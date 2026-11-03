import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { test } from 'node:test'
import { zipSync } from 'fflate'
import {
  createExpressionPackService,
  exportExpressionZip,
  importExpressionZip,
  validateExpressionDraft,
  validateExpressionImage,
} from '../lib/host/expression-packs.js'
import { CHANNEL } from '../lib/host/index.js'
import { call, mount, JSON_HEADERS, requestBody } from './helpers.mjs'

const clone = (value) => structuredClone(value)
function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function storage() {
  const state = {
    records: new Map(),
    global: null,
    opens: 0,
    closes: 0,
    open: false,
    beforePut: null,
    beforeOpen: null,
    globalWrites: 0,
    failGlobalAt: 0,
    failPut: false,
    failDelete: false,
  }
  state.facility = {
    async open(spec) {
      state.opens++
      // Exact constraints from DSH storage UNIT_NAME_RE and JSON SAFE_KEY_RE.
      assert.match(spec.name, /^[a-z][a-z0-9_]*$/, 'DSH rejects hyphens in domain names')
      for (const name of Object.keys(spec.tables)) assert.match(name, /^[a-z][a-z0-9_]*$/)
      state.spec = spec
      if (state.beforeOpen) await state.beforeOpen()
      if (state.open) throw new Error('already open')
      state.open = true
      if (!state.global) state.global = clone(spec.global.initial)
      for (const value of state.records.values()) spec.tables.packs.valueSchema.parse(value)
      spec.global.schema.parse(state.global)
      let closed = false
      return {
        table(name) {
          assert.equal(name, 'packs')
          return {
            get(key) {
              return state.records.get(key)
            },
            entries() {
              return state.records.entries()
            },
            async put(key, value) {
              assert.match(key, /^[a-zA-Z0-9_-]+$/, 'JSON record keys cannot contain a colon')
              if (state.beforePut) await state.beforePut()
              if (state.failPut) throw new Error('disk failure')
              spec.tables.packs.valueSchema.parse(value)
              state.records.set(key, clone(value))
            },
            async delete(key) {
              if (state.failDelete) throw new Error('disk failure')
              return state.records.delete(key)
            },
          }
        },
        global: {
          get() {
            return clone(state.global)
          },
          async set(value) {
            state.globalWrites++
            if (state.globalWrites === state.failGlobalAt) throw new Error('disk failure')
            spec.global.schema.parse(value)
            state.global = clone(value)
          },
        },
        async close() {
          if (!closed) {
            closed = true
            state.open = false
            state.closes++
          }
        },
      }
    },
  }
  return state
}
const create = (state) =>
  createExpressionPackService({
    get: (name) => (name === 'storageDomain' ? state.facility : undefined),
  })
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data = Buffer.alloc(0)) {
  const bytes = Buffer.alloc(data.length + 12)
  bytes.writeUInt32BE(data.length)
  bytes.write(type, 4)
  data.copy(bytes, 8)
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4)
  return bytes
}
function png(width = 2, height = 2, extra = []) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const pixels = Buffer.alloc((width * 4 + 1) * height, 180)
  for (let y = 0; y < height; y++) pixels[y * (width * 4 + 1)] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    ...extra,
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND'),
  ])
}
const pngUrl = (bytes) => 'data:image/png;base64,' + bytes.toString('base64')
function draft(name = 'My Whale') {
  return {
    manifest: {
      schemaVersion: 1,
      name,
      author: '',
      version: '1.0.0',
      fallback: 'thinking',
      actions: { thinking: 'images/thinking.png' },
    },
    files: { 'images/thinking.png': pngUrl(png()) },
  }
}
const code = (expected) => (error) => error.code === expected

test('expression validation accepts static PNG/WebP, missing optional poses and empty author', () => {
  const checked = validateExpressionDraft(draft())
  assert.equal(checked.draft.manifest.author, undefined)
  assert.equal(checked.draft.manifest.name, 'My Whale')
  assert.equal(checked.bytes, png().length)
  const bytes = readFileSync(
    new URL('../src/client/assets/cyber-whale-girl/thinking.webp', import.meta.url),
  )
  assert.equal(
    validateExpressionImage('data:image/webp;base64,' + bytes.toString('base64'), 'images/a.webp')
      .bytes,
    bytes.length,
  )
})

