/** Borrow the selected session's pushed projection and transient stream; never poll RPC or fold history. */
import type { RunningActivityView } from '../shared/running-activity.js'
import type { DisplayActivity } from './running-activity-cues.js'
import type { HudStore } from './shared.js'

interface Face<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}
interface LiveEntry {
  type: 'event' | 'transient'
  event: {
    type: string
    data: {
      attemptId?: string
      turn?: number
      step?: number
      chunk?: { type?: string; blockType?: string }
    }
  }
}
interface EventWindow {
  entries: readonly LiveEntry[]
  change?: { kind: string; entries?: readonly LiveEntry[]; attemptId?: string }
}
interface Binding {
  session: Face<{ running: boolean }> & { projections: { faceOf(key: string): Face<unknown> } }
  eventSource?: Face<EventWindow>
}
interface Sessions {
  binding(id: string): Binding | undefined
}
const phases = new Set([
  'preparing',
  'waiting',
  'thinking',
  'responding',
  'tool',
  'approval',
  'working',
  'error',
  'idle',
])

function activityView(value: unknown): RunningActivityView | null {
  if (!value || typeof value !== 'object') return null
  const v = value as RunningActivityView
  return typeof v.key === 'string' &&
    phases.has(v.phase) &&
    (v.toolName === null || typeof v.toolName === 'string') &&
    (v.attemptId === null || typeof v.attemptId === 'string') &&
    Number.isSafeInteger(v.turn) &&
    Number.isSafeInteger(v.step)
    ? v
    : null
}

export function watchRunningActivity(
  ctx: { get(name: string): unknown },
  store: HudStore,
  changed: () => void,
): { read(): DisplayActivity | null; dispose(): void } {
  let sessions: Sessions | undefined
  let binding: Binding | undefined
  let face: Face<unknown> | undefined
  let sessionId: string | null = null
  let stops: Array<() => void> = []
  let disposed = false
  let live: RunningActivityView | null = null
  let liveBaseKey: string | null = null
  let lastWindow: EventWindow | undefined
  let generation = 0

  function detach(): void {
    generation += 1
    const previous = stops
    stops = []
    binding = undefined
    face = undefined
    live = null
    liveBaseKey = null
    lastWindow = undefined
    for (const stop of previous) stop()
  }

  function streamChanged(): void {
    const window = binding?.eventSource?.getSnapshot()
    if (!window || window === lastWindow) return
    const first = lastWindow === undefined
    lastWindow = window
    const change = window.change
    if (change?.kind === 'settle-assistant') {
      if (live?.attemptId === change.attemptId) {
        live = null
        liveBaseKey = null
      }
      return
    }
    if (change?.kind === 'prepend') return
    if (first || change?.kind === 'replace') {
      live = null
      liveBaseKey = null
    }
    // Only transient records belong here. All durable events are folded by the Host projection.
    const entries = first || change?.kind === 'replace' ? window.entries : change?.entries || []
    for (const entry of entries) {
      if (entry.type !== 'transient' || entry.event.type !== 'assistant/live-chunk') continue
      const data = entry.event.data
      if (!data.attemptId || !Number.isSafeInteger(data.turn) || !Number.isSafeInteger(data.step))
        continue
      const chunk = data.chunk
      if (!chunk) continue
      if (chunk.type === 'finish') {
        if (live?.attemptId === data.attemptId) {
          live = null
          liveBaseKey = null
        }
        continue
      }
      const kind = chunk.type === 'block-start' ? chunk.blockType : chunk.type
      const phase =
        kind === 'reasoning' || kind === 'reasoning-delta'
          ? 'thinking'
          : kind === 'text' || kind === 'text-delta'
            ? 'responding'
            : kind === 'tool-call' || kind === 'tool-call-delta'
              ? 'preparing'
              : null
      if (!phase) continue
      const key = `stream:${data.attemptId}:${phase}`
      if (live?.key === key) continue
      live = {
        key,
        phase,
        attemptId: data.attemptId,
        toolName: null,
        turn: data.turn!,
        step: data.step!,
      }
      liveBaseKey = activityView(face?.getSnapshot())?.key || null
    }
  }

  function sync(): void {
    if (disposed) return
    const id = store.getSnapshot().sessionId || null
    let next: Binding | undefined
    try {
      sessions = ctx.get('sessions') as Sessions | undefined
      next = id ? sessions?.binding?.(id) : undefined
    } catch {
      next = undefined
    }
    if (sessionId === id && binding === next) return
    detach()
    sessionId = id
    if (!next) return
    binding = next
    const ticket = generation
    function notify(): void {
      if (disposed || ticket !== generation) return
      try {
        streamChanged()
      } catch {
        live = null
      }
      changed()
    }
    try {
      face = next.session.projections.faceOf('runningActivity')
      stops.push(face.subscribe(notify), next.session.subscribe(notify))
      if (next.eventSource) stops.push(next.eventSource.subscribe(notify))
      streamChanged()
    } catch {
      detach()
    }
  }

  const stopStore = store.subscribe(function () {
    sync()
    changed()
  })
  // This listener only rebinds after a connection/page generation changes.
  const focus = function () {
    sync()
    changed()
  }
  window.addEventListener('focus', focus)
  sync()
  return {
    read() {
      sync()
      if (disposed || !sessionId || !binding) return null
      try {
        const snapshot = binding.session.getSnapshot()
        if (!snapshot.running) {
          live = null
          liveBaseKey = null
          return {
            sessionId,
            key: 'idle',
            phase: 'idle',
            toolName: null,
            attemptId: null,
            turn: 0,
            step: 0,
          }
        }
        const base = activityView(face?.getSnapshot())
        if (!base) return null // Old Host / unavailable projection: generic static state, no guesses.
        const modelPhase = base.phase === 'waiting' || base.phase === 'working'
        if (
          live &&
          modelPhase &&
          base.turn === live.turn &&
          base.step === live.step &&
          (base.attemptId === null || base.attemptId === live.attemptId) &&
          (liveBaseKey === null || base.key === liveBaseKey)
        ) {
          return { ...live, sessionId }
        }
        return { ...base, sessionId }
      } catch {
        return null
      }
    },
    dispose() {
      disposed = true
      stopStore()
      window.removeEventListener('focus', focus)
      detach()
    },
  }
}
