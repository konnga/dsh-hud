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
 *   - `log { cwd, count? }` → 最近提交（短 sha、作者、日期、refs、标题），条数钳制 1..50。
 *
 * git 调用一律 `execFile`（无 shell）、带超时、有界输出，并对同一 cwd 做短 TTL 缓存 +
 * 在途请求合并，避免面板轮询时反复跑 `git status`。
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/** 插件名（Cordis 插件面的一部分）。 */
export const name = 'dsh-hud'

/** 本插件独占的 RPC 通道前缀（浏览器侧用同一常量调用）。 */
export const CHANNEL = '/dsh-hud-rpc'

/**
 * 模块自带的硬依赖声明：Cordis 读这里的 `inject` 做激活门控，
 * `cordis.patch.yml` 的行里因此不再重复写一遍。
 */
export const inject = ['webServer', 'connection']

/** 本地 git 超时：大仓库的 `git status` 也可能要几秒。 */
const GIT_TIMEOUT_MS = 30_000
/** execFile 输出上限，防止异常仓库把内存吃满。 */
const MAX_BUFFER_BYTES = 8 * 1024 * 1024
/** 同一 cwd 的状态缓存时长。 */
const STATUS_CACHE_MS = 1_500
const CACHE_MAX_ENTRIES = 32
/** 改动清单上限；超出只计数并置 `truncated`。 */
const MAX_CHANGES = 200
/** 单文件路径上限，防御异常仓库。 */
const MAX_PATH_LENGTH = 4_096
/** 请求体上限。 */
const MAX_BODY_BYTES = 256 * 1024

/** 控制字符（含 NUL、换行）——出现在路径里即视为非法入参。 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

const STATUS_CACHE = new Map()
const INFLIGHT = new Map()

/** 运行一条 git 命令；永不自造结果，失败就把失败原因交回调用方。 */
function runGit(cwd, args, timeoutMs = GIT_TIMEOUT_MS) {
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
  const records = String(raw).split('\0')

  let branch = null
  let oid = null
  let upstream = null
  let ahead = 0
  let behind = 0
  let detached = false
  let truncated = false

  const counts = {
    modified: 0,
    added: 0,
    deleted: 0,
    renamed: 0,
    copied: 0,
    typeChanged: 0,
    untracked: 0,
    conflicted: 0,
  }
  const changes = []

  /** 跳过 `count` 个空格分隔的字段，返回其后剩余部分（保留路径里的空格）。 */
  const afterFields = (record, count) => {
    let index = 0
    for (let seen = 0; seen < count; seen += 1) {
      const space = record.indexOf(' ', index)
      if (space < 0) return null
      index = space + 1
    }
    return record.slice(index)
  }

  const push = (status, index, worktree, file, origFile) => {
    if (changes.length < MAX_CHANGES) {
      changes.push({
        status,
        index,
        worktree,
        path: origFile ? `${origFile} → ${file}` : file,
        file,
        origFile,
      })
    } else {
      truncated = true
    }
  }

  for (let cursor = 0; cursor < records.length; cursor += 1) {
    const record = records[cursor]
    if (!record) continue

    if (record.startsWith('# branch.head ')) {
      const value = record.slice('# branch.head '.length)
      detached = value === '(detached)'
      branch = detached ? null : value
      continue
    }
    if (record.startsWith('# branch.oid ')) {
      const value = record.slice('# branch.oid '.length)
      oid = value === '(initial)' ? null : value.slice(0, 7)
      continue
    }
    if (record.startsWith('# branch.upstream ')) {
      upstream = record.slice('# branch.upstream '.length) || null
      continue
    }
    if (record.startsWith('# branch.ab ')) {
      const match = /\+(\d+) -(\d+)/.exec(record)
      ahead = Number(match?.[1] ?? 0)
      behind = Number(match?.[2] ?? 0)
      continue
    }

    if (record.startsWith('? ')) {
      counts.untracked += 1
      push('?', '.', '?', record.slice(2))
      continue
    }
    if (record.startsWith('! ')) {
      // 未使用 --ignored，正常不会出现；出现时按未跟踪处理更贴近用户直觉。
      counts.untracked += 1
      push('!', '.', '!', record.slice(2))
      continue
    }
    if (record.startsWith('u ')) {
      counts.conflicted += 1
      const file = afterFields(record, 10)
      if (file !== null) push('!', record.slice(2, 4)[0], record.slice(2, 4)[1], file)
      continue
    }
    if (record.startsWith('1 ') || record.startsWith('2 ')) {
      const renamed = record.startsWith('2 ')
      const xy = record.slice(2, 4)
      // 展示字母：优先取 index 侧，index 为 '.' 时取 worktree 侧（与 codex-hud 同规则）。
      const letter = xy[0] !== '.' ? xy[0] : xy[1]
      const file = afterFields(record, renamed ? 9 : 8)
      let origFile = null
      if (renamed) {
        // 重命名/复制的原路径是紧随其后的一条 NUL 记录。
        cursor += 1
        origFile = records[cursor] || null
      }
      if (letter === 'R') counts.renamed += 1
      else if (letter === 'C') counts.copied += 1
      else if (letter === 'A') counts.added += 1
      else if (letter === 'D') counts.deleted += 1
      else if (letter === 'T') counts.typeChanged += 1
      else counts.modified += 1
      if (file !== null) push(letter, xy[0], xy[1], file, origFile)
    }
  }

  const dirty = Object.values(counts).some(count => count > 0)

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
  }
}

