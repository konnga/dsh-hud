/** @env node — embed the canonical Cyber Whale Girl runtime WebPs. */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectRuntimeWebp, readAssets, renderAssets } from './generate-whale-assets.mjs'

export const assetDirectory = fileURLToPath(
  new URL('../src/client/assets/cyber-whale-girl/', import.meta.url),
)
export const generatedFile = fileURLToPath(
  new URL('../src/client/cyber-whale-assets.ts', import.meta.url),
)
export { inspectRuntimeWebp }

export function readCyberWhaleAssets(directory = assetDirectory) {
  return readAssets(directory, 'Cyber Whale Girl')
}

export function renderCyberWhaleAssets(assets) {
  return renderAssets(assets, 'src/client/assets/cyber-whale-girl/*.webp', 'CYBER_WHALE_ASSETS')
}

export function generateCyberWhaleAssets() {
  const assets = readCyberWhaleAssets()
  if (Object.keys(assets).length !== 30) {
    throw new Error(
      `Cyber Whale Girl: expected 30 action WebPs, found ${Object.keys(assets).length}`,
    )
  }
  const source = renderCyberWhaleAssets(assets)
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
    `Embedded ${generateCyberWhaleAssets()} Cyber Whale Girl lossless WebPs from src/client/assets/cyber-whale-girl`,
  )
}
