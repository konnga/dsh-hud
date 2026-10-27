/**
 * 「按当前会话的模型来源查余额」——宿主半的编排层。
 *
 * 这一层只做四件事，协议细节全在 `providers.ts`：
 *
 *   1. **定位账本**：`sessionId` → 会话 → `modelSelection` 投影 → 提供方 id。
 *   2. **查它的连接事实**：从「设置 → 模型」的实时投影里读 `baseURL` 与凭据引用名
 *      （不另存一份，避免与用户改动漂移）。
 *   3. **取密钥**：向 `credentials` 服务要一次，只发给**这个提供方自己的 baseURL**，
 *      不进日志、不回浏览器。
 *   4. **缓存**：按提供方缓存一分钟 —— 余额胶囊五秒级的轮询不能变成对中转站的炮击
 *      （中转站被轮询打脸会限流，那才是真的"查不到余额"）。
 *
 * 所有失败路径都返回**带原因的空结果**，而不是抛异常：余额胶囊按"读不到就不画"的规矩
 * 处理，插件其余部分不受影响。
 */
import { PROVIDER_CACHE_MS, factsFromSettings, failureOf, fetchProviderBalance, fetchUserBalance, } from './providers.js';
import { sessionById, sessionModelSelection } from './services.js';
/** 设置投影的缓存时长：用户改配置是低频动作，但改完应当很快生效。 */
export const FACTS_CACHE_MS = 5000;
/**
 * 建一个"按会话查余额"的读取器（每个插件实例一个，自己持有缓存）。
 *
 * @param ctx - 宿主上下文（用 `get` 取 settings / credentials）。
 * @param deps - 取数、时钟与中断信号（测试注入）。
 * @returns 读一次余额的函数。
 */
