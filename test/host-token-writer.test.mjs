/**
 * 「把后台凭据写进凭据存储」这条路径的用例。
 *
 * 这是整个插件里**唯一会改状态**的地方，所以守得比其他都紧：
 *
 *   1. 只写 `*_ACCESS_TOKEN` —— 不接受客户端传来的任意引用名（否则这就是一个
 *      "往凭据库里任意写入"的接口）；
 *   2. 令牌脏（空白、超长、空）就不写 —— 宁可报错，也不把半个令牌存进去；
 *   3. 引用名从**设置投影**推导，客户端连名字都不用知道。
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { createProviderTokenWriter, PROVIDER_TOKEN_MAX } from '../lib/host/provider-balance.js'

/** 真实形状的设置投影：一个中转站 / 一个不符合 `*_API_KEY` 形状的怪名字。 */
function fakeCtx(options = {}) {
  const written = []
  const services = {
    settings: {
      describe() {
        return [
          {
            ns: 'llm-pi-ai',
            value: {
              providers: {
                'relay-a': {
                  baseURL: 'https://relay-a.example/v1',
                  apiKeyEnv: 'RELAY_A_API_KEY',
                  api: 'openai-completions',
                },
                // 不符合 `*_API_KEY` 形状：推导不出令牌引用名，就该拒绝写。
                odd: {
                  baseURL: 'https://example.com/v1',
                  apiKeyEnv: 'SOME_TOKEN',
                  api: 'openai-completions',
                },
              },
            },
          },
        ]
      },
    },
    credentials: {
      describe() {
        return Promise.resolve({ configured: false, writable: true })
      },
      set(ref, value) {
        written.push({ ref, value })
        return Promise.resolve()
      },
    },
  }
  if (options.withoutCredentials === true) delete services.credentials
  return {
    written,
    ctx: {
      get(name) {
        return services[name]
      },
      inject(deps, callback) {
        if (deps.some((name) => services[name] === undefined)) return () => {}
        return callback({ ...services }) ?? (() => {})
      },
    },
  }
}

test('写入器：令牌写到**推导出来的** `*_ACCESS_TOKEN`，客户端全程不用知道引用名', async () => {
  const { ctx, written } = fakeCtx()
  const write = createProviderTokenWriter(ctx)
  const result = await write('relay-a', 'sk-dashboard-token')
  assert.deepEqual(result, { ok: true, ref: 'RELAY_A_ACCESS_TOKEN' })
  assert.deepEqual(written, [{ ref: 'RELAY_A_ACCESS_TOKEN', value: 'sk-dashboard-token' }])
})

test('写入器：首尾空白被剪掉（从浏览器复制十次有八次带个尾换行）', async () => {
  const { ctx, written } = fakeCtx()
  const write = createProviderTokenWriter(ctx)
  assert.equal((await write('relay-a', '  sk-with-padding\n')).ok, true)
  assert.equal(written[0].value, 'sk-with-padding', '存进去的必须是没有空白的那个值')
})

test('写入器：脏令牌一律不写（空 / 纯空白 / 中间有空白 / 超长 / 不是字符串）', async () => {
  const { ctx, written } = fakeCtx()
  const write = createProviderTokenWriter(ctx)
  const dirty = [
    '',
    '   ',
    'sk-has space',
    'sk-has\ttab',
    'sk-has\nnewline',
    'x'.repeat(PROVIDER_TOKEN_MAX + 1),
    null,
    undefined,
    42,
    { token: 'sk-x' },
  ]
  for (const value of dirty) {
    const result = await write('relay-a', value)
    assert.equal(result.ok, false, `应当拒绝：${JSON.stringify(value)}`)
    assert.equal(result.reason, 'bad-token', `原因应当是 bad-token：${JSON.stringify(value)}`)
  }
  assert.deepEqual(written, [], '一个脏令牌都不该落进凭据存储')
})

test('写入器：不认识的提供方 → unknown-provider（不去猜它叫什么）', async () => {
  const { ctx, written } = fakeCtx()
  const write = createProviderTokenWriter(ctx)
  const result = await write('nope', 'sk-x')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'unknown-provider')
  assert.deepEqual(written, [])
})

test('写入器：提供方的 Key 引用名不是 `*_API_KEY` 形状 → 推导不出令牌名，拒绝写', async () => {
  const { ctx, written } = fakeCtx()
  const write = createProviderTokenWriter(ctx)
  const result = await write('odd', 'sk-x')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'not-supported')
  assert.deepEqual(written, [])
})

test('写入器：凭据服务不在 → no-credentials（而不是假装存好了）', async () => {
  const { ctx } = fakeCtx({ withoutCredentials: true })
  const write = createProviderTokenWriter(ctx)
  const result = await write('relay-a', 'sk-x')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'no-credentials')
})

test('写入器：凭据服务抛错 → failed，且把原因带回来（面板要能说人话）', async () => {
  const { ctx } = fakeCtx()
  ctx.get('credentials').set = () => Promise.reject(new Error('disk full'))
  const write = createProviderTokenWriter(ctx)
  const result = await write('relay-a', 'sk-x')
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'failed')
  assert.equal(result.message, 'disk full')
})

test('写入器：答复里没有令牌本身（只有引用名）', async () => {
  const { ctx } = fakeCtx()
  const write = createProviderTokenWriter(ctx)
  const result = await write('relay-a', 'sk-very-secret')
  assert.equal(JSON.stringify(result).includes('sk-very-secret'), false)
})
