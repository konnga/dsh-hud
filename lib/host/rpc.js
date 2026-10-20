import { validateCommitSha, validateCwd, validateDiffPath } from './git.js';
import { readImagePair } from './image.js';
import { readCommit, readCommitDiff, readDiff, readLog, readReviewSignatures, readStatusCached, readTags, } from './readers.js';
import { readPromptHistory, readSessionChanges, readSessionOverview, readSessionTime, readSessionTools, } from './session.js';
/**
 * 线路层：把 /dsh-hud-rpc 的请求按端点分发、复用 Connection 的信任判定、统一错误信封。
 */
export const CHANNEL = '/dsh-hud-rpc';
export const MAX_BODY_BYTES = 256 * 1024;
/** 一次最多给多少个改动文件算"这一版"的签名（超出的那些只显示"未审"，不报错）。 */
export const REVIEW_SIGNATURE_MAX = 200;
const toArgs = (args) => args !== null && typeof args === 'object' ? args : {};
/** 端点表：全部只读；新增端点时在这里登记。 */
export const ENDPOINTS = {
    async status(args) {
        const input = toArgs(args);
        const checked = validateCwd(input.cwd);
        if (!checked.ok)
            throw Object.assign(new Error(checked.message), { code: checked.code });
        const status = await readStatusCached(checked.value);
        // 「审阅进度」要的"这一版"签名：只在客户端明确要的时候才算（胶囊那一路的轮询不用付这个钱）。
        if (input.review === true && Array.isArray(status.changes) && status.changes.length > 0) {
            status.review = await readReviewSignatures(checked.value, status.changes.slice(0, REVIEW_SIGNATURE_MAX).map((change) => change.file));
        }
        return status;
    },
    async 'session-tools'(args) {
        const input = toArgs(args);
        const sessionId = typeof input.sessionId === 'string' && input.sessionId.length > 0 ? input.sessionId : null;
        return readSessionTools(sessionId);
    },
    async 'session-statuses'() {
        return readSessionOverview();
    },
    /** 一个会话的 prompt 历史（新的在前）—— 给输入框的 `↑` 召回用。 */
    async 'prompt-history'(args) {
        const input = toArgs(args);
        const sessionId = typeof input.sessionId === 'string' && input.sessionId.length > 0 ? input.sessionId : null;
        return readPromptHistory(sessionId, input.limit);
    },
    /** 一个会话的运行时长（挂钟 + 模型/工具墙钟）—— 给会话计时胶囊用。 */
    async 'session-time'(args) {
        const input = toArgs(args);
        const sessionId = typeof input.sessionId === 'string' && input.sessionId.length > 0 ? input.sessionId : null;
        return readSessionTime(sessionId);
    },
    async diff(args) {
        const input = toArgs(args);
        const cwd = validateCwd(input.cwd);
        if (!cwd.ok)
            throw Object.assign(new Error(cwd.message), { code: cwd.code });
        const file = validateDiffPath(input.path);
        if (!file.ok)
            throw Object.assign(new Error(file.message), { code: file.code });
        let origFile = null;
        if (input.origPath !== undefined && input.origPath !== null && input.origPath !== '') {
            const checked = validateDiffPath(input.origPath, 'origPath');
            if (!checked.ok)
                throw Object.assign(new Error(checked.message), { code: checked.code });
            origFile = checked.value;
        }
        return readDiff(cwd.value, file.value, origFile);
    },
    /**
     * 图片预览：一个二进制改动两侧的字节与像素尺寸。
     *
     * `diff` 对二进制只回一句 `binary: true`（文本 diff 里没有可看的东西），
     * 浏览器半靠这个端点把"改了哪张图、尺寸变没变"画出来。只读，不写 index / 工作区。
     */
    async image(args) {
        const input = toArgs(args);
        const cwd = validateCwd(input.cwd);
        if (!cwd.ok)
            throw Object.assign(new Error(cwd.message), { code: cwd.code });
        const file = validateDiffPath(input.path);
        if (!file.ok)
            throw Object.assign(new Error(file.message), { code: file.code });
        let origFile = null;
        if (input.origPath !== undefined && input.origPath !== null && input.origPath !== '') {
            const checked = validateDiffPath(input.origPath, 'origPath');
            if (!checked.ok)
                throw Object.assign(new Error(checked.message), { code: checked.code });
            origFile = checked.value;
        }
        let sha = null;
        if (input.sha !== undefined && input.sha !== null && input.sha !== '') {
            const checked = validateCommitSha(input.sha);
            if (!checked.ok)
                throw Object.assign(new Error(checked.message), { code: checked.code });
            sha = checked.value;
        }
        return readImagePair(cwd.value, file.value, origFile, input.side === 'index' ? 'index' : 'worktree', sha);
    },
    async log(args) {
        const input = toArgs(args);
        const cwd = validateCwd(input.cwd);
        if (!cwd.ok)
            throw Object.assign(new Error(cwd.message), { code: cwd.code });
        return readLog(cwd.value, input.count);
    },
    /** 标签列表（只读）。点一个 tag 复用 `commit` 那条管道去看它指向的提交。 */
    async tags(args) {
        const input = toArgs(args);
        const cwd = validateCwd(input.cwd);
        if (!cwd.ok)
            throw Object.assign(new Error(cwd.message), { code: cwd.code });
        return readTags(cwd.value, input.count);
    },
    async commit(args) {
        const input = toArgs(args);
        const cwd = validateCwd(input.cwd);
        if (!cwd.ok)
            throw Object.assign(new Error(cwd.message), { code: cwd.code });
        const sha = validateCommitSha(input.sha);
        if (!sha.ok)
            throw Object.assign(new Error(sha.message), { code: sha.code });
        return readCommit(cwd.value, sha.value);
    },
    async 'commit-diff'(args) {
        const input = toArgs(args);
        const cwd = validateCwd(input.cwd);
        if (!cwd.ok)
            throw Object.assign(new Error(cwd.message), { code: cwd.code });
        const sha = validateCommitSha(input.sha);
        if (!sha.ok)
            throw Object.assign(new Error(sha.message), { code: sha.code });
        const file = validateDiffPath(input.path);
        if (!file.ok)
            throw Object.assign(new Error(file.message), { code: file.code });
        let origFile = null;
        if (input.origPath !== undefined && input.origPath !== null && input.origPath !== '') {
            const checked = validateDiffPath(input.origPath, 'origPath');
            if (!checked.ok)
                throw Object.assign(new Error(checked.message), { code: checked.code });
            origFile = checked.value;
        }
        return readCommitDiff(cwd.value, sha.value, file.value, origFile);
    },
    /**
     * 本会话改过哪些文件（按会话归因）。
     *
     * 只读：只回答"这个会话动过哪些路径"，与工作区现状的关系由浏览器半自己用 `status` 求交 —
     * 这样端点不需要知道 git 的事，两个事实各自只有一个来源。
     */
    async 'session-changes'(args) {
        const input = toArgs(args);
        const cwd = validateCwd(input.cwd);
        if (!cwd.ok)
            throw Object.assign(new Error(cwd.message), { code: cwd.code });
        const sessionId = typeof input.sessionId === 'string' && input.sessionId.length > 0 ? input.sessionId : null;
        return readSessionChanges(cwd.value, sessionId);
    },
};
/** 响应信封：`{ type:"server-response", rpcId, result }`。 */
export function envelope(rpcId, result) {
    return { type: 'server-response', rpcId, result };
}
export function failure(rpcId, code, message, details) {
    return envelope(rpcId, { ok: false, error: { code, message, details: details || {} } });
}
export function sendJson(res, status, body) {
    const payload = JSON.stringify(body) ?? '';
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('content-length', Buffer.byteLength(payload));
    res.end(payload);
}
/** 读请求体，超过上限即拒绝（不继续缓冲）。 */
export function readBody(req, limit) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > limit) {
                reject(Object.assign(new Error('payload too large'), { code: 'too-large' }));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}
