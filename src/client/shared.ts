/**
 * 浏览器半的**内核**：常量、存储助手、诊断探针，以及几个到处都用得着的纯函数。
 *
 * 它是最底层 —— store 各片、hook、组件都从这里 import，它自己不 import 任何本包模块，
 * 于是依赖方向永远是"由外向内"，不会绕成环。
 */

import React from 'react'

export var h = React.createElement

/* --------------------------------------------------------------- 领域形状 */

/**
 * 下面这些 interface 是**浏览器半读到的线路形状**（宿主半 `src/host/types.ts` 的镜像）。
 *
 * 为什么集中放在这里：store 各片、hook、组件都从 shared import；类型只写一份，
 * 字段漂移才能一眼看见。宿主半与浏览器半各自打包，不能互相 import 类型，所以
 * 这是刻意的"同形两份"，改线路形状时两边一起改。
 */

/** 改动类型的八个键（与宿主半 `counts` 的键一致）。 */
export type HudCountKey =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'typeChanged'
  | 'untracked'
  | 'conflicted'

/** git status 的分组计数（porcelain-v2 的八类）。 */
export interface HudStatusCounts {
  modified: number
  added: number
  deleted: number
  renamed: number
  copied: number
  typeChanged: number
  untracked: number
  conflicted: number
}

/** 改动清单里的一条：porcelain-v2 的两个字母 + 路径。 */
export interface HudChange {
  /** 展示用字母：优先 index 侧，index 为 `.` 时取 worktree 侧。 */
  status: string
  /** index 侧字母（未跟踪/未合并的记录是 `.` / `!`）。 */
  index?: string
  /** worktree 侧字母。 */
  worktree?: string
  /** 展示用路径；重命名/复制是 `旧路径 → 新路径`。 */
  path: string
  /** 新路径那一侧（git 命令当 pathspec 用）。 */
  file: string
  /** 重命名/复制的原路径；普通改动没有这个字段。 */
  origFile?: string | null
}

/** 文件 → “这一版”签名（`size.mtimeMs`，或 `missing`）。 */
export type ReviewSignatures = Record<string, string>

/** `status` 端点的结果（工作区概览 + 改动清单）。 */
export interface HudStatus {
  /** 仓库根；不在仓库里时为 null。 */
  repo: string | null
  /** 当前分支（detached 时为短 oid）；空仓库里也为 null。 */
  branch: string | null
  detached: boolean
  /** 短 oid（7 位）；还没有提交时为 null。 */
  oid: string | null
  upstream: string | null
  ahead: number
  behind: number
  dirty: boolean
  counts: HudStatusCounts
  changes: HudChange[]
  truncated: boolean
  /** 「审阅进度」要的“这一版”签名；只在客户端明确要的时候才附上。 */
  review?: ReviewSignatures
}

/** diff 行的种类：增 / 删 / 上下文 / hunk 头 / git 自己的文件头。 */
export type DiffRowKind = 'add' | 'del' | 'ctx' | 'hunk' | 'meta'

/** 差异里的一行。 */
export interface DiffRow {
  kind: DiffRowKind
  text: string
  /** 旧侧行号；新增行与 hunk/meta 为 null。 */
  oldLine: number | null
  /** 新侧行号；删除行与 hunk/meta 为 null。 */
  newLine: number | null
}

/** 一侧 diff 的解析结果。 */
export interface DiffSide {
  rows: DiffRow[]
  additions: number
  deletions: number
  hunks: number
  binary: boolean
  truncated: boolean
}

/** 工作区差异端点载荷：一个改动文件的两侧（工作区 / 已暂存）。 */
export interface WorktreeDiffPayload {
  repo: string | null
  path: string
  origPath: string | null
  /** 工作区里的未跟踪文件（`--no-index` 那条分支）。 */
  untracked: boolean
  worktree: DiffSide
  index: DiffSide
}

/** 右栏差异的 `data`：工作区差异是两侧，提交差异是单侧。 */
export type DiffPayload = WorktreeDiffPayload | DiffSide

/** 差异的两种来源。 */
export type DiffSource = 'worktree' | 'commit'

/** 差异的三种“侧”。 */
export type DiffSideName = 'worktree' | 'index' | 'commit'

/** 右侧差异视图的状态（`state.diff`）。 */
export interface HudDiffState {
  source: DiffSource
  phase: string
  sha?: string
  shortSha?: string
  subject?: string
  path: string
  file: string
  origPath: string | null
  data: DiffPayload | null
  side: DiffSideName
  wrap?: boolean
  zoom?: number | null
  hunk?: number
  collapsed?: number[]
  errorCode?: string | null
}

/** 一侧图片可以预览：内容以 base64 附带，尺寸认出来才给。 */
export interface ImagePreview {
  kind: 'image'
  mime: string
  bytes: number
  width: number | null
  height: number | null
  base64: string
}

/** 一侧图片超过单侧上限：只报字节数，不塞内容。 */
export interface ImageTooLarge {
  kind: 'too-large'
  bytes: number
  limit: number
}

/** 一侧内容认不出是图片。 */
export interface ImageNotImage {
  kind: 'not-image'
  bytes: number
}

/** 一侧不存在（新文件还没有索引副本 / 文件被删掉）。 */
export interface ImageMissing {
  kind: 'missing'
}

/** 一侧内容的可预览状态。 */
export type ImageSide = ImagePreview | ImageTooLarge | ImageNotImage | ImageMissing

/** `image` 端点载荷：一个二进制（图片）改动的两侧字节与像素尺寸。 */
export interface ImagePayload {
  repo: string | null
  /** 提交明细时才有（工作区/索引视图没有）。 */
  shortSha?: string
  path: string
  origPath: string | null
  side: string
  sha: string | null
  before: ImageSide
  after: ImageSide
}

/** `image` 请求：缓存键按这几个字段算。 */
export interface ImageRequest {
  cwd: string
  path: string
  origPath?: string | null
  side?: string | null
  sha?: string | null
}

/** 「本会话确定改过」的一个文件。 */
export interface SessionChange {
  path: string
  file: string
  writes: number
  edits: number
  firstAt: number
  lastAt: number
  lastTurn: number | null
  turns: number[]
}

/** 「可能相关」的一个路径（命令旁听来的启发式）。 */
export interface SessionChangeCandidate {
  path: string
  file: string
  hits: number
  firstAt: number
  lastAt: number
  reason: string
  lastTurn: number | null
}

/** 本会话跑过的一条 shell 命令。 */
export interface SessionCommand {
  tool: string
  command: string
  at: number
  turn: number | null
  failed: boolean
  readOnly: boolean
}

/** 「会话归因」这一片 store 的状态（`state.sessionChanges`）。 */
export interface SessionChangesState {
  phase: string
  /** `null` 表示"还没有这份数据"（老宿主 / 还没回来 / 请求失败）。 */
  files: Record<string, SessionChange> | null
  possible: Record<string, SessionChangeCandidate> | null
  commands: SessionCommand[]
  since: number | null
  dropped: number
  possibleDropped: number
  errorCode: string | null
}

/** 「第几轮 → 那一轮的请求预览」（`state.turns`，宿主 `turnOutline` 的归一结果）。 */
export interface TurnsState {
  available: boolean
  prompts: Record<number, string>
  latest: number | null
}

