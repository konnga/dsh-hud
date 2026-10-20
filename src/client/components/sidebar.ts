/**
 * 侧栏那两处按需展示：⋯ 菜单里的会话摘要、悬停卡片。
 */

import { branchLabel, rowSummaryOf } from '../format.js'
import { useStore } from '../hooks/use-store.js'
import type { HudStore, Translate } from '../shared.js'
import { h } from '../shared.js'

/** `⋯` 菜单摘要的 props（座位 `sidebar.workspaces.session.menu.item`）。 */
export interface SessionMenuSummaryProps {
  t?: Translate
  /** 座位按会话作用域注入的 sessionId。 */
  sessionId?: string | null
  store: HudStore
}

/** 悬停卡片的 props（座位 `sidebar.session.row.hover`）。 */
export interface SessionRowHoverChipProps {
  t?: Translate
  sessionId?: string | null
  store: HudStore
}

/**
 * `⋯` 菜单里的只读摘要（座位 `sidebar.workspaces.session.menu.item`）。
 *
 * 为什么要有这一处：会话行**行尾的常亮位置归产品**（`time` 自适应宽度 + 悬停才换上的动作条），
 * 插件在行尾拿不到常亮的座位；行首那格只有 16px，只能放一个双字符标记。所以要"完整信息 +
 * 不用等悬停卡片那 800ms"，`⋯` 菜单是最实在的地方 —— 点一下就有，且不用把鼠标停住。
 *
 * 它是**只读**的：不做任何动作，所以做得像一条说明（弱化颜色、不响应 hover 高亮）；
 * 工作区干净时也照实说"干净"，而不是消失（那样用户会以为没有这个功能）。
 */
export function SessionMenuSummary(props: SessionMenuSummaryProps): React.ReactElement | null {
  var t: Translate =
    props.t ||
    function (key: string) {
      return key
    }
  var sessionId = props.sessionId
  var store = props.store
  var state = useStore(store)
  if (!sessionId) return null
  var row = state.rows && state.rows.byId ? state.rows.byId[sessionId] : undefined
  var summary = rowSummaryOf(row)
  if (summary === null) return null

  var head: string
  if (summary.row.repo === true) {
    head = branchLabel(summary.row, t)
    if (summary.dirty === true) head += '*'
    var aheadOf = summary.row.ahead
    var behindOf = summary.row.behind
    if (typeof aheadOf === 'number' && aheadOf > 0) head += ' ↑' + String(aheadOf)
    if (typeof behindOf === 'number' && behindOf > 0) head += ' ↓' + String(behindOf)
    var counts = summary.shorthands
      .map(function (item) {
        return t('count.' + item.key) + ' ' + String(item.value)
      })
      .join(' ')
    head += counts === '' ? ' · ' + t('panel.clean') : ' · ' + counts
  } else if (summary.row.error !== null) {
    head = t('rows.error', { code: String(summary.row.error) })
  } else {
    head = t('rows.noRepo')
  }

  var own: string[] = []
  if (summary.mine > 0) own.push(t('session.pill', { n: String(summary.mine) }))
  if (summary.possible > 0) {
    own.push(t('rows.possible', { n: String(summary.possible), now: String(summary.possibleNow) }))
  }
  var ownLine = own.length === 0 ? t('rows.ownNone') : own.join(' · ')

  return h(
    'div',
    {
      className: 'dshh-menureadout',
      'data-dsh-hud': 'menu-readout',
      title: summary.row.cwd || undefined,
    },
    [
      h('div', { key: 'git', className: 'dshh-menureadoutLine' }, head),
      h('div', { key: 'own', className: 'dshh-menureadoutLine' }, ownLine),
    ],
  )
}

/**
 * 侧栏会话行**悬停卡片**里的那一块（座位 `sidebar.session.row.hover`）。
 *
 * 动作条那一枚只有图标级宽度（`!4 ●3`），明细放不下；悬停卡是宽敞的地方 ——
 * 分支/上游、分类型计数、这个会话自己的改动，都在这里说清楚。
 * 没有任何可说的（干净、且本会话没改过）就整块不画，卡片保持原来的样子。
 */
export function SessionRowHoverChip(props: SessionRowHoverChipProps): React.ReactElement | null {
  var t: Translate =
    props.t ||
    function (key: string) {
      return key
    }
  var sessionId = props.sessionId
  var store = props.store
  var state = useStore(store)
  if (!sessionId) return null
  var row = state.rows && state.rows.byId ? state.rows.byId[sessionId] : undefined
  var summary = rowSummaryOf(row)
  if (summary === null) return null
  // 上面已确认 summary 非空，它带的 row 就是刚落下来的那一行（同一个对象）。
  var rowData = summary.row
  var mineCount = summary.mine
  var possibleCount = summary.possible
  var shorthands = summary.shorthands

  var lines: string[] = []
  if (rowData.repo === true) {
    var head = branchLabel(rowData, t)
    if (rowData.dirty === true) head += '*'
    var aheadOf = rowData.ahead
    var behindOf = rowData.behind
    if (typeof aheadOf === 'number' && aheadOf > 0) head += ' ↑' + String(aheadOf)
    if (typeof behindOf === 'number' && behindOf > 0) head += ' ↓' + String(behindOf)
    if (shorthands.length > 0) {
      head +=
        ' · ' +
        shorthands
          .map(function (item) {
            return t('count.' + item.key) + ' ' + String(item.value)
          })
          .join(' ')
    } else {
      // 干净也要说出来 —— 与悬停说明、⋯ 菜单同一个口径（空着看不出是"干净"还是"没读到"）。
      head += ' · ' + t('panel.clean')
    }
    lines.push(head)
  } else if (rowData.repo === false && rowData.error === null) {
    lines.push(t('rows.noRepo'))
  }
  if (rowData.error) lines.push(t('rows.error', { code: String(rowData.error) }))
  var own: string[] = []
  if (mineCount > 0) own.push(t('session.pill', { n: String(mineCount) }))
  if (possibleCount > 0) {
    own.push(t('rows.possible', { n: String(possibleCount), now: String(summary.possibleNow) }))
  }
  // 和第二行对齐：没有改动记录时也明说一句 —— 否则卡片上会缺一行，看着像没加载出来。
  lines.push(own.length === 0 ? t('rows.ownNone') : own.join(' · '))
  if (lines.length === 0) return null

  return h(
    'div',
    {
      className: 'dshh-rowhover',
      'data-dsh-hud': 'row-hover',
    },
    lines.map(function (line, index) {
      return h('div', { key: String(index), className: 'dshh-rowhoverLine' }, line)
    }),
  )
}
