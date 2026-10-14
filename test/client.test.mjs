import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createMiniReact } from './mini-react.mjs'

/**
 * 浏览器半的冒烟测试：在没有浏览器的情况下评估 bundle 主体，
 * 验证模块表契约（id / factory）、两条座位注册，以及交互路径。
 *
 * 这里用假 React 与假 DOM —— 被测的是插件面、注册协议与事件接线，不是像素结果。
 * 交互测试可注入 `test/mini-react.mjs` 的运行时，让 useState/useEffect 真的生效。
 */
function loadBundle(options = {}) {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  const registry = {}
  const styles = []
  const listeners = new Map()
  const intervals = []

  const React = options.ReactImpl ?? {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
  }

  const windowStub = {
    __ModuleLoader__: { load: definition => { registry.definition = definition } },
    innerWidth: 1200,
    innerHeight: 800,
    localStorage: {
      values: new Map(),
      getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null
      },
      setItem(key, value) {
        this.values.set(key, value)
      },
    },
    addEventListener(name, listener, opts) {
      const list = listeners.get(name) ?? []
      list.push({ listener, opts })
      listeners.set(name, list)
    },
    removeEventListener(name, listener) {
      const list = listeners.get(name) ?? []
      listeners.set(name, list.filter(entry => entry.listener !== listener))
    },
    setInterval: (callback, ms) => { intervals.push({ callback, ms }); return intervals.length },
    clearInterval: () => {},
  }

  const documentStub = {
    visibilityState: 'visible',
    createElement: () => ({ textContent: '', attributes: {}, parentNode: null, setAttribute(name, value) { this.attributes[name] = value } }),
    head: { appendChild: (element) => { styles.push(element); element.parentNode = { removeChild() {} } } },
  }

  const requireModule = (name) => {
    if (name === 'react') return React
    throw new Error(`unexpected module: ${name}`)
  }

  // bundle 主体是脚本：跑在受控的 window/document 下，它只做一次 self-register。
  new Function('window', 'document', 'require', source)(windowStub, documentStub, requireModule)

  /** 触发某个 window 事件名上的全部监听（模拟浏览器派发）。 */
  const dispatch = (name, event) => {
    for (const entry of listeners.get(name) ?? []) entry.listener(event)
  }

  return { registry, styles, listeners, intervals, React, requireModule, windowStub, dispatch }
}

/** 用假 ctx 调 apply，捕获座位的注册与副作用标签。 */
function mountClient(options = {}) {
  const bundle = loadBundle(options)
  assert.ok(bundle.registry.definition, 'bundle 必须先向 __ModuleLoader__ 注册自己')

  const exported = bundle.registry.definition.factory(bundle.requireModule)
  const registrations = []
  const labels = []
  const ctx = {
    effect(fn, label) {
      labels.push(label)
      return fn()
    },
    locale: { register: () => () => {} },
    slots: {
      inject(_key, callback) {
        callback()
        return () => {}
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }
  exported.apply(ctx)

  const components = Object.fromEntries(registrations.map(entry => [entry.options.id, entry.component]))
  return { ...bundle, exported, registrations, components, labels }
}

/**
 * 递归收集渲染树里的文本节点。
 *
 * 假 React 不会自己渲染函数组件，所以 `type` 是函数的节点要手动调用 ——
 * 这样覆盖到的是真实子组件（CountChips / ChangeList），而不是它们的占位。
 */
function collectText(node, out = [], depth = 0) {
  if (depth > 20 || node === null || node === undefined || node === false || node === true) return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out, depth + 1)
    return out
  }
  if (typeof node === 'object') {
    if (typeof node.type === 'function') {
      collectText(node.type({ ...node.props, children: node.children }), out, depth + 1)
      return out
    }
    for (const child of node.children || []) collectText(child, out, depth + 1)
  }
  return out
}

/** 渲染成一行文本，便于断言。 */
function textOf(node) {
  return collectText(node).join(' ').replace(/\s+/g, ' ').trim()
}

