import { resolveCommit, runGit } from './git.js';
import { parseDiff, parseNameStatus, parseStatus, truncateDiff } from './parse.js';
import fs from 'node:fs';
import path from 'node:path';
/**
 * git 的查询读取器：状态、差异、提交、标签、审阅签名。
 */
/** 插件名（Cordis 插件面的一部分）。 */
/** 无缓存地采集一次状态（测试与缓存未命中时使用）。 */
export async function readStatus(cwd) {
    const root = await runGit(cwd, ['rev-parse', '--show-toplevel']);
    if (!root.ok) {
        if (root.killed)
            throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' });
        if (root.code === 'ENOENT' && !fs.existsSync(cwd))
            throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' });
        if (root.code === 'ENOENT')
            throw Object.assign(new Error('git executable not found'), { code: 'git-missing' });
        // 其余非零退出（典型是 128）就是"不在仓库里"——这是正常结果，不是错误。
        return {
            repo: null,
            branch: null,
            detached: false,
            oid: null,
            upstream: null,
            ahead: 0,
            behind: 0,
            dirty: false,
            counts: emptyCounts(),
            changes: [],
            truncated: false,
        };
    }
    const repoRoot = root.stdout.split('\n')[0].trim();
    if (!repoRoot) {
        return {
            repo: null,
            branch: null,
            detached: false,
            oid: null,
            upstream: null,
            ahead: 0,
            behind: 0,
            dirty: false,
            counts: emptyCounts(),
            changes: [],
            truncated: false,
        };
    }
    // `--untracked-files=all`：未跟踪**按文件**计，而不是把整个未跟踪目录折成一条。
    // 不这样写的话，`?n` 会比编辑器（以及 `git status -uall`）报的数小得多 —— 目录里 200 个新文件
    // 只算 1 条。代价是 git 要走一遍未跟踪树，所以清单仍受 `MAX_CHANGES` 上限保护（超出置 truncated）。
    const status = await runGit(repoRoot, [
        'status',
        '--porcelain=v2',
        '--branch',
        '-z',
        '--untracked-files=all',
    ]);
    if (!status.ok) {
        if (status.killed)
            throw Object.assign(new Error('git status timed out'), { code: 'timeout' });
        throw Object.assign(new Error(status.stderr.trim() || status.message || 'git status failed'), {
            code: 'git-failed',
        });
    }
    const parsed = parseStatus(status.stdout);
    parsed.repo = repoRoot;
    return parsed;
}
/**
 * "这一版"的签名：给每个改动文件取 `size + mtimeMs`，用来判断"我审过的还是不是现在这一版"。
 *
 * 为什么不用 `git diff --numstat`：行数变化抓不到"同数改写"（把 `foo` 改成 `bar`），而
 * `stat` 的 mtime 对任何一次写都会变 —— 也更便宜（一次 syscall，不用再跑一个 git 进程）。
 * 反过来它也会过报：`touch` 一下（内容没变）就会让"已审"失效 —— 宁可让人多看一眼。
 */
export async function readReviewSignatures(cwd, files) {
    const signatures = {};
    for (const file of files) {
        if (typeof file !== 'string' || file.length === 0)
            continue;
        const absolute = path.join(cwd, file);
        try {
            const info = await fs.promises.stat(absolute);
            signatures[file] = `${info.size}.${Math.round(info.mtimeMs)}`;
        }
        catch {
            // 文件不在了（被删掉 / 被重命名）：给一个"不存在"的签名，别让它跟"没审过"混在一起。
            signatures[file] = 'missing';
        }
    }
    return signatures;
}
export function emptyCounts() {
    return {
        modified: 0,
        added: 0,
        deleted: 0,
        renamed: 0,
        copied: 0,
        typeChanged: 0,
        untracked: 0,
        conflicted: 0,
    };
}
/** 最近提交：默认条数与上限。 */
export const DEFAULT_COMMITS = 10;
export const MAX_COMMITS = 50;
/**
 * 读一个改动路径的**两侧** diff（工作区 / 已暂存），全部只读。
 *
 * 未跟踪文件用 `git diff --no-index -- /dev/null <path>`（该命令以退出码 1 表示
 * "有差异"，属于正常结果）；重命名把原路径一并作为 pathspec 传入。
 *
 * @param cwd - 会话工作区（绝对路径）。
 * @param file - 仓库内相对路径。
 * @param origFile - 重命名/复制的原路径，可选。
 * @returns `{ repo, path, origPath, untracked, worktree, index }`，两侧都是 parseDiff 的结果。
 */
