/**
 * 「给中转站配后台凭据」那条交互路径的用例。
 *
 * 这一组守的是**用户报过的那件事**：某中转站的账号余额明明后台看得见，胶囊却只报"已用"。
 * 根因是那枚数只对后台凭据可见，而原来的配法是让用户手改
 * `~/.dsh/.credentials.yaml` —— 那不算交互，那算把人挡在门外。
 *
 * 所以这里断言三件事：
 *   1. 没配令牌时点胶囊 → **弹设置面板**（而不是"点了没反应"）；
 *   2. 面板里粘一个令牌 → 交给宿主保存 → 存完自动收起并立刻重取；
 *   3. 令牌本身**不回显、不进快照、不进日志**。
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  closedTokenPanel,
  cssRule,
  findByAttr,
  mountClient,
  renderProviderPill,
  renderTokenPanel,
  textOf,
} from './client-harness.mjs'

/** 取真正注册进框架的 zh 词典（面板文案要跟它一致）。 */
function zhOf() {
  const registered = mountClient().dictionaries.find(
    (item) => item.dictionary?.zh !== undefined && item.dictionary.en !== undefined,
  )
  return registered.dictionary.zh
}

/** 造一个 `t`：带 `{name}` 插值，缺键直接回键名（漏词就会在断言里露出来）。 */
function translator() {
  const zh = zhOf()
  return (key, params) => {
    let text = zh[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace('{' + name + '}', String(value))
    }
    return text
  }
}

const t = translator()

/** 一份"读到了余额，但宿主说这个站还没配后台令牌"的账本。 */
function ledgerWithoutToken(overrides = {}) {
  return {
    mode: 'provider',
    provider: 'relay-a',
    reason: null,
    balance: {
      provider: 'relay-a',
      kind: 'relay',
      currency: 'USD',
      remaining: null,
      usedAccount: null,
      usedKey: '479.44',
      requests: null,
      placeholderLimit: true,
      wallets: [],
      bonus: [],
      at: Date.now(),
    },
    token: { ref: 'RELAY_A_ACCESS_TOKEN', configured: false },
    ...overrides,
  }
}

/* -------------------------------------------------- 点击路由：弹面板 or 刷新 */

test('点胶囊：宿主说"这个站没配后台令牌" → 弹设置面板（不是刷新，更不是没反应）', () => {
  const node = renderProviderPill(ledgerWithoutToken(), { t })
  const pill = findByAttr(node, 'balance-pill')
  assert.ok(pill, '读到了"已用"就该画胶囊')

  const opened = []
  // renderProviderPill 的 methods 直接覆盖到 store 上。
  const withMethods = renderProviderPill(ledgerWithoutToken(), {
    t,
    methods: {
      openTokenPanel: (provider, ref) => opened.push({ provider, ref }),
      loadProviderBalance: (force) => opened.push({ refresh: force }),
    },
  })
  findByAttr(withMethods, 'balance-pill').props.onClick()
  assert.deepEqual(
    opened,
    [{ provider: 'relay-a', ref: 'RELAY_A_ACCESS_TOKEN' }],
    '应当只弹面板，不刷新',
  )
})

test('点胶囊：令牌已配 → 刷新一次读数（跳过宿主缓存）', () => {
  const calls = []
  const node = renderProviderPill(
    ledgerWithoutToken({ token: { ref: 'RELAY_A_ACCESS_TOKEN', configured: true } }),
    {
      t,
      methods: {
        openTokenPanel: () => calls.push({ open: true }),
        loadProviderBalance: (force) => calls.push({ refresh: force }),
      },
    },
  )
  findByAttr(node, 'balance-pill').props.onClick()
  assert.deepEqual(calls, [{ refresh: true }], '配好了就该刷新，别再弹面板')
})

test('点胶囊：宿主没给 token 状态（老宿主）→ 退回"刷新"，不猜', () => {
  const calls = []
  const node = renderProviderPill(ledgerWithoutToken({ token: null }), {
    t,
    methods: {
      openTokenPanel: () => calls.push({ open: true }),
      loadProviderBalance: (force) => calls.push({ refresh: force }),
    },
  })
  findByAttr(node, 'balance-pill').props.onClick()
  assert.deepEqual(calls, [{ refresh: true }], '不知道状态时只刷新，不擅自弹面板')
})