export function createProviderBalanceReader(ctx, deps) {
    /** 提供方 id → 最近一次结果（含"取不到"的原因，避免失败时也去炮击站点）。 */
    var cache = new Map();
    /** 设置投影缓存（`facts` 与取到的时刻）。 */
    var factsCache = null;
    /** 从设置读一次提供方连接事实（带短 TTL）。 */
    function readFacts() {
        var now = deps.now();
        if (factsCache !== null && now - factsCache.at < FACTS_CACHE_MS)
            return factsCache.facts;
        var settings = serviceOf(ctx, 'settings');
        var facts = new Map();
        if (settings !== null) {
            try {
                // 只读 `baseURL` 与凭据引用名；关掉 secret 字段才拿得到的那些值我们一个都不碰。
                var descriptors = settings.describe();
                if (Array.isArray(descriptors))
                    facts = factsFromSettings(descriptors);
            }
            catch {
                facts = new Map();
            }
        }
        factsCache = { at: now, facts: facts };
        return facts;
    }
    /** 按提供方的凭据引用名取一次密钥（取不到就是 `null`，不是错误）。 */
    async function readKey(apiKeyEnv) {
        var credentials = serviceOf(ctx, 'credentials');
        if (credentials === null)
            return null;
        try {
            var hit = await credentials.resolve(apiKeyEnv);
            if (!hit || typeof hit.value !== 'string' || hit.value === '')
                return null;
            return hit.value;
        }
        catch {
            return null;
        }
    }
    /**
     * 问一次这个提供方的后台凭据是否已配。
     *
     * 只问 `describe`（不回值）：客户端只需要知道"要不要弹设置面板"，
     * 把令牌发到浏览器毫无必要，也不该发。
     *
     * @param facts - 提供方事实（令牌引用名从里面取）。
     * @returns 状态；这个提供方不可配令牌时回 `null`。
     */
    async function tokenStateOf(facts) {
        var ref = facts.accessTokenEnv;
        if (typeof ref !== 'string' || ref === '')
            return null;
        var credentials = serviceOf(ctx, 'credentials');
        if (credentials === null)
            return { ref: ref, configured: false };
        try {
            if (typeof credentials.describe !== 'function') {
                // 没有 `describe` 的旧实现：退回 `resolve` 看一眼有没有值（只要"有没有"，不留值）。
                var hit = await credentials.resolve(ref);
                return { ref: ref, configured: !!hit && typeof hit.value === 'string' && hit.value !== '' };
            }
            var described = await credentials.describe(ref);
            return { ref: ref, configured: described !== undefined && described.configured === true };
        }
        catch {
            return { ref: ref, configured: false };
        }
    }
    /**
     * 用 API Key 读一次"本 Key 的累计已用"；没 Key 或读不到都回 `null`。
     *
     * @param facts - 提供方事实。
     * @returns 这一路的结论；不可用回 `null`。
     */
    async function readKeyValue(facts) {
        var key = await readKey(facts.apiKeyEnv);
        // 区分"根本没配 Key"与"配了但读不到"：前者该报 `no-key`（用户得去配），
        // 后者是站点的问题。合并成一个 `unsupported` 会把这两种处境混成一句话。
        if (key === null)
            return { status: 'no-key' };
        var value = await fetchProviderBalance(facts, key, deps);
        return value === null ? { status: 'failed' } : { status: 'value', value: value };
    }
    /**
     * 把两条路的结论并成一份载荷。
     *
     * 合并规则：账号路的数**优先**（它是后台那个"当前余额"），但 Key 路的
     * `usedKey` 照样带上 —— 两本账都要让人看见。只有两条路都空才算失败。
     *
     * @param provider - 提供方 id。
     * @param kind - 官方还是中转站。
     * @param account - 账号路的结论。
     * @param key - Key 路的结论。
     * @returns 合并后的结论。
     */
    function mergeOutcomes(provider, kind, account, keyResult) {
        var key = keyResult.status === 'value' ? keyResult.value : null;
        if (account === null && key === null) {
            return {
                ok: false,
                failure: failureOf(provider, kind, keyResult.status === 'no-key' ? 'no-key' : 'unsupported'),
            };
        }
        if (account !== null && key === null)
            return { ok: true, value: account };
        if (account === null && key !== null)
            return { ok: true, value: key };
        // 两条都有：以账号路的读数为准，补上 Key 自己那份"已用"与 Key 路的占位标记。
        return {
            ok: true,
            value: {
                provider: provider,
                kind: kind,
                currency: account.currency,
                remaining: account.remaining,
                usedAccount: account.usedAccount,
                // 账号路没有这个数时，用 Key 路的顶上；两条路都有则**都留着**（下面的 usedKey）。
                usedKey: key.usedKey,
                requests: account.requests,
                // 只要账号路拿到了真实余额，就不是"无限额度占位"。
                placeholderLimit: account.remaining === null ? key.placeholderLimit : false,
                wallets: account.wallets,
                bonus: account.bonus,
                at: Math.max(account.at, key.at),
            },
        };
    }
    /**
     * 用网页访问令牌读一次**账号级**余额；没配令牌或读不到都回 `null`。
     *
     * 这条路是"有则更好"：配了就能看到中转站后台那个"当前余额"，
     * 没配就安静退回用量那一路 —— 绝不能因为缺令牌而让胶囊整枚消失。
     *
     * @param facts - 提供方事实（含推导出来的令牌引用名）。
     * @returns 账号级余额；不可用回 `null`。
     */
    async function readAccountBalance(facts) {
        var tokenEnv = facts.accessTokenEnv;
        if (typeof tokenEnv !== 'string' || tokenEnv === '')
            return null;
        var accessToken = await readKey(tokenEnv);
        if (accessToken === null)
            return null;
        var userId = typeof facts.userIdEnv === 'string' ? await readKey(facts.userIdEnv) : null;
        return fetchUserBalance(facts, accessToken, userId, deps);
    }
    return async function readProviderBalance(sessionId, force) {
        var session = sessionById(sessionId);
        if (session === null)
            return { ok: false, failure: failureOf(null, null, 'no-session') };
        var selection = sessionModelSelection(session);
        if (selection === null)
            return { ok: false, failure: failureOf(null, null, 'no-provider') };
        var provider = selection.provider;
        // DeepSeek 平台账号：客户端已经用 `remote.account.getBalance` 拿到同一份数，
        // 宿主不再走一遍（两条路径取同一个数只会多一处漂移）。
        if (provider === 'deepseek-account') {
            return { ok: true, value: null, account: true };
        }
        // `force` = 用户点了胶囊：跳过缓存。否则"我刚配好令牌，怎么还是旧数"这件事
        // 会持续一分钟 —— 而点胶囊本身就是"我怀疑这个数是旧的"那个动作。
        var cached = cache.get(provider);
        if (force !== true && cached !== undefined && deps.now() - cached.at < PROVIDER_CACHE_MS) {
            // token 状态**不进缓存**：刚配好令牌的那一刻它就该变，等一分钟是没法解释的行为。
            return await withToken(cached.outcome, cached.facts);
        }
        var known = readFacts();
        var facts = known.get(provider);
        if (facts === undefined) {
            // 没有连接事实就不知道它的令牌引用名，也就没有 token 状态可给 —— 直接回，
            // 也不进缓存（设置投影可能只是还没就绪，缓存一分钟反而延长了错误的寿命）。
            // 把"我们实际认出了哪些提供方"带在 message 里：这条消息不会画到界面上，
            // 但会进客户端 probe 日志 —— 下次有人问"为什么只显示一个 `—`"，一眼就知道
            // 是设置投影没读到（known 空）、还是 id 对不上（known 里有别的）。
            return {
                ok: false,
                failure: failureOf(provider, null, 'unknown-provider', 'known providers: ' + (known.size === 0 ? '(none)' : [...known.keys()].join(', '))),
                token: null,
            };
        }
        // 两条路**都走一遍再合并**，不是二选一：它们给的是两本不同的账。
        //   - 账号路（要后台凭据）：剩余余额 + 账号累计已用 + 请求数；
        //   - Key 路（API Key）：本 Key 累计已用。
        // 站点上这两个"已用"能同时读到（ur：$526.66 vs $479.44），合并后悬停里两个都列出来。
        var accountValue = await readAccountBalance(facts);
        var keyValue = await readKeyValue(facts);
        var outcome = mergeOutcomes(provider, facts.kind, accountValue, keyValue);
        cache.set(provider, { at: deps.now(), outcome: outcome, facts: facts });
        return await withToken(outcome, facts);
    };
    /**
     * 给结论补上"这个提供方的后台凭据配了没"。
     *
     * @param outcome - 余额结论（缓存里的那份，不含 token 状态）。
     * @param facts - 提供方事实。
     * @returns 带 token 状态的新结论（不改缓存里那份）。
     */
    async function withToken(outcome, facts) {
        var token = await tokenStateOf(facts);
        return { ...outcome, token: token };
    }
}
/* ------------------------------------------------ 写后台凭据（给胶囊上的设置面板用） */
/** 令牌长度上限：PAT 通常几十字节，4096 已经宽松到不可能误伤，又能挡住误粘贴整页文本。 */
export const PROVIDER_TOKEN_MAX = 4096;
/**
 * 建一个"把后台凭据写进凭据存储"的写入器（供胶囊上的设置面板调用）。
 *
 * 为什么让插件自己写、而不是让用户去编辑 `~/.dsh/.credentials.yaml`：
 * 那个文件是 DSH 的凭据库，让用户手工改它等于把"配一个令牌"变成"改一个配置文件"——
 * 手滑一个缩进就整份凭据读不出来。这套 UI 只写**一个**引用、且是**推导出来的**那个。
 *
 * 安全边界（三条都必须守）：
 *   1. 只写 `facts.accessTokenEnv`（即 `*_ACCESS_TOKEN`），不接受任意引用名 ——
 *      否则这就是一个"往凭据库里任意写入"的接口；
 *   2. 令牌不回显、不进日志、不缓存；
 *   3. 写之前把站点 / 长度 / 换行都校验一遍，脏数据宁可不写。
 *
 * @param ctx - 宿主上下文（用 `get` 取 settings / credentials）。
 * @returns 写一次令牌的函数。
 */
