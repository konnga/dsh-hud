import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PLACEHOLDER_LIMIT_USD,
  QUOTA_PER_UNIT_DEFAULT,
  factsFromSettings,
  fetchProviderBalance,
  fetchUserBalance,
  kindOf,
  parseAmountScale,
  parseOfficialBalance,
  parseRelayBilling,
  parseUserSelfBalance,
} from '../lib/host/providers.js'

/* ------------------------------------------------------------- 协议判定 */

test('提供方协议：官方域名走 /user/balance，其余一律当 one-api 家族', () => {
  assert.equal(kindOf('https://api.deepseek.com'), 'official')
  assert.equal(kindOf('https://api.deepseek.com/anthropic'), 'official')
  assert.equal(kindOf('https://relay-b.example/v1'), 'relay')
  assert.equal(kindOf('https://relay-x.example/v1'), 'relay')
  // 不是合法 URL 也当 relay（试一次就知道，猜错会明确报 unsupported，不会给出假数字）。
  assert.equal(kindOf('not a url'), 'relay')
})

/* --------------------------------------------------- 官方 /user/balance */

test('官方余额：balance_infos → 钱包 + 赠送额度；形状不对回 null', () => {
  // 实测响应（本机真账号）。
  const real = {
    is_available: false,
    balance_infos: [
      {
        currency: 'CNY',
        total_balance: '-0.19',
        granted_balance: '0.00',
        topped_up_balance: '-0.19',
      },
    ],
  }
  assert.deepEqual(parseOfficialBalance(real), {
    wallets: [{ currency: 'CNY', balance: '-0.19' }],
    // granted 是 0 → 不进赠送列表（与账号那一路"不再画 0"同一条规矩）。
    bonus: [],
  })

  // 只有赠送额度时，那一条要保留（否则"还有赠送"这件事会被抹掉）。
  assert.deepEqual(
    parseOfficialBalance({
      balance_infos: [
        {
          currency: 'CNY',
          total_balance: '12.00',
          granted_balance: '5.00',
          topped_up_balance: '7.00',
        },
      ],
    }),
    {
      wallets: [{ currency: 'CNY', balance: '12.00' }],
      bonus: [{ currency: 'CNY', balance: '5.00' }],
    },
  )

  for (const broken of [null, {}, { balance_infos: 'nope' }, { balance_infos: [] }]) {
    assert.equal(
      parseOfficialBalance(broken),
      null,
      `形状不对应当回 null：${JSON.stringify(broken)}`,
    )
  }
  // 缺 currency 的那一项丢掉，剩下的照用。
  assert.deepEqual(
    parseOfficialBalance({
      balance_infos: [{ total_balance: '1' }, { currency: 'USD', total_balance: '2.5' }],
    }),
    { wallets: [{ currency: 'USD', balance: '2.5' }], bonus: [] },
  )
})

/* ------------------------------------------------ 中转站账单（one-api 家族） */

test('中转站账单：hard_limit_usd 就是剩余额度（不再减已用），total_usage 单位是分', () => {
  // 实测某站：剩余 2265.330862、本月已用 21274.26 分 = $212.74。
  const parsed = parseRelayBilling(
    { object: 'billing_subscription', soft_limit_usd: 2265.330862, hard_limit_usd: 2265.330862 },
    { object: 'list', total_usage: 21274.260000000002 },
  )
  assert.deepEqual(parsed, {
    currency: 'USD',
    // 关键：剩余就是站点报的那个数本身。早先写成 `limit - used` 会把余额算少 $212.74。
    remaining: '2265.33',
    used: '212.74',
    placeholderLimit: false,
  })
})

test('中转站账单：额度是 1e8 占位值时剩余算不出来，只报已用', () => {
  // 实测四个站：两次探测都是 100000000，期间真实用量在涨而它不动 → 是哨兵值。
  const parsed = parseRelayBilling(
    { soft_limit_usd: 100000000, hard_limit_usd: 100000000, system_hard_limit_usd: 100000000 },
    { total_usage: 44171.8558 },
  )
  assert.deepEqual(parsed, {
    currency: 'USD',
    remaining: null,
    used: '441.72',
    placeholderLimit: true,
  })
  // 门限本身也要一致：恰好等于门限算占位。
  assert.equal(
    parseRelayBilling({ hard_limit_usd: PLACEHOLDER_LIMIT_USD }, { total_usage: 0 })
      .placeholderLimit,
    true,
  )
  assert.equal(
    parseRelayBilling({ hard_limit_usd: PLACEHOLDER_LIMIT_USD - 1 }, { total_usage: 0 })
      .placeholderLimit,
    false,
  )
})

