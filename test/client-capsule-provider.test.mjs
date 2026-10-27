/**
 * 胶囊用例：「当前会话的模型来源」那一路的渲染。
 *
 * 要盯住的是三件事：显示的必须是**当前提供方**的数；只有"已用"可画时不能让人误读成余额；
 * 读不到时干脆不画（画平台账号的余额是错的 —— 那是另一个账本）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  findByAttr,
  hoverPill,
  mountClient,
  renderProviderPill,
  renderBalancePill,
  textOf,
} from './client-harness.mjs'

/**
 * 用**真正注册进框架的中文词典**渲染（不是拿 key 当文案）。
 *
 * 直接读 key 的断言会让"文案写没写"这件事从用例里溜走 —— 这里读的是真词典。
 */
const ZH = mountClient().dictionaries.find((item) => item.dictionary?.zh).dictionary.zh
function t(key, params) {
  let text = ZH[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, value)
  return text
}
/** 所有渲染都带上真词典。 */
const zh = (options = {}) => ({ t, ...options })

/** 一个中转站余额快照。 */
function relayBalance(overrides = {}) {
  return {
    provider: 'relay-b',
    kind: 'relay',
    currency: 'USD',
    remaining: '2265.33',
    usedAccount: null,
    usedKey: '212.74',
    requests: null,
    placeholderLimit: false,
    wallets: [],
    bonus: [],
    at: Date.now(),
    ...overrides,
  }
}

const ledger = (balance) => ({ mode: 'provider', balance })

test('提供方胶囊：剩余额度可算 → 画剩余，悬停给出提供方与本 Key 已用', () => {
  const tips = []
  const node = renderProviderPill(
    ledger(relayBalance()),
    zh({
      methods: {
        showTip: (key, text) => tips.push({ key, text }),
        loadProviderBalance: (force) => tips.push({ refreshed: force === true }),
      },
    }),
  )
  const pill = findByAttr(node, 'balance-pill')
  assert.ok(pill, '应当画出胶囊')
  assert.equal(textOf(pill), '$2,265.33', `画剩余额度，实际 ${textOf(pill)}`)
  assert.ok(!textOf(pill).includes('已用'), '剩余可算时不该出现"已用"前缀')

  hoverPill(node, 'balance-pill')
  const tip = tips[0].text
  assert.ok(tip.startsWith('relay-b'), `第一行是提供方，实际 ${tip}`)
  assert.ok(tip.includes('$2,265.33'), `剩余额度，实际 ${tip}`)
  assert.ok(tip.includes('本 Key 已用 $212.74'), `本 Key 已用，实际 ${tip}`)
  assert.ok(tip.includes('更新于'), `更新时间，实际 ${tip}`)
  // 只放读数：五行以内（提供方 / 剩余 / 已用 / 更新）。
  assert.ok(tip.split('\n').length <= 4, `悬停不该超过四行，实际 ${JSON.stringify(tip)}`)

  // 点一下刷新的是**提供方**那一路，不是账号那一路。
  pill.props.onClick()
  assert.deepEqual(tips[1], { refreshed: true })
})

test('提供方胶囊：只有"已用"可画（额度是无限占位）→ 必须带前缀，不能让人读成余额', () => {
  const balance = relayBalance({ remaining: null, usedKey: '441.72', placeholderLimit: true })
  const tips = []
  const node = renderProviderPill(
    ledger(balance),
    zh({ methods: { showTip: (key, text) => tips.push({ key, text }) } }),
  )
  const pill = findByAttr(node, 'balance-pill')
  const text = textOf(pill)
  assert.ok(text.includes('已用'), `只有已用时要有前缀，实际 ${text}`)
  assert.ok(!text.includes('+'), '没有赠送余额就不该有 +')

  hoverPill(node, 'balance-pill')
  // 悬停里不出现"剩余"那种说法：站点没给剩余，就不该假装知道。
  assert.ok(tips[0].text.includes('$441.72'), `已用照报，实际 ${tips[0].text}`)
  assert.ok(!tips[0].text.includes('$0'), `不能编一个剩余，实际 ${tips[0].text}`)
})

