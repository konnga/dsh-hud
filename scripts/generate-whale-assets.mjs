/** @env node — embed the canonical lossless runtime WebPs; never read local design discussions. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const assetDirectory = fileURLToPath(
  new URL('../src/client/assets/whale-girl/', import.meta.url),
)
export const generatedFile = fileURLToPath(
  new URL('../src/client/whale-assets.ts', import.meta.url),
)
/** Inspect the RIFF and lossless image headers without a build-time image library. */
export function inspectRuntimeWebp(bytes) {
  const invalid = () => {
    throw new Error('Expected a complete, static, lossless 112×112 WebP with alpha')
  }
  if (
    bytes.length < 26 ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP' ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  )
    invalid()
  let image = null
  let canvas = null
  for (let cursor = 12; cursor < bytes.length;) {
    if (cursor + 8 > bytes.length) invalid()
    const kind = bytes.toString('ascii', cursor, cursor + 4)
    const size = bytes.readUInt32LE(cursor + 4)
    const start = cursor + 8
    const end = start + size
    const next = end + (size & 1)
    if (next > bytes.length) invalid()
    if (kind === 'VP8 ' || kind === 'ANIM' || kind === 'ANMF' || kind === 'ALPH') invalid()
    if (kind === 'VP8L') {
      if (image || size < 5 || bytes[start] !== 0x2f) invalid()
      const bits = bytes.readUInt32LE(start + 1)
      image = {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
        alpha: Boolean(bits & 0x10000000),
      }
      if (bits >>> 29 !== 0) invalid()
    }
    if (kind === 'VP8X') {
      if (canvas || size !== 10 || bytes[start] & 0x02) invalid()
      canvas = {
        width: bytes.readUIntLE(start + 4, 3) + 1,
        height: bytes.readUIntLE(start + 7, 3) + 1,
        alpha: Boolean(bytes[start] & 0x10),
      }
    }
    cursor = next
  }
  if (!image || image.width !== 112 || image.height !== 112 || !image.alpha) invalid()
  if (canvas && (canvas.width !== image.width || canvas.height !== image.height || !canvas.alpha))
    invalid()
  return image
}

export function readWhaleAssets(directory = assetDirectory) {
  const assets = {}
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.webp'))
    .sort()
  if (files.length === 0) throw new Error('Whale girl: no runtime WebPs found')
  for (const file of files) {
    if (!/^[a-z][a-z_]*\.webp$/.test(file))
      throw new Error(`Invalid whale action filename: ${file}`)
    const bytes = readFileSync(resolve(directory, file))
    try {
      inspectRuntimeWebp(bytes)
    } catch (error) {
      throw new Error(`Whale girl: ${file}: ${error.message}`)
    }
    assets[file.slice(0, -5)] = 'data:image/webp;base64,' + bytes.toString('base64')
  }
  return assets
}

export function renderWhaleAssets(assets) {
  return (
    '/** Generated from src/client/assets/whale-girl/*.webp; do not edit. */\n' +
    "import type { WhaleAction } from './running-cues.js'\n\n" +
    '// prettier-ignore\nexport var WHALE_ASSETS: Record<WhaleAction, string> = ' +
    JSON.stringify(assets, null, 2) +
    '\n'
  )
}

export function generateWhaleAssets() {
  const assets = readWhaleAssets()
  const source = renderWhaleAssets(assets)
  let existing = null
  try {
    existing = readFileSync(generatedFile, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (existing !== source) writeFileSync(generatedFile, source)
  return Object.keys(assets).length
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(
    `Embedded ${generateWhaleAssets()} whale-girl lossless WebPs from src/client/assets/whale-girl`,
  )
}
