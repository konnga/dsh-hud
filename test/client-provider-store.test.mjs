/**
 * store 用例：「当前会话模型来源」的余额这一片。
 *
 * 驱动的是**真 store**（从座位注册的 `inject()` 里取），验的是"按会话换账本"的规则本身：
 * 会话用的提供方不同 → 胶囊看不同的账本；读不到 → 不画（而不是画别人的余额）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { mountClient } from './client-harness.mjs'

/** 从座位注册里把真 store 掏出来。 */
function storeOf(mounted) {
  const entry = mounted.registrations.find((item) => item.options.id === 'dsh-hud-pill')
  assert.ok(entry, '胶囊座位应当注册过')
  return entry.options.inject('session-1').store
}

/** 等一条 then 链跑完（取数是纯 Promise，没有定时器）。 */
function settle() {
  return new Promise((resolve) => setImmediate(resolve))
}

/** 挂一个只有 provider-balance 这条通道应答的客户端；`reply` 决定每次答复。 */
function mountWithProvider(reply) {
  const calls = []
  const mounted = mountClient({
    rpc(channel, method, payload) {
      // 只记这一条端点：其它端点（status / session-changes …）也会走同一个 rpc，
      // 混在一起数会让"打了几次余额"变成数不清。
      if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
      calls.push({ channel, method, args: payload.args })
      return Promise.resolve(reply(payload.args))
    },
  })
  return { mounted, calls, store: storeOf(mounted) }
}

/** 一个"读到了中转站余额"的宿主答复。 */
function readyReply(overrides = {}) {
  return {
    ok: true,
    value: {
      available: true,
      balance: {
        provider: 'muyuan',
        kind: 'relay',
        currency: 'USD',
        remaining: '2265.33',
        usedAccount: null,
        usedKey: '212.74',
        placeholderLimit: false,
        wallets: [],
        bonus: [],
        at: 1_700_000_000_000,
        ...overrides,
      },
    },
  }
}

test('提供方切片：读到余额 → 账本切到 provider，并带上会话 id 去问宿主', async () => {
  const { calls, store } = mountWithProvider(() => readyReply())
  // 先让 store 知道当前会话（真实路径由归因那一片写进快照）。
  store.bindSession('session-1', '/tmp/repo')
  await store.loadProviderBalance()
  await settle()

  assert.equal(calls.length, 1)
  assert.equal(calls[0].channel, '/dsh-hud-rpc')
  assert.equal(calls[0].method, 'provider-balance')
  assert.deepEqual(calls[0].args, { sessionId: 'session-1', force: false })

  const ledger = store.getSnapshot().provider
  assert.equal(ledger.mode, 'provider')
  assert.equal(ledger.balance.provider, 'muyuan')
  assert.equal(ledger.balance.remaining, '2265.33')
  assert.equal(ledger.balance.usedKey, '212.74')
})

test('提供方切片：宿主说"这个提供方的账本就是平台账号" → 账本回到 account，不画第二份数', async () => {
  const { store } = mountWithProvider(() => ({
    ok: true,
    value: { available: true, account: true },
  }))
  store.bindSession('session-1', '/tmp/repo')
  await store.loadProviderBalance()
  await settle()
  const ledger = store.getSnapshot().provider
  assert.equal(ledger.mode, 'account')
  assert.equal(ledger.balance, null)
})

test('提供方切片：读不到（不支持的站 / 没密钥 / 没会话）→ unavailable，不画胶囊', async () => {
  const cases = [
    {
      ok: true,
      value: {
        available: false,
        provider: 'api404',
        kind: 'relay',
        reason: 'unsupported',
        message: null,
      },
    },
    {
      ok: true,
      value: {
        available: false,
        provider: 'muyuan',
        kind: 'relay',
        reason: 'no-key',
        message: null,
      },
    },
    { ok: false, error: { code: 'boom', message: 'nope' } },
  ]
  for (const reply of cases) {
    const { store } = mountWithProvider(() => reply)
    store.bindSession('session-1', '/tmp/repo')
    await store.loadProviderBalance()
    await settle()
    assert.equal(
      store.getSnapshot().provider.mode,
      'unavailable',
      `应当落到 unavailable：${JSON.stringify(reply)}`,
    )
    assert.equal(store.getSnapshot().provider.balance, null)
  }
})

