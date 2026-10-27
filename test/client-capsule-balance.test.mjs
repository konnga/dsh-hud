/** 浏览器半用例：账号余额胶囊（formatBalance 的取值规则 + 胶囊的三种存在状态 + 点击刷新）。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  findAll,
  findByAttr,
  hoverPill,
  renderBalancePill,
  renderPill,
  statusFixture,
  textOf,
} from './client-harness.mjs'

/**
 * 从胶囊文本里取出余额那一段（`¥1,234.56`）。
 *
 * 座位里还有 git 胶囊与工作区名，直接 `textOf` 会混进来 —— 限定到 `data-dsh-hud="balance-pill"`。
 */
function balanceText(balance) {
  const node = findByAttr(renderBalancePill(balance), 'balance-pill')
  assert.ok(node, `应当画出余额胶囊，快照 ${JSON.stringify(balance)}`)
  return textOf(node).replace(/\s+/g, '')
}

test('余额胶囊：按 DSH 平台规则格式化金额（零 / 不足一分 / 千分位 / 负值）', () => {
  const cases = [
    // [balance, currency, 期望文本] —— 逐条对齐 `dsh-client-ui-settings-account` 的 formatBalance。
    ['0', 'CNY', '¥0.00'],
    ['0.00', 'CNY', '¥0.00'],
    ['0.001', 'CNY', '<¥0.01'],
    ['0.005', 'USD', '<$0.01'],
    ['0.01', 'CNY', '¥0.01'],
    ['0.1', 'CNY', '¥0.10'],
    ['12', 'CNY', '¥12.00'],
    ['100', 'USD', '$100.00'],
    // 向零截断到两位，不进位：123.456 → 123.45（与平台卡片显示同一个数）。
    ['123.456', 'CNY', '¥123.45'],
    ['-12.345', 'USD', '-$12.34'],
    ['-1', 'CNY', '-¥1.00'],
    ['1234567.89', 'CNY', '¥1,234,567.89'],
    // 负的小额没有"小于"的直觉：进位成 -¥0.01，而不是显示 `-<¥0.01`。
    ['-0.005', 'CNY', '-¥0.01'],
    // 认不出的币种不猜符号：带上币种代码。
    ['7.5', 'EUR', '7.50EUR'],
  ]
  for (const [amount, currency, expected] of cases) {
    const text = balanceText({
      wallets: [{ currency, balance: amount }],
      bonus: [],
      at: Date.now(),
      failed: false,
    })
    assert.ok(text.includes(expected), `${amount} ${currency} 应当显示 ${expected}，实际 ${text}`)
  }
})

test('余额胶囊：币种符号只画一次（早先多画一个字形，屏幕上成了「¥ ¥8.60」）', () => {
  for (const [amount, currency, symbol] of [
    ['8.6', 'CNY', '¥'],
    ['8.6', 'USD', '$'],
  ]) {
    const text = balanceText({
      wallets: [{ currency, balance: amount }],
      bonus: [],
      at: Date.now(),
      failed: false,
    })
    assert.equal(text.split(symbol).length - 1, 1, `${currency} 的符号只该出现一次，实际 ${text}`)
  }
})

