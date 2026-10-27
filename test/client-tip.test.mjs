/** 浏览器半用例：tip（4 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMiniReact } from './mini-react.mjs'
/** 取真词典的 `t`（缺键回键名，漏词会在断言里露出来）。 */
function translator() {
  const registered = mountClient().dictionaries.find(
    (item) => item.dictionary?.zh !== undefined && item.dictionary.en !== undefined,
  )
  const zh = registered.dictionary.zh
  return (key, params) => {
    let text = zh[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace('{' + name + '}', String(value))
    }
    return text
  }
}

const T = translator()

import { readFileSync } from 'node:fs'
import {
  cssRule,
  flatText,
  hoverPill,
  mountClient,
  renderPill,
  renderProviderPill,
  renderSeat,
  renderTimerPill,
  renderTools,
  statusFixture,
  textOf,
} from './client-harness.mjs'

test('悬停气泡：没提示时渲染 null，有提示时贴在那枚胶囊上方', () => {
  assert.equal(renderSeat('dsh-hud-pill-tip', { tip: null }, {}, {}), null)

  const node = renderSeat(
    'dsh-hud-pill-tip',
    {},
    {
      tip: {
        key: 'session-timer',
        text: '第一行\n第二行',
        rect: { left: 300, top: 400, right: 420 },
      },
    },
    {},
  )
  assert.equal(node.props['data-dsh-hud'], 'pill-tip')
  assert.equal(node.props.role, 'tooltip')
  // 断言**去空白后的内容**：harness 的 textOf 会在相邻子元素间插空格、也会把换行拍平，
  // 而气泡靠 CSS 的 `white-space:pre-wrap` 保留多行结构 —— 这里只看"两行文字都在"，
  // 换行是由样式保证的（下面单独断言那条规则存在）。
  assert.equal(flatText(node), '第一行第二行')
  // 横向夹在视口内、向上贴住锚点（用 bottom 定位：不用先量自己的高度）
  assert.equal(node.props.style.left, '300px')
  assert.equal(node.props.style.bottom, `${800 - 400 + 6}px`)
})

test('悬停气泡：横向越界会被夹回视口内（贴到右边缘的胶囊也不会顶出去）', () => {
  const node = renderSeat(
    'dsh-hud-pill-tip',
    {},
    {
      tip: { key: 'pill', text: 'x', rect: { left: 1190, top: 200, right: 1200 } },
    },
    {},
  )
  assert.equal(node.props.style.left, `${1200 - 428}px`, '夹到"视口宽 − 气泡最大宽 − 边距"')
})

test('悬停气泡：样式里必须留下"多行 + 不挡指针"这两条（否则提示会挤成一行、还会挡住指针）', () => {
  const rule = cssRule('.dshh-tip')
  assert.ok(rule, '.dshh-tip 规则必须成立')
  assert.ok(rule.body.includes('white-space:pre-wrap'), '多行文案靠它保住结构')
  assert.ok(rule.body.includes('pointer-events:none'), '气泡永远不许挡指针')
  assert.ok(rule.body.includes('position:fixed'), '浮在 dock 行之外')
  assert.ok(rule.body.includes('max-width:420px'), '太长的文案要换行而不是铺满屏')
})

test('悬停提示：showTip 写进快照、hideTip 清掉；旧的 leave 不会关掉新的提示', () => {
  const mini = createMiniReact()
  const bundle = mountClient({ ReactImpl: mini.React })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store

  store
    .tipHandlers('pill', () => '甲')
    .onPointerEnter({
      currentTarget: { getBoundingClientRect: () => ({ left: 10, top: 20, right: 90 }) },
    })
  assert.equal(store.getSnapshot().tip.text, '甲')
  assert.equal(store.getSnapshot().tip.key, 'pill')
  assert.deepEqual(store.getSnapshot().tip.rect, { left: 10, top: 20, right: 90 })

  // 指针从甲移到乙：先 enter 乙、后 leave 甲 —— 甲那条 late leave 不该把乙关掉。
  store
    .tipHandlers('session-timer', () => '乙')
    .onPointerEnter({
      currentTarget: { getBoundingClientRect: () => ({ left: 1, top: 2, right: 3 }) },
    })
  store.tipHandlers('pill', () => '甲').onPointerLeave()
  assert.equal(store.getSnapshot().tip.text, '乙', '旧 leave 不许关掉新提示')

  store.tipHandlers('session-timer', () => '乙').onPointerLeave()
  assert.equal(store.getSnapshot().tip, null)

  // 空文案不显示（宁可不弹，也不要一个空气泡）
  store
    .tipHandlers('pill', () => '')
    .onPointerEnter({
      currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 0 }) },
    })
  assert.equal(store.getSnapshot().tip, null)
})

/* ------------------------------------------- 气泡的两种颜色（用户要的"数字亮、标签灰"） */