test('提供方切片：形状不对的答复（缺字段 / 非法金额）当作读不到', async () => {
  for (const balance of [
    null,
    {},
    { provider: '', kind: 'relay', remaining: '1', usedKey: null },
    { provider: 'x', kind: 'nonsense', remaining: '1', usedKey: null },
    // 一个能画的数字都没有：这不是余额。
    {
      provider: 'x',
      kind: 'relay',
      remaining: null,
      usedAccount: null,
      usedKey: null,
      wallets: [],
    },
  ]) {
    const { store } = mountWithProvider(() => ({
      ok: true,
      value: { available: true, balance },
    }))
    store.bindSession('session-1', '/tmp/repo')
    await store.loadProviderBalance()
    await settle()
    assert.equal(store.getSnapshot().provider.mode, 'unavailable', JSON.stringify(balance))
  }
})

test('提供方切片：换会话就换账本（不吃上一个会话的结论）', async () => {
  const seen = []
  const mounted = mountClient({
    rpc(channel, method, payload) {
      if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
      seen.push(payload.args.sessionId)
      const sessionId = payload.args.sessionId
      return Promise.resolve(
        readyReply({
          provider: sessionId === 'session-a' ? 'muyuan' : 'ur',
          remaining: sessionId === 'session-a' ? '10.00' : null,
          usedKey: sessionId === 'session-a' ? null : '441.72',
          placeholderLimit: sessionId !== 'session-a',
        }),
      )
    },
  })
  const store = storeOf(mounted)

  store.bindSession('session-a', '/tmp/repo')
  await store.loadProviderBalance()
  await settle()
  assert.equal(store.getSnapshot().provider.balance.provider, 'muyuan')

  // 换会话：TTL 还没到，但账本必须换（这是"按当前会话查"的核心）。
  store.bindSession('session-b', '/tmp/repo')
  await store.loadProviderBalance()
  await settle()
  assert.equal(store.getSnapshot().provider.balance.provider, 'ur')
  assert.equal(store.getSnapshot().provider.balance.remaining, null)
  assert.deepEqual(seen, ['session-a', 'session-b'])
})

test('提供方切片：TTL 内不重复打宿主，force 跳过 TTL', async () => {
  const { calls, store } = mountWithProvider(() => readyReply())
  store.bindSession('session-1', '/tmp/repo')
  await store.loadProviderBalance()
  await settle()
  await store.loadProviderBalance()
  await settle()
  assert.equal(calls.length, 1, 'TTL 内不该重复请求')

  await store.loadProviderBalance(true)
  await settle()
  assert.equal(calls.length, 2, 'force 要跳过 TTL')
})

test('提供方切片：读失败时保留上一次的 provider 余额（网络抖一下不该让胶囊消失）', async () => {
  let reply = readyReply()
  const mounted = mountClient({
    rpc(channel, method) {
      if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
      return Promise.resolve(reply)
    },
  })
  const store = storeOf(mounted)
  store.bindSession('session-1', '/tmp/repo')
  await store.loadProviderBalance()
  await settle()
  assert.equal(store.getSnapshot().provider.balance.remaining, '2265.33')

  // 失败一次：仍然画上一次的数（模式还是 provider）。
  reply = { ok: false, error: { code: 'boom', message: 'nope' } }
  await store.loadProviderBalance(true)
  await settle()
  const ledger = store.getSnapshot().provider
  assert.equal(ledger.mode, 'provider')
  assert.equal(ledger.balance.remaining, '2265.33')
})

test('提供方切片：还没有会话时是 unknown（胶囊先按账号那一路画，不闪没）', async () => {
  const { calls, store } = mountWithProvider(() => readyReply())
  await store.loadProviderBalance()
  await settle()
  assert.equal(calls.length, 0, '没有会话就不该发请求')
  assert.equal(store.getSnapshot().provider.mode, 'unknown')
})

test('绑定会话就顺手取一次（用户报过的那一幕：要等五分钟轮询才会纠正）', async () => {
  const { calls, store } = mountWithProvider(() => readyReply())
  // 只绑会话，**不**手动调 loadProviderBalance —— 这正是胶囊挂载时走的路径。
  store.bindSession('session-1', '/tmp/repo')
  await settle()
  await settle()

  assert.equal(calls.length, 1, '绑会话之后应当立刻问一次账本')
  assert.deepEqual(calls[0].args, { sessionId: 'session-1', force: false })
  assert.equal(store.getSnapshot().provider.mode, 'provider')
  assert.equal(store.getSnapshot().provider.balance.provider, 'muyuan')
})