export async function readDiff(cwd, file, origFile = null) {
    const root = await runGit(cwd, ['rev-parse', '--show-toplevel']);
    if (!root.ok) {
        if (root.killed)
            throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' });
        if (root.code === 'ENOENT' && !fs.existsSync(cwd))
            throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' });
        if (root.code === 'ENOENT')
            throw Object.assign(new Error('git executable not found'), { code: 'git-missing' });
        return {
            repo: null,
            path: file,
            origPath: origFile,
            untracked: false,
            worktree: parseDiff(''),
            index: parseDiff(''),
        };
    }
    const repoRoot = root.stdout.split('\n')[0].trim();
    const pathspec = origFile === null || origFile === undefined || origFile === '' ? [file] : [file, origFile];
    const tracked = await runGit(repoRoot, ['ls-files', '--error-unmatch', '--', file]);
    const untracked = !tracked.ok;
    let worktreeText = '';
    let worktreeTruncated = false;
    if (untracked) {
        // 以退出码 1 表示"有差异"，stdout 就是 unified diff。
        const result = await runGit(repoRoot, [
            'diff',
            '--no-index',
            '--no-color',
            '--no-ext-diff',
            '--',
            '/dev/null',
            file,
        ]);
        if (!result.ok && (result.code === 'ENOENT' || result.killed)) {
            throw Object.assign(new Error(result.killed ? 'git diff timed out' : 'git executable not found'), { code: result.killed ? 'timeout' : 'git-missing' });
        }
        worktreeText = result.stdout;
    }
    else {
        const result = await runGit(repoRoot, [
            'diff',
            '--no-color',
            '--no-ext-diff',
            '--',
            ...pathspec,
        ]);
        if (!result.ok)
            throw Object.assign(new Error(result.stderr.trim() || 'git diff failed'), {
                code: 'git-failed',
            });
        worktreeText = result.stdout;
    }
    const indexResult = untracked
        ? { ok: true, stdout: '' }
        : await runGit(repoRoot, ['diff', '--cached', '--no-color', '--no-ext-diff', '--', ...pathspec]);
    if (!indexResult.ok)
        throw Object.assign(new Error(indexResult.stderr?.trim() || 'git diff --cached failed'), {
            code: 'git-failed',
        });
    const worktreeCut = truncateDiff(worktreeText);
    const indexCut = truncateDiff(indexResult.stdout || '');
    const worktree = parseDiff(worktreeCut.text);
    const index = parseDiff(indexCut.text);
    return {
        repo: repoRoot,
        path: file,
        origPath: origFile ?? null,
        untracked,
        worktree: { ...worktree, truncated: worktree.truncated || worktreeCut.truncated },
        index: { ...index, truncated: index.truncated || indexCut.truncated },
    };
}
/**
 * 读最近的提交（只读 `git log`）。
 *
 * 用 NUL 分隔的 `--pretty=format:` 而不是默认格式：提交标题里可以有空格、引号、
 * 甚至制表符，用分隔符切比按列对齐稳。空仓库（还没有任何提交）时 `git log` 以非零
 * 退出，这里返回空列表而不是错误——"还没有提交"是正常状态。
 *
 * @param cwd - 会话工作区（绝对路径）。
 * @param count - 条数，钳制在 1..50，默认 10。
 * @returns `{ repo, commits: [{ sha, author, date, committedAt, refs, subject }] }`。
 */
