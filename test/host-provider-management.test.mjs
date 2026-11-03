import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProviderBalanceReader, publicProviderURL } from '../lib/host/provider-balance.js'
import { setProviderManagementReader, CHANNEL } from '../lib/host/rpc.js'
import { mount, rpcCall, call, requestBody, JSON_HEADERS } from './helpers.mjs'

function fixture(options = {}) {
  const providers = options.providers ?? {
    relay: { baseURL: 'https://relay.example/v1', apiKeyEnv: 'RELAY_API_KEY' },
    official: { baseURL: 'https://api.deepseek.com', apiKeyEnv: 'OFFICIAL_API_KEY' },
  }
  const refs = { RELAY_API_KEY: 'secret-api-key', ...options.refs }
  const calls = []
  const described = []
  const resolved = []
  const settings = {
    describe(opts) {
      assert.deepEqual(opts, { redactSecrets: true })
      if (options.settingsThrow) throw new Error('settings-secret-error')
      return [{ ns: 'include:llm-pi-ai', value: { providers, secret: 'never-return-me' } }]
    },
    update() {
      assert.fail('must not update settings')
    },
  }
  const credentials = {
    async describe(ref) {
      described.push(ref)
      return { configured: !!refs[ref], writable: true }
    },
    async resolve(ref) {
      resolved.push(ref)
      return refs[ref] ? { value: refs[ref], source: 'test' } : undefined
    },
    set() {
      assert.fail('read APIs must not write credentials')
    },
  }
  const services = { settings, credentials, ...options.services }
  const mounted = mount({ services })
  const reader = createProviderBalanceReader(mounted.ctx, {
    now: () => 100,
    fetch: async (url, init) => {
      calls.push({ url, headers: init.headers })
      if (options.networkThrow) throw new Error('secret-api-key network error')
      const body = url.includes('/usage') ? { total_usage: 123 } : { hard_limit_usd: 42 }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    },
  })
  setProviderManagementReader(reader)
  return {
    providers,
    refs,
    calls,
    described,
    resolved,
    reader,
    services,
    call: async (endpoint, args = {}) => {
      const result = await rpcCall(mounted.handler, CHANNEL, endpoint, { args })
      assert.equal(result.ok, true)
      return result.value
    },
    dispose: () => mounted.cleanups.forEach((fn) => fn()),
  }
}

test('list exposes only configured relays and public metadata; no requests or credential resolution', async () => {
  const f = fixture({
    providers: {
      relay: {
        baseURL:
          'https://url-user:url-password@relay.example/v1?api_key=query-secret#fragment-secret',
        apiKeyEnv: 'RELAY_API_KEY',
        apiKey: 'inline-secret',
        headers: { Authorization: 'header-secret' },
      },
      official: { baseURL: 'https://api.deepseek.com', apiKeyEnv: 'OFFICIAL_API_KEY' },
      opaque: { baseURL: 'https://opaque.example', apiKeyEnv: 'OTHER_KEY' },
      invalid: { baseURL: 'invalid-secret-url', apiKeyEnv: 'INVALID_API_KEY' },
    },
    refs: { RELAY_ACCESS_TOKEN: 'secret-access-token' },
  })
  try {
    const result = await f.call('provider-list')
    assert.deepEqual(result, {
      available: true,
      providers: [
        {
          id: 'relay',
          label: 'relay',
          baseURL: 'https://relay.example/v1',
          token: { ref: 'RELAY_ACCESS_TOKEN', configured: true },
          key: { ref: 'RELAY_API_KEY', configured: true },
        },
        {
          id: 'opaque',
          label: 'opaque',
          baseURL: 'https://opaque.example/',
          token: null,
          key: { ref: 'OTHER_KEY', configured: false },
        },
        {
          id: 'invalid',
          label: 'invalid',
          baseURL: '',
          token: { ref: 'INVALID_ACCESS_TOKEN', configured: false },
          key: { ref: 'INVALID_API_KEY', configured: false },
        },
      ],
    })
    const serialized = JSON.stringify(result)
    for (const secret of [
      'url-user',
      'url-password',
      'query-secret',
      'fragment-secret',
      'inline-secret',
      'header-secret',
      'secret-api-key',
      'secret-access-token',
      'invalid-secret-url',
      'never-return-me',
    ]) {
      assert.ok(!serialized.includes(secret), secret)
    }
    assert.equal(f.calls.length, 0)
    assert.deepEqual(f.resolved, [])
  } finally {
    f.dispose()
  }
})

