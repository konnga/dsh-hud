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

  // `--untracked-files=all`：未跟踪**按文件**计，而不是把整个未跟踪目录折成一条。
  // 不这样写的话，`?n` 会比编辑器（以及 `git status -uall`）报的数小得多 —— 目录里 200 个新文件
  // 只算 1 条。代价是 git 要走一遍未跟踪树，所以清单仍受 `MAX_CHANGES` 上限保护（超出置 truncated）。
  const status = await runGit(repoRoot, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'])
  if (!status.ok) {
    if (status.killed) throw Object.assign(new Error('git status timed out'), { code: 'timeout' })
    throw Object.assign(new Error(status.stderr.trim() || status.message || 'git status failed'), { code: 'git-failed' })
  }

  const parsed = parseStatus(status.stdout)
  parsed.repo = repoRoot
  return parsed
}

/** 一次最多看多少个工作区（多个会话可能共用一个目录，按目录去重之后再算）。 */
const ROW_STATUS_MAX_WORKTREES = 8

/**
 * 会话一览：每个活着的会话 → （它那个工作区的 git 摘要）+（这个会话自己的改动计数）。
 *
 * 两半各有一个唯一来源：git 那半走带缓存的 `readStatusCached`（按目录去重，多会话共用
 * 一个目录只跑一次 git），"这个会话改过什么"那半直接来自归因记录（本来就按 sessionId 分，
 * 不用再问 git）。**不返回 `changes`**：这一行只要摘要，别把清单也拖过来。
 */
export async function readSessionOverview() {
  if (hostSessions === null) return { sessions: [], unavailable: true, truncated: false, worktrees: 0 }
  let live = []
  try {
    live = hostSessions.list()
  } catch {
    return { sessions: [], unavailable: true, truncated: false, worktrees: 0 }
  }

  // 会话 → 目录；同一个目录只读一次。
  const byCwd = new Map()
  const rows = []
  for (const session of live) {
    const header = session && session.header ? session.header : undefined
    const sessionId = header && typeof header.id === 'string' ? header.id : null
    if (sessionId === null) continue
    const cwd = header && typeof header.cwd === 'string' && header.cwd.length > 0 ? header.cwd : null
    rows.push({ sessionId, cwd })
    if (cwd !== null && !byCwd.has(cwd)) byCwd.set(cwd, null)
  }

  const cwds = [...byCwd.keys()]
  const used = cwds.slice(0, ROW_STATUS_MAX_WORKTREES)
  const truncated = cwds.length > used.length
  await Promise.all(used.map(async (cwd) => {
    try {
      byCwd.set(cwd, await readStatusCached(cwd))
    } catch (error) {
      byCwd.set(cwd, { error: error && error.code ? error.code : 'git-failed' })
    }
  }))

  const sessions = rows.map((row) => {
    // 会话自己的改动计数（确定 / 可能），来自归因记录 —— 与 git 无关，非仓库也能报。
    const entry = sessionChanges.get(row.sessionId)
    const summary = {
      sessionId: row.sessionId,
      cwd: row.cwd,
      mine: entry === undefined ? 0 : entry.files.size,
      possible: entry === undefined ? 0 : entry.possible.size,
    }
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
        const status = row.cwd === null ? undefined : byCwd.get(row.cwd)
        if (status === undefined || status === null || Array.isArray(status.changes) !== true) return 0
        let count = 0
        for (const change of status.changes) if (entry.possible.has(change.file)) count += 1
        return count
      })()
    if (row.cwd === null) return { ...summary, possibleNow: 0, repo: false, error: null }
    const status = byCwd.get(row.cwd)
    if (status === undefined || status === null) return { ...summary, possibleNow: 0, repo: false, error: null, pending: true }
    if (status.error !== undefined) return { ...summary, possibleNow: 0, repo: false, error: status.error }
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
    }
  })

  return { sessions, unavailable: false, truncated, worktrees: used.length }
}

/**
 * "这一版"的签名：给每个改动文件取 `size + mtimeMs`，用来判断"我审过的还是不是现在这一版"。
 *
 * 为什么不用 `git diff --numstat`：行数变化抓不到"同数改写"（把 `foo` 改成 `bar`），而
 * `stat` 的 mtime 对任何一次写都会变 —— 也更便宜（一次 syscall，不用再跑一个 git 进程）。
 * 反过来它也会过报：`touch` 一下（内容没变）就会让"已审"失效 —— 宁可让人多看一眼。
 */
export async function readReviewSignatures(cwd, files) {
  const signatures = {}
  for (const file of files) {
    if (typeof file !== 'string' || file.length === 0) continue
    const absolute = path.join(cwd, file)
    try {
      const info = await fs.promises.stat(absolute)
      signatures[file] = `${info.size}.${Math.round(info.mtimeMs)}`
    } catch {
      // 文件不在了（被删掉 / 被重命名）：给一个"不存在"的签名，别让它跟"没审过"混在一起。
      signatures[file] = 'missing'
    }
  }
  return signatures
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
  const tokens = String(raw).split('\0')
  const files = []
  let truncated = false

  for (let cursor = 0; cursor < tokens.length;) {
    const status = tokens[cursor]
    cursor += 1
    // 收尾的 NUL 会留一个空段；非状态行的段落一律跳过，而不是把垃圾当路径。
    if (!status || !/^[A-Z]/.test(status)) continue

    const letter = status.slice(0, 1)
    const paired = letter === 'R' || letter === 'C'
    const first = tokens[cursor]
    cursor += 1
    const second = paired ? tokens[cursor] : null
    if (paired) cursor += 1

    if (typeof first !== 'string' || first === '') continue
    const file = paired ? second : first
    const origFile = paired ? first : null
    if (typeof file !== 'string' || file === '') continue

    if (files.length >= MAX_CHANGES) {
      truncated = true
      break
    }
    files.push({
      status: letter,
      path: origFile === null ? file : `${origFile} → ${file}`,
      file,
      origFile,
    })
  }

  return { files, truncated }
}

/** 提交 sha 的形状：只用十六进制，长度 4..40（面板给的是短 sha）。 */
const COMMIT_SHA = /^[0-9a-fA-F]{4,40}$/

/**
 * 校验提交 sha。
 *
 * 只收十六进制，因此 `HEAD~1`、`--help`、`origin/main` 这类都进不来——`sha` 会作为
 * 位置参数交给 `git`，只靠 `--` 分隔路径是不够的，必须在入口就把选项形状挡掉。
 */
