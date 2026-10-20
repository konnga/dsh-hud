import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CHANNEL, readPromptHistory, readSessionTime } from '../lib/host/index.js'
import { mount, rpcCall } from './helpers.mjs'

/** 一个够用的假 Session：宿主只读它的 header，投影读数器只拿它当键。 */
function fakeSession(id, createdAt, cwd = '/Users/me/project') {
  return { header: { id, createdAt, cwd } }
}

/** 挂一个带 `sessions` + `sessionProjections` 的宿主，并让投影回给定的 stats。 */
function mountWithSession(session, stats) {
  return mount({
    services: {
      sessions: { list: () => (session === null ? [] : [session]) },
      sessionProjections: {
        stateOf: (target, key) =>
          key === 'sessionStats' && target === session ? stats : undefined,
      },
    },
  })
}

test('会话时长：拿得到创建时刻与 sessionStats，字段一个不少', (t, done) => {
  const created = Date.now() - 134 * 60000 // 2h14m
  const session = fakeSession('session-1', created)
  mountWithSession(session, { turns: 27, steps: 380, llmMs: 5_355_113, toolMs: 1_389_523 })
  // inject 回调是同步跑的（helpers 的假 ctx 如此），所以这里可以直接读。
  const value = readSessionTime('session-1')
  assert.equal(value.available, true)
  assert.equal(value.sessionId, 'session-1')
  assert.equal(value.createdAt, created)
  assert.equal(value.turns, 27)
  assert.equal(value.steps, 380)
  assert.equal(value.llmMs, 5_355_113)
  assert.equal(value.toolMs, 1_389_523)
  assert.ok(typeof value.now === 'number' && value.now >= created, 'now 是宿主时钟，客户端据此对齐')
  done()
})

test('会话时长：脏字段归零、不是数字的一律不冒充', (t, done) => {
  const session = fakeSession('session-1', Date.now() - 1000)
  mountWithSession(session, { turns: 3, steps: Number.NaN, llmMs: '1234', toolMs: 4200 })
  const value = readSessionTime('session-1')
  assert.equal(value.turns, 3)
  assert.equal(value.steps, 0, 'NaN 归 0（宁可为零，也不要 NaN 传到界面上）')
  assert.equal(value.llmMs, 0, '字符串不算数')
  assert.equal(value.toolMs, 4200)
  done()
})

test('会话时长：会话不在 / 服务缺失 / 没给 sessionId，都回 available:false 而不是抛', (t, done) => {
  // 软依赖是模块级的：先挂一次带服务的宿主，用完让它自己复位（cleanups），
  // 否则下一个 mount 不提供该服务时，上一个宿主留下的值会继续生效。
  const withService = mountWithSession(fakeSession('session-1', Date.now()), {
    turns: 1,
    steps: 1,
    llmMs: 1,
    toolMs: 1,
  })
  assert.equal(readSessionTime('session-404').available, false, '会话不在（归档/子会话已回收）')
  withService.cleanups.forEach((fn) => fn())

  mount()
  assert.equal(readSessionTime('session-1').available, false, '宿主没挂 sessions 服务')
  assert.equal(readSessionTime(null).available, false)
  assert.equal(readSessionTime('').available, false)
  done()
})

test('会话时长：投影键缺失（没装 session-stats）时仍给挂钟，只是统计为 null', (t, done) => {
  const created = Date.now() - 60_000
  mountWithSession(fakeSession('session-1', created), undefined)
  const value = readSessionTime('session-1')
  assert.equal(value.available, true)
  assert.equal(value.createdAt, created, '挂钟时长照样给')
  assert.equal(value.turns, null, '统计缺失时是 null，而不是 0（0 是"确实是 0 轮"）')
  assert.equal(value.llmMs, null)
  done()
})

test('会话时长：注入被别的挂载实例卸载清掉时，按契约用 ctx.get 兜底', (t, done) => {
  const session = fakeSession('session-1', Date.now() - 60_000)
  const stats = { turns: 1, steps: 1, llmMs: 1, toolMs: 1 }
  const first = mountWithSession(session, stats)
  assert.equal(readSessionTime('session-1').available, true, '前提：正常情况下可取')

  // 模块级软依赖 + 每个挂载各自 return 清理 —— 第二个实例卸载会把值清成 null，
  // 而第一个实例仍在服务（HMR 反复重载、或宿主挂了多个实例时就会这样）。
  const second = mountWithSession(session, stats)
  second.cleanups.forEach((fn) => fn())
  const after = readSessionTime('session-1')
  assert.equal(after.available, true, '兜底生效：服务还在，就不该因为别的实例卸载而失明')
  assert.equal(after.createdAt, session.header.createdAt)

  first.cleanups.forEach((fn) => fn())
  done()
})