/** 归因与 git 现状核对后的视图（`sessionChangeView()` 的结果）。 */
export interface SessionChangeView {
  /** 本会话改过、且工作区里还有差异。 */
  mine: Record<string, SessionChange>
  /** 命令旁听出来的「可能相关」（只标没被确定认领的）。 */
  possible: Record<string, SessionChangeCandidate>
  turnPrompts: Record<number, string>
  latestTurn: number | null
  latestCount: number
  /** 第几轮 → 那一轮改了几个文件。 */
  byTurn: Record<number, number>
  mineCount: number
  possibleCount: number
  commandCount: number
  writingCommands: number
  commands: SessionCommand[]
  /** 本会话改过、但工作区里已经没有差异的文件。 */
  gone: string[]
  /** 本会话记录过的文件总数。 */
  tracked: number
  since: number | null
  dropped: number
  possibleDropped: number
  /** 工作区里有差异、但不是本会话动的条数。 */
  others: number
}

/** 审阅标记：这一版审过了（fresh）/ 之后又变了（stale）。 */
export type ReviewMark = 'fresh' | 'stale'

/** 「审阅进度」视图（`reviewView()` 的结果）。 */
export interface ReviewView {
  marks: Record<string, ReviewMark>
  known: Record<string, true>
  done: number
  total: number
  staleCount: number
}

/** 存档里一个"已审"标记。 */
export interface ReviewedEntry {
  signature: string
  at: number
}

/** 存档：`工作区 + NUL + 文件 → { signature, at }`。 */
export type ReviewedMap = Record<string, ReviewedEntry>

/** 面板位置。 */
export interface PanelPos {
  left: number
  top: number
}

/** 右栏里打开着哪几栏（`panelLayout()` 的结果）。 */
export interface PanelLayout {
  diff: boolean
  commit: boolean
}

/** 本地 UI 记忆（`dsh-hud.ui.v1`）：只记界面开关与布局，不混业务数据。 */
export interface UiPrefs {
  onlySession?: boolean
  onlyLatest?: boolean
  open?: boolean
  pos?: PanelPos | null
  wrap?: boolean
  zoom?: number | null
  diffWidth?: number
  commitWidth?: number
}

/**
 * 悬停气泡里的一行。
 *
 * 三种写法：
 *   - `{ text, tone }`   —— 一整行一种颜色（如「更新于 …」用次要色）；
 *   - `{ label, value }` —— 左边标签次要色、右边数字主色（余额那几行）；
 *   - `{ text }`         —— 默认主色。
 *
 * 之所以要结构而不是一段纯文本：用户要求「数字亮、标签灰」，
 * 而一整段字符串在 DOM 里只有一个文本节点，一种颜色，做不到。
 */
export interface TipSegment {
  text: string
  /** 只给"读数"上色；不给就是普通文字色。 */
  tone?: TipLine['tone']
}

export interface TipLine {
  text?: string
  label?: string
  value?: string
  /**
   * 行内分段（比 `label + value` 更细）：一句白话里只把数字挑出来高亮。
   *
   * 为什么需要它：会话计时、工具统计这些气泡是**一整句话**
   *（「…其中模型 3h 24m、工具 50m · 62 轮 / 1469 步」），
   * 排版不能动，但其中的数字要突出。用分段就能只染色、不改句式和换行。
   */
  segments?: TipSegment[]
  /**
   * 这一行里"被强调的部分"用什么颜色。
   *
   * - `primary`（默认）：主文字色，深浅主题自动反色；
   * - `muted`：次要信息（抬头、更新时间、变化量）；
   * - `success`：**还剩多少**（余额）—— 绿色是"可用额度"的通行读法；
   * - `warn`：**已经花掉多少**（两个已用）—— 琥珀只是"这是消耗"的分类色，
   *   不是在报警；
   * - `accent`：中性数字（API 请求次数）—— 用产品自己的品牌蓝，深浅主题各有一套取值。
   *
   * 为什么不全用同一种彩色：四个数里三个是钱、一个是次数，颜色分开才一眼分得清
   * 哪行是"还剩"、哪行是"花掉"、哪行根本不是金额。
   */
  tone?: 'primary' | 'muted' | 'success' | 'warn' | 'accent'
}

/** 气泡内容：单段文本（老写法）或逐行结构。 */
export type TipContent = string | TipLine[]

/**
 * 一行在"拼平"（日志/断言/兼容 `state.text`）时长的样子。
 *
 * 标签与数值之间补一个空格：屏幕上它们之间是 CSS 的 `margin-left`，拼平之后没这个
 * 间距，`余额$742.23` 读起来是错的，日志里也不好 grep。
 */
export function tipLineText(line: TipLine): string {
  if (Array.isArray(line.segments)) {
    return line.segments
      .map(function (segment) {
        return segment.text
      })
      .join('')
  }
  if (typeof line.text === 'string') return line.text
  var label = line.label ?? ''
  var value = line.value ?? ''
  if (label !== '' && value !== '') return label + ' ' + value
  return label + value
}

/**
 * 把一句白话按给定的"读数"切成段：命中的部分高亮，其余保持普通文字。
 *
 * 做法是**字面量匹配**而不是猜数字：调用方知道这句话里哪些是读数
 *（`3h 24m`、`1469`、`$742.23`），交给我们按出现顺序切段。
 * 不去用 `\d+` 自动扫 —— 那样会把「2026-10-20 12:41」这类时间戳也染上，
 * 满屏都是颜色，等于没有重点。
 *
 * @param text - 整句白话。
 * @param readings - 要突出的字面量（按长度从长到短匹配，避免短串先吃长串）。
 * @param tone - 用什么颜色。
 * @returns 分段数组（没有命中就退化成一段）。
 */
export function emphasize(
  text: string,
  readings: (string | null | undefined)[],
  tone: TipLine['tone'] = 'accent',
): TipSegment[] {
  var hits = readings
    .filter(function (item) {
      return typeof item === 'string' && item !== ''
    })
    .map(function (item) {
      return item as string
    })
    .sort(function (left, right) {
      return right.length - left.length
    })
  if (hits.length === 0 || text === '') return [{ text: text }]
  var segments: TipSegment[] = []
  var plain = ''
  var index = 0
  while (index < text.length) {
    var matched: string | null = null
    for (var at = 0; at < hits.length; at += 1) {
      if (text.startsWith(hits[at], index)) {
        matched = hits[at]
        break
      }
    }
    if (matched === null) {
      plain += text[index]
      index += 1
      continue
    }
    if (plain !== '') {
      segments.push({ text: plain })
      plain = ''
    }
    segments.push({ text: matched, tone: tone })
    index += matched.length
  }
  if (plain !== '') segments.push({ text: plain })
  return segments.length === 0 ? [{ text: text }] : segments
}

/**
 * 把气泡内容归一成「逐行结构 + 拼平文本」。
 *
 * 两处都用它：真 store 的 tip 片（渲染用 `lines`，`text` 留给日志与断言），
 * 以及测试 harness 的假 `showTip`（让老用例继续按字符串断言，不必全部重写）。
 */
