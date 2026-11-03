/** Read-only relay directory. Never binds or changes the active conversation/model. */
import { CHANNEL } from './shared.js'
import type { HudProviderBalance, HudProviderToken } from './shared.js'
import type { HudConnection, ProviderBalancePayload } from './store/types.js'
import { balanceOf } from './store/provider.js'

export interface RelayEntry {
  id: string
  label: string
  baseURL: string | null
  copyURL: string | null
  token: HudProviderToken | null
  key: HudProviderToken | null
}
export interface RelayDetail {
  phase: 'loading' | 'ready' | 'error' | 'unsupported'
  balance: HudProviderBalance | null
}
export interface RelaySecret {
  phase: 'loading' | 'revealed' | 'error' | 'restartRequired' | 'missing' | 'unsupported'
  value: string | null
}
type SecretKind = 'key' | 'token'
export type CopyPhase = 'loading' | 'copied' | 'error'
export type ClipboardWriter = (text: string) => Promise<void>
export interface RelayDirectoryState {
  phase:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error'
    | 'unsupported'
    | 'restartRequired'
    | 'settingsUnavailable'
  providers: RelayEntry[]
  details: Record<string, RelayDetail>
  secrets: Record<string, RelaySecret>
  tokenSecrets: Record<string, RelaySecret>
  copies: Record<string, { key?: CopyPhase; token?: CopyPhase; address?: CopyPhase }>
}
export interface RelayDirectory {
  getSnapshot(): RelayDirectoryState
  subscribe(listener: () => void): () => void
  activate(autoQuery?: boolean): () => void
  refresh(): Promise<void>
  query(id: string): Promise<void>
  reveal(id: string): Promise<void>
  hide(id: string): void
  revealToken(id: string): Promise<void>
  hideToken(id: string): void
  copyToken(id: string, writeText?: ClipboardWriter): Promise<void>
  clearSecrets(): void
  copyKey(id: string, writeText?: ClipboardWriter): Promise<void>
  copyAddress(id: string, writeText?: ClipboardWriter): Promise<void>
}
export const EMPTY_DIRECTORY: RelayDirectoryState = {
  phase: 'unsupported',
  providers: [],
  details: {},
  secrets: {},
  tokenSecrets: {},
  copies: {},
}
/**
 * 已查询到的余额是读数、不含凭据，所以可以缓存到本地，避免每次打开面板都重查一遍。
 * 只保留仍在有效期内的条目；过期后回到「查询余额」，不会拿旧数字冒充当前余额。
 */
