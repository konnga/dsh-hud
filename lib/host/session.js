/**
 * 会话改动归因 + 会话级读取：工具活动、改动计数、审阅进度、prompt 历史、运行时长。
 */
import { readStatusCached } from './readers.js';
import { registerSoftDependencies, sessionOutline, sessionStats, sessionTurn, sessionsService, } from './services.js';
import path from 'node:path';
/** 一次最多看多少个工作区（多个会话可能共用一个目录，按目录去重之后再算）。 */
export const ROW_STATUS_MAX_WORKTREES = 8;
/**
 * 一个会话的用户 prompt 历史，**新的在前**（给输入框的 `↑` 召回用）。
 *
 * 来源是内置 `turnOutline` 投影的每条 `prompt` —— 也就是会话日志里真正的用户消息，
 * 不是我们自己记的一份。截断到 `limit` 条，相邻重复（同一句连发两次）只留一条。
 * 投影没注册、会话不在（还没恢复进存储 / 已归档）时回 `available: false` 与空列表。
 *
 * @param sessionId - 会话 id。
 * @param limit - 最多返回多少条（1..200，默认 {@link PROMPT_HISTORY_MAX}）。
 */
export function readPromptHistory(sessionId, limit = PROMPT_HISTORY_MAX) {
    const empty = { available: false, sessionId, prompts: [] };
    if (typeof sessionId !== 'string' || sessionId.length === 0)
        return empty;
    const max = typeof limit === 'number' && Number.isFinite(limit)
        ? Math.min(200, Math.max(1, Math.trunc(limit)))
        : PROMPT_HISTORY_MAX;
    const sessionStore = sessionsService();
    if (sessionStore === null)
        return empty;
    let live = [];
    try {
        live = sessionStore.list();
    }
    catch {
        return empty;
    }
    const session = live.find((item) => item && item.header && item.header.id === sessionId);
    if (session === undefined)
        return empty;
    const outline = sessionOutline(session);
    const turns = outline !== null && Array.isArray(outline.turns) ? outline.turns : null;
    if (turns === null)
        return empty;
    const prompts = [];
    for (let index = turns.length - 1; index >= 0 && prompts.length < max; index -= 1) {
        const turn = turns[index];
        const raw = turn && typeof turn.prompt === 'string' ? turn.prompt.trim() : '';
        if (raw.length === 0)
            continue;
        if (prompts.length > 0 && prompts[prompts.length - 1] === raw)
            continue;
        prompts.push(raw);
    }
    return { available: true, sessionId, prompts };
}
/**
 * 一个会话的"运行时长"事实：创建时刻 + 内置 `sessionStats` 的累计数字。
 *
 * 与 codex-hud 的会话时长口径一致：**挂钟时长 = 现在 − 会话创建时刻**（含等待与空闲），
 * 另外把"真的在干活"的两段（模型墙钟 `llmMs`、工具墙钟 `toolMs`）一并给出，让胶囊的悬停
 * 能说清"74 小时里其实只有 1 小时 52 分在跑"。
 *
 * 只读；`sessions` 服务没到齐或会话已不在（归档、子会话已回收）时回 `available: false`，
 * 客户端据此不画这枚胶囊。
 *
 * @param sessionId - 会话 id。
 * @returns `{ available, sessionId, createdAt, turns, steps, llmMs, toolMs, now }`。
 */
export function readSessionTime(sessionId) {
    const now = Date.now();
    const empty = {
        available: false,
        sessionId,
        createdAt: null,
        turns: null,
        steps: null,
        llmMs: null,
        toolMs: null,
        now,
    };
    if (typeof sessionId !== 'string' || sessionId.length === 0)
        return empty;
    const sessionStore = sessionsService();
    if (sessionStore === null)
        return empty;
    let live = [];
    try {
        live = sessionStore.list();
    }
    catch {
        return empty;
    }
    const session = live.find((item) => item && item.header && item.header.id === sessionId);
    if (session === undefined)
        return empty;
    const header = session.header;
    const createdAt = header !== undefined && header !== null && typeof header.createdAt === 'number'
        ? header.createdAt
        : null;
    const stats = sessionStats(session);
    return {
        available: true,
        sessionId,
        createdAt,
        turns: stats === null ? null : stats.turns,
        steps: stats === null ? null : stats.steps,
        llmMs: stats === null ? null : stats.llmMs,
        toolMs: stats === null ? null : stats.toolMs,
        now,
    };
}
/** 从异常里取一个可回报的诊断码（没有就退回 `git-failed`）。 */
function failureCodeOf(error) {
    if (error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code.length > 0)
        return error.code;
    return 'git-failed';
}
/**
 * 会话一览：每个活着的会话 → （它那个工作区的 git 摘要）+（这个会话自己的改动计数）。
 *
 * 两半各有一个唯一来源：git 那半走带缓存的 `readStatusCached`（按目录去重，多会话共用
 * 一个目录只跑一次 git），"这个会话改过什么"那半直接来自归因记录（本来就按 sessionId 分，
 * 不用再问 git）。**不返回 `changes`**：这一行只要摘要，别把清单也拖过来。
 */
