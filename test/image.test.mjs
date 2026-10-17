import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { CHANNEL, MAX_IMAGE_BYTES, readImagePair, readImageSize, sniffImageMime } from '../lib/index.js'
import { mount, rpcCall } from './helpers.mjs'

const HAS_GIT = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
})()

const SKIP = HAS_GIT ? false : 'git 不可用'

/* ----------------------------------------------------------- 造图（只造头部） */

/** 造一张"头部正确、像素数据是填充"的 PNG：预览只读头部，不需要真解码。 */
function png(width, height, pad = 8) {
  const head = Buffer.alloc(24 + pad, 0x5a)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head, 0)
  head.writeUInt32BE(13, 8)
  head.write('IHDR', 12, 'latin1')
  head.writeUInt32BE(width, 16)
  head.writeUInt32BE(height, 20)
  return head
}

function gif(width, height) {
  const buffer = Buffer.alloc(20, 0x21)
  buffer.write('GIF89a', 0, 'latin1')
  buffer.writeUInt16LE(width, 6)
  buffer.writeUInt16LE(height, 8)
  return buffer
}

function jpeg(width, height) {
  const buffer = Buffer.alloc(40, 0x00)
  buffer.writeUInt16BE(0xffd8, 0) // SOI
  buffer.writeUInt16BE(0xffe0, 2) // APP0
  buffer.writeUInt16BE(16, 4) // 段长（含自身两字节）
  buffer.write('JFIF\0', 6, 'latin1')
  buffer.writeUInt16BE(0xffc0, 20) // SOF0
  buffer.writeUInt16BE(17, 22)
  buffer.writeUInt8(8, 24) // 精度
  buffer.writeUInt16BE(height, 25)
  buffer.writeUInt16BE(width, 27)
  return buffer
}

function webp(width, height) {
  const buffer = Buffer.alloc(34, 0x00)
  buffer.write('RIFF', 0, 'latin1')
  buffer.writeUInt32LE(26, 4)
  buffer.write('WEBP', 8, 'latin1')
  buffer.write('VP8X', 12, 'latin1')
  buffer.writeUInt32LE(10, 16)
  buffer.writeUIntLE(width - 1, 24, 3)
  buffer.writeUIntLE(height - 1, 27, 3)
  return buffer
}

function bmp(width, height) {
  const buffer = Buffer.alloc(30, 0x00)
  buffer.write('BM', 0, 'latin1')
  buffer.writeInt32LE(width, 18)
  buffer.writeInt32LE(height, 22)
  return buffer
}

/* ------------------------------------------------------------- 纯函数 */

test('认图：按内容而不是扩展名（含"头不够长"与乱码都不认）', () => {
  assert.equal(sniffImageMime(png(2, 3)), 'image/png')
  assert.equal(sniffImageMime(gif(2, 3)), 'image/gif')
  assert.equal(sniffImageMime(jpeg(2, 3)), 'image/jpeg')
  assert.equal(sniffImageMime(webp(2, 3)), 'image/webp')
  assert.equal(sniffImageMime(bmp(2, 3)), 'image/bmp')
  assert.equal(sniffImageMime(Buffer.from('not an image at all')), null)
  assert.equal(sniffImageMime(Buffer.from([0x89, 0x50])), null, '短于 12 字节不认（避免拿半个签名下结论）')
  assert.equal(sniffImageMime('text'), null, '非 Buffer 不认')
})

test('读尺寸：五种格式各自的字段位置', () => {
  assert.deepEqual(readImageSize(png(1024, 768), 'image/png'), { width: 1024, height: 768 })
  assert.deepEqual(readImageSize(gif(31, 47), 'image/gif'), { width: 31, height: 47 })
  assert.deepEqual(readImageSize(jpeg(640, 480), 'image/jpeg'), { width: 640, height: 480 })
  assert.deepEqual(readImageSize(webp(200, 100), 'image/webp'), { width: 200, height: 100 })
  assert.deepEqual(readImageSize(bmp(12, 34), 'image/bmp'), { width: 12, height: 34 })
})

