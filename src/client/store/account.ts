/**
 * 「账号余额」这一片 store：把 DSH 自己的账号接口包装成"一份快照 + 一个取数函数"。
 *
 * 为什么这么绕：余额不是一个投影，而是宿主替我们去 DeepSeek 平台查的账
 * （`remote.account.getBalance`）。所以这里做三件事 ——
 *
 *   1. **软依赖**：`remote.account` 与 `modules` 都是动态注入。没有账号能力（或没有
 *      版本号可用）时这一整片安静地不工作，余额胶囊不出现；插件其余部分照常。
 *   2. **限流**：余额按分钟变，轮询却跟别的读数不同频（见 `BALANCE_POLL_MS`）。
 *      这里再按 TTL 兜一层：轮询、窗口聚焦、点击三者撞到一起时只打一次平台。
 *   3. **失败不清零**：读不到时保留上一次的数字并打 `failed` 标记（界面据此提示
 *      "可能已过期"），而不是把胶囊抹掉 —— 账目读数短暂失败不代表余额变成 0。
 */

import type { HudBalance, HudBalanceWallet } from '../shared.js'
import type {
  AccountClientMetadata,
  AccountRemoteService,
  AccountSlice,
  AccountWallet,
  GetState,
  ModulesService,
  StoreContext,
  StoreSet,
} from './types.js'

import { isPositiveAmount } from '../format.js'
import { BALANCE_RETRY_MS, BALANCE_TTL_MS, probe } from '../shared.js'

/** 启动清单里宿主这一版的发布身份（`window.__DSH_BOOT__.release`）。 */
interface BootRelease {
  release?: { version?: string; commit?: string } | null
}

/**
 * 建「账号余额」这一片。
 * @param ctx - 客户端根上下文（用到 `effect` / `inject` / `locale`）。
 * @param getState - 读当前快照。
 * @param set - 浅合并写快照。
 * @returns 本片对外暴露的方法。
 */
