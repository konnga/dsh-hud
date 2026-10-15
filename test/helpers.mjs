import { EventEmitter } from 'node:events'
import { CHANNEL, apply } from '../lib/index.js'

/**
 * 用假 ctx 挂载宿主半，捕获它注册的路由与 effect 标签。
 * @param options - `requestRejection` 可覆盖围栏结果。
 */
export function mount(options = {}) {
  const routes = []
  const labels = []
  /** 事件名 → 监听器：宿主半会旁听 `fs/*` 事件做会话归因，测试要用 emit 驱动它。 */
  const listeners = new Map()
  const connection = {
    requestRejection: options.requestRejection ?? (() => undefined),
  }
  const cleanups = []
  const ctx = {
    effect(fn, label) {
      labels.push(label)
      const cleanup = fn()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
      return cleanup
    },
    get(name) {
      return name === 'connection' ? connection : undefined
    },
    // 动态注入：真实 Cordis 里 `ctx.inject(deps, cb)` 起一个带 inject 的子 fiber ——
    // 全部依赖到齐才回调，缺一个就永远不回调。宿主半的软依赖（例如 `sessionProjections`）
    // 就是靠这个语义"有则用、无则不算"。
    inject(deps, callback) {
      const provided = options.services ?? {}
      if (deps.some(name => provided[name] === undefined)) return () => {}
      const dispose = callback({ ...provided, effect: fn => fn() })
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    on(event, listener) {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
      return () => {
        listeners.set(event, (listeners.get(event) ?? []).filter(item => item !== listener))
      }
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
  }
  apply(ctx)
  return {
    ctx,
    routes,
    labels,
    connection,
    handler: routes[0].handler,
    listeners,
    cleanups,
    /** 触发某个事件上的全部监听（模拟宿主侧派发）。 */
    emit(event, ...args) {
      for (const listener of listeners.get(event) ?? []) listener(...args)
    },
  }
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
