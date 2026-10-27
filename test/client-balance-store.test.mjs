/**
 * store 用例：账号余额那一片的取数规则（软依赖 / TTL / 失败保留 / 版本门禁）。
 *
 * 这里驱动的是**真 store**（从座位注册的 `inject()` 里取出来），不是 `fakeStore` ——
 * 要验的正是"取数、限流、错误降级"这套逻辑本身。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mountClient } from './client-harness.mjs'

/** 立一个假 DSH 账号接口：记下每次调用，结果由 `reply()` 决定。 */
function fakeAccount(reply, options = {}) {
  const calls = []
  const service = {
    getBalance(client) {
      calls.push(client)
      return Promise.resolve(reply(client))
    },
  }
  // `getState` 是可选的直连方法：不传就当作"更旧的宿主没有它"。
  if (options.state !== undefined) {
    service.getState = () => Promise.resolve(options.state)
  }
  return { calls, service }
}

/** 从座位注册里把真 store 掏出来（胶囊那枚座位的 `inject()` 会给）。 */
function storeOf(mounted) {
  const entry = mounted.registrations.find((item) => item.options.id === 'dsh-hud-pill')
  assert.ok(entry, '胶囊座位应当注册过')
  const props = entry.options.inject('session-1')
  return props.store
}

/** 等微任务/一条 then 链跑完（取数是纯 Promise，没有定时器）。 */
function settle() {
  return new Promise((resolve) => setImmediate(resolve))
}

/** 共用的假启动清单：外部插件的版本号只能从这里取。 */
const BOOT_MODULES = { manifest: { release: { version: '0.2.1-rc.3' } } }

/** 一个"已登录、有余额"的平台应答。 */
function readyReply(wallets, bonusWallets = []) {
  return {
    ok: true,
    value: { status: 'ready', value: wallets, bonusWallets: bonusWallets },
  }
}

test('余额切片：取到数就写进快照，0 余额的赠送钱包被过滤', async () => {
  const account = fakeAccount(() =>
    readyReply(
      [{ currency: 'CNY', balance: '1234.56' }],
      [
        { currency: 'CNY', balance: '20' },
        { currency: 'CNY', balance: '0' },
        { currency: 'USD', balance: '-1' },
      ],
    ),
  )
  const mounted = mountClient({
    services: { remote: { account: account.service }, modules: BOOT_MODULES },
  })
  const store = storeOf(mounted)
  await settle()

  const balance = store.getSnapshot().balance
  assert.ok(balance, '应当已经拿到余额')
  assert.deepEqual(balance.wallets, [{ currency: 'CNY', balance: '1234.56' }])
  assert.deepEqual(
    balance.bonus,
    [{ currency: 'CNY', balance: '20' }],
    '0 与负数的赠送钱包必须过滤掉（平台会把用完的额度继续挂着）',
  )
  assert.equal(balance.failed, false)
  assert.equal(typeof balance.at, 'number')
})

test('余额切片：调用元数据带版本 / 语言 / 时区（时区按东为正）', async () => {
  const account = fakeAccount(() => readyReply([{ currency: 'CNY', balance: '1' }]))
  const mounted = mountClient({
    services: {
      remote: { account: account.service },
      // 外部插件的产物里没有内联版本号：版本要从启动清单里取。
      modules: { manifest: { release: { version: '9.9.9-test' } } },
    },
  })
  void storeOf(mounted)
  await settle()

  assert.equal(account.calls.length, 1, '应当只问一次平台')
  const client = account.calls[0]
  assert.equal(client.version, '9.9.9-test', '版本取自启动清单')
  assert.equal(typeof client.locale, 'string')
  assert.ok(client.locale.length > 0, '语言不能是空串')
  assert.equal(
    client.timezoneOffsetSeconds,
    -new Date().getTimezoneOffset() * 60,
    '时区偏移要按"东为正"给（与 DSH 自己一致）',
  )
})

