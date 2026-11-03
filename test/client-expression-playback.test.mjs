/** Imported packs use the real bundled player; these are state tests, not visual QA. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { findAll, mountClient } from './client-harness.mjs'
import { runningDom } from './client-running-dom.mjs'

const asset = (name) =>
  'data:image/webp;base64,' +
  readFileSync(
    new URL(`../src/client/assets/cyber-whale-girl/${name}.webp`, import.meta.url),
  ).toString('base64')
const FIRST = asset('thinking')
const SECOND = asset('typing')
const ID = 'custom:sample-whale'
function pack(revision = 'one', image = FIRST) {
  return {
    id: ID,
    name: 'Test whale',
    author: '',
    version: '1.0.0',
    revision,
    actionCount: 1,
    bytes: 12345,
    updatedAt: '2026-11-02T00:00:00.000Z',
    manifest: {
      schemaVersion: 1,
      name: 'Test whale',
      version: '1.0.0',
      fallback: 'thinking',
      actions: { thinking: 'images/thinking.webp' },
    },
    files: { 'images/thinking.webp': image },
  }
}
const settle = () => new Promise((resolve) => setImmediate(resolve))
function fixture(options = {}) {
  const backend = {
    pack: pack(),
    selectedSkin: options.selectedSkin === undefined ? ID : options.selectedSkin,
  }
  const calls = []
  const mounted = mountClient({
    storageValues: options.storageValues,
    rpc: async (_channel, endpoint, payload) => {
      calls.push({ endpoint, args: payload.args })
      if (endpoint === 'expression-packs-list') {
        if (options.list) return options.list(backend)
        return {
          ok: true,
          value: {
            available: true,
            packs: backend.pack ? [{ ...backend.pack, manifest: undefined, files: undefined }] : [],
            selectedSkin: backend.selectedSkin,
          },
        }
      }
      if (endpoint === 'expression-packs-get') return { ok: true, value: backend.pack }
      if (endpoint === 'expression-packs-select') {
        if (options.failSelection) {
          options.failSelection -= 1
          return { ok: false, error: { details: { code: 'expression-storage-failed' } } }
        }
        backend.selectedSkin = payload.args.skin
        return { ok: true, value: { selectedSkin: backend.selectedSkin } }
      }
      return {
        ok: false,
        error: { message: 'not in this fixture', details: { code: 'unknown-endpoint' } },
      }
    },
  })
  const dom = runningDom(mounted, options.dom)
  const root = dom.root()
  return { backend, mounted, dom, root, calls }
}
function choose(mounted, index) {
  const row = mounted.components['dsh-hud-running-skin']({ t: (key) => key })
  findAll(row, (node) => node.props?.className === 'dshh-skinCube')[index].props.onClick()
}

test('Host-selected custom pack restores without touching built-in assets or resetting sizes', async () => {
  const f = fixture({
    storageValues: { 'dsh-hud:display-settings': JSON.stringify({ imageSize: 40 }) },
  })
  try {
    await settle()
    f.dom.tick()
    assert.equal(f.mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'), ID)
    assert.equal(f.dom.image(f.root).src, FIRST)
    assert.equal(f.dom.image(f.root).getAttribute('data-action'), 'thinking')
    assert.ok(
      f.mounted.styles.some((style) => style.textContent.includes('width:40px;height:40px')),
    )
  } finally {
    f.mounted.dispose()
  }
})

test('a one-image pack keeps its fallback image while the phrase clock advances', async (t) => {
  let now = 10_000
  t.mock.method(Date, 'now', () => now)
  const f = fixture()
  let activity = { key: 'read-1', phase: 'tool', toolName: 'read_file', turn: 1, step: 1 }
  f.mounted.exported.configureRunningText({
    readActivity: () => activity,
    resolveText: (text) => text.zh,
  })
  try {
    await settle()
    f.dom.tick()
    assert.equal(f.dom.image(f.root).src, FIRST)
    const phrase = f.dom.phrase(f.root)
    const count = f.dom.images.length
    f.dom.tick()
    assert.equal(f.dom.phrase(f.root), phrase, 'refreshing the same event must not churn')
    // 新调用 + 两个轮换周期：姿势会推进，但单图包始终回落到它自己的文件。
    activity = { ...activity, key: 'read-2', step: 2 }
    now += 12_500
    f.dom.tick()
    assert.equal(f.dom.phrase(f.root), phrase, 'same tool category keeps factual text')
    assert.equal(
      f.dom.image(f.root).src,
      FIRST,
      'a one-image pack always falls back to its own file',
    )
    assert.equal(f.dom.images.length, count, 'the same fallback file should not decode again')
  } finally {
    f.mounted.dispose()
  }
})

test('same-path revision updates replace the visible custom image without switching skins', async () => {
  const f = fixture()
  try {
    await settle()
    f.dom.tick()
    assert.equal(f.dom.image(f.root).src, FIRST)
    f.backend.pack = pack('two', SECOND)
    f.mounted.dispatch('focus', {})
    await settle()
    f.dom.tick()
    assert.equal(f.dom.image(f.root).src, SECOND)
    assert.equal(f.mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'), ID)
  } finally {
    f.mounted.dispose()
  }
})

test('replacing a custom file invalidates the old pending decode', async () => {
  const decoding = []
  const f = fixture({
    dom: { manualLoad: true, decode: () => new Promise((resolve) => decoding.push(resolve)) },
  })
  try {
    await settle()
    f.dom.tick()
    f.dom.load()
    assert.equal(decoding.length, 1)
    f.backend.pack = pack('two', SECOND)
    f.mounted.dispatch('focus', {})
    await settle()
    f.dom.tick()
    f.dom.load()
    assert.equal(decoding.length, 2)
    decoding[0]()
    await settle()
    assert.equal(f.dom.image(f.root).hidden, true)
    decoding[1]()
    await settle()
    assert.equal(f.dom.image(f.root).src, SECOND)
    assert.equal(f.dom.image(f.root).hidden, false)
  } finally {
    f.mounted.dispose()
  }
})

test('missing selected custom pack falls back only after a successful catalog read', async () => {
  const f = fixture()
  try {
    await settle()
    f.dom.tick()
    f.backend.pack = null
    f.backend.selectedSkin = 'whale'
    f.mounted.dispatch('focus', {})
    await settle()
    f.dom.tick()
    assert.equal(f.mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'), 'whale')
    assert.notEqual(f.dom.image(f.root).src, FIRST)
  } finally {
    f.mounted.dispose()
  }
})

test('an unavailable Host preserves custom selection rather than overwriting it', async () => {
  const f = fixture({
    storageValues: { 'dsh-hud:running-skin': ID },
    list: async () => ({
      ok: true,
      value: { available: false, packs: [], selectedSkin: null, reason: 'storage-unavailable' },
    }),
  })
  try {
    await settle()
    f.dom.tick()
    assert.equal(f.mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'), ID)
    assert.equal(f.dom.image(f.root).hidden, true)
    assert.equal(f.calls.filter((call) => call.endpoint === 'expression-packs-select').length, 0)
  } finally {
    f.mounted.dispose()
  }
})

test('null Host preference rejects the removed paper-plane choice and keeps whale default', async () => {
  const f = fixture({ selectedSkin: null, storageValues: { 'dsh-hud:running-skin': 'rotate' } })
  try {
    await settle()
    assert.equal(f.backend.selectedSkin, 'whale')
    assert.equal(f.calls.filter((call) => call.endpoint === 'expression-packs-select').length, 1)
  } finally {
    f.mounted.dispose()
  }
})

test('a local choice made during catalog load wins over the old Host choice', async () => {
  let resolveList
  const f = fixture({
    list: () =>
      new Promise((resolve) => {
        resolveList = resolve
      }),
  })
  try {
    choose(f.mounted, 2)
    resolveList({ ok: true, value: { available: true, packs: [f.backend.pack], selectedSkin: ID } })
    await settle()
    assert.equal(f.mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'), 'cyber-whale')
    assert.equal(f.backend.selectedSkin, 'cyber-whale')
  } finally {
    f.mounted.dispose()
  }
})

test('manager refresh retries an unsaved selection without a window focus event or a retry loop', async () => {
  const f = fixture({ failSelection: 1 })
  try {
    await settle()
    choose(f.mounted, 1)
    await settle()
    assert.equal(f.backend.selectedSkin, ID)
    assert.equal(f.mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'), 'whale')
    assert.equal(f.calls.filter((call) => call.endpoint === 'expression-packs-select').length, 1)
    const store = f.mounted.registrations
      .find((entry) => entry.options.id === 'dsh-hud-settings')
      .options.inject().packs
    await store.refresh()
    await settle()
    assert.equal(f.backend.selectedSkin, 'whale')
    assert.equal(f.calls.filter((call) => call.endpoint === 'expression-packs-select').length, 2)
  } finally {
    f.mounted.dispose()
  }
})

test('custom pack selection respects reduced motion', async (t) => {
  let now = 10000
  t.mock.method(Date, 'now', () => now)
  const f = fixture()
  f.mounted.windowStub.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  })
  try {
    await settle()
    f.dom.tick()
    const phrase = f.dom.phrase(f.root)
    now += 10000
    f.dom.tick()
    assert.equal(f.dom.phrase(f.root), phrase)
    assert.equal(f.dom.image(f.root).src, FIRST)
  } finally {
    f.mounted.dispose()
  }
})
