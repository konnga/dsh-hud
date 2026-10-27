/**
 * 余额胶囊：dock 行里那枚读数。
 *
 * 它画**当前会话真正在用的那个账本**：会话用的是 DeepSeek 平台账号，就画账号余额；
 * 换成了第三方中转站 / 官方 API Key，就画那个提供方的余额（见 `store/provider.ts`）。
 * 两个账本的钱不混着显示 —— 混着显示就是"胶囊数字看着像 bug"的来源。
 *
 * 两个动作：**左键刷新**（不必等 5 分钟那条节拍）、**右键打开平台用量页**
 * （累计消耗 / 本月消耗这些账目只在平台上，DSH 的账号接口只回钱包余额）。
 *
 * 它与其它几枚同住一条注册 —— dock 是竖列，独立注册会另起一整行（工具胶囊当初就撞过这个）。
 *
 * 余额是**账号级**事实：与会话、工作区都无关，所以这里不读 `sessionId`，也不因
 * "当前会话换了"而变化。没有账号能力 / 没登录 / 一个可展示的钱包都没有时**不画**，
 * 而不是画一个 `¥0.00` —— 那会把"读不到"说成"没钱"。
 */

import React from 'react'

import {
  formatBalance,
  formatDelta,
  fullWhen,
  isBelowAmount,
  isPositiveAmount,
  lowThresholdOf,
  subtractAmounts,
} from '../format.js'
import type {
  HudBalance,
  HudBalanceWallet,
  HudProviderBalance,
  HudProviderLedger,
  HudStore,
  TipLine,
  Translate,
} from '../shared.js'
import { BALANCE_LOW_DEFAULT, h, probe } from '../shared.js'

/** 余额胶囊的选项。 */
export interface BalancePillOptions {
  t: Translate
  store: HudStore
}

/**
 * 挑出要摆在胶囊上的那个钱包。
 *
 * 平台一般只给一个充值钱包；真给了多个，取**第一个**（顺序由平台决定），其余全在
 * 悬停里 —— 胶囊上塞两个币种会挤掉它"扫一眼"的价值。
 *
 * @param state - 快照（只读 `balance`）。
 * @returns 主钱包，或 `null`（没有可展示的钱包）。
 */
export function primaryWallet(state: { balance?: HudBalance | null }): HudBalanceWallet | null {
  var balance = state.balance
  if (!balance || !Array.isArray(balance.wallets)) return null
  for (var index = 0; index < balance.wallets.length; index += 1) {
    var wallet = balance.wallets[index]
    if (!wallet || typeof wallet.balance !== 'string') continue
    if (typeof wallet.currency !== 'string') continue
    return wallet
  }
  return null
}

/**
 * 赠送钱包里**真正有钱**的那些。
 *
 * 平台会把用完的赠送额度继续挂在 `bonusWallets` 里（余额 `0`），过滤规则与 DSH 自己的
 * 账号卡片一致（`isPositiveAmount`，等价于它的 `new Big(…).gt(0)`）—— store 那侧已经过滤
 * 过一次，这里再兜一次：组件不该假设上游一定干净。
 *
 * @param balance - 余额快照。
 * @returns 余额大于 0 的赠送钱包。
 */
export function visibleBonus(balance: HudBalance): HudBalanceWallet[] {
  var bonus = Array.isArray(balance.bonus) ? balance.bonus : []
  var out: HudBalanceWallet[] = []
  for (var index = 0; index < bonus.length; index += 1) {
    var wallet = bonus[index]
    if (!wallet || typeof wallet.balance !== 'string') continue
    if (!isPositiveAmount(wallet.balance)) continue
    out.push(wallet)
  }
  return out
}

/**
 * 某个钱包**较上一次成功刷新**变化了多少。
 *
 * 只在我们自己采样到的两个时刻之间比较（不是平台账单的"今日消耗"）：所以文案写的是
 * "较上次刷新"，而不是"今天花了多少"。上一次读数与这次币种对不上、或数值没变，都回
 * `null`（那时没有可展示的变化量）。
 *
 * @param balance - 余额快照（含 `prev`）。
 * @param wallet - 当前主钱包。
 * @returns `{ delta, at }`；没有变化或没有前一份读数时回 `null`。
 */
