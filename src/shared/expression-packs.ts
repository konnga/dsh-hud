/** Versioned static expression-pack wire format shared by Host and Client. */
export const EXPRESSION_ACTIONS = [
  'thinking',
  'context',
  'connect',
  'ponder',
  'writing',
  'checking',
  'typing',
  'watching',
  'reading',
  'inspecting',
  'searching',
  'working',
  'question',
  'butterfly',
  'gears',
  'puzzle',
  'thread',
  'sketching',
  'flashlight',
  'binoculars',
  'map',
  'measuring',
  'toolbox',
  'notes',
  'rice_eating',
  'rice_cheeks',
  'rice_terminal',
  'rice_ponder',
  'rice_reading',
  'rice_notes',
] as const
export type ExpressionAction = (typeof EXPRESSION_ACTIONS)[number]
export interface ExpressionManifest {
  schemaVersion: 1
  name: string
  author?: string
  version: string
  fallback: 'thinking'
  actions: Partial<Record<ExpressionAction, string>> & { thinking: string }
}
/** File values are validated static PNG/WebP data URLs; paths are relative ZIP entries. */
export interface ExpressionDraft {
  manifest: ExpressionManifest
  files: Record<string, string>
}
export interface ExpressionPackSummary {
  id: string
  name: string
  author: string
  version: string
  revision: string
  actionCount: number
  bytes: number
  updatedAt: string
}
export interface ExpressionPack extends ExpressionDraft, ExpressionPackSummary {}
export interface ExpressionCatalog {
  available: boolean
  reason?: string
  packs: ExpressionPackSummary[]
  selectedSkin: string | null
}
export const EXPRESSION_LIMITS = {
  maxPacks: 20,
  maxFiles: 30,
  maxFileBytes: 2 * 1024 * 1024,
  maxPackBytes: 12 * 1024 * 1024,
  maxZipBytes: 16 * 1024 * 1024,
  maxDimension: 1024,
} as const
/** Existing built-in skin ids stay stable; custom IDs are never derived from file paths. */
export function isCustomSkin(value: string): boolean {
  return /^custom:[a-z0-9-]{1,80}$/.test(value)
}
export function isCharacterSkin(value: string): boolean {
  return (
    value === 'whale' ||
    value === 'cyber-whale' ||
    value === 'longdress-whale' ||
    isCustomSkin(value)
  )
}
