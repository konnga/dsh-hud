/**
 * 在「本轮结束时刻」后面补一段耗时：`17:30 · 1 分 3 秒`。
 *
 * 数据不自己算，也不重新排版：DSH 的过程行上已经写着「已完成，用时 1 分 3 秒」，
 * 这里只把**它渲染出来的那一段**抄到结束时刻后面。这样做的好处：
 *
 *   - 数字和官方一致，不会因为我们自己拿 `turn.end - turn.start` 再算一遍而漂移；
 *   - 语言跟着官方走（中文「1 分 3 秒」/ 英文「1m 3s」），不用维护第二套词典；
 *   - 官方对「已停止 / 处理失败 / 没有耗时」的处理原样继承 —— 它不显示，我们也不显示。
 *
 * 抄的位置是过程行的 `_label`：它的第一个子节点是「已完成，用时 」这段静态前缀，
 * 后面才是数字与单位的若干节点。所以 `textContent` 去掉前缀就是纯耗时，与语言无关。
 *
 * 和 `running-text.ts` 一样，这里碰的是产品的 DOM 选择器，因此单独一个模块：
 * 把 `watchTurnClock` 的返回值（或整个 effect）撤掉，页面上不会留下任何痕迹。
 */

/** 只需要比对文本，1 秒一拍足够（耗时是终态数字，不会再变）。 */
var TICK_MS = 1000

/** 我们自己挂的那颗节点上的标记，用于幂等与清理。 */
var MARK = 'turn-duration'

/** 正在跑的节拍（`null` = 没跑）。 */
var timer: number | null = null
/** 页面里可能出现的「已完成，用时 …」前缀变化不需要额外处理：每拍重算一次。 */
var observer: MutationObserver | null = null

interface ClockContext {
  /** 当前是否要显示用时（沿用「显示用时」开关）。 */
  enabled: () => boolean
}

var context: ClockContext | null = null

/** 取过程行里那段耗时文本；没有（已停止 / 处理失败 / 还没结束）就返回 `null`。 */
export function durationText(button: Element): string | null {
  var label =
    typeof button.querySelector === 'function'
      ? (button.querySelector('[class*="_label"]') as Element | null)
      : null
  if (label === null) return null
  var numbers =
    typeof label.querySelectorAll === 'function'
      ? label.querySelectorAll('[class*="_durationNumber"]')
      : []
  if (numbers.length === 0) return null
  var full = label.textContent || ''
  var first = label.firstChild
  // 前缀是 label 里的第一个文本节点（「已完成，用时 」）。没有它就无从裁剪，宁可不动。
  var prefix = first !== null && first.nodeType === 3 ? first.textContent || '' : ''
  if (prefix === '' || full.indexOf(prefix) !== 0) return null
  var rest = full.slice(prefix.length).trim()
  return rest === '' ? null : rest
}

/** 找到某个 turn 对应的结束时刻节点（`_timeEnd` 是动作栏里那颗时钟）。 */
function endClockOf(tail: Element): Element | null {
  return typeof tail.querySelector === 'function'
    ? (tail.querySelector('[class*="_timeEnd"]') as Element | null)
    : null
}

function removeOwned(tail: Element): void {
  var owned =
    typeof tail.querySelector === 'function'
      ? (tail.querySelector('[data-dsh-hud="' + MARK + '"]') as Element | null)
      : null
  if (owned !== null && owned.parentNode !== null) owned.parentNode.removeChild(owned)
}

function placeAfter(span: Element, clock: Element): void {
  var parent = clock.parentNode
  if (parent === null) return
  if (typeof parent.insertBefore === 'function')
    parent.insertBefore(span, clock.nextSibling || null)
  else if (typeof parent.appendChild === 'function') parent.appendChild(span)
}

/** 单条 turn-tail：有耗时就补上，没有就把上次补的撤掉。 */
function syncTail(tail: Element, enabled: boolean): void {
  var turn = typeof tail.getAttribute === 'function' ? tail.getAttribute('data-turn-tail') : null
  var clock = endClockOf(tail)
  if (!enabled || turn === null || clock === null) {
    removeOwned(tail)
    return
  }
  var process =
    typeof document.querySelector === 'function'
      ? (document.querySelector('button[data-turn-process="' + turn + '"]') as Element | null)
      : null
  var duration = process === null ? null : durationText(process)
  if (duration === null) {
    removeOwned(tail)
    return
  }
  var text = '· ' + duration
  var owned =
    typeof tail.querySelector === 'function'
      ? (tail.querySelector('[data-dsh-hud="' + MARK + '"]') as Element | null)
      : null
  if (owned !== null) {
    if (owned.textContent !== text) owned.textContent = text
    return
  }
  var span = document.createElement('span')
  span.className = 'dshh-turnDuration'
  span.setAttribute('data-dsh-hud', MARK)
  span.textContent = text
  placeAfter(span, clock)
}

/** 每拍扫一遍所有已完成轮次的页脚。React 重渲染会把我们的节点冲掉，所以这里可重复执行。 */
function tick(): void {
  if (context === null || typeof document === 'undefined') return
  var enabled = false
  try {
    enabled = context.enabled()
  } catch (error) {
    enabled = false
  }
  var tails =
    typeof document.querySelectorAll === 'function'
      ? Array.from(document.querySelectorAll('[data-turn-tail]'))
      : []
  for (var index = 0; index < tails.length; index += 1) {
    try {
      syncTail(tails[index], enabled)
    } catch (error) {
      // 某条页脚结构不认识就跳过它，不影响其它轮次。
    }
  }
}

/** 启动同步（幂等）；已经跑着就只补一次当前状态。 */
export function watchTurnClock(options: ClockContext): () => void {
  context = options
  if (typeof window === 'undefined' || typeof document === 'undefined') return function () {}
  tick()
  if (timer === null) timer = window.setInterval(tick, TICK_MS)
  if (observer === null && typeof MutationObserver === 'function' && document.body) {
    // 对话流是增量挂载的：新的一轮结束时立刻补上，不必等下一拍。
    observer = new MutationObserver(tick)
    observer.observe(document.body, { childList: true, subtree: true })
  }
  return function () {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
    if (observer !== null) {
      observer.disconnect()
      observer = null
    }
    context = null
    if (typeof document === 'undefined') return
    var owned =
      typeof document.querySelectorAll === 'function'
        ? Array.from(document.querySelectorAll('[data-dsh-hud="' + MARK + '"]'))
        : []
    for (var index = 0; index < owned.length; index += 1) {
      var element = owned[index]
      if (element.parentNode !== null) element.parentNode.removeChild(element)
    }
  }
}