test('public URL rejects non-http and malformed addresses without echoing secrets', () => {
  for (const url of ['file:///secret', 'javascript:secret', 'secret', 'data:text/plain,secret']) {
    assert.equal(publicProviderURL(url), '')
  }
  assert.equal(
    publicProviderURL('http://user:pass@localhost:3000/v1?token=secret#secret'),
    'http://localhost:3000/v1',
  )
})

test('empty available configuration differs from missing or failed settings service', async () => {
  for (const [options, available] of [
    [{ providers: {} }, true],
    [{ services: { settings: undefined } }, false],
    [{ settingsThrow: true }, false],
  ]) {
    const f = fixture(options)
    try {
      assert.deepEqual(await f.call('provider-list'), {
        available,
        providers: [],
        ...(!available
          ? { reason: options.settingsThrow ? 'settings-failed' : 'settings-unavailable' }
          : {}),
      })
    } finally {
      f.dispose()
    }
  }
})

test('detail reads a configured provider without session, caches values and honors force', async () => {
  const f = fixture()
  try {
    const one = await f.call('provider-detail-balance', {
      provider: 'relay',
      baseURL: 'https://attacker.example',
      sessionId: 'not-a-session',
    })
    assert.equal(one.available, true)
    assert.equal(one.balance.provider, 'relay')
    assert.equal(one.balance.remaining, '42.00')
    assert.equal(one.balance.usedKey, '1.23')
    assert.deepEqual(one.token, { ref: 'RELAY_ACCESS_TOKEN', configured: false })
    assert.ok(f.calls.every((call) => call.url.startsWith('https://relay.example/')))
    assert.ok(f.calls.every((call) => call.headers.Authorization === 'Bearer secret-api-key'))
    const count = f.calls.length
    await f.call('provider-detail-balance', { provider: 'relay' })
    assert.equal(f.calls.length, count)
    f.refs.RELAY_ACCESS_TOKEN = 'new-access-secret'
    const cached = await f.call('provider-detail-balance', { provider: 'relay' })
    assert.equal(cached.token.configured, true, 'token status is not cached')
    assert.equal(f.calls.length, count)
    await f.call('provider-detail-balance', { provider: 'relay', force: true })
    assert.ok(f.calls.length > count)
    assert.ok(!JSON.stringify(one).includes('secret-api-key'))
  } finally {
    f.dispose()
  }
})

test('unknown, malformed, official and arbitrary URL providers cannot issue requests or echo input', async () => {
  const f = fixture()
  try {
    for (const provider of [
      undefined,
      null,
      {},
      '',
      'missing',
      'official',
      'deepseek-account',
      'https://attacker.example?token=secret',
    ]) {
      const result = await f.call('provider-detail-balance', {
        provider,
        baseURL: 'https://attacker.example',
      })
      assert.equal(result.available, false)
      assert.equal(result.reason, 'unknown-provider')
      assert.equal(result.provider, null)
      assert.equal(result.token, null)
      assert.ok(!JSON.stringify(result).includes('attacker'))
    }
    assert.equal(f.calls.length, 0)
    assert.equal(f.resolved.length, 0)
  } finally {
    f.dispose()
  }
})

test('removed or changed provider configuration invalidates access to previous cached balance', async () => {
  const f = fixture()
  try {
    await f.call('provider-detail-balance', { provider: 'relay' })
    const count = f.calls.length
    f.providers.relay.baseURL = 'https://new-relay.example/v1'
    await f.call('provider-detail-balance', { provider: 'relay' })
    assert.ok(f.calls.length > count)
    assert.ok(
      f.calls.slice(count).every((call) => call.url.startsWith('https://new-relay.example/')),
    )
    delete f.providers.relay
    const removed = await f.call('provider-detail-balance', { provider: 'relay' })
    assert.equal(removed.reason, 'unknown-provider')
    assert.deepEqual((await f.call('provider-list')).providers, [])
  } finally {
    f.dispose()
  }
})

