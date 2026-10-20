/**
 * git 输出的纯解析器：`git status --porcelain` / unified diff / `--name-status`。
 *
 * 全是**纯函数**（只吃字符串、只吐结构），没有 I/O、没有 ctx、也没有模块级状态 ——
 * 所以它们最先从 `index.ts` 里搬出来：搬运零风险，且 diff 那几家读法都靠它们。
 */
/** 改动清单上限；超出只计数并置 `truncated`。 */
export const MAX_CHANGES = 200;
/** 单文件路径上限，防御异常仓库。 */
/**
 * 解析 `git status --porcelain=v2 --branch -z` 的输出。
 *
 * porcelain-v2 的记录以 NUL 分隔，重命名/复制的记录会多跟一条 NUL 记录作为原路径。
 * 路径本身可能含空格，所以绝不能整行 `split(' ')` —— 按字段数用 `indexOf` 切分。
 *
 * @param raw - git 的原始 stdout。
 * @returns 与 `HudGitStatus` 同形的结果。
 */
export function parseStatus(raw) {
    const records = String(raw).split('\0');
    let branch = null;
    let oid = null;
    let upstream = null;
    let ahead = 0;
    let behind = 0;
    let detached = false;
    let truncated = false;
    const counts = {
        modified: 0,
        added: 0,
        deleted: 0,
        renamed: 0,
        copied: 0,
        typeChanged: 0,
        untracked: 0,
        conflicted: 0,
    };
    const changes = [];
    /** 跳过 `count` 个空格分隔的字段，返回其后剩余部分（保留路径里的空格）。 */
    const afterFields = (record, count) => {
        let index = 0;
        for (let seen = 0; seen < count; seen += 1) {
            const space = record.indexOf(' ', index);
            if (space < 0)
                return null;
            index = space + 1;
        }
        return record.slice(index);
    };
    const push = (status, index, worktree, file, origFile) => {
        if (changes.length < MAX_CHANGES) {
            changes.push({
                status,
                index,
                worktree,
                path: origFile ? `${origFile} → ${file}` : file,
                file,
                origFile,
            });
        }
        else {
            truncated = true;
        }
    };
    for (let cursor = 0; cursor < records.length; cursor += 1) {
        const record = records[cursor];
        if (!record)
            continue;
        if (record.startsWith('# branch.head ')) {
            const value = record.slice('# branch.head '.length);
            detached = value === '(detached)';
            branch = detached ? null : value;
            continue;
        }
        if (record.startsWith('# branch.oid ')) {
            const value = record.slice('# branch.oid '.length);
            oid = value === '(initial)' ? null : value.slice(0, 7);
            continue;
        }
        if (record.startsWith('# branch.upstream ')) {
            upstream = record.slice('# branch.upstream '.length) || null;
            continue;
        }
        if (record.startsWith('# branch.ab ')) {
            const match = /\+(\d+) -(\d+)/.exec(record);
            ahead = Number(match?.[1] ?? 0);
            behind = Number(match?.[2] ?? 0);
            continue;
        }
        if (record.startsWith('? ')) {
            counts.untracked += 1;
            push('?', '.', '?', record.slice(2));
            continue;
        }
        if (record.startsWith('! ')) {
            // 未使用 --ignored，正常不会出现；出现时按未跟踪处理更贴近用户直觉。
            counts.untracked += 1;
            push('!', '.', '!', record.slice(2));
            continue;
        }
        if (record.startsWith('u ')) {
            counts.conflicted += 1;
            const file = afterFields(record, 10);
            if (file !== null)
                push('!', record.slice(2, 4)[0], record.slice(2, 4)[1], file);
            continue;
        }
        if (record.startsWith('1 ') || record.startsWith('2 ')) {
            const renamed = record.startsWith('2 ');
            const xy = record.slice(2, 4);
            // 展示字母：优先取 index 侧，index 为 '.' 时取 worktree 侧（与 codex-hud 同规则）。
            const letter = xy[0] !== '.' ? xy[0] : xy[1];
            const file = afterFields(record, renamed ? 9 : 8);
            let origFile = null;
            if (renamed) {
                // 重命名/复制的原路径是紧随其后的一条 NUL 记录。
                cursor += 1;
                origFile = records[cursor] || null;
            }
            if (letter === 'R')
                counts.renamed += 1;
            else if (letter === 'C')
                counts.copied += 1;
            else if (letter === 'A')
                counts.added += 1;
            else if (letter === 'D')
                counts.deleted += 1;
            else if (letter === 'T')
                counts.typeChanged += 1;
            else
                counts.modified += 1;
            if (file !== null)
                push(letter, xy[0], xy[1], file, origFile);
        }
    }
    const dirty = Object.values(counts).some((count) => count > 0);
    return {
        repo: null, // 由调用方填入仓库根
        branch: branch ?? oid,
        detached,
        oid,
        upstream,
        ahead,
        behind,
        dirty,
        counts,
        changes,
        truncated,
    };
}
/** 单侧 diff 的文本上限（先按行截断再解析，保证解析量有界）。 */
export const MAX_DIFF_CHARS = 200_000;
/** 单侧 diff 的行数上限。 */
export const MAX_DIFF_ROWS = 2_000;
/** diff 行的种类：增 / 删 / 上下文 / hunk 头 / git 自己的文件头。 */
export const DIFF_ADD = 'add';
export const DIFF_DEL = 'del';
export const DIFF_CTX = 'ctx';
export const DIFF_HUNK = 'hunk';
export const DIFF_META = 'meta';
/**
 * 把 `git diff` 文本解析成带行号的 rows。
 *
 * 放在宿主半而不是浏览器半：解析是纯函数，可以直接单测，客户端只负责渲染。
 * 行号从每个 hunk 头 `@@ -a,b +c,d @@` 起算；git 自己的文件头（`diff --git`、
 * `index`、`---`、`+++`）只在 hunk 之外识别，因此**内容行**里以 `--`/`++`/`@@`
 * 开头的文本不会被误判。
 *
 * @param raw - git 的原始 stdout。
 * @returns `{ rows, additions, deletions, hunks, binary, truncated }`。
 */