export function validateCommitSha(value, label = 'sha') {
  const reject = message => ({ ok: false, code: 'invalid-sha', message: `${label}: ${message}` })
  if (typeof value !== 'string' || value.length === 0) return reject('must be a non-empty string')
  if (!COMMIT_SHA.test(value)) return reject('must be 4..40 hex characters')
  return { ok: true, value }
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
async function resolveCommit(cwd, sha) {
  const root = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (!root.ok) {
    if (root.killed) throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' })
    if (root.code === 'ENOENT' && !fs.existsSync(cwd)) throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' })
    if (root.code === 'ENOENT') throw Object.assign(new Error('git executable not found'), { code: 'git-missing' })
    return { repo: null, sha, shortSha: sha, subject: '', author: '', date: '', committedAt: null, refs: [], parents: [], base: null }
  }

  const repoRoot = root.stdout.split('\n')[0].trim()
  if (!repoRoot) return { repo: null, sha, shortSha: sha, subject: '', author: '', date: '', committedAt: null, refs: [], parents: [], base: null }

  const result = await runGit(repoRoot, [
    'log',
    '-1',
    '--no-color',
    '--date=short',
    '--pretty=format:%H%x00%h%x00%an%x00%ad%x00%ct%x00%D%x00%P%x00%s',
    sha,
  ])
  if (!result.ok) {
    throw Object.assign(new Error(result.stderr.trim() || 'unknown commit'), { code: result.killed ? 'timeout' : 'unknown-commit' })
  }

  const [full, short, author, date, seconds, refs, parents, subject] = result.stdout.split('\0')
  const at = Number(seconds)
  const parentList = typeof parents === 'string' && parents.length > 0 ? parents.split(' ').filter(Boolean) : []

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

/** 这次提交的改动清单 + 元信息（只读 `git diff` / `git show`）。 */
/** 标签列表上限（超出的只报 truncated，不硬塞）。 */
const TAGS_MAX = 100

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
  const root = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (!root.ok) {
    if (root.killed) throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' })
    if (root.code === 'ENOENT' && !fs.existsSync(cwd)) throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' })
    if (root.code === 'ENOENT') throw Object.assign(new Error('git executable not found'), { code: 'git-missing' })
    return { repo: null, tags: [], truncated: false }
  }

  const repoRoot = root.stdout.split('\n')[0].trim()
  if (!repoRoot) return { repo: null, tags: [], truncated: false }

  const requested = Number.isFinite(count) ? Math.floor(count) : TAGS_MAX
  const limit = Math.min(Math.max(1, requested), TAGS_MAX)

  // 多取一条用来判断“还有更多”（比事后猜“正好等于上限”准确）。
  const result = await runGit(repoRoot, [
    'for-each-ref',
    '--sort=-creatordate',
    `--count=${String(limit + 1)}`,
    '--format=%(refname:short)%00%(objecttype)%00%(objectname:short)%00%(*objectname:short)%00%(creatordate:short)%00%(creatordate:unix)%00%(contents:subject)',
    'refs/tags',
  ])
  // 没有 tag 时 git 也返回 0（输出为空），不是错误。
  if (!result.ok) return { repo: repoRoot, tags: [], truncated: false }

  const lines = result.stdout.split('\n').filter(line => line.length > 0)
  const tags = lines.map((line) => {
    const parts = line.split('\0')
    const [name, objecttype, objectname, peeled, date, seconds] = parts
    // 最后一个字段是主题：附注 tag 的说明可能是多行，这里只取首行。
    const subject = parts.slice(6).join('\0').split('\n')[0] ?? ''
    const at = Number(seconds)
    const annotated = objecttype === 'tag'
    // 附注 tag 要“剥一层”拿提交 sha；剥不出来（比如 tag 指向 blob/tree）就退回对象自身的 sha。
    const sha = annotated && peeled ? peeled : objectname
    return {
      name: name ?? '',
      sha: sha ?? '',
      annotated,
      date: date ?? '',
      committedAt: Number.isFinite(at) ? at * 1000 : null,
      subject,
    }
  })

  // creatordate 同一个秒内的先后 git 不保证（测试里三个 tag 常在同一秒建出来），
  // 再按名字倒序定死 —— 否则界面上同批 tag 每次刷新都可能换位置。
  //
  // 顺序：**先排序再截断**。反过来的话截出来的是 git 的任意顺序（t1、t2），排序再好也没用。
  tags.sort((left, right) => {
    const diff = (right.committedAt ?? 0) - (left.committedAt ?? 0)
    if (diff !== 0) return diff
    return left.name < right.name ? 1 : (left.name > right.name ? -1 : 0)
  })

  const truncated = tags.length > limit
  return { repo: repoRoot, tags: tags.slice(0, limit), truncated }
}

export async function readCommit(cwd, sha) {
  const commit = await resolveCommit(cwd, sha)
  if (!commit.repo) return { repo: null, commit: null, files: [], truncated: false }

  // 根提交没有父提交，改用 `show` 与空树比较；其余一律 diff 第一父提交。
  const result = commit.base === null
    ? await runGit(commit.repo, ['show', '--format=', '--no-color', '--no-ext-diff', '--name-status', '-z', '-M', commit.sha])
    : await runGit(commit.repo, ['diff', '--no-color', '--no-ext-diff', '--name-status', '-z', '-M', commit.base, commit.sha])
  if (!result.ok) {
    throw Object.assign(new Error(result.stderr.trim() || 'git diff failed'), { code: result.killed ? 'timeout' : 'git-failed' })
  }

  const { files, truncated } = parseNameStatus(result.stdout)
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
  }
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
  const commit = await resolveCommit(cwd, sha)
  if (!commit.repo) {
    return { repo: null, sha, file, path: file, origPath: origFile, ...parseDiff(''), truncated: false }
  }

  const pathspec = origFile === null || origFile === undefined || origFile === '' ? [file] : [file, origFile]
  const result = commit.base === null
    ? await runGit(commit.repo, ['show', '--format=', '--no-color', '--no-ext-diff', '-M', commit.sha, '--', ...pathspec])
    : await runGit(commit.repo, ['diff', '--no-color', '--no-ext-diff', '-M', commit.base, commit.sha, '--', ...pathspec])
  if (!result.ok) {
    throw Object.assign(new Error(result.stderr.trim() || 'git diff failed'), { code: result.killed ? 'timeout' : 'git-failed' })
  }

  const cut = truncateDiff(result.stdout)
  const parsed = parseDiff(cut.text)
  return {
    repo: commit.repo,
    sha: commit.sha,
    shortSha: commit.shortSha,
    file,
    path: file,
    origPath: origFile ?? null,
    ...parsed,
    truncated: parsed.truncated || cut.truncated,
  }
}

