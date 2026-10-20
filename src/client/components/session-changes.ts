/**
 * 「本会话改过哪些文件」那一行的展示：标题、审阅标记、回合标签。
 *
 * 数据来自 store 的会话归因，这里只负责把事实排成一行字。
 */

import type React from 'react'

import { timeLabel } from '../format.js'
import type {
  ReviewMark,
  ReviewView,
  SessionChangeView,
  SessionCommand,
  Translate,
} from '../shared.js'
import { h } from '../shared.js'

/** `SessionChangesLine` 的 props：归因视图 + 审阅进度 + 三枚开关。 */
export interface SessionChangesLineProps {
  t: Translate
  /** 会话归因视图；`null` = 这份数据还没到手（这一行只剩开关）。 */
  view: SessionChangeView | null
  /** 「只看本会话改的」开关状态。 */
  onlySession?: boolean
  /** 「只看最近一轮」开关状态。 */
  onlyLatest?: boolean
  /** 审阅进度；`null` / 缺省 = 这次没要签名。 */
  review?: ReviewView | null
  onToggle: () => void
  onToggleLatest: () => void
  onClearReviewed: () => void
}

/**
 * 改动概览下面那一行：本会话改了几个文件 + 「只看本会话改的」开关。
 *
 * 归因数据没到手（`view === null`）时整行不渲染 —— 不显示一个"全部都是别人的"的假象。
 */
export function SessionChangesLine(props: SessionChangesLineProps): React.ReactElement {
  var t = props.t
  var view = props.view
  var review = props.review || null
  // 这一行**总是渲染**：它带着三枚开关（只看本会话改的 / 侧栏档位 / 只看最近一轮），
  // 归因或审阅数据缺失时只是没有计数可报 —— 控件不能因为"数据还没到"就凭空消失。
  var notes: string[] = []
  if (view !== null) {
    notes.push(t('session.line', { n: String(view.mineCount) }))
    // 回合信息拿得到时，"最近一轮改了几个"是最常问的那个问题，直接写在行上。
    if (view.latestTurn !== null && view.latestCount > 0) {
      notes.push(
        t('session.latestTurn', { n: String(view.latestCount), turn: String(view.latestTurn + 1) }),
      )
    }
    if (view.possibleCount > 0) notes.push(t('session.possible', { n: String(view.possibleCount) }))
  }
  if (view !== null) {
    if (view.gone.length > 0) notes.push(t('session.gone', { n: String(view.gone.length) }))
    if (view.dropped > 0) notes.push(t('session.dropped', { n: String(view.dropped) }))
    if (view.possibleDropped > 0)
      notes.push(t('session.possibleDropped', { n: String(view.possibleDropped) }))
  }
  if (props.review && props.review.total > 0) {
    notes.push(
      t('review.count', { n: String(props.review.done), total: String(props.review.total) }),
    )
  }
  if (props.review && props.review.staleCount > 0)
    notes.push(t('review.staleCount', { n: String(props.review.staleCount) }))
  return h(
    'div',
    { className: 'dshh-session', 'data-dsh-hud': 'session' },
    // 没有任何可报的计数时，文字位置留空（开关照旧在右边）。
    notes.length === 0
      ? null
      : h(
          'span',
          { className: 'dshh-sessionText', title: sessionLineTitle(view, t) },
          notes.join(' · '),
        ),
    h(
      'button',
      {
        type: 'button',
        className:
          'dshh-sessionToggle' + (props.onlySession === true ? ' dshh-sessionToggleOn' : ''),
        'data-session-filter': 'only',
        'aria-pressed': props.onlySession === true ? 'true' : 'false',
        title: t('session.onlyTitle'),
        onClick: props.onToggle,
      },
      props.onlySession === true ? '◉ ' : '○ ',
      t('session.only'),
    ),
    // 已经把某些文件标成"已审"时，给一个"清空"的出口（只清当前工作区）。
    props.review && props.review.done > 0
      ? h(
          'button',
          {
            type: 'button',
            className: 'dshh-sessionToggle',
            'data-session-review': 'clear',
            title: t('review.clear'),
            onClick: props.onClearReviewed,
          },
          t('review.clearShort'),
        )
      : null,
    // 第二枚开关只在"这一轮的归属拿得到"时出现：拿不到就整枚不画，别给一个按不动的按钮。
    view === null || view.latestTurn === null
      ? null
      : h(
          'button',
          {
            type: 'button',
            className:
              'dshh-sessionToggle' + (props.onlyLatest === true ? ' dshh-sessionToggleOn' : ''),
            'data-session-filter': 'latest',
            'aria-pressed': props.onlyLatest === true ? 'true' : 'false',
            title: turnLabel(view, view.latestTurn, t) + '\n' + t('session.onlyLatestTitle'),
            onClick: props.onToggleLatest,
          },
          props.onlyLatest === true ? '◉ ' : '○ ',
          t('session.onlyLatest'),
        ),
  )
}

