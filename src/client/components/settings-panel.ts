/** HUD 自己的显示设置：仅客户端偏好，即改即用。 */
import React from 'react'
import { useHudSettings } from '../hooks/use-hud-settings.js'
import {
  closeHudSettings,
  DEFAULT_PREFERENCES,
  IMAGE_SIZES,
  setHudPreferences,
} from '../hud-settings.js'
import { setSkin } from '../running-skin.js'
import { RelayBalances } from './relay-balances.js'
import type { RelayDirectory } from '../relay-directory.js'
import { SkinRow } from './skin-row.js'
import { ExpressionPacks } from './expression-packs.js'
import type { ExpressionPackStore } from '../expression-packs.js'
import { h } from '../shared.js'
import type { Translate } from '../shared.js'

export interface SettingsPanelProps {
  t?: Translate
  directory?: RelayDirectory
  packs?: ExpressionPackStore
  onSelectPack?: (skin: string) => void | Promise<void>
  /** 打开时落在哪一页；默认「常规」。离线预览与用例可以借此直接渲染某一页。 */
  initialTab?: SettingsTab
}

type SettingsTab = 'general' | 'balances' | 'packs'
var SETTINGS_TABS: SettingsTab[] = ['general', 'balances', 'packs']

export function SettingsPanel(props: SettingsPanelProps): React.ReactElement | null {
  var t: Translate =
    props.t ||
    function (key) {
      return key
    }
  var state = useHudSettings()
  var preferences = state.preferences
  var tabState = React.useState<SettingsTab>(props.initialTab || 'general')
  var tab = tabState[0]
  React.useEffect(
    function () {
      if (!state.open) {
        tabState[1]('general')
        props.directory?.clearSecrets()
      }
    },
    [state.open, props.directory],
  )

  React.useEffect(
    function () {
      if (!state.open) return
      var dialog = document.querySelector('[data-dsh-hud="settings-dialog"]') as HTMLElement | null
      if (dialog && typeof dialog.focus === 'function') dialog.focus()
    },
    [state.open],
  )

  if (!state.open) return null

  function toggle(
    key: 'showElapsed' | 'showGit' | 'showTools' | 'showBalance' | 'showTimer',
    label: string,
  ): React.ReactElement {
    var id = 'dshh-setting-' + key
    return h(
      'div',
      { key: key, className: 'dshh-settingRow' },
      h('label', { htmlFor: id }, t(label)),
      h(
        'button',
        {
          id: id,
          type: 'button',
          role: 'switch',
          className: 'dshh-settingsSwitch',
          'aria-label': t(label),
          'aria-checked': preferences[key],
          'data-setting': key,
          onClick: function () {
            setHudPreferences({ [key]: !preferences[key] })
          },
        },
        h(
          'span',
          { className: 'dshh-switchTrack', 'aria-hidden': true },
          h('span', { className: 'dshh-switchThumb' }),
        ),
        h(
          'span',
          { className: 'dshh-switchState', 'aria-hidden': true },
          t(preferences[key] ? 'settings.on' : 'settings.off'),
        ),
      ),
    )
  }

  function selectTab(next: SettingsTab, focus = false): void {
    props.directory?.clearSecrets()
    tabState[1](next)
    if (focus) {
      var button = document.getElementById('dshh-settings-tab-' + next)
      if (button && typeof button.focus === 'function') button.focus()
    }
  }
  function tabButton(id: SettingsTab): React.ReactElement {
    return h(
      'button',
      {
        type: 'button',
        role: 'tab',
        id: 'dshh-settings-tab-' + id,
        'aria-controls': 'dshh-settings-page-' + id,
        'aria-selected': tab === id,
        tabIndex: tab === id ? 0 : -1,
        onClick: function () {
          selectTab(id)
        },
        onKeyDown: function (event: React.KeyboardEvent<HTMLButtonElement>) {
          var next: SettingsTab
          if (event.key === 'Home') next = 'general'
          else if (event.key === 'End') next = 'packs'
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            var index = SETTINGS_TABS.indexOf(id)
            var step = event.key === 'ArrowRight' ? 1 : -1
            next = SETTINGS_TABS[(index + step + SETTINGS_TABS.length) % SETTINGS_TABS.length]
          } else return
          event.preventDefault()
          event.stopPropagation()
          selectTab(next, true)
        },
      },
      t('settings.' + id),
    )
  }
  function keydown(event: React.KeyboardEvent<HTMLElement>): void {
    // 不让对话框内的 Esc / 快捷键传播到下方 Git 面板和输入框。
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      closeHudSettings()
    } else if (event.key === 'Tab') {
      var dialog = event.currentTarget
      var focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]),select:not([disabled]),input:not([disabled]),[tabindex="0"]',
        ),
      )
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      var first = focusable[0]
      var last = focusable[focusable.length - 1]
      var active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || active === dialog)) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return h(
    'div',
    {
      className: 'dshh-settingsBackdrop',
      'data-dsh-hud': 'settings-backdrop',
      onClick: function (event: React.MouseEvent<HTMLElement>) {
        if (event.target === event.currentTarget) closeHudSettings()
      },
    },
    h(
      'section',
      {
        id: 'dshh-settings-dialog',
        className: 'dshh-settingsPanel',
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': 'dshh-settings-title',
        tabIndex: -1,
        'data-dsh-hud': 'settings-dialog',
        onKeyDown: keydown,
      },
      h(
        'header',
        { className: 'dshh-settingsHead' },
        h('h2', { id: 'dshh-settings-title' }, t('settings.title')),
        h(
          'button',
          {
            type: 'button',
            className: 'dshh-settingsClose',
            'aria-label': t('settings.close'),
            onClick: closeHudSettings,
          },
          h(
            'svg',
            { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true },
            h('path', {
              d: 'm4 4 8 8m0-8-8 8',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.5,
            }),
          ),
        ),
      ),
      h(
        'div',
        { className: 'dshh-settingsTabs', role: 'tablist', 'aria-label': t('settings.title') },
        tabButton('general'),
        tabButton('balances'),
        tabButton('packs'),
      ),
      h(
        'div',
        {
          role: 'tabpanel',
          id: 'dshh-settings-page-general',
          'aria-labelledby': 'dshh-settings-tab-general',
          hidden: tab !== 'general',
        },
        tab === 'general'
          ? h(
              'div',
              { className: 'dshh-settingsGeneral' },
              h(
                'section',
                { className: 'dshh-settingsGroup', 'aria-labelledby': 'dshh-capsules-title' },
                h('h3', { id: 'dshh-capsules-title' }, t('settings.capsules')),
                toggle('showGit', 'settings.showGit'),
                toggle('showTools', 'settings.showTools'),
                toggle('showBalance', 'settings.showBalance'),
                toggle('showTimer', 'settings.showTimer'),
              ),
              state.saveFailed
                ? h(
                    'p',
                    { className: 'dshh-settingsError', role: 'status' },
                    t('settings.saveFailed'),
                  )
                : null,
              h(
                'footer',
                { className: 'dshh-settingsFooter' },
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: function () {
                      setHudPreferences(DEFAULT_PREFERENCES)
                      setSkin('whale')
                    },
                  },
                  t('settings.reset'),
                ),
              ),
            )
          : null,
      ),
      h(
        'div',
        {
          role: 'tabpanel',
          id: 'dshh-settings-page-balances',
          'aria-labelledby': 'dshh-settings-tab-balances',
          hidden: tab !== 'balances',
        },
        tab === 'balances' ? h(RelayBalances, { t: t, directory: props.directory }) : null,
      ),
      h(
        'div',
        {
          role: 'tabpanel',
          id: 'dshh-settings-page-packs',
          'aria-labelledby': 'dshh-settings-tab-packs',
          hidden: tab !== 'packs',
        },
        tab === 'packs'
          ? h(
              'div',
              { className: 'dshh-settingsGeneral' },
              h(SkinRow, { t: t }),
              // 「角色图片尺寸」和「显示用时」都只作用于思考中那一行：尺寸是图、用时是文字，
              // 所以跟着「思考中动画」放在同一页，而不是混进「胶囊显示」。
              h(
                'div',
                { className: 'dshh-settingsFields' },
                h(
                  'label',
                  { className: 'dshh-settingRow' },
                  h('span', {}, t('settings.imageSize')),
                  h(
                    'span',
                    { className: 'dshh-selectWrap' },
                    h(
                      'select',
                      {
                        value: preferences.imageSize,
                        'data-setting': 'imageSize',
                        onChange: function (event: React.ChangeEvent<HTMLSelectElement>) {
                          setHudPreferences({ imageSize: Number(event.currentTarget.value) })
                        },
                      },
                      IMAGE_SIZES.map(function (size) {
                        return h('option', { key: size, value: size }, String(size) + ' px')
                      }),
                    ),
                  ),
                ),
                toggle('showElapsed', 'settings.elapsed'),
              ),
              h(ExpressionPacks, { t: t, store: props.packs, onSelect: props.onSelectPack }),
            )
          : null,
      ),
    ),
  )
}