/** 校验浏览器传来的 cwd，只接受绝对、无控制字符、长度有界的路径。 */
export function validateCwd(value) {
  if (typeof value !== 'string' || value.length === 0) return { ok: false, code: 'invalid-cwd', message: 'cwd must be a non-empty string' }
  if (value.length > MAX_PATH_LENGTH) return { ok: false, code: 'invalid-cwd', message: 'cwd is too long' }
  if (CONTROL_CHARS.test(value)) return { ok: false, code: 'invalid-cwd', message: 'cwd contains control characters' }
  if (!path.isAbsolute(value)) return { ok: false, code: 'invalid-cwd', message: 'cwd must be an absolute path' }
  return { ok: true, value }
}

/** 无缓存地采集一次状态（测试与缓存未命中时使用）。 */
export async function readStatus(cwd) {
  const root = await runGit(cwd, ['rev-parse', '--show-toplevel'])

  if (!root.ok) {
    if (root.killed) throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' })
    if (root.code === 'ENOENT' && !fs.existsSync(cwd)) throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' })
    if (root.code === 'ENOENT') throw Object.assign(new Error('git executable not found'), { code: 'git-missing' })
    // 其余非零退出（典型是 128）就是"不在仓库里"——这是正常结果，不是错误。
    return { repo: null, branch: null, detached: false, oid: null, upstream: null, ahead: 0, behind: 0, dirty: false, counts: emptyCounts(), changes: [], truncated: false }
  }

  const repoRoot = root.stdout.split('\n')[0].trim()
  if (!repoRoot) {
    return { repo: null, branch: null, detached: false, oid: null, upstream: null, ahead: 0, behind: 0, dirty: false, counts: emptyCounts(), changes: [], truncated: false }
  }

  const status = await runGit(repoRoot, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=normal'])
  if (!status.ok) {
    if (status.killed) throw Object.assign(new Error('git status timed out'), { code: 'timeout' })
    throw Object.assign(new Error(status.stderr.trim() || status.message || 'git status failed'), { code: 'git-failed' })
  }

  const parsed = parseStatus(status.stdout)
  parsed.repo = repoRoot
  return parsed
}

function emptyCounts() {
  return { modified: 0, added: 0, deleted: 0, renamed: 0, copied: 0, typeChanged: 0, untracked: 0, conflicted: 0 }
}

/** 带 TTL 缓存与在途合并的读取，面板轮询时不会反复跑 git。 */
async function readStatusCached(cwd, now = Date.now()) {
  const cached = STATUS_CACHE.get(cwd)
  if (cached && now - cached.at < STATUS_CACHE_MS) {
    return cached.value
  }

  const inflight = INFLIGHT.get(cwd)
  if (inflight) return inflight

  const pending = readStatus(cwd).then(
    (value) => {
      INFLIGHT.delete(cwd)
      STATUS_CACHE.set(cwd, { at: Date.now(), value })
      if (STATUS_CACHE.size > CACHE_MAX_ENTRIES) {
        const oldest = [...STATUS_CACHE.entries()].sort((left, right) => left[1].at - right[1].at)[0]
        if (oldest) STATUS_CACHE.delete(oldest[0])
      }
      return value
    },
    (error) => {
      INFLIGHT.delete(cwd)
      throw error
    },
  )
  INFLIGHT.set(cwd, pending)
  return pending
}

/** 最近提交：默认条数与上限。 */
const DEFAULT_COMMITS = 10
const MAX_COMMITS = 50

/** 单侧 diff 的文本上限（先按行截断再解析，保证解析量有界）。 */
const MAX_DIFF_CHARS = 200_000
/** 单侧 diff 的行数上限。 */
const MAX_DIFF_ROWS = 2_000

/** diff 行的种类：增 / 删 / 上下文 / hunk 头 / git 自己的文件头。 */
const DIFF_ADD = 'add'
const DIFF_DEL = 'del'
const DIFF_CTX = 'ctx'
const DIFF_HUNK = 'hunk'
const DIFF_META = 'meta'

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
  const lines = String(raw).split('\n')
  const rows = []

  let oldLine = 0
  let newLine = 0
  let inHunk = false
  let additions = 0
  let deletions = 0
  let hunks = 0
  let binary = false
  let truncated = false

  const push = (kind, text, old, next) => {
    if (rows.length >= MAX_DIFF_ROWS) {
      truncated = true
      return false
    }
    rows.push({ kind, text, oldLine: old, newLine: next })
    return true
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    // 末尾那一行空串是 split 的产物，不是 diff 内容。
    if (index === lines.length - 1 && line === '') break

    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      binary = true
      push(DIFF_META, line, null, null)
      continue
    }
    if (line.startsWith('diff --git ')) {
      // 多文件 diff（路径是目录时）：新的一段从这里开始。
      inHunk = false
      push(DIFF_META, line, null, null)
      continue
    }

    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk !== null) {
      inHunk = true
      hunks += 1
      oldLine = Number(hunk[1])
      newLine = Number(hunk[2])
      push(DIFF_HUNK, line, null, null)
      continue
    }

    if (!inHunk) {
      push(DIFF_META, line, null, null)
      continue
    }

    if (line.startsWith('+')) {
      additions += 1
      push(DIFF_ADD, line.slice(1), null, newLine)
      newLine += 1
      continue
    }
    if (line.startsWith('-')) {
      deletions += 1
      push(DIFF_DEL, line.slice(1), oldLine, null)
      oldLine += 1
      continue
    }
    if (line.startsWith(' ')) {
      push(DIFF_CTX, line.slice(1), oldLine, newLine)
      oldLine += 1
      newLine += 1
      continue
    }
    // 反斜杠行（"\ No newline at end of file"）等。
    push(DIFF_META, line, null, null)
  }

  return { rows, additions, deletions, hunks, binary, truncated }
}