/** 一个文件属于哪一档：`mine` 确定改过 / `possible` 命令旁听 / `other` 与本会话无关。 */
export function sessionMarkOf(
  view: SessionChangeView,
  file: string,
): 'mine' | 'possible' | 'other' {
  if (view.mine !== undefined && view.mine[file] !== undefined) return 'mine'
  if (view.possible !== undefined && view.possible[file] !== undefined) return 'possible'
  return 'other'
}

export function sessionTitle(view: SessionChangeView, file: string, t: Translate): string {
  var record = view.mine !== undefined ? view.mine[file] : undefined
  if (record === undefined) {
    var guess = view.possible !== undefined ? view.possible[file] : undefined
    if (guess === undefined) return t('session.other')
    // 低一档的置信度：说清是"从命令里看出来的"，并把那条命令贴出来。
    return t('session.possibleTitle', { reason: String(guess.reason || '').slice(0, 80) })
  }
  var parts: string[] = []
  if (record.writes > 0) parts.push(t('session.writes', { n: String(record.writes) }))
  if (record.edits > 0) parts.push(t('session.edits', { n: String(record.edits) }))
  var when = typeof record.lastAt === 'number' ? timeLabel(record.lastAt) : ''
  var line =
    t('session.mine') +
    (parts.length === 0 ? '' : '（' + parts.join('、') + '）') +
    (when ? ' ' + when : '')
  // 回合是"这一轮改了什么"的锚点：有就一并说清是哪一轮、那一轮的请求是什么。
  var turn = typeof record.lastTurn === 'number' ? record.lastTurn : null
  if (turn !== null) line += '\n' + turnLabel(view, turn, t)
  return line
}

/** 行尾那个标记的悬停说明：三种状态各说清下一步。 */
export function reviewTitle(state: ReviewMark | undefined, t: Translate): string {
  if (state === 'fresh') return t('review.unmark')
  if (state === 'stale') return t('review.stale')
  return t('review.mark')
}

/**
 * 那一行的悬停说明：自哪一刻起记录 + 跑过哪些命令。
 *
 * "可能相关"是从命令里看出来的，用户要能自己判断 —— 所以把命令原文贴出来，而不是只报一个数。
 */
export function sessionLineTitle(view: SessionChangeView | null, t: Translate): string | undefined {
  // 没有归因数据（那一行只剩审阅进度）时没有"自 … 起记录"也没有命令可列。
  if (view === null) return undefined
  var lines: string[] = []
  if (view.since !== null) lines.push(t('session.since', { time: timeLabel(view.since) }))
  var commands = (view.commands || []).slice(-5).reverse()
  if (commands.length > 0) {
    lines.push(t('session.commands', { n: String(commands.length) }))
    for (var index = 0; index < commands.length; index += 1) {
      var item: Partial<SessionCommand> = commands[index] || {}
      lines.push(
        '· ' +
          String(item.command || '') +
          (item.failed === true ? ' ' + t('session.commandFailed') : ''),
      )
    }
    if (view.writingCommands > commands.length) {
      lines.push(t('session.commandsMore', { n: String(view.writingCommands - commands.length) }))
    }
  }
  return lines.length === 0 ? undefined : lines.join('\n')
}

/**
 * 清单里那一行的悬停说明：这行是不是本会话改的。
 *
 * `mine` 里有这条就把写入/编辑次数与时间区间说清楚；没有就直说"不是这个会话改的"
 * （可能是你自己、编辑器、或另一个会话）。
 */
/**
 * 一轮的说明：`第 3 轮：<那一轮的请求预览>`。
 *
 * 回合号从宿主的 `turnBoundary` 投影来，请求预览从 `turnOutline` 投影来 —— 拿不到 prompt
 * 时只说"第 N 轮"，不编内容。
 */
export function turnLabel(view: SessionChangeView, turn: number, t: Translate): string {
  var prompt =
    view.turnPrompts !== undefined && view.turnPrompts !== null ? view.turnPrompts[turn] : undefined
  if (typeof prompt !== 'string' || prompt.length === 0)
    return t('session.turn', { n: String(turn + 1) })
  return t('session.turnWithPrompt', { n: String(turn + 1), prompt: prompt })
}