test('expression validation rejects missing/unknown actions, foreign paths and mismatched formats', () => {
  for (const change of [
    (value) => delete value.manifest.actions.thinking,
    (value) => (value.manifest.actions.unknown = 'images/thinking.png'),
    (value) => (value.manifest.actions.thinking = 'https://example.org/picture.png'),
    (value) => (value.manifest.actions.thinking = '../thinking.png'),
    (value) => (value.manifest.actions.thinking = 'images/missing.png'),
    (value) => (value.files['images/a.svg'] = 'data:image/svg+xml;base64,PHN2Zy8+'),
    (value) => (value.files['images/thinking.png'] = 'data:image/webp;base64,AAAA'),
    (value) => (value.manifest.schemaVersion = 2),
  ]) {
    const value = draft()
    change(value)
    assert.throws(() => validateExpressionDraft(value), code('expression-invalid'))
  }
})

test('expression image validation checks full PNG chunks, checksums, pixel stream, dimensions and animation markers', () => {
  const badCrc = png()
  badCrc[badCrc.length - 1] ^= 1
  const badPixel = png()
  const ihdr = badPixel.subarray(0, 33)
  const missingPixels = Buffer.concat([
    ihdr,
    chunk('IDAT', deflateSync(Buffer.alloc(1))),
    chunk('IEND'),
  ])
  for (const bytes of [
    badCrc,
    png().subarray(0, -3),
    Buffer.concat([png(), Buffer.from([0])]),
    png(1025, 1),
    png(2, 2, [chunk('acTL', Buffer.alloc(8))]),
    missingPixels,
  ]) {
    assert.throws(
      () => validateExpressionImage(pngUrl(bytes), 'images/a.png'),
      code('expression-invalid'),
    )
  }
})

test('expression ZIP round-trip preserves original data; import is only a preview and accepts directory entries', async () => {
  const source = draft(),
    exported = exportExpressionZip(source),
    imported = importExpressionZip(exported.base64)
  assert.deepEqual(
    JSON.parse(JSON.stringify(imported)),
    JSON.parse(JSON.stringify(validateExpressionDraft(source).draft)),
  )
  const withDirectories = zipSync({
    'images/': new Uint8Array(),
    'manifest.json': Buffer.from(JSON.stringify(source.manifest)),
    'images/thinking.png': png(),
  })
  assert.equal(
    importExpressionZip(Buffer.from(withDirectories).toString('base64')).manifest.name,
    'My Whale',
  )
  const state = storage(),
    service = create(state)
  assert.equal((await service.import(exported.base64)).manifest.name, 'My Whale')
  assert.equal(state.opens, 0)
  assert.equal((await service.list()).packs.length, 0)
  await service.dispose()
})

test('expression ZIP validation rejects duplicate/unexpected paths, too many images and oversized expanded entry metadata', () => {
  const source = draft()
  const fixtures = [
    { 'manifest.json': Buffer.from(JSON.stringify(source.manifest)), '../a.png': png() },
    {
      'manifest.json': Buffer.from(JSON.stringify(source.manifest)),
      'images/a.gif': Buffer.from('GIF89a'),
    },
    { 'images/a.png': png() },
    { 'manifest.json': Buffer.alloc(65537) },
    {
      'manifest.json': Buffer.from(JSON.stringify(source.manifest)),
      ...Object.fromEntries(Array.from({ length: 31 }, (_, i) => ['images/' + i + '.png', png()])),
    },
  ]
  for (const entries of fixtures)
    assert.throws(
      () => importExpressionZip(Buffer.from(zipSync(entries)).toString('base64')),
      code('expression-invalid'),
    )
})

