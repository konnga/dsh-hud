/**
 * 小段 DOM 判定与定位：焦点在哪、点在不在面板里、差异行怎么滚进视野。
 *
 * 数量少但被 hooks 与组件共用，所以单独一层，避免它们互相 import。
 */

/**
 * 本层用到的 DOM 子集（结构类型）。
 *
 * 为什么不用 `Element` / `instanceof Element`：测试里的假 DOM 是普通对象（没有 Element 类），
 * 用 instanceof 会把那些用例全判成"没有 DOM"。这里只关心下面几个字段，按结构收窄即可；
 * 外部传进来的值（事件目标、查询结果）都从 `unknown` 收一次 —— 这就是系统边界。
 */
interface DomNodeLike {
  getAttribute?: (name: string) => string | null
  parentNode?: DomNodeLike | null
  tagName?: string
  isContentEditable?: boolean
  className?: string
  scrollTop?: number
  offsetTop?: number
  offsetHeight?: number
  clientHeight?: number
  getBoundingClientRect?: () => { top: number }
}

/** 把未知值收窄成"结构上像个 DOM 节点"；不是对象就给 null。 */
function asDomNode(value: unknown): DomNodeLike | null {
  return value !== null && typeof value === 'object' ? (value as DomNodeLike) : null
}

/** 取当前焦点节点；没有 document / activeElement 时给 null。 */
export function activeElement(): Element | null {
  if (typeof document === 'undefined') return null
  return document.activeElement || null
}

/** 事件目标是否落在面板里（走自己的 `data-dsh-hud="panel"` 标记，不碰产品 DOM）。 */
export function isInsidePanel(node: unknown): boolean {
  return isInsideMarked(node, 'panel')
}

/** 事件目标是否落在某个 `data-dsh-hud` 标记的子树里（自己的标记，不碰产品的选择器）。 */
export function isInsideMarked(node: unknown, mark: string): boolean {
  var current = asDomNode(node)
  var depth = 0
  while (current && depth < 64) {
    var attribute =
      typeof current.getAttribute === 'function' ? current.getAttribute('data-dsh-hud') : null
    if (attribute === mark) return true
    current = asDomNode(current.parentNode)
    depth += 1
  }
  return false
}

/**
 * 事件目标是不是"正在输入"的地方。
 *
 * 产品的输入框是 contenteditable，所以不能只看 tagName；两种都认。
 */
export function isTypingTarget(node: unknown): boolean {
  var current = asDomNode(node)
  var depth = 0
  while (current && depth < 8) {
    var tag = typeof current.tagName === 'string' ? current.tagName.toLowerCase() : ''
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if (current.isContentEditable === true) return true
    var editable =
      typeof current.getAttribute === 'function' ? current.getAttribute('contenteditable') : null
    if (editable === '' || editable === 'true' || editable === 'plaintext-only') return true
    current = asDomNode(current.parentNode)
    depth += 1
  }
  return false
}

/** 用自己写在节点上的标记找节点；找不到或不支持就是 null。 */
export function findMarked(selector: string): Element | null {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
  return document.querySelector(selector)
}

/**
 * 把一个带自己标记的节点滚进它所在滚动容器的视野（最小滚动量）。
 *
 * 全走能力判断：假 DOM（测试）里没有 offsetTop / clientHeight，这个函数直接
 * no-op，测试断言的是状态与结构，不是像素。不用 `scrollIntoView`：那会连带
 * 滚动祖先容器（面板是浮层，滚了产品的会话列表就不好了）。
 */
export function revealRow(node: unknown, containerClassName: string): void {
  var start = asDomNode(node)
  if (!start || typeof start.parentNode === 'undefined') return
  var container = asDomNode(start.parentNode)
  var depth = 0
  while (container && depth < 32) {
    if (String(container.className || '').indexOf(containerClassName) >= 0) break
    container = asDomNode(container.parentNode)
    depth += 1
  }
  if (!container || typeof container.scrollTop !== 'number') return
  var top = start.offsetTop
  var height = start.offsetHeight
  var view = container.clientHeight
  if (typeof top !== 'number' || typeof height !== 'number' || typeof view !== 'number') return
  if (top < container.scrollTop) container.scrollTop = top
  else if (top + height > container.scrollTop + view) container.scrollTop = top + height - view
}

/* ------------------------------------------------------- 悬浮面板 */

export function measureDockTop(): number | null {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
  var node = document.querySelector('[data-dsh-hud="dock"]')
  if (!node || typeof node.getBoundingClientRect !== 'function') return null
  var rect = node.getBoundingClientRect()
  return typeof rect.top === 'number' ? rect.top : null
}
