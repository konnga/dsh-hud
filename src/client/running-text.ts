/** Existing running-row adapter. Identity-driven poses; the 300ms tick only mounts and copies elapsed time. */
import type { RunningSkinId } from './running-skin.js'
import { getHudSettings } from './hud-settings.js'
import {
  ACTION_POOL,
  FUN_PHRASES,
  createActivitySelector,
  pickFunPhrase,
} from './running-activity-cues.js'
import type { DisplayActivity } from './running-activity-cues.js'
export { groupOfTool } from './running-activity-cues.js'
import type { RunningCue, WhaleAction } from './running-cues.js'
import { characterFrame } from './character-packs.js'
import { isCharacterSkin } from '../shared/expression-packs.js'
export type { RunningGroup } from './running-cues.js'

/** Local DOM/clock maintenance only; never advances a pose or sends a request. */
var TICK_MS = 300

/**
 * The playful line is decorative, so it may rotate on its own clock — unlike the
 * pose, which only changes when the session reports a new identity. It comes from
 * one pool for every activity, never restates the factual line (see
 * `FUN_PHRASES`), pauses while hovered or focused, and freezes with reduced motion.
 */
var FUN_ROTATE_MS = 6000

/** 正在跑的节拍（`null` = 没跑）。 */
var timer: number | null = null
/** 挂载节点与文案 / 用时引用；鲸鱼娘把文字包成两行。 */
var node: HTMLElement | null = null
var phraseEl: HTMLElement | null = null
var funEl: HTMLElement | null = null
var timeEl: HTMLElement | null = null
var imageEl: HTMLImageElement | null = null
var imageAction: WhaleAction | null = null
var imageKey: string | null = null
var pendingImage: HTMLImageElement | null = null
var pendingPhrase = ''
var activeSkin: RunningSkinId | null = null
var motionQuery: MediaQueryList | null = null
/** 上一拍看到的那个 `[data-chat-running]`：换了就说明是新的一轮，从第一句重来。 */
var lastRoot: Element | null = null
var cue: RunningCue = { zh: '正在处理', en: 'Working', action: 'thinking' }
/** 表情与趣味短语同一节拍推进：全库池按顺序走，走完一圈再从头。 */
var poseCursor = 0
var selectCue = createActivitySelector()
var readActivity: (() => DisplayActivity | null) | null = null
var lastSessionId: string | undefined
var funCurrent: string | null = null
var funAt = 0
/** True while the pointer or keyboard focus rests on the aside: rotation waits. */
var funPaused = false

/** 应用的语言解析器；没有服务的旧环境安全回落中文，不读取浏览器语言。 */
var resolveText: (text: { zh: string; en: string }) => string = function (text) {
  return text.zh
}

export interface RunningTextOptions {
  readActivity: () => DisplayActivity | null
  resolveText: (text: { zh: string; en: string }) => string
}

/** 配置只借用客户端服务，卸载时释放对 store / locale 的引用。 */
export function configureRunningText(options: RunningTextOptions): () => void {
  readActivity = options.readActivity
  selectCue = createActivitySelector()
  resolveText = options.resolveText
  return function () {
    stopRunningText()
    readActivity = null
    resolveText = function (text) {
      return text.zh
    }
  }
}

function phraseAt(): string {
  return resolveText(cue)
}

/** 趣味短语只换文字，不动图片、不改变事实。 */
function showFun(text: string): void {
  if (funEl !== null && funEl.textContent !== text) funEl.textContent = text
}

/**
 * 悬停或键盘聚焦时暂停轮换：读者正在看这句，就别把它换掉。
 * 测试里的假节点没有 addEventListener，缺了它只是没有暂停能力。
 */
function pauseFun(): void {
  funPaused = true
  funAt = Date.now()
}

function resumeFun(): void {
  funPaused = false
  funAt = Date.now()
}

function attachFunHover(element: HTMLElement): void {
  if (typeof element.addEventListener !== 'function') return
  element.addEventListener('mouseenter', pauseFun)
  element.addEventListener('mouseleave', resumeFun)
  element.addEventListener('focusin', pauseFun)
  element.addEventListener('focusout', resumeFun)
}

function detachFunHover(): void {
  if (funEl === null || typeof funEl.removeEventListener !== 'function') return
  funEl.removeEventListener('mouseenter', pauseFun)
  funEl.removeEventListener('mouseleave', resumeFun)
  funEl.removeEventListener('focusin', pauseFun)
  funEl.removeEventListener('focusout', resumeFun)
}

/** 取池内下一张姿势（按顺序，走完一轮再循环）。 */
function nextPose(): WhaleAction {
  var pose = ACTION_POOL[poseCursor % ACTION_POOL.length]
  poseCursor += 1
  cue = { ...cue, action: pose }
  return pose
}

/**
 * 每拍（300ms）看一眼：还没句子就先取一句；到点且没被悬停/聚焦暂停时随机换下一句，
 * **表情同一拍跟着换**。悬停或聚焦时两者一起停住。
 */
