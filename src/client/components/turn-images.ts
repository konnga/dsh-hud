/**
 * 轮尾那一行「本轮图片改动」：只列本轮动过的图，点缩略图走内置预览，⇄ 进 hud 看前后对比。
 */

import React from 'react'

import { looksLikeImage } from './image-diff.js'
import type { ImagePairEntry } from './image-diff.js'
import { useStore } from '../hooks/use-store.js'
import type {
  HudChange,
  HudStore,
  ImagePreview,
  ImageRequest,
  SessionChange,
  SessionChangeCandidate,
  SessionChangesState,
  Translate,
} from '../shared.js'
import { h } from '../shared.js'

/**
 * 框架 `useSessions` 快照里本插件用到的会话摘要字段（等 shared 收尾后视需要上提）。
 */
interface TurnSessionSummaryLike {
  cwd?: string | null
}

/** `useSessions` 快照的子集：只用到按 sessionId 索引的那张表。 */
interface TurnSessionsSnapshotLike {
  byId?: Record<string, TurnSessionSummaryLike>
}

/** 框架给座位的选择器 hook：选择器参数是必需的。 */
type TurnUseSessions = <T>(selector: (snapshot: TurnSessionsSnapshotLike) => T) => T

/** 「本轮改过的一张图」：文件、档位（确定/命令旁听）、那条命令与最近触达时刻。 */
export interface TurnImagePick {
  file: string
  name: string
  tier: 'confirmed' | 'possible'
  reason: string
  at: number
}

/** `imageChangesOf()` 的结果：挑出来的条目 + `exact`（标题该说"本轮"还是"本会话"）。 */
export interface TurnImageChanges {
  files: TurnImagePick[]
  exact: boolean
}

/** `TurnImages` 的 props：store + 框架注入的会话/回合信息 + 内置预览的打开函数。 */
export interface TurnImagesProps {
  t: Translate
  store: HudStore
  /** 座位按会话作用域注入的 sessionId。 */
  sessionId?: string | null
  useSessions?: TurnUseSessions | null
  /** 内置右侧文档预览的"打开这个文件"（缩略图点击用）。 */
  openFile?: ((path: string) => void) | null
  /** 槽位给的 TurnLocation（宿主内部形状），只用来取回合号。 */
  turn?: unknown
}

/**
 * 轮尾那条「本轮图片改动」：每项一张缩略图 + 文件名。
 *
 * 内置的改动卡片点一行是打开 review tab（图片在那儿看不见），这条是补上的门：
 * **点缩略图 → 槽位给的 `openFile(path)`**，即内置的右侧文档预览（图片原生渲染、可缩放）；
 * 旁边那个 `⇄` 才打开 dsh-hud 面板看前后两张 —— 前后对比只有我们有。
 */
