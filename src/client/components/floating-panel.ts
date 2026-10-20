/**
 * 悬浮面板本体：头部、概览、左栏改动清单、中间提交栏、右栏差异/提交明细，以及拖拽与抓握。
 *
 * 三段行为（键盘、视口夹回、dock 锚点）在 `hooks/panel.ts` 里；这里只剩 hooks 调用与 JSX。
 */

import { reviewView } from '../shared.js'
import React from 'react'

import { ChangeList } from './change-list.js'
import { CommitList } from './commit-list.js'
import { CommitPane } from './commit-pane.js'
import { CountChips } from './count-chips.js'
import { DiffView } from './diff-view.js'
import { SessionChangesLine } from './session-changes.js'
import { TagList } from './tag-list.js'
import { branchLabel, errorText, timeLabel } from '../format.js'
import { useDockAnchor, usePanelClamp, usePanelKeys } from '../hooks/panel.js'
import { useStore } from '../hooks/use-store.js'
import type { HudChange, HudLogEntry, HudStore, HudTag, Translate } from '../shared.js'
import {
  COMMIT_LIST_WIDTH,
  COMPOSER_OFFSET,
  DIFF_DEFAULT_WIDTH,
  DIFF_PANEL_HEIGHT_VH,
  DRAG_THRESHOLD_PX,
  PANEL_DOCK_GAP,
  PANEL_WIDTH,
  VIEWPORT_MARGIN,
  clampPos,
  h,
  panelLayout,
  panelWidthFor,
  panelWidthOf,
  sessionChangeView,
  visibleChangeRows,
} from '../shared.js'