test('气泡：余额那几行拆成「标签灰 + 数字亮」两段，抬头与时间整行次要色', () => {
  const captured = []
  const ledger = {
    mode: 'provider',
    provider: 'relay-a',
    reason: null,
    token: { ref: 'RELAY_A_ACCESS_TOKEN', configured: true },
    balance: {
      provider: 'relay-a',
      kind: 'relay',
      currency: 'USD',
      remaining: '742.23',
      usedAccount: '642.02',
      usedKey: '539.94',
      requests: 4485,
      placeholderLimit: false,
      wallets: [],
      bonus: [],
      at: Date.now(),
    },
  }
  const node = renderProviderPill(ledger, {
    t: T,
    methods: { showTip: (key, text, rect, lines) => captured.push(lines) },
  })
  hoverPill(node, 'balance-pill')
  const lines = captured[0]
  assert.ok(Array.isArray(lines), '气泡内容应当是逐行结构（渲染才能力分标签/数值两种颜色）')

  // 抬头：站名整行次要色。
  assert.deepEqual(lines[0], { text: 'relay-a', tone: 'muted' })
  // 四行读数：标签与数值分开，数值各带**语义色**（用户要的"重要数字用彩色"）。
  const reading = lines.filter((line) => line.label !== undefined)
  assert.deepEqual(
    reading.map((line) => line.label),
    ['余额', 'API 请求', '账号已用', '本 Key 已用'],
  )
  assert.deepEqual(
    reading.map((line) => line.tone),
    ['success', 'accent', 'warn', 'warn'],
    '余额绿（还剩多少）/ 请求数品牌蓝（次数）/ 两个已用琥珀（花掉多少）',
  )
  for (const line of reading) {
    assert.ok(line.value !== undefined && line.value !== '', `${line.label} 要有数值`)
  }
  // 时间整行次要色（它不是读数）。
  assert.equal(lines.at(-1).tone, 'muted')
})

test('气泡：标签与数值在拼平文本里有一个空格（否则日志里是「余额$742.23」）', () => {
  // 屏幕上是 CSS 的 margin，拼平之后没有间距 —— 补一个空格，读起来才是人话。
  const captured = []
  const node = renderProviderPill(
    {
      mode: 'provider',
      provider: 'relay-a',
      reason: null,
      token: { ref: 'RELAY_A_ACCESS_TOKEN', configured: true },
      balance: {
        provider: 'relay-a',
        kind: 'relay',
        currency: 'USD',
        remaining: '742.23',
        usedAccount: '642.02',
        usedKey: '539.94',
        requests: 4485,
        placeholderLimit: false,
        wallets: [],
        bonus: [],
        at: Date.now(),
      },
    },
    { t: T, methods: { showTip: (key, text) => captured.push(text) } },
  )
  hoverPill(node, 'balance-pill')
  assert.ok(captured[0].includes('余额 $742.23'), captured[0])
  assert.ok(captured[0].includes('API 请求 4,485'), captured[0])
})

test('气泡：样式表给标签/数值/次要行各一条规则（颜色由主题变量驱动）', () => {
  // 断言的是"类名与规则存在且用主题变量"，不是具体色值 —— 深色/浅色主题各取各的。
  const label = cssRule('.dshh-tipLabel')
  const value = cssRule('.dshh-tipValue')
  const muted = cssRule('.dshh-tipMuted')
  assert.ok(label, '缺 .dshh-tipLabel')
  assert.ok(value, '缺 .dshh-tipValue')
  assert.ok(muted, '缺 .dshh-tipMuted')
  assert.match(label.body, /--dsw-alias-label-secondary/, '标签用次要文字色')
  assert.match(value.body, /--dsw-alias-label-primary/, '数值用主文字色')
  assert.match(muted.body, /--dsw-alias-label-tertiary/, '整行次要信息用更淡的色')
})

/* ------------------------------------------------- 所有气泡里的数字都要高亮 */

/** 取一次悬停交给 store 的逐行结构。 */
function tipLinesOf(node, attr, rect = { left: 100, top: 300, right: 190 }) {
  const captured = []
  const mounted = mountClient({
    rpc: () => Promise.resolve({ ok: true, value: null }),
  })
  void mounted
  const target = findByAttr(node, attr)
  assert.ok(target, `找不到 ${attr}`)
  target.props.onPointerEnter({ currentTarget: { getBoundingClientRect: () => rect } })
  void captured
  return captured
}

/** 从逐行结构里取出"被染色的文字"（行内分段 + label/value 的数值）。 */
function tonedTexts(lines) {
  const out = []
  for (const line of lines) {
    if (Array.isArray(line.segments)) {
      for (const segment of line.segments) if (segment.tone) out.push(segment.text)
    } else if (line.value !== undefined && line.tone === undefined) {
      out.push(line.value)
    }
  }
  return out
}