export function normalizeTipContent(content: TipContent): { lines: TipLine[]; text: string } {
  var lines: TipLine[] =
    typeof content === 'string'
      ? [{ text: content }]
      : Array.isArray(content)
        ? content.filter(function (line) {
            return line !== null && typeof line === 'object'
          })
        : []
  return {
    lines: lines,
    text: lines
      .map(function (line) {
        return tipLineText(line)
      })
      .join('\n'),
  }
}

/** 悬停气泡快照（`state.tip`）。 */
export interface TipState {
  key: string
  text: string
  /** 逐行结构（渲染用）；`text` 是它的拼平版本。 */
  lines: TipLine[]
  rect: { left: number; top: number; right: number }
}

/** 最近提交里的一行（`log` 端点载荷里的一条）。 */
export interface HudLogEntry {
  sha: string
  author: string
  date: string
  committedAt: number | null
  refs: string[]
  subject: string
}

/** 提交元信息（`commit` 端点载荷里的 `commit`）。 */
export interface HudCommitSummary {
  sha: string
  shortSha: string
  subject: string
  author: string
  date: string
  committedAt: number | null
  refs: string[]
  merge: boolean
}

/** 提交明细里的一个改动文件（`git diff --name-status -z` 的一条）。 */
export interface HudCommitFile {
  status: string
  path: string
  file: string
  origFile?: string | null
}

/** 提交明细（右栏视图）的状态（`state.commit`）。 */
export interface HudCommitState {
  phase: string
  sha: string
  shortSha: string
  subject: string
  author: string
  date: string
  committedAt: number | null
  refs: string[]
  merge: boolean
  files: HudCommitFile[]
  truncated: boolean
  errorCode: string | null
}

/** 标签列表里的一条（`tags` 端点里的一条）。 */
export interface HudTag {
  name: string
  sha: string
  annotated: boolean
  date: string
  committedAt: number | null
  subject: string
}

/** 正在跑的工具（胶囊显示实时秒数用：秒数由客户端本地计时）。 */
export interface HudToolActive {
  callId: string | null
  name: string
  summary: string | null
  startedAt: number
}

/** 最近一次工具调用。 */
export interface HudToolRecent {
  name: string
  summary: string | null
  ok: boolean
  at: number
  ms: number | null
}

/** 某个工具跑了多少次、最近一次成功没有。 */
export interface HudToolCount {
  name: string
  count: number
  ok: boolean | null
}

/** 某个技能用了几次、最近一次成功没有。 */
export interface HudToolSkill {
  name: string
  count: number
  ok: boolean | null
}

/** 「工具活动」这一片 store 的状态（`state.tools`）。 */
export interface ToolsState {
  phase: string
  active: HudToolActive | null
  recent: HudToolRecent[]
  counts: HudToolCount[]
  skills: HudToolSkill[]
  skillsDropped: number
  total: number
  updatedAt: number | null
}

/** `session-time` 端点载荷：创建时刻 + 累计墙钟与轮次/步数。 */
export interface HudSessionTime {
  available: boolean
  sessionId?: string | null
  createdAt?: number | null
  turns?: number | null
  steps?: number | null
  llmMs?: number | null
  toolMs?: number | null
  now?: number
}

/** 会话时长快照（`state.sessionTime`）：`sessionId` 用来判断"这份数还是不是这个会话的"。 */
export interface SessionTimeState {
  sessionId: string | null
  value: HudSessionTime | null
}

/** `prompt-history` 端点载荷。 */
export interface HudPromptHistory {
  available: boolean
  sessionId?: string | null
  prompts: string[]
}

/** prompt 历史快照（`state.promptHistory`）。 */
export interface PromptHistoryState {
  sessionId: string | null
  value: HudPromptHistory | null
}

/** 一个钱包的余额（充值钱包与赠送钱包同形）。`balance` 是平台给的十进制字符串，保精度不转数字。 */
export interface HudBalanceWallet {
  currency: string
  balance: string
}

/**
 * 账号余额快照（`state.balance`）。
 *
 * 这是**账号级**读数，与会话无关：换会话、换工作区都不该让它消失。
 * 值来自 DSH 自己的 `remote.account.getBalance`，本插件只读、不落盘
 * （余额是会变的账目数字，留一个过期值比没有更糟）。
 */
export interface HudBalance {
  /** 充值钱包；一个可展示的钱包都没有时整份快照为 `null`，胶囊不画。 */
  wallets: HudBalanceWallet[]
  /** 赠送钱包（已过滤掉 0 余额的）。 */
  bonus: HudBalanceWallet[]
  /** 这份数字是什么时候取到的（本地时刻）。 */
  at: number
  /** 最近一次读取失败：`at` 仍停在上一次成功的时刻，界面据此标"可能过期"。 */
  failed: boolean
  /** 平台用量页（累计消耗 / 本月消耗这些账目只在那里；右键胶囊会打开它）。 */
  usageUrl?: string | null
  /** 平台充值页。 */
  topUpUrl?: string | null
  /**
   * 上一次成功读到的钱包与时刻，用来算"较上次刷新变化了多少"。
   *
   * 只在内存里：跨重启比较没有意义（中间发生过什么不知道），所以不落盘。
   * 失败的那一轮不动它 —— 它永远指向**最近一次成功**的读数。
   */
  prev?: { wallets: HudBalanceWallet[]; at: number } | null
}

/** 侧栏每条会话行要的摘要（`session-statuses` 里的一行）。 */
export interface HudSessionOverviewRow {
  sessionId: string
  cwd: string | null
  /** 确定改过的文件数（归因记录）。 */
  mine: number
  /** “可能相关”的历史候选路径数。 */
  possible: number
  /** “可能相关”里此刻仍然有差异的个数。 */
  possibleNow: number
  repo: boolean
  error: string | null
  /** 该工作区的 git 摘要还没算出来。 */
  pending?: boolean
  branch?: string | null
  detached?: boolean
  dirty?: boolean
  ahead?: number
  behind?: number
  counts?: HudStatusCounts
}

/** 「侧栏摘要」这一片 store 的状态（`state.rows`）。 */
export interface RowsState {
  phase: string
  byId: Record<string, HudSessionOverviewRow>
  unavailable: boolean
  truncated: boolean
  updatedAt: number | null
}

/** 紧凑计数简写（胶囊与侧栏 chip 共用）。 */
export interface CountShorthand {
  key: HudCountKey
  mark: string
  value: number
}

/** 侧栏一枚状态 chip 的"事实摘要"（`rowSummaryOf()` 的结果）。 */
export interface RowSummary {
  row: HudSessionOverviewRow
  mine: number
  possibleNow: number
  possible: number
  shorthands: CountShorthand[]
  changed: number
  dirty: boolean
  hasContent: boolean
}

