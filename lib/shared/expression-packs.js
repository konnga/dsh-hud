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
];
export const EXPRESSION_LIMITS = {
    maxPacks: 20,
    maxFiles: 30,
    maxFileBytes: 2 * 1024 * 1024,
    maxPackBytes: 12 * 1024 * 1024,
    maxZipBytes: 16 * 1024 * 1024,
    maxDimension: 1024,
};
/** Existing built-in skin ids stay stable; custom IDs are never derived from file paths. */
export function isCustomSkin(value) {
    return /^custom:[a-z0-9-]{1,80}$/.test(value);
}
export function isCharacterSkin(value) {
    return (value === 'whale' ||
        value === 'cyber-whale' ||
        value === 'longdress-whale' ||
        isCustomSkin(value));
}
