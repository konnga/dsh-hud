/**
 * 运行状态换皮：把官方「深度求索中」那一行的图标和扫光，换成自己的。
 *
 * 官方那套在 `@deepseek-ai/dsh-client-ui-chat` 的 `RunningStatus` 里，由两半组成：
 *
 *   - 图标 `RunningWhaleTail`：一张 APNG 当 CSS `mask`、`background:currentColor` 上色，
 *     静态 SVG 只在 `prefers-reduced-motion` 时兜底。帧时长在素材里 —— 所以它只能被整个
 *     换掉，调不了速率。
 *   - 文字 `TextShimmer`：叠两层同样的字，上层 `decoration > sweep` 带一条 105deg 的遮罩
 *     从 -100% 平移到 100%，`1.5s / 延迟 .3s / steps(48,end)`，走完 2/3 个周期就停住。
 *
 * 这两段都硬编码在组件 CSS 里：既不是主题 token（`ctx.theme` 只能覆盖颜色），也改不了
 * i18n（`locale.register` 对同 namespace + 同 locale 直接抛错）。所以只剩一条路 ——
 * 注入一份**独立**的样式表把它俩盖掉。
 *
 * ⚠️ 这份表确实碰了产品的 DOM 选择器，和 `styles.ts` 头注释那条约定相反。因此它单独一个
 * 模块、单独一个 `<style>` 节点：把 `RUNNING_SKIN` 改成 `'off'` 就整体不注入，胶囊与面板
 * 一行都不受影响。选择器一律走 `data-*` 与结构（`[class*="_runningIcon"]`），不用每次构建
 * 都会变的 hash 类名。
 */

import { stopRunningText, syncRunningText } from './running-text.js'

/** 可选的皮肤。`off` 表示不注入，官方那套原样保留。 */
export type RunningSkinId = 'plane' | 'pulse' | 'rotate' | 'whale' | 'off'

/**
 * 当前启用的皮肤。
 *
 * 这是**默认值**，不是最终生效值：`currentSkin()` 从 localStorage 初始化后
 * 维护内存状态，持久化失败也不会撤销本次选择。
 * 想换成自己的动画：改下面 `PRESETS` 里对应那一段 CSS 就行，选择器不用动。
 */
export var RUNNING_SKIN: RunningSkinId = 'whale'
/**
 * 设置面板里的方块的顺序。`off` 排第一：想回到原样的人一眼能找到。
 * （默认选中鲸鱼娘；已有存储选择保持不变。）
 */
export var SKIN_IDS: RunningSkinId[] = ['off', 'plane', 'pulse', 'rotate', 'whale']

/** 运行时选择的存储键。浏览器控制台里改它再刷新，等价于点设置面板。 */
var STORAGE_KEY = 'dsh-hud:running-skin'

/** 自己这块样式表的 tag，用于幂等注入；与 `styles.ts` 那块互不干扰。 */
var TAG_ID = 'dsh-hud/running-skin.css'

/** 内存状态是生效值；存储只负责初始化、持久化与跨窗口同步。 */
var selected: RunningSkinId | null = null
var storageFailed = false
var listeners = new Set<() => void>()

function storedSkin(value: string | null): RunningSkinId {
  return value !== null && Object.prototype.hasOwnProperty.call(PRESETS, value)
    ? (value as RunningSkinId)
    : RUNNING_SKIN
}

/** 存储不可读时保留内存选择，不把异常当成「恢复默认」。 */
function readStoredSkin(): RunningSkinId | null {
  try {
    return storedSkin(window.localStorage.getItem(STORAGE_KEY))
  } catch (error) {
    return null
  }
}

/** 设置行订阅同一份生效状态。 */
export function subscribeRunningSkin(listener: () => void): () => void {
  listeners.add(listener)
  return function () {
    listeners.delete(listener)
  }
}

function notify(): void {
  listeners.forEach(function (listener) {
    listener()
  })
}

/**
 * 纸飞机（16×16 实心）。base64 是为了让 `url()` 里不出现引号与尖括号 ——
 * 那两种字符在 CSS 的 mask 里要么得转义、要么直接解析失败。
 */
var PLANE_MASK =
  'url("data:image/svg+xml;base64,' +
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiI+' +
  'PHBhdGggZD0iTTE0LjYgMS40IDEuNCA2LjlsNSAxLjcgMS43IDV6IiBmaWxsPSIjMDAwIi8+PC9zdmc+")'

