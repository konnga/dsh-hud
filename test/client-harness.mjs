/**
 * 浏览器半的测试脚手架（原 client.test.mjs 里的非用例部分，整体搬来）。
 *
 * 用例按功能分家之后，假 DOM / 假 React / store 桩 / 渲染助手都在这里 —— 一份定义、一处修改。
 * 这里**不放任何 `test(...)`**。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMiniReact } from './mini-react.mjs'

/**
 * 浏览器半的冒烟测试：在没有浏览器的情况下评估 bundle 主体，
 * 验证模块表契约（id / factory）、两条座位注册，以及交互路径。
 *
 * 这里用假 React 与假 DOM —— 被测的是插件面、注册协议与事件接线，不是像素结果。
 * 交互测试可注入 `test/mini-react.mjs` 的运行时，让 useState/useEffect 真的生效。
 */
export function loadBundle(options = {}) {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  const registry = {}
  const styles = []
  const listeners = new Map()
  const intervals = []
  const timeouts = []
  const clipboardWrites = []

  const React = options.ReactImpl ?? {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
  }

  const windowStub = {
    __ModuleLoader__: {
      load: (definition) => {
        registry.definition = definition
      },
    },
    innerWidth: options.innerWidth ?? 1200,
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
      listeners.set(
        name,
        list.filter((entry) => entry.listener !== listener),
      )
    },
    setInterval: (callback, ms) => {
      intervals.push({ callback, ms })
      return intervals.length
    },
    clearInterval: () => {},
    setTimeout: (callback, ms) => {
      timeouts.push({ callback, ms })
      return timeouts.length
    },
    clearTimeout: () => {},
  }

  // 假 head：样式节点进出都要反映到 `styles` 上，这样「框架把表删掉」才能被模拟。
  const head = {
    appendChild(element) {
      styles.push(element)
      element.parentNode = head
      return element
    },
    removeChild(element) {
      const index = styles.indexOf(element)
      if (index >= 0) styles.splice(index, 1)
      element.parentNode = null
      return element
    },
  }

  const documentStub = {
    visibilityState: 'visible',
    createElement: () => ({
      textContent: '',
      attributes: {},
      parentNode: null,
      setAttribute(name, value) {
        this.attributes[name] = value
      },
    }),
    head,
    // 只认自己的两个标记：dock 行（dockRect 由测试注入）与自有样式表（按 data-plugin-css 复用）。
    querySelector(selector) {
      if (selector === '[data-dsh-hud="dock"]') {
        return options.dockRect ? { getBoundingClientRect: () => options.dockRect } : null
      }
      const tag = /^style\[data-plugin-css="([^"]+)"\]$/.exec(selector)
      if (tag)
        return styles.find((element) => element.attributes['data-plugin-css'] === tag[1]) ?? null
      return null
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

  // 假 console：插件的自诊断（`[dsh-hud] …`）照收不误，但不要污染 TAP 输出 ——
  // 顺便让"降级时说清楚为什么"这件事可以被断言，而不是只靠人看。
  const consoleLines = []
  const consoleStub = {
    warn: (...args) => {
      consoleLines.push(args.join(' '))
    },
    error: (...args) => {
      consoleLines.push(args.join(' '))
    },
    log: (...args) => {
      consoleLines.push(args.join(' '))
    },
  }

  // bundle 主体是脚本：跑在受控的 window/document/navigator/console 下，它只做一次 self-register。
  new Function('window', 'document', 'require', 'navigator', 'console', source)(
    windowStub,
    documentStub,
    requireModule,
    navigatorStub,
    consoleStub,
  )

  /** 触发某个 window 事件名上的全部监听（模拟浏览器派发）。 */
  const dispatch = (name, event) => {
    for (const entry of listeners.get(name) ?? []) entry.listener(event)
  }

  return {
    registry,
    styles,
    head,
    listeners,
    intervals,
    timeouts,
    clipboardWrites,
    React,
    requireModule,
    windowStub,
    documentStub,
    dispatch,
    consoleLines,
  }
}

