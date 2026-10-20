/**
 * 面板的三段行为，各自一个 hook：键盘与"点进来"手势、视口变化后夹回位置、量 dock 行位置。
 *
 * 提成 hook 的理由：这些是 `FloatingPanel` 里最费劲的部分，而它们只依赖 `store` 与几个快照字段 ——
 * 组件从此只剩"hooks 调用 + JSX"。
 */

import { activeElement, isInsidePanel, isTypingTarget, measureDockTop } from '../dom.js'
import { clampPos, panelWidthOf, visibleChangeRows } from '../shared.js'
import type { HudStatus, HudStore, PanelPos } from '../shared.js'
import React from 'react'

/**
 * 根作用域的座位：读不到当前会话，只读共享 store。
 * 收起时渲染 `null` —— 这样不会在输入框上留一个挡点击的气泡。
 */
/**
 * 面板的键盘与"点进来"手势：Esc 逐层退（右栏 → 收起面板），其余键只在面板被激活时接管。
 *
 * 提成顶层 hook 的理由：这段是面板里最费劲的一部分，而它只依赖 `store` 与 `panelOpen`
 * （`armed` 是就地可变的对象，按引用传进来，语义与原来完全一致）。
 */
export function usePanelKeys(
  store: HudStore,
  panelOpen: boolean,
  armed: { inside: boolean },
): void {
  React.useEffect(
    function () {
      if (!panelOpen) return undefined
      var onKeyDown = function (event: KeyboardEvent) {
        // Esc 任何时候都收（和以前一样：焦点在输入框里也能收到）。
        if (event.key === 'Escape') {
          // 和 dsh-git 一样"退一层"：右栏（差异 / 提交明细）→ 收起面板。
          var current = store.getSnapshot()
          if (current.diff || current.commit) store.closeDetail()
          else store.openPanel(false)
          return
        }

        // 其余按键只在面板被激活时接管：先在面板里点一下（或 Tab 进去）。
        // 本插件是挂在输入框上方的浮层，抢键的代价（打字、翻菜单、滚会话
        // 全被吃掉）远大于多几个快捷键，所以宁可要一次"点进来"。
        if (!armed.inside && !isInsidePanel(activeElement())) return
        // 正在输入时一律不管。
        if (isTypingTarget(event.target)) return
        // 带修饰键的组合交给产品与浏览器。
        if (event.metaKey || event.ctrlKey || event.altKey) return

        var handled = true
        if (event.key === 'ArrowDown') store.stepFile(1, false)
        else if (event.key === 'ArrowUp') store.stepFile(-1, false)
        else if (event.key === ']') store.stepFile(1, true)
        else if (event.key === '[') store.stepFile(-1, true)
        else if (event.key === 'Enter') store.openCursor()
        else if (event.key === 'n') store.stepHunk(1)
        else if (event.key === 'p') store.stepHunk(-1)
        else if (event.key === ' ' || event.code === 'Space') {
          var openDiff = store.getSnapshot().diff
          store.toggleHunk(openDiff ? openDiff.hunk : 0)
        } else if (event.key === 'r') store.refresh()
        // `v`：把当前聚焦的那一行标成"这一版我审过了"（再按一次取消）。
        // 用键盘而不是给行尾那个标记加 tabindex：行本身是按钮，里面再塞一个按钮是无效结构。
        else if (event.key === 'v') {
          var snapshot = store.getSnapshot()
          var rows = visibleChangeRows(snapshot)
          var target =
            snapshot.cursor !== null && snapshot.cursor !== undefined ? snapshot.cursor : null
          if (target === null) target = rows[0] ? rows[0].file : null
          if (target !== null) store.toggleReviewed(target)
        } else handled = false

        if (handled) {
          // 认领了的键就别再让浏览器滚动页面，也别让产品再处理一遍。
          event.preventDefault()
          event.stopPropagation()
        }
      }

      var onPointerDown = function (event: PointerEvent) {
        armed.inside = isInsidePanel(event.target)
      }

      window.addEventListener('keydown', onKeyDown, true)
      window.addEventListener('pointerdown', onPointerDown, true)
      return function () {
        window.removeEventListener('keydown', onKeyDown, true)
        window.removeEventListener('pointerdown', onPointerDown, true)
      }
    },
    [panelOpen, store],
  )
}

/** 视口变化后把已记忆的面板位置夹回可见区域。 */
export function usePanelClamp(store: HudStore, pos: PanelPos | null): void {
  React.useEffect(
    function () {
      if (!pos) return undefined
      var onResize = function () {
        var next = clampPos(pos.left, pos.top, panelWidthOf(store))
        if (next.left !== pos.left || next.top !== pos.top) store.movePanel(next)
      }
      window.addEventListener('resize', onResize)
      return function () {
        window.removeEventListener('resize', onResize)
      }
    },
    [pos, store],
  )
}

/** 量 dock 行位置：面板据此贴到胶囊上方（会话/状态变化都会重量一次，所以输入框移位时面板跟着走）。 */
export function useDockAnchor(
  store: HudStore,
  panelOpen: boolean,
  sessionId: string | null | undefined,
  status: HudStatus | null,
): void {
  React.useEffect(
    function () {
      if (!panelOpen) return undefined
      var measure = function () {
        store.setAnchorTop(measureDockTop())
      }
      measure()
      window.addEventListener('resize', measure)
      return function () {
        window.removeEventListener('resize', measure)
      }
    },
    [panelOpen, sessionId, status, store],
  )
}