test('中转站账单：只有已用 / 只有额度 / 两边都没有', () => {
  // 只有 usage：剩余不可知，已用照报（分 → 美元，保留两位）。
  assert.deepEqual(parseRelayBilling(null, { total_usage: 2450 }), {
    currency: 'USD',
    remaining: null,
    used: '24.50',
    placeholderLimit: true,
  })
  // 只有 subscription：剩余可报，已用未知。
  assert.deepEqual(parseRelayBilling({ hard_limit_usd: 30 }, null), {
    currency: 'USD',
    remaining: '30.00',
    used: null,
    placeholderLimit: false,
  })
  // 都没有：不是"余额 0"，是什么都不知道。
  assert.equal(parseRelayBilling(null, null), null)
  assert.equal(parseRelayBilling({}, {}), null)
  // `hard_limit_usd` 缺失时退到 `soft_limit_usd`。
  assert.equal(parseRelayBilling({ soft_limit_usd: 12 }, null).remaining, '12.00')
  // 0 也要能表达（余额真的耗尽时不能因为 `> 0` 就当成"没给"）。
  assert.equal(parseRelayBilling({ hard_limit_usd: 0 }, null).remaining, '0.00')
})

/* --------------------------------------------------------------- 设置投影 */

test('设置投影：从 llm-pi-ai 的 providers 字典与 llm-deepseek-api-key 的顶层读出事实', () => {
  const facts = factsFromSettings([
    {
      ns: 'llm-pi-ai',
      value: {
        providers: {
          'relay-b': {
            baseURL: 'https://relay-b.example/v1',
            apiKeyEnv: 'RELAY_B_API_KEY',
            api: 'openai-completions',
          },
          // 缺 apiKeyEnv 的条目跳过（不猜环境变量名）。
          broken: { baseURL: 'https://example.com/v1' },
        },
      },
    },
    {
      ns: 'llm-deepseek-api-key',
      value: { baseURL: 'https://api.deepseek.com/anthropic', apiKeyEnv: 'DEEPSEEK_API_KEY' },
    },
    // 不认识的命名空间不看。
    { ns: 'ui-theme', value: { preference: 'dark' } },
  ])
  assert.deepEqual([...facts.keys()].sort(), ['deepseek-official', 'relay-b'])
  assert.deepEqual(facts.get('relay-b'), {
    provider: 'relay-b',
    kind: 'relay',
    baseURL: 'https://relay-b.example/v1',
    apiKeyEnv: 'RELAY_B_API_KEY',
    // 账号余额那一路的引用名从上面这枚**推导**出来（零配置）。
    accessTokenEnv: 'RELAY_B_ACCESS_TOKEN',
    userIdEnv: 'RELAY_B_USER_ID',
  })
  assert.equal(facts.get('deepseek-official').kind, 'official')
})

test('设置投影：命名空间带 loader 前缀（`include:llm-pi-ai`）时照样认得出 —— 不能按字符串写死', () => {
  // 这是**实测的形状**：`describe()` 的 ns 是 loader 拼的入口 id，这条 profile 里是
  // `include:llm-pi-ai`。早先按 `ns === 'llm-pi-ai'` 匹配会静默失配（余额读不到、只画一个 `—`）。
  const facts = factsFromSettings([
    {
      ns: 'include:llm-pi-ai',
      value: {
        providers: {
          'relay-a': {
            baseURL: 'https://relay-a.example/v1',
            apiKeyEnv: 'RELAY_A_API_KEY',
            api: 'openai-completions',
          },
        },
      },
    },
  ])
  assert.deepEqual([...facts.keys()], ['relay-a'])
  assert.equal(facts.get('relay-a').baseURL, 'https://relay-a.example/v1')
  assert.equal(facts.get('relay-a').kind, 'relay')
})

