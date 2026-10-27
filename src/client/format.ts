/**
 * 展示用的格式化：分支名、工作区名、相对时间、计数简写。
 *
 * 都是纯函数（输入数据、输出字符串），所以可以直接单测，也让组件里不再夹带这类判断。
 */

import type {
  CountShorthand,
  HudCountKey,
  HudSessionOverviewRow,
  HudStatusCounts,
  RowSummary,
  Translate,
} from './shared.js'
import {
  BALANCE_LOW_KEY,
  COUNT_MARK,
  COUNT_ORDER,
  PILL_BRANCH_MAX,
  PILL_WORKSPACE_MAX,
} from './shared.js'
/** 从中间省略：保留头尾（路径/分支名两头的区分度都比中间高）。 */
export function middleEllipsis(name: string, max: number): string {
  if (name.length <= max) return name
  var head = Math.ceil((max - 1) / 2)
  var tail = max - 1 - head
  return name.slice(0, head) + '…' + name.slice(name.length - tail)
}

/**
 * 工作区名 = 会话 cwd 的目录名（侧栏给工作区起的名字就是它）。
 *
 * 取的是 **cwd** 而不是仓库顶层：会话开在子目录时，用户认的是那个子目录；
 * 完整路径在悬停与面板里，胶囊上只要一个能认出来的短名字。
 */
export function workspaceNameOf(cwd: string | null | undefined): string | null {
  if (typeof cwd !== 'string' || cwd.length === 0) return null
  var trimmed = cwd.replace(/[/\\]+$/, '')
  if (trimmed.length === 0) return null
  var index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  var name = index === -1 ? trimmed : trimmed.slice(index + 1)
  if (name.length === 0) return null
  return middleEllipsis(name, PILL_WORKSPACE_MAX)
}

/** 分支名过长时中段省略，保留头尾信息量。 */
export function shortBranch(name: string): string {
  return middleEllipsis(name, PILL_BRANCH_MAX)
}

/**
 * 改动计数 → 简写符列表 `[{ key, mark, value }]`（只列非零项，顺序固定）。
 *
 * 胶囊与侧栏行内 chip 共用这一份：两处各写一套算法一定会漂。
 */
export function countShorthands(counts: HudStatusCounts | null | undefined): CountShorthand[] {
  var out: CountShorthand[] = []
  var source: Partial<HudStatusCounts> = counts || {}
  for (var index = 0; index < COUNT_ORDER.length; index += 1) {
    var key = COUNT_ORDER[index]
    var value = source[key] || 0
    if (value <= 0) continue
    out.push({ key: key, mark: COUNT_MARK[key], value: value })
  }
  return out
}

export function branchLabel(
  status: { branch?: string | null; oid?: string | null } | null | undefined,
  t: Translate,
): string {
  if (!status) return '—'
  if (status.branch) return status.branch
  if (status.oid) return t('panel.detached') + ' ' + status.oid
  return t('panel.detached')
}

export function timeLabel(at: number): string {
  var date = new Date(at)
  var pad = function (value: number) {
    return value < 10 ? '0' + String(value) : String(value)
  }
  return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
}

/* --------------------------------------------------------- 胶囊（dock） */

/**
 * 会话作用域的座位：框架给出 `sessionId`，`useSessions` 快照给出该会话的 `cwd`，
 * 因此它是唯一能完成绑定的座位。
 */
/**
 * 侧栏每条会话行上的状态 chip（座位 `sidebar.workspaces.session.row.action`）。
 *
 * 一行只有 32px 高、悬停才露出来，所以只放**最该一眼看到的两件事**：这个工作区脏不脏
 * （git 简写符）与**这个会话自己改过几个文件**（`●n`，只我们有这个信息）。干净且本会话
 * 没改过就整枚不画 —— 不占位置、也不制造噪音。完整信息在悬停里。
 */
/**
 * 一枚侧栏状态的"事实摘要"：三种呈现（常亮标记 / 悬停动条 / 卡片详情）共用这一份计算。
 *
 * 同一份数据要在三个地方以三种宽度呈现，各写一套一定会漂 —— 所以抽成一处。
 */
export function rowSummaryOf(row: HudSessionOverviewRow | null | undefined): RowSummary | null {
  if (row === undefined || row === null || row.pending === true) return null
  var mineCount = typeof row.mine === 'number' ? row.mine : 0
  var possibleCount = typeof row.possible === 'number' ? row.possible : 0
  var shorthands: CountShorthand[] = row.repo === true ? countShorthands(row.counts) : []
  var changed = 0
  for (var index = 0; index < shorthands.length; index += 1) changed += shorthands[index].value
  return {
    row: row,
    mine: mineCount,
    possibleNow: typeof row.possibleNow === 'number' ? row.possibleNow : 0,
    possible: possibleCount,
    shorthands: shorthands,
    changed: changed,
    dirty: row.repo === true && row.dirty === true,
    hasContent: changed > 0 || mineCount > 0 || possibleCount > 0 || row.error !== null,
  }
}

