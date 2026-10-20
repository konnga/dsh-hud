/**
 * 「工具活动 / 侧栏摘要 / 回合信息」这一片 store：三样都跟会话走、与工作区无关，各自一条轮询节拍；回合信息还带一个 sessions 动态注入。
 *
 * store 拆分后的一片：读快照走 `getState()`，写状态走 `set()`；
 * 跨片与 store 内部依赖走 `helpers`（由 `createStore` 组装时注入）。
 */

import type { HudSessionOverviewRow, HudToolActive, TurnsState } from '../shared.js'
import type {
  GetState,
  SessionStatusesPayload,
  SessionToolsPayload,
  StoreContext,
  SessionsService,
  StoreSet,
  ToolsSlice,
  TurnFace,
  TurnSession,
} from './types.js'

import { CHANNEL, probe } from '../shared.js'

/** 回合投影的订阅记账：`{ sessionId, dispose }`；`null` 表示没接。 */
interface TurnsBinding {
  sessionId: string | null
  dispose: (() => void) | null
}

export function createToolsSlice(ctx: StoreContext, getState: GetState, set: StoreSet): ToolsSlice {
  /** 工具活动那次请求（在途合并）。 */
  var toolsInflight: Promise<unknown> | null = null
  /** 侧栏摘要那次请求（在途合并）。 */
  var rowsInflight: Promise<unknown> | null = null
  /** 回合投影的订阅：`{ sessionId, dispose }`；`null` 表示没接。 */
  var turnsBound: TurnsBinding | null = null
  /** `sessions` 客户端服务（动态注入；没到齐就是 null，回合信息不显示）。 */
  var turnSessions: SessionsService | null = null

  // 回合信息要的 `sessions` 客户端服务：**动态注入**等它到齐（软依赖）——
  // 缺它时 git、归因、胶囊一切照旧，只是不显示"第几轮"。到齐后把当前会话接上。
  if (typeof ctx.inject === 'function') {
    ctx.effect(function () {
      return ctx.inject(['sessions'], function (scope) {
        turnSessions = scope.sessions
        probe.log('turn-services', { sessions: true })
        bindTurns(getState().sessionId)
        return function () {
          turnSessions = null
          unbindTurns()
        }
      })
    }, 'dsh-hud: turn services')
  }

  /**
   * 接上 `turnOutline` 投影（"第几轮改的"）。
   *
   * 软依赖：`sessions` 服务、已物化的会话、这个投影三者缺一个就安静地不接 —— 归因、
   * git、胶囊一切照旧，只是不显示回合信息。整段包在 try/catch 里，读不到不该把面板带崩。
   */
  function unbindTurns(): void {
    if (turnsBound === null) return
    try {
      if (typeof turnsBound.dispose === 'function') turnsBound.dispose()
    } catch (error) {
      // 解绑失败不影响接下来的绑定。
    }
    turnsBound = null
    set({ turns: { available: false, prompts: {}, latest: null } })
  }

  function bindTurns(sessionId: string | null | undefined): void {
    if (turnsBound !== null && turnsBound.sessionId === sessionId) return
    unbindTurns()
    if (!sessionId || turnSessions === null) return
    try {
      var bound = turnSessions.binding(sessionId)
      var live = bound ? bound.session : undefined
      if (!live || !live.projections || typeof live.projections.faceOf !== 'function') return
      var face = live.projections.faceOf('turnOutline')
      if (!face || typeof face.getSnapshot !== 'function') return
      // 已用 typeof 确认 getSnapshot 是函数：这里断言成"带 getSnapshot 的 face"，
      // 让闭包里可以保持 this 绑定地调用它（把方法拆出来再调会丢 this）。
      var liveFace = face as TurnFace & { getSnapshot: () => unknown }
      var apply = function () {
        try {
          set({ turns: normalizeTurns(liveFace.getSnapshot()) })
        } catch (error) {
          probe.log('turns-read-failed', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
      apply()
      var dispose = typeof liveFace.subscribe === 'function' ? liveFace.subscribe(apply) : null
      turnsBound = { sessionId: sessionId, dispose: dispose }
    } catch (error) {
      // 会话还没物化、投影还没注册、注入没到位 —— 都只意味着"这一轮拿不到回合信息"。
      probe.log('turns-bind-failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /** 归一 `turnOutline` 快照：`{ turns: [{ turn, prompt }], draft }`。 */
  function normalizeTurns(snapshot: unknown): TurnsState {
    // 投影快照是外部服务给的 unknown：先收成记录，再逐项判断。
    var record =
      snapshot !== null && typeof snapshot === 'object' ? (snapshot as { turns?: unknown }) : null
    var entries = record !== null && Array.isArray(record.turns) ? record.turns : null
    if (entries === null) return { available: false, prompts: {}, latest: null }
    var prompts: Record<number, string> = {}
    var latest: number | null = null
    for (var index = 0; index < entries.length; index += 1) {
      var entry = entries[index]
      if (!entry || typeof entry !== 'object') continue
      // 每条 turn 也是外部形状：同样先收成记录再逐字段判断。
      var item = entry as { turn?: unknown; prompt?: unknown }
      if (typeof item.turn !== 'number') continue
      if (typeof item.prompt === 'string' && item.prompt.length > 0)
        prompts[item.turn] = item.prompt
      if (latest === null || item.turn > latest) latest = item.turn
    }
    return { available: true, prompts: prompts, latest: latest }
  }

  /**
   * 取侧栏每条会话行要的摘要（**一次批量**，不是 N 次 RPC）。
   *
   * 会话列表由**宿主**枚举（它有 `sessions` 服务），客户端不用把名单端过去；宿主没有
   * 那个服务时回 `unavailable: true`，那些 chip 就整片不画（其余功能照旧）。
   */
  function refreshRows(): Promise<unknown> {
    if (rowsInflight) return rowsInflight
    var task = Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<SessionStatusesPayload>(CHANNEL, 'session-statuses', {
          args: {},
        })
      })
      .then(function (result) {
        rowsInflight = null
        if (result && result.ok === true && result.value) {
          var byId: Record<string, HudSessionOverviewRow> = {}
          var list = Array.isArray(result.value.sessions) ? result.value.sessions : []
          for (var index = 0; index < list.length; index += 1) {
            var item = list[index]
            if (item && typeof item.sessionId === 'string') byId[item.sessionId] = item
          }
          probe.log('session-statuses', {
            sessions: list.length,
            unavailable: result.value.unavailable === true,
            worktrees: typeof result.value.worktrees === 'number' ? result.value.worktrees : null,
            truncated: result.value.truncated === true,
          })
          set({
            rows: {
              phase: 'ready',
              byId: byId,
              unavailable: result.value.unavailable === true,
              truncated: result.value.truncated === true,
              updatedAt: Date.now(),
            },
          })
          return
        }
        var code = result && result.error && result.error.details ? result.error.details.code : null
        probe.log('session-statuses-failed', { code: code || 'transport' })
        set({
          rows: {
            phase: 'error',
            byId: {},
            unavailable: true,
            truncated: false,
            updatedAt: Date.now(),
          },
        })
      })
      .catch(function () {
        rowsInflight = null
        probe.log('session-statuses-failed', { code: 'transport' })
        set({
          rows: {
            phase: 'error',
            byId: {},
            unavailable: true,
            truncated: false,
            updatedAt: Date.now(),
          },
        })
      })
    rowsInflight = task
    return task
  }

  /** 取本会话的工具活动（正在跑哪个 / 跑过哪些 / 各几次）。 */
  function loadTools(): Promise<unknown> {
    var sessionId = getState().sessionId
    if (!sessionId) return Promise.resolve()
    if (toolsInflight) return toolsInflight
    var task = Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<SessionToolsPayload>(CHANNEL, 'session-tools', {
          args: { sessionId: sessionId },
        })
      })
      .then(function (result) {
        toolsInflight = null
        if (getState().sessionId !== sessionId) return
        if (result && result.ok === true && result.value) {
          var value = result.value
          var active: HudToolActive | null =
            value.active && typeof value.active === 'object' ? value.active : null
          var tools = {
            phase: 'ready',
            active: active,
            recent: Array.isArray(value.recent) ? value.recent : [],
            counts: Array.isArray(value.counts) ? value.counts : [],
            skills: Array.isArray(value.skills) ? value.skills : [],
            skillsDropped: typeof value.skillsDropped === 'number' ? value.skillsDropped : 0,
            total: typeof value.total === 'number' ? value.total : 0,
            updatedAt: Date.now(),
          }
          // 内容没变就不要 set：这个节拍很密（见 TOOLS_POLL_MS），无谓的重渲染会到处都是。
          var previous = getState().tools
          var same =
            previous !== null && previous.active !== null && tools.active !== null
              ? previous.active.callId === tools.active.callId && previous.total === tools.total
              : previous !== null &&
                previous.active === null &&
                tools.active === null &&
                previous.total === tools.total &&
                previous.recent.length === tools.recent.length &&
                (previous.recent.length === 0 || previous.recent[0].at === tools.recent[0].at)
          if (same) return
          probe.log('session-tools', {
            active: tools.active === null ? null : tools.active.name,
            total: tools.total,
            kinds: tools.counts.length,
            // 技能单独露面：排查"技能名有没有记到"时不必再靠猜（这一版新增的字段）。
            skills: tools.skills.length,
          })
          set({ tools: tools })
          return
        }
        var code = result && result.error && result.error.details ? result.error.details.code : null
        probe.log('session-tools-failed', { code: code || 'transport' })
        set({
          tools: {
            phase: 'error',
            active: null,
            recent: [],
            counts: [],
            skills: [],
            skillsDropped: 0,
            total: 0,
            updatedAt: Date.now(),
          },
        })
      })
      .catch(function () {
        toolsInflight = null
        probe.log('session-tools-failed', { code: 'transport' })
        set({
          tools: {
            phase: 'error',
            active: null,
            recent: [],
            counts: [],
            skills: [],
            skillsDropped: 0,
            total: 0,
            updatedAt: Date.now(),
          },
        })
      })
    toolsInflight = task
    return task
  }

  return {
    bindTurns: bindTurns,
    loadTools: loadTools,
    refreshRows: refreshRows,
    unbindTurns: unbindTurns,
  }
}
