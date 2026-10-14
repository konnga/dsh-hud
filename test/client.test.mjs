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
  const timeouts = []
  const clipboardWrites = []

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
    setTimeout: (callback, ms) => { timeouts.push({ callback, ms }); return timeouts.length },
    clearTimeout: () => {},
  }

  const documentStub = {
    visibilityState: 'visible',
    createElement: () => ({ textContent: '', attributes: {}, parentNode: null, setAttribute(name, value) { this.attributes[name] = value } }),
    head: { appendChild: (element) => { styles.push(element); element.parentNode = { removeChild() {} } } },
    // 只认自己的 data-dsh-hud 标记；dockRect 由测试注入，不注入就当量不到。
    querySelector(selector) {
      if (selector !== '[data-dsh-hud="dock"]' || !options.dockRect) return null
      return { getBoundingClientRect: () => options.dockRect }
    },
  }

  const navigatorStub = {
    clipboard: {
      writeText(text) {
        if (options.clipboardFails) return Promise.reject(new Error('denied'))
        clipboardWrites.push(text)
        return Promise.resolve()
      },
    },
  }

  const requireModule = (name) => {
    if (name === 'react') return React
    throw new Error(`unexpected module: ${name}`)
  }

  // bundle 主体是脚本：跑在受控的 window/document/navigator 下，它只做一次 self-register。
  new Function('window', 'document', 'require', 'navigator', source)(windowStub, documentStub, requireModule, navigatorStub)

  /** 触发某个 window 事件名上的全部监听（模拟浏览器派发）。 */
  const dispatch = (name, event) => {
    for (const entry of listeners.get(name) ?? []) entry.listener(event)
  }

  return { registry, styles, listeners, intervals, timeouts, clipboardWrites, React, requireModule, windowStub, documentStub, dispatch }
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
    setAnchorTop: () => {},
    openDiff: () => {},
    closeDiff: () => {},
    setDiffSide: () => {},
    toggleDiffWrap: () => {},
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
    diff: null,
    anchorTop: null,
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
    diff: null,
    anchorTop: null,
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

test('胶囊：脏分支带星号、领先落后，并用 codex-hud 式简写符分组展示改动', () => {
  const text = textOf(renderPill())
  assert.ok(text.includes('⎇ main*'), `期望分支摘要，实际 ${JSON.stringify(text)}`)
  assert.ok(text.includes('↑1'), '领先数')
  assert.ok(text.includes('↓2'), '落后数')
  // 简写符：M 已修改 / A 已暂存新增 / ? 未跟踪，按固定顺序。
  assert.equal(text, '⎇ main* ↑1 ↓2 M2 A1 ?1')
})

test('胶囊：简写符只列非零项，顺序固定为 M A D R C T ? !', () => {
  const text = textOf(renderPill({
    status: statusFixture({
      counts: { modified: 4, added: 0, deleted: 2, renamed: 1, copied: 0, typeChanged: 0, untracked: 3, conflicted: 1 },
    }),
  }))
  assert.equal(text, '⎇ main* ↑1 ↓2 M4 D2 R1 ?3 !1')
})

test('胶囊：简写符各自上色，与面板计数同色', () => {
  const node = renderPill()
  const marks = []
  const walk = (child) => {
    if (child === null || typeof child !== 'object') return
    if (Array.isArray(child)) return child.forEach(walk)
    if (child.props && child.props.style && child.props.style.color) marks.push({ text: child.children?.[0], color: child.props.style.color })
    for (const grand of child.children || []) walk(grand)
  }
  walk(node.children)

  const byText = Object.fromEntries(marks.map(mark => [mark.text, mark.color]))
  assert.ok(byText.M2?.includes('state-warn'), `M 应为警告色，实际 ${JSON.stringify(byText)}`)
  assert.ok(byText.A1?.includes('state-success'), 'A 应为成功色')
  assert.ok(byText['?1']?.includes('label-secondary'), '? 应为次级文字色')
})

test('胶囊：悬停给出完整信息（路径、上游、各类型计数）', () => {
  const node = renderPill()
  const button = findByAttr(node, 'pill')
  assert.ok(button, '必须能找到胶囊按钮')
  const lines = button.props.title.split('\n')
  assert.equal(lines[0], 'pill.title')
  assert.equal(lines[1], '/Users/me/project')
  assert.ok(lines[2].includes('main') && lines[2].includes('origin/main'), '上游分支')
  assert.ok(lines[3].includes('count.modified 2') && lines[3].includes('count.untracked 1'), '各类型计数')
})

