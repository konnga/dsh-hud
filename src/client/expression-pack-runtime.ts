/** Coordinate Host-owned packs with existing local skin preferences and the player. */
import type { ExpressionPackStore } from './expression-packs.js'
import { isCustomSkin } from '../shared/expression-packs.js'
import { currentSkin, isRunningSkinId, setSkin, subscribeRunningSkin } from './running-skin.js'
import { refreshRunningText } from './running-text.js'

export function bindExpressionPackRuntime(store: ExpressionPackStore): () => void {
  var disposed = false
  var applyingRemote = false
  var restoring = 0
  var selectionVersion = 0
  var refreshVersion = 0
  var pendingSelection: string | null = null
  var saving = false
  var unsavedSelection = false

  function loadSelected(): void {
    var id = currentSkin()
    var state = store.getSnapshot()
    if (disposed || state.phase !== 'ready' || state.busy || !isCustomSkin(id)) return
    var found = state.catalog.packs.some(function (pack) {
      return pack.id === id
    })
    if (!found) {
      if (restoring === 0) setSkin('whale')
      return
    }
    if (!store.getCached(id)) void store.ensureLoaded(id)
  }

  async function drainSelection(): Promise<void> {
    if (saving || disposed || store.getSnapshot().busy || store.getSnapshot().phase !== 'ready')
      return
    saving = true
    try {
      while (pendingSelection !== null && !disposed) {
        var skin = pendingSelection
        pendingSelection = null
        try {
          await store.select(skin)
          if (!disposed && currentSkin() === skin && pendingSelection === null)
            unsavedSelection = false
        } catch {
          // The store exposes the error; retain this window's selected skin and retry
          // after an explicit refresh rather than rolling back a failed local save.
          unsavedSelection = true
          pendingSelection = currentSkin()
          break
        }
      }
    } finally {
      saving = false
      if (!disposed) loadSelected()
    }
  }

  var unsubscribeSkin = subscribeRunningSkin(function () {
    if (disposed) return
    if (!applyingRemote) {
      selectionVersion += 1
      unsavedSelection = true
      pendingSelection = currentSkin()
      void drainSelection()
    }
    loadSelected()
  })
  var unsubscribePacks = store.subscribe(function () {
    if (disposed) return
    // Revision keys invalidate pending images without restarting the cue timer.
    refreshRunningText()
    loadSelected()
    if (!restoring) void drainSelection()
  })

  async function refresh(): Promise<void> {
    if (disposed || saving || store.getSnapshot().busy) return
    var request = ++refreshVersion
    var localVersion = selectionVersion
    restoring += 1
    try {
      await store.refresh()
      if (disposed || request !== refreshVersion || store.getSnapshot().phase !== 'ready') return
      var catalog = store.getSnapshot().catalog
      var saved = catalog.selectedSkin
      if (
        localVersion === selectionVersion &&
        !unsavedSelection &&
        saved !== null &&
        isRunningSkinId(saved)
      ) {
        // The legacy IDs are their own migration: keep them stable and restore only
        // an explicit Host choice. A null Host choice must not replace local prefs.
        applyingRemote = true
        try {
          setSkin(saved)
        } finally {
          applyingRemote = false
        }
      }
      var skin = currentSkin()
      if (
        isCustomSkin(skin) &&
        !catalog.packs.some(function (pack) {
          return pack.id === skin
        })
      ) {
        setSkin('whale')
      }
      if (saved === null || unsavedSelection || localVersion !== selectionVersion) {
        pendingSelection = currentSkin()
      }
    } finally {
      restoring -= 1
      if (!disposed) {
        loadSelected()
        void drainSelection()
        refreshRunningText()
      }
    }
  }

  function focus(): void {
    void refresh()
  }
  window.addEventListener('focus', focus)
  void refresh()
  return function () {
    disposed = true
    pendingSelection = null
    window.removeEventListener('focus', focus)
    unsubscribeSkin()
    unsubscribePacks()
  }
}
