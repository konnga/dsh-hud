/**
 * 差异视图：两侧页签、逐行渲染、折叠 hunk、复制为文本。
 */

import React from 'react'

import { ImageDiff } from './image-diff.js'
import { findMarked, revealRow } from '../dom.js'
import { errorText } from '../format.js'
import type {
  DiffPayload,
  DiffRow as DiffRowShape,
  DiffSide,
  HudDiffState,
  HudStore,
  Translate,
  WorktreeDiffPayload,
} from '../shared.js'
import { DIFF_ADD_BG, DIFF_DEL_BG, DIFF_GUTTER_COLOR, h } from '../shared.js'

/** 差异视图的两侧页签（提交差异没有这个概念，不会画）。 */
export type DiffTabSide = 'worktree' | 'index'

/** `DiffView` 的 props：当前差异状态 + 打开它的 store + 工作区（图片预览要按它发请求）。 */
export interface DiffViewProps {
  t: Translate
  diff: HudDiffState
  store: HudStore
  cwd?: string | null
}

/** `DiffRow` 的 props：一行解析好的差异 + 它的 hunk 归属与折叠状态。 */
export interface DiffRowProps {
  row: DiffRowShape
  /** 自动换行（store 里记住的开关）。 */
  wrap?: boolean
  /** 这一行属于第几个 hunk（头之前的行是 `null`）。 */
  hunk?: number | null
  /** hunk 头是否"当前正在看"的那一段。 */
  active?: boolean
  /** hunk 是否被折叠。 */
  collapsed?: boolean
  /** hunk 头的悬停说明（"点一下折叠"）。 */
  hint?: string
  /** 点 hunk 头：折叠/展开这一段。 */
  onToggle?: (() => void) | null
}

/** `visibleDiffRows()` 的输出项：要渲染的行 + 它属于哪个 hunk。 */
export interface VisibleDiffEntry {
  row: DiffRowShape
  /** hunk 序号；hunk 头之前的行是 `null`。 */
  hunk: number | null
}

