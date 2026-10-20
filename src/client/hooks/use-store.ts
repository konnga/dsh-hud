/**
 * 订阅共享 store 的经典写法（不依赖种子里的 `useSyncExternalStore` 构建）。
 */

import React from 'react'

import type { HudState, HudStore } from '../shared.js'

/* ---------------------------------------------------------- 订阅 hook */

/** 订阅共享 store 的经典写法（不依赖种子里的 useSyncExternalStore 构建）。 */
export function useStore(store: HudStore): HudState {
  var pair = React.useState(function () {
    return store.getSnapshot()
  })
  React.useEffect(
    function () {
      return store.subscribe(function () {
        pair[1](store.getSnapshot())
      })
    },
    [store],
  )
  return pair[0]
}
