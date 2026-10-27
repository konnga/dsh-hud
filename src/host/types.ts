/**
 * 宿主半的**线路契约**：这些 interface 描述 `src/host` 各模块之间、以及宿主半与
 * 浏览器半之间传递的数据形状。
 *
 * 为什么集中在一个文件：`parse`（解析）、`git`（调用）、`image`、`readers`、`rpc`
 * 与 `session` 交叉引用同一批形状（status / diff / 提交 / 会话条目），分散定义会让
 * “浏览器半读到的字段”散落在六个文件里；集中之后，字段漂移一眼可见。
 *
 * 本文件**只有类型、没有运行时值**：`import type` 会被 tsc 完全抹掉，产物只是一个
 * 空的 `lib/host/types.js`，不引入任何运行时依赖。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/* ------------------------------------------------------------- git 状态 */

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
  /** 展示用字母：优先 index 侧，index 为 `'.'` 时取 worktree 侧。 */
  status: string
  /** index 侧字母（未跟踪/未合并的记录是 `.` / `!`）。 */
  index: string
  /** worktree 侧字母。 */
  worktree: string
  /** 展示用路径；重命名/复制是 `旧路径 → 新路径`。 */
  path: string
  /** 新路径那一侧（git 命令当 pathspec 用）。 */
  file: string
  /** 重命名/复制的原路径；普通改动没有这个字段。 */
  origFile?: string | null
}

/** `status` 端点 / `readStatus` 的结果（`parseStatus` 与它同形）。 */
export interface HudGitStatus {
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
  review?: HudReviewSignatures
}

/* ------------------------------------------------------------------ diff */

/** diff 行的种类：增 / 删 / 上下文 / hunk 头 / git 自己的文件头。 */
export type HudDiffKind = 'add' | 'del' | 'ctx' | 'hunk' | 'meta'

/** `parseDiff` 产出的一行。 */
export interface HudDiffRow {
  kind: HudDiffKind
  text: string
  /** 旧侧行号；新增行与 hunk/meta 为 null。 */
  oldLine: number | null
  /** 新侧行号；删除行与 hunk/meta 为 null。 */
  newLine: number | null
}

/** 一侧 diff 的解析结果。 */
export interface HudDiff {
  rows: HudDiffRow[]
  additions: number
  deletions: number
  hunks: number
  binary: boolean
  truncated: boolean
}

/** `diff` 端点载荷：一个改动文件的两侧（工作区 / 已暂存）。 */
export interface HudDiffPayload {
  repo: string | null
  path: string
  origPath: string | null
  /** 工作区里的未跟踪文件（`--no-index` 那条分支）。 */
  untracked: boolean
  worktree: HudDiff
  index: HudDiff
}

/** `git diff --name-status -z` 里的一条（形状与 `status.changes` 对齐）。 */
export interface HudNameStatusFile {
  status: string
  path: string
  file: string
  origFile: string | null
}

/** `parseNameStatus` 的结果。 */
export interface HudNameStatus {
  files: HudNameStatusFile[]
  truncated: boolean
}

/* ----------------------------------------------------------------- 图片 */

/** 图片的像素尺寸。 */
export interface HudImageSize {
  width: number
  height: number
}

/** 一侧图片可以预览：内容以 base64 附带，尺寸认出来才给。 */
export interface HudImagePreview {
  kind: 'image'
  mime: string
  bytes: number
  width: number | null
  height: number | null
  base64: string
}

/** 一侧图片超过单侧上限：只报字节数，不塞内容。 */
export interface HudImageTooLarge {
  kind: 'too-large'
  bytes: number
  limit: number
}

/** 一侧内容认不出是图片。 */
export interface HudImageNotImage {
  kind: 'not-image'
  bytes: number
}

/** 一侧不存在（新文件还没有索引副本 / 文件被删掉）。 */
export interface HudImageMissing {
  kind: 'missing'
}

/** 一侧内容的可预览状态。 */
export type HudImageSide = HudImagePreview | HudImageTooLarge | HudImageNotImage | HudImageMissing

/** 图片两侧对应的视图：工作区 / 已暂存 / 某次提交。 */
export type HudImageSideName = 'worktree' | 'index' | 'commit'

/** `image` 端点载荷：一个二进制（图片）改动的两侧字节与像素尺寸。 */
export interface HudImagePair {
  repo: string | null
  /** 提交明细时才有（工作区/索引视图没有）。 */
  shortSha?: string
  path: string
  origPath: string | null
  side: HudImageSideName
  sha: string | null
  before: HudImageSide
  after: HudImageSide
}

/* ------------------------------------------------------------- git 调用 */

