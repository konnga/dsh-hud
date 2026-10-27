/**
 * 「当前模型是谁家的，就查谁家的余额」——宿主半。
 *
 * 为什么要这么绕：DSH 的账号接口（`remote.account`）只认 DeepSeek 平台账号那一条路。
 * 会话换了提供方（`ur` / `api404` / 官方 API Key ……）之后，那枚余额胶囊显示的是**另一个
 * 账本**上的钱，看着像 bug。这里按会话当前的模型选择解析出提供方，再用**它自己的协议**
 * 取一次余额。
 *
 * 实测出来的三套协议（2026-10-27 用本机真实配置验过，见 README 的"提供方余额"一节）：
 *
 *   1. `deepseek-account` —— DeepSeek 平台账号。**不在这里取**：客户端已经用
 *      `remote.account.getBalance` 拿到了同一份数，宿主再取一次只会多一条路径。
 *   2. `official` —— DeepSeek 官方 API Key。`GET https://api.deepseek.com/user/balance`
 *      回 `{is_available, balance_infos: [{currency, total_balance, granted_balance, ...}]}`。
 *   3. `relay` —— 第三方中转站（one-api / new-api 家族）。一对 OpenAI 兼容接口：
 *      `GET {base}/dashboard/billing/subscription` 给上限（`hard_limit_usd`），
 *      `GET {base}/dashboard/billing/usage` 给已用（`total_usage`，单位是**分**）。
 *
 * 三个必须如实交代的约束（都在载荷里，不靠文案遮掩）：
 *
 *   - **占位上限**：不少中转站把上限写成 `1e8` 当"无限"。这时剩余额算不出来，只能报已用
 *     （`placeholderLimit: true`），别拿 `1e8 - 已用` 冒充一个天文数字余额。
 *   - **币种口径**：中转站这套接口的字段名是 `*_usd`，但很多站内部按人民币 1:1 记账。
 *     我们只转述站点自己的数，**不做任何汇率换算**，`currency` 就标站点口径。
 *   - **没有统一标准**：有的站（本机的 `api404`）两条路都 404/502。这种情况报
 *     `unsupported`，界面不画胶囊 —— 与"读不到就不画"同一条规矩。
 *
 * 凭据只在这个进程里用：按提供方自己的 `apiKeyEnv` 引用名向 `credentials` 服务要一次，
 * 只发给**这个提供方自己的 baseURL**，不进日志、不落盘、不回传给浏览器。
 */

import type {
  HudProviderBalance,
  HudProviderBalanceFailure,
  HudProviderFacts,
  HudProviderWallet,
} from './types.js'

/** 单个提供方的余额缓存时长：中转站被轮询打脸会被限流，这里挡一层。 */
export const PROVIDER_CACHE_MS = 60000
/** 一次取数的超时（中转站偶尔很慢，超过就不等了）。 */
export const PROVIDER_TIMEOUT_MS = 8000
/**
 * 上限的"占位值"门限：实测有站点把 `hard_limit_usd` 写成 `1e8`（等于"无限"）。
 * 超过这个数就认为它不是真实余额，只报已用。
 */
export const PLACEHOLDER_LIMIT_USD = 1e7
/** 官方 API Key 那条插件配置的命名空间最后一段。 */
const OFFICIAL_NS = 'llm-deepseek-api-key'
/** 官方端点（`baseURL` 未配置时上游自己用的那个默认值）。 */
const OFFICIAL_DEFAULT_BASE_URL = 'https://api.deepseek.com/anthropic'

/** DeepSeek 官方 API 的 origin（只有它走 `/user/balance`）。 */
const OFFICIAL_ORIGIN = 'https://api.deepseek.com'

/** 取数用的依赖（测试里换成假实现，避免真的打网络）。 */
export interface ProviderFetchDeps {
  fetch: (
    url: string,
    init: { headers: Record<string, string>; signal?: AbortSignal },
  ) => Promise<{
    ok: boolean
    status: number
    text(): Promise<string>
  }>
  now: () => number
  signal?: () => AbortSignal | undefined
}

