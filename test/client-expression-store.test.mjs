import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { mountClient } from './client-harness.mjs'

const image =
  'data:image/webp;base64,' +
  readFileSync(new URL('../src/client/assets/whale-girl/thinking.webp', import.meta.url)).toString(
    'base64',
  )
function draft(name = 'My pack') {
  return {
    manifest: {
      schemaVersion: 1,
      name,
      author: '',
      version: '1.0.0',
      fallback: 'thinking',
      actions: { thinking: 'images/thinking.webp' },
    },
    files: { 'images/thinking.webp': image },
  }
}
function pack(revision = 'r1', name = 'My pack') {
  return {
    ...draft(name),
    id: 'custom:test',
    name,
    author: '',
    version: '1.0.0',
    revision,
    actionCount: 1,
    bytes: 100,
    updatedAt: '2026-11-02T09:00:00Z',
  }
}
function catalog(packs = [], selectedSkin = null) {
  return { available: true, packs, selectedSkin }
}
function deferred() {
  let resolve, reject
  const promise = new Promise((a, b) => {
    resolve = a
    reject = b
  })
  return { promise, resolve, reject }
}
function fixture(handler, decodeImage = async () => {}) {
  const mounted = mountClient()
  const calls = []
  const store = mounted.exported.createExpressionPacks(
    {
      rpc: {
        call(channel, endpoint, payload) {
          calls.push({ channel, endpoint, args: payload.args })
          return Promise.resolve(handler(endpoint, payload.args))
        },
      },
    },
    { decodeImage },
  )
  return {
    store,
    calls,
    dispose() {
      store.dispose()
      mounted.dispose()
    },
  }
}

test('expression store distinguishes missing endpoints, unavailable storage, errors and empty catalogue', async () => {
  for (const [reply, phase] of [
    [{ ok: false, error: { details: { code: 'unknown-endpoint' } } }, 'restartRequired'],
    [
      {
        ok: true,
        value: { available: false, reason: 'storage-unavailable', packs: [], selectedSkin: null },
      },
      'unsupported',
    ],
    [{ ok: false, error: { details: { code: 'expression-storage-failed' } } }, 'error'],
    [{ ok: true, value: catalog() }, 'ready'],
  ]) {
    const f = fixture(() => reply)
    try {
      assert.equal(f.store.getSnapshot().phase, 'idle')
      await f.store.refresh()
      assert.equal(f.store.getSnapshot().phase, phase)
      assert.equal(f.calls[0].endpoint, 'expression-packs-list')
      assert.deepEqual(f.calls[0].args, {})
    } finally {
      f.dispose()
    }
  }
})

test('expression store decodes before sending save and only publishes the persisted host revision', async () => {
  const decoding = deferred(),
    saving = deferred()
  const f = fixture(
    (endpoint) =>
      endpoint === 'expression-packs-save' ? saving.promise : { ok: true, value: catalog() },
    () => decoding.promise,
  )
  try {
    await f.store.refresh()
    const request = f.store.save(draft())
    assert.equal(f.store.getSnapshot().busy, true)
    assert.equal(f.calls.filter((c) => c.endpoint === 'expression-packs-save').length, 0)
    assert.equal(f.store.getCached('custom:test'), undefined)
    decoding.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(f.calls.filter((c) => c.endpoint === 'expression-packs-save').length, 1)
    assert.equal(f.store.getSnapshot().catalog.packs.length, 0)
    saving.resolve({ ok: true, value: pack('persisted-revision') })
    const saved = await request
    assert.equal(saved.revision, 'persisted-revision')
    assert.equal(f.store.getCached(saved.id).revision, saved.revision)
    assert.equal(f.store.getSnapshot().catalog.packs[0].revision, saved.revision)
    assert.equal(
      f.store.getSnapshot().catalog.selectedSkin,
      null,
      'saving never silently selects the pack',
    )
    assert.equal(f.store.getSnapshot().busy, false)
  } finally {
    f.dispose()
  }
})

