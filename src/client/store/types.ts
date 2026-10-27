/**
 * store 内部共用的类型：RPC 信封、ctx 注入面、各 slice 的返回形状。
 *
 * 只放浏览器半内部的东西；跨模块（store ↔ 组件）的领域类型在 `../shared.js`。
 */

import type { TipContent } from '../shared.js'
import type {
  DiffSide,
  HudBalance,
  HudBalanceWallet,
  HudChange,
  HudCommitFile,
  HudCommitSummary,
  HudLogEntry,
  HudPromptHistory,
  HudProviderLedger,
  HudSessionOverviewRow,
  HudSessionTime,
  HudState,
  HudStatus,
  HudTag,
  HudToolActive,
  HudToolCount,
  HudToolRecent,
  HudToolSkill,
  ImagePayload,
  ImageRequest,
  SessionChange,
  SessionChangeCandidate,
  SessionCommand,
} from '../shared.js'

/** store 的 `set`：与实现里的 Object.assign 一致（浅合并）。 */
export type StoreSet = (patch: Partial<HudState>) => void

/** 读当前快照（各片一律现读，不缓存 state 引用）。 */
export type GetState = () => HudState

/* ------------------------------------------------------------ RPC 信封 */

/** 失败时宿主给的 `error.details.code`（store 只把它转成界面文案）。 */
export interface RpcError {
  details?: { code?: string | null } | null
}

/**
 * RPC 的返回信封：成功带 `value`、失败带 `error`，都走同一条 resolved Promise。
 *
 * `value` 的线路形状（T）由调用点声明 —— 这是**系统边界**：宿主与客户端各自打包、
 * 无法共享类型；收到之后代码里仍会逐字段判断（`Array.isArray` / `typeof`）。
 */
export interface RpcResponse<T> {
  ok?: boolean
  value?: T | null
  error?: RpcError | null
}

/** `ctx.connection.rpc.call` 的最小签名。 */
export interface RpcCall {
  <T>(channel: string, method: string, payload: { args: unknown }): Promise<RpcResponse<T>>
}

/** store 用到的客户端连接服务子集。 */
export interface HudConnection {
  rpc: { call: RpcCall }
}

/** `binding()` 交回来的会话。 */
export interface TurnBinding {
  session?: TurnSession | null
}

/** 会话上的投影集合（只用到 `faceOf`）。 */
export interface TurnSession {
  projections?: TurnProjections | null
}

export interface TurnProjections {
  faceOf?: (name: string) => TurnFace | null | undefined
}

/** `turnOutline` 的 face（只用到 getSnapshot / subscribe）。 */
export interface TurnFace {
  getSnapshot?: () => unknown
  subscribe?: (listener: () => void) => (() => void) | null
}

/** `sessions` 客户端服务（动态注入的软依赖；只用 `binding`）。 */
export interface SessionsService {
  binding(sessionId: string): TurnBinding | null | undefined
}

/**
 * 账号接口的调用元数据（`@deepseek-ai/dsh-deepseek-account` 的 `AccountClientMetadata`）。
 *
 * 宿主拿它推导平台请求头（`x-client-version` / `x-client-locale` / 时区偏移），
 * **一项都不能缺**：`version` 为空时 DSH 自己的 `accountClientMetadata()` 会直接抛，
 * 所以我们从启动清单里取真实版本，取不到就不发请求。
 */
export interface AccountClientMetadata {
  version: string
  locale: string
  timezoneOffsetSeconds: number
}

/** 一个钱包（平台原样给的十进制字符串）。 */
export interface AccountWallet {
  currency: string
  balance: string
}

/** `account.getBalance` 的结果；`null` 表示当前没有登录态。 */
export type AccountBalancePayload =
  | null
  | { status: 'failed' }
  | { status: 'ready'; value: AccountWallet[]; bonusWallets: AccountWallet[] }

/**
 * 账号的"安全投影"（`AccountView` 的子集）：本插件只用它的两个链接。
 *
 * 余额接口只给钱包，**不给任何消费数字** —— 累计消耗、本月消耗都在平台用量页上，
 * 所以这一枚胶囊的价值一半在于能一步跳到那一页。
 */
export interface AccountViewPayload {
  status?: string
  links?: { usageUrl?: string | null; topUpUrl?: string | null } | null
  attempt?: unknown
}

/** 客户端 `remote.account` 命名空间里本插件用到的那两个方法。 */
export interface AccountRemoteService {
  getBalance(client: AccountClientMetadata): Promise<RpcResponse<AccountBalancePayload>>
  /** 直连方法，不带调用元数据（宿主那边的状态是本地读，不碰网络）。 */
  getState?(): Promise<RpcResponse<AccountViewPayload>>
}

/** 客户端 `remote` 命名空间（只声明 `account` 子服务）。 */
export interface RemoteService {
  account?: AccountRemoteService
}