test('读尺寸：截断/畸形输入一律 null，绝不抛', () => {
  assert.equal(readImageSize(Buffer.alloc(4), 'image/png'), null)
  assert.equal(readImageSize(Buffer.alloc(4), 'image/gif'), null)
  assert.equal(readImageSize(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'), null)
  assert.equal(readImageSize(Buffer.alloc(40), 'image/webp'), null, '全 0 不是任何 WebP 子块')
  assert.equal(readImageSize(Buffer.alloc(30), 'image/bmp'), null, '宽为 0 不算尺寸')
  assert.equal(readImageSize(png(4, 4), 'image/unknown'), null)
})

/* ------------------------------------------------------------- 真仓库 */

/** 在临时目录里建一个仓库，回传 `{ dir, git }`。 */
async function repo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-image-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
  git('init', '-q')
  git('config', 'user.email', 't@example.com')
  git('config', 'user.name', 't')
  git('config', 'commit.gpgsign', 'false')
  return { dir, git }
}

test('图片改动：两侧都拿到字节 + 像素尺寸，且二进制没被解码毁掉', { skip: SKIP }, async () => {
  const { dir, git } = await repo()
  try {
    // 故意带上 0xC3 0x28 这种非法 UTF-8 序列：按 utf8 读再编码回去就会变成 U+FFFD。
    const before = Buffer.concat([png(1024, 768), Buffer.from([0x00, 0xc3, 0x28, 0xff, 0x89])])
    await writeFile(path.join(dir, 'cat.png'), before)
    git('add', 'cat.png')
    git('commit', '-qm', 'add cat')
    const after = png(1024, 512, 16)
    await writeFile(path.join(dir, 'cat.png'), after)

    const pair = await readImagePair(dir, 'cat.png', null, 'worktree')
    assert.equal(pair.side, 'worktree')
    assert.equal(pair.before.kind, 'image')
    assert.equal(pair.before.mime, 'image/png')
    assert.deepEqual([pair.before.width, pair.before.height], [1024, 768])
    assert.equal(pair.before.bytes, before.length)
    assert.ok(Buffer.from(pair.before.base64, 'base64').equals(before), '索引里的字节必须原样回来')

    assert.equal(pair.after.kind, 'image')
    assert.deepEqual([pair.after.width, pair.after.height], [1024, 512])
    assert.ok(Buffer.from(pair.after.base64, 'base64').equals(after), '工作区里的字节必须原样回来')

    // 已暂存那侧：还没 add，索引仍是提交里的那一版。
    const staged = await readImagePair(dir, 'cat.png', null, 'index')
    assert.equal(staged.before.mime, 'image/png')
    assert.ok(Buffer.from(staged.before.base64, 'base64').equals(before))
    assert.ok(Buffer.from(staged.after.base64, 'base64').equals(before), '没暂存时索引 == HEAD')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('图片改动：提交明细按"第一父提交 → 该提交"取两侧', { skip: SKIP }, async () => {
  const { dir, git } = await repo()
  try {
    await writeFile(path.join(dir, 'cat.png'), png(10, 10))
    git('add', 'cat.png')
    git('commit', '-qm', 'first')
    await writeFile(path.join(dir, 'cat.png'), png(20, 20))
    git('add', 'cat.png')
    git('commit', '-qm', 'second')
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()

    const pair = await readImagePair(dir, 'cat.png', null, 'worktree', sha)
    assert.equal(pair.side, 'commit')
    assert.equal(pair.sha, sha)
    assert.deepEqual([pair.before.width, pair.before.height], [10, 10])
    assert.deepEqual([pair.after.width, pair.after.height], [20, 20])
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('图片改动：非图片、缺失、超上限各自回报，不抛也不塞内容', { skip: SKIP }, async () => {
  const { dir, git } = await repo()
  try {
    await writeFile(path.join(dir, 'notes.txt'), 'hello\n')
    await writeFile(path.join(dir, 'blob.bin'), Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]))
    git('add', 'notes.txt', 'blob.bin')
    git('commit', '-qm', 'add')

    const notImage = await readImagePair(dir, 'blob.bin', null, 'worktree')
    assert.equal(notImage.after.kind, 'not-image')
    assert.equal(notImage.after.bytes, 12)
    assert.equal(notImage.after.base64, undefined, '"不是图片"不该带内容回来')

    const missing = await readImagePair(dir, 'nope.png', null, 'worktree')
    assert.equal(missing.after.kind, 'missing')
    assert.equal(missing.before.kind, 'missing')

    // 超过单侧上限：只回报真实字节数（工作区一侧就够验证这条路径）。
    const big = Buffer.concat([png(4, 4), Buffer.alloc(MAX_IMAGE_BYTES, 0x5a)])
    await writeFile(path.join(dir, 'big.png'), big)
    const tooLarge = await readImagePair(dir, 'big.png', null, 'worktree')
    assert.equal(tooLarge.after.kind, 'too-large')
    assert.equal(tooLarge.after.bytes, big.length)
    assert.equal(tooLarge.after.base64, undefined, '超限不把内容塞进 JSON')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('端点：image 走 RPC 能取到两侧，非法入参被挡在门外', { skip: SKIP }, async () => {
  const { dir } = await repo()
  try {
    await writeFile(path.join(dir, 'cat.png'), png(64, 32))
    const { handler } = mount()

    const ok = await rpcCall(handler, CHANNEL, 'image', { args: { cwd: dir, path: 'cat.png' } })
    assert.equal(ok.ok, true)
    assert.equal(ok.value.after.kind, 'image')
    assert.deepEqual([ok.value.after.width, ok.value.after.height], [64, 32])
    assert.equal(ok.value.before.kind, 'missing', '未跟踪文件没有基线')

    const absolute = await rpcCall(handler, CHANNEL, 'image', { args: { cwd: dir, path: '/etc/passwd' } })
    assert.equal(absolute.ok, false)
    assert.equal(absolute.error.details.code, 'invalid-path')

    const escape = await rpcCall(handler, CHANNEL, 'image', { args: { cwd: dir, path: '../outside.png' } })
    assert.equal(escape.ok, false)
    assert.equal(escape.error.details.code, 'invalid-path')

    const badSha = await rpcCall(handler, CHANNEL, 'image', { args: { cwd: dir, path: 'cat.png', sha: 'not a sha' } })
    assert.equal(badSha.ok, false)
    assert.equal(badSha.error.details.code, 'invalid-sha')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})
