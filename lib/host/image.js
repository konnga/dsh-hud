import { resolveCommit, runGit, runGitBytes } from './git.js';
import fs from 'node:fs';
import path from 'node:path';
/**
 * 图片改动：按文件头认图片、读两侧尺寸与字节、把不可预览的原因说清楚。
 */
/**
 * 单侧图片预览的字节上限。
 *
 * 超限不等于"看不了这个改动"：仍然回报真实字节数，只是不把内容塞进 JSON
 * （base64 还要再涨 1/3，RPC 体量必须有界）。
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** PNG 的签名（8 字节）。 */
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/**
 * 从**内容**而不是扩展名认图片类型（扩展名会骗人：`.png` 里放 gif 很常见）。
 *
 * @param buffer - 文件头若干字节。
 * @returns MIME 字符串，认不出返回 null。
 */
export function sniffImageMime(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12)
        return null;
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE))
        return 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
        return 'image/jpeg';
    const gif = buffer.subarray(0, 6).toString('latin1');
    if (gif === 'GIF87a' || gif === 'GIF89a')
        return 'image/gif';
    if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
        buffer.subarray(8, 12).toString('latin1') === 'WEBP')
        return 'image/webp';
    if (buffer.subarray(0, 2).toString('latin1') === 'BM')
        return 'image/bmp';
    return null;
}
/** PNG：IHDR 紧跟签名，宽高各 4 字节大端。 */
export function pngSize(buffer) {
    if (buffer.length < 24)
        return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
/** GIF：逻辑屏幕描述符，宽高各 2 字节小端。 */
export function gifSize(buffer) {
    if (buffer.length < 10)
        return null;
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}
/**
 * JPEG：从头扫段，找 SOFn（C0–CF，但 C4/C8/CC 不是）里的高/宽。
 *
 * 段长字段是**含自身两字节**的长度，所以下一段起点是 `index + 2 + length`；
 * 填充 0xFF、TEM 与 RSTn 都没有长度字段，只前进一字节。
 */
export function jpegSize(buffer) {
    let index = 2;
    while (index + 9 < buffer.length) {
        if (buffer[index] !== 0xff) {
            index += 1;
            continue;
        }
        const marker = buffer[index + 1];
        if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
            index += 1;
            continue;
        }
        const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isFrame)
            return { width: buffer.readUInt16BE(index + 7), height: buffer.readUInt16BE(index + 5) };
        const length = buffer.readUInt16BE(index + 2);
        if (length < 2)
            return null;
        index += 2 + length;
    }
    return null;
}
/** WebP：VP8X 是 24 位减一、VP8（有损）内嵌 14 位、VP8L（无损）打包在 32 位里。 */
export function webpSize(buffer) {
    if (buffer.length < 30)
        return null;
    const chunk = buffer.subarray(12, 16).toString('latin1');
    if (chunk === 'VP8X')
        return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
    if (chunk === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
        return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && buffer[20] === 0x2f) {
        const packed = buffer.readUInt32LE(21);
        return { width: (packed & 0x3fff) + 1, height: ((packed >> 14) & 0x3fff) + 1 };
    }
    return null;
}
/** BMP：BITMAPINFOHEADER 的宽为有符号、高可为负（自上而下）。 */
export function bmpSize(buffer) {
    if (buffer.length < 26)
        return null;
    const width = buffer.readInt32LE(18);
    const height = buffer.readInt32LE(22);
    if (width <= 0 || height === 0)
        return null;
    return { width, height: Math.abs(height) };
}
/**
 * 读出图片的像素尺寸。纯函数，只读头部，认不出返回 `null`（绝不抛）。
 *
 * @param buffer - 文件内容（头部足够即可，但这里拿的是完整内容）。
 * @param mime - `sniffImageMime` 的结果。
 * @returns `{ width, height }` 或 null。
 */