export function createAccountSlice(
  ctx: StoreContext,
  getState: GetState,
  set: StoreSet,
): AccountSlice {
  /** 账号命名空间；没注入到就是 `null`（这个宿主没有账号插件，或还没起来）。 */
  var accountService: AccountRemoteService | null = null
  /** 启动清单服务：只借用它的 `manifest.release.version`。 */
  var modulesService: ModulesService | null = null
  /** 平台链接（用量页 / 充值页）：`getState()` 给，取到一次就一直用。 */
  var links: { usageUrl: string | null; topUpUrl: string | null } = {
    usageUrl: null,
    topUpUrl: null,
  }
  /** 在途请求：三次触发撞到一起时共用一次。 */
  var inflight: Promise<HudBalance | null> | null = null
  /** 上次真正发请求的时刻（TTL 的起点）。 */
  var lastAttemptAt = 0
  /** 上次的结果档位：成功用长 TTL，其它用短 TTL。 */
  var lastReady = false

  // 两条软依赖分开注入：缺 `modules` 不该把账号能力一起废掉（版本还能从启动清单里取）。
  if (typeof ctx.inject === 'function') {
    ctx.effect(function () {
      // 与内置插件同一写法（`dsh-client-ui-sidebar-documentpreview`）：父命名空间与子服务一起注入，
      // `scope.remote.account` 才保证有；只注子服务在 Cordis 里不保证父壳存在。
      return ctx.inject(['remote', 'remote.account'], function (scope) {
        accountService = scope.remote && scope.remote.account ? scope.remote.account : null
        probe.log('account', { bound: accountService !== null })
        // 服务可能比 apply 晚到：一绑上就补一次，别让胶囊等到下一轮 5 分钟的节拍才出现。
        if (accountService !== null) loadBalance()
        return function () {
          accountService = null
        }
      })
    }, 'dsh-hud: account service')

    ctx.effect(function () {
      return ctx.inject(['modules'], function (scope) {
        modulesService = scope.modules || null
        // 版本可能就是从这条依赖里来的：同样补一次（TTL 会挡住重复请求）。
        if (modulesService !== null) loadBalance()
        return function () {
          modulesService = null
        }
      })
    }, 'dsh-hud: boot manifest')
  }

  /**
   * 宿主这一版的版本号。
   *
   * 为什么非要它：账号接口的调用元数据要带 `x-client-version`，而 DSH 内置插件那半边
   * 是打包时**内联**了版本常量的（`"0.2.1-rc.3"`），外部插件的产物里没有这行字面量。
   * 所以从启动清单里现取：`window.__DSH_BOOT__.release.version` 是宿主自己发布在每份
   * 图里的发布身份，`ctx.modules.manifest.release.version` 是同一份数据的服务视角。
   * 两条都取不到就**不发请求**（宁可没有这一枚胶囊，也不要带一个假版本号去问平台）。
   *
   * @returns 版本字符串；都取不到回 `null`。
   */
  function releaseVersion(): string | null {
    var boot = (globalThis as { __DSH_BOOT__?: BootRelease }).__DSH_BOOT__
    var fromBoot = boot && boot.release ? boot.release.version : undefined
    if (typeof fromBoot === 'string' && fromBoot !== '') return fromBoot
    var manifest = modulesService ? modulesService.manifest : null
    var fromModules = manifest && manifest.release ? manifest.release.version : undefined
    if (typeof fromModules === 'string' && fromModules !== '') return fromModules
    return null
  }

  /** 当前界面语言（宿主再把它折成平台用的 `zh_CN` / `en_US`）。 */
  function activeLocale(): string {
    try {
      // `locale` 在 Cordis 上是个带 `getSnapshot()` 的服务；这里按结构读，不去依赖它的类型。
      var locale = ctx.locale as
        { getSnapshot?: () => { active?: string } | null } | null | undefined
      var snapshot =
        locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : null
      var active = snapshot && snapshot.active
      if (typeof active === 'string' && active !== '') return active
    } catch (error) {
      // 语言服务取不到不该影响余额：宿主那边会按 en_US 处理。
    }
    return 'en-US'
  }

  /**
   * 读账号投影里的两个平台链接。
   *
   * 为什么单独要它：余额接口只回钱包，**累计消耗 / 本月消耗只在平台用量页上**
   * （平台页还有「今天 / 本月 / 自定」那种时间维度，DSH 不代理那份数据）。
   * 这一枚胶囊因此提供一条直达那一页的路 —— 链接从账号投影里拿，不写死域名。
   *
   * `getState` 是直连方法（不碰网络），也不是所有宿主版本都有：缺了就安静地
   * 返回上一次的值，胶囊退化成"只有余额"。
   *
   * @param service - 账号命名空间。
   * @returns 两个链接（取不到就是上一次的、可能都是 `null`）。
   */
  function readLinks(service: AccountRemoteService): Promise<{
    usageUrl: string | null
    topUpUrl: string | null
  }> {
    if (typeof service.getState !== 'function') return Promise.resolve(links)
    return Promise.resolve()
      .then(function () {
        return service.getState!()
      })
      .then(function (result) {
        var value = result && result.ok === true ? result.value : null
        var next = value && value.links ? value.links : null
        if (next === null) return links
        var usageUrl = typeof next.usageUrl === 'string' ? next.usageUrl : null
        var topUpUrl = typeof next.topUpUrl === 'string' ? next.topUpUrl : null
        if (usageUrl === null && topUpUrl === null) return links
        return { usageUrl: usageUrl, topUpUrl: topUpUrl }
      })
      .catch(function () {
        return links
      })
  }

  /** 账号接口的调用元数据（时区偏移按"东为正"给，与 DSH 自己一致）。 */
  function clientMetadata(version: string): AccountClientMetadata {
    return {
      version: version,
      locale: activeLocale(),
      timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
    }
  }

  /** 平台给的数组 → 本片的钱包列表（逐项校验；形状不对的项直接丢，不猜）。 */
  function walletsOf(value: unknown): HudBalanceWallet[] {
    if (!Array.isArray(value)) return []
    var out: HudBalanceWallet[] = []
    for (var index = 0; index < value.length; index += 1) {
      var item = value[index] as AccountWallet | null
      if (!item || typeof item !== 'object') continue
      if (typeof item.currency !== 'string' || typeof item.balance !== 'string') continue
      out.push({ currency: item.currency, balance: item.balance })
    }
    return out
  }

  /** 两份快照的账目是否一致（一致就不 set，省一次重渲染）。 */
  function sameWallets(left: HudBalanceWallet[], right: HudBalanceWallet[]): boolean {
    if (left.length !== right.length) return false
    for (var index = 0; index < left.length; index += 1) {
      if (left[index].currency !== right[index].currency) return false
      if (left[index].balance !== right[index].balance) return false
    }
    return true
  }

  function publish(next: HudBalance | null): HudBalance | null {
    var previous = getState().balance
    if (next === null) {
      if (previous !== null) set({ balance: null })
      return null
    }
    var previousPrev = previous !== null && previous.prev ? previous.prev.at : null
    var nextPrev = next.prev ? next.prev.at : null
    var same =
      previous !== null &&
      previous.failed === next.failed &&
      previous.usageUrl === next.usageUrl &&
      previousPrev === nextPrev &&
      sameWallets(previous.wallets, next.wallets) &&
      sameWallets(previous.bonus, next.bonus)
    if (!same) set({ balance: next })
    return next
  }

  /** 读失败：留着上一次的数字、打上 `failed`，让界面能说"可能已过期"。 */
  function markFailed(): HudBalance | null {
    lastReady = false
    var previous = getState().balance
    if (previous === null) {
      probe.log('balance', { failed: true, had: false })
      return null
    }
    probe.log('balance', { failed: true, had: true })
    return publish({
      wallets: previous.wallets,
      bonus: previous.bonus,
      at: previous.at,
      failed: true,
      usageUrl: previous.usageUrl,
      topUpUrl: previous.topUpUrl,
      // 失败那一轮不动 `prev`：它永远指向最近一次**成功**的读数，否则"较上次刷新"会被
      // 一次失败搅成"跟更早的一次比"。
      prev: previous.prev || { wallets: previous.wallets, at: previous.at },
    })
  }

  /**
   * 取一次余额。
   * @param force - 跳过 TTL（点击胶囊时用）。
   * @returns 最新快照；没法取时回上一次的（可能为 `null`）。**从不 reject**。
   */
  function loadBalance(force?: boolean): Promise<HudBalance | null> {
    var now = Date.now()
    if (force !== true && lastAttemptAt !== 0) {
      var ttl = lastReady ? BALANCE_TTL_MS : BALANCE_RETRY_MS
      if (now - lastAttemptAt < ttl) return Promise.resolve(getState().balance)
    }
    if (accountService === null) return Promise.resolve(getState().balance)
    var version = releaseVersion()
    if (version === null) {
      probe.log('balance', { skipped: 'no-release-version' })
      return Promise.resolve(getState().balance)
    }
    if (inflight !== null) return inflight

    var service = accountService
    lastAttemptAt = now
    inflight = Promise.resolve()
      .then(function () {
        return Promise.all([
          service.getBalance(clientMetadata(version as string)),
          readLinks(service),
        ])
      })
      .then(function (pair) {
        links = pair[1]
        inflight = null
        var result = pair[0]
        if (!result || result.ok !== true) return markFailed()
        var payload = result.value
        // `null` = 当前没有登录态：不是错误，只是没账目可显示。
        if (payload === null || payload === undefined) {
          lastReady = false
          probe.log('balance', { signedOut: true })
          return publish(null)
        }
        if (payload.status !== 'ready') return markFailed()
        var wallets = walletsOf(payload.value)
        var bonus = walletsOf(payload.bonusWallets).filter(function (wallet) {
          return isPositiveAmount(wallet.balance)
        })
        if (wallets.length === 0 && bonus.length === 0) {
          lastReady = false
          probe.log('balance', { empty: true })
          return publish(null)
        }
        lastReady = true
        var at = Date.now()
        var before = getState().balance
        probe.log('balance', { wallets: wallets.length, bonus: bonus.length })
        return publish({
          wallets: wallets,
          bonus: bonus,
          at: at,
          failed: false,
          usageUrl: links.usageUrl,
          topUpUrl: links.topUpUrl,
          // 上一次成功读到的钱包：界面据此算"较上次刷新"的变化量。
          // 第一次根本没有前一份，这里就是 `null`（那时也就没有变化量可谈）。
          prev: before !== null ? { wallets: before.wallets, at: before.at } : null,
        })
      })
      .catch(function (error) {
        inflight = null
        probe.log('balance', { thrown: error instanceof Error ? error.message : String(error) })
        return markFailed()
      })

    return inflight
  }

  return { loadBalance: loadBalance }
}