test('余额胶囊：右键打开平台用量页（累计消耗 / 本月消耗在那里）', () => {
  const opened = []
  const previous = globalThis.open
  globalThis.open = (url, name) => opened.push({ url, name })
  try {
    const node = renderBalancePill({
      wallets: [{ currency: 'CNY', balance: '8.60' }],
      bonus: [],
      at: Date.now(),
      failed: false,
      usageUrl: 'https://platform.deepseek.com/usage',
    })
    const pill = findByAttr(node, 'balance-pill')
    assert.equal(typeof pill.props.onContextMenu, 'function', '右键要接了链接')
    let prevented = 0
    pill.props.onContextMenu({ preventDefault: () => (prevented += 1) })
    assert.equal(prevented, 1, '接了就要吃掉浏览器自己的右键菜单')
    assert.deepEqual(opened, [{ url: 'https://platform.deepseek.com/usage', name: '_blank' }])

    // 没有链接（更旧的宿主）时：右键什么都不做，也不能吃默认行为（用户还得用浏览器菜单）。
    const bare = findByAttr(
      renderBalancePill({
        wallets: [{ currency: 'CNY', balance: '1' }],
        bonus: [],
        at: Date.now(),
        failed: false,
      }),
      'balance-pill',
    )
    bare.props.onContextMenu({ preventDefault: () => (prevented += 1) })
    assert.equal(prevented, 1, '没有链接就不该 preventDefault')
    assert.equal(opened.length, 1, '没有链接就不该打开任何页面')
  } finally {
    if (previous === undefined) delete globalThis.open
    else globalThis.open = previous
  }
})

test('余额胶囊：与 git 胶囊同住一条 dock 行、排在最后；悬停给出明细与刷新提示', () => {
  const now = Date.now()
  const tips = []
  const node = renderBalancePill(
    {
      wallets: [{ currency: 'CNY', balance: '88.5' }],
      bonus: [
        { currency: 'CNY', balance: '20' },
        { currency: 'CNY', balance: '0' },
      ],
      at: now,
      failed: false,
      usageUrl: 'https://platform.deepseek.com/usage',
    },
    { methods: { showTip: (key, text, rect) => tips.push({ key, text, rect }) } },
  )

  // dock 是竖列：余额必须在**同一条注册**里，否则会另起一整行。
  const dock = findByAttr(node, 'dock')
  assert.ok(dock, 'dock 行要存在')
  const inked = findAll(
    dock,
    (entry) =>
      entry.props &&
      (entry.props['data-dsh-hud'] === 'balance-pill' ||
        entry.props['data-dsh-hud'] === 'pill' ||
        entry.props['data-dsh-hud'] === 'session-timer'),
  )
  assert.deepEqual(
    inked.map((entry) => entry.props['data-dsh-hud']),
    ['pill', 'balance-pill'],
    `余额排在 git 之后、同在一行，实际 ${JSON.stringify(inked.map((e) => e.props['data-dsh-hud']))}`,
  )

  const pill = findByAttr(node, 'balance-pill')
  assert.equal(pill.props.type, 'button', '可点击：点了强制刷新')
  assert.ok(pill.props['aria-label'].includes('balance.title'), '无障碍名走词典 key')
  // 赠送余额只缀一个 `+`（明细在悬停里）。
  assert.ok(textOf(pill).includes('+'), `有赠送余额就该缀 +，实际 ${textOf(pill)}`)

  hoverPill(node, 'balance-pill', { left: 100, top: 300, right: 200 })
  assert.equal(tips.length, 1, '悬停把文案交给 store')
  assert.equal(tips[0].key, 'balance-pill')
  const tip = tips[0].text
  assert.ok(tip.includes('balance.title'), `先说这是什么，实际 ${tip}`)
  assert.ok(tip.includes('¥88.50'), `主钱包金额，实际 ${tip}`)
  assert.ok(tip.includes('balance.bonus') && tip.includes('¥20.00'), `赠送余额，实际 ${tip}`)
  assert.ok(!tip.includes('¥0.00'), '余额为 0 的赠送钱包应当被过滤，实际 ' + tip)
  assert.ok(tip.includes('balance.updated'), `更新时间，实际 ${tip}`)
  assert.ok(!tip.includes('balance.stale'), '没失败就不该说"可能是旧的"，实际 ' + tip)
  // 气泡是读数，不是帮助文档：操作说明（"点一下刷新" / "右键开用量页"）不进悬停 ——
  // 那两行会把五行明细撑成七行，还挤掉真正会变的那几个数。
  assert.equal(
    tip.split('\n').length,
    4,
    `悬停只该有标题 / 金额 / 赠送 / 更新四行，实际 ${JSON.stringify(tip)}`,
  )
})