/** `runGit` 成功的结果。 */
export interface HudGitSuccess {
  ok: true
  stdout: string
}

/** `runGit` 失败的结果：把失败原因交回调用方，不自造结果。 */
export interface HudGitFailure {
  ok: false
  stdout: string
  stderr: string
  killed: boolean
  code: string | number | null
  message: string
}

export type HudGitResult = HudGitSuccess | HudGitFailure

/** `runGitBytes` 成功的结果（二进制对象，按 buffer 编码）。 */
export interface HudGitBytesSuccess {
  ok: true
  stdout: Buffer
}

/** `runGitBytes` 失败的结果。 */
export interface HudGitBytesFailure {
  ok: false
  stdout: Buffer
  stderr: string
  killed: boolean
  code: string | number | null
  message: string
}

export type HudGitBytesResult = HudGitBytesSuccess | HudGitBytesFailure

/** `resolveCommit` 解析出的仓库与目标提交元信息。 */
export interface HudCommitInfo {
  repo: string | null
  sha: string
  shortSha: string
  subject: string
  author: string
  date: string
  committedAt: number | null
  refs: string[]
  parents: string[]
  /** 比较基准：第一个父提交；根提交为 null（与空树比较）。 */
  base: string | null
}

/** 入参校验通过。 */
export interface HudValidationOk {
  ok: true
  value: string
}

/** 入参校验失败（`code` 会原样进 RPC 的 details）。 */
export interface HudValidationFailure {
  ok: false
  code: string
  message: string
}

export type HudValidation = HudValidationOk | HudValidationFailure

/* --------------------------------------------------------- 提交 / 日志 / 标签 */

/** `readCommit` 载荷里的提交元信息。 */
export interface HudCommitSummary {
  sha: string
  shortSha: string
  subject: string
  author: string
  date: string
  committedAt: number | null
  refs: string[]
  /** 是否合并提交（>1 个父提交）。 */
  merge: boolean
}

/** `commit` 端点载荷：元信息 + 相对第一父提交的改动清单。 */
export interface HudCommitDetail {
  repo: string | null
  commit: HudCommitSummary | null
  files: HudNameStatusFile[]
  truncated: boolean
}

/** `commit-diff` 端点载荷：某次提交里一个文件的单侧 diff。 */
export interface HudCommitDiff extends HudDiff {
  repo: string | null
  sha: string
  /** 提交明细里才有。 */
  shortSha?: string
  file: string
  path: string
  origPath: string | null
}

/** `log` 端点里的一条最近提交。 */
export interface HudLogEntry {
  sha: string
  author: string
  date: string
  committedAt: number | null
  refs: string[]
  subject: string
}

/** `log` 端点载荷。 */
export interface HudLog {
  repo: string | null
  commits: HudLogEntry[]
}

/** `tags` 端点里的一条标签。 */
export interface HudTag {
  name: string
  /** 指向的提交 sha（附注 tag 已剥一层；剥不出来退回对象自身 sha）。 */
  sha: string
  annotated: boolean
  date: string
  committedAt: number | null
  subject: string
}

/** `tags` 端点载荷。 */
export interface HudTags {
  repo: string | null
  tags: HudTag[]
  truncated: boolean
}

/** 文件 → “这一版”签名（`size.mtimeMs`，或 `missing`）。 */
export type HudReviewSignatures = Record<string, string>

/* --------------------------------------------------------- 会话服务（软依赖） */

/** 会话头：宿主半只读 id / cwd / createdAt 三个字段。 */
export interface HudSessionHeader {
  id?: string
  cwd?: string
  createdAt?: number
  [key: string]: unknown
}

/** 宿主 `sessions` 服务枚举出来的一个会话（只用到 `header`）。 */
export interface HudSession {
  header?: HudSessionHeader | null
  [key: string]: unknown
}

/** `modelSelection` 投影里本模块关心的两格（`next` 优先于 `lastUsed`）。 */
export interface HudModelSelection {
  provider: string
  model: string | null
}

/** 宿主 `sessions` 服务的最小接口。 */
export interface HudSessionsService {
  list(): HudSession[]
  /** 按 id 直接取（真实宿主服务有；没有时按 `list()` 扫）。 */
  get?(id: string): unknown
}

/** `sessionStats` 投影折叠出来的累计数字。 */
export interface HudSessionStats {
  turns: number
  steps: number
  llmMs: number
  toolMs: number
}

/** `turnOutline` 投影里的一条 turn（只关心它的 `prompt`）。 */
export interface HudTurnOutlineEntry {
  prompt?: unknown
  [key: string]: unknown
}

/** `turnOutline` 投影的读数。 */
export interface HudTurnOutline {
  turns?: HudTurnOutlineEntry[]
  [key: string]: unknown
}