test('expression store rejects decoding failures without posting or caching a draft', async () => {
  const f = fixture(
    () => {
      throw new Error('save must not run')
    },
    async () => {
      throw new Error('decode failed')
    },
  )
  try {
    await assert.rejects(f.store.save(draft()))
    assert.equal(f.calls.length, 0)
    assert.equal(f.store.getSnapshot().catalog.packs.length, 0)
    assert.equal(f.store.getCached('custom:test'), undefined)
    assert.equal(f.store.getSnapshot().busy, false)
  } finally {
    f.dispose()
  }
})

test('expression store deduplicates player loads and suppresses notification-driven failure retry loops', async () => {
  const loading = deferred()
  const f = fixture(() => loading.promise)
  try {
    const a = f.store.ensureLoaded('custom:test'),
      b = f.store.ensureLoaded('custom:test')
    assert.equal(f.calls.length, 1)
    let notifications = 0
    f.store.subscribe(() => {
      notifications++
      void f.store.ensureLoaded('custom:test')
    })
    loading.resolve({ ok: false, error: { details: { code: 'expression-not-found' } } })
    await Promise.all([a, b])
    await f.store.ensureLoaded('custom:test')
    assert.equal(f.calls.length, 1)
    assert.equal(notifications, 1)
    assert.equal(f.store.getSnapshot().errorCode, 'expression-not-found')
  } finally {
    f.dispose()
  }
})

test('expression store cannot let an earlier get overwrite a saved revision', async () => {
  const loading = deferred()
  const f = fixture((endpoint) =>
    endpoint === 'expression-packs-get' ? loading.promise : { ok: true, value: pack('r2') },
  )
  try {
    const old = f.store.ensureLoaded('custom:test')
    const saved = await f.store.save(draft(), 'custom:test', 'r1')
    loading.resolve({ ok: true, value: pack('r1') })
    await old
    assert.equal(f.store.getCached('custom:test').revision, 'r2')
    assert.equal(saved.revision, 'r2')
    const call = f.calls.find((c) => c.endpoint === 'expression-packs-save')
    assert.equal(call.args.expectedRevision, 'r1')
  } finally {
    f.dispose()
  }
})

test('expression store deletion cannot be undone by an earlier get and restores host-selected fallback', async () => {
  const loading = deferred()
  const f = fixture((endpoint) =>
    endpoint === 'expression-packs-list'
      ? { ok: true, value: catalog([pack()], 'custom:test') }
      : endpoint === 'expression-packs-get'
        ? loading.promise
        : { ok: true, value: { deleted: true, selectedSkin: 'whale' } },
  )
  try {
    await f.store.refresh()
    const old = f.store.ensureLoaded('custom:test')
    await f.store.remove('custom:test', 'r1')
    loading.resolve({ ok: true, value: pack() })
    await old
    assert.equal(f.store.getCached('custom:test'), undefined)
    assert.equal(f.store.getSnapshot().catalog.packs.length, 0)
    assert.equal(f.store.getSnapshot().catalog.selectedSkin, 'whale')
  } finally {
    f.dispose()
  }
})

test('expression store disposes pending mutations without publishing cache or notifications', async () => {
  const saving = deferred()
  const f = fixture(() => saving.promise)
  let notifications = 0
  f.store.subscribe(() => {
    notifications++
  })
  const request = f.store.save(draft())
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  f.store.dispose()
  const count = notifications
  saving.resolve({ ok: true, value: pack() })
  await assert.rejects(request, (error) => error.code === 'cancelled')
  assert.equal(notifications, count)
  assert.equal(f.store.getCached('custom:test'), undefined)
  f.dispose()
})

