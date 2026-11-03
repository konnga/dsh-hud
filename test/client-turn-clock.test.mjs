/**
 * 「本轮结束时刻」后面补耗时：`17:30 · 1 分 3 秒`。
 *
 * 这里用一棵最小的假 DOM 复刻产品那两处结构（动作栏里的 `_timeEnd`、过程行里的
 * `_label` + `_durationNumber`），验证：抄的是官方那段文字、幂等、开关能撤掉、
 * 官方不给耗时（已停止 / 处理失败）时我们也不显示。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mountClient } from './client-harness.mjs'

const key = 'dsh-hud:display-settings'

/** 最小元素：够 `querySelector` / `insertBefore` / 文本比对用。 */
function element(tag = 'div') {
  const node = {
    tagName: tag,
    nodeType: 1,
    textContent: '',
    className: '',
    attributes: {},
    children: [],
    parentNode: null,
    firstChild: null,
    get nextSibling() {
      if (this.parentNode === null) return null
      const index = this.parentNode.children.indexOf(this)
      return index < 0 ? null : (this.parentNode.children[index + 1] ?? null)
    },
    setAttribute(name, value) {
      this.attributes[name] = value
    },
    getAttribute(name) {
      return this.attributes[name] ?? null
    },
    removeAttribute(name) {
      delete this.attributes[name]
    },
    appendChild(child) {
      this.children.push(child)
      child.parentNode = this
      return child
    },
    insertBefore(child, reference) {
      const index = reference === null ? this.children.length : this.children.indexOf(reference)
      this.children.splice(index < 0 ? this.children.length : index, 0, child)
      child.parentNode = this
      return child
    },
    removeChild(child) {
      const index = this.children.indexOf(child)
      if (index < 0) throw new Error('not a child')
      this.children.splice(index, 1)
      child.parentNode = null
      return child
    },
    matches(selector) {
      const attribute = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector)
      if (attribute) {
        const value = this.attributes[attribute[1]]
        if (attribute[2] === undefined) return value !== undefined
        return value === attribute[2]
      }
      const contains = /^\[class\*="([^"]+)"\]$/.exec(selector)
      if (contains) return String(this.className).includes(contains[1])
      return false
    },
    querySelectorAll(selector) {
      const found = []
      const walk = (item) => {
        for (const child of item.children) {
          if (child.matches?.(selector)) found.push(child)
          walk(child)
        }
      }
      walk(this)
      return found
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null
    },
  }
  return node
}

/**
 * 装一棵「一轮刚结束」的页面：动作栏里有结束时刻，过程行里有官方算好的耗时。
 * @param options - `duration` 为 `null` 时模拟已停止 / 处理失败（官方不给耗时）。
 */
function page(options = {}) {
  const tail = element()
  tail.setAttribute('data-turn-tail', '3')
  const actions = element()
  tail.appendChild(actions)
  const clock = element('span')
  clock.className = 'tii1Sq_timeEnd'
  clock.textContent = '17:30'
  actions.appendChild(clock)

  const process = element('button')
  process.setAttribute('data-turn-process', '3')
  const label = element('span')
  label.className = 'gTO55a_label'
  process.appendChild(label)

  const duration = options.duration === undefined ? '1 分 3 秒' : options.duration
  const prefix = '已完成，用时 '
  if (duration === null) {
    label.textContent = '已停止'
    label.firstChild = { nodeType: 3, textContent: '已停止' }
  } else {
    const numbers = [element('span'), element('span')]
    for (const number of numbers) number.className = 'gTO55a_durationNumber'
    label.children = numbers
    label.textContent = prefix + duration
    label.firstChild = { nodeType: 3, textContent: prefix }
  }
  return { tail, actions, clock, process, label }
}

/** 接上假 DOM，并拿到我们那个 1 秒节拍。 */
function fixture(options = {}) {
  const mounted = mountClient()
  const view = page(options)
  const created = []
  mounted.documentStub.querySelectorAll = (selector) => {
    if (selector === '[data-turn-tail]') return [view.tail]
    // 真实 document 能找到我们挂的节点；卸载清理正是靠这条选择器。
    if (selector === '[data-dsh-hud="turn-duration"]')
      return view.actions.children.filter(
        (child) => child.attributes['data-dsh-hud'] === 'turn-duration',
      )
    return []
  }
  mounted.documentStub.querySelector = (selector) =>
    selector === 'button[data-turn-process="3"]' ? view.process : null
  mounted.documentStub.createElement = (tag) => {
    const node = element(tag)
    created.push(node)
    return node
  }
  const tick = () => {
    const timer = mounted.intervals.findLast((item) => item.ms === 1000 && !item.cancelled)
    assert.ok(timer, '应有一个 1 秒节拍在扫页脚')
    timer.callback()
  }
  return { mounted, view, tick, created }
}

/** 动作栏里我们挂的那颗节点。 */
function owned(view) {
  return view.actions.children.find((child) => child.attributes['data-dsh-hud'] === 'turn-duration')
}

test('把过程行上官方算好的耗时抄到结束时刻后面，且只抄一次', () => {
  const f = fixture()
  try {
    f.tick()
    const span = owned(f.view)
    assert.ok(span, '结束时刻后面应补上耗时')
    assert.equal(span.textContent, '· 1 分 3 秒')
    assert.equal(span.className, 'dshh-turnDuration')
    assert.equal(
      f.view.actions.children.indexOf(span),
      f.view.actions.children.indexOf(f.view.clock) + 1,
      '紧跟在时刻后面',
    )
    f.tick()
    assert.equal(
      f.view.actions.children.filter(
        (child) => child.attributes['data-dsh-hud'] === 'turn-duration',
      ).length,
      1,
      '重复扫描不能补出第二颗',
    )
  } finally {
    f.mounted.dispose()
  }
})

test('官方不给耗时（已停止 / 处理失败）时我们也不显示', () => {
  const f = fixture({ duration: null })
  try {
    f.tick()
    assert.equal(owned(f.view), undefined, '没有耗时就不该补空壳')
  } finally {
    f.mounted.dispose()
  }
})

test('「显示每轮耗时」关掉就撤掉，打开再补回来', () => {
  const f = fixture()
  try {
    f.tick()
    assert.ok(owned(f.view))
    f.mounted.dispatch('storage', { key, newValue: JSON.stringify({ showTurnDuration: false }) })
    f.tick()
    assert.equal(owned(f.view), undefined, '关掉后不留节点')
    f.mounted.dispatch('storage', { key, newValue: JSON.stringify({ showTurnDuration: true }) })
    f.tick()
    assert.ok(owned(f.view), '再打开应补回来')
  } finally {
    f.mounted.dispose()
  }
})

test('和「显示用时」互不影响：关掉思考行的用时，这截耗时仍在', () => {
  const f = fixture()
  try {
    f.tick()
    assert.ok(owned(f.view))
    f.mounted.dispatch('storage', { key, newValue: JSON.stringify({ showElapsed: false }) })
    f.tick()
    assert.ok(owned(f.view), '两个开关各管一段文字')
  } finally {
    f.mounted.dispose()
  }
})

test('卸载时把自己挂的节点和节拍一起收掉', () => {
  const f = fixture()
  f.tick()
  assert.ok(owned(f.view))
  f.mounted.dispose()
  assert.equal(owned(f.view), undefined, '页面上不能留下孤儿节点')
  assert.equal(
    f.mounted.intervals.filter((item) => item.ms === 1000 && !item.cancelled).length,
    0,
    '节拍也要停',
  )
})
