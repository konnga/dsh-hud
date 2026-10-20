/** 浏览器半用例：diff（24 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMiniReact } from './mini-react.mjs'
import {
  COMMITS,
  COMMIT_DIFF_VALUE,
  COMMIT_VALUE,
  T,
  byClass,
  byText,
  commitDiffState,
  diffFixture,
  diffState,
  fakeNode,
  fakeStore,
  findAll,
  findButton,
  findByAttr,
  flush,
  keyEvent,
  mountArmedPanel,
  mountClient,
  mountPanel,
  multiHunkDiffValue,
  multiHunkState,
  panelKeydown,
  realStore,
  renderPanel,
  statusFixture,
  textOf,
} from './client-harness.mjs'

test('三栏的收缩规则写在样式表里：左栏固定，明细栏与差异栏一起被压缩', () => {
  const { styles } = mountClient()
  const css = styles[0].textContent
  const pane = /\.dshh-commitpane\{[^}]*\}/.exec(css)?.[0] ?? ''

  // 左栏是主面板（flex:none + 固定宽度），中间栏必须可收缩，否则窄窗口下会把左栏挤出面板。
  assert.ok(pane.includes('flex:0 1 auto'), `明细栏要可收缩，实际 ${pane}`)
  assert.ok(pane.includes('min-width:0'), 'flex 子项不写 min-width:0 就不肯缩到内容以下')
  assert.ok(/\.dshh-leftpane\{[^}]*flex:none/.test(css), '左栏保持固定宽度')
})

test('差异视图：行号、文本与增删底色', () => {
  const node = renderPanel(diffState())

  const text = textOf(node)
  assert.ok(text.includes('+2') && text.includes('-1'), '显示增删计数')
  assert.ok(text.includes('keep') && text.includes('new') && text.includes('more'))
  assert.ok(text.includes('panel.summary'), '改动概览仍在（它就是左栏不可变的那部分）')

  // 两个行号槽：上下文行两侧都有行号，删除行只有旧行号，新增行只有新行号。
  const ctx = findAll(node, byClass('dshh-difrow')).find((row) =>
    row.props.className.includes('dshh-difrow-ctx'),
  )
  const gutters = ctx.children.filter(
    (child) => child.props && child.props.className === 'dshh-difno',
  )
  assert.deepEqual(
    gutters.map((gutter) => gutter.children[0]),
    ['1', '1'],
  )

  const del = findAll(node, byClass('dshh-difrow')).find((row) =>
    row.props.className.includes('dshh-difrow-del'),
  )
  assert.deepEqual(
    del.children.filter((c) => c.props?.className === 'dshh-difno').map((g) => g.children[0]),
    ['2', ''],
  )
  assert.ok(del.props.style.background.includes('rgba'), '删除行有底色')

  const add = findAll(node, byClass('dshh-difrow')).find((row) =>
    row.props.className.includes('dshh-difrow-add'),
  )
  assert.ok(add.props.style.background.includes('rgba'), '新增行有底色')

  // 空文本行用不换行空格占位，否则行高会塌掉。
  const metaRows = findAll(node, byClass('dshh-difrow-meta'))
  assert.ok(metaRows.length >= 1)
})

test('差异视图：页签、自动换行、返回都走 store', () => {
  const calls = { side: [], wrap: 0, close: 0 }
  const node = renderPanel(diffState(), {
    methods: {
      setDiffSide: (side) => calls.side.push(side),
      toggleDiffWrap: () => {
        calls.wrap += 1
      },
      closeDetail: () => {
        calls.close += 1
      },
    },
  })

  findAll(node, byText('diff.index'))[0].props.onClick()
  findAll(node, byText('diff.worktree'))[0].props.onClick()
  assert.deepEqual(calls.side, ['index', 'worktree'])

  findAll(node, byText('diff.wrap'))[0].props.onClick()
  assert.equal(calls.wrap, 1)

  // ✕ 是"收起右栏"：提交明细在场时它整体退掉，否则只关差异（见 closeDetail）。
  findButton(node, 'diff.close').props.onClick()
  assert.equal(calls.close, 1)
})

test('差异视图：复制的是重建后的 unified diff 文本', async () => {
  const { bundle } = (() => {
    const mini = createMiniReact()
    return { bundle: mountClient({ ReactImpl: mini.React }) }
  })()
  const tree = (() => {
    const node = renderPanel(diffState())
    return findAll(node, byText('diff.copy'))[0]
  })()

  // 用带真实 hooks 的挂载来跑点击后的状态更新与剪贴板写入。
  const mini = createMiniReact()
  const harness = mountClient({ ReactImpl: mini.React })
  const store = { ...fakeStore({ ...diffState(), panelOpen: true }), toggleDiffWrap: () => {} }
  const mounted = mini.mount(harness.components['dsh-hud-panel'], { t: T, store })
  const copyButton = findAll(mounted, byText('diff.copy'))[0]
  copyButton.props.onClick()
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(harness.clipboardWrites.length, 1)
  assert.equal(
    harness.clipboardWrites[0],
    ['diff --git a/a.ts b/a.ts', '@@ -1,2 +1,3 @@', ' keep', '-old', '+new', '+more'].join('\n'),
  )
  assert.ok(tree, '静态渲染下也应能找到复制按钮')
  assert.ok(bundle)
})

test('差异视图：未跟踪文件隐藏已暂存页签并给出说明', () => {
  const node = renderPanel(diffState({ data: diffFixture({ untracked: true }), side: 'worktree' }))
  assert.equal(findAll(node, byText('diff.index')).length, 0, '未跟踪没有已暂存一侧')
  assert.ok(textOf(node).includes('diff.untrackedHint'))
})

test('差异视图：二进制、空、错误、读取中各有文案', () => {
  // 二进制不再直接给一句文案，而是交给图片预览（静态渲染下停在"读取图片…"）。
  const binary = renderPanel(
    diffState({
      data: diffFixture({
        worktree: {
          rows: [{ kind: 'meta', text: 'Binary files differ', oldLine: null, newLine: null }],
          additions: 0,
          deletions: 0,
          hunks: 0,
          binary: true,
          truncated: false,
        },
      }),
    }),
  )
  assert.ok(findByAttr(binary, 'image'), '二进制改动要挂到图片预览上')
  assert.ok(textOf(binary).includes('image.loading'), '取件期间说"读取图片"')

  const empty = renderPanel(
    diffState({
      data: diffFixture({
        worktree: {
          rows: [],
          additions: 0,
          deletions: 0,
          hunks: 0,
          binary: false,
          truncated: false,
        },
      }),
    }),
  )
  assert.ok(textOf(empty).includes('diff.empty'))

  const loading = renderPanel(diffState({ phase: 'loading', data: null }))
  assert.ok(textOf(loading).includes('panel.loading'))

  const failed = renderPanel(diffState({ phase: 'error', data: null, errorCode: 'timeout' }))
  assert.ok(textOf(failed).includes('err.timeout'))
})

test('差异视图：截断时给出提示', () => {
  const node = renderPanel(
    diffState({ data: diffFixture({ worktree: { ...diffFixture().worktree, truncated: true } }) }),
  )
  assert.ok(textOf(node).includes('diff.truncated'))
})

test('hunk：可点、带序号、折叠标记按状态翻转', () => {
  const toggled = []
  const node = renderPanel(multiHunkState({ collapsed: [1] }), {
    methods: { toggleHunk: (index) => toggled.push(index) },
  })

  const hunks = findAll(node, byClass('dshh-difrow-hunk'))
  assert.equal(hunks.length, 3, '三个 hunk 头都在（折叠的也留着头）')
  assert.deepEqual(
    hunks.map((row) => row.props['data-dsh-hud']),
    ['hunk', 'hunk', 'hunk'],
  )
  assert.deepEqual(
    hunks.map((row) => row.props['data-hunk-index']),
    ['0', '1', '2'],
    '序号是渲染顺序，不是行号',
  )

  const marks = findAll(node, byClass('dshh-hunkMark')).map((mark) => textOf(mark))
  assert.deepEqual(marks, ['▾', '▸', '▾'], '折叠的那个是 ▸')

  // 点 hunk 头 = 折叠 / 展开它。
  hunks[2].props.onClick()
  assert.deepEqual(toggled, [2])
})

test('hunk：折叠只收起那一段，文件头与别的 hunk 照常显示', () => {
  const open = textOf(renderPanel(multiHunkState()))
  assert.ok(
    open.includes('first-hunk') && open.includes('second-hunk') && open.includes('third-hunk'),
  )

  const folded = textOf(renderPanel(multiHunkState({ collapsed: [1] })))
  assert.ok(folded.includes('first-hunk'), '别的 hunk 的内容还在')
  assert.ok(folded.includes('third-hunk'))
  assert.ok(!folded.includes('second-hunk'), '被折叠那段的正文不渲染')
  assert.ok(folded.includes('diff --git a/a.ts b/a.ts'), 'hunk 之前的文件头永远显示')
  assert.ok(folded.includes('@@ -10,1 +10,1 @@'), '折叠的头本身还在（要能点回来）')
})

test('hunk：当前 hunk 高亮，且不是折叠中的那个', () => {
  const active = renderPanel(multiHunkState({ hunk: 2 }))
  const activeRows = findAll(active, byClass('dshh-difrow-hunkActive'))
  assert.equal(activeRows.length, 1, '只有一个当前 hunk')
  assert.equal(activeRows[0].props['data-hunk-index'], '2')

  // 当前 hunk 正好被折叠时不标"当前"（不然用户看不到内容却看到高亮）。
  const foldedActive = renderPanel(multiHunkState({ hunk: 1, collapsed: [1] }))
  assert.equal(findAll(foldedActive, byClass('dshh-difrow-hunkActive')).length, 0)
})

test('清单：键盘选中用描边，正在看的差异用底色，两者可以同时在不同行上', () => {
  const node = renderPanel({ ...multiHunkState(), cursor: 'new file.txt' })
  const rows = findAll(node, byClass('dshh-row'))
  assert.deepEqual(
    rows.map((row) => row.props['data-row-index']),
    ['0', '1'],
    '行带序号（键盘把它滚回视野要用）',
  )

  const active = findAll(node, byClass('dshh-rowActive'))
  const cursor = findAll(node, byClass('dshh-rowCursor'))
  assert.equal(active.length, 1, '正在看的是 src/a.ts')
  assert.ok(active[0].props.title.startsWith('src/a.ts'))
  assert.equal(cursor.length, 1, '键盘选中的是另一行')
  assert.ok(cursor[0].props.title.startsWith('new file.txt'))
  assert.notEqual(active[0], cursor[0])
})

test('键盘移动（store）：↑/↓ 在工作区清单里走，到底就停住', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'diff') return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')
  await store.refresh()

  // 还没选过：向下落在第一条，向上落在最后一条。
  assert.equal(store.stepFile(1, false).file, 'src/a.ts')
  assert.equal(store.getSnapshot().cursor, 'src/a.ts')
  assert.equal(store.stepFile(1, false).file, 'new file.txt')
  assert.equal(store.stepFile(1, false).file, 'new file.txt', '到底了就停住，不绕回')
  assert.equal(store.stepFile(-1, false).file, 'src/a.ts')
  assert.equal(store.getSnapshot().diff, null, '只移动不打开')
  assert.equal(store.stepFile(-1, false).file, 'src/a.ts', '到顶了也停住')

  assert.equal(store.stepFile(1, true).file, 'new file.txt', '移动并打开')
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'new file.txt')
  assert.deepEqual(
    calls.filter((call) => call.endpoint === 'diff').map((call) => call.args.path),
    ['new file.txt'],
  )
})

test('键盘移动（store）：还没选过时 ↑ 落在最后一条', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.refresh()

  assert.equal(store.stepFile(-1, false).file, 'new file.txt', '↑ 先落在最后一条，用户不必先点一行')
})

test('键盘移动（store）：清单跟着视图走——提交页里返回的是这次提交的文件', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: COMMIT_VALUE })
      if (endpoint === 'commit-diff') return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'sha-1', subject: 'feat: 有改动' })

  assert.equal(store.getSnapshot().cursor, 'src/a.ts', '打开提交时顺手选中了第一个文件')
  const next = store.stepFile(1, true)
  assert.equal(next.file, 'b.txt')
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'b.txt')
  assert.equal(
    calls.filter((call) => call.endpoint === 'diff').length,
    0,
    '提交视图里不该去问工作区差异',
  )
  assert.deepEqual(
    calls.filter((call) => call.endpoint === 'commit-diff').map((call) => call.args.path),
    ['src/a.ts', 'b.txt'],
  )
})

test('键盘移动（store）：Enter 打开选中的那条，还没选过就打开第一条', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.refresh()

  store.openCursor()
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'src/a.ts', '没选过就打开第一条')
  assert.equal(store.getSnapshot().cursor, 'src/a.ts')

  store.stepFile(1, false)
  assert.equal(store.getSnapshot().cursor, 'new file.txt', '↑/↓ 先把选中的那行挪过去')
  store.openCursor()
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'new file.txt')
  assert.deepEqual(
    calls.filter((call) => call.endpoint === 'diff').map((call) => call.args.path),
    ['src/a.ts', 'new file.txt'],
  )
})

test('hunk 移动（store）：n/p 在 hunk 之间走，跳到折叠的那个会展开它', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openDiff({ file: 'src/a.ts', path: 'src/a.ts' })

  assert.equal(store.getSnapshot().diff.hunk, 0, '刚打开时落在第一个 hunk')
  assert.deepEqual(store.getSnapshot().diff.collapsed, [])

  store.stepHunk(1)
  assert.equal(store.getSnapshot().diff.hunk, 1)
  store.stepHunk(1)
  assert.equal(store.getSnapshot().diff.hunk, 2)
  store.stepHunk(1)
  assert.equal(store.getSnapshot().diff.hunk, 2, '到最后一个就停住')
  store.stepHunk(-1)
  store.stepHunk(-1)
  store.stepHunk(-1)
  assert.equal(store.getSnapshot().diff.hunk, 0, '到第一个也停住')

  store.toggleHunk(1)
  assert.deepEqual(store.getSnapshot().diff.collapsed, [1])
  assert.equal(store.getSnapshot().diff.hunk, 1, '折叠某个 hunk 也把它变成当前 hunk')
  store.stepHunk(-1)
  store.stepHunk(1)
  assert.deepEqual(
    store.getSnapshot().diff.collapsed,
    [],
    '跳回折叠中的 hunk 要展开它，否则按键像没反应',
  )

  store.toggleHunk(1)
  store.toggleHunk(1)
  assert.deepEqual(store.getSnapshot().diff.collapsed, [], '再点一次就展开')
})

test('hunk 移动（store）：换文件、换侧都会重置当前 hunk 与折叠', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openDiff({ file: 'src/a.ts', path: 'src/a.ts' })
  store.stepHunk(2)
  store.toggleHunk(1)
  assert.equal(store.getSnapshot().diff.hunk, 1)

  store.setDiffSide('index')
  assert.equal(store.getSnapshot().diff.hunk, 0, '换侧等于换了一份 rows')
  assert.deepEqual(store.getSnapshot().diff.collapsed, [])

  store.setDiffSide('worktree')
  store.stepHunk(2)
  await store.openDiff({ file: 'new file.txt', path: 'new file.txt' })
  assert.equal(store.getSnapshot().diff.hunk, 0, '换文件也回到第一个 hunk')
  assert.deepEqual(store.getSnapshot().diff.collapsed, [])

  // 没有差异 / 没有 hunk 时按键就是 no-op，不抛错。
  store.closeDiff()
  store.stepHunk(1)
  store.toggleHunk(0)
  assert.equal(store.getSnapshot().diff, null)
})

test('工作台：左栏常驻改动清单，右栏是差异，打开差异不换掉清单', () => {
  const node = renderPanel(diffState())

  assert.equal(findAll(node, byClass('dshh-workbench')).length, 1, '两栏容器')
  assert.equal(findAll(node, byClass('dshh-leftpane')).length, 1, '左栏')
  assert.equal(findAll(node, byClass('dshh-diffview')).length, 1, '右栏')

  // 清单两行仍在左栏里（这正是"打开 diff 不关闭主面板"的含义）。
  const rows = findAll(node, byClass('dshh-row'))
  assert.equal(rows.length, 2, '左栏仍然列出全部改动')
  assert.ok(textOf(node).includes('src/a.ts'), '清单路径可见')
  assert.ok(textOf(node).includes('keep'), '差异内容同时可见')

  // 正在看的文件在左栏高亮。
  const active = findAll(node, byClass('dshh-rowActive'))
  assert.equal(active.length, 1, '当前文件高亮')
  assert.ok(active[0].props.title.startsWith('src/a.ts'), '高亮的是正在看的那个文件')

  // 点击左栏另一行即可切换差异，不需要先返回。
  assert.equal(typeof rows[0].props.onClick, 'function')
})

test('工作台：拖动右边缘改差异宽度，松手才落盘', () => {
  const { tree, bundle, calls } = mountPanel({
    ...(diffState().diff === null ? {} : {}),
    diff: diffState().diff,
  })
  const grip = findAll(tree, byClass('dshh-grip'))[0]

  let prevented = false
  grip.props.onPointerDown({
    button: 0,
    pointerId: 9,
    clientX: 1000,
    preventDefault: () => {
      prevented = true
    },
  })
  assert.equal(prevented, true, '抓握按下要阻止文本选择')

  const move = bundle.listeners.get('pointermove')?.[0]?.listener
  const up = bundle.listeners.get('pointerup')?.[0]?.listener
  assert.equal(typeof move, 'function', '按下后注册 window 拖动监听')

  move({ pointerId: 9, clientX: 940 })
  assert.deepEqual(calls.diffWidth, [530], '往左拖 60px → 差异栏 470 + 60')

  up({ pointerId: 9 })
  assert.equal(calls.persist, 1, '松手落盘')
  assert.equal(bundle.listeners.get('pointermove')?.length ?? 0, 0, '松手解除监听')
})

test('键盘：Space 折叠当前 hunk；带修饰键与输入中的按键都不碰', () => {
  const { bundle, calls } = mountArmedPanel({ diff: diffState({ hunk: 2 }).diff })
  const keydown = panelKeydown(bundle)

  keydown(keyEvent(' '))
  assert.deepEqual(calls.toggleHunk, [2], 'Space 作用于当前 hunk')

  // contenteditable（产品的输入框）里打字：一个字都不能吞。
  const typing = keyEvent(' ', {
    target: fakeNode(null, { tagName: 'DIV', isContentEditable: true }),
  })
  keydown(typing)
  assert.deepEqual(calls.toggleHunk, [2], '输入时不再接管')
  assert.equal(typing.prevented, undefined)

  // 带修饰键的组合交给产品与浏览器。
  keydown(keyEvent('n', { metaKey: true }))
  keydown(keyEvent('n', { ctrlKey: true }))
  keydown(keyEvent('n', { altKey: true }))
  assert.deepEqual(calls.stepHunk, [], 'Cmd/Ctrl/Alt 组合不接管')
})

test('工作台：没有差异时不渲染两栏，也没有抓握', () => {
  const node = renderPanel({ diff: null })
  assert.equal(findAll(node, byClass('dshh-workbench')).length, 0)
  assert.equal(findAll(node, byClass('dshh-grip')).length, 0)
  assert.equal(node.props.style.width, 380, '回到紧凑清单宽度')
})

test('工作台：左栏保留仓库路径与提交段，不只留计数和清单', () => {
  const node = renderPanel({ ...diffState(), commits: COMMITS })
  const leftText = textOf(findAll(node, byClass('dshh-leftpane'))[0])

  assert.ok(leftText.includes('/Users/me/project'), '仓库路径')
  assert.ok(leftText.includes('panel.upstream'), '上游')
  assert.ok(leftText.includes('panel.summary'), '改动概览标题')
  assert.ok(leftText.includes('panel.commits'), '最近提交段')
  assert.ok(leftText.includes('panel.changes'), '改动清单')
})

test('工作台：拖动提交栏右边那条抓握改它的宽度，松手才落盘', () => {
  const state = commitDiffState()
  const { tree, bundle, calls } = mountPanel(state)
  const inner = findAll(tree, (item) => item.props?.['data-dsh-hud'] === 'grip-commit')[0]
  assert.ok(inner, '三栏时提交栏右边有一条抓握')

  inner.props.onPointerDown({ button: 0, pointerId: 7, clientX: 800, preventDefault: () => {} })
  const move = bundle.listeners.get('pointermove')?.[0]?.listener
  const up = bundle.listeners.get('pointerup')?.[0]?.listener
  move({ pointerId: 7, clientX: 740 })
  assert.deepEqual(calls.commitWidth, [300], '往左拖 60px → 提交栏 240 + 60')
  assert.deepEqual(calls.diffWidth, [], '不该动差异栏')

  up({ pointerId: 7 })
  assert.equal(calls.persist, 1, '松手落盘')
})

test('工作台：提交栏宽度按存档恢复，并有最小值下限', () => {
  const narrow = renderPanel({ ...commitDiffState(), commitWidth: 40 })
  // 40 小于下限 180 → 面板宽度按 180 算（否则路径全被截成一个字）。
  assert.equal(narrow.props.style.width, 380 + 180 + 6 + 470 + 6)

  // 用 300 而不是更大的值：面板总宽会被视口钳住（harness 的 innerWidth 约 1216），
  // 420 那一档会被钳到 1184，反而看不出"存档里的宽度有没有生效"。
  const wide = renderPanel({ ...commitDiffState(), commitWidth: 300 })
  assert.equal(wide.props.style.width, 380 + 300 + 6 + 470 + 6, '存档里的宽度要生效')
  assert.equal(
    findAll(wide, byClass('dshh-commitpane'))[0].props.style.width,
    300,
    '栏自己按存档宽度渲染',
  )
})
