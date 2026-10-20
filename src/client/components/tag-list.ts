/**
 * 标签列表（面板底部）：只在有标签时渲染，点了复制名字。
 */

import type React from 'react'

import { commitWhen, fullWhen } from '../format.js'
import type { HudTag, Translate } from '../shared.js'
import { h, sameCommit } from '../shared.js'

/** `TagList` 的 props：标签清单 + HEAD 比对 + 打开回调。 */
export interface TagListProps {
  /** `null` = 还没取到（整段不画）；`[]` = 取回了、确实一个都没有（画一行说明）。 */
  tags?: HudTag[] | null
  t: Translate
  /** 当前 HEAD 的 oid（用来给指向 HEAD 的标签标 HEAD 徽标）。 */
  headSha?: string | null
  /** 提交明细当前打开的那条。 */
  activeSha?: string | null
  truncated?: boolean
  onOpen?: ((tag: HudTag) => void) | null
}

/**
 * 标签列表：一行一个，tag 名 + 它指向的提交 sha + 相对时间；指向当前 HEAD 的标 HEAD。
 * 点一行 = 用右栏的提交明细看这个 tag 指向的那次提交（复用同一条管道，不新增界面）。
 */
export function TagList(props: TagListProps): React.ReactElement | null {
  // 原样保留 `null`（"还没取到"）—— 写成 `props.tags || []` 会把"没取到"和"确实没有"合并，
  // 于是面板一打开就先闪一行"还没有标签"。
  var tags = props.tags
  var t = props.t
  // `null` = 还没取到（先不画，避免闪一下"还没有标签"）；`[]` = 取回了、确实一个都没有 →
  // 这时要**画一行写明**：整段不画的话，用户没法区分"这个仓库没有 tag"与"这个功能没做"（实测踩过）。
  if (!Array.isArray(tags)) return null
  if (tags.length === 0) {
    return h(
      'div',
      { className: 'dshh-section' },
      h('div', { className: 'dshh-sectionTitle' }, t('panel.tags')),
      h('div', { className: 'dshh-note', 'data-tags-empty': '1' }, t('panel.tagsEmpty')),
    )
  }
  var headSha = props.headSha

  return h(
    'div',
    { className: 'dshh-section' },
    h('div', { className: 'dshh-sectionTitle' }, t('panel.tags')),
    h(
      'div',
      { className: 'dshh-commits' },
      tags.map(function (tag, index) {
        var isHead =
          typeof headSha === 'string' &&
          headSha.length > 0 &&
          (tag.sha === headSha || headSha.indexOf(tag.sha) === 0)
        var tip = [
          t('tag.click'),
          '',
          tag.subject || '',
          t(tag.annotated ? 'tag.annotated' : 'tag.lightweight') +
            ' · ' +
            tag.sha +
            ' · ' +
            (typeof tag.committedAt === 'number' ? fullWhen(tag.committedAt) : tag.date || ''),
        ].join('\n')
        var open = sameCommit(tag.sha, props.activeSha)
        return h(
          'button',
          {
            type: 'button',
            className: 'dshh-commit' + (open ? ' dshh-commitActive' : ''),
            'data-tag-row': tag.name,
            key: tag.name + ':' + String(index),
            title: tip,
            onClick: function () {
              if (props.onOpen) props.onOpen(tag)
            },
          },
          h('span', { className: 'dshh-ctag' }, tag.name),
          h('span', { className: 'dshh-csha' }, tag.sha),
          isHead ? h('span', { className: 'dshh-chead' }, 'HEAD') : null,
          h('span', { className: 'dshh-cwhen' }, commitWhen(tag, t)),
        )
      }),
    ),
    props.truncated === true
      ? h('div', { className: 'dshh-note' }, t('panel.tagsCapped', { n: String(tags.length) }))
      : null,
  )
}
