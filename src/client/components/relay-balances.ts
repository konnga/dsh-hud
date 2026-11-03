import React from 'react'
import { h } from '../shared.js'
import type { Translate } from '../shared.js'
import { amountText } from './balance-pill.js'
import { EMPTY_DIRECTORY } from '../relay-directory.js'
import type { RelayDirectory, RelayDirectoryState, RelayDetail } from '../relay-directory.js'

type RelayIcon = 'balance' | 'eye' | 'eyeOff' | 'copy' | 'check' | 'loading'
function relayIcon(name: RelayIcon): React.ReactElement {
  var paths: Record<RelayIcon, string> = {
    balance: 'M4 5h15v14H4zM4 9h15M14 12h7v4h-7z',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    eyeOff:
      'm3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-4 4M6 6a21 21 0 0 0-4 6s3.5 7 10 7a11 11 0 0 0 5-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    check: 'm5 12 4 4L19 6',
    loading: 'M20 12a8 8 0 1 1-8-8',
  }
  return h(
    'svg',
    {
      width: 16,
      height: 16,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      focusable: false,
      'data-relay-icon': name,
    },
    h('path', { d: paths[name] }),
  )
}
function clipboardWriter(): ((text: string) => Promise<void>) | undefined {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function')
      return function (text) {
        return navigator.clipboard.writeText(text)
      }
  } catch {
    /* Disabled clipboard APIs are represented as an explicit failed copy. */
  }
  return undefined
}