test('读不到时账本记下提供方与原因（胶囊据此画 `ur —`，而不是消失）', async () => {
  const { store } = mountWithProvider(() => ({
    ok: true,
    value: {
      available: false,
      provider: 'api404',
      kind: 'relay',
      reason: 'unsupported',
      message: null,
    },
  }))
  store.bindSession('session-1', '/tmp/repo')
  await settle()
  await settle()
  const ledger = store.getSnapshot().provider
  assert.equal(ledger.mode, 'unavailable')
  assert.equal(ledger.provider, 'api404')
  assert.equal(ledger.reason, 'unsupported')
  assert.equal(ledger.balance, null)
})

test('换会话时不吃上一个会话的在途请求（否则新账本要白等一个 TTL）', async () => {
  /** 手工控制 resolve 时刻的答复。 */
  const pending = []
  const mounted = mountClient({
    rpc(channel, method, payload) {
      if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
      return new Promise((resolve) => pending.push({ sessionId: payload.args.sessionId, resolve }))
    },
  })
  const store = storeOf(mounted)

  store.bindSession('session-a', '/tmp/repo')
  await settle()
  assert.equal(pending.length, 1, 'A 会话发了一次请求')

  // A 还没回来就切到 B：B 必须自己发请求，不能复用 A 的在途 promise。
  store.bindSession('session-b', '/tmp/repo')
  await settle()
  assert.deepEqual(
    pending.map((item) => item.sessionId),
    ['session-a', 'session-b'],
    'B 应当自己发一次',
  )

  // 先回来的那个属于 A，当前会话是 B → 结论要丢掉，不能画成 B 的余额。
  pending[0].resolve(readyReply({ provider: 'muyuan' }))
  await settle()
  assert.notEqual(store.getSnapshot().provider.balance?.provider, 'muyuan')

  pending[1].resolve(
    readyReply({ provider: 'ur', remaining: null, usedKey: '451.95', placeholderLimit: true }),
  )
  await settle()
  const ledger = store.getSnapshot().provider
  assert.equal(ledger.mode, 'provider')
  assert.equal(ledger.balance.provider, 'ur')
})

test('点胶囊那次是 force：要能绕过宿主的 60s 缓存（"我刚配好令牌怎么还是旧数"）', async () => {
  const { calls, store } = mountWithProvider(() => readyReply())
  store.bindSession('session-1', '/tmp/repo')
  await settle()
  await settle()
  assert.deepEqual(calls[0].args, { sessionId: 'session-1', force: false }, '自动取数不吃 force')

  await store.loadProviderBalance(true)
  await settle()
  assert.deepEqual(
    calls[calls.length - 1].args,
    { sessionId: 'session-1', force: true },
    '点击要带 force 给宿主',
  )
})

/* ---------------------------------------- 存完后台令牌：面板一定要自己消失 */

/**
 * 这一组守的是用户的原话：「保存成功后，要自动关闭弹窗」。
 *
 * 早先的收法是"存成功 → 置一个 savedAt → 组件里的 setTimeout(900ms) 收起"。
 * 那条路把"关不关"寄托在渲染副作用上，任何一个漏掉的 effect 都让面板僵在那儿，
 * 而用户此时已经存好了、只是在干等。现在关闭是 store 里的一句同步变更，
 * 所以这里断言的是 store 的状态，而不是某个定时器有没有被排上。
 */

/** 挂一个 provider-credential 有答复的客户端（余额那条也一并应答，便于观察重取）。 */
function mountWithCredential(credentialReply) {
  const calls = []
  const mounted = mountClient({
    rpc(channel, method, payload) {
      if (method === 'provider-credential') {
        calls.push({ method, args: payload.args })
        return Promise.resolve(credentialReply(payload.args))
      }
      if (method === 'provider-balance') {
        calls.push({ method, args: payload.args })
        return Promise.resolve(readyReply())
      }
      return Promise.resolve({ ok: true, value: null })
    },
  })
  return { mounted, calls, store: storeOf(mounted) }
}

/** 打开面板（真 store 的面：`openTokenPanel(provider, ref)`）。 */
function openPanel(store, provider = 'ur', ref = 'UR_ACCESS_TOKEN') {
  store.openTokenPanel(provider, ref)
  assert.equal(store.getSnapshot().tokenPanel.open, true, '打开后应当处于打开态')
}