export async function readSessionOverview() {
    const sessionStore = sessionsService();
    if (sessionStore === null)
        return { sessions: [], unavailable: true, truncated: false, worktrees: 0 };
    let live = [];
    try {
        live = sessionStore.list();
    }
    catch {
        return { sessions: [], unavailable: true, truncated: false, worktrees: 0 };
    }
    // 会话 → 目录；同一个目录只读一次。
    const byCwd = new Map();
    const rows = [];
    for (const session of live) {
        const header = session && session.header ? session.header : undefined;
        const sessionId = header && typeof header.id === 'string' ? header.id : null;
        if (sessionId === null)
            continue;
        const cwd = header && typeof header.cwd === 'string' && header.cwd.length > 0 ? header.cwd : null;
        rows.push({ sessionId, cwd });
        if (cwd !== null && !byCwd.has(cwd))
            byCwd.set(cwd, null);
    }
    const cwds = [...byCwd.keys()];
    const used = cwds.slice(0, ROW_STATUS_MAX_WORKTREES);
    const truncated = cwds.length > used.length;
    await Promise.all(used.map(async (cwd) => {
        try {
            byCwd.set(cwd, await readStatusCached(cwd));
        }
        catch (error) {
            byCwd.set(cwd, { error: failureCodeOf(error) });
        }
    }));
    const sessions = rows.map((row) => {
        // 会话自己的改动计数（确定 / 可能），来自归因记录 —— 与 git 无关，非仓库也能报。
        const entry = sessionChanges.get(row.sessionId);
        const summary = {
            sessionId: row.sessionId,
            cwd: row.cwd,
            mine: entry === undefined ? 0 : entry.files.size,
            possible: entry === undefined ? 0 : entry.possible.size,
        };
        /**
         * 「可能相关」里**此刻仍然有差异**的个数（与这份 status 的清单求交）。
         *
         * 为什么要两个数：`possible` 是"命令里提到过的路径"（历史，含已经还原/被忽略的），
         * 面板那一行只数"现在还有差异"的。同一个概念两个口径，界面上必须分别说清，
         * 否则就会出现"工作区干净 + 14 个可能相关"这种让人以为算错了的组合。
         */
        const possibleNow = entry === undefined
            ? 0
            : (() => {
                const status = row.cwd === null ? undefined : byCwd.get(row.cwd);
                if (status === undefined ||
                    status === null ||
                    !('changes' in status) ||
                    Array.isArray(status.changes) !== true)
                    return 0;
                let count = 0;
                for (const change of status.changes)
                    if (entry.possible.has(change.file))
                        count += 1;
                return count;
            })();
        if (row.cwd === null)
            return { ...summary, possibleNow: 0, repo: false, error: null };
        const status = byCwd.get(row.cwd);
        if (status === undefined || status === null)
            return { ...summary, possibleNow: 0, repo: false, error: null, pending: true };
        if ('error' in status)
            return { ...summary, possibleNow: 0, repo: false, error: status.error };
        return {
            ...summary,
            possibleNow,
            repo: status.repo !== null,
            branch: status.branch,
            detached: status.detached === true,
            dirty: status.dirty === true,
            ahead: status.ahead || 0,
            behind: status.behind || 0,
            counts: status.counts,
            error: null,
        };
    });
    return { sessions, unavailable: false, truncated, worktrees: used.length };
}
/** 单个会话最多记多少个文件；超出只计数（`dropped`），不做 LRU 淘汰。 */
export const SESSION_CHANGE_MAX_FILES = 500;
/** 最多同时记多少个会话（按最近一次改动淘汰最旧的）。 */
export const SESSION_CHANGE_MAX_SESSIONS = 32;
/** 单个会话最多记多少个"可能相关"的路径（命令旁听来的，优先级低于确定改动）。 */
export const SESSION_CHANGE_MAX_POSSIBLE = 300;
/** 每个会话留多少条命令历史（面板悬停时能看到"跑过什么"）。 */
export const SESSION_COMMAND_MAX = 20;
/** 命令在界面上的显示上限（超长命令截断，别把整行撑爆）。 */
export const COMMAND_TEXT_MAX = 140;
/** 每个会话留多少条"最近工具调用"（胶囊悬停里列最近几条）。 */
export const TOOL_RECENT_MAX = 12;
/** 最多同时记多少个会话的工具活动（与归因那份各自独立淘汰）。 */
export const TOOL_SESSIONS_MAX = 32;
/** 每个会话最多记多少个技能（超出的只计数不列名）。 */
export const TOOL_SKILLS_MAX = 20;
/** 参数摘要的显示上限（超长命令/路径截断，别把胶囊撑爆）。 */
export const TOOL_SUMMARY_MAX = 60;
/**
 * sessionId → { active, recent, counts, total }：这个会话**跑到哪些工具**。
 *
 * 与归因那份记录分开存：归因关心"改了哪些文件"，这份关心"跑了什么"。
 */