/* --------------------------------------------- 二进制预览（图片，只读） */

/**
 * 单侧图片预览的字节上限。
 *
 * 超限不等于"看不了这个改动"：仍然回报真实字节数，只是不把内容塞进 JSON
 * （base64 还要再涨 1/3，RPC 体量必须有界）。
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** PNG 的签名（8 字节）。 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * 从**内容**而不是扩展名认图片类型（扩展名会骗人：`.png` 里放 gif 很常见）。
 *
 * @param buffer - 文件头若干字节。
 * @returns MIME 字符串，认不出返回 null。
 */
export function sniffImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  const gif = buffer.subarray(0, 6).toString('latin1')
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif'
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  if (buffer.subarray(0, 2).toString('latin1') === 'BM') return 'image/bmp'
  return null
}

/** PNG：IHDR 紧跟签名，宽高各 4 字节大端。 */
function pngSize(buffer) {
  if (buffer.length < 24) return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

/** GIF：逻辑屏幕描述符，宽高各 2 字节小端。 */
function gifSize(buffer) {
  if (buffer.length < 10) return null
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
}

/**
 * JPEG：从头扫段，找 SOFn（C0–CF，但 C4/C8/CC 不是）里的高/宽。
 *
 * 段长字段是**含自身两字节**的长度，所以下一段起点是 `index + 2 + length`；
 * 填充 0xFF、TEM 与 RSTn 都没有长度字段，只前进一字节。
 */
function jpegSize(buffer) {
  let index = 2
  while (index + 9 < buffer.length) {
    if (buffer[index] !== 0xff) {
      index += 1
      continue
    }
    const marker = buffer[index + 1]
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      index += 1
      continue
    }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) return { width: buffer.readUInt16BE(index + 7), height: buffer.readUInt16BE(index + 5) }
    const length = buffer.readUInt16BE(index + 2)
    if (length < 2) return null
    index += 2 + length
  }
  return null
}

/** WebP：VP8X 是 24 位减一、VP8（有损）内嵌 14 位、VP8L（无损）打包在 32 位里。 */
function webpSize(buffer) {
  if (buffer.length < 30) return null
  const chunk = buffer.subarray(12, 16).toString('latin1')
  if (chunk === 'VP8X') return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 }
  if (chunk === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L' && buffer[20] === 0x2f) {
    const packed = buffer.readUInt32LE(21)
    return { width: (packed & 0x3fff) + 1, height: ((packed >> 14) & 0x3fff) + 1 }
  }
  return null
}

/** BMP：BITMAPINFOHEADER 的宽为有符号、高可为负（自上而下）。 */
function bmpSize(buffer) {
  if (buffer.length < 26) return null
  const width = buffer.readInt32LE(18)
  const height = buffer.readInt32LE(22)
  if (width <= 0 || height === 0) return null
  return { width, height: Math.abs(height) }
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
    if (mime === 'image/png') return pngSize(buffer)
    if (mime === 'image/jpeg') return jpegSize(buffer)
    if (mime === 'image/gif') return gifSize(buffer)
    if (mime === 'image/webp') return webpSize(buffer)
    if (mime === 'image/bmp') return bmpSize(buffer)
    return null
  }
  catch {
    return null
  }
}

/**
 * `runGit` 的字节版。
 *
 * `cat-file blob` 的输出是任意二进制，按 utf8 解码会毁掉它（非法序列变成 U+FFFD，
 * 再编码回去就不是原文件了），所以这条路径必须单独走 buffer 编码。
 */