/** 浏览器半共享 store 的快照。 */
export interface HudState {
  phase: string
  sessionId: string | null
  cwd: string | null
  status: HudStatus | null
  errorCode: string | null
  updatedAt: number | null
  panelOpen: boolean
  pos: PanelPos | null
  /** 胶囊所在 dock 行的视口顶部坐标。 */
  anchorTop: number | null
  diff: HudDiffState | null
  commit: HudCommitState | null
  /** 键盘高亮的那个文件（清单里的 `file`）。 */
  cursor: string | null
  commits: HudLogEntry[] | null
  commitsOid: string | null
  tags: HudTag[] | null
  tagsAt: number
  tagsTruncated: boolean
  diffWidth: number
  commitWidth: number
  sessionChanges: SessionChangesState
  onlySession: boolean
  onlyLatest: boolean
  /** 这一版每个改动文件的签名（`file → signature`）。 */
  review: ReviewSignatures
  tools: ToolsState
  sessionTime: SessionTimeState
  promptHistory: PromptHistoryState
  /** 账号余额（账号级；还没读到、或这个账号没有可展示的钱包时是 `null`）。 */
  balance: HudBalance | null
  /** 当前会话模型来源的账本（见 `HudProviderLedger`）。 */
  provider: HudProviderLedger
  /** 后台凭据设置面板（点胶囊时按需打开）。 */
  tokenPanel: TokenPanelState
  tip: TipState | null
  rows: RowsState
  reviewed: ReviewedMap
  turns: TurnsState
}

/**
 * 共享 store 的对外接口（hook / 组件只依赖它，不依赖 `createStore` 的实现）。
 *
 * 只列浏览器半真正用到的那些；方法参数用线路形状（`HudChange` / `ImageRequest` …），
 * 这样 hook 里传参也一起被检查到。
 */
export interface HudStore {
  getSnapshot(): HudState
  subscribe(listener: () => void): () => void
  bindSession(sessionId: string | null | undefined, cwd: string | null | undefined): void
  refresh(): Promise<unknown>
  openPanel(open: boolean): void
  togglePanel(): void
  movePanel(pos: PanelPos): void
  commitPanel(pos: PanelPos): void
  resetPanel(): void
  setAnchorTop(top: number | null): void
  setDiffWidth(width: number): void
  setCommitWidth(width: number): void
  persistLayout(): void
  openDiff(change: HudChange): Promise<unknown>
  loadImagePair(request: ImageRequest): Promise<unknown>
  cachedImagePair(request: ImageRequest): unknown
  loadSessionChanges(): Promise<unknown>
  loadSessionTime(sessionId: string): Promise<unknown>
  loadPromptHistory(sessionId: string): Promise<unknown>
  /** 取账号余额（`force` 跳过 TTL；胶囊点击就用它）。拿不到账号能力时安静地回 `null`。 */
  loadBalance(force?: boolean): Promise<HudBalance | null>
  /** 取"当前会话模型来源"的余额（中转站/官方 Key 那一侧；`force` 跳过 TTL）。 */
  /** 换会话时把账本清成 unknown（别让新会话顶着上一个会话的读数）。 */
  resetForSession(): void
  loadProviderBalance(force?: boolean): Promise<HudProviderLedger | null>
  openTokenPanel(provider: string, ref: string | null): void
  closeTokenPanel(): void
  saveProviderToken(token: string): Promise<boolean>
  showTip(
    key: string,
    text: string,
    rect: { left: number; top: number; right: number } | null,
  ): void
  hideTip(key?: string): void
  tipHandlers(key: string, contentOf: () => TipContent): Record<string, unknown>
  closeDiff(): void
  closeDetail(): void
  setDiffSide(side: string): void
  toggleDiffWrap(): void
  setZoom(value: number | null): void
  openCommit(commit: HudLogEntry | HudCommitSummary): Promise<unknown>
  openCommitDiff(file: HudCommitFile): Promise<unknown>
  toggleCommit(commit: HudLogEntry | HudCommitSummary): Promise<unknown> | void
  closeCommit(): void
  stepFile(delta: number, open: boolean): HudChange | null
  openCursor(): HudChange | null
  stepHunk(delta: number): void
  toggleHunk(index: number | undefined): void
  toggleOnlySession(): void
  toggleOnlyLatest(): void
  refreshRows(): Promise<unknown>
  loadTools(): Promise<unknown>
  toggleReviewed(file: string): void
  clearReviewed(): void
}

/** 取词函数（框架把 `t` 交给座位；取不到会回落成键本身）。 */
export type Translate = (key: string, params?: Record<string, string>) => string

/** 诊断探针（`createProbe()` 的返回）。 */
export interface Probe {
  log(reason: string, detail?: Record<string, unknown>): void
}

/* --------------------------------------------------------------- 常量 */

export var CHANNEL = '/dsh-hud-rpc'
export var NS = 'dshHud'

export var UI_KEY = 'dsh-hud.ui.v1'
/**
 * 插件自诊断的留存键（最近 24 行）：会话归因每一步的事实都往这里留一行。
 *
 * 为什么落在这里：客户端插件的异常与"服务找不到"都不会进宿主日志，界面出问题时往往只有
 * 有/没有两种观察；把每一步的事实留一行在 localStorage，用户不用开 DevTools 也能把它捞出来，
 * 排查完可以随手删掉。
 */
export var DEBUG_KEY = 'dsh-hud.debug'

/** 轮询间隔：面板与胶囊共用，页面不可见时跳过。 */
export var POLL_MS = 8000
/**
 * 侧栏行内 chip 的轮询节奏：比面板慢一档。
 *
 * 那些 chip 是"扫一眼"的信息（哪个会话脏了），不值得跟面板一样频繁；宿主侧还按目录
 * 缓存 + 去重，多会话共用一个目录只跑一次 git。
 */
// 侧栏标记删掉之后，这份数据只剩"悬停卡片 / ⋯ 菜单"两处**按需展示**在用 ——
// 所以从 12s 放宽到 30s：按下不表的东西没必要那么勤地去问 git。
export var ROWS_POLL_MS = 30000
/**
 * 工具活动的节拍。比面板那 8s 密得多：宿主这一端是**内存读**（不碰 git、不跑子进程），
 * 密一点才能让"正在跑什么"真的看到；代价用"内容没变就不 set"抵掉。
 */
export var TOOLS_POLL_MS = 3000
/** 胶囊上最多铺几个技能名（其余收成 `+k`，完整清单在悬停里）。 */
export var SKILLS_SHOWN = 2
/**
 * 账号余额的轮询节拍：**比别的读数都慢**。
 *
 * 这一枚走的不是本地 git，而是宿主替我们去平台查账（一次真实网络请求），
 * 而且余额是按分钟变的，密了纯属浪费。页面隐藏时照例跳过，点击胶囊可强制刷新。
 */
export var BALANCE_POLL_MS = 300000
/** 同一次请求的 TTL：轮询与点击之间不重复打平台（失败时用更短的间隔重试，见切片）。 */
export var BALANCE_TTL_MS = 240000
/** 失败后的重问间隔：账目查不到多半是网络/登录态，隔一小会儿再试就够。 */
export var BALANCE_RETRY_MS = 30000
/* ------------------------------------------------- 提供方余额（按模型来源） */

/**
 * 当前会话**当前模型所属提供方**的余额。
 *
 * 与 `HudBalance` 的区别不只是字段：`HudBalance` 是 DeepSeek 平台账号那一个账本，
 * 这个是"这次会话真正在用的那个提供方"的账本 —— 可能是官方 API Key，也可能是用户自己
 * 填的第三方中转站。两个账本的钱不能混着显示（那正是"胶囊数字看着像 bug"的来源）。
 */
