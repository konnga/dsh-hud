/**
 * 图片改动的前后对比：两侧缩略、尺寸与字节数、可缩放，认不出的二进制退回一句话说明。
 */

import React from 'react'

import { errorText } from '../format.js'
import type {
  HudDiffState,
  HudStore,
  ImagePayload,
  ImageRequest,
  ImageSide,
  Translate,
} from '../shared.js'
import { IMAGE_FILE_EXTENSIONS, formatBytes, h, imagePairKey, stepZoom } from '../shared.js'

/**
 * `image` 端点在 store 缓存里的条目（store 的 image 片写进 `Map` 的那个形状）。
 *
 * 它同时被 image-diff 与本目录的 turn-images 消费；先放在这里（等 shared 收尾后视需要上提）。
 */
export interface ImagePairEntry {
  phase: string
  value?: ImagePayload
  code?: string | null
}

/** 图片请求失败/成功的一侧标签对。 */
export interface ImageLabels {
  before: string
  after: string
}

/** 图片并排/切换时的一格。 */
interface ImageCell {
  key: string
  label: string
  side: ImageSide
}

/** `ImageDiff` 的 props：差异状态（二进制改动才有它）+ store + 工作区（发请求要用）。 */
export interface ImageDiffProps {
  t: Translate
  store: HudStore
  diff: HudDiffState
  /** 会话工作区；没有它就没法发 `image` 请求（文本 diff 也用不到）。 */
  cwd?: string | null
}

/**
 * 二进制（图片）改动的预览：并排两张图，或按需在两张之间切换。
 *
 * 只在文本 diff 报 `binary` 时挂上来。字节来自宿主的 `image` 端点（只读），
 * 这里只负责画：单侧画不出来就画那一侧的原因，两侧都不行才退回原来那句话。
 */