/** 按 data-dsh-hud 属性找出节点（同样展开函数组件）。 */
function findByAttr(node, value, depth = 0) {
  if (depth > 20 || node === null || typeof node !== 'object') return null
  if (typeof node.type === 'function') return findByAttr(node.type({ ...node.props, children: node.children }), value, depth + 1)
  if (node.props && node.props['data-dsh-hud'] === value) return node
  for (const child of node.children || []) {
    const found = findByAttr(child, value, depth + 1)
    if (found) return found
  }
  return null
}

/** 假 store：组件只通过 getSnapshot/subscribe 读它。 */
function fakeStore(state) {
  return {
    getSnapshot: () => state,
    subscribe: () => () => {},
    bindSession: () => {},
    refresh: () => {},
    openPanel: () => {},
    togglePanel: () => {},
    movePanel: () => {},
    commitPanel: () => {},
    resetPanel: () => {},
  }
}

const T = key => key

function statusFixture(overrides = {}) {
  return {
    repo: '/Users/me/project',
    branch: 'main',
    detached: false,
    oid: 'abc1234',
    upstream: 'origin/main',
    ahead: 1,
    behind: 2,
    dirty: true,
    counts: { modified: 2, added: 1, deleted: 0, renamed: 0, copied: 0, typeChanged: 0, untracked: 1, conflicted: 0 },
    changes: [
      { status: 'M', index: 'M', worktree: '.', path: 'src/a.ts', file: 'src/a.ts', origFile: null },
      { status: '?', index: '.', worktree: '?', path: 'new file.txt', file: 'new file.txt' },
    ],
    truncated: false,
    ...overrides,
  }
}

/**
 * 渲染一个座位。
 * @param id - 座位 id。
 * @param defaults - store 快照的默认值。
 * @param state - 覆盖快照字段。
 * @param options - `methods` 覆盖 store 方法，其余作为组件 props。
 */
function renderSeat(id, defaults, state = {}, options = {}) {
  const { components } = mountClient()
  const { methods = {}, ...props } = options
  return components[id]({ t: T, store: { ...fakeStore({ ...defaults, ...state }), ...methods }, ...props })
}

function renderPill(state = {}, options = {}) {
  return renderSeat('dsh-hud-pill', {
    phase: 'ready',
    sessionId: 'session-1',
    cwd: '/Users/me/project',
    panelOpen: false,
    status: statusFixture(),
  }, state, {
    sessionId: 'session-1',
    useSessions: selector => selector({ byId: { 'session-1': { cwd: '/Users/me/project' } } }),
    ...options,
  })
}

function renderPanel(state = {}, options = {}) {
  return renderSeat('dsh-hud-panel', {
    phase: 'ready',
    sessionId: 'session-1',
    cwd: '/Users/me/project',
    panelOpen: true,
    status: statusFixture(),
  }, state, options)
}

test('bundle 以 dsh.client 契约注册自己', () => {
  const { registry } = loadBundle()
  assert.equal(registry.definition.id, 'dsh-hud')
  assert.equal(typeof registry.definition.factory, 'function')
})

test('客户端插件面声明 apply 与三个硬依赖服务', () => {
  const { registry, requireModule } = loadBundle()
  const exported = registry.definition.factory(requireModule)
  assert.equal(typeof exported.apply, 'function')
  assert.deepEqual(exported.inject, ['slots', 'connection', 'locale'])
})

test('apply 注册胶囊与面板两个座位，位置与作用域都不重复', () => {
  const { registrations } = mountClient()

  assert.equal(registrations.length, 2, '应当只注册两条座位')
  const byId = Object.fromEntries(registrations.map(entry => [entry.options.id, entry.options]))
  assert.deepEqual(Object.keys(byId).sort(), ['dsh-hud-panel', 'dsh-hud-pill'])

  assert.equal(byId['dsh-hud-panel'].name, 'shell.overlay', '面板坐在 root 作用域的浮动层')
  assert.equal(byId['dsh-hud-pill'].name, 'conversation.input.dock', '胶囊坐在会话作用域的 dock 行')
  for (const options of Object.values(byId)) {
    assert.equal(options.locale, 'dshHud', '两个座位都要拿到本插件的词典')
  }

  for (const entry of registrations) {
    assert.equal(typeof entry.component, 'function')
    // inject 面必须交出共享 store：两个座位看到同一份事实。
    const injected = entry.options.inject('session-1')
    assert.ok(injected.store, `${entry.options.id} 必须拿到共享 store`)
  }
  // 会话作用域的座位要从 inject 参数带出 sessionId。
  assert.equal(byId['dsh-hud-pill'].inject('session-1').sessionId, 'session-1')
})