export const sessionTools = new Map();
/** 取（必要时新建）某个会话的工具活动记录，并做数量上限淘汰。 */
export function sessionToolEntry(sessionId) {
    let entry = sessionTools.get(sessionId);
    if (entry === undefined) {
        entry = {
            active: null,
            recent: [],
            counts: new Map(),
            status: new Map(),
            skills: new Map(),
            total: 0,
        };
        sessionTools.set(sessionId, entry);
        if (sessionTools.size > TOOL_SESSIONS_MAX) {
            const oldest = sessionTools.keys().next().value;
            if (oldest !== undefined && oldest !== sessionId)
                sessionTools.delete(oldest);
        }
    }
    return entry;
}
/**
 * 参数里可以安全拿出来做"一行摘要"的键。
 *
 * 只认这些**路径/命令类**的键：工具参数里可能带着整个文件内容（write 的 `content`），
 * 随便取"第一个字符串"就会把内容贴到界面上 —— 所以认不出来就干脆不写摘要。
 */
export const TOOL_SUMMARY_KEYS = [
    'command',
    'cmd',
    'script',
    'filePath',
    'path',
    'file',
    'pattern',
    'query',
    'url',
];
/** 「调用技能」那件工具的工具名（`dsh-tool-skill` 注册的名字）。 */
export const SKILL_TOOL_NAME = 'skill';
/**
 * 技能名：`skill` 工具的入参是 `{ name: '技能名' }`。
 *
 * 只对这一个工具认 `name` 键 —— 别的工具用 `name` 表达别的东西，不能被当技能名抓走。
 */
export function skillNameOf(exec) {
    if (exec === null || typeof exec !== 'object' || exec.name !== SKILL_TOOL_NAME)
        return null;
    const args = exec.arguments;
    if (args === null || typeof args !== 'object')
        return null;
    const value = args.name;
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim().slice(0, TOOL_SUMMARY_MAX)
        : null;
}
/** 工具名：从执行上下文里取，取不到就退回 `'?'`。 */
function execNameOf(exec) {
    return exec !== null && exec !== undefined && typeof exec.name === 'string' ? exec.name : '?';
}
/** 从工具调用参数里取一行摘要（认不出来返回 null，不用兜底去猜）。 */
export function toolSummaryOf(exec) {
    const skill = skillNameOf(exec);
    if (skill !== null)
        return skill;
    const args = exec && exec.arguments;
    if (args === null || args === undefined || typeof args !== 'object')
        return null;
    const record = args;
    for (const key of TOOL_SUMMARY_KEYS) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.replace(/\s+/g, ' ').trim().slice(0, TOOL_SUMMARY_MAX);
        }
    }
    return null;
}
/** 工具开跑：记下"现在是哪个工具、什么时候开始的"（供胶囊显示实时秒数）。 */
export function noteToolStart(exec) {
    try {
        const identity = sessionIdentityOf(exec);
        if (identity === null)
            return;
        const entry = sessionToolEntry(identity.sessionId);
        const rawName = execNameOf(exec);
        const name = rawName.length > 0 ? rawName : '?';
        entry.active = {
            callId: identity.callId,
            name,
            summary: toolSummaryOf(exec),
            startedAt: Date.now(),
        };
        entry.total += 1;
        entry.counts.set(name, (entry.counts.get(name) || 0) + 1);
        const skill = skillNameOf(exec);
        if (skill !== null) {
            const seen = entry.skills.get(skill);
            entry.skills.set(skill, { count: (seen ? seen.count : 0) + 1, ok: seen ? seen.ok : null });
        }
    }
    catch {
        // 旁听失败不影响工具本身。
    }
}
/** 工具结束：把这一次挪进"最近"，并清掉 active（只有同一个 callId 才清，避免并发调用互相抹掉）。 */
export function noteToolFinish(exec, result) {
    try {
        const identity = sessionIdentityOf(exec);
        if (identity === null)
            return;
        const entry = sessionToolEntry(identity.sessionId);
        const active = entry.active;
        const startedAt = active !== null && active.callId === identity.callId ? active.startedAt : null;
        entry.recent.push({
            name: active !== null && active.callId === identity.callId ? active.name : execNameOf(exec),
            summary: active !== null && active.callId === identity.callId ? active.summary : toolSummaryOf(exec),
            ok: !resultFailed(result),
            at: Date.now(),
            ms: startedAt === null ? null : Math.max(0, Date.now() - startedAt),
        });
        if (entry.recent.length > TOOL_RECENT_MAX)
            entry.recent.splice(0, entry.recent.length - TOOL_RECENT_MAX);
        // 每个工具"最近一次调用"的结果：胶囊上每个工具前面那个 ✓/✗ 用它。
        const finished = entry.recent[entry.recent.length - 1];
        if (finished !== undefined)
            entry.status.set(finished.name, finished.ok === true);
        // 技能自己的最近一次结果（胶囊上可以据此打 ✓/✗）。
        const skill = skillNameOf(exec);
        if (skill !== null) {
            const known = entry.skills.get(skill);
            if (known !== undefined)
                entry.skills.set(skill, { count: known.count, ok: !resultFailed(result) });
        }
        if (active !== null && active.callId === identity.callId)
            entry.active = null;
    }
    catch {
        // 同上。
    }
}
/**
 * 读出某个会话的工具活动（端点载荷）。
 *
 * `active` 带 `startedAt`：实时秒数由客户端本地计时（否则要为了一个秒数把轮询压到亚秒级 ✗）。
 */