function runGitBytes(cwd, args, maxBytes) {
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

/** 一个 git 对象的字节数；对象不存在（新文件还没有索引副本）返回 null。 */
async function gitBlobSize(repoRoot, spec) {
  const result = await runGit(repoRoot, ['cat-file', '-s', spec])
  if (!result.ok) return null
  const size = Number.parseInt(result.stdout.trim(), 10)
  return Number.isFinite(size) && size >= 0 ? size : null
}

/** 判断一侧的内容：能预览就带上 base64 与像素尺寸，否则只说"为什么不能"。 */
function describeSide(buffer) {
  const bytes = buffer.length
  const mime = sniffImageMime(buffer)
  if (mime === null) return { kind: 'not-image', bytes }
  const size = readImageSize(buffer, mime)
  return {
    kind: 'image',
    mime,
    bytes,
    width: size === null ? null : size.width,
    height: size === null ? null : size.height,
    base64: buffer.toString('base64'),
  }
}

/** 读工作区里的一个文件；不是普通文件、或超过上限，都只回报状态。 */
async function readWorktreeSide(repoRoot, file) {
  const full = path.resolve(repoRoot, file)
  const rootPrefix = repoRoot.endsWith(path.sep) ? repoRoot : repoRoot + path.sep
  // validateDiffPath 已经挡掉绝对路径与 `..`；这里再确认落在仓库内（软链接不越界）。
  if (!full.startsWith(rootPrefix)) return { kind: 'missing' }
  let stats
  try {
    stats = await fs.promises.stat(full)
  }
  catch {
    return { kind: 'missing' }
  }
  if (!stats.isFile()) return { kind: 'missing' }
  if (stats.size > MAX_IMAGE_BYTES) return { kind: 'too-large', bytes: stats.size, limit: MAX_IMAGE_BYTES }
  try {
    return describeSide(await fs.promises.readFile(full))
  }
  catch {
    return { kind: 'missing' }
  }
}

/** 读一个 git 对象（`<rev>:<path>`，rev 为空串即索引）：不存在即 missing，超限只回报字节数。 */
async function readGitSide(repoRoot, rev, file) {
  const spec = `${rev}:${file}`
  const size = await gitBlobSize(repoRoot, spec)
  if (size === null) return { kind: 'missing' }
  if (size > MAX_IMAGE_BYTES) return { kind: 'too-large', bytes: size, limit: MAX_IMAGE_BYTES }
  const result = await runGitBytes(repoRoot, ['cat-file', 'blob', spec], MAX_IMAGE_BYTES + 64 * 1024)
  if (!result.ok) {
    if (result.killed) throw Object.assign(new Error('git cat-file timed out'), { code: 'timeout' })
    return { kind: 'missing' }
  }
  return describeSide(result.stdout)
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
  const base = { path: file, origPath: origFile ?? null, side: sha === null ? side : 'commit', sha }
  const empty = { repo: null, ...base, before: { kind: 'missing' }, after: { kind: 'missing' } }

  if (sha !== null) {
    const commit = await resolveCommit(cwd, sha)
    if (!commit.repo) return empty
    return {
      repo: commit.repo,
      shortSha: commit.shortSha,
      ...base,
      before: commit.base === null ? { kind: 'missing' } : await readGitSide(commit.repo, commit.base, origFile ?? file),
      after: await readGitSide(commit.repo, commit.sha, file),
    }
  }

  const root = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (!root.ok) {
    if (root.killed) throw Object.assign(new Error('git rev-parse timed out'), { code: 'timeout' })
    if (root.code === 'ENOENT' && !fs.existsSync(cwd)) throw Object.assign(new Error('cwd does not exist'), { code: 'no-cwd' })
    if (root.code === 'ENOENT') throw Object.assign(new Error('git executable not found'), { code: 'git-missing' })
    return empty
  }

  const repoRoot = root.stdout.split('\n')[0].trim()
  if (side === 'index') {
    return {
      repo: repoRoot,
      ...base,
      before: await readGitSide(repoRoot, 'HEAD', origFile ?? file),
      after: await readGitSide(repoRoot, '', file),
    }
  }
  return {
    repo: repoRoot,
    ...base,
    before: await readGitSide(repoRoot, '', origFile ?? file),
    after: await readWorktreeSide(repoRoot, file),
  }
}

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

/** 一次最多给多少个改动文件算"这一版"的签名（超出的那些只显示"未审"，不报错）。 */
const REVIEW_SIGNATURE_MAX = 200
/** 单个会话最多记多少个文件；超出只计数（`dropped`），不做 LRU 淘汰。 */
const SESSION_CHANGE_MAX_FILES = 500
/** 最多同时记多少个会话（按最近一次改动淘汰最旧的）。 */
const SESSION_CHANGE_MAX_SESSIONS = 32
/** 单个会话最多记多少个"可能相关"的路径（命令旁听来的，优先级低于确定改动）。 */
const SESSION_CHANGE_MAX_POSSIBLE = 300
/** 每个会话留多少条命令历史（面板悬停时能看到"跑过什么"）。 */
const SESSION_COMMAND_MAX = 20
/** 命令在界面上的显示上限（超长命令截断，别把整行撑爆）。 */
const COMMAND_TEXT_MAX = 140
/** 一条命令里最多抽多少个路径（防御性上限）。 */
const COMMAND_PATHS_MAX = 20
/** 每个会话留多少条"最近工具调用"（胶囊悬停里列最近几条）。 */
const TOOL_RECENT_MAX = 12
/** 最多同时记多少个会话的工具活动（与归因那份各自独立淘汰）。 */
const TOOL_SESSIONS_MAX = 32
/** 每个会话最多记多少个技能（超出的只计数不列名）。 */
const TOOL_SKILLS_MAX = 20
/** 参数摘要的显示上限（超长命令/路径截断，别把胶囊撑爆）。 */
const TOOL_SUMMARY_MAX = 60

/**
 * sessionId → { active, recent, counts, total }：这个会话**跑到哪些工具**。
 *
 * 与归因那份记录分开存：归因关心"改了哪些文件"，这份关心"跑了什么"。
 */
const sessionTools = new Map()

/** 取（必要时新建）某个会话的工具活动记录，并做数量上限淘汰。 */
function sessionToolEntry(sessionId) {
  let entry = sessionTools.get(sessionId)
  if (entry === undefined) {
    entry = { active: null, recent: [], counts: new Map(), status: new Map(), skills: new Map(), total: 0 }
    sessionTools.set(sessionId, entry)
    if (sessionTools.size > TOOL_SESSIONS_MAX) {
      const oldest = sessionTools.keys().next().value
      if (oldest !== undefined && oldest !== sessionId) sessionTools.delete(oldest)
    }
  }
  return entry
}

/**
 * 参数里可以安全拿出来做"一行摘要"的键。
 *
 * 只认这些**路径/命令类**的键：工具参数里可能带着整个文件内容（write 的 `content`），
 * 随便取"第一个字符串"就会把内容贴到界面上 —— 所以认不出来就干脆不写摘要。
 */
const TOOL_SUMMARY_KEYS = ['command', 'cmd', 'script', 'filePath', 'path', 'file', 'pattern', 'query', 'url']

/** 「调用技能」那件工具的工具名（`dsh-tool-skill` 注册的名字）。 */
const SKILL_TOOL_NAME = 'skill'

/**
 * 技能名：`skill` 工具的入参是 `{ name: '技能名' }`。
 *
 * 只对这一个工具认 `name` 键 —— 别的工具用 `name` 表达别的东西，不能被当技能名抓走。
 */
function skillNameOf(exec) {
  if (exec === null || typeof exec !== 'object' || exec.name !== SKILL_TOOL_NAME) return null
  const args = exec.arguments
  if (args === null || typeof args !== 'object') return null
  const value = args.name
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, TOOL_SUMMARY_MAX) : null
}

/** 从工具调用参数里取一行摘要（认不出来返回 null，不用兜底去猜）。 */
function toolSummaryOf(exec) {
  const skill = skillNameOf(exec)
  if (skill !== null) return skill
  const args = exec && exec.arguments
  if (args === null || typeof args !== 'object') return null
  for (const key of TOOL_SUMMARY_KEYS) {
    const value = args[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.replace(/\s+/g, ' ').trim().slice(0, TOOL_SUMMARY_MAX)
    }
  }
  return null
}

/** 工具开跑：记下"现在是哪个工具、什么时候开始的"（供胶囊显示实时秒数）。 */
function noteToolStart(exec) {
  try {
    const identity = sessionIdentityOf(exec)
    if (identity === null) return
    const entry = sessionToolEntry(identity.sessionId)
    entry.active = {
      callId: identity.callId,
      name: typeof exec.name === 'string' && exec.name.length > 0 ? exec.name : '?',
      summary: toolSummaryOf(exec),
      startedAt: Date.now(),
    }
    entry.total += 1
    const name = entry.active.name
    entry.counts.set(name, (entry.counts.get(name) || 0) + 1)
    const skill = skillNameOf(exec)
    if (skill !== null) {
      const seen = entry.skills.get(skill)
      entry.skills.set(skill, { count: (seen ? seen.count : 0) + 1, ok: seen ? seen.ok : null })
    }
  } catch {
    // 旁听失败不影响工具本身。
  }
}