export function createProviderTokenWriter(ctx) {
    /** 从设置读一次提供方连接事实（写是低频动作，不缓存，让它立刻看到最新投影）。 */
    function factsOf(provider) {
        var settings = serviceOf(ctx, 'settings');
        if (settings === null)
            return null;
        try {
            var descriptors = settings.describe();
            if (!Array.isArray(descriptors))
                return null;
            return factsFromSettings(descriptors).get(provider) ?? null;
        }
        catch {
            return null;
        }
    }
    return async function writeProviderToken(provider, token) {
        if (typeof token !== 'string')
            return { ok: false, reason: 'bad-token' };
        // 去空白是必须的：从浏览器复制令牌十次有八次带一个尾空格或换行。
        var value = token.trim();
        if (value === '' || value.length > PROVIDER_TOKEN_MAX || /\s/.test(value)) {
            return { ok: false, reason: 'bad-token' };
        }
        var facts = factsOf(provider);
        if (facts === null)
            return { ok: false, reason: 'unknown-provider' };
        var ref = facts.accessTokenEnv;
        // 形状不认识的引用名一律不写：这条接口只服务"后台凭据"这一件事。
        if (typeof ref !== 'string' || !ref.endsWith('_ACCESS_TOKEN')) {
            return { ok: false, reason: 'not-supported' };
        }
        var credentials = serviceOf(ctx, 'credentials');
        if (credentials === null || typeof credentials.set !== 'function') {
            return { ok: false, reason: 'no-credentials' };
        }
        try {
            await credentials.set(ref, value);
            return { ok: true, ref: ref };
        }
        catch (error) {
            return {
                ok: false,
                reason: 'failed',
                message: error instanceof Error ? error.message : String(error),
            };
        }
    };
}
/** 从 ctx 取一个服务；类型对不上就当没有（软依赖，缺了安静降级）。 */
function serviceOf(ctx, name) {
    try {
        var service = ctx.get(name);
        if (service === undefined || service === null || typeof service !== 'object')
            return null;
        return service;
    }
    catch {
        return null;
    }
}