export interface HudProviderBalance {
  /** 提供方 id（`ur` / `muyuan` / `deepseek-official` …）。 */
  provider: string
  kind: 'official' | 'relay'
  /** 站点自己的记账币种；不做汇率换算。 */
  currency: string | null
  /** 剩余额度；站点把额度写成"无限"占位值时是 `null`（算不出来，别编）。 */
  remaining: string | null
  /**
   * **整个账号**的累计已用（站点 `/api/user/self` 的 `used_quota`）。
   *
   * 与 `usedKey` 并存而不是二选一：站点上两个数能同时拿到、也能差出一截
   * （实测 ur：账号 $526.66 / 本 Key $479.44）。
   */
  usedAccount: string | null
  /** **这枚 API Key** 的累计已用（站点 `/dashboard/billing/usage` 的 `total_usage`）。 */
  usedKey: string | null
  /** 账号累计请求数（只有账号那一路给得出）。 */
  requests?: number | null
  /** 站点把额度写成占位值 → 剩余不可信，只能展示已用。 */
  placeholderLimit: boolean
  wallets: HudBalanceWallet[]
  bonus: HudBalanceWallet[]
  /** 取数时刻（本地毫秒）。 */
  at: number
}

/**
 * 这一枚胶囊该看哪个账本。
 *
 * - `account`：会话用的就是 DeepSeek 平台账号 → 走原来的 `HudBalance` 那一路；
 * - `provider`：会话用的是别的提供方，且读到了它的余额；
 * - `unavailable`：知道是哪个提供方，但读不到（不画胶囊，与"读不到就不画"同一条规矩）；
 * - `unknown`：会话/投影还没就绪（首帧常态），先按账号那一路画，别让胶囊闪没。
 */
/** 「后台凭据设置面板」的状态：开没开、给哪个提供方、存到了哪一步。 */
export interface TokenPanelState {
  open: boolean
  /** 面板正在为哪个提供方配令牌。 */
  provider: string | null
  /** 那个提供方的凭据引用名（宿主给的；面板只拿它显示"存到哪了"）。 */
  ref: string | null
  /** 这个提供方到底能不能配（宿主不认识它时面板不弹）。 */
  supported: boolean
  saving: boolean
  /** 上一次保存失败的原因键（`balance.tokenError.*`）。 */
  error: string | null
  /** 保存成功的时刻（好让面板自己收起）。 */
}

/**
 * 「这个提供方的后台凭据配了没」。
 *
 * 只用来决定点胶囊干什么：没配 → 弹设置面板；配了 → 刷新一次读数。
 * 令牌本身永远不出宿主，这里也就没有它的位置。
 */
export interface HudProviderToken {
  ref: string
  configured: boolean
}

export interface HudProviderLedger {
  mode: 'account' | 'provider' | 'unavailable' | 'unknown'
  balance: HudProviderBalance | null
  /**
   * 知道是哪个提供方（但可能读不到它的余额）时的 id。
   *
   * 为什么要留着：`unavailable` 时胶囊要画 `ur —`，而不是干脆消失 ——
   * 消失会让人分不清"这个站没有余额接口"和"插件坏了"（这正是用户报过的那一幕）。
   */
  provider?: string | null
  /** 读不到的原因（`unsupported` / `no-key` / `network` …）；只用于悬停里那句话。 */
  reason?: string | null
  /** 这个提供方的后台凭据状态（决定点胶囊是"弹面板"还是"刷新"）。 */
  token?: HudProviderToken | null
}

/**
 * 低余额提醒的阈值（默认 10）。
 *
 * 为什么是常量而不是设置项：DSH 的客户端插件条目拿不到 Cordis config
 * （`client-modules` 建条目时只传 `{ name: id }`），这里也就没有可读的配置面；
 * 而为了一个数字去加一整页设置并不划算。需要改的人用 `BALANCE_LOW_KEY` 那个
 * localStorage 键覆盖（README 里写了）。
 */
export var BALANCE_LOW_DEFAULT = 10
/** 「当前会话模型来源」余额的轮询节拍：真实请求由 store 的 TTL 兜着，这里只决定问的频率。 */
export var PROVIDER_POLL_MS = 30000
/**
 * 「还没问出来」时的重问间隔。
 *
 * 重启/刚开会话的那一下，宿主往往还没读到模型选择投影 —— 第一次问会落空。
 * 用 30 秒节拍兜的话胶囊要空半分钟（用户报的就是这个）；1 秒问一次，
 * 正常情况一两秒内就补上了。真的出错时也不会打风暴：store 的失败退避是
 * 1s→2s→4s→…→30s，这里的轮询只是"看一眼"，多半被 TTL 直接挡回。
 */
export var PROVIDER_RETRY_TICK_MS = 1000

/** 覆盖低余额阈值的 localStorage 键（值是十进制数，比如 `50`）。 */
export var BALANCE_LOW_KEY = 'dsh-hud.balanceLow'
/** 面板默认宽度与“停靠在输入框上方”的锚点高度。 */
export var PANEL_WIDTH = 380
export var COMPOSER_OFFSET = 168

export var VIEWPORT_MARGIN = 8

/** 超过这个位移才算拖动，避免把头部上的普通点击当成拖动。 */
export var DRAG_THRESHOLD_PX = 3
/** 面板与胶囊所在 dock 行之间的间距。 */
export var PANEL_DOCK_GAP = 8
/**
 * 中间那一栏（打开提交明细时：这次提交的元信息 + 改动清单）的宽度。
 * 它夹在左栏与差异栏之间，是固定的——右边缘那个抓握仍只调整差异栏。
 */
export var COMMIT_LIST_WIDTH = 240
/** 提交明细栏的最小宽度（它装的是文件路径，不能太窄；默认 240 只是起点，可拖）。 */
export var COMMIT_MIN_WIDTH = 180

/** diff 模式的面板：更宽，且用固定高度（避免 bottom 锚定下"内容变高就跳位"）。 */
/** 右栏（差异）默认宽度、下限，以及面板右边缘抓握的宽度。 */
export var DIFF_DEFAULT_WIDTH = 470
export var DIFF_MIN_WIDTH = 240

export var RESIZE_GRIP_WIDTH = 6

export var DIFF_PANEL_HEIGHT_VH = 0.72

/** 改动类型的固定展示顺序，与宿主半的 counts 键一致。 */
export var COUNT_ORDER: HudCountKey[] = [
  'modified',
  'added',
  'deleted',
  'renamed',
  'copied',
  'typeChanged',
  'untracked',
  'conflicted',
]

/** 每类改动对应的主题色令牌（都带回退色，暗亮色主题都能看）。 */
export var COUNT_COLOR: Record<HudCountKey, string> = {
  modified: 'var(--dsw-alias-state-warn-primary, #d9a63c)',
  added: 'var(--dsw-alias-state-success-primary, #3fb950)',
  deleted: 'var(--dsw-alias-state-error-primary, #f06a6a)',
  // 与 codex-hud 的 `statEntries` 一一对应：R→cyan、C→brightBlue（我们的品牌蓝就是这个位）、
  // T→magenta、?→灰。M/A/D/! 本来就一致（yellow/green/red/critical）。
  // `?` 用 `label-secondary` 而不是 `label-dimmed`：后者是**反相的表面色**（浅 #e1e5ee、深 #43454a），
  // 当文字压在面板底色上只有 1.26:1 / 1.64:1 —— 看不见（issue：未跟踪计数读不出来）。
  // secondary 仍是中性灰、比彩色状态弱一档，但浅 5.8:1 / 深 10.4:1 都读得清。
  renamed: 'var(--dsh-hud-cyan, #22d3ee)',
  copied: 'var(--dsw-alias-brand-primary, #4b8bf5)',
  typeChanged: 'var(--dsh-hud-magenta, #d946ef)',
  untracked: 'var(--dsw-alias-label-secondary, #8a8f98)',
  conflicted: 'var(--dsw-alias-state-error-primary, #f06a6a)',
}