test('apply 装上词典、自有样式与唯一一个轮询定时器', () => {
  const { styles, labels, intervals, listeners } = mountClient()

  assert.ok(labels.includes('dsh-hud: dictionaries'))
  assert.ok(labels.includes('dsh-hud: styles'))
  assert.ok(labels.includes('dsh-hud: status poll'))
  assert.ok(labels.includes('dsh-hud: focus refresh'))
  assert.equal(styles.length, 1, '只应插入一份自有样式表')
  assert.equal(styles[0].attributes['data-dsh-hud'], 'styles')
  assert.ok(styles[0].textContent.includes('.dshh-panel'), '样式表要覆盖自己的类名')
  assert.ok(styles[0].textContent.includes('--dsw-alias-'), '配色走主题令牌')
  assert.equal(intervals.length, 1, '只应有一个轮询定时器')
  assert.equal(intervals[0].ms, 8000)
  assert.ok(listeners.has('focus'), '需要 focus 时补一次刷新')
})

/* ------------------------------------------------------------ 渲染逻辑 */

test('胶囊：脏分支带上星号、领先落后与改动总数', () => {
  const text = textOf(renderPill())
  assert.ok(text.includes('⎇ main*'), `期望分支摘要，实际 ${JSON.stringify(text)}`)
  assert.ok(text.includes('↑1'), '领先数')
  assert.ok(text.includes('↓2'), '落后数')
  assert.ok(text.includes('· 4'), '改动总数 = 2 修改 + 1 新增 + 1 未跟踪')
})

test('胶囊：干净仓库不带星号也不带计数', () => {
  const text = textOf(renderPill({
    status: statusFixture({ dirty: false, ahead: 0, behind: 0, counts: { modified: 0, added: 0, deleted: 0, renamed: 0, copied: 0, typeChanged: 0, untracked: 0, conflicted: 0 } }),
  }))
  assert.equal(text, '⎇ main')
})

test('胶囊：非仓库、读取中、失败三种状态各有文案', () => {
  assert.ok(textOf(renderPill({ status: { repo: null } })).includes('pill.notRepo'))
  assert.ok(textOf(renderPill({ phase: 'loading', status: null })).includes('pill.loading'))
  assert.ok(textOf(renderPill({ phase: 'error', errorCode: 'timeout', status: null })).includes('pill.error'))
})

test('胶囊：未绑定工作区或不是主视图时不渲染', () => {
  const { components } = mountClient()
  const base = {
    t: T,
    sessionId: 'session-1',
    store: fakeStore({ phase: 'loading', sessionId: 'session-1', cwd: null, panelOpen: false, status: null }),
  }

  const withoutCwd = components['dsh-hud-pill']({
    ...base,
    useSessions: selector => selector({ byId: { 'session-1': {} } }),
  })
  assert.equal(withoutCwd, null, '没有 cwd 就不该有胶囊')

  const embedded = components['dsh-hud-pill']({
    ...base,
    useSessions: selector => selector({ byId: { 'session-1': { cwd: '/x', retainedBy: { mainView: 0 } } } }),
  })
  assert.equal(embedded, null, '右栏嵌入式会话（子会话 chat）不驱动共享面板')
})

test('胶囊：点击开关面板', () => {
  let toggled = 0
  const node = renderPill({}, { methods: { togglePanel: () => { toggled += 1 } } })
  node.props.onClick()
  assert.equal(toggled, 1)
})

test('面板：收起时渲染 null，不留挡住输入框的气泡', () => {
  assert.equal(renderPanel({ panelOpen: false }), null)
})

