/**
 * 「差异视图」这一片 store：打开哪份差异、页签、换行，清单里上下走与 hunk 折叠。
 *
 * store 拆分后的一片：读快照走 `getState()`，写状态走 `set()`；跨片依赖走 `helpers`。
 */

import type { HudChange, WorktreeDiffPayload } from '../shared.js'
import type { DiffHelpers, DiffSlice, GetState, StoreContext, StoreSet } from './types.js'

import { CHANNEL, ZOOM_STEPS, readUi, readZoom } from '../shared.js'

export function createDiffSlice(
  ctx: StoreContext,
  getState: GetState,
  set: StoreSet,
  helpers: DiffHelpers,
): DiffSlice {
  /** 差异那次请求（在途合并）。 */
  var diffInflight: Promise<unknown> | null = null

  /**
   * 打开一个改动文件的差异视图：一次取回**两侧**的 rows，
   * 默认落在有内容的那一侧（工作区优先），页签切换因此不需要再发请求。
   */
  function openDiff(change: HudChange): Promise<unknown> {
    if (!getState().cwd || !change || !change.file) return Promise.resolve()
    var cwd = getState().cwd
    var currentDiff = getState().diff
    var wrap = currentDiff ? currentDiff.wrap === true : readUi().wrap === true
    var zoom =
      currentDiff &&
      typeof currentDiff.zoom === 'number' &&
      ZOOM_STEPS.indexOf(currentDiff.zoom) >= 0
        ? currentDiff.zoom
        : readZoom(readUi())
    set({
      // 工作区差异与「某次提交的明细」是互斥的两种右栏内容，换过去就收起明细。
      commit: null,
      cursor: change.file,
      diff: {
        source: 'worktree',
        phase: 'loading',
        path: change.path,
        file: change.file,
        origPath: change.origFile || null,
        data: null,
        side: 'worktree',
        wrap: wrap,
        zoom: zoom,
        hunk: 0,
        collapsed: [],
        errorCode: null,
      },
    })

    var task = Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<WorktreeDiffPayload>(CHANNEL, 'diff', {
          args: { cwd: cwd, path: change.file, origPath: change.origFile || null },
        })
      })
      .then(function (result) {
        diffInflight = null
        var current = getState().diff
        // 期间用户可能已经返回清单或换了文件。
        if (!current || current.file !== change.file || getState().cwd !== cwd) return
        if (result && result.ok === true && result.value) {
          var value = result.value
          var worktreeRows = value.worktree && value.worktree.rows ? value.worktree.rows.length : 0
          var indexRows = value.index && value.index.rows ? value.index.rows.length : 0
          set({
            diff: {
              source: 'worktree',
              phase: 'ready',
              path: change.path,
              file: change.file,
              origPath: change.origFile || null,
              data: value,
              side: worktreeRows > 0 || indexRows === 0 ? 'worktree' : 'index',
              wrap: current.wrap,
              zoom: current.zoom,
              hunk: 0,
              collapsed: [],
              errorCode: null,
            },
          })
          return
        }
        var code = result && result.error && result.error.details ? result.error.details.code : null
        set({
          diff: {
            source: 'worktree',
            phase: 'error',
            path: change.path,
            file: change.file,
            origPath: change.origFile || null,
            data: null,
            side: 'worktree',
            wrap: current.wrap,
            errorCode: code || 'git-failed',
          },
        })
      })
      .catch(function () {
        diffInflight = null
        var current = getState().diff
        if (!current || current.file !== change.file) return
        set({ diff: Object.assign({}, current, { phase: 'error', errorCode: 'transport' }) })
      })

    // 到这里 task 一定已被赋值；先挂进在途合并变量再返回（返回类型才不是可空的）。
    diffInflight = task
    return task
  }
  function closeDiff(): void {
    if (getState().diff === null) return
    set({ diff: null })
  }
  function setDiffSide(side: string): void {
    var diff = getState().diff
    if (!diff || diff.source === 'commit' || (side !== 'worktree' && side !== 'index')) return
    // 换侧等于换了一份 rows：hunk 序号与折叠状态都不再对应得上。
    set({ diff: Object.assign({}, diff, { side: side, hunk: 0, collapsed: [] }) })
  }
  /**
   * 在当前清单里上下移动一格（↑/↓ 只移动；`[`/`]` 移动并直接打开）。
   *
   * 还没选过时：向下从第一条开始，向上从最后一条开始 —— 这样 ↑ 和 ↓ 都能
   * "先落在一个合理的位置上"，不需要用户先点一行。
   *
   * @param delta - 1 向下、-1 向上。
   * @param open - 移动后是否立刻打开。
   * @returns 选中的那条，清单为空时返回 null。
   */
  function stepFile(delta: number, open: boolean): HudChange | null {
    var list = helpers.visibleFiles()
    if (list.length === 0) return null

    var index = -1
    for (var cursor = 0; cursor < list.length; cursor += 1) {
      if (list[cursor].file === getState().cursor) {
        index = cursor
        break
      }
    }

    var next =
      index === -1
        ? delta > 0
          ? 0
          : list.length - 1
        : Math.min(Math.max(0, index + delta), list.length - 1)
    var entry = list[next]
    if (!entry || !entry.file) return null

    set({ cursor: entry.file })
    if (open) helpers.openListEntry(entry)
    return entry
  }
  /** Enter：打开键盘选中的那条；还没选过就打开第一条。 */
  function openCursor(): HudChange | null {
    var list = helpers.visibleFiles()
    if (list.length === 0) return null
    for (var index = 0; index < list.length; index += 1) {
      if (list[index].file === getState().cursor) {
        helpers.openListEntry(list[index])
        return list[index]
      }
    }
    return stepFile(1, true)
  }
  /**
   * n / p：跳到下一个 / 上一个 hunk。跳到折叠着的 hunk 会顺手展开它 ——
   * 不然按键看起来什么都没发生。
   */
  function stepHunk(delta: number): void {
    var diff = getState().diff
    if (!diff) return
    var total = helpers.hunkCount()
    if (total === 0) return
    var current = typeof diff.hunk === 'number' ? diff.hunk : 0
    var next = Math.min(Math.max(0, current + delta), total - 1)
    var collapsed = (diff.collapsed || []).filter(function (index) {
      return index !== next
    })
    set({ diff: Object.assign({}, diff, { hunk: next, collapsed: collapsed }) })
  }
  /** 折叠 / 展开一个 hunk（点 hunk 头，或 Space 作用于当前 hunk）。 */
  function toggleHunk(index: number | undefined): void {
    var diff = getState().diff
    if (!diff || typeof index !== 'number' || index < 0) return
    var collapsed = diff.collapsed || []
    var next =
      collapsed.indexOf(index) >= 0
        ? collapsed.filter(function (item) {
            return item !== index
          })
        : collapsed.concat([index])
    set({ diff: Object.assign({}, diff, { hunk: index, collapsed: next }) })
  }
  function toggleDiffWrap(): void {
    var diff = getState().diff
    if (!diff) return
    set({ diff: Object.assign({}, diff, { wrap: diff.wrap !== true }) })
    helpers.persist()
  }

  return {
    closeDiff: closeDiff,
    openCursor: openCursor,
    openDiff: openDiff,
    setDiffSide: setDiffSide,
    stepFile: stepFile,
    stepHunk: stepHunk,
    toggleDiffWrap: toggleDiffWrap,
    toggleHunk: toggleHunk,
  }
}
