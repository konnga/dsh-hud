/**
 * dsh-hud — 宿主半边（Cordis 插件）。
 *
 * 在自己的 `ctx.webServer` 上挂 `/dsh-hud-rpc` 前缀路由，收发与内置 `/api` 完全相同的
 * Connection RPC 信封，并把请求围栏交给 `connection.requestRejection`
 * （Host/Origin + 浏览器会话认证），因此信任等级与内置通道一致。
 *
 * 为什么不直接调用内置通道：dsh >= 0.1.5-rc.1 起，外部插件无法使用
 * `ctx.connection.rpc.handle()` —— Connection 插件是在自己内部
 * `ctx.inject(["webServer"], …)` 作用域里注册路由的，无论调用方 inject 了什么，
 * 那一行都会以 `cannot get property "webServer" without inject` 挂载失败。
 * 因此本插件自持路由，只借用 Connection 的信任判定。
 *
 * 端点（全部只读，不写 index / 工作区 / 配置）：
 *   - `status { cwd }` → 仓库事实：当前分支（或 detached）、ahead/behind、脏状态、
 *     按类型分组的改动计数，以及改动清单（porcelain-v2 的两个字母 + 路径）。
 *   - `diff { cwd, path, origPath? }` → 一个改动文件的**两侧** unified diff
 *     （工作区 / 已暂存），已解析成带行号的 rows；未跟踪文件与 `--no-index` 对齐，
 *     文本按行截断、行数有上限，二进制只报 `binary`。
 *   - `image { cwd, path, origPath?, side?, sha? }` → 图片改动**两侧**的字节与像素尺寸
 *     （`kind` 为 `image` / `too-large` / `not-image` / `missing`），给二进制预览用；
 *     单侧上限 `MAX_IMAGE_BYTES`，超限只回报字节数。
 *   - `session-time { sessionId }` → 该会话的创建时刻与累计墙钟（`llmMs` / `toolMs` /
 *     `turns` / `steps`，来自内置 `sessionStats` 投影；服务缺失时 `available: false`）。
 *   - `prompt-history { sessionId, limit? }` → 该会话的用户 prompt（**新的在前**，来自内置
 *     `turnOutline` 投影；相邻重复只留一条，默认最多 100 条）。
 *   - `log { cwd, count? }` → 最近提交（短 sha、作者、日期、refs、标题），条数钳制 1..50。
 *   - `commit { cwd, sha }` → 某次提交的元信息与改动清单（相对**第一个父提交**，
 *     合并提交也按第一父提交看），清单形状与 `status.changes` 一致。
 *   - `commit-diff { cwd, sha, path, origPath? }` → 该提交里某个文件的 unified diff，
 *     已解析成带行号的 rows（形状与 `diff` 的**单侧**一致）。
 *   - `session-changes { cwd, sessionId }` → **本会话改过哪些文件**（按会话归因，见下）：
 *     路径、写入/编辑次数、首次与末次改动时间，以及"自 … 起记录"的时间戳。
 *
 * git 调用一律 `execFile`（无 shell）、带超时、有界输出，并对同一 cwd 做短 TTL 缓存 +
 * 在途请求合并，避免面板轮询时反复跑 `git status`。
 */
export { parseDiff, parseNameStatus, parseStatus } from './parse.js';
export { validateCommitSha, validateCwd, validateDiffPath } from './git.js';
export { MAX_IMAGE_BYTES, readImagePair, readImageSize, sniffImageMime } from './image.js';
export { readCommit, readCommitDiff, readDiff, readLog, readReviewSignatures, readStatus, readTags, } from './readers.js';
import { trackSessionChanges, } from './session.js';
export { PROMPT_HISTORY_MAX, readPromptHistory, readSessionChanges, readSessionOverview, readSessionTime, readSessionTools, } from './session.js';
import { CHANNEL, handleRequest, } from './rpc.js';
export { CHANNEL } from './rpc.js';
import { rememberContext, } from './services.js';
/** 本插件独占的 RPC 通道前缀（浏览器侧用同一常量调用）。 */
/** 插件名：`cordis.patch.yml` 用包名插入，Cordis 读的就是这个导出。 */
export const name = 'dsh-hud';
/**
 * 模块自带的硬依赖声明：Cordis 读这里的 `inject` 做激活门控，
 * `cordis.patch.yml` 的行里因此不再重复写一遍。
 */
export const inject = ['webServer', 'connection'];
/* --------------------------------------------- 二进制预览（图片，只读） */
/* ------------------------------------------------- 会话改动（按会话归因） */
/**
 * "哪个会话写过哪个文件"——事实源是 fs seam 派发的两类事件：
 *
 *   - `fs/write-intent` / `fs/edit-intent`（waterfall，参数 `(target, exec)`）：这次**要**动
 *     哪个文件。`dsh-tool-fs` 的写入/编辑工具与 `dsh-tool-str-replace-editor` 都走 `ctx.fs`，
 *     因此都会发这两个意图事件。
 *   - `fs/observed`（emit，参数 `(target, observation, exec)`）：那一下**之后**文件是 `present`
 *     还是 `absent`。注意它对**读取**也发（"编辑前必须先读"那个策略插件就是靠它），所以不能
 *     只看它 —— 必须与意图配对：同一个工具调用里先有意图、后有观察，才算这次改动落了地。
 *
 * `exec.agent.session.header` 同时给出 `id`（哪个会话）与 `cwd`（哪个工作区），所以"谁改的"
 * 不用猜。只记 cwd 之内的路径（git 只关心这些），每个会话与全局都有上限，避免长会话吃内存。
 *
 * 已知不覆盖（界面上如实标注，不假装全知）：
 *   - agent 通过 bash 间接改的文件（`sed -i`、脚本、格式化、`git` 操作）；
 *   - 本进程启动**之前**的改动（fs 观察不持久化）——所以每个会话都报一个 `since`。
 */
/* ------------------------------------------------------------------ 线路层 */
/* ------------------------------------------------------------------- 插件 */
/**
 * 插件入口。
 * @param ctx - 已注入 webServer 与 connection 的 Cordis 上下文。
 */
export function apply(ctx) {
    rememberContext(ctx);
    trackSessionChanges(ctx);
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: CHANNEL,
        handler: (req, res) => handleRequest(ctx, req, res),
    }), `dsh-hud: POST ${CHANNEL}/*`);
}
// 导出即插件面：`apply` / `inject` / `name` 供 Cordis 读取；`CHANNEL` / `parseStatus` /
// `validateCwd` / `readStatus` 是可直接单测的单元（前两个是纯函数，最后一个需要真实仓库）。