/**
 * 把一个 JSON 值里的字符串金额原样取出。
 *
 * 为什么不转成 `number`：余额是账目数字，`1e-2` 这种经过浮点会变成 `0.010000000000000002`。
 * 站点给什么字符串就用什么字符串；给数字的先 `String()` 再走同一条路（也只在这一处容忍）。
 */
function amountOf(value: unknown): string | null {
  if (typeof value === 'string') {
    var raw = value.trim()
    return /^-?\d+(?:\.\d+)?$/.test(raw) ? raw : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // 站点把小数位写进浮点时，`toFixed` 到 8 位足以还原它的意图，且不会再出现科学计数法。
    return value.toFixed(8)
  }
  return null
}

/**
 * 解析 DeepSeek 官方 `/user/balance` 的响应。
 *
 * @param raw - 已 JSON.parse 的响应体。
 * @returns 钱包与赠送额度；形状不对回 `null`（不猜）。
 */
export function parseOfficialBalance(
  raw: unknown,
): { wallets: HudProviderWallet[]; bonus: HudProviderWallet[] } | null {
  if (raw === null || typeof raw !== 'object') return null
  var infos = (raw as { balance_infos?: unknown }).balance_infos
  if (!Array.isArray(infos)) return null
  var wallets: HudProviderWallet[] = []
  var bonus: HudProviderWallet[] = []
  for (var index = 0; index < infos.length; index += 1) {
    var item = infos[index]
    if (item === null || typeof item !== 'object') continue
    var row = item as { currency?: unknown; total_balance?: unknown; granted_balance?: unknown }
    if (typeof row.currency !== 'string' || row.currency === '') continue
    var total = amountOf(row.total_balance)
    if (total === null) continue
    wallets.push({ currency: row.currency, balance: total })
    // 赠送额度单独一栏，与账号那一路的口径一致（`granted_balance` 是"总额里有多少是赠送"）。
    var granted = amountOf(row.granted_balance)
    if (granted !== null && granted !== '0' && granted !== '0.00') {
      bonus.push({ currency: row.currency, balance: granted })
    }
  }
  return wallets.length === 0 ? null : { wallets: wallets, bonus: bonus }
}

/** 中转站账单的读法（`remaining` 可能是"算不出来"）。 */
export interface RelayBilling {
  currency: string
  remaining: string | null
  used: string | null
  placeholderLimit: boolean
}

/** 小数点后保留两位（站点给的是浮点，钱的展示以分为准）。 */
function centsRounded(value: number): string {
  return value.toFixed(2)
}

/**
 * 解析中转站的那一对账单响应。
 *
 * 两件事必须说清楚，否则数字会错得看不出来：
 *
 * 1. **`hard_limit_usd` 是剩余额度，不是总额度**（one-api / new-api 的账单接口按这个
 *    语义发字段，`soft_limit_usd` 与它同值）。所以**不能再减一次 `total_usage`** ——
 *    减了就是把余额算少一截。`total_usage` 是"另一件事"：已用量。
 * 2. **`total_usage` 的单位是分**（one-api 的 `GetUsage` 把额度换算成
 *    `quota / QuotaPerUnit * 100` 发出来）。实测 `total_usage: 21274.26` 即 $212.74。
 *
 * 「无限」占位：额度是 `1e8` 的站（实测 `ur` / `ccwu` / `happycoding` 两次探测都恰好
 * 是 100000000，期间真实用量在涨而它一动不动）——这不是余额，是"无限额度"的哨兵值。
 * 这时剩余额**算不出来**，只能报已用，并用 `placeholderLimit` 把这个事实传给界面。
 *
 * @param subscription - `/dashboard/billing/subscription` 的响应体。
 * @param usage - `/dashboard/billing/usage` 的响应体。
 * @returns 剩余/已用；两个形状都对不上时回 `null`。
 */
