/**
 * 「思考中」那行的轮播文案。
 *
 * 为什么不能只靠 CSS：官方文字是 React 每秒重渲染出来的（`setInterval` → `setNow`），
 * 内容由 i18n 决定，纯 CSS 的 `content` 只能写死一句，也拿不到「用时」。
 * 所以这里走 DOM：**不去改 React 管的那棵树**，而是
 *
 *   1. 先挂载替换节点，再给运行行打标，换皮表只隐藏该行的官方文字；
 *   2. 在 `.runningContent` 末尾**追加**一个自己的 span，文案由我们定时换。
 *
 * 追加的节点在 React 的 children 之外：它每次重渲染只更新自己的那两个子节点
 * （图标 + 文字），不会碰到我们挂在末尾的这一颗。轮次结束整棵子树卸载，我们跟着没，
 * 下一个轮次由 300ms 的 tick 重新挂上。
 *
 * 计时不是自己算的：官方那行里还留着「用时 1 分 1 秒」，从隐藏的 `data-shimmer-text`
 * 里抠出来接着显示 —— 口径和官方一致，不用重复实现一遍时长格式化。
 *
 * 文案**跟着正在跑的工具走**：跑 `apply_patch` 时说「正在改文件」，跑 `bash` 时说
 * 「在敲命令」，没有工具在跑才是「深度求索中」。工具名由调用方通过 `read` 传进来
 * （插件里读的是 `store.getSnapshot().tools.active`），这个模块自己不碰 store。
 */

import type { RunningSkinId } from './running-skin.js'
import { RUNNING_CUES } from './running-cues.js'
import type { RunningGroup, WhaleAction } from './running-cues.js'
import { WHALE_ASSETS } from './whale-assets.js'
export type { RunningGroup } from './running-cues.js'

/** 每隔多久在同一组里换一句。3.2s 是「读得完一句、又不至于等」的折中。 */
var ROTATE_MS = 3200

/**
 * 检查节拍。300ms 是「轮次开始后几乎立刻出现」与「几乎不耗」的折中：
 * 只读取现有运行行；多会话时保留官方文案，避免冒用主会话的工具状态。
 */
var TICK_MS = 300

/** 文案分组：按「现在在干什么」切，不是纯按时间轮。 */
// 分组与中英文动作表定义在 running-cues.ts。

/**
 * 工具名 → 分组。按前缀匹配，认不出的一律落 `other`（在跑，但不知道在跑什么）。
 *
 * 名字来自宿主报上来的工具名（`bash` / `apply_patch` / …），这里放宽一点，
 * 常见别名一起认，免得换个工具名就退回「正在动手」。
 */
var GROUP_RULES: Array<[RegExp, RunningGroup]> = [
  [/^write_stdin$/i, 'shell'],
  [/^(apply_patch|edit|write|create_file|str_replace|patch)/i, 'edit'],
  [/^(bash|shell|exec|run|terminal|command|process)/i, 'shell'],
  [/^(web_search|web_fetch|fetch|browse|search_web|http)/i, 'search'],
  [/^(read|read_file|grep|glob|list|ls|search_data|inspect)/i, 'read'],
]

/** 正在跑的节拍（`null` = 没跑）。 */
var timer: number | null = null
/** 挂载节点与文案 / 用时引用；鲸鱼娘把文字包成两行。 */
var node: HTMLElement | null = null
var phraseEl: HTMLElement | null = null
var timeEl: HTMLElement | null = null
var imageEl: HTMLImageElement | null = null
var imageAction: WhaleAction | null = null
var pendingImage: HTMLImageElement | null = null
var pendingPhrase = ''
var activeSkin: RunningSkinId | null = null
var motionQuery: MediaQueryList | null = null
/** 上一拍看到的那个 `[data-chat-running]`：换了就说明是新的一轮，从第一句重来。 */
var lastRoot: Element | null = null
/** 当前分组：工具一换就跳回该组的第一句。 */
var group: RunningGroup = 'idle'
var index = 0
var lastRotate = 0
/** 读「现在在跑哪个工具」；插件在 apply 时把它接上（`store.getSnapshot().tools.active`）。 */
var readTool: (() => string | null) | null = null

/** 应用的语言解析器；没有服务的旧环境安全回落中文，不读取浏览器语言。 */
var resolveText: (text: { zh: string; en: string }) => string = function (text) {
  return text.zh
}

export interface RunningTextOptions {
  readTool: () => string | null
  resolveText: (text: { zh: string; en: string }) => string
}