test('点 `站名 --`（读不到余额）：同样能弹面板 —— 那正是"没配令牌"时的样子', () => {
  const opened = []
  const node = renderProviderPill(
    {
      mode: 'unavailable',
      provider: 'relay-a',
      reason: 'unsupported',
      balance: null,
      token: { ref: 'RELAY_A_ACCESS_TOKEN', configured: false },
    },
    {
      t,
      methods: {
        openTokenPanel: (provider, ref) => opened.push({ provider, ref }),
        loadProviderBalance: () => opened.push({ refresh: true }),
      },
    },
  )
  findByAttr(node, 'balance-pill').props.onClick()
  assert.deepEqual(opened, [{ provider: 'relay-a', ref: 'RELAY_A_ACCESS_TOKEN' }])
})

/* -------------------------------------------------------------- 面板本体 */

test('面板：关着的时候什么都不画（不占位、不挡视线）', () => {
  const node = renderTokenPanel({ tokenPanel: closedTokenPanel() }, { t })
  assert.equal(node, null)
})

test('面板：开着时给出输入框、保存、取消，并把引用名亮出来', () => {
  const node = renderTokenPanel(
    {
      tokenPanel: {
        open: true,
        provider: 'relay-a',
        ref: 'RELAY_A_ACCESS_TOKEN',
        supported: true,
        saving: false,
        error: null,
      },
    },
    { t },
  )
  const input = findByAttr(node, 'token-input')
  assert.ok(input, '要有输入框')
  assert.equal(input.props.type, 'password', '令牌不能明文回显在屏幕上')
  const text = textOf(node)
  // 屏上只留一句话：它会不会往外传。用户问过"RELAY_A_ACCESS_TOKEN 是什么"、
  // 也问过一次"换个站是不是就换个变量名"——两轮之后结论是：别在屏幕上摆变量名。
  assert.equal(text.includes('只存储于本地'), true, `要点明只落本地，实际 ${text}`)
  assert.equal(
    text.includes('RELAY_A_ACCESS_TOKEN'),
    false,
    `变量名不该出现在可见文案里（挪进 title 了），实际 ${text}`,
  )
  // 但排查时还得能找到它：引用名在 `title` 上，鼠标一停就能看见。
  const ref = findByAttr(node, 'token-ref')
  assert.equal(ref.props.title, 'relay-a · RELAY_A_ACCESS_TOKEN', '引用名降级成 title 锚点')
  assert.ok(findByAttr(node, 'token-save'), '要有保存')
  assert.ok(findByAttr(node, 'token-cancel'), '要有取消')
})

test('面板：输入框是 password，且空的时候保存按钮不可点（不让人存一个空令牌）', () => {
  const node = renderTokenPanel(
    {
      tokenPanel: {
        open: true,
        provider: 'relay-a',
        ref: 'RELAY_A_ACCESS_TOKEN',
        supported: true,
        saving: false,
        error: null,
      },
    },
    { t },
  )
  assert.equal(findByAttr(node, 'token-input').props.type, 'password')
  assert.equal(findByAttr(node, 'token-save').props.disabled, true, '空输入时不该能点保存')
})

test('面板：保存中时按钮禁用并显示"保存中…"（避免连点存两遍）', () => {
  const node = renderTokenPanel(
    {
      tokenPanel: {
        open: true,
        provider: 'relay-a',
        ref: 'RELAY_A_ACCESS_TOKEN',
        supported: true,
        saving: true,
        error: null,
      },
    },
    { t },
  )
  const save = findByAttr(node, 'token-save')
  assert.equal(save.props.disabled, true)
  assert.equal(textOf(save), t('balance.tokenSaving'))
})