export function parseRelayBilling(subscription: unknown, usage: unknown): RelayBilling | null {
  var reported: number | null = null
  if (subscription !== null && typeof subscription === 'object') {
    var sub = subscription as { hard_limit_usd?: unknown; soft_limit_usd?: unknown }
    // `hard_limit_usd` 优先（语义更贴"可用到哪"）；站点没给才退到 `soft_limit_usd`。
    for (var candidate of [sub.hard_limit_usd, sub.soft_limit_usd]) {
      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
        reported = candidate
        break
      }
    }
  }
  var usedCents: number | null = null
  if (usage !== null && typeof usage === 'object') {
    var total = (usage as { total_usage?: unknown }).total_usage
    if (typeof total === 'number' && Number.isFinite(total) && total >= 0) usedCents = total
  }
  if (reported === null && usedCents === null) return null
  var usedUsd = usedCents === null ? null : usedCents / 100
  var placeholder = reported === null || reported >= PLACEHOLDER_LIMIT_USD
  return {
    // 字段名是 `*_usd`，但站点口径不一定真是美元；这里只转述，不做任何汇率换算。
    currency: 'USD',
    // 剩余 = 站点报的那个数本身（不减已用，见上面第 1 点）。
    remaining: placeholder ? null : centsRounded(reported as number),
    used: usedUsd === null ? null : centsRounded(usedUsd),
    placeholderLimit: placeholder,
  }
}

/** 一个设置条目（`settings.describe()` 的返回项，只取本模块用到的字段）。 */
export interface SettingsDescriptor {
  ns?: string
  value?: unknown
}

/** 提供方设置里本模块关心的两格。 */
interface ProviderSettingsEntry {
  baseURL?: unknown
  apiKeyEnv?: unknown
}

/**
 * 从设置投影里认出提供方 →（baseURL、凭据引用）。
 *
 * 只认两个已知命名空间，别的一律不看：
 *   - `llm-pi-ai`：`providers` 字典，键就是提供方 id（`ur` / `muyuan` / …）；
 *   - `llm-deepseek-api-key`：单提供方 `deepseek-official`，字段就在顶层。
 *
 * 为什么从设置读而不是自己存一份：用户改中转站地址/密钥引用是在「设置 → 模型」里改的，
 * 我们另存一份必然漂移。这里的读取只发生在宿主进程内，不经过浏览器。
 *
 * @param descriptors - `settings.describe()` 的结果。
 * @returns 提供方 id → 事实。缺字段的条目直接跳过（不猜默认值）。
 */
export function factsFromSettings(
  descriptors: readonly SettingsDescriptor[],
): Map<string, HudProviderFacts> {
  var out = new Map<string, HudProviderFacts>()
  for (var index = 0; index < descriptors.length; index += 1) {
    var descriptor = descriptors[index]
    if (descriptor === null || typeof descriptor !== 'object') continue
    var ns = typeof descriptor.ns === 'string' ? descriptor.ns : ''
    var value = descriptor.value
    if (value === null || typeof value !== 'object') continue
    var tail = nsTailOf(ns)

    // ① 字典形状（`llm-pi-ai`）：一个提供方一个 key，每个都自报 baseURL 与凭据引用名。
    //    按**形状**认，不按命名空间字符串认 —— 命名空间是 loader 那边拼出来的
    //    （这条 profile 里就是 `include:llm-pi-ai`），写死会静默失配：
    //    余额读不到、胶囊只剩一个 `—`，而没有任何一处会报错。
    var dict = (value as { providers?: unknown }).providers
    if (dict !== null && typeof dict === 'object' && !Array.isArray(dict)) {
      for (var [id, entry] of Object.entries(dict as Record<string, ProviderSettingsEntry>)) {
        var fromDict = factsOf(id, entry)
        if (fromDict !== null) out.set(id, fromDict)
      }
      continue
    }

    // ② 单条形状（`llm-deepseek-api-key`）：顶层就是 baseURL + apiKeyEnv。
    //    它的 `baseURL` 没有 schema 默认值（不填就是 undefined），而运行时等价于官方端点，
    //    所以这里补上同一个默认值 —— 补的是**上游自己的默认**，不是我们编的地址。
    var single = value as ProviderSettingsEntry
    if (tail === OFFICIAL_NS && typeof single.apiKeyEnv === 'string') {
      var official = factsOf('deepseek-official', {
        baseURL: typeof single.baseURL === 'string' ? single.baseURL : OFFICIAL_DEFAULT_BASE_URL,
        apiKeyEnv: single.apiKeyEnv,
      })
      if (official !== null) out.set('deepseek-official', official)
      continue
    }
    var standalone = factsOf(tail, single)
    if (standalone !== null) out.set(tail, standalone)
  }
  return out
}