test('设置投影：官方 Key 那条没配 baseURL 时补上游自己的默认值（不编地址）', () => {
  const facts = factsFromSettings([
    { ns: 'include:llm-deepseek-api-key', value: { apiKeyEnv: 'DEEPSEEK_API_KEY' } },
  ])
  assert.deepEqual([...facts.keys()], ['deepseek-official'])
  assert.equal(facts.get('deepseek-official').baseURL, 'https://api.deepseek.com/anthropic')
  assert.equal(facts.get('deepseek-official').kind, 'official')

  // 用户自己改过 baseURL 时用它自己的（哪怕不是官方域，也按站点自己的口径）。
  const custom = factsFromSettings([
    {
      ns: 'include:llm-deepseek-api-key',
      value: { baseURL: 'https://api.deepseek.com', apiKeyEnv: 'OTHER_KEY' },
    },
  ])
  assert.equal(custom.get('deepseek-official').baseURL, 'https://api.deepseek.com')
  assert.equal(custom.get('deepseek-official').apiKeyEnv, 'OTHER_KEY')
})

test('设置投影：空输入 / 畸形条目都不炸', () => {
  assert.equal(factsFromSettings([]).size, 0)
  assert.equal(
    factsFromSettings([
      null,
      {},
      { ns: 'llm-pi-ai' },
      { ns: 'llm-pi-ai', value: { providers: 'x' } },
    ]).size,
    0,
  )
})

/* ----------------------------------------------------------- 取数（假 fetch） */

/** 一个按 URL 路由的假 fetch：记下每次请求（含发出去的 Authorization）。 */
function fakeFetch(routes) {
  const calls = []
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({
        url,
        authorization: init.headers.Authorization,
        newApiUser: init.headers['New-Api-User'],
      })
      for (const [match, reply] of routes) {
        if (!url.includes(match)) continue
        if (reply === 'throw') throw new Error('boom')
        return {
          ok: reply.status === 200,
          status: reply.status,
          text: async () =>
            typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body),
        }
      }
      return { ok: false, status: 404, text: async () => '' }
    },
  }
}

const deps = (fetchImpl) => ({ fetch: fetchImpl, now: () => 1_700_000_000_000 })

const RELAY = {
  provider: 'relay-b',
  kind: 'relay',
  baseURL: 'https://relay-b.example/v1',
  apiKeyEnv: 'RELAY_B_API_KEY',
}
const OFFICIAL = {
  provider: 'deepseek-official',
  kind: 'official',
  baseURL: 'https://api.deepseek.com/anthropic',
  apiKeyEnv: 'DEEPSEEK_API_KEY',
}

test('取数·中转站：两条 URL 都拼对（含本月日期区间），密钥只发给这一个站点', async () => {
  const fake = fakeFetch([
    ['/dashboard/billing/subscription', { status: 200, body: { hard_limit_usd: 2265.33 } }],
    ['/dashboard/billing/usage', { status: 200, body: { total_usage: 21274.26 } }],
  ])
  const value = await fetchProviderBalance(RELAY, 'sk-relay-secret', deps(fake.fetch))
  assert.ok(value)
  assert.equal(value.provider, 'relay-b')
  assert.equal(value.kind, 'relay')
  assert.equal(value.remaining, '2265.33')
  assert.equal(value.usedKey, '212.74')
  assert.equal(value.at, 1_700_000_000_000)

  assert.equal(fake.calls.length, 2)
  assert.ok(
    fake.calls[0].url.startsWith('https://relay-b.example/v1/dashboard/billing/subscription'),
  )
  const usageUrl = new URL(fake.calls[1].url)
  assert.equal(usageUrl.pathname, '/v1/dashboard/billing/usage')
  // 区间是"本月 1 号 → 明天"（站点按这个区间算已用）。
  assert.match(usageUrl.searchParams.get('start_date'), /^\d{4}-\d{2}-01$/)
  assert.match(usageUrl.searchParams.get('end_date'), /^\d{4}-\d{2}-\d{2}$/)
  // 密钥只出现在 Authorization 里，且两条请求都是同一把（不泄漏到 query 里）。
  for (const call of fake.calls) {
    assert.equal(call.authorization, 'Bearer sk-relay-secret')
    assert.ok(!call.url.includes('sk-relay-secret'), '密钥不该出现在 URL 里')
  }
})

