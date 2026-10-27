/**
 * 「当前会话模型来源」的余额这一片。
 *
 * 为什么需要它：账号那一路（`store/account.ts`）只认 DeepSeek 平台账号的账本。会话换到
 * 第三方中转站（`ur` / `api404` / `muyuan` …）之后，胶囊还画着平台账号的 `¥8.60`，
 * 那是**另一个账本上的钱** —— 看着就像 bug。这一片按会话当前模型去问宿主"这个提供方
 * 还剩多少"，再把结论压成一份 `HudProviderLedger`：
 *
 *   - `account`：会话用的就是平台账号 → 胶囊继续走 `HudBalance`（不重复取数）；
 *   - `provider`：读到了这个提供方的余额 → 胶囊改画它；
 *   - `unavailable`：知道是哪个提供方但读不到 → **不画**（不是画别人的余额）；
 *   - `unknown`：会话/投影还没就绪（首帧常态）→ 先按账号那一路画，别让胶囊闪一下。
 *
 * 三条设计约束：
 *
 *   1. **按会话取**：换会话就换账本，所以 `sessionId` 一变就得重取（不吃上一个会话的缓存）。
 *   2. **慢节拍**：中转站被高频轮询会限流，宿主那边还有一分钟缓存；这里再按 TTL 兜一层。
 *   3. **失败不清零**：读不到时保留上一次的结果（`unavailable` 只在**没有**上一次
 *      provider 结果时才生效），避免网络抖一下就让胶囊在"有数/没数"之间跳。
 */

import type { HudProviderBalance, HudProviderLedger, HudProviderToken } from '../shared.js'
import type {
  GetState,
  ProviderBalancePayload,
  ProviderSlice,
  StoreContext,
  StoreSet,
  TokenPanelState,
} from './types.js'

import { CHANNEL, probe } from '../shared.js'

/** 同一会话两次取数的最小间隔（宿主侧缓存一分钟，这里配合它不空转）。 */
export const PROVIDER_TTL_MS = 60000
/** 没取到时多久再试。 */
export const PROVIDER_RETRY_MS = 30000
/**
 * 失败后的第一次重试间隔，之后逐次翻倍，到 `PROVIDER_RETRY_MS` 封顶。
 *
 * 为什么要退避而不是一上来就 30 秒：重启/刚开会话时**宿主常常还答不上来**
 *（模型选择投影还没就绪），第一次问必然落空。用固定 30 秒兜的话，胶囊要空半分钟 ——
 * 用户看到的就是"重启后没立即显示"。1 秒起、翻倍到 30 秒，正常情况一两秒内就出来了，
 * 而真出故障时也不会变成每秒一次的重试风暴。
 */
export const PROVIDER_RETRY_BASE_MS = 1000

/** 端点名（宿主半 `rpc.ts` 里登记的那个）。 */
const ENDPOINT = 'provider-balance'

/** 一个可展示的钱包列表（逐项校验，形状不对的项直接丢，不猜）。 */
function walletsOf(value: unknown): Array<{ currency: string; balance: string }> {
  if (!Array.isArray(value)) return []
  var out: Array<{ currency: string; balance: string }> = []
  for (var index = 0; index < value.length; index += 1) {
    var item = value[index] as { currency?: unknown; balance?: unknown } | null
    if (!item || typeof item !== 'object') continue
    if (typeof item.currency !== 'string' || typeof item.balance !== 'string') continue
    out.push({ currency: item.currency, balance: item.balance })
  }
  return out
}

/** 十进制字符串校验（不合法就当没给）。 */
function amountOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  var raw = value.trim()
  return /^-?\d+(?:\.\d+)?$/.test(raw) ? raw : null
}

