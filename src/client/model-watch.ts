/**
 * 「换模型就换账本」的那个触发器。
 *
 * 为什么需要它：胶囊的取数有 TTL（成功 60 秒），而**换模型不是取数失败**，
 * 它只是让"当前会话用的是哪个提供方"变了。TTL 按时钟算，不按事实算，
 * 所以换完模型最长要等一分钟胶囊才改口径 —— 用户切到 `ur` 之后盯着
 * `¥8.60`（平台账号的钱）看一分钟，会以为插件没跟上（他确实是这么问的）。
 *
 * 触发源选 `sessions` 服务的 `modelSelection` 投影：那是**模型选择本身**的
 * 真相（`pending ?? lastUsed`，刚在菜单里点下的那个立刻生效，不必等第一条消息），
 * 也正是宿主解析提供方时用的同一个投影 —— 两边看同一份数据，才不会各说各话。
 *
 * 这一层是**软依赖**：拿不到 `sessions` 就什么都不做，退回原来的轮询节奏。
 * 一条诊断都不报 —— 少了它只是慢一分钟，不是坏掉。
 */

import type { HudState, HudStore } from './shared.js'

/** 模型投影里我们关心的一点点形状（其余字段不碰）。 */
interface ModelSelectionValue {
  lastUsed?: { provider?: unknown } | null
  pending?: { provider?: unknown } | null
}

/** 投影的一个 face：`getSnapshot` 读、`subscribe` 听（框架提供的形状）。 */
interface ProjectionFace {
  getSnapshot: () => ModelSelectionValue | undefined
  subscribe: (listener: () => void) => () => void
}

/** 客户端 `sessions` 服务里用到的那一点。 */
interface SessionsService {
  binding?: (
    id: string,
  ) => { session?: { projections?: { faceOf?: (key: string) => ProjectionFace } } } | undefined
}

/** 多久检查一次"这个会话的投影挂上了没"（纯本地读取，不发请求）。 */
const BIND_RETRY_MS = 2000

/**
 * 从投影读数里取"当前属于哪个提供方"。
 *
 * `pending` 优先：菜单里刚点下的那个模型还没真正用过，但账本已经该换了 ——
 * 胶囊跟的是"接下来要花谁的钱"，不是"上一次花了谁的钱"。
 */
function providerOf(value: ModelSelectionValue | undefined): string | null {
  if (value === null || typeof value !== 'object') return null
  const chosen = value.pending ?? value.lastUsed
  if (chosen === null || typeof chosen !== 'object') return null
  const provider = (chosen as { provider?: unknown }).provider
  return typeof provider === 'string' && provider !== '' ? provider : null
}

/**
 * 盯着当前会话的 `modelSelection`：提供方一变就**立刻**重取一次余额。
 *
 * @param ctx - 客户端插件上下文（只用 `get`）。
 * @param store - 共享 store（`loadProviderBalance(true)` 会跳过 TTL）。
 * @returns 卸载函数（停掉定时器与订阅）。
 */
export function watchModelSelection(
  ctx: { get: (name: string) => unknown },
  store: HudStore,
): () => void {
  const raw = ctx.get('sessions') as SessionsService | undefined
  // 没有这个服务：什么都不做，保持原来的 30 秒轮询 + TTL 行为。
  if (raw === undefined || raw === null || typeof raw.binding !== 'function') {
    return function () {}
  }
  // 收窄到一个不可变的局部量：下面几个闭包都要用（TS 不跨闭包保留收窄）。
  const sessions: SessionsService = raw

  let disposed = false
  let boundSession: string | null = null
  let unsubscribe: (() => void) | null = null
  let lastProvider: string | null = null
  let retry: number | null = null

  /** 投影还没就绪时才需要补挂；挂上了就把定时器停掉（不白跑）。 */
  function startRetry(): void {
    if (retry !== null || disposed) return
    // `window.setInterval`：测试 harness 替换的是 `window.*`，裸调用会留下真的 Node
    // 定时器（用例全过但进程不退出），浏览器里 `window.setInterval` 与全局是同一个。
    retry = window.setInterval(function () {
      sync(store.getSnapshot())
    }, BIND_RETRY_MS)
  }

  function stopRetry(): void {
    if (retry === null) return
    window.clearInterval(retry)
    retry = null
  }

  function detach(): void {
    if (unsubscribe !== null) {
      const stop = unsubscribe
      unsubscribe = null
      try {
        stop()
      } catch {
        // 投影已经被框架收走了：这里没有任何可做的补救，也不该反过来打崩插件。
      }
    }
    boundSession = null
    lastProvider = null
  }

  /** 把订阅挂到当前会话的投影上（投影/绑定还没就绪就下次再试）。 */
  function attach(sessionId: string): void {
    const binding = sessions.binding?.(sessionId)
    const faceOf = binding?.session?.projections?.faceOf
    if (typeof faceOf !== 'function') return
    let face: ProjectionFace
    try {
      face = faceOf('modelSelection')
    } catch {
      return
    }
    if (face === undefined || face === null || typeof face.subscribe !== 'function') return

    boundSession = sessionId
    stopRetry()
    lastProvider = providerOf(face.getSnapshot())
    unsubscribe = face.subscribe(function () {
      if (disposed) return
      const next = providerOf(face.getSnapshot())
      // 只认"提供方变了"：同一个站下面换模型（`ur/deepseek-v4.1-flash` → `ur/gpt-6-luna`）
      // 账本没变，没必要打一次请求。
      if (next === null || next === lastProvider) return
      lastProvider = next
      void store.loadProviderBalance(true)
    })
  }

  /** 看一眼当前会话，必要时重挂。 */
  function sync(state: HudState): void {
    if (disposed) return
    const sessionId = state.sessionId
    if (typeof sessionId !== 'string' || sessionId === '') {
      detach()
      return
    }
    if (sessionId === boundSession) return
    detach()
    attach(sessionId)
    // 没挂上（绑定还没物化 / 这个会话没有 modelSelection 投影）：过一会儿再试。
    if (boundSession === null) startRetry()
  }

  const stopStore = store.subscribe(function () {
    sync(store.getSnapshot())
  })
  sync(store.getSnapshot())

  return function () {
    disposed = true
    stopRetry()
    stopStore()
    detach()
  }
}