/** 用假 ctx 调 apply，捕获座位的注册与副作用标签。 */
export function mountClient(options = {}) {
  const bundle = loadBundle(options)
  assert.ok(bundle.registry.definition, 'bundle 必须先向 __ModuleLoader__ 注册自己')

  const exported = bundle.registry.definition.factory(bundle.requireModule)
  const registrations = []
  const labels = []
  // 词典注册也收下来：契约用例要拿**真正注册进框架的那两份**来核对，而不是再去正则扫源码
  //（源码排版由 prettier 管，扫源码只适合找 `t('…')` 这类调用点，不适合解析字面量）。
  const dictionaries = []
  // `apply` 里注册的每个 effect 的清理函数（真实 Cordis 在 fiber 卸载时调它）。
  // 必须收下来：插件里有 `setInterval` 那类长活，不清理的话 node 进程退不出去
  //（表现是 `node --test` 全部用例通过但永远不返回）。
  const disposers = []
  const ctx = {
    effect(fn, label) {
      labels.push(label)
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    // 按名取客户端服务：宿主没有那个客户端半边时返回 undefined（真实 ctx.get 也如此）。
    get(name) {
      return (options.services ?? {})[name]
    },
    // 动态注入：真实 Cordis 里 `ctx.inject(deps, cb)` 起一个带 inject 的子 fiber ——
    // 全部依赖到齐才回调，缺一个就永远不回调。这里照这个语义实现（含点号子服务路径）。
    inject(deps, callback) {
      const provided = options.services ?? {}
      const resolve = (name) =>
        name
          .split('.')
          .reduce(
            (value, part) => (value === undefined || value === null ? undefined : value[part]),
            provided,
          )
      if (deps.some((name) => resolve(name) === undefined)) return () => {}
      const scope = { ...provided, effect: (fn) => fn() }
      const dispose = callback(scope)
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    locale: {
      register(namespace, dictionary) {
        dictionaries.push({ namespace, dictionary })
        return () => {}
      },
    },
    // 需要驱动真实 store 的用例自己注入 rpc stub；默认直接拒绝，免得静默走空。
    connection: {
      rpc: {
        call: options.rpc ?? (() => Promise.reject(new Error('这个用例没有注入 rpc stub'))),
      },
    },
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

  const components = Object.fromEntries(
    registrations.map((entry) => [entry.options.id, entry.component]),
  )
  // `dispose()` 卸载这个"已挂载的客户端"：把 apply 里装下的清理函数都跑一遍。
  // 用不用都行，但**用到了会起定时器的服务**（`sessions` 等）的用例必须调，
  // 否则那个 interval 会一直挂着。
  let disposed = false
  function dispose() {
    if (disposed) return
    disposed = true
    while (disposers.length > 0) {
      const fn = disposers.pop()
      try {
        fn()
      } catch {
        // 清理失败不该把用例本身判红：这里只求"进程能退出"。
      }
    }
  }
  return { ...bundle, exported, registrations, components, labels, dictionaries, dispose }
}

/**
 * 递归收集渲染树里的文本节点。
 *
 * 假 React 不会自己渲染函数组件，所以 `type` 是函数的节点要手动调用 ——
 * 这样覆盖到的是真实子组件（CountChips / ChangeList），而不是它们的占位。
 */
export function collectText(node, out = [], depth = 0) {
  if (depth > 20 || node === null || node === undefined || node === false || node === true)
    return out
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
export function textOf(node) {
  return collectText(node).join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * 胶囊座位里**那枚 git 胶囊**的文本（限定到 `data-dsh-hud="pill"` 这一枚）。
 *
 * dock 一行里只有这一枚胶囊，但按标记取仍然更精确：会话归因那段挂在它尾部，直接
 * `textOf(座位)` 会把那些字也算进"分支摘要"的断言里。
 */
/**
 * 去掉 harness 插入的空格后的座位文本。
 *
 * `textOf()` 会把相邻子元素**用空格**连接，而 DOM 里 `git:(` + `main*` + `)` 是紧挨着的 ——
 * 所以凡是断言胶囊结构（尤其 `git:(…)`）的地方都要用这个，否则断言的是 harness 的拼接方式。
 */
export function flatText(node) {
  return textOf(node).replace(/\s+/g, '')
}

export function pillText(state = {}, options = {}) {
  return textOf(findByAttr(renderPill(state, options), 'pill'))
}

/**
 * 把自有样式表解析成规则（够用的小解析器，只为断言结构）。
 *
 * 为什么要解析而不是断言子串：**规则被吞掉时子串仍然在**（文本还在字符串里，只是浏览器
 * 不认），所以"文本里有这个值"这种断言会假绿。解析出"哪条规则真的成立、声明是什么"才算数。
 *
 * 返回 `{ rules, orphan }`：`orphan` 里是没成规则的片段（多半是删规则时留下的尾巴，
 * 或者多出来的 `}`），非空即说明样式表结构坏了。
 */
export function parseStylesheet(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = []
  const orphan = []
  let preludeStart = 0
  let index = 0
  const stack = []
  while (index < text.length) {
    const ch = text[index]
    if (ch === '{') {
      const prelude = text.slice(preludeStart, index).trim()
      if (/^[a-z-]+\s*:/.test(prelude) || prelude.includes(';')) {
        // 声明被当成了选择器：前面少了一个 {（或多了个 }）—— 这种片段会把后面那条规则一起吞掉。
        const end = text.indexOf('}', index)
        orphan.push(prelude.slice(0, 60))
        index = end < 0 ? text.length : end + 1
        preludeStart = index
        continue
      }
      stack.push({ selector: prelude, start: index })
      index += 1
      continue
    }
    if (ch === '}') {
      if (stack.length === 0) orphan.push('}')
      else {
        const open = stack.pop()
        rules.push({
          selector: open.selector,
          body: text.slice(open.start + 1, index).trim(),
        })
      }
      index += 1
      preludeStart = index
      continue
    }
    index += 1
  }
  for (const open of stack) orphan.push(open.selector || '(空选择器)')
  return { rules, orphan }
}

/** 取自有样式表（`ensureStyles` 注入的那个 `<style>` 的文本）。 */
export function stylesheetText() {
  return mountClient().styles[0].textContent
}

/** 按选择器取一条规则（解析出来的，不是子串匹配）。 */
export function cssRule(selector, css = stylesheetText()) {
  return parseStylesheet(css).rules.find((rule) => rule.selector === selector) ?? null
}

/** 按 data-dsh-hud 属性找出节点（同样展开函数组件）。 */
export function findByAttr(node, value, depth = 0) {
  if (depth > 20 || node === null || typeof node !== 'object') return null
  // 数组也可能作为"单个子节点"传进来（`h('div', props, children)` 就是这么传的）。
  // 上面 `findAll` 早就认这种形状了，这里漏了会让"节点明明在树里却找不到"。
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByAttr(child, value, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof node.type === 'function')
    return findByAttr(node.type({ ...node.props, children: node.children }), value, depth + 1)
  if (node.props && node.props['data-dsh-hud'] === value) return node
  for (const child of node.children || []) {
    const found = findByAttr(child, value, depth + 1)
    if (found) return found
  }
  return null
}

/**
 * 与 `src/client/shared.ts` 的 `normalizeTipContent` 同一套规则（harness 跑的是打包后的
 * `lib/client.js`，import 不到 TS 源码，只能在这里照抄一份）。
 *
 * 之所以要它：组件现在把气泡内容作为「逐行结构」交给 `tipHandlers`，而绝大多数用例
 * 只关心拼平后的文本 —— 在假 `showTip` 里归一化，老用例一行都不用改。
 */
function normalizeTipContent(content) {
  const lines =
    typeof content === 'string'
      ? [{ text: content }]
      : Array.isArray(content)
        ? content.filter((line) => line !== null && typeof line === 'object')
        : []
  const text = lines
    .map((line) => {
      // 与 `tipLineText` 逐条对齐：行内分段 > 整行 text > label + value。
      if (Array.isArray(line.segments)) return line.segments.map((seg) => seg.text).join('')
      if (typeof line.text === 'string') return line.text
      const label = line.label ?? ''
      const value = line.value ?? ''
      // 标签和数值之间补一个空格（屏幕上是 CSS 间距）。
      return label !== '' && value !== '' ? label + ' ' + value : label + value
    })
    .join('\n')
  return { lines, text }
}

/** 假 store：组件只通过 getSnapshot/subscribe 读它。 */
export function fakeStore(state) {
  // 真实快照总是带 diff / commit 两个字段（都是 null 起）：这里就地补上，
  // 组件用例不必每个都写一遍，同时保持快照对象本身的引用（有测试靠它观察变更）。
  if (!('diff' in state)) state.diff = null
  if (!('commit' in state)) state.commit = null
  // 令牌面板的默认快照：关着。开着的用例自己传 `tokenPanel`。
  if (!('tokenPanel' in state)) state.tokenPanel = closedTokenPanel()
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
    openCommit: () => {},
    openCommitDiff: () => {},
    closeCommit: () => {},
    // 会话归因那枚开关（真实 store 的面）：默认 no-op，要观察调用的用例用 `options.methods` 覆盖。
    toggleOnlySession: () => {},
    toggleOnlyLatest: () => {},
    // 审阅进度（`v` 键会调它：假 store 缺这个方法就会把按键路径打崩）。
    toggleReviewed: () => {},
    clearReviewed: () => {},
    // 账号余额：胶囊点击会带 `force` 调它；默认 no-op，要观察的用例用 `options.methods` 覆盖。
    balanceCalls: [],
    loadBalance: function (force) {
      this.balanceCalls.push({ force: force === true })
    },
    // 当前模型来源那一路：胶囊在 provider 模式下点击会带 `force` 调它。
    providerCalls: [],
    loadProviderBalance: function (force) {
      this.providerCalls.push({ force: force === true })
    },
    // 后台令牌设置面板：打开 / 收起 / 保存都只记调用，断言由用例看着自己那份数组做。
    tokenPanelCalls: [],
    openTokenPanel: function (provider, ref) {
      this.tokenPanelCalls.push({ action: 'open', provider: provider, ref: ref })
    },
    closeTokenPanel: function () {
      this.tokenPanelCalls.push({ action: 'close' })
    },
    saveProviderToken: function (token) {
      this.tokenPanelCalls.push({ action: 'save', token: token })
      return Promise.resolve(true)
    },
    // 悬停气泡：真 store 把文案放进快照、由 overlay 那枚座位画；这里只把调用记下来供断言。
    tipCalls: [],
    showTip: function (key, text, rect) {
      this.tipCalls.push({ key, text, rect })
    },
    hideTip: function (key) {
      this.tipCalls.push({ key, text: null })
    },
    tipHandlers: function (key, contentOf) {
      const self = this
      return {
        onPointerEnter: (event) => {
          const target = event && event.currentTarget ? event.currentTarget : null
          const rect =
            target && typeof target.getBoundingClientRect === 'function'
              ? target.getBoundingClientRect()
              : null
          // 内容可能是「逐行结构」（新）或一整段文本（老）。这里归一化，
          // 让只关心文本的用例继续拿 `text`，关心配色的用例另取 `lines`。
          const content = contentOf()
          const normalized = normalizeTipContent(content)
          self.showTip(key, normalized.text, rect, normalized.lines)
        },
        onPointerLeave: () => self.hideTip(key),
        onPointerDown: () => self.hideTip(key),
      }
    },
  }
}

/** 悬停一枚胶囊：假的指针进入事件，锚点矩形由调用方给。 */
export function hoverPill(node, attr, rect = { left: 100, top: 300, right: 190 }) {
  const target = findByAttr(node, attr)
  assert.ok(target, `找不到 ${attr}`)
  assert.equal(typeof target.props.onPointerEnter, 'function', `${attr} 应当接了悬停接线`)
  const event = { currentTarget: { getBoundingClientRect: () => rect } }
  target.props.onPointerEnter(event)
  return target
}

/**
 * 翻译桩：返回 key，并把参数按 `name=value` 缀在后面。
 *
 * 保留 key 是为了让"这条文案在不在"的断言继续好写；带上参数是为了能断言"用户实际会看到的字"
 * （比如「可能相关」那条要把命令原文贴出来，光有 key 就测不到）。
 */
export const T = (key, params) => {
  if (params === undefined || params === null) return key
  const pairs = Object.keys(params).map((name) => `${name}=${params[name]}`)
  return pairs.length === 0 ? key : `${key} ${pairs.join(' ')}`
}

export function statusFixture(overrides = {}) {
  return {
    repo: '/Users/me/project',
    branch: 'main',
    detached: false,
    oid: 'abc1234',
    upstream: 'origin/main',
    ahead: 1,
    behind: 2,
    dirty: true,
    counts: {
      modified: 2,
      added: 1,
      deleted: 0,
      renamed: 0,
      copied: 0,
      typeChanged: 0,
      untracked: 1,
      conflicted: 0,
    },
    changes: [
      {
        status: 'M',
        index: 'M',
        worktree: '.',
        path: 'src/a.ts',
        file: 'src/a.ts',
        origFile: null,
      },
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
/** 令牌面板"关着"时的快照（真实 store 的初值也是这个形状）。 */
export function closedTokenPanel() {
  return {
    open: false,
    provider: null,
    ref: null,
    supported: true,
    saving: false,
    error: null,
  }
}

/** 渲染一次后台令牌设置面板。`state` 覆盖快照，`options.methods` 覆盖 store 方法。 */
export function renderTokenPanel(state = {}, options = {}) {
  return renderSeat('dsh-hud-token-panel', {}, state, options)
}

export function renderSeat(id, defaults, state = {}, options = {}) {
  const { components } = mountClient()
  const { methods = {}, ...props } = options
  return components[id]({
    t: T,
    store: { ...fakeStore({ ...defaults, ...state }), ...methods },
    ...props,
  })
}

export function renderPill(state = {}, options = {}) {
  return renderSeat(
    'dsh-hud-pill',
    {
      phase: 'ready',
      sessionId: 'session-1',
      cwd: '/Users/me/project',
      panelOpen: false,
      status: statusFixture(),
      diff: null,
      anchorTop: null,
    },
    state,
    {
      sessionId: 'session-1',
      useSessions: (selector) => selector({ byId: { 'session-1': { cwd: '/Users/me/project' } } }),
      ...options,
    },
  )
}

/**
 * 渲染一枚余额胶囊（dock 那行里的最后一条）。
 *
 * @param balance - 余额快照（`state.balance`）；传 `null` 就是"没有可展示的余额"。
 * @param options - 交给 `renderPill` 的选项（`methods` 可覆盖 store 方法）。
 * @returns 座位节点。
 */
export function renderBalancePill(balance, options = {}) {
  return renderPill({ balance: balance }, options)
}

/**
 * 按"当前会话的模型来源"渲染余额胶囊（`provider` 那一路）。
 *
 * @param provider - `state.provider` 那份账本结论。
 * @param options - 渲染选项；`balance` 是同一份快照里的**账号**余额（对照用）。
 */
export function renderProviderPill(provider, options = {}) {
  const { balance = null, ...rest } = options
  return renderPill({ balance: balance, provider: provider }, rest)
}

export function renderPanel(state = {}, options = {}) {
  return renderSeat(
    'dsh-hud-panel',
    {
      phase: 'ready',
      sessionId: 'session-1',
      cwd: '/Users/me/project',
      panelOpen: true,
      status: statusFixture(),
      diff: null,
      anchorTop: null,
    },
    state,
    options,
  )
}

/* ------------------------------------------------------------ 渲染逻辑 */

/* ------------------------------------------------------ 交互路径（真 hooks） */

/** 按 aria-label 找一个按钮。 */
export function findButton(node, label, depth = 0) {
  if (depth > 20 || node === null || typeof node !== 'object') return null
  if (typeof node.type === 'function')
    return findButton(node.type({ ...node.props, children: node.children }), label, depth + 1)
  if (node.props && node.props['aria-label'] === label) return node
  for (const child of node.children || []) {
    const found = findButton(child, label, depth + 1)
    if (found) return found
  }
  return null
}

/** 挂载面板并返回 { tree, store, dispatch, mini }，hooks 是真实的。 */
export function mountPanel(state = {}, options = {}) {
  const mini = createMiniReact()
  const bundle = mountClient({ ReactImpl: mini.React })
  const calls = {
    openPanel: [],
    movePanel: [],
    commitPanel: [],
    resetPanel: 0,
    diffWidth: [],
    commitWidth: [],
    closeDiff: 0,
    closeCommit: 0,
    closeDetail: 0,
    persist: 0,
    stepFile: [],
    openCursor: 0,
    stepHunk: [],
    toggleHunk: [],
    refresh: 0,
  }
  // 快照是可变对象：movePanel 必须更新它，否则「松开时从 store 现读位置」读不到东西。
  const snapshot = {
    phase: 'ready',
    sessionId: 'session-1',
    cwd: '/Users/me/project',
    panelOpen: true,
    status: statusFixture(),
    diff: null,
    anchorTop: null,
    diffWidth: 470,
    ...state,
  }
  const store = {
    ...fakeStore(snapshot),
    setCommitWidth: (width) => {
      calls.commitWidth.push(width)
      snapshot.commitWidth = width
    },
    setDiffWidth: (width) => {
      calls.diffWidth.push(width)
      snapshot.diffWidth = width
    },
    openPanel: (value) => {
      calls.openPanel.push(value)
      snapshot.panelOpen = value
    },
    movePanel: (pos) => {
      calls.movePanel.push(pos)
      snapshot.pos = pos
    },
    commitPanel: (pos) => {
      calls.commitPanel.push(pos)
    },
    resetPanel: () => {
      calls.resetPanel += 1
    },
    closeDiff: () => {
      calls.closeDiff += 1
    },
    closeDetail: () => {
      calls.closeDetail += 1
      // 真实 store 里 closeDetail 会按当前状态退一层：提交明细优先整体退掉。
      if (snapshot.commit) calls.closeCommit += 1
      else calls.closeDiff += 1
    },
    closeCommit: () => {
      calls.closeCommit += 1
    },
    stepFile: (delta, open) => {
      calls.stepFile.push([delta, open])
    },
    openCursor: () => {
      calls.openCursor += 1
    },
    // 与 `renderSeat` 一致：允许用例覆盖 store 上的个别方法（键盘路径要观察调用）。
    ...(options.methods ?? {}),
    stepHunk: (delta) => {
      calls.stepHunk.push(delta)
    },
    toggleHunk: (index) => {
      calls.toggleHunk.push(index)
    },
    refresh: () => {
      calls.refresh += 1
    },
    setDiffWidth: (width) => {
      calls.diffWidth.push(width)
      snapshot.diffWidth = width
    },
    persistLayout: () => {
      calls.persist += 1
    },
  }
  const tree = mini.mount(bundle.components['dsh-hud-panel'], { t: T, store })
  // 键盘接管需要"在面板里按过指针"：这一步就是那一下。
  const arm = () => {
    for (const entry of bundle.listeners.get('pointerdown') ?? [])
      entry.listener({ target: fakeNode('panel') })
  }
  return { tree, store, calls, mini, bundle, arm }
}

/* ---------------------------------------------------- 差异视图（diff） */

/**
 * 面板那条 keydown 监听。
 *
 * 插件现在有**两条** keydown 监听：输入框 `↑` 召回（`apply` 时注册，最早）与面板
 * （面板挂载时注册，最晚）。这里取**最后一条**，并顺手把"两条都在、顺序如此"钉住 ——
 * 将来谁挪动了注册次序，这几条键盘用例会立刻报错，而不是悄悄测错对象。
 */
export function panelKeydown(bundle) {
  const keydowns = bundle.listeners.get('keydown') ?? []
  assert.equal(
    keydowns.length,
    2,
    `应当两条 keydown 监听（输入框召回 + 面板），实际 ${keydowns.length}`,
  )
  return keydowns[keydowns.length - 1].listener
}

/** 按谓词收集节点（会展开函数组件，因此子组件也参与断言）。 */
export function findAll(node, predicate, depth = 0, out = []) {
  if (depth > 20 || node === null || typeof node !== 'object') return out
  // 数组也可能作为"单个子节点"传进来（例如把 rows 数组直接交给 div）。
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, depth + 1, out)
    return out
  }
  if (typeof node.type === 'function')
    return findAll(node.type({ ...node.props, children: node.children }), predicate, depth + 1, out)
  if (predicate(node)) out.push(node)
  for (const child of node.children || []) findAll(child, predicate, depth + 1, out)
  return out
}

export const byClass = (className) => (node) =>
  typeof node.props?.className === 'string' && node.props.className.split(' ').includes(className)
export const byText = (text) => (node) => node.children?.length === 1 && node.children[0] === text

/** 一个改动文件的两侧 diff（宿主半已解析成 rows）。 */
export function diffFixture(overrides = {}) {
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

export function diffState(overrides = {}) {
  return {
    diff: {
      phase: 'ready',
      path: 'src/a.ts',
      file: 'src/a.ts',
      origPath: null,
      data: diffFixture(),
      side: 'worktree',
      wrap: false,
      hunk: 0,
      collapsed: [],
      errorCode: null,
      ...overrides,
    },
  }
}

export const IMAGE_PAIR_VALUE = {
  repo: '/Users/me/project',
  path: 'cat.png',
  origPath: null,
  side: 'worktree',
  sha: null,
  before: {
    kind: 'image',
    mime: 'image/png',
    bytes: 2048,
    width: 1024,
    height: 768,
    base64: 'AAAA',
  },
  after: {
    kind: 'image',
    mime: 'image/png',
    bytes: 1000,
    width: 1024,
    height: 512,
    base64: 'BBBB',
  },
}

export const BINARY_DIFF_VALUE = diffFixture({
  path: 'cat.png',
  // 两侧都报二进制：一张图改了尺寸，未暂存与已暂存两枚页签都该能看图。
  worktree: {
    rows: [
      {
        kind: 'meta',
        text: 'Binary files a/cat.png and b/cat.png differ',
        oldLine: null,
        newLine: null,
      },
    ],
    additions: 0,
    deletions: 0,
    hunks: 0,
    binary: true,
    truncated: false,
  },
  index: {
    rows: [
      {
        kind: 'meta',
        text: 'Binary files a/cat.png and b/cat.png differ',
        oldLine: null,
        newLine: null,
      },
    ],
    additions: 0,
    deletions: 0,
    hunks: 0,
    binary: true,
    truncated: false,
  },
})

/** 把面板挂上真 hooks，并让它打开一个二进制改动（图片请求由 rpc stub 回答）。 */
export async function mountBinaryDiff(imageValue) {
  const mini = createMiniReact()
  const calls = []
  const rpc = (channel, endpoint, envelope) => {
    calls.push({ endpoint, args: envelope && envelope.args })
    if (endpoint === 'image') return Promise.resolve({ ok: true, value: imageValue })
    if (endpoint === 'diff') return Promise.resolve({ ok: true, value: BINARY_DIFF_VALUE })
    return Promise.resolve({ ok: true, value: statusFixture() })
  }
  const bundle = mountClient({ ReactImpl: mini.React, rpc })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  store.openPanel(true)
  await store.openDiff({ file: 'cat.png', path: 'cat.png' })

  // 预热缓存：这个假 React 不会为**嵌套**组件跑 effect，所以走"已经取过一次"的渲染路径 ——
  // 这正好也是真实里"关掉再打开同一张图"的路径（第一帧就该有图，不该再发请求）。
  const base = { cwd: '/Users/me/project', path: 'cat.png' }
  await store.loadImagePair({ ...base, side: 'worktree' })
  await store.loadImagePair({ ...base, side: 'index' })

  mini.mount(bundle.components['dsh-hud-panel'], { t: T, store })
  await new Promise((resolve) => setImmediate(resolve))
  return { mini, store, calls, tree: () => mini.current() }
}

/* ------------------------------------------------ 悬停气泡（自己画，不靠原生 title） */

/* ------------------------------------------------- 输入框 ↑ 召回（纯文本历史） */

/**
 * 造一个"输入框 + 历史"的现场：
 * · 假的 Lexical 根节点（`data-lexical-editor="true"`，文本放 `textContent`）；
 * · 假的 Selection/Range —— 只建模"光标在同一个文本节点里的偏移"，够断言召回与光标；
 * · rpc 桩回 `prompt-history`，由 store 写进快照（按键那侧只读快照）。
 */
export async function mountComposerRecall(prompts = ['第二句', '第一句']) {
  const mini = createMiniReact()
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) => {
      if (endpoint === 'prompt-history')
        return Promise.resolve({
          ok: true,
          value: { available: true, sessionId: 'session-1', prompts },
        })
      if (endpoint === 'session-time')
        return Promise.resolve({ ok: true, value: { available: false } })
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })

  let caret = 0
  const root = {
    textContent: '',
    get innerText() {
      return this.textContent
    },
    getAttribute: (name) => (name === 'data-lexical-editor' ? 'true' : null),
    parentElement: null,
    dispatchEvent: () => true,
  }
  const selection = {
    rangeCount: 1,
    isCollapsed: true,
    focusNode: root,
    get focusOffset() {
      return caret
    },
    removeAllRanges() {},
    addRange() {},
  }
  const range = {
    selectNodeContents() {},
    cloneRange() {
      return this
    },
    setEnd: (node, offset) => {
      caret = offset
    },
    collapse: (atStart) => {
      caret = atStart ? 0 : root.textContent.length
    },
    toString: () => root.textContent.slice(0, caret),
  }
  bundle.windowStub.getSelection = () => selection
  bundle.documentStub.createRange = () => range

  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  await store.loadPromptHistory('session-1')

  const keydown = (bundle.listeners.get('keydown') ?? [])[0].listener
  /** 按一下并等写入落地（写入是异步的：要等 Lexical 的粘贴处理完，才回读确认）。 */
  const press = async (key, options = {}) => {
    const event = {
      key,
      target: options.target === undefined ? root : options.target,
      altKey: options.altKey === true,
      ctrlKey: options.ctrlKey === true,
      metaKey: false,
      isComposing: options.isComposing === true,
      prevented: undefined,
      preventDefault() {
        this.prevented = true
      },
      stopPropagation() {},
    }
    keydown(event)
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
    return event
  }
  return {
    bundle,
    store,
    root,
    press,
    setCaret: (value) => {
      caret = value
    },
    getCaret: () => caret,
  }
}

/* ------------------------------------------- 会话计时胶囊（dock 行最左一枚） */

/** 计时那一枚的数据住在 store 快照里（`sessionTime`），所以渲染是纯函数、可以直接喂。 */
export function renderTimerPill(sessionValue, options = {}) {
  return renderPill(
    {
      status: statusFixture(),
      sessionTime: { sessionId: 'session-1', value: sessionValue },
    },
    options,
  )
}

/** 悬停某一枚胶囊，拿到交给 store 的文案（气泡本体由 overlay 那枚座位画，另有用例）。 */
export function hoverTipText(node, attr, rect = { left: 100, top: 300, right: 190 }) {
  const tips = []
  const target = findByAttr(node, attr)
  assert.ok(target, `找不到 ${attr}`)
  assert.equal(typeof target.props.onPointerEnter, 'function', `${attr} 应当接了悬停接线`)
  target.props.onPointerEnter({ currentTarget: { getBoundingClientRect: () => rect } })
  void tips
  return target
}

/* ------------------------------------- 轮尾：本轮图片改动（内置卡片旁边那扇门） */

export const SESSION_CHANGES_VALUE = {
  repo: '/Users/me/project',
  sessionId: 'session-1',
  tracking: true,
  since: 1_700_000_000_000,
  files: [
    {
      file: 'assets/cat.png',
      path: 'assets/cat.png',
      writes: 2,
      edits: 0,
      firstAt: 1,
      lastAt: 300,
      lastTurn: 3,
      turns: [3],
    },
    {
      file: 'src/a.ts',
      path: 'src/a.ts',
      writes: 1,
      edits: 1,
      firstAt: 1,
      lastAt: 200,
      lastTurn: 3,
      turns: [3],
    },
    {
      file: 'assets/old.png',
      path: 'assets/old.png',
      writes: 1,
      edits: 0,
      firstAt: 1,
      lastAt: 100,
      lastTurn: 2,
      turns: [2],
    },
  ],
  possible: [
    // 命令旁听（◐）：脚本/命令产出的图基本都落这一档，所以这一档必须也收。
    {
      file: 'assets/from-script.png',
      path: 'assets/from-script.png',
      hits: 1,
      firstAt: 1,
      lastAt: 400,
      reason: 'python3 gen.py > assets/from-script.png',
      lastTurn: 3,
    },
    // 同一个文件两档都有：只算一次（确定的优先）。
    {
      file: 'assets/cat.png',
      path: 'assets/cat.png',
      hits: 1,
      firstAt: 1,
      lastAt: 350,
      reason: 'cp',
      lastTurn: 3,
    },
    {
      file: 'assets/old-guess.png',
      path: 'assets/old-guess.png',
      hits: 1,
      firstAt: 1,
      lastAt: 50,
      reason: 'cp',
      lastTurn: 2,
    },
  ],
  commands: [],
  unconfirmed: 0,
  dropped: 0,
  possibleDropped: 0,
}

/** 把轮尾图片条挂上真 hooks：先驱动 store，再预热缩略图，最后挂载组件。 */
export async function mountTurnImages(turn) {
  const mini = createMiniReact()
  const opened = []
  const rpc = (channel, endpoint) => {
    if (endpoint === 'session-changes')
      return Promise.resolve({ ok: true, value: SESSION_CHANGES_VALUE })
    if (endpoint === 'image') return Promise.resolve({ ok: true, value: IMAGE_PAIR_VALUE })
    return Promise.resolve({ ok: true, value: statusFixture() })
  }
  const bundle = mountClient({ ReactImpl: mini.React, rpc })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await store.loadSessionChanges()
  // 缩略图走的是同一个缓存：预热后第一帧就有图（假 React 不会为嵌套组件跑 effect）。
  await store.loadImagePair({ cwd: '/Users/me/project', path: 'assets/cat.png', side: 'worktree' })
  await store.loadImagePair({ cwd: '/Users/me/project', path: 'assets/old.png', side: 'worktree' })
  await store.loadImagePair({
    cwd: '/Users/me/project',
    path: 'assets/from-script.png',
    side: 'worktree',
  })

  const tree = mini.mount(bundle.components['dsh-hud-turn-images'], {
    t: T,
    store,
    sessionId: 'session-1',
    turn,
    seq: 42,
    openFile: (path) => opened.push(path),
    useSessions: (selector) => selector({ byId: { 'session-1': { cwd: '/Users/me/project' } } }),
  })
  return { mini, store, tree, opened }
}

export const chipsOf = (tree) =>
  findAll(tree, (node) => node.props && node.props['data-dsh-hud'] === 'turn-image')

/* -------------------------------------------------------- 定位与尺寸 */

/* ------------------------------------------------------------ 最近提交 */

export const COMMITS = [
  {
    sha: '2eed74e',
    author: 'wjc',
    date: '2026-10-14',
    committedAt: Date.now() - 3600 * 1000,
    refs: ['HEAD -> main', 'origin/main'],
    subject: 'feat: 差异视图',
  },
  {
    sha: '1097168',
    author: 'wjc',
    date: '2026-10-14',
    committedAt: Date.now() - 7200 * 1000,
    refs: [],
    subject: 'fix: 胶囊与输入卡片左对齐',
  },
]

/* --------------------------------------------------------------- 提交明细 */

/** 提交明细的 store 状态。 */
export function commitState(overrides = {}) {
  return {
    commit: {
      phase: 'ready',
      sha: '2eed74e0000000000000000000000000000000000',
      shortSha: '2eed74e',
      subject: 'feat: 差异视图（点击文件看 diff）',
      author: 'wjc',
      date: '2026-10-14',
      committedAt: Date.now() - 3600 * 1000,
      refs: ['HEAD -> main'],
      merge: false,
      files: [
        { status: 'M', path: 'src/a.ts', file: 'src/a.ts', origFile: null },
        {
          status: 'R',
          path: 'src/old.ts → src/new.ts',
          file: 'src/new.ts',
          origFile: 'src/old.ts',
        },
      ],
      truncated: false,
      errorCode: null,
      ...overrides,
    },
  }
}

/** 提交差异的 store 状态（右栏只有一个"侧"）。 */
export function commitDiffState(overrides = {}) {
  return {
    commit: commitState().commit,
    diff: {
      source: 'commit',
      phase: 'ready',
      sha: '2eed74e0000000000000000000000000000000000',
      shortSha: '2eed74e',
      subject: 'feat: 差异视图（点击文件看 diff）',
      path: 'src/a.ts',
      file: 'src/a.ts',
      origPath: null,
      data: {
        rows: diffFixture().worktree.rows,
        additions: 2,
        deletions: 1,
        hunks: 1,
        binary: false,
        truncated: false,
      },
      side: 'commit',
      wrap: false,
      hunk: 0,
      collapsed: [],
      errorCode: null,
      ...overrides,
    },
  }
}

/* ------------------------------------------------ 提交明细（真实 store 接线） */

/** 从座位注册里取共享 store（真实 store，带 rpc stub 就整条链路可测）。 */
export function realStore(options) {
  const { registrations } = mountClient(options)
  const entry = registrations.find((item) => item.options.id === 'dsh-hud-panel')
  return entry.options.inject().store
}

export const COMMIT_VALUE = {
  repo: '/x',
  commit: {
    sha: 'sha-1-full',
    shortSha: 'sha-1',
    subject: 'feat: 有改动',
    author: 'wjc',
    date: '2026-10-14',
    committedAt: 1_700_000_000_000,
    refs: ['HEAD -> main'],
    merge: false,
  },
  files: [
    { status: 'M', path: 'src/a.ts', file: 'src/a.ts', origFile: null },
    { status: 'A', path: 'b.txt', file: 'b.txt', origFile: null },
  ],
  truncated: false,
}

export const COMMIT_DIFF_VALUE = {
  repo: '/x',
  sha: 'sha-1-full',
  file: 'src/a.ts',
  path: 'src/a.ts',
  rows: [{ kind: 'ctx', text: 'keep', oldLine: 1, newLine: 1 }],
  additions: 0,
  deletions: 0,
  hunks: 1,
  binary: false,
  truncated: false,
}

/* ------------------------------------------- hunk 折叠与当前 hunk（渲染） */

/** 三个 hunk 的差异：够测 n/p 的边界与折叠。 */
export const MULTI_HUNK_ROWS = [
  { kind: 'meta', text: 'diff --git a/a.ts b/a.ts', oldLine: null, newLine: null },
  { kind: 'hunk', text: '@@ -1,1 +1,1 @@', oldLine: null, newLine: null },
  { kind: 'ctx', text: 'first-hunk', oldLine: 1, newLine: 1 },
  { kind: 'hunk', text: '@@ -10,1 +10,1 @@', oldLine: null, newLine: null },
  { kind: 'ctx', text: 'second-hunk', oldLine: 10, newLine: 10 },
  { kind: 'hunk', text: '@@ -20,1 +20,1 @@', oldLine: null, newLine: null },
  { kind: 'ctx', text: 'third-hunk', oldLine: 20, newLine: 20 },
]

export function multiHunkState(overrides = {}) {
  return diffState({
    data: diffFixture({
      worktree: {
        rows: MULTI_HUNK_ROWS,
        additions: 0,
        deletions: 0,
        hunks: 3,
        binary: false,
        truncated: false,
      },
    }),
    ...overrides,
  })
}

/* ------------------------------------------------- 键盘移动（真实 store） */

/** 三个 hunk 的 diff 响应。 */
export function multiHunkDiffValue() {
  return {
    repo: '/x',
    path: 'src/a.ts',
    origPath: null,
    untracked: false,
    worktree: {
      rows: MULTI_HUNK_ROWS,
      additions: 0,
      deletions: 0,
      hunks: 3,
      binary: false,
      truncated: false,
    },
    index: { rows: [], additions: 0, deletions: 0, hunks: 0, binary: false, truncated: false },
  }
}

/* -------------------------------------------------- 两栏工作台（diff 模式） */

/* ------------------------------------------------------- 键盘（面板激活后） */

/** 造一个"事件目标"节点：`panelMark` 为 'panel' 表示落在面板里。 */
export function fakeNode(panelMark = null, extra = {}) {
  return {
    getAttribute: (name) => (name === 'data-dsh-hud' ? panelMark : null),
    parentNode: null,
    ...extra,
  }
}

/** 让 store 里那串 promise 链跑完（键盘动作本身是 fire-and-forget，返回的是条目不是 promise）。 */
export function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** 造一个 keydown 事件（带 preventDefault / stopPropagation 的探针）。 */
export function keyEvent(key, extra = {}) {
  return {
    key,
    target: fakeNode('panel'),
    preventDefault() {
      this.prevented = true
    },
    stopPropagation() {
      this.stopped = true
    },
    ...extra,
  }
}

/** 挂载面板，并在面板里按一下指针把它激活。 */
export function mountArmedPanel(state = {}, options = {}) {
  const mounted = mountPanel(state, options)
  mounted.arm()
  return mounted
}

/* ------------------------------------------------- 会话归因（本会话改了哪些） */

/**
 * 一份"本会话改过哪些文件"的宿主响应（`session-changes` 的 `value`）。
 * 形状与宿主半一致：`files[]` 里是 cwd 之内的 posix 相对路径。
 */
export function sessionChangesValue(files, overrides = {}) {
  return {
    repo: '/Users/me/project',
    sessionId: 'session-1',
    tracking: true,
    since: 1_700_000_000_000,
    files: files.map((file) => ({
      path: file,
      file,
      writes: 1,
      edits: 0,
      firstAt: 1_700_000_000_000,
      lastAt: 1_700_000_060_000,
    })),
    dropped: 0,
    unconfirmed: 0,
    ...overrides,
  }
}

/** 面板/胶囊用到的那个 store 切片（组件只读快照）。 */
export function sessionSlice(files, overrides = {}) {
  const byFile = {}
  for (const item of sessionChangesValue(files).files) byFile[item.file] = item
  return {
    phase: 'ready',
    files: byFile,
    since: 1_700_000_000_000,
    dropped: 0,
    errorCode: null,
    ...overrides,
  }
}

/* ------------------------------------------------- 样式表结构（防"规则被吞"） */

/* --------------------------------------------- 命令旁听的分档显示（◐ 可能相关） */

/** 一条从命令旁听来的"可能相关"记录。 */
export function possibleItem(file, reason = "sed -i 's/a/b/' " + file) {
  return {
    path: file,
    file,
    hits: 1,
    firstAt: 1_700_000_000_000,
    lastAt: 1_700_000_060_000,
    reason,
  }
}

/** 一条命令历史。 */
export function commandItem(command, overrides = {}) {
  return {
    tool: 'bash',
    command,
    at: 1_700_000_000_000,
    failed: false,
    readOnly: false,
    ...overrides,
  }
}

/* ------------------------------------------------------ 回合级归因（第几轮改的） */

/** 一份 `turnOutline` 投影快照（和宿主的形状一致）。 */
export function turnOutline(entries) {
  return {
    turns: entries.map(([turn, prompt]) => ({ turn, seq: turn * 10, prompt, response: '' })),
    draft: '',
  }
}

/** 一套假的会话服务：`binding(id).session.projections.faceOf('turnOutline')`。 */
export function fakeSessionsService(outline, options = {}) {
  const listeners = new Set()
  const face = {
    getSnapshot: () => outline,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  // 只有 `forSession`（默认 session-1）这个会话是"已物化且带投影"的；
  // 问别的会话就返回 undefined —— 这正是"会话还没物化"的真实形态。
  const forSession = options.forSession ?? 'session-1'
  const session =
    options.materialized === false
      ? undefined
      : { projections: { faceOf: (key) => (key === 'turnOutline' ? face : undefined) } }
  return {
    pushed: 0,
    setOutline(next) {
      outline = next
      for (const listener of listeners) listener()
    },
    binding: (id) => ({ session: id === forSession ? session : undefined }),
    faceOf: face,
  }
}

/* --------------------------------------------------------------- 审阅进度 */

/** 一份带签名的 status（`review` 是"这一版"的签名表）。 */
export function reviewStatus(signatures, overrides = {}) {
  const base = statusFixture(overrides)
  return { ...base, review: signatures }
}

/** 已审存档键（与实现里的键一致）。 */
export const REVIEWED_KEY = 'dsh-hud.reviewed.v1'
/** 存档键的分隔符：与实现一样用 NUL（不写字面量转义，免得源码里是两个反斜杠都看不出来）。 */
export const REVIEW_SEP = String.fromCharCode(0)
export function reviewKey(cwd, file) {
  return cwd + REVIEW_SEP + file
}

/* --------------------------------------------- 侧栏行内状态 chip（会话一览） */

/** 一份会话一览的响应。 */
export function overviewValue(sessions, overrides = {}) {
  return {
    sessions,
    unavailable: false,
    truncated: false,
    worktrees: sessions.length,
    ...overrides,
  }
}

/** 一行摘要：`mine`/`possible` 是这个会话自己的改动数（与 git 无关）。 */
export function overviewRow(sessionId, overrides = {}) {
  return {
    sessionId,
    cwd: '/Users/me/project',
    repo: true,
    branch: 'main',
    detached: false,
    dirty: true,
    ahead: 1,
    behind: 0,
    counts: {
      modified: 2,
      added: 1,
      deleted: 0,
      renamed: 0,
      copied: 0,
      typeChanged: 0,
      untracked: 1,
      conflicted: 0,
    },
    mine: 3,
    possible: 1,
    error: null,
    ...overrides,
  }
}

/** 渲染侧栏行内 chip（座位 props 只有 sessionId / displayTitle）。 */
export function renderRowChip(state = {}, options = {}) {
  // 座位 props 只有 `sessionId` / `displayTitle`（产品就是这么传的）——所以两者分开传：
  // 第 3 个参数是快照，第 4 个才是 props。
  return renderSeat(
    'dsh-hud-session-status',
    {
      phase: 'ready',
      cwd: '/Users/me/project',
      status: statusFixture(),
      sidebarMode: 'hover',
      rows: { phase: 'ready', byId: {}, unavailable: false, truncated: false, updatedAt: 1 },
    },
    state,
    { sessionId: 'session-1', displayTitle: '会话', ...options },
  )
}

/* ------------------------------------------- 侧栏状态的三档（常亮 / 悬停 / 关） */

/** 渲染行首那枚常亮标记。 */
export function renderLeadingToken(state = {}, options = {}) {
  return renderSeat(
    'dsh-hud-session-leading',
    {
      phase: 'ready',
      cwd: '/Users/me/project',
      status: statusFixture(),
      sidebarMode: 'always',
      rows: { phase: 'ready', byId: {}, unavailable: false, truncated: false, updatedAt: 1 },
    },
    state,
    { sessionId: 'session-1', ...options },
  )
}

/* ------------------------------------------ ⋯ 菜单里的只读摘要（B 方案） */

/** 渲染 ⋯ 菜单里那条摘要。 */
export function renderMenuSummary(state = {}, options = {}) {
  return renderSeat(
    'dsh-hud-session-menu',
    {
      phase: 'ready',
      cwd: '/Users/me/project',
      status: statusFixture(),
      sidebarMode: 'always',
      rows: { phase: 'ready', byId: {}, unavailable: false, truncated: false, updatedAt: 1 },
    },
    state,
    { sessionId: 'session-1', displayTitle: '会话', ...options },
  )
}

/* ------------------------------------------------ 工具活动胶囊（像 codex-hud） */

export const TOOLS_NOW = 1_700_000_000_000

/**
 * 渲染那一行（Git 胶囊所在的座位），在行内找工具胶囊 —— `now` 固定，便于断言实时秒数。
 *
 * 工具胶囊**不是独立座位**：dock 是竖列，独立注册会另起一整行（用户实测过"换行了"）。
 */
export function renderTools(state = {}, options = {}) {
  return renderPill(
    {
      tools: {
        phase: 'ready',
        active: null,
        recent: [],
        counts: [],
        total: 0,
        updatedAt: TOOLS_NOW,
      },
      ...state,
    },
    { now: TOOLS_NOW, ...options },
  )
}

/** 渲染工具胶囊并把悬停文案收下来（气泡本体由 overlay 那枚座位画，另有专门用例）。 */
export function renderToolsWithTips(state = {}) {
  const tips = []
  const node = renderTools(state, { methods: { showTip: (key, text) => tips.push({ key, text }) } })
  return { node, tips }
}
{
  /* 下面的用例统一用 findByAttr(node, 'tools-pill') 取那一枚 */
}

export function toolsState(overrides = {}) {
  return {
    phase: 'ready',
    active: null,
    recent: [],
    counts: [],
    total: 0,
    updatedAt: TOOLS_NOW,
    ...overrides,
  }
}

/* ---------------------------------------------------------- 标签列表（面板） */

export const TAG_FIXTURES = [
  {
    name: 'v0.8.0',
    sha: 'abc1234',
    annotated: true,
    date: '2026-10-16',
    committedAt: TOOLS_NOW,
    subject: '这一版加了工具胶囊',
  },
  {
    name: 'v0.7.1',
    sha: 'def5678',
    annotated: false,
    date: '2026-10-15',
    committedAt: TOOLS_NOW - 86400000,
    subject: '修好装不上的问题',
  },
]

/**
 * 双状态冒烟：同一行"先空闲、后正在跑"都要能画出来。
 *
 * 诚实标注它**挡不住**什么：真事故是"hooks 被放进普通函数 `toolPillNode` 里、还条件调用"，
 * 真 React 会抛错并让整行 dock 消失（两枚胶囊一起不见）。我们的假 React 不校验钩子顺序，
 * 所以这条在修复前也是绿的 —— 真正的防线是 `test/mini-react.mjs` 里那条钩子顺序校验，
 * 但它目前只覆盖走 `mount()` 渲染的座位（胶囊是直接调用组件渲染的）。要让防线覆盖到这里，
 * 得把胶囊也改成走 `mount()`：那是一次 harness 改造，单独做。
 * 注意：**不传 `now`**，走生产路径（组件自己滴答）。
 */

/* ---------------------------------------------------- 胶囊里的工作区名 */

/** 覆盖胶囊看到的会话 cwd（它取自 `useSessions` 快照，不是 state）。 */
export function sessionOf(cwd) {
  return { useSessions: (selector) => selector({ byId: { 'session-1': { cwd } } }) }
}

/* ---------------------------------------------------------- 技能（skill 工具） */