test('余额胶囊：没数据 / 没登录 / 空钱包都不画；失败时保留上一次的数并标 ?', () => {
  // 三件"没有可展示余额"的事在界面上一视同仁：不占位，也不画 ¥0.00（那会把"读不到"说成"没钱"）。
  for (const balance of [
    null,
    undefined,
    { wallets: [], bonus: [], at: Date.now(), failed: false },
    // 形状不对的快照（老宿主 / 上游改了字段）也不该炸，只是不画。
    { wallets: [{ currency: 1, balance: 2 }], bonus: [], at: Date.now(), failed: false },
    { wallets: [{ currency: 'CNY', balance: 'oops' }], bonus: [], at: Date.now(), failed: false },
  ]) {
    assert.equal(
      findByAttr(renderBalancePill(balance), 'balance-pill'),
      null,
      `不该画胶囊：${JSON.stringify(balance)}`,
    )
  }

  // 刷新失败：数字仍是上一次的（`at` 也停在上一次），但末位 `?` 说明"可能已过期"。
  const stale = findByAttr(
    renderBalancePill({
      wallets: [{ currency: 'USD', balance: '9.99' }],
      bonus: [],
      at: Date.now() - 3600_000,
      failed: true,
    }),
    'balance-pill',
  )
  assert.ok(stale, '有上一次的数字就继续画')
  assert.ok(textOf(stale).includes('$9.99'), `保留上一次的数，实际 ${textOf(stale)}`)
  assert.ok(textOf(stale).includes('?'), `失败要标 ?，实际 ${textOf(stale)}`)
})

test('余额胶囊：点击带 force 立刻重取（不等 5 分钟那条节拍）', () => {
  const calls = []
  const node = renderBalancePill(
    {
      wallets: [{ currency: 'CNY', balance: '5' }],
      bonus: [],
      at: Date.now(),
      failed: false,
    },
    {
      methods: {
        loadBalance: (force) => calls.push({ force: force === true }),
      },
    },
  )
  const pill = findByAttr(node, 'balance-pill')
  pill.props.onClick()
  assert.deepEqual(calls, [{ force: true }], `点击要跳过 TTL，实际 ${JSON.stringify(calls)}`)
})

test('余额胶囊：git 那一侧坏掉（非仓库 / 读取失败）时，余额照样画', () => {
  // 余额是账号级读数，跟工作区里有没有 git 完全无关：git 出错、没仓库都不该把它带走。
  const balance = {
    wallets: [{ currency: 'CNY', balance: '42' }],
    bonus: [],
    at: Date.now(),
    failed: false,
  }
  for (const state of [
    { phase: 'error', errorCode: 'git-failed', status: null },
    { phase: 'ready', status: { repo: null, counts: {} } },
  ]) {
    const node = renderPill({ ...state, balance })
    assert.ok(findByAttr(node, 'balance-pill'), `git 状态 ${state.phase} 下余额该照常出现`)
  }

  // dock 行本身是会话作用域的座位：没有 cwd 时整行都不画（这是框架的语义，不是余额的取舍）。
  assert.equal(
    findByAttr(
      renderPill(
        { phase: 'ready', status: null, cwd: null, balance },
        {
          useSessions: (selector) => selector({ byId: {} }),
          sessionId: null,
        },
      ),
      'dock',
    ),
    null,
    '没有会话/工作区时 dock 行不渲染',
  )
})

