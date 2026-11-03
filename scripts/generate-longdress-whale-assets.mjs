/** @env node — embed the canonical Longdress Whale Girl runtime WebPs. */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectRuntimeWebp, readAssets, renderAssets } from './generate-whale-assets.mjs'

export const assetDirectory = fileURLToPath(
  new URL('../src/client/assets/longdress-whale-girl/', import.meta.url),
)
export const generatedFile = fileURLToPath(
  new URL('../src/client/longdress-whale-assets.ts', import.meta.url),
)
export { inspectRuntimeWebp }

export function readLongdressWhaleAssets(directory = assetDirectory) {
  return readAssets(directory, 'Longdress Whale Girl')
}

export function renderLongdressWhaleAssets(assets) {
  return renderAssets(
    assets,
    'src/client/assets/longdress-whale-girl/*.webp',
    'LONGDRESS_WHALE_ASSETS',
    'Partial<Record<WhaleAction, string>>',
  )
}

export function generateLongdressWhaleAssets() {
  const assets = readLongdressWhaleAssets()
  const source = renderLongdressWhaleAssets(assets)
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
    `Embedded ${generateLongdressWhaleAssets()} Longdress Whale Girl lossless WebPs from src/client/assets/longdress-whale-girl`,
  )
}
