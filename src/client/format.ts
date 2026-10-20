/**
 * 展示用的格式化：分支名、工作区名、相对时间、计数简写。
 *
 * 都是纯函数（输入数据、输出字符串），所以可以直接单测，也让组件里不再夹带这类判断。
 */

import type {
  CountShorthand,
  HudCountKey,
  HudSessionOverviewRow,
  HudStatusCounts,
  RowSummary,
  Translate,
} from './shared.js'
import { COUNT_MARK, COUNT_ORDER, PILL_BRANCH_MAX, PILL_WORKSPACE_MAX } from './shared.js'
/** 从中间省略：保留头尾（路径/分支名两头的区分度都比中间高）。 */
export function middleEllipsis(name: string, max: number): string {
  if (name.length <= max) return name
  var head = Math.ceil((max - 1) / 2)
  var tail = max - 1 - head
  return name.slice(0, head) + '…' + name.slice(name.length - tail)
}

/**
 * 工作区名 = 会话 cwd 的目录名（侧栏给工作区起的名字就是它）。
 *
 * 取的是 **cwd** 而不是仓库顶层：会话开在子目录时，用户认的是那个子目录；
 * 完整路径在悬停与面板里，胶囊上只要一个能认出来的短名字。
 */
export function workspaceNameOf(cwd: string | null | undefined): string | null {
  if (typeof cwd !== 'string' || cwd.length === 0) return null
  var trimmed = cwd.replace(/[/\\]+$/, '')
  if (trimmed.length === 0) return null
  var index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  var name = index === -1 ? trimmed : trimmed.slice(index + 1)
  if (name.length === 0) return null
  return middleEllipsis(name, PILL_WORKSPACE_MAX)
}

/** 分支名过长时中段省略，保留头尾信息量。 */
export function shortBranch(name: string): string {
  return middleEllipsis(name, PILL_BRANCH_MAX)
}

/**
 * 改动计数 → 简写符列表 `[{ key, mark, value }]`（只列非零项，顺序固定）。
 *
 * 胶囊与侧栏行内 chip 共用这一份：两处各写一套算法一定会漂。
 */
export function countShorthands(counts: HudStatusCounts | null | undefined): CountShorthand[] {
  var out: CountShorthand[] = []
  var source: Partial<HudStatusCounts> = counts || {}
  for (var index = 0; index < COUNT_ORDER.length; index += 1) {
    var key = COUNT_ORDER[index]
    var value = source[key] || 0
    if (value <= 0) continue
    out.push({ key: key, mark: COUNT_MARK[key], value: value })
  }
  return out
}

export function branchLabel(
  status: { branch?: string | null; oid?: string | null } | null | undefined,
  t: Translate,
): string {
  if (!status) return '—'
  if (status.branch) return status.branch
  if (status.oid) return t('panel.detached') + ' ' + status.oid
  return t('panel.detached')
}

export function timeLabel(at: number): string {
  var date = new Date(at)
  var pad = function (value: number) {
    return value < 10 ? '0' + String(value) : String(value)
  }
  return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
}

/* --------------------------------------------------------- 胶囊（dock） */

/**
 * 会话作用域的座位：框架给出 `sessionId`，`useSessions` 快照给出该会话的 `cwd`，
 * 因此它是唯一能完成绑定的座位。
 */
/**
 * 侧栏每条会话行上的状态 chip（座位 `sidebar.workspaces.session.row.action`）。
 *
 * 一行只有 32px 高、悬停才露出来，所以只放**最该一眼看到的两件事**：这个工作区脏不脏
 * （git 简写符）与**这个会话自己改过几个文件**（`●n`，只我们有这个信息）。干净且本会话
 * 没改过就整枚不画 —— 不占位置、也不制造噪音。完整信息在悬停里。
 */
/**
 * 一枚侧栏状态的"事实摘要"：三种呈现（常亮标记 / 悬停动条 / 卡片详情）共用这一份计算。
 *
 * 同一份数据要在三个地方以三种宽度呈现，各写一套一定会漂 —— 所以抽成一处。
 */
export function rowSummaryOf(row: HudSessionOverviewRow | null | undefined): RowSummary | null {
  if (row === undefined || row === null || row.pending === true) return null
  var mineCount = typeof row.mine === 'number' ? row.mine : 0
  var possibleCount = typeof row.possible === 'number' ? row.possible : 0
  var shorthands: CountShorthand[] = row.repo === true ? countShorthands(row.counts) : []
  var changed = 0
  for (var index = 0; index < shorthands.length; index += 1) changed += shorthands[index].value
  return {
    row: row,
    mine: mineCount,
    possibleNow: typeof row.possibleNow === 'number' ? row.possibleNow : 0,
    possible: possibleCount,
    shorthands: shorthands,
    changed: changed,
    dirty: row.repo === true && row.dirty === true,
    hasContent: changed > 0 || mineCount > 0 || possibleCount > 0 || row.error !== null,
  }
}

/** 相对时间；超过 30 天直接给提交自己的日期。 */
export function commitWhen(
  commit: { committedAt?: number | null; date?: string | null },
  t: Translate,
): string {
  if (typeof commit.committedAt !== 'number') return commit.date || ''
  return fullWhen(commit.committedAt)
}

/**
 * 时刻一律给完整年月日 + 时分（本地时区）：`2026-10-16 14:18`。
 *
 * 两级简化都被否掉了：先是从"2 小时前"改成具体时间（相对时间在对账场景不够用），
 * 再是"今天只给 `14:18`"也被否 —— 用户要**年月日都在**。所以不再分档，一视同仁。
 * 只到分钟：提交/标签不需要秒，列一排在面板里也塞得下。
 */
export function fullWhen(at: number): string {
  var then = new Date(at)
  return (
    String(then.getFullYear()) +
    '-' +
    pad2(then.getMonth() + 1) +
    '-' +
    pad2(then.getDate()) +
    ' ' +
    pad2(then.getHours()) +
    ':' +
    pad2(then.getMinutes())
  )
}

export function pad2(value: number): string {
  return value < 10 ? '0' + String(value) : String(value)
}

/** porcelain-v2 的展示字母 → counts 键（用于配色）。 */
export function statusKey(letter: string): HudCountKey {
  if (letter === 'M') return 'modified'
  if (letter === 'A') return 'added'
  if (letter === 'D') return 'deleted'
  if (letter === 'R') return 'renamed'
  if (letter === 'C') return 'copied'
  if (letter === 'T') return 'typeChanged'
  if (letter === '?') return 'untracked'
  if (letter === '!') return 'conflicted'
  return 'typeChanged'
}

/** 宿主半的 `details.code` → 本座位的本地化文案（store 只存机器码）。 */
export function errorText(code: string | null | undefined, t: Translate): string {
  if (code === 'timeout') return t('err.timeout')
  if (code === 'no-cwd') return t('err.no-cwd')
  if (code === 'git-missing') return t('err.git-missing')
  if (code === 'invalid-cwd') return t('err.invalid-cwd')
  if (code === 'transport') return t('err.transport')
  if (code === 'invalid-path') return t('err.invalid-path')
  // 提交可能在两次请求之间被 rebase / amend 换掉：给一句能操作的提示，而不是"git 执行失败"。
  if (code === 'unknown-commit') return t('commit.unknown')
  // 宿主半是启动时加载的：只刷新页面时，新端点还不存在，这个提示能省下一轮排查。
  if (code === 'unknown-endpoint') return t('err.stale-host')
  return t('err.git-failed')
}