export function readSessionTools(sessionId) {
    const entry = sessionId === null || sessionId === undefined ? undefined : sessionTools.get(sessionId);
    if (entry === undefined) {
        return {
            sessionId: sessionId ?? null,
            tracking: true,
            active: null,
            recent: [],
            counts: [],
            skills: [],
            skillsDropped: 0,
            total: 0,
        };
    }
    const counts = [...entry.counts].map(([name, count]) => ({
        name,
        count,
        // `null` = 还没看到它结束过（比如正在跑第一次），别替它编一个 ✓。
        ok: entry.status.has(name) ? (entry.status.get(name) ?? null) : null,
    }));
    counts.sort((left, right) => right.count - left.count || (left.name < right.name ? -1 : 1));
    // 技能按次数排序（用得多在前），超过上限只报前若干个。
    const skills = [...entry.skills].map(([name, item]) => ({
        name,
        count: item.count,
        ok: item.ok,
    }));
    skills.sort((left, right) => right.count - left.count || (left.name < right.name ? -1 : 1));
    return {
        sessionId,
        tracking: true,
        active: entry.active === null ? null : { ...entry.active },
        recent: entry.recent.slice(-5).reverse(),
        counts,
        skills: skills.slice(0, TOOL_SKILLS_MAX),
        skillsDropped: Math.max(0, skills.length - TOOL_SKILLS_MAX),
        total: entry.total,
    };
}
/** sessionId → { cwd, since, files: Map<relPath, {...}>, dropped, unconfirmed }。 */
export const sessionChanges = new Map();
/** 本次监听开始的时刻 —— 界面说的"自 … 起记录"用的是它（不是"第一条改动的时间"）。 */
export let sessionChangeTrackingSince = null;
/** callId（没有就退化成 sessionId+路径）→ 尚未配对到 `fs/observed` 的意图。 */
export const pendingChangeIntents = new Map();
/** prompt 历史的条数上限（与客户端的 `↑` 召回共用这一个数）。 */
export const PROMPT_HISTORY_MAX = 100;
/** 这次调用发生在第几回合（拿不到就是 null，界面据此不显示回合信息）。 */
export function currentTurnOf(exec) {
    const session = exec && exec.agent ? exec.agent.session : undefined;
    return sessionTurn(session);
}
/** 这个会话第一次出现在记录里的时刻（客户端据此说"自 … 起"）。 */
export function sessionChangeEntry(sessionId, cwd) {
    let entry = sessionChanges.get(sessionId);
    if (entry === undefined) {
        entry = {
            cwd,
            since: Date.now(),
            files: new Map(),
            dropped: 0,
            // 命令旁听来的"可能相关"：与 files 分开存，绝不冒充"确定改过"。
            possible: new Map(),
            possibleDropped: 0,
            commands: [],
        };
        sessionChanges.set(sessionId, entry);
        if (sessionChanges.size > SESSION_CHANGE_MAX_SESSIONS) {
            // 先淘汰最久没动过的那个（Map 保持插入序，删第一个就是最旧的）。
            const oldest = sessionChanges.keys().next().value;
            if (oldest !== undefined && oldest !== sessionId)
                sessionChanges.delete(oldest);
        }
    }
    if (cwd !== undefined && cwd !== null)
        entry.cwd = cwd;
    return entry;
}
/** 把绝对路径折成 cwd 之内的 posix 相对路径；在 cwd 之外或拿不到都返回 null。 */
export function sessionRelativePath(cwd, absolutePath) {
    if (typeof cwd !== 'string' || cwd.length === 0)
        return null;
    if (typeof absolutePath !== 'string' || absolutePath.length === 0)
        return null;
    if (!path.isAbsolute(absolutePath))
        return null;
    const relative = path.relative(cwd, absolutePath);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative))
        return null;
    return relative.split(path.sep).join('/');
}
/**
 * 会自己改文件的"命令行工具"：bash / pwsh / 各种 shell。
 *
 * 用名字前缀匹配而不是精确清单：产品里有 `bash`、`bash-persistent`、`pwsh`、`pwsh-persistent`
 * 等等，将来还会加，硬编码清单一定会过期。
 */