/** 工具结束：把这一次挪进"最近"，并清掉 active（只有同一个 callId 才清，避免并发调用互相抹掉）。 */
function noteToolFinish(exec, result) {
  try {
    const identity = sessionIdentityOf(exec)
    if (identity === null) return
    const entry = sessionToolEntry(identity.sessionId)
    const active = entry.active
    const startedAt = active !== null && active.callId === identity.callId ? active.startedAt : null
    entry.recent.push({
      name: active !== null && active.callId === identity.callId ? active.name : (typeof exec.name === 'string' ? exec.name : '?'),
      summary: active !== null && active.callId === identity.callId ? active.summary : toolSummaryOf(exec),
      ok: !resultFailed(result),
      at: Date.now(),
      ms: startedAt === null ? null : Math.max(0, Date.now() - startedAt),
    })
    if (entry.recent.length > TOOL_RECENT_MAX) entry.recent.splice(0, entry.recent.length - TOOL_RECENT_MAX)
    // 每个工具"最近一次调用"的结果：胶囊上每个工具前面那个 ✓/✗ 用它。
    const finished = entry.recent[entry.recent.length - 1]
    if (finished !== undefined) entry.status.set(finished.name, finished.ok === true)
    // 技能自己的最近一次结果（胶囊上可以据此打 ✓/✗）。
    const skill = skillNameOf(exec)
    if (skill !== null && entry.skills.has(skill)) {
      entry.skills.set(skill, { count: entry.skills.get(skill).count, ok: !resultFailed(result) })
    }
    if (active !== null && active.callId === identity.callId) entry.active = null
  } catch {
    // 同上。
  }
}

/**
 * 读出某个会话的工具活动（端点载荷）。
 *
 * `active` 带 `startedAt`：实时秒数由客户端本地计时（否则要为了一个秒数把轮询压到亚秒级 ✗）。
 */
export function readSessionTools(sessionId) {
  const entry = sessionId === null || sessionId === undefined ? undefined : sessionTools.get(sessionId)
  if (entry === undefined) {
    return { sessionId: sessionId ?? null, tracking: true, active: null, recent: [], counts: [], skills: [], skillsDropped: 0, total: 0 }
  }
  const counts = [...entry.counts].map(([name, count]) => ({
    name,
    count,
    // `null` = 还没看到它结束过（比如正在跑第一次），别替它编一个 ✓。
    ok: entry.status.has(name) ? entry.status.get(name) : null,
  }))
  counts.sort((left, right) => right.count - left.count || (left.name < right.name ? -1 : 1))
  // 技能按次数排序（用得多在前），超过上限只报前若干个。
  const skills = [...entry.skills].map(([name, item]) => ({ name, count: item.count, ok: item.ok }))
  skills.sort((left, right) => right.count - left.count || (left.name < right.name ? -1 : 1))
  return {
    sessionId,
    tracking: true,
    active: entry.active === null ? null : { ...entry.active },
    recent: entry.recent.slice(-5).reverse(),
    counts,
    skills: skills.slice(0, TOOL_SKILLS_MAX),
    skillsDropped: Math.max(0, skills.length - TOOL_SKILLS_MAX),
    total: entry.total,
  }
}

/** sessionId → { cwd, since, files: Map<relPath, {...}>, dropped, unconfirmed }。 */
const sessionChanges = new Map()
/** 本次监听开始的时刻 —— 界面说的"自 … 起记录"用的是它（不是"第一条改动的时间"）。 */
let sessionChangeTrackingSince = null
/** callId（没有就退化成 sessionId+路径）→ 尚未配对到 `fs/observed` 的意图。 */
const pendingChangeIntents = new Map()
/**
 * 从会话取"当前回合号"的读取器。
 *
 * `sessionProjections` 是**软依赖**（`ctx.inject` 动态等它到齐）：拿不到就记 `null`，
 * 归因照常工作 —— 绝不因为少一个服务把整块降级掉。
 */
let sessionTurnReader = null
/**
 * 宿主 `sessions` 服务（枚举所有活着的会话）—— 同样是软依赖：拿不到时
 * `session-statuses` 端点报"不可用"，侧栏那枚 chip 就不画，其余功能照旧。
 */
let hostSessions = null

/** 这次调用发生在第几回合（拿不到就是 null，界面据此不显示回合信息）。 */
function currentTurnOf(exec) {
  if (sessionTurnReader === null) return null
  const session = exec && exec.agent ? exec.agent.session : undefined
  if (session === undefined || session === null) return null
  return sessionTurnReader(session)
}

/** 这个会话第一次出现在记录里的时刻（客户端据此说"自 … 起"）。 */
function sessionChangeEntry(sessionId, cwd) {
  let entry = sessionChanges.get(sessionId)
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
    }
    sessionChanges.set(sessionId, entry)
    if (sessionChanges.size > SESSION_CHANGE_MAX_SESSIONS) {
      // 先淘汰最久没动过的那个（Map 保持插入序，删第一个就是最旧的）。
      const oldest = sessionChanges.keys().next().value
      if (oldest !== undefined && oldest !== sessionId) sessionChanges.delete(oldest)
    }
  }
  if (cwd !== undefined && cwd !== null) entry.cwd = cwd
  return entry
}

/** 把绝对路径折成 cwd 之内的 posix 相对路径；在 cwd 之外或拿不到都返回 null。 */
function sessionRelativePath(cwd, absolutePath) {
  if (typeof cwd !== 'string' || cwd.length === 0) return null
  if (typeof absolutePath !== 'string' || absolutePath.length === 0) return null
  if (!path.isAbsolute(absolutePath)) return null
  const relative = path.relative(cwd, absolutePath)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return null
  return relative.split(path.sep).join('/')
}

/**
 * 会自己改文件的"命令行工具"：bash / pwsh / 各种 shell。
 *
 * 用名字前缀匹配而不是精确清单：产品里有 `bash`、`bash-persistent`、`pwsh`、`pwsh-persistent`
 * 等等，将来还会加，硬编码清单一定会过期。
 */
const SHELL_TOOL_RE = /^(?:bash|pwsh|sh|zsh|fish|shell|cmd|powershell|exec_command|run_command|terminal)/i