/** `sessionProjections` 服务的最小接口。 */
export interface HudSessionProjections {
  stateOf(session: unknown, projection: string): unknown
}

/** `ctx.inject([...], scope => …)` 交回来的子作用域。 */
export interface HudInjectedScope {
  sessions: HudSessionsService
  sessionProjections: HudSessionProjections
  [key: string]: unknown
}

/* --------------------------------------------------- 提供方余额（按模型来源） */

/**
 * 一个提供方的余额，读取方式由它自己的协议决定。
 *
 * 三种来源，语义**不许混**（这是这一片最容易糊掉的地方）：
 *   - `account`：DeepSeek 平台账号（`remote.account.getBalance`），只回钱包；
 *   - `official`：DeepSeek 官方 API Key 路线，`GET /user/balance` 回 `balance_infos`；
 *   - `relay`：第三方中转站，走 OpenAI 兼容的 `/dashboard/billing/*` 一对接口
 *     （one-api / new-api 家族），上限是"订阅额度"而不是钱包余额。
 */
export type HudProviderKind = 'account' | 'official' | 'relay'

/** 一个钱包（币种 + 十进制字符串，和账号那一路同形）。 */
export interface HudProviderWallet {
  currency: string
  balance: string
}

/** `provider-balance` 端点载荷。 */
export interface HudProviderBalance {
  /** 提供方 id（会话当前模型所属的那个）。 */
  provider: string
  kind: HudProviderKind
  /** 站点自己的记账币种（**不做汇率换算**）。 */
  currency: string | null
  /** 剩余额度：只有能算出来时才有（中转站上限是占位值时算不出）。 */
  remaining: string | null
  /**
   * **整个账号**的累计已用（`/api/user/self` 的 `used_quota`）。
   *
   * 与 `usedKey` 分开两个字段，不是靠一个 `scope` 标记：站点上这两个数**能同时拿到**
   * （实测：账号 $526.66 / 本 Key $479.44），也**能差出一大截**。
   * 塞进一个字段就必须二选一，那等于主动丢掉一个真实读数。
   */
  usedAccount: string | null
  /**
   * **这枚 API Key** 的累计已用（`/dashboard/billing/usage` 的 `total_usage`）。
   *
   * 站点在这个接口上回的一直是"这枚 Key 的累计"，不是账号总量、也不是本月。
   */
  usedKey: string | null
  /**
   * 账号累计请求数（`/api/user/self` 的 `request_count`）。
   *
   * 只有账号那一路给得出；其余路径没有这个数就是 `null`（不编）。
   */
  requests?: number | null
  /** 站点把上限写成占位值（典型 1e8）→ `remaining` 不可信，只能给"已用"。 */
  placeholderLimit: boolean
  wallets: HudProviderWallet[]
  bonus: HudProviderWallet[]
  /** 取数时刻（本地毫秒）。 */
  at: number
}

/** 没有可展示结果时告诉界面**为什么**（不画胶囊，但可诊断）。 */
export interface HudProviderBalanceFailure {
  provider: string | null
  kind: HudProviderKind | null
  reason: 'no-session' | 'no-provider' | 'unknown-provider' | 'no-key' | 'unsupported' | 'network'
  /** 供排查的短消息（不含任何密钥）。 */
  message: string | null
}

/** 提供方取数所需的两个事实（从设置里读出来，**不落盘、不外传**）。 */
export interface HudProviderFacts {
  provider: string
  kind: 'official' | 'relay'
  baseURL: string
  /** 凭据引用名（`<前缀>_API_KEY` 这种），值由凭据服务解析。 */
  apiKeyEnv: string
  /**
   * 后台（dashboard）凭据的引用名（`SITE_API_KEY` → `SITE_ACCESS_TOKEN`）。
   *
   * 为什么需要：new-api 把**账号余额**放在挂了 `UserAuth()` 的 `/api/user/self` 里，
   * `sk-` API Key 走的是另一套 `TokenAuth`，读不到（只能读用量）。
   * 配一枚后台凭据才拿得到"还剩多少"。
   *
   * 两种都能用，都放在 `Authorization: Bearer` 里：
   *   - **PAT**（站点「访问令牌」，需 `profile:read` scope）——长期有效，首选；
   *   - 老版本没有 PAT 时用浏览器 localStorage 里的登录令牌 —— 会过期。
   */
  accessTokenEnv?: string | null
  /**
   * `New-Api-User` 头的值来自哪枚凭据（`SITE_USER_ID`）。
   *
   * 只有老版本 / 部分 fork 才校验这个头；new-api 主线里没有这个头，配了也无害。
   */
  userIdEnv?: string | null
}

