/**
 * 「换模型就换账本」这条触发链的用例。
 *
 * 背景：胶囊的取数有 TTL（成功 60 秒），而换模型**不是取数失败** ——
 * 它只是让"当前会话用哪个提供方"变了。TTL 按时钟算、不按事实算，
 * 于是切到 `ur` 之后会先盯着平台账号的 `¥8.60` 看满一分钟。用户就是这么报的。
 *
 * 这里钉住四件事：
 *   1. 提供方变了 → 立刻重取（且是 force，跳过缓存）；
 *   2. 同一站里换模型（ur 的两个模型）→ **不**重取，账本没变；
 *   3. `pending` 优先 —— 菜单里刚点下的模型，哪怕一条消息都还没发，账本也该换；
 *   4. 没有 `sessions` 服务 / 卸载之后 → 一次都不触发（软依赖，不许崩）。
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { mountClient } from './client-harness.mjs'

/** 一个只长着我们需要的那个洞的 `sessions` 服务：`modelSelection` 投影可推。 */
function fakeSessions(sessionId = 'session-a') {
  const listeners = new Set()
  let value
  const face = {
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    /** 推一次新的模型选择（模拟用户在菜单里点了一个模型）。 */
    select(next) {
      value = next
      for (const listener of [...listeners]) listener()
    },
    subscriptionCount: () => listeners.size,
    service: {
      binding(id) {
        if (id !== sessionId) return undefined
        return {
          session: {
            projections: {
              faceOf: (key) => (key === 'modelSelection' ? face : undefined),
            },
          },
        }
      },
    },
  }
}

/** 挂一个会记录 `provider-balance` 调用的客户端（其余端点一律空答复）。 */
function mountWithSessions(services) {
  const calls = []
  const mounted = mountClient({
    services,
    rpc(channel, method, payload) {
      calls.push({ method, args: payload.args })
      return Promise.resolve({ ok: true, value: null })
    },
  })
  const store = mounted.registrations
    .find((item) => item.options.id === 'dsh-hud-pill')
    .options.inject('session-a').store
  return { mounted, store, calls }
}

/** 只数"余额重取"那几次，以及它们带没带 force。 */
function balanceForces(calls) {
  return calls
    .filter((call) => call.method === 'provider-balance')
    .map((call) => call.args.force === true)
}

function settle() {
  return new Promise((resolve) => setImmediate(resolve))
}

test('换模型：提供方从平台账号切到 ur → 立刻强制重取一次', async () => {
  const sessions = fakeSessions()
  const { mounted, store, calls } = mountWithSessions({ sessions: sessions.service })
  try {
    store.bindSession('session-a', '/tmp/repo')
    sessions.select({ lastUsed: { provider: 'deepseek-account' }, pending: null })
    await settle()
    const before = balanceForces(calls).length

    // 用户切到 ur 的模型。
    sessions.select({
      lastUsed: { provider: 'deepseek-account' },
      pending: { provider: 'ur', model: 'deepseek-v4.1-flash' },
    })
    await settle()

    const after = balanceForces(calls)
    assert.ok(after.length > before, '换提供方必须触发一次重取')
    assert.equal(after[after.length - 1], true, '这次重取要带给宿主 force（跳过 60 秒缓存）')
  } finally {
    mounted.dispose?.()
  }
})

test('换模型：同一个站里换模型 → 不重取（账本没变，别白打请求）', async () => {
  const sessions = fakeSessions()
  const { mounted, store, calls } = mountWithSessions({ sessions: sessions.service })
  try {
    store.bindSession('session-a', '/tmp/repo')
    sessions.select({ lastUsed: { provider: 'ur' }, pending: null })
    await settle()
    const before = calls.filter((call) => call.method === 'provider-balance').length

    // ur 下面从 flash 换到 luna：还是同一个站、同一本账。
    sessions.select({
      lastUsed: { provider: 'ur', model: 'deepseek-v4.1-flash' },
      pending: { provider: 'ur', model: 'gpt-6-luna' },
    })
    await settle()

    assert.equal(
      calls.filter((call) => call.method === 'provider-balance').length,
      before,
      '同一个提供方换模型不该再问一次余额',
    )
  } finally {
    mounted.dispose?.()
  }
})

test('换模型：`pending` 优先 —— 刚点下、还没发消息，账本也要立刻换', async () => {
  // 这是真实场景：菜单里选了 ur 的模型，第一条消息还没发出去。
  // 若只读 `lastUsed`，胶囊会继续显示上一个站的钱，直到那条消息发出为止。
  const sessions = fakeSessions()
  const { mounted, store, calls } = mountWithSessions({ sessions: sessions.service })
  try {
    store.bindSession('session-a', '/tmp/repo')
    // lastUsed 仍指向平台账号，pending 已经是 ur。
    sessions.select({
      lastUsed: { provider: 'deepseek-account' },
      pending: { provider: 'ur', model: 'deepseek-v4.1-flash' },
    })
    await settle()
    assert.equal(
      balanceForces(calls).at(-1),
      true,
      '只按 lastUsed 判断的话这里不会触发 —— 必须读 pending',
    )
  } finally {
    mounted.dispose?.()
  }
})

test('换模型：没有 sessions 服务 → 一次都不触发，也不崩（软依赖）', async () => {
  const { mounted, store, calls } = mountWithSessions({})
  try {
    store.bindSession('session-a', '/tmp/repo')
    await settle()
    assert.deepEqual(
      balanceForces(calls).filter((force) => force === true),
      [],
    )
  } finally {
    mounted.dispose?.()
  }
})

test('换模型：卸载后不再触发（订阅与补挂定时器都要收拾干净）', async () => {
  const sessions = fakeSessions()
  const { mounted, store, calls } = mountWithSessions({ sessions: sessions.service })
  store.bindSession('session-a', '/tmp/repo')
  await settle()
  sessions.select({ lastUsed: { provider: 'ur' }, pending: null })
  await settle()

  mounted.dispose()
  assert.equal(sessions.subscriptionCount(), 0, '卸载必须退订，否则投影那边会一直留着回调')

  const before = balanceForces(calls).length
  sessions.select({ lastUsed: { provider: 'happycoding' }, pending: null })
  await settle()
  assert.equal(balanceForces(calls).length, before, '卸载之后不该再有任何重取')
})
