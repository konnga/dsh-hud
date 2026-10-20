/**
 * 「提交与标签」这一片 store：打开某次提交、看它里面某个文件的差异、标签列表。
 *
 * store 拆分后的一片：读快照走 `getState()`，写状态走 `set()`；跨片依赖走 `helpers`。
 */

import type { HudCommitFile } from '../shared.js'
import type {
  CommitDiffPayload,
  CommitPayload,
  CommitRef,
  CommitsHelpers,
  CommitsSlice,
  GetState,
  LogPayload,
  StoreContext,
  StoreSet,
  TagsPayload,
} from './types.js'

import { CHANNEL, ZOOM_STEPS, probe, readUi, readZoom, sameCommit } from '../shared.js'

export function createCommitsSlice(
  ctx: StoreContext,
  getState: GetState,
  set: StoreSet,
  helpers: CommitsHelpers,
): CommitsSlice {
  /** 提交那几次请求（在途合并）。 */
  var commitInflight: Promise<unknown> | null = null
  /** 提交里某个文件的差异：与工作区差异**分开**合并（拆分前两者共用一个变量，
   *  拆分后留在差异片里，这里再引用就会 ReferenceError）。 */
  var commitDiffInflight: Promise<unknown> | null = null

  /**
   * 打开「某次提交」的视图：先取这次提交的改动清单，再自动打开第一个文件的差异，
   * 这样一次点击就能看到"这次提交改了什么"。
   *
   * 提交是历史事实，取回来就不再变，因此不参与轮询；只有 HEAD 变了它也不受影响
   * （面板显示的是你点的那一次提交）。
   */
  function openCommit(commit: CommitRef): Promise<unknown> {
    if (!getState().cwd || !commit || !commit.sha) return Promise.resolve()
    var cwd = getState().cwd
    var sha = commit.sha

    set({
      commit: {
        phase: 'loading',
        sha: sha,
        shortSha:
          typeof commit.sha === 'string' && commit.sha.length > 7 ? commit.sha.slice(0, 7) : sha,
        subject: commit.subject || '',
        author: commit.author || '',
        date: commit.date || '',
        committedAt: typeof commit.committedAt === 'number' ? commit.committedAt : null,
        refs: commit.refs || [],
        merge: false,
        files: [],
        truncated: false,
        errorCode: null,
      },
      diff: null,
    })

    var task = Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<CommitPayload>(CHANNEL, 'commit', {
          args: { cwd: cwd, sha: sha },
        })
      })
      .then(function (result) {
        commitInflight = null
        var current = getState().commit
        // 期间用户可能已经返回清单、点了别的提交，或换了工作区。
        if (!current || current.sha !== sha || getState().cwd !== cwd) return
        if (result && result.ok === true && result.value) {
          var value = result.value
          var files = Array.isArray(value.files) ? value.files : []
          var meta = value.commit
          if (meta !== null && meta !== undefined) {
            set({
              commit: {
                phase: 'ready',
                sha: meta.sha || sha,
                shortSha: meta.shortSha || sha,
                subject: meta.subject || '',
                author: meta.author || '',
                date: meta.date || '',
                committedAt: typeof meta.committedAt === 'number' ? meta.committedAt : null,
                refs: meta.refs || [],
                merge: meta.merge === true,
                files: files,
                truncated: value.truncated === true,
                errorCode: null,
              },
            })
            // 空提交（或者清单被截断到没内容）就停在左栏，不去开一个空差异。
            // 有内容就顺手打开第一个文件——一次点击就看到"改了什么"；这里把
            // diff 的 promise 交回去，于是 await openCommit 就是等整次点击完成。
            if (files.length > 0) return openCommitDiff(files[0])
            return undefined
          }
        }
        var code = result && result.error && result.error.details ? result.error.details.code : null
        set({
          commit: Object.assign({}, current, {
            phase: 'error',
            files: [],
            errorCode: code || 'git-failed',
          }),
        })
      })
      .catch(function () {
        commitInflight = null
        var current = getState().commit
        if (!current || current.sha !== sha) return
        set({ commit: Object.assign({}, current, { phase: 'error', errorCode: 'transport' }) })
      })

    commitInflight = task
    return task
  }
  /**
   * 打开这次提交里某个文件的差异。与工作区差异共用右栏，但只有一个"侧"
   * （提交相对其父提交），因此工具栏不显示 未暂存/已暂存 两个页签。
   */
  function openCommitDiff(file: HudCommitFile): Promise<unknown> {
    var current = getState().commit
    if (!getState().cwd || !current || !file || !file.file) return Promise.resolve()
    var cwd = getState().cwd
    var sha = current.sha
    var currentDiff = getState().diff
    var wrap = currentDiff ? currentDiff.wrap === true : readUi().wrap === true

    set({
      cursor: file.file,
      diff: {
        source: 'commit',
        phase: 'loading',
        sha: sha,
        shortSha: current.shortSha,
        subject: current.subject,
        path: file.path || file.file,
        file: file.file,
        origPath: file.origFile || null,
        data: null,
        side: 'commit',
        wrap: wrap,
        zoom:
          currentDiff &&
          typeof currentDiff.zoom === 'number' &&
          ZOOM_STEPS.indexOf(currentDiff.zoom) >= 0
            ? currentDiff.zoom
            : readZoom(readUi()),
        hunk: 0,
        collapsed: [],
        errorCode: null,
      },
    })

    var task = Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<CommitDiffPayload>(CHANNEL, 'commit-diff', {
          args: { cwd: cwd, sha: sha, path: file.file, origPath: file.origFile || null },
        })
      })
      .then(function (result) {
        commitDiffInflight = null
        var now = getState().diff
        // 期间可能已经返回清单、点了别的文件，或换了提交。
        if (
          !now ||
          now.source !== 'commit' ||
          now.sha !== sha ||
          now.file !== file.file ||
          getState().cwd !== cwd
        )
          return
        if (result && result.ok === true && result.value) {
          set({
            diff: Object.assign({}, now, { phase: 'ready', data: result.value, errorCode: null }),
          })
          return
        }
        var code = result && result.error && result.error.details ? result.error.details.code : null
        set({
          diff: Object.assign({}, now, {
            phase: 'error',
            data: null,
            errorCode: code || 'git-failed',
          }),
        })
      })
      .catch(function () {
        commitDiffInflight = null
        var now = getState().diff
        if (!now || now.source !== 'commit' || now.file !== file.file) return
        set({ diff: Object.assign({}, now, { phase: 'error', errorCode: 'transport' }) })
      })

    commitDiffInflight = task
    return task
  }
  /**
   * 点最近提交里的一行：打开这次提交的明细；点已经打开的那条则收起。
   * （明细占的是右栏，左栏主面板只是高亮那一行。）
   */
  function toggleCommit(commit: CommitRef): Promise<unknown> | void {
    if (!commit || !commit.sha) return Promise.resolve()
    var openCommitState = getState().commit
    if (openCommitState !== null && sameCommit(commit.sha, openCommitState.sha))
      return closeCommit()
    return openCommit(commit)
  }
  /** 收起提交明细：它带来的差异一起收起来（清单换了，光标也要清）。 */
  function closeCommit(): void {
    if (getState().commit === null) return
    var openDiff = getState().diff
    var keep = openDiff && openDiff.source === 'commit' ? null : openDiff
    set({ commit: null, diff: keep, cursor: null })
  }
  /**
   * 取最近提交。失败只让这一段不显示，不影响面板其余部分——
   * 提交是背景信息，不该抢走「工作区状态」的注意力。
   */
  function loadCommits(cwd: string, oid: string | null): Promise<unknown> {
    return Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<LogPayload>(CHANNEL, 'log', {
          args: { cwd: cwd, count: 10 },
        })
      })
      .then(function (result) {
        if (getState().cwd !== cwd) return
        var commits =
          result && result.ok === true && result.value && Array.isArray(result.value.commits)
            ? result.value.commits
            : []
        set({ commits: commits, commitsOid: oid })
      })
      .catch(function () {
        if (getState().cwd !== cwd) return
        set({ commits: [], commitsOid: oid })
      })
  }
  /** 取标签列表（面板开着时才取）。失败只让这一段不显示。 */
  function loadTags(cwd: string): Promise<unknown> {
    // 10s 新鲜度窗口：面板每 8s 刷新一次，这里避免每次都对 git 跑一遍 for-each-ref；
    // 又能让"刚打的新 tag"在十来秒内出现（HEAD 没动也得看到）。
    if (getState().tags !== null && Date.now() - getState().tagsAt < 10000) return Promise.resolve()
    return Promise.resolve()
      .then(function () {
        return ctx.connection.rpc.call<TagsPayload>(CHANNEL, 'tags', { args: { cwd: cwd } })
      })
      .then(function (result) {
        if (getState().cwd !== cwd) return
        var value = result && result.ok === true ? result.value : null
        var tags = value && Array.isArray(value.tags) ? value.tags : []
        probe.log('tags', {
          count: tags.length,
          truncated: value ? value.truncated === true : false,
        })
        set({
          tags: tags,
          tagsAt: Date.now(),
          tagsTruncated: value ? value.truncated === true : false,
        })
      })
      .catch(function () {
        if (getState().cwd !== cwd) return
        probe.log('tags-failed', { code: 'transport' })
        set({ tags: [], tagsAt: Date.now(), tagsTruncated: false })
      })
  }

  return {
    closeCommit: closeCommit,
    loadCommits: loadCommits,
    loadTags: loadTags,
    openCommit: openCommit,
    openCommitDiff: openCommitDiff,
    toggleCommit: toggleCommit,
  }
}