test('面板：正常状态列出计数与改动清单', () => {
  const node = renderPanel()
  assert.ok(findByAttr(node, 'panel'), '面板根节点应带 data-dsh-hud="panel"')

  const text = textOf(node)
  assert.ok(text.includes('panel.title'))
  assert.ok(text.includes('main'), '标题栏显示分支')
  assert.ok(text.includes('/Users/me/project'), '显示仓库路径')
  assert.ok(text.includes('count.modified 2'), `期望已修改计数，实际 ${JSON.stringify(text)}`)
  assert.ok(text.includes('count.added 1'))
  assert.ok(text.includes('count.untracked 1'))
  assert.ok(!text.includes('count.deleted'), '零值计数不渲染')
  assert.ok(text.includes('src/a.ts'), '改动清单列出路径')
  assert.ok(text.includes('new file.txt'), '含空格的路径原样保留')
  assert.ok(text.includes('panel.readonly'), '底栏声明只读')
})

test('面板：干净仓库给出明确空状态', () => {
  const text = textOf(renderPanel({
    status: statusFixture({ dirty: false, ahead: 0, behind: 0, changes: [], counts: { modified: 0, added: 0, deleted: 0, renamed: 0, copied: 0, typeChanged: 0, untracked: 0, conflicted: 0 } }),
  }))
  assert.ok(text.includes('panel.clean'))
})

test('面板：非仓库、未绑定、读取中与失败各有文案', () => {
  assert.ok(textOf(renderPanel({ status: { repo: null } })).includes('panel.notRepo'))
  assert.ok(textOf(renderPanel({ cwd: null, status: null })).includes('panel.noSession'))
  assert.ok(textOf(renderPanel({ phase: 'loading', status: null })).includes('panel.loading'))
})

test('面板：宿主半的失败码翻译成本地化文案', () => {
  for (const [code, key] of [['timeout', 'err.timeout'], ['no-cwd', 'err.no-cwd'], ['git-missing', 'err.git-missing'], ['invalid-cwd', 'err.invalid-cwd'], ['transport', 'err.transport']]) {
    assert.ok(textOf(renderPanel({ phase: 'error', errorCode: code, status: null })).includes(key), `${code} → ${key}`)
  }
  // 认不出的码回退到通用文案，而不是把机器码丢给用户。
  assert.ok(textOf(renderPanel({ phase: 'error', errorCode: 'weird', status: null })).includes('err.git-failed'))
})

test('面板：锚定在输入框上方，未拖动时不写死坐标', () => {
  const node = renderPanel()
  assert.equal(node.props.style.position, 'fixed')
  assert.equal(node.props.style.bottom, 168)
  assert.equal(node.props.style.pointerEvents, 'auto', '浮动层本身是 click-through，占用者要自己开')
})

test('面板：拖动过则改为显式坐标，标题栏承载拖动与复位', () => {
  let reset = 0
  const node = renderPanel({ pos: { left: 40, top: 60 } }, { methods: { resetPanel: () => { reset += 1 } } })
  assert.equal(node.props.style.left, 40)
  assert.equal(node.props.style.top, 60)
  assert.equal(node.props.style.bottom, undefined)

  const header = node.children[0]
  assert.equal(header.props.style, undefined, '标题栏样式来自样式表，不写内联')
  assert.equal(typeof header.props.onPointerDown, 'function')
  assert.equal(typeof header.props.onDoubleClick, 'function')
  header.props.onDoubleClick()
  assert.equal(reset, 1, '双击标题栏复位位置')
})

/* ------------------------------------------------------ 交互路径（真 hooks） */

/** 按 aria-label 找一个按钮。 */
function findButton(node, label, depth = 0) {
  if (depth > 20 || node === null || typeof node !== 'object') return null
  if (typeof node.type === 'function') return findButton(node.type({ ...node.props, children: node.children }), label, depth + 1)
  if (node.props && node.props['aria-label'] === label) return node
  for (const child of node.children || []) {
    const found = findButton(child, label, depth + 1)
    if (found) return found
  }
  return null
}