/**
 * 三个皮肤共用的部分：藏掉官方图标里的两个子元素（APNG mask + 静态 SVG 兜底），
 * 让 `_runningIcon` 这个容器空出来当自己的画布。
 *
 * 容器本身保留官方给的尺寸（`calc(14px + var(--dsh-content-font-delta,0px))`）与
 * `contain:strict`，所以这里不动宽高 —— 字号调大时图标会跟着长大。
 */
var BASE = [
  '[data-chat-running] [class*="_runningIcon"]>span,',
  '[data-chat-running] [class*="_runningIcon"]>svg{display:none}',
  // 系统开了「减弱动态效果」就都别动：官方那套是这么做的，自己加的也要跟上，
  // 否则用户关掉动效之后只有我们这一处在动。
  '@media (prefers-reduced-motion:reduce){',
  '[data-chat-running] [class*="_runningIcon"],',
  '[data-chat-running] [data-shimmer],',
  '[data-chat-running] [class*="_runningContent"]::after{animation:none!important}}',
].join('')

/** 静态纸飞机：给不需要图标动画的皮肤复用（PULSE / ROTATE）。 */
var PLANE_STILL = [
  '[data-chat-running] [class*="_runningIcon"]{background:currentColor;mask:',
  PLANE_MASK,
  ' center/contain no-repeat}',
].join('')

/** 纸飞机 + 官方扫光放慢：动效还在，但不那么抢眼。 */
var PLANE = [
  '[data-chat-running] [class*="_runningIcon"]{background:currentColor;mask:',
  PLANE_MASK,
  ' center/contain no-repeat;animation:dshh-plane 2.6s ease-in-out infinite}',
  '@keyframes dshh-plane{0%,100%{transform:translate3d(0,0,0) rotate(0)}',
  '50%{transform:translate3d(1px,-2px,0) rotate(-8deg)}}',
  // 扫光的两个动画层要一起改：只改外层，遮罩和文字会错位。
  '[data-chat-running] [data-shimmer]>[inert]>span,',
  '[data-chat-running] [data-shimmer]>[inert]>span>span{',
  'animation-duration:3s;animation-delay:0s;animation-timing-function:linear}',
  '[data-chat-running] [data-shimmer]>[inert]>span{',
  'mask-image:linear-gradient(105deg,transparent 18%,#000 46% 54%,transparent 82%)}',
].join('')

/** 纸飞机不动 + 去掉扫光，改成文字呼吸 + 尾部光标。 */
var PULSE = [
  PLANE_STILL,
  // 扫光是叠在文字上的第二层，整层藏掉；底层是真文本节点，会留着。
  '[data-chat-running] [data-shimmer]>[inert]{display:none}',
  '[data-chat-running] [data-shimmer]{animation:dshh-breathe 2.8s ease-in-out infinite}',
  '@keyframes dshh-breathe{0%,100%{opacity:.55}50%{opacity:1}}',
  // `_runningContent` 是 inline-flex 且带 6px gap，::after 会自动跟文字隔开。
  '[data-chat-running] [class*="_runningContent"]::after{content:"";',
  'width:1.5px;height:12px;margin-left:1px;background:currentColor;',
  'animation:dshh-blink 1.1s steps(1,end) infinite}',
  '@keyframes dshh-blink{0%,49.9%{opacity:1}50%,100%{opacity:0}}',
].join('')

/**
 * 轮播文案：官方那行整块藏掉，文字交给 `running-text.ts` 挂上去的 span。
 *
 * 只藏成功挂载了替换节点的运行行。多会话或 DOM 挂载失败时不打标，官方文案保留。
 */
var ROTATE = [
  PLANE_STILL,
  '[data-chat-running][data-dsh-hud-running-text] [data-shimmer]{display:none}',
].join('')

/** 彩色全身图不走 currentColor mask；只接管图片已加载成功的唯一运行行。 */
var WHALE = [
  '[data-chat-running][data-dsh-hud-running-text] [data-shimmer]{display:none}',
  '[data-chat-running][data-dsh-hud-running-whale] [class*="_runningIcon"]{display:none}',
  '[data-chat-running] .dshh-runWhale{order:-1;width:56px;height:56px;flex:0 0 56px;',
  'object-fit:contain}',
  '[data-chat-running] .dshh-runWhale[hidden]{display:none}',
  '[data-chat-running] .dshh-runText{align-items:center;gap:10px;min-height:56px}',
  '[data-chat-running] .dshh-runCopy{display:inline-flex;flex-direction:column;',
  'align-items:flex-start;justify-content:center;gap:2px;min-width:0}',
  '[data-chat-running] .dshh-runTime{font-size:.78em;line-height:1.2}',
  '[data-chat-running] .dshh-runPhrase{white-space:normal;overflow-wrap:anywhere;line-height:1.4}',
  '@media(prefers-reduced-motion:reduce){[data-chat-running] .dshh-runWhale{animation:none}}',
].join('')

