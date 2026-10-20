/**
 * 改动清单（面板左栏）：分组、计数、每行的状态标记，以及只显示本会话/最近一轮的过滤。
 */

import { statusKey } from '../format.js'
import React from 'react'

import { reviewTitle, sessionMarkOf, sessionTitle } from './session-changes.js'
import { revealRow } from '../dom.js'
import type { HudChange, ReviewView, SessionChangeView, Translate } from '../shared.js'
import { COUNT_COLOR, h } from '../shared.js'

/** `ChangeList` 的 props：清单本体 + 会话归因/审阅两列标记 + 交互回调。 */
export interface ChangeListProps {
  /** 要渲染的清单：工作区那份是 `HudChange`，提交明细那份是 `HudCommitFile`（结构兼容）。 */
  changes?: HudChange[] | null
  /** 正在看的那份差异对应的文件（`null` = 没打开差异）。 */
  activeFile?: string | null
  /** 键盘高亮的文件。 */
  cursor?: string | null
  /** 两份清单同时在屏幕上时要区分"哪一份"（滚进视野时按它找行）。 */
  listId?: string
  /** 会话归因视图；`null` = 这份数据还没到手（整列不画）。 */
  sessionView?: SessionChangeView | null
  /** 审阅进度；`null` = 这次没要签名（胶囊那一路的轮询就是这样）。 */
  review?: ReviewView | null
  /** 清单被截断时的那句脚注。 */
  truncated?: boolean
  /** 自定义标题（提交明细那栏用）；不给自己拼一个带计数的。 */
  title?: string
  t: Translate
  /** 点一行：打开该文件的差异视图。 */
  onOpen: (change: HudChange) => void
  /** 点行尾审阅标记：切换"这一版审过了"（不画审阅列的那份清单可以不给）。 */
  onToggleReviewed?: (file: string) => void
}

export function ChangeList(props: ChangeListProps): React.ReactElement | null {
  var changes = props.changes || []
  var activeFile = props.activeFile
  var cursorFile = props.cursor || null
  // 提交明细打开时，屏幕上会同时有两份清单（左栏工作区 + 右栏这次提交），
  // 所以行标记必须带上是哪一份，否则"把选中行滚进视野"会滚错栏。
  var listId = props.listId || 'changes'

  // 键盘选中（或正在看）的那行可能被滚出视野：把它带回来。
  React.useEffect(
    function () {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return
      var wanted = cursorFile || activeFile
      if (!wanted) return
      for (var index = 0; index < changes.length; index += 1) {
        if (changes[index].file !== wanted) continue
        var node = document.querySelector(
          '[data-dsh-hud="row"][data-row-list="' +
            listId +
            '"][data-row-index="' +
            String(index) +
            '"]',
        )
        revealRow(node, 'dshh-list')
        return
      }
    },
    [cursorFile, activeFile, changes.length, listId],
  )

  if (changes.length === 0) return null

  // 会话归因标记：只在这份数据到手时才有（`sessionView` 为 null 就整列不画）。
  var sessionView = props.sessionView === undefined ? null : props.sessionView
  // 审阅进度：`null` 表示这次没要签名（胶囊那一路的轮询就是这样），整列不画。
  var review = props.review === undefined ? null : props.review

  var rows = changes.map(function (change, index) {
    // 整行可点：打开该文件的差异视图（只读，不改动任何东西）。
    // "正在看的那行"和"键盘选中的那行"可能是两行（选了还没打开），因此两种标记分开。
    return h(
      'button',
      {
        type: 'button',
        className:
          'dshh-row' +
          (activeFile && change.file === activeFile ? ' dshh-rowActive' : '') +
          (cursorFile && change.file === cursorFile ? ' dshh-rowCursor' : ''),
        key: String(index) + ':' + change.path,
        'data-dsh-hud': 'row',
        'data-row-list': listId,
        'data-row-index': String(index),
        title:
          change.path +
          (sessionView === null ? '' : '\n' + sessionTitle(sessionView, change.file, props.t)) +
          '\n' +
          props.t('panel.clickForDiff') +
          '\n' +
          props.t('panel.rowKeys'),
        onClick: function () {
          props.onOpen(change)
        },
      },
      sessionView === null
        ? null
        : h(
            'span',
            {
              className:
                'dshh-marker' +
                (sessionMarkOf(sessionView, change.file) === 'mine'
                  ? ''
                  : sessionMarkOf(sessionView, change.file) === 'possible'
                    ? ' dshh-markerPossible'
                    : ' dshh-markerOther'),
              'data-session-mark': sessionMarkOf(sessionView, change.file),
              'aria-hidden': 'true',
            },
            sessionMarkOf(sessionView, change.file) === 'mine'
              ? '●'
              : sessionMarkOf(sessionView, change.file) === 'possible'
                ? '◐'
                : '○',
          ),
      h(
        'span',
        {
          className: 'dshh-status',
          style: {
            color:
              COUNT_COLOR[statusKey(change.status)] || 'var(--dsw-alias-label-secondary, #8a8f98)',
          },
        },
        change.status,
      ),
      h('span', { className: 'dshh-path' }, change.path),
      review === null || review.known === undefined || review.known[change.file] !== true
        ? null
        : h(
            'span',
            {
              className:
                'dshh-review' +
                (review.marks[change.file] === 'fresh' ? ' dshh-reviewOn' : '') +
                (review.marks[change.file] === 'stale' ? ' dshh-reviewStale' : ''),
              'data-review':
                review.marks[change.file] === undefined ? 'none' : review.marks[change.file],
              title: reviewTitle(review.marks[change.file], props.t),
              onClick: function (event: React.MouseEvent<HTMLSpanElement>) {
                // 行本身是按钮（点开差异）：这里必须拦住，否则标记一下就顺手打开了差异。
                event.stopPropagation()
                event.preventDefault()
                // 只有画了审阅列的清单才会渲染这枚标记，所以回调不给时这里也不会被走到。
                if (props.onToggleReviewed) props.onToggleReviewed(change.file)
              },
            },
            review.marks[change.file] === undefined ? '○' : '✓',
          ),
    )
  })

  var footer = props.truncated
    ? h('div', { className: 'dshh-note' }, props.t('panel.truncated'))
    : null

  return h(
    'div',
    { className: 'dshh-section' },
    h(
      'div',
      { className: 'dshh-sectionTitle' },
      props.title || props.t('panel.changes') + ' · ' + String(changes.length),
    ),
    h('div', { className: 'dshh-list' }, rows),
    footer,
  )
}
