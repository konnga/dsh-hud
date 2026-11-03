import React from 'react'
import { getHudSettings, subscribeHudSettings } from '../hud-settings.js'
import type { HudSettingsState } from '../hud-settings.js'

export function useHudSettings(): HudSettingsState {
  var pair = React.useState(getHudSettings)
  React.useEffect(function () {
    var update = function () {
      pair[1](getHudSettings())
    }
    var dispose = subscribeHudSettings(update)
    update()
    return dispose
  }, [])
  return pair[0]
}
