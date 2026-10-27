/**
 * 「给这个中转站配一枚后台凭据」的小面板。
 *
 * 为什么要有它：中转站的**账号余额**（后台那个"当前余额"）挂在 new-api 的
 * `/api/user/self` 上，只认后台凭据（PAT / 登录会话），`sk-` API Key 读不到。
 * 没有这枚凭据，胶囊就只能报"本 Key 已用"。
 *
 * 而没有这个面板时，唯一的配法是让用户去手改 `~/.dsh/.credentials.yaml` ——
 * 那是 DSH 的凭据库，手滑一个缩进整份凭据就读不出来了。所以这里做三件事：
 *
 *   1. 只问**一样东西**：令牌。引用名（`SITE_ACCESS_TOKEN`）由宿主从设置投影推导，
 *      用户不用知道它叫什么；
 *   2. 粘贴即存：`⌘V` 或按钮都行，存完立刻重取一次读数（`saveProviderToken` 里做）；
 *   3. 令牌**不回显**：输入框 `type=password`，store 不持有它，宿主也不回传。
 *
 * 令牌本身从不进 localStorage、不进日志、不进快照 —— 它只走一次 RPC 到宿主的凭据服务。
 */

import React from 'react'

import { useStore } from '../hooks/use-store.js'
import { h } from '../shared.js'
import type { HudStore, Translate } from '../shared.js'

/** 面板 props：取词与 store（面板状态在快照的 `tokenPanel` 里）。 */
export interface TokenPanelProps {
  store: HudStore
  /** 取词。框架按 `locale: NS` 注入；缺了就回键名（与主面板同一套兜底，宁丑不崩）。 */
  t?: Translate
}

/**
 * 后台凭据设置面板。
 *
 * 平时返回 `null`（不占位）；`tokenPanel.open` 为真时才渲染。
 *
 * @param props - 取词与 store。
 * @returns 面板节点或 `null`。
 */
export function TokenPanel(props: TokenPanelProps): React.ReactElement | null {
  var store = props.store
  // `t` 缺了也**不能崩**：面板是点胶囊弹出来的，崩掉就退化成"点了没反应"——
  // 而这正是这一整个功能要修掉的那种体验。
  var t: Translate =
    props.t ||
    function (key: string) {
      return key
    }
  var state = useStore(store)
  var panel = state.tokenPanel

  // 受控输入：草稿留在组件自己这儿，**不进 store** —— store 是会被 probe 打印的东西。
  var draftRef = React.useState('')
  var draft = draftRef[0]
  var setDraft = draftRef[1]

  // 面板关掉就清空草稿：不然下次打开还留着上一次粘的令牌。
  React.useEffect(
    function () {
      if (!panel.open) setDraft('')
    },
    [panel.open],
  )

  if (!panel.open) return null
  var provider = panel.provider ?? ''

  /** 存一次；失败原因由 store 写进 `tokenPanel.error`。 */
  function submit(): void {
    var value = draft.trim()
    if (value === '' || panel.saving) return
    setDraft('')
    void store.saveProviderToken(value)
  }

  var children: React.ReactNode[] = [
    h(
      'div',
      { key: 'head', className: 'dshh-tokenHead' },
      h('span', { key: 'title', className: 'dshh-tokenTitle' }, t('balance.tokenTitle')),
      h('span', { key: 'provider', className: 'dshh-tokenProvider' }, provider),
    ),
    h('div', { key: 'hint', className: 'dshh-tokenHint' }, t('balance.tokenHint')),
  ]

  children.push(
    h('input', {
      key: 'input',
      className: 'dshh-tokenInput',
      'data-dsh-hud': 'token-input',
      type: 'password',
      value: draft,
      placeholder: t('balance.tokenPlaceholder'),
      spellCheck: false,
      autoComplete: 'off',
      disabled: panel.saving,
      onInput: function (event: { target?: { value?: unknown } }) {
        var next = event && event.target ? event.target.value : ''
        setDraft(typeof next === 'string' ? next : '')
      },
      onKeyDown: function (event: { key?: string; preventDefault?: () => void }) {
        if (event && event.key === 'Enter') {
          if (typeof event.preventDefault === 'function') event.preventDefault()
          submit()
        }
        if (event && event.key === 'Escape') store.closeTokenPanel()
      },
    }),
  )

  // 屏上只留一句话：**只存储于本地**（用户只想知道它会不会往外传）。
  // 引用名（`SITE_ACCESS_TOKEN`）挪进 `title` —— 肉眼看不见，但排查时鼠标一停就知道
  // 该去凭据里翻哪个名字删掉，不必为此在白话文案里塞一个变量名。
  var refTitle =
    typeof panel.ref === 'string' && panel.ref !== ''
      ? (panel.provider ?? '') + ' · ' + panel.ref
      : undefined
  children.push(
    h(
      'div',
      { key: 'ref', className: 'dshh-tokenRef', 'data-dsh-hud': 'token-ref', title: refTitle },
      t('balance.tokenRef'),
    ),
  )

  // 顺序是 [取消][保存]：整行右对齐，所以保存落在最右边（主操作靠边是对话框惯例）。
  // 早先是 [保存][取消]，保存夹在左边，看着像"次要按钮"。
  children.push(
    h(
      'div',
      { key: 'actions', className: 'dshh-tokenActions', 'data-dsh-hud': 'token-actions' },
      h(
        'button',
        {
          key: 'cancel',
          type: 'button',
          className: 'dshh-tokenCancel',
          'data-dsh-hud': 'token-cancel',
          onClick: function () {
            store.closeTokenPanel()
          },
        },
        t('balance.tokenCancel'),
      ),
      h(
        'button',
        {
          key: 'save',
          type: 'button',
          className: 'dshh-tokenSave',
          'data-dsh-hud': 'token-save',
          disabled: panel.saving || draft.trim() === '',
          onClick: submit,
        },
        panel.saving ? t('balance.tokenSaving') : t('balance.tokenSave'),
      ),
    ),
  )

  if (panel.error !== null) {
    children.push(
      h(
        'div',
        { key: 'error', className: 'dshh-tokenError', role: 'alert' },
        t('balance.tokenError.' + panel.error),
      ),
    )
  }

  return h(
    'div',
    {
      className: 'dshh-tokenPanel',
      'data-dsh-hud': 'token-panel',
      role: 'dialog',
      'aria-label': t('balance.tokenTitle'),
    },
    children,
  )
}
