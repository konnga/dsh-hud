/**
 * 提交明细（右栏）：某次提交的元信息与它改过的文件。
 */

import { errorText } from '../format.js'
import { ChangeList } from './change-list.js'
import type { HudCommitFile, HudCommitState, Translate } from '../shared.js'
import { h } from '../shared.js'

/** `CommitPane` 的 props：这次提交的完整明细 + 打开某个文件差异的回调。 */
export interface CommitPaneProps {
  t: Translate
  /** 提交明细的状态（`state.commit`）；只在它非空时才渲染本栏。 */
  commit: HudCommitState
  /** 打开清单里一条（= 提交里的某个文件）的差异。 */
  onOpenFile: (file: HudCommitFile) => void
  /** 正在看的那份差异对应的文件。 */
  activeFile?: string | null
  /** 键盘高亮的文件。 */
  cursor?: string | null
  /** 本栏宽度（右边缘抓握可拖）。 */
  width?: number | null
}

/**
 * 一次提交的那一栏（**中间**栏，固定宽度）：元信息 + 这次提交的改动清单。
 *
 * 差异在它右边那一栏（DiffView）。打开提交不改动左栏——左栏始终是那块主面板，
 * 只是"最近提交"里对应的一行高亮起来。清单复用工作区那套 ChangeList（同一个
 * 行样式、同一套键盘移动）。
 */
export function CommitPane(props: CommitPaneProps) {
  var t = props.t
  var commit = props.commit
  var style = { width: props.width }

  var head
  if (commit.phase === 'loading') {
    head = h(
      'div',
      { className: 'dshh-commitHead' },
      h('div', { className: 'dshh-commitMeta' }, t('commit.loading')),
    )
  } else if (commit.phase === 'error') {
    head = h(
      'div',
      { className: 'dshh-commitHead' },
      h('div', { className: 'dshh-commitMeta' }, errorText(commit.errorCode, t)),
    )
  } else {
    var lines = [commit.author + ' · ' + commit.date]
    if (commit.refs && commit.refs.length > 0) lines.push(commit.refs.join(', '))
    if (commit.merge) lines.push(t('commit.merge'))
    head = h(
      'div',
      { className: 'dshh-commitHead' },
      h(
        'div',
        { className: 'dshh-commitTitle' },
        h('span', { className: 'dshh-csha' }, commit.shortSha),
        h(
          'span',
          { className: 'dshh-commitSubject', title: commit.subject },
          commit.subject || '—',
        ),
      ),
      h('div', { className: 'dshh-commitMeta' }, lines.join(' · ')),
    )
  }

  var files = commit.files || []
  var list =
    commit.phase !== 'ready'
      ? null
      : files.length === 0
        ? h(
            'div',
            { className: 'dshh-commitFiles' },
            h('div', { className: 'dshh-note' }, t('commit.empty')),
          )
        : h(
            'div',
            { className: 'dshh-commitFiles' },
            h(ChangeList, {
              changes: files,
              truncated: commit.truncated,
              t: t,
              title: t('commit.files') + ' · ' + String(files.length),
              onOpen: props.onOpenFile,
              activeFile: props.activeFile,
              cursor: props.cursor,
              listId: 'commit',
            }),
          )

  return h('div', { className: 'dshh-commitpane', style: style }, head, list)
}