export const SHELL_TOOL_RE = /^(?:bash|pwsh|sh|zsh|fish|shell|cmd|powershell|exec_command|run_command|terminal)/i;
/** 从工具调用参数里取命令行文本（不同 shell 工具的字段名不一样，按常见几个找）。 */
export function shellCommandOf(exec) {
    if (exec === undefined || exec === null)
        return null;
    if (typeof exec.name !== 'string' || !SHELL_TOOL_RE.test(exec.name))
        return null;
    const args = exec.arguments;
    if (args === null || typeof args !== 'object')
        return null;
    const record = args;
    for (const key of ['command', 'cmd', 'script', 'input', 'line']) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0)
            return value;
    }
    return null;
}
/** 按 `; && || | 换行` 切分命令（只为抽路径，不做真正的 shell 解析）。 */
export function shellSegments(command) {
    return command
        .split(/\r?\n|;|&&|\|\||\|/)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
}
/** 极简分词：支持单双引号（不处理转义与嵌套），够抽路径用。 */
export function shellTokens(segment) {
    const tokens = [];
    let current = '';
    let quote = null;
    for (const ch of segment) {
        if (quote !== null) {
            if (ch === quote)
                quote = null;
            else
                current += ch;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === ' ' || ch === '\t') {
            if (current.length > 0) {
                tokens.push(current);
                current = '';
            }
            continue;
        }
        current += ch;
    }
    if (current.length > 0)
        tokens.push(current);
    return tokens;
}
/** 环境变量赋值、sudo/env 之类的包装前缀：抽路径时要跳过。 */
export const SHELL_PREFIX_RE = /^(?:[A-Za-z_][A-Za-z0-9_]*=|sudo$|env$|time$|nohup$|command$|builtin$|exec$|then$|do$|if$|while$)/;
/** 一条命令里最多抽多少个路径（防御性上限）。 */
const COMMAND_PATHS_MAX = 20;
/** 写入类命令：它们改文件，"目标"在哪一个参数上按命令而定。 */
const WRITE_COMMANDS = new Set([
    'mv',
    'cp',
    'ln',
    'install',
    'rsync',
    'truncate',
    'touch',
    'rm',
    'unlink',
    'sed',
    'perl',
    'tee',
    'dd',
    'patch',
    'chmod',
    'chown',
    'gzip',
    'gunzip',
    'tar',
    'unzip',
    'zip',
]);
/** 只读命令：即使带了参数也不要记成"可能改过"。 */
export const READ_COMMANDS = new Set([
    'cat',
    'less',
    'more',
    'head',
    'tail',
    'grep',
    'rg',
    'ls',
    'find',
    'stat',
    'wc',
    'file',
    'du',
    'diff',
    'git',
    'echo',
    'printf',
    'pwd',
    'which',
    'type',
    'env',
    'date',
    'sort',
    'uniq',
    'awk',
    'jq',
    'node',
    'python',
    'python3',
    'true',
    'false',
    'test',
    'cd',
    'export',
    'set',
    'source',
]);
/**
 * 从一条命令里抽出"可能被改动的路径"。
 *
 * 这是**启发式**，只做三类有把握的事，其余一律退回"命令级提示"（不声称改过哪些路径）：
 *   1. 重定向与 `tee` 的目标（`>`、`>>`、`tee file`）；
 *   2. 原地编辑（`sed -i`、`perl -i`）与写入类命令（`mv`/`cp`/`rm`/`dd of=`…）的目标参数；
 *   3. `git checkout|restore <path>` 这类"把文件改回某个版本"的命令。
 * 只读命令（`cat`、`grep`、`git status`…）即使带路径也不记。
 * @returns {{ path: string, reason: string }[]} 去重后的候选路径（原样 token，未解析）。
 */