/** 从工具调用参数里取命令行文本（不同 shell 工具的字段名不一样，按常见几个找）。 */
function shellCommandOf(exec) {
  if (exec === undefined || exec === null) return null
  if (typeof exec.name !== 'string' || !SHELL_TOOL_RE.test(exec.name)) return null
  const args = exec.arguments
  if (args === null || typeof args !== 'object') return null
  for (const key of ['command', 'cmd', 'script', 'input', 'line']) {
    const value = args[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return null
}

/** 按 `; && || | 换行` 切分命令（只为抽路径，不做真正的 shell 解析）。 */
function shellSegments(command) {
  return command
    .split(/\r?\n|;|&&|\|\||\|/)
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0)
}

/** 极简分词：支持单双引号（不处理转义与嵌套），够抽路径用。 */
function shellTokens(segment) {
  const tokens = []
  let current = ''
  let quote = null
  for (const ch of segment) {
    if (quote !== null) {
      if (ch === quote) quote = null
      else current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
      continue
    }
    current += ch
  }
  if (current.length > 0) tokens.push(current)
  return tokens
}

/** 环境变量赋值、sudo/env 之类的包装前缀：抽路径时要跳过。 */
const SHELL_PREFIX_RE = /^(?:[A-Za-z_][A-Za-z0-9_]*=|sudo$|env$|time$|nohup$|command$|builtin$|exec$|then$|do$|if$|while$)/
/** 写入类命令：它们改文件，"目标"在哪一个参数上按命令而定。 */
const WRITE_COMMANDS = new Set([
  'mv', 'cp', 'ln', 'install', 'rsync', 'truncate', 'touch', 'rm', 'unlink',
  'sed', 'perl', 'tee', 'dd', 'patch', 'chmod', 'chown', 'gzip', 'gunzip', 'tar', 'unzip', 'zip',
])
/** 只读命令：即使带了参数也不要记成"可能改过"。 */
const READ_COMMANDS = new Set([
  'cat', 'less', 'more', 'head', 'tail', 'grep', 'rg', 'ls', 'find', 'stat', 'wc', 'file', 'du',
  'diff', 'git', 'echo', 'printf', 'pwd', 'which', 'type', 'env', 'date', 'sort', 'uniq', 'awk',
  'jq', 'node', 'python', 'python3', 'true', 'false', 'test', 'cd', 'export', 'set', 'source',
])

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
function possiblePathsOf(command) {
  const found = new Map()
  const add = (token, reason) => {
    const cleaned = String(token).replace(/^["']|["']$/g, '')
    if (cleaned.length === 0 || cleaned === '/' || cleaned.startsWith('/dev/')) return
    if (/^&?\d+$/.test(cleaned) || cleaned.startsWith('&')) return
    if (cleaned.startsWith('-')) return
    if (cleaned.includes('$') || cleaned.includes('*') || cleaned.includes('?')) return
    if (found.has(cleaned)) return
    found.set(cleaned, reason.slice(0, 80))
  }

  for (const segment of shellSegments(command)) {
    // 1) 重定向与 tee：即使命令本身不认识也要抽。
    const redirects = segment.matchAll(/(?:^|[^0-9<>])>>?\s*([^\s;&|<>()]+)/g)
    for (const match of redirects) add(match[1], segment)
    const tees = segment.matchAll(/\btee\s+(?:-[A-Za-z-]+\s+)*([^\s;&|<>()]+)/g)
    for (const match of tees) add(match[1], segment)

    const tokens = shellTokens(segment).filter(token => !SHELL_PREFIX_RE.test(token))
    let index = 0
    while (index < tokens.length && SHELL_PREFIX_RE.test(tokens[index])) index += 1
    const head = (tokens[index] || '').toLowerCase()
    const args = tokens.slice(index + 1)
    if (head.length === 0) continue

    // 2) 原地编辑：`sed -i … <file>` / `perl -i … <file>` —— 取该段最后一个非 flag 参数。
    if ((head === 'sed' || head === 'perl') && args.some(arg => /^-[A-Za-z]*i/.test(arg))) {
      const last = [...args].reverse().find(arg => !arg.startsWith('-'))
      if (last !== undefined) add(last, segment)
      continue
    }
    // 3) `dd of=…`
    if (head === 'dd') {
      for (const arg of args) if (arg.startsWith('of=')) add(arg.slice(3), segment)
      continue
    }
    // 4) `git checkout|restore <path>`（会覆盖工作区文件）
    if (head === 'git') {
      const sub = (args[0] || '').toLowerCase()
      if (sub === 'checkout' || sub === 'restore') {
        const target = args.slice(1).find(arg => !arg.startsWith('-'))
        if (target !== undefined && target !== '.') add(target, segment)
      }
      continue
    }
    // 5) 写入类命令：`mv/cp/ln/install/rsync` 记目标（最后一个参数）；其余记所有非 flag 参数。
    if (WRITE_COMMANDS.has(head)) {
      if (/^(?:chmod|chown|tar|gzip|gunzip|zip)$/.test(head)) continue
      // `mv` 的源也会"变"（消失），所以源与目标都记；其余写入类命令只记目标。
      if (head === 'mv') {
        for (const arg of args) if (!arg.startsWith('-')) add(arg, segment)
        continue
      }
      if (/^(?:cp|ln|install|rsync|patch)$/.test(head)) {
        const target = [...args].reverse().find(arg => !arg.startsWith('-'))
        if (target !== undefined) add(target, segment)
        continue
      }
      for (const arg of args) if (!arg.startsWith('-')) add(arg, segment)
      continue
    }
    // 其余（含只读命令、以及 npm/pnpm/prettier 这类"可能改了但说不清改哪"的）一律退回命令级提示。
    void READ_COMMANDS
  }
  return [...found].slice(0, COMMAND_PATHS_MAX).map(([pathToken, reason]) => ({ path: pathToken, reason }))
}

/** 命令是不是"看起来只读"（用于命令历史里的标注）。 */
function commandLooksReadOnly(command) {
  const heads = shellSegments(command).map(segment => shellTokens(segment).filter(token => !SHELL_PREFIX_RE.test(token))[0] || '')
  if (heads.length === 0) return false
  return heads.every(head => READ_COMMANDS.has(head.toLowerCase()))
}

/** 结果看起来是失败吗（失败的命令不改文件，就不算"可能相关"）。 */
function resultFailed(result) {
  if (result === null || typeof result !== 'object') return false
  if (result.ok === false) return true
  if (result.isError === true) return true
  return result.error !== undefined && result.error !== null
}

/**
 * 把"第几回合"记到一条记录上（文件 / 可能相关）。
 *
 * `lastTurn` 是最近一次动它的回合，`turns` 是动过它的回合列表（去重、最多 8 个）——
 * 界面用前者做"只看最近一轮"，后者留给悬停说明"这个文件被两轮动过"。
 */
function noteTurnOfRecord(record, turn) {
  record.lastTurn = turn
  if (turn === null) return
  if (!Array.isArray(record.turns)) record.turns = []
  if (record.turns[record.turns.length - 1] !== turn && record.turns.indexOf(turn) === -1) record.turns.push(turn)
  if (record.turns.length > 8) record.turns.splice(0, record.turns.length - 8)
}

/** 从工具执行上下文里取会话身份与工作区；非 agent 调用返回 null。 */
function sessionIdentityOf(exec) {
  const header = exec && exec.agent && exec.agent.session ? exec.agent.session.header : undefined
  if (header === undefined || header === null) return null
  if (typeof header.id !== 'string' || header.id.length === 0) return null
  const cwd = typeof header.cwd === 'string' && header.cwd.length > 0 ? header.cwd : undefined
  return { sessionId: header.id, cwd, callId: exec && typeof exec.callId === 'string' ? exec.callId : null }
}

/** 意图的配对键：优先用调用 id（一次调用一个意图），没有就退化成"会话 + 路径"。 */
function pendingKeyOf(identity, relative) {
  return identity.callId !== null ? `call:${identity.callId}` : `path:${identity.sessionId}\u0000${relative}`;
}

/**
 * 记一次写入/编辑意图（事件回调；绝不抛，也绝不返回 next —— 这是 waterfall 的旁听）。
 * @param target - fs 目标（`displayPath` 是绝对路径）。
 * @param exec - 工具执行上下文。
 * @param kind - `"write"` 或 `"edit"`。
 */
function noteChangeIntent(target, exec, kind) {
  try {
    const identity = sessionIdentityOf(exec)
    if (identity === null) return
    const absolute = target && typeof target.displayPath === 'string' ? target.displayPath : null
    const relative = sessionRelativePath(identity.cwd, absolute)
    if (relative === null) return
    pendingChangeIntents.set(pendingKeyOf(identity, relative), {
      sessionId: identity.sessionId,
      cwd: identity.cwd,
      relative,
      kind,
      at: Date.now(),
    })
    // 配对表也会长：清掉明显过期的（超过 5 分钟还没等到观察的意图）。
    if (pendingChangeIntents.size > 512) {
      const cutoff = Date.now() - 5 * 60 * 1000
      for (const [key, entry] of pendingChangeIntents) if (entry.at < cutoff) pendingChangeIntents.delete(key)
    }
  } catch {
    // 旁听失败不影响写入本身。
  }
}

/**
 * 记一次观察：只有配得上"意图"的才算这次改动落了地（读取引起的观察一律忽略）。
 * @param target - fs 目标。
 * @param exec - 工具执行上下文。
 */
function noteChangeObservation(target, exec) {
  try {
    const identity = sessionIdentityOf(exec)
    if (identity === null) return
    const absolute = target && typeof target.displayPath === 'string' ? target.displayPath : null
    const relative = sessionRelativePath(identity.cwd, absolute)
    if (relative === null) return
    const key = pendingKeyOf(identity, relative)
    const intent = pendingChangeIntents.get(key)
    if (intent === undefined) return
    pendingChangeIntents.delete(key)

    const entry = sessionChangeEntry(intent.sessionId, intent.cwd)
    let file = entry.files.get(intent.relative)
    if (file === undefined) {
      if (entry.files.size >= SESSION_CHANGE_MAX_FILES) {
        entry.dropped += 1
        return
      }
      file = { writes: 0, edits: 0, firstAt: intent.at, lastAt: intent.at, lastTurn: null, turns: [] }
      entry.files.set(intent.relative, file)
    }
    if (intent.kind === 'write') file.writes += 1
    else file.edits += 1
    file.lastAt = Date.now()
    noteTurnOfRecord(file, currentTurnOf(exec))
  } catch {
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
function noteShellCommand(exec, result) {
  try {
    const command = shellCommandOf(exec)
    if (command === null) return
    const identity = sessionIdentityOf(exec)
    if (identity === null) return
    const cwd = typeof identity.cwd === 'string' && identity.cwd.length > 0 ? identity.cwd : null
    const entry = sessionChangeEntry(identity.sessionId, identity.cwd)
    const failed = resultFailed(result)
    const turn = currentTurnOf(exec)
    entry.commands.push({
      tool: exec.name,
      command: command.replace(/\s+/g, ' ').trim().slice(0, COMMAND_TEXT_MAX),
      at: Date.now(),
      turn,
      failed,
      readOnly: commandLooksReadOnly(command),
    })
    if (entry.commands.length > SESSION_COMMAND_MAX) {
      entry.commands.splice(0, entry.commands.length - SESSION_COMMAND_MAX)
    }
    if (failed || cwd === null) return

    for (const candidate of possiblePathsOf(command)) {
      const absolute = path.isAbsolute(candidate.path) ? candidate.path : path.resolve(cwd, candidate.path)
      const relative = sessionRelativePath(cwd, absolute)
      if (relative === null) continue
      let item = entry.possible.get(relative)
      if (item === undefined) {
        if (entry.possible.size >= SESSION_CHANGE_MAX_POSSIBLE) {
          entry.possibleDropped += 1
          continue
        }
        item = { hits: 0, firstAt: Date.now(), lastAt: Date.now(), reason: candidate.reason, lastTurn: turn, turns: [] }
        entry.possible.set(relative, item)
      }
      item.hits += 1
      item.lastAt = Date.now()
      noteTurnOfRecord(item, turn)
      // 最近一次提到它的命令片段更有参考价值。
      item.reason = candidate.reason
    }
  } catch {
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
  const entry = sessionId === null || sessionId === undefined ? undefined : sessionChanges.get(sessionId)
  const mismatched = entry !== undefined && entry.cwd !== undefined && entry.cwd !== null && entry.cwd !== cwd
  const files = []
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
      })
    }
    files.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0))
  }
  const possible = []
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
      })
    }
    possible.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0))
  }
  let unconfirmed = 0
  if (sessionId !== null && sessionId !== undefined) {
    for (const intent of pendingChangeIntents.values()) if (intent.sessionId === sessionId) unconfirmed += 1
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
  }
}