test('expression ZIP preview validates but never persists, selects or inserts catalogue entries', async () => {
  const f = fixture(() => ({ ok: true, value: draft('Imported') }))
  try {
    const preview = await f.store.previewZip('eA==')
    assert.equal(preview.manifest.name, 'Imported')
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].endpoint, 'expression-packs-import')
    assert.equal(f.store.getSnapshot().catalog.packs.length, 0)
    assert.equal(f.store.getSnapshot().catalog.selectedSkin, null)
  } finally {
    f.dispose()
  }
})

test('expression store failed persistence keeps the old pack and surfaces revision conflicts', async () => {
  const f = fixture((endpoint) =>
    endpoint === 'expression-packs-get'
      ? { ok: true, value: pack('r1') }
      : { ok: false, error: { details: { code: 'expression-conflict' } } },
  )
  try {
    await f.store.get('custom:test')
    await assert.rejects(
      f.store.save(draft('Updated'), 'custom:test', 'r1'),
      (e) => e.code === 'expression-conflict',
    )
    assert.equal(f.store.getCached('custom:test').name, 'My pack')
    assert.equal(f.store.getSnapshot().errorCode, 'expression-conflict')
  } finally {
    f.dispose()
  }
})

test('expression store does not start pack reads from loading-catalogue notifications', async () => {
  const listing = deferred()
  const f = fixture((endpoint) =>
    endpoint === 'expression-packs-list' ? listing.promise : { ok: true, value: pack('r2') },
  )
  try {
    const refreshing = f.store.refresh()
    await f.store.ensureLoaded('custom:test')
    assert.equal(f.calls.filter((c) => c.endpoint === 'expression-packs-get').length, 0)
    listing.resolve({ ok: true, value: catalog([pack('r2')], 'custom:test') })
    await refreshing
    await f.store.ensureLoaded('custom:test')
    assert.equal(f.store.getCached('custom:test').revision, 'r2')
  } finally {
    f.dispose()
  }
})

test('expression store rejects a get reply that disagrees with the latest catalogue revision', async () => {
  const f = fixture((endpoint) => ({
    ok: true,
    value: endpoint === 'expression-packs-list' ? catalog([pack('r2')]) : pack('r1'),
  }))
  try {
    await f.store.refresh()
    await assert.rejects(f.store.get('custom:test'), (e) => e.code === 'cancelled')
    assert.equal(f.store.getCached('custom:test'), undefined)
    assert.equal(f.store.getSnapshot().catalog.packs[0].revision, 'r2')
  } finally {
    f.dispose()
  }
})

test('remote deletion discovered by refresh cannot be undone by an earlier get', async () => {
  const loading = deferred()
  let removed = false
  const f = fixture((endpoint) =>
    endpoint === 'expression-packs-list'
      ? { ok: true, value: catalog(removed ? [] : [pack()]) }
      : loading.promise,
  )
  try {
    await f.store.refresh()
    const pending = f.store.ensureLoaded('custom:test')
    removed = true
    await f.store.refresh()
    loading.resolve({ ok: true, value: pack() })
    await pending
    assert.equal(f.store.getCached('custom:test'), undefined)
    assert.deepEqual(f.store.getSnapshot().catalog.packs, [])
  } finally {
    f.dispose()
  }
})

test('expression store validates thinking, path and file count before persistence', async () => {
  const f = fixture(() => {
    throw new Error('no request expected')
  })
  try {
    const missing = draft()
    missing.manifest.actions.thinking = ''
    await assert.rejects(f.store.save(missing), (e) => e.code === 'missing-thinking')
    const outside = draft()
    outside.files = { 'other.webp': image }
    outside.manifest.actions.thinking = 'other.webp'
    await assert.rejects(f.store.save(outside), (e) => e.code === 'invalid-image')
    const tooMany = draft()
    for (let i = 0; i < 30; i++) tooMany.files[`images/extra-${i}.webp`] = image
    await assert.rejects(f.store.save(tooMany), (e) => e.code === 'too-many-files')
    assert.equal(f.calls.length, 0)
  } finally {
    f.dispose()
  }
})