export function deltaOf(
  balance: HudBalance,
  wallet: HudBalanceWallet,
): { delta: string; at: number } | null {
  var prev = balance.prev
  if (!prev || !Array.isArray(prev.wallets)) return null
  for (var index = 0; index < prev.wallets.length; index += 1) {
    var older = prev.wallets[index]
    if (!older || older.currency !== wallet.currency) continue
    if (typeof older.balance !== 'string') return null
    var diff = subtractAmounts(wallet.balance, older.balance)
    if (diff === null) return null
    var text = formatDelta(diff, wallet.currency)
    if (text === null) return null
    return { delta: text, at: prev.at }
  }
  return null
}

/**
 * 这个钱包是否低于低余额阈值。
 *
 * 阈值默认 `BALANCE_LOW_DEFAULT`，可被 `dsh-hud.balanceLow` 覆盖（见 README）。
 * 拿不准（金额非法、阈值读坏）时**不报警**：误报比漏报更烦人。
 *
 * @param wallet - 钱包。
 * @returns 严格低于阈值为 `true`。
 */
export function isLowWallet(wallet: HudBalanceWallet): boolean {
  return isBelowAmount(wallet.balance, lowThresholdOf(BALANCE_LOW_DEFAULT))
}

/** 提供方账本里可展示的主数字（剩余优先；只有已用时退回已用）。 */
export interface ProviderFigure {
  /** 主数字的十进制字符串。 */
  amount: string
  /** 币种（站点口径）。 */
  currency: string | null
  /** 主数字是"剩余"还是"已用"（决定胶囊要不要前缀、要不要低余额判断）。 */
  kind: 'remaining' | 'used'
}

/**
 * 从提供方余额里挑出胶囊该画的那个数。
 *
 * 顺序是有讲究的：**剩余优先**。中转站把额度写成"无限"占位值时 `remaining` 是 `null`
 * （站点自己也不知道剩多少），这时只能画已用 —— 一个能核对的数字，胜过编一个天文数字。
 *
 * @param balance - 提供方余额快照。
 * @returns 主数字；一个能画的都没有时回 `null`（那就不画胶囊）。
 */
export function providerFigureOf(balance: HudProviderBalance): ProviderFigure | null {
  if (typeof balance.remaining === 'string') {
    return { amount: balance.remaining, currency: balance.currency, kind: 'remaining' }
  }
  // 只剩"已用"可画时优先用**本 Key**那个数：胶囊空间只够一个，而它跟"这个会话
  // 花了多少"对得更近；账号累计照样在悬停里列着（见 `providerBalanceTitle`）。
  if (typeof balance.usedKey === 'string') {
    return { amount: balance.usedKey, currency: balance.currency, kind: 'used' }
  }
  if (typeof balance.usedAccount === 'string') {
    return { amount: balance.usedAccount, currency: balance.currency, kind: 'used' }
  }
  // 只有钱包列表（官方 `/user/balance` 那种）：取第一个。
  var wallets = Array.isArray(balance.wallets) ? balance.wallets : []
  for (var index = 0; index < wallets.length; index += 1) {
    var wallet = wallets[index]
    if (wallet && typeof wallet.balance === 'string') {
      return { amount: wallet.balance, currency: wallet.currency, kind: 'remaining' }
    }
  }
  return null
}

/**
 * 金额文本：币种未知时不要凭空造一个符号。
 *
 * @param amount - 十进制字符串。
 * @param currency - 币种（可能为 `null`）。
 * @returns 展示文本；金额非法回 `null`。
 */
export function amountText(amount: string, currency: string | null): string | null {
  var text = formatBalance(amount, currency === null ? '' : currency)
  if (text === null) return null
  return currency === null ? text.trim() : text
}

/** `amountText` 的"可能没有"版本：不是十进制字符串就回 `null`。 */
function amountTextOf(amount: string | null | undefined, currency: string | null): string | null {
  if (typeof amount !== 'string') return null
  return amountText(amount, currency)
}

/** i18n 模板里用来定位"标签/数值"分界点的哨兵（不可能出现在译文里）。 */
const TIP_SPLIT = '\u0000'