/**
 * 客户端 `modules` 服务：启动清单里带着**宿主这一版的发布身份**。
 *
 * 账号接口要用它当 `x-client-version`，而外部插件的产物里没有 DSH 在打包时内联的版本常量
 * （内置插件那半边是 `"0.2.1-rc.3"` 这样的字面量），所以只能从启动清单里现取。
 */
export interface ModulesService {
  manifest?: { release?: { version?: string; commit?: string } } | null
}

/** 动态注入交回来的子作用域（只声明 store 用到的那几项）。 */
export interface InjectedScope {
  sessions: SessionsService
  /** 账号命名空间（软依赖：没有这个服务时余额胶囊整个不出现）。 */
  remote?: RemoteService
  /** 启动清单（软依赖：拿不到版本就不发账号请求）。 */
  modules?: ModulesService
}

/** store 用到的客户端 ctx 子集（effect / inject 是 Cordis 的两件套）。 */
export interface StoreContext {
  connection: HudConnection
  effect(callback: () => unknown, label?: string): unknown
  inject(names: string[], callback: (scope: InjectedScope) => (() => void) | void): unknown
  /** 当前界面语言（账号请求要带；老宿主/假 ctx 可能没有）。 */
  locale?: object | null
}

/* -------------------------------------------------------- RPC 载荷形状 */

/** `status` 端点载荷。 */
export type StatusPayload = HudStatus

/** `session-changes` 端点载荷（字段都可能缺：老宿主/失败时按"没有数据"处理）。 */
export interface SessionChangesPayload {
  repo?: string
  sessionId?: string | null
  since?: number | null
  files?: SessionChange[]
  dropped?: number
  possible?: SessionChangeCandidate[]
  possibleDropped?: number
  commands?: SessionCommand[]
  cwdMismatch?: boolean
}

/** `commit` 端点载荷。 */
export interface CommitPayload {
  commit?: HudCommitSummary | null
  files?: HudCommitFile[]
  truncated?: boolean
}

/** `log` 端点载荷。 */
export interface LogPayload {
  commits?: HudLogEntry[]
}

/** `tags` 端点载荷。 */
export interface TagsPayload {
  tags?: HudTag[]
  truncated?: boolean
}

/** `commit-diff` 端点载荷：单侧差异 + 这次提交的文件信息。 */
export interface CommitDiffPayload extends DiffSide {
  repo?: string | null
  sha?: string
  shortSha?: string
  file?: string
  path?: string
  origPath?: string | null
}

/** `session-statuses` 端点载荷（侧栏摘要）。 */
export interface SessionStatusesPayload {
  sessions?: HudSessionOverviewRow[]
  unavailable?: boolean
  truncated?: boolean
  worktrees?: number
}

/** `session-tools` 端点载荷。 */
export interface SessionToolsPayload {
  active?: HudToolActive | null
  recent?: HudToolRecent[]
  counts?: HudToolCount[]
  skills?: HudToolSkill[]
  skillsDropped?: number
  total?: number
}

/* -------------------------------------------------------- 图片缓存条目 */

/** 一侧图片已取回。 */
export interface ImageReadyView {
  phase: 'ready'
  value: ImagePayload
}

/** 取回失败（`code` 是宿主给的机器码，界面再本地化）。 */
export interface ImageErrorView {
  phase: 'error'
  code: string | null | undefined
}

/** 图片缓存条目。 */
export type ImageView = ImageReadyView | ImageErrorView

/* ------------------------------------------------------------ 各片工厂 */

/** 「图片预览」片。 */
export interface ImageSlice {
  cachedImagePair(request: ImageRequest): ImageView | null
  loadImagePair(request: ImageRequest): Promise<ImageView>
}

/** 悬停气泡锚点（视口坐标）。 */
export interface TipAnchor {
  left: number
  top: number
  right: number
}

/** 气泡的指针接线。 */
export type TipHandlers = {
  onPointerEnter: (event: { currentTarget?: unknown }) => void
  onPointerLeave: () => void
  onPointerDown: () => void
}

/** 「悬停提示」片。 */
export interface TipSlice {
  hideTip(key?: string): void
  showTip(key: string, content: TipContent, rect: TipAnchor | null): void
  tipHandlers(key: string, contentOf: () => TipContent): TipHandlers
}

/** 「会话信息」片。 */
export interface SessionInfoSlice {
  loadPromptHistory(sessionId: string): Promise<HudPromptHistory>
  loadSessionTime(sessionId: string): Promise<HudSessionTime>
}

/** 「账号余额」片。 */
export interface AccountSlice {
  loadBalance(force?: boolean): Promise<HudBalance | null>
}