/** 从异常里取诊断码（没有就退回调用方给的兜底值）。 */
function errorCodeOf(error, fallback) {
    if (error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string')
        return error.code;
    return fallback;
}
function connectionFenceOf(ctx) {
    const service = ctx.get('connection');
    if (!service || typeof service !== 'object')
        return null;
    if (!('requestRejection' in service) || typeof service.requestRejection !== 'function')
        return null;
    return service;
}
function clientRequestOf(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return null;
    const record = value;
    if (record.type !== 'client-request')
        return null;
    if (typeof record.rpcId !== 'string' || typeof record.method !== 'string')
        return null;
    if (!('payload' in record))
        return null;
    return { rpcId: record.rpcId, method: record.method, payload: record.payload };
}
/** 信封不合法但还能读出一个 rpcId 时，把它回显到错误信封里；否则用固定占位。 */
function fallbackRpcIdOf(value) {
    if (value !== null &&
        typeof value === 'object' &&
        'rpcId' in value &&
        typeof value.rpcId === 'string')
        return value.rpcId;
    return 'invalid-request';
}
/**
 * 路由处理器：先过 Connection 围栏，再解析信封，最后分发到端点。
 * 非 POST → 405，非 JSON → 415，超限 → 413，通道外路径 → 404。
 */
export async function handleRequest(ctx, req, res) {
    const connection = connectionFenceOf(ctx);
    if (connection === null) {
        res.statusCode = 503;
        res.end();
        return;
    }
    const rejection = connection.requestRejection(req);
    if (rejection !== undefined) {
        res.statusCode = rejection;
        res.end();
        return;
    }
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end();
        return;
    }
    const contentType = String(req.headers['content-type'] || '');
    if (!contentType.includes('application/json')) {
        res.statusCode = 415;
        res.end();
        return;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    // 不能只靠「前缀路由已经过滤过路径」：路由是挂载契约，处理器仍要自己确认，
    // 否则 `/somewhere-else` 会被 slice 成一段垃圾端点名。
    if (pathname !== CHANNEL && !pathname.startsWith(`${CHANNEL}/`)) {
        res.statusCode = 404;
        res.end();
        return;
    }
    const endpoint = pathname === CHANNEL ? '' : pathname.slice(CHANNEL.length + 1);
    if (!endpoint || endpoint.includes('/')) {
        res.statusCode = 404;
        res.end();
        return;
    }
    let raw;
    try {
        raw = await readBody(req, MAX_BODY_BYTES);
    }
    catch (error) {
        res.statusCode = errorCodeOf(error, '') === 'too-large' ? 413 : 400;
        res.end();
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        sendJson(res, 400, failure('invalid-request', 'internal', 'invalid client-request message', {
            code: 'invalid-request',
        }));
        return;
    }
    const message = clientRequestOf(parsed);
    if (message === null) {
        sendJson(res, 400, failure(fallbackRpcIdOf(parsed), 'internal', 'invalid client-request message', {
            code: 'invalid-request',
        }));
        return;
    }
    const rpcId = message.rpcId;
    const handler = Object.prototype.hasOwnProperty.call(ENDPOINTS, endpoint)
        ? ENDPOINTS[endpoint]
        : null;
    if (handler === null) {
        // 未知方法按 JSON-RPC 语义回 200 + 错误信封：非 2xx 会被浏览器侧的传输层
        // 当成连接失败，插件自己的 details.code 就再也到不了界面。
        sendJson(res, 200, failure(rpcId, 'internal', `unknown endpoint: ${endpoint}`, { code: 'unknown-endpoint' }));
        return;
    }
    const payload = message.payload;
    const args = payload !== null && payload !== undefined && typeof payload === 'object'
        ? payload.args
        : undefined;
    try {
        const value = await handler(args);
        sendJson(res, 200, envelope(rpcId, { ok: true, value }));
    }
    catch (error) {
        const code = errorCodeOf(error, 'git-failed');
        const text = error instanceof Error ? error.message : String(error);
        // 线路上的 error.code 固定为 "internal"，插件自己的诊断码放在 details.code，
        // 由浏览器半按码做本地化文案。
        sendJson(res, 200, failure(rpcId, 'internal', text, { code }));
    }
}
