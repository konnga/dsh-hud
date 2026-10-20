/**
 * 最近提交清单（面板中间那一栏）：一条一行，短 sha + 标题 + HEAD 徽标 + 时刻。
 */

import { commitWhen, fullWhen } from '../format.js'
import type { HudLogEntry, Translate } from '../shared.js'
import { h, sameCommit } from '../shared.js'

/** `CommitList` 的 props：最近提交清单 + 打开回调 + 高亮的那一条。 */
export interface CommitListProps {
  /** 最近提交；`null` / 空表时整段不画。 */
  commits?: HudLogEntry[] | null
  t: Translate
  /** 提交明细当前打开的那条（短 sha 与完整 sha 前缀匹配）。 */
  activeSha?: string | null
  /** 点一行：打开/收起这次提交的明细。 */
  onOpen?: ((commit: HudLogEntry) => void) | null
}

/**
 * 最近提交：一行一条，sha + 标题 + HEAD 徽标 + 相对时间；整行可点看这次提交改了什么。
 * 打开的那条会高亮（再点一次收起）——提交明细在右栏，左栏这块主面板不动。
 */
export function CommitList(props: CommitListProps) {
  var commits = props.commits || []
  if (commits.length === 0) return null
  var t = props.t

  return h(
    'div',
    { className: 'dshh-section' },
    h('div', { className: 'dshh-sectionTitle' }, t('panel.commits')),
    h(
      'div',
      { className: 'dshh-commits' },
      commits.map(function (commit, index) {
        var refs = commit.refs || []
        var isHead = refs.some(function (ref) {
          return ref.indexOf('HEAD') === 0
        })
        var when =
          typeof commit.committedAt === 'number' ? fullWhen(commit.committedAt) : commit.date || ''
        var tip = [t('commit.click'), '', commit.subject, commit.author + ' · ' + when]
          .concat(refs)
          .join('\n')
        // 整行是按钮：点了在左栏换成这次提交的改动清单（只读）。
        var open = sameCommit(commit.sha, props.activeSha)
        return h(
          'button',
          {
            type: 'button',
            className: 'dshh-commit' + (open ? ' dshh-commitActive' : ''),
            key: commit.sha + ':' + String(index),
            title: tip,
            onClick: function () {
              if (props.onOpen) props.onOpen(commit)
            },
          },
          h('span', { className: 'dshh-csha' }, commit.sha),
          h('span', { className: 'dshh-csubject' }, commit.subject || '—'),
          isHead ? h('span', { className: 'dshh-chead' }, 'HEAD') : null,
          h('span', { className: 'dshh-cwhen' }, commitWhen(commit, t)),
        )
      }),
    ),
  )
}