export function possiblePathsOf(command) {
    const found = new Map();
    const add = (token, reason) => {
        const cleaned = String(token).replace(/^["']|["']$/g, '');
        if (cleaned.length === 0 || cleaned === '/' || cleaned.startsWith('/dev/'))
            return;
        if (/^&?\d+$/.test(cleaned) || cleaned.startsWith('&'))
            return;
        if (cleaned.startsWith('-'))
            return;
        if (cleaned.includes('$') || cleaned.includes('*') || cleaned.includes('?'))
            return;
        if (found.has(cleaned))
            return;
        found.set(cleaned, reason.slice(0, 80));
    };
    for (const segment of shellSegments(command)) {
        // 1) 重定向与 tee：即使命令本身不认识也要抽。
        const redirects = segment.matchAll(/(?:^|[^0-9<>])>>?\s*([^\s;&|<>()]+)/g);
        for (const match of redirects)
            add(match[1], segment);
        const tees = segment.matchAll(/\btee\s+(?:-[A-Za-z-]+\s+)*([^\s;&|<>()]+)/g);
        for (const match of tees)
            add(match[1], segment);
        const tokens = shellTokens(segment).filter((token) => !SHELL_PREFIX_RE.test(token));
        let index = 0;
        while (index < tokens.length && SHELL_PREFIX_RE.test(tokens[index]))
            index += 1;
        const head = (tokens[index] || '').toLowerCase();
        const args = tokens.slice(index + 1);
        if (head.length === 0)
            continue;
        // 2) 原地编辑：`sed -i … <file>` / `perl -i … <file>` —— 取该段最后一个非 flag 参数。
        if ((head === 'sed' || head === 'perl') && args.some((arg) => /^-[A-Za-z]*i/.test(arg))) {
            const last = [...args].reverse().find((arg) => !arg.startsWith('-'));
            if (last !== undefined)
                add(last, segment);
            continue;
        }
        // 3) `dd of=…`
        if (head === 'dd') {
            for (const arg of args)
                if (arg.startsWith('of='))
                    add(arg.slice(3), segment);
            continue;
        }
        // 4) `git checkout|restore <path>`（会覆盖工作区文件）
        if (head === 'git') {
            const sub = (args[0] || '').toLowerCase();
            if (sub === 'checkout' || sub === 'restore') {
                const target = args.slice(1).find((arg) => !arg.startsWith('-'));
                if (target !== undefined && target !== '.')
                    add(target, segment);
            }
            continue;
        }
        // 5) 写入类命令：`mv/cp/ln/install/rsync` 记目标（最后一个参数）；其余记所有非 flag 参数。
        if (WRITE_COMMANDS.has(head)) {
            if (/^(?:chmod|chown|tar|gzip|gunzip|zip)$/.test(head))
                continue;
            // `mv` 的源也会"变"（消失），所以源与目标都记；其余写入类命令只记目标。
            if (head === 'mv') {
                for (const arg of args)
                    if (!arg.startsWith('-'))
                        add(arg, segment);
                continue;
            }
            if (/^(?:cp|ln|install|rsync|patch)$/.test(head)) {
                const target = [...args].reverse().find((arg) => !arg.startsWith('-'));
                if (target !== undefined)
                    add(target, segment);
                continue;
            }
            for (const arg of args)
                if (!arg.startsWith('-'))
                    add(arg, segment);
            continue;
        }
        // 其余（含只读命令、以及 npm/pnpm/prettier 这类"可能改了但说不清改哪"的）一律退回命令级提示。
        void READ_COMMANDS;
    }
    return [...found]
        .slice(0, COMMAND_PATHS_MAX)
        .map(([pathToken, reason]) => ({ path: pathToken, reason }));
}
/** 命令是不是"看起来只读"（用于命令历史里的标注）。 */
export function commandLooksReadOnly(command) {
    const heads = shellSegments(command).map((segment) => shellTokens(segment).filter((token) => !SHELL_PREFIX_RE.test(token))[0] || '');
    if (heads.length === 0)
        return false;
    return heads.every((head) => READ_COMMANDS.has(head.toLowerCase()));
}
/** 结果看起来是失败吗（失败的命令不改文件，就不算"可能相关"）。 */
export function resultFailed(result) {
    if (result === null || typeof result !== 'object')
        return false;
    if (result.ok === false)
        return true;
    if (result.isError === true)
        return true;
    return result.error !== undefined && result.error !== null;
}
/**
 * 把"第几回合"记到一条记录上（文件 / 可能相关）。
 *
 * `lastTurn` 是最近一次动它的回合，`turns` 是动过它的回合列表（去重、最多 8 个）——
 * 界面用前者做"只看最近一轮"，后者留给悬停说明"这个文件被两轮动过"。
 */
export function noteTurnOfRecord(record, turn) {
    record.lastTurn = turn;
    if (turn === null)
        return;
    if (!Array.isArray(record.turns))
        record.turns = [];
    if (record.turns[record.turns.length - 1] !== turn && record.turns.indexOf(turn) === -1)
        record.turns.push(turn);
    if (record.turns.length > 8)
        record.turns.splice(0, record.turns.length - 8);
}
/** 从工具执行上下文里取会话身份与工作区；非 agent 调用返回 null。 */
export function sessionIdentityOf(exec) {
    const session = exec && exec.agent ? exec.agent.session : undefined;
    const header = session ? session.header : undefined;
    if (header === undefined || header === null)
        return null;
    if (typeof header.id !== 'string' || header.id.length === 0)
        return null;
    const cwd = typeof header.cwd === 'string' && header.cwd.length > 0 ? header.cwd : undefined;
    return {
        sessionId: header.id,
        cwd,
        callId: exec && typeof exec.callId === 'string' ? exec.callId : null,
    };
}
/** 意图的配对键：优先用调用 id（一次调用一个意图），没有就退化成"会话 + 路径"。 */
export function pendingKeyOf(identity, relative) {
    return identity.callId !== null
        ? `call:${identity.callId}`
        : `path:${identity.sessionId}\u0000${relative}`;
}
/**
 * 记一次写入/编辑意图（事件回调；绝不抛，也绝不返回 next —— 这是 waterfall 的旁听）。
 * @param target - fs 目标（`displayPath` 是绝对路径）。
 * @param exec - 工具执行上下文。
 * @param kind - `"write"` 或 `"edit"`。
 */
export function noteChangeIntent(target, exec, kind) {
    try {
        const identity = sessionIdentityOf(exec);
        if (identity === null)
            return;
        const absolute = target && typeof target.displayPath === 'string' ? target.displayPath : null;
        const relative = sessionRelativePath(identity.cwd, absolute);
        if (relative === null)
            return;
        pendingChangeIntents.set(pendingKeyOf(identity, relative), {
            sessionId: identity.sessionId,
            cwd: identity.cwd,
            relative,
            kind,
            at: Date.now(),
        });
        // 配对表也会长：清掉明显过期的（超过 5 分钟还没等到观察的意图）。
        if (pendingChangeIntents.size > 512) {
            const cutoff = Date.now() - 5 * 60 * 1000;
            for (const [key, entry] of pendingChangeIntents)
                if (entry.at < cutoff)
                    pendingChangeIntents.delete(key);
        }
    }
    catch {
        // 旁听失败不影响写入本身。
    }
}
/**
 * 记一次观察：只有配得上"意图"的才算这次改动落了地（读取引起的观察一律忽略）。
 * @param target - fs 目标。
 * @param exec - 工具执行上下文。
 */
export function noteChangeObservation(target, exec) {
    try {
        const identity = sessionIdentityOf(exec);
        if (identity === null)
            return;
        const absolute = target && typeof target.displayPath === 'string' ? target.displayPath : null;
        const relative = sessionRelativePath(identity.cwd, absolute);
        if (relative === null)
            return;
        const key = pendingKeyOf(identity, relative);
        const intent = pendingChangeIntents.get(key);
        if (intent === undefined)
            return;
        pendingChangeIntents.delete(key);
        const entry = sessionChangeEntry(intent.sessionId, intent.cwd);
        let file = entry.files.get(intent.relative);
        if (file === undefined) {
            if (entry.files.size >= SESSION_CHANGE_MAX_FILES) {
                entry.dropped += 1;
                return;
            }
            file = {
                writes: 0,
                edits: 0,
                firstAt: intent.at,
                lastAt: intent.at,
                lastTurn: null,
                turns: [],
            };
            entry.files.set(intent.relative, file);
        }
        if (intent.kind === 'write')
            file.writes += 1;
        else
            file.edits += 1;
        file.lastAt = Date.now();
        noteTurnOfRecord(file, currentTurnOf(exec));
    }
    catch {
        // 同上：旁听不参与写入成败。
    }
}
/**
 * 记一次 shell 命令（事件回调；旁听，绝不抛，也绝不吞掉 waterfall 的返回值）。
 *
 * 两类信息分开记：
 *   - `commands`：跑过什么（含看似只读的、以及失败的），供界面说"跑过这些命令"；
 *   - `possible`：从命令里抽出来的**候选路径**，只进"可能相关"这一档，绝不写进 `files`。
 *
 * 失败的命令不改文件：只进 `commands`，不参与路径归因。
 */
export function noteShellCommand(exec, result) {
    try {
        const command = shellCommandOf(exec);
        if (command === null)
            return;
        const identity = sessionIdentityOf(exec);
        if (identity === null)
            return;
        const cwd = typeof identity.cwd === 'string' && identity.cwd.length > 0 ? identity.cwd : null;
        const entry = sessionChangeEntry(identity.sessionId, identity.cwd);
        const failed = resultFailed(result);
        const turn = currentTurnOf(exec);
        entry.commands.push({
            tool: execNameOf(exec),
            command: command.replace(/\s+/g, ' ').trim().slice(0, COMMAND_TEXT_MAX),
            at: Date.now(),
            turn,
            failed,
            readOnly: commandLooksReadOnly(command),
        });
        if (entry.commands.length > SESSION_COMMAND_MAX) {
            entry.commands.splice(0, entry.commands.length - SESSION_COMMAND_MAX);
        }
        if (failed || cwd === null)
            return;
        for (const candidate of possiblePathsOf(command)) {
            const absolute = path.isAbsolute(candidate.path)
                ? candidate.path
                : path.resolve(cwd, candidate.path);
            const relative = sessionRelativePath(cwd, absolute);
            if (relative === null)
                continue;
            let item = entry.possible.get(relative);
            if (item === undefined) {
                if (entry.possible.size >= SESSION_CHANGE_MAX_POSSIBLE) {
                    entry.possibleDropped += 1;
                    continue;
                }
                item = {
                    hits: 0,
                    firstAt: Date.now(),
                    lastAt: Date.now(),
                    reason: candidate.reason,
                    lastTurn: turn,
                    turns: [],
                };
                entry.possible.set(relative, item);
            }
            item.hits += 1;
            item.lastAt = Date.now();
            noteTurnOfRecord(item, turn);
            // 最近一次提到它的命令片段更有参考价值。
            item.reason = candidate.reason;
        }
    }
    catch {
        // 旁听失败不影响命令本身。
    }
}
/**
 * 把某个会话的改动读成端点的载荷（只含 cwd 之内的路径，按路径排序）。
 *
 * 两条诚实性检查：
 *   - 会话记录里的 cwd 与请求的 cwd 不一致时返回**空清单**（`cwdMismatch`）：记的是相对
 *     那个工作区的路径，跟另一个工作区对账只会标错行。
 *   - `unconfirmed` 只数**这个会话**的待配对意图（不是全局），免得把别的会话的在途写入报成它的。
 */
export function readSessionChanges(cwd, sessionId) {
    const entry = sessionId === null || sessionId === undefined ? undefined : sessionChanges.get(sessionId);
    const mismatched = entry !== undefined && entry.cwd !== undefined && entry.cwd !== null && entry.cwd !== cwd;
    const files = [];
    if (entry !== undefined && !mismatched) {
        for (const [relative, file] of entry.files) {
            files.push({
                path: relative,
                file: relative,
                writes: file.writes,
                edits: file.edits,
                firstAt: file.firstAt,
                lastAt: file.lastAt,
                lastTurn: file.lastTurn === undefined ? null : file.lastTurn,
                turns: Array.isArray(file.turns) ? file.turns.slice() : [],
            });
        }
        files.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0));
    }
    const possible = [];
    if (entry !== undefined && !mismatched) {
        for (const [relative, item] of entry.possible) {
            possible.push({
                path: relative,
                file: relative,
                hits: item.hits,
                firstAt: item.firstAt,
                lastAt: item.lastAt,
                reason: item.reason,
                lastTurn: item.lastTurn === undefined ? null : item.lastTurn,
            });
        }
        possible.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0));
    }
    let unconfirmed = 0;
    if (sessionId !== null && sessionId !== undefined) {
        for (const intent of pendingChangeIntents.values())
            if (intent.sessionId === sessionId)
                unconfirmed += 1;
    }
    return {
        repo: cwd,
        sessionId: sessionId ?? null,
        tracking: true,
        // 记录是在宿主进程里做的、不持久化：客户端据此说"自 … 起"，而不是暗示"这个会话从头到现在"。
        since: sessionChangeTrackingSince,
        // 这个会话第一次被记到改动的时刻（没有改动就是 null）。
        firstChangeAt: entry === undefined ? null : entry.since,
        files,
        dropped: entry === undefined ? 0 : entry.dropped,
        // 命令旁听的结果：`possible` 是"可能相关"的候选路径（启发式），`commands` 是跑过的命令。
        possible,
        possibleDropped: entry === undefined ? 0 : entry.possibleDropped,
        commands: entry === undefined || mismatched ? [] : entry.commands.slice(),
        unconfirmed,
        cwdMismatch: mismatched,
    };
}
/** 挂上两个事件监听（由 `apply` 调用）。 */
export function trackSessionChanges(ctx) {
    return ctx.effect(() => {
        sessionChangeTrackingSince = Date.now();
        const stops = [
            ctx.on('fs/write-intent', (target, exec) => {
                noteChangeIntent(target, exec, 'write');
            }),
            ctx.on('fs/edit-intent', (target, exec) => {
                noteChangeIntent(target, exec, 'edit');
            }),
            ctx.on('fs/observed', (target, observation, exec) => {
                noteChangeObservation(target, exec);
            }),
            // 命令旁听：`tools/post-execute` 是 waterfall，**必须把 next() 的判定原样透传**
            // （兜底是 `{ kind: 'accept' }`，吞掉就等于把工具结果的裁决改掉了）。
            // 工具开跑：记"现在在跑哪个工具"（胶囊显示实时秒数用）。
            // `tools/pre-execute` 同样是 waterfall（兜底 `{ kind: 'allow' }`），必须原样透传判定。
            ctx.on('tools/pre-execute', (exec, next) => {
                noteToolStart(exec);
                return next();
            }),
            ctx.on('tools/post-execute', (exec, result, next) => {
                noteShellCommand(exec, result);
                noteToolFinish(exec, result);
                return next();
            }),
        ];
        // 软依赖全部集中在 services.js：状态只在那里被持有，这里只负责挂上并收集清理函数。
        registerSoftDependencies(ctx, stops);
        return () => {
            for (const stop of stops)
                if (typeof stop === 'function')
                    stop();
            sessionChanges.clear();
            pendingChangeIntents.clear();
            sessionTools.clear();
            sessionChangeTrackingSince = null;
        };
    }, 'dsh-hud: session change tracking');
}