var PRESETS: Record<RunningSkinId, string> = {
  off: '',
  plane: BASE + PLANE,
  pulse: BASE + PULSE,
  rotate: BASE + ROTATE,
  whale: WHALE,
}

/** 当前生效值：只在第一次读取存储，之后由统一入口更新。 */
export function currentSkin(): RunningSkinId {
  if (selected === null) selected = readStoredSkin() || RUNNING_SKIN
  return selected
}

/** 统一更新样式、轮播生命周期与设置选中态。 */
function applySkin(id: RunningSkinId): HTMLStyleElement | null {
  var previous = selected
  selected = id
  var tag = applySkinStyles(id)
  syncRunningText(id)
  if (previous !== id) notify()
  return tag
}

/** 切换立即生效；持久化失败后轮询不能拿旧存储值撤销这次选择。 */
export function setSkin(id: RunningSkinId): RunningSkinId {
  currentSkin()
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
    storageFailed = false
  } catch (error) {
    storageFailed = true
  }
  applySkin(id)
  return id
}

/** 跨窗口变更立刻同步；clear() 与删除该键恢复默认。 */
export function watchRunningSkin(): () => void {
  var onStorage = function (event: StorageEvent) {
    if (event.key !== STORAGE_KEY && event.key !== null) return
    try {
      if (event.storageArea && event.storageArea !== window.localStorage) return
    } catch (error) {
      return
    }
    storageFailed = false
    applySkin(storedSkin(event.newValue))
  }
  window.addEventListener('storage', onStorage)
  ensureRunningSkin()
  return function () {
    window.removeEventListener('storage', onStorage)
    stopRunningText()
    // 切过 off 或发生过 HMR 后，当前节点可能不是起手注入的那个。
    applySkinStyles('off')
  }
}

/**
 * 某个皮肤要注入的样式表。
 *
 * @param id - 皮肤 id，默认取当前生效的那个（`currentSkin()`）；`'off'` 返回空串。
 * @returns 可以直接塞进 `<style>` 的 CSS 文本。
 */
export function runningSkinCss(id: RunningSkinId = currentSkin()): string {
  return PRESETS[id] || ''
}

/**
 * 幂等注入（或撤掉）自己这块样式表。
 *
 * 和 `ensureStyles()` 一样必须打 `data-plugin`：框架的 client-modules 在每次模块物化后
 * 会把当时**没有 `data-plugin`** 的 `<style>` 认领走，并在 HMR 的 replace / prune 路径上
 * 连带删除。不打标的表会被别人领走，页面就退回官方那套。
 *
 * 轮询 / focus 也经过同一入口；持久化失败时保留内存选择。
 * @returns 注入后的样式节点；皮肤为 `'off'` 或没有 `document` 时返回 `null`。
 */
export function ensureRunningSkin(): HTMLStyleElement | null {
  var id = currentSkin()
  if (!storageFailed) id = readStoredSkin() || id
  return applySkin(id)
}

/** 只操作自己的样式节点；调用方负责同步运行状态。 */
function applySkinStyles(id: RunningSkinId): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null
  var selector = 'style[data-plugin-css="' + TAG_ID + '"]'
  var tag = (
    typeof document.querySelector === 'function' ? document.querySelector(selector) : null
  ) as HTMLStyleElement | null
  var css = runningSkinCss(id)
  if (css === '') {
    if (tag && tag.parentNode) tag.parentNode.removeChild(tag)
    return null
  }
  if (!tag) {
    tag = document.createElement('style')
    // 值必须等于客户端模块 id（= 包名）：客户端的 removeOwnedStyles(id) 靠它回收样式。
    tag.setAttribute('data-plugin', '@konnga/dsh-hud')
    tag.setAttribute('data-plugin-css', TAG_ID)
    tag.setAttribute('data-dsh-hud', 'running-skin')
    document.head.appendChild(tag)
  }
  if (tag.textContent !== css) tag.textContent = css
  return tag
}