test('计时气泡：时长/轮/步被高亮，创建时间不染（满屏都是色等于没有重点）', () => {
  const box = []
  const node = renderTimerPill(
    {
      available: true,
      sessionId: 'session-1',
      createdAt: Date.parse('2026-10-20T04:41:00Z'),
      turns: 62,
      steps: 1469,
      llmMs: (3 * 60 + 24) * 60000,
      toolMs: 50 * 60000,
      now: Date.now(),
    },
    {
      t: T,
      methods: { showTip: (key, text, rect, lines) => box.push({ text, lines }) },
    },
  )
  hoverPill(node, 'session-timer')
  const toned = tonedTexts(box[0].lines)
  assert.deepEqual(toned, ['3h 24m', '50m', '62', '1469'], `实际高亮：${toned.join(' / ')}`)
  // 句式没变：仍然是一句话，用 `·` 连起来（用户只要求高亮，不要求改排版）。
  assert.equal(box[0].lines.length, 1, '仍然是一整行')
  assert.ok(box[0].text.includes('·'), '仍然用 · 连句')
  // 时间戳不上色：它出现在同一行里，但不在高亮集合中。
  assert.equal(box[0].text.includes('2026-10-20'), true, '创建时间仍在句子里（只是不染色）')
})

test('工具气泡：总次数、各工具次数、逐条耗时都被高亮', () => {
  const box = []
  const node = renderTools(
    {
      tools: {
        phase: 'ready',
        active: null,
        total: 12,
        counts: [
          { name: 'bash', count: 7 },
          { name: 'read', count: 5 },
        ],
        recent: [{ name: 'bash', ok: true, ms: 1200, summary: 'pnpm test' }],
        skills: [{ name: 'verify', count: 2, ok: true }],
        updatedAt: Date.now(),
      },
    },
    { t: T, methods: { showTip: (key, text, rect, lines) => box.push({ text, lines }) } },
  )
  hoverPill(node, 'tools-pill')
  const toned = tonedTexts(box[0].lines)
  assert.ok(toned.includes('12'), `总次数要亮，实际 ${toned.join(' / ')}`)
  assert.ok(toned.includes('×7'), `各工具次数要亮，实际 ${toned.join(' / ')}`)
  assert.ok(toned.includes('×2'), `技能次数要亮，实际 ${toned.join(' / ')}`)
  assert.ok(toned.includes('1.2s'), `逐条耗时也要亮，实际 ${toned.join(' / ')}`)
})

test('Git 气泡：改动计数被高亮，路径不染（路径染色等于整行变色）', () => {
  const box = []
  const node = renderPill(
    { status: statusFixture() },
    { t: T, methods: { showTip: (key, text, rect, lines) => box.push({ text, lines }) } },
  )
  hoverPill(node, 'pill')
  const lines = box[0].lines
  const toned = tonedTexts(lines)
  // 每个非零改动类型都要有一个被染色的数字。
  for (const count of toned) assert.match(count, /^\d+$/, `高亮的应当是纯数字：${count}`)
  assert.ok(toned.length > 0, '至少有改动计数被高亮')
  // cwd 那一行整行次要色，不含高亮段。
  const cwdLine = lines.find((line) => line.tone === 'muted' && !line.segments)
  assert.ok(cwdLine, '路径走整行次要色')
})

test('emphasize：长串优先匹配，未命中的部分原样保留，没有命中就退化成一段', () => {
  // 它只是内部助手（不在插件导出面上），所以从构建产物里取出真代码来跑 ——
  // 保证测的是浏览器里跑的那一份，而不是这里抄的一份。
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const body = /function emphasize\(text, readings, tone = "accent"\) \{[\s\S]*?\n\}/.exec(source)
  assert.ok(body, '产物里找不到 emphasize')
  const emphasize = new Function(body[0] + '\nreturn emphasize;')()
  // 单独验这个助手：它决定"哪几个字被染色"，错一位就是屏幕上多染一段。
  const segments = emphasize('模型 3h 24m、工具 50m · 62 轮', ['3h 24m', '50m', '62', '3h'])
  assert.deepEqual(
    segments.map((segment) => segment.text),
    ['模型 ', '3h 24m', '、工具 ', '50m', ' · ', '62', ' 轮'],
    '长的先匹配，短的不该把长的切开',
  )
  assert.deepEqual(
    segments.filter((segment) => segment.tone).map((segment) => segment.text),
    ['3h 24m', '50m', '62'],
  )
  // 没有命中：退化成一段普通文字（不能返回空数组把整行吞掉）。
  assert.deepEqual(emphasize('没有数字', []), [{ text: '没有数字' }])
  // 空串同样安全。
  assert.deepEqual(emphasize('', ['1']), [{ text: '' }])
})