/** 命名空间最后一段（loader 会拼成 `include:llm-pi-ai` 这种带前缀的形状）。 */
function nsTailOf(ns: string): string {
  var parts = ns.split(':')
  return parts.length === 0 ? ns : parts[parts.length - 1]
}

/** 一个条目 → 事实；`baseURL` 与 `apiKeyEnv` 都必须是字符串，否则跳过。 */
function factsOf(
  provider: string,
  entry: ProviderSettingsEntry | undefined,
): HudProviderFacts | null {
  if (entry === null || typeof entry !== 'object') return null
  if (typeof entry.baseURL !== 'string' || entry.baseURL === '') return null
  if (typeof entry.apiKeyEnv !== 'string' || entry.apiKeyEnv === '') return null
  return {
    provider: provider,
    kind: kindOf(entry.baseURL),
    baseURL: entry.baseURL,
    apiKeyEnv: entry.apiKeyEnv,
    // 账号余额那条路要的凭据，从 API Key 的引用名**推**出来（零配置）：
    //   UR_API_KEY       → UR_ACCESS_TOKEN   （网页访问令牌）
    //   UR_API_KEY       → UR_USER_ID        （部分部署要求的 New-Api-User）
    // 不符合 `*_API_KEY` 形状时就不推导 —— 宁可没有，也不去猜别的引用名。
    accessTokenEnv: refSiblingOf(entry.apiKeyEnv, 'ACCESS_TOKEN'),
    userIdEnv: refSiblingOf(entry.apiKeyEnv, 'USER_ID'),
  }
}

/** `UR_API_KEY` + `ACCESS_TOKEN` → `UR_ACCESS_TOKEN`；形状不符回 `null`。 */
function refSiblingOf(apiKeyEnv: string, suffix: string): string | null {
  var tail = '_API_KEY'
  if (!apiKeyEnv.endsWith(tail)) return null
  return apiKeyEnv.slice(0, apiKeyEnv.length - tail.length) + '_' + suffix
}

/**
 * 按 baseURL 的 origin 判断走哪套协议。
 *
 * 官方域名就是 `/user/balance`，其余一律当 one-api 家族试 `/dashboard/billing/*` ——
 * 这是"猜协议"唯一允许的地方，猜错了会明确地报 `unsupported`，不会给出假数字。
 *
 * @param baseURL - 提供方 baseURL。
 * @returns `official` / `relay`。
 */
export function kindOf(baseURL: string): 'official' | 'relay' {
  try {
    return new URL(baseURL).origin === OFFICIAL_ORIGIN ? 'official' : 'relay'
  } catch (error) {
    return 'relay'
  }
}

/** 把 baseURL 归一成"没有结尾斜杠"的形式（拼路径前用）。 */
function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/**
 * 一次 GET + JSON 解析；非 2xx 或非 JSON 都算失败。
 *
 * @param deps - 取数依赖。
 * @param url - 完整地址。
 * @param apiKey - `Bearer` 令牌；传 `null` 表示这条请求不需要鉴权（例如 `/api/status`）。
 * @param extra - 额外请求头（`New-Api-User` 这类站点要求的头）。
 * @returns 解析后的响应体，或失败与状态码。
 */