test('取数·官方：打 origin 的 /user/balance（丢掉 /anthropic 路径），解析钱包', async () => {
  const fake = fakeFetch([
    [
      '/user/balance',
      {
        status: 200,
        body: {
          balance_infos: [{ currency: 'CNY', total_balance: '8.60', granted_balance: '0.00' }],
        },
      },
    ],
  ])
  const value = await fetchProviderBalance(OFFICIAL, 'sk-official', deps(fake.fetch))
  assert.ok(value)
  assert.equal(value.kind, 'official')
  assert.equal(value.remaining, '8.60')
  assert.equal(value.currency, 'CNY')
  assert.equal(value.usedAccount, null)
  assert.equal(value.usedKey, null)
  assert.deepEqual(
    fake.calls.map((call) => call.url),
    ['https://api.deepseek.com/user/balance'],
  )
})

test('取数：站点 404 / 5xx / 抛异常 / 非 JSON 一律回 null（不抛、不编数）', async () => {
  for (const route of [
    ['/dashboard/billing/subscription', { status: 404, body: '' }],
    ['/dashboard/billing/subscription', { status: 502, body: '' }],
    ['/dashboard/billing/subscription', 'throw'],
    ['/dashboard/billing/subscription', { status: 200, body: 'not json' }],
    ['/dashboard/billing/subscription', { status: 200, body: {} }],
  ]) {
    const fake = fakeFetch([route])
    assert.equal(
      await fetchProviderBalance(RELAY, 'k', deps(fake.fetch)),
      null,
      `这种回复应当回 null：${JSON.stringify(route)}`,
    )
  }
})

test('取数：subscription 通、usage 挂掉时仍然给出剩余（半个答案好过没有）', async () => {
  const fake = fakeFetch([
    ['/dashboard/billing/subscription', { status: 200, body: { hard_limit_usd: 30 } }],
    ['/dashboard/billing/usage', { status: 500, body: '' }],
  ])
  const value = await fetchProviderBalance(RELAY, 'k', deps(fake.fetch))
  assert.ok(value)
  assert.equal(value.remaining, '30.00')
  assert.equal(value.usedAccount, null)
  assert.equal(value.usedKey, null)
})

/* ---------------------------------- 中转站「账号余额」（网页令牌那条路） */

// 实测的 /api/status 片段（2026-10-27）。
const RELAY_A_STATUS = {
  data: { quota_per_unit: 500000, quota_display_type: 'USD', usd_exchange_rate: 6.67, price: 1 },
}

test('金额口径：从 /api/status 读 quota_per_unit 与显示币种', () => {
  assert.deepEqual(parseAmountScale(RELAY_A_STATUS), {
    quotaPerUnit: 500000,
    currency: 'USD',
    exchangeRate: 6.67,
  })
  // 缺 `quota_display_type` 时按 USD（new-api 的默认口径）。
  assert.equal(parseAmountScale({ data: { quota_per_unit: 500000 } }).currency, 'USD')
  // 拿不到口径就回 null（调用方用默认值），不要编一个率。
  for (const broken of [
    null,
    {},
    { data: null },
    { data: { quota_per_unit: 0 } },
    { data: { quota_per_unit: 'x' } },
  ]) {
    assert.equal(parseAmountScale(broken), null, JSON.stringify(broken))
  }
})

test('账号余额：quota / quota_per_unit = 截图里那个 $855.69，used_quota 是 $526.66，请求数 3685', () => {
  const scale = parseAmountScale(RELAY_A_STATUS)
  // 你截图上的三个数：当前余额 $855.69、总用量 $526.66、API 请求 3685。
  const parsed = parseUserSelfBalance(
    {
      success: true,
      data: {
        id: 936,
        username: 'konnw',
        quota: 427845000,
        used_quota: 263330000,
        request_count: 3685,
      },
    },
    scale,
  )
  assert.deepEqual(parsed, {
    remaining: '855.69',
    usedAccount: '526.66',
    currency: 'USD',
    requests: 3685,
  })
})

test('账号余额：形状不对 / 明确失败都回 null（不猜）', () => {
  const scale = parseAmountScale(RELAY_A_STATUS)
  for (const broken of [
    null,
    {},
    { data: null },
    { success: false, data: { quota: 1 } },
    { data: {} },
    { data: { quota: 'not-a-number' } },
  ]) {
    assert.equal(parseUserSelfBalance(broken, scale), null, JSON.stringify(broken))
  }
})

test('账号余额：站点用非美元显示时按**站点自己公布的汇率**换算', () => {
  const scale = parseAmountScale({
    data: { quota_per_unit: 500000, quota_display_type: 'CNY', usd_exchange_rate: 7 },
  })
  // 1 美元额度 × 7 = ¥7.00
  const parsed = parseUserSelfBalance({ data: { quota: 500000 } }, scale)
  assert.equal(parsed.remaining, '7.00')
  assert.equal(parsed.currency, 'CNY')
})