/**
 * 把 `'余额 {amount}'` 这样的模板拆成「标签 + 数值」两段。
 *
 * 为什么要拆：用户要「数字亮、标签灰」，而一整段文本在 DOM 里只有一个文本节点。
 * 做法是把参数换成一个哨兵再渲染，按哨兵位置切开 —— 这样**标签部分始终来自词典**，
 * 中英文都自动跟着走，不需要为每种语言另立一个"只有标签"的 key。
 *
 * @param t - 取词。
 * @param key - 词典里那条带 `{param}` 的模板。
 * @param param - 模板里的参数名。
 * @param value - 已经格式化好的数值文本。
 * @returns 逐行结构里的一行。
 */
function labelledLine(
  t: Translate,
  key: string,
  param: string,
  value: string,
  tone: TipLine['tone'] = 'primary',
): TipLine {
  var probe: Record<string, string> = {}
  probe[param] = TIP_SPLIT
  var rendered = t(key, probe)
  var at = rendered.indexOf(TIP_SPLIT)
  if (at < 0) return { text: t(key, probe) }
  return { label: rendered.slice(0, at).trim(), value: value, tone: tone }
}

/**
 * 提供方余额的悬停明细。
 *
 * 只放读数：提供方 id、余额、账号已用、请求数、本 Key 已用、更新时间。
 * 不再解释"为什么没有剩余额度"—— 没有那一行本身就是答案。
 *
 * @param balance - 提供方余额快照。
 * @param t - 取词。
 * @returns 逐行结构（标签灰、数字亮）。
 */
export function providerBalanceTitle(balance: HudProviderBalance, t: Translate): TipLine[] {
  // 站名当抬头：一整行次要色，不和下面的读数抢注意力。
  var lines: TipLine[] = [{ text: balance.provider, tone: 'muted' }]
  var figure = providerFigureOf(balance)
  if (figure !== null && figure.kind === 'remaining') {
    var remainingText = amountText(figure.amount, figure.currency)
    if (remainingText !== null)
      // 绿 = 还剩多少（"可用额度"的通行读法）。
      lines.push(labelledLine(t, 'balance.providerRemaining', 'amount', remainingText, 'success'))
  }
  // 官方 Key 会带赠送额度（胶囊上那个 `+` 就是它），明细里要说清是多少 ——
  // 不然 `+` 就是个没人知道什么意思的符号。
  var bonus = Array.isArray(balance.bonus) ? balance.bonus : []
  var parts: string[] = []
  for (var index = 0; index < bonus.length; index += 1) {
    if (!isPositiveAmount(bonus[index].balance)) continue
    var bonusText = amountText(bonus[index].balance, bonus[index].currency)
    if (bonusText !== null) parts.push(bonusText)
  }
  if (parts.length > 0) {
    lines.push({ label: t('balance.bonus'), value: parts.join(' · '), tone: 'muted' })
  }
  // 两个"已用"是两个账本上的数（账号 $637.56 / 本 Key $536.22），
  // 所以各占一行、各带自己的标签 —— 不合并成一个数，也不互相顶替。
  // 顺序：余额 → 请求数 → 账号已用 → 本 Key 已用。
  // 请求数紧跟在余额下面（用户要的）：它是同一屏里唯一一个"次数"而不是钱，
  // 夹在两个金额中间容易被读成第三个金额。
  if (typeof balance.requests === 'number' && balance.requests > 0) {
    // 站点后台「API 请求」那个数；千分位让四位数一眼能读。
    // 品牌蓝：这是次数、不是金额，用中性强调色把它和两行钱区分开。
    lines.push(
      labelledLine(
        t,
        'balance.providerRequests',
        'count',
        balance.requests.toLocaleString('en-US'),
        'accent',
      ),
    )
  }
  var accountUsed = amountTextOf(balance.usedAccount, balance.currency)
  if (accountUsed !== null) {
    // 琥珀 = 已经花掉多少。它是**分类色**（消耗），不是在报警。
    lines.push(labelledLine(t, 'balance.providerUsedAccount', 'amount', accountUsed, 'warn'))
  }
  var keyUsed = amountTextOf(balance.usedKey, balance.currency)
  if (keyUsed !== null) {
    lines.push(labelledLine(t, 'balance.providerUsedKey', 'amount', keyUsed, 'warn'))
  }
  // 时间不是读数，整行次要色。
  lines.push({ text: t('balance.updated', { time: fullWhen(balance.at) }), tone: 'muted' })
  return lines
}