test('存成功 → 面板当场关闭（不等定时器，也不等重新取数）', async () => {
  const { store, calls } = mountWithCredential(() => ({
    ok: true,
    value: { saved: true, ref: 'UR_ACCESS_TOKEN' },
  }))
  store.bindSession('session-1', '/tmp/repo')
  openPanel(store)

  const ok = await store.saveProviderToken('sk-dashboard-token')
  assert.equal(ok, true)

  // 关键断言：**同步就已经关了**，没有任何"900ms 后再说"的余地。
  const panel = store.getSnapshot().tokenPanel
  assert.equal(panel.open, false, '存成功后必须立刻关掉')
  assert.equal(panel.error, null)
  assert.equal(calls[0].method, 'provider-credential')
  // 关掉之后仍然重取了一次，胶囊上的数字才会变。
  // 这里**必然还有一个** `force: false` 的请求：`bindSession` 自己会触发一次首取，
  // 到这会儿可能还在飞。所以断言"最后一个余额请求是 force"，而不是"一共只有一个请求"。
  //（这正是本轮修掉的 bug：早先 `force` 被那个在途请求去重掉了，于是存完令牌后
  //  胶囊拿到的还是**旧凭据**那次请求的结论，数字一直不变。）
  const balanceCalls = calls.filter((c) => c.method === 'provider-balance')
  assert.ok(balanceCalls.length >= 1)
  assert.deepEqual(
    balanceCalls[balanceCalls.length - 1].args,
    { sessionId: 'session-1', force: true },
    '存完必须发出一次跳过缓存的强制重取',
  )
})

test('存成功 → 即使重新取数很慢，面板也早就关了（不给网络留扣人的机会）', async () => {
  let release = () => {}
  const hanging = new Promise((resolve) => {
    release = () => resolve(readyReply())
  })
  const mounted = mountClient({
    rpc(channel, method, payload) {
      if (method === 'provider-credential') {
        return Promise.resolve({ ok: true, value: { saved: true, ref: 'UR_ACCESS_TOKEN' } })
      }
      // 余额那一路**永不立即答复**：模拟宿主超时（8 秒）那种慢法。
      if (method === 'provider-balance') return hanging
      return Promise.resolve({ ok: true, value: null })
    },
  })
  const store = storeOf(mounted)
  store.bindSession('session-1', '/tmp/repo')
  openPanel(store)

  const ok = await store.saveProviderToken('sk-dashboard-token')
  assert.equal(ok, true)
  assert.equal(
    store.getSnapshot().tokenPanel.open,
    false,
    '重取还在飞的时候，面板就该关掉了 —— 否则慢网络会把面板扣在屏幕上 8 秒',
  )
  release()
  await settle()
})

test('存失败 → 面板**不关**，并带上原因（要留着让人改完再存）', async () => {
  const { store } = mountWithCredential(() => ({
    ok: true,
    value: { saved: false, reason: 'bad-token', message: null },
  }))
  store.bindSession('session-1', '/tmp/repo')
  openPanel(store)

  const ok = await store.saveProviderToken('sk-has space')
  assert.equal(ok, false)
  const panel = store.getSnapshot().tokenPanel
  assert.equal(panel.open, true, '失败时不能把面板关掉，否则原因没处看')
  assert.equal(panel.saving, false, '别卡在"保存中…"')
  assert.equal(panel.error, 'bad-token')
  assert.equal(panel.provider, 'ur', '提供方要留着，用户改一改还能再存')
})

test('存失败（端点整个挂掉）→ 面板同样不关，报 failed', async () => {
  const mounted = mountClient({
    rpc(channel, method) {
      if (method === 'provider-credential') return Promise.reject(new Error('boom'))
      return Promise.resolve({ ok: true, value: null })
    },
  })
  const store = storeOf(mounted)
  store.bindSession('session-1', '/tmp/repo')
  openPanel(store)
  assert.equal(await store.saveProviderToken('sk-x'), false)
  assert.equal(store.getSnapshot().tokenPanel.open, true)
  assert.equal(store.getSnapshot().tokenPanel.error, 'failed')
})

