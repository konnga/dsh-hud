/**
 * 宿主侧「按会话查余额」的定位链路：sessionId → 会话 → modelSelection → 提供方 → 事实 → 密钥。
 *
 * 这一层最容易错的地方不是协议，而是**读投影时读错字段**：`stateOf` 给的是投影的
 * `state`（`{lastUsed, pending}`），线上 view 才是 `{lastUsed, next}`。读错就会永远退回
 * `lastUsed` —— 用户在模型菜单里换了来源、还没发消息时，余额还挂在旧账本上。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProviderBalanceReader } from '../lib/host/provider-balance.js'
import {
  registerSoftDependencies,
  sessionById,
  sessionModelSelection,
} from '../lib/host/services.js'

/* --------------------------------------------------------------- 假服务 */

/** 假宿主 ctx：`get` 取服务，`inject` 到齐就同步回调（与 Cordis 的全部到齐语义一致）。 */
function fakeContext(services) {
  return {
    services,
    get(name) {
      return services[name]
    },
    inject(deps, callback) {
      if (deps.some((name) => services[name] === undefined)) return () => {}
      return callback({ ...services }) ?? (() => {})
    },
  }
}

/** 一个 modelSelection 投影读数器：按会话 id 回固定的 state。 */
function projectionsOf(stateById) {
  return {
    stateOf(session, key) {
      if (key !== 'modelSelection') return undefined
      return stateById[session.id] ?? stateById[session.header?.id] ?? undefined
    },
  }
}

/** 假 settings：只有 `llm-pi-ai` 那一份，里面两个提供方。 */
const settings = {
  describe() {
    return [
      {
        ns: 'llm-pi-ai',
        value: {
          providers: {
            'relay-b': {
              baseURL: 'https://relay-b.example/v1',
              apiKeyEnv: 'RELAY_B_API_KEY',
              api: 'openai-completions',
            },
            'relay-y': {
              baseURL: 'https://relay-x.example/v1',
              apiKeyEnv: 'RELAY_X_API_KEY',
              api: 'openai-completions',
            },
          },
        },
      },
    ]
  },
}

/** 假凭据：`RELAY_X_API_KEY` 故意不给，用来走 no-key；令牌按需加上。 */
function credentialsWith(extra = {}) {
  const refs = { RELAY_B_API_KEY: 'sk-fixture-b', ...extra }
  return {
    resolve(ref) {
      return Promise.resolve(
        refs[ref] === undefined ? undefined : { value: refs[ref], source: 'file' },
      )
    },
  }
}
const credentials = credentialsWith()

/**
 * 一次真协议形状的取数，记下每次请求（URL + 发出去的头）。
 *
 * @param routes - `{ subscription, usage, status, self }` 四种响应体。
 * @param extraRoutes - 额外覆盖（按 URL 子串匹配）。
 */
function fakeFetch(routes = {}, extraRoutes) {
  const calls = []
  const pick = (url) => {
    if (extraRoutes !== undefined) {
      // 注意 `Object.entries`：直接 `for..of` 一个普通对象会抛 TypeError，
      // 而 `getJson` 会把异常吞成"失败"，于是用例失败在最不像的地方。
      for (const [match, body] of Object.entries(extraRoutes)) {
        if (url.includes(match)) return body
      }
    }
    if (url.includes('/api/status')) return routes.status
    if (url.includes('/api/user/self')) return routes.self
    if (url.includes('/dashboard/billing/usage')) return routes.usage
    return routes.subscription
  }
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, headers: init?.headers ?? {} })
      const body = pick(url)
      if (body === undefined) return { ok: false, status: 404, text: async () => '' }
      if (body === 'deny') return { ok: false, status: 401, text: async () => '' }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    },
  }
}

const RELAY_BODIES = {
  subscription: { hard_limit_usd: 2265.33 },
  usage: { total_usage: 21274.26 },
}

/** 装一次软依赖并给出读取器；用完必须调 `stops`，否则模块级状态会漏给下一条用例。 */
function withReader(options) {
  const sessions = {
    get(id) {
      return options.sessions[id]
    },
    list() {
      return Object.values(options.sessions)
    },
  }
  const ctx = fakeContext({
    sessions,
    sessionProjections: projectionsOf(options.states),
    settings,
    credentials: options.credentials ?? credentials,
  })
  const stops = []
  registerSoftDependencies(ctx, stops)
  const net = fakeFetch(options.bodies ?? RELAY_BODIES, options.routes)
  const reader = createProviderBalanceReader(ctx, {
    fetch: net.fetch,
    now: options.now ?? (() => 0),
  })
  return { reader, net, stop: () => stops.forEach((fn) => fn()) }
}

/** 一个会话（`header.id` 是真实形状。`get` 那条路回的就是它）。 */
const sessionWith = (id) => ({ id, header: { id } })

/* ------------------------------------------------------------- 用例 */

