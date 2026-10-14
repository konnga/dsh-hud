import { EventEmitter } from 'node:events'
import { CHANNEL, apply } from '../lib/index.js'

/**
 * 用假 ctx 挂载宿主半，捕获它注册的路由与 effect 标签。
 * @param options - `requestRejection` 可覆盖围栏结果。
 */
export function mount(options = {}) {
  const routes = []
  const labels = []
  const connection = {
    requestRejection: options.requestRejection ?? (() => undefined),
  }
  const ctx = {
    effect(fn, label) {
      labels.push(label)
      return fn()
    },
    get(name) {
      return name === 'connection' ? connection : undefined
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
  }
  apply(ctx)
  return { ctx, routes, labels, connection, handler: routes[0].handler }
}

export function fakeRequest({ method = 'POST', url = `${CHANNEL}/status`, headers = {}, body = undefined } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = headers
  req.destroy = () => {}
  queueMicrotask(() => {
    if (body !== undefined) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  return req
}

export function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value
    },
    end(chunk) {
      this.body = chunk ?? ''
    },
  }
}

/** 发一条请求，返回假响应。 */
export async function call(handler, options) {
  const res = fakeResponse()
  await handler(fakeRequest(options), res)
  return res
}

export const JSON_HEADERS = { 'content-type': 'application/json' }

/** 构造客户端 `ctx.connection.rpc.call` 会发出的请求体。 */
export function requestBody(args, rpcId = 'rpc-1', method = 'status') {
  return JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } })
}

/**
 * 以浏览器半的视角调用宿主半：与 `ctx.connection.rpc.call(channel, endpoint, { args })`
 * 同形，返回它 resolve 出的结果信封（成功与业务失败都不抛）。
 *
 * @param handler - 宿主半注册的路由处理器。
 * @param channel - RPC 通道前缀。
 * @param endpoint - 端点名。
 * @param options - `{ args }`。
 * @returns `{ ok: true, value } | { ok: false, error }`。
 */
export async function rpcCall(handler, channel, endpoint, options = {}) {
  const res = await call(handler, {
    url: `${channel}/${endpoint}`,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      type: 'client-request',
      rpcId: 'rpc-e2e',
      method: endpoint,
      payload: { args: options.args },
    }),
  })

  // 宿主半对可解析的请求一律回 200 + 信封；非 2xx 只在路径/协议层面的拒绝里出现。
  // 这里两种都尝试解析，解析不出才算传输失败。
  let payload = null
  try {
    payload = JSON.parse(res.body)
  }
  catch {
    payload = null
  }

  if (payload && payload.type === 'server-response' && payload.result) {
    return payload.result
  }

  return { ok: false, error: { code: 'internal', message: `HTTP ${res.statusCode}`, details: { code: 'transport' } } }
}