test('胶囊：外层容器复刻输入栏的 dock 行几何，胶囊自身不撑宽', () => {
  const node = renderPill()
  assert.equal(node.props['data-dsh-hud'], 'dock', '胶囊应包在与输入卡片同宽的外层容器里')
  const button = findByAttr(node, 'pill')
  assert.equal(button.type, 'button', '可点击的是内层按钮')

  const { styles } = mountClient()
  const css = styles[0].textContent
  const dockRule = /\.dshh-dock\{[^}]*\}/.exec(css)?.[0] ?? ''
  const pillRule = /\.dshh-pill\{[^}]*\}/.exec(css)?.[0] ?? ''

  // 关键几何：与输入卡片同宽并居中，否则左对齐的胶囊会飘到整栏最左边。
  assert.ok(dockRule.includes('max-width:calc(var(--dsh-composer-card-max-width'), '必须跟输入卡片的最大宽度对齐')
  assert.ok(dockRule.includes('--dsh-composer-side-clearance'), '必须扣掉侧边留白')
  assert.ok(dockRule.includes('--dsh-composer-dock-inset'), '必须扣掉 dock 内缩')
  assert.ok(dockRule.includes('margin:0 auto'), '必须居中，才能与居中的输入卡片对齐')
  assert.ok(dockRule.includes('justify-content:flex-start'), '胶囊在行内靠左')
  assert.ok(pillRule.includes('width:fit-content'), '胶囊自身锁住宽度，不撑满')
})