function syncFun(reduced: boolean): void {
  if (funEl === null) return
  var now = Date.now()
  if (funCurrent === null) {
    funCurrent = pickFunPhrase(FUN_PHRASES, null).zh
    poseCursor = 1
    cue = { ...cue, action: ACTION_POOL[0] }
    funAt = now
  } else if (!reduced && !funPaused && now - funAt >= FUN_ROTATE_MS) {
    funCurrent = pickFunPhrase(FUN_PHRASES, funCurrent).zh
    nextPose()
    funAt = now
  }
  var match = null
  for (var i = 0; i < FUN_PHRASES.length; i += 1) {
    if (FUN_PHRASES[i].zh === funCurrent) {
      match = FUN_PHRASES[i]
      break
    }
  }
  showFun(resolveText(match || { zh: funCurrent, en: funCurrent }))
}

/** locale 订阅通知时立即更新，不必等下一拍。 */
export function refreshRunningText(): void {
  if (timer !== null) tick()
}

/**
 * 从官方文案里抠出「用时」那一段。
 *
 * 官方两种语言都长这样：`深度求索中，用时 1 分 1 秒 ···` / `Deep diving for 1m 1s ···`。
 * 共同点是「末尾一串 ···」和「时长从第一个数字开始」，所以先砍掉 ···，再从第一个数字取到结尾。
 * 没有数字（轮次刚开始、`startTime` 还没给）就返回空串 —— 那时不显示时长。
 *
 * @param text - 官方那行的 `data-shimmer-text`。
 * @returns 形如 `1 分 1 秒` / `1m 1s`；抠不出来是 `''`。
 */
export function extractElapsed(text: string): string {
  var cut = text.lastIndexOf('···')
  var head = cut > 0 ? text.slice(0, cut) : text
  var start = head.search(/\d/)
  if (start < 0) return ''
  return head.slice(start).trim()
}

/** 直接更新文字，不清空、不重放透明度动画，也不强制回流。 */
function show(phrase: string): void {
  if (phraseEl !== null && phraseEl.textContent !== phrase) phraseEl.textContent = phrase
}

/** 把我们的 span 挂进 `.runningContent`（末尾），返回它。 */
function mountInto(content: Element): HTMLElement {
  var span = document.createElement('span')
  span.className = 'dshh-runText'
  span.setAttribute('data-dsh-hud', 'running-text')

  var phrase = document.createElement('span')
  phrase.className = 'dshh-runPhrase'
  phrase.textContent = phraseAt()

  var fun = document.createElement('span')
  fun.className = 'dshh-runFun'

  var line = document.createElement('span')
  line.className = 'dshh-runLine'
  line.appendChild(phrase)
  line.appendChild(fun)

  var time = document.createElement('span')
  time.className = 'dshh-runTime'

  if (activeSkin !== null && isCharacterSkin(activeSkin)) {
    // 同一文字列：用时在上、文案在下；没有用时时由 :empty 自动收起，
    // 保留 DOM 引用，计时刷新与图片回退都不需要重新挂载。
    var copy = document.createElement('span')
    copy.className = 'dshh-runCopy'
    copy.appendChild(time)
    copy.appendChild(line)
    span.appendChild(copy)
    var image = document.createElement('img')
    image.className = 'dshh-runWhale'
    image.alt = ''
    image.setAttribute('aria-hidden', 'true')
    image.setAttribute('draggable', 'false')
    image.hidden = true
    span.appendChild(image)
    image.onerror = function () {
      // 只在屏幕上的图片真的失败时回退；候选图加载期间不切回官方图标。
      if (imageEl !== image) return
      image.hidden = true
      if (lastRoot !== null) lastRoot.removeAttribute('data-dsh-hud-running-whale')
    }
    imageEl = image
  } else {
    span.appendChild(line)
    span.appendChild(time)
  }
  content.appendChild(span)

  phraseEl = phrase
  funEl = fun
  attachFunHover(fun)
  timeEl = time
  return span
}

function cancelPendingImage(): void {
  if (pendingImage !== null) {
    pendingImage.onload = null
    pendingImage.onerror = null
  }
  pendingImage = null
}

