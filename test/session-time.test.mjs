import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CHANNEL, readSessionTime } from '../lib/index.js'
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
        stateOf: (target, key) => (key === 'sessionStats' && target === session ? stats : undefined),
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
  const withService = mountWithSession(fakeSession('session-1', Date.now()), { turns: 1, steps: 1, llmMs: 1, toolMs: 1 })
  assert.equal(readSessionTime('session-404').available, false, '会话不在（归档/子会话已回收）')
  withService.cleanups.forEach(fn => fn())

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
  second.cleanups.forEach(fn => fn())
  const after = readSessionTime('session-1')
  assert.equal(after.available, true, '兜底生效：服务还在，就不该因为别的实例卸载而失明')
  assert.equal(after.createdAt, session.header.createdAt)

  first.cleanups.forEach(fn => fn())
  done()
})

test('端点：session-time 走 RPC 能取到，非法 sessionId 不炸', (t, done) => {
  const created = Date.now() - 3600_000
  const { handler } = mountWithSession(fakeSession('session-1', created), { turns: 5, steps: 9, llmMs: 1000, toolMs: 2000 })
  rpcCall(handler, CHANNEL, 'session-time', { args: { sessionId: 'session-1' } }).then(result => {
    assert.equal(result.ok, true)
    assert.equal(result.value.createdAt, created)
    assert.equal(result.value.llmMs, 1000)
    return rpcCall(handler, CHANNEL, 'session-time', { args: {} })
  }).then(result => {
    assert.equal(result.ok, true)
    assert.equal(result.value.available, false, '没给 sessionId 只是"不可用"，不是错误')
    done()
  }).catch(done)
})
