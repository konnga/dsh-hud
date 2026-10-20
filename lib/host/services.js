/**
 * 宿主半的**软依赖**：会话服务与三个投影读数器。
 *
 * 为什么单独一个文件：这些是**模块级状态**，而每个挂载实例各有自己的清理函数
 * （`ctx.inject` 的回调返回 `() => { hostSessions = null }`）—— 状态一旦被拆成两份，
 * 就会变成"服务明明在、却读不到"，而且不报错。把它们关在这一个文件里，
 * 这个坑从"要靠小心"变成"结构上不可能犯"。
 *
 * 三块内容的语义：
 *
 * - `sessions`（宿主服务）：枚举活着的会话，给 `session-time` / `prompt-history` /
 *   `session-statuses` 三个端点用。缺了就回"不可用"，侧栏那枚 chip 不画，其余照旧。
 * - `sessionProjections` 的三个键（都是投影，**从完整持久日志折叠**，分页与压实都不影响）：
 *   - `turnBoundary` → 当前回合号（归因、面板、胶囊用它说"第几轮"）；
 *   - `sessionStats` → 会话计时胶囊要的模型/工具墙钟与轮次步数；
 *   - `turnOutline` → 每条 turn 的原始 `prompt`，即输入框 `↑` 召回的数据源。
 *
 * 四者全是**软依赖**：任何一个没到齐，对应功能安静降级，绝不把整块拖下水。
 */
let hostSessions = null;
let hostContext = null;
let sessionTurnReader = null;
let sessionStatsReader = null;
let sessionOutlineReader = null;
/** 记下宿主 ctx：注入回调没到齐、或状态被别的实例卸载清掉时，用它按契约兜底问一次。 */
export function rememberContext(ctx) {
    hostContext = ctx;
}
/** 会话服务：先信注入给的那份，再按契约用 `ctx.get("sessions")` 兜底问 ctx。 */
export function sessionsService() {
    if (hostSessions !== null)
        return hostSessions;
    try {
        const fallback = hostContext !== null && typeof hostContext.get === 'function'
            ? hostContext.get('sessions')
            : undefined;
        if (fallback === undefined || fallback === null)
            return null;
        return fallback;
    }
    catch {
        return null;
    }
}
/** 这个会话现在在第几回合（拿不到就是 null，界面据此不显示回合信息）。 */
export function sessionTurn(session) {
    if (sessionTurnReader === null || session === undefined || session === null)
        return null;
    return sessionTurnReader(session);
}
/** 这个会话的累计墙钟与轮次/步数（`sessionStats` 投影）；投影没注册就回 null。 */
export function sessionStats(session) {
    if (sessionStatsReader === null || session === undefined || session === null)
        return null;
    return sessionStatsReader(session);
}
/** 这个会话的 turn 大纲（`turnOutline` 投影，含每条 turn 的 prompt）；没注册就回 null。 */
export function sessionOutline(session) {
    if (sessionOutlineReader === null || session === undefined || session === null)
        return null;
    return sessionOutlineReader(session);
}
/**
 * 挂上三个软依赖。`stops` 是调用方收集清理函数的数组（卸载时逐个调用）。
 *
 * 语义与原实现完全一致：依赖没到齐就**永远不回调**（Cordis 的动态注入），
 * 到齐后把读数器装好，卸载时再清成 null。
 */
export function registerSoftDependencies(ctx, stops) {
    if (typeof ctx.inject !== 'function')
        return;
    stops.push(ctx.inject(['sessions'], (scope) => {
        hostSessions = scope.sessions;
        return () => {
            hostSessions = null;
        };
    }));
    stops.push(ctx.inject(['sessionProjections'], (scope) => {
        sessionOutlineReader = (session) => {
            try {
                const state = scope.sessionProjections.stateOf(session, 'turnOutline');
                return state === undefined || state === null ? null : state;
            }
            catch {
                return null;
            }
        };
        sessionStatsReader = (session) => {
            try {
                const state = scope.sessionProjections.stateOf(session, 'sessionStats');
                if (state === undefined || state === null)
                    return null;
                const stats = state;
                const num = (value) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
                return {
                    turns: num(stats.turns),
                    steps: num(stats.steps),
                    llmMs: num(stats.llmMs),
                    toolMs: num(stats.toolMs),
                };
            }
            catch {
                return null;
            }
        };
        sessionTurnReader = (session) => {
            try {
                const state = scope.sessionProjections.stateOf(session, 'turnBoundary');
                const turn = state === undefined || state === null
                    ? null
                    : state.lastTurn;
                return typeof turn === 'number' && turn >= 0 ? turn : null;
            }
            catch {
                return null;
            }
        };
        return () => {
            sessionTurnReader = null;
            sessionStatsReader = null;
            sessionOutlineReader = null;
        };
    }));
}