/**
 * 点胶囊该干什么。
 *
 * 分两种情况，因为"点了没反应"是最难查的那种问题：
 *   - 这个提供方的**后台凭据还没配**（`token.configured === false`）→ 直接弹设置面板。
 *     这才是用户此刻真正要做的事；让他自己去翻配置文件就是把人挡在门外。
 *   - 配了（或宿主没告诉我们状态）→ 刷新一次读数（跳过宿主 60 秒缓存）。
 *
 * @param ledger - 当前账本结论（`token` 在里面）。
 * @param store - 共享 store。
 */
function onPillClick(ledger: HudProviderLedger, store: HudStore): void {
  var token = ledger.token
  if (token !== null && token !== undefined && token.configured === false) {
    store.openTokenPanel(
      typeof ledger.provider === 'string' && ledger.provider !== '' ? ledger.provider : '',
      token.ref,
    )
    return
  }
  void store.loadProviderBalance(true)
}

/** 平台用量页地址（没有就回 `null`：更旧的宿主不给这个链接）。 */
export function usageUrlOf(balance: HudBalance): string | null {
  var url = balance.usageUrl
  return typeof url === 'string' && url !== '' ? url : null
}

/**
 * 在新标签页打开一个外链。
 *
 * 为什么要 try/catch：`window.open` 在假 DOM 与某些沙箱里不存在，而"打不开链接"
 * 不该把整枚胶囊的点击路径打崩（它是只读读数，不是导航控件）。
 *
 * @param url - 目标地址。
 * @returns 是否成功发起打开。
 */
export function openExternal(url: string): boolean {
  try {
    var opened = (globalThis as { open?: (target: string, name?: string) => unknown }).open
    if (typeof opened === 'function') {
      opened.call(globalThis, url, '_blank')
      return true
    }
  } catch (error) {
    // 落到下面的 false：调用方只知道"没打开"，不需要知道原因。
  }
  return false
}

/**
 * 悬停明细：每个钱包一行、赠送余额、变化量、低余额提醒、更新时间，以及失败时那句"可能已过期"。
 *
 * 刻意**不写操作说明**（"点一下刷新" / "右键开用量页"）：气泡是读数，不是帮助文档；
 * 两句话就把本来五行的明细撑成七行，还挤掉了真正会变的那几个数。
 *
 * @param balance - 余额快照。
 * @param t - 取词。
 * @returns 多行文本（气泡按 `pre-wrap` 原样显示）。
 */
export function balanceTitle(balance: HudBalance, t: Translate): TipLine[] {
  // 抬头（「DeepSeek 账号余额」）用次要色：它是标题，不是读数。
  var lines: TipLine[] = [{ text: t('balance.title'), tone: 'muted' }]
  var wallets = Array.isArray(balance.wallets) ? balance.wallets : []
  for (var index = 0; index < wallets.length; index += 1) {
    var text = formatBalance(wallets[index].balance, wallets[index].currency)
    if (text === null) continue
    // 钱包金额是这一屏的主角：绿色（"还剩多少"），不带标签所以整行染色。
    lines.push({
      text: (index === 0 ? text : text + ' (' + wallets[index].currency + ')') as string,
      tone: 'success',
    })
  }
  // 赠送钱包里 0 余额的那些不必露脸（平台会把用完的额度继续挂在列表里）。
  var bonus = visibleBonus(balance)
  if (bonus.length > 0) {
    var parts: string[] = []
    for (var k = 0; k < bonus.length; k += 1) {
      var bonusText = formatBalance(bonus[k].balance, bonus[k].currency)
      if (bonusText !== null) parts.push(bonusText)
    }
    if (parts.length > 0) {
      lines.push({ label: t('balance.bonus'), value: parts.join(' · '), tone: 'muted' })
    }
  }
  // 变化量放在金额之后、时间之前：读的人先看"现在多少"，再看"比上次多了/少了多少"。
  var wallet = primaryWallet({ balance: balance })
  if (wallet !== null) {
    var move = deltaOf(balance, wallet)
    // 变化量是给"顺手看一眼"的信息，不是主读数：整行次要色。
    if (move !== null) {
      lines.push({
        text: t('balance.delta', { delta: move.delta, time: fullWhen(move.at) }),
        tone: 'muted',
      })
    }
    // 低余额不在这里写字：`⚠` + 警示色已经在胶囊上说了这件事，气泡不再复述一遍。
  }
  lines.push({ text: t('balance.updated', { time: fullWhen(balance.at) }), tone: 'muted' })
  // 失败时 `at` 还停在上一次成功的时刻：这句把"这个数是旧的"说清楚。
  if (balance.failed === true) {
    lines.push({ text: t('balance.stale', { time: fullWhen(balance.at) }), tone: 'muted' })
  }
  return lines
}