/** 按行边界截断文本。 */
function truncateDiff(text) {
  if (text.length <= MAX_DIFF_CHARS) return { text, truncated: false }
  const head = text.slice(0, MAX_DIFF_CHARS)
  const lastBreak = head.lastIndexOf('\n')
  return { text: lastBreak > 0 ? head.slice(0, lastBreak) : head, truncated: true }
}

/** 校验 diff 的仓库内相对路径：必须是相对、无控制字符、无 `..`、不以 `-` 开头。 */
export function validateDiffPath(value, label = 'path') {
  const reject = message => ({ ok: false, code: 'invalid-path', message: `${label}: ${message}` })
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
  const root = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (!root.ok) {
    if (root.killed) throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' })
    if (root.code === 'ENOENT' && !fs.existsSync(cwd)) throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' })
    if (root.code === 'ENOENT') throw Object.assign(new Error('git executable not found'), { code: 'git-missing' })
    return { repo: null, path: file, origPath: origFile, untracked: false, worktree: parseDiff(''), index: parseDiff('') }
  }

  const repoRoot = root.stdout.split('\n')[0].trim()
  const pathspec = origFile === null || origFile === undefined || origFile === '' ? [file] : [file, origFile]

  const tracked = await runGit(repoRoot, ['ls-files', '--error-unmatch', '--', file])
  const untracked = !tracked.ok

  let worktreeText = ''
  let worktreeTruncated = false
  if (untracked) {
    // 以退出码 1 表示"有差异"，stdout 就是 unified diff。
    const result = await runGit(repoRoot, ['diff', '--no-index', '--no-color', '--no-ext-diff', '--', '/dev/null', file])
    if (result.code === 'ENOENT' || result.killed) {
      throw Object.assign(new Error(result.killed ? 'git diff timed out' : 'git executable not found'), { code: result.killed ? 'timeout' : 'git-missing' })
    }
    worktreeText = result.stdout
  }
  else {
    const result = await runGit(repoRoot, ['diff', '--no-color', '--no-ext-diff', '--', ...pathspec])
    if (!result.ok) throw Object.assign(new Error(result.stderr.trim() || 'git diff failed'), { code: 'git-failed' })
    worktreeText = result.stdout
  }

  const indexResult = untracked
    ? { ok: true, stdout: '' }
    : await runGit(repoRoot, ['diff', '--cached', '--no-color', '--no-ext-diff', '--', ...pathspec])
  if (!indexResult.ok) throw Object.assign(new Error(indexResult.stderr?.trim() || 'git diff --cached failed'), { code: 'git-failed' })

  const worktreeCut = truncateDiff(worktreeText)
  const indexCut = truncateDiff(indexResult.stdout || '')
  const worktree = parseDiff(worktreeCut.text)
  const index = parseDiff(indexCut.text)

  return {
    repo: repoRoot,
    path: file,
    origPath: origFile ?? null,
    untracked,
    worktree: { ...worktree, truncated: worktree.truncated || worktreeCut.truncated },
    index: { ...index, truncated: index.truncated || indexCut.truncated },
  }
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
  const root = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (!root.ok) {
    if (root.killed) throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' })
    if (root.code === 'ENOENT' && !fs.existsSync(cwd)) throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' })
    if (root.code === 'ENOENT') throw Object.assign(new Error('git executable not found'), { code: 'git-missing' })
    return { repo: null, commits: [] }
  }

  const repoRoot = root.stdout.split('\n')[0].trim()
  if (!repoRoot) return { repo: null, commits: [] }

  const requested = Number.isFinite(count) ? Math.floor(count) : DEFAULT_COMMITS
  const limit = Math.min(Math.max(1, requested), MAX_COMMITS)

  const result = await runGit(repoRoot, [
    'log',
    `-n${String(limit)}`,
    '--no-color',
    '--date=short',
    '--pretty=format:%h%x00%an%x00%ad%x00%ct%x00%D%x00%s',
  ])
  if (!result.ok) {
    // 空仓库 / 无 HEAD：不是错误，就是还没有提交。
    return { repo: repoRoot, commits: [] }
  }

  const commits = result.stdout
    .split('\n')
    .filter(line => line.length > 0)
    .map((line) => {
      const [sha, author, date, seconds, refs, subject] = line.split('\0')
      const at = Number(seconds)
      return {
        sha: sha ?? '',
        author: author ?? '',
        date: date ?? '',
        committedAt: Number.isFinite(at) ? at * 1000 : null,
        refs: refs ? refs.split(', ').filter(Boolean) : [],
        subject: subject ?? '',
      }
    })

  return { repo: repoRoot, commits }
}