/**
 * 每个改动类型在胶囊里的简写符，沿用 codex-hud / 上游 statusline 的 git 标记约定：
 * M 已修改、A 已暂存新增、D 已删除、R 重命名、C 复制、T 类型改变、? 未跟踪、! 冲突。
 */
export var COUNT_MARK: Record<HudCountKey, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  typeChanged: 'T',
  untracked: '?',
  conflicted: '!',
}

/** 胶囊里分支名的显示上限；超出就中段省略，别把简写符挤出可见区。 */
export var PILL_BRANCH_MAX = 28
/** 胶囊里工作区名最多几个字符（它在分支前面，不该抢分支的位置）。 */
export var PILL_WORKSPACE_MAX = 20

/**
 * 差异行的底色：半透明，压在面板表面色之上，因此亮/暗主题都可读
 * （文本与行号仍走主题令牌）。
 */
export var DIFF_ADD_BG = 'rgba(63,185,80,0.12)'
export var DIFF_DEL_BG = 'rgba(240,106,106,0.13)'

export var DIFF_GUTTER_COLOR = 'var(--dsw-alias-label-secondary, #8a8f98)'

/** prompt 历史的条数上限（与宿主半的 `PROMPT_HISTORY_MAX` 同一个数）。 */
export var PROMPT_HISTORY_MAX = 100

/**
 * 时长格式化：**与 codex-hud 同一套口径**。
 *
 * 不足一分钟给 `<1m`；然后按 `Xd Yh Zm` 只列非零项（`45m` / `2h 14m` / `3d 2h`）。
 * 取的是 floor —— 计时器宁可比真实少一点，也不要"明明刚过 1 分钟就写 2m"。
 */
export function formatDuration(ms: unknown) {
  var safe = typeof ms === 'number' && isFinite(ms) ? Math.max(0, ms) : 0
  if (safe < 60000) return '<1m'
  var minutes = Math.floor(safe / 60000)
  var days = Math.floor(minutes / 1440)
  var hours = Math.floor((minutes % 1440) / 60)
  var rest = minutes % 60
  var parts = []
  if (days > 0) parts.push(String(days) + 'd')
  if (hours > 0) parts.push(String(hours) + 'h')
  if (rest > 0) parts.push(String(rest) + 'm')
  return parts.join(' ')
}

/** 固定缩放档位：与内置文档预览的菜单一致（25% / 50% / 100% / 150% / 200%）。 */
export var ZOOM_STEPS = [0.25, 0.5, 1, 1.5, 2]

/** 落盘/读回的缩放值：只认档位里的数，其他一律当"适应宽度"。 */
export function readZoom(ui: UiPrefs | null | undefined): number | null {
  return ui && typeof ui.zoom === 'number' && ZOOM_STEPS.indexOf(ui.zoom) >= 0 ? ui.zoom : null
}

/**
 * 走一档缩放。
 *
 * `null`（适应宽度）出发：`＋` 从 100% 开始、`−` 从 50% 开始 —— 和"适应宽度"的直觉一致，
 * 不用先经过 25% 才知道按了有反应。
 */
export function stepZoom(current: number | null | undefined, direction: number): number {
  if (current === null || current === undefined) return direction > 0 ? 1 : 0.5
  var index = ZOOM_STEPS.indexOf(current)
  if (index < 0) return direction > 0 ? 1 : 0.5
  var next = index + (direction > 0 ? 1 : -1)
  if (next < 0 || next >= ZOOM_STEPS.length) return current
  return ZOOM_STEPS[next]
}

export function readUi(): UiPrefs {
  try {
    var raw = window.localStorage.getItem(UI_KEY)
    if (!raw) return {}
    // localStorage 是不可信输入（旧版本写的、手改过的都有可能）：先当 unknown，收窄后再当 UiPrefs。
    var parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as UiPrefs) : {}
  } catch (error) {
    return {}
  }
}

export function writeUi(next: UiPrefs): void {
  try {
    window.localStorage.setItem(UI_KEY, JSON.stringify(next))
  } catch (error) {
    // 隐私模式等写入失败只影响“记住位置/展开状态”，不影响功能。
  }
}

/** 「审阅进度」的存档键：按"工作区 + 文件"记下审过的那一版签名。 */
export var REVIEWED_KEY = 'dsh-hud.reviewed.v1'
/**
 * 存档键的分隔符：NUL。
 *
 * 用 `String.fromCharCode(0)` 而不是 `"\u0000"` 字面量：路径里不可能有 NUL，而转义写法
 * 在源码与测试里极易被多转一层（写成字面量反斜杠），排查起来极其费劲。
 */
export var REVIEW_KEY_SEP = String.fromCharCode(0)

/** 存档键：`工作区 NUL 文件`（同一个文件名在别的仓库里是另一码事）。 */
export function reviewKeyOf(cwd: string | null | undefined, file: string): string {
  return String(cwd || '') + REVIEW_KEY_SEP + file
}

/** 存档上限：超出丢最久没动的那些（不然用久了这个键会一直长）。 */
export var REVIEWED_MAX = 200

/** 读取"我审过哪些版本"：坏数据一律当空表（存档不该把插件带崩）。 */
export function readReviewed(): ReviewedMap {
  try {
    var raw = window.localStorage.getItem(REVIEWED_KEY)
    if (!raw) return {}
    // 与 readUi 同理：localStorage 里的 JSON 是不可信输入，逐步收窄而不是直接当目标类型用。
    var parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    var source = parsed as Record<string, unknown>
    var out: ReviewedMap = {}
    for (var key in source) {
      var item = source[key]
      if (!Object.prototype.hasOwnProperty.call(source, key) || !item || typeof item !== 'object')
        continue
      // 同一系统边界：条目也是不可信 JSON，先收成表再逐个字段判断。
      var entry = item as Record<string, unknown>
      if (typeof entry.signature !== 'string') continue
      out[key] = { signature: entry.signature, at: typeof entry.at === 'number' ? entry.at : 0 }
    }
    return out
  } catch (error) {
    return {}
  }
}

/** 写回"我审过哪些版本"：超上限就按最后触达时间丢最旧的。 */
export function writeReviewed(next: ReviewedMap): ReviewedMap {
  try {
    var keys = Object.keys(next)
    if (keys.length > REVIEWED_MAX) {
      keys.sort(function (left: string, right: string) {
        return (next[left].at || 0) - (next[right].at || 0)
      })
      var trimmed: ReviewedMap = {}
      var keep = keys.slice(keys.length - REVIEWED_MAX)
      for (var index = 0; index < keep.length; index += 1) trimmed[keep[index]] = next[keep[index]]
      next = trimmed
    }
    window.localStorage.setItem(REVIEWED_KEY, JSON.stringify(next))
    return next
  } catch (error) {
    // 写不进去只意味着"这次不记住"，不影响功能。
    return next
  }
}