test('存成功后再打开面板 → 是干净的一张白纸（上一轮的错/输入不残留）', async () => {
  const { store } = mountWithCredential(() => ({
    ok: true,
    value: { saved: true, ref: 'UR_ACCESS_TOKEN' },
  }))
  store.bindSession('session-1', '/tmp/repo')
  openPanel(store)
  await store.saveProviderToken('sk-dashboard-token')
  openPanel(store, 'muyuan', 'MUYUAN_ACCESS_TOKEN')
  const panel = store.getSnapshot().tokenPanel
  assert.equal(panel.open, true)
  assert.equal(panel.error, null)
  assert.equal(panel.saving, false)
  assert.equal(panel.provider, 'muyuan')
})

test('强制重取：先发后到的旧结论不能盖掉新结论（旧凭据那次请求回来得晚）', async () => {
  // 场景就是"存完令牌"这一下：`bindSession` 的首取是用**旧凭据**发出的、可能晚到；
  // 强制重取用**新凭据**、可能早到。若不做代次判断，后到的旧结论会把新数字盖掉，
  // 胶囊就会一直显示旧值，直到下一个 TTL —— 用户看到的就是"存了没反应"。
  const pending = []
  const mounted = mountClient({
    rpc(channel, method, payload) {
      if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
      return new Promise((resolve) => {
        pending.push({ args: payload.args, resolve })
      })
    },
  })
  const store = storeOf(mounted)
  store.bindSession('session-1', '/tmp/repo')
  await settle()

  // 第一次（旧凭据、force:false）先挂着不发结果。
  assert.equal(pending.length, 1)
  // 强制重取：应当**另发**一个请求，而不是复用上面那个。
  const forced = store.loadProviderBalance(true)
  await settle()
  assert.equal(pending.length, 2, 'force 不该被在途请求去重掉')

  // 新凭据那个先回：读到 $855.69。
  pending[1].resolve(
    readyReply({ provider: 'ur', remaining: '855.69', usedAccount: '526.66', usedKey: '479.44' }),
  )
  await forced
  await settle()
  assert.equal(store.getSnapshot().provider.balance.remaining, '855.69')

  // 旧凭据那个后回：读到的还是"只有本 Key 已用"。它必须被丢弃。
  pending[0].resolve(readyReply({ provider: 'ur', remaining: null, usedKey: '479.44' }))
  await settle()
  const ledger = store.getSnapshot().provider
  assert.equal(ledger.balance.remaining, '855.69', '旧请求后到，不该把新结论盖掉')
  assert.equal(ledger.balance.usedAccount, '526.66')
})

/* -------------------------------- 账本必须自带"这是哪个站"（点胶囊要靠它） */

test('账本：provider 模式下 ledger.provider 必须有值（否则"配令牌"那一下找不到站）', async () => {
  // 这是真出过的 bug：正常读取走 `publish('provider', balance, undefined, token)`，
  // `provider` 只从 `extra` 取 → `ledger.provider === null` → 面板打开后 provider 为空
  // → `saveProviderToken` 静默 `return false`：不报错、不发请求、什么都不发生。
  // 用户的原话就是"我保存了没什么变化"。
  const { store } = mountWithProvider(() => readyReply({ provider: 'ur' }))
  store.bindSession('session-1', '/tmp/repo')
  await store.loadProviderBalance()
  await settle()

  const ledger = store.getSnapshot().provider
  assert.equal(ledger.mode, 'provider')
  assert.equal(ledger.provider, 'ur', '账本自己要记得是哪个站')
  assert.equal(ledger.provider, ledger.balance.provider, '两处不能不一致')

  // 点胶囊这条路径要能拿到站名（真 store 里 `onPillClick` 就是把 ledger 交给面板的）。
  store.openTokenPanel(ledger.provider, 'UR_ACCESS_TOKEN')
  assert.equal(store.getSnapshot().tokenPanel.provider, 'ur')
})

test('存令牌：面板里没有提供方 → 报 unknown-provider（绝不静默失败）', async () => {
  const { store, calls } = mountWithCredential(() => ({
    ok: true,
    value: { saved: true, ref: 'UR_ACCESS_TOKEN' },
  }))
  store.bindSession('session-1', '/tmp/repo')
  // 故意绕过 openTokenPanel，直接造一个 provider 为空的面板。
  store.openTokenPanel('', null)
  const ok = await store.saveProviderToken('sk-x')
  assert.equal(ok, false)
  assert.equal(
    calls.filter((c) => c.method === 'provider-credential').length,
    0,
    '连请求都不该发（发了也是瞎猜）',
  )
  const panel = store.getSnapshot().tokenPanel
  assert.equal(panel.open, true, '面板要留着')
  assert.equal(panel.error, 'unknown-provider', '必须有可见的原因，不能一片安静')
})