/** 挂上两个事件监听（由 `apply` 调用）。 */
function trackSessionChanges(ctx) {
  return ctx.effect(() => {
    sessionChangeTrackingSince = Date.now()
    const stops = [
      ctx.on('fs/write-intent', (target, exec) => {
        noteChangeIntent(target, exec, 'write')
      }),
      ctx.on('fs/edit-intent', (target, exec) => {
        noteChangeIntent(target, exec, 'edit')
      }),
      ctx.on('fs/observed', (target, observation, exec) => {
        noteChangeObservation(target, exec)
      }),
      // 命令旁听：`tools/post-execute` 是 waterfall，**必须把 next() 的判定原样透传**
      // （兜底是 `{ kind: 'accept' }`，吞掉就等于把工具结果的裁决改掉了）。
      // 工具开跑：记"现在在跑哪个工具"（胶囊显示实时秒数用）。
      // `tools/pre-execute` 同样是 waterfall（兜底 `{ kind: 'allow' }`），必须原样透传判定。
      ctx.on('tools/pre-execute', (exec, next) => {
        noteToolStart(exec)
        return next()
      }),
      ctx.on('tools/post-execute', (exec, result, next) => {
        noteShellCommand(exec, result)
        noteToolFinish(exec, result)
        return next()
      }),
    ]
    // 回合号来自宿主投影 `turnBoundary`。软依赖：这个服务没到齐时 turn 记 null，
    // 归因、面板、胶囊一切照旧（只是不显示"第几轮"）。
    if (typeof ctx.inject === 'function') {
      if (typeof ctx.inject === 'function') {
        stops.push(ctx.inject(['sessions'], (scope) => {
          hostSessions = scope.sessions
          return () => {
            hostSessions = null
          }
        }))
      }
      stops.push(ctx.inject(['sessionProjections'], (scope) => {
        sessionTurnReader = (session) => {
          try {
            const state = scope.sessionProjections.stateOf(session, 'turnBoundary')
            const turn = state === undefined || state === null ? null : state.lastTurn
            return typeof turn === 'number' && turn >= 0 ? turn : null
          } catch {
            return null
          }
        }
        return () => {
          sessionTurnReader = null
        }
      }))
    }
    return () => {
      for (const stop of stops) if (typeof stop === 'function') stop()
      sessionChanges.clear()
      pendingChangeIntents.clear()
      sessionTools.clear()
      sessionChangeTrackingSince = null
    }
  }, 'dsh-hud: session change tracking')
}