export function ImageDiff(props: ImageDiffProps) {
  var t = props.t
  var store = props.store
  var diff = props.diff
  var request = imageRequest(diff, props.cwd)
  var key = request === null ? null : imagePairKey(request)
  // 先同步看缓存：已经取过的图第一帧就画出来，不闪"读取图片…"。
  var viewRef = React.useState<ImagePairEntry | null>(function () {
    return request !== null && store.cachedImagePair
      ? asPairEntry(store.cachedImagePair(request))
      : null
  })
  var modeRef = React.useState<'pair' | 'flip'>('pair')
  var flipRef = React.useState<'after' | 'before'>('after')

  React.useEffect(
    function () {
      if (request === null || key === null) return undefined
      var cancelled = false
      var cached = store.cachedImagePair ? asPairEntry(store.cachedImagePair(request)) : null
      if (cached !== null) {
        viewRef[1](cached)
        return undefined
      }
      viewRef[1](null)
      store.loadImagePair(request).then(function (entry) {
        if (!cancelled) viewRef[1](asPairEntry(entry))
      })
      return function () {
        cancelled = true
      }
    },
    [key],
  )

  if (key === null)
    return h('div', { className: 'dshh-empty', 'data-dsh-hud': 'image' }, t('diff.binary'))

  var view = viewRef[0]
  if (view === null)
    return h('div', { className: 'dshh-empty', 'data-dsh-hud': 'image' }, t('image.loading'))
  if (view.phase === 'error')
    return h('div', { className: 'dshh-empty', 'data-dsh-hud': 'image' }, errorText(view.code, t))

  var value: Partial<ImagePayload> = view.value || {}
  var before: ImageSide = value.before || { kind: 'missing' }
  var after: ImageSide = value.after || { kind: 'missing' }
  if (before.kind !== 'image' && after.kind !== 'image') {
    return h(
      'div',
      { className: 'dshh-empty', 'data-dsh-hud': 'image' },
      imageFallbackText(t, before, after),
    )
  }

  var labels = imageLabels(diff, t)
  var mode = modeRef[0]
  var flip = flipRef[0]
  // 缩放住在 store 里（和"自动换行"一样记住）：`null` = 适应宽度，数字 = 固定档位。
  var zoom = diff.zoom === undefined ? null : diff.zoom
  var cells: ImageCell[] =
    mode === 'pair'
      ? [
          { key: 'before', label: labels.before, side: before },
          { key: 'after', label: labels.after, side: after },
        ]
      : [
          {
            key: flip,
            label: flip === 'after' ? labels.after : labels.before,
            side: flip === 'after' ? after : before,
          },
        ]

  function cell(entry: ImageCell): React.ReactElement {
    var side = entry.side
    var body =
      side.kind === 'image'
        ? h('img', {
            className: 'dshh-img',
            alt: entry.label,
            // 缩放：适应宽度交给 CSS（`max-width:100%`）；固定档位按**固有像素**算宽度，
            // 因为宿主已经把宽高一起给我们了 —— 不用等图片加载就能算对。
            style:
              zoom === null || typeof side.width !== 'number'
                ? undefined
                : { width: Math.round(side.width * zoom) + 'px', maxWidth: 'none' },
            src: 'data:' + side.mime + ';base64,' + String(side.base64 || ''),
          })
        : h('div', { className: 'dshh-imgNote' }, sideReasonText(side, t))
    return h(
      'div',
      { className: 'dshh-imgCell', key: entry.key },
      h('div', { className: 'dshh-imgLabel' }, entry.label),
      body,
    )
  }

  function tab(id: 'pair' | 'flip', label: string): React.ReactElement {
    var active = mode === id
    return h(
      'button',
      {
        type: 'button',
        className: 'dshh-tab' + (active ? ' dshh-tabActive' : ''),
        'aria-pressed': active ? 'true' : 'false',
        onClick: function () {
          modeRef[1](id)
        },
      },
      label,
    )
  }

  // 尺寸变了才是这张图最值得一眼看到的信息（改图最常见的就是换尺寸）。
  var dimsChanged =
    before.kind === 'image' &&
    after.kind === 'image' &&
    typeof before.width === 'number' &&
    typeof after.width === 'number' &&
    (before.width !== after.width || before.height !== after.height)
      ? h(
          'span',
          { className: 'dshh-imgDims' },
          t('image.dimsChanged', {
            from: t('image.dims', { w: String(before.width), h: String(before.height) }),
            to: t('image.dims', { w: String(after.width), h: String(after.height) }),
          }),
        )
      : null
  var bytes =
    before.kind === 'image' && after.kind === 'image'
      ? h(
          'span',
          { className: 'dshh-imgBytes' },
          formatBytes(before.bytes) + ' → ' + formatBytes(after.bytes),
        )
      : null

  // 缩放按钮：内置那个文档预览把缩放藏在"预览区底部 72px 的悬停感应带"里
  // （CSS 默认 opacity:0，还得 Ctrl+滚轮），这里给一排看得见、点的着的。
  var zoomControls = h('span', { className: 'dshh-imgZoom', 'data-dsh-hud': 'image-zoom' }, [
    h(
      'button',
      {
        key: 'out',
        type: 'button',
        className: 'dshh-imgZoomBtn',
        title: t('image.zoomOut'),
        'data-dsh-hud': 'image-zoom-out',
        onClick: function () {
          store.setZoom(stepZoom(zoom, -1))
        },
      },
      '−',
    ),
    h(
      'button',
      {
        key: 'value',
        type: 'button',
        className: 'dshh-imgZoomBtn dshh-imgZoomValue',
        title: t('image.fitWidth'),
        'data-dsh-hud': 'image-zoom-value',
        onClick: function () {
          store.setZoom(null)
        },
      },
      zoom === null
        ? t('image.fitWidth')
        : t('image.zoomValue', { percent: String(Math.round(zoom * 100)) }),
    ),
    h(
      'button',
      {
        key: 'in',
        type: 'button',
        className: 'dshh-imgZoomBtn',
        title: t('image.zoomIn'),
        'data-dsh-hud': 'image-zoom-in',
        onClick: function () {
          store.setZoom(stepZoom(zoom, 1))
        },
      },
      '＋',
    ),
  ])

  return h(
    'div',
    { className: 'dshh-imgWrap', 'data-dsh-hud': 'image' },
    h(
      'div',
      { className: 'dshh-imgMeta' },
      tab('pair', t('image.pair')),
      mode === 'flip'
        ? h(
            'button',
            {
              type: 'button',
              className: 'dshh-tab',
              title: t('image.flip'),
              'data-dsh-hud': 'image-flip',
              onClick: function () {
                flipRef[1](flip === 'after' ? 'before' : 'after')
              },
            },
            t('image.flip'),
          )
        : null,
      zoomControls,
      dimsChanged,
      bytes,
    ),
    h(
      'div',
      {
        className:
          'dshh-imgPair' +
          (mode === 'flip' ? ' dshh-imgPairSingle' : '') +
          (zoom === null ? '' : ' dshh-imgPairZoomed'),
      },
      cells.map(cell),
    ),
  )
}