test('定位：`pending`（刚在菜单里选的新来源）优先于 `lastUsed` —— 读 view 的 `next` 会失败', async () => {
  const session = sessionWith('s1')
  const { reader, net, stop } = withReader({
    sessions: { s1: session },
    states: {
      s1: {
        lastUsed: { provider: 'deepseek-account', model: 'deepseek-v4.1-flash' },
        // 用户刚把来源换成中转站、还没发消息：只有 pending 知道这件事。
        pending: { provider: 'relay-b', model: 'deepseek-v4.1-flash' },
      },
    },
  })
  try {
    const outcome = await reader('s1')
    assert.equal(outcome.ok, true)
    assert.equal(outcome.value.provider, 'relay-b', '必须跟着 pending 走，而不是 lastUsed 的账号')
    assert.equal(outcome.value.remaining, '2265.33')
    assert.equal(net.calls.length, 2, '一次订阅 + 一次用量')
  } finally {
    stop()
  }
})

test('定位：`pending` 为 null 时用 `lastUsed`；两个都空 → no-provider', async () => {
  const a = sessionWith('a')
  const b = sessionWith('b')
  const { reader, stop } = withReader({
    sessions: { a, b },
    states: {
      a: { lastUsed: { provider: 'relay-b', model: 'm' }, pending: null },
      b: { lastUsed: null, pending: null },
    },
  })
  try {
    const first = await reader('a')
    assert.equal(first.ok, true)
    assert.equal(first.value.provider, 'relay-b')

    const second = await reader('b')
    assert.equal(second.ok, false)
    assert.equal(second.failure.reason, 'no-provider')
    assert.equal(second.failure.provider, null)
  } finally {
    stop()
  }
})

test('定位：平台账号那一路由浏览器半自己取 —— 宿主返回 account 且**不发网络请求**', async () => {
  const session = sessionWith('s1')
  const { reader, net, stop } = withReader({
    sessions: { s1: session },
    states: { s1: { lastUsed: { provider: 'deepseek-account', model: 'm' }, pending: null } },
  })
  try {
    const outcome = await reader('s1')
    assert.deepEqual(outcome, { ok: true, value: null, account: true })
    assert.equal(net.calls.length, 0, '账号余额不该由宿主再取一遍')
  } finally {
    stop()
  }
})

test('定位：会话不存在 / 没配密钥 / 提供方不在设置里，都给出各自的原因', async () => {
  const missingKey = sessionWith('nokey')
  const unknown = sessionWith('unknown')
  const { reader, net, stop } = withReader({
    sessions: { nokey: missingKey, unknown },
    states: {
      nokey: { lastUsed: { provider: 'relay-y', model: 'm' }, pending: null },
      unknown: { lastUsed: { provider: 'nope', model: 'm' }, pending: null },
    },
  })
  try {
    const gone = await reader('session-that-does-not-exist')
    assert.equal(gone.ok, false)
    assert.equal(gone.failure.reason, 'no-session')

    const withoutKey = await reader('nokey')
    assert.equal(withoutKey.ok, false)
    assert.equal(withoutKey.failure.reason, 'no-key')
    assert.equal(withoutKey.failure.provider, 'relay-y')
    assert.equal(withoutKey.failure.kind, 'relay')

    const nowhere = await reader('unknown')
    assert.equal(nowhere.ok, false)
    assert.equal(nowhere.failure.reason, 'unknown-provider')

    assert.equal(net.calls.length, 0, '没密钥 / 没事实时不该发请求')
  } finally {
    stop()
  }
})

test('定位：同一个提供方一分钟内只取一次（轮询不该变成对中转站的炮击）', async () => {
  const session = sessionWith('s1')
  let now = 1_000
  const { reader, net, stop } = withReader({
    sessions: { s1: session },
    states: { s1: { lastUsed: { provider: 'relay-b', model: 'm' }, pending: null } },
    now: () => now,
  })
  try {
    await reader('s1')
    assert.equal(net.calls.length, 2)
    now += 30_000
    await reader('s1')
    assert.equal(net.calls.length, 2, '一分钟内复用上一次结果')
    now += 31_000
    await reader('s1')
    assert.equal(net.calls.length, 4, '过了缓存期才重新取')
  } finally {
    stop()
  }
})

test('定位：会话查找先走 `get(id)`，没有这个方法时退回 `list()` 扫描', () => {
  const session = sessionWith('s1')
  // 只有 list 的旧形状。
  const ctx = fakeContext({ sessions: { list: () => [session] } })
  const stops = []
  registerSoftDependencies(ctx, stops)
  try {
    assert.equal(sessionById('s1'), session)
    assert.equal(sessionById('nope'), null)
    assert.equal(sessionById(null), null)
    // 这个 ctx 没给 sessionProjections → 读数器没装，安静回 null（不抛）。
    assert.equal(sessionModelSelection(session), null)
  } finally {
    stops.forEach((fn) => fn())
  }
})