/**
 * 画那枚余额胶囊。
 * @param state - store 快照（只读 `balance`）。
 * @param options - 取词与 store（悬停接线、刷新都经它）。
 * @returns 胶囊节点；没有可展示的余额时 `null`。
 */
export function balancePillNode(
  state: { balance?: HudBalance | null; provider?: HudProviderLedger | null },
  options: BalancePillOptions,
): React.ReactElement | null {
  var t = options.t
  var ledger = state.provider

  // ── 会话用的是别的提供方，并且读到了它的余额 ────────────────────────────────
  if (ledger && ledger.mode === 'provider' && ledger.balance !== null) {
    // 右键仍要去平台用量页：那份链接挂在**账号**快照上（提供方那一侧没有），
    // 所以这里把账号快照里的链接单独取出来传下去。
    var accountUsage =
      state.balance && typeof state.balance === 'object' ? usageUrlOf(state.balance) : null
    return providerPillNode(ledger, ledger.balance, accountUsage, options)
  }
  // 知道是哪个提供方但读不到：**绝不退回平台账号的余额**（那是另一个账本的钱）。
  // 但也别干脆消失 —— 消失分不清"这个站没有余额接口"和"插件坏了"（用户正是这么误判的）。
  // 折中：画成 `站名 --`，悬停里写一句为什么。
  if (ledger && ledger.mode === 'unavailable') {
    if (typeof ledger.provider === 'string' && ledger.provider !== '') {
      return unknownProviderPillNode(ledger, options)
    }
    // 连是哪个站都还不知道（新会话的投影还没就绪 / 宿主答不上来）：
    // 画 `--`，**不要**拿平台账号的余额顶上 —— 用户明确要求过这一条。
    return placeholderPillNode(ledger, options)
  }

  // **明确**处于"还没问出来"（`unknown`）：画 `--`。
  // 早先这里落到下面的账号那一路，于是新会话会先闪一个官方账号余额 ——
  // 那个数字未必是这次会话要花的钱，等于骗人。
  //
  // 注意与"根本没有 provider 字段"区分开：后者是更旧的快照（或 store 还没挂上），
  // 那时没有"本次会话要用谁的钱"这个概念，照旧走账号那一路（向后兼容）。
  if (ledger !== undefined && ledger !== null && ledger.mode === 'unknown') {
    return placeholderPillNode(ledger, options)
  }

  // ── 平台账号那一路（`account`）：宿主明确说"这个提供方的账本就是平台账号"────────
  var snapshot = state.balance
  if (!snapshot || typeof snapshot !== 'object') return null
  // 收窄进 local const：下面的悬停闭包里还要用它（`var` 在回调里 TS 不再保留收窄）。
  const balance = snapshot
  var wallet = primaryWallet({ balance: balance })
  if (wallet === null) return null
  var text = formatBalance(wallet.balance, wallet.currency)
  if (text === null) return null

  // 只画 `formatBalance` 给的那一串：**不要再额外加一个符号** ——
  // 它自己已经带 `¥` / `$`，早先这里又画了一个字形，屏幕上就成了 `¥ ¥8.60`。
  var low = isLowWallet(wallet)
  var children: React.ReactNode[] = []
  // 低余额：在最前面加一个 `⚠`（不是替换数字 —— 用户还是要知道具体剩多少）。
  if (low) children.push(h('span', { key: 'low', className: 'dshh-balanceWarn' }, '\u26a0'))
  children.push(
    h(
      'span',
      { key: 'value', className: 'dshh-balanceValue' + (low ? ' dshh-balanceLow' : '') },
      text,
    ),
  )
  // 有赠送余额就缀一个 `+`：不占地方，但"还有一笔"这件事不会被藏起来（明细在悬停里）。
  if (visibleBonus(balance).length > 0) {
    children.push(h('span', { key: 'bonus', className: 'dshh-balanceBonus' }, '+'))
  }
  // 最近一次刷新失败：数字还是上一次的，用 `?` 标出"可能已过期"。
  if (balance.failed === true) {
    children.push(h('span', { key: 'stale', className: 'dshh-balanceStale' }, '?'))
  }

  probe.log('balance-pill', {
    ledger: 'account',
    currency: wallet.currency,
    failed: balance.failed === true,
    bonus: Array.isArray(balance.bonus) ? balance.bonus.length : 0,
    low: low,
    delta: deltaOf(balance, wallet) === null ? null : 'yes',
  })

  return h(
    'button',
    Object.assign(
      {
        type: 'button',
        className: 'dshh-pill dshh-balance',
        'data-dsh-hud': 'balance-pill',
        key: 'balance',
        'aria-label': t('balance.title'),
        onClick: function () {
          options.store.loadBalance(true)
        },
        // 右键 = 去看账目明细。累计消耗 / 本月消耗在平台用量页，DSH 没有代理那份数据，
        // 所以这里只做"一步跳过去"，并在悬停里写清楚（不然没人会想到去右键）。
        onContextMenu: function (event: {
          preventDefault?: () => void
          stopPropagation?: () => void
        }) {
          var url = usageUrlOf(balance)
          if (url === null) return
          if (event && typeof event.preventDefault === 'function') event.preventDefault()
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
          openExternal(url)
        },
      },
      options.store.tipHandlers('balance-pill', function () {
        return balanceTitle(balance, t)
      }),
    ),
    children,
  )
}