/* --------------------------------------------------------------- store */

/**
 * 插件自诊断的现场记录：只写控制台，不碰界面、不留全局。
 *
 * 客户端插件的异常和"服务找不到"都不会进宿主日志，所以控制台是排查时唯一的通道。
 * 同一个 reason + 同样的事实只报一次（轮询每 8s 会重试），一行 JSON 便于复制。
 */
export function createProbe(): Probe {
  var seen: Record<string, true> = {}
  return {
    /** 记一行现场：一行进控制台，同时留一份在 localStorage（都按 reason+事实去重）。 */
    log: function (reason: string, detail?: Record<string, unknown>) {
      var facts = detail === undefined ? {} : detail
      var line = reason + ' ' + JSON.stringify(facts)
      if (seen[line] === true) return
      seen[line] = true
      console.warn('[dsh-hud] ' + line)
      try {
        var history = window.localStorage.getItem(DEBUG_KEY)
        var parsed: unknown = history === null ? [] : JSON.parse(history)
        var list: Array<{ at: number; line: string }> = Array.isArray(parsed) ? parsed : []
        list.push({ at: Date.now(), line: line })
        window.localStorage.setItem(DEBUG_KEY, JSON.stringify(list.slice(-24)))
      } catch (error) {
        // 隐私模式等写不进去只影响这行诊断，不影响功能。
      }
    },
  }
}

/**
 * 面板左栏那份工作区清单 —— **渲染与键盘导航共用这一份**。
 *
 * 过滤必须发生在一个地方：键盘选中用的是行下标，如果渲染时过滤了而导航没过滤，
 * ↑/↓ 就会落在看不见的行上。
 */
export function visibleChangeRows(state: HudState): HudChange[] {
  var changes = state.status && Array.isArray(state.status.changes) ? state.status.changes : []
  var onlySession = state.onlySession === true
  var onlyLatest = state.onlyLatest === true
  if (!onlySession && !onlyLatest) return changes
  var view = sessionChangeView(state)
  // 归因还没到手时这些开关不该悄悄把清单清空：那时候它们还没有意义。
  if (view === null) return changes
  // 别名：`view` 被闭包捕获后 TS 不再保留"非 null"的收窄，这里先取出两份表。
  var mineOf = view.mine
  var possibleOf = view.possible
  var rows = changes
  if (onlySession) {
    // "可能相关"（命令旁听）也算本会话碰过的：过滤器的承诺是"只看本会话动过的"。
    rows = rows.filter(function (change) {
      return mineOf[change.file] !== undefined || possibleOf[change.file] !== undefined
    })
  }
  var latestTurn = view.latestTurn
  if (onlyLatest && latestTurn !== null) {
    // "这一轮改了什么"：只留最近一轮确定动过的（"可能相关"没有可靠的回合归属，不收）。
    rows = rows.filter(function (change) {
      var record = mineOf[change.file]
      return record !== undefined && record.lastTurn === latestTurn
    })
  }
  return rows
}

/** 进程内唯一一份探针：两个座位共用，去重也一起算。 */
export var probe: Probe = createProbe()

/**
 * 两个 sha 说的是不是同一次提交。
 *
 * 最近提交那份清单里是 **短 sha**，而提交明细里是宿主半解析回来的**完整 sha**，
 * 直接 `===` 永远配不上；按前缀对一下（git 自己认 rev 也是这个语义）。
 */
export function sameCommit(left: unknown, right: unknown): boolean {
  if (typeof left !== 'string' || typeof right !== 'string' || left === '' || right === '')
    return false
  return left === right || right.indexOf(left) === 0 || left.indexOf(right) === 0
}

/**
 * 差异视图：两侧页签（宿主半一次把两侧都取回来了，切页签不再发请求）、
 * 自动换行、复制差异。全部只读——它只是把 git 的输出画出来。
 */
/* ------------------------------------------------ 图片预览（二进制改动） */

/** 图片请求的缓存键：把请求的每个字段都带上，免得两侧共用一个键。 */
export function imagePairKey(request: ImageRequest): string {
  return [
    request.cwd || '',
    request.path || '',
    request.origPath || '',
    request.side || '',
    request.sha || '',
  ].join('\u0000')
}

/** 字节数：十进制 KB/MB，和文件管理器里看到的一致。 */
export function formatBytes(bytes: unknown): string {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return '?'
  if (bytes < 1000) return String(bytes) + ' B'
  if (bytes < 1000 * 1000) return (bytes / 1000).toFixed(1) + ' KB'
  return (bytes / 1000 / 1000).toFixed(2) + ' MB'
}

/** 图片类文件的扩展名。这里只做粗筛 —— 真正"是不是图"由宿主按文件头判断。 */
export var IMAGE_FILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif']

/* ------------------------------------------------------- 悬浮面板 */

/**
 * 当前右栏里有哪几栏 —— 样式、夹位置、渲染三处必须用同一份判断，抽出来免得漂移。
 *
 * @returns `{ diff, commit }`：`diff` = 有工作区/提交差异，`commit` = 打开着提交明细。
 */
export function panelLayout(state: HudState): PanelLayout {
  return {
    diff: state.diff !== null && typeof state.diff === 'object',
    commit: state.commit !== null && typeof state.commit === 'object',
  }
}

/**
 * 面板宽度：单栏紧凑；打开右栏就按"左栏 + [提交明细栏] + 抓握 + 差异栏"算。
 *
 * 右栏（差异）宽度由面板右边缘的抓握拖动调整并记忆；中间那栏是固定宽度。
 * 视口不够宽时只把弹性的一栏（差异）压小——左栏与提交明细栏是有下限的固定栏。
 *
 * @param layout - `panelLayout()` 的结果。
 * @param diffWidth - 差异栏的目标宽度。
 */
export function panelWidthFor(
  layout: PanelLayout,
  diffWidth?: number | null,
  commitWidth?: number | null,
): number {
  var hasCommit = layout.commit === true
  var hasDiff = layout.diff === true
  if (!hasCommit && !hasDiff) return PANEL_WIDTH
  // **逐栏钳到自己的下限**：只对总宽加一个 floor 是不够的 —— 存档里写着 40px 时，
  // 总宽仍然会按 40 算（floor 只保证"不小于最小总和"，但差额会被算到别的栏头上）。
  var middle = hasCommit
    ? Math.max(COMMIT_MIN_WIDTH, typeof commitWidth === 'number' ? commitWidth : COMMIT_LIST_WIDTH)
    : 0
  var right = hasDiff
    ? Math.max(DIFF_MIN_WIDTH, typeof diffWidth === 'number' ? diffWidth : DIFF_DEFAULT_WIDTH)
    : 0
  // 两条抓握：面板右边缘那条（调差异栏；只有提交栏时调提交栏）—— 它是绝对定位、**不占宽**，
  // 但宽度里要预留 6px 让位，否则它压在内容上；栏间那条是真实的一格，占宽。
  var outerGrip = RESIZE_GRIP_WIDTH
  var innerGrip = hasCommit && hasDiff ? RESIZE_GRIP_WIDTH : 0
  var available = window.innerWidth - 2 * VIEWPORT_MARGIN
  return Math.min(PANEL_WIDTH + middle + innerGrip + right + outerGrip, available)
}

