import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type {
  HudCommitInfo,
  HudGitBytesResult,
  HudGitResult,
  HudValidation,
  HudValidationFailure,
} from './types.js'

/**
 * git 的调用与解析：执行 git、取 blob 字节、把 sha/路径归一成仓库内的提交与文件。
 */

/** 本地 git 超时：大仓库的 `git status` 也可能要几秒。 */
export const GIT_TIMEOUT_MS = 30_000
/** execFile 输出上限，防止异常仓库把内存吃满。 */
export const MAX_BUFFER_BYTES = 8 * 1024 * 1024
/** 同一 cwd 的状态缓存时长。 */
export const MAX_PATH_LENGTH = 4_096
/** 请求体上限。 */
/** 控制字符（含 NUL、换行）——出现在路径里即视为非法入参。 */
export const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
/** 运行一条 git 命令；永不自造结果，失败就把失败原因交回调用方。 */
export function runGit(
  cwd: string,
  args: readonly string[],
  timeoutMs = GIT_TIMEOUT_MS,
): Promise<HudGitResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES, windowsHide: true, encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ ok: true, stdout: stdout || '' })
          return
        }
        resolve({
          ok: false,
          stdout: stdout || '',
          stderr: stderr || '',
          killed: Boolean(error.killed) || Boolean(error.signal),
          code: typeof error.code === 'number' ? error.code : (error.code ?? null),
          message: error instanceof Error ? error.message : String(error),
        })
      },
    )
  })
}
/** 校验浏览器传来的 cwd，只接受绝对、无控制字符、长度有界的路径。 */
export function validateCwd(value: unknown): HudValidation {
  if (typeof value !== 'string' || value.length === 0)
    return { ok: false, code: 'invalid-cwd', message: 'cwd must be a non-empty string' }
  if (value.length > MAX_PATH_LENGTH)
    return { ok: false, code: 'invalid-cwd', message: 'cwd is too long' }
  if (CONTROL_CHARS.test(value))
    return { ok: false, code: 'invalid-cwd', message: 'cwd contains control characters' }
  if (!path.isAbsolute(value))
    return { ok: false, code: 'invalid-cwd', message: 'cwd must be an absolute path' }
  return { ok: true, value }
}
/** 提交 sha 的形状：只用十六进制，长度 4..40（面板给的是短 sha）。 */
export const COMMIT_SHA = /^[0-9a-fA-F]{4,40}$/

/**
 * 校验提交 sha。
 *
 * 只收十六进制，因此 `HEAD~1`、`--help`、`origin/main` 这类都进不来——`sha` 会作为
 * 位置参数交给 `git`，只靠 `--` 分隔路径是不够的，必须在入口就把选项形状挡掉。
 */
export function validateCommitSha(value: unknown, label = 'sha'): HudValidation {
  const reject = (message: string): HudValidationFailure => ({
    ok: false,
    code: 'invalid-sha',
    message: `${label}: ${message}`,
  })
  if (typeof value !== 'string' || value.length === 0) return reject('must be a non-empty string')
  if (!COMMIT_SHA.test(value)) return reject('must be 4..40 hex characters')
  return { ok: true, value }
}
/** 校验 diff 的仓库内相对路径：必须是相对、无控制字符、无 `..`、不以 `-` 开头。 */
export function validateDiffPath(value: unknown, label = 'path'): HudValidation {
  const reject = (message: string): HudValidationFailure => ({
    ok: false,
    code: 'invalid-path',
    message: `${label}: ${message}`,
  })
  if (typeof value !== 'string' || value.length === 0) return reject('must be a non-empty string')
  if (value.length > MAX_PATH_LENGTH) return reject('is too long')
  if (CONTROL_CHARS.test(value)) return reject('contains control characters')
  if (path.isAbsolute(value)) return reject('must be repo-relative, not absolute')
  if (/^[\\/]/.test(value)) return reject('must not start with a separator')
  if (value.startsWith('-')) return reject('must not start with "-"')
  if (value.split(/[\\/]/).includes('..')) return reject('must not contain ".."')
  return { ok: true, value }
}
/**
 * 解析仓库根与目标提交的元信息（含父提交），`readCommit` / `readCommitDiff` 共用。
 *
 * 父提交直接从 `%P` 拿：`git log -1` 已经把它给了出来，不必再跑一次 `rev-parse`。
 * 取**第一个**父提交作为比较基准——"这次提交改了什么"对合并提交也是这个意思，
 * 而 `git show` 对合并提交默认给的是"组合差异"，常常是空的，对用户没意义。
 *
 * @returns `{ repo, sha, shortSha, subject, author, date, committedAt, refs, parents, base }`；
 *   `base` 为空串表示这是根提交（与空树比较）。非仓库时 `repo` 为 null。
 */
export async function resolveCommit(cwd: string, sha: string): Promise<HudCommitInfo> {
  const root = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (!root.ok) {
    if (root.killed) throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' })
    if (root.code === 'ENOENT' && !fs.existsSync(cwd))
      throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' })
    if (root.code === 'ENOENT')
      throw Object.assign(new Error('git executable not found'), { code: 'git-missing' })
    return {
      repo: null,
      sha,
      shortSha: sha,
      subject: '',
      author: '',
      date: '',
      committedAt: null,
      refs: [],
      parents: [],
      base: null,
    }
  }

  const repoRoot = root.stdout.split('\n')[0].trim()
  if (!repoRoot)
    return {
      repo: null,
      sha,
      shortSha: sha,
      subject: '',
      author: '',
      date: '',
      committedAt: null,
      refs: [],
      parents: [],
      base: null,
    }

  const result = await runGit(repoRoot, [
    'log',
    '-1',
    '--no-color',
    '--date=short',
    '--pretty=format:%H%x00%h%x00%an%x00%ad%x00%ct%x00%D%x00%P%x00%s',
    sha,
  ])
  if (!result.ok) {
    throw Object.assign(new Error(result.stderr.trim() || 'unknown commit'), {
      code: result.killed ? 'timeout' : 'unknown-commit',
    })
  }

  const [full, short, author, date, seconds, refs, parents, subject] = result.stdout.split('\0')
  const at = Number(seconds)
  const parentList =
    typeof parents === 'string' && parents.length > 0 ? parents.split(' ').filter(Boolean) : []

  return {
    repo: repoRoot,
    sha: full || sha,
    shortSha: short || sha,
    subject: subject ?? '',
    author: author ?? '',
    date: date ?? '',
    committedAt: Number.isFinite(at) ? at * 1000 : null,
    refs: refs ? refs.split(', ').filter(Boolean) : [],
    parents: parentList,
    base: parentList.length > 0 ? parentList[0] : null,
  }
}
/**
 * `runGit` 的字节版。
 *
 * `cat-file blob` 的输出是任意二进制，按 utf8 解码会毁掉它（非法序列变成 U+FFFD，
 * 再编码回去就不是原文件了），所以这条路径必须单独走 buffer 编码。
 */
export function runGitBytes(
  cwd: string,
  args: readonly string[],
  maxBytes: number,
): Promise<HudGitBytesResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: maxBytes, windowsHide: true, encoding: 'buffer' },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ ok: true, stdout })
          return
        }
        resolve({
          ok: false,
          stdout,
          stderr: stderr ? stderr.toString('utf8') : '',
          killed: Boolean(error.killed) || Boolean(error.signal),
          code: typeof error.code === 'number' ? error.code : (error.code ?? null),
          message: error instanceof Error ? error.message : String(error),
        })
      },
    )
  })
}