test('胶囊：超长分支名中段省略，不把简写符挤出可见区', () => {
  const long = 'feat/very-long-branch-name-that-keeps-going-and-going'
  const text = textOf(renderPill({ status: statusFixture({ branch: long }) }))
  assert.ok(text.includes('…'), '应当省略')
  assert.ok(text.includes('M2'), '简写符仍然可见')
  assert.ok(!text.includes(long), '不应出现完整长名')
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
  findByAttr(node, 'pill').props.onClick()
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
  for (const [code, key] of [['timeout', 'err.timeout'], ['no-cwd', 'err.no-cwd'], ['git-missing', 'err.git-missing'], ['invalid-cwd', 'err.invalid-cwd'], ['invalid-path', 'err.invalid-path'], ['unknown-endpoint', 'err.stale-host'], ['transport', 'err.transport']]) {
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
  const calls = { openPanel: [], movePanel: [], commitPanel: [], resetPanel: 0, diffWidth: [], closeDiff: 0, persist: 0 }
  // 快照是可变对象：movePanel 必须更新它，否则「松开时从 store 现读位置」读不到东西。
  const snapshot = { phase: 'ready', sessionId: 'session-1', cwd: '/Users/me/project', panelOpen: true, status: statusFixture(), diff: null, anchorTop: null, diffWidth: 470, ...state }
  const store = {
    ...fakeStore(snapshot),
    openPanel: value => { calls.openPanel.push(value) },
    movePanel: (pos) => { calls.movePanel.push(pos); snapshot.pos = pos },
    commitPanel: pos => { calls.commitPanel.push(pos) },
    resetPanel: () => { calls.resetPanel += 1 },
    closeDiff: () => { calls.closeDiff += 1 },
    setDiffWidth: (width) => { calls.diffWidth.push(width); snapshot.diffWidth = width },
    persistLayout: () => { calls.persist += 1 },
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

/* ---------------------------------------------------- 差异视图（diff） */

/** 按谓词收集节点（会展开函数组件，因此子组件也参与断言）。 */
function findAll(node, predicate, depth = 0, out = []) {
  if (depth > 20 || node === null || typeof node !== 'object') return out
  // 数组也可能作为"单个子节点"传进来（例如把 rows 数组直接交给 div）。
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, depth + 1, out)
    return out
  }
  if (typeof node.type === 'function') return findAll(node.type({ ...node.props, children: node.children }), predicate, depth + 1, out)
  if (predicate(node)) out.push(node)
  for (const child of node.children || []) findAll(child, predicate, depth + 1, out)
  return out
}

const byClass = className => node => typeof node.props?.className === 'string' && node.props.className.split(' ').includes(className)
const byText = text => node => node.children?.length === 1 && node.children[0] === text

/** 一个改动文件的两侧 diff（宿主半已解析成 rows）。 */
function diffFixture(overrides = {}) {
  const rows = [
    { kind: 'meta', text: 'diff --git a/a.ts b/a.ts', oldLine: null, newLine: null },
    { kind: 'hunk', text: '@@ -1,2 +1,3 @@', oldLine: null, newLine: null },
    { kind: 'ctx', text: 'keep', oldLine: 1, newLine: 1 },
    { kind: 'del', text: 'old', oldLine: 2, newLine: null },
    { kind: 'add', text: 'new', oldLine: null, newLine: 2 },
    { kind: 'add', text: 'more', oldLine: null, newLine: 3 },
  ]
  return {
    repo: '/Users/me/project',
    path: 'src/a.ts',
    origPath: null,
    untracked: false,
    worktree: { rows, additions: 2, deletions: 1, hunks: 1, binary: false, truncated: false },
    index: { rows: [], additions: 0, deletions: 0, hunks: 0, binary: false, truncated: false },
    ...overrides,
  }
}

function diffState(overrides = {}) {
  return {
    diff: {
      phase: 'ready',
      path: 'src/a.ts',
      file: 'src/a.ts',
      origPath: null,
      data: diffFixture(),
      side: 'worktree',
      wrap: false,
      errorCode: null,
      ...overrides,
    },
  }
}

test('清单：点击一行以该改动打开差异', () => {
  const opened = []
  const node = renderPanel({}, { methods: { openDiff: change => opened.push(change) } })
  const rows = findAll(node, byClass('dshh-row'))
  assert.equal(rows.length, 2, '两个改动各一行')
  rows[0].props.onClick()
  assert.equal(opened.length, 1)
  assert.equal(opened[0].file, 'src/a.ts')
  assert.equal(opened[0].path, 'src/a.ts')
})

test('差异视图：行号、文本与增删底色', () => {
  const node = renderPanel(diffState())

  const text = textOf(node)
  assert.ok(text.includes('+2') && text.includes('-1'), '显示增删计数')
  assert.ok(text.includes('keep') && text.includes('new') && text.includes('more'))
  assert.ok(text.includes('panel.summary'), '改动概览仍在（它就是左栏不可变的那部分）')

  // 两个行号槽：上下文行两侧都有行号，删除行只有旧行号，新增行只有新行号。
  const ctx = findAll(node, byClass('dshh-difrow')).find(row => row.props.className.includes('dshh-difrow-ctx'))
  const gutters = ctx.children.filter(child => child.props && child.props.className === 'dshh-difno')
  assert.deepEqual(gutters.map(gutter => gutter.children[0]), ['1', '1'])

  const del = findAll(node, byClass('dshh-difrow')).find(row => row.props.className.includes('dshh-difrow-del'))
  assert.deepEqual(del.children.filter(c => c.props?.className === 'dshh-difno').map(g => g.children[0]), ['2', ''])
  assert.ok(del.props.style.background.includes('rgba'), '删除行有底色')

  const add = findAll(node, byClass('dshh-difrow')).find(row => row.props.className.includes('dshh-difrow-add'))
  assert.ok(add.props.style.background.includes('rgba'), '新增行有底色')

  // 空文本行用不换行空格占位，否则行高会塌掉。
  const metaRows = findAll(node, byClass('dshh-difrow-meta'))
  assert.ok(metaRows.length >= 1)
})

test('差异视图：页签、自动换行、返回都走 store', () => {
  const calls = { side: [], wrap: 0, close: 0 }
  const node = renderPanel(diffState(), {
    methods: { setDiffSide: side => calls.side.push(side), toggleDiffWrap: () => { calls.wrap += 1 }, closeDiff: () => { calls.close += 1 } },
  })

  findAll(node, byText('diff.index'))[0].props.onClick()
  findAll(node, byText('diff.worktree'))[0].props.onClick()
  assert.deepEqual(calls.side, ['index', 'worktree'])

  findAll(node, byText('diff.wrap'))[0].props.onClick()
  assert.equal(calls.wrap, 1)

  findButton(node, 'diff.close').props.onClick()
  assert.equal(calls.close, 1)
})

test('差异视图：复制的是重建后的 unified diff 文本', async () => {
  const { bundle } = (() => {
    const mini = createMiniReact()
    return { bundle: mountClient({ ReactImpl: mini.React }) }
  })()
  const tree = (() => {
    const node = renderPanel(diffState())
    return findAll(node, byText('diff.copy'))[0]
  })()

  // 用带真实 hooks 的挂载来跑点击后的状态更新与剪贴板写入。
  const mini = createMiniReact()
  const harness = mountClient({ ReactImpl: mini.React })
  const store = { ...fakeStore({ ...diffState(), panelOpen: true }), toggleDiffWrap: () => {} }
  const mounted = mini.mount(harness.components['dsh-hud-panel'], { t: T, store })
  const copyButton = findAll(mounted, byText('diff.copy'))[0]
  copyButton.props.onClick()
  await new Promise(resolve => setImmediate(resolve))

  assert.equal(harness.clipboardWrites.length, 1)
  assert.equal(harness.clipboardWrites[0], [
    'diff --git a/a.ts b/a.ts',
    '@@ -1,2 +1,3 @@',
    ' keep',
    '-old',
    '+new',
    '+more',
  ].join('\n'))
  assert.ok(tree, '静态渲染下也应能找到复制按钮')
  assert.ok(bundle)
})

test('差异视图：未跟踪文件隐藏已暂存页签并给出说明', () => {
  const node = renderPanel(diffState({ data: diffFixture({ untracked: true }), side: 'worktree' }))
  assert.equal(findAll(node, byText('diff.index')).length, 0, '未跟踪没有已暂存一侧')
  assert.ok(textOf(node).includes('diff.untrackedHint'))
})

test('差异视图：二进制、空、错误、读取中各有文案', () => {
  const binary = renderPanel(diffState({ data: diffFixture({ worktree: { rows: [{ kind: 'meta', text: 'Binary files differ', oldLine: null, newLine: null }], additions: 0, deletions: 0, hunks: 0, binary: true, truncated: false } }) }))
  assert.ok(textOf(binary).includes('diff.binary'))

  const empty = renderPanel(diffState({ data: diffFixture({ worktree: { rows: [], additions: 0, deletions: 0, hunks: 0, binary: false, truncated: false } }) }))
  assert.ok(textOf(empty).includes('diff.empty'))

  const loading = renderPanel(diffState({ phase: 'loading', data: null }))
  assert.ok(textOf(loading).includes('panel.loading'))

  const failed = renderPanel(diffState({ phase: 'error', data: null, errorCode: 'timeout' }))
  assert.ok(textOf(failed).includes('err.timeout'))
})

test('差异视图：截断时给出提示', () => {
  const node = renderPanel(diffState({ data: diffFixture({ worktree: { ...diffFixture().worktree, truncated: true } }) }))
  assert.ok(textOf(node).includes('diff.truncated'))
})

/* -------------------------------------------------------- 定位与尺寸 */

test('面板：量到胶囊位置就贴到它上方，量不到退回 168px', () => {
  const anchored = renderPanel({ anchorTop: 500 })
  assert.equal(anchored.props.style.bottom, 800 - 500 + 8, 'bottom = 视口高 - dock 顶部 + 间距')

  const fallback = renderPanel({ anchorTop: null })
  assert.equal(fallback.props.style.bottom, 168, 'dsh-git 记录的那次测量作为兜底')
})

test('面板：打开时测量自己的 dock 行并写进 store', () => {
  const mini = createMiniReact()
  const bundle = mountClient({ ReactImpl: mini.React, dockRect: { top: 420 } })
  const seen = []
  const store = { ...fakeStore({ ...diffState().diff === null ? {} : {}, phase: 'ready', sessionId: 's', cwd: '/x', panelOpen: true, status: statusFixture(), diff: null, anchorTop: null }), setAnchorTop: top => seen.push(top) }
  mini.mount(bundle.components['dsh-hud-panel'], { t: T, store })
  assert.deepEqual(seen, [420], '应把量到的顶部坐标交给 store')
})

test('面板：量不到 dock 行时写 null，退回常量锚点', () => {
  const mini = createMiniReact()
  const bundle = mountClient({ ReactImpl: mini.React })
  const seen = []
  const store = { ...fakeStore({ phase: 'ready', sessionId: 's', cwd: '/x', panelOpen: true, status: statusFixture(), diff: null, anchorTop: null }), setAnchorTop: top => seen.push(top) }
  mini.mount(bundle.components['dsh-hud-panel'], { t: T, store })
  assert.deepEqual(seen, [null])
})

test('面板：差异模式更宽、且用固定高度（避免 bottom 锚定下跳位）', () => {
  const list = renderPanel({ anchorTop: null })
  assert.equal(list.props.style.width, 380)
  assert.equal(list.props.style.height, undefined, '清单模式跟着内容')
  assert.equal(list.props.style.maxHeight, '62vh')

  const diff = renderPanel({ ...diffState(), anchorTop: null })
  assert.ok(diff.props.style.width > 380, '差异模式更宽')
  assert.equal(typeof diff.props.style.height, 'number', '差异模式固定高度')
  const spaceAbove = 800 - 168 - 8
  assert.ok(diff.props.style.height <= spaceAbove, '高度不超过胶囊上方的可用空间')
  assert.equal(diff.props.style.maxHeight, undefined, '固定高度就不该再给 max-height')
})

/* ------------------------------------------------------------ 最近提交 */

const COMMITS = [
  { sha: '2eed74e', author: 'wjc', date: '2026-10-14', committedAt: Date.now() - 3600 * 1000, refs: ['HEAD -> main', 'origin/main'], subject: 'feat: 差异视图' },
  { sha: '1097168', author: 'wjc', date: '2026-10-14', committedAt: Date.now() - 7200 * 1000, refs: [], subject: 'fix: 胶囊与输入卡片左对齐' },
]

test('最近提交：一行一条，带短 sha、标题、HEAD 徽标与相对时间', () => {
  const node = renderPanel({ commits: COMMITS })
  const rows = findAll(node, byClass('dshh-commit'))
  assert.equal(rows.length, 2)

  const text = textOf(node)
  assert.ok(text.includes('panel.commits'), '有小标题')
  assert.ok(text.includes('2eed74e') && text.includes('1097168'), '短 sha')
  assert.ok(text.includes('feat: 差异视图'), '标题')

  // HEAD 徽标只在 HEAD 那条上出现。
  assert.equal(findAll(node, byClass('dshh-chead')).length, 1)

  // 相对时间：一小时前 / 两小时前。
  assert.ok(text.includes('1' + 'time.hours'), `期望「1 小时前」，实际 ${JSON.stringify(text)}`)
  assert.ok(text.includes('2' + 'time.hours'))
})

test('最近提交：悬停给出作者、日期与 refs', () => {
  const node = renderPanel({ commits: COMMITS })
  const first = findAll(node, byClass('dshh-commit'))[0]
  const lines = first.props.title.split('\n')
  assert.equal(lines[0], 'feat: 差异视图')
  assert.equal(lines[1], 'wjc · 2026-10-14')
  assert.ok(lines.includes('HEAD -> main') && lines.includes('origin/main'))
})

test('最近提交：没有提交就整段不渲染', () => {
  assert.equal(findAll(renderPanel({ commits: [] }), byClass('dshh-commit')).length, 0)
  assert.equal(findAll(renderPanel({ commits: null }), byClass('dshh-commit')).length, 0)
  assert.ok(!textOf(renderPanel({ commits: [] })).includes('panel.commits'), '连小标题都不出现')
})

test('最近提交：超过 30 天回退到提交自己的日期', () => {
  const old = [{ sha: 'aaaaaaa', author: 'wjc', date: '2025-01-02', committedAt: Date.now() - 400 * 24 * 3600 * 1000, refs: [], subject: '很久以前' }]
  assert.ok(textOf(renderPanel({ commits: old })).includes('2025-01-02'))
})

/* -------------------------------------------------- 两栏工作台（diff 模式） */

test('工作台：左栏常驻改动清单，右栏是差异，打开差异不换掉清单', () => {
  const node = renderPanel(diffState())

  assert.equal(findAll(node, byClass('dshh-workbench')).length, 1, '两栏容器')
  assert.equal(findAll(node, byClass('dshh-leftpane')).length, 1, '左栏')
  assert.equal(findAll(node, byClass('dshh-diffview')).length, 1, '右栏')

  // 清单两行仍在左栏里（这正是"打开 diff 不关闭主面板"的含义）。
  const rows = findAll(node, byClass('dshh-row'))
  assert.equal(rows.length, 2, '左栏仍然列出全部改动')
  assert.ok(textOf(node).includes('src/a.ts'), '清单路径可见')
  assert.ok(textOf(node).includes('keep'), '差异内容同时可见')

  // 正在看的文件在左栏高亮。
  const active = findAll(node, byClass('dshh-rowActive'))
  assert.equal(active.length, 1, '当前文件高亮')
  assert.ok(active[0].props.title.startsWith('src/a.ts'), '高亮的是正在看的那个文件')

  // 点击左栏另一行即可切换差异，不需要先返回。
  assert.equal(typeof rows[0].props.onClick, 'function')
})

test('工作台：面板右边缘有抓握，宽度 = 左栏 + 抓握 + 差异栏', () => {
  const node = renderPanel(diffState())
  const grip = findAll(node, byClass('dshh-grip'))
  assert.equal(grip.length, 1, '右边缘抓握')
  assert.equal(grip[0].props['data-dsh-hud'], 'grip')
  assert.equal(typeof grip[0].props.onPointerDown, 'function')

  assert.equal(node.props.style.width, 380 + 6 + 470, '左栏与单栏同为 380px，差异栏默认 470px')
  assert.equal(node.props.style.position, 'fixed', '抓握是绝对定位，依赖面板自身定位')
})

test('工作台：拖动右边缘改差异宽度，松手才落盘', () => {
  const { tree, bundle, calls } = mountPanel({ ...diffState().diff === null ? {} : {}, diff: diffState().diff })
  const grip = findAll(tree, byClass('dshh-grip'))[0]

  let prevented = false
  grip.props.onPointerDown({ button: 0, pointerId: 9, clientX: 1000, preventDefault: () => { prevented = true } })
  assert.equal(prevented, true, '抓握按下要阻止文本选择')

  const move = bundle.listeners.get('pointermove')?.[0]?.listener
  const up = bundle.listeners.get('pointerup')?.[0]?.listener
  assert.equal(typeof move, 'function', '按下后注册 window 拖动监听')

  move({ pointerId: 9, clientX: 940 })
  assert.deepEqual(calls.diffWidth, [530], '往左拖 60px → 差异栏 470 + 60')

  up({ pointerId: 9 })
  assert.equal(calls.persist, 1, '松手落盘')
  assert.equal(bundle.listeners.get('pointermove')?.length ?? 0, 0, '松手解除监听')
})

test('工作台：Esc 是"退一层"——先关差异，再按才收起面板', () => {
  const { bundle, calls } = mountPanel({ diff: diffState().diff })
  const keydown = bundle.listeners.get('keydown')?.[0]?.listener
  assert.equal(typeof keydown, 'function')

  keydown({ key: 'Escape' })
  assert.equal(calls.closeDiff, 1, '先关差异')
  assert.deepEqual(calls.openPanel, [], '此时不该收起面板')

  keydown({ key: 'a' })
  assert.equal(calls.closeDiff, 1, '其他按键不动它')
})

test('工作台：没有差异时不渲染两栏，也没有抓握', () => {
  const node = renderPanel({ diff: null })
  assert.equal(findAll(node, byClass('dshh-workbench')).length, 0)
  assert.equal(findAll(node, byClass('dshh-grip')).length, 0)
  assert.equal(node.props.style.width, 380, '回到紧凑清单宽度')
})

test('工作台：左栏与单栏面板逐字一致——点击不改变左栏', () => {
  const single = renderPanel({ diff: null })
  const withDiff = renderPanel(diffState())

  const singleBody = findAll(single, byClass('dshh-body'))[0]
  const leftPane = findAll(withDiff, byClass('dshh-leftpane'))[0]
  assert.ok(singleBody && leftPane)

  assert.equal(
    textOf(leftPane),
    textOf(singleBody),
    '左栏内容必须与单栏视图完全相同（仓库路径、上游、oid、改动概览、提交、清单一个都不少）',
  )

  // 宽度也一致：左栏就是原来那个面板，不因打开差异而变窄。
  assert.equal(leftPane.props.style.width, 380)
  assert.equal(single.props.style.width, 380)

  // 只有差异栏是"新出现"的东西。
  assert.equal(findAll(single, byClass('dshh-diffview')).length, 0)
  assert.equal(findAll(withDiff, byClass('dshh-diffview')).length, 1)
})

test('工作台：左栏保留仓库路径与提交段，不只留计数和清单', () => {
  const node = renderPanel({ ...diffState(), commits: COMMITS })
  const leftText = textOf(findAll(node, byClass('dshh-leftpane'))[0])

  assert.ok(leftText.includes('/Users/me/project'), '仓库路径')
  assert.ok(leftText.includes('panel.upstream'), '上游')
  assert.ok(leftText.includes('panel.summary'), '改动概览标题')
  assert.ok(leftText.includes('panel.commits'), '最近提交段')
  assert.ok(leftText.includes('panel.changes'), '改动清单')
})
