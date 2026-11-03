/** 本地显示偏好与设置面板开关；不访问模型请求或宿主 RPC。 */
export interface HudPreferences {
  imageSize: number
  showElapsed: boolean
  showTurnDuration: boolean
  showGit: boolean
  showTools: boolean
  showBalance: boolean
  showTimer: boolean
}
export interface HudSettingsState {
  open: boolean
  preferences: HudPreferences
  saveFailed: boolean
}
export var IMAGE_SIZES = [32, 40, 48, 56, 64, 72, 80, 96, 104]
export var DEFAULT_PREFERENCES: HudPreferences = {
  imageSize: 56,
  showElapsed: true,
  showTurnDuration: true,
  showGit: true,
  showTools: true,
  showBalance: true,
  showTimer: true,
}
var STORAGE_KEY = 'dsh-hud:display-settings'
var state: HudSettingsState | null = null
var listeners = new Set<() => void>()
var returnFocus: HTMLElement | null = null

// 按保留字段重建，忽略旧 playful、rice、rotateMs 等已移除的独立配置。
function normalize(raw: unknown): HudPreferences {
  var value = raw && typeof raw === 'object' ? (raw as Partial<HudPreferences>) : {}
  return {
    imageSize: IMAGE_SIZES.includes(value.imageSize as number)
      ? value.imageSize!
      : DEFAULT_PREFERENCES.imageSize,
    showGit: typeof value.showGit === 'boolean' ? value.showGit : true,
    showTools: typeof value.showTools === 'boolean' ? value.showTools : true,
    showBalance: typeof value.showBalance === 'boolean' ? value.showBalance : true,
    showTimer: typeof value.showTimer === 'boolean' ? value.showTimer : true,
    showElapsed:
      typeof value.showElapsed === 'boolean' ? value.showElapsed : DEFAULT_PREFERENCES.showElapsed,
    showTurnDuration:
      typeof value.showTurnDuration === 'boolean'
        ? value.showTurnDuration
        : DEFAULT_PREFERENCES.showTurnDuration,
  }
}
function parse(raw: string | null): HudPreferences {
  try {
    return normalize(raw === null ? null : JSON.parse(raw))
  } catch (error) {
    return normalize(null)
  }
}
function read(): HudPreferences | null {
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY))
  } catch (error) {
    return null
  }
}
function same(a: HudPreferences, b: HudPreferences): boolean {
  return (
    a.imageSize === b.imageSize &&
    a.showElapsed === b.showElapsed &&
    a.showTurnDuration === b.showTurnDuration &&
    a.showGit === b.showGit &&
    a.showTools === b.showTools &&
    a.showBalance === b.showBalance &&
    a.showTimer === b.showTimer
  )
}
export function getHudSettings(): HudSettingsState {
  if (state === null)
    state = { open: false, preferences: read() || normalize(null), saveFailed: false }
  return state
}
export function subscribeHudSettings(listener: () => void): () => void {
  listeners.add(listener)
  return function () {
    listeners.delete(listener)
  }
}
function update(next: HudSettingsState): void {
  state = next
  listeners.forEach(function (listener) {
    listener()
  })
}
export function setHudPreferences(patch: Partial<HudPreferences>): void {
  var current = getHudSettings()
  var preferences = normalize({ ...current.preferences, ...patch })
  var failed = false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch (error) {
    failed = true
  }
  update({ ...current, preferences, saveFailed: failed })
}
export function openHudSettings(trigger?: HTMLElement): void {
  var current = getHudSettings()
  if (current.open) return
  returnFocus = trigger || null
  update({ ...current, open: true })
}
export function closeHudSettings(): void {
  var current = getHudSettings()
  if (current.open) update({ ...current, open: false })
  var target = returnFocus
  returnFocus = null
  if (target && target.isConnected && typeof target.focus === 'function') target.focus()
}
/** 新窗口 / focus 同步；持久化失败时不让旧存储撤销本次本地选择。 */
export function watchHudSettings(): () => void {
  getHudSettings()
  function sync(): void {
    var current = getHudSettings()
    if (current.saveFailed) return
    var preferences = read()
    if (preferences && !same(preferences, current.preferences)) update({ ...current, preferences })
  }
  function storage(event: StorageEvent): void {
    if (event.key !== STORAGE_KEY && event.key !== null) return
    try {
      if (event.storageArea && event.storageArea !== window.localStorage) return
    } catch (error) {
      return
    }
    var current = getHudSettings()
    var preferences = parse(event.newValue)
    if (current.saveFailed || !same(preferences, current.preferences))
      update({ ...current, preferences, saveFailed: false })
  }
  window.addEventListener('storage', storage)
  window.addEventListener('focus', sync)
  sync()
  return function () {
    window.removeEventListener('storage', storage)
    window.removeEventListener('focus', sync)
    closeHudSettings()
  }
}