export function TurnImages(props: TurnImagesProps): React.ReactElement | null {
  var t = props.t
  var store = props.store
  var sessionId = props.sessionId
  var useSessions = props.useSessions
  var openFile = props.openFile
  var turnNumber = turnNumberOf(props.turn)

  // useSessions 是选择器 hook：选择器参数是必需的。
  var sessions =
    typeof useSessions === 'function'
      ? useSessions(function (snapshot) {
          return snapshot
        })
      : null
  var summary =
    typeof sessionId === 'string' && sessions && sessions.byId
      ? sessions.byId[sessionId]
      : undefined
  var cwd = summary ? summary.cwd : undefined

  var state = useStore(store)
  // 缩略图要等字节；缓存本身不在快照里，所以取完自增一下触发重画。
  var tick = React.useState(0)
  var bump = tick[1]

  // 轮尾每个已完成的回合都会挂一次：绑定会话 + 没取过会话改动就取一次（宿主侧是内存读，很便宜）。
  React.useEffect(
    function () {
      if (sessionId === undefined || cwd === undefined) return undefined
      store.bindSession(sessionId, cwd)
      if (state.sessionChanges === undefined || state.sessionChanges.phase === 'idle')
        store.loadSessionChanges()
      return undefined
    },
    [sessionId, cwd],
  )

  var picked = imageChangesOf(state.sessionChanges, turnNumber)
  var shown = picked.files.slice(0, 4)
  var keys = shown
    .map(function (entry) {
      return entry.file
    })
    .join('\u0000')

  React.useEffect(
    function () {
      if (keys === '' || typeof cwd !== 'string') return undefined
      // 闭包里用局部常量保住上面的收窄（`cwd` 是 `var`，TS 在回调里会重新放宽成可空）。
      const cwdOf = cwd
      var cancelled = false
      var wanted: ImageRequest[] = shown
        .map(function (entry) {
          return { cwd: cwdOf, path: entry.file, side: 'worktree' }
        })
        .filter(function (request) {
          return store.cachedImagePair(request) === null
        })
      if (wanted.length === 0) return undefined
      Promise.all(
        wanted.map(function (request) {
          return store.loadImagePair(request)
        }),
      ).then(function () {
        if (!cancelled)
          bump(function (count) {
            return count + 1
          })
      })
      return function () {
        cancelled = true
      }
    },
    [keys, cwd],
  )

  // 会话改动还没到、或这一轮没动过图：整条不渲染（不在每条轮尾留个空壳）。
  if (state.sessionChanges === undefined || state.sessionChanges.phase !== 'ready') return null
  if (shown.length === 0) return null

  var rest = picked.files.length - shown.length

  function chip(entry: TurnImagePick): React.ReactElement {
    var thumb = thumbSideOf(
      typeof cwd === 'string'
        ? store.cachedImagePair({ cwd: cwd, path: entry.file, side: 'worktree' })
        : null,
    )
    var dot = entry.name.lastIndexOf('.')
    var extension = dot > 0 ? entry.name.slice(dot + 1).toUpperCase() : '?'
    // `◐` 是命令旁听来的（猜的）：说清这一点，并把那条命令放进悬停里。
    var hint = entry.file + ' · ' + t('turnImages.open')
    if (entry.tier === 'possible' && entry.reason !== '')
      hint += ' · ' + t('session.possibleTitle', { reason: entry.reason })
    return h(
      'span',
      {
        key: entry.file,
        className: 'dshh-imgstripItem',
        'data-dsh-hud': 'turn-image',
        'data-file': entry.file,
        'data-tier': entry.tier,
      },
      [
        h(
          'button',
          {
            key: 'open',
            type: 'button',
            className: 'dshh-imgstripOpen',
            title: hint,
            onClick: function () {
              if (typeof openFile === 'function') openFile(entry.file)
            },
          },
          [
            thumb === null
              ? h(
                  'span',
                  { key: 'ph', className: 'dshh-imgstripThumb dshh-imgstripThumbEmpty' },
                  extension,
                )
              : h('img', {
                  key: 'img',
                  className: 'dshh-imgstripThumb',
                  alt: entry.name,
                  src: 'data:' + thumb.mime + ';base64,' + String(thumb.base64 || ''),
                }),
            entry.tier === 'possible'
              ? h('span', { key: 'tier', className: 'dshh-imgstripTier', title: hint }, '◐')
              : null,
            h('span', { key: 'name', className: 'dshh-imgstripName' }, entry.name),
          ],
        ),
        h(
          'button',
          {
            key: 'compare',
            type: 'button',
            className: 'dshh-imgstripCompare',
            title: t('turnImages.compare'),
            'data-dsh-hud': 'turn-image-compare',
            onClick: function () {
              // store 边界：这里只知道文件路径，而 `openDiff` 只读 file/path/origFile，按调用契约补形状。
              var change = { file: entry.file, path: entry.file, origFile: null } as HudChange
              store.openPanel(true)
              store.openDiff(change)
            },
          },
          '⇄',
        ),
      ],
    )
  }

  return h('div', { className: 'dshh-imgstrip', 'data-dsh-hud': 'turn-images' }, [
    h(
      'span',
      { key: 'title', className: 'dshh-imgstripTitle' },
      picked.exact ? t('turnImages.title') : t('turnImages.titleSession'),
    ),
    h('span', { key: 'items', className: 'dshh-imgstripItems' }, shown.map(chip)),
    rest > 0
      ? h(
          'span',
          { key: 'more', className: 'dshh-imgstripMore' },
          t('turnImages.more', { n: String(rest) }),
        )
      : null,
  ])
}