test('余额切片：TTL 内不重复打平台，force 跳过 TTL', async () => {
  const account = fakeAccount(() => readyReply([{ currency: 'CNY', balance: '7' }]))
  const mounted = mountClient({
    services: { remote: { account: account.service }, modules: BOOT_MODULES },
  })
  const store = storeOf(mounted)
  await settle()

  assert.equal(account.calls.length, 1)
  // 5 分钟的节拍 + 4 分钟的 TTL：没有 force 时第二次调用是白问，直接吃缓存。
  await store.loadBalance()
  assert.equal(account.calls.length, 1, 'TTL 内不该再问平台')
  // 点击胶囊走的就是这条路：必须真的去问。
  await store.loadBalance(true)
  assert.equal(account.calls.length, 2, 'force 要跳过 TTL')
})

test('余额切片：读失败时保留上一次的数字并标 failed（不把胶囊抹掉）', async () => {
  let reply = readyReply([{ currency: 'USD', balance: '9.99' }])
  const account = fakeAccount(() => reply)
  const mounted = mountClient({
    services: { remote: { account: account.service }, modules: BOOT_MODULES },
  })
  const store = storeOf(mounted)
  await settle()
  const good = store.getSnapshot().balance
  assert.ok(good)

  // 平台这一次报 failed。
  reply = { ok: true, value: { status: 'failed' } }
  await store.loadBalance(true)
  const stale = store.getSnapshot().balance
  assert.ok(stale, '失败不该让胶囊消失')
  assert.deepEqual(stale.wallets, good.wallets, '数字保留上一次的')
  assert.equal(stale.at, good.at, '时间也停在上一次成功的时刻（界面据此说"这是旧的"）')
  assert.equal(stale.failed, true)

  // RPC 信封本身失败（传输层）也走同一条降级。
  reply = { ok: false, error: { details: { code: 'transport' } } }
  await store.loadBalance(true)
  assert.equal(store.getSnapshot().balance.failed, true, '传输失败同样只打标、不清零')
})

test('余额切片：没登录（null）与空钱包都不算错误，但也不画胶囊', async () => {
  let reply = { ok: true, value: null }
  const account = fakeAccount(() => reply)
  const mounted = mountClient({
    services: { remote: { account: account.service }, modules: BOOT_MODULES },
  })
  const store = storeOf(mounted)
  await settle()
  assert.equal(store.getSnapshot().balance, null, '没登录 = 没有账目，不是"余额 0"')

  reply = readyReply([], [])
  await store.loadBalance(true)
  assert.equal(store.getSnapshot().balance, null, '一个可展示的钱包都没有时也是 null')
})

test('余额切片：没有账号能力 / 拿不到版本，都安静地不做任何事', async () => {
  // 1) 这个宿主没装账号插件：`remote.account` 注入不到。
  const noAccount = mountClient()
  const storeA = storeOf(noAccount)
  await storeA.loadBalance(true)
  assert.equal(storeA.getSnapshot().balance, null, '没有账号能力时不该有余额，也不该抛')

  // 2) 有账号能力但没有版本号（`window.__DSH_BOOT__` 与 `modules` 都缺）：
  //    带空版本去问平台会被 DSH 自己拦下（`accountClientMetadata` 直接抛），所以干脆不发。
  const account = fakeAccount(() => readyReply([{ currency: 'CNY', balance: '1' }]))
  const noVersion = mountClient({ services: { remote: { account: account.service } } })
  const storeB = storeOf(noVersion)
  await storeB.loadBalance(true)
  assert.equal(account.calls.length, 0, '取不到版本就不该发请求')
  assert.equal(storeB.getSnapshot().balance, null)
})

test('余额切片：版本可以退回到 window.__DSH_BOOT__（模块服务不可用时仍能取）', async () => {
  const account = fakeAccount(() => readyReply([{ currency: 'CNY', balance: '3' }]))
  const previous = globalThis.__DSH_BOOT__
  globalThis.__DSH_BOOT__ = {
    rev: 'x',
    entries: [],
    batches: [],
    release: { version: '0.0.0-boot' },
  }
  try {
    const mounted = mountClient({ services: { remote: { account: account.service } } })
    void storeOf(mounted)
    await settle()
    assert.equal(account.calls.length, 1)
    assert.equal(account.calls[0].version, '0.0.0-boot')
  } finally {
    if (previous === undefined) delete globalThis.__DSH_BOOT__
    else globalThis.__DSH_BOOT__ = previous
  }
})