export function DiffView(props: DiffViewProps) {
  var t = props.t
  var diff = props.diff
  var store = props.store
  // 图片预览要按工作区发请求；文本 diff 用不到它。
  var cwd = props.cwd

  var copiedRef = React.useState(false)
  var copied = copiedRef[0]
  var setCopied = copiedRef[1]
  // 复制的"已复制"提示要 1.5s 后收回；定时器句柄得留一份好清掉。
  var timerRef = React.useState<number | null>(null)

  var isCommit = diff.source === 'commit'
  // 提交差异没有"侧"这个概念，但只要不是提交，页签就得知道自己亮的是哪个。
  var side: DiffTabSide = diff.side === 'index' ? 'index' : 'worktree'
  var data = diffPayload(diff)
  var untracked = isCommit ? false : payloadUntracked(diff.data)
  var hunk = typeof diff.hunk === 'number' ? diff.hunk : 0
  var collapsed = diff.collapsed || []
  var rows = data && data.rows ? data.rows : []

  // 换了文件 / 侧 / 提交：回到顶部。否则会停在上一份 diff 的滚动位置
  // （React 复用同一个容器节点，scrollTop 会留下来）。
  React.useEffect(
    function () {
      var host = findMarked('[data-dsh-hud="diff"]')
      if (host && typeof host.scrollTop === 'number') host.scrollTop = 0
    },
    [diff.file, diff.sha, diff.side],
  )

  // 键盘移动 hunk：把当前 hunk 滚进视野（已经看得见就一点都不动）。
  React.useEffect(
    function () {
      var host = findMarked('[data-dsh-hud="diff"]')
      if (!host || typeof host.querySelector !== 'function') return
      revealRow(
        host.querySelector('[data-dsh-hud="hunk"][data-hunk-index="' + String(hunk) + '"]'),
        'dshh-diff',
      )
    },
    [hunk, diff.file, diff.sha, diff.side, collapsed.length],
  )

  function onCopy(): void {
    if (!data) return
    var clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (!clipboard || typeof clipboard.writeText !== 'function') return
    Promise.resolve(clipboard.writeText(rowsToText(data.rows || [])))
      .then(function () {
        setCopied(true)
        if (timerRef[0]) window.clearTimeout(timerRef[0])
        timerRef[1](
          window.setTimeout(function () {
            setCopied(false)
          }, 1500),
        )
      })
      .catch(function () {
        // 剪贴板被拒绝（无权限/非安全上下文）时不谎报成功。
      })
  }

  function tab(kind: DiffTabSide, label: string, title: string): React.ReactElement {
    var active = side === kind
    return h(
      'button',
      {
        type: 'button',
        className: 'dshh-tab' + (active ? ' dshh-tabActive' : ''),
        'aria-pressed': active ? 'true' : 'false',
        title: title,
        onClick: function () {
          store.setDiffSide(kind)
        },
      },
      label,
    )
  }

  var counts =
    data && data.binary !== true
      ? h(
          'span',
          { className: 'dshh-difcounts' },
          h(
            'span',
            { style: { color: 'var(--dsw-alias-state-success-primary, #3fb950)' } },
            '+' + String(data.additions),
          ),
          h(
            'span',
            { style: { color: 'var(--dsw-alias-state-error-primary, #f06a6a)' } },
            '-' + String(data.deletions),
          ),
        )
      : null

  var body: React.ReactElement
  if (diff.phase === 'loading') {
    body = h('div', { className: 'dshh-empty' }, t('panel.loading'))
  } else if (diff.phase === 'error') {
    body = h('div', { className: 'dshh-empty' }, errorText(diff.errorCode, t))
  } else if (!data) {
    body = h('div', { className: 'dshh-empty' }, t('diff.empty'))
  } else if (data.binary === true) {
    // 二进制里最常被改的就是图：能认出来就画出来，认不出才退回那句话。
    body = h(ImageDiff, { t: t, store: store, diff: diff, cwd: cwd })
  } else if (rows.length === 0) {
    body = h('div', { className: 'dshh-empty' }, t('diff.empty'))
  } else {
    var visible = visibleDiffRows(rows, collapsed)
    body = h(
      'div',
      { className: 'dshh-diff', 'data-dsh-hud': 'diff' },
      visible.map(function (entry, index) {
        // hunk 序号只在 hunk 头及其后面的行上有；头之前的行是 null。
        var entryHunk = entry.hunk === null ? -1 : entry.hunk
        var isHunk = entry.row.kind === 'hunk'
        return h(DiffRow, {
          key: String(index) + ':' + entry.row.kind,
          row: entry.row,
          wrap: diff.wrap === true,
          hunk: entry.hunk,
          active: isHunk && entry.hunk === hunk && collapsed.indexOf(entryHunk) < 0,
          collapsed: isHunk && collapsed.indexOf(entryHunk) >= 0,
          hint: isHunk ? t('diff.hunkToggle') : undefined,
          onToggle: isHunk
            ? function () {
                store.toggleHunk(entry.hunk === null ? undefined : entry.hunk)
              }
            : undefined,
        })
      }),
      data.truncated === true ? h('div', { className: 'dshh-note' }, t('diff.truncated')) : null,
    )
  }

  return h(
    'div',
    { className: 'dshh-diffview' },
    h(
      'div',
      { className: 'dshh-toolbar' },
      h('span', { className: 'dshh-difpath', title: diff.path }, diff.path),
      counts,
      h('span', { className: 'dshh-spacer' }),
      // 提交差异只有一个"侧"（相对父提交），因此不给 未暂存/已暂存 页签
      // （短 sha 与标题在右栏的明细头里，这里不重复）。
      untracked ? h('span', { className: 'dshh-kv' }, t('diff.untrackedHint')) : null,
      isCommit ? null : tab('worktree', t('diff.worktree'), t('diff.worktree')),
      isCommit || untracked ? null : tab('index', t('diff.index'), t('diff.index')),
      h(
        'button',
        {
          type: 'button',
          className: 'dshh-tab' + (diff.wrap === true ? ' dshh-tabActive' : ''),
          'aria-pressed': diff.wrap === true ? 'true' : 'false',
          title: t('diff.wrap'),
          onClick: function () {
            store.toggleDiffWrap()
          },
        },
        t('diff.wrap'),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dshh-tab',
          title: t('diff.copy'),
          onClick: onCopy,
        },
        copied ? t('diff.copied') : t('diff.copy'),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dshh-tab',
          // 提交明细里这个 ✕ 收的是整块明细（差异是明细的一段），文案跟着改。
          title: isCommit ? t('commit.close') : t('diff.close'),
          'aria-label': isCommit ? t('commit.close') : t('diff.close'),
          onClick: function () {
            store.closeDetail()
          },
        },
        '✕',
      ),
    ),
    body,
  )
}

/**
 * 一行差异：两个行号槽 + 文本。
 *
 * hunk 头是**可点**的（折叠 / 展开这一段），因此它第一个行号槽放的是折叠标记，
 * 不是行号——那个位置本来就空着，放标记不会让文本错位。
 */
