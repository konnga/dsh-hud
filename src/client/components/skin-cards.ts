/**
 * 思考动画的皮肤方块：常规页与「表情包」页共用同一套卡片。
 *
 * 两处入口如果各画一套，样式和可选项很快就会漂开（曾经一边是卡片、一边是下拉框）。
 * 这里只负责渲染与回传 skin id，真正切换由调用方决定。
 */
import React from 'react'

import { SKIN_IDS } from '../running-skin.js'
import type { Translate } from '../shared.js'
import { h } from '../shared.js'
import { characterFrame } from '../character-packs.js'
import { getExpressionPackStore } from '../expression-packs.js'
import type { ExpressionPackSummary } from '../../shared/expression-packs.js'

export interface SkinCardsProps {
  t: Translate
  active: string
  packs: ExpressionPackSummary[]
  onPick: (id: string) => void
  disabled?: boolean
}

/** 官方那只摆尾的轮廓（和 `RunningWhaleTail` 的静态 SVG 同一条路径）。 */
var WHALE_PATH =
  'M8.844 13.742C8.967 12.328 8.45 10.4 8.45 9.65C8.45 8.94 8.88 8.43 9.6 8.43' +
  'C11.285 8.43 12.106 8.281 12.685 8.104C13.71 7.791 14.585 6.768 15.055 5.945' +
  'C15.137 5.803 14.99 5.641 14.829 5.671C13.829 5.86 12.828 5.376 11.827 4.978' +
  'C10.659 4.514 9.491 4.707 8.935 4.876C8.805 4.915 8.658 4.819 8.636 4.686' +
  'C8.468 3.643 7.405 2.615 5.498 2.238C4.54 2.048 3.748 1.574 3.347 1.202' +
  'C3.252 1.113 3.088 1.125 3.03 1.242C2.628 2.059 2.168 3.82 5.248 6.115' +
  'C5.82 6.494 6.31 6.785 6.574 7.637C6.72 8.104 6.157 9.168 6.061 9.368' +
  'C5.157 11.27 5.089 12.19 4.926 13.742'

/** 卡片的图标框：和角色图同高，四张卡片的文字基线才会落在同一条线上。 */
var FACE_SIZE = 56

/**
 * 线稿在 56px 框里的落地尺寸：墨迹高 `GLYPH_INK` px、线宽 `GLYPH_STROKE` px。
 *
 * 官方那颗运行图标是 14–16px 的 inline 图形（`viewBox="0 0 16 16"`、`stroke-width: 1`）。
 * 等比放大到 56px 会让墨迹撑满整个框、线宽涨到近 4px，比旁边的角色图还抢眼；所以框不变，
 * 只把墨迹收到约 2/3 高、线宽压到 1.7px —— 和角色图那圈细描边同一重量级，四周还留出气口。
 * 位置仍按墨迹自己的中心对齐，所以四张卡片的图标与文字都是水平垂直居中的。
 */
var GLYPH_INK = 38
var GLYPH_STROKE = 1.7
/** 官方路径的外接框（`getBBox()` 实测）高 12.5985，中心 8.9096 / 7.4428。 */
var GLYPH_INK_H = 12.5985
var GLYPH_CX = 8.9096
var GLYPH_CY = 7.4428

function glyph(): React.ReactElement {
  // 用户单位换成 px 的比例由「墨迹高度」定：viewBox 边长 = 56 × 墨迹高 / 目标墨迹 px。
  // 描边按同一比例换算，屏幕上就正好是 GLYPH_STROKE px，不随缩放变粗。
  var box = (FACE_SIZE * GLYPH_INK_H) / GLYPH_INK
  var stroke = (GLYPH_STROKE * box) / FACE_SIZE
  var x = (GLYPH_CX - box / 2).toFixed(4)
  var y = (GLYPH_CY - box / 2).toFixed(4)
  return h(
    'svg',
    {
      key: 'icon',
      className: 'dshh-skinFace',
      width: FACE_SIZE,
      height: FACE_SIZE,
      viewBox: x + ' ' + y + ' ' + box.toFixed(4) + ' ' + box.toFixed(4),
      fill: 'none',
      'aria-hidden': 'true',
    },
    h('path', { d: WHALE_PATH, stroke: 'currentColor', strokeWidth: Number(stroke.toFixed(4)) }),
  )
}

/**
 * 每个方块里的小图标。
 *
 * 自定义包的缩略图只在已经缓存时使用；没缓存时画一个中性图标，
 * 不在渲染期间为每张卡片去读一遍宿主存储（最多 20 个包，每个都可能有几 MB）。
 */
function cardIcon(id: string): React.ReactElement {
  var frame = characterFrame(id, 'thinking')
  if (frame)
    return h('img', {
      key: 'icon',
      className: 'dshh-skinFace',
      src: frame.src,
      width: FACE_SIZE,
      height: FACE_SIZE,
      alt: '',
      loading: 'lazy',
    })
  return glyph()
}

function labelOf(t: Translate, id: string, packs: ExpressionPackSummary[]): string {
  if (id.indexOf('custom:') === 0) {
    var pack = packs.find(function (entry) {
      return entry.id === id
    })
    return pack ? pack.name : t('packs.missingSelection')
  }
  return t('skin.' + id)
}

/** 渲染方块列表。调用方负责标题、位置与切换回调。 */
export function SkinCards(props: SkinCardsProps): React.ReactElement {
  var ids: string[] = (SKIN_IDS as string[]).slice()
  for (var index = 0; index < props.packs.length; index += 1) ids.push(props.packs[index].id)
  // 已选中的自定义包即使暂时读不到目录，也要留在方阵里，避免选中态凭空消失。
  if (props.active.indexOf('custom:') === 0 && ids.indexOf(props.active) < 0) ids.push(props.active)

  return h(
    'div',
    { className: 'dshh-skinCubes' },
    ids.map(function (id) {
      return h(
        'button',
        {
          key: id,
          type: 'button',
          className: 'dshh-skinCube',
          'data-active': id === props.active ? '' : undefined,
          'aria-pressed': id === props.active,
          disabled: props.disabled,
          onClick: function () {
            props.onPick(id)
          },
        },
        cardIcon(id),
        h('span', { key: 'label', className: 'dshh-skinLabel' }, labelOf(props.t, id, props.packs)),
      )
    }),
  )
}

/** 读取当前目录里的自定义包摘要；没有宿主服务时返回空数组。 */
export function useCustomPacks(): ExpressionPackSummary[] {
  var packs = getExpressionPackStore()
  var state = React.useState(function () {
    return packs?.getSnapshot().catalog.packs || []
  })
  React.useEffect(
    function () {
      if (!packs) return
      var update = function () {
        state[1](packs!.getSnapshot().catalog.packs)
      }
      var dispose = packs.subscribe(update)
      update()
      return dispose
    },
    [packs],
  )
  return state[0]
}