export function readImageSize(buffer, mime) {
    try {
        if (mime === 'image/png')
            return pngSize(buffer);
        if (mime === 'image/jpeg')
            return jpegSize(buffer);
        if (mime === 'image/gif')
            return gifSize(buffer);
        if (mime === 'image/webp')
            return webpSize(buffer);
        if (mime === 'image/bmp')
            return bmpSize(buffer);
        return null;
    }
    catch {
        return null;
    }
}
/** 一个 git 对象的字节数；对象不存在（新文件还没有索引副本）返回 null。 */
export async function gitBlobSize(repoRoot, spec) {
    const result = await runGit(repoRoot, ['cat-file', '-s', spec]);
    if (!result.ok)
        return null;
    const size = Number.parseInt(result.stdout.trim(), 10);
    return Number.isFinite(size) && size >= 0 ? size : null;
}
/** 判断一侧的内容：能预览就带上 base64 与像素尺寸，否则只说"为什么不能"。 */
export function describeSide(buffer) {
    const bytes = buffer.length;
    const mime = sniffImageMime(buffer);
    if (mime === null)
        return { kind: 'not-image', bytes };
    const size = readImageSize(buffer, mime);
    return {
        kind: 'image',
        mime,
        bytes,
        width: size === null ? null : size.width,
        height: size === null ? null : size.height,
        base64: buffer.toString('base64'),
    };
}
/** 读工作区里的一个文件；不是普通文件、或超过上限，都只回报状态。 */
export async function readWorktreeSide(repoRoot, file) {
    const full = path.resolve(repoRoot, file);
    const rootPrefix = repoRoot.endsWith(path.sep) ? repoRoot : repoRoot + path.sep;
    // validateDiffPath 已经挡掉绝对路径与 `..`；这里再确认落在仓库内（软链接不越界）。
    if (!full.startsWith(rootPrefix))
        return { kind: 'missing' };
    let stats;
    try {
        stats = await fs.promises.stat(full);
    }
    catch {
        return { kind: 'missing' };
    }
    if (!stats.isFile())
        return { kind: 'missing' };
    if (stats.size > MAX_IMAGE_BYTES)
        return { kind: 'too-large', bytes: stats.size, limit: MAX_IMAGE_BYTES };
    try {
        return describeSide(await fs.promises.readFile(full));
    }
    catch {
        return { kind: 'missing' };
    }
}
/** 读一个 git 对象（`<rev>:<path>`，rev 为空串即索引）：不存在即 missing，超限只回报字节数。 */
export async function readGitSide(repoRoot, rev, file) {
    const spec = `${rev}:${file}`;
    const size = await gitBlobSize(repoRoot, spec);
    if (size === null)
        return { kind: 'missing' };
    if (size > MAX_IMAGE_BYTES)
        return { kind: 'too-large', bytes: size, limit: MAX_IMAGE_BYTES };
    const result = await runGitBytes(repoRoot, ['cat-file', 'blob', spec], MAX_IMAGE_BYTES + 64 * 1024);
    if (!result.ok) {
        if (result.killed)
            throw Object.assign(new Error('git cat-file timed out'), { code: 'timeout' });
        return { kind: 'missing' };
    }
    return describeSide(result.stdout);
}
/**
 * 读一个二进制（图片）改动的两侧字节与像素尺寸，全部只读。
 *
 * `side` 与文本 diff 的两枚页签一一对应，这样"未暂存 / 已暂存"在两个视图里指的是同一件事：
 *   - `worktree`（未暂存）：基线 = 索引 `:<path>`，新 = 工作区文件；
 *   - `index`（已暂存）：基线 = `HEAD`，新 = 索引 `:<path>`；
 *   - 给了 `sha`（提交明细）：基线 = 第一父提交（根提交则为空），新 = 该提交。
 *
 * 两侧各自回答"能不能预览"：`kind` 为 `image` / `too-large` / `not-image` / `missing`。
 * 任一侧不可预览都不算失败 —— 另一侧照样能看。
 *
 * @param cwd - 会话工作区（绝对路径）。
 * @param file - 仓库内相对路径。
 * @param origFile - 重命名/复制的原路径，可选。
 * @param side - `'worktree'` | `'index'`，给了 sha 时忽略。
 * @param sha - 提交 sha（提交明细用），可选。
 * @returns `{ repo, path, origPath, side, sha, before, after }`。
 */
export async function readImagePair(cwd, file, origFile = null, side = 'worktree', sha = null) {
    const base = {
        path: file,
        origPath: origFile ?? null,
        side: sha === null ? side : 'commit',
        sha,
    };
    const empty = {
        repo: null,
        ...base,
        before: { kind: 'missing' },
        after: { kind: 'missing' },
    };
    if (sha !== null) {
        const commit = await resolveCommit(cwd, sha);
        if (!commit.repo)
            return empty;
        return {
            repo: commit.repo,
            shortSha: commit.shortSha,
            ...base,
            before: commit.base === null
                ? { kind: 'missing' }
                : await readGitSide(commit.repo, commit.base, origFile ?? file),
            after: await readGitSide(commit.repo, commit.sha, file),
        };
    }
    const root = await runGit(cwd, ['rev-parse', '--show-toplevel']);
    if (!root.ok) {
        if (root.killed)
            throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' });
        if (root.code === 'ENOENT' && !fs.existsSync(cwd))
            throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' });
        if (root.code === 'ENOENT')
            throw Object.assign(new Error('git executable not found'), { code: 'git-missing' });
        return empty;
    }
    const repoRoot = root.stdout.split('\n')[0].trim();
    if (side === 'index') {
        return {
            repo: repoRoot,
            ...base,
            before: await readGitSide(repoRoot, 'HEAD', origFile ?? file),
            after: await readGitSide(repoRoot, '', file),
        };
    }
    return {
        repo: repoRoot,
        ...base,
        before: await readGitSide(repoRoot, '', origFile ?? file),
        after: await readWorktreeSide(repoRoot, file),
    };
}
