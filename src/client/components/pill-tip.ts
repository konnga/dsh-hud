/**
 * 悬停气泡本体：位置由 store 里的 tip 快照给（`shell.overlay` 座位里渲染）。
 */

import type React from 'react'

import { useStore } from '../hooks/use-store.js'
import type { HudStore } from '../shared.js'
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
    tip.text,
  )
}