export async function readLog(cwd, count = DEFAULT_COMMITS) {
    const root = await runGit(cwd, ['rev-parse', '--show-toplevel']);
    if (!root.ok) {
        if (root.killed)
            throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' });
        if (root.code === 'ENOENT' && !fs.existsSync(cwd))
            throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' });
        if (root.code === 'ENOENT')
            throw Object.assign(new Error('git executable not found'), { code: 'git-missing' });
        return { repo: null, commits: [] };
    }
    const repoRoot = root.stdout.split('\n')[0].trim();
    if (!repoRoot)
        return { repo: null, commits: [] };
    const requested = typeof count === 'number' && Number.isFinite(count) ? Math.floor(count) : DEFAULT_COMMITS;
    const limit = Math.min(Math.max(1, requested), MAX_COMMITS);
    const result = await runGit(repoRoot, [
        'log',
        `-n${String(limit)}`,
        '--no-color',
        '--date=short',
        '--pretty=format:%h%x00%an%x00%ad%x00%ct%x00%D%x00%s',
    ]);
    if (!result.ok) {
        // 空仓库 / 无 HEAD：不是错误，就是还没有提交。
        return { repo: repoRoot, commits: [] };
    }
    const commits = result.stdout
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
        const [sha, author, date, seconds, refs, subject] = line.split('\0');
        const at = Number(seconds);
        return {
            sha: sha ?? '',
            author: author ?? '',
            date: date ?? '',
            committedAt: Number.isFinite(at) ? at * 1000 : null,
            refs: refs ? refs.split(', ').filter(Boolean) : [],
            subject: subject ?? '',
        };
    });
    return { repo: repoRoot, commits };
}
/** 这次提交的改动清单 + 元信息（只读 `git diff` / `git show`）。 */
/** 标签列表上限（超出的只报 truncated，不硬塞）。 */
export const TAGS_MAX = 100;
/**
 * 读标签列表（`refs/tags`，按 creatordate 倒序 = 最新的在前）。
 *
 * 两处容易搞错、这里显式处理：
 * - **附注 tag**（annotated）的 `%(objectname)` 是 **tag 对象**的 sha，不是它指向的提交；
 *   要拿提交得用 `%(*objectname)`。轻量 tag 两者相同。列表里显示提交 sha（能对上“最近提交”）。
 * - 主题用 `%(contents:subject)`：附注 tag 是 tag 说明的首行，轻量 tag 拿到的是提交标题 ——
 *   两种情况都比只给一个名字有用；它理论上可以是多行，所以最后一个字段按“剩下全部”再取首行。
 */
export async function readTags(cwd, count = TAGS_MAX) {
    const root = await runGit(cwd, ['rev-parse', '--show-toplevel']);
    if (!root.ok) {
        if (root.killed)
            throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' });
        if (root.code === 'ENOENT' && !fs.existsSync(cwd))
            throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' });
        if (root.code === 'ENOENT')
            throw Object.assign(new Error('git executable not found'), { code: 'git-missing' });
        return { repo: null, tags: [], truncated: false };
    }
    const repoRoot = root.stdout.split('\n')[0].trim();
    if (!repoRoot)
        return { repo: null, tags: [], truncated: false };
    const requested = typeof count === 'number' && Number.isFinite(count) ? Math.floor(count) : TAGS_MAX;
    const limit = Math.min(Math.max(1, requested), TAGS_MAX);
    // 多取一条用来判断“还有更多”（比事后猜“正好等于上限”准确）。
    const result = await runGit(repoRoot, [
        'for-each-ref',
        '--sort=-creatordate',
        `--count=${String(limit + 1)}`,
        '--format=%(refname:short)%00%(objecttype)%00%(objectname:short)%00%(*objectname:short)%00%(creatordate:short)%00%(creatordate:unix)%00%(contents:subject)',
        'refs/tags',
    ]);
    // 没有 tag 时 git 也返回 0（输出为空），不是错误。
    if (!result.ok)
        return { repo: repoRoot, tags: [], truncated: false };
    const lines = result.stdout.split('\n').filter((line) => line.length > 0);
    const tags = lines.map((line) => {
        const parts = line.split('\0');
        const [name, objecttype, objectname, peeled, date, seconds] = parts;
        // 最后一个字段是主题：附注 tag 的说明可能是多行，这里只取首行。
        const subject = parts.slice(6).join('\0').split('\n')[0] ?? '';
        const at = Number(seconds);
        const annotated = objecttype === 'tag';
        // 附注 tag 要“剥一层”拿提交 sha；剥不出来（比如 tag 指向 blob/tree）就退回对象自身的 sha。
        const sha = annotated && peeled ? peeled : objectname;
        return {
            name: name ?? '',
            sha: sha ?? '',
            annotated,
            date: date ?? '',
            committedAt: Number.isFinite(at) ? at * 1000 : null,
            subject,
        };
    });
    // creatordate 同一个秒内的先后 git 不保证（测试里三个 tag 常在同一秒建出来），
    // 再按名字倒序定死 —— 否则界面上同批 tag 每次刷新都可能换位置。
    //
    // 顺序：**先排序再截断**。反过来的话截出来的是 git 的任意顺序（t1、t2），排序再好也没用。
    tags.sort((left, right) => {
        const diff = (right.committedAt ?? 0) - (left.committedAt ?? 0);
        if (diff !== 0)
            return diff;
        return left.name < right.name ? 1 : left.name > right.name ? -1 : 0;
    });
    const truncated = tags.length > limit;
    return { repo: repoRoot, tags: tags.slice(0, limit), truncated };
}
export async function readCommit(cwd, sha) {
    const commit = await resolveCommit(cwd, sha);
    if (!commit.repo)
        return { repo: null, commit: null, files: [], truncated: false };
    // 根提交没有父提交，改用 `show` 与空树比较；其余一律 diff 第一父提交。
    const result = commit.base === null
        ? await runGit(commit.repo, [
            'show',
            '--format=',
            '--no-color',
            '--no-ext-diff',
            '--name-status',
            '-z',
            '-M',
            commit.sha,
        ])
        : await runGit(commit.repo, [
            'diff',
            '--no-color',
            '--no-ext-diff',
            '--name-status',
            '-z',
            '-M',
            commit.base,
            commit.sha,
        ]);
    if (!result.ok) {
        throw Object.assign(new Error(result.stderr.trim() || 'git diff failed'), {
            code: result.killed ? 'timeout' : 'git-failed',
        });
    }
    const { files, truncated } = parseNameStatus(result.stdout);
    return {
        repo: commit.repo,
        commit: {
            sha: commit.sha,
            shortSha: commit.shortSha,
            subject: commit.subject,
            author: commit.author,
            date: commit.date,
            committedAt: commit.committedAt,
            refs: commit.refs,
            merge: commit.parents.length > 1,
        },
        files,
        truncated,
    };
}
/**
 * 读这次提交里某个文件的 diff（相对第一父提交）。
 *
 * 重命名/复制把原路径一并作为 pathspec 传进去，否则 git 只看到"新增 + 删除"而不是
 * 一次移动。未跟踪文件不属于提交，因此这里没有 `--no-index` 那条分支。
 *
 * @returns `{ repo, path, file, origPath, sha, rows, additions, deletions, hunks, binary, truncated }`。
 */