/** 相对时间；超过 30 天直接给提交自己的日期。 */
export function commitWhen(
  commit: { committedAt?: number | null; date?: string | null },
  t: Translate,
): string {
  if (typeof commit.committedAt !== 'number') return commit.date || ''
  return fullWhen(commit.committedAt)
}

/**
 * 时刻一律给完整年月日 + 时分（本地时区）：`2026-10-16 14:18`。
 *
 * 两级简化都被否掉了：先是从"2 小时前"改成具体时间（相对时间在对账场景不够用），
 * 再是"今天只给 `14:18`"也被否 —— 用户要**年月日都在**。所以不再分档，一视同仁。
 * 只到分钟：提交/标签不需要秒，列一排在面板里也塞得下。
 */
export function fullWhen(at: number): string {
  var then = new Date(at)
  return (
    String(then.getFullYear()) +
    '-' +
    pad2(then.getMonth() + 1) +
    '-' +
    pad2(then.getDate()) +
    ' ' +
    pad2(then.getHours()) +
    ':' +
    pad2(then.getMinutes())
  )
}

export function pad2(value: number): string {
  return value < 10 ? '0' + String(value) : String(value)
}

/** porcelain-v2 的展示字母 → counts 键（用于配色）。 */
export function statusKey(letter: string): HudCountKey {
  if (letter === 'M') return 'modified'
  if (letter === 'A') return 'added'
  if (letter === 'D') return 'deleted'
  if (letter === 'R') return 'renamed'
  if (letter === 'C') return 'copied'
  if (letter === 'T') return 'typeChanged'
  if (letter === '?') return 'untracked'
  if (letter === '!') return 'conflicted'
  return 'typeChanged'
}

/** 宿主半的 `details.code` → 本座位的本地化文案（store 只存机器码）。 */
export function errorText(code: string | null | undefined, t: Translate): string {
  if (code === 'timeout') return t('err.timeout')
  if (code === 'no-cwd') return t('err.no-cwd')
  if (code === 'git-missing') return t('err.git-missing')
  if (code === 'invalid-cwd') return t('err.invalid-cwd')
  if (code === 'transport') return t('err.transport')
  if (code === 'invalid-path') return t('err.invalid-path')
  // 提交可能在两次请求之间被 rebase / amend 换掉：给一句能操作的提示，而不是"git 执行失败"。
  if (code === 'unknown-commit') return t('commit.unknown')
  // 宿主半是启动时加载的：只刷新页面时，新端点还不存在，这个提示能省下一轮排查。
  if (code === 'unknown-endpoint') return t('err.stale-host')
  return t('err.git-failed')
}

/* ------------------------------------------------------------- 账号余额 */

/**
 * 这个金额真的大于 0 吗（不引 big.js：只看字符串里有没有非零数字、且不是负数）。
 *
 * 平台会给 0 余额的钱包（赠送额度用完了也还在列里），DSH 自己的账号卡片就是
 * 这么过滤的（`new Big(wallet.balance).gt(0)`）—— 两边判定要一致，否则会出现
 * "这里有 ¥0.00 的赠送余额"这种没人想看的一行。
 *
 * @param amount - 平台给的十进制字符串。
 * @returns 严格大于 0 为 `true`。
 */
export function isPositiveAmount(amount: string): boolean {
  if (typeof amount !== 'string') return false
  var raw = amount.trim()
  if (raw.charAt(0) === '-') return false
  return /[1-9]/.test(raw)
}

/** 币种 → 符号。认不出的币种原样接在后面（`123.45 XYZ`），不猜符号。 */
export function currencySymbol(currency: string): string | null {
  if (currency === 'CNY') return '\u00a5'
  if (currency === 'USD') return '$'
  return null
}

/**
 * 十进制字符串 → 千分位整数部分，**不经过浮点**。
 *
 * 余额是账目数字：`Number('1234567.89')` 在极大值上会丢精度，所以整数部分只做字符串分组，
 * 小数部分原样保留。符号与小数位由调用方决定（两者在本插件里是两条独立规则）。
 */
