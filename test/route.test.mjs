import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { CHANNEL } from '../lib/index.js'
import { JSON_HEADERS, call, mount, requestBody as envelopeBody } from './helpers.mjs'

test('注册一条前缀路由与会话归因监听，并都挂在自身的 ctx.effect 上', () => {
  const { routes, labels, listeners } = mount()
  assert.equal(routes.length, 1)
  assert.equal(routes[0].kind, 'prefix')
  assert.equal(routes[0].path, CHANNEL)
  assert.equal(typeof routes[0].handler, 'function')
  // 两个 effect：会话归因的事件监听 + 路由本身（标签顺序就是注册顺序）。
  assert.deepEqual(labels, ['dsh-hud: session change tracking', `dsh-hud: POST ${CHANNEL}/*`])
  assert.deepEqual([...listeners.keys()].sort(), ['fs/edit-intent', 'fs/observed', 'fs/write-intent', 'tools/post-execute'])
})

test('非 POST 一律 405', async () => {
  const { handler } = mount()
  const res = await call(handler, { method: 'GET' })
  assert.equal(res.statusCode, 405)
})

test('围栏拒绝时原样回传状态码', async () => {
  const { handler } = mount({ requestRejection: () => 401 })
  const res = await call(handler, { headers: JSON_HEADERS, body: envelopeBody({ cwd: tmpdir() }) })
  assert.equal(res.statusCode, 401)
})

test('围栏先于方法与信封判定', async () => {
  const { handler } = mount({ requestRejection: () => 403 })
  const res = await call(handler, { method: 'GET' })
  assert.equal(res.statusCode, 403)
})

test('非 JSON content-type 返回 415', async () => {
  const { handler } = mount()
  const res = await call(handler, { headers: { 'content-type': 'text/plain' }, body: '{}' })
  assert.equal(res.statusCode, 415)
})

test('通道外路径返回 404', async () => {
  const { handler } = mount()
  const res = await call(handler, { url: '/somewhere-else', headers: JSON_HEADERS, body: '{}' })
  assert.equal(res.statusCode, 404)
})

test('通道根路径与嵌套路径都返回 404', async () => {
  const { handler } = mount()

  const bare = await call(handler, { url: CHANNEL, headers: JSON_HEADERS, body: '{}' })
  assert.equal(bare.statusCode, 404, '通道根路径下没有端点')

  const nested = await call(handler, {
    url: `${CHANNEL}/status/extra`,
    headers: JSON_HEADERS,
    body: envelopeBody({ cwd: tmpdir() }),
  })
  assert.equal(nested.statusCode, 404, '端点名不允许再带斜杠')
})

test('信封不合法返回 400', async () => {
  const { handler } = mount()
  const res = await call(handler, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ type: 'server-response', rpcId: 'x', method: 'status', payload: {} }),
  })
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).type, 'server-response')
})

test('未知端点返回错误信封与可诊断的 details.code', async () => {
  const { handler } = mount()
  const res = await call(handler, {
    url: `${CHANNEL}/nope`,
    headers: JSON_HEADERS,
    body: envelopeBody({ cwd: tmpdir() }, 'rpc-9'),
  })
  // 200 而不是 404：非 2xx 会被浏览器侧传输层当连接失败，diagnostics 就丢了。
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.rpcId, 'rpc-9')
  assert.equal(body.result.ok, false)
  assert.equal(body.result.error.code, 'internal', '线路上的 code 固定为 internal')
  assert.equal(body.result.error.details.code, 'unknown-endpoint')
})

test('相对路径的 cwd 被拒绝，且错误走信封而非 HTTP 状态', async () => {
  const { handler } = mount()
  const res = await call(handler, { headers: JSON_HEADERS, body: envelopeBody({ cwd: 'relative/path' }) })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.type, 'server-response')
  assert.equal(body.result.ok, false)
  assert.equal(body.result.error.details.code, 'invalid-cwd')
})

test('非仓库目录是成功结果（repo 为 null），不是错误', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-nonrepo-'))
  try {
    const { handler } = mount()
    const res = await call(handler, { headers: JSON_HEADERS, body: envelopeBody({ cwd: dir }) })
    const body = JSON.parse(res.body)
    assert.equal(res.statusCode, 200)
    assert.equal(body.result.ok, true)
    assert.equal(body.result.value.repo, null)
    assert.equal(body.result.value.dirty, false)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('请求体超限返回 413', async () => {
  const { handler } = mount()
  const res = await call(handler, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ type: 'client-request', rpcId: 'x', method: 'status', payload: { pad: 'y'.repeat(300 * 1024) } }),
  })
  assert.equal(res.statusCode, 413)
})

test('响应头带 json content-type 与准确 content-length', async () => {
  const { handler } = mount()
  const res = await call(handler, { headers: JSON_HEADERS, body: envelopeBody({ cwd: 'relative' }) })
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(Number(res.headers['content-length']), Buffer.byteLength(res.body))
})
