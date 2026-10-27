/** 浏览器半用例：commits（24 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  COMMITS,
  COMMIT_DIFF_VALUE,
  COMMIT_VALUE,
  T,
  TAG_FIXTURES,
  byClass,
  commitDiffState,
  commitState,
  cssRule,
  diffState,
  fakeStore,
  findAll,
  flush,
  mountClient,
  mountPanel,
  panelKeydown,
  realStore,
  renderPanel,
  statusFixture,
  textOf,
} from './client-harness.mjs'

test('面板：改动清单排在最近提交之前（先看眼前要处理的，再看背景）', () => {
  const text = textOf(renderPanel({ commits: COMMITS }))
  const changes = text.indexOf('panel.changes')
  const commits = text.indexOf('panel.commits')
  assert.ok(changes >= 0, `应渲染改动清单，实际 ${JSON.stringify(text)}`)
  assert.ok(commits >= 0, '应渲染最近提交')
  assert.ok(changes < commits, `改动清单要在最近提交前面，实际 ${JSON.stringify(text)}`)

  // 概览仍在两者之前（顺序 = 概览 → 清单 → 提交）。
  const summary = text.indexOf('panel.summary')
  assert.ok(summary >= 0 && summary < changes, '改动概览在最前面')
})

test('最近提交：一行一条，带短 sha、标题、HEAD 徽标与具体时刻', () => {
  const node = renderPanel({ commits: COMMITS })
  const rows = findAll(node, byClass('dshh-commit'))
  assert.equal(rows.length, 2)

  const text = textOf(node)
  assert.ok(text.includes('panel.commits'), '有小标题')
  assert.ok(text.includes('2eed74e') && text.includes('1097168'), '短 sha')
  assert.ok(text.includes('feat: 差异视图'), '标题')

  // HEAD 徽标只在 HEAD 那条上出现。
  assert.equal(findAll(node, byClass('dshh-chead')).length, 1)

  // 具体时刻（用户要求）：不再是 `2 小时前`。COMMITS 里两条相差一小时 → 两个 `HH:mm`。
  const expectedA = new RegExp('\\d{2}:\\d{2}')
  assert.ok(expectedA.test(text), `期望具体时刻，实际 ${JSON.stringify(text)}`)
  // 一律完整年月日 + 时分（`2026-10-16 14:18`），不再有"只给时刻"的那一档。
  assert.ok(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text),
    `期望完整年月日，实际 ${JSON.stringify(text)}`,
  )
})

test('最近提交：悬停给出点击提示、作者、完整时刻与 refs', () => {
  const node = renderPanel({ commits: COMMITS })
  const first = findAll(node, byClass('dshh-commit'))[0]
  const lines = first.props.title.split('\n')
  assert.equal(lines[0], 'commit.click', '第一行说明这行可点')
  assert.equal(lines[2], 'feat: 差异视图')
  assert.ok(
    /^wjc · \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(lines[3]),
    `悬停要给到分钟（不再依赖 git 那个只有日期的短日期），实际 ${lines[3]}`,
  )
  assert.ok(lines.includes('HEAD -> main') && lines.includes('origin/main'))
})

test('最近提交：没有提交就整段不渲染', () => {
  assert.equal(findAll(renderPanel({ commits: [] }), byClass('dshh-commit')).length, 0)
  assert.equal(findAll(renderPanel({ commits: null }), byClass('dshh-commit')).length, 0)
  assert.ok(!textOf(renderPanel({ commits: [] })).includes('panel.commits'), '连小标题都不出现')
})

test('最近提交：整行可点，点击把这次提交交给 store（再点一次收起）', () => {
  const opened = []
  const node = renderPanel(
    { commits: COMMITS },
    { methods: { toggleCommit: (commit) => opened.push(commit) } },
  )
  const rows = findAll(node, byClass('dshh-commit'))
  assert.ok(
    rows.every((row) => row.type === 'button'),
    '每行都是按钮（可点）',
  )

  rows[1].props.onClick()
  assert.equal(opened.length, 1)
  assert.equal(opened[0].sha, '1097168')
  assert.equal(opened[0].subject, 'fix: 胶囊与输入卡片左对齐')
})

test('最近提交：打开的那条高亮（清单是短 sha，明细里是完整 sha）', () => {
  const open = renderPanel({
    commits: COMMITS,
    ...(commitState().commit === undefined ? {} : { commit: commitState().commit }),
  })
  const active = findAll(open, byClass('dshh-commitActive'))
  assert.equal(active.length, 1, '只有打开的那条亮着')
  assert.ok(
    textOf(active[0]).includes('2eed74e'),
    '高亮的是 2eed74e 那条（短 sha 前缀匹配完整 sha）',
  )

  const closed = renderPanel({ commits: COMMITS, commit: null })
  assert.equal(findAll(closed, byClass('dshh-commitActive')).length, 0, '没打开就没有高亮')
})

test('提交明细：三栏——左栏一个字不动，只高亮打开的那条；明细在中间栏', () => {
  const withCommits = { ...commitState(), commits: COMMITS }
  const single = renderPanel({ ...withCommits, commit: null, diff: null })
  const node = renderPanel(withCommits)

  // 工作台，且左栏与"没有提交明细"时逐字一致 —— 打开提交不改动主面板。
  assert.equal(findAll(node, byClass('dshh-workbench')).length, 1)
  const left = findAll(node, byClass('dshh-leftpane'))[0]
  assert.equal(
    textOf(left),
    textOf(findAll(single, byClass('dshh-body'))[0]),
    '左栏（仓库路径 / 概览 / 提交列表 / 工作区清单）必须原封不动',
  )
  assert.equal(left.props.style.width, 380)

  // 左栏那一行高亮。
  assert.equal(findAll(left, byClass('dshh-commitActive')).length, 1)
  assert.equal(findAll(node, byClass('dshh-rowActive')).length, 0, '左栏的工作区清单不该跟着高亮')

  // 中间那一栏是这次提交的明细：元信息 + 清单。
  const right = findAll(node, byClass('dshh-commitpane'))[0]
  assert.ok(right, '中间栏渲染明细')
  const rightText = textOf(right)
  assert.ok(rightText.includes('2eed74e'), '短 sha')
  assert.ok(rightText.includes('feat: 差异视图'), '提交标题')
  assert.ok(rightText.includes('wjc · 2026-10-14'), '作者与日期')
  assert.ok(rightText.includes('HEAD -> main'), 'refs')
  assert.ok(rightText.includes('commit.files'), '这次提交的改动清单')

  const files = findAll(right, byClass('dshh-row'))
  assert.equal(files.length, 2)
  assert.ok(textOf(right).includes('src/old.ts → src/new.ts'), '重命名行与工作区清单同形')
})

test('提交明细：点清单里的文件打开该文件的差异（差异在右边那一栏）', () => {
  const calls = { files: [], detail: 0 }
  const node = renderPanel(commitState(), {
    methods: {
      openCommitDiff: (file) => calls.files.push(file),
      closeDetail: () => {
        calls.detail += 1
      },
    },
  })

  const rows = findAll(findAll(node, byClass('dshh-commitpane'))[0], byClass('dshh-row'))
  rows[1].props.onClick()
  assert.deepEqual(
    calls.files.map((file) => file.file),
    ['src/new.ts'],
  )
  assert.equal(calls.files[0].origFile, 'src/old.ts', '重命名要把原路径一起带上')
})

test('提交明细：空提交、读取中、找不到这次提交各有文案', () => {
  const empty = renderPanel(commitState({ files: [] }))
  const emptyPane = findAll(empty, byClass('dshh-commitpane'))[0]
  assert.ok(textOf(emptyPane).includes('commit.empty'))
  assert.equal(findAll(emptyPane, byClass('dshh-row')).length, 0, '明细里没有文件行')
  assert.equal(
    findAll(empty, byClass('dshh-workbench')).length,
    1,
    '明细在场就进工作台（左栏照旧）',
  )
  assert.equal(findAll(empty, byClass('dshh-diffview')).length, 0, '空提交没有差异栏')
  // 只有提交明细栏时，右边缘那条抓握改成调它 —— 它是右边界上唯一还能变宽的东西，
  // 按下去没反应才是 bug。所以这里期望"有抓握"，且它是提交栏那条。
  assert.equal(findAll(empty, byClass('dshh-grip')).length, 1, '只有提交栏 → 右边缘那一条调提交栏')
  assert.equal(
    findAll(empty, (item) => item.props?.['data-dsh-hud'] === 'grip-commit').length,
    1,
    '标记成提交栏那条',
  )
  assert.equal(
    empty.props.style.width,
    380 + 240 + 6,
    '左栏 + 明细栏 + 右边缘那条的让位（它是绝对定位，不占宽但要预留）',
  )

  const loading = renderPanel(commitState({ phase: 'loading' }))
  assert.ok(textOf(findAll(loading, byClass('dshh-commitpane'))[0]).includes('commit.loading'))

  const unknown = renderPanel(commitState({ phase: 'error', errorCode: 'unknown-commit' }))
  assert.ok(textOf(findAll(unknown, byClass('dshh-commitpane'))[0]).includes('commit.unknown'))

  const timeout = renderPanel(commitState({ phase: 'error', errorCode: 'timeout' }))
  assert.ok(textOf(findAll(timeout, byClass('dshh-commitpane'))[0]).includes('err.timeout'))
})

test('提交明细：合并提交明确说按第一父提交比较', () => {
  assert.ok(
    textOf(
      findAll(renderPanel(commitState({ merge: true })), byClass('dshh-commitpane'))[0],
    ).includes('commit.merge'),
  )
})

test('提交差异：三栏 + 两条抓握（栏间那条调提交栏、右边缘那条调差异栏）', () => {
  const node = renderPanel(commitDiffState())

  assert.equal(findAll(node, byClass('dshh-workbench')).length, 1)
  assert.equal(findAll(node, byClass('dshh-leftpane')).length, 1, '左栏')
  assert.equal(findAll(node, byClass('dshh-commitpane')).length, 1, '提交明细栏')
  assert.equal(findAll(node, byClass('dshh-diffview')).length, 1, '差异栏')
  assert.equal(
    node.props.style.width,
    380 + 240 + 6 + 470 + 6,
    '左栏 + 明细栏 + 栏间抓握 + 差异栏 + 右边缘抓握',
  )
  assert.equal(
    findAll(node, byClass('dshh-commitpane'))[0].props.style.width,
    240,
    '明细栏默认 240px（可拖）',
  )
  // 三栏时是两条：提交栏右边那条（调提交栏）+ 面板右边缘那条（调差异栏）。
  assert.equal(findAll(node, byClass('dshh-grip')).length, 2, '提交栏与差异栏各一条抓握')
  assert.equal(
    findAll(node, (item) => item.props?.['data-dsh-hud'] === 'grip-commit').length,
    1,
    '其中一条是提交栏的',
  )
  assert.equal(
    findAll(node, (item) => item.props?.['data-dsh-hud'] === 'grip').length,
    1,
    '另一条是差异栏的',
  )

  const middle = findAll(node, byClass('dshh-commitpane'))[0]
  const middleText = textOf(middle)
  assert.ok(middleText.includes('2eed74e') && middleText.includes('feat: 差异视图'), '明细栏的头部')
  assert.ok(middleText.includes('commit.files'), '明细栏里是这次提交的清单')
  assert.ok(!middleText.includes('keep'), '差异不在明细栏里')

  const diffText = textOf(findAll(node, byClass('dshh-diffview'))[0])
  assert.ok(
    !diffText.includes('diff.worktree') && !diffText.includes('diff.index'),
    '提交差异没有两侧页签',
  )
  assert.ok(!diffText.includes('diff.untrackedHint'), '提交里的文件不存在"未跟踪"这回事')
  assert.ok(diffText.includes('diff.wrap') && diffText.includes('diff.copy'), '换行与复制仍在')
  assert.ok(
    diffText.includes('keep') && diffText.includes('+2') && diffText.includes('-1'),
    '差异内容与计数照常',
  )

  const files = findAll(middle, byClass('dshh-row'))
  assert.equal(
    findAll(middle, byClass('dshh-rowActive')).length,
    1,
    '正在看的那份差异在明细清单里高亮',
  )
  assert.ok(files[0].props.title.startsWith('src/a.ts'))
})

test('提交明细：窄窗口下三栏不溢出——固定栏保持，差异栏压小', () => {
  const node = mountClient({ innerWidth: 900 }).components['dsh-hud-panel']({
    t: T,
    store: {
      ...fakeStore({ ...commitDiffState(), panelOpen: true, anchorTop: null }),
      stepFile() {},
      openCursor() {},
      stepHunk() {},
      toggleHunk() {},
      closeDetail() {},
    },
  })

  // 目标宽度 380+240+6+470=1096 > 可用 884：整体夹到可视范围，左栏与明细栏仍是固定宽度，
  // 弹性的是差异栏（784 - 380 - 240 = 就剩这些）。
  assert.equal(node.props.style.width, 900 - 2 * 8)
  assert.equal(findAll(node, byClass('dshh-leftpane'))[0].props.style.width, 380)
  assert.equal(findAll(node, byClass('dshh-commitpane'))[0].props.style.width, 240)
})

test('提交明细栏：清单与左栏清单用不同的行标记（键盘滚动不能滚错栏）', () => {
  const node = renderPanel(commitDiffState())
  const rows = findAll(node, byClass('dshh-row'))
  const lists = rows.map((row) => row.props['data-row-list'])
  assert.ok(
    lists.includes('changes') && lists.includes('commit'),
    `两份清单要能区分，实际 ${JSON.stringify(lists)}`,
  )
})

test('提交明细（store）：点一行 → 取这次提交 → 自动打开第一个文件；收起时两样一起清掉', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: COMMIT_VALUE })
      if (endpoint === 'commit-diff') return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })

  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'sha-1', subject: 'feat: 有改动' })

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.commit.phase, 'ready')
  assert.deepEqual(
    snapshot.commit.files.map((file) => file.file),
    ['src/a.ts', 'b.txt'],
    '左栏拿这次提交的清单',
  )
  assert.equal(snapshot.commit.shortSha, 'sha-1')
  assert.equal(snapshot.diff.source, 'commit', '右栏是提交差异')
  assert.equal(snapshot.diff.file, 'src/a.ts', '自动打开第一个文件')
  assert.equal(snapshot.diff.phase, 'ready')
  assert.equal(snapshot.diff.side, 'commit', '提交差异只有一个"侧"')

  // status 与 session-changes 是"每轮刷新都搭车"的只读事实，`provider-balance` 是绑会话时
  // 顺手问的余额账本（也不属于这次提交）—— 这里只看这次提交相关的调用。
  const first = calls.filter(
    (call) =>
      ![
        'status',
        'session-changes',
        'session-statuses',
        'session-tools',
        'provider-balance',
      ].includes(call.endpoint),
  )
  assert.deepEqual(
    first.map((call) => call.endpoint),
    ['commit', 'commit-diff'],
  )
  assert.deepEqual(first[0].args, { cwd: '/x', sha: 'sha-1' }, '拿点击时那个（可能是短）sha 去问')
  assert.deepEqual(
    first[1].args,
    { cwd: '/x', sha: 'sha-1-full', path: 'src/a.ts', origPath: null },
    '之后一律用解析回来的完整 sha',
  )

  // 切这次提交里的另一个文件：不再重复取提交本身。
  await store.openCommitDiff({ file: 'b.txt', path: 'b.txt' })
  assert.equal(store.getSnapshot().diff.file, 'b.txt')
  assert.deepEqual(calls.filter((call) => call.endpoint === 'commit').length, 1)

  // 收起明细：它与它带来的差异一起收起。
  store.closeCommit()
  assert.equal(store.getSnapshot().commit, null)
  assert.equal(store.getSnapshot().diff, null)
})

test('提交明细（store）：再点一次打开着的那条就收起（短 sha 与完整 sha 要能配对）', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: COMMIT_VALUE })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')

  // 清单里是短 sha（sha-1），明细里是完整 sha（sha-1-full）——必须认得出是同一次提交。
  await store.toggleCommit({ sha: 'sha-1', subject: 'feat: 有改动' })
  assert.equal(store.getSnapshot().commit.phase, 'ready')

  await store.toggleCommit({ sha: 'sha-1', subject: 'feat: 有改动' })
  assert.equal(store.getSnapshot().commit, null, '再点一次收起明细')
  assert.equal(store.getSnapshot().diff, null, '它带来的差异一起收起')

  // 点另一条则是切换，不是收起。
  await store.toggleCommit({ sha: 'sha-2', subject: '别的提交' })
  assert.notEqual(store.getSnapshot().commit, null)
})

test('提交明细（store）：空提交不开差异，认不出的提交给错误态', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit')
        return Promise.resolve({ ok: true, value: { ...COMMIT_VALUE, files: [] } })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'sha-1' })
  assert.equal(store.getSnapshot().commit.phase, 'ready')
  assert.deepEqual(store.getSnapshot().commit.files, [])
  assert.equal(store.getSnapshot().diff, null, '空提交不开一个空差异')
})

test('提交明细（store）：宿主半说找不到这次提交时给出可读的错误态', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit')
        return Promise.resolve({ ok: false, error: { details: { code: 'unknown-commit' } } })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'deadbee' })
  assert.equal(store.getSnapshot().commit.phase, 'error')
  assert.equal(store.getSnapshot().commit.errorCode, 'unknown-commit')
  assert.equal(store.getSnapshot().diff, null)
})

test('提交明细（store）：换了工作区就把明细收起（不能显示别的仓库的提交）', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: COMMIT_VALUE })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'sha-1' })
  assert.equal(store.getSnapshot().commit.phase, 'ready')

  store.bindSession('session-2', '/other')
  assert.equal(store.getSnapshot().commit, null)
  assert.equal(store.getSnapshot().diff, null)
})

test('提交明细：Esc 退一层——先收起右栏，再按才收起面板', () => {
  // 提交明细（右栏 = 明细，里面装着差异）：一次 Esc 把整块明细收掉。
  const detail = mountPanel(commitDiffState())
  const keydown = panelKeydown(detail.bundle)
  keydown({ key: 'Escape' })
  assert.equal(detail.calls.closeDetail, 1, '右栏整体退掉')
  assert.equal(detail.calls.closeCommit, 1, 'closeDetail 在提交明细在场时退的是明细')
  assert.deepEqual(detail.calls.openPanel, [], '此时还不收起面板')

  // 只有工作区差异：退的是差异。
  const worktree = mountPanel({ diff: diffState().diff })
  panelKeydown(worktree.bundle)({ key: 'Escape' })
  assert.equal(worktree.calls.closeDetail, 1)
  assert.equal(worktree.calls.closeDiff, 1)

  // 右栏什么都不在场：才收起面板。
  const plain = mountPanel({ diff: null, commit: null })
  panelKeydown(plain.bundle)({ key: 'Escape' })
  assert.deepEqual(plain.calls.openPanel, [false])
})

test('最近提交：标题下面与改动清单一样有一条分隔线', () => {
  const commits = cssRule('.dshh-commits')
  const list = cssRule('.dshh-list')

  assert.ok(commits, '这条规则必须真的成立')
  assert.ok(
    commits.body.includes('border-top:1px solid'),
    `最近提交要有分隔线（现在 ${commits.body}）`,
  )
  assert.ok(commits.body.includes('padding-top:4px'), '线与第一行之间要留出间距')
  // 与改动清单用同一条线：两处取同一个主题令牌，免得两个段落各是各的灰。
  const token = /border-top:1px solid ([^)]*\))/.exec(list?.body ?? '')?.[1]
  assert.ok(token && commits.body.includes(token), `要和改动清单同一条线（${token}）`)
})

test('标签列表：一行一个（tag 名 + 它指向的提交 sha + 时间），指向 HEAD 的标 HEAD', () => {
  const node = renderPanel({ tags: TAG_FIXTURES, status: statusFixture({ oid: 'abc1234' }) })
  const rows = findAll(node, (item) => item.props?.['data-tag-row'] !== undefined)
  const texts = rows.map(textOf)
  assert.equal(rows.length, 2, `两条 tag 两行，实际 ${rows.length}`)
  assert.ok(texts[0].includes('v0.8.0') && texts[0].includes('abc1234'), texts[0])
  assert.ok(texts[0].includes('HEAD'), '指向当前 HEAD 的那个要标 HEAD')
  assert.ok(!texts[1].includes('HEAD'), '另一个不该标')
})

test('标签列表：点一行 = 用右栏看它指向的那次提交（tag 自己不是提交，所以要填提交信息）', () => {
  const opened = []
  const node = renderPanel(
    { tags: TAG_FIXTURES },
    { methods: { toggleCommit: (commit) => opened.push(commit) } },
  )
  findAll(node, (item) => item.props?.['data-tag-row'] !== undefined)[1].props.onClick()

  assert.equal(opened.length, 1, '应当把这次点击交给提交明细那条管道')
  assert.equal(opened[0].sha, 'def5678', '打开的是 tag 指向的**提交**')
  assert.equal(opened[0].subject, '修好装不上的问题')
  assert.deepEqual(opened[0].refs, ['v0.7.1'], '把这个 tag 记进 refs，明细里能看出是从 tag 来的')
})

test('标签列表：没有 tag 时画一行写明（"仓库没有 tag"与"功能没做"必须能区分）；被截断时明说', () => {
  const none = renderPanel({ tags: [] })
  assert.equal(
    findAll(none, (item) => item.props?.['data-tag-row'] !== undefined).length,
    0,
    '一行 tag 也不该有',
  )
  const emptyNote = findAll(none, (item) => item.props?.['data-tags-empty'] !== undefined)
  assert.equal(emptyNote.length, 1, '要写明"还没有标签"（一行 tag 都不画，但话说清楚）')
  assert.ok(textOf(emptyNote[0]).includes('panel.tagsEmpty'))
  // 标题也要留着：整段不画的话，功能看起来像没做。
  assert.ok(
    findAll(none, (item) => (item.props?.className || '').includes('dshh-sectionTitle')).length > 0,
  )

  assert.equal(
    findAll(renderPanel({ tags: null }), (item) => item.props?.['data-tags-empty'] !== undefined)
      .length,
    0,
    '还没取到数据时先不画，避免闪一下"还没有标签"',
  )

  const capped = textOf(renderPanel({ tags: TAG_FIXTURES, tagsTruncated: true }))
  assert.ok(capped.includes('panel.tagsCapped'), '截断了要说清楚')
})

test('标签列表（store）：面板打开时去取；10s 新鲜度窗口内不重复问 git', async () => {
  const calls = []
  const bundle = mountClient({
    rpc: (channel, endpoint) => {
      calls.push(endpoint)
      if (endpoint === 'status')
        return Promise.resolve({ ok: true, value: statusFixture({ oid: 'abc1234' }) })
      if (endpoint === 'tags')
        return Promise.resolve({
          ok: true,
          value: { repo: '/Users/me/project', tags: TAG_FIXTURES, truncated: false },
        })
      if (endpoint === 'log') return Promise.resolve({ ok: true, value: { commits: [] } })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await flush()
  const before = calls.filter((name) => name === 'tags').length
  assert.equal(before, 0, '面板没打开时不该问 tag（省一次 for-each-ref）')

  store.togglePanel()
  await flush()
  await flush()
  assert.equal(store.getSnapshot().tags.length, 2, '面板打开后要有 tag')
  const after = calls.filter((name) => name === 'tags').length
  assert.ok(after >= 1, '面板打开时要取一次')

  store.refreshRows()
  await flush()
  await flush()
  assert.equal(calls.filter((name) => name === 'tags').length, after, '10s 内不重复问 git')
  const line = bundle.consoleLines.find((item) => item.includes('tags {'))
  assert.ok(line && line.includes('"count":2'), `要有现场日志，实际 ${line}`)
})

test('时刻一律给完整年月日：`2026-10-16 14:18`（不再分档、也不再是相对时间）', () => {
  const at = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm).getTime()
  const today = at(2026, 10, 16, 14, 18)
  const rows = [
    {
      sha: 'aaaaaaa',
      author: 'wjc',
      date: '2026-10-16',
      committedAt: at(2026, 10, 16, 9, 5),
      refs: [],
      subject: '今天早上',
    },
    {
      sha: 'bbbbbbb',
      author: 'wjc',
      date: '2026-03-02',
      committedAt: at(2026, 3, 2, 22, 37),
      refs: [],
      subject: '今年早些时候',
    },
    {
      sha: 'ccccccc',
      author: 'wjc',
      date: '2025-12-31',
      committedAt: at(2025, 12, 31, 9, 12),
      refs: [],
      subject: '去年',
    },
  ]
  const node = renderPanel({ commits: rows, now: today })
  const rowsText = findAll(node, byClass('dshh-commit')).map(textOf)
  // 每一行都必须带完整年月日 —— 只给 `09:05` 这种（今天的那档）已经不被接受。
  assert.ok(rowsText[0].includes('2026-10-16 09:05'), `今天也要年月日，实际 ${rowsText[0]}`)
  assert.ok(rowsText[1].includes('2026-03-02 22:37'), `同一年也要，实际 ${rowsText[1]}`)
  assert.ok(rowsText[2].includes('2025-12-31 09:12'), `跨年当然要，实际 ${rowsText[2]}`)
})

test('提交页里按 ↓ 换文件：走 commit-diff 且不抛（回归：openCommitDiff 曾引用差异片的在途变量）', async () => {
  // 背景：把 store 拆成几片时，「提交里某个文件的差异」与「工作区差异」各归各家，
  // 但 openCommitDiff 里还在写差异片那个 in-flight 变量 —— 打开提交会自动打开第一个
  // 文件（另一条路径），所以只有"换一个文件"才会踩到。TS 的重构检查抓到了它，
  // 这条用例把它钉在行为层。
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope && envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: COMMIT_VALUE })
      if (endpoint === 'commit-diff') return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
      return Promise.resolve({ ok: true, value: null })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'sha-1', subject: 'feat: 有改动' })
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'src/a.ts', '打开提交会自动打开第一条')

  // 真实交互是两步：↓ 移动高亮，Enter 打开（`stepFile` 的第二参才是"顺便打开"）。
  store.stepFile(1, false)
  store.openCursor()
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'b.txt', '按 ↓ 再 Enter 打开下一条')
  const diffCalls = calls
    .filter((call) => call.endpoint === 'commit-diff')
    .map((call) => call.args && call.args.path)
  assert.ok(
    diffCalls.includes('b.txt'),
    `应当去取 b.txt 的提交差异，实际取过 ${JSON.stringify(diffCalls)}`,
  )
})