test('低余额提醒：低于阈值时加 ⚠ 并把金额染成警示色（默认阈值 10）', () => {
  const withBalance = (amount, currency = 'CNY') =>
    findByAttr(
      renderBalancePill({
        wallets: [{ currency, balance: amount }],
        bonus: [],
        at: Date.now(),
        failed: false,
      }),
      'balance-pill',
    )

  // 低于阈值：`⚠` + 数值带警示类；但数字本身照旧显示（用户要知道具体剩多少）。
  const low = withBalance('8.6')
  assert.ok(textOf(low).includes('⚠'), `低余额要有 ⚠，实际 ${textOf(low)}`)
  assert.ok(textOf(low).includes('¥8.60'), `金额仍要显示，实际 ${textOf(low)}`)
  const lowValue = findAll(low, (node) => typeof node.props?.className === 'string').find((node) =>
    node.props.className.includes('dshh-balanceLow'),
  )
  assert.ok(lowValue, '数值上要带 dshh-balanceLow 类（警示色由样式表给）')

  // 恰好等于阈值不算"低于"（严格小于）。
  const edge = withBalance('10')
  assert.ok(!textOf(edge).includes('⚠'), `10 不该报警，实际 ${textOf(edge)}`)

  // 高于阈值：不报警。
  const ok = withBalance('128.4')
  assert.ok(!textOf(ok).includes('⚠'), `128.4 不该报警，实际 ${textOf(ok)}`)

  // 阈值可以按币种同样套用（USD 也走同一个数字阈值）。
  const usd = withBalance('9.99', 'USD')
  assert.ok(textOf(usd).includes('⚠'), `USD 9.99 也该报警，实际 ${textOf(usd)}`)

  // 提醒只在胶囊上（`⚠` + 颜色），悬停气泡里**不写字**：那里只该有读数。
  const tips = []
  const node = renderBalancePill(
    { wallets: [{ currency: 'CNY', balance: '8.6' }], bonus: [], at: Date.now(), failed: false },
    { methods: { showTip: (key, text) => tips.push({ key, text }) } },
  )
  hoverPill(node, 'balance-pill')
  assert.ok(!/低于|记得充值/.test(tips[0].text), `气泡里不该有低余额文案，实际 ${tips[0].text}`)
})

test('低余额提醒：阈值可被 localStorage 覆盖（dsh-hud.balanceLow），坏值退回默认', () => {
  const previous = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  }
  try {
    const at = (amount) => {
      const node = findByAttr(
        renderBalancePill({
          wallets: [{ currency: 'CNY', balance: amount }],
          bonus: [],
          at: Date.now(),
          failed: false,
        }),
        'balance-pill',
      )
      return textOf(node).includes('⚠')
    }

    // 默认阈值 10：128.4 不报警。
    assert.equal(at('128.4'), false)
    // 把阈值抬到 200：同一个数字就报警了。
    store.set('dsh-hud.balanceLow', '200')
    assert.equal(at('128.4'), true, '阈值抬高后 128.4 应当报警')
    // 写坏的阈值（0 / 负数 / 非数字）退回默认：不该让提醒消失，也不该全都报警。
    for (const bad of ['0', '-5', 'abc', '']) {
      store.set('dsh-hud.balanceLow', bad)
      assert.equal(at('128.4'), false, `阈值 ${JSON.stringify(bad)} 应当退回默认 10`)
      assert.equal(at('5'), true, `阈值 ${JSON.stringify(bad)} 退回默认后 5 仍要报警`)
    }
  } finally {
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  }
})

