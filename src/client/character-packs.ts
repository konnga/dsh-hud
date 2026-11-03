/** One asset resolver for bundled and user-imported characters. Never fetches during a tick. */
import { WHALE_ASSETS } from './whale-assets.js'
import { CYBER_WHALE_ASSETS } from './cyber-whale-assets.js'
import { LONGDRESS_WHALE_ASSETS } from './longdress-whale-assets.js'
import { getExpressionPackStore } from './expression-packs.js'
import type { ExpressionAction } from '../shared/expression-packs.js'

export interface CharacterFrame {
  key: string
  src: string
}
var BUILTIN_PACKS: Record<string, Partial<Record<ExpressionAction, string>>> = {
  whale: WHALE_ASSETS,
  'cyber-whale': CYBER_WHALE_ASSETS,
  'longdress-whale': LONGDRESS_WHALE_ASSETS,
}

function builtinFrame(
  pack: Partial<Record<ExpressionAction, string>>,
  skin: string,
  action: ExpressionAction,
): CharacterFrame | null {
  var src = pack[action] || pack.thinking
  return src ? { key: skin + ':' + (pack[action] ? action : 'thinking'), src } : null
}

export function characterFrame(skin: string, action: ExpressionAction): CharacterFrame | null {
  if (Object.prototype.hasOwnProperty.call(BUILTIN_PACKS, skin)) {
    return builtinFrame(BUILTIN_PACKS[skin], skin, action)
  }
  var pack = getExpressionPackStore()?.getCached(skin)
  if (!pack) return null
  var path = pack.manifest.actions[action] || pack.manifest.actions.thinking
  var src = pack.files[path]
  if (!src) return null
  // A same-name file replacement must cancel the old pending decode, too.
  return { key: pack.id + ':' + pack.revision + ':' + path, src }
}