test('提供方胶囊：官方 API Key（kind=official）画钱包余额与赠送标记', () => {
  const node = renderProviderPill(
    ledger(
      relayBalance({
        provider: 'deepseek-official',
        kind: 'official',
        currency: 'CNY',
        remaining: '128.60',
        usedAccount: null,
        usedKey: null,
        wallets: [{ currency: 'CNY', balance: '128.60' }],
        bonus: [{ currency: 'CNY', balance: '2' }],
      }),
    ),
    zh(),
  )
  const text = textOf(findByAttr(node, 'balance-pill'))
  assert.equal(text, '¥128.60 +', `官方 Key 的余额与赠送标记，实际 ${text}`)
})

test('提供方胶囊：官方 Key 的赠送额度在悬停里说清（否则 `+` 是个没人懂的符号）', () => {
  const tips = []
  const node = renderProviderPill(
    ledger(
      relayBalance({
        provider: 'deepseek-official',
        kind: 'official',
        currency: 'CNY',
        remaining: '128.60',
        usedAccount: null,
        usedKey: null,
        wallets: [{ currency: 'CNY', balance: '128.60' }],
        bonus: [{ currency: 'CNY', balance: '2' }],
      }),
    ),
    zh({ methods: { showTip: (key, text) => tips.push({ key, text }) } }),
  )
  hoverPill(node, 'balance-pill')
  assert.ok(tips[0].text.includes('赠送余额 ¥2.00'), `要写明赠送额度，实际 ${tips[0].text}`)
})

test('提供方胶囊：低余额提醒只对"剩余额度"生效（拿已用去比阈值是错的）', () => {
  const lowRemaining = renderProviderPill(ledger(relayBalance({ remaining: '3.20' })), zh())
  assert.ok(textOf(findByAttr(lowRemaining, 'balance-pill')).includes('⚠'), '剩余低于阈值要报警')

  const lowUsed = renderProviderPill(
    ledger(relayBalance({ remaining: null, usedKey: '3.20', placeholderLimit: true })),
    zh(),
  )
  assert.ok(
    !textOf(findByAttr(lowUsed, 'balance-pill')).includes('⚠'),
    '"已用 3.20" 不是低余额，不该报警',
  )
})

test('提供方胶囊：读不到（unavailable）→ 干脆不画，绝不退回平台账号的余额', () => {
  // 平台上确实有余额，但会话用的是另一个提供方：这时候画 ¥8.60 就是错的。
  const account = {
    wallets: [{ currency: 'CNY', balance: '8.60' }],
    bonus: [],
    at: Date.now(),
    failed: false,
  }
  const unavailable = renderProviderPill(
    { mode: 'unavailable', balance: null },
    zh({ balance: account }),
  )
  // 读不到时画 `--`（用户要求"没有查询结果就显示 --"），**不**拿平台账号的 ¥8.60 顶上：
  // 那是另一个账本的钱，填进来等于报一个与本次会话无关的数。
  assert.equal(
    textOf(findByAttr(unavailable, 'balance-pill')),
    '--',
    '读不到 → `--`，绝不退回平台账号余额',
  )

  // 账本还是 `unknown`（首帧 / 刚换完会话）：画 `--`，即使平台账号上还有余额。
  // 这是用户明确要的："没有查询结果的显示 --，不要显示默认的官方账号余额"。
  const unknown = renderProviderPill({ mode: 'unknown', balance: null }, zh())
  assert.equal(textOf(findByAttr(unknown, 'balance-pill')), '--')
  const withAccount = renderProviderPill(
    { mode: 'unknown', balance: null },
    zh({ balance: account }),
  )
  assert.equal(
    textOf(findByAttr(withAccount, 'balance-pill')),
    '--',
    'unknown 时不拿官方账号余额顶上（那个数未必是这次会话要花的钱）',
  )
})