export function DiffRow(props: DiffRowProps): React.ReactElement {
  var row = props.row
  var style =
    row.kind === 'add'
      ? { background: DIFF_ADD_BG }
      : row.kind === 'del'
        ? { background: DIFF_DEL_BG }
        : null
  var gutterStyle = { color: DIFF_GUTTER_COLOR }
  var text = row.text === '' ? '\u00a0' : row.text

  if (row.kind === 'hunk') {
    return h(
      'div',
      {
        className: 'dshh-difrow dshh-difrow-hunk' + (props.active ? ' dshh-difrow-hunkActive' : ''),
        'data-dsh-hud': 'hunk',
        'data-hunk-index':
          props.hunk === null || props.hunk === undefined ? undefined : String(props.hunk),
        title: props.hint,
        onClick: props.onToggle,
      },
      h('span', { className: 'dshh-difno', style: gutterStyle }, ''),
      h(
        'span',
        { className: 'dshh-difno dshh-hunkMark', style: gutterStyle },
        props.collapsed ? '▸' : '▾',
      ),
      h('span', { className: 'dshh-diftext' + (props.wrap ? ' dshh-wrap' : '') }, text),
    )
  }

  return h(
    'div',
    { className: 'dshh-difrow dshh-difrow-' + row.kind, style: style },
    h(
      'span',
      { className: 'dshh-difno', style: gutterStyle },
      row.oldLine === null ? '' : String(row.oldLine),
    ),
    h(
      'span',
      { className: 'dshh-difno', style: gutterStyle },
      row.newLine === null ? '' : String(row.newLine),
    ),
    h('span', { className: 'dshh-diftext' + (props.wrap ? ' dshh-wrap' : '') }, text),
  )
}

/**
 * 把 rows 整理成"要渲染的行 + 它属于哪个 hunk"。
 *
 * hunk 段从 hunk 头开始，到下一个 hunk 头（或结尾）结束；折叠某个 hunk 就是
 * 把该段里除头以外的行丢掉。hunk 头之前那些行（`diff --git`、`---`、`+++`）
 * 永远显示——它们是"这是哪个文件"的上下文。
 *
 * @returns `[{ row, hunk }]`，`hunk` 是 hunk 序号（头之前的行是 null，收起时是负数）。
 */
export function visibleDiffRows(rows: DiffRowShape[], collapsed: number[]): VisibleDiffEntry[] {
  var folded = collapsed || []
  var out: VisibleDiffEntry[] = []
  var ordinal = -1
  for (var index = 0; index < rows.length; index += 1) {
    var row = rows[index]
    if (row.kind === 'hunk') {
      ordinal += 1
      out.push({ row: row, hunk: ordinal })
      continue
    }
    if (ordinal >= 0 && folded.indexOf(ordinal) >= 0) continue
    out.push({ row: row, hunk: ordinal >= 0 ? ordinal : null })
  }
  return out
}

/** 把 rows 还原成 unified diff 文本（"复制差异"用）。 */
export function rowsToText(rows: DiffRowShape[]): string {
  return rows
    .map(function (row) {
      if (row.kind === 'add') return '+' + row.text
      if (row.kind === 'del') return '-' + row.text
      if (row.kind === 'ctx') return ' ' + row.text
      return row.text
    })
    .join('\n')
}

/** 工作区差异的载荷形状：两侧都在。提交差异是单侧，没有这个形状。 */
function isWorktreePayload(payload: DiffPayload): payload is WorktreeDiffPayload {
  return 'worktree' in payload && 'index' in payload
}

/** 工作区差异载荷里的 `untracked`；单侧载荷（提交差异）没有这个字段。 */
function payloadUntracked(payload: DiffPayload | null): boolean {
  return payload !== null && isWorktreePayload(payload) ? payload.untracked === true : false
}

/** 当前这一侧的 rows 载体：提交差异只有一侧，工作区差异要按 side 取。 */
export function diffPayload(diff: HudDiffState | null | undefined): DiffSide | null {
  if (!diff || !diff.data) return null
  // 域边界：来源是 commit 时宿主只回单侧载荷（`DiffSide`），类型上 `data` 是联合，这里收窄一次。
  if (diff.source === 'commit') return diff.data as DiffSide
  // 工作区差异的 `data` 一定是两侧载荷；收窄成单侧只是给类型看的，取的是同一份 rows。
  if (!isWorktreePayload(diff.data)) return null
  return diff.data[diff.side === 'index' ? 'index' : 'worktree'] || null
}
