import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

/**
 * 浏览器半的冒烟测试：在没有浏览器的情况下评估 bundle 主体，
 * 验证模块表契约（id / factory）与两条座位注册。
 *
 * 这里用假 React 与假 DOM —— 被测的是插件面与注册协议，不是渲染结果。
 */
function loadBundle() {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  const registry = {}
  const styles = []
  const listeners = new Map()
  const intervals = []

  const React = {
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
    addEventListener: (name, listener) => { listeners.set(name, listener) },
    removeEventListener: name => { listeners.delete(name) },
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

  return { registry, styles, listeners, intervals, React, requireModule, windowStub }
}

/** 用假 ctx 调 apply，捕获座位的注册与副作用标签。 */
function mountClient() {
  const bundle = loadBundle()
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
  assert.equal(typeof header.props.onPointerMove, 'function')
  assert.equal(typeof header.props.onPointerUp, 'function')
  header.props.onDoubleClick()
  assert.equal(reset, 1, '双击标题栏复位位置')
})