test('提供方胶囊：读不到但知道是哪个站 → 画 `站名 --`，悬停说清原因', () => {
  const tips = []
  const node = renderProviderPill(
    { mode: 'unavailable', balance: null, provider: 'relay-x', reason: 'unsupported' },
    zh({ methods: { showTip: (key, text) => tips.push({ key, text }) } }),
  )
  const pill = findByAttr(node, 'balance-pill')
  assert.ok(pill, '知道是哪个站就该画一枚中性胶囊')
  assert.equal(textOf(pill), 'relay-x --', `实际 ${textOf(pill)}`)

  hoverPill(node, 'balance-pill')
  assert.ok(tips[0].text.startsWith('relay-x'), `第一行是提供方，实际 ${tips[0].text}`)
  assert.ok(tips[0].text.includes('该站不提供余额接口'), `第二行是原因，实际 ${tips[0].text}`)

  // 同一枚胶囊点一下仍然重取（走的是提供方那一路）。
  const refreshed = []
  const clickable = findByAttr(
    renderProviderPill(
      { mode: 'unavailable', balance: null, provider: 'relay-x', reason: 'unsupported' },
      zh({ methods: { loadProviderBalance: (force) => refreshed.push(force === true) } }),
    ),
    'balance-pill',
  )
  clickable.props.onClick()
  assert.deepEqual(refreshed, [true], '点一下 = 强制重取一次')
})

test('提供方胶囊：不知道是哪个站时只画 `--`（没有主语，但也不留空白）', () => {
  const node = renderProviderPill({ mode: 'unavailable', balance: null, provider: null }, zh())
  assert.equal(textOf(findByAttr(node, 'balance-pill')), '--')
})

test('占位胶囊：点它强制重取一次（"怎么还没出来"就点它）', () => {
  const calls = []
  const node = renderProviderPill(
    { mode: 'unknown', balance: null, provider: null },
    zh({ methods: { loadProviderBalance: (force) => calls.push(force === true) } }),
  )
  findByAttr(node, 'balance-pill').props.onClick()
  assert.deepEqual(calls, [true], '占位态点一下应当带 force 重取')
})

test('提供方胶囊：account 模式回到平台账号那一路（同一个数不画两遍）', () => {
  const account = {
    wallets: [{ currency: 'CNY', balance: '128.40' }],
    bonus: [],
    at: Date.now(),
    failed: false,
  }
  const node = renderProviderPill({ mode: 'account', balance: null }, zh({ balance: account }))
  assert.equal(textOf(findByAttr(node, 'balance-pill')), '¥128.40')
})

test('账号那一路不受影响：没有 provider 字段时照旧画（向后兼容旧快照）', () => {
  const node = renderBalancePill(
    {
      wallets: [{ currency: 'CNY', balance: '128.40' }],
      bonus: [],
      at: Date.now(),
      failed: false,
    },
    zh(),
  )
  assert.equal(textOf(findByAttr(node, 'balance-pill')), '¥128.40')
})

test('提供方胶囊：两个"已用"是两个账本，各占一行、各带自己的标签（不合并、不顶替）', () => {
  function tipLines(overrides) {
    const tips = []
    const node = renderProviderPill(
      ledger(relayBalance(overrides)),
      zh({ methods: { showTip: (key, text) => tips.push({ key, text }) } }),
    )
    hoverPill(node, 'balance-pill')
    return tips[0].text.split('\n')
  }

  // 两本账同时存在（实测：账号 $526.66 / 本 Key $479.44）→ 两行都要在。
  const both = tipLines({ usedAccount: '526.66', usedKey: '479.44' })
  assert.ok(both.includes('账号已用 $526.66'), `账号那本账，实际 ${both.join(' | ')}`)
  assert.ok(both.includes('本 Key 已用 $479.44'), `Key 那本账，实际 ${both.join(' | ')}`)

  // 只有账号那本：不该冒出一行空的"本 Key 已用"。
  const accountOnly = tipLines({ usedAccount: '526.66', usedKey: null })
  assert.ok(accountOnly.includes('账号已用 $526.66'), accountOnly.join(' | '))
  assert.equal(
    accountOnly.some((line) => line.includes('本 Key 已用')),
    false,
    '没有 Key 那个数就不该画那一行',
  )

  // 只有 Key 那本：不该冒充账号口径。
  const keyOnly = tipLines({ usedAccount: null, usedKey: '479.44' })
  assert.ok(keyOnly.includes('本 Key 已用 $479.44'), keyOnly.join(' | '))
  assert.equal(
    keyOnly.some((line) => line.includes('账号已用')),
    false,
    '没有账号那个数就不该冒充账号口径',
  )

  // 两个都没有：两行都不画（不写 0）。
  const none = tipLines({ usedAccount: null, usedKey: null })
  assert.equal(
    none.some((line) => line.includes('已用')),
    false,
    `两个数都没有时不该画"已用"，实际 ${none.join(' | ')}`,
  )
})