async function getJson(
  deps: ProviderFetchDeps,
  url: string,
  apiKey: string | null,
  extra?: Record<string, string>,
): Promise<{ ok: true; body: unknown } | { ok: false; status: number }> {
  try {
    var headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey !== null) headers.Authorization = 'Bearer ' + apiKey
    if (extra !== undefined) Object.assign(headers, extra)
    var response = await deps.fetch(url, {
      headers: headers,
      signal: deps.signal === undefined ? undefined : deps.signal(),
    })
    if (!response.ok) return { ok: false, status: response.status }
    var text = await response.text()
    try {
      return { ok: true, body: JSON.parse(text) as unknown }
    } catch (error) {
      return { ok: false, status: response.status }
    }
  } catch (error) {
    return { ok: false, status: 0 }
  }
}

/**
 * 按提供方自己的协议取一次余额。
 *
 * @param facts - 提供方事实（baseURL / kind / 凭据引用）。
 * @param apiKey - 已解析出来的密钥值（调用方负责取，本函数只发出去）。
 * @param deps - 取数与时钟（测试注入）。
 * @returns 余额载荷；取不到或协议不认时回 `null`（调用方再决定报什么原因）。
 */
export async function fetchProviderBalance(
  facts: HudProviderFacts,
  apiKey: string,
  deps: ProviderFetchDeps,
): Promise<HudProviderBalance | null> {
  var at = deps.now()
  if (facts.kind === 'official') {
    var origin = OFFICIAL_ORIGIN
    try {
      origin = new URL(facts.baseURL).origin
    } catch (error) {
      return null
    }
    var official = await getJson(deps, origin + '/user/balance', apiKey)
    if (official.ok !== true) return null
    var parsed = parseOfficialBalance(official.body)
    if (parsed === null) return null
    return {
      provider: facts.provider,
      kind: 'official',
      currency: parsed.wallets[0].currency,
      remaining: parsed.wallets[0].balance,
      // `/user/balance` 只报钱包余额，没有"已用"这个数 —— 两条都留空，不拿别处的数顶上。
      usedAccount: null,
      usedKey: null,
      placeholderLimit: false,
      wallets: parsed.wallets,
      bonus: parsed.bonus,
      at: at,
    }
  }

  var base = trimSlash(facts.baseURL)
  // 区间给"全历史"，不是"本月"：实测 ur / muyuan / happycoding / ccwu **都忽略**这两个参数，
  // 回的始终是这枚 Key 的累计用量。既然区间不生效，就别写一个"本月"的标签去暗示它按月算 ——
  // 标签跟着"这个数到底是什么"走，落在 `usedKey` 这个字段上。
  var end = new Date(at + 86400000).toISOString().slice(0, 10)
  var subscription = await getJson(deps, base + '/dashboard/billing/subscription', apiKey)
  if (subscription.ok !== true) return null
  var usage = await getJson(
    deps,
    base + '/dashboard/billing/usage?start_date=1970-01-01&end_date=' + end,
    apiKey,
  )
  var billing = parseRelayBilling(subscription.body, usage.ok === true ? usage.body : null)
  if (billing === null) return null
  return {
    provider: facts.provider,
    kind: 'relay',
    currency: billing.currency,
    remaining: billing.remaining,
    // 这个"已用"是**这枚 API Key** 的累计量，不是账号总量（也不是本月）。
    usedKey: billing.used,
    usedAccount: null,
    placeholderLimit: billing.placeholderLimit,
    wallets: [],
    bonus: [],
    at: at,
  }
}

/* ------------------------------------------- 中转站「账号余额」（网页令牌那条路） */

/**
 * new-api 的默认换算率：`quota` 是整数，除以它才是站点自己的货币金额。
 *
 * 站点会把真实值公开在 `GET /api/status` 的 `quota_per_unit` 里（实测 ur = 500000），
 * 这里是它取不到时用的兜底 —— new-api 上游的默认值，不是我们编的系数。
 */
export const QUOTA_PER_UNIT_DEFAULT = 500000

