/**
 * 悬停气泡本体：位置由 store 里的 tip 快照给（`shell.overlay` 座位里渲染）。
 */

import type React from 'react'

import { useStore } from '../hooks/use-store.js'
import type { HudStore, TipState } from '../shared.js'
import { h } from '../shared.js'

/** `PillTip` 的 props：共享 store（气泡文案与锚点都在它的快照里）。 */
export interface PillTipProps {
  store: HudStore
}

/**
 * 胶囊悬停提示的气泡。**自己画**，不用浏览器原生 `title`。
 *
 * 由一个独立的 `shell.overlay` 座位渲染、`position:fixed` 定位 —— 这样它不受 dock 那行的
 * 裁切与堆叠上下文限制。位置只用锚点矩形的 `top` 与 `right`：
 * 贴在那枚胶囊**上方**，横向按视口夹住（不量自己的宽度，避免"先渲染再回填"的抖动）。
 */
export function PillTip(props: PillTipProps): React.ReactElement | null {
  var store = props.store
  var state = useStore(store)
  var tip = state.tip

  if (tip === null || tip === undefined) return null
  var innerWidth = typeof window.innerWidth === 'number' ? window.innerWidth : 1200
  var innerHeight = typeof window.innerHeight === 'number' ? window.innerHeight : 800
  var margin = 8
  var left = Math.max(
    margin,
    Math.min(typeof tip.rect.left === 'number' ? tip.rect.left : margin, innerWidth - 428),
  )
  var bottom = Math.max(
    margin,
    innerHeight - (typeof tip.rect.top === 'number' ? tip.rect.top : 0) + 6,
  )

  return h(
    'div',
    {
      className: 'dshh-tip',
      'data-dsh-hud': 'pill-tip',
      role: 'tooltip',
      style: { left: String(left) + 'px', bottom: String(bottom) + 'px' },
    },
    tipLines(tip),
  )
}

/**
 * 把 `tip.lines` 画成一行一个元素。
 *
 * 为什么要拆元素：用户要「数字亮、标签灰」。一整段字符串在 DOM 里只有一个文本节点，
 * 一种颜色，做不到；拆成行以后标签与数字各自带类名，颜色由 CSS 决定。
 *
 * 三种行：`label + value`（两段）、整行 `text` 带 `tone`、以及只有 `text` 的普通行。
 */
/** `tone` → 类名。默认（`primary`）不加类，走 `.dshh-tipValue` 的主文字色。 */
function toneClass(tone: string | undefined): string {
  if (tone === 'muted') return ' dshh-tipMuted'
  if (tone === 'success') return ' dshh-tipSuccess'
  if (tone === 'warn') return ' dshh-tipWarn'
  if (tone === 'accent') return ' dshh-tipAccent'
  return ''
}

function tipLines(tip: TipState): React.ReactNode[] {
  var lines = Array.isArray(tip.lines) ? tip.lines : []
  // 兜底：老快照（或别处直接塞了 text）没有 lines，就照旧画一整段。
  if (lines.length === 0) return [tip.text]
  return lines.map(function (line, index) {
    // 行内分段：一句白话里只把读数染色（计时 / 工具统计这类整句气泡）。
    if (Array.isArray(line.segments)) {
      return h(
        'div',
        { key: 'line-' + index, className: 'dshh-tipLine' },
        line.segments.map(function (segment, at) {
          var segmentTone =
            segment.tone === undefined ? toneClass(line.tone) : toneClass(segment.tone)
          return h(
            'span',
            {
              key: 'seg-' + at,
              // 有色的段用内联强调，无色段继承所在行的类（普通文字）。
              className: 'dshh-tipSeg' + segmentTone,
            },
            segment.text,
          )
        }),
      )
    }
    if (typeof line.label === 'string' || typeof line.value === 'string') {
      // 标签恒为次要色；`tone` 只落在数值上（那才是要强调的东西）。
      return h(
        'div',
        { key: 'line-' + index, className: 'dshh-tipLine' },
        h('span', { key: 'label', className: 'dshh-tipLabel' }, line.label ?? ''),
        h(
          'span',
          { key: 'value', className: 'dshh-tipValue' + toneClass(line.tone) },
          line.value ?? '',
        ),
      )
    }
    return h(
      'div',
      { key: 'line-' + index, className: 'dshh-tipLine' + toneClass(line.tone) },
      line.text ?? '',
    )
  })
}
