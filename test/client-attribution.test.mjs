/** 浏览器半用例：attribution（31 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  REVIEWED_KEY,
  byClass,
  commandItem,
  fakeSessionsService,
  findAll,
  findByAttr,
  flush,
  hoverPill,
  keyEvent,
  mountArmedPanel,
  mountClient,
  panelKeydown,
  pillText,
  possibleItem,
  realStore,
  renderPanel,
  renderPill,
  reviewKey,
  reviewStatus,
  sessionChangesValue,
  sessionSlice,
  statusFixture,
  textOf,
  turnOutline,
} from './client-harness.mjs'

test('会话归因（store）：随刷新取回，并归一成以文件为键的表', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes')
        return Promise.resolve({
          ok: true,
          value: sessionChangesValue(['src/a.ts', 'new file.txt']),
        })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  const call = calls.find((item) => item.endpoint === 'session-changes')
  assert.ok(call, '要跟着刷一起去取')
  assert.deepEqual(
    call.args,
    { cwd: '/Users/me/project', sessionId: 'session-1' },
    '端点要 cwd + sessionId 两个参数',
  )

  const slice = store.getSnapshot().sessionChanges
  assert.equal(slice.phase, 'ready')
  assert.deepEqual(Object.keys(slice.files).sort(), ['new file.txt', 'src/a.ts'])
  assert.equal(slice.since, 1_700_000_000_000)
})

test('会话归因（store）：宿主不认这个端点时保持"没有数据"，不打标记', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  const slice = store.getSnapshot().sessionChanges
  assert.equal(slice.files, null, '拿不到就是 null（界面据此不打标记、也不过这个滤）')
  assert.equal(slice.errorCode, 'unknown-endpoint')
})

test('会话归因（store）：换会话先清空，别把上一个会话的标记留在新会话的清单上', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes')
        return Promise.resolve({ ok: true, value: sessionChangesValue(['src/a.ts']) })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()
  assert.ok(store.getSnapshot().sessionChanges.files)

  store.bindSession('session-2', '/Users/me/project')
  assert.equal(store.getSnapshot().sessionChanges.files, null, '换会话先清空')
})

test('会话归因（store）：过滤发生在可见清单里，键盘导航跟着同一份走', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes')
        return Promise.resolve({ ok: true, value: sessionChangesValue(['new file.txt']) })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  // statusFixture 里是 src/a.ts 与 new file.txt；本会话只改了后者。
  store.stepFile(1, false)
  assert.equal(store.getSnapshot().cursor, 'src/a.ts', '没开过滤时从第一条开始')

  store.toggleOnlySession()
  assert.equal(store.getSnapshot().onlySession, true)
  // 过滤开着：键盘只在本会话改过的那一条上移动。
  store.bindSession('session-1', '/Users/me/project')
  store.stepFile(1, false)
  assert.equal(store.getSnapshot().cursor, 'new file.txt', '↑/↓ 不该落到被过滤掉的行的下标上')
})

test('会话归因（store）：「只看本会话改的」开关会落盘', async () => {
  const bundle = mountClient({ rpc: () => Promise.resolve({ ok: true, value: statusFixture() }) })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store

  store.toggleOnlySession()
  assert.equal(store.getSnapshot().onlySession, true)
  const saved = bundle.windowStub.localStorage.values.get('dsh-hud.ui.v1')
  assert.ok(String(saved).includes('"onlySession":true'), `要写进 localStorage，实际 ${saved}`)

  store.toggleOnlySession()
  assert.equal(store.getSnapshot().onlySession, false)
  assert.ok(
    String(bundle.windowStub.localStorage.values.get('dsh-hud.ui.v1')).includes(
      '"onlySession":false',
    ),
  )
})

test('会话归因（面板）：概览下面那行给出计数与过滤开关', () => {
  const node = renderPanel({ sessionChanges: sessionSlice(['src/a.ts', 'gone.ts']) })
  const line = findByAttr(node, 'session')
  assert.ok(line, '有数据时要有这一行')
  const text = textOf(line)
  assert.ok(text.includes('session.line'), `要报本会话改了几个，实际 ${text}`)
  assert.ok(text.includes('session.gone'), '本会话改过、现在没差异的要单独说')

  const toggle = findAll(line, (node2) => node2.props?.['data-session-filter'] === 'only')[0]
  assert.ok(toggle, '要有过滤开关')
  assert.equal(toggle.props['aria-pressed'], 'false')
})

test('会话归因（面板）：清单行首标出 ● 本会话 / ○ 其他来源', () => {
  const node = renderPanel({ sessionChanges: sessionSlice(['new file.txt']) })
  const marks = findAll(node, (node2) => node2.props?.['data-session-mark'])

  // statusFixture：src/a.ts（别人改的）与 new file.txt（本会话新建的）。
  assert.deepEqual(
    marks.map((mark) => [mark.props['data-session-mark'], textOf(mark)]),
    [
      ['other', '○'],
      ['mine', '●'],
    ],
  )
})

test('会话归因（面板）：没有归因数据时整列不画，那一行只剩开关', () => {
  const node = renderPanel({
    sessionChanges: { phase: 'idle', files: null, since: null, dropped: 0, errorCode: null },
  })
  const line = findByAttr(node, 'session')
  assert.ok(line, '那一行要在（它带着三枚开关，不能因为数据没到就消失）')
  assert.deepEqual(
    findAll(line, (item) => item.props?.['data-session-filter']).map(
      (item) => item.props['data-session-filter'],
    ),
    ['only'],
    '只剩"只看本会话改的"这枚（侧栏档位开关随标记一起删了）',
  )
  assert.equal(
    findAll(node, (node2) => node2.props?.['data-session-mark']).length,
    0,
    '也不该乱标"别人的"',
  )
})

test('会话归因（面板）：过滤器只留本会话改的，清空时给一句说明而不是整段消失', () => {
  const filtered = renderPanel({
    onlySession: true,
    sessionChanges: sessionSlice(['new file.txt']),
  })
  const rows = findAll(filtered, byClass('dshh-row')).filter(
    (row) => row.props['data-row-list'] === 'changes',
  )
  assert.equal(rows.length, 1, '只剩本会话改的那条')
  assert.ok(textOf(rows[0]).includes('new file.txt'))

  // 本会话什么都没改：清单位置给一句说明。
  const empty = renderPanel({ onlySession: true, sessionChanges: sessionSlice([]) })
  const emptyRows = findAll(empty, byClass('dshh-row')).filter(
    (row) => row.props['data-row-list'] === 'changes',
  )
  assert.equal(emptyRows.length, 0)
  assert.ok(textOf(empty).includes('session.empty'), '要说清为什么是空的')
})

test('会话归因（面板）：点了过滤开关就走 store', () => {
  const toggled = []
  const node = renderPanel(
    { sessionChanges: sessionSlice(['src/a.ts']) },
    { methods: { toggleOnlySession: () => toggled.push(true) } },
  )
  findAll(node, (node2) => node2.props?.['data-session-filter'] === 'only')[0].props.onClick()
  assert.deepEqual(toggled, [true])
})

test('会话归因（胶囊）：改过东西才挂 `│ ●n`，没数据或 0 个都不显示', () => {
  const withChanges = pillText({ sessionChanges: sessionSlice(['src/a.ts']) })
  assert.ok(withChanges.includes('●1'), `要有本会话段，实际 ${withChanges}`)

  const none = pillText({ sessionChanges: sessionSlice([]) })
  assert.equal(none.includes('●'), false, '0 个不显示')

  const noData = pillText({
    sessionChanges: { phase: 'idle', files: null, since: null, dropped: 0, errorCode: null },
  })
  assert.equal(noData.includes('●'), false, '没数据不显示')

  // 悬停里说清这个数字是什么。
  const tips = []
  const node = renderPill(
    { sessionChanges: sessionSlice(['src/a.ts']) },
    { methods: { showTip: (key, text) => tips.push(text) } },
  )
  hoverPill(node, 'pill')
  assert.ok(tips[0].includes('session.pill'), `悬停要解释，实际 ${tips[0]}`)
})

test('会话归因（诊断）：取回与失败各留一行现场', async () => {
  const ok = mountClient({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes')
        return Promise.resolve({ ok: true, value: sessionChangesValue(['src/a.ts']) })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  ok.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject()
    .store.bindSession('session-1', '/Users/me/project')
  await flush()
  const line = ok.consoleLines.find((item) => item.includes('session-changes {'))
  assert.ok(line, `要有一行取回现场，实际 ${JSON.stringify(ok.consoleLines)}`)
  assert.ok(line.includes('"files":1'), line)

  const failed = mountClient({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  failed.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject()
    .store.bindSession('session-1', '/Users/me/project')
  await flush()
  const bad = failed.consoleLines.find((item) => item.includes('session-changes-failed'))
  assert.ok(bad, '取不到也要说清是"宿主不认这个端点"还是传输失败')
  assert.ok(bad.includes('unknown-endpoint'), bad)
})

test('命令旁听（面板）：命令里看出来的文件标 ◐，悬停说清是哪条命令', () => {
  const node = renderPanel({
    sessionChanges: sessionSlice([], { possible: { 'src/a.ts': possibleItem('src/a.ts') } }),
  })
  const marks = findAll(node, (item) => item.props?.['data-session-mark'])
  assert.deepEqual(
    marks.map((mark) => [mark.props['data-session-mark'], textOf(mark)]),
    [
      ['possible', '◐'],
      ['other', '○'],
    ],
  )

  const row = findAll(node, byClass('dshh-row')).filter(
    (item) => item.props['data-row-list'] === 'changes',
  )[0]
  const title = String(row.props.title)
  assert.ok(title.includes('session.possibleTitle'), `悬停要给低一档的说明，实际 ${title}`)
  assert.ok(title.includes('sed -i'), '要把那条命令贴出来（让人自己判断）')
})

test('命令旁听（面板）：同一文件两档都有时只标 ●（确定赢过可能）', () => {
  const node = renderPanel({
    sessionChanges: sessionSlice(['src/a.ts'], {
      possible: { 'src/a.ts': possibleItem('src/a.ts') },
    }),
  })
  const marks = findAll(node, (item) => item.props?.['data-session-mark'])
  assert.deepEqual(
    marks.map((mark) => mark.props['data-session-mark']),
    ['mine', 'other'],
  )
})

test('命令旁听（面板）：那一行报出"另有 N 个可能相关"，悬停列出最近命令', () => {
  const node = renderPanel({
    sessionChanges: sessionSlice([], {
      possible: {
        'src/a.ts': possibleItem('src/a.ts'),
        'new file.txt': possibleItem('new file.txt'),
      },
      commands: [
        commandItem('pnpm test', { readOnly: true }),
        commandItem('sed -i s/a/b/ src/a.ts', { failed: true }),
      ],
    }),
  })
  const line = findByAttr(node, 'session')
  assert.ok(textOf(line).includes('session.possible'), `要报出可能相关的个数，实际 ${textOf(line)}`)

  const text = findAll(line, byClass('dshh-sessionText'))[0]
  const title = String(text.props.title)
  assert.ok(title.includes('sed -i'), '悬停要能看到跑过的命令原文')
  assert.ok(title.includes('session.commandFailed'), '失败的那条要标出来')
})

test('命令旁听（面板）：过滤器把"可能相关"也算本会话动过的', () => {
  const filtered = renderPanel({
    onlySession: true,
    sessionChanges: sessionSlice([], { possible: { 'src/a.ts': possibleItem('src/a.ts') } }),
  })
  const rows = findAll(filtered, byClass('dshh-row')).filter(
    (item) => item.props['data-row-list'] === 'changes',
  )
  assert.equal(rows.length, 1, '命令旁听到的那条要留下（过滤器的承诺是"本会话动过的"）')
  assert.ok(textOf(rows[0]).includes('src/a.ts'))
})

test('命令旁听（诊断）：取回时把文件数、可能相关数、命令数一起报出来', async () => {
  const bundle = mountClient({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes') {
        return Promise.resolve({
          ok: true,
          value: sessionChangesValue(['src/a.ts'], {
            possible: [possibleItem('src/b.ts')],
            commands: [commandItem('sed -i s/a/b/ src/b.ts')],
          }),
        })
      }
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject()
    .store.bindSession('session-1', '/Users/me/project')
  await flush()

  const line = bundle.consoleLines.find((item) => item.includes('session-changes {'))
  assert.ok(line, '要有现场')
  assert.ok(line.includes('"files":1'), line)
  assert.ok(line.includes('"possible":1'), line)
  assert.ok(line.includes('"commands":1'), line)
})

test('回合归因（store）：从 turnOutline 投影读回合并订阅，换会话时解绑', async () => {
  const sessions = fakeSessionsService(
    turnOutline([
      [0, '把面板改成两栏'],
      [1, '加上本会话改动'],
    ]),
  )
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes')
        return Promise.resolve({ ok: true, value: sessionChangesValue(['src/a.ts']) })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
    services: { sessions },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  const turns = store.getSnapshot().turns
  assert.equal(turns.available, true)
  assert.equal(turns.latest, 1)
  assert.equal(turns.prompts[1], '加上本会话改动')

  // 投影推送新回合 → store 跟着走。
  sessions.setOutline(
    turnOutline([
      [0, 'a'],
      [1, 'b'],
      [2, 'c'],
    ]),
  )
  assert.equal(store.getSnapshot().turns.latest, 2)
  assert.equal(store.getSnapshot().turns.prompts[2], 'c')

  // 换会话：旧的先解掉；换到那个"还没物化"的会话时，回合信息就该清空（不是留着上一条的）。
  store.bindSession('session-2', '/Users/me/project')
  assert.equal(store.getSnapshot().turns.available, false)
})

test('回合归因（store）：投影还没注册（会话没物化）时不崩，只是没有回合信息', async () => {
  const sessions = fakeSessionsService(turnOutline([[0, 'x']]), { materialized: false })
  const store = realStore({
    rpc: () => Promise.resolve({ ok: true, value: statusFixture() }),
    services: { sessions },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  assert.equal(store.getSnapshot().turns.available, false)
  assert.equal(store.getSnapshot().phase, 'ready', 'git 那半边照常')
})

test('回合归因（面板）：那一行报出"最近一轮 N 个"，行悬停说清是哪一轮', () => {
  const node = renderPanel({
    turns: { available: true, prompts: { 1: '加上本会话改动' }, latest: 1 },
    sessionChanges: sessionSlice(['src/a.ts'], {
      files: {
        'src/a.ts': {
          path: 'src/a.ts',
          file: 'src/a.ts',
          writes: 1,
          edits: 0,
          firstAt: 1,
          lastAt: 2,
          lastTurn: 1,
        },
      },
    }),
  })
  const line = findByAttr(node, 'session')
  assert.ok(
    textOf(line).includes('session.latestTurn'),
    `要报最近一轮改了几个，实际 ${textOf(line)}`,
  )

  const row = findAll(node, byClass('dshh-row')).filter(
    (item) => item.props['data-row-list'] === 'changes',
  )[0]
  const title = String(row.props.title)
  assert.ok(title.includes('session.turnWithPrompt'), '悬停要给出轮次')
  assert.ok(title.includes('加上本会话改动'), '并带上那一轮的请求预览')
})

test('回合归因（面板）：投影里没有那一轮的 prompt 时只说"第 N 轮"，不编内容', () => {
  const node = renderPanel({
    turns: { available: true, prompts: {}, latest: 3 },
    sessionChanges: sessionSlice(['src/a.ts'], {
      files: {
        'src/a.ts': {
          path: 'src/a.ts',
          file: 'src/a.ts',
          writes: 1,
          edits: 0,
          firstAt: 1,
          lastAt: 2,
          lastTurn: 3,
        },
      },
    }),
  })
  const row = findAll(node, byClass('dshh-row')).filter(
    (item) => item.props['data-row-list'] === 'changes',
  )[0]
  assert.ok(String(row.props.title).includes('session.turn'), '有轮次')
  assert.ok(
    !String(row.props.title).includes('turnWithPrompt'),
    '没有 prompt 就不该出现带 prompt 的文案',
  )
})

test('回合归因（面板）：第二枚开关只在拿得到回合时出现', () => {
  const withTurns = renderPanel({
    turns: { available: true, prompts: {}, latest: 1 },
    sessionChanges: sessionSlice(['src/a.ts'], {
      files: {
        'src/a.ts': {
          path: 'src/a.ts',
          file: 'src/a.ts',
          writes: 1,
          edits: 0,
          firstAt: 1,
          lastAt: 2,
          lastTurn: 1,
        },
      },
    }),
  })
  const toggles = findAll(withTurns, (item) => item.props?.['data-session-filter'])
  assert.deepEqual(
    toggles.map((item) => item.props['data-session-filter']),
    ['only', 'latest'],
  )

  // 拿不到回合：整枚不画（不给一个按不动的按钮）。
  const withoutTurns = renderPanel({ sessionChanges: sessionSlice(['src/a.ts']) })
  assert.deepEqual(
    findAll(withoutTurns, (item) => item.props?.['data-session-filter']).map(
      (item) => item.props['data-session-filter'],
    ),
    ['only'],
  )
})

test('回合归因（面板）：点"只看最近一轮"就走 store', () => {
  const toggled = []
  const node = renderPanel(
    {
      turns: { available: true, prompts: {}, latest: 1 },
      sessionChanges: sessionSlice(['src/a.ts'], {
        files: {
          'src/a.ts': {
            path: 'src/a.ts',
            file: 'src/a.ts',
            writes: 1,
            edits: 0,
            firstAt: 1,
            lastAt: 2,
            lastTurn: 1,
          },
        },
      }),
    },
    { methods: { toggleOnlyLatest: () => toggled.push(true) } },
  )
  findAll(node, (item) => item.props?.['data-session-filter'] === 'latest')[0].props.onClick()
  assert.deepEqual(toggled, [true])
})

test('回合归因（面板）：「只看最近一轮」只留这一轮改的，并与本会话过滤叠加', () => {
  const state = {
    turns: { available: true, prompts: {}, latest: 1 },
    onlyLatest: true,
    sessionChanges: sessionSlice(['src/a.ts', 'new file.txt'], {
      files: {
        'src/a.ts': {
          path: 'src/a.ts',
          file: 'src/a.ts',
          writes: 1,
          edits: 0,
          firstAt: 1,
          lastAt: 2,
          lastTurn: 0,
        },
        'new file.txt': {
          path: 'new file.txt',
          file: 'new file.txt',
          writes: 1,
          edits: 0,
          firstAt: 1,
          lastAt: 2,
          lastTurn: 1,
        },
      },
    }),
  }
  const rows = findAll(renderPanel(state), byClass('dshh-row')).filter(
    (item) => item.props['data-row-list'] === 'changes',
  )
  assert.deepEqual(
    rows.map((row) => textOf(row).includes('new file.txt')),
    [true],
    `只该留最近一轮那条，实际 ${rows.length} 行`,
  )

  // 叠加「只看本会话改的」：同一条仍在（它两档都满足）。
  const both = findAll(renderPanel({ ...state, onlySession: true }), byClass('dshh-row')).filter(
    (item) => item.props['data-row-list'] === 'changes',
  )
  assert.equal(both.length, 1)
})

test('审阅进度（标记）：点行尾的 ○ 就标成已审，存进自己的键里（不跟界面开关混）', () => {
  const bundle = mountClient({ rpc: () => Promise.resolve({ ok: true, value: statusFixture() }) })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store

  store.bindSession('session-1', '/Users/me/project')
  store.setReviewForTest?.()
  // 直接把签名喂进快照（真实路径由 status 请求带回来，store 测试里单列）。
  store.refresh()
  store.toggleReviewed('src/a.ts')
  const saved = JSON.parse(bundle.windowStub.localStorage.values.get(REVIEWED_KEY) ?? '{}')
  assert.deepEqual(Object.keys(saved), [], '没有签名就不能标记 —— 标了也算不出"还是不是这一版"')
})

test('审阅进度（标记）：有签名时按签名落盘，再点一次取消', () => {
  const signatures = { 'src/a.ts': '10.1700000000000' }
  const bundle = mountClient({
    rpc: (channel, endpoint) =>
      Promise.resolve({
        ok: true,
        value: endpoint === 'status' ? reviewStatus(signatures) : statusFixture(),
      }),
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  return flush().then(() => {
    store.toggleReviewed('src/a.ts')
    const saved = JSON.parse(bundle.windowStub.localStorage.values.get(REVIEWED_KEY) ?? '{}')
    const mark = saved[reviewKey('/Users/me/project', 'src/a.ts')]
    assert.deepEqual(Object.keys(saved), [reviewKey('/Users/me/project', 'src/a.ts')])
    assert.equal(mark.signature, '10.1700000000000', '存档里记的就是当前这一版的签名')
    assert.equal(typeof mark.at, 'number')
    assert.equal(
      store.getSnapshot().reviewed[reviewKey('/Users/me/project', 'src/a.ts')].signature,
      '10.1700000000000',
    )

    // 再点一次：取消（同一个签名 = 同一次点击的开关语义）。
    store.toggleReviewed('src/a.ts')
    assert.deepEqual(Object.keys(store.getSnapshot().reviewed), [])
    assert.equal(bundle.windowStub.localStorage.values.get(REVIEWED_KEY), '{}')
  })
})

test('审阅进度（失效）：改动一落盘（签名变了）标记就降级成"需要重看"，不再算已审', async () => {
  let signatures = { 'src/a.ts': '10.1', 'new file.txt': '20.2' }
  const bundle = mountClient({
    rpc: (channel, endpoint) =>
      Promise.resolve({
        ok: true,
        value: endpoint === 'status' ? reviewStatus(signatures) : statusFixture(),
      }),
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  store.toggleReviewed('src/a.ts')
  assert.equal(
    store.getSnapshot().reviewed[reviewKey('/Users/me/project', 'src/a.ts')].signature,
    '10.1',
  )

  // 又改了一次 → 签名变了 → 那条标记变 stale（仍在存档里，但不再算"已审"）。
  signatures = { 'src/a.ts': '12.9', 'new file.txt': '20.2' }
  store.refresh()
  await flush()

  // 审阅进度只在面板打开时存在（签名也是那时才要的）：渲染快照时把面板打开。
  const node = renderPanel({ ...store.getSnapshot(), panelOpen: true })
  const marks = findAll(node, (item) => item.props?.['data-review'])
  assert.deepEqual(
    marks.map((mark) => [mark.props['data-review'], textOf(mark)]),
    [
      ['stale', '✓'],
      ['none', '○'],
    ],
    '签名变了要降级成 stale，而不是继续显示已审',
  )
  assert.ok(
    textOf(findByAttr(node, 'session')).includes('review.staleCount'),
    '行上要提一句"改动已变"',
  )
})

test('审阅进度（清空）：只清当前工作区，别的仓库的标记不动', async () => {
  const signatures = { 'src/a.ts': '10.1' }
  const bundle = mountClient({
    rpc: (channel, endpoint) =>
      Promise.resolve({
        ok: true,
        value: endpoint === 'status' ? reviewStatus(signatures) : statusFixture(),
      }),
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store

  // 在第一个工作区标一条。
  store.bindSession('session-1', '/Users/me/project')
  await flush()
  store.toggleReviewed('src/a.ts')

  // 换到另一个工作区再标一条（键里带 cwd，所以是两份互不相干的记录）。
  store.bindSession('session-2', '/Users/me/other')
  await flush()
  store.toggleReviewed('src/a.ts')

  const before = Object.keys(JSON.parse(bundle.windowStub.localStorage.values.get(REVIEWED_KEY)))
  assert.equal(before.length, 2, `两个工作区各一条，实际 ${JSON.stringify(before)}`)

  // 在第二个工作区里清空：只该清掉它自己那条。
  store.clearReviewed()
  const after = Object.keys(JSON.parse(bundle.windowStub.localStorage.values.get(REVIEWED_KEY)))
  assert.deepEqual(after, [reviewKey('/Users/me/project', 'src/a.ts')], '只该清掉当前工作区那条')
})

test('审阅进度（渲染）：行尾标记 + 那一行的"已审 n/总数"', () => {
  const node = renderPanel({
    status: statusFixture(),
    review: { 'src/a.ts': '1.1', 'new file.txt': '2.2' },
    reviewed: { [reviewKey('/Users/me/project', 'src/a.ts')]: { signature: '1.1', at: 1 } },
  })
  const rows = findAll(node, byClass('dshh-row')).filter(
    (item) => item.props['data-row-list'] === 'changes',
  )
  const cells = findAll(node, (item) => item.props?.['data-review'])
  assert.deepEqual(
    cells.map((cell) => [cell.props['data-review'], textOf(cell)]),
    [
      ['fresh', '✓'],
      ['none', '○'],
    ],
  )
  assert.ok(textOf(findByAttr(node, 'session')).includes('review.count'), '行上要报"已审 n/总数"')
  assert.equal(rows.length, 2, '行的结构没被行尾标记改坏')
})

test('审阅进度（渲染）：这次没要签名（胶囊那一路）就整列不画、也不报进度', () => {
  const node = renderPanel({ status: statusFixture(), review: {} })
  assert.deepEqual(
    findAll(node, (item) => item.props?.['data-review']),
    [],
  )
  assert.ok(!textOf(findByAttr(node, 'session')).includes('review.count'), '没有签名就不该报进度')
})

test('审阅进度（键盘）：v 标记当前聚焦的那一行', () => {
  const marked = []
  const { bundle, calls } = mountArmedPanel(
    { cursor: 'src/a.ts', status: reviewStatus({ 'src/a.ts': '1.1', 'new file.txt': '2.2' }) },
    { methods: { toggleReviewed: (file) => marked.push(file) } },
  )
  const keydown = panelKeydown(bundle)
  const event = keyEvent('v')
  keydown(event)

  assert.deepEqual(marked, ['src/a.ts'], 'v 作用于光标所在那一行')
  assert.equal(event.prevented, true, '认领的键要阻止默认行为')
  assert.deepEqual(calls.stepFile, [], 'v 不该顺手移行')
})