/**
 * 差异视图：两侧页签（宿主半一次把两侧都取回来了，切页签不再发请求）、
 * 自动换行、复制差异。全部只读——它只是把 git 的输出画出来。
 */
/* ------------------------------------------------ 图片预览（二进制改动） */

/**
 * 由 diff 状态推出 `image` 请求；推不出（没有 cwd / 文件）返回 null。
 *
 * 页签语义与文本 diff 完全一致：未暂存看「索引 → 工作区」，已暂存看「HEAD → 索引」，
 * 提交明细按 sha 取，所以两个视图里"未暂存 / 已暂存"指的是同一件事。
 */
export function imageRequest(
  diff: HudDiffState | null | undefined,
  cwd: string | null | undefined,
): ImageRequest | null {
  if (!diff || !diff.file || !cwd) return null
  var request: ImageRequest = { cwd: cwd, path: diff.file }
  if (diff.origPath) request.origPath = diff.origPath
  if (diff.source === 'commit' && diff.sha) request.sha = diff.sha
  else request.side = diff.side === 'index' ? 'index' : 'worktree'
  return request
}

/** 两侧的标签跟着"看的到底是哪两条记录"走。 */
export function imageLabels(diff: HudDiffState, t: Translate): ImageLabels {
  if (diff.source === 'commit')
    return { before: t('image.beforeCommit'), after: t('image.afterCommit') }
  if (diff.side === 'index') return { before: t('image.beforeIndex'), after: t('image.afterIndex') }
  return { before: t('image.beforeWorktree'), after: t('image.afterWorktree') }
}

/** 一侧画不出来时的原因文案（每一侧各有各的原因）。 */
export function sideReasonText(side: ImageSide, t: Translate): string {
  if (side.kind === 'too-large') {
    return t('image.tooLarge', {
      limit: String(Math.round((typeof side.limit === 'number' ? side.limit : 0) / 1024 / 1024)),
      size: formatBytes(side.bytes),
    })
  }
  if (side.kind === 'not-image') return t('image.notImage', { size: formatBytes(side.bytes) })
  return t('image.missing')
}

/**
 * 两张都画不出来时说什么：能说清原因就说原因，否则退回原来那句话。
 * "太大"优先于"不是图" —— 前者才是用户会想处理的那件事。
 */
export function imageFallbackText(t: Translate, before: ImageSide, after: ImageSide): string {
  var sides = [before, after]
  var tooLarge = sides.filter(function (side) {
    return side.kind === 'too-large'
  })[0]
  if (tooLarge !== undefined) return sideReasonText(tooLarge, t)
  var notImage = sides.filter(function (side) {
    return side.kind === 'not-image'
  })[0]
  if (notImage !== undefined) return sideReasonText(notImage, t)
  return t('diff.binary')
}

/* ----------------------------------------- 轮尾：本轮改过的图片（一条门） */

/** 按扩展名粗筛"这看起来是张图"。 */
export function looksLikeImage(file: unknown): boolean {
  if (typeof file !== 'string') return false
  var dot = file.lastIndexOf('.')
  if (dot < 0 || dot === file.length - 1) return false
  return IMAGE_FILE_EXTENSIONS.indexOf(file.slice(dot + 1).toLowerCase()) >= 0
}

/**
 * store 边界：图片缓存条目由 store 的 image 片构造（形状见 `store/image.ts`），
 * 到这里只做一次"是不是对象"的收窄；坏值当没有缓存（会再发一次请求，行为不变）。
 */
function asPairEntry(value: unknown): ImagePairEntry | null {
  return value !== null && value !== undefined && typeof value === 'object'
    ? (value as ImagePairEntry)
    : null
}
