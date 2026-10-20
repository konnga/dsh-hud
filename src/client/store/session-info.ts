/**
 * 「会话信息」这一片 store：会话运行时长（3 秒 / 60 秒两档 TTL）与 prompt 历史。
 *
 * store 拆分后的一片：读快照走 `getState()`，写状态走 `set()`（由 `createStore` 注入）。
 */

import type { HudPromptHistory, HudSessionTime } from '../shared.js'
import type { GetState, SessionInfoSlice, StoreContext, StoreSet } from './types.js'

import { CHANNEL, PROMPT_HISTORY_MAX } from '../shared.js'

export function createSessionInfoSlice(
  ctx: StoreContext,
  getState: GetState,
  set: StoreSet,
): SessionInfoSlice {
  /**
   * 会话运行时长的缓存：每分钟最多问一次（统计数字不需要更密），同会话复用。
   *
   * 与图片那种"重"缓存分开存：这个条目只有几十字节，TTL 到期直接覆盖。
   */
  var sessionTimes = new Map<string, { at: number; value: HudSessionTime }>()
  /** 拿到数的缓存时长。 */
  var SESSION_TIME_TTL_MS = 60000
  /**
   * **没拿到**时的重问间隔。
   *
   * 会话是异步恢复到宿主 `sessions` 存储里的：重启后头几百毫秒问 `session-time` 得到的是
   * "这个会话还不存在"（实测启动 0.6 秒时 live=0，30 秒后才 live=1）。
   * 把这种答案按 60 秒缓存，就会让计时胶囊在你重启后一两分钟才出现 —— 所以负面结果只记 3 秒。
   */
  var SESSION_TIME_RETRY_MS = 3000
  /** 取一个会话的运行时长（含内置 `sessionStats` 的累计数字）；拿不到回 `available: false`。 */
  function loadSessionTime(sessionId: string): Promise<HudSessionTime> {
    if (typeof sessionId !== 'string' || sessionId === '')
      return Promise.resolve({ available: false })
    var cached = sessionTimes.get(sessionId)
    if (cached !== undefined) {
      var ttl =
        cached.value && cached.value.available === true
          ? SESSION_TIME_TTL_MS
          : SESSION_TIME_RETRY_MS
      if (Date.now() - cached.at < ttl) return Promise.resolve(cached.value)
    }
    return Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<HudSessionTime>(CHANNEL, 'session-time', {
          args: { sessionId: sessionId },
        })
      })
      .then(function (result) {
        var value: HudSessionTime =
          result && result.ok === true && result.value
            ? result.value
            : { available: false, sessionId: sessionId }
        if (sessionTimes.size >= 16) sessionTimes.clear()
        sessionTimes.set(sessionId, { at: Date.now(), value: value })
        var previous: HudSessionTime | null =
          getState().sessionTime && getState().sessionTime.sessionId === sessionId
            ? getState().sessionTime.value
            : null
        // 深度比较没必要：这两个字段（会话创建时刻 + 累计墙钟）就是整份值里会变的部分。
        var same =
          previous !== null &&
          previous.available === value.available &&
          previous.createdAt === value.createdAt &&
          previous.llmMs === value.llmMs &&
          previous.toolMs === value.toolMs &&
          previous.turns === value.turns &&
          previous.steps === value.steps
        if (!same) set({ sessionTime: { sessionId: sessionId, value: value } })
        return value
      })
      .catch(function () {
        return { available: false, sessionId: sessionId }
      })
  }
  /**
   * prompt 历史：宿主从内置 `turnOutline` 投影里取，比客户端自己记一份可靠得多
   * （分页、压实、重启、换设备都不影响）。prompt 只在"一整轮发出去"之后才会变，
   * 所以 5 秒 TTL 足够，而且顺手把值写进快照 —— 按键那侧只读快照，不必再 await。
   */
  var promptHistories = new Map<string, { at: number; value: HudPromptHistory }>()
  var PROMPT_HISTORY_TTL_MS = 5000

  function loadPromptHistory(sessionId: string): Promise<HudPromptHistory> {
    if (typeof sessionId !== 'string' || sessionId === '')
      return Promise.resolve({ available: false, prompts: [] })
    var cached = promptHistories.get(sessionId)
    if (cached !== undefined && Date.now() - cached.at < PROMPT_HISTORY_TTL_MS)
      return Promise.resolve(cached.value)
    return Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<HudPromptHistory>(CHANNEL, 'prompt-history', {
          args: { sessionId: sessionId, limit: PROMPT_HISTORY_MAX },
        })
      })
      .then(function (result) {
        var value: HudPromptHistory =
          result && result.ok === true && result.value
            ? result.value
            : { available: false, sessionId: sessionId, prompts: [] }
        if (promptHistories.size >= 16) promptHistories.clear()
        promptHistories.set(sessionId, { at: Date.now(), value: value })
        var previous: HudPromptHistory | null =
          getState().promptHistory && getState().promptHistory.sessionId === sessionId
            ? getState().promptHistory.value
            : null
        var same =
          previous !== null &&
          previous.available === value.available &&
          (previous.prompts || []).length === (value.prompts || []).length &&
          (previous.prompts || []).every(function (item, index) {
            return item === value.prompts[index]
          })
        if (!same) set({ promptHistory: { sessionId: sessionId, value: value } })
        return value
      })
      .catch(function () {
        return { available: false, sessionId: sessionId, prompts: [] }
      })
  }

  return { loadPromptHistory: loadPromptHistory, loadSessionTime: loadSessionTime }
}
