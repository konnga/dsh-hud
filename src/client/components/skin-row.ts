/**
 * 「思考中动画」设置行：注册进 dsh「设置 → 通用」的 item 座位，紧挨在官方「外观」下面。
 *
 * 预设方块对应 `running-skin.ts` 里的预设。点一下立刻换 —— 不用重启、不用刷新：
 * `setSkin()` 写完存储就地把那张 `<style>` 换掉。
 *
 * 方块本身与「表情包」页共用 `SkinCards`，两处入口的可选项和外观保持一致。
 */

import React from 'react'

import { currentSkin, setSkin, subscribeRunningSkin } from '../running-skin.js'
import type { RunningSkinId } from '../running-skin.js'
import type { Translate } from '../shared.js'
import { h } from '../shared.js'
import { SkinCards, useCustomPacks } from './skin-cards.js'

/** `SkinRow` 的 props：座位把 `t` 绑到本插件的词典上。 */
export interface SkinRowProps {
  t: Translate
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
  var packs = useCustomPacks()
  React.useEffect(function () {
    var update = function () {
      setActive(currentSkin())
    }
    var dispose = subscribeRunningSkin(update)
    update()
    return dispose
  }, [])

  return h(
    'div',
    { className: 'dshh-skin' },
    h('div', { key: 'title', className: 'dshh-skinTitle' }, props.t('skin.title')),
    h(SkinCards, {
      key: 'cards',
      t: props.t,
      active: active,
      packs: packs,
      onPick: function (id: string) {
        setActive(setSkin(id as RunningSkinId))
      },
    }),
  )
}
