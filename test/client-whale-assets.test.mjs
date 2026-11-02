/** Production resources and builds must be independent of local design archives. */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  assetDirectory,
  generatedFile,
  inspectRuntimeWebp,
  readWhaleAssets,
  renderWhaleAssets,
} from '../scripts/generate-whale-assets.mjs'
import { mountClient } from './client-harness.mjs'

const sourceFile = new URL('../src/client/running-cues.ts', import.meta.url)
const bundleFile = new URL('../lib/client.js', import.meta.url)

test('30 lossless runtime WebPs in src exactly match all bilingual cue actions', () => {
  const assets = readWhaleAssets()
  const mounted = mountClient()
  try {
    const actions = new Set(
      Object.values(mounted.exported.RUNNING_CUES)
        .flat()
        .map((cue) => cue.action),
    )
    assert.equal(Object.keys(assets).length, 30)
    assert.deepEqual(new Set(Object.keys(assets)), actions)
    for (const [action, uri] of Object.entries(assets)) {
      const expected = readFileSync(join(assetDirectory, action + '.webp'))
      assert.deepEqual(Buffer.from(uri.split(',')[1], 'base64'), expected)
      assert.deepEqual(inspectRuntimeWebp(expected), { width: 112, height: 112, alpha: true })
      assert.match(uri, /^data:image\/webp;base64,/)
    }
  } finally {
    mounted.dispose()
  }
})

test('Generated module and published bundle embed the canonical WebP bytes', () => {
  const assets = readWhaleAssets()
  const generated = readFileSync(generatedFile, 'utf8')
  const bundle = readFileSync(bundleFile, 'utf8')
  assert.equal(generated, renderWhaleAssets(assets))
  for (const uri of Object.values(assets)) assert.ok(bundle.includes(uri))
  assert.ok(Object.values(assets).reduce((sum, uri) => sum + uri.length, 0) < 1_000_000)
})

test('Resource generation is deterministic and never imports docs images', () => {
  assert.equal(renderWhaleAssets(readWhaleAssets()), renderWhaleAssets(readWhaleAssets()))
  assert.doesNotMatch(
    readFileSync(new URL('../scripts/generate-whale-assets.mjs', import.meta.url), 'utf8'),
    /docs\/images/,
  )
  assert.ok(readFileSync(sourceFile, 'utf8').includes("'rice_eating'"))
})

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-whale-assets-'))
  try {
    run(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('Generator rejects missing assets, invalid filenames and truncated WebPs', () => {
  fixture((directory) => {
    assert.throws(() => readWhaleAssets(directory), /no runtime WebPs/)
    writeFileSync(join(directory, 'Invalid-action.webp'), Buffer.alloc(48))
    assert.throws(() => readWhaleAssets(directory), /Invalid whale action filename/)
  })
  fixture((directory) => {
    writeFileSync(join(directory, 'thinking.webp'), Buffer.from('not a WebP'))
    assert.throws(() => readWhaleAssets(directory), /lossless 112×112 WebP with alpha/)
  })
})

test('Generator rejects wrong dimensions or lossless WebP without alpha', () => {
  const bytes = readFileSync(join(assetDirectory, 'thinking.webp'))
  fixture((directory) => {
    const wrongSize = Buffer.from(bytes)
    wrongSize.writeUInt32LE((wrongSize.readUInt32LE(21) & 0xffffc000) | 511, 21)
    writeFileSync(join(directory, 'thinking.webp'), wrongSize)
    assert.throws(() => readWhaleAssets(directory), /112×112/)
    const opaque = Buffer.from(bytes)
    opaque.writeUInt32LE(opaque.readUInt32LE(21) & 0xefffffff, 21)
    writeFileSync(join(directory, 'thinking.webp'), opaque)
    assert.throws(() => readWhaleAssets(directory), /with alpha/)
  })
})

test('Every build, typecheck and test recreates the ignored module from src', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const command of ['build', 'test', 'typecheck']) {
    assert.ok(pkg.scripts[command].startsWith('node scripts/generate-whale-assets.mjs && '))
  }
  assert.ok(pkg.files.includes('docs/images/*.webp'))
  assert.ok(!pkg.files.includes('docs/images'), 'do not publish nested local discussions')
  assert.ok(pkg.files.includes('docs/running-text.md'))
  assert.ok(pkg.files.includes('docs/whale-assets.md'))
  const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8')
  assert.ok(ignore.includes('/docs/images/whale-girl/'))
  assert.ok(ignore.includes('/src/client/whale-assets.ts'))
})

test('Public README images exist separately from the local discussion archive', () => {
  for (const name of ['README.md', 'README.en.md']) {
    const text = readFileSync(new URL('../' + name, import.meta.url), 'utf8')
    assert.doesNotMatch(text, /docs\/images\/whale-girl\//)
    assert.ok(text.includes('docs/images/whale-girl-preview.webp'))
  }
  const showcase = readFileSync(new URL('../docs/images/whale-girl-preview.webp', import.meta.url))
  assert.equal(showcase.toString('ascii', 0, 4), 'RIFF')
  assert.equal(showcase.toString('ascii', 8, 12), 'WEBP')
  assert.ok(showcase.length < 1_000_000)
  assert.equal(readdirSync(assetDirectory).filter((file) => file.endsWith('.webp')).length, 30)
})

test('WebP validation rejects lossy/animated files, invalid versions and broken chunk bounds', () => {
  const bytes = readFileSync(join(assetDirectory, 'thinking.webp'))
  assert.equal(bytes.toString('ascii', 12, 16), 'VP8L')
  for (const mutation of [
    (copy) => copy.write('VP8 ', 12, 'ascii'),
    (copy) => copy.write('ANMF', 12, 'ascii'),
    (copy) => copy.writeUInt32LE(0xffffffff, 16),
    (copy) => copy.writeUInt32LE(copy.readUInt32LE(21) | 0x20000000, 21),
    (copy) => copy.writeUInt32LE(0, 4),
  ]) {
    const broken = Buffer.from(bytes)
    mutation(broken)
    assert.throws(() => inspectRuntimeWebp(broken), /lossless 112×112/)
  }
  assert.throws(() => inspectRuntimeWebp(bytes.subarray(0, bytes.length - 1)), /complete/)
  const duplicate = Buffer.concat([bytes, bytes.subarray(12)])
  duplicate.writeUInt32LE(duplicate.length - 8, 4)
  assert.throws(() => inspectRuntimeWebp(duplicate), /lossless/)
})

test('Extended lossless WebP canvas must match image dimensions and alpha; no animation', () => {
  const bytes = readFileSync(join(assetDirectory, 'thinking.webp'))
  const canvas = Buffer.alloc(18)
  canvas.write('VP8X', 0, 'ascii')
  canvas.writeUInt32LE(10, 4)
  canvas[8] = 0x10
  canvas.writeUIntLE(111, 12, 3)
  canvas.writeUIntLE(111, 15, 3)
  const extended = Buffer.concat([bytes.subarray(0, 12), canvas, bytes.subarray(12)])
  extended.writeUInt32LE(extended.length - 8, 4)
  assert.deepEqual(inspectRuntimeWebp(extended), { width: 112, height: 112, alpha: true })
  for (const mutation of [
    (copy) => {
      copy[20] = 0x12
    },
    (copy) => {
      copy[20] = 0
    },
    (copy) => copy.writeUIntLE(511, 24, 3),
  ]) {
    const broken = Buffer.from(extended)
    mutation(broken)
    assert.throws(() => inspectRuntimeWebp(broken), /lossless/)
  }
})