test('端点：session-time 走 RPC 能取到，非法 sessionId 不炸', (t, done) => {
  const created = Date.now() - 3600_000
  const { handler } = mountWithSession(fakeSession('session-1', created), {
    turns: 5,
    steps: 9,
    llmMs: 1000,
    toolMs: 2000,
  })
  rpcCall(handler, CHANNEL, 'session-time', { args: { sessionId: 'session-1' } })
    .then((result) => {
      assert.equal(result.ok, true)
      assert.equal(result.value.createdAt, created)
      assert.equal(result.value.llmMs, 1000)
      return rpcCall(handler, CHANNEL, 'session-time', { args: {} })
    })
    .then((result) => {
      assert.equal(result.ok, true)
      assert.equal(result.value.available, false, '没给 sessionId 只是"不可用"，不是错误')
      done()
    })
    .catch(done)
})

/* ------------------------------------------------ prompt 历史（输入框 ↑ 召回的数据源） */

/** 挂一个带 `sessions` + `turnOutline` 的宿主。 */
function mountWithOutline(session, outline) {
  return mount({
    services: {
      sessions: { list: () => (session === null ? [] : [session]) },
      sessionProjections: {
        stateOf: (target, key) =>
          key === 'turnOutline' && target === session ? outline : undefined,
      },
    },
  })
}

test('prompt 历史：新的在前、相邻重复只留一条、空 prompt 跳过', (t, done) => {
  const session = fakeSession('session-1', Date.now())
  mountWithOutline(session, {
    turns: [
      { turn: 1, prompt: '第一句' },
      { turn: 2, prompt: '第二句' },
      { turn: 3, prompt: '第二句' }, // 连发两次 → 只留一条
      { turn: 4, prompt: '   ' }, // 空白 → 跳过
      { turn: 5, prompt: ' 第五句 ' }, // 前后空白会 trim
    ],
  })
  const value = readPromptHistory('session-1')
  assert.deepEqual(value.prompts, ['第五句', '第二句', '第一句'], '从最新往回排')
  assert.equal(value.available, true)
  done()
})

test('prompt 历史：limit 起作用（1..200 钳制），投影缺失/会话不在时回空', (t, done) => {
  const session = fakeSession('session-1', Date.now())
  const turns = Array.from({ length: 12 }, (_, index) => ({
    turn: index + 1,
    prompt: `第${index + 1}句`,
  }))
  const withOutline = mountWithOutline(session, { turns })
  assert.equal(readPromptHistory('session-1', 3).prompts.length, 3, 'limit=3')
  assert.deepEqual(readPromptHistory('session-1', 3).prompts, ['第12句', '第11句', '第10句'])
  assert.equal(readPromptHistory('session-1', 0).prompts.length, 1, 'limit 下限 1')
  assert.equal(
    readPromptHistory('session-1', 9999).prompts.length,
    12,
    '上限不越界（这里只有 12 条）',
  )

  // 软依赖是模块级的：先让上一个宿主复位，否则它的投影读数器还在。
  withOutline.cleanups.forEach((fn) => fn())
  const missingProjection = mount({
    services: { sessions: { list: () => [session] } }, // 没挂 sessionProjections
  })
  assert.deepEqual(readPromptHistory('session-1'), {
    available: false,
    sessionId: 'session-1',
    prompts: [],
  })
  missingProjection.cleanups.forEach((fn) => fn())

  const noSession = mount({ services: { sessions: { list: () => [] } } })
  assert.equal(readPromptHistory('session-1').available, false)
  assert.equal(readPromptHistory(null).available, false)
  assert.equal(readPromptHistory('').available, false)
  noSession.cleanups.forEach((fn) => fn())
  done()
})

test('端点：prompt-history 走 RPC 能取到，limit 透传', (t, done) => {
  const session = fakeSession('session-1', Date.now())
  const { handler, cleanups } = mountWithOutline(session, {
    turns: [
      { turn: 1, prompt: '甲' },
      { turn: 2, prompt: '乙' },
      { turn: 3, prompt: '丙' },
    ],
  })
  rpcCall(handler, CHANNEL, 'prompt-history', { args: { sessionId: 'session-1', limit: 2 } })
    .then((result) => {
      assert.equal(result.ok, true)
      assert.deepEqual(result.value.prompts, ['丙', '乙'])
      cleanups.forEach((fn) => fn())
      done()
    })
    .catch(done)
})