test('expression Host service persists complete records and selection across reopen, exports data-only ZIP', async () => {
  const state = storage(),
    service = create(state)
  const pack = await service.save(draft())
  assert.match(pack.id, /^custom:[a-f0-9-]{36}$/)
  assert.equal(state.spec.name, 'dsh_hud_expression_packs')
  assert.equal(state.spec.layout, 'per-record')
  assert.deepEqual([...state.records.keys()], [pack.id.slice('custom:'.length)])
  assert.equal(state.records.get(pack.id.slice('custom:'.length)).id, pack.id)
  assert.equal(pack.actionCount, 1)
  assert.equal((await service.list()).selectedSkin, null)
  await service.select(pack.id)
  const fetched = await service.get(pack.id)
  fetched.manifest.name = 'mutated outside'
  assert.equal((await service.get(pack.id)).manifest.name, 'My Whale')
  assert.equal(
    importExpressionZip((await service.export(pack.id)).base64).manifest.name,
    'My Whale',
  )
  await service.dispose()
  assert.equal(state.closes, 1)
  const reopened = create(state)
  assert.equal((await reopened.list()).selectedSkin, pack.id)
  assert.equal((await reopened.get(pack.id)).revision, pack.revision)
  await reopened.dispose()
})

test('expression concurrent revisions serialize and preserve the successful writer', async () => {
  const state = storage(),
    service = create(state),
    pack = await service.save(draft())
  const results = await Promise.allSettled([
    service.save(draft('A'), pack.id, pack.revision),
    service.save(draft('B'), pack.id, pack.revision),
  ])
  assert.equal(results[0].status, 'fulfilled')
  assert.equal(results[1].status, 'rejected')
  assert.equal(results[1].reason.code, 'expression-conflict')
  assert.equal((await service.get(pack.id)).name, 'A')
  await assert.rejects(service.save(draft(), pack.id), code('expression-conflict'))
  await assert.rejects(service.save(draft(), 'whale', 'revision'), code('expression-invalid'))
  await service.dispose()
})

test('expression failed writes publish no pack and queued reads wait for persistence', async () => {
  const state = storage(),
    service = create(state),
    pending = deferred(),
    started = deferred()
  state.beforePut = async () => {
    started.resolve()
    await pending.promise
  }
  const saving = service.save(draft())
  await started.promise
  let readFinished = false
  const listing = service.list().then((value) => {
    readFinished = true
    return value
  })
  await Promise.resolve()
  assert.equal(readFinished, false)
  assert.equal(state.records.size, 0)
  state.failPut = true
  pending.resolve()
  await assert.rejects(saving, code('expression-storage-failed'))
  assert.equal((await listing).packs.length, 0)
  state.beforePut = null
  state.failPut = false
  assert.equal((await service.save(draft())).name, 'My Whale')
  await service.dispose()
})

test('expression deletion validates revision and selection returns to whale', async () => {
  const state = storage(),
    service = create(state),
    pack = await service.save(draft())
  await service.select(pack.id)
  await assert.rejects(service.delete(pack.id, 'old'), code('expression-conflict'))
  assert.equal((await service.list()).packs.length, 1)
  assert.deepEqual(await service.delete(pack.id, pack.revision), {
    deleted: true,
    selectedSkin: 'whale',
  })
  await assert.rejects(service.get(pack.id), code('expression-not-found'))
  for (const skin of ['off', 'whale', 'cyber-whale', 'longdress-whale'])
    assert.equal((await service.select(skin)).selectedSkin, skin)
  await assert.rejects(service.select('plane'), code('expression-invalid'))
  await assert.rejects(service.select('custom:missing'), code('expression-invalid'))
  await service.dispose()
})

test('expression interrupted delete recovers before another selection and after reopening', async () => {
  for (const reopen of [false, true]) {
    const state = storage()
    let service = create(state)
    const pack = await service.save(draft())
    await service.select(pack.id)
    state.failGlobalAt = 3
    await assert.rejects(service.delete(pack.id, pack.revision), code('expression-storage-failed'))
    assert.equal(state.records.size, 0)
    assert.equal(state.global.pendingDelete.id, pack.id)
    if (reopen) {
      await service.dispose()
      service = create(state)
    }
    assert.deepEqual((await service.list()).packs, [])
    assert.equal((await service.list()).selectedSkin, 'whale')
    assert.equal(state.global.pendingDelete, null)
    await assert.rejects(service.select('plane'), code('expression-invalid'))
    await service.dispose()
  }
})

