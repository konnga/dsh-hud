/** 浏览器半用例：panel（27 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMiniReact } from './mini-react.mjs'
import {
  T,
  byClass,
  byText,
  cssRule,
  diffState,
  fakeNode,
  fakeStore,
  findAll,
  findButton,
  findByAttr,
  keyEvent,
  mountArmedPanel,
  mountClient,
  mountPanel,
  panelKeydown,
  renderPanel,
  renderPill,
  statusFixture,
  textOf,
} from './client-harness.mjs'

test('胶囊：简写符各自上色，与面板计数同色', () => {
  const node = renderPill()
  const marks = []
  const walk = (child) => {
    if (child === null || typeof child !== 'object') return
    if (Array.isArray(child)) return child.forEach(walk)
    if (child.props && child.props.style && child.props.style.color)
      marks.push({ text: child.children?.[0], color: child.props.style.color })
    for (const grand of child.children || []) walk(grand)
  }
  walk(node.children)

  const byText = Object.fromEntries(marks.map((mark) => [mark.text, mark.color]))
  assert.ok(byText.M2?.includes('state-warn'), `M 应为警告色，实际 ${JSON.stringify(byText)}`)
  assert.ok(byText.A1?.includes('state-success'), 'A 应为成功色')
  assert.ok(
    byText['?1']?.includes('label-secondary'),
    `? 用次级文字色（label-dimmed 是反相的表面色：浅 1.26:1 / 深 1.64:1，压在面板底色上看不见），实际 ${JSON.stringify(byText['?1'])}`,
  )
})

test('胶囊：点击开关面板', () => {
  let toggled = 0
  const node = renderPill(
    {},
    {
      methods: {
        togglePanel: () => {
          toggled += 1
        },
      },
    },
  )
  findByAttr(node, 'pill').props.onClick()
  assert.equal(toggled, 1)
})

test('面板：收起时渲染 null，不留挡住输入框的气泡', () => {
  assert.equal(renderPanel({ panelOpen: false }), null)
})

test('面板：正常状态列出计数与改动清单', () => {
  const node = renderPanel()
  assert.ok(findByAttr(node, 'panel'), '面板根节点应带 data-dsh-hud="panel"')

  const text = textOf(node)
  assert.ok(text.includes('panel.title'))
  assert.ok(text.includes('main'), '标题栏显示分支')
  assert.ok(text.includes('/Users/me/project'), '显示仓库路径')
  assert.ok(text.includes('count.modified 2'), `期望已修改计数，实际 ${JSON.stringify(text)}`)
  assert.ok(text.includes('count.added 1'))
  assert.ok(text.includes('count.untracked 1'))
  assert.ok(!text.includes('count.deleted'), '零值计数不渲染')
  assert.ok(text.includes('src/a.ts'), '改动清单列出路径')
  assert.ok(text.includes('new file.txt'), '含空格的路径原样保留')
  assert.ok(text.includes('panel.readonly'), '底栏声明只读')
})

test('面板：干净仓库给出明确空状态', () => {
  const text = textOf(
    renderPanel({
      status: statusFixture({
        dirty: false,
        ahead: 0,
        behind: 0,
        changes: [],
        counts: {
          modified: 0,
          added: 0,
          deleted: 0,
          renamed: 0,
          copied: 0,
          typeChanged: 0,
          untracked: 0,
          conflicted: 0,
        },
      }),
    }),
  )
  assert.ok(text.includes('panel.clean'))
})

test('面板：非仓库、未绑定、读取中与失败各有文案', () => {
  assert.ok(textOf(renderPanel({ status: { repo: null } })).includes('panel.notRepo'))
  assert.ok(textOf(renderPanel({ cwd: null, status: null })).includes('panel.noSession'))
  assert.ok(textOf(renderPanel({ phase: 'loading', status: null })).includes('panel.loading'))
})

test('面板：宿主半的失败码翻译成本地化文案', () => {
  for (const [code, key] of [
    ['timeout', 'err.timeout'],
    ['no-cwd', 'err.no-cwd'],
    ['git-missing', 'err.git-missing'],
    ['invalid-cwd', 'err.invalid-cwd'],
    ['invalid-path', 'err.invalid-path'],
    ['unknown-endpoint', 'err.stale-host'],
    ['transport', 'err.transport'],
  ]) {
    assert.ok(
      textOf(renderPanel({ phase: 'error', errorCode: code, status: null })).includes(key),
      `${code} → ${key}`,
    )
  }
  // 认不出的码回退到通用文案，而不是把机器码丢给用户。
  assert.ok(
    textOf(renderPanel({ phase: 'error', errorCode: 'weird', status: null })).includes(
      'err.git-failed',
    ),
  )
})

test('面板：锚定在输入框上方，未拖动时不写死坐标', () => {
  const node = renderPanel()
  assert.equal(node.props.style.position, 'fixed')
  assert.equal(node.props.style.bottom, 168)
  assert.equal(node.props.style.pointerEvents, 'auto', '浮动层本身是 click-through，占用者要自己开')
})

test('面板：拖动过则改为显式坐标，标题栏承载拖动与复位', () => {
  let reset = 0
  const node = renderPanel(
    { pos: { left: 40, top: 60 } },
    {
      methods: {
        resetPanel: () => {
          reset += 1
        },
      },
    },
  )
  assert.equal(node.props.style.left, 40)
  assert.equal(node.props.style.top, 60)
  assert.equal(node.props.style.bottom, undefined)

  const header = node.children[0]
  assert.equal(header.props.style, undefined, '标题栏样式来自样式表，不写内联')
  assert.equal(typeof header.props.onPointerDown, 'function')
  assert.equal(typeof header.props.onDoubleClick, 'function')
  header.props.onDoubleClick()
  assert.equal(reset, 1, '双击标题栏复位位置')
})

test('面板：✕ 按钮的 onClick 直接收起面板', () => {
  const { tree, calls } = mountPanel()
  const close = findButton(tree, 'panel.close')
  assert.ok(close, '必须能找到关闭按钮')
  close.props.onClick()
  assert.deepEqual(calls.openPanel, [false])
})

test('交互：按在按钮上不会开始拖动（回归：指针捕获曾让 ✕ 永远点不动）', () => {
  const { tree, bundle } = mountPanel()
  const header = tree.children[0]
  const captured = []
  const fakeButton = {
    closest: (selector) => (selector === 'button' ? { tagName: 'BUTTON' } : null),
  }

  header.props.onPointerDown({
    button: 0,
    pointerId: 1,
    clientX: 500,
    clientY: 300,
    target: fakeButton,
    currentTarget: {
      setPointerCapture: (id) => captured.push(id),
      parentNode: { getBoundingClientRect: () => ({ left: 400, top: 200 }) },
    },
  })

  assert.deepEqual(captured, [], '绝不能捕获指针：捕获会把 click 重定向到头部，按钮就失效了')
  assert.equal(bundle.listeners.has('pointermove'), false, '按在按钮上不应开始拖动')
})

test('交互：在头部按下并移动才拖动，松开时落盘', () => {
  const { tree, bundle, calls } = mountPanel()
  const header = tree.children[0]

  header.props.onPointerDown({
    button: 0,
    pointerId: 7,
    clientX: 500,
    clientY: 300,
    target: { closest: () => null },
    currentTarget: { parentNode: { getBoundingClientRect: () => ({ left: 400, top: 200 }) } },
  })

  const move = bundle.listeners.get('pointermove')?.[0]?.listener
  const up = bundle.listeners.get('pointerup')?.[0]?.listener
  assert.equal(typeof move, 'function', '按下后应注册 window 拖动监听')
  assert.equal(typeof up, 'function')

  // 小于阈值：不改变位置（头部上的普通点击不是拖动）。
  move({ pointerId: 7, clientX: 501, clientY: 301 })
  assert.deepEqual(calls.movePanel, [], '3px 以内不算拖动')

  move({ pointerId: 7, clientX: 460, clientY: 260 })
  assert.equal(calls.movePanel.length, 1)
  assert.deepEqual(
    calls.movePanel[0],
    { left: 360, top: 160 },
    '位置 = 指针 - 按下时的偏移，并夹进视口',
  )

  up({ pointerId: 7 })
  assert.deepEqual(calls.commitPanel, [{ left: 360, top: 160 }], '松开时把位置落盘')
  // 松开后应解除 window 监听。
  assert.equal(bundle.listeners.get('pointermove')?.length ?? 0, 0)
})

test('交互：Esc 收起面板，且在捕获阶段监听（焦点在任何输入框里也能收到）', () => {
  const { bundle, calls } = mountPanel()
  const entries = bundle.listeners.get('keydown') ?? []
  assert.equal(entries.length, 2, '两条：输入框 ↑ 召回（apply 时）+ 面板（挂载时）')

  const panel = entries[entries.length - 1]
  assert.equal(panel.opts, true, '必须用捕获阶段')

  panel.listener({ key: 'Escape' })
  assert.deepEqual(calls.openPanel, [false])

  panel.listener({ key: 'a' })
  assert.deepEqual(calls.openPanel, [false], '其他按键不关面板')
})

test('交互：面板收起时不注册任何面板级监听', () => {
  const { bundle } = mountPanel({ panelOpen: false })
  const keydowns = bundle.listeners.get('keydown') ?? []
  assert.equal(keydowns.length, 1, '只剩输入框 ↑ 召回那一条 —— 面板收起时它自己不注册')
  assert.equal(bundle.listeners.has('pointermove'), false)

  // 而剩下那条对"不在输入框里"的按键完全不介入 —— 这就是"面板收起时按键照常"的含义。
  const event = keyEvent('ArrowUp', { target: fakeNode() })
  keydowns[0].listener(event)
  assert.equal(event.prevented, undefined)
})

test('清单：点击一行以该改动打开差异', () => {
  const opened = []
  const node = renderPanel({}, { methods: { openDiff: (change) => opened.push(change) } })
  const rows = findAll(node, byClass('dshh-row'))
  assert.equal(rows.length, 2, '两个改动各一行')
  rows[0].props.onClick()
  assert.equal(opened.length, 1)
  assert.equal(opened[0].file, 'src/a.ts')
  assert.equal(opened[0].path, 'src/a.ts')
})

test('面板：量到胶囊位置就贴到它上方，量不到退回 168px', () => {
  const anchored = renderPanel({ anchorTop: 500 })
  assert.equal(anchored.props.style.bottom, 800 - 500 + 8, 'bottom = 视口高 - dock 顶部 + 间距')

  const fallback = renderPanel({ anchorTop: null })
  assert.equal(fallback.props.style.bottom, 168, 'dsh-git 记录的那次测量作为兜底')
})

test('面板：打开时测量自己的 dock 行并写进 store', () => {
  const mini = createMiniReact()
  const bundle = mountClient({ ReactImpl: mini.React, dockRect: { top: 420 } })
  const seen = []
  const store = {
    ...fakeStore({
      ...(diffState().diff === null ? {} : {}),
      phase: 'ready',
      sessionId: 's',
      cwd: '/x',
      panelOpen: true,
      status: statusFixture(),
      diff: null,
      anchorTop: null,
    }),
    setAnchorTop: (top) => seen.push(top),
  }
  mini.mount(bundle.components['dsh-hud-panel'], { t: T, store })
  assert.deepEqual(seen, [420], '应把量到的顶部坐标交给 store')
})

test('面板：量不到 dock 行时写 null，退回常量锚点', () => {
  const mini = createMiniReact()
  const bundle = mountClient({ ReactImpl: mini.React })
  const seen = []
  const store = {
    ...fakeStore({
      phase: 'ready',
      sessionId: 's',
      cwd: '/x',
      panelOpen: true,
      status: statusFixture(),
      diff: null,
      anchorTop: null,
    }),
    setAnchorTop: (top) => seen.push(top),
  }
  mini.mount(bundle.components['dsh-hud-panel'], { t: T, store })
  assert.deepEqual(seen, [null])
})

test('面板：差异模式更宽、且用固定高度（避免 bottom 锚定下跳位）', () => {
  const list = renderPanel({ anchorTop: null })
  assert.equal(list.props.style.width, 380)
  assert.equal(list.props.style.height, undefined, '清单模式跟着内容')
  assert.equal(list.props.style.maxHeight, '62vh')

  const diff = renderPanel({ ...diffState(), anchorTop: null })
  assert.ok(diff.props.style.width > 380, '差异模式更宽')
  assert.equal(typeof diff.props.style.height, 'number', '差异模式固定高度')
  const spaceAbove = 800 - 168 - 8
  assert.ok(diff.props.style.height <= spaceAbove, '高度不超过胶囊上方的可用空间')
  assert.equal(diff.props.style.maxHeight, undefined, '固定高度就不该再给 max-height')
})

test('工作台：面板右边缘有抓握，宽度 = 左栏 + 抓握 + 差异栏', () => {
  const node = renderPanel(diffState())
  const grip = findAll(node, byClass('dshh-grip'))
  assert.equal(grip.length, 1, '右边缘抓握')
  assert.equal(grip[0].props['data-dsh-hud'], 'grip')
  assert.equal(typeof grip[0].props.onPointerDown, 'function')

  assert.equal(node.props.style.width, 380 + 6 + 470, '左栏与单栏同为 380px，差异栏默认 470px')
  assert.equal(node.props.style.position, 'fixed', '抓握是绝对定位，依赖面板自身定位')
})

test('键盘：没在面板里点过就不接管按键（打字、翻菜单、滚会话都不受影响）', () => {
  const { bundle, calls } = mountPanel({ diff: diffState().diff })
  const keydown = panelKeydown(bundle)

  const event = keyEvent('ArrowDown', { target: fakeNode() })
  keydown(event)
  assert.deepEqual(calls.stepFile, [], '没激活就一个键都不该动')
  assert.equal(event.prevented, undefined)

  // 但 Esc 例外：老行为是"焦点在输入框里也收得到"。
  keydown(keyEvent('Escape', { target: fakeNode() }))
  assert.equal(calls.closeDiff, 1)
})

test('键盘：在面板里点过之后 ↑/↓ 选行、Enter 打开、[/] 移动并打开', () => {
  const { bundle, calls } = mountArmedPanel({ diff: diffState().diff })
  const keydown = panelKeydown(bundle)
  const press = (key, extra = {}) => {
    const event = keyEvent(key, extra)
    keydown(event)
    return event
  }

  assert.equal(press('ArrowDown').prevented, true, '认领的键要阻止默认滚动')
  assert.equal(press('ArrowUp').stopped, true, '也不该再让产品处理一遍')
  assert.deepEqual(
    calls.stepFile,
    [
      [1, false],
      [-1, false],
    ],
    '↑/↓ 只移动，不打开',
  )

  press('Enter')
  assert.equal(calls.openCursor, 1, 'Enter 打开选中的那条')

  press(']')
  press('[')
  assert.deepEqual(
    calls.stepFile.slice(2),
    [
      [1, true],
      [-1, true],
    ],
    '[/] 移动并直接打开',
  )

  press('n')
  press('p')
  assert.deepEqual(calls.stepHunk, [1, -1], 'n/p 跳 hunk')

  press('r')
  assert.equal(calls.refresh, 1, 'r 刷新')

  // 认不出的键不接管。
  const other = press('x')
  assert.equal(other.prevented, undefined)
})

test('键盘：Tab 进面板也算激活（activeElement 在面板里）', () => {
  const { bundle, calls } = mountPanel({ diff: diffState().diff })
  const keydown = panelKeydown(bundle)

  bundle.documentStub.activeElement = fakeNode('panel')
  keydown(keyEvent('n'))
  assert.deepEqual(calls.stepHunk, [1], '不用先点一下也能用键盘')

  // 点到面板外面就把按键交还（下一次 pointerdown 会重置这个标记）。
  bundle.documentStub.activeElement = null
  bundle.listeners.get('pointerdown')[0].listener({ target: fakeNode() })
  keydown(keyEvent('n'))
  assert.deepEqual(calls.stepHunk, [1], '在别处点过之后不再接管')
})

test('键盘：面板收起时连指针监听都不注册', () => {
  const { bundle } = mountPanel({ panelOpen: false })
  assert.equal(bundle.listeners.has('pointerdown'), false)
})

test('工作台：Esc 是"退一层"——先关差异，再按才收起面板', () => {
  const { bundle, calls } = mountPanel({ diff: diffState().diff })
  const keydown = panelKeydown(bundle)
  assert.equal(typeof keydown, 'function')

  keydown({ key: 'Escape' })
  assert.equal(calls.closeDiff, 1, '先关差异')
  assert.deepEqual(calls.openPanel, [], '此时不该收起面板')

  keydown({ key: 'a' })
  assert.equal(calls.closeDiff, 1, '其他按键不动它')
})

test('工作台：左栏与单栏面板逐字一致——点击不改变左栏', () => {
  const single = renderPanel({ diff: null })
  const withDiff = renderPanel(diffState())

  const singleBody = findAll(single, byClass('dshh-body'))[0]
  const leftPane = findAll(withDiff, byClass('dshh-leftpane'))[0]
  assert.ok(singleBody && leftPane)

  assert.equal(
    textOf(leftPane),
    textOf(singleBody),
    '左栏内容必须与单栏视图完全相同（仓库路径、上游、oid、改动概览、提交、清单一个都不少）',
  )

  // 宽度也一致：左栏就是原来那个面板，不因打开差异而变窄。
  assert.equal(leftPane.props.style.width, 380)
  assert.equal(single.props.style.width, 380)

  // 只有差异栏是"新出现"的东西。
  assert.equal(findAll(single, byClass('dshh-diffview')).length, 0)
  assert.equal(findAll(withDiff, byClass('dshh-diffview')).length, 1)
})

test('改动概览：计数芯片之间有间隔，不与相邻胶囊贴住', () => {
  // 用解析出来的规则断言：只测"文本里有 12px"会假绿 —— 规则被吞掉时文本照样在。
  const chips = cssRule('.dshh-chips')
  const chip = cssRule('.dshh-chip')

  assert.ok(
    chips,
    '这条规则必须真的成立（曾经因为删规则留下尾巴被浏览器整条吞掉，肉眼就是"没间隔"）',
  )
  assert.ok(chips.body.includes('display:flex'), `芯片行要是 flex 容器（现在 ${chips.body}）`)
  assert.ok(chips.body.includes('gap:6px 12px'), `横向间隔要够（现在 ${chips.body}）`)
  assert.ok(chip && chip.body.includes('padding:1px 8px'), '胶囊自身也留一点内边距')
})

test('面（store）把拖动要用的方法都暴露出来了 —— 少一个，拖起来就是"没反应"', () => {
  // 这条是给一个真实事故留的：`setCommitWidth` 在 store 里定义了、也接进了 pointermove，
  // 但忘了挂到 store 返回的面上 → 拖动时 `store.setCommitWidth` 是 undefined → 直接抛错，
  // 表现就是"无法拖动"。而当时的拖动用例用的是 harness 自己拼的假 store（里面有这个方法），
  // 所以永远发现不了。这里直接检查**真 store 的面**。
  const bundle = mountClient()
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  for (const name of [
    'setDiffWidth',
    'setCommitWidth',
    'openDiff',
    'closeDetail',
    'refreshRows',
    'commitPanel',
  ]) {
    assert.equal(typeof store[name], 'function', `store 面上缺 ${name}()`)
  }
})