export function parseDiff(raw) {
    const lines = String(raw).split('\n');
    const rows = [];
    let oldLine = 0;
    let newLine = 0;
    let inHunk = false;
    let additions = 0;
    let deletions = 0;
    let hunks = 0;
    let binary = false;
    let truncated = false;
    const push = (kind, text, old, next) => {
        if (rows.length >= MAX_DIFF_ROWS) {
            truncated = true;
            return false;
        }
        rows.push({ kind, text, oldLine: old, newLine: next });
        return true;
    };
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        // 末尾那一行空串是 split 的产物，不是 diff 内容。
        if (index === lines.length - 1 && line === '')
            break;
        if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
            binary = true;
            push(DIFF_META, line, null, null);
            continue;
        }
        if (line.startsWith('diff --git ')) {
            // 多文件 diff（路径是目录时）：新的一段从这里开始。
            inHunk = false;
            push(DIFF_META, line, null, null);
            continue;
        }
        const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
        if (hunk !== null) {
            inHunk = true;
            hunks += 1;
            oldLine = Number(hunk[1]);
            newLine = Number(hunk[2]);
            push(DIFF_HUNK, line, null, null);
            continue;
        }
        if (!inHunk) {
            push(DIFF_META, line, null, null);
            continue;
        }
        if (line.startsWith('+')) {
            additions += 1;
            push(DIFF_ADD, line.slice(1), null, newLine);
            newLine += 1;
            continue;
        }
        if (line.startsWith('-')) {
            deletions += 1;
            push(DIFF_DEL, line.slice(1), oldLine, null);
            oldLine += 1;
            continue;
        }
        if (line.startsWith(' ')) {
            push(DIFF_CTX, line.slice(1), oldLine, newLine);
            oldLine += 1;
            newLine += 1;
            continue;
        }
        // 反斜杠行（"\ No newline at end of file"）等。
        push(DIFF_META, line, null, null);
    }
    return { rows, additions, deletions, hunks, binary, truncated };
}
/** 按行边界截断文本。 */
export function truncateDiff(text) {
    if (text.length <= MAX_DIFF_CHARS)
        return { text, truncated: false };
    const head = text.slice(0, MAX_DIFF_CHARS);
    const lastBreak = head.lastIndexOf('\n');
    return { text: lastBreak > 0 ? head.slice(0, lastBreak) : head, truncated: true };
}
/**
 * 解析 `git diff --name-status -z` 的输出。
 *
 * `-z` 用 NUL 收尾，所以含空格/引号的路径原样给出（不会像默认输出那样带引号转义）：
 * 一段是 `STATUS\0PATH\0`，重命名/复制则是 `R075\0OLD\0NEW\0`。返回的每条与
 * `status.changes` 同形（`status` 只留 M/A/D/R/C/T/U/X 这类单字母），这样左栏的
 * 改动清单组件可以直接渲染这次的提交。
 *
 * @param raw - git 的原始 stdout。
 * @returns `{ files, truncated }`，条数上限与工作区清单一致。
 */
export function parseNameStatus(raw) {
    const tokens = String(raw).split('\0');
    const files = [];
    let truncated = false;
    for (let cursor = 0; cursor < tokens.length;) {
        const status = tokens[cursor];
        cursor += 1;
        // 收尾的 NUL 会留一个空段；非状态行的段落一律跳过，而不是把垃圾当路径。
        if (!status || !/^[A-Z]/.test(status))
            continue;
        const letter = status.slice(0, 1);
        const paired = letter === 'R' || letter === 'C';
        const first = tokens[cursor];
        cursor += 1;
        const second = paired ? tokens[cursor] : null;
        if (paired)
            cursor += 1;
        if (typeof first !== 'string' || first === '')
            continue;
        const file = paired ? second : first;
        const origFile = paired ? first : null;
        if (typeof file !== 'string' || file === '')
            continue;
        if (files.length >= MAX_CHANGES) {
            truncated = true;
            break;
        }
        files.push({
            status: letter,
            path: origFile === null ? file : `${origFile} → ${file}`,
            file,
            origFile,
        });
    }
    return { files, truncated };
}
