import { randomUUID } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { Unzip, UnzipInflate, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';
import { EXPRESSION_ACTIONS, EXPRESSION_LIMITS as LIMITS, isCustomSkin, } from '../shared/expression-packs.js';
const MANIFEST_BYTES = 64 * 1024;
const BUILTINS = new Set(['off', 'whale', 'cyber-whale', 'longdress-whale']);
const ACTIONS = new Set(EXPRESSION_ACTIONS);
// Storage unit names must match DSH's /^[a-z][a-z0-9_]*$/.
const DOMAIN_NAME = 'dsh_hud_expression_packs';
/** JSON per-record keys cannot contain ':'. The public pack ID remains unchanged. */
function storageKey(id) {
    if (!isCustomSkin(id))
        fail('Invalid expression-pack storage ID');
    return id.slice('custom:'.length);
}
function fail(message, code = 'expression-invalid') {
    throw Object.assign(new Error(message), { code });
}
function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        fail('Expected a plain data object');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        fail('Expected a plain data object');
    return value;
}
function text(value, label, max, optional = false) {
    if (optional && (value === undefined || (typeof value === 'string' && !value.trim())))
        return '';
    if (typeof value !== 'string' ||
        !value.trim() ||
        value.length > max ||
        /[\u0000-\u001f\u007f]/.test(value))
        fail(`Invalid ${label}`);
    return value.trim();
}
function exactKeys(value, allowed) {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
        fail('Unrecognized data fields');
}
function imagePath(value, directory = false) {
    if (typeof value !== 'string' || value.length > 180 || /[\\:%?#\u0000-\u0020\u007f]/.test(value))
        fail('Invalid image path');
    const trimmed = directory && value.endsWith('/') ? value.slice(0, -1) : value;
    const parts = trimmed.split('/');
    if (parts.length > 5 ||
        parts.some((part) => !part ||
            part === '.' ||
            part === '..' ||
            part === '__proto__' ||
            part === 'constructor' ||
            part === 'prototype'))
        fail('Invalid relative image path');
    if (parts[0] !== 'images' ||
        (!directory && (parts.length < 2 || !/\.(png|webp)$/i.test(trimmed))))
        fail('Images must use relative images/ PNG or WebP paths');
    return value;
}
function base64Bytes(value, max) {
    if (typeof value !== 'string' ||
        !value ||
        value.length > Math.ceil(max / 3) * 4 ||
        value.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
        fail('Invalid or oversized base64 data');
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length > max || bytes.toString('base64') !== value)
        fail('Invalid or oversized base64 data');
    return bytes;
}
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++)
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});
function crc32(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes)
        value = CRC_TABLE[(value ^ byte) & 255] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
}
function dimensions(width, height) {
    if (!width || !height || width > LIMITS.maxDimension || height > LIMITS.maxDimension)
        fail('Image dimensions must be 1–1024 pixels');
}
/** Validates complete PNG chunks, CRCs, static format and bounded decompressed scanlines. */
function png(bytes) {
    if (bytes.length < 57 ||
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        fail('Invalid PNG signature');
    let width = 0, height = 0, depth = 0, channels = 0, interlace = 0;
    let cursor = 8, idatStarted = false, idatEnded = false, ended = false, palette = false;
    const compressed = [];
    while (cursor < bytes.length) {
        if (cursor + 12 > bytes.length)
            fail('Truncated PNG chunk');
        const size = bytes.readUInt32BE(cursor), end = cursor + 12 + size;
        if (end > bytes.length)
            fail('Truncated PNG chunk');
        const type = bytes.toString('ascii', cursor + 4, cursor + 8);
        if (!/^[A-Za-z]{4}$/.test(type) ||
            crc32(bytes.subarray(cursor + 4, end - 4)) !== bytes.readUInt32BE(end - 4))
            fail('Invalid PNG chunk checksum');
        const data = bytes.subarray(cursor + 8, end - 4);
        if (['acTL', 'fcTL', 'fdAT'].includes(type))
            fail('Animated PNG is not supported');
        if (cursor === 8 && type !== 'IHDR')
            fail('PNG must begin with IHDR');
        if (type === 'IHDR') {
            if (cursor !== 8 || size !== 13)
                fail('Invalid PNG header');
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            dimensions(width, height);
            depth = data[8];
            const color = data[9];
            channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color] || 0;
            const depths = color === 0 ? [1, 2, 4, 8, 16] : color === 3 ? [1, 2, 4, 8] : [8, 16];
            if (!channels || !depths.includes(depth) || data[10] !== 0 || data[11] !== 0 || data[12] > 1)
                fail('Unsupported PNG header');
            interlace = data[12];
        }
        else if (type === 'PLTE') {
            if (idatStarted || palette || !size || size > 768 || size % 3)
                fail('Invalid PNG palette');
            palette = true;
        }
        else if (type === 'IDAT') {
            if (idatEnded || (bytes[25] === 3 && !palette))
                fail('Invalid PNG image data order');
            idatStarted = true;
            compressed.push(data);
        }
        else if (type === 'IEND') {
            if (size !== 0 || !idatStarted || end !== bytes.length)
                fail('Invalid PNG ending');
            ended = true;
        }
        else if (type[0] === type[0].toUpperCase())
            fail('Unsupported critical PNG chunk');
        if (idatStarted && type !== 'IDAT')
            idatEnded = true;
        cursor = end;
    }
    if (!ended)
        fail('PNG is missing IEND');
    const passes = interlace
        ? [
            [0, 0, 8, 8],
            [4, 0, 8, 8],
            [0, 4, 4, 8],
            [2, 0, 4, 4],
            [0, 2, 2, 4],
            [1, 0, 2, 2],
            [0, 1, 1, 2],
        ]
        : [[0, 0, 1, 1]];
    const rows = [];
    for (const [x, y, sx, sy] of passes) {
        const w = Math.max(0, Math.ceil((width - x) / sx)), h = Math.max(0, Math.ceil((height - y) / sy));
        if (w)
            for (let row = 0; row < h; row++)
                rows.push(Math.ceil((w * channels * depth) / 8));
    }
    const expected = rows.reduce((sum, row) => sum + row + 1, 0);
    let pixels;
    try {
        pixels = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
    }
    catch {
        fail('Invalid PNG compressed image data');
    }
    if (pixels.length !== expected)
        fail('PNG pixel data has an invalid length');
    let offset = 0;
    for (const row of rows) {
        if (pixels[offset] > 4)
            fail('Invalid PNG scanline filter');
        offset += row + 1;
    }
}
/** Validates the complete static WebP RIFF container and its image dimensions. */
function webp(bytes) {
    if (bytes.length < 26 ||
        bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP' ||
        bytes.readUInt32LE(4) + 8 !== bytes.length)
        fail('Invalid WebP container');
    let cursor = 12, image = null, canvas = null, alpha = false;
    while (cursor < bytes.length) {
        if (cursor + 8 > bytes.length)
            fail('Truncated WebP chunk');
        const kind = bytes.toString('ascii', cursor, cursor + 4), size = bytes.readUInt32LE(cursor + 4);
        const start = cursor + 8, end = start + size, next = end + (size & 1);
        if (next > bytes.length || (size & 1 && bytes[end] !== 0))
            fail('Invalid WebP chunk boundary');
        if (kind === 'ANIM' || kind === 'ANMF')
            fail('Animated WebP is not supported');
        if (kind === 'VP8X') {
            if (cursor !== 12 ||
                size !== 10 ||
                canvas ||
                bytes[start] & 0xc3 ||
                bytes[start + 1] ||
                bytes[start + 2] ||
                bytes[start + 3])
                fail('Invalid or animated WebP extended header');
            canvas = [bytes.readUIntLE(start + 4, 3) + 1, bytes.readUIntLE(start + 7, 3) + 1];
            dimensions(...canvas);
        }
        else if (kind === 'ALPH') {
            if (!canvas || image || alpha || !size)
                fail('Invalid WebP alpha chunk');
            alpha = true;
        }
        else if (kind === 'VP8L') {
            if (image || alpha || size < 6 || bytes[start] !== 0x2f)
                fail('Invalid lossless WebP image');
            const bits = bytes.readUInt32LE(start + 1);
            if (bits >>> 29)
                fail('Invalid WebP version');
            image = [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
        }
        else if (kind === 'VP8 ') {
            if (image ||
                size < 11 ||
                bytes[start] & 1 ||
                bytes.toString('hex', start + 3, start + 6) !== '9d012a' ||
                bytes.readUIntLE(start, 3) >>> 5 > size - 3)
                fail('Invalid lossy WebP image');
            image = [bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff];
        }
        else if (!['ICCP', 'EXIF', 'XMP '].includes(kind))
            fail('Unsupported WebP chunk');
        cursor = next;
    }
    if (!image)
        fail('WebP contains no image');
    dimensions(...image);
    if (canvas && (canvas[0] !== image[0] || canvas[1] !== image[1]))
        fail('WebP canvas and image size differ');
}
export function validateExpressionImage(value, path) {
    if (typeof value !== 'string')
        fail('Expected an image data URL');
    const match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match || !path.toLowerCase().endsWith('.' + match[1]))
        fail('Only matching PNG/WebP data URLs are accepted');
    const bytes = base64Bytes(match[2], LIMITS.maxFileBytes);
    if (match[1] === 'png')
        png(bytes);
    else
        webp(bytes);
    return { dataUrl: value, bytes: bytes.length };
}
export function validateExpressionDraft(value) {
    const input = record(value);
    exactKeys(input, ['manifest', 'files']);
    const raw = record(input.manifest);
    exactKeys(raw, ['schemaVersion', 'name', 'author', 'version', 'fallback', 'actions']);
    if (raw.schemaVersion !== 1 || raw.fallback !== 'thinking')
        fail('Unsupported expression-pack format');
    const name = text(raw.name, 'name', 80), author = text(raw.author, 'author', 120, true), version = text(raw.version, 'version', 40);
    const rawActions = record(raw.actions), actions = Object.create(null);
    if (!Object.prototype.hasOwnProperty.call(rawActions, 'thinking'))
        fail('The thinking action is required');
    for (const [action, path] of Object.entries(rawActions)) {
        if (!ACTIONS.has(action))
            fail('Unknown expression action');
        actions[action] = imagePath(path);
    }
    const rawFiles = record(input.files), names = Object.keys(rawFiles);
    if (!names.length || names.length > LIMITS.maxFiles)
        fail('An expression pack needs 1–30 image files');
    const files = Object.create(null);
    let total = 0;
    for (const path of names) {
        imagePath(path);
        const checked = validateExpressionImage(rawFiles[path], path);
        total += checked.bytes;
        if (total > LIMITS.maxPackBytes)
            fail('Expression pack exceeds 12 MiB');
        files[path] = checked.dataUrl;
    }
    if (Object.values(actions).some((path) => !Object.prototype.hasOwnProperty.call(files, path)))
        fail('An action references a missing image');
    const manifest = {
        schemaVersion: 1,
        name,
        ...(author ? { author } : {}),
        version,
        fallback: 'thinking',
        actions: actions,
    };
    return { draft: { manifest, files }, bytes: total };
}
/** Metadata-only library pass precedes bounded streaming extraction. No archive paths touch the filesystem. */
export function importExpressionZip(value) {
    const archive = base64Bytes(value, LIMITS.maxZipBytes);
    const metadata = new Map();
    let total = 0, count = 0, entries = 0;
    try {
        unzipSync(archive, {
            filter(file) {
                if (++entries > 64 || metadata.has(file.name))
                    fail('Too many or duplicate ZIP entries');
                const directory = file.name.endsWith('/');
                if (file.name !== 'manifest.json')
                    imagePath(file.name, directory);
                const limit = directory
                    ? 0
                    : file.name === 'manifest.json'
                        ? MANIFEST_BYTES
                        : LIMITS.maxFileBytes;
                if (![0, 8].includes(file.compression) ||
                    !Number.isSafeInteger(file.originalSize) ||
                    file.originalSize < 0 ||
                    file.originalSize > limit)
                    fail('Invalid ZIP entry size or compression');
                if (!directory && file.name !== 'manifest.json' && ++count > LIMITS.maxFiles)
                    fail('Too many ZIP images');
                total += file.originalSize;
                if (total > LIMITS.maxPackBytes + MANIFEST_BYTES)
                    fail('ZIP expanded size exceeds limit');
                metadata.set(file.name, {
                    size: file.size,
                    originalSize: file.originalSize,
                    compression: file.compression,
                });
                return false;
            },
        });
        if (!metadata.has('manifest.json'))
            fail('ZIP is missing manifest.json');
        const output = Object.create(null), seen = new Set();
        let actualTotal = 0;
        const stream = new Unzip((file) => {
            const expected = metadata.get(file.name);
            if (!expected ||
                seen.has(file.name) ||
                expected.compression !== file.compression ||
                (file.originalSize !== undefined && file.originalSize !== expected.originalSize))
                fail('ZIP directory and file entries differ');
            seen.add(file.name);
            let size = 0;
            const chunks = [];
            file.ondata = (error, data, final) => {
                if (error)
                    fail('ZIP decompression failed');
                size += data.length;
                actualTotal += data.length;
                if (size > expected.originalSize || actualTotal > LIMITS.maxPackBytes + MANIFEST_BYTES) {
                    file.terminate();
                    fail('ZIP output exceeds declared limits');
                }
                chunks.push(Buffer.from(data));
                if (final) {
                    if (size !== expected.originalSize)
                        fail('ZIP output does not match declared size');
                    output[file.name] = Buffer.concat(chunks);
                }
            };
            file.start();
        });
        stream.register(UnzipInflate);
        for (let offset = 0; offset < archive.length; offset += 128)
            stream.push(archive.subarray(offset, offset + 128), offset + 128 >= archive.length);
        if (seen.size !== metadata.size || Object.keys(output).length !== metadata.size)
            fail('Incomplete ZIP archive');
        const manifestBytes = output['manifest.json'];
        const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
        const files = Object.create(null);
        for (const [path, bytes] of Object.entries(output))
            if (path !== 'manifest.json' && !path.endsWith('/'))
                files[path] =
                    `data:image/${path.toLowerCase().endsWith('.png') ? 'png' : 'webp'};base64,${bytes.toString('base64')}`;
        return validateExpressionDraft({ manifest, files }).draft;
    }
    catch (error) {
        if (error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'expression-invalid')
            throw error;
        fail('Invalid expression-pack ZIP');
    }
}
export function exportExpressionZip(pack) {
    const { draft } = validateExpressionDraft(pack);
    const files = Object.create(null);
    files['manifest.json'] = Buffer.from(JSON.stringify(draft.manifest, null, 2));
    for (const [path, url] of Object.entries(draft.files))
        files[path] = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    const bytes = zipSync(files, { level: 0 });
    if (bytes.length > LIMITS.maxZipBytes)
        fail('Export exceeds ZIP size limit');
    return {
        base64: Buffer.from(bytes).toString('base64'),
        name: draft.manifest.name.replace(/[\\/:*?"<>|]/g, '_') + '.zip',
    };
}
function storedPack(value) {
    try {
        const pack = record(value);
        if (typeof pack.id !== 'string' ||
            !isCustomSkin(pack.id) ||
            typeof pack.revision !== 'string' ||
            typeof pack.updatedAt !== 'string')
            return false;
        const checked = validateExpressionDraft({ manifest: pack.manifest, files: pack.files });
        return (pack.bytes === checked.bytes &&
            pack.name === checked.draft.manifest.name &&
            pack.actionCount === Object.keys(checked.draft.manifest.actions).length &&
            pack.author === (checked.draft.manifest.author || '') &&
            pack.version === checked.draft.manifest.version);
    }
    catch {
        return false;
    }
}
const DOMAIN_SPEC = {
    name: DOMAIN_NAME,
    version: 1,
    layout: 'per-record',
    tables: { packs: { valueSchema: z.custom(storedPack) } },
    global: {
        schema: z.object({
            selectedSkin: z.string().nullable(),
            pendingDelete: z.object({ id: z.string(), revision: z.string() }).nullable(),
        }),
        initial: { selectedSkin: null, pendingDelete: null },
    },
};
const copy = (value) => structuredClone(value);
function summary(pack) {
    const { id, name, author, version, revision, actionCount, bytes, updatedAt } = pack;
    return { id, name, author, version, revision, actionCount, bytes, updatedAt };
}
/** One Host-owned service shared by RPC UI callers and future agent tools. */
export function createExpressionPackService(ctx) {
    let disposed = false, domain = null, opening = null, queue = Promise.resolve(), closing = null;
    const assertLive = () => {
        if (disposed)
            fail('Expression-pack service is disposed', 'expression-disposed');
    };
    async function open() {
        assertLive();
        if (domain)
            return domain;
        if (!opening) {
            const attempt = (async () => {
                const facility = ctx.get('storageDomain');
                if (!facility || typeof facility.open !== 'function')
                    fail('Host expression-pack storage is unavailable', 'expression-unavailable');
                let opened;
                try {
                    opened = await facility.open(DOMAIN_SPEC);
                }
                catch {
                    fail('Host expression-pack storage could not be opened', 'expression-unavailable');
                }
                domain = opened;
                if (disposed)
                    fail('Expression-pack service is disposed', 'expression-disposed');
                return opened;
            })();
            opening = attempt;
            void attempt.catch(() => {
                if (!domain && opening === attempt)
                    opening = null;
            });
        }
        return opening;
    }
    async function recover(opened) {
        const table = opened.table('packs'), global = opened.global.get();
        if ([...table.entries()].some(([key, pack]) => key !== storageKey(pack.id)))
            fail('Expression-pack storage contains an invalid key', 'expression-unavailable');
        if (global.pendingDelete) {
            const found = table.get(storageKey(global.pendingDelete.id));
            if (found && found.revision !== global.pendingDelete.revision)
                fail('Expression-pack deletion recovery conflict', 'expression-conflict');
            try {
                if (found)
                    await table.delete(storageKey(found.id));
                await opened.global.set({
                    selectedSkin: global.selectedSkin === global.pendingDelete.id ? 'whale' : global.selectedSkin,
                    pendingDelete: null,
                });
            }
            catch {
                fail('Could not recover expression-pack deletion', 'expression-storage-failed');
            }
        }
        else if (global.selectedSkin &&
            !BUILTINS.has(global.selectedSkin) &&
            (!isCustomSkin(global.selectedSkin) || !table.get(storageKey(global.selectedSkin)))) {
            try {
                await opened.global.set({ selectedSkin: 'whale', pendingDelete: null });
            }
            catch {
                fail('Could not recover expression-pack selection', 'expression-storage-failed');
            }
        }
    }
    function serialized(operation) {
        const result = queue.then(async () => {
            assertLive();
            const opened = await open();
            assertLive();
            await recover(opened);
            assertLive();
            return operation(opened);
        });
        queue = result.catch(() => { });
        return result;
    }
    function idOf(id) {
        if (typeof id !== 'string' || !isCustomSkin(id))
            fail('Only custom expression-pack IDs are accepted');
        return id;
    }
    function required(opened, id, revision) {
        const pack = opened.table('packs').get(storageKey(idOf(id)));
        if (!pack)
            fail('Expression pack was not found', 'expression-not-found');
        if (revision !== undefined && revision !== pack.revision)
            fail('Expression pack changed; reload before saving', 'expression-conflict');
        return pack;
    }
    const persist = async (write) => {
        try {
            return await write();
        }
        catch {
            fail('Could not save expression-pack changes', 'expression-storage-failed');
        }
    };
    return {
        async list() {
            try {
                return await serialized(async (opened) => ({
                    available: true,
                    packs: [...opened.table('packs').entries()].map(([, pack]) => summary(pack)),
                    selectedSkin: opened.global.get().selectedSkin,
                }));
            }
            catch {
                return {
                    available: false,
                    reason: disposed
                        ? 'disposed'
                        : ctx.get('storageDomain')
                            ? 'storage-open-failed'
                            : 'storage-unavailable',
                    packs: [],
                    selectedSkin: null,
                };
            }
        },
        get(id) {
            return serialized(async (opened) => copy(required(opened, id)));
        },
        save(value, id, expectedRevision) {
            return serialized(async (opened) => {
                const checked = validateExpressionDraft(value), table = opened.table('packs');
                if (id !== undefined) {
                    if (typeof expectedRevision !== 'string' || !expectedRevision)
                        fail('An expected revision is required', 'expression-conflict');
                    required(opened, id, expectedRevision);
                }
                else if ([...table.entries()].length >= LIMITS.maxPacks)
                    fail('At most 20 custom expression packs can be saved');
                const pack = {
                    ...checked.draft,
                    id: id === undefined ? 'custom:' + randomUUID() : idOf(id),
                    name: checked.draft.manifest.name,
                    author: checked.draft.manifest.author || '',
                    version: checked.draft.manifest.version,
                    revision: randomUUID(),
                    actionCount: Object.keys(checked.draft.manifest.actions).length,
                    bytes: checked.bytes,
                    updatedAt: new Date().toISOString(),
                };
                await persist(() => table.put(storageKey(pack.id), pack));
                return copy(pack);
            });
        },
        delete(id, expectedRevision) {
            return serialized(async (opened) => {
                if (typeof expectedRevision !== 'string' || !expectedRevision)
                    fail('An expected revision is required', 'expression-conflict');
                const pack = required(opened, id, expectedRevision), global = opened.global.get();
                // Durable intent allows completion after interruption between record/global writes.
                await persist(() => opened.global.set({ ...global, pendingDelete: { id: pack.id, revision: pack.revision } }));
                await persist(() => opened.table('packs').delete(storageKey(pack.id)));
                const selectedSkin = global.selectedSkin === pack.id ? 'whale' : global.selectedSkin;
                await persist(() => opened.global.set({ selectedSkin, pendingDelete: null }));
                return { deleted: true, selectedSkin };
            });
        },
        select(skin) {
            return serialized(async (opened) => {
                if (typeof skin !== 'string' ||
                    (!BUILTINS.has(skin) &&
                        (!isCustomSkin(skin) || !opened.table('packs').get(storageKey(skin)))))
                    fail('Unknown thinking-animation selection');
                await persist(() => opened.global.set({ selectedSkin: skin, pendingDelete: null }));
                return { selectedSkin: skin };
            });
        },
        async import(value) {
            assertLive();
            return importExpressionZip(value);
        },
        export(id) {
            return serialized(async (opened) => {
                const pack = required(opened, id);
                return exportExpressionZip({ manifest: pack.manifest, files: pack.files });
            });
        },
        dispose() {
            if (!closing) {
                disposed = true;
                closing = (async () => {
                    await queue;
                    if (opening)
                        await opening.catch(() => { });
                    if (domain)
                        await domain.close();
                })();
            }
            return closing;
        },
    };
}
