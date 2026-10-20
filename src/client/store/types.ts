/**
 * store 内部共用的类型：RPC 信封、ctx 注入面、各 slice 的返回形状。
 *
 * 只放浏览器半内部的东西；跨模块（store ↔ 组件）的领域类型在 `../shared.js`。
 */

import type {
  DiffSide,
  HudChange,
  HudCommitFile,
  HudCommitSummary,
  HudLogEntry,
  HudPromptHistory,
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

/** 动态注入交回来的子作用域（只声明 store 用到的那一项）。 */
export interface InjectedScope {
  sessions: SessionsService
}

/** store 用到的客户端 ctx 子集（effect / inject 是 Cordis 的两件套）。 */
export interface StoreContext {
  connection: HudConnection
  effect(callback: () => unknown, label?: string): unknown
  inject(names: string[], callback: (scope: InjectedScope) => (() => void) | void): unknown
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
  showTip(key: string, text: string, rect: TipAnchor | null): void
  tipHandlers(key: string, textOf: () => string): TipHandlers
}

/** 「会话信息」片。 */
export interface SessionInfoSlice {
  loadPromptHistory(sessionId: string): Promise<HudPromptHistory>
  loadSessionTime(sessionId: string): Promise<HudSessionTime>
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