/** 从 `/api/status` 里读出换算率与显示币种。 */
export interface RelayAmountScale {
  /** 一个货币单位等于多少 `quota`。 */
  quotaPerUnit: number
  /** 站点用什么币种显示余额（`USD` / `CNY` …）。 */
  currency: string
  /** 站点公布的美元汇率（`display_type` 不是 USD 时用它把美元换算成站点币种）。 */
  exchangeRate: number
}

/**
 * 解析 `/api/status` 的金额口径。
 *
 * @param raw - 已 JSON.parse 的响应体。
 * @returns 换算口径；字段缺失或非法时回 `null`（调用方用默认值）。
 */
export function parseAmountScale(raw: unknown): RelayAmountScale | null {
  if (raw === null || typeof raw !== 'object') return null
  var data = (raw as { data?: unknown }).data
  if (data === null || typeof data !== 'object') return null
  var fields = data as {
    quota_per_unit?: unknown
    quota_display_type?: unknown
    usd_exchange_rate?: unknown
  }
  var rawPerUnit = fields.quota_per_unit
  if (typeof rawPerUnit !== 'number' || !Number.isFinite(rawPerUnit) || rawPerUnit <= 0) return null
  var perUnit: number = rawPerUnit
  var display = typeof fields.quota_display_type === 'string' ? fields.quota_display_type : ''
  var rate = fields.usd_exchange_rate
  return {
    quotaPerUnit: perUnit,
    currency: display === '' ? 'USD' : display.toUpperCase(),
    exchangeRate: typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : 1,
  }
}

/** 一个 `quota` 整数 → 站点自己口径的十进制金额字符串。 */
function amountFromQuota(quota: number, scale: RelayAmountScale): string | null {
  if (!Number.isFinite(quota)) return null
  var amount = quota / scale.quotaPerUnit
  // 站点用非美元显示时，按**它自己公布的汇率**换算（不是我编的汇率）。
  if (scale.currency !== 'USD') amount = amount * scale.exchangeRate
  // 向零截断到两位：余额是钱，不该出现第三位小数（与账号那一路的规则一致）。
  var truncated = amount >= 0 ? Math.floor(amount * 100) / 100 : Math.ceil(amount * 100) / 100
  // `-0` 归一成 `0`：`-0.000006` 截断后是"没有钱"，不是"负的零钱"。
  if (truncated === 0) truncated = 0
  return truncated.toFixed(2)
}

/**
 * 解析 new-api `GET /api/user/self` 的响应（**账号级**余额）。
 *
 * 这是唯一能拿到"当前余额"的接口 —— 它挂在 `UserAuth()` 下，认后台凭据
 * （PAT / 登录会话），不认 `sk-` 开头的 API Key。所以调用方得先拿到一枚后台凭据。
 *
 * @param raw - 已 JSON.parse 的响应体。
 * @param scale - 金额口径（来自 `/api/status`）。
 * @returns 余额、账号累计已用、请求数；形状不对回 `null`。
 */
export function parseUserSelfBalance(
  raw: unknown,
  scale: RelayAmountScale,
): {
  remaining: string | null
  usedAccount: string | null
  currency: string
  requests: number | null
} | null {
  if (raw === null || typeof raw !== 'object') return null
  var envelope = raw as { success?: unknown; data?: unknown }
  // new-api 用 `success: true`；个别 fork 只给 `data`。没有 `data` 就是没读到。
  if (envelope.data === null || typeof envelope.data !== 'object') return null
  if (envelope.success === false) return null
  var user = envelope.data as { quota?: unknown; used_quota?: unknown; request_count?: unknown }
  var remaining = typeof user.quota === 'number' ? amountFromQuota(user.quota, scale) : null
  var usedAccount =
    typeof user.used_quota === 'number' ? amountFromQuota(user.used_quota, scale) : null
  if (remaining === null && usedAccount === null) return null
  // 站点后台「API 请求」那个数（截图里 3685）；同一个响应里就有，顺手带上。
  var requests =
    typeof user.request_count === 'number' && Number.isFinite(user.request_count)
      ? user.request_count
      : null
  return {
    remaining: remaining,
    usedAccount: usedAccount,
    currency: scale.currency,
    requests: requests,
  }
}