/** 挂载面板并返回 { tree, store, dispatch, mini }，hooks 是真实的。 */
function mountPanel(state = {}, options = {}) {
  const mini = createMiniReact()
  const bundle = mountClient({ ReactImpl: mini.React })
  const calls = { openPanel: [], movePanel: [], commitPanel: [], resetPanel: 0 }
  // 快照是可变对象：movePanel 必须更新它，否则「松开时从 store 现读位置」读不到东西。
  const snapshot = { phase: 'ready', sessionId: 'session-1', cwd: '/Users/me/project', panelOpen: true, status: statusFixture(), ...state }
  const store = {
    ...fakeStore(snapshot),
    openPanel: value => { calls.openPanel.push(value) },
    movePanel: (pos) => { calls.movePanel.push(pos); snapshot.pos = pos },
    commitPanel: pos => { calls.commitPanel.push(pos) },
    resetPanel: () => { calls.resetPanel += 1 },
  }
  const tree = mini.mount(bundle.components['dsh-hud-panel'], { t: T, store })
  return { tree, store, calls, mini, bundle }
}

test('面板：✕ 按钮的 onClick 直接收起面板', () => {
  const { tree, calls } = mountPanel()
  const close = findButton(tree, 'panel.close')
  assert.ok(close, '必须能找到关闭按钮')
  close.props.onClick()
  assert.deepEqual(calls.openPanel, [false])
})

test('交互：按在按钮上不会开始拖动（回归：指针捕获曾让 ✕ 永远点不动）', () => {
  const { tree, bundle } = mountPanel()
  const header = tree.children[0]
  const captured = []
  const fakeButton = { closest: selector => (selector === 'button' ? { tagName: 'BUTTON' } : null) }

  header.props.onPointerDown({
    button: 0,
    pointerId: 1,
    clientX: 500,
    clientY: 300,
    target: fakeButton,
    currentTarget: {
      setPointerCapture: id => captured.push(id),
      parentNode: { getBoundingClientRect: () => ({ left: 400, top: 200 }) },
    },
  })

  assert.deepEqual(captured, [], '绝不能捕获指针：捕获会把 click 重定向到头部，按钮就失效了')
  assert.equal(bundle.listeners.has('pointermove'), false, '按在按钮上不应开始拖动')
})

test('交互：在头部按下并移动才拖动，松开时落盘', () => {
  const { tree, bundle, calls } = mountPanel()
  const header = tree.children[0]

  header.props.onPointerDown({
    button: 0,
    pointerId: 7,
    clientX: 500,
    clientY: 300,
    target: { closest: () => null },
    currentTarget: { parentNode: { getBoundingClientRect: () => ({ left: 400, top: 200 }) } },
  })

  const move = bundle.listeners.get('pointermove')?.[0]?.listener
  const up = bundle.listeners.get('pointerup')?.[0]?.listener
  assert.equal(typeof move, 'function', '按下后应注册 window 拖动监听')
  assert.equal(typeof up, 'function')

  // 小于阈值：不改变位置（头部上的普通点击不是拖动）。
  move({ pointerId: 7, clientX: 501, clientY: 301 })
  assert.deepEqual(calls.movePanel, [], '3px 以内不算拖动')

  move({ pointerId: 7, clientX: 460, clientY: 260 })
  assert.equal(calls.movePanel.length, 1)
  assert.deepEqual(calls.movePanel[0], { left: 360, top: 160 }, '位置 = 指针 - 按下时的偏移，并夹进视口')

  up({ pointerId: 7 })
  assert.deepEqual(calls.commitPanel, [{ left: 360, top: 160 }], '松开时把位置落盘')
  // 松开后应解除 window 监听。
  assert.equal(bundle.listeners.get('pointermove')?.length ?? 0, 0)
})

test('交互：Esc 收起面板，且在捕获阶段监听（焦点在任何输入框里也能收到）', () => {
  const { bundle, calls } = mountPanel()
  const entries = bundle.listeners.get('keydown') ?? []
  assert.equal(entries.length, 1, '应注册一个 keydown 监听')
  assert.equal(entries[0].opts, true, '必须用捕获阶段')

  entries[0].listener({ key: 'Escape' })
  assert.deepEqual(calls.openPanel, [false])

  entries[0].listener({ key: 'a' })
  assert.deepEqual(calls.openPanel, [false], '其他按键不关面板')
})

test('交互：面板收起时不注册任何面板级监听', () => {
  const { bundle } = mountPanel({ panelOpen: false })
  assert.equal(bundle.listeners.has('keydown'), false)
  assert.equal(bundle.listeners.has('pointermove'), false)
})