test('余额切片：把平台链接（用量页 / 充值页）带进快照，供胶囊右键跳转', async () => {
  const account = fakeAccount(() => readyReply([{ currency: 'CNY', balance: '8.6' }]), {
    state: {
      ok: true,
      value: {
        status: 'credential-stored',
        links: {
          usageUrl: 'https://platform.deepseek.com/usage',
          topUpUrl: 'https://platform.deepseek.com/top_up',
        },
        attempt: null,
      },
    },
  })
  const mounted = mountClient({
    services: { remote: { account: account.service }, modules: BOOT_MODULES },
  })
  const store = storeOf(mounted)
  await settle()

  const balance = store.getSnapshot().balance
  assert.ok(balance)
  assert.equal(balance.usageUrl, 'https://platform.deepseek.com/usage')
  assert.equal(balance.topUpUrl, 'https://platform.deepseek.com/top_up')
})

test('余额切片：宿主没有 getState / 取链接失败时，余额照常显示（只是少了那条路）', async () => {
  // 1) 方法不存在（更旧的宿主）。
  const noState = fakeAccount(() => readyReply([{ currency: 'CNY', balance: '5' }]))
  const a = mountClient({
    services: { remote: { account: noState.service }, modules: BOOT_MODULES },
  })
  const storeA = storeOf(a)
  await settle()
  assert.ok(storeA.getSnapshot().balance, '没有 getState 也要能显示余额')
  assert.equal(storeA.getSnapshot().balance.usageUrl, null)

  // 2) 方法在但报失败（`ok: false`）。
  const failing = fakeAccount(() => readyReply([{ currency: 'CNY', balance: '5' }]), {
    state: { ok: false, error: { code: 'gateway/unavailable' } },
  })
  const b = mountClient({
    services: { remote: { account: failing.service }, modules: BOOT_MODULES },
  })
  const storeB = storeOf(b)
  await settle()
  assert.ok(storeB.getSnapshot().balance, '取链接失败不该把余额一起丢掉')
  assert.equal(storeB.getSnapshot().balance.usageUrl, null)
})

test('余额切片：prev 永远指向"最近一次成功"的读数，失败那一轮不动它', async () => {
  let reply = readyReply([{ currency: 'CNY', balance: '20' }])
  const account = fakeAccount(() => reply)
  const mounted = mountClient({
    services: { remote: { account: account.service }, modules: BOOT_MODULES },
  })
  const store = storeOf(mounted)
  await settle()

  // 第一次成功：还没有"上一次"，prev 为 null（那时没有变化量可谈）。
  assert.equal(store.getSnapshot().balance.prev, null)

  // 第二次成功且数字变了：prev 指向第一次。
  reply = readyReply([{ currency: 'CNY', balance: '18.5' }])
  await store.loadBalance(true)
  const second = store.getSnapshot().balance
  assert.ok(second.prev, '第二次成功之后要有 prev')
  assert.deepEqual(second.prev.wallets, [{ currency: 'CNY', balance: '20' }])
  assert.equal(typeof second.prev.at, 'number')

  // 失败那一轮：prev 不能被改成"失败这次"，仍指向最近一次成功（18.5）。
  reply = { ok: true, value: { status: 'failed' } }
  await store.loadBalance(true)
  const failed = store.getSnapshot().balance
  assert.equal(failed.failed, true)
  assert.deepEqual(
    failed.prev.wallets,
    [{ currency: 'CNY', balance: '20' }],
    '失败不推进 prev：否则"较上次刷新"会被一次失败搅成跟更早的一次比',
  )
  assert.equal(failed.prev.at, second.prev.at)
})