function groupDigits(integer: string): string {
  var negative = integer.charAt(0) === '-'
  var digits = negative ? integer.slice(1) : integer
  var out = ''
  for (var index = 0; index < digits.length; index += 1) {
    var rest = digits.length - index
    out += digits.charAt(index)
    if (rest > 1 && rest % 3 === 1) out += ','
  }
  return negative ? '-' + out : out
}

/** 一个金额的字符串分解（不经过浮点：账目数字转成 double 会丢精度）。 */
export interface ParsedAmount {
  negative: boolean
  /** 整数部分，已去掉前导 0（`007` → `7`），至少一位。 */
  integer: string
  /** 小数部分，至少一位（`5` → `0`）；科学计数法已展开。 */
  fraction: string
}

/**
 * 把十进制字符串拆成符号 / 整数 / 小数三块。
 *
 * 允许的写法与平台一致：`123`、`123.45`、`.5`、`5.`、科学计数法。
 * 不接受空串、`+` 号以外的其它前缀、以及 `1,234`（千分位是我们**输出**的形状，不是输入）。
 *
 * @param amount - 十进制字符串。
 * @returns 分解结果；非法输入回 `null`。
 */
export function parseAmount(amount: string): ParsedAmount | null {
  if (typeof amount !== 'string') return null
  var raw = amount.trim()
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return null
  var negative = raw.charAt(0) === '-'
  var body = negative ? raw.slice(1) : raw
  // 科学计数法只在真的出现时才展开（平台实际不会给，但别在这里崩）。
  if (/[eE]/.test(body)) {
    var expanded = Number(raw)
    if (!Number.isFinite(expanded)) return null
    negative = expanded < 0
    body = String(Math.abs(expanded))
  }
  var dot = body.indexOf('.')
  var integerPart = dot === -1 ? body : body.slice(0, dot)
  var fractionPart = dot === -1 ? '' : body.slice(dot + 1)
  // `.5` / `5.` 这类写法先补齐成 `0.5` / `5.0`；整数部分的前导 0 去掉（`007.5` → `7.5`）。
  if (integerPart.length === 0) integerPart = '0'
  integerPart = integerPart.replace(/^0+(?=\d)/, '')
  if (fractionPart.length === 0) fractionPart = '0'
  return { negative: negative, integer: integerPart, fraction: fractionPart }
}

/** 参与加减的最大小数位（Decimal 的 8 位对账目足够，再长也没人会看）。 */
var AMOUNT_SCALE_MAX = 8

/**
 * 把两个金额对齐到同一标度，转成 BigInt（值为 `真实值 × 10^scale`）。
 *
 * @param left - 第一个十进制字符串。
 * @param right - 第二个十进制字符串。
 * @returns 两个 BigInt 与它们共用的标度；任一非法回 `null`。
 */
function scaledPair(
  left: string,
  right: string,
): { left: bigint; right: bigint; scale: number } | null {
  var a = parseAmount(left)
  var b = parseAmount(right)
  if (a === null || b === null) return null
  var scale = Math.min(AMOUNT_SCALE_MAX, Math.max(a.fraction.length, b.fraction.length))
  var toScaled = function (value: ParsedAmount): bigint {
    var digits = (value.fraction + '0'.repeat(scale)).slice(0, scale)
    var magnitude = BigInt(value.integer + digits)
    return value.negative ? -magnitude : magnitude
  }
  return { left: toScaled(a), right: toScaled(b), scale: scale }
}

/** 标度整数 → 十进制字符串（`-30` + scale 2 → `-0.30`）。 */
function formatScaled(value: bigint, scale: number): string {
  var negative = value < BigInt(0)
  var digits = (negative ? -value : value).toString()
  if (scale === 0) return (negative ? '-' : '') + digits
  var padded = digits.padStart(scale + 1, '0')
  var head = padded.slice(0, padded.length - scale)
  var tail = padded.slice(padded.length - scale)
  return (negative ? '-' : '') + head + '.' + tail
}

/**
 * 两个金额相减（`left - right`），精确到小数末位。
 *
 * 为什么不用 `Number`：余额是账目数字，`8.6 - 8.3` 在 double 里是 `0.2999999999999998`，
 * 两次刷新差一分钱就能看出误差。这里按十进制对齐后做整数减法，结果直接可用于展示。
 *
 * @param left - 被减数（十进制字符串）。
 * @param right - 减数。
 * @returns 差值（十进制字符串，可能带 `-`，小数位到 max(两侧位数)）；任一非法回 `null`。
 */
export function subtractAmounts(left: string, right: string): string | null {
  var pair = scaledPair(left, right)
  if (pair === null) return null
  return formatScaled(pair.left - pair.right, pair.scale)
}