test('fetch errors containing credentials remain private and failed balance is explicit', async () => {
  const f = fixture({ networkThrow: true })
  try {
    const result = await f.call('provider-detail-balance', { provider: 'relay' })
    assert.equal(result.available, false)
    assert.equal(result.reason, 'unsupported')
    assert.ok(!JSON.stringify(result).includes('secret-api-key'))
  } finally {
    f.dispose()
  }
})

test('session and management queries share the same balance cache without changing model selection', async () => {
  const session = { id: 's1', header: { id: 's1' } }
  const state = { pending: { provider: 'relay', model: 'model-a' } }
  const before = JSON.stringify(state)
  const f = fixture({
    services: {
      sessions: { get: () => session, list: () => [session] },
      sessionProjections: {
        stateOf: (_session, key) => (key === 'modelSelection' ? state : undefined),
      },
    },
  })
  try {
    const sessionResult = await f.reader('s1')
    assert.equal(sessionResult.ok, true)
    const count = f.calls.length
    const detail = await f.call('provider-detail-balance', { provider: 'relay' })
    assert.deepEqual(detail.balance, sessionResult.value)
    assert.equal(f.calls.length, count)
    await f.call('provider-detail-balance', { provider: 'relay', force: true })
    const refreshedCount = f.calls.length
    await f.reader('s1')
    assert.equal(f.calls.length, refreshedCount)
    assert.equal(JSON.stringify(state), before)
  } finally {
    f.dispose()
  }
})

test('plugin disposal removes both management endpoints readers', async () => {
  const f = fixture()
  f.dispose()
  assert.deepEqual(await f.call('provider-list'), {
    available: false,
    providers: [],
    reason: 'unsupported',
  })
  assert.equal(
    (await f.call('provider-detail-balance', { provider: 'relay' })).reason,
    'unsupported',
  )
})

test('API key reveal is explicit, uncached, provider-scoped and does not reveal the web token', async () => {
  const f = fixture({ refs: { RELAY_ACCESS_TOKEN: 'private-web-token' } })
  try {
    await f.call('provider-list')
    assert.deepEqual(f.resolved, [])
    assert.deepEqual(
      await f.call('provider-key', { provider: 'relay', ref: 'RELAY_ACCESS_TOKEN' }),
      {
        available: true,
        provider: 'relay',
        apiKey: 'secret-api-key',
      },
    )
    assert.deepEqual(f.resolved, ['RELAY_API_KEY'])
    f.refs.RELAY_API_KEY = 'rotated-api-key'
    assert.equal((await f.call('provider-key', { provider: 'relay' })).apiKey, 'rotated-api-key')
    f.providers.relay.apiKeyEnv = 'CHANGED_API_KEY'
    f.refs.CHANGED_API_KEY = 'changed-reference-key'
    assert.equal(
      (await f.call('provider-key', { provider: 'relay' })).apiKey,
      'changed-reference-key',
    )
    delete f.providers.relay
    assert.deepEqual(await f.call('provider-key', { provider: 'relay' }), {
      available: false,
      reason: 'unknown-provider',
    })
    assert.equal(f.calls.length, 0)
  } finally {
    f.dispose()
  }
})

test('API key reveal rejects arbitrary references, missing providers, official/account IDs and sanitizes errors', async () => {
  const f = fixture()
  try {
    for (const provider of [
      undefined,
      null,
      {},
      '',
      'official',
      'deepseek-account',
      'RELAY_API_KEY',
      'https://evil/?secret',
    ]) {
      assert.deepEqual(await f.call('provider-key', { provider, ref: 'RELAY_API_KEY' }), {
        available: false,
        reason: 'unknown-provider',
      })
    }
    assert.deepEqual(f.resolved, [])
    delete f.refs.RELAY_API_KEY
    assert.deepEqual(await f.call('provider-key', { provider: 'relay' }), {
      available: false,
      reason: 'not-configured',
    })
    f.services.credentials.resolve = async () => {
      throw new Error('private-secret-stack')
    }
    assert.deepEqual(await f.call('provider-key', { provider: 'relay' }), {
      available: false,
      reason: 'read-failed',
    })
    f.services.credentials = undefined
    assert.deepEqual(await f.call('provider-key', { provider: 'relay' }), {
      available: false,
      reason: 'credentials-unavailable',
    })
    f.services.settings = undefined
    assert.deepEqual(await f.call('provider-key', { provider: 'relay' }), {
      available: false,
      reason: 'settings-unavailable',
    })
    f.dispose()
    assert.deepEqual(await f.call('provider-key', { provider: 'relay' }), {
      available: false,
      reason: 'unsupported',
    })
  } finally {
    f.dispose()
  }
})