/**
 * 画"还没有读数"的占位胶囊：`--`。
 *
 * 为什么不是干脆不画：不画就分不清"还在查"和"插件没装好"（用户当年正是这么误判的）。
 * 为什么不用平台账号的余额顶上：那是**另一个账本**的钱；新会话还不知道要用谁的钱，
 * 拿官方账号余额去填，等于报一个和本次会话无关的数。
 *
 * 点击照样重取一次 —— 用户点它，通常就是"怎么还没出来"。
 *
 * @param ledger - 当前账本结论（可能是 `null`：连结论都还没有）。
 * @param options - 取词与 store。
 * @returns 胶囊节点。
 */
function placeholderPillNode(
  ledger: HudProviderLedger | null,
  options: BalancePillOptions,
): React.ReactElement {
  var t = options.t
  probe.log('balance-pill', { ledger: 'placeholder', reason: ledger?.reason ?? null })
  var text = t('balance.providerUnknown')
  return h(
    'button',
    Object.assign(
      {
        type: 'button',
        className: 'dshh-pill dshh-balance dshh-balanceUnknown',
        'data-dsh-hud': 'balance-pill',
        key: 'balance',
        'aria-label': text,
        onClick: function () {
          void options.store.loadProviderBalance(true)
        },
      },
      options.store.tipHandlers('balance-pill', function () {
        return text
      }),
    ),
    [h('span', { key: 'value', className: 'dshh-balanceValue' }, text)],
  )
}

/**
 * 画"知道是哪个提供方、但读不到它的余额"的胶囊：`站名 --`。
 *
 * 为什么值得画：`—` 是一个**读数**（"这个账本的数读不到"），而空白只是一个疑点。
 * 用户看到空白的第一反应是"插件坏了"，于是去翻日志、重装、重启 —— 那才是真正的成本。
 *
 * @param ledger - 账本结论（含提供方与原因）。
 * @param options - 取词与 store。
 * @returns 胶囊节点。
 */