/** 端点答复 → 快照；形状不对回 `null`（当作"读不到"）。 */
function balanceOf(payload: ProviderBalancePayload): HudProviderBalance | null {
  if (payload.available !== true || payload.account === true) return null
  var raw = (payload as { balance?: unknown }).balance
  if (raw === null || typeof raw !== 'object') return null
  var item = raw as {
    provider?: unknown
    kind?: unknown
    currency?: unknown
    remaining?: unknown
    usedAccount?: unknown
    usedKey?: unknown
    requests?: unknown
    placeholderLimit?: unknown
    wallets?: unknown
    bonus?: unknown
    at?: unknown
  }
  if (typeof item.provider !== 'string' || item.provider === '') return null
  if (item.kind !== 'official' && item.kind !== 'relay') return null
  var remaining = amountOf(item.remaining)
  var usedAccount = amountOf(item.usedAccount)
  var usedKey = amountOf(item.usedKey)
  var requests =
    typeof item.requests === 'number' && Number.isFinite(item.requests) ? item.requests : null
  var wallets = walletsOf(item.wallets)
  // 一个可展示的数字都没有：这不是余额，别画。
  if (remaining === null && usedAccount === null && usedKey === null && wallets.length === 0) {
    return null
  }
  return {
    provider: item.provider,
    kind: item.kind,
    currency: typeof item.currency === 'string' && item.currency !== '' ? item.currency : null,
    remaining: remaining,
    usedAccount: usedAccount,
    usedKey: usedKey,
    requests: requests,
    placeholderLimit: item.placeholderLimit === true,
    wallets: wallets,
    bonus: walletsOf(item.bonus),
    at: typeof item.at === 'number' && Number.isFinite(item.at) ? item.at : Date.now(),
  }
}

/**
 * 失败答复里的"是哪个提供方 / 为什么读不到"。
 *
 * 有这两个字段，胶囊就能画成 `ur —`（并说清是"该站没有余额接口"还是"没配密钥"），
 * 而不是直接消失 —— 消失分不清"这个站真的没有"和"插件坏了"。
 *
 * @param result - 宿主的答复信封。
 * @returns `{provider, reason}`；读不出就给 `null`（调用方按无信息处理）。
 */
function failureFieldsOf(result: unknown): { provider: string | null; reason: string | null } {
  var payload = (result as { value?: unknown } | null)?.value
  if (payload === null || typeof payload !== 'object') return { provider: null, reason: null }
  var item = payload as { provider?: unknown; reason?: unknown }
  return {
    provider: typeof item.provider === 'string' && item.provider !== '' ? item.provider : null,
    reason: typeof item.reason === 'string' && item.reason !== '' ? item.reason : null,
  }
}

/** 宿主给的「后台凭据配了没」；形状不对就当没有（老宿主不给这个字段）。 */
function tokenOf(payload: unknown): HudProviderToken | null {
  if (payload === null || typeof payload !== 'object') return null
  var item = (payload as { token?: unknown }).token
  if (item === null || typeof item !== 'object') return null
  var token = item as { ref?: unknown; configured?: unknown }
  if (typeof token.ref !== 'string' || token.ref === '') return null
  return { ref: token.ref, configured: token.configured === true }
}

/**
 * 建「提供方余额」这一片。
 * @param ctx - 客户端根上下文（只用 `connection.rpc`）。
 * @param getState - 读当前快照。
 * @param set - 浅合并写快照。
 * @returns 本片对外暴露的方法。
 */
/**
 * 失败后的重试间隔：1s、2s、4s、8s、16s，然后封顶在 `PROVIDER_RETRY_MS`。
 *
 * @param failStreak - 连续失败次数（0 = 还没失败过）。
 * @returns 毫秒。
 */
export function providerRetryDelayMs(failStreak: number): number {
  if (!(failStreak > 0)) return PROVIDER_RETRY_BASE_MS
  var delay = PROVIDER_RETRY_BASE_MS * Math.pow(2, failStreak - 1)
  return delay > PROVIDER_RETRY_MS ? PROVIDER_RETRY_MS : delay
}