test('账号余额：向零截断两位（余额是钱，不出现第三位小数；负余额要保住符号）', () => {
  const scale = { quotaPerUnit: 500000, currency: 'USD', exchangeRate: 1 }
  assert.equal(parseUserSelfBalance({ data: { quota: 427845001 } }, scale).remaining, '855.69')
  // 一点点负额度是"没有钱"，归一成 0（不写 `-0.00`）。
  assert.equal(parseUserSelfBalance({ data: { quota: -3 } }, scale).remaining, '0.00')
  // 但真的透支了就要看见负号（某站的 key 那个 total_available 就是 -199583909）。
  assert.equal(parseUserSelfBalance({ data: { quota: -199583909 } }, scale).remaining, '-399.16')
})

test('账号余额取数：打 origin 的 /api/status（不鉴权）与 /api/user/self（Bearer + New-Api-User）', async () => {
  const fake = fakeFetch([
    ['/api/status', { status: 200, body: RELAY_A_STATUS }],
    [
      '/api/user/self',
      { status: 200, body: { success: true, data: { quota: 427845000, used_quota: 263330000 } } },
    ],
  ])
  const value = await fetchUserBalance(RELAY, 'web-token-abc', '936', deps(fake.fetch))
  assert.ok(value)
  assert.equal(value.remaining, '855.69')
  assert.equal(value.usedAccount, '526.66')
  assert.equal(value.currency, 'USD')
  assert.equal(value.placeholderLimit, false, '账号余额是确定值，不是"无限"占位')

  // status 那条请求**不该带** Authorization（它是公开接口）；user/self 才带令牌。
  assert.equal(fake.calls[0].url, 'https://relay-b.example/api/status')
  assert.equal(fake.calls[0].authorization, undefined)
  assert.equal(fake.calls[1].url, 'https://relay-b.example/api/user/self')
  assert.equal(fake.calls[1].authorization, 'Bearer web-token-abc')
  assert.equal(fake.calls[1].newApiUser, '936')
})

test('账号余额取数：令牌无效 / status 拿不到 / 站点不认，一律回 null（退回用量那一路）', async () => {
  // 令牌无效：401。
  const denied = fakeFetch([
    ['/api/status', { status: 200, body: RELAY_A_STATUS }],
    ['/api/user/self', { status: 401, body: { success: false } }],
  ])
  assert.equal(await fetchUserBalance(RELAY, 'bad', null, deps(denied.fetch)), null)

  // status 拿不到 → 用 new-api 默认率，仍然能读出余额。
  const noStatus = fakeFetch([
    ['/api/status', { status: 500, body: '' }],
    ['/api/user/self', { status: 200, body: { data: { quota: QUOTA_PER_UNIT_DEFAULT } } }],
  ])
  const fallback = await fetchUserBalance(RELAY, 'ok', null, deps(noStatus.fetch))
  assert.equal(fallback.remaining, '1.00', '默认率 500000 → 1 美元')

  // 站点回 HTML（不是 new-api）：读不到。
  const html = fakeFetch([
    ['/api/status', 'throw'],
    ['/api/user/self', { status: 200, body: '<!doctype html>' }],
  ])
  assert.equal(await fetchUserBalance(RELAY, 'ok', null, deps(html.fetch)), null)
})

test('设置投影：从 API Key 的引用名推导出账号令牌的引用名（零配置）', () => {
  const facts = factsFromSettings([
    {
      ns: 'include:llm-pi-ai',
      value: {
        providers: {
          'relay-a': { baseURL: 'https://relay-a.example/v1', apiKeyEnv: 'RELAY_A_API_KEY' },
          // 不符合 `*_API_KEY` 形状：不推导（不去猜别的引用名）。
          odd: { baseURL: 'https://example.com/v1', apiKeyEnv: 'SOME_TOKEN' },
        },
      },
    },
  ])
  assert.equal(facts.get('relay-a').accessTokenEnv, 'RELAY_A_ACCESS_TOKEN')
  assert.equal(facts.get('relay-a').userIdEnv, 'RELAY_A_USER_ID')
  assert.equal(facts.get('odd').accessTokenEnv, null)
})