/* ------------------------------------------- 启动那一会儿：别让胶囊空等半分钟 */

test('退避：失败后 1s 起、翻倍、30s 封顶（原来固定 30 秒，重启后要空半分钟）', () => {
  // 直接对**构建产物**取值：这些常量与函数不挂在插件导出面上（`apply` / `inject` 之外
  // 都是内部实现），单测拿不到；而这个仓库本来就有"读 lib/client.js 断言"的先例
  // （通道前缀那条）。所以这里从产物里取出真代码来跑，而不是抄一份常量。
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const number = (name) => {
    const match = new RegExp('const ' + name + ' = ([^;]+);').exec(source)
    assert.ok(match, `产物里找不到 ${name}`)
    return Number(match[1])
  }
  const body = /function providerRetryDelayMs\(failStreak\) \{[\s\S]*?\n\}/.exec(source)
  assert.ok(body, '产物里找不到 providerRetryDelayMs')
  const call = new Function(
    'PROVIDER_RETRY_BASE_MS',
    'PROVIDER_RETRY_MS',
    body[0] + '\nreturn providerRetryDelayMs;',
  )(number('PROVIDER_RETRY_BASE_MS'), number('PROVIDER_RETRY_MS'))

  assert.equal(number('PROVIDER_RETRY_BASE_MS'), 1000)
  assert.equal(number('PROVIDER_RETRY_MS'), 30000)
  assert.equal(call(0), 1000, '还没失败过：1 秒')
  assert.equal(call(1), 1000)
  assert.equal(call(2), 2000)
  assert.equal(call(3), 4000)
  assert.equal(call(4), 8000)
  assert.equal(call(5), 16000)
  assert.equal(call(6), 30000, '封顶在 30 秒，别无限翻倍')
  assert.equal(call(50), 30000, '连续失败很多次也只是 30 秒一次')
})

test('启动：第一次问落空（宿主投影还没就绪）→ 1 秒后就能再问，不用等 30 秒', async () => {
  // 真 store + 真时钟：把 `Date.now` 钉住，直接观察 TTL 闸门放不放行。
  const realNow = Date.now
  let clock = 1_000_000
  Date.now = () => clock
  try {
    let asks = 0
    const mounted = mountClient({
      rpc(channel, method) {
        if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
        asks += 1
        // 头一次答不上来（真实形态：宿主还没读到模型选择投影）。
        if (asks === 1)
          return Promise.resolve({
            ok: true,
            value: { available: false, reason: 'unknown-provider', token: null },
          })
        return Promise.resolve(readyReply())
      },
    })
    const store = storeOf(mounted)
    store.bindSession('session-1', '/tmp/repo')
    await settle()
    assert.equal(asks, 1, '会话一绑上就问了一次')
    assert.equal(store.getSnapshot().provider.mode, 'unavailable', '第一次落空')

    // 300ms 后：退避还没到，不该再问。
    clock += 300
    await store.loadProviderBalance()
    await settle()
    assert.equal(asks, 1, '1 秒内不该重问（否则就是每秒一次的重试风暴）')

    // 1100ms 后：应当放行 —— 这就是"重启后一两秒内出现"的关键。
    clock += 800
    await store.loadProviderBalance()
    await settle()
    assert.equal(asks, 2, '失败后约 1 秒就允许重问')
    assert.equal(store.getSnapshot().provider.mode, 'provider')
    assert.equal(store.getSnapshot().provider.balance.remaining, '2265.33')
    mounted.dispose?.()
  } finally {
    Date.now = realNow
  }
})

test('退避：成功一次就归零（读数好着呢，别继续按罚时降频）', async () => {
  const realNow = Date.now
  let clock = 2_000_000
  Date.now = () => clock
  try {
    let asks = 0
    const mounted = mountClient({
      rpc(channel, method) {
        if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
        asks += 1
        if (asks === 1)
          return Promise.resolve({
            ok: true,
            value: { available: false, reason: 'unsupported', token: null },
          })
        return Promise.resolve(readyReply())
      },
    })
    const store = storeOf(mounted)
    store.bindSession('session-1', '/tmp/repo')
    await settle()
    clock += 1100
    await store.loadProviderBalance()
    await settle()
    assert.equal(asks, 2, '失败后重试成功')

    // 成功之后再往后挪 5 秒：TTL 是 60 秒，不该再问。
    clock += 5000
    await store.loadProviderBalance()
    await settle()
    assert.equal(asks, 2, '成功后应当回到 60 秒 TTL，而不是继续按失败退避')
    mounted.dispose?.()
  } finally {
    Date.now = realNow
  }
})