test('API key metadata is unknown rather than resolving secrets when describe is unavailable', async () => {
  const f = fixture()
  try {
    f.services.credentials.describe = undefined
    const result = await f.call('provider-list')
    assert.equal(result.providers[0].key, null)
    assert.ok(!f.resolved.includes('RELAY_API_KEY'))
  } finally {
    f.dispose()
  }
})

test('API key route sets no-store and retains the existing authentication fence', async () => {
  const mounted = mount()
  setProviderManagementReader({
    revealKey: async () => ({ available: true, provider: 'relay', apiKey: 'synthetic-key' }),
  })
  const request = {
    url: CHANNEL + '/provider-key',
    headers: JSON_HEADERS,
    body: requestBody({ provider: 'relay' }, 'key-test', 'provider-key'),
  }
  try {
    const response = await call(mounted.handler, request)
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.equal(JSON.parse(response.body).result.value.apiKey, 'synthetic-key')
    mounted.connection.requestRejection = () => 401
    const denied = await call(mounted.handler, request)
    assert.equal(denied.statusCode, 401)
    assert.equal(denied.body, '')
  } finally {
    mounted.cleanups.forEach((fn) => fn())
  }
})

test('Web token reads only current relay token, with no API key fallback or secret error', async () => {
  const f = fixture({ refs: { RELAY_ACCESS_TOKEN: 'synthetic-web-token' } })
  try {
    assert.deepEqual(await f.call('provider-token', { provider: 'relay', ref: 'RELAY_API_KEY' }), {
      available: true,
      provider: 'relay',
      accessToken: 'synthetic-web-token',
    })
    assert.deepEqual(f.resolved, ['RELAY_ACCESS_TOKEN'])
    f.refs.RELAY_ACCESS_TOKEN = 'rotated-web-token'
    assert.equal(
      (await f.call('provider-token', { provider: 'relay' })).accessToken,
      'rotated-web-token',
    )
    for (const provider of ['official', 'deepseek-account', 'unknown'])
      assert.deepEqual(await f.call('provider-token', { provider }), {
        available: false,
        reason: 'unknown-provider',
      })
    delete f.refs.RELAY_ACCESS_TOKEN
    assert.deepEqual(await f.call('provider-token', { provider: 'relay' }), {
      available: false,
      reason: 'not-configured',
    })
    f.services.credentials.resolve = async () => {
      throw new Error('synthetic-private-value')
    }
    assert.deepEqual(await f.call('provider-token', { provider: 'relay' }), {
      available: false,
      reason: 'read-failed',
    })
    delete f.providers.relay
    assert.deepEqual(await f.call('provider-token', { provider: 'relay' }), {
      available: false,
      reason: 'unknown-provider',
    })
  } finally {
    f.dispose()
  }
})

test('Web token endpoint has no-store and keeps authentication required', async () => {
  const mounted = mount()
  setProviderManagementReader({
    revealToken: async () => ({
      available: true,
      provider: 'relay',
      accessToken: 'synthetic-web-token',
    }),
  })
  const request = {
    url: CHANNEL + '/provider-token',
    headers: JSON_HEADERS,
    body: requestBody({ provider: 'relay' }, 'token-test', 'provider-token'),
  }
  try {
    const response = await call(mounted.handler, request)
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.equal(JSON.parse(response.body).result.value.accessToken, 'synthetic-web-token')
    mounted.connection.requestRejection = () => 401
    const denied = await call(mounted.handler, request)
    assert.equal(denied.statusCode, 401)
    assert.equal(denied.body, '')
  } finally {
    mounted.cleanups.forEach((fn) => fn())
  }
})
