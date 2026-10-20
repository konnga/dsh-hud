/**
 * 「会话归因与审阅」这一片 store：本会话改过哪些文件、哪些标记为已审阅。
 *
 * store 拆分后的一片：读快照走 `getState()`，写状态走 `set()`；
 * 跨片与 store 内部依赖走 `helpers`（由 `createStore` 组装时注入）。
 */

import type { ReviewedMap, SessionChange, SessionChangeCandidate } from '../shared.js'
import type {
  AttributionHelpers,
  AttributionSlice,
  GetState,
  SessionChangesPayload,
  StoreContext,
  StoreSet,
} from './types.js'

import { CHANNEL, probe, reviewKeyOf, writeReviewed } from '../shared.js'

export function createAttributionSlice(
  ctx: StoreContext,
  getState: GetState,
  set: StoreSet,
  helpers: AttributionHelpers,
): AttributionSlice {
  /** 会话归因那次请求（在途合并）。 */
  var sessionInflight: Promise<unknown> | null = null

  /** 胶囊调用：把当前会话的工作区写进 store，变了才重新取数。 */
  function bindSession(sessionId: string | null | undefined, cwd: string | null | undefined): void {
    if (getState().sessionId === sessionId && getState().cwd === (cwd || null)) return
    set({
      sessionId: sessionId === undefined ? null : sessionId,
      cwd: cwd || null,
      status: null,
      errorCode: null,
      commits: null,
      commitsOid: null,
      tags: null,
      tagsAt: 0,
      tagsTruncated: false,
      // 差异与提交明细都绑定在某个工作区上：换了工作区就把它们收起，
      // 否则会显示另一个仓库的文件或提交。键盘光标同理，它指向的是清单里的行。
      diff: null,
      commit: null,
      cursor: null,
      phase: cwd ? 'loading' : 'idle',
    })
    // 工具活动同理：换会话就清空，别显示上一个会话正在跑的工具。
    set({
      tools: {
        phase: 'idle',
        active: null,
        recent: [],
        counts: [],
        skills: [],
        skillsDropped: 0,
        total: 0,
        updatedAt: null,
      },
    })
    // 归因是"这个会话"的事实：换会话就先清空，别把上一个会话的标记留在新会话的清单上。
    set({
      sessionChanges: {
        phase: 'idle',
        files: null,
        possible: null,
        commands: [],
        since: null,
        dropped: 0,
        possibleDropped: 0,
        errorCode: null,
      },
    })
    // 回合信息同理：换会话就按新会话重新接（旧的先解掉）。
    helpers.bindTurns(sessionId)
    helpers.refresh()
  }
  /**
   * 取"本会话改过哪些文件"。
   *
   * 与 `status` 同一条命：状态刷新时顺带取一次（都是本进程内的读，很便宜）。失败就保持
   * `files: null`（界面不打标记、也不过这个滤），不会挡住 git 那半边。
   */
  function loadSessionChanges(): Promise<unknown> {
    var cwd = getState().cwd
    var sessionId = getState().sessionId
    if (!cwd || !sessionId) return Promise.resolve()
    if (sessionInflight) return sessionInflight
    if (getState().sessionChanges.phase === 'idle')
      set({ sessionChanges: Object.assign({}, getState().sessionChanges, { phase: 'loading' }) })

    var task = Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<SessionChangesPayload>(CHANNEL, 'session-changes', {
          args: { cwd: cwd, sessionId: sessionId },
        })
      })
      .then(function (result) {
        sessionInflight = null
        if (getState().cwd !== cwd || getState().sessionId !== sessionId) return
        if (result && result.ok === true && result.value && result.value.cwdMismatch === true) {
          probe.log('session-changes', { cwdMismatch: true })
        }
        if (result && result.ok === true && result.value && result.value.cwdMismatch !== true) {
          var files: Record<string, SessionChange> = {}
          var list = Array.isArray(result.value.files) ? result.value.files : []
          for (var index = 0; index < list.length; index += 1) {
            var item = list[index]
            if (item && typeof item.file === 'string' && item.file !== '') files[item.file] = item
          }
          var possible: Record<string, SessionChangeCandidate> = {}
          var possibleList = Array.isArray(result.value.possible) ? result.value.possible : []
          for (var pIndex = 0; pIndex < possibleList.length; pIndex += 1) {
            var possibleItem = possibleList[pIndex]
            if (possibleItem && typeof possibleItem.file === 'string' && possibleItem.file !== '') {
              possible[possibleItem.file] = possibleItem
            }
          }
          var since = typeof result.value.since === 'number' ? result.value.since : null
          var dropped = typeof result.value.dropped === 'number' ? result.value.dropped : 0
          probe.log('session-changes', {
            files: Object.keys(files).length,
            possible: Object.keys(possible).length,
            commands: Array.isArray(result.value.commands) ? result.value.commands.length : 0,
            dropped: dropped,
            since: since === null ? null : new Date(since).toISOString(),
          })
          set({
            sessionChanges: {
              phase: 'ready',
              files: files,
              possible: possible,
              commands: Array.isArray(result.value.commands) ? result.value.commands : [],
              since: since,
              dropped: dropped,
              possibleDropped:
                typeof result.value.possibleDropped === 'number' ? result.value.possibleDropped : 0,
              errorCode: null,
            },
          })
          return
        }
        var code = result && result.error && result.error.details ? result.error.details.code : null
        probe.log('session-changes-failed', { code: code || 'transport' })
        set({
          sessionChanges: {
            phase: 'error',
            files: null,
            possible: null,
            commands: [],
            since: null,
            dropped: 0,
            possibleDropped: 0,
            errorCode: code || 'transport',
          },
        })
      })
      .catch(function () {
        sessionInflight = null
        if (getState().cwd !== cwd) return
        probe.log('session-changes-failed', { code: 'transport' })
        set({
          sessionChanges: {
            phase: 'error',
            files: null,
            possible: null,
            commands: [],
            since: null,
            dropped: 0,
            possibleDropped: 0,
            errorCode: 'transport',
          },
        })
      })

    sessionInflight = task
    return task
  }
  /**
   * 标记 / 取消"这个文件的这一版我审过了"。
   *
   * 签名用的是**当前**这一版（宿主 stat 出来的 size+mtimeMs）：下次改动一落盘签名就变，
   * 标记自动降级成"改动已变，需要重看" —— 而不是继续冒充"已审"。
   */
  function toggleReviewed(file: string): void {
    if (typeof file !== 'string' || file.length === 0) return
    var signature = getState().review ? getState().review[file] : undefined
    if (typeof signature !== 'string') {
      probe.log('review-no-signature', { file: file })
      return
    }
    var next: ReviewedMap = {}
    for (var key in getState().reviewed)
      if (Object.prototype.hasOwnProperty.call(getState().reviewed, key))
        next[key] = getState().reviewed[key]
    var markKey = helpers.reviewedKeyOf(file)
    if (next[markKey] !== undefined && next[markKey].signature === signature) delete next[markKey]
    else next[markKey] = { signature: signature, at: Date.now() }
    set({ reviewed: writeReviewed(next) })
  }

  /** 清掉**当前工作区**的全部"已审"标记（别的仓库不动）。 */
  function clearReviewed(): void {
    var prefix = reviewKeyOf(getState().cwd, '')
    var next: ReviewedMap = {}
    var removed = 0
    for (var key in getState().reviewed) {
      if (!Object.prototype.hasOwnProperty.call(getState().reviewed, key)) continue
      if (key.indexOf(prefix) === 0) {
        removed += 1
        continue
      }
      next[key] = getState().reviewed[key]
    }
    if (removed === 0) return
    set({ reviewed: writeReviewed(next) })
  }

  return {
    bindSession: bindSession,
    clearReviewed: clearReviewed,
    loadSessionChanges: loadSessionChanges,
    toggleReviewed: toggleReviewed,
  }
}