/** 端点表：全部只读；新增端点时在这里登记。 */
const ENDPOINTS = {
  async status(args) {
    const target = args && typeof args === 'object' ? args.cwd : undefined
    const checked = validateCwd(target)
    if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code })
    return readStatusCached(checked.value)
  },

  async diff(args) {
    const input = args && typeof args === 'object' ? args : {}
    const cwd = validateCwd(input.cwd)
    if (!cwd.ok) throw Object.assign(new Error(cwd.message), { code: cwd.code })
    const file = validateDiffPath(input.path)
    if (!file.ok) throw Object.assign(new Error(file.message), { code: file.code })

    let origFile = null
    if (input.origPath !== undefined && input.origPath !== null && input.origPath !== '') {
      const checked = validateDiffPath(input.origPath, 'origPath')
      if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code })
      origFile = checked.value
    }

    return readDiff(cwd.value, file.value, origFile)
  },

  async log(args) {
    const input = args && typeof args === 'object' ? args : {}
    const cwd = validateCwd(input.cwd)
    if (!cwd.ok) throw Object.assign(new Error(cwd.message), { code: cwd.code })
    return readLog(cwd.value, input.count)
  },
}

/* ------------------------------------------------------------------ 线路层 */

/** 响应信封：`{ type:"server-response", rpcId, result }`。 */
function envelope(rpcId, result) {
  return { type: 'server-response', rpcId, result }
}