export function RelayBalances(props: {
  directory?: RelayDirectory
  t: Translate
}): React.ReactElement {
  const directory = props.directory
  var pair = React.useState<RelayDirectoryState>(function () {
    return directory ? directory.getSnapshot() : EMPTY_DIRECTORY
  })
  React.useEffect(
    function () {
      if (!directory) {
        pair[1](EMPTY_DIRECTORY)
        return
      }
      var unsubscribe = directory.subscribe(function () {
        pair[1](directory.getSnapshot())
      })
      var deactivate = directory.activate(true)
      var hideOnBlur = function () {
        directory.clearSecrets()
      }
      window.addEventListener('blur', hideOnBlur)
      pair[1](directory.getSnapshot())
      return function () {
        unsubscribe()
        window.removeEventListener('blur', hideOnBlur)
        deactivate()
      }
    },
    [directory],
  )
  var state = pair[0]
  var t = props.t
  function readings(detail: RelayDetail): React.ReactNode {
    if (detail.phase !== 'ready' || !detail.balance)
      return h(
        'p',
        { className: 'dshh-relayNote', role: 'status' },
        t('settings.relays.' + detail.phase),
      )
    var balance = detail.balance
    var values: React.ReactNode[] = []
    function amount(key: string, value: string | null, currency: string | null): void {
      var formatted = value === null ? null : amountText(value, currency)
      if (formatted !== null)
        values.push(
          h(
            'span',
            { key: key, className: 'dshh-relayReading' },
            t('settings.relays.' + key),
            ' ',
            formatted,
          ),
        )
    }
    amount('remaining', balance.remaining, balance.currency)
    amount('usedAccount', balance.usedAccount, balance.currency)
    amount('usedKey', balance.usedKey, balance.currency)
    if (balance.remaining === null)
      values.unshift(
        h(
          'span',
          { key: 'unknown', className: 'dshh-relayNote' },
          t('settings.relays.unknownRemaining'),
        ),
      )
    if (values.length === 1 && balance.wallets.length)
      balance.wallets.forEach(function (wallet, index) {
        var formatted = amountText(wallet.balance, wallet.currency)
        if (formatted)
          values.push(
            h('span', { key: 'wallet-' + index }, t('settings.relays.wallet'), ' ', formatted),
          )
      })
    return h('div', { className: 'dshh-relayReadings', 'aria-live': 'polite' }, values)
  }
  function action(
    label: string,
    icon: RelayIcon,
    onClick: () => void,
    options: {
      disabled?: boolean
      busy?: boolean
      provider?: string
      copied?: boolean
      tooltip?: string
    } = {},
  ): React.ReactElement {
    var name = t('settings.relays.' + label) + (options.provider ? ' · ' + options.provider : '')
    return h(
      'button',
      {
        type: 'button',
        className: 'dshh-relayAction',
        'aria-label': name,
        title: options.copied ? t('settings.relays.copied') : options.tooltip || name,
        'data-tooltip': options.copied ? t('settings.relays.copied') : options.tooltip || name,
        disabled: options.disabled,
        'aria-busy': options.busy || undefined,
        onClick,
      },
      relayIcon(options.busy ? 'loading' : options.copied ? 'check' : icon),
    )
  }
  return h(
    'section',
    { className: 'dshh-relaySection', 'aria-label': t('settings.balances') },
    state.phase !== 'ready'
      ? h(
          'p',
          { className: 'dshh-relayNote', role: 'status' },
          t('settings.relays.' + (state.phase === 'idle' ? 'loading' : state.phase)),
        )
      : state.providers.length === 0
        ? h('p', { className: 'dshh-relayNote', role: 'status' }, t('settings.relays.empty'))
        : h(
            'ul',
            { className: 'dshh-relayList' },
            state.providers.map(function (provider) {
              var detail = Object.prototype.hasOwnProperty.call(state.details, provider.id)
                ? state.details[provider.id]
                : undefined
              var secret = Object.prototype.hasOwnProperty.call(state.secrets, provider.id)
                ? state.secrets[provider.id]
                : undefined
              var copies = Object.prototype.hasOwnProperty.call(state.copies, provider.id)
                ? state.copies[provider.id]
                : {}
              var tokenSecret = Object.prototype.hasOwnProperty.call(
                state.tokenSecrets,
                provider.id,
              )
                ? state.tokenSecrets[provider.id]
                : undefined
              var tokenVisible = tokenSecret?.phase === 'revealed'
              var tokenHiding = tokenVisible || tokenSecret?.phase === 'loading'
              var tokenEnabled = provider.token?.configured === true
              var tokenStatus =
                provider.token === null
                  ? 'tokenUnsupported'
                  : provider.token.configured
                    ? 'tokenConfigured'
                    : 'tokenMissing'
              var visible = secret?.phase === 'revealed'
              var hiding = visible || secret?.phase === 'loading'
              var keyStatus =
                provider.key === null
                  ? 'keyUnknown'
                  : provider.key.configured
                    ? 'keyConfigured'
                    : 'keyMissing'
              return h(
                'li',
                { key: provider.id, className: 'dshh-relay', 'data-provider-id': provider.id },
                h(
                  'div',
                  { className: 'dshh-relayHead' },
                  h('strong', { className: 'dshh-relayIdentity' }, provider.label),
                  action(
                    'query',
                    'balance',
                    function () {
                      void directory?.query(provider.id)
                    },
                    {
                      provider: provider.label,
                      busy: detail?.phase === 'loading',
                      disabled: detail?.phase === 'loading',
                    },
                  ),
                ),
                h(
                  'div',
                  { className: 'dshh-relayAddress' },
                  h(
                    'code',
                    { className: 'dshh-relayURL', title: provider.copyURL || undefined },
                    provider.copyURL || t('settings.relays.noAddress'),
                  ),
                  action(
                    'copyAddress',
                    'copy',
                    function () {
                      void directory?.copyAddress(provider.id, clipboardWriter())
                    },
                    {
                      provider: provider.label,
                      disabled: !provider.copyURL || copies.address === 'loading',
                      busy: copies.address === 'loading',
                      copied: copies.address === 'copied',
                    },
                  ),
                ),
                h(
                  'div',
                  { className: 'dshh-relayKey' },
                  h(
                    'span',
                    { className: 'dshh-relayNote', title: t('settings.relays.' + keyStatus) },
                    'API Key',
                  ),
                  h(
                    'code',
                    { className: 'dshh-relaySecret', 'data-secret-provider': provider.id },
                    visible && secret ? secret.value : '••••••••',
                  ),
                  action(
                    hiding ? 'hideKey' : 'showKey',
                    hiding ? 'eyeOff' : 'eye',
                    function () {
                      if (hiding) directory?.hide(provider.id)
                      else void directory?.reveal(provider.id)
                    },
                    { provider: provider.label, busy: secret?.phase === 'loading' },
                  ),
                  action(
                    'copyKey',
                    'copy',
                    function () {
                      void directory?.copyKey(provider.id, clipboardWriter())
                    },
                    {
                      provider: provider.label,
                      disabled: copies.key === 'loading',
                      busy: copies.key === 'loading',
                      copied: copies.key === 'copied',
                    },
                  ),
                ),
                copies.key === 'error' || copies.address === 'error' || copies.token === 'error'
                  ? h(
                      'p',
                      { className: 'dshh-relayNote', role: 'status' },
                      t('settings.relays.copyFailed'),
                    )
                  : null,
                h(
                  'div',
                  { className: 'dshh-relayKey' },
                  h(
                    'span',
                    { className: 'dshh-relayNote', title: t('settings.relays.' + tokenStatus) },
                    t('settings.relays.tokenLabel'),
                  ),
                  h(
                    'code',
                    { className: 'dshh-relaySecret', 'data-token-provider': provider.id },
                    tokenVisible && tokenSecret
                      ? tokenSecret.value
                      : tokenEnabled
                        ? '••••••••'
                        : t(
                            provider.token === null
                              ? 'settings.relays.tokenNotSupported'
                              : 'settings.relays.tokenNotConfigured',
                          ),
                  ),
                  action(
                    tokenHiding ? 'hideToken' : 'showToken',
                    tokenHiding ? 'eyeOff' : 'eye',
                    function () {
                      if (tokenHiding) directory?.hideToken(provider.id)
                      else void directory?.revealToken(provider.id)
                    },
                    {
                      provider: provider.label,
                      busy: tokenSecret?.phase === 'loading',
                      disabled: !tokenEnabled && !tokenHiding,
                      tooltip:
                        tokenEnabled || tokenHiding
                          ? undefined
                          : t('settings.relays.' + tokenStatus),
                    },
                  ),
                  action(
                    'copyToken',
                    'copy',
                    function () {
                      void directory?.copyToken(provider.id, clipboardWriter())
                    },
                    {
                      provider: provider.label,
                      disabled: !tokenEnabled || copies.token === 'loading',
                      busy: copies.token === 'loading',
                      copied: copies.token === 'copied',
                      tooltip: tokenEnabled ? undefined : t('settings.relays.' + tokenStatus),
                    },
                  ),
                ),
                tokenSecret && tokenSecret.phase !== 'revealed'
                  ? h(
                      'p',
                      { className: 'dshh-relayNote', role: 'status' },
                      t(
                        tokenSecret.phase === 'missing'
                          ? 'settings.relays.tokenMissing'
                          : 'settings.relays.' + tokenSecret.phase,
                      ),
                    )
                  : null,
                secret && secret.phase !== 'revealed'
                  ? h(
                      'p',
                      { className: 'dshh-relayNote', role: 'status' },
                      t(
                        secret.phase === 'missing'
                          ? 'settings.relays.keyMissing'
                          : 'settings.relays.' + secret.phase,
                      ),
                    )
                  : null,
                detail
                  ? readings(detail)
                  : h(
                      'button',
                      {
                        type: 'button',
                        className: 'dshh-relayQuery',
                        'aria-label': t('settings.relays.query') + ' · ' + provider.label,
                        onClick: function () {
                          void directory?.query(provider.id)
                        },
                      },
                      t('settings.relays.query'),
                    ),
              )
            }),
          ),
  )
}