function unknownProviderPillNode(
  ledger: HudProviderLedger,
  options: BalancePillOptions,
): React.ReactElement {
  var t = options.t
  var provider = typeof ledger.provider === 'string' ? ledger.provider : '?'
  var reason =
    typeof ledger.reason === 'string' && ledger.reason !== ''
      ? t('balance.reason.' + ledger.reason)
      : ''

  probe.log('balance-pill', { ledger: 'unavailable', provider: provider, reason: ledger.reason })

  return h(
    'button',
    Object.assign(
      {
        type: 'button',
        className: 'dshh-pill dshh-balance dshh-balanceUnknown',
        'data-dsh-hud': 'balance-pill',
        key: 'balance',
        'aria-label': provider,
        onClick: function () {
          // `站名 --` 往往正是"没配后台令牌"的样子，所以这里也要能弹面板。
          onPillClick(ledger, options.store)
        },
      },
      options.store.tipHandlers('balance-pill', function () {
        return reason === '' ? provider : provider + '\n' + reason
      }),
    ),
    [
      h('span', { key: 'provider', className: 'dshh-balanceProvider' }, provider),
      h('span', { key: 'value', className: 'dshh-balanceValue' }, t('balance.providerUnknown')),
    ],
  )
}

/**
 * 画"当前提供方"的余额胶囊（中转站 / 官方 API Key）。
 *
 * 与账号那一路的两处不同：
 *   - 没有赠送标记 `+` 那一套区分含义（中转站只报一个数），但官方 Key 带 `bonus`，照旧缀起来；
 *   - 只有"已用"可画时（站点把额度写成无限占位值）在数字前加一个词，否则读的人会把它当成余额。
 *
 * @param balance - 提供方余额快照。
 * @param options - 取词与 store。
 * @returns 胶囊节点；没有可画的数字时 `null`。
 */
function providerPillNode(
  ledger: HudProviderLedger,
  balance: HudProviderBalance,
  usageUrl: string | null,
  options: BalancePillOptions,
): React.ReactElement | null {
  var t = options.t
  var figure = providerFigureOf(balance)
  if (figure === null) return null
  var text = amountText(figure.amount, figure.currency)
  if (text === null) return null

  // 低余额只在"这是剩余额度"时才有意义：拿"已用"去比阈值是错的。
  var low =
    figure.kind === 'remaining' && isBelowAmount(figure.amount, lowThresholdOf(BALANCE_LOW_DEFAULT))

  var children: React.ReactNode[] = []
  if (low) children.push(h('span', { key: 'low', className: 'dshh-balanceWarn' }, '\u26a0'))
  // 只有"已用"可画时先标一个词：不然 `$442.33` 会被读成余额。
  if (figure.kind === 'used') {
    children.push(
      h('span', { key: 'label', className: 'dshh-balanceUsed' }, t('balance.usedShort')),
    )
  }
  children.push(
    h(
      'span',
      { key: 'value', className: 'dshh-balanceValue' + (low ? ' dshh-balanceLow' : '') },
      text,
    ),
  )
  if (balance.bonus.length > 0) {
    children.push(h('span', { key: 'bonus', className: 'dshh-balanceBonus' }, '+'))
  }

  probe.log('balance-pill', {
    ledger: 'provider',
    provider: balance.provider,
    kind: balance.kind,
    figure: figure.kind,
    placeholder: balance.placeholderLimit,
    low: low,
  })

  return h(
    'button',
    Object.assign(
      {
        type: 'button',
        className: 'dshh-pill dshh-balance',
        'data-dsh-hud': 'balance-pill',
        key: 'balance',
        'aria-label': balance.provider,
        onClick: function () {
          onPillClick(ledger, options.store)
        },
        // 右键仍然去平台用量页 —— 那是"按时间维度看消耗"的地方；没有链接就什么都不做。
        onContextMenu: function (event: {
          preventDefault?: () => void
          stopPropagation?: () => void
        }) {
          var url = usageUrl
          if (url === null) return
          if (event && typeof event.preventDefault === 'function') event.preventDefault()
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
          openExternal(url)
        },
      },
      options.store.tipHandlers('balance-pill', function () {
        return providerBalanceTitle(balance, t)
      }),
    ),
    children,
  )
}
