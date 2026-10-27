/**
 * 「悬停提示」这一片 store：把气泡的文案与锚点放进快照，由 overlay 里那枚座位去画。
 */

import type { GetState, StoreSet, TipAnchor, TipHandlers, TipSlice } from './types.js'
import type { TipContent } from '../shared.js'
import { normalizeTipContent } from '../shared.js'

/** 事件里的锚点矩形：真实 DOM 给的是 DOMRect（结构上就是这三个数）。 */
interface AnchorTarget {
  getBoundingClientRect?: () => TipAnchor
}

export function createTipSlice(getState: GetState, set: StoreSet): TipSlice {
  /** 显示某枚胶囊的悬停提示（`rect` 由调用方从 `getBoundingClientRect()` 给）。 */
  function showTip(key: string, content: TipContent, rect: TipAnchor | null): void {
    var normalized = normalizeTipContent(content)
    if (normalized.text.length === 0) return
    var at: TipAnchor =
      rect && typeof rect === 'object'
        ? { left: rect.left, top: rect.top, right: rect.right }
        : { left: 0, top: 0, right: 0 }
    // `text` 与 `lines` 一起存：渲染只认 `lines`，`text` 留给日志/断言/兼容老读者。
    set({ tip: { key: key, text: normalized.text, lines: normalized.lines, rect: at } })
  }

  /** 收起悬停提示。带 `key` 时只在"还是这一枚"的情况下收 —— 免得旧的 leave 把新的提示关掉。 */
  function hideTip(key?: string): void {
    var current = getState().tip
    if (current === null || current === undefined) return
    if (typeof key === 'string' && current.key !== key) return
    set({ tip: null })
  }

  /**
   * 一枚胶囊的悬停接线：算出锚点矩形，把文案交给 store。
   *
   * 为什么走 store 而不是就地渲染气泡：气泡必须**逃出行内盒**（不被 dock 那行的裁切与
   * 堆叠上下文限制），所以它由 `shell.overlay` 里一枚单独的座位画，位置用 `position:fixed`。
   */
  function tipHandlers(key: string, contentOf: () => TipContent): TipHandlers {
    return {
      onPointerEnter: function (event) {
        // 事件目标是 DOM 边界：只按 `getBoundingClientRect` 这一项能力收窄。
        var target = event && event.currentTarget ? (event.currentTarget as AnchorTarget) : null
        var rect =
          target && typeof target.getBoundingClientRect === 'function'
            ? target.getBoundingClientRect()
            : null
        showTip(key, contentOf(), rect)
      },
      onPointerLeave: function () {
        hideTip(key)
      },
      onPointerDown: function () {
        hideTip(key)
      },
    }
  }

  return { hideTip: hideTip, showTip: showTip, tipHandlers: tipHandlers }
}