export function createProviderSlice(
  ctx: StoreContext,
  getState: GetState,
  set: StoreSet,
): ProviderSlice {
  /** 在途请求（一次只打一个）。 */
  var inflight: Promise<HudProviderLedger | null> | null = null
  /** 请求代次：每发一次 +1，落地时对不上号就作废（见 `loadProviderBalance`）。 */
  var requestTicket = 0
  /** 连续失败次数（成功即归零）：只用来算退避间隔。 */
  var failStreak = 0
  /** 上次真正发请求的时刻。 */
  var lastAttemptAt = 0
  /** 上次取数针对哪个会话 —— 换了会话就必须重取，不能吃上一个会话的账本。 */
  var lastSessionId: string | null = null
  /** 上次是成功（长 TTL）还是失败（短 TTL）。 */
  var lastReady = false

  /** 写一份新结论（没变化就不 set，省一次重渲染）。 */
  function publish(
    mode: HudProviderLedger['mode'],
    balance: HudProviderBalance | null,
    extra?: { provider?: string | null; reason?: string | null },
    token?: HudProviderToken | null,
  ): HudProviderLedger {
    var previous = getState().provider
    // token 没给就沿用上一次的：失败路径不重问一遍状态（它本来就没变，而且
    // "读不到"与"没配令牌"是两件事，前者不该把后者抹掉）。
    var nextToken = token === undefined ? (previous?.token ?? null) : token
    // `provider` 在 `provider` 模式下**必须**有值：胶囊的点击路径（配后台令牌）靠它决定
    // "给哪个站存令牌"。早先这里只从 `extra` 取，而正常读取走的是
    // `publish('provider', balance, undefined, token)` —— 于是 `ledger.provider` 是 `null`，
    // 面板打开后 provider 为空，`saveProviderToken` 一看就 `return false`：不报错、不发请求、
    // 什么都不发生。用户看到的就是"保存了没什么变化"。
    // 账本自己就带着这个事实（`balance.provider`），没理由再让它空着。
    var provider = extra?.provider ?? balance?.provider ?? null
    var next: HudProviderLedger = {
      mode: mode,
      balance: balance,
      provider: provider,
      reason: extra?.reason ?? null,
      token: nextToken,
    }
    if (
      previous === undefined ||
      previous.mode !== next.mode ||
      previous.provider !== next.provider ||
      previous.reason !== next.reason ||
      (previous.token?.configured ?? null) !== (next.token?.configured ?? null) ||
      (previous.token?.ref ?? null) !== (next.token?.ref ?? null) ||
      (previous.balance === null) !== (next.balance === null) ||
      (previous.balance !== null &&
        next.balance !== null &&
        (previous.balance.provider !== next.balance.provider ||
          previous.balance.remaining !== next.balance.remaining ||
          previous.balance.usedAccount !== next.balance.usedAccount ||
          previous.balance.usedKey !== next.balance.usedKey ||
          previous.balance.requests !== next.balance.requests ||
          previous.balance.at !== next.balance.at))
    ) {
      set({ provider: next })
    }
    return next
  }

  /**
   * 换会话时把账本清成"还不知道"。
   *
   * 为什么必须清：不清就会**在新会话里继续挂着上一个会话的读数和站名**，直到新答案回来。
   * 那段时间屏幕上写的是 `ur` 的钱，而这次会话可能花的是 `muyuan` 的钱 —— 正是
   * "绝不把别人的钱画成你的"那条约束要防的事。清成 `unknown` 后胶囊画 `--`，
   * 一眼就知道"还在查"，比显示一个错的数强。
   */
  function resetForSession(): void {
    // 在途请求也一并作废：它回来的是上一个会话的账本。
    requestTicket += 1
    inflight = null
    lastAttemptAt = 0
    lastSessionId = null
    failStreak = 0
    lastReady = false
    set({ provider: { mode: 'unknown', balance: null, provider: null, reason: null, token: null } })
  }

  /**
   * 取一次"当前会话模型来源"的余额。
   * @param force - 跳过 TTL（点击胶囊时用）。
   * @returns 最新结论（可能沿用上一次）；**从不 reject**。
   */
  function loadProviderBalance(force?: boolean): Promise<HudProviderLedger | null> {
    var sessionId = getState().sessionId
    var now = Date.now()
    // 换了会话（或从无到有）：立刻重取，不吃上一个会话的结论。
    var switched = sessionId !== lastSessionId
    if (force !== true && !switched && lastAttemptAt !== 0) {
      var ttl = lastReady ? PROVIDER_TTL_MS : providerRetryDelayMs(failStreak)
      if (now - lastAttemptAt < ttl) return Promise.resolve(getState().provider)
    }
    // 换了会话就别复用上一个会话的在途请求：它回来的是**另一个账本**的数字，
    // 而这次调用方要的是当前会话的（复用会让新会话白等一个 TTL）。
    // `force` 同理不能复用：它请求的是"**此刻之后**的事实"（典型场景就是刚存完令牌，
    // 手上那个在途请求是用旧凭据发出的，用它等于让新令牌白等一个 TTL）。
    if (inflight !== null && !switched && force !== true) return inflight
    if (typeof sessionId !== 'string' || sessionId === '') {
      // 还没有会话（首帧）：按"还不知道"处理，胶囊照旧看账号那一路。
      lastSessionId = null
      return Promise.resolve(publish('unknown', null))
    }

    // 换会话就重置退避：这是另一个账本，不该继承上一个会话攒下的罚时。
    if (switched) failStreak = 0
    lastAttemptAt = now
    lastSessionId = sessionId
    // 代次：谁最后发出，谁说了算。`force` 现在能绕过在途去重 → 可能同时有两个请求在飞，
    // 若让先发后到的那份落地，胶囊就会拿旧凭据的结论盖掉新凭据的。
    var ticket = ++requestTicket
    inflight = Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<ProviderBalancePayload>(CHANNEL, ENDPOINT, {
          args: { sessionId: sessionId, force: force === true },
        })
      })
      .then(function (result) {
        // 有更新的请求已经发出去了：这份结论作废（它可能是旧凭据/旧会话的）。
        if (ticket !== requestTicket) return getState().provider
        inflight = null
        // 会话在等结果期间又换了：这一份结论不属于当前会话，丢掉。
        if (getState().sessionId !== sessionId) return getState().provider
        if (!result || result.ok !== true || !result.value) {
          lastReady = false
          failStreak += 1
          probe.log('provider-balance', { failed: true })
          return keepOr('unavailable', failureFieldsOf(result), tokenOf(result?.value))
        }
        var payload = result.value
        var token = tokenOf(payload)
        if (payload.available === true && payload.account === true) {
          // 这个提供方的账本就是平台账号那一路：胶囊回到 `HudBalance`，这里不画数。
          lastReady = true
          failStreak = 0
          probe.log('provider-balance', { account: true })
          return publish('account', null, undefined, token)
        }
        var balance = balanceOf(payload)
        if (balance === null) {
          lastReady = false
          failStreak += 1
          probe.log('provider-balance', {
            unavailable: payload.available !== true ? payload.reason : 'empty',
            // 宿主在 message 里带的原因细节（例如"实际认出哪些提供方"）：只进日志，不上界面。
            message: (payload as { message?: unknown }).message ?? null,
          })
          return keepOr('unavailable', failureFieldsOf(result), token)
        }
        lastReady = true
        failStreak = 0
        probe.log('provider-balance', {
          provider: balance.provider,
          kind: balance.kind,
          remaining: balance.remaining === null,
          usedAccount: balance.usedAccount === null,
          usedKey: balance.usedKey === null,
          placeholder: balance.placeholderLimit,
        })
        return publish('provider', balance, undefined, token)
      })
      .catch(function (error) {
        if (ticket !== requestTicket) return getState().provider
        inflight = null
        lastReady = false
        failStreak += 1
        probe.log('provider-balance', {
          thrown: error instanceof Error ? error.message : String(error),
        })
        return keepOr('unavailable')
      })

    return inflight
  }

  /**
   * 读不到时的结论：**有**上一次的 provider 余额就继续用它（网络抖一下不该让胶囊消失），
   * 没有才落到 `unavailable`。
   *
   * @param fallbackMode - 没有上一次结果时用的模式。
   * @returns 写进快照的结论。
   */
  function keepOr(
    fallbackMode: HudProviderLedger['mode'],
    extra?: { provider?: string | null; reason?: string | null },
    token?: HudProviderToken | null,
  ): HudProviderLedger {
    var previous = getState().provider
    var stale =
      previous !== undefined && previous.mode === 'provider' && previous.balance !== null
        ? previous.balance
        : null
    if (stale !== null) return publish('provider', stale, undefined, token)
    return publish(fallbackMode, null, extra, token)
  }

  /**
   * 打开后台凭据设置面板。
   *
   * @param provider - 哪个提供方。
   * @param ref - 宿主给的凭据引用名（老宿主不给就 `null`，面板照样能存）。
   */
  function openTokenPanel(provider: string, ref: string | null): void {
    set({
      tokenPanel: {
        open: true,
        provider: provider,
        ref: ref,
        supported: true,
        saving: false,
        error: null,
      } satisfies TokenPanelState,
    })
  }

  /** "关着"的面板状态：取消、存成功、初始值都从这里来（免得三份各自漂移）。 */
  function closedTokenPanel(): TokenPanelState {
    return {
      open: false,
      provider: null,
      ref: null,
      supported: true,
      saving: false,
      error: null,
    }
  }

  /** 收起设置面板（取消 / 存完自动收起都走这里）。 */
  function closeTokenPanel(): void {
    set({ tokenPanel: closedTokenPanel() })
  }

  /**
   * 把用户粘贴的令牌交给宿主，写进凭据存储。
   *
   * 为什么由宿主写：令牌只该落在 DSH 自己的凭据库里（`~/.dsh/.credentials.yaml`），
   * 客户端不碰文件、不存 localStorage —— 存那里等于把密钥摊在一个任何脚本都读得到的地方。
   *
   * @param token - 用户粘贴的令牌（宿主会校验长度与形状）。
   * @returns 是否存成功（面板据此显示错误或自动收起）。
   */
  async function saveProviderToken(token: string): Promise<boolean> {
    var panel = getState().tokenPanel
    var provider = panel.provider
    if (provider === null || provider === '') {
      // 静默 `return false` 是这一整轮 bug 的形态：面板不报错、不发请求、也不关闭，
      // 用户只看到"点了没反应"。缺少提供方是个可报的错，就报出来。
      probe.log('provider-credential', { failed: 'no-provider' })
      set({
        tokenPanel: {
          ...getState().tokenPanel,
          saving: false,
          error: 'unknown-provider',
        },
      })
      return false
    }
    set({ tokenPanel: { ...panel, saving: true, error: null } })
    try {
      // 泛型参数就是端点返回的载荷本身（`RpcResponse<T>.value` 才是它）。
      var result = await ctx.connection.rpc.call<{
        saved?: boolean
        ref?: string
        reason?: string
        message?: string | null
      }>(CHANNEL, 'provider-credential', { args: { provider: provider, token: token } })
      var value = result && result.ok === true ? result.value : null
      if (!value || value.saved !== true) {
        var reason = value?.reason ?? 'failed'
        probe.log('provider-credential', {
          provider: provider,
          reason: reason,
          message: value?.message ?? null,
        })
        // 失败**不关**：面板得留着让人看见原因、改一改再存。
        set({ tokenPanel: { ...getState().tokenPanel, saving: false, error: reason } })
        return false
      }
      probe.log('provider-credential', { provider: provider, saved: true, ref: value.ref ?? null })
      // 存成功就把面板**当场关掉**。
      // 早先是"置一个 savedAt、由组件里的 setTimeout(900ms) 收起"——那条路不可靠：
      // 收起动作挂在渲染副作用上，宿主/页面任何一次异常重渲染都能把它漏掉，用户就看着
      // 一个已经存好的面板干等（他原话就是"保存成功后要自动关闭"）。
      // 现在关闭是 store 里的一句同步状态变更，没有定时器、没有副作用依赖。
      set({ tokenPanel: closedTokenPanel() })
      // 重取**不等**：网络慢（宿主超时 8 秒）时面板早该关了，
      // 数字自己在后台到位 —— 胶囊从"已用"变成"余额"就是保存成功的回执。
      void loadProviderBalance(true)
      return true
    } catch (error) {
      probe.log('provider-credential', {
        thrown: error instanceof Error ? error.message : String(error),
      })
      set({ tokenPanel: { ...getState().tokenPanel, saving: false, error: 'failed' } })
      return false
    }
  }

  return {
    loadProviderBalance: loadProviderBalance,
    resetForSession: resetForSession,
    openTokenPanel: openTokenPanel,
    closeTokenPanel: closeTokenPanel,
    saveProviderToken: saveProviderToken,
  }
}
