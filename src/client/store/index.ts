/**
 * 共享 store 的组装层：自己管状态、订阅、持久化与布局，七片各自管自己的域。
 *
 * 它对外只暴露浏览器半需要的那一套（打开面板 / 差异 / 提交 / 会话列表摘要 / 审阅 …），
 * 每个"片"的入口都只是转发到这个文件外面的小工厂。
 */

import { diffPayload } from '../components/diff-view.js'
import type { HudChange, HudState, HudStore, HudStatus, PanelPos } from '../shared.js'
import {
  CHANNEL,
  COMMIT_LIST_WIDTH,
  COMMIT_MIN_WIDTH,
  DIFF_DEFAULT_WIDTH,
  DIFF_MIN_WIDTH,
  ZOOM_STEPS,
  readReviewed,
  readUi,
  reviewKeyOf,
  visibleChangeRows,
  writeUi,
} from '../shared.js'
import type { StoreContext } from './types.js'
import { createAccountSlice } from './account.js'
import { createProviderSlice } from './provider.js'
import { createAttributionSlice } from './attribution.js'
import { createCommitsSlice } from './commits.js'
import { createDiffSlice } from './diff.js'
import { createImageSlice } from './image.js'
import { createSessionInfoSlice } from './session-info.js'
import { createTipSlice } from './tip.js'
import { createToolsSlice } from './tools.js'
export function createStore(ctx: StoreContext): HudStore {
  var imageSlice = createImageSlice(ctx)
  var ui = readUi()
  var pos: PanelPos | null =
    ui.pos &&
    typeof ui.pos === 'object' &&
    typeof ui.pos.left === 'number' &&
    typeof ui.pos.top === 'number'
      ? { left: ui.pos.left, top: ui.pos.top }
      : null

  var state: HudState = {
    phase: 'idle',
    sessionId: null,
    cwd: null,
    status: null,
    errorCode: null,
    updatedAt: null,
    panelOpen: ui.open === true,
    pos: pos,
    /** 胶囊所在 dock 行的视口顶部坐标：面板据此贴到它上方，而不是用写死的偏移。 */
    anchorTop: null,
    /** 正在查看的差异；`null` 表示面板停在改动清单。 */
    diff: null,
    /**
     * 正在查看的提交（点了「最近提交」里的一行）；`null` 表示左栏是工作区清单。
     * 打开时左栏换成这次提交的改动清单，右栏打开它第一个文件的差异。
     */
    commit: null,
    /**
     * 键盘高亮的那个文件（清单里的 `file`）；`null` 表示还没用键盘选过。
     * 指向 `file` 而不是下标：轮询刷新后清单条目可能增减，下标会指错行。
     */
    cursor: null,
    /** 最近提交；`commitsOid` 记住它是哪个 HEAD 取的，oid 变了才重取。 */
    commits: null,
    commitsOid: null,
    /**
     * 标签列表。与提交不同，**新 tag 可以打在老提交上**（HEAD 不动），所以不能只按 oid 判断；
     * 改用"上次取的时刻"做新鲜度窗口：面板开着时每次刷新都看一眼，但 10s 内不重复问 git。
     */
    tags: null,
    tagsAt: 0,
    tagsTruncated: false,
    /** 差异栏宽度（面板右边缘可拖），持久化。 */
    diffWidth: typeof ui.diffWidth === 'number' ? ui.diffWidth : DIFF_DEFAULT_WIDTH,
    /** 提交明细栏宽度（它与差异栏之间那条抓握可拖），持久化。 */
    commitWidth: typeof ui.commitWidth === 'number' ? ui.commitWidth : COMMIT_LIST_WIDTH,
    /**
     * 会话归因：本会话改过哪些文件（宿主半按 fs 事件记的）。
     *
     * `files` 为 `null` 表示"还没有这份数据"（老宿主 / 还没回来 / 请求失败）——
     * 界面据此不打标记、也不过这个滤。
     */
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
    /** 「只看本会话改的」开关（持久化，跟"自动换行"一样）。 */
    onlySession: ui.onlySession === true,
    /** 「只看最近一轮」开关：把清单收窄到最近这一轮动过的文件。 */
    onlyLatest: ui.onlyLatest === true,
    /** 这一版每个改动文件的签名（`file → signature`）；空表表示"这次没要"。 */
    review: {},
    /**
     * 本会话的工具活动：`active`（正在跑哪个）+ `recent` + 计数。
     *
     * 实时秒数由客户端本地算（`active.startedAt`），不靠把轮询压到亚秒级。
     */
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
    // 会话时长（计时胶囊用）：`{ sessionId, value }`；取数写进快照，渲染那边就是纯函数。
    sessionTime: { sessionId: null, value: null },
    // prompt 历史（输入框 `↑` 召回用）：`{ sessionId, value }`，value 里 prompts 是**新的在前**。
    promptHistory: { sessionId: null, value: null },
    // 账号余额：**账号级**读数（换会话、换工作区都不该让它消失）。`null` = 还没读到 /
    // 没登录 / 这个宿主没有账号能力 —— 三种情况界面一样是"不画这枚胶囊"。
    balance: null,
    // 当前会话模型来源的账本：首帧还不知道是哪个提供方，先按平台账号那一路画。
    provider: { mode: 'unknown', balance: null },
    // 后台凭据设置面板：平时关着，点胶囊（且宿主说"这个站还没配令牌"）时才开。
    tokenPanel: {
      open: false,
      provider: null,
      ref: null,
      supported: true,
      saving: false,
      error: null,
    },
    // 胶囊悬停提示：`{ key, text, rect }` 或 null。**自己画**，不用浏览器原生 tooltip ——
    // 原生那个在真机上按了没反应（试过三种节点/容器查证，都不是被谁挡住），
    // 而它延迟、样式、能否出现我们都控制不了；自己画则位置、换行、颜色全说了算。
    tip: null,
    /** 侧栏行内 chip 要的摘要：一次批量取回，按 sessionId 索引。 */
    rows: { phase: 'idle', byId: {}, unavailable: false, truncated: false, updatedAt: null },
    /**
     * 我审过的版本：`工作区 + NUL + 文件 → { signature, at }`，存在自己的键里
     * （`dsh-hud.reviewed.v1`，不跟界面开关混在一起）。
     */
    reviewed: readReviewed(),
    /**
     * 回合信息（`turnOutline` 投影）：`第 N 轮 → 那一轮的请求预览`。
     *
     * `available: false` 表示这个宿主没有这个投影（或还没读到）——界面这时不提回合，
     * 也绝不因为读不到它影响别的部分。
     */
    turns: { available: false, prompts: {}, latest: null },
  }

  var listeners = new Set<() => void>()
  var inflight: Promise<unknown> | null = null
  /** 会话归因那次请求（在途合并）。 */

  function getSnapshot(): HudState {
    return state
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return function () {
      listeners.delete(listener)
    }
  }

  function emit(): void {
    listeners.forEach(function (listener) {
      listener()
    })
  }

  function set(patch: Partial<HudState>): void {
    state = Object.assign({}, state, patch)
    emit()
  }

  // 悬停提示片：用到 state/set，所以在两者定义之后再组装。
  var tipSlice = createTipSlice(function () {
    return state
  }, set)
  var sessionInfoSlice = createSessionInfoSlice(
    ctx,
    function () {
      return state
    },
    set,
  )
  // 账号余额：软依赖 + 自己的 TTL（它打的是平台网络，不是本地 git）。
  var accountSlice = createAccountSlice(
    ctx,
    function () {
      return state
    },
    set,
  )
  // 当前会话模型来源的余额：按会话取、慢节拍（中转站被轮询会限流）。
  var providerSlice = createProviderSlice(
    ctx,
    function () {
      return state
    },
    set,
  )
  var toolsSlice = createToolsSlice(
    ctx,
    function () {
      return state
    },
    set,
  )
  var commitsSlice = createCommitsSlice(
    ctx,
    function () {
      return state
    },
    set,
    {
      closeDiff: function () {
        return diffSlice.closeDiff()
      },
    },
  )
  var attributionSlice = createAttributionSlice(
    ctx,
    function () {
      return state
    },
    set,
    {
      // 惰性包装：这几样分属工具片与组装层，用包装就不必纠结创建顺序。
      bindTurns: function (sessionId) {
        return toolsSlice.bindTurns(sessionId)
      },
      loadTools: function () {
        return toolsSlice.loadTools()
      },
      refresh: function () {
        return refresh()
      },
      refreshRows: function () {
        return toolsSlice.refreshRows()
      },
      reviewedKeyOf: reviewedKeyOf,
    },
  )
  var diffSlice = createDiffSlice(
    ctx,
    function () {
      return state
    },
    set,
    {
      // 这两样暂住在 store 里（清单选择 / 提交差异），等提交那一片搬走时再挪过去。
      hunkCount: hunkCount,
      openCommitDiff: commitsSlice.openCommitDiff,
      openListEntry: openListEntry,
      persist: persist,
      visibleFiles: visibleFiles,
    },
  )

  function persist(): void {
    var diff = state.diff
    writeUi({
      onlySession: state.onlySession === true,
      onlyLatest: state.onlyLatest === true,
      open: state.panelOpen,
      pos: state.pos,
      wrap: diff ? diff.wrap === true : false,
      zoom:
        diff && typeof diff.zoom === 'number' && ZOOM_STEPS.indexOf(diff.zoom) >= 0
          ? diff.zoom
          : null,
      diffWidth: state.diffWidth,
      commitWidth: state.commitWidth,
    })
  }

  /** 拖动提交栏右边那条抓握时只改内存；松手才落盘。 */
  function setCommitWidth(width: number): void {
    if (typeof width !== 'number' || !Number.isFinite(width)) return
    var next = Math.max(COMMIT_MIN_WIDTH, Math.round(width))
    if (state.commitWidth === next) return
    set({ commitWidth: next })
  }

  /** 拖动右边缘时只改内存；松手才落盘（persistLayout）。 */
  function setDiffWidth(width: number): void {
    if (typeof width !== 'number' || !Number.isFinite(width)) return
    var next = Math.max(DIFF_MIN_WIDTH, Math.round(width))
    if (state.diffWidth === next) return
    set({ diffWidth: next })
  }

  /* --------------------------------------------------- 图片预览（二进制） */

  /**
   * 图片两侧的缓存：键与请求一一对应。
   *
   * 一张图的 base64 可能上兆，所以命中就不重取；条目数有上限（超了整表清空，
   * 和宿主的 `CACHE_MAX_ENTRIES` 同一个思路：宁可少缓存，也不要无界增长）。
   */

  /**
   * 收起右栏。提交明细把差异包在里面，所以它优先整体退掉；
   * 只有工作区差异时才只是关掉差异。
   */
  function closeDetail(): void {
    if (state.commit !== null) return commitsSlice.closeCommit()
    return diffSlice.closeDiff()
  }

  /**
   * 当前能上下选的那份清单：打开提交明细时是这次提交的改动，否则是工作区清单。
   *
   * 清单必须跟视图一致 —— 否则打开着提交明细时按 ↑/↓ 会去动工作区的行，
   * 高亮和打开的文件对不上。
   */
  function visibleFiles(): HudChange[] {
    if (state.commit !== null) {
      return Array.isArray(state.commit.files) ? state.commit.files : []
    }
    // 与面板渲染**共用同一份**过滤结果：过滤只发生在一个地方，↑/↓ 才不会落到看不见的行上。
    return visibleChangeRows(state)
  }

  /** 打开清单里的一条：提交明细打开时走提交差异，否则走工作区差异。 */
  function openListEntry(file: HudChange): Promise<unknown> {
    if (state.commit !== null) return commitsSlice.openCommitDiff(file)
    return diffSlice.openDiff(file)
  }

  /** 当前差异里有几个 hunk —— n / p 的边界就是它。 */
  function hunkCount(): number {
    var payload = diffPayload(state.diff)
    var rows = payload && payload.rows ? payload.rows : []
    var total = 0
    for (var index = 0; index < rows.length; index += 1) {
      if (rows[index].kind === 'hunk') total += 1
    }
    return total
  }

  /**
   * 图片缩放的档位（`null` = 适应宽度）。
   *
   * 放在 store 而不是组件里：一来记住（和"自动换行"一样落盘），二来组件的 hooks
   * 在这个假 React 里驱动不了嵌套状态 —— store 的状态任何位置都读得到。
   */
  function setZoom(value: number | null): void {
    var diff = state.diff
    if (!diff) return
    var next = value === null || ZOOM_STEPS.indexOf(value) >= 0 ? value : null
    set({ diff: Object.assign({}, diff, { zoom: next }) })
    persist()
  }

  /** dock 行的位置变了才写，避免每次测量都触发重渲染。 */
  function setAnchorTop(top: number | null): void {
    if (state.anchorTop === top) return
    set({ anchorTop: top })
  }

  function refresh(): Promise<unknown> {
    // 会话归因跟 status 同一条命（两个都是"当前会话 + 当前工作区"的只读事实）。
    attributionSlice.loadSessionChanges()
    // 工具活动只跟会话有关（没有工作区也该显示"正在跑什么"）。
    toolsSlice.loadTools()
    // 回合投影：会话还没物化时这里会安静地不接，下一次刷新再试。
    toolsSlice.bindTurns(state.sessionId)
    if (!state.cwd) return Promise.resolve()
    if (inflight) return inflight
    var cwd = state.cwd

    set({ phase: state.status ? 'ready' : 'loading' })

    inflight = Promise.resolve()
      .then(function () {
        // 面板打开时才要"这一版"的签名：胶囊那一路不需要，白付一次 stat。
        return ctx.connection.rpc.call<HudStatus>(CHANNEL, 'status', {
          args: { cwd: cwd, review: state.panelOpen === true },
        })
      })
      .then(function (result) {
        inflight = null
        if (state.cwd !== cwd) return
        if (result && result.ok === true) {
          var statusValue = result.value || null
          set({
            phase: 'ready',
            status: statusValue,
            // 送回来的"这一版"签名（没要或没改动就是空表）。
            review:
              statusValue && statusValue.review && typeof statusValue.review === 'object'
                ? statusValue.review
                : {},
            errorCode: null,
            updatedAt: Date.now(),
          })
          // 提交只取一次：面板打开时取，且只有 HEAD 变了（提交过、切分支、拉取）才重取。
          if (
            statusValue &&
            state.panelOpen &&
            (state.commits === null || state.commitsOid !== statusValue.oid)
          ) {
            commitsSlice.loadCommits(cwd, statusValue.oid)
          }
          // 标签与 HEAD 无关（新 tag 可以打在老提交上），所以只要面板开着就问一次（10s 窗口）。
          if (statusValue && state.panelOpen) commitsSlice.loadTags(cwd)
          return
        }
        var code = result && result.error && result.error.details ? result.error.details.code : null
        set({ phase: 'error', errorCode: code || 'git-failed' })
      })
      .catch(function () {
        inflight = null
        if (state.cwd !== cwd) return
        set({ phase: 'error', errorCode: 'transport' })
      })

    return inflight
  }

  /** 审阅存档的键：**按工作区分开**，同一个文件名在别的仓库里是另一码事。 */
  function reviewedKeyOf(file: string): string {
    return reviewKeyOf(state.cwd, file)
  }

  /** 「只看最近一轮」开关：过滤发生在 `visibleChangeRows`（渲染与键盘共用）。 */
  function toggleOnlyLatest(): void {
    set({ onlyLatest: state.onlyLatest !== true })
    persist()
  }

  /** 「只看本会话改的」开关：过滤发生在 `visibleChangeRows`（渲染与键盘共用）。 */
  function toggleOnlySession(): void {
    set({ onlySession: state.onlySession !== true })
    persist()
  }

  function openPanel(open: boolean): void {
    if (state.panelOpen === open) return
    set({ panelOpen: open })
    persist()
    if (open) refresh()
  }

  function togglePanel(): void {
    openPanel(!state.panelOpen)
  }

  /** 拖动过程中的临时位置：只改内存，不写 localStorage。 */
  function movePanel(next: PanelPos): void {
    set({ pos: next })
  }

  /** 松开指针后的位置：落盘。 */
  function commitPanel(next: PanelPos): void {
    set({ pos: next })
    persist()
  }

  function resetPanel(): void {
    set({ pos: null })
    persist()
  }

  return {
    getSnapshot: getSnapshot,
    subscribe: subscribe,
    /**
     * 绑定当前会话（胶囊/turn-images 的 effect 调它）。
     *
     * 绑完之后**立刻**去问"这个会话的模型来源是哪个账本"：早先这一步挂在另一个 effect 里，
     * 而那个 effect 的依赖只有 `sessionId` —— 它先于 `bindSession` 跑，此时 store 里的
     * `sessionId` 还是 `null`，于是 provider 侧永远是 `unknown`（胶囊一直画平台账号余额），
     * 要等五分钟那一次轮询才会纠正。会话一换就顺手问，才是对的时机。
     */
    bindSession: function (sessionId, cwd) {
      var previous = state.sessionId
      attributionSlice.bindSession(sessionId, cwd)
      if (state.sessionId === previous) return
      // 换会话 = 换账本。先把旧读数清掉，再**立刻**问一次新会话的模型来源：
      //   - 不清：新会话会顶着上一个会话的站名和金额，直到新答案回来（那是别人的钱）；
      //   - 不问：要等 30 秒轮询才纠正（用户报过"切了会话还是旧数"）。
      providerSlice.resetForSession()
      if (state.sessionId !== null) providerSlice.loadProviderBalance()
    },
    refresh: refresh,
    openPanel: openPanel,
    togglePanel: togglePanel,
    movePanel: movePanel,
    commitPanel: commitPanel,
    resetPanel: resetPanel,
    setAnchorTop: setAnchorTop,
    setDiffWidth: setDiffWidth,
    setCommitWidth: setCommitWidth,
    persistLayout: persist,
    openDiff: diffSlice.openDiff,
    loadImagePair: imageSlice.loadImagePair,
    cachedImagePair: imageSlice.cachedImagePair,
    loadSessionChanges: attributionSlice.loadSessionChanges,
    loadSessionTime: sessionInfoSlice.loadSessionTime,
    loadPromptHistory: sessionInfoSlice.loadPromptHistory,
    loadBalance: accountSlice.loadBalance,
    resetForSession: providerSlice.resetForSession,
    loadProviderBalance: providerSlice.loadProviderBalance,
    openTokenPanel: providerSlice.openTokenPanel,
    closeTokenPanel: providerSlice.closeTokenPanel,
    saveProviderToken: providerSlice.saveProviderToken,
    showTip: tipSlice.showTip,
    hideTip: tipSlice.hideTip,
    tipHandlers: tipSlice.tipHandlers,
    closeDiff: diffSlice.closeDiff,
    closeDetail: closeDetail,
    setDiffSide: diffSlice.setDiffSide,
    toggleDiffWrap: diffSlice.toggleDiffWrap,
    setZoom: setZoom,
    openCommit: commitsSlice.openCommit,
    openCommitDiff: commitsSlice.openCommitDiff,
    toggleCommit: commitsSlice.toggleCommit,
    closeCommit: commitsSlice.closeCommit,
    stepFile: diffSlice.stepFile,
    openCursor: diffSlice.openCursor,
    stepHunk: diffSlice.stepHunk,
    toggleHunk: diffSlice.toggleHunk,
    toggleOnlySession: toggleOnlySession,
    toggleOnlyLatest: toggleOnlyLatest,
    refreshRows: toolsSlice.refreshRows,
    loadTools: toolsSlice.loadTools,
    toggleReviewed: attributionSlice.toggleReviewed,
    clearReviewed: attributionSlice.clearReviewed,
  }
}