/** 把位置夹回视口内，避免拖到屏幕外再也点不到。 */
export function clampPos(left: number, top: number, width?: number | null): PanelPos {
  var panelWidth = typeof width === 'number' ? width : PANEL_WIDTH
  var maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - panelWidth - VIEWPORT_MARGIN)
  var maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - 48)
  return {
    left: Math.min(Math.max(VIEWPORT_MARGIN, left), maxLeft),
    top: Math.min(Math.max(VIEWPORT_MARGIN, top), maxTop),
  }
}

/**
 * 量出胶囊所在 dock 行的视口顶部坐标。
 *
 * 这里用**自己的** `data-dsh-hud` 标记，不碰产品的 DOM 选择器。dsh-git 把
 * "输入框堆叠高 168px"写成了常量并注明那只是一次测量；直接量真实位置可以同时
 * 适配 hero（空白会话，输入框居中）与 active 两种布局。
 *
 * @returns 视口坐标的顶部像素，量不到时返回 null。
 */
/**
 * 面板当前该有多宽：从 store **现读**（模式切换会改宽度，别用可能过期的渲染闭包）。
 *
 * 原来它是组件里的 `panelWidthOf(store)`，被"视口夹取"和"拖动"两处用；提成顶层
 * 纯函数后两边共用同一份判断。
 */
export function panelWidthOf(store: HudStore): number {
  var snapshot = store.getSnapshot()
  return panelWidthFor(panelLayout(snapshot), snapshot.diffWidth, snapshot.commitWidth)
}

/** 自有样式表的稳定 tag id：`data-plugin-css` 用它做幂等插入。 */
export var CSS_TAG_ID = 'dsh-hud/styles.css'

/* --------------------------------------------------- 会话归因（对账） */

/**
 * 把"本会话改过哪些文件"（宿主半按 fs 事件记的）与 git 现状对起来。
 *
 * - `mine`：本会话改过、且工作区里还有差异（`status.changes` 里能找到）
 * - `gone`：本会话改过、但工作区里已经没有差异（被改回去了 / 被别的会话或你自己覆盖了）
 * - `others`：工作区里有差异、但不是本会话动的
 *
 * 名字能直接对上：宿主报的是 cwd 之内的 posix 相对路径，`status.changes[].file` 也是。
 * 还拿不到归因（老宿主 / 请求还没回来）时返回 `null` —— 界面这时**不打任何标记**，
 * 而不是把所有改动都标成"别人的"。
 */
export function sessionChangeView(state: HudState): SessionChangeView | null {
  // 快照可能来自老宿主/旧存档：这里保留"缺字段就当没有"的老行为，不让界面崩。
  var slice: SessionChangesState | null | undefined = state.sessionChanges
  if (slice === null || slice === undefined) return null
  var files = slice.files
  if (files === null || files === undefined) return null
  var possibleAll: Record<string, SessionChangeCandidate> | null =
    slice.possible === undefined ? null : slice.possible
  var changes = state.status && Array.isArray(state.status.changes) ? state.status.changes : []
  var mine: Record<string, SessionChange> = {}
  var possible: Record<string, SessionChangeCandidate> = {}
  var gone: string[] = []
  var index
  var change
  // 先认"确定改过"的：一档优先于一档，同一个文件不会被标两次。
  for (index = 0; index < changes.length; index += 1) {
    change = changes[index]
    if (Object.prototype.hasOwnProperty.call(files, change.file))
      mine[change.file] = files[change.file]
  }
  // 再看"可能相关"：只标没有被确定认领的那些（命令旁听来的，置信度低一档）。
  for (index = 0; index < changes.length; index += 1) {
    change = changes[index]
    if (mine[change.file] !== undefined) continue
    if (possibleAll !== null && Object.prototype.hasOwnProperty.call(possibleAll, change.file)) {
      possible[change.file] = possibleAll[change.file]
    }
  }
  for (var file in files) {
    if (Object.prototype.hasOwnProperty.call(files, file) && mine[file] === undefined)
      gone.push(file)
  }
  gone.sort()
  var commands: SessionCommand[] = Array.isArray(slice.commands) ? slice.commands : []
  var turns =
    state.turns !== undefined && state.turns !== null && state.turns.available === true
      ? state.turns
      : null
  var latestTurn = turns === null ? null : turns.latest
  var byTurn: Record<number, number> = {}
  var latestCount = 0
  for (var mineFile in mine) {
    if (!Object.prototype.hasOwnProperty.call(mine, mineFile)) continue
    var turn = typeof mine[mineFile].lastTurn === 'number' ? mine[mineFile].lastTurn : null
    if (turn === null) continue
    byTurn[turn] = (byTurn[turn] === undefined ? 0 : byTurn[turn]) + 1
    if (latestTurn !== null && turn === latestTurn) latestCount += 1
  }
  return {
    mine: mine,
    possible: possible,
    /** 第几轮 → prompt 预览（来自 `turnOutline` 投影；没有就是空表）。 */
    turnPrompts: turns === null ? {} : turns.prompts,
    latestTurn: latestTurn,
    latestCount: latestCount,
    byTurn: byTurn,
    mineCount: Object.keys(mine).length,
    possibleCount: Object.keys(possible).length,
    /** 跑过的命令里"看着会写文件"的条数（含失败的，界面自己再分）。 */
    commandCount: commands.length,
    writingCommands: commands.filter(function (item) {
      return item && item.readOnly !== true
    }).length,
    commands: commands,
    gone: gone,
    /** 本会话记录过的文件总数（宿主那边的集合大小）。 */
    tracked: Object.keys(files).length,
    since: slice.since === undefined ? null : slice.since,
    dropped: slice.dropped === undefined ? 0 : slice.dropped,
    possibleDropped: slice.possibleDropped === undefined ? 0 : slice.possibleDropped,
    others: changes.length - Object.keys(mine).length,
  }
}

export function reviewView(state: HudState): ReviewView {
  var changes = state.status && Array.isArray(state.status.changes) ? state.status.changes : []
  var signatures: ReviewSignatures =
    state.review && typeof state.review === 'object' ? state.review : {}
  var reviewed = state.reviewed && typeof state.reviewed === 'object' ? state.reviewed : {}
  var prefix = reviewKeyOf(state.cwd, '')
  var marks: Record<string, ReviewMark> = {}
  var known: Record<string, true> = {}
  var done = 0
  var total = 0
  var staleCount = 0
  for (var index = 0; index < changes.length; index += 1) {
    var file = changes[index].file
    var signature = typeof signatures[file] === 'string' ? signatures[file] : null
    if (signature === null) continue
    known[file] = true
    total += 1
    var mark = reviewed[prefix + file]
    if (mark === undefined) continue
    if (mark.signature === signature) {
      marks[file] = 'fresh'
      done += 1
    } else {
      marks[file] = 'stale'
      staleCount += 1
    }
  }
  return { marks: marks, known: known, done: done, total: total, staleCount: staleCount }
}