test('提供方胶囊：账号那一路连「API 请求 3685」一起显示（截图里那三个数）', () => {
  const tips = []
  const node = renderProviderPill(
    ledger(
      relayBalance({
        provider: 'relay-a',
        remaining: '855.69',
        usedAccount: '526.66',
        usedKey: '479.44',
        requests: 3685,
        placeholderLimit: false,
        at: Date.now(),
      }),
    ),
    zh({ methods: { showTip: (key, text) => tips.push({ key, text }) } }),
  )
  const pill = findByAttr(node, 'balance-pill')
  assert.equal(textOf(pill).trim(), '$855.69', '胶囊画后台「当前余额」')
  hoverPill(node, 'balance-pill')
  const tip = tips[0].text
  assert.ok(tip.includes('relay-a'), tip)
  assert.ok(tip.includes('账号已用 $526.66'), tip)
  assert.ok(tip.includes('API 请求 3,685'), `千分位，实际 ${tip}`)
  assert.ok(tip.includes('本 Key 已用 $479.44'), tip)
  // 有请求数时不该再冒出"该站不提供余额接口"这类失败文案。
  assert.equal(tip.includes('—'), false, tip)
})

test('提供方胶囊：行序是 余额 → API 请求 → 账号已用 → 本 Key 已用（请求数紧跟余额）', () => {
  // 用户看着截图提的：`API 请求` 夹在两个金额中间会被读成第三个金额，
  // 所以它要紧跟在余额下面。这条用例钉的是**顺序**，不是"有没有"——
  // 之前只断言 `includes()`，交换两行也不会红。
  const tips = []
  const node = renderProviderPill(
    ledger(
      relayBalance({
        provider: 'relay-a',
        remaining: '745.58',
        usedAccount: '637.56',
        usedKey: '536.22',
        requests: 4458,
        placeholderLimit: false,
        at: new Date('2026-10-27T03:47:00Z').getTime(),
      }),
    ),
    zh({ methods: { showTip: (key, text) => tips.push({ key, text }) } }),
  )
  hoverPill(node, 'balance-pill')
  const lines = tips[0].text.split('\n')
  // 第一行是提供方，最后一行是"更新于"（时间随时区变，只核对前缀）。
  assert.equal(lines[0], 'relay-a')
  assert.equal(lines[1], '余额 $745.58')
  assert.equal(lines[2], 'API 请求 4,458')
  assert.equal(lines[3], '账号已用 $637.56')
  assert.equal(lines[4], '本 Key 已用 $536.22')
  assert.ok(lines[5].startsWith('更新于 '), lines[5])
  assert.equal(lines.length, 6, `不该多出行：${lines.join(' | ')}`)
})

test('提供方胶囊：没有请求数时那一行不画（不写 0，不写空）', () => {
  const tips = []
  const node = renderProviderPill(
    ledger(relayBalance({ provider: 'relay-a', requests: null })),
    zh({ methods: { showTip: (key, text) => tips.push({ key, text }) } }),
  )
  hoverPill(node, 'balance-pill')
  assert.equal(tips[0].text.includes('API 请求'), false, tips[0].text)
})