/** 配置只借用客户端服务，卸载时释放对 store / locale 的引用。 */
export function configureRunningText(options: RunningTextOptions): () => void {
  readTool = options.readTool
  resolveText = options.resolveText
  return function () {
    stopRunningText()
    readTool = null
    resolveText = function (text) {
      return text.zh
    }
  }
}

function phraseAt(): string {
  return resolveText(RUNNING_CUES[group][index])
}

/** locale 订阅通知时立即更新，不必等下一拍。 */
export function refreshRunningText(): void {
  if (timer !== null) tick()
}

/**
 * 工具名归到哪一组。
 *
 * @param name - 正在跑的工具名；没有工具在跑是 `null`。
 * @returns 该用哪一组文案。
 */
export function groupOfTool(name: string | null): RunningGroup {
  if (name === null || name === '') return 'idle'
  if (/^(web|browser)[.:/]/i.test(name)) return 'search'
  name = name.replace(/^.*[.:/]/, '')
  for (var cursor = 0; cursor < GROUP_RULES.length; cursor += 1) {
    if (GROUP_RULES[cursor][0].test(name)) return GROUP_RULES[cursor][1]
  }
  return 'other'
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

  var time = document.createElement('span')
  time.className = 'dshh-runTime'

  if (activeSkin === 'whale') {
    // 同一文字列：用时在上、文案在下；没有用时时由 :empty 自动收起，
    // 保留 DOM 引用，计时刷新与图片回退都不需要重新挂载。
    var copy = document.createElement('span')
    copy.className = 'dshh-runCopy'
    copy.appendChild(time)
    copy.appendChild(phrase)
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
    // 轮播文案皮肤维持原来的一行布局。
    span.appendChild(phrase)
    span.appendChild(time)
  }
  content.appendChild(span)

  phraseEl = phrase
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
  var action = RUNNING_CUES[group][index].action
  var phrase = phraseAt()
  if (imageEl === null) {
    if (node !== null) node.setAttribute('data-action', action)
    show(phrase)
    return
  }
  pendingPhrase = phrase
  if (imageAction === action) {
    if (pendingImage === null) show(phrase)
    return
  }
  cancelPendingImage()
  imageAction = action
  var image = imageEl
  var candidate = document.createElement('img')
  pendingImage = candidate

  function isCurrent(): boolean {
    return lastRoot === root && imageEl === image && pendingImage === candidate
  }
  function commit(): void {
    if (!isCurrent()) return
    cancelPendingImage()
    image.src = WHALE_ASSETS[action]
    image.setAttribute('data-action', action)
    image.hidden = false
    if (node !== null) node.setAttribute('data-action', action)
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
  candidate.src = WHALE_ASSETS[action]
  if (candidate.complete && candidate.naturalWidth > 0) loaded()
}

/** 把官方那行里的「用时」抄到我们这一行。 */
function syncTime(root: Element): boolean {
  if (timeEl === null) return false
  var source = root.querySelector('[data-shimmer-text]')
  if (source === null) return false
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
  if (node !== null && node.parentNode !== null) node.parentNode.removeChild(node)
  lastRoot = null
  node = null
  phraseEl = null
  timeEl = null
  group = 'idle'
  index = 0
  lastRotate = 0
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
    var next = groupOfTool(readTool === null ? null : readTool())
    if (node === null || node.parentNode !== content) {
      unmount()
      lastRoot = root
      group = next
      node = mountInto(content)
      lastRotate = Date.now()
    } else if (next !== group) {
      group = next
      index = 0
      lastRotate = Date.now()
    }
    if (!syncTime(root)) {
      unmount()
      return
    }
    var now = Date.now()
    if (now - lastRotate >= ROTATE_MS && !(activeSkin === 'whale' && motionQuery?.matches)) {
      lastRotate = now
      index = (index + 1) % RUNNING_CUES[group].length
    }
    syncAction(root)
    // 最后才隐藏官方文字：挂载、计时和语言读取都已成功。
    root.setAttribute('data-dsh-hud-running-text', '')
  } catch (error) {
    unmount()
  }
}

/** 开始轮播（幂等）；重新确保状态时也立即检查 DOM。 */
export function startRunningText(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  tick()
  if (timer === null) timer = window.setInterval(tick, TICK_MS)
}

/** 停掉轮播并恢复官方文案。 */
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

/** 减弱动态设置切换时重新计拍，不在恢复动画的瞬间跳帧。 */
function onMotionChange(): void {
  lastRotate = Date.now()
  refreshRunningText()
}

/** 所有皮肤变更（包括轮询 / focus / storage）都经过这里。 */
export function syncRunningText(id: RunningSkinId): void {
  if (id !== 'rotate' && id !== 'whale') {
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