/** 界面外准备新图，解码完成后同拍更新图片与文案，期间保留上一张图。 */
function syncAction(root: Element): void {
  var action = cue.action
  var phrase = phraseAt()
  if (imageEl === null) {
    if (node !== null) node.setAttribute('data-action', action)
    show(phrase)
    return
  }
  pendingPhrase = phrase
  // Factual state must not wait for an image decode (which can fail or stall).
  show(phrase)
  var frame = activeSkin === null ? null : characterFrame(activeSkin, action)
  if (frame === null) {
    cancelPendingImage()
    imageKey = null
    show(phrase)
    return
  }
  if (imageKey === frame.key) {
    imageAction = action
    if (pendingImage === null) {
      imageEl.setAttribute('data-action', action)
      if (node !== null) node.setAttribute('data-action', action)
      show(phrase)
    }
    return
  }
  cancelPendingImage()
  imageAction = action
  imageKey = frame.key
  var source = frame.src
  var image = imageEl
  var candidate = document.createElement('img')
  pendingImage = candidate

  function isCurrent(): boolean {
    return lastRoot === root && imageEl === image && pendingImage === candidate
  }
  function commit(): void {
    if (!isCurrent()) return
    cancelPendingImage()
    image.src = source
    image.setAttribute('data-action', imageAction || action)
    image.hidden = false
    if (node !== null) node.setAttribute('data-action', imageAction || action)
    show(pendingPhrase)
    root.setAttribute('data-dsh-hud-running-whale', '')
  }
  function failed(): void {
    if (!isCurrent()) return
    cancelPendingImage()
    // 首张失败保留官方图标；后续失败保留最后一张成功图片，避免闪回。
    show(pendingPhrase)
  }
  function loaded(): void {
    if (!isCurrent()) return
    candidate.onload = null
    if (typeof candidate.decode === 'function') {
      try {
        candidate.decode().then(commit, failed)
      } catch (error) {
        failed()
      }
    } else {
      // 旧 WebView 没有 decode 时，至少等待图片 load 成功再换图。
      commit()
    }
  }
  candidate.onload = loaded
  candidate.onerror = failed
  candidate.src = source
  if (candidate.complete && candidate.naturalWidth > 0) loaded()
}

/** 把官方那行里的「用时」抄到我们这一行。 */
function syncTime(root: Element): boolean {
  if (timeEl === null) return false
  var source = root.querySelector('[data-shimmer-text]')
  if (source === null) return false
  timeEl.hidden = !getHudSettings().preferences.showElapsed
  var elapsed = extractElapsed(source.getAttribute('data-shimmer-text') || '')
  if (timeEl.textContent !== elapsed) timeEl.textContent = elapsed
  return true
}

/** 撤回接管：先取消隐藏标记，再移除自己的节点。 */
function unmount(): void {
  if (lastRoot !== null) {
    lastRoot.removeAttribute('data-dsh-hud-running-text')
    lastRoot.removeAttribute('data-dsh-hud-running-whale')
  }
  if (imageEl !== null) {
    imageEl.onload = null
    imageEl.onerror = null
  }
  cancelPendingImage()
  pendingPhrase = ''
  imageEl = null
  imageAction = null
  imageKey = null
  if (node !== null && node.parentNode !== null) node.parentNode.removeChild(node)
  lastRoot = null
  node = null
  phraseEl = null
  detachFunHover()
  funEl = null
  timeEl = null
  funCurrent = null
  funAt = 0
  funPaused = false
  poseCursor = 0
}

/** 只接管唯一运行行；多会话无法可靠关联工具时全部保留官方文案。 */
function tick(): void {
  if (typeof document === 'undefined') return
  var roots =
    typeof document.querySelectorAll === 'function'
      ? Array.from(document.querySelectorAll('[data-chat-running]'))
      : []
  if (roots.length !== 1) {
    unmount()
    return
  }
  var root = roots[0]
  if (root !== lastRoot) unmount()
  var content = root.querySelector('[class*="_runningContent"]')
  if (content === null) {
    unmount()
    return
  }

  // DOM 或外部服务短暂不可用时撤销接管，官方那行仍然可见。
  try {
    var activity = readActivity === null ? null : readActivity()
    if (activity?.phase === 'idle') {
      unmount()
      return
    }
    if (lastSessionId !== activity?.sessionId) {
      unmount()
      lastSessionId = activity?.sessionId
    }
    cue = { ...selectCue(activity), action: cue.action }
    if (node === null || node.parentNode !== content) {
      unmount()
      lastRoot = root
      node = mountInto(content)
    }
    if (!syncTime(root)) {
      unmount()
      return
    }
    syncFun(Boolean(motionQuery?.matches))
    syncAction(root)
    // 最后才隐藏官方文字：挂载、计时和语言读取都已成功。
    root.setAttribute('data-dsh-hud-running-text', '')
  } catch (error) {
    unmount()
  }
}

/** 启动显示同步（幂等）；重新确保状态时也立即检查 DOM。 */
export function startRunningText(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  tick()
  if (timer === null) timer = window.setInterval(tick, TICK_MS)
}

/** 停止显示同步并恢复官方文案。 */
export function stopRunningText(): void {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
  if (motionQuery !== null) motionQuery.removeEventListener('change', onMotionChange)
  motionQuery = null
  activeSkin = null
  unmount()
}

/** 减弱动态仅影响表情变体，真实执行状态继续更新。 */
function onMotionChange(): void {
  refreshRunningText()
}

/** 所有皮肤变更（包括轮询 / focus / storage）都经过这里。 */
export function syncRunningText(id: RunningSkinId): void {
  if (!isCharacterSkin(id)) {
    stopRunningText()
    return
  }
  if (activeSkin !== id) stopRunningText()
  activeSkin = id
  if (motionQuery === null && typeof window.matchMedia === 'function') {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    motionQuery.addEventListener('change', onMotionChange)
  }
  startRunningText()
}
