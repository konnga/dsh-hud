/** Host-backed expression packs. Only persisted Host replies update the runtime cache. */
import { CHANNEL } from './shared.js'
import type { HudConnection } from './store/types.js'
import { EXPRESSION_ACTIONS, EXPRESSION_LIMITS, isCustomSkin } from '../shared/expression-packs.js'
import type {
  ExpressionCatalog,
  ExpressionDraft,
  ExpressionPack,
} from '../shared/expression-packs.js'

export type ExpressionPhase =
  'idle' | 'loading' | 'ready' | 'error' | 'unsupported' | 'restartRequired'
export interface ExpressionPackState {
  phase: ExpressionPhase
  catalog: ExpressionCatalog
  errorCode: string | null
  busy: boolean
  revision: number
}
export interface ExpressionPackStore {
  getSnapshot(): ExpressionPackState
  subscribe(listener: () => void): () => void
  refresh(): Promise<void>
  get(id: string): Promise<ExpressionPack>
  getCached(id: string): ExpressionPack | undefined
  ensureLoaded(id: string): Promise<void>
  save(draft: ExpressionDraft, id?: string, expectedRevision?: string): Promise<ExpressionPack>
  remove(
    id: string,
    expectedRevision: string,
  ): Promise<{ deleted: true; selectedSkin: string | null }>
  previewZip(base64: string): Promise<ExpressionDraft>
  exportZip(id: string): Promise<{ base64: string; name: string }>
  select(skin: string): Promise<{ selectedSkin: string }>
  dispose(): void
}
export class ExpressionPackError extends Error {
  constructor(public code: string) {
    super(code)
    this.name = 'ExpressionPackError'
  }
}
export function expressionErrorCode(error: unknown): string {
  return error instanceof ExpressionPackError ? error.code : 'request-failed'
}
function fail(code: string): never {
  throw new ExpressionPackError(code)
}
export function base64Bytes(value: string): number {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    fail('invalid-image')
  return (value.length / 4) * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0)
}
/** Enforce static formats before browser decode; the Host validates independently. */
export function expressionImageBytes(value: string): number {
  var match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(value)
  if (!match) fail('invalid-image')
  var size = base64Bytes(match[2])
  if (size > EXPRESSION_LIMITS.maxFileBytes) fail('file-too-large')
  var raw: string
  try {
    raw = atob(match[2])
  } catch {
    return fail('invalid-image')
  }
  function uint32(at: number, little = false): number {
    if (at + 4 > raw.length) fail('invalid-image')
    var bytes = [0, 1, 2, 3].map(function (i) {
      return raw.charCodeAt(at + i)
    })
    if (little) bytes.reverse()
    return bytes[0] * 0x1000000 + bytes[1] * 0x10000 + bytes[2] * 0x100 + bytes[3]
  }
  if (match[1] === 'png') {
    if (raw.slice(0, 8) !== '\x89PNG\r\n\x1a\n') fail('invalid-image')
    for (var p = 8; p < raw.length;) {
      var length = uint32(p)
      if (p + length + 12 > raw.length) fail('invalid-image')
      if (raw.slice(p + 4, p + 8) === 'acTL') fail('animated-image')
      p += length + 12
    }
  } else {
    if (
      raw.slice(0, 4) !== 'RIFF' ||
      raw.slice(8, 12) !== 'WEBP' ||
      uint32(4, true) + 8 !== raw.length
    )
      fail('invalid-image')
    for (var q = 12; q < raw.length;) {
      var kind = raw.slice(q, q + 4)
      var count = uint32(q + 4, true)
      if (q + count + 8 > raw.length) fail('invalid-image')
      if (kind === 'ANIM' || kind === 'ANMF' || (kind === 'VP8X' && raw.charCodeAt(q + 8) & 2))
        fail('animated-image')
      q += 8 + count + (count & 1)
    }
  }
  return size
}
export async function decodeExpressionImage(url: string): Promise<void> {
  if (typeof Image === 'undefined') fail('decode-unavailable')
  var image = new Image()
  image.src = url
  try {
    if (typeof image.decode !== 'function') fail('decode-unavailable')
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) fail('invalid-image')
    if (Math.max(image.naturalWidth, image.naturalHeight) > EXPRESSION_LIMITS.maxDimension)
      fail('image-too-large')
  } catch (error) {
    if (error instanceof ExpressionPackError) throw error
    fail('invalid-image')
  } finally {
    image.src = ''
  }
}
export function validateExpressionShape(draft: ExpressionDraft): void {
  if (
    !draft ||
    typeof draft !== 'object' ||
    !draft.manifest ||
    typeof draft.files !== 'object' ||
    !draft.files
  )
    fail('invalid-pack')
  var manifest = draft.manifest
  if (manifest.schemaVersion !== 1 || manifest.fallback !== 'thinking') fail('unsupported-version')
  if (
    typeof manifest.name !== 'string' ||
    !manifest.name.trim() ||
    manifest.name.length > 80 ||
    typeof manifest.version !== 'string' ||
    !manifest.version.trim() ||
    manifest.version.length > 40 ||
    (manifest.author !== undefined &&
      (typeof manifest.author !== 'string' || manifest.author.length > 120))
  )
    fail('invalid-metadata')
  if (
    !manifest.actions ||
    typeof manifest.actions !== 'object' ||
    typeof manifest.actions.thinking !== 'string' ||
    !manifest.actions.thinking
  )
    fail('missing-thinking')
  var files = Object.entries(draft.files)
  if (!files.length || files.length > EXPRESSION_LIMITS.maxFiles) fail('too-many-files')
  var total = 0
  files.forEach(function ([path, url]) {
    if (
      !/^images\/[A-Za-z0-9_./-]+\.(png|webp)$/i.test(path) ||
      path.length > 180 ||
      path.split('/').length > 5 ||
      path.split('/').some(function (part) {
        return !part || ['.', '..', '__proto__', 'constructor', 'prototype'].includes(part)
      }) ||
      typeof url !== 'string'
    )
      fail('invalid-image')
    total += expressionImageBytes(url)
  })
  if (total > EXPRESSION_LIMITS.maxPackBytes) fail('pack-too-large')
  Object.entries(manifest.actions).forEach(function ([action, path]) {
    if (
      !EXPRESSION_ACTIONS.includes(action as (typeof EXPRESSION_ACTIONS)[number]) ||
      typeof path !== 'string' ||
      !Object.prototype.hasOwnProperty.call(draft.files, path)
    )
      fail('missing-image')
  })
}
export async function validateExpressionDraft(
  draft: ExpressionDraft,
  decode = decodeExpressionImage,
): Promise<void> {
  validateExpressionShape(draft)
  // Decode sequentially so a 30-image import does not retain 30 full-resolution bitmaps.
  for (var url of Object.values(draft.files)) await decode(url)
}
var configured: ExpressionPackStore | undefined
export function getExpressionPackStore(): ExpressionPackStore | undefined {
  return configured
}
export function configureExpressionPackStore(store: ExpressionPackStore): () => void {
  configured = store
  return function () {
    if (configured === store) configured = undefined
  }
}
export function createExpressionPacks(
  connection: HudConnection,
  options: { decodeImage?: (url: string) => Promise<void> } = {},
): ExpressionPackStore {
  var state: ExpressionPackState = {
    phase: 'idle',
    catalog: { available: false, packs: [], selectedSkin: null },
    errorCode: null,
    busy: false,
    revision: 0,
  }
  var listeners = new Set<() => void>()
  var cache = new Map<string, ExpressionPack>()
  var loading = new Map<string, Promise<ExpressionPack>>()
  var failedLoads = new Set<string>()
  var epoch = 0
  var listTicket = 0
  var disposed = false
  function publish(patch: Partial<ExpressionPackState>): void {
    if (disposed) return
    state = { ...state, ...patch, revision: state.revision + 1 }
    listeners.forEach(function (listener) {
      listener()
    })
  }
  function current(ticket: number): void {
    if (disposed || ticket !== epoch) fail('cancelled')
  }
  function report(error: unknown): void {
    var code = expressionErrorCode(error)
    if (code === 'cancelled' || disposed) return
    publish({
      phase:
        code === 'unknown-endpoint'
          ? 'restartRequired'
          : code === 'unsupported' || code === 'expression-unavailable'
            ? 'unsupported'
            : 'error',
      errorCode: code,
    })
  }
  async function rpc<T>(endpoint: string, args: unknown): Promise<T> {
    if (disposed) fail('cancelled')
    try {
      var reply = await connection.rpc.call<T>(CHANNEL, endpoint, { args })
      if (!reply.ok) fail(reply.error?.details?.code || 'request-failed')
      if (reply.value == null) fail('invalid-response')
      return reply.value
    } catch (error) {
      if (error instanceof ExpressionPackError) throw error
      return fail('request-failed')
    }
  }
  function storePack(pack: ExpressionPack): void {
    if (!isCustomSkin(pack.id) || typeof pack.revision !== 'string') fail('invalid-response')
    validateExpressionShape(pack)
    cache.delete(pack.id)
    cache.set(pack.id, pack)
    while (cache.size > 3) {
      var evict = Array.from(cache.keys()).find(function (id) {
        return id !== state.catalog.selectedSkin && id !== pack.id
      })
      if (!evict) break
      cache.delete(evict)
    }
  }
  function summary(pack: ExpressionPack): ExpressionCatalog['packs'][number] {
    return {
      id: pack.id,
      name: pack.name,
      author: pack.author,
      version: pack.version,
      revision: pack.revision,
      actionCount: pack.actionCount,
      bytes: pack.bytes,
      updatedAt: pack.updatedAt,
    }
  }
  async function refresh(): Promise<void> {
    if (disposed || state.busy) return
    var ticket = ++epoch
    loading.clear()
    failedLoads.clear()
    var list = ++listTicket
    publish({ phase: 'loading', errorCode: null })
    try {
      var catalog = await rpc<ExpressionCatalog>('expression-packs-list', {})
      if (disposed || ticket !== epoch || list !== listTicket) return
      if (!catalog || !Array.isArray(catalog.packs)) fail('invalid-response')
      if (!catalog.available) {
        publish({
          phase: catalog.reason === 'unknown-endpoint' ? 'restartRequired' : 'unsupported',
          catalog,
          errorCode: catalog.reason || 'unsupported',
        })
        return
      }
      for (var [id, pack] of cache) {
        if (
          !catalog.packs.some(function (entry) {
            return entry.id === id && entry.revision === pack.revision
          })
        )
          cache.delete(id)
      }
      publish({ phase: 'ready', catalog, errorCode: null })
    } catch (error) {
      if (ticket === epoch && list === listTicket) report(error)
    }
  }
  async function get(id: string): Promise<ExpressionPack> {
    if (disposed) fail('cancelled')
    if (!isCustomSkin(id)) fail('not-found')
    var cached = cache.get(id)
    if (cached) return cached
    if (state.busy || state.phase === 'loading') fail('busy')
    var pending = loading.get(id)
    if (pending) return pending
    var ticket = epoch
    var operation = (async function () {
      try {
        var pack = await rpc<ExpressionPack>('expression-packs-get', { id })
        current(ticket)
        if (pack.id !== id) fail('invalid-response')
        if (
          state.catalog.available &&
          !state.catalog.packs.some(function (entry) {
            return entry.id === id && entry.revision === pack.revision
          })
        )
          fail('cancelled')
        storePack(pack)
        publish({ errorCode: null })
        return pack
      } catch (error) {
        if (ticket === epoch) {
          failedLoads.add(id)
          report(error)
        }
        throw error
      }
    })()
    loading.set(id, operation)
    try {
      return await operation
    } finally {
      if (loading.get(id) === operation) loading.delete(id)
    }
  }
  async function mutate<T>(operation: (ticket: number) => Promise<T>): Promise<T> {
    if (disposed) fail('cancelled')
    if (state.busy) fail('busy')
    var ticket = ++epoch
    loading.clear()
    failedLoads.clear()
    publish({ busy: true, errorCode: null })
    try {
      return await operation(ticket)
    } catch (error) {
      if (ticket === epoch) report(error)
      throw error
    } finally {
      if (ticket === epoch) publish({ busy: false })
    }
  }
  return {
    getSnapshot: function () {
      return state
    },
    subscribe: function (listener) {
      if (disposed) return function () {}
      listeners.add(listener)
      return function () {
        listeners.delete(listener)
      }
    },
    refresh,
    get,
    getCached: function (id) {
      return cache.get(id)
    },
    ensureLoaded: async function (id) {
      if (failedLoads.has(id) || state.busy || state.phase === 'loading') return
      try {
        await get(id)
      } catch {
        /* Retry only after refresh or a persisted mutation. */
      }
    },
    save: function (draft, id, expectedRevision) {
      return mutate(async function (ticket) {
        await validateExpressionDraft(draft, options.decodeImage)
        current(ticket)
        var pack = await rpc<ExpressionPack>('expression-packs-save', {
          draft,
          ...(id ? { id, expectedRevision } : {}),
        })
        current(ticket)
        storePack(pack)
        var packs = state.catalog.packs.filter(function (entry) {
          return entry.id !== pack.id
        })
        packs.push(summary(pack))
        publish({
          phase: 'ready',
          catalog: { ...state.catalog, available: true, packs },
          errorCode: null,
        })
        return pack
      })
    },
    remove: function (id, expectedRevision) {
      return mutate(async function (ticket) {
        var result = await rpc<{ deleted: true; selectedSkin: string | null }>(
          'expression-packs-delete',
          { id, expectedRevision },
        )
        current(ticket)
        if (result.deleted !== true) fail('invalid-response')
        cache.delete(id)
        publish({
          phase: 'ready',
          catalog: {
            ...state.catalog,
            packs: state.catalog.packs.filter(function (pack) {
              return pack.id !== id
            }),
            selectedSkin: result.selectedSkin,
          },
          errorCode: null,
        })
        return result
      })
    },
    previewZip: async function (base64) {
      if (base64Bytes(base64) > EXPRESSION_LIMITS.maxZipBytes) fail('zip-too-large')
      var ticket = epoch
      try {
        var draft = await rpc<ExpressionDraft>('expression-packs-import', { base64 })
        current(ticket)
        await validateExpressionDraft(draft, options.decodeImage)
        current(ticket)
        return draft
      } catch (error) {
        if (ticket === epoch) report(error)
        throw error
      }
    },
    exportZip: async function (id) {
      var ticket = epoch
      try {
        var result = await rpc<{ base64: string; name: string }>('expression-packs-export', { id })
        current(ticket)
        if (
          base64Bytes(result.base64) > EXPRESSION_LIMITS.maxZipBytes ||
          typeof result.name !== 'string'
        )
          fail('invalid-response')
        return result
      } catch (error) {
        if (ticket === epoch) report(error)
        throw error
      }
    },
    select: function (skin) {
      return mutate(async function (ticket) {
        var result = await rpc<{ selectedSkin: string }>('expression-packs-select', { skin })
        current(ticket)
        if (result.selectedSkin !== skin) fail('invalid-response')
        publish({
          phase: 'ready',
          errorCode: null,
          catalog: { ...state.catalog, selectedSkin: result.selectedSkin },
        })
        return result
      })
    },
    dispose: function () {
      disposed = true
      epoch++
      listTicket++
      cache.clear()
      loading.clear()
      listeners.clear()
    },
  }
}