/* ------------------------------------ 换会话 / 新会话：立刻查、别顶着旧账本 */

test('换会话：立刻查一次，并且先把旧账本清成 `--`（不顶着别人的钱等答案）', async () => {
  const calls = []
  const mounted = mountClient({
    rpc(channel, method, payload) {
      if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
      calls.push(payload.args.sessionId)
      // 会话 a 用 muyuan，会话 b 用 ur。
      const provider = payload.args.sessionId === 'session-b' ? 'ur' : 'muyuan'
      return Promise.resolve({
        ok: true,
        value: {
          available: true,
          balance: {
            provider,
            kind: 'relay',
            currency: 'USD',
            remaining: provider === 'ur' ? '742.23' : '2265.33',
            usedAccount: null,
            usedKey: null,
            placeholderLimit: false,
            wallets: [],
            bonus: [],
            at: 1_700_000_000_000,
          },
          token: { ref: provider.toUpperCase() + '_ACCESS_TOKEN', configured: true },
        },
      })
    },
  })
  const store = storeOf(mounted)

  store.bindSession('session-a', '/tmp/repo')
  await settle()
  assert.equal(store.getSnapshot().provider.balance.provider, 'muyuan')

  // 切到会话 b：**绑定那一瞬**旧账本就该没了（同步的，不等任何 Promise）。
  store.bindSession('session-b', '/tmp/repo')
  const during = store.getSnapshot().provider
  assert.equal(during.mode, 'unknown', '换会话瞬间应当是 unknown')
  assert.equal(during.balance, null, '不能留着上一个会话的金额')
  assert.equal(during.provider, null, '也不能留着上一个会话的站名')

  // 查询本身在微任务里发出（`loadProviderBalance` 走 Promise 链），落地后就该是会话 b。
  await settle()
  assert.deepEqual(calls, ['session-a', 'session-b'], '切会话要立刻问新会话的账本')
  const after = store.getSnapshot().provider
  assert.equal(after.balance.provider, 'ur')
  assert.equal(after.balance.remaining, '742.23')
  mounted.dispose?.()
})

test('换会话：上一个会话迟到的答复不会落到新会话头上', async () => {
  const pending = []
  const mounted = mountClient({
    rpc(channel, method, payload) {
      if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
      return new Promise((resolve) => pending.push({ args: payload.args, resolve }))
    },
  })
  const store = storeOf(mounted)
  store.bindSession('session-a', '/tmp/repo')
  await settle()
  store.bindSession('session-b', '/tmp/repo')
  await settle()
  assert.equal(pending.length, 2, '两个会话各问了一次')

  // 新会话的答复先到。
  pending[1].resolve(readyReply({ provider: 'ur', remaining: '742.23' }))
  await settle()
  assert.equal(store.getSnapshot().provider.balance.remaining, '742.23')

  // 旧会话的答复后到：它属于另一个账本，必须被丢弃。
  pending[0].resolve(readyReply({ provider: 'muyuan', remaining: '2265.33' }))
  await settle()
  assert.equal(
    store.getSnapshot().provider.balance.provider,
    'ur',
    '旧会话迟到的答复不该覆盖新会话的账本',
  )
  mounted.dispose?.()
})

test('新会话：还没问出结果时是 unknown（胶囊画 `--`），不落回官方账号余额', async () => {
  const mounted = mountClient({
    rpc(channel, method) {
      if (method !== 'provider-balance') return Promise.resolve({ ok: true, value: null })
      // 新会话的真实形态：模型选择投影还没就绪，宿主答不上来。
      return Promise.resolve({
        ok: true,
        value: { available: false, provider: null, reason: 'unknown-provider', token: null },
      })
    },
  })
  const store = storeOf(mounted)
  store.bindSession('session-new', '/tmp/repo')
  await settle()
  const ledger = store.getSnapshot().provider
  assert.equal(ledger.mode, 'unavailable')
  assert.equal(ledger.balance, null, '不能拿账号余额顶上')
  assert.equal(ledger.provider, null)
  mounted.dispose?.()
})
