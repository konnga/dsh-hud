import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadBundle } from './client-harness.mjs'

function observable(initial) {
  let value = initial
  const listeners = new Set()
  return {
    getSnapshot: () => value,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    set(next) {
      value = next
      for (const fn of listeners) fn()
    },
    listeners,
  }
}
function view(key = 'step:1', phase = 'working', toolName = null) {
  return { key, phase, toolName, attemptId: null, turn: 1, step: 1 }
}
function fixture() {
  const bundle = loadBundle()
  const exported = bundle.registry.definition.factory(bundle.requireModule)
  const face = observable(view())
  const events = observable({ entries: [], change: { kind: 'replace' } })
  const session = Object.assign(observable({ running: true }), {
    projections: {
      faceOf(key) {
        assert.equal(key, 'runningActivity')
        return face
      },
    },
  })
  const store = observable({ sessionId: 'one' })
  let binding = { session, eventSource: events }
  let changes = 0
  const watcher = exported.watchRunningActivity(
    { get: () => ({ binding: () => binding }) },
    store,
    () => changes++,
  )
  function chunk(attemptId, type, turn = 1, step = 1) {
    const entry = {
      type: 'transient',
      event: {
        type: 'assistant/live-chunk',
        data: { attemptId, turn, step, chunk: { type, text: 'SECRET_NOT_FOR_STATUS' } },
      },
    }
    events.set({ entries: [entry], change: { kind: 'append', entries: [entry] } })
  }
  return {
    bundle,
    exported,
    face,
    events,
    session,
    store,
    watcher,
    chunk,
    changes: () => changes,
    replaceBinding: (value) => {
      binding = value
    },
  }
}

test('projection push drives tools without RPC, call identity differs even for same tool name', () => {
  const f = fixture()
  try {
    f.face.set(view('call:one', 'tool', 'read'))
    assert.equal(f.watcher.read().key, 'call:one')
    const count = f.changes()
    f.face.set(view('call:two', 'tool', 'read'))
    assert.equal(f.watcher.read().key, 'call:two')
    assert.ok(f.changes() > count)
    assert.equal(f.bundle.intervals.length, 0, 'subscription introduces no polling timer')
  } finally {
    f.watcher.dispose()
  }
})

test('live reasoning/text/tool arguments are distinct phases; text/arguments never enter status', () => {
  const f = fixture()
  try {
    f.chunk('a', 'reasoning-delta')
    const first = f.watcher.read()
    assert.equal(first.phase, 'thinking')
    f.chunk('a', 'reasoning-delta')
    assert.deepEqual(f.watcher.read(), first)
    f.chunk('a', 'text-delta')
    assert.equal(f.watcher.read().phase, 'responding')
    f.chunk('a', 'tool-call-delta')
    assert.equal(f.watcher.read().phase, 'preparing')
    assert.ok(!JSON.stringify(f.watcher.read()).includes('SECRET'))
    f.face.set(view('call:a', 'tool', 'bash'))
    assert.equal(f.watcher.read().phase, 'tool')
    f.events.set({ entries: [], change: { kind: 'settle-assistant', attemptId: 'a' } })
    f.face.set(view('after:call', 'working'))
    assert.equal(f.watcher.read().phase, 'working')
  } finally {
    f.watcher.dispose()
  }
})

test('stale attempts, historical prepend, unrelated turn and ended sessions cannot restore old activity', () => {
  const f = fixture()
  try {
    f.chunk('new', 'text-delta')
    f.chunk('old', 'finish')
    assert.equal(f.watcher.read().attemptId, 'new')
    f.events.set({ entries: [], change: { kind: 'settle-assistant', attemptId: 'old' } })
    assert.equal(f.watcher.read().attemptId, 'new')
    f.events.set({ entries: [], change: { kind: 'prepend', entries: [] } })
    assert.equal(f.watcher.read().phase, 'responding')
    f.face.set({ ...view('step:2'), step: 2 })
    assert.equal(f.watcher.read().phase, 'working')
    f.session.set({ running: false })
    assert.equal(f.watcher.read().phase, 'idle')
  } finally {
    f.watcher.dispose()
  }
})

test('missing capabilities, rebinding the same session generation and disposal stay safe', () => {
  const f = fixture()
  try {
    f.face.set(undefined)
    assert.equal(f.watcher.read(), null)
    const late = [...f.events.listeners][0]
    f.replaceBinding(undefined)
    assert.equal(f.watcher.read(), null)
    assert.equal(f.events.listeners.size, 0)
    const count = f.changes()
    late()
    assert.equal(f.changes(), count)
    const otherFace = observable(view('new', 'tool', 'write'))
    const otherSession = Object.assign(observable({ running: true }), {
      projections: { faceOf: () => otherFace },
    })
    f.replaceBinding({ session: otherSession })
    assert.equal(f.watcher.read().key, 'new')
    f.watcher.dispose()
    assert.equal(otherFace.listeners.size, 0)
    assert.equal(otherSession.listeners.size, 0)
    assert.equal(f.store.listeners.size, 0)
  } finally {
    f.watcher.dispose()
  }
})