var CACHE_KEY = 'dsh-hud:relay-balance-cache'
var CACHE_MS = 10 * 60 * 1000
interface CachedBalance {
  detail: RelayDetail
  at: number
}
function readBalanceCache(): Record<string, CachedBalance> {
  try {
    var raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    var parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    var now = Date.now()
    var kept: Record<string, CachedBalance> = {}
    Object.keys(parsed as Record<string, unknown>).forEach(function (id) {
      var entry = (parsed as Record<string, CachedBalance>)[id]
      if (!entry || typeof entry !== 'object') return
      if (typeof entry.at !== 'number' || now - entry.at > CACHE_MS) return
      var detail = entry.detail
      if (!detail || (detail.phase !== 'ready' && detail.phase !== 'unsupported')) return
      if (!detail.balance || detail.balance.provider !== id) return
      kept[id] = { detail: detail, at: entry.at }
    })
    return kept
  } catch (error) {
    return {}
  }
}
function writeBalanceCache(
  details: Record<string, RelayDetail>,
  times: Record<string, number>,
): void {
  try {
    var next: Record<string, CachedBalance> = {}
    Object.keys(details).forEach(function (id) {
      var detail = details[id]
      if (detail.phase !== 'ready' || !detail.balance) return
      var at = times[id]
      if (typeof at !== 'number') return
      next[id] = { detail: detail, at: at }
    })
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch (error) {
    // 存储不可用时只是少了缓存，不影响本轮查询结果。
  }
}
/** Display only the origin: never show userinfo, query, fragments or secret path segments. */
export function safeRelayAddress(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    var url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}
/** Copy the host-sanitized API address, retaining endpoint path but never URL credentials. */
function copyRelayAddress(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    var url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}
function entriesOf(raw: unknown): RelayEntry[] {
  if (!Array.isArray(raw)) return []
  var ids = new Set<string>()
  return raw.flatMap(function (value): RelayEntry[] {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof value.id !== 'string' ||
      !value.id ||
      ids.has(value.id)
    )
      return []
    ids.add(value.id)
    return [
      {
        id: value.id,
        label: typeof value.label === 'string' && value.label ? value.label : value.id,
        baseURL: safeRelayAddress(value.baseURL),
        copyURL: copyRelayAddress(value.baseURL),
        key:
          value.key && typeof value.key.configured === 'boolean'
            ? { ref: '', configured: value.key.configured }
            : null,
        token:
          value.token && typeof value.token.configured === 'boolean'
            ? { ref: '', configured: value.token.configured }
            : null,
      },
    ]
  })
}
export function createRelayDirectory(connection: HudConnection): RelayDirectory {
  var hydrated: Record<string, RelayDetail> = {}
  var cached = readBalanceCache()
  var detailTimes: Record<string, number> = {}
  Object.keys(cached).forEach(function (id) {
    hydrated[id] = cached[id].detail
    detailTimes[id] = cached[id].at
  })
  /** 到期后不再展示旧读数，重新回到「查询余额」。 */
  function isFresh(id: string): boolean {
    var at = detailTimes[id]
    return typeof at === 'number' && Date.now() - at <= CACHE_MS
  }
  var state: RelayDirectoryState = {
    phase: 'idle',
    providers: [],
    details: hydrated,
    secrets: {},
    tokenSecrets: {},
    copies: {},
  }
  var listeners = new Set<() => void>()
  var active = false
  var generation = 0
  var secretTickets = new Map<string, number>()
  var copyTickets = new Map<string, number>()
  var nextCopyTicket = 0
  function set(next: RelayDirectoryState): void {
    state = next
    listeners.forEach(function (listener) {
      listener()
    })
  }
  async function refresh(): Promise<void> {
    if (!active) return
    var ticket = ++generation
    // Queried balances are results, not credentials: keep them visible while the list
    // reloads so switching tabs does not look like the balance was lost.
    // A 'loading' marker belongs to an in-flight request that leaving the tab cancels;
    // keeping it would block a re-query forever. Only finished results survive.
    var keptDetails: Record<string, RelayDetail> = {}
    Object.keys(state.details).forEach(function (id) {
      if (state.details[id].phase !== 'loading' && isFresh(id)) keptDetails[id] = state.details[id]
    })
    clearSecrets()
    set({
      phase: 'loading',
      providers: state.providers,
      details: keptDetails,
      secrets: {},
      tokenSecrets: {},
      copies: {},
    })
    try {
      var result = await connection.rpc.call<{
        available?: boolean
        providers?: unknown
        reason?: string
      }>(CHANNEL, 'provider-list', { args: {} })
      if (!active || ticket !== generation) return
      if (!result.ok) {
        set({
          phase: result.error?.details?.code === 'unknown-endpoint' ? 'restartRequired' : 'error',
          providers: [],
          details: {},
          secrets: {},
          tokenSecrets: {},
          copies: {},
        })
      } else if (result.value?.available !== true) {
        set({
          phase:
            result.value?.reason === 'settings-unavailable'
              ? 'settingsUnavailable'
              : result.value?.reason === 'settings-failed'
                ? 'error'
                : 'unsupported',
          providers: [],
          details: {},
          secrets: {},
          tokenSecrets: {},
          copies: {},
        })
      } else {
        var providers = entriesOf(result.value.providers)
        // Keep results for providers that still exist; drop ones that disappeared.
        var details: Record<string, RelayDetail> = {}
        providers.forEach(function (provider) {
          var previous = keptDetails[provider.id]
          if (previous) details[provider.id] = previous
        })
        set({
          phase: 'ready',
          providers: providers,
          details: details,
          secrets: {},
          tokenSecrets: {},
          copies: {},
        })
      }
    } catch {
      if (active && ticket === generation)
        set({
          phase: 'error',
          providers: [],
          details: {},
          secrets: {},
          tokenSecrets: {},
          copies: {},
        })
    }
  }
  async function query(id: string): Promise<void> {
    if (
      !active ||
      state.phase !== 'ready' ||
      !state.providers.some(function (p) {
        return p.id === id
      }) ||
      state.details[id]?.phase === 'loading'
    )
      return
    var ticket = generation
    set({ ...state, details: { ...state.details, [id]: { phase: 'loading', balance: null } } })
    try {
      var result = await connection.rpc.call<ProviderBalancePayload>(
        CHANNEL,
        'provider-detail-balance',
        { args: { provider: id } },
      )
      if (!active || ticket !== generation) return
      var balance = result.ok && result.value ? balanceOf(result.value) : null
      if (balance?.provider !== id) balance = null
      const token = (result.value as { token?: HudProviderToken } | null)?.token
      var providers =
        token && typeof token.configured === 'boolean'
          ? state.providers.map(function (provider) {
              return provider.id === id
                ? { ...provider, token: { ref: '', configured: token.configured } }
                : provider
            })
          : state.providers
      var reason = (result.value as { reason?: string } | null)?.reason
      var unsupported =
        reason === 'unsupported' || result.error?.details?.code === 'unknown-endpoint'
      var details = {
        ...state.details,
        [id]: {
          phase: balance
            ? ('ready' as const)
            : unsupported
              ? ('unsupported' as const)
              : ('error' as const),
          balance,
        },
      }
      detailTimes[id] = Date.now()
      set({ ...state, providers: providers, details: details })
      writeBalanceCache(details, detailTimes)
    } catch {
      if (active && ticket === generation)
        set({ ...state, details: { ...state.details, [id]: { phase: 'error', balance: null } } })
    }
  }
  function clearSecrets(): void {
    secretTickets.clear()
    copyTickets.clear()
    set({ ...state, secrets: {}, tokenSecrets: {}, copies: {} })
  }
  function secretMap(kind: SecretKind): Record<string, RelaySecret> {
    return kind === 'key' ? state.secrets : state.tokenSecrets
  }
  function setSecret(id: string, kind: SecretKind, secret: RelaySecret): void {
    var next = { ...secretMap(kind), [id]: secret }
    set(kind === 'key' ? { ...state, secrets: next } : { ...state, tokenSecrets: next })
  }
  function hide(id: string, kind: SecretKind = 'key'): void {
    secretTickets.delete(JSON.stringify([id, kind]))
    copyTickets.delete(JSON.stringify([id, kind]))
    if (kind === 'key') copyTickets.delete(JSON.stringify([id, 'address']))
    var previous = Object.prototype.hasOwnProperty.call(state.copies, id) ? state.copies[id] : {}
    var entry = { ...previous }
    delete entry[kind]
    if (kind === 'key') delete entry.address
    var copies = { ...state.copies }
    if (Object.keys(entry).length) copies[id] = entry
    else delete copies[id]
    var secrets = { ...secretMap(kind) }
    delete secrets[id]
    set(
      kind === 'key'
        ? { ...state, secrets: secrets, copies: copies }
        : { ...state, tokenSecrets: secrets, copies: copies },
    )
  }
  var nextSecretTicket = 0
  async function reveal(id: string, kind: SecretKind = 'key'): Promise<void> {
    if (!active || state.phase !== 'ready') return
    var provider = state.providers.find(function (entry) {
      return entry.id === id
    })
    if (!provider) return
    var requestId = JSON.stringify([id, kind])
    if (secretTickets.has(requestId)) return
    if (kind === 'token' && !provider.token?.configured) {
      setSecret(id, kind, {
        phase: provider.token === null ? 'unsupported' : 'missing',
        value: null,
      })
      return
    }
    var ticket = ++nextSecretTicket
    var currentGeneration = generation
    secretTickets.set(requestId, ticket)
    setSecret(id, kind, { phase: 'loading', value: null })
    try {
      var result = await connection.rpc.call<{
        available?: boolean
        provider?: string
        apiKey?: unknown
        accessToken?: unknown
        reason?: string
      }>(CHANNEL, kind === 'key' ? 'provider-key' : 'provider-token', { args: { provider: id } })
      if (!active || currentGeneration !== generation || secretTickets.get(requestId) !== ticket)
        return
      var raw = kind === 'key' ? result.value?.apiKey : result.value?.accessToken
      var value =
        result.ok &&
        result.value?.available === true &&
        result.value.provider === id &&
        typeof raw === 'string' &&
        raw.length > 0
          ? raw
          : null
      var phase: RelaySecret['phase'] =
        value !== null
          ? 'revealed'
          : result.error?.details?.code === 'unknown-endpoint'
            ? 'restartRequired'
            : result.value?.reason === 'not-configured'
              ? 'missing'
              : result.value?.reason === 'not-supported'
                ? 'unsupported'
                : 'error'
      setSecret(id, kind, { phase: phase, value: value })
    } catch {
      if (active && currentGeneration === generation && secretTickets.get(requestId) === ticket)
        setSecret(id, kind, { phase: 'error', value: null })
    } finally {
      if (secretTickets.get(requestId) === ticket) secretTickets.delete(requestId)
    }
  }
  function setCopy(id: string, kind: SecretKind | 'address', phase: CopyPhase): void {
    var previous = Object.prototype.hasOwnProperty.call(state.copies, id) ? state.copies[id] : {}
    set({ ...state, copies: { ...state.copies, [id]: { ...previous, [kind]: phase } } })
  }
  async function copy(
    id: string,
    kind: SecretKind | 'address',
    writeText?: ClipboardWriter,
  ): Promise<void> {
    if (!active || state.phase !== 'ready') return
    var provider = state.providers.find(function (entry) {
      return entry.id === id
    })
    if (!provider) return
    var requestId = JSON.stringify([id, kind])
    if (copyTickets.has(requestId)) return
    var ticket = ++nextCopyTicket
    var currentGeneration = generation
    copyTickets.set(requestId, ticket)
    setCopy(id, kind, 'loading')
    var current = function () {
      return active && generation === currentGeneration && copyTickets.get(requestId) === ticket
    }
    try {
      if (!writeText) throw new Error('clipboard unavailable')
      var value: string | null = kind === 'address' ? provider.copyURL : null
      if (kind !== 'address') {
        if (kind === 'token' && !provider.token?.configured) throw new Error('token unavailable')
        var secrets = secretMap(kind)
        var secret = Object.prototype.hasOwnProperty.call(secrets, id) ? secrets[id] : undefined
        if (secret?.phase === 'revealed') value = secret.value
        else {
          var result = await connection.rpc.call<{
            available?: boolean
            provider?: string
            apiKey?: unknown
            accessToken?: unknown
          }>(CHANNEL, kind === 'key' ? 'provider-key' : 'provider-token', {
            args: { provider: id },
          })
          if (!current()) return
          var raw = kind === 'key' ? result.value?.apiKey : result.value?.accessToken
          value =
            result.ok &&
            result.value?.available === true &&
            result.value.provider === id &&
            typeof raw === 'string' &&
            raw.length > 0
              ? raw
              : null
        }
      }
      if (!current()) return
      if (value === null) throw new Error('copy unavailable')
      // No await between final lifecycle check and initiating the explicit clipboard write.
      await writeText(value)
      if (current()) setCopy(id, kind, 'copied')
    } catch {
      if (current()) setCopy(id, kind, 'error')
    } finally {
      if (copyTickets.get(requestId) === ticket) copyTickets.delete(requestId)
    }
  }
  return {
    getSnapshot: function () {
      return state
    },
    subscribe: function (listener) {
      listeners.add(listener)
      return function () {
        listeners.delete(listener)
      }
    },
    activate: function (autoQuery?: boolean) {
      active = true
      var started = refresh()
      if (autoQuery) {
        // Opening the tab is the user asking for balances; ask once for everything
        // still missing while fresh cached readings are left untouched.
        void started.then(function () {
          if (!active || state.phase !== 'ready') return
          state.providers.forEach(function (provider) {
            if (isFresh(provider.id) && state.details[provider.id]?.balance) return
            void query(provider.id)
          })
        })
      }
      return function () {
        active = false
        generation++
        clearSecrets()
      }
    },
    refresh,
    query,
    reveal,
    hide,
    clearSecrets,
    revealToken: function (id) {
      return reveal(id, 'token')
    },
    hideToken: function (id) {
      hide(id, 'token')
    },
    copyToken: function (id, writeText) {
      return copy(id, 'token', writeText)
    },
    copyKey: function (id, writeText) {
      return copy(id, 'key', writeText)
    },
    copyAddress: function (id, writeText) {
      return copy(id, 'address', writeText)
    },
  }
}
