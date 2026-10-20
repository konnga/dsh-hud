/** 浏览器半用例：tip（4 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMiniReact } from './mini-react.mjs'
import { cssRule, flatText, mountClient, renderSeat, textOf } from './client-harness.mjs'

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