/** `provider-balance` 端点里"这个提供方的账本就是平台账号"的那一种答复。 */
export interface ProviderAccountPayload {
  available: true
  account: true
  token?: ProviderTokenStatePayload | null
}

/**
 * 「这个提供方的后台凭据配了没」——宿主只说这两个字段。
 *
 * 令牌本身永远不出宿主：要它去取数的只有宿主自己。
 */
export interface ProviderTokenStatePayload {
  ref: string
  configured: boolean
}

/** `provider-balance` 端点读到余额时的答复。 */
export interface ProviderReadyPayload {
  available: true
  account?: false
  token?: ProviderTokenStatePayload | null
  balance: {
    provider: string
    kind: string
    currency: string | null
    remaining: string | null
    usedAccount: string | null
    usedKey: string | null
    requests?: number | null
    placeholderLimit: boolean
    wallets: AccountWallet[]
    bonus: AccountWallet[]
    at: number
  }
}

/** `provider-balance` 端点读不到时的答复（`reason` 用来诊断，不直接显示给用户）。 */
export interface ProviderUnavailablePayload {
  available: false
  provider: string | null
  kind: string | null
  reason: string
  message: string | null
  token?: ProviderTokenStatePayload | null
}

/** 三种答复的并集。 */
export type ProviderBalancePayload =
  ProviderAccountPayload | ProviderReadyPayload | ProviderUnavailablePayload

/** 「后台凭据设置面板」的状态：开没开、给哪个提供方、存到了哪一步。 */
export interface TokenPanelState {
  open: boolean
  /** 面板正在为哪个提供方配令牌。 */
  provider: string | null
  /** 那个提供方的凭据引用名（宿主给的，客户端只用来显示"存到哪了"）。 */
  ref: string | null
  /** 这个提供方到底能不能配（宿主不支持时面板不弹）。 */
  supported: boolean
  saving: boolean
  /** 上一次保存失败的原因键（`token.error.*`）。 */
  error: string | null
  /** 保存成功的时间戳（好让面板自动收起）。 */
}

/** 「提供方余额」片。 */
export interface ProviderSlice {
  /** 换会话时把账本清成 unknown（别让新会话顶着上一个会话的读数）。 */
  resetForSession(): void
  loadProviderBalance(force?: boolean): Promise<HudProviderLedger | null>
  /** 打开后台凭据设置面板（点胶囊时按 token 状态决定要不要调）。 */
  openTokenPanel(provider: string, ref: string | null): void
  closeTokenPanel(): void
  /** 把用户粘贴的令牌交给宿主写进凭据存储。 */
  saveProviderToken(token: string): Promise<boolean>
}

/** 「会话归因与审阅」片的注入 helpers。 */
export interface AttributionHelpers {
  bindTurns(sessionId: string | null | undefined): void
  loadTools(): Promise<unknown>
  refresh(): Promise<unknown>
  refreshRows(): Promise<unknown>
  reviewedKeyOf(file: string): string
}

/** 「会话归因与审阅」片。 */
export interface AttributionSlice {
  bindSession(sessionId: string | null | undefined, cwd: string | null | undefined): void
  clearReviewed(): void
  loadSessionChanges(): Promise<unknown>
  toggleReviewed(file: string): void
}

/** 「提交与标签」片的注入 helpers。 */
export interface CommitsHelpers {
  closeDiff(): void
}

/** 提交的两种输入：最近提交的一行，或完整的提交元信息。 */
export type CommitRef = HudLogEntry | HudCommitSummary

/** 「提交与标签」片。 */
export interface CommitsSlice {
  closeCommit(): void
  loadCommits(cwd: string, oid: string | null): Promise<unknown>
  loadTags(cwd: string): Promise<unknown>
  openCommit(commit: CommitRef): Promise<unknown>
  openCommitDiff(file: HudCommitFile): Promise<unknown>
  toggleCommit(commit: CommitRef): Promise<unknown> | void
}

/** 「差异视图」片的注入 helpers。 */
export interface DiffHelpers {
  hunkCount(): number
  openCommitDiff(file: HudCommitFile): Promise<unknown>
  openListEntry(file: HudChange): Promise<unknown> | void
  persist(): void
  visibleFiles(): HudChange[]
}

/** 「差异视图」片。 */
export interface DiffSlice {
  closeDiff(): void
  openCursor(): HudChange | null
  openDiff(change: HudChange): Promise<unknown>
  setDiffSide(side: string): void
  stepFile(delta: number, open: boolean): HudChange | null
  stepHunk(delta: number): void
  toggleDiffWrap(): void
  toggleHunk(index: number | undefined): void
}

/** 「工具活动 / 侧栏摘要 / 回合信息」片。 */
export interface ToolsSlice {
  bindTurns(sessionId: string | null | undefined): void
  loadTools(): Promise<unknown>
  refreshRows(): Promise<unknown>
  unbindTurns(): void
}