function failure(rpcId, code, message, details) {
  return envelope(rpcId, { ok: false, error: { code, message, details: details || {} } })
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('content-length', Buffer.byteLength(payload))
  res.end(payload)
}

/** 读请求体，超过上限即拒绝（不继续缓冲）。 */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        const error = new Error('payload too large')
        error.code = 'too-large'
        reject(error)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * 路由处理器：先过 Connection 围栏，再解析信封，最后分发到端点。
 * 非 POST → 405，非 JSON → 415，超限 → 413，通道外路径 → 404。
 */
async function handleRequest(ctx, req, res) {
  const connection = ctx.get('connection')
  if (!connection || typeof connection.requestRejection !== 'function') {
    res.statusCode = 503
    res.end()
    return
  }

  const rejection = connection.requestRejection(req)
  if (rejection !== undefined) {
    res.statusCode = rejection
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end()
    return
  }

  const contentType = String(req.headers['content-type'] || '')
  if (!contentType.includes('application/json')) {
    res.statusCode = 415
    res.end()
    return
  }

  const url = new URL(req.url || '/', 'http://localhost')
  const pathname = url.pathname
  // 不能只靠「前缀路由已经过滤过路径」：路由是挂载契约，处理器仍要自己确认，
  // 否则 `/somewhere-else` 会被 slice 成一段垃圾端点名。
  if (pathname !== CHANNEL && !pathname.startsWith(`${CHANNEL}/`)) {
    res.statusCode = 404
    res.end()
    return
  }
  const endpoint = pathname === CHANNEL ? '' : pathname.slice(CHANNEL.length + 1)
  if (!endpoint || endpoint.includes('/')) {
    res.statusCode = 404
    res.end()
    return
  }

  let raw
  try {
    raw = await readBody(req, MAX_BODY_BYTES)
  }
  catch (error) {
    res.statusCode = error && error.code === 'too-large' ? 413 : 400
    res.end()
    return
  }

  let message
  try {
    message = JSON.parse(raw)
  }
  catch {
    sendJson(res, 400, failure('invalid-request', 'internal', 'invalid client-request message', { code: 'invalid-request' }))
    return
  }

  if (!message || typeof message !== 'object' || Array.isArray(message)
    || message.type !== 'client-request' || typeof message.rpcId !== 'string'
    || typeof message.method !== 'string' || !('payload' in message)) {
    sendJson(res, 400, failure(
      message && typeof message.rpcId === 'string' ? message.rpcId : 'invalid-request',
      'internal',
      'invalid client-request message',
      { code: 'invalid-request' },
    ))
    return
  }

  const rpcId = message.rpcId
  const handler = Object.prototype.hasOwnProperty.call(ENDPOINTS, endpoint) ? ENDPOINTS[endpoint] : null
  if (handler === null) {
    // 未知方法按 JSON-RPC 语义回 200 + 错误信封：非 2xx 会被浏览器侧的传输层
    // 当成连接失败，插件自己的 details.code 就再也到不了界面。
    sendJson(res, 200, failure(rpcId, 'internal', `unknown endpoint: ${endpoint}`, { code: 'unknown-endpoint' }))
    return
  }

  const args = message.payload && typeof message.payload === 'object' ? message.payload.args : undefined
  try {
    const value = await handler(args)
    sendJson(res, 200, envelope(rpcId, { ok: true, value }))
  }
  catch (error) {
    const code = error && typeof error.code === 'string' ? error.code : 'git-failed'
    const text = error instanceof Error ? error.message : String(error)
    // 线路上的 error.code 固定为 "internal"，插件自己的诊断码放在 details.code，
    // 由浏览器半按码做本地化文案。
    sendJson(res, 200, failure(rpcId, 'internal', text, { code }))
  }
}

/* ------------------------------------------------------------------- 插件 */

/**
 * 插件入口。
 * @param ctx - 已注入 webServer 与 connection 的 Cordis 上下文。
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: CHANNEL,
    handler: (req, res) => handleRequest(ctx, req, res),
  }), `dsh-hud: POST ${CHANNEL}/*`)
}

// 导出即插件面：`apply` / `inject` / `name` 供 Cordis 读取；`CHANNEL` / `parseStatus` /
// `validateCwd` / `readStatus` 是可直接单测的单元（前两个是纯函数，最后一个需要真实仓库）。
