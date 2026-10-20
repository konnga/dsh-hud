/**
 * 概览那一行的计数小片：按「改动 > 新增 > 未跟踪」排列，颜色与胶囊上的简写一致。
 */

import type React from 'react'

import type { HudStatusCounts, Translate } from '../shared.js'
import { COUNT_COLOR, COUNT_ORDER, h } from '../shared.js'

/** `CountChips` 的 props：八类改动计数 + 取词函数。 */
export interface CountChipsProps {
  /** git status 的分组计数；缺字段按 0 处理。 */
  counts?: HudStatusCounts | null
  t: Translate
}

/* ------------------------------------------------------------- 小组件 */

export function CountChips(props: CountChipsProps): React.ReactElement {
  var counts: Partial<HudStatusCounts> = props.counts || {}
  var children: React.ReactElement[] = []
  for (var index = 0; index < COUNT_ORDER.length; index += 1) {
    var key = COUNT_ORDER[index]
    var value = counts[key] || 0
    if (value <= 0) continue
    children.push(
      h(
        'span',
        {
          key: key,
          className: 'dshh-chip',
          style: { color: COUNT_COLOR[key], borderColor: 'currentColor' },
          title: props.t('count.' + key) + ' ' + String(value),
        },
        props.t('count.' + key) + ' ' + String(value),
      ),
    )
  }
  if (children.length === 0) {
    return h('span', { className: 'dshh-clean' }, props.t('panel.clean'))
  }
  return h('div', { className: 'dshh-chips' }, children)
}
