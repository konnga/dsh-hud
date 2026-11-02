/**
 * 「思考中动画」设置行：注册进 dsh「设置 → 通用」的 item 座位，紧挨在官方「外观」下面。
 *
 * 预设方块对应 `running-skin.ts` 里的预设。点一下立刻换 —— 不用重启、不用刷新：
 * `setSkin()` 写完存储就地把那张 `<style>` 换掉。
 *
 * 视觉照抄官方 `AppearanceRow` 的几何（`.dshh-skin*` 那几条规则是它的等价物），
 * 这样它和上下几行看起来是同一个界面，而不是插件贴上来的一块。
 */

import React from 'react'

import { SKIN_IDS, currentSkin, setSkin, subscribeRunningSkin } from '../running-skin.js'
import type { RunningSkinId } from '../running-skin.js'
import type { Translate } from '../shared.js'
import { h } from '../shared.js'
import { WHALE_ASSETS } from '../whale-assets.js'

/** `SkinRow` 的 props：座位把 `t` 绑到本插件的词典上。 */
export interface SkinRowProps {
  t: Translate
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

/**
 * 每个方块里的小图标：不用 emoji，走和官方一样的 16×16 描边 SVG，
 * 这样深浅主题都跟着 `currentColor` 走。
 */
function skinIcon(id: RunningSkinId): React.ReactElement {
  if (id === 'whale') {
    return h('img', { key: 'icon', src: WHALE_ASSETS.thinking, width: 32, height: 32, alt: '' })
  }
  if (id === 'plane') {
    return h(
      'svg',
      { key: 'icon', width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' },
      h('path', { d: 'M14.6 1.4 1.4 6.9l5 1.7 1.7 5z', stroke: 'currentColor', strokeWidth: 1 }),
    )
  }
  return h(
    'svg',
    { key: 'icon', width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' },
    h('path', { d: WHALE_PATH, stroke: 'currentColor', strokeWidth: 1 }),
  )
}

/**
 * 渲染这一行。
 *
 * @param props - 座位组装的 props（`t` 已绑定到本插件词典）。
 * @returns 标题 + 预设方块。
 */
export function SkinRow(props: SkinRowProps): React.ReactElement {
  // 订阅同一份运行时状态：点击、跨窗口与 focus 都能同步选中态。
  var state = React.useState<RunningSkinId>(currentSkin)
  var active = state[0]
  var setActive = state[1]
  React.useEffect(function () {
    var update = function () {
      setActive(currentSkin())
    }
    var dispose = subscribeRunningSkin(update)
    update()
    return dispose
  }, [])

  /**
   * 点一下：写存储、立刻换表、再同步选中态。
   *
   * 单独包一层是因为循环里用的是 `var id` —— 直接把闭包塞进 onClick，预设方块会
   * 一起指向最后那个 id。这个函数每次调用都把当时的 id 定住。
   */
  function picker(id: RunningSkinId): () => void {
    return function () {
      setActive(setSkin(id))
    }
  }

  var cubes: React.ReactElement[] = []
  for (var index = 0; index < SKIN_IDS.length; index += 1) {
    var id = SKIN_IDS[index]
    cubes.push(
      h(
        'button',
        {
          key: id,
          type: 'button',
          className: 'dshh-skinCube',
          // 选中态用 data-active 而不是再加一个类：和官方那行同一个写法。
          'data-active': id === active ? '' : undefined,
          'aria-pressed': id === active,
          onClick: picker(id),
        },
        skinIcon(id),
        h('span', { key: 'label' }, props.t('skin.' + id)),
      ),
    )
  }

  return h(
    'div',
    { className: 'dshh-skin' },
    h('div', { key: 'title', className: 'dshh-skinTitle' }, props.t('skin.title')),
    h('div', { key: 'cubes', className: 'dshh-skinCubes' }, cubes),
  )
}