/**
 * 从会话改动里挑出"这一轮改过的图片"，最近的在前。
 *
 * **两档都收**：`●` 确定改过（写文件 / 编辑工具）与 `◐` 命令旁听（`>`、`tee`、`cp`、`rm`…）。
 * 只收确定档不够用 —— 图几乎都是脚本/命令产出的（`python gen.py`、`cp`、`curl -o`），
 * 那些永远进不了确定档，而"点一下看图"对它们一样有用。`◐` 是猜的，所以 chip 上带 `◐`、
 * 悬停给出那条命令（措辞与面板里改动清单一致）。
 *
 * 回合号拿不到（`turnNumberOf` 回 null）就不按回合收窄，退回"本会话最近的图片改动"。
 *
 * @returns `{ files, exact }`；`exact` 为 false 表示标题该说"本会话"而不是"本轮"。
 */
export function imageChangesOf(
  changes: SessionChangesState,
  turnNumber: number | null,
): TurnImageChanges {
  if (changes === null || changes === undefined) return { files: [], exact: turnNumber !== null }
  var confirmed: Record<string, SessionChange> = changes.files ? changes.files : {}
  var guessed: Record<string, SessionChangeCandidate> = changes.possible ? changes.possible : {}
  var picked: TurnImagePick[] = []
  var seen: Record<string, true> = {}

  for (var file in confirmed) {
    if (!Object.prototype.hasOwnProperty.call(confirmed, file)) continue
    if (!looksLikeImage(file)) continue
    var record: Partial<SessionChange> = confirmed[file] || {}
    if (turnNumber !== null) {
      var turns = Array.isArray(record.turns) ? record.turns : []
      if (turns.indexOf(turnNumber) < 0 && record.lastTurn !== turnNumber) continue
    }
    seen[file] = true
    picked.push({
      file: file,
      name: baseNameOf(file),
      tier: 'confirmed',
      reason: '',
      at: typeof record.lastAt === 'number' ? record.lastAt : 0,
    })
  }

  for (var guess in guessed) {
    if (!Object.prototype.hasOwnProperty.call(guessed, guess)) continue
    if (seen[guess] === true) continue
    if (!looksLikeImage(guess)) continue
    var item: Partial<SessionChangeCandidate> = guessed[guess] || {}
    // 命令旁听只记"最近一次"的回合号（没有 turns 列表），所以只能按 lastTurn 收窄。
    if (turnNumber !== null && item.lastTurn !== turnNumber) continue
    seen[guess] = true
    picked.push({
      file: guess,
      name: baseNameOf(guess),
      tier: 'possible',
      reason: typeof item.reason === 'string' ? item.reason : '',
      at: typeof item.lastAt === 'number' ? item.lastAt : 0,
    })
  }

  picked.sort(function (left, right) {
    return right.at - left.at
  })
  return { files: picked, exact: turnNumber !== null }
}

/** 缩略图用哪一侧的字节：优先工作区，其次基线（新增/删除时只有一侧有）。 */
export function thumbSideOf(entry: unknown): ImagePreview | null {
  // store 边界：图片缓存条目的形状由 store 的 image 片构造，这里只收窄成声明过的联合。
  var pair =
    entry !== null && entry !== undefined && typeof entry === 'object'
      ? (entry as ImagePairEntry)
      : null
  if (pair === null || pair.phase !== 'ready' || !pair.value) return null
  var value = pair.value
  if (value.after && value.after.kind === 'image') return value.after
  if (value.before && value.before.kind === 'image') return value.before
  return null
}

/**
 * 槽位给的是宿主的 `TurnLocation`。
 *
 * 形状属于宿主内部约定（槽位文档只说"receives the Turn"），所以这里宽松取值：
 * 取不到就回 null，由调用方退到"本会话"的说法，而不是整条不显示。
 */
export function turnNumberOf(turn: unknown): number | null {
  if (typeof turn === 'number' && isFinite(turn)) return turn
  if (turn !== null && turn !== undefined && typeof turn === 'object') {
    // 槽位边界：TurnLocation 的字段形状属于框架内部约定，这里只取用到的 `turn`。
    var record = turn as { turn?: unknown }
    if (typeof record.turn === 'number') return record.turn
  }
  return null
}

/** 只取文件名（chip 上放不下整条路径）。 */
export function baseNameOf(file: string): string {
  var parts = String(file).split('/')
  return parts[parts.length - 1] || String(file)
}