/**
 * 用**后台凭据**读中转站的账号余额（`GET /api/user/self`）。
 *
 * 为什么单独一条路：new-api 把 `/api/user/self` 挂在 `UserAuth()` 下，认的是后台凭据
 * （PAT 或登录会话令牌）；`sk-` API Key 走的是另一套 `TokenAuth`，只能读
 * `/dashboard/billing/*`（那里往往只给"无限额度"占位值与用量）。
 * 拿不到就不要假装拿得到 —— 回 `null` 让调用方退回用量那一路。
 *
 * @param facts - 提供方事实（用它的 origin）。
 * @param accessToken - 后台凭据（PAT 或登录会话令牌），放进 `Authorization: Bearer`。
 * @param userId - 可选的 `New-Api-User`（只有老版本 / 部分 fork 校验）。
 * @param deps - 取数与时钟。
 * @returns 账号级余额；令牌无效 / 形状不对时回 `null`。
 */
export async function fetchUserBalance(
  facts: HudProviderFacts,
  accessToken: string,
  userId: string | null,
  deps: ProviderFetchDeps,
): Promise<HudProviderBalance | null> {
  var origin = originOf(facts.baseURL)
  if (origin === null) return null
  // 换算率是公开的（不需要鉴权）；拿不到就用 new-api 的默认值。
  var status = await getJson(deps, origin + '/api/status', null)
  var scale = (status.ok === true ? parseAmountScale(status.body) : null) ?? {
    quotaPerUnit: QUOTA_PER_UNIT_DEFAULT,
    currency: 'USD',
    exchangeRate: 1,
  }
  var extra: Record<string, string> = {}
  if (userId !== null && userId !== '') extra['New-Api-User'] = userId
  var self = await getJson(deps, origin + '/api/user/self', accessToken, extra)
  if (self.ok !== true) return null
  var parsed = parseUserSelfBalance(self.body, scale)
  if (parsed === null) return null
  return {
    provider: facts.provider,
    kind: 'relay',
    currency: parsed.currency,
    remaining: parsed.remaining,
    // 账号 `/api/user/self` 的 `used_quota` 是**整个账号**的累计量。
    usedAccount: parsed.usedAccount,
    usedKey: null,
    requests: parsed.requests,
    // 账号余额是站点自己算出来的确定值，不是"无限额度"占位。
    placeholderLimit: false,
    wallets: [],
    bonus: [],
    at: deps.now(),
  }
}

/** 从 baseURL 取 origin；不是合法 URL 就回 `null`。 */
function originOf(baseURL: string): string | null {
  try {
    return new URL(baseURL).origin
  } catch (error) {
    return null
  }
}

/**
 * 真实取数依赖：`fetch` + 单次超时。
 *
 * 超时用 `AbortSignal.timeout`（每次请求一个新的信号）：中转站偶尔会挂住不返回，
 * 不设上限就会把余额胶囊那条链一直吊着。
 *
 * @returns 供 `createProviderBalanceReader` 用的依赖。
 */
export function defaultFetchDeps(): ProviderFetchDeps {
  return {
    fetch: async function (url, init) {
      var timeout =
        typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
          : undefined
      var response = await fetch(url, { headers: init.headers, signal: timeout })
      return {
        ok: response.ok,
        status: response.status,
        text: function () {
          return response.text()
        },
      }
    },
    now: function () {
      return Date.now()
    },
  }
}

/** 没取到时给界面的原因（`unsupported` = 两套协议都不认，别当网络错误）。 */
export function failureOf(
  provider: string | null,
  kind: 'official' | 'relay' | null,
  reason: HudProviderBalanceFailure['reason'],
  message?: string | null,
): HudProviderBalanceFailure {
  return { provider: provider, kind: kind, reason: reason, message: message ?? null }
}