test('变化量：悬停给出"较上次刷新"的差，金额精确到分（不走浮点）', () => {
  const tips = []
  const balance = {
    wallets: [{ currency: 'CNY', balance: '8.6' }],
    bonus: [],
    at: Date.now(),
    failed: false,
    prev: { wallets: [{ currency: 'CNY', balance: '8.3' }], at: Date.now() - 300_000 },
  }
  const node = renderBalancePill(balance, {
    methods: { showTip: (key, text, rect) => tips.push({ key, text, rect }) },
  })
  hoverPill(node, 'balance-pill')
  const tip = tips[0].text
  // 8.6 - 8.3 在 double 里是 0.2999999999999998；这里必须是干净的 0.30。
  assert.ok(tip.includes('balance.delta'), `要有变化量那一行，实际 ${tip}`)
  assert.ok(tip.includes('+¥0.30'), `精确到分且带正号，实际 ${tip}`)
  // 低余额靠胶囊上的 `⚠` 与警示色表达，气泡里不再复述那句话。
  assert.ok(!tip.includes('balance.low'), `气泡里不该有低余额文案，实际 ${tip}`)
  assert.ok(!/余额低于|记得充值/.test(tip), `气泡里不该有低余额文案，实际 ${tip}`)

  // 消费（余额变小）用负号。
  const spent = []
  hoverPill(
    renderBalancePill(
      {
        wallets: [{ currency: 'CNY', balance: '8.3' }],
        bonus: [],
        at: Date.now(),
        failed: false,
        prev: { wallets: [{ currency: 'CNY', balance: '8.6' }], at: Date.now() - 300_000 },
      },
      { methods: { showTip: (key, text) => spent.push({ key, text }) } },
    ),
    'balance-pill',
  )
  assert.ok(spent[0].text.includes('-¥0.30'), `减少要用负号，实际 ${spent[0].text}`)

  // 没变 / 没有前一份 / 币种对不上：都不画那一行（`-0.00` 这种尤其不该出现）。
  const cases = [
    { at: Date.now(), failed: false, prev: null },
    {
      at: Date.now(),
      failed: false,
      prev: { wallets: [{ currency: 'CNY', balance: '8.6' }], at: Date.now() - 1000 },
    },
    {
      at: Date.now(),
      failed: false,
      prev: { wallets: [{ currency: 'USD', balance: '1' }], at: Date.now() - 1000 },
    },
  ]
  for (const extra of cases) {
    const collected = []
    hoverPill(
      renderBalancePill(
        { wallets: [{ currency: 'CNY', balance: '8.6' }], bonus: [], ...extra },
        { methods: { showTip: (key, text) => collected.push({ key, text }) } },
      ),
      'balance-pill',
    )
    assert.ok(
      !collected[0].text.includes('balance.delta'),
      `这种情况不该有变化量，实际 ${collected[0].text}`,
    )
  }
})

test('dock 行顺序：Git → 工具 → 余额 → 计时（余额在运行时长之前）', () => {
  // 四枚同时在场才看得出顺序。用户明确要求"余额排在运行时长前面"：
  // 余额是会变的"钱"，计时是一直在涨的时长 —— 读数靠前、节拍感靠后。
  const now = Date.now()
  const node = renderPill({
    status: statusFixture(),
    // 工具那一枚：一条正在跑的调用（不然它自己不画）。
    tools: {
      phase: 'ready',
      active: { name: 'bash', callId: 'call-1', startedAt: now - 3000 },
      recent: [],
      counts: [],
      total: 1,
      updatedAt: now,
    },
    // 计时那一枚：`available` + `createdAt` 齐了才画（与 DSH 会话服务的答复同形）。
    sessionTime: {
      sessionId: 'session-1',
      value: {
        available: true,
        sessionId: 'session-1',
        createdAt: now - 134 * 60_000,
        turns: 27,
        steps: 380,
        llmMs: 5_355_113,
        toolMs: 1_389_523,
        now: now,
      },
    },
    balance: {
      wallets: [{ currency: 'CNY', balance: '128.40' }],
      bonus: [],
      at: now,
      failed: false,
    },
  })
  const dock = findByAttr(node, 'dock')
  assert.ok(dock, 'dock 行要存在')
  const order = findAll(
    dock,
    (entry) =>
      entry.props &&
      ['pill', 'tools-pill', 'balance-pill', 'session-timer'].includes(entry.props['data-dsh-hud']),
  ).map((entry) => entry.props['data-dsh-hud'])

  assert.deepEqual(
    order,
    ['pill', 'tools-pill', 'balance-pill', 'session-timer'],
    `顺序应当是 Git → 工具 → 余额 → 计时，实际 ${JSON.stringify(order)}`,
  )
})