/* ---------------------------------- 账号余额优先、用量兜底 */

const RELAY_A_STATUS = {
  data: { quota_per_unit: 500000, quota_display_type: 'USD', usd_exchange_rate: 6.67 },
}

test('编排：配了后台令牌 → 账号余额 + 本 Key 已用**两本账都要**（截图那三个数都齐）', async () => {
  const session = sessionWith('s1')
  const { reader, net, stop } = withReader({
    sessions: { s1: session },
    states: { s1: { lastUsed: { provider: 'relay-b', model: 'm' }, pending: null } },
    credentials: credentialsWith({ RELAY_B_ACCESS_TOKEN: 'web-token', RELAY_B_USER_ID: '936' }),
    routes: { subscription: { hard_limit_usd: 100000000 }, usage: { total_usage: 47944.125 } },
    bodies: {
      status: RELAY_A_STATUS,
      self: {
        success: true,
        data: { quota: 427845000, used_quota: 263330000, request_count: 3685 },
      },
    },
  })
  try {
    const outcome = await reader('s1')
    assert.equal(outcome.ok, true)
    // 账号那一路（截图上的"当前余额 / 总用量 / API 请求"）
    assert.equal(outcome.value.remaining, '855.69', '账号余额（截图那个数）')
    assert.equal(outcome.value.usedAccount, '526.66')
    assert.equal(outcome.value.requests, 3685)
    // Key 那一路（同一张截图旁边那个"本 Key 已用"）—— 两本账并存，不是二选一。
    assert.equal(outcome.value.usedKey, '479.44')
    // 账号路拿到了真实余额，就不再是"无限额度占位"。
    assert.equal(outcome.value.placeholderLimit, false)
    // 两条路都走了：status → user/self → subscription → usage。
    assert.deepEqual(
      net.calls.map((call) => new URL(call.url).pathname),
      [
        '/api/status',
        '/api/user/self',
        '/v1/dashboard/billing/subscription',
        '/v1/dashboard/billing/usage',
      ],
    )
    // 令牌只发给这个站点，且带上了 New-Api-User。
    assert.equal(net.calls[1].headers.Authorization, 'Bearer web-token')
    assert.equal(net.calls[1].headers['New-Api-User'], '936')
    assert.equal(net.calls[0].headers.Authorization, undefined, 'status 是公开接口，不该带令牌')
  } finally {
    stop()
  }
})

test('编排：令牌失效 → 安静退回用量那一路（胶囊不该整枚消失）', async () => {
  const session = sessionWith('s1')
  const { reader, net, stop } = withReader({
    sessions: { s1: session },
    states: { s1: { lastUsed: { provider: 'relay-b', model: 'm' }, pending: null } },
    credentials: credentialsWith({ RELAY_B_ACCESS_TOKEN: 'expired-token' }),
    routes: { subscription: { hard_limit_usd: 2265.33 }, usage: { total_usage: 21274.26 } },
    // /api/status 通，但 /api/user/self 401（令牌过期就是这个形状）。
    bodies: { status: RELAY_A_STATUS, self: 'deny' },
  })
  try {
    const outcome = await reader('s1')
    assert.equal(outcome.ok, true, '仍然要给出一个读数')
    assert.equal(outcome.value.remaining, '2265.33', '退回 API Key 那一路')
    assert.equal(outcome.value.usedKey, '212.74')
    assert.equal(outcome.value.usedAccount, null, '令牌失效时不该编一个账号已用出来')
    // status / user/self 之后才去读 subscription + usage。
    assert.deepEqual(
      net.calls.map((call) => new URL(call.url).pathname),
      [
        '/api/status',
        '/api/user/self',
        // baseURL 是 `https://relay-b.example/v1`，所以这两条在 `/v1` 下面。
        '/v1/dashboard/billing/subscription',
        '/v1/dashboard/billing/usage',
      ],
    )
  } finally {
    stop()
  }
})

test('编排：没配令牌就是原来的行为（不额外打 status / user/self）', async () => {
  const session = sessionWith('s1')
  const { reader, net, stop } = withReader({
    sessions: { s1: session },
    states: { s1: { lastUsed: { provider: 'relay-b', model: 'm' }, pending: null } },
  })
  try {
    const outcome = await reader('s1')
    assert.equal(outcome.ok, true)
    assert.equal(outcome.value.remaining, '2265.33')
    assert.equal(
      outcome.token.configured,
      false,
      '没配令牌 → 告诉客户端"没配"，它才知道点胶囊该弹设置面板',
    )
    assert.deepEqual(
      net.calls.map((call) => new URL(call.url).pathname),
      ['/v1/dashboard/billing/subscription', '/v1/dashboard/billing/usage'],
      '没令牌就不该去碰那两条要登录态的接口',
    )
  } finally {
    stop()
  }
})