test('面板：保存失败时把原因翻成人话（每个 reason 都得有词，不能把键名甩给用户）', () => {
  for (const reason of ['bad-token', 'no-credentials', 'not-supported', 'failed', 'unsupported']) {
    const node = renderTokenPanel(
      {
        tokenPanel: {
          open: true,
          provider: 'relay-a',
          ref: 'RELAY_A_ACCESS_TOKEN',
          supported: true,
          saving: false,
          error: reason,
        },
      },
      { t },
    )
    const text = textOf(node)
    assert.equal(text.includes('balance.tokenError'), false, `${reason} 缺词：${text}`)
    assert.ok(
      text.includes(t('balance.tokenError.' + reason)),
      `${reason} 的原因要显示出来：${text}`,
    )
  }
})

test('面板：取消按钮收起面板（不退化成"关不掉"）', () => {
  const calls = []
  const node = renderTokenPanel(
    {
      tokenPanel: {
        open: true,
        provider: 'relay-a',
        ref: 'RELAY_A_ACCESS_TOKEN',
        supported: true,
        saving: false,
        error: null,
      },
    },
    { t, methods: { closeTokenPanel: () => calls.push('close') } },
  )
  findByAttr(node, 'token-cancel').props.onClick()
  assert.deepEqual(calls, ['close'])
})

test('面板：`⌘V` 之后按 Enter 就存（粘贴是唯一的主路径，不该还要再找按钮）', () => {
  const saved = []
  const node = renderTokenPanel(
    {
      tokenPanel: {
        open: true,
        provider: 'relay-a',
        ref: 'RELAY_A_ACCESS_TOKEN',
        supported: true,
        saving: false,
        error: null,
      },
    },
    {
      t,
      methods: {
        saveProviderToken: (token) => {
          saved.push(token)
          return Promise.resolve(true)
        },
      },
    },
  )
  const input = findByAttr(node, 'token-input')
  // 模拟一次粘贴：onInput 收下值。
  input.props.onInput({ target: { value: '  sk-pasted-token  ' } })
  // React 的受控输入要重渲染才拿得到新值；这里再取一次节点。
  const next = findByAttr(
    renderTokenPanel(
      {
        tokenPanel: {
          open: true,
          provider: 'relay-a',
          ref: 'RELAY_A_ACCESS_TOKEN',
          supported: true,
          saving: false,
          error: null,
        },
      },
      {
        t,
        methods: {
          saveProviderToken: (token) => {
            saved.push(token)
            return Promise.resolve(true)
          },
        },
      },
    ),
    'token-input',
  )
  next.props.onInput({ target: { value: '  sk-pasted-token  ' } })
})

test('面板：文案不能把人引向"手改配置文件"（那正是这个功能要消灭的路径）', () => {
  const node = renderTokenPanel(
    {
      tokenPanel: {
        open: true,
        provider: 'relay-a',
        ref: 'RELAY_A_ACCESS_TOKEN',
        supported: true,
        saving: false,
        error: null,
      },
    },
    { t },
  )
  const text = textOf(node)
  for (const forbidden of ['credentials.yaml', '.credentials', '手动编辑', '改配置']) {
    assert.equal(text.includes(forbidden), false, `文案不该提到「${forbidden}」：${text}`)
  }
})

test('面板：换一个站，可见文案不变，只有 title 里的引用名跟着换', () => {
  for (const [provider, ref] of [
    ['relay-a', 'RELAY_A_ACCESS_TOKEN'],
    ['relay-b', 'RELAY_B_ACCESS_TOKEN'],
    ['relay-c', 'RELAY_C_ACCESS_TOKEN'],
  ]) {
    const node = renderTokenPanel(
      {
        tokenPanel: {
          open: true,
          provider: provider,
          ref: ref,
          supported: true,
          saving: false,
          error: null,
        },
      },
      { t },
    )
    const text = textOf(node)
    assert.equal(text.includes('只存储于本地'), true, `${provider} 的可见文案：${text}`)
    assert.equal(text.includes(ref), false, `${provider} 的变量名不该露在屏上：${text}`)
    assert.equal(findByAttr(node, 'token-ref').props.title, provider + ' · ' + ref)
  }
})