/** 头部拖拽的现场（指针 id + 起点 + 按下时指针在面板内的偏移）。 */
interface DragState {
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

/** 抓握拖拽的现场（调哪一栏 + 指针 id + 起点与起始宽度）。 */
interface GripState {
  kind: 'diff' | 'commit'
  pointerId: number
  startX: number
  startWidth: number
}

/** `HudFloatingPanel` 的 props：共享 store（面板状态都在它的快照里）。 */
export interface HudFloatingPanelProps {
  t?: Translate
  store: HudStore
}

export function HudFloatingPanel(props: HudFloatingPanelProps): React.ReactElement | null {
  var t: Translate =
    props.t ||
    function (key: string) {
      return key
    }
  var store = props.store
  var state = useStore(store)

  var dragRef = React.useState<DragState | null>(null)
  var drag = dragRef[0]
  var setDrag = dragRef[1]

  var gripRef = React.useState<GripState | null>(null)
  /**
   * "面板已激活"标记：在面板里按过指针（或 Tab 进去）才允许接管裸按键。
   *
   * 用可变对象而不是 React state：事件处理里读的必须是最新值，而重建监听
   * 只依赖 `panelOpen`，改这个标记不该触发重渲染。
   * 必须和其它 hook 一起放在下面那个 `!panelOpen → null` 早退之前。
   */
  var armedState = React.useState(function () {
    return { inside: false }
  })
  var armed = armedState[0]
  usePanelKeys(store, state.panelOpen, armed)
  usePanelClamp(store, state.pos)
  useDockAnchor(store, state.panelOpen, state.sessionId, state.status)
  var grip = gripRef[0]
  var setGrip = gripRef[1]

  /**
   * 拖动：只在头部按下、并且**不是**按在按钮上时开始；移动走 window 监听，
   * 刻意**不用** `setPointerCapture` —— 一旦在头部捕获指针，`pointerup` 会被
   * 重定向到头部，`click` 便落在按下与松开的公共祖先（头部）上，按钮的
   * `onClick` 永远不触发，面板就「关不掉」了。
   */
  React.useEffect(
    function () {
      if (!drag) return undefined
      // 闭包里用局部常量保住上面的非空收窄（`drag` 是 `var`，TS 在回调里会重新放宽成可空）。
      const activeDrag = drag
      var moved = false
      var onMove = function (event: PointerEvent) {
        if (event.pointerId !== activeDrag.pointerId) return
        if (
          !moved &&
          Math.abs(event.clientX - activeDrag.startX) < DRAG_THRESHOLD_PX &&
          Math.abs(event.clientY - activeDrag.startY) < DRAG_THRESHOLD_PX
        )
          return
        moved = true
        store.movePanel(
          clampPos(
            event.clientX - activeDrag.offsetX,
            event.clientY - activeDrag.offsetY,
            panelWidthOf(store),
          ),
        )
      }
      var finish = function (event: PointerEvent) {
        if (event.pointerId !== activeDrag.pointerId) return
        setDrag(null)
        // 只有真的拖动过才落盘：头部上的普通点击不该改变位置。
        if (moved) {
          // 拖动过程中 movePanel 已经把位置写进快照，这里收窄只是 strictNullChecks 需要。
          var next = store.getSnapshot().pos
          if (next !== null) store.commitPanel(next)
        }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
      return function () {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
      }
    },
    [drag, store],
  )

  /**
   * 拖动面板**右边缘**调整差异栏宽度（与 dsh-git 的抓握位置一致）：
   * 往左拖变宽、往右拖变窄；松手才落盘。
   */
  React.useEffect(
    function () {
      if (!grip) return undefined
      // 同拖动：回调里用局部常量保住非空收窄。
      const activeGrip = grip
      var onMove = function (event: PointerEvent) {
        if (event.pointerId !== activeGrip.pointerId) return
        if (activeGrip.kind === 'commit')
          store.setCommitWidth(activeGrip.startWidth - (event.clientX - activeGrip.startX))
        else store.setDiffWidth(activeGrip.startWidth - (event.clientX - activeGrip.startX))
      }
      var finish = function (event: PointerEvent) {
        if (event.pointerId !== activeGrip.pointerId) return
        setGrip(null)
        store.persistLayout()
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
      return function () {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
      }
    },
    [grip, store],
  )

  if (!state.panelOpen) return null

  /**
   * 抓握按下。
   *
   * `kind` 决定它调哪一栏：`diff` = 面板右边缘那条（调差异栏）；`commit` = 提交栏右边那条
   * （调提交明细栏）。只有提交栏、没有差异栏时，右边缘那条也调提交栏 —— 它是右边界上唯一
   * 还能变宽的东西，不该按下去没反应。
   */
  function onGripPointerDown(
    kind: GripState['kind'],
    event: React.PointerEvent<HTMLDivElement>,
  ): void {
    if (event.button !== 0) return
    var snapshot = store.getSnapshot()
    event.preventDefault()
    var start =
      kind === 'commit'
        ? typeof snapshot.commitWidth === 'number'
          ? snapshot.commitWidth
          : COMMIT_LIST_WIDTH
        : typeof snapshot.diffWidth === 'number'
          ? snapshot.diffWidth
          : DIFF_DEFAULT_WIDTH
    setGrip({ kind: kind, pointerId: event.pointerId, startX: event.clientX, startWidth: start })
  }

  function onHeaderPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return
    // DOM 边界：事件的 target 是 EventTarget，`closest` 只存在于 Element 上，按能力判断前先收窄。
    var target = event.target as Element | null
    // 头部里的按钮要保持普通点击，否则拖动会吞掉它们。
    if (target && typeof target.closest === 'function' && target.closest('button')) return
    // DOM 边界：头部的父节点就是面板容器（渲染结构固定），这里按元素取几何。
    var rect = (event.currentTarget.parentNode as HTMLElement).getBoundingClientRect()
    setDrag({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    })
  }

  function onHeaderDoubleClick(): void {
    store.resetPanel()
  }

  var layout = panelLayout(state)
  var diffMode = layout.diff
  // 提交明细在场时右栏也在场（明细是中间那一栏，差异是右边那一栏），
  // 而当时 `state.diff` 可能还在路上 —— 因此两种情形都算"宽面板"。
  var commitMode = layout.commit
  var wide = diffMode || commitMode
  var dockTop = typeof state.anchorTop === 'number' ? state.anchorTop : null
  // 贴到胶囊所在行的上方；量不到就退回 dsh-git 记录的那次测量（168px）。
  var anchorBottom =
    dockTop === null
      ? COMPOSER_OFFSET
      : Math.max(VIEWPORT_MARGIN, window.innerHeight - dockTop + PANEL_DOCK_GAP)

  var panelStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 30,
    boxSizing: 'border-box',
    width: panelWidthFor(layout, state.diffWidth, state.commitWidth),
    maxWidth: 'calc(100vw - 16px)',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))',
    borderRadius: 12,
    // 表面用"抬升面"令牌：DSH 自己的浮层几乎都用 bg-layer-1，而 bg-overlay
    // 在暗色下是中灰 bluish-700，拿它当面板底色会发灰、与产品观感不一致。
    background: 'var(--dsw-alias-bg-layer-1, #1f2126)',
    boxShadow: 'var(--dsw-shadow-lv2, 0 4px 12px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12))',
    overflow: 'hidden',
    pointerEvents: 'auto',
  }

  if (wide) {
    // 固定高度：面板以 bottom 锚定，若只给 max-height，差异到达时面板会长高并整体跳位。
    var spaceAbove =
      (dockTop === null ? window.innerHeight - anchorBottom : dockTop - PANEL_DOCK_GAP) -
      VIEWPORT_MARGIN
    panelStyle.height = Math.max(
      240,
      Math.min(Math.round(window.innerHeight * DIFF_PANEL_HEIGHT_VH), spaceAbove),
    )
  } else {
    panelStyle.maxHeight = '62vh'
  }

  // 未拖动过：锚在胶囊上方居中；拖动过：显式坐标。
  if (state.pos) {
    panelStyle.left = state.pos.left
    panelStyle.top = state.pos.top
  } else {
    panelStyle.left = '50%'
    panelStyle.bottom = anchorBottom
    panelStyle.transform = 'translateX(-50%)'
  }

  // 单栏内容（"面板本来就长这样"）：两种模式共用同一份，
  // 打开差异时它原封不动地留在左栏，只有右栏是新出现的。
  // "正在看的那份差异"与"键盘选中的那行"是两件事：前者是打开的文件，
  // 后者可能只是选过还没打开（↑/↓ 移动，Enter 才打开）。两个标记都留着。
  // 左栏那份清单只关心工作区差异：提交明细打开时它不该跟着高亮。
  var openDiff = state.diff
  var openCommit = state.commit
  // 工作区差异（含未暂存/已暂存两页签）与提交差异是两种右栏内容。
  var openFile = openDiff !== null && openDiff.source !== 'commit' ? openDiff.file : null
  var commitOpenFile = openDiff !== null && openDiff.source === 'commit' ? openDiff.file : null

  // 会话归因视图与过滤后的清单：渲染期只算一次（标记、过滤、概览那行共用）。
  var sessionView = sessionChangeView(state)
  var sessionRows = visibleChangeRows(state)

  var emptyBody: React.ReactElement
  if (state.phase === 'error') {
    emptyBody = h('div', { className: 'dshh-empty' }, errorText(state.errorCode, t))
  } else if (!state.cwd) {
    emptyBody = h('div', { className: 'dshh-empty' }, t('panel.noSession'))
  } else if (state.phase === 'loading' && !state.status) {
    emptyBody = h('div', { className: 'dshh-empty' }, t('panel.loading'))
  } else {
    emptyBody = h('div', { className: 'dshh-empty' }, t('panel.notRepo'))
  }

  var listBody
  if (state.status && state.status.repo) {
    var status = state.status
    var repoChildren: React.ReactNode[] = [
      h(
        'div',
        { className: 'dshh-meta' },
        h('span', { className: 'dshh-repo', title: status.repo }, status.repo),
        status.upstream
          ? h('span', { className: 'dshh-kv' }, t('panel.upstream') + ' ' + status.upstream)
          : null,
        status.ahead > 0
          ? h('span', { className: 'dshh-kv' }, '↑ ' + t('panel.ahead') + String(status.ahead))
          : null,
        status.behind > 0
          ? h('span', { className: 'dshh-kv' }, '↓ ' + t('panel.behind') + String(status.behind))
          : null,
        status.oid ? h('span', { className: 'dshh-kv' }, status.oid) : null,
      ),
      h('div', { className: 'dshh-sectionTitle' }, t('panel.summary')),
      h(CountChips, { counts: status.counts, t: t }),
      h(SessionChangesLine, {
        t: t,
        view: sessionView,
        onlySession: state.onlySession === true,
        onToggle: function () {
          store.toggleOnlySession()
        },
        onlyLatest: state.onlyLatest === true,
        onToggleLatest: function () {
          store.toggleOnlyLatest()
        },
        review: reviewView(state),
        onClearReviewed: function () {
          store.clearReviewed()
        },
      }),
      // 顺序：改动概览 → **改动清单** → 最近提交。清单是"现在要处理的"，
      // 提交是背景信息；清单放前面，一屏不够时先看到的是眼前的事。
      sessionRows.length > 0
        ? h(ChangeList, {
            changes: sessionRows,
            truncated: status.truncated,
            t: t,
            onOpen: function (change: HudChange) {
              store.openDiff(change)
            },
            activeFile: openFile,
            cursor: commitMode ? null : state.cursor,
            listId: 'changes',
            sessionView: sessionView,
            review: reviewView(state),
            onToggleReviewed: function (file: string) {
              store.toggleReviewed(file)
            },
          })
        : state.status.changes.length > 0 && state.onlySession === true && sessionView !== null
          ? // 过滤器开着、本会话又什么都没改：说一句，而不是让清单整段消失。
            h('div', { className: 'dshh-note' }, t('session.empty'))
          : null,
      h(CommitList, {
        commits: state.commits,
        t: t,
        activeSha: commitMode && openCommit !== null ? openCommit.sha : null,
        // 再点一次打开着的那条 = 收起明细（打开提交不改左栏，只高亮它）。
        onOpen: function (commit: HudLogEntry) {
          store.toggleCommit(commit)
        },
      }),
      h(TagList, {
        tags: state.tags,
        truncated: state.tagsTruncated,
        t: t,
        headSha: state.status && state.status.oid ? state.status.oid : null,
        activeSha: commitMode && openCommit !== null ? openCommit.sha : null,
        // 点一个 tag = 看它指向的那次提交（tag 自己不是提交，所以把提交信息填进去）。
        onOpen: function (tag: HudTag) {
          store.toggleCommit({
            sha: tag.sha,
            subject: tag.subject || '',
            author: '',
            date: tag.date || '',
            committedAt: typeof tag.committedAt === 'number' ? tag.committedAt : null,
            refs: [tag.name],
          })
        },
      }),
    ]
    listBody = h('div', { className: 'dshh-body' }, ...repoChildren)
  } else {
    listBody = emptyBody
  }

  // 工作台：左栏**始终**是上面那份单栏内容（宽度也与单栏一致）；打开提交明细时
  // 中间多一栏（这次提交的元信息 + 改动清单），差异固定在右边那一栏。
  // 左栏一个像素都不动，面板右边缘的抓握仍只调整差异栏——与 dsh-git 的 workbench 同形。
  var body = wide
    ? h(
        'div',
        { className: 'dshh-workbench' },
        h('div', { className: 'dshh-leftpane', style: { width: PANEL_WIDTH } }, listBody),
        commitMode && openCommit !== null
          ? h(CommitPane, {
              t: t,
              commit: openCommit,
              onOpenFile: function (file) {
                store.openCommitDiff(file)
              },
              activeFile: commitOpenFile,
              cursor: state.cursor,
              width: typeof state.commitWidth === 'number' ? state.commitWidth : COMMIT_LIST_WIDTH,
            })
          : null,
        commitMode && diffMode
          ? h('div', {
              className: 'dshh-grip dshh-gripBetween',
              'data-dsh-hud': 'grip-commit',
              title: t('diff.resizeCommit'),
              onPointerDown: function (event: React.PointerEvent<HTMLDivElement>) {
                onGripPointerDown('commit', event)
              },
            })
          : null,
        diffMode && openDiff !== null
          ? h(DiffView, { t: t, diff: openDiff, store: store, cwd: state.cwd })
          : null,
      )
    : listBody

  return h(
    'div',
    { className: 'dshh-panel', 'data-dsh-hud': 'panel', style: panelStyle },
    h(
      'div',
      {
        className: 'dshh-header',
        title: t('panel.dragHint'),
        onPointerDown: function (event: React.PointerEvent<HTMLDivElement>) {
          onHeaderPointerDown(event)
        },
        onDoubleClick: onHeaderDoubleClick,
      },
      h('span', { className: 'dshh-title' }, t('panel.title')),
      state.status && state.status.repo
        ? h('span', { className: 'dshh-branch' }, branchLabel(state.status, t))
        : null,
      h('span', { className: 'dshh-spacer' }),
      h(
        'button',
        {
          type: 'button',
          className: 'dshh-icon',
          title: t('panel.refresh'),
          'aria-label': t('panel.refresh'),
          onClick: function () {
            store.refresh()
          },
        },
        '⟳',
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dshh-icon',
          title: t('panel.reset'),
          'aria-label': t('panel.reset'),
          onClick: function () {
            store.resetPanel()
          },
        },
        '⌖',
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dshh-icon',
          title: t('panel.close'),
          'aria-label': t('panel.close'),
          onClick: function () {
            store.openPanel(false)
          },
        },
        '✕',
      ),
    ),
    body,
    diffMode
      ? h('div', {
          className: 'dshh-grip',
          'data-dsh-hud': 'grip',
          title: t('diff.resize'),
          onPointerDown: function (event: React.PointerEvent<HTMLDivElement>) {
            onGripPointerDown('diff', event)
          },
        })
      : commitMode
        ? // 只有提交栏：右边缘这条改成调它（否则按下去没反应）。
          h('div', {
            className: 'dshh-grip',
            'data-dsh-hud': 'grip-commit',
            title: t('diff.resizeCommit'),
            onPointerDown: function (event: React.PointerEvent<HTMLDivElement>) {
              onGripPointerDown('commit', event)
            },
          })
        : null,
    h(
      'div',
      { className: 'dshh-footer' },
      h('span', null, t('panel.readonly')),
      h('span', null, state.updatedAt ? t('panel.updated') + timeLabel(state.updatedAt) : ''),
    ),
  )
}