/* ------------------------------------------------------------- 会话载荷 */

/** `prompt-history` 端点载荷。 */
export interface HudPromptHistory {
  available: boolean
  sessionId: string | null
  prompts: string[]
}

/** `session-time` 端点载荷：创建时刻 + 累计墙钟与轮次/步数。 */
export interface HudSessionTime {
  available: boolean
  sessionId: string | null
  createdAt: number | null
  turns: number | null
  steps: number | null
  llmMs: number | null
  toolMs: number | null
  now: number
}

/** `session-statuses` 里的一行：git 摘要 + 这个会话自己的改动计数。 */
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

/** `session-statuses` 端点载荷。 */
export interface HudSessionOverview {
  sessions: HudSessionOverviewRow[]
  unavailable: boolean
  truncated: boolean
  worktrees: number
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

/** `session-tools` 端点载荷。 */
export interface HudSessionTools {
  sessionId: string | null
  tracking: boolean
  active: HudToolActive | null
  recent: HudToolRecent[]
  counts: HudToolCount[]
  skills: HudToolSkill[]
  skillsDropped: number
  total: number
}

/** `session-changes` 里“确定改过”的一个文件。 */
export interface HudSessionChangeFile {
  path: string
  file: string
  writes: number
  edits: number
  firstAt: number
  lastAt: number
  lastTurn: number | null
  turns: number[]
}

/** `session-changes` 里“可能相关”的一个路径（命令旁听来的启发式）。 */
export interface HudSessionChangePossible {
  path: string
  file: string
  hits: number
  firstAt: number
  lastAt: number
  reason: string
  lastTurn: number | null
}

/** `session-changes` 里跑过的一条 shell 命令。 */
export interface HudSessionCommand {
  tool: string
  command: string
  at: number
  turn: number | null
  failed: boolean
  readOnly: boolean
}

/** `session-changes` 端点载荷：本会话改过哪些文件 + 跑过哪些命令。 */
export interface HudSessionChanges {
  repo: string
  sessionId: string | null
  tracking: boolean
  since: number | null
  firstChangeAt: number | null
  files: HudSessionChangeFile[]
  dropped: number
  possible: HudSessionChangePossible[]
  possibleDropped: number
  commands: HudSessionCommand[]
  unconfirmed: number
  cwdMismatch: boolean
}

/* --------------------------------------------------- 宿主 ctx 与工具事件 */

/** fs 事件里的目标（`displayPath` 是绝对路径）。 */
export interface HudFsTarget {
  displayPath?: unknown
  [key: string]: unknown
}

/** 一次工具调用的执行上下文（宿主半只读下面几个字段）。 */
export interface HudToolExec {
  name?: unknown
  arguments?: unknown
  callId?: unknown
  agent?: {
    session?: HudSession
  }
  [key: string]: unknown
}

/** 一次工具调用的结果（只用来判断“失败没失败”）。 */
export interface HudToolResult {
  ok?: unknown
  isError?: unknown
  error?: unknown
  [key: string]: unknown
}

/** `ctx.webServer.register` 认的路由形状（只用 prefix 这一种）。 */
export interface HudWebServerRoute {
  kind: 'prefix'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => unknown
}

/** `ctx.webServer` 的最小接口。 */
export interface HudWebServer {
  register(route: HudWebServerRoute): () => void
}

/** 宿主 ctx 的**诚实最小接口**：本插件只用到 effect / inject / get / on / webServer。 */
export interface HudContext {
  effect(callback: () => (() => void) | void, label?: string): () => void
  inject(
    dependencies: string[],
    callback: (scope: HudInjectedScope) => (() => void) | void,
  ): () => void
  get(name: string): unknown
  webServer: HudWebServer
  on(
    event: 'fs/write-intent' | 'fs/edit-intent',
    listener: (
      target: HudFsTarget | null | undefined,
      exec: HudToolExec | null | undefined,
    ) => void,
  ): () => void
  on(
    event: 'fs/observed',
    listener: (
      target: HudFsTarget | null | undefined,
      observation: unknown,
      exec: HudToolExec | null | undefined,
    ) => void,
  ): () => void
  on(
    event: 'tools/pre-execute',
    listener: (exec: HudToolExec | null | undefined, next: () => unknown) => unknown,
  ): () => void
  on(
    event: 'tools/post-execute',
    listener: (
      exec: HudToolExec | null | undefined,
      result: HudToolResult | null | undefined,
      next: () => unknown,
    ) => unknown,
  ): () => void
}

/** 响应信封：`{ type:"server-response", rpcId, result }`。 */
export interface HudRpcEnvelope {
  type: 'server-response'
  rpcId: string
  result: unknown
}
