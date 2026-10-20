/** 浏览器半用例：capsule-timer（4 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMiniReact } from './mini-react.mjs'
import {
  T,
  findAll,
  findByAttr,
  hoverPill,
  mountClient,
  renderTimerPill,
  statusFixture,
  textOf,
} from './client-harness.mjs'

test('计时胶囊：画在 Git 那一行里、排在最后，显示挂钟时长与悬停明细', () => {
  const now = Date.now()
  const tips = []
  const node = renderTimerPill(
    {
      available: true,
      sessionId: 'session-1',
      createdAt: now - 134 * 60000, // 2h14m
      turns: 27,
      steps: 380,
      llmMs: 5_355_113,
      toolMs: 1_389_523,
      now,
    },
    { methods: { showTip: (key, text, rect) => tips.push({ key, text, rect }) } },
  )

  const pill = findByAttr(node, 'session-timer')
  assert.ok(pill, '拿到数据就该有这枚胶囊')
  assert.ok(textOf(node).includes('⏱'), '要带计时图标')
  assert.ok(
    textOf(node).includes('2h 14m'),
    `格式与 codex-hud 一致（2h 14m），实际 ${textOf(node)}`,
  )

  hoverPill(node, 'session-timer', { left: 100, top: 300, right: 190 })
  assert.equal(tips.length, 1, '悬停把文案交给 store')
  assert.equal(tips[0].key, 'session-timer')
  const tip = tips[0].text
  assert.ok(
    tip.includes('timer.title') && tip.includes('timer.created'),
    `悬停先说是什么、创建于何时，实际 ${tip}`,
  )
  assert.ok(
    tip.includes('llm=1h 29m') && tip.includes('tool=23m'),
    `模型 5,355,113ms→1h 29m、工具 1,389,523ms→23m，实际 ${tip}`,
  )
  assert.ok(tip.includes('turns=27'), `悬停给出轮次/步数，实际 ${tip}`)

  // dock 是竖列：计时必须在**同一条注册**里、且排在最后（这次用例里没有工具，所以是 Git 之后）。
  const dock = findByAttr(node, 'dock')
  assert.ok(dock, 'dock 行要存在')
  const inked = findAll(
    dock,
    (entry) =>
      entry.props &&
      (entry.props['data-dsh-hud'] === 'session-timer' || entry.props['data-dsh-hud'] === 'pill'),
  )
  assert.deepEqual(
    inked.map((entry) => entry.props['data-dsh-hud']),
    ['pill', 'session-timer'],
    `计时排在最后，实际 ${JSON.stringify(inked.map((entry) => entry.props['data-dsh-hud']))}`,
  )
})

test('计时胶囊：不足一分钟显示 <1m；不可用与"没有统计"时各自的克制', () => {
  const now = Date.now()
  const fresh = renderTimerPill({
    available: true,
    sessionId: 'session-1',
    createdAt: now - 30_000,
    turns: 0,
    steps: 0,
    llmMs: 0,
    toolMs: 0,
    now,
  })
  assert.ok(textOf(fresh).includes('<1m'), `刚开一分钟内写 <1m，实际 ${textOf(fresh)}`)

  // 会话不在（还没恢复进存储 / 已归档 / 子会话回收）或宿主缺 sessions 服务：不画，也不留空壳。
  assert.equal(
    findByAttr(renderTimerPill({ available: false, sessionId: 'session-1' }), 'session-timer'),
    null,
  )

  // 统计键缺失（宿主没装 session-stats）：只给挂钟，不提模型/工具与轮次 —— 宁缺毋假。
  const tips = []
  const noStats = renderTimerPill(
    {
      available: true,
      sessionId: 'session-1',
      createdAt: now - 3 * 3600_000,
      turns: null,
      steps: null,
      llmMs: null,
      toolMs: null,
      now,
    },
    { methods: { showTip: (key, text) => tips.push(text) } },
  )
  const pill = findByAttr(noStats, 'session-timer')
  assert.ok(pill && textOf(noStats).includes('3h'), `3 小时整显示 3h，实际 ${textOf(noStats)}`)
  hoverPill(noStats, 'session-timer')
  assert.ok(
    !tips[0].includes('timer.work') && !tips[0].includes('timer.turns'),
    `没有统计就不提模型/工具与轮次，实际 ${tips[0]}`,
  )
})

test('计时胶囊：挂载后按 3 秒节奏取数、4 秒跳一次挂钟，并把取到的值写进快照', async () => {
  const mini = createMiniReact()
  const calls = []
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) => {
      calls.push(endpoint)
      if (endpoint === 'session-time') {
        return Promise.resolve({
          ok: true,
          value: {
            available: true,
            sessionId: 'session-1',
            createdAt: Date.now() - 60000,
            turns: 1,
            steps: 1,
            llmMs: 10,
            toolMs: 20,
            now: Date.now(),
          },
        })
      }
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  const before = bundle.intervals.length
  mini.mount(bundle.components['dsh-hud-pill'], {
    t: T,
    store,
    sessionId: 'session-1',
    useSessions: (selector) =>
      selector({
        byId: { 'session-1': { cwd: '/Users/me/project', retainedBy: { mainView: 1 } } },
      }),
  })
  await new Promise((resolve) => setImmediate(resolve))

  const added = bundle.intervals
    .slice(before)
    .map((item) => item.ms)
    .sort((left, right) => left - right)
  assert.ok(
    added.includes(3000),
    `要按 3 秒节奏取数（loader 自带 3/60 秒两档 TTL），实际 ${JSON.stringify(added)}`,
  )
  assert.ok(added.includes(4000), `挂钟要每 4 秒跳一次，实际 ${JSON.stringify(added)}`)
  assert.ok(calls.includes('session-time'), '挂载后应当真的去取了一次')
  assert.equal(
    store.getSnapshot().sessionTime.value.available,
    true,
    '取到的值要写进快照（渲染那边只读快照）',
  )
})

test('计时胶囊：负面答案只记 3 秒 —— 启动那一下会话还没恢复进存储时，别缓存一分钟', async () => {
  const mini = createMiniReact()
  let calls = 0
  let payload = { available: false, sessionId: 'session-1' }
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) => {
      if (endpoint === 'session-time') {
        calls += 1
        return Promise.resolve({ ok: true, value: payload })
      }
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store

  assert.equal((await store.loadSessionTime('session-1')).available, false)
  assert.equal((await store.loadSessionTime('session-1')).available, false)
  assert.equal(calls, 1, '3 秒内的连问复用负面结果，不把宿主打爆')

  // 实测：启动后头几百毫秒 live=0，约 30 秒后会话才进存储 —— 过了重问间隔必须真的再问。
  payload = {
    available: true,
    sessionId: 'session-1',
    createdAt: Date.now() - 60000,
    turns: 3,
    steps: 9,
    llmMs: 1000,
    toolMs: 2000,
    now: Date.now(),
  }
  const realNow = Date.now
  Date.now = () => realNow() + 4000
  try {
    const value = await store.loadSessionTime('session-1')
    assert.equal(value.available, true, '过了重问间隔要真的再问一次')
    assert.equal(calls, 2)
    assert.equal(store.getSnapshot().sessionTime.value.available, true, '新值要落进快照')
  } finally {
    Date.now = realNow
  }
})