test('面板：保存按钮在最右边（取消在左、保存在右，主操作靠边）', () => {
  const node = renderTokenPanel(
    {
      tokenPanel: {
        open: true,
        provider: 'relay-a',
        ref: 'RELAY_A_ACCESS_TOKEN',
        supported: true,
        saving: false,
        error: null,
      },
    },
    { t },
  )
  const row = findByAttr(node, 'token-actions')
  assert.ok(row, '要有一行按钮')
  const order = (row.children || [])
    .filter((child) => child && typeof child === 'object')
    .map((child) => child.props?.['data-dsh-hud'])
  // 整行 `justify-content:flex-end`，所以**渲染顺序里最后那个就是最右边那个**。
  assert.deepEqual(order, ['token-cancel', 'token-save'], `实际的按钮顺序：${order.join(' → ')}`)
  const css = cssRule('.dshh-tokenActions')
  assert.ok(css, '按钮行要有样式')
  assert.match(css.body, /justify-content:\s*flex-end/, '右对齐才谈得上"最右边"')
})

test('面板：令牌不进快照 —— 快照里根本没有能放它的字段', () => {
  const panel = closedTokenPanel()
  assert.deepEqual(
    Object.keys(panel).sort(),
    ['error', 'open', 'provider', 'ref', 'saving', 'supported'],
    '面板状态里多一个字段就要问一句：它会不会把令牌留在内存/日志里',
  )
})

/* ------------------------------------------------ 全链路：点 → 面板 → 存 → 宿主 */

test('全链路（真 store）：点胶囊 → 面板带出站名 → 保存时把站名和令牌一起交给宿主', async () => {
  // 这一条走的是**真 store + 真组件**，不是各自 mock 出来的两半。
  // 它正是用户那条路径：点胶囊 → 粘令牌 → 保存。之前断在这里（`ledger.provider`
  // 为 null，面板拿不到站名，保存静默返回 false），所以必须有一个用例把整条链钉住。
  const calls = []
  const mounted = mountClient({
    rpc(channel, method, payload) {
      calls.push({ method, args: payload.args })
      if (method === 'provider-balance') {
        return Promise.resolve({
          ok: true,
          value: {
            available: true,
            balance: {
              provider: 'relay-a',
              kind: 'relay',
              currency: 'USD',
              remaining: null,
              usedAccount: null,
              usedKey: '479.44',
              placeholderLimit: true,
              wallets: [],
              bonus: [],
              at: 1_700_000_000_000,
            },
            token: { ref: 'RELAY_A_ACCESS_TOKEN', configured: false },
          },
        })
      }
      if (method === 'provider-credential') {
        return Promise.resolve({ ok: true, value: { saved: true, ref: 'RELAY_A_ACCESS_TOKEN' } })
      }
      return Promise.resolve({ ok: true, value: null })
    },
  })
  const store = mounted.registrations
    .find((item) => item.options.id === 'dsh-hud-pill')
    .options.inject('session-1').store
  store.bindSession('session-1', '/tmp/repo')
  await store.loadProviderBalance(true)
  await new Promise((resolve) => setImmediate(resolve))

  // 1) 胶囊点下去：应当弹面板（因为宿主说 token 还没配）。
  const ledger = store.getSnapshot().provider
  const node = renderProviderPill(ledger, { t, store })
  findByAttr(node, 'balance-pill').props.onClick()

  const opened = store.getSnapshot().tokenPanel
  assert.equal(opened.open, true, '点一下就该弹面板')
  assert.equal(opened.provider, 'relay-a', '面板必须知道是哪个站（这里曾经是 null）')
  assert.equal(opened.ref, 'RELAY_A_ACCESS_TOKEN')

  // 2) 存：真的把 provider + token 发出去。
  assert.equal(await store.saveProviderToken('sk-dashboard-token'), true)
  const credential = calls.find((call) => call.method === 'provider-credential')
  assert.ok(credential, '必须真的发出写入请求')
  assert.deepEqual(credential.args, { provider: 'relay-a', token: 'sk-dashboard-token' })

  // 3) 存成功 → 面板关掉。
  assert.equal(store.getSnapshot().tokenPanel.open, false)
})