export async function readCommitDiff(cwd, sha, file, origFile = null) {
    const commit = await resolveCommit(cwd, sha);
    if (!commit.repo) {
        return {
            repo: null,
            sha,
            file,
            path: file,
            origPath: origFile,
            ...parseDiff(''),
            truncated: false,
        };
    }
    const pathspec = origFile === null || origFile === undefined || origFile === '' ? [file] : [file, origFile];
    const result = commit.base === null
        ? await runGit(commit.repo, [
            'show',
            '--format=',
            '--no-color',
            '--no-ext-diff',
            '-M',
            commit.sha,
            '--',
            ...pathspec,
        ])
        : await runGit(commit.repo, [
            'diff',
            '--no-color',
            '--no-ext-diff',
            '-M',
            commit.base,
            commit.sha,
            '--',
            ...pathspec,
        ]);
    if (!result.ok) {
        throw Object.assign(new Error(result.stderr.trim() || 'git diff failed'), {
            code: result.killed ? 'timeout' : 'git-failed',
        });
    }
    const cut = truncateDiff(result.stdout);
    const parsed = parseDiff(cut.text);
    return {
        repo: commit.repo,
        sha: commit.sha,
        shortSha: commit.shortSha,
        file,
        path: file,
        origPath: origFile ?? null,
        ...parsed,
        truncated: parsed.truncated || cut.truncated,
    };
}
export const STATUS_CACHE_MS = 1_500;
export const CACHE_MAX_ENTRIES = 32;
export const STATUS_CACHE = new Map();
export const INFLIGHT = new Map();
/** 带 TTL 缓存与在途合并的读取，面板轮询时不会反复跑 git。 */
export async function readStatusCached(cwd, now = Date.now()) {
    const cached = STATUS_CACHE.get(cwd);
    if (cached && now - cached.at < STATUS_CACHE_MS) {
        return cached.value;
    }
    const inflight = INFLIGHT.get(cwd);
    if (inflight)
        return inflight;
    const pending = readStatus(cwd).then((value) => {
        INFLIGHT.delete(cwd);
        STATUS_CACHE.set(cwd, { at: Date.now(), value });
        if (STATUS_CACHE.size > CACHE_MAX_ENTRIES) {
            const oldest = [...STATUS_CACHE.entries()].sort((left, right) => left[1].at - right[1].at)[0];
            if (oldest)
                STATUS_CACHE.delete(oldest[0]);
        }
        return value;
    }, (error) => {
        INFLIGHT.delete(cwd);
        throw error;
    });
    INFLIGHT.set(cwd, pending);
    return pending;
}