/** 端点表：全部只读；新增端点时在这里登记。 */
const ENDPOINTS = {
  async status(args) {
    const input = args && typeof args === 'object' ? args : {}
    const checked = validateCwd(input.cwd)
    if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code })
    const status = await readStatusCached(checked.value)
    // 「审阅进度」要的"这一版"签名：只在客户端明确要的时候才算（胶囊那一路的轮询不用付这个钱）。
    if (input.review === true && Array.isArray(status.changes) && status.changes.length > 0) {
      status.review = await readReviewSignatures(
        checked.value,
        status.changes.slice(0, REVIEW_SIGNATURE_MAX).map(change => change.file),
      )
    }
    return status
  },

  async 'session-tools'(args) {
    const input = args && typeof args === 'object' ? args : {}
    const sessionId = typeof input.sessionId === 'string' && input.sessionId.length > 0 ? input.sessionId : null
    return readSessionTools(sessionId)
  },

  async 'session-statuses'() {
    return readSessionOverview()
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

  /**
   * 图片预览：一个二进制改动两侧的字节与像素尺寸。
   *
   * `diff` 对二进制只回一句 `binary: true`（文本 diff 里没有可看的东西），
   * 浏览器半靠这个端点把"改了哪张图、尺寸变没变"画出来。只读，不写 index / 工作区。
   */
  async image(args) {
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

    let sha = null
    if (input.sha !== undefined && input.sha !== null && input.sha !== '') {
      const checked = validateCommitSha(input.sha)
      if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code })
      sha = checked.value
    }

    return readImagePair(cwd.value, file.value, origFile, input.side === 'index' ? 'index' : 'worktree', sha)
  },

  async log(args) {
    const input = args && typeof args === 'object' ? args : {}
    const cwd = validateCwd(input.cwd)
    if (!cwd.ok) throw Object.assign(new Error(cwd.message), { code: cwd.code })
    return readLog(cwd.value, input.count)
  },

  /** 标签列表（只读）。点一个 tag 复用 `commit` 那条管道去看它指向的提交。 */
  async tags(args) {
    const input = args && typeof args === 'object' ? args : {}
    const cwd = validateCwd(input.cwd)
    if (!cwd.ok) throw Object.assign(new Error(cwd.message), { code: cwd.code })
    return readTags(cwd.value, input.count)
  },
  async commit(args) {
    const input = args && typeof args === 'object' ? args : {}
    const cwd = validateCwd(input.cwd)
    if (!cwd.ok) throw Object.assign(new Error(cwd.message), { code: cwd.code })
    const sha = validateCommitSha(input.sha)
    if (!sha.ok) throw Object.assign(new Error(sha.message), { code: sha.code })
    return readCommit(cwd.value, sha.value)
  },

  async 'commit-diff'(args) {
    const input = args && typeof args === 'object' ? args : {}
    const cwd = validateCwd(input.cwd)
    if (!cwd.ok) throw Object.assign(new Error(cwd.message), { code: cwd.code })
    const sha = validateCommitSha(input.sha)
    if (!sha.ok) throw Object.assign(new Error(sha.message), { code: sha.code })
    const file = validateDiffPath(input.path)
    if (!file.ok) throw Object.assign(new Error(file.message), { code: file.code })

    let origFile = null
    if (input.origPath !== undefined && input.origPath !== null && input.origPath !== '') {
      const checked = validateDiffPath(input.origPath, 'origPath')
      if (!checked.ok) throw Object.assign(new Error(checked.message), { code: checked.code })
      origFile = checked.value
    }

    return readCommitDiff(cwd.value, sha.value, file.value, origFile)
  },

  /**
   * 本会话改过哪些文件（按会话归因）。
   *
   * 只读：只回答"这个会话动过哪些路径"，与工作区现状的关系由浏览器半自己用 `status` 求交 —
   * 这样端点不需要知道 git 的事，两个事实各自只有一个来源。
   */
  async 'session-changes'(args) {
    const input = args && typeof args === 'object' ? args : {}
    const cwd = validateCwd(input.cwd)
    if (!cwd.ok) throw Object.assign(new Error(cwd.message), { code: cwd.code })
    const sessionId = typeof input.sessionId === 'string' && input.sessionId.length > 0 ? input.sessionId : null
    return readSessionChanges(cwd.value, sessionId)
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
  trackSessionChanges(ctx)
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: CHANNEL,
    handler: (req, res) => handleRequest(ctx, req, res),
  }), `dsh-hud: POST ${CHANNEL}/*`)
}

// 导出即插件面：`apply` / `inject` / `name` 供 Cordis 读取；`CHANNEL` / `parseStatus` /
// `validateCwd` / `readStatus` 是可直接单测的单元（前两个是纯函数，最后一个需要真实仓库）。