/**
 * `amount` 是否严格小于 `limit`（同样走十进制对齐，不走浮点）。
 *
 * @param amount - 待比较的金额。
 * @param limit - 阈值（十进制字符串）。
 * @returns 严格小于为 `true`；任一非法回 `false`（拿不准就不报警）。
 */
export function isBelowAmount(amount: string, limit: string): boolean {
  var pair = scaledPair(amount, limit)
  if (pair === null) return false
  return pair.left < pair.right
}

/**
 * 读取低余额阈值（`dsh-hud.balanceLow`，没有就用默认 10）。
 *
 * 键值是十进制数；解析不出正数就退回默认值 —— 一个写坏了的存储项不该让提醒消失。
 *
 * @param fallback - 默认阈值（`BALANCE_LOW_DEFAULT`）。
 * @returns 阈值字符串（交给 `isBelowAmount`）。
 */
export function lowThresholdOf(fallback: number): string {
  try {
    var raw = globalThis.localStorage ? globalThis.localStorage.getItem(BALANCE_LOW_KEY) : null
    if (typeof raw === 'string' && raw.trim() !== '') {
      var value = Number(raw.trim())
      if (Number.isFinite(value) && value > 0) return String(value)
    }
  } catch (error) {
    // 读不到存储（隐私模式 / 假 DOM）就用默认值，不影响其它任何东西。
  }
  return String(fallback)
}

/**
 * 变化量的展示文本：`+¥0.30` / `-¥0.30`（零值回 `null`，调用方据此不画那一行）。
 *
 * @param amount - `subtractAmounts` 的输出。
 * @param currency - 币种。
 * @returns 带正负号的文本；零值或金额非法回 `null`。
 */
export function formatDelta(amount: string, currency: string): string | null {
  var parsed = parseAmount(amount)
  if (parsed === null) return null
  var abs = parsed.negative ? amount.slice(1) : amount
  var text = formatBalance(abs, currency)
  if (text === null) return null
  // 零值没有"变化"，不画（`-0.00` 这种更不该出现）。
  if (/^0*(\.0*)?$/.test(abs.trim())) return null
  return (parsed.negative ? '-' : '+') + text
}

/**
 * 把一个钱包余额格式化成界面文本。
 *
 * 规则照 DSH 自己的账号卡片（`formatBalance`，`dsh-client-ui-settings-account`）：
 * 0 → `¥0.00`；不足一分 → `<¥0.01`；负的小额进位成 `-¥0.01`；其余**向零截断**到两位并加千分位。
 * 两边读同一份余额就该显示同一个数，所以这里刻意复刻而不是"差不多"。
 *
 * 认不出的币种没有符号可用：直接给 `123.45 XYZ` 这样带代码的文本，不做符号猜测。
 *
 * @param amount - 平台给的十进制字符串（可能带负号；非法输入按 0 处理）。
 * @param currency - `CNY` / `USD`，其它值按代码显示。
 * @returns 可展示文本；`amount` 非法时回 `null`（宁可不画，也不画错数字）。
 */
export function formatBalance(amount: string, currency: string): string | null {
  var parsed = parseAmount(amount)
  if (parsed === null) return null
  var symbol = currencySymbol(currency)
  var suffix = symbol === null ? ' ' + currency : ''
  var negative = parsed.negative
  var integerPart = parsed.integer
  var fractionPart = parsed.fraction

  var sign = negative ? '-' : ''
  /** 按币种符号规则拼一段文本。 */
  var render = function (value: string): string {
    return symbol === null ? sign + value + suffix : sign + symbol + value
  }
  var integerIsZero = /^0*$/.test(integerPart)
  var fractionHasDigit = /[1-9]/.test(fractionPart)

  // 零：`¥0.00`。判零只看有没有非 0 数字，避免 `0.000` 这类写法被当成"不足一分"。
  if (integerIsZero && !fractionHasDigit) return render('0.00')

  // 不足一分（且不是零）：正数说 `<¥0.01`，负数没有"小于"的直觉，直接进位成 `-¥0.01`。
  // `0.0` 后面全 0、前两位小数是 00，就等价于 0 < |v| < 0.01。
  if (integerIsZero && (fractionPart + '00').slice(0, 2) === '00') {
    if (negative) return render('0.01')
    return '<' + render('0.01')
  }

  // 常规：整数部分千分位，小数**向零截断**到两位（不足补 0）。
  var cents = (fractionPart + '00').slice(0, 2)
  return render(groupDigits(integerPart) + '.' + cents)
}
