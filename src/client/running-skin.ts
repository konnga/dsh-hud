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

import { getHudSettings } from './hud-settings.js'
import { stopRunningText, syncRunningText } from './running-text.js'
import { isCharacterSkin, isCustomSkin } from '../shared/expression-packs.js'

/** Built-in IDs; custom packs use stable Host-generated IDs. */
export type BuiltinSkinId = 'whale' | 'cyber-whale' | 'longdress-whale' | 'off'
export type RunningSkinId = BuiltinSkinId | `custom:${string}`
export function isRunningSkinId(value: string): value is RunningSkinId {
  return value === 'off' || isCharacterSkin(value)
}

/**
 * 当前启用的皮肤。
 *
 * 这是**默认值**，不是最终生效值：`currentSkin()` 从 localStorage 初始化后
 * 维护内存状态，持久化失败也不会撤销本次选择。
 * 想换成自己的动画：改下面 `PRESETS` 里对应那一段 CSS 就行，选择器不用动。
 */
/** 默认 Q版鲸鱼娘；想换成别的动画，改这里或点设置面板。 */
export var RUNNING_SKIN: RunningSkinId = 'whale'
/**
 * 设置面板里的方块的顺序。`off` 排第一：想回到原样的人一眼能找到。
 * （默认选中 Q版鲸鱼娘；已有存储选择保持不变。）
 */
export var SKIN_IDS: RunningSkinId[] = ['off', 'whale', 'cyber-whale', 'longdress-whale']

/** 运行时选择的存储键。浏览器控制台里改它再刷新，等价于点设置面板。 */
var STORAGE_KEY = 'dsh-hud:running-skin'

/** 自己这块样式表的 tag，用于幂等注入；与 `styles.ts` 那块互不干扰。 */
var TAG_ID = 'dsh-hud/running-skin.css'

/** 内存状态是生效值；存储只负责初始化、持久化与跨窗口同步。 */
var selected: RunningSkinId | null = null
var storageFailed = false
var listeners = new Set<() => void>()

function storedSkin(value: string | null): RunningSkinId {
  // A custom pack can be temporarily unavailable while its Host catalog loads.
  // Do not erase its saved selection merely because it is not cached yet.
  return value !== null && isRunningSkinId(value) ? value : RUNNING_SKIN
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

/** 彩色全身图不走 currentColor mask；只接管图片已加载成功的唯一运行行。 */
var WHALE = [
  // The host centers its children inside a fixed 28px row. Let the owning row
  // grow with our image/copy so large skins cannot paint over adjacent chat rows.
  '[data-chat-running][data-dsh-hud-running-text] [class*="_runningContent"]{',
  'height:auto;min-height:56px;max-width:100%}',
  '[data-chat-running][data-dsh-hud-running-text] [data-shimmer]{display:none}',
  '[data-chat-running][data-dsh-hud-running-whale] [class*="_runningIcon"]{display:none}',
  '[data-chat-running] .dshh-runWhale{order:-1;width:56px;height:56px;flex:0 0 56px;',
  'object-fit:contain}',
  '[data-chat-running] .dshh-runWhale[hidden]{display:none}',
  '[data-chat-running] .dshh-runText{align-items:center;gap:10px;min-height:56px}',
  '[data-chat-running] .dshh-runCopy{display:inline-flex;flex-direction:column;',
  'align-items:flex-start;justify-content:center;gap:2px;min-width:0}',
  // Fact and flavour share one row; the aside is muted and never looks like a second fact.
  '[data-chat-running] .dshh-runLine{display:flex;align-items:baseline;flex-wrap:wrap;',
  'gap:6px;min-width:0}',
  // Same type size as the fact line: the aside only differs by opacity, never by scale.
  '[data-chat-running] .dshh-runTime,[data-chat-running] .dshh-runPhrase,',
  '[data-chat-running] .dshh-runFun{font-size:1em;white-space:nowrap}',
  '[data-chat-running] .dshh-runFun{opacity:.62}',
  '[data-chat-running] .dshh-runFun:not(:empty)::before{content:"\\00B7";margin-right:6px;',
  'opacity:.7}',
  '[data-chat-running] .dshh-runTime{line-height:1.2}',
  '[data-chat-running] .dshh-runPhrase{white-space:normal;overflow-wrap:anywhere;line-height:1.4}',
  // Two soft crests travel left to right inside the glyphs; no duplicate text or layout shifts.
  '@supports(background-clip:text){',
  '[data-chat-running] .dshh-runTime,[data-chat-running] .dshh-runPhrase,',
  '[data-chat-running] .dshh-runFun{',
  'background-image:linear-gradient(110deg,currentColor 0%,currentColor 38%,',
  'color-mix(in srgb,currentColor 60%,transparent) 43%,currentColor 48%,',
  'color-mix(in srgb,currentColor 70%,transparent) 53%,currentColor 58%,currentColor 100%);',
  'background-size:300% 100%;background-repeat:no-repeat;',
  'background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;',
  'animation:dshh-text-ripple 3.6s ease-in-out infinite}',
  '@keyframes dshh-text-ripple{0%{background-position:100% 50%}',
  '75%,100%{background-position:0% 50%}}}',
  '@media(prefers-reduced-motion:reduce){[data-chat-running] .dshh-runWhale{animation:none}',
  '[data-chat-running] .dshh-runTime,[data-chat-running] .dshh-runPhrase,',
  '[data-chat-running] .dshh-runFun{',
  'animation:none;background-image:none;-webkit-text-fill-color:currentColor}}',
].join('')

var PRESETS: Record<BuiltinSkinId, string> = {
  off: '',
  whale: WHALE,
  'cyber-whale': WHALE,
  'longdress-whale': WHALE,
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
  var css = isCustomSkin(id) ? WHALE : PRESETS[id as BuiltinSkinId] || ''
  if (isCharacterSkin(id))
    css = css.replaceAll('56px', String(getHudSettings().preferences.imageSize) + 'px')
  return css
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
