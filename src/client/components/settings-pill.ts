import React from 'react'
import { useHudSettings } from '../hooks/use-hud-settings.js'
import { openHudSettings, closeHudSettings } from '../hud-settings.js'
import type { HudStore, Translate } from '../shared.js'
import { h } from '../shared.js'

export function SettingsGear(): React.ReactElement {
  return h(
    'svg',
    { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
    h('path', {
      d: 'M10 2h4l.4 2.6 2.2 1.3 2.4-.9 2 3.5-2 1.7v2.6l2 1.7-2 3.5-2.4-.9-2.2 1.3L14 22h-4l-.4-2.6-2.2-1.3-2.4.9-2-3.5 2-1.7v-2.6l-2-1.7 2-3.5 2.4.9 2.2-1.3z',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinejoin: 'round',
    }),
    h('circle', { cx: 12, cy: 12, r: 3, stroke: 'currentColor', strokeWidth: 1.5 }),
  )
}
export interface SettingsPillProps {
  t: Translate
  store: HudStore
}
export function SettingsPill(props: SettingsPillProps): React.ReactElement {
  var state = useHudSettings()
  return h(
    'button',
    Object.assign(
      {
        type: 'button',
        className: 'dshh-pill dshh-settingsPill',
        'data-dsh-hud': 'settings-pill',
        'aria-label': props.t('settings.title'),
        'aria-haspopup': 'dialog',
        'aria-controls': 'dshh-settings-dialog',
        'aria-expanded': state.open,
        'data-active': state.open ? '' : undefined,
        onClick: function (event: { currentTarget: HTMLElement }) {
          props.store.hideTip()
          if (state.open) closeHudSettings()
          else openHudSettings(event.currentTarget)
        },
      },
      props.store.tipHandlers('hud-settings', function () {
        return [{ text: props.t('settings.title') }]
      }),
    ),
    h(SettingsGear),
  )
}