test('expression service retries missing or initially failing storage and never opens a domain twice', async () => {
  const state = storage()
  let enabled = false
  const service = createExpressionPackService({ get: () => (enabled ? state.facility : undefined) })
  assert.equal((await service.list()).available, false)
  enabled = true
  await Promise.all([service.list(), service.list(), service.list()])
  assert.equal(state.opens, 1)
  await service.dispose()
  const broken = storage()
  const actual = broken.facility.open
  let first = true
  broken.facility.open = async (spec) => {
    if (first) {
      first = false
      throw new Error('temporary')
    }
    return actual(spec)
  }
  const retry = create(broken)
  assert.equal((await retry.list()).available, false)
  assert.equal((await retry.list()).available, true)
  await retry.dispose()
})

test('expression dispose during domain open closes the eventual handle and rejects subsequent work', async () => {
  const state = storage(),
    pending = deferred(),
    started = deferred()
  state.beforeOpen = async () => {
    started.resolve()
    await pending.promise
  }
  const service = create(state),
    listing = service.list()
  await started.promise
  const disposing = service.dispose()
  pending.resolve()
  await disposing
  assert.equal((await listing).available, false)
  assert.equal(state.closes, 1)
  await assert.rejects(service.save(draft()), code('expression-disposed'))
  await service.dispose()
  assert.equal(state.closes, 1)
})

test('expression service enforces the saved pack count limit', async () => {
  const state = storage(),
    service = create(state)
  for (let i = 0; i < 20; i++) await service.save(draft('Pack ' + i))
  await assert.rejects(service.save(draft('21')), code('expression-invalid'))
  const first = (await service.list()).packs[0]
  await service.save(draft('Updated'), first.id, first.revision)
  assert.equal((await service.list()).packs.length, 20)
  await service.dispose()
})

test('expression RPC exposes all operations and preserves the original request fence/body limits', async () => {
  const state = storage(),
    mounted = mount({ services: { storageDomain: state.facility } })
  const rpc = async (endpoint, args) => {
    const res = await call(mounted.handler, {
      url: `${CHANNEL}/${endpoint}`,
      headers: JSON_HEADERS,
      body: requestBody(args, 'packs', endpoint),
    })
    return { res, result: JSON.parse(res.body).result }
  }
  const saved = await rpc('expression-packs-save', { draft: draft() })
  assert.equal(saved.result.ok, true)
  const pack = saved.result.value
  assert.equal((await rpc('expression-packs-get', { id: pack.id })).result.value.id, pack.id)
  assert.equal((await rpc('expression-packs-list', {})).result.value.packs.length, 1)
  const exported = await rpc('expression-packs-export', { id: pack.id })
  assert.equal(
    (await rpc('expression-packs-import', { base64: exported.result.value.base64 })).result.value
      .manifest.name,
    'My Whale',
  )
  assert.equal(
    (await rpc('expression-packs-select', { skin: pack.id })).result.value.selectedSkin,
    pack.id,
  )
  assert.equal(
    (await rpc('expression-packs-delete', { id: pack.id, expectedRevision: pack.revision })).result
      .value.selectedSkin,
    'whale',
  )
  const huge = 'x'.repeat(300 * 1024)
  assert.equal((await rpc('expression-packs-save', { draft: huge })).res.statusCode, 200)
  const oversized = await call(mounted.handler, {
    url: `${CHANNEL}/expression-packs-get`,
    headers: JSON_HEADERS,
    body: requestBody({ pad: huge }),
  })
  assert.equal(oversized.statusCode, 413)
  for (const cleanup of mounted.cleanups.reverse()) await cleanup()
  assert.equal(state.closes, 1)
  const rejected = mount({ requestRejection: () => 403 })
  const response = await call(rejected.handler, {
    url: `${CHANNEL}/expression-packs-import`,
    headers: JSON_HEADERS,
    body: requestBody({ base64: huge }),
  })
  assert.equal(response.statusCode, 403)
  for (const cleanup of rejected.cleanups.reverse()) await cleanup()
})
