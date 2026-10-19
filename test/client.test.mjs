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
      listeners.set(name, list.filter(entry => entry.listener !== listener))
    },
    setInterval: (callback, ms) => { intervals.push({ callback, ms }); return intervals.length },
    clearInterval: () => {},
    setTimeout: (callback, ms) => { timeouts.push({ callback, ms }); return timeouts.length },
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
    createElement: () => ({ textContent: '', attributes: {}, parentNode: null, setAttribute(name, value) { this.attributes[name] = value } }),
    head,
    // 只认自己的两个标记：dock 行（dockRect 由测试注入）与自有样式表（按 data-plugin-css 复用）。
    querySelector(selector) {
      if (selector === '[data-dsh-hud="dock"]') {
        return options.dockRect ? { getBoundingClientRect: () => options.dockRect } : null
      }
      const tag = /^style\[data-plugin-css="([^"]+)"\]$/.exec(selector)
      if (tag) return styles.find(element => element.attributes['data-plugin-css'] === tag[1]) ?? null
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
    warn: (...args) => { consoleLines.push(args.join(' ')) },
    error: (...args) => { consoleLines.push(args.join(' ')) },
    log: (...args) => { consoleLines.push(args.join(' ')) },
  }

  // bundle 主体是脚本：跑在受控的 window/document/navigator/console 下，它只做一次 self-register。
  new Function('window', 'document', 'require', 'navigator', 'console', source)(windowStub, documentStub, requireModule, navigatorStub, consoleStub)

  /** 触发某个 window 事件名上的全部监听（模拟浏览器派发）。 */
  const dispatch = (name, event) => {
    for (const entry of listeners.get(name) ?? []) entry.listener(event)
  }

  return { registry, styles, head, listeners, intervals, timeouts, clipboardWrites, React, requireModule, windowStub, documentStub, dispatch, consoleLines }
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
    // 按名取客户端服务：宿主没有那个客户端半边时返回 undefined（真实 ctx.get 也如此）。
    get(name) {
      return (options.services ?? {})[name]
    },
    // 动态注入：真实 Cordis 里 `ctx.inject(deps, cb)` 起一个带 inject 的子 fiber ——
    // 全部依赖到齐才回调，缺一个就永远不回调。这里照这个语义实现（含点号子服务路径）。
    inject(deps, callback) {
      const provided = options.services ?? {}
      const resolve = name => name.split('.').reduce((value, part) => (value === undefined || value === null ? undefined : value[part]), provided)
      if (deps.some(name => resolve(name) === undefined)) return () => {}
      const scope = { ...provided, effect: fn => fn() }
      const dispose = callback(scope)
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    locale: { register: () => () => {} },
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
function flatText(node) {
  return textOf(node).replace(/\s+/g, '');
}

function pillText(state = {}, options = {}) {
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
function parseStylesheet(css) {
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
function stylesheetText() {
  return mountClient().styles[0].textContent
}

/** 按选择器取一条规则（解析出来的，不是子串匹配）。 */
function cssRule(selector, css = stylesheetText()) {
  return parseStylesheet(css).rules.find(rule => rule.selector === selector) ?? null
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
  // 真实快照总是带 diff / commit 两个字段（都是 null 起）：这里就地补上，
  // 组件用例不必每个都写一遍，同时保持快照对象本身的引用（有测试靠它观察变更）。
  if (!('diff' in state)) state.diff = null
  if (!('commit' in state)) state.commit = null
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
  }
}

/**
 * 翻译桩：返回 key，并把参数按 `name=value` 缀在后面。
 *
 * 保留 key 是为了让"这条文案在不在"的断言继续好写；带上参数是为了能断言"用户实际会看到的字"
 * （比如「可能相关」那条要把命令原文贴出来，光有 key 就测不到）。
 */
const T = (key, params) => {
  if (params === undefined || params === null) return key
  const pairs = Object.keys(params).map(name => `${name}=${params[name]}`)
  return pairs.length === 0 ? key : `${key} ${pairs.join(' ')}`
}

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
  assert.equal(registry.definition.id, '@konnga/dsh-hud', '客户端模块 id 必须等于包名（参照插件同此约定：宿主按包名发模块并记账）')
  assert.equal(typeof registry.definition.factory, 'function')
})

test('客户端插件面声明 apply 与三个硬依赖服务', () => {
  const { registry, requireModule } = loadBundle()
  const exported = registry.definition.factory(requireModule)
  assert.equal(typeof exported.apply, 'function')
  assert.deepEqual(exported.inject, ['slots', 'connection', 'locale'])
})

test('apply 注册五个座位：Git 胶囊（含计时与工具两枚）、面板、轮尾图片条、⋯ 菜单摘要、悬停详情', () => {
  const { registrations } = mountClient()

  assert.equal(registrations.length, 5, '应当注册五条座位 —— 工具与计时胶囊都在 Git 那一行里，不另注册')
  const byId = Object.fromEntries(registrations.map(entry => [entry.options.id, entry.options]))
  assert.deepEqual(Object.keys(byId).sort(), [
    'dsh-hud-panel', 'dsh-hud-pill', 'dsh-hud-session-hover', 'dsh-hud-session-menu', 'dsh-hud-turn-images',
  ])
  const dockEntries = registrations.filter(entry => entry.options.name === 'conversation.input.dock')
  assert.equal(dockEntries.length, 1,
    'dock 是**竖列**：一条注册就是一整行。计时胶囊若单独注册会另起一行（工具胶囊当年就这么踩过），所以它必须由同一个占位画')
})

test('词典：代码里用到的每个 key 在 zh / en 里都有值（漏一个就会把 key 显示给用户）', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  // 取出两份词典：`var zh = { ... };` / `var en = { ... };`
  const dictOf = (name) => {
    const match = new RegExp(`var ${name} = \\{([\\s\\S]*?)\\n    \\};`).exec(source)
    assert.ok(match, `找不到 ${name} 词典`)
    return Object.fromEntries([...match[1].matchAll(/"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/g)].map(item => [item[1], item[2]]))
  }
  const zh = dictOf('zh')
  const en = dictOf('en')

  // 代码里所有 t("...") 的 key（跳过词典自身的字面量行）。
  // 前缀一个非标识符字符：否则 `createElement("button")` 里的 t 也会被当成 t("button")。
  const used = new Set([...source.matchAll(/(?:^|[^\w$])t\("([^"]+)"\)/gm)].map(match => match[1]))
  assert.ok(used.size > 20, `应当抽到足够多的 key，实际 ${String(used.size)}`)

  for (const key of used) {
    assert.ok(key in zh, `zh 缺少 ${key}`)
    assert.ok(key in en, `en 缺少 ${key}`)
    assert.notEqual(en[key], '', `en.${key} 不能是空串`)
  }
  // 两份词典的 key 集合必须一致（否则切语言会出现原始 key）。
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())

  // 动态 key 也要在（errorText 会按宿主半的 code 拼 key）。
  for (const key of ['err.timeout', 'err.no-cwd', 'err.git-missing', 'err.invalid-cwd', 'err.git-failed', 'err.invalid-path', 'err.stale-host', 'err.transport', 'commit.unknown']) {
    assert.ok(zh[key] && en[key], `动态 key ${key} 必须在两份词典里`)
  }
})

test('apply 装上词典、自有样式与两个轮询定时器（面板状态 / 侧栏摘要）', () => {
  const { styles, labels, intervals, listeners } = mountClient()

  assert.ok(labels.includes('dsh-hud: dictionaries'))
  assert.ok(labels.includes('dsh-hud: styles'))
  assert.ok(labels.includes('dsh-hud: status poll'))
  assert.ok(labels.includes('dsh-hud: focus refresh'))
  assert.equal(styles.length, 1, '只应插入一份自有样式表')
  assert.equal(styles[0].attributes['data-dsh-hud'], 'styles')
  assert.ok(styles[0].textContent.includes('.dshh-panel'), '样式表要覆盖自己的类名')
  assert.ok(styles[0].textContent.includes('--dsw-alias-'), '配色走主题令牌')
  assert.ok(labels.includes('dsh-hud: session rows poll'))
  // 三个节拍：面板 8s（跟着看的）、工具活动 3s（宿主是内存读，密一点才看得到"正在跑"）、
  // 摘要 30s（只在悬停/⋯ 菜单里按需展示，没必要那么勤问 git）。
  assert.deepEqual(intervals.map(item => item.ms).sort((left, right) => left - right), [3000, 8000, 30000])
  assert.ok(listeners.has('focus'), '需要 focus 时补一次刷新')
})

test('自有样式表打上 DSH 的所有权标记，且被 HMR 记账删掉后能自愈', () => {
  const { styles, head, intervals, listeners, dispatch } = mountClient()

  // client-modules 靠 data-plugin 认领/清理样式：不打标就会被别的模块领走并删掉。
  assert.equal(styles[0].attributes['data-plugin'], '@konnga/dsh-hud', '值 = 客户端模块 id（= 包名），客户端运行器按它回收样式')
  assert.equal(styles[0].attributes['data-plugin-css'], 'dsh-hud/styles.css', '稳定 tag id，重复注入复用同一节点')

  // 框架在 replace/invalidate/prune 里删掉整张表 —— 轮询周期要把它补回来。
  head.removeChild(styles[0])
  assert.equal(styles.length, 0, '先模拟框架把表删掉')

  intervals[0].callback()
  assert.equal(styles.length, 1, '下一个轮询周期补回样式表')
  assert.equal(styles[0].attributes['data-plugin'], '@konnga/dsh-hud', '值 = 客户端模块 id（= 包名），客户端运行器按它回收样式')
  assert.ok(styles[0].textContent.includes('.dshh-pill'), '补回的是同一张表')

  // 幂等：没丢的时候再补一次不新增节点。
  intervals[0].callback()
  assert.equal(styles.length, 1, '已有节点就复用，不重复插入')

  // 回到页面（focus）也补一次。
  head.removeChild(styles[0])
  dispatch('focus')
  assert.equal(styles.length, 1, 'focus 时补一次样式表')
  assert.ok(listeners.has('focus'))
})

/* ------------------------------------------------------------ 渲染逻辑 */

test('胶囊：脏分支带星号、领先落后，并用 codex-hud 式简写符分组展示改动', () => {
  const text = flatText(renderPill())
  assert.ok(text.includes('git:(main*)'), `期望分支摘要，实际 ${JSON.stringify(text)}`)
  assert.ok(text.includes('↑1'), '领先数')
  assert.ok(text.includes('↓2'), '落后数')
  // 简写符：M 已修改 / A 已暂存新增 / ? 未跟踪，按固定顺序。
  // 前面多了工作区名（另有专门用例钉它），这里断言分支摘要那一段。
  assert.ok(text.endsWith('git:(main*)↑1↓2M2A1?1'), `实际 ${JSON.stringify(text)}`)
})

test('胶囊：简写符只列非零项，顺序固定为 M A D R C T ? !', () => {
  const text = textOf(renderPill({
    status: statusFixture({
      counts: { modified: 4, added: 0, deleted: 2, renamed: 1, copied: 0, typeChanged: 0, untracked: 3, conflicted: 1 },
    }),
  }))
  assert.ok(flatText(renderPill({
    status: statusFixture({
      counts: { modified: 4, added: 0, deleted: 2, renamed: 1, copied: 0, typeChanged: 0, untracked: 3, conflicted: 1 },
    }),
  })).endsWith('git:(main*)↑1↓2M4D2R1?3!1'), '简写符顺序与内容')
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
  assert.ok(byText['?1']?.includes('label-secondary'), `? 用次级文字色（label-dimmed 是反相的表面色：浅 1.26:1 / 深 1.64:1，压在面板底色上看不见），实际 ${JSON.stringify(byText['?1'])}`)
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

test('三栏的收缩规则写在样式表里：左栏固定，明细栏与差异栏一起被压缩', () => {
  const { styles } = mountClient()
  const css = styles[0].textContent
  const pane = /\.dshh-commitpane\{[^}]*\}/.exec(css)?.[0] ?? ''

  // 左栏是主面板（flex:none + 固定宽度），中间栏必须可收缩，否则窄窗口下会把左栏挤出面板。
  assert.ok(pane.includes('flex:0 1 auto'), `明细栏要可收缩，实际 ${pane}`)
  assert.ok(pane.includes('min-width:0'), 'flex 子项不写 min-width:0 就不肯缩到内容以下')
  assert.ok(/\.dshh-leftpane\{[^}]*flex:none/.test(css), '左栏保持固定宽度')
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
  assert.ok(flatText(renderPill({
    status: statusFixture({ dirty: false, ahead: 0, behind: 0, counts: { modified: 0, added: 0, deleted: 0, renamed: 0, copied: 0, typeChanged: 0, untracked: 0, conflicted: 0 } }),
  })).endsWith('git:(main)'), '干净仓库')
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

test('面板：改动清单排在最近提交之前（先看眼前要处理的，再看背景）', () => {
  const text = textOf(renderPanel({ commits: COMMITS }))
  const changes = text.indexOf('panel.changes')
  const commits = text.indexOf('panel.commits')
  assert.ok(changes >= 0, `应渲染改动清单，实际 ${JSON.stringify(text)}`)
  assert.ok(commits >= 0, '应渲染最近提交')
  assert.ok(changes < commits, `改动清单要在最近提交前面，实际 ${JSON.stringify(text)}`)

  // 概览仍在两者之前（顺序 = 概览 → 清单 → 提交）。
  const summary = text.indexOf('panel.summary')
  assert.ok(summary >= 0 && summary < changes, '改动概览在最前面')
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
  const calls = { openPanel: [], movePanel: [], commitPanel: [], resetPanel: 0, diffWidth: [], commitWidth: [], closeDiff: 0, closeCommit: 0, closeDetail: 0, persist: 0, stepFile: [], openCursor: 0, stepHunk: [], toggleHunk: [], refresh: 0 }
  // 快照是可变对象：movePanel 必须更新它，否则「松开时从 store 现读位置」读不到东西。
  const snapshot = { phase: 'ready', sessionId: 'session-1', cwd: '/Users/me/project', panelOpen: true, status: statusFixture(), diff: null, anchorTop: null, diffWidth: 470, ...state }
  const store = {
    ...fakeStore(snapshot),
    setCommitWidth: width => { calls.commitWidth.push(width); snapshot.commitWidth = width },
    setDiffWidth: width => { calls.diffWidth.push(width); snapshot.diffWidth = width },
    openPanel: value => { calls.openPanel.push(value); snapshot.panelOpen = value },
    movePanel: (pos) => { calls.movePanel.push(pos); snapshot.pos = pos },
    commitPanel: pos => { calls.commitPanel.push(pos) },
    resetPanel: () => { calls.resetPanel += 1 },
    closeDiff: () => { calls.closeDiff += 1 },
    closeDetail: () => {
      calls.closeDetail += 1
      // 真实 store 里 closeDetail 会按当前状态退一层：提交明细优先整体退掉。
      if (snapshot.commit) calls.closeCommit += 1
      else calls.closeDiff += 1
    },
    closeCommit: () => { calls.closeCommit += 1 },
    stepFile: (delta, open) => { calls.stepFile.push([delta, open]) },
    openCursor: () => { calls.openCursor += 1 },
    // 与 `renderSeat` 一致：允许用例覆盖 store 上的个别方法（键盘路径要观察调用）。
    ...(options.methods ?? {}),
    stepHunk: delta => { calls.stepHunk.push(delta) },
    toggleHunk: index => { calls.toggleHunk.push(index) },
    refresh: () => { calls.refresh += 1 },
    setDiffWidth: (width) => { calls.diffWidth.push(width); snapshot.diffWidth = width },
    persistLayout: () => { calls.persist += 1 },
  }
  const tree = mini.mount(bundle.components['dsh-hud-panel'], { t: T, store })
  // 键盘接管需要"在面板里按过指针"：这一步就是那一下。
  const arm = () => { for (const entry of bundle.listeners.get('pointerdown') ?? []) entry.listener({ target: fakeNode('panel') }) }
  return { tree, store, calls, mini, bundle, arm }
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
  assert.equal(entries.length, 2, '两条：输入框 ↑ 召回（apply 时）+ 面板（挂载时）')

  const panel = entries[entries.length - 1]
  assert.equal(panel.opts, true, '必须用捕获阶段')

  panel.listener({ key: 'Escape' })
  assert.deepEqual(calls.openPanel, [false])

  panel.listener({ key: 'a' })
  assert.deepEqual(calls.openPanel, [false], '其他按键不关面板')
})

test('交互：面板收起时不注册任何面板级监听', () => {
  const { bundle } = mountPanel({ panelOpen: false })
  const keydowns = bundle.listeners.get('keydown') ?? []
  assert.equal(keydowns.length, 1, '只剩输入框 ↑ 召回那一条 —— 面板收起时它自己不注册')
  assert.equal(bundle.listeners.has('pointermove'), false)

  // 而剩下那条对"不在输入框里"的按键完全不介入 —— 这就是"面板收起时按键照常"的含义。
  const event = keyEvent('ArrowUp', { target: fakeNode() })
  keydowns[0].listener(event)
  assert.equal(event.prevented, undefined)
})

/* ---------------------------------------------------- 差异视图（diff） */

/**
 * 面板那条 keydown 监听。
 *
 * 插件现在有**两条** keydown 监听：输入框 `↑` 召回（`apply` 时注册，最早）与面板
 * （面板挂载时注册，最晚）。这里取**最后一条**，并顺手把"两条都在、顺序如此"钉住 ——
 * 将来谁挪动了注册次序，这几条键盘用例会立刻报错，而不是悄悄测错对象。
 */
function panelKeydown(bundle) {
  const keydowns = bundle.listeners.get('keydown') ?? []
  assert.equal(keydowns.length, 2, `应当两条 keydown 监听（输入框召回 + 面板），实际 ${keydowns.length}`)
  return keydowns[keydowns.length - 1].listener
}

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
      hunk: 0,
      collapsed: [],
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
    methods: { setDiffSide: side => calls.side.push(side), toggleDiffWrap: () => { calls.wrap += 1 }, closeDetail: () => { calls.close += 1 } },
  })

  findAll(node, byText('diff.index'))[0].props.onClick()
  findAll(node, byText('diff.worktree'))[0].props.onClick()
  assert.deepEqual(calls.side, ['index', 'worktree'])

  findAll(node, byText('diff.wrap'))[0].props.onClick()
  assert.equal(calls.wrap, 1)

  // ✕ 是"收起右栏"：提交明细在场时它整体退掉，否则只关差异（见 closeDetail）。
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
  // 二进制不再直接给一句文案，而是交给图片预览（静态渲染下停在"读取图片…"）。
  const binary = renderPanel(diffState({ data: diffFixture({ worktree: { rows: [{ kind: 'meta', text: 'Binary files differ', oldLine: null, newLine: null }], additions: 0, deletions: 0, hunks: 0, binary: true, truncated: false } }) }))
  assert.ok(findByAttr(binary, 'image'), '二进制改动要挂到图片预览上')
  assert.ok(textOf(binary).includes('image.loading'), '取件期间说"读取图片"')

  const empty = renderPanel(diffState({ data: diffFixture({ worktree: { rows: [], additions: 0, deletions: 0, hunks: 0, binary: false, truncated: false } }) }))
  assert.ok(textOf(empty).includes('diff.empty'))

  const loading = renderPanel(diffState({ phase: 'loading', data: null }))
  assert.ok(textOf(loading).includes('panel.loading'))

  const failed = renderPanel(diffState({ phase: 'error', data: null, errorCode: 'timeout' }))
  assert.ok(textOf(failed).includes('err.timeout'))
})

const IMAGE_PAIR_VALUE = {
  repo: '/Users/me/project',
  path: 'cat.png',
  origPath: null,
  side: 'worktree',
  sha: null,
  before: { kind: 'image', mime: 'image/png', bytes: 2048, width: 1024, height: 768, base64: 'AAAA' },
  after: { kind: 'image', mime: 'image/png', bytes: 1000, width: 1024, height: 512, base64: 'BBBB' },
}

const BINARY_DIFF_VALUE = diffFixture({
  path: 'cat.png',
  // 两侧都报二进制：一张图改了尺寸，未暂存与已暂存两枚页签都该能看图。
  worktree: { rows: [{ kind: 'meta', text: 'Binary files a/cat.png and b/cat.png differ', oldLine: null, newLine: null }], additions: 0, deletions: 0, hunks: 0, binary: true, truncated: false },
  index: { rows: [{ kind: 'meta', text: 'Binary files a/cat.png and b/cat.png differ', oldLine: null, newLine: null }], additions: 0, deletions: 0, hunks: 0, binary: true, truncated: false },
})

/** 把面板挂上真 hooks，并让它打开一个二进制改动（图片请求由 rpc stub 回答）。 */
async function mountBinaryDiff(imageValue) {
  const mini = createMiniReact()
  const calls = []
  const rpc = (channel, endpoint, envelope) => {
    calls.push({ endpoint, args: envelope && envelope.args })
    if (endpoint === 'image') return Promise.resolve({ ok: true, value: imageValue })
    if (endpoint === 'diff') return Promise.resolve({ ok: true, value: BINARY_DIFF_VALUE })
    return Promise.resolve({ ok: true, value: statusFixture() })
  }
  const bundle = mountClient({ ReactImpl: mini.React, rpc })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  store.openPanel(true)
  await store.openDiff({ file: 'cat.png', path: 'cat.png' })

  // 预热缓存：这个假 React 不会为**嵌套**组件跑 effect，所以走"已经取过一次"的渲染路径 ——
  // 这正好也是真实里"关掉再打开同一张图"的路径（第一帧就该有图，不该再发请求）。
  const base = { cwd: '/Users/me/project', path: 'cat.png' }
  await store.loadImagePair({ ...base, side: 'worktree' })
  await store.loadImagePair({ ...base, side: 'index' })

  mini.mount(bundle.components['dsh-hud-panel'], { t: T, store })
  await new Promise(resolve => setImmediate(resolve))
  return { mini, store, calls, tree: () => mini.current() }
}

test('图片预览：二进制改动画出两侧的图、尺寸变化与字节数，并按当前页签发请求', async () => {
  const { store, calls, tree } = await mountBinaryDiff(IMAGE_PAIR_VALUE)
  assert.equal(store.getSnapshot().diff.data.worktree.binary, true, '前提：git 把这条改动报成二进制')

  const images = findAll(tree(), node => node && node.type === 'img')
  assert.equal(images.length, 2, '并排两张：索引那一版 + 工作区这一版')
  assert.match(images[0].props.src, /^data:image\/png;base64,/, '图直接用数据 URL 画，不落盘也不外链')

  const text = textOf(tree())
  assert.ok(text.includes('image.beforeWorktree') && text.includes('image.afterWorktree'), `两侧各有标签，实际 ${text}`)
  assert.ok(text.includes('image.dimsChanged'), '尺寸变了要一眼看到')
  assert.ok(text.includes('w=1024 h=768') && text.includes('w=1024 h=512'), `尺寸文案要带具体数字，实际 ${text}`)
  assert.ok(text.includes('2.0 KB → 1.0 KB'), `字节变化也要报，实际 ${text}`)

  // 预热的两次就是全部请求：组件命中缓存后不该再发（也没发成别的键）。
  const imageCalls = calls.filter(entry => entry.endpoint === 'image')
  assert.deepEqual(imageCalls.map(entry => entry.args.side), ['worktree', 'index'], '两个页签各一份缓存，键里必须带侧')

  // 切到「已暂存」：页签换侧后仍然有图（用的是那一侧的缓存）。
  store.setDiffSide('index')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(findAll(tree(), node => node && node.type === 'img').length, 2, '换侧后照画，不该掉回"读取图片…"')
})

test('图片预览：认不出的二进制退回原来那句话，并说清是哪一种', async () => {
  const notImage = await mountBinaryDiff({
    repo: '/Users/me/project',
    path: 'cat.png',
    origPath: null,
    side: 'worktree',
    sha: null,
    before: { kind: 'missing' },
    after: { kind: 'not-image', bytes: 4096 },
  })
  assert.equal(findAll(notImage.tree(), node => node && node.type === 'img').length, 0, '不是图就不该画图')
  assert.ok(textOf(notImage.tree()).includes('image.notImage'), `要说清"不是可预览的图片"，实际 ${textOf(notImage.tree())}`)

  const tooLarge = await mountBinaryDiff({
    repo: '/Users/me/project',
    path: 'cat.png',
    origPath: null,
    side: 'worktree',
    sha: null,
    before: { kind: 'image', mime: 'image/png', bytes: 100, width: 8, height: 8, base64: 'AAAA' },
    after: { kind: 'too-large', bytes: 9_000_000, limit: 4 * 1024 * 1024 },
  })
  const text = textOf(tooLarge.tree())
  assert.ok(text.includes('image.tooLarge'), `超上限要说清上限，实际 ${text}`)
  assert.ok(text.includes('limit=4') && text.includes('size=9.00 MB'), `要带上上限与真实大小，实际 ${text}`)
  assert.equal(findAll(tooLarge.tree(), node => node && node.type === 'img').length, 1, '另一侧仍然画得出来')
})

test('图片预览：缩放按钮看得见、点得动；适应宽度 / 100% / 150% / 200% 封顶', async () => {
  const { store, tree } = await mountBinaryDiff(IMAGE_PAIR_VALUE)
  // 缩放控件是一组带 key 的子元素（children 是数组），所以用 findAll 而不是 findByAttr。
  const zoomBtn = key => findAll(tree(), node => node.props && node.props['data-dsh-hud'] === key)[0]
  const images = () => findAll(tree(), node => node && node.type === 'img')
  const settle = () => new Promise(resolve => setImmediate(resolve))

  assert.ok(zoomBtn('image-zoom'), '要有一排看得见、点的着的缩放控件（内置那个藏在悬停感应带里）')
  assert.ok(textOf(tree()).includes('image.fitWidth'), '默认状态是"适应宽度"')
  assert.equal(images()[0].props.style, undefined, '适应宽度交给 CSS（max-width:100%），不写死宽度')

  // 从适应宽度按 ＋ → 100%（固有宽 1024）：按固有像素算，不用等图片加载。
  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  assert.equal(store.getSnapshot().diff.zoom, 1, '缩放档位住在 store 里（换个文件也记得）')
  assert.equal(images()[0].props.style.width, '1024px')
  assert.equal(images()[0].props.style.maxWidth, 'none')
  assert.ok(textOf(tree()).includes('image.zoomValue'), '数值按钮显示百分比')

  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  assert.equal(images()[0].props.style.width, '1536px', '150%')

  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  assert.equal(images()[0].props.style.width, '2048px', '200%')

  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  assert.equal(images()[0].props.style.width, '2048px', '200% 封顶，再按没反应')

  zoomBtn('image-zoom-out').props.onClick()
  await settle()
  assert.equal(images()[0].props.style.width, '1536px', '－ 回到 150%')

  // 点数值按钮 = 回到适应宽度。
  zoomBtn('image-zoom-value').props.onClick()
  await settle()
  assert.equal(store.getSnapshot().diff.zoom, null)
  assert.equal(images()[0].props.style, undefined, '回到适应宽度')
  assert.ok(textOf(tree()).includes('image.fitWidth'))

  // 记住：定到 100% 后关掉再打开，还是 100%（与"自动换行"一样落盘）。
  zoomBtn('image-zoom-in').props.onClick()
  await settle()
  store.closeDiff()
  await store.openDiff({ file: 'cat.png', path: 'cat.png' })
  assert.equal(store.getSnapshot().diff.zoom, 1, '重新打开还记住缩放档位')
})

/* ------------------------------------------------- 输入框 ↑ 召回（纯文本历史） */

/**
 * 造一个"输入框 + 历史"的现场：
 * · 假的 Lexical 根节点（`data-lexical-editor="true"`，文本放 `textContent`）；
 * · 假的 Selection/Range —— 只建模"光标在同一个文本节点里的偏移"，够断言召回与光标；
 * · rpc 桩回 `prompt-history`，由 store 写进快照（按键那侧只读快照）。
 */
async function mountComposerRecall(prompts = ['第二句', '第一句']) {
  const mini = createMiniReact()
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) => {
      if (endpoint === 'prompt-history') return Promise.resolve({ ok: true, value: { available: true, sessionId: 'session-1', prompts } })
      if (endpoint === 'session-time') return Promise.resolve({ ok: true, value: { available: false } })
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })

  let caret = 0
  const root = {
    textContent: '',
    get innerText() { return this.textContent },
    getAttribute: name => (name === 'data-lexical-editor' ? 'true' : null),
    parentElement: null,
    dispatchEvent: () => true,
  }
  const selection = {
    rangeCount: 1,
    isCollapsed: true,
    focusNode: root,
    get focusOffset() { return caret },
    removeAllRanges() {},
    addRange() {},
  }
  const range = {
    selectNodeContents() {},
    cloneRange() { return this },
    setEnd: (node, offset) => { caret = offset },
    collapse: atStart => { caret = atStart ? 0 : root.textContent.length },
    toString: () => root.textContent.slice(0, caret),
  }
  bundle.windowStub.getSelection = () => selection
  bundle.documentStub.createRange = () => range

  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
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
      preventDefault() { this.prevented = true },
      stopPropagation() {},
    }
    keydown(event)
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
    return event
  }
  return { bundle, store, root, press, setCaret: value => { caret = value }, getCaret: () => caret }
}

test('输入框 ↑ 召回：空输入框里按 ↑ 带出上一条，连按往回翻，到最旧就放手', async () => {
  const { press, root, getCaret } = await mountComposerRecall(['第二句', '第一句'])

  const first = await press('ArrowUp')
  assert.equal(first.prevented, true, '接管了才拦默认行为')
  assert.equal(root.textContent, '第二句', '先是最新一条')
  assert.equal(getCaret(), 0, '往旧翻时光标放开头（与 OpenCode 一致）')

  const second = await press('ArrowUp')
  assert.equal(second.prevented, true)
  assert.equal(root.textContent, '第一句', '再往回一条')

  const third = await press('ArrowUp')
  assert.equal(third.prevented, undefined, '已经到最旧：把 ↑ 还给编辑器')
  assert.equal(root.textContent, '第一句', '内容不动')
})

test('输入框 ↑ 召回：Lexical 空框里的那个换行不算内容（否则整条路会静默失效）', async () => {
  const { press, root } = await mountComposerRecall(['第二句', '第一句'])
  root.textContent = '\n'                       // `<p><br></p>` 的 innerText 就长这样
  const event = await press('ArrowUp')
  assert.equal(event.prevented, true, '空框判定要吞掉末尾空白')
  assert.equal(root.textContent, '第二句')
})

test('输入框 ↑ 召回：输入框非空时不接管（多行草稿里的 ↑ 永远只是移动光标）', async () => {
  const { press, root } = await mountComposerRecall()
  root.textContent = '我写了一半'
  const event = await press('ArrowUp')
  assert.equal(event.prevented, undefined, '非空输入框不接管')
  assert.equal(root.textContent, '我写了一半', '一个字都不动')
})

test('输入框 ↑ 召回：翻进历史后用 ↓ 回到最新，再 ↓ 回到空（进历史前的位置）', async () => {
  const { press, root } = await mountComposerRecall(['第二句', '第一句'])
  await press('ArrowUp')
  await press('ArrowUp')                                   // 到最旧
  assert.equal(root.textContent, '第一句')

  const back = await press('ArrowDown')
  assert.equal(back.prevented, true)
  assert.equal(root.textContent, '第二句', '往回翻是新的一条')

  const toDraft = await press('ArrowDown')
  assert.equal(toDraft.prevented, true)
  assert.equal(root.textContent, '', '回到进历史前的空草稿')
  assert.equal((await press('ArrowDown')).prevented, undefined, '已经不在历史里：↓ 不接管')
})

test('输入框 ↑ 召回：异步落地的粘贴不会被第二层再插一遍（真机上"文字出现两遍"就是这个 bug）', async () => {
  const mini = createMiniReact()
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) => {
      if (endpoint === 'prompt-history') return Promise.resolve({ ok: true, value: { available: true, sessionId: 'session-1', prompts: ['只有一句'] } })
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })

  let caret = 0
  let execCommandCalls = 0
  const frames = []
  const root = {
    textContent: '',
    get innerText() { return this.textContent },
    getAttribute: () => 'true',
    parentElement: null,
    // 粘贴是**异步**落地：这一帧里先什么都不做，下一帧才写入 —— Lexical 就是这样。
    dispatchEvent: event => {
      if (event.type === 'paste') {
        const text = event.clipboardData.getData('text/plain')
        frames.push(() => { root.textContent = text })
      }
      return true
    },
  }
  bundle.windowStub.getSelection = () => ({ rangeCount: 1, isCollapsed: true, focusNode: root, focusOffset: caret, removeAllRanges() {}, addRange() {} })
  bundle.documentStub.createRange = () => ({ selectNodeContents() {}, cloneRange() { return this }, setEnd: (node, offset) => { caret = offset }, collapse: atStart => { caret = atStart ? 0 : root.textContent.length }, toString: () => root.textContent.slice(0, caret) })
  bundle.documentStub.execCommand = () => { execCommandCalls += 1; return true }
  bundle.windowStub.requestAnimationFrame = callback => { frames.push(callback); return frames.length }
  bundle.windowStub.ClipboardEvent = class { constructor(type, init) { this.type = type; this.clipboardData = init.clipboardData } }
  bundle.windowStub.DataTransfer = class { setData(name, value) { this.text = value } getData() { return this.text } }

  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  await store.loadPromptHistory('session-1')

  const event = { key: 'ArrowUp', target: root, prevented: undefined, preventDefault() { this.prevented = true }, stopPropagation() {} }
  ;(bundle.listeners.get('keydown') ?? [])[0].listener(event)
  assert.equal(event.prevented, true, '先挡住默认行为')

  // 把排队中的帧依次跑掉（模拟浏览器推进到内容真正落地）。
  // 注意不能把 `frames.length > 0` 写进循环守卫：第一轮时 promise 链还没跑、帧还没排上，
  // 守卫会直接判假、整个循环跳过 —— 那会变成"测了个空"。
  for (let round = 0; round < 8; round += 1) {
    const queue = frames.splice(0, frames.length)
    for (const callback of queue) callback()
    await new Promise(resolve => setImmediate(resolve))
    if (frames.length === 0 && root.textContent !== '') break
  }

  assert.equal(root.textContent, '只有一句', `内容只该有一份，实际 ${JSON.stringify(root.textContent)}`)
  assert.equal(execCommandCalls, 0, '粘贴落地后就不该再降级去 insertText（否则就是插两遍）')
})

test('输入框 ↑ 召回：不是输入框、带修饰键、输入法组合中，一律完全不介入', async () => {
  const { press, root } = await mountComposerRecall()
  const elsewhere = { getAttribute: () => null, parentElement: null }
  assert.equal((await press('ArrowUp', { target: elsewhere })).prevented, undefined, '别处按键不碰')
  assert.equal((await press('ArrowUp', { altKey: true })).prevented, undefined, '带修饰键让路')
  assert.equal((await press('ArrowUp', { ctrlKey: true })).prevented, undefined, '带 Ctrl 让路')
  assert.equal((await press('ArrowUp', { isComposing: true })).prevented, undefined, '输入法组合中让路')
  assert.equal((await press('ArrowRight')).prevented, undefined, '不是 ↑/↓ 不碰')
  assert.equal(root.textContent, '', '以上都不该写入任何内容')
})

test('输入框 ↑ 召回：拿不到历史（宿主没装 turnOutline 投影）时静默不启用', async () => {
  const mini = createMiniReact()
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) => Promise.resolve({ ok: true, value: endpoint === 'prompt-history' ? { available: false, sessionId: 'session-1', prompts: [] } : statusFixture() }),
  })
  const root = { textContent: '', get innerText() { return this.textContent }, getAttribute: () => 'true', parentElement: null, dispatchEvent: () => true }
  bundle.windowStub.getSelection = () => ({ rangeCount: 1, isCollapsed: true, focusNode: root, focusOffset: 0, removeAllRanges() {}, addRange() {} })
  bundle.documentStub.createRange = () => ({ selectNodeContents() {}, cloneRange() { return this }, setEnd() {}, collapse() {}, toString: () => '' })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  await store.loadPromptHistory('session-1')

  const event = { key: 'ArrowUp', target: root, prevented: undefined, preventDefault() { this.prevented = true }, stopPropagation() {} }
  ;(bundle.listeners.get('keydown') ?? [])[0].listener(event)
  assert.equal(event.prevented, undefined, '没有历史就不该接管')
  assert.equal(root.textContent, '')
})


/* ------------------------------------------- 会话计时胶囊（dock 行最左一枚） */

/** 计时那一枚的数据住在 store 快照里（`sessionTime`），所以渲染是纯函数、可以直接喂。 */
function renderTimerPill(sessionValue) {
  return renderPill({
    status: statusFixture(),
    sessionTime: { sessionId: 'session-1', value: sessionValue },
  })
}

test('计时胶囊：画在 Git 那一行里、排在最后，显示挂钟时长与悬停明细', () => {
  const now = Date.now()
  const node = renderTimerPill({
    available: true, sessionId: 'session-1', createdAt: now - 134 * 60000,   // 2h14m
    turns: 27, steps: 380, llmMs: 5_355_113, toolMs: 1_389_523, now,
  })

  const pill = findByAttr(node, 'session-timer')
  assert.ok(pill, '拿到数据就该有这枚胶囊')
  assert.ok(textOf(node).includes('⏱'), '要带计时图标')
  assert.ok(textOf(node).includes('2h 14m'), `格式与 codex-hud 一致（2h 14m），实际 ${textOf(node)}`)
  assert.ok(pill.props.title.includes('timer.title') && pill.props.title.includes('timer.created'), '悬停先说是什么、创建于何时')
  assert.ok(pill.props.title.includes('llm=1h 29m') && pill.props.title.includes('tool=23m'),
    `模型 5,355,113ms→1h 29m、工具 1,389,523ms→23m，实际 ${pill.props.title}`)
  assert.ok(pill.props.title.includes('turns=27'), `悬停给出轮次/步数，实际 ${pill.props.title}`)

  // dock 是竖列：计时必须在**同一条注册**里、且排在最后（这次用例里没有工具，所以是 Git 之后）。
  const dock = findByAttr(node, 'dock')
  assert.ok(dock, 'dock 行要存在')
  const inked = findAll(dock, entry => entry.props && (entry.props['data-dsh-hud'] === 'session-timer' || entry.props['data-dsh-hud'] === 'pill'))
  assert.deepEqual(inked.map(entry => entry.props['data-dsh-hud']), ['pill', 'session-timer'],
    `计时排在最后，实际 ${JSON.stringify(inked.map(entry => entry.props['data-dsh-hud']))}`)
})

test('计时胶囊：不足一分钟显示 <1m；不可用与"没有统计"时各自的克制', () => {
  const now = Date.now()
  const fresh = renderTimerPill({ available: true, sessionId: 'session-1', createdAt: now - 30_000, turns: 0, steps: 0, llmMs: 0, toolMs: 0, now })
  assert.ok(textOf(fresh).includes('<1m'), `刚开一分钟内写 <1m，实际 ${textOf(fresh)}`)

  // 会话不在（还没恢复进存储 / 已归档 / 子会话回收）或宿主缺 sessions 服务：不画，也不留空壳。
  assert.equal(findByAttr(renderTimerPill({ available: false, sessionId: 'session-1' }), 'session-timer'), null)

  // 统计键缺失（宿主没装 session-stats）：只给挂钟，不提模型/工具与轮次 —— 宁缺毋假。
  const noStats = renderTimerPill({ available: true, sessionId: 'session-1', createdAt: now - 3 * 3600_000, turns: null, steps: null, llmMs: null, toolMs: null, now })
  const pill = findByAttr(noStats, 'session-timer')
  assert.ok(pill && textOf(noStats).includes('3h'), `3 小时整显示 3h，实际 ${textOf(noStats)}`)
  assert.ok(!pill.props.title.includes('timer.work') && !pill.props.title.includes('timer.turns'))
})

test('计时胶囊：挂载后按 3 秒节奏取数、4 秒跳一次挂钟，并把取到的值写进快照', async () => {
  const mini = createMiniReact()
  const calls = []
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) => {
      calls.push(endpoint)
      if (endpoint === 'session-time') {
        return Promise.resolve({ ok: true, value: { available: true, sessionId: 'session-1', createdAt: Date.now() - 60000, turns: 1, steps: 1, llmMs: 10, toolMs: 20, now: Date.now() } })
      }
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  const before = bundle.intervals.length
  mini.mount(bundle.components['dsh-hud-pill'], {
    t: T, store, sessionId: 'session-1',
    useSessions: selector => selector({ byId: { 'session-1': { cwd: '/Users/me/project', retainedBy: { mainView: 1 } } } }),
  })
  await new Promise(resolve => setImmediate(resolve))

  const added = bundle.intervals.slice(before).map(item => item.ms).sort((left, right) => left - right)
  assert.ok(added.includes(3000), `要按 3 秒节奏取数（loader 自带 3/60 秒两档 TTL），实际 ${JSON.stringify(added)}`)
  assert.ok(added.includes(4000), `挂钟要每 4 秒跳一次，实际 ${JSON.stringify(added)}`)
  assert.ok(calls.includes('session-time'), '挂载后应当真的去取了一次')
  assert.equal(store.getSnapshot().sessionTime.value.available, true, '取到的值要写进快照（渲染那边只读快照）')
})

test('计时胶囊：负面答案只记 3 秒 —— 启动那一下会话还没恢复进存储时，别缓存一分钟', async () => {
  const mini = createMiniReact()
  let calls = 0
  let payload = { available: false, sessionId: 'session-1' }
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) => {
      if (endpoint === 'session-time') {
        calls += 1
        return Promise.resolve({ ok: true, value: payload })
      }
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store

  assert.equal((await store.loadSessionTime('session-1')).available, false)
  assert.equal((await store.loadSessionTime('session-1')).available, false)
  assert.equal(calls, 1, '3 秒内的连问复用负面结果，不把宿主打爆')

  // 实测：启动后头几百毫秒 live=0，约 30 秒后会话才进存储 —— 过了重问间隔必须真的再问。
  payload = { available: true, sessionId: 'session-1', createdAt: Date.now() - 60000, turns: 3, steps: 9, llmMs: 1000, toolMs: 2000, now: Date.now() }
  const realNow = Date.now
  Date.now = () => realNow() + 4000
  try {
    const value = await store.loadSessionTime('session-1')
    assert.equal(value.available, true, '过了重问间隔要真的再问一次')
    assert.equal(calls, 2)
    assert.equal(store.getSnapshot().sessionTime.value.available, true, '新值要落进快照')
  } finally {
    Date.now = realNow
  }
})


/* ------------------------------------- 轮尾：本轮图片改动（内置卡片旁边那扇门） */

const SESSION_CHANGES_VALUE = {
  repo: '/Users/me/project',
  sessionId: 'session-1',
  tracking: true,
  since: 1_700_000_000_000,
  files: [
    { file: 'assets/cat.png', path: 'assets/cat.png', writes: 2, edits: 0, firstAt: 1, lastAt: 300, lastTurn: 3, turns: [3] },
    { file: 'src/a.ts', path: 'src/a.ts', writes: 1, edits: 1, firstAt: 1, lastAt: 200, lastTurn: 3, turns: [3] },
    { file: 'assets/old.png', path: 'assets/old.png', writes: 1, edits: 0, firstAt: 1, lastAt: 100, lastTurn: 2, turns: [2] },
  ],
  possible: [
    // 命令旁听（◐）：脚本/命令产出的图基本都落这一档，所以这一档必须也收。
    { file: 'assets/from-script.png', path: 'assets/from-script.png', hits: 1, firstAt: 1, lastAt: 400, reason: 'python3 gen.py > assets/from-script.png', lastTurn: 3 },
    // 同一个文件两档都有：只算一次（确定的优先）。
    { file: 'assets/cat.png', path: 'assets/cat.png', hits: 1, firstAt: 1, lastAt: 350, reason: 'cp', lastTurn: 3 },
    { file: 'assets/old-guess.png', path: 'assets/old-guess.png', hits: 1, firstAt: 1, lastAt: 50, reason: 'cp', lastTurn: 2 },
  ],
  commands: [],
  unconfirmed: 0,
  dropped: 0,
  possibleDropped: 0,
}

/** 把轮尾图片条挂上真 hooks：先驱动 store，再预热缩略图，最后挂载组件。 */
async function mountTurnImages(turn) {
  const mini = createMiniReact()
  const opened = []
  const rpc = (channel, endpoint) => {
    if (endpoint === 'session-changes') return Promise.resolve({ ok: true, value: SESSION_CHANGES_VALUE })
    if (endpoint === 'image') return Promise.resolve({ ok: true, value: IMAGE_PAIR_VALUE })
    return Promise.resolve({ ok: true, value: statusFixture() })
  }
  const bundle = mountClient({ ReactImpl: mini.React, rpc })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await store.loadSessionChanges()
  // 缩略图走的是同一个缓存：预热后第一帧就有图（假 React 不会为嵌套组件跑 effect）。
  await store.loadImagePair({ cwd: '/Users/me/project', path: 'assets/cat.png', side: 'worktree' })
  await store.loadImagePair({ cwd: '/Users/me/project', path: 'assets/old.png', side: 'worktree' })
  await store.loadImagePair({ cwd: '/Users/me/project', path: 'assets/from-script.png', side: 'worktree' })

  const tree = mini.mount(bundle.components['dsh-hud-turn-images'], {
    t: T,
    store,
    sessionId: 'session-1',
    turn,
    seq: 42,
    openFile: path => opened.push(path),
    useSessions: selector => selector({ byId: { 'session-1': { cwd: '/Users/me/project' } } }),
  })
  return { mini, store, tree, opened }
}

const chipsOf = tree => findAll(tree, node => node.props && node.props['data-dsh-hud'] === 'turn-image')

test('轮尾图片条：只列本轮的图（确定档 + 命令旁听档），点缩略图走内置预览，⇄ 进 hud 看前后对比', async () => {
  const { store, tree, opened } = await mountTurnImages({ turn: 3 })

  assert.ok(findByAttr(tree, 'turn-images'), '本轮动过图就该有这条')
  const chips = chipsOf(tree)
  assert.deepEqual(chips.map(chip => chip.props['data-file']),
    ['assets/from-script.png', 'assets/cat.png'],
    '两档都收、最近的在前，且同一个文件只算一次：src/a.ts 不是图，assets/old*.png 属于第 2 轮')
  assert.deepEqual(chips.map(chip => chip.props['data-tier']), ['possible', 'confirmed'],
    '命令旁听来的标 ◐，写文件工具改的算确定')
  assert.equal(findAll(tree, node => node && node.type === 'img').length, 2, '两张都画出缩略图')
  assert.ok(textOf(tree).includes('turnImages.title'), `标题要说"本轮"，实际 ${textOf(tree)}`)

  // 点缩略图 = 内置预览（槽位给的 openFile），这正是"点了就能看图"。
  const open = findAll(chips[0], node => node.props && typeof node.props.className === 'string' && node.props.className.includes('dshh-imgstripOpen'))[0]
  assert.ok(open, '缩略图必须是个按钮')
  assert.ok(open.props.title.includes('assets/from-script.png') && open.props.title.includes('session.possibleTitle'),
    `◐ 的悬停要说清是命令旁观来的、并给出那条命令，实际 ${open.props.title}`)
  open.props.onClick()
  assert.deepEqual(opened, ['assets/from-script.png'])

  // ⇄ 才进 hud 面板看前后两张。
  const compare = findAll(chips[0], node => node.props && node.props['data-dsh-hud'] === 'turn-image-compare')[0]
  compare.props.onClick()
  const snapshot = store.getSnapshot()
  assert.equal(snapshot.panelOpen, true, '对比要打开 hud 面板')
  assert.equal(snapshot.diff.file, 'assets/from-script.png', '并且落在同一个文件的差异上')
})

test('轮尾图片条：这一轮没动过图就不渲染，不给每条轮尾留空壳', async () => {
  const { tree } = await mountTurnImages({ turn: 9 })
  assert.equal(findByAttr(tree, 'turn-images'), null, '整条不渲染')
  assert.equal(chipsOf(tree).length, 0)
})

test('轮尾图片条：拿不到回合号时退回"本会话"，而不是整条消失', async () => {
  const { tree } = await mountTurnImages(undefined)
  assert.ok(findByAttr(tree, 'turn-images'), '形状变了也要能显示')
  assert.ok(textOf(tree).includes('turnImages.titleSession'), `标题该说"本会话"，实际 ${textOf(tree)}`)
  assert.deepEqual(chipsOf(tree).map(chip => chip.props['data-file']).sort(),
    ['assets/cat.png', 'assets/from-script.png', 'assets/old-guess.png', 'assets/old.png'])
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

test('最近提交：一行一条，带短 sha、标题、HEAD 徽标与具体时刻', () => {
  const node = renderPanel({ commits: COMMITS })
  const rows = findAll(node, byClass('dshh-commit'))
  assert.equal(rows.length, 2)

  const text = textOf(node)
  assert.ok(text.includes('panel.commits'), '有小标题')
  assert.ok(text.includes('2eed74e') && text.includes('1097168'), '短 sha')
  assert.ok(text.includes('feat: 差异视图'), '标题')

  // HEAD 徽标只在 HEAD 那条上出现。
  assert.equal(findAll(node, byClass('dshh-chead')).length, 1)

  // 具体时刻（用户要求）：不再是 `2 小时前`。COMMITS 里两条相差一小时 → 两个 `HH:mm`。
  const expectedA = new RegExp('\\d{2}:\\d{2}')
  assert.ok(expectedA.test(text), `期望具体时刻，实际 ${JSON.stringify(text)}`)
  // 一律完整年月日 + 时分（`2026-10-16 14:18`），不再有"只给时刻"的那一档。
  assert.ok(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text), `期望完整年月日，实际 ${JSON.stringify(text)}`)
})

test('最近提交：悬停给出点击提示、作者、完整时刻与 refs', () => {
  const node = renderPanel({ commits: COMMITS })
  const first = findAll(node, byClass('dshh-commit'))[0]
  const lines = first.props.title.split('\n')
  assert.equal(lines[0], 'commit.click', '第一行说明这行可点')
  assert.equal(lines[2], 'feat: 差异视图')
  assert.ok(/^wjc · \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(lines[3]),
    `悬停要给到分钟（不再依赖 git 那个只有日期的短日期），实际 ${lines[3]}`)
  assert.ok(lines.includes('HEAD -> main') && lines.includes('origin/main'))
})

test('最近提交：没有提交就整段不渲染', () => {
  assert.equal(findAll(renderPanel({ commits: [] }), byClass('dshh-commit')).length, 0)
  assert.equal(findAll(renderPanel({ commits: null }), byClass('dshh-commit')).length, 0)
  assert.ok(!textOf(renderPanel({ commits: [] })).includes('panel.commits'), '连小标题都不出现')
})

test('时刻一律给完整年月日：`2026-10-16 14:18`（不再分档、也不再是相对时间）', () => {
  const at = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm).getTime()
  const today = at(2026, 10, 16, 14, 18)
  const rows = [
    { sha: 'aaaaaaa', author: 'wjc', date: '2026-10-16', committedAt: at(2026, 10, 16, 9, 5), refs: [], subject: '今天早上' },
    { sha: 'bbbbbbb', author: 'wjc', date: '2026-03-02', committedAt: at(2026, 3, 2, 22, 37), refs: [], subject: '今年早些时候' },
    { sha: 'ccccccc', author: 'wjc', date: '2025-12-31', committedAt: at(2025, 12, 31, 9, 12), refs: [], subject: '去年' },
  ]
  const node = renderPanel({ commits: rows, now: today })
  const rowsText = findAll(node, byClass('dshh-commit')).map(textOf)
  // 每一行都必须带完整年月日 —— 只给 `09:05` 这种（今天的那档）已经不被接受。
  assert.ok(rowsText[0].includes('2026-10-16 09:05'), `今天也要年月日，实际 ${rowsText[0]}`)
  assert.ok(rowsText[1].includes('2026-03-02 22:37'), `同一年也要，实际 ${rowsText[1]}`)
  assert.ok(rowsText[2].includes('2025-12-31 09:12'), `跨年当然要，实际 ${rowsText[2]}`)
})

test('最近提交：整行可点，点击把这次提交交给 store（再点一次收起）', () => {
  const opened = []
  const node = renderPanel({ commits: COMMITS }, { methods: { toggleCommit: commit => opened.push(commit) } })
  const rows = findAll(node, byClass('dshh-commit'))
  assert.ok(rows.every(row => row.type === 'button'), '每行都是按钮（可点）')

  rows[1].props.onClick()
  assert.equal(opened.length, 1)
  assert.equal(opened[0].sha, '1097168')
  assert.equal(opened[0].subject, 'fix: 胶囊与输入卡片左对齐')
})

test('最近提交：打开的那条高亮（清单是短 sha，明细里是完整 sha）', () => {
  const open = renderPanel({ commits: COMMITS, ...commitState().commit === undefined ? {} : { commit: commitState().commit } })
  const active = findAll(open, byClass('dshh-commitActive'))
  assert.equal(active.length, 1, '只有打开的那条亮着')
  assert.ok(textOf(active[0]).includes('2eed74e'), '高亮的是 2eed74e 那条（短 sha 前缀匹配完整 sha）')

  const closed = renderPanel({ commits: COMMITS, commit: null })
  assert.equal(findAll(closed, byClass('dshh-commitActive')).length, 0, '没打开就没有高亮')
})

/* --------------------------------------------------------------- 提交明细 */

/** 提交明细的 store 状态。 */
function commitState(overrides = {}) {
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
        { status: 'R', path: 'src/old.ts → src/new.ts', file: 'src/new.ts', origFile: 'src/old.ts' },
      ],
      truncated: false,
      errorCode: null,
      ...overrides,
    },
  }
}

/** 提交差异的 store 状态（右栏只有一个"侧"）。 */
function commitDiffState(overrides = {}) {
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
      data: { rows: diffFixture().worktree.rows, additions: 2, deletions: 1, hunks: 1, binary: false, truncated: false },
      side: 'commit',
      wrap: false,
      hunk: 0,
      collapsed: [],
      errorCode: null,
      ...overrides,
    },
  }
}

test('提交明细：三栏——左栏一个字不动，只高亮打开的那条；明细在中间栏', () => {
  const withCommits = { ...commitState(), commits: COMMITS }
  const single = renderPanel({ ...withCommits, commit: null, diff: null })
  const node = renderPanel(withCommits)

  // 工作台，且左栏与"没有提交明细"时逐字一致 —— 打开提交不改动主面板。
  assert.equal(findAll(node, byClass('dshh-workbench')).length, 1)
  const left = findAll(node, byClass('dshh-leftpane'))[0]
  assert.equal(
    textOf(left),
    textOf(findAll(single, byClass('dshh-body'))[0]),
    '左栏（仓库路径 / 概览 / 提交列表 / 工作区清单）必须原封不动',
  )
  assert.equal(left.props.style.width, 380)

  // 左栏那一行高亮。
  assert.equal(findAll(left, byClass('dshh-commitActive')).length, 1)
  assert.equal(findAll(node, byClass('dshh-rowActive')).length, 0, '左栏的工作区清单不该跟着高亮')

  // 中间那一栏是这次提交的明细：元信息 + 清单。
  const right = findAll(node, byClass('dshh-commitpane'))[0]
  assert.ok(right, '中间栏渲染明细')
  const rightText = textOf(right)
  assert.ok(rightText.includes('2eed74e'), '短 sha')
  assert.ok(rightText.includes('feat: 差异视图'), '提交标题')
  assert.ok(rightText.includes('wjc · 2026-10-14'), '作者与日期')
  assert.ok(rightText.includes('HEAD -> main'), 'refs')
  assert.ok(rightText.includes('commit.files'), '这次提交的改动清单')

  const files = findAll(right, byClass('dshh-row'))
  assert.equal(files.length, 2)
  assert.ok(textOf(right).includes('src/old.ts → src/new.ts'), '重命名行与工作区清单同形')
})

test('提交明细：点清单里的文件打开该文件的差异（差异在右边那一栏）', () => {
  const calls = { files: [], detail: 0 }
  const node = renderPanel(commitState(), {
    methods: { openCommitDiff: file => calls.files.push(file), closeDetail: () => { calls.detail += 1 } },
  })

  const rows = findAll(findAll(node, byClass('dshh-commitpane'))[0], byClass('dshh-row'))
  rows[1].props.onClick()
  assert.deepEqual(calls.files.map(file => file.file), ['src/new.ts'])
  assert.equal(calls.files[0].origFile, 'src/old.ts', '重命名要把原路径一起带上')
})

test('提交明细：空提交、读取中、找不到这次提交各有文案', () => {
  const empty = renderPanel(commitState({ files: [] }))
  const emptyPane = findAll(empty, byClass('dshh-commitpane'))[0]
  assert.ok(textOf(emptyPane).includes('commit.empty'))
  assert.equal(findAll(emptyPane, byClass('dshh-row')).length, 0, '明细里没有文件行')
  assert.equal(findAll(empty, byClass('dshh-workbench')).length, 1, '明细在场就进工作台（左栏照旧）')
  assert.equal(findAll(empty, byClass('dshh-diffview')).length, 0, '空提交没有差异栏')
  // 只有提交明细栏时，右边缘那条抓握改成调它 —— 它是右边界上唯一还能变宽的东西，
  // 按下去没反应才是 bug。所以这里期望"有抓握"，且它是提交栏那条。
  assert.equal(findAll(empty, byClass('dshh-grip')).length, 1, '只有提交栏 → 右边缘那一条调提交栏')
  assert.equal(findAll(empty, item => item.props?.['data-dsh-hud'] === 'grip-commit').length, 1, '标记成提交栏那条')
  assert.equal(empty.props.style.width, 380 + 240 + 6, '左栏 + 明细栏 + 右边缘那条的让位（它是绝对定位，不占宽但要预留）')

  const loading = renderPanel(commitState({ phase: 'loading' }))
  assert.ok(textOf(findAll(loading, byClass('dshh-commitpane'))[0]).includes('commit.loading'))

  const unknown = renderPanel(commitState({ phase: 'error', errorCode: 'unknown-commit' }))
  assert.ok(textOf(findAll(unknown, byClass('dshh-commitpane'))[0]).includes('commit.unknown'))

  const timeout = renderPanel(commitState({ phase: 'error', errorCode: 'timeout' }))
  assert.ok(textOf(findAll(timeout, byClass('dshh-commitpane'))[0]).includes('err.timeout'))
})

test('提交明细：合并提交明确说按第一父提交比较', () => {
  assert.ok(textOf(findAll(renderPanel(commitState({ merge: true })), byClass('dshh-commitpane'))[0]).includes('commit.merge'))
})

test('提交差异：三栏 + 两条抓握（栏间那条调提交栏、右边缘那条调差异栏）', () => {
  const node = renderPanel(commitDiffState())

  assert.equal(findAll(node, byClass('dshh-workbench')).length, 1)
  assert.equal(findAll(node, byClass('dshh-leftpane')).length, 1, '左栏')
  assert.equal(findAll(node, byClass('dshh-commitpane')).length, 1, '提交明细栏')
  assert.equal(findAll(node, byClass('dshh-diffview')).length, 1, '差异栏')
  assert.equal(node.props.style.width, 380 + 240 + 6 + 470 + 6, '左栏 + 明细栏 + 栏间抓握 + 差异栏 + 右边缘抓握')
  assert.equal(findAll(node, byClass('dshh-commitpane'))[0].props.style.width, 240, '明细栏默认 240px（可拖）')
  // 三栏时是两条：提交栏右边那条（调提交栏）+ 面板右边缘那条（调差异栏）。
  assert.equal(findAll(node, byClass('dshh-grip')).length, 2, '提交栏与差异栏各一条抓握')
  assert.equal(findAll(node, item => item.props?.['data-dsh-hud'] === 'grip-commit').length, 1, '其中一条是提交栏的')
  assert.equal(findAll(node, item => item.props?.['data-dsh-hud'] === 'grip').length, 1, '另一条是差异栏的')

  const middle = findAll(node, byClass('dshh-commitpane'))[0]
  const middleText = textOf(middle)
  assert.ok(middleText.includes('2eed74e') && middleText.includes('feat: 差异视图'), '明细栏的头部')
  assert.ok(middleText.includes('commit.files'), '明细栏里是这次提交的清单')
  assert.ok(!middleText.includes('keep'), '差异不在明细栏里')

  const diffText = textOf(findAll(node, byClass('dshh-diffview'))[0])
  assert.ok(!diffText.includes('diff.worktree') && !diffText.includes('diff.index'), '提交差异没有两侧页签')
  assert.ok(!diffText.includes('diff.untrackedHint'), '提交里的文件不存在"未跟踪"这回事')
  assert.ok(diffText.includes('diff.wrap') && diffText.includes('diff.copy'), '换行与复制仍在')
  assert.ok(diffText.includes('keep') && diffText.includes('+2') && diffText.includes('-1'), '差异内容与计数照常')

  const files = findAll(middle, byClass('dshh-row'))
  assert.equal(findAll(middle, byClass('dshh-rowActive')).length, 1, '正在看的那份差异在明细清单里高亮')
  assert.ok(files[0].props.title.startsWith('src/a.ts'))
})

test('提交明细：窄窗口下三栏不溢出——固定栏保持，差异栏压小', () => {
  const node = mountClient({ innerWidth: 900 }).components['dsh-hud-panel']({
    t: T,
    store: { ...fakeStore({ ...commitDiffState(), panelOpen: true, anchorTop: null }), stepFile() {}, openCursor() {}, stepHunk() {}, toggleHunk() {}, closeDetail() {} },
  })

  // 目标宽度 380+240+6+470=1096 > 可用 884：整体夹到可视范围，左栏与明细栏仍是固定宽度，
  // 弹性的是差异栏（784 - 380 - 240 = 就剩这些）。
  assert.equal(node.props.style.width, 900 - 2 * 8)
  assert.equal(findAll(node, byClass('dshh-leftpane'))[0].props.style.width, 380)
  assert.equal(findAll(node, byClass('dshh-commitpane'))[0].props.style.width, 240)
})

test('提交明细栏：清单与左栏清单用不同的行标记（键盘滚动不能滚错栏）', () => {
  const node = renderPanel(commitDiffState())
  const rows = findAll(node, byClass('dshh-row'))
  const lists = rows.map(row => row.props['data-row-list'])
  assert.ok(lists.includes('changes') && lists.includes('commit'), `两份清单要能区分，实际 ${JSON.stringify(lists)}`)
})

/* ------------------------------------------------ 提交明细（真实 store 接线） */

/** 从座位注册里取共享 store（真实 store，带 rpc stub 就整条链路可测）。 */
function realStore(options) {
  const { registrations } = mountClient(options)
  const entry = registrations.find(item => item.options.id === 'dsh-hud-panel')
  return entry.options.inject().store
}

const COMMIT_VALUE = {
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

const COMMIT_DIFF_VALUE = {
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

test('提交明细（store）：点一行 → 取这次提交 → 自动打开第一个文件；收起时两样一起清掉', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: COMMIT_VALUE })
      if (endpoint === 'commit-diff') return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })

  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'sha-1', subject: 'feat: 有改动' })

  const snapshot = store.getSnapshot()
  assert.equal(snapshot.commit.phase, 'ready')
  assert.deepEqual(snapshot.commit.files.map(file => file.file), ['src/a.ts', 'b.txt'], '左栏拿这次提交的清单')
  assert.equal(snapshot.commit.shortSha, 'sha-1')
  assert.equal(snapshot.diff.source, 'commit', '右栏是提交差异')
  assert.equal(snapshot.diff.file, 'src/a.ts', '自动打开第一个文件')
  assert.equal(snapshot.diff.phase, 'ready')
  assert.equal(snapshot.diff.side, 'commit', '提交差异只有一个"侧"')

  // status 与 session-changes 是"每轮刷新都搭车"的只读事实，这里只看这次提交相关的调用。
  const first = calls.filter(call => !['status', 'session-changes', 'session-statuses', 'session-tools'].includes(call.endpoint))
  assert.deepEqual(first.map(call => call.endpoint), ['commit', 'commit-diff'])
  assert.deepEqual(first[0].args, { cwd: '/x', sha: 'sha-1' }, '拿点击时那个（可能是短）sha 去问')
  assert.deepEqual(first[1].args, { cwd: '/x', sha: 'sha-1-full', path: 'src/a.ts', origPath: null }, '之后一律用解析回来的完整 sha')

  // 切这次提交里的另一个文件：不再重复取提交本身。
  await store.openCommitDiff({ file: 'b.txt', path: 'b.txt' })
  assert.equal(store.getSnapshot().diff.file, 'b.txt')
  assert.deepEqual(calls.filter(call => call.endpoint === 'commit').length, 1)

  // 收起明细：它与它带来的差异一起收起。
  store.closeCommit()
  assert.equal(store.getSnapshot().commit, null)
  assert.equal(store.getSnapshot().diff, null)
})

test('提交明细（store）：再点一次打开着的那条就收起（短 sha 与完整 sha 要能配对）', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: COMMIT_VALUE })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')

  // 清单里是短 sha（sha-1），明细里是完整 sha（sha-1-full）——必须认得出是同一次提交。
  await store.toggleCommit({ sha: 'sha-1', subject: 'feat: 有改动' })
  assert.equal(store.getSnapshot().commit.phase, 'ready')

  await store.toggleCommit({ sha: 'sha-1', subject: 'feat: 有改动' })
  assert.equal(store.getSnapshot().commit, null, '再点一次收起明细')
  assert.equal(store.getSnapshot().diff, null, '它带来的差异一起收起')

  // 点另一条则是切换，不是收起。
  await store.toggleCommit({ sha: 'sha-2', subject: '别的提交' })
  assert.notEqual(store.getSnapshot().commit, null)
})

test('提交明细（store）：空提交不开差异，认不出的提交给错误态', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: { ...COMMIT_VALUE, files: [] } })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'sha-1' })
  assert.equal(store.getSnapshot().commit.phase, 'ready')
  assert.deepEqual(store.getSnapshot().commit.files, [])
  assert.equal(store.getSnapshot().diff, null, '空提交不开一个空差异')
})

test('提交明细（store）：宿主半说找不到这次提交时给出可读的错误态', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: false, error: { details: { code: 'unknown-commit' } } })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'deadbee' })
  assert.equal(store.getSnapshot().commit.phase, 'error')
  assert.equal(store.getSnapshot().commit.errorCode, 'unknown-commit')
  assert.equal(store.getSnapshot().diff, null)
})

test('提交明细（store）：换了工作区就把明细收起（不能显示别的仓库的提交）', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: COMMIT_VALUE })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'sha-1' })
  assert.equal(store.getSnapshot().commit.phase, 'ready')

  store.bindSession('session-2', '/other')
  assert.equal(store.getSnapshot().commit, null)
  assert.equal(store.getSnapshot().diff, null)
})

/* ------------------------------------------- hunk 折叠与当前 hunk（渲染） */

/** 三个 hunk 的差异：够测 n/p 的边界与折叠。 */
const MULTI_HUNK_ROWS = [
  { kind: 'meta', text: 'diff --git a/a.ts b/a.ts', oldLine: null, newLine: null },
  { kind: 'hunk', text: '@@ -1,1 +1,1 @@', oldLine: null, newLine: null },
  { kind: 'ctx', text: 'first-hunk', oldLine: 1, newLine: 1 },
  { kind: 'hunk', text: '@@ -10,1 +10,1 @@', oldLine: null, newLine: null },
  { kind: 'ctx', text: 'second-hunk', oldLine: 10, newLine: 10 },
  { kind: 'hunk', text: '@@ -20,1 +20,1 @@', oldLine: null, newLine: null },
  { kind: 'ctx', text: 'third-hunk', oldLine: 20, newLine: 20 },
]

function multiHunkState(overrides = {}) {
  return diffState({
    data: diffFixture({
      worktree: { rows: MULTI_HUNK_ROWS, additions: 0, deletions: 0, hunks: 3, binary: false, truncated: false },
    }),
    ...overrides,
  })
}

test('hunk：可点、带序号、折叠标记按状态翻转', () => {
  const toggled = []
  const node = renderPanel(multiHunkState({ collapsed: [1] }), { methods: { toggleHunk: index => toggled.push(index) } })

  const hunks = findAll(node, byClass('dshh-difrow-hunk'))
  assert.equal(hunks.length, 3, '三个 hunk 头都在（折叠的也留着头）')
  assert.deepEqual(hunks.map(row => row.props['data-dsh-hud']), ['hunk', 'hunk', 'hunk'])
  assert.deepEqual(hunks.map(row => row.props['data-hunk-index']), ['0', '1', '2'], '序号是渲染顺序，不是行号')

  const marks = findAll(node, byClass('dshh-hunkMark')).map(mark => textOf(mark))
  assert.deepEqual(marks, ['▾', '▸', '▾'], '折叠的那个是 ▸')

  // 点 hunk 头 = 折叠 / 展开它。
  hunks[2].props.onClick()
  assert.deepEqual(toggled, [2])
})

test('hunk：折叠只收起那一段，文件头与别的 hunk 照常显示', () => {
  const open = textOf(renderPanel(multiHunkState()))
  assert.ok(open.includes('first-hunk') && open.includes('second-hunk') && open.includes('third-hunk'))

  const folded = textOf(renderPanel(multiHunkState({ collapsed: [1] })))
  assert.ok(folded.includes('first-hunk'), '别的 hunk 的内容还在')
  assert.ok(folded.includes('third-hunk'))
  assert.ok(!folded.includes('second-hunk'), '被折叠那段的正文不渲染')
  assert.ok(folded.includes('diff --git a/a.ts b/a.ts'), 'hunk 之前的文件头永远显示')
  assert.ok(folded.includes('@@ -10,1 +10,1 @@'), '折叠的头本身还在（要能点回来）')
})

test('hunk：当前 hunk 高亮，且不是折叠中的那个', () => {
  const active = renderPanel(multiHunkState({ hunk: 2 }))
  const activeRows = findAll(active, byClass('dshh-difrow-hunkActive'))
  assert.equal(activeRows.length, 1, '只有一个当前 hunk')
  assert.equal(activeRows[0].props['data-hunk-index'], '2')

  // 当前 hunk 正好被折叠时不标"当前"（不然用户看不到内容却看到高亮）。
  const foldedActive = renderPanel(multiHunkState({ hunk: 1, collapsed: [1] }))
  assert.equal(findAll(foldedActive, byClass('dshh-difrow-hunkActive')).length, 0)
})

test('清单：键盘选中用描边，正在看的差异用底色，两者可以同时在不同行上', () => {
  const node = renderPanel({ ...multiHunkState(), cursor: 'new file.txt' })
  const rows = findAll(node, byClass('dshh-row'))
  assert.deepEqual(rows.map(row => row.props['data-row-index']), ['0', '1'], '行带序号（键盘把它滚回视野要用）')

  const active = findAll(node, byClass('dshh-rowActive'))
  const cursor = findAll(node, byClass('dshh-rowCursor'))
  assert.equal(active.length, 1, '正在看的是 src/a.ts')
  assert.ok(active[0].props.title.startsWith('src/a.ts'))
  assert.equal(cursor.length, 1, '键盘选中的是另一行')
  assert.ok(cursor[0].props.title.startsWith('new file.txt'))
  assert.notEqual(active[0], cursor[0])
})

/* ------------------------------------------------- 键盘移动（真实 store） */

/** 三个 hunk 的 diff 响应。 */
function multiHunkDiffValue() {
  return {
    repo: '/x',
    path: 'src/a.ts',
    origPath: null,
    untracked: false,
    worktree: { rows: MULTI_HUNK_ROWS, additions: 0, deletions: 0, hunks: 3, binary: false, truncated: false },
    index: { rows: [], additions: 0, deletions: 0, hunks: 0, binary: false, truncated: false },
  }
}

test('键盘移动（store）：↑/↓ 在工作区清单里走，到底就停住', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'diff') return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
      return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
    },
  })
  store.bindSession('session-1', '/x')
  await store.refresh()

  // 还没选过：向下落在第一条，向上落在最后一条。
  assert.equal(store.stepFile(1, false).file, 'src/a.ts')
  assert.equal(store.getSnapshot().cursor, 'src/a.ts')
  assert.equal(store.stepFile(1, false).file, 'new file.txt')
  assert.equal(store.stepFile(1, false).file, 'new file.txt', '到底了就停住，不绕回')
  assert.equal(store.stepFile(-1, false).file, 'src/a.ts')
  assert.equal(store.getSnapshot().diff, null, '只移动不打开')
  assert.equal(store.stepFile(-1, false).file, 'src/a.ts', '到顶了也停住')

  assert.equal(store.stepFile(1, true).file, 'new file.txt', '移动并打开')
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'new file.txt')
  assert.deepEqual(calls.filter(call => call.endpoint === 'diff').map(call => call.args.path), ['new file.txt'])
})

test('键盘移动（store）：还没选过时 ↑ 落在最后一条', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.refresh()

  assert.equal(store.stepFile(-1, false).file, 'new file.txt', '↑ 先落在最后一条，用户不必先点一行')
})

test('键盘移动（store）：清单跟着视图走——提交页里返回的是这次提交的文件', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'commit') return Promise.resolve({ ok: true, value: COMMIT_VALUE })
      if (endpoint === 'commit-diff') return Promise.resolve({ ok: true, value: COMMIT_DIFF_VALUE })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openCommit({ sha: 'sha-1', subject: 'feat: 有改动' })

  assert.equal(store.getSnapshot().cursor, 'src/a.ts', '打开提交时顺手选中了第一个文件')
  const next = store.stepFile(1, true)
  assert.equal(next.file, 'b.txt')
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'b.txt')
  assert.equal(calls.filter(call => call.endpoint === 'diff').length, 0, '提交视图里不该去问工作区差异')
  assert.deepEqual(calls.filter(call => call.endpoint === 'commit-diff').map(call => call.args.path), ['src/a.ts', 'b.txt'])
})

test('键盘移动（store）：Enter 打开选中的那条，还没选过就打开第一条', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.refresh()

  store.openCursor()
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'src/a.ts', '没选过就打开第一条')
  assert.equal(store.getSnapshot().cursor, 'src/a.ts')

  store.stepFile(1, false)
  assert.equal(store.getSnapshot().cursor, 'new file.txt', '↑/↓ 先把选中的那行挪过去')
  store.openCursor()
  await flush()
  assert.equal(store.getSnapshot().diff.file, 'new file.txt')
  assert.deepEqual(calls.filter(call => call.endpoint === 'diff').map(call => call.args.path), ['src/a.ts', 'new file.txt'])
})

test('hunk 移动（store）：n/p 在 hunk 之间走，跳到折叠的那个会展开它', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openDiff({ file: 'src/a.ts', path: 'src/a.ts' })

  assert.equal(store.getSnapshot().diff.hunk, 0, '刚打开时落在第一个 hunk')
  assert.deepEqual(store.getSnapshot().diff.collapsed, [])

  store.stepHunk(1)
  assert.equal(store.getSnapshot().diff.hunk, 1)
  store.stepHunk(1)
  assert.equal(store.getSnapshot().diff.hunk, 2)
  store.stepHunk(1)
  assert.equal(store.getSnapshot().diff.hunk, 2, '到最后一个就停住')
  store.stepHunk(-1)
  store.stepHunk(-1)
  store.stepHunk(-1)
  assert.equal(store.getSnapshot().diff.hunk, 0, '到第一个也停住')

  store.toggleHunk(1)
  assert.deepEqual(store.getSnapshot().diff.collapsed, [1])
  assert.equal(store.getSnapshot().diff.hunk, 1, '折叠某个 hunk 也把它变成当前 hunk')
  store.stepHunk(-1)
  store.stepHunk(1)
  assert.deepEqual(store.getSnapshot().diff.collapsed, [], '跳回折叠中的 hunk 要展开它，否则按键像没反应')

  store.toggleHunk(1)
  store.toggleHunk(1)
  assert.deepEqual(store.getSnapshot().diff.collapsed, [], '再点一次就展开')
})

test('hunk 移动（store）：换文件、换侧都会重置当前 hunk 与折叠', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: true, value: multiHunkDiffValue() })
    },
  })
  store.bindSession('session-1', '/x')
  await store.openDiff({ file: 'src/a.ts', path: 'src/a.ts' })
  store.stepHunk(2)
  store.toggleHunk(1)
  assert.equal(store.getSnapshot().diff.hunk, 1)

  store.setDiffSide('index')
  assert.equal(store.getSnapshot().diff.hunk, 0, '换侧等于换了一份 rows')
  assert.deepEqual(store.getSnapshot().diff.collapsed, [])

  store.setDiffSide('worktree')
  store.stepHunk(2)
  await store.openDiff({ file: 'new file.txt', path: 'new file.txt' })
  assert.equal(store.getSnapshot().diff.hunk, 0, '换文件也回到第一个 hunk')
  assert.deepEqual(store.getSnapshot().diff.collapsed, [])

  // 没有差异 / 没有 hunk 时按键就是 no-op，不抛错。
  store.closeDiff()
  store.stepHunk(1)
  store.toggleHunk(0)
  assert.equal(store.getSnapshot().diff, null)
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

/* ------------------------------------------------------- 键盘（面板激活后） */

/** 造一个"事件目标"节点：`panelMark` 为 'panel' 表示落在面板里。 */
function fakeNode(panelMark = null, extra = {}) {
  return {
    getAttribute: name => (name === 'data-dsh-hud' ? panelMark : null),
    parentNode: null,
    ...extra,
  }
}

/** 让 store 里那串 promise 链跑完（键盘动作本身是 fire-and-forget，返回的是条目不是 promise）。 */
function flush() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/** 造一个 keydown 事件（带 preventDefault / stopPropagation 的探针）。 */
function keyEvent(key, extra = {}) {
  return {
    key,
    target: fakeNode('panel'),
    preventDefault() { this.prevented = true },
    stopPropagation() { this.stopped = true },
    ...extra,
  }
}

/** 挂载面板，并在面板里按一下指针把它激活。 */
function mountArmedPanel(state = {}, options = {}) {
  const mounted = mountPanel(state, options)
  mounted.arm()
  return mounted
}

test('键盘：没在面板里点过就不接管按键（打字、翻菜单、滚会话都不受影响）', () => {
  const { bundle, calls } = mountPanel({ diff: diffState().diff })
  const keydown = panelKeydown(bundle)

  const event = keyEvent('ArrowDown', { target: fakeNode() })
  keydown(event)
  assert.deepEqual(calls.stepFile, [], '没激活就一个键都不该动')
  assert.equal(event.prevented, undefined)

  // 但 Esc 例外：老行为是"焦点在输入框里也收得到"。
  keydown(keyEvent('Escape', { target: fakeNode() }))
  assert.equal(calls.closeDiff, 1)
})

test('键盘：在面板里点过之后 ↑/↓ 选行、Enter 打开、[/] 移动并打开', () => {
  const { bundle, calls } = mountArmedPanel({ diff: diffState().diff })
  const keydown = panelKeydown(bundle)
  const press = (key, extra = {}) => {
    const event = keyEvent(key, extra)
    keydown(event)
    return event
  }

  assert.equal(press('ArrowDown').prevented, true, '认领的键要阻止默认滚动')
  assert.equal(press('ArrowUp').stopped, true, '也不该再让产品处理一遍')
  assert.deepEqual(calls.stepFile, [[1, false], [-1, false]], '↑/↓ 只移动，不打开')

  press('Enter')
  assert.equal(calls.openCursor, 1, 'Enter 打开选中的那条')

  press(']')
  press('[')
  assert.deepEqual(calls.stepFile.slice(2), [[1, true], [-1, true]], '[/] 移动并直接打开')

  press('n')
  press('p')
  assert.deepEqual(calls.stepHunk, [1, -1], 'n/p 跳 hunk')

  press('r')
  assert.equal(calls.refresh, 1, 'r 刷新')

  // 认不出的键不接管。
  const other = press('x')
  assert.equal(other.prevented, undefined)
})

test('键盘：Space 折叠当前 hunk；带修饰键与输入中的按键都不碰', () => {
  const { bundle, calls } = mountArmedPanel({ diff: diffState({ hunk: 2 }).diff })
  const keydown = panelKeydown(bundle)

  keydown(keyEvent(' '))
  assert.deepEqual(calls.toggleHunk, [2], 'Space 作用于当前 hunk')

  // contenteditable（产品的输入框）里打字：一个字都不能吞。
  const typing = keyEvent(' ', { target: fakeNode(null, { tagName: 'DIV', isContentEditable: true }) })
  keydown(typing)
  assert.deepEqual(calls.toggleHunk, [2], '输入时不再接管')
  assert.equal(typing.prevented, undefined)

  // 带修饰键的组合交给产品与浏览器。
  keydown(keyEvent('n', { metaKey: true }))
  keydown(keyEvent('n', { ctrlKey: true }))
  keydown(keyEvent('n', { altKey: true }))
  assert.deepEqual(calls.stepHunk, [], 'Cmd/Ctrl/Alt 组合不接管')
})

test('键盘：Tab 进面板也算激活（activeElement 在面板里）', () => {
  const { bundle, calls } = mountPanel({ diff: diffState().diff })
  const keydown = panelKeydown(bundle)

  bundle.documentStub.activeElement = fakeNode('panel')
  keydown(keyEvent('n'))
  assert.deepEqual(calls.stepHunk, [1], '不用先点一下也能用键盘')

  // 点到面板外面就把按键交还（下一次 pointerdown 会重置这个标记）。
  bundle.documentStub.activeElement = null
  bundle.listeners.get('pointerdown')[0].listener({ target: fakeNode() })
  keydown(keyEvent('n'))
  assert.deepEqual(calls.stepHunk, [1], '在别处点过之后不再接管')
})

test('键盘：面板收起时连指针监听都不注册', () => {
  const { bundle } = mountPanel({ panelOpen: false })
  assert.equal(bundle.listeners.has('pointerdown'), false)
})

test('工作台：Esc 是"退一层"——先关差异，再按才收起面板', () => {
  const { bundle, calls } = mountPanel({ diff: diffState().diff })
  const keydown = panelKeydown(bundle)
  assert.equal(typeof keydown, 'function')

  keydown({ key: 'Escape' })
  assert.equal(calls.closeDiff, 1, '先关差异')
  assert.deepEqual(calls.openPanel, [], '此时不该收起面板')

  keydown({ key: 'a' })
  assert.equal(calls.closeDiff, 1, '其他按键不动它')
})

test('提交明细：Esc 退一层——先收起右栏，再按才收起面板', () => {
  // 提交明细（右栏 = 明细，里面装着差异）：一次 Esc 把整块明细收掉。
  const detail = mountPanel(commitDiffState())
  const keydown = panelKeydown(detail.bundle)
  keydown({ key: 'Escape' })
  assert.equal(detail.calls.closeDetail, 1, '右栏整体退掉')
  assert.equal(detail.calls.closeCommit, 1, 'closeDetail 在提交明细在场时退的是明细')
  assert.deepEqual(detail.calls.openPanel, [], '此时还不收起面板')

  // 只有工作区差异：退的是差异。
  const worktree = mountPanel({ diff: diffState().diff })
  panelKeydown(worktree.bundle)({ key: 'Escape' })
  assert.equal(worktree.calls.closeDetail, 1)
  assert.equal(worktree.calls.closeDiff, 1)

  // 右栏什么都不在场：才收起面板。
  const plain = mountPanel({ diff: null, commit: null })
  panelKeydown(plain.bundle)({ key: 'Escape' })
  assert.deepEqual(plain.calls.openPanel, [false])
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

/* ------------------------------------------------- 会话归因（本会话改了哪些） */

/**
 * 一份"本会话改过哪些文件"的宿主响应（`session-changes` 的 `value`）。
 * 形状与宿主半一致：`files[]` 里是 cwd 之内的 posix 相对路径。
 */
function sessionChangesValue(files, overrides = {}) {
  return {
    repo: '/Users/me/project',
    sessionId: 'session-1',
    tracking: true,
    since: 1_700_000_000_000,
    files: files.map(file => ({
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
function sessionSlice(files, overrides = {}) {
  const byFile = {}
  for (const item of sessionChangesValue(files).files) byFile[item.file] = item
  return { phase: 'ready', files: byFile, since: 1_700_000_000_000, dropped: 0, errorCode: null, ...overrides }
}

test('会话归因（store）：随刷新取回，并归一成以文件为键的表', async () => {
  const calls = []
  const store = realStore({
    rpc: (channel, endpoint, envelope) => {
      calls.push({ endpoint, args: envelope.args })
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes') return Promise.resolve({ ok: true, value: sessionChangesValue(['src/a.ts', 'new file.txt']) })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  const call = calls.find(item => item.endpoint === 'session-changes')
  assert.ok(call, '要跟着刷一起去取')
  assert.deepEqual(call.args, { cwd: '/Users/me/project', sessionId: 'session-1' }, '端点要 cwd + sessionId 两个参数')

  const slice = store.getSnapshot().sessionChanges
  assert.equal(slice.phase, 'ready')
  assert.deepEqual(Object.keys(slice.files).sort(), ['new file.txt', 'src/a.ts'])
  assert.equal(slice.since, 1_700_000_000_000)
})

test('会话归因（store）：宿主不认这个端点时保持"没有数据"，不打标记', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  const slice = store.getSnapshot().sessionChanges
  assert.equal(slice.files, null, '拿不到就是 null（界面据此不打标记、也不过这个滤）')
  assert.equal(slice.errorCode, 'unknown-endpoint')
})

test('会话归因（store）：换会话先清空，别把上一个会话的标记留在新会话的清单上', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes') return Promise.resolve({ ok: true, value: sessionChangesValue(['src/a.ts']) })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()
  assert.ok(store.getSnapshot().sessionChanges.files)

  store.bindSession('session-2', '/Users/me/project')
  assert.equal(store.getSnapshot().sessionChanges.files, null, '换会话先清空')
})

test('会话归因（store）：过滤发生在可见清单里，键盘导航跟着同一份走', async () => {
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes') return Promise.resolve({ ok: true, value: sessionChangesValue(['new file.txt']) })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  // statusFixture 里是 src/a.ts 与 new file.txt；本会话只改了后者。
  store.stepFile(1, false)
  assert.equal(store.getSnapshot().cursor, 'src/a.ts', '没开过滤时从第一条开始')

  store.toggleOnlySession()
  assert.equal(store.getSnapshot().onlySession, true)
  // 过滤开着：键盘只在本会话改过的那一条上移动。
  store.bindSession('session-1', '/Users/me/project')
  store.stepFile(1, false)
  assert.equal(store.getSnapshot().cursor, 'new file.txt', '↑/↓ 不该落到被过滤掉的行的下标上')
})

test('会话归因（store）：「只看本会话改的」开关会落盘', async () => {
  const bundle = mountClient({ rpc: () => Promise.resolve({ ok: true, value: statusFixture() }) })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store

  store.toggleOnlySession()
  assert.equal(store.getSnapshot().onlySession, true)
  const saved = bundle.windowStub.localStorage.values.get('dsh-hud.ui.v1')
  assert.ok(String(saved).includes('"onlySession":true'), `要写进 localStorage，实际 ${saved}`)

  store.toggleOnlySession()
  assert.equal(store.getSnapshot().onlySession, false)
  assert.ok(String(bundle.windowStub.localStorage.values.get('dsh-hud.ui.v1')).includes('"onlySession":false'))
})

test('会话归因（面板）：概览下面那行给出计数与过滤开关', () => {
  const node = renderPanel({ sessionChanges: sessionSlice(['src/a.ts', 'gone.ts']) })
  const line = findByAttr(node, 'session')
  assert.ok(line, '有数据时要有这一行')
  const text = textOf(line)
  assert.ok(text.includes('session.line'), `要报本会话改了几个，实际 ${text}`)
  assert.ok(text.includes('session.gone'), '本会话改过、现在没差异的要单独说')

  const toggle = findAll(line, node2 => node2.props?.['data-session-filter'] === 'only')[0]
  assert.ok(toggle, '要有过滤开关')
  assert.equal(toggle.props['aria-pressed'], 'false')
})

test('会话归因（面板）：清单行首标出 ● 本会话 / ○ 其他来源', () => {
  const node = renderPanel({ sessionChanges: sessionSlice(['new file.txt']) })
  const marks = findAll(node, node2 => node2.props?.['data-session-mark'])

  // statusFixture：src/a.ts（别人改的）与 new file.txt（本会话新建的）。
  assert.deepEqual(marks.map(mark => [mark.props['data-session-mark'], textOf(mark)]), [
    ['other', '○'],
    ['mine', '●'],
  ])
})

test('会话归因（面板）：没有归因数据时整列不画，那一行只剩开关', () => {
  const node = renderPanel({ sessionChanges: { phase: 'idle', files: null, since: null, dropped: 0, errorCode: null } })
  const line = findByAttr(node, 'session')
  assert.ok(line, '那一行要在（它带着三枚开关，不能因为数据没到就消失）')
  assert.deepEqual(findAll(line, item => item.props?.['data-session-filter']).map(item => item.props['data-session-filter']), ['only'], '只剩"只看本会话改的"这枚（侧栏档位开关随标记一起删了）')
  assert.equal(findAll(node, node2 => node2.props?.['data-session-mark']).length, 0, '也不该乱标"别人的"')
})

test('会话归因（面板）：过滤器只留本会话改的，清空时给一句说明而不是整段消失', () => {
  const filtered = renderPanel({ onlySession: true, sessionChanges: sessionSlice(['new file.txt']) })
  const rows = findAll(filtered, byClass('dshh-row')).filter(row => row.props['data-row-list'] === 'changes')
  assert.equal(rows.length, 1, '只剩本会话改的那条')
  assert.ok(textOf(rows[0]).includes('new file.txt'))

  // 本会话什么都没改：清单位置给一句说明。
  const empty = renderPanel({ onlySession: true, sessionChanges: sessionSlice([]) })
  const emptyRows = findAll(empty, byClass('dshh-row')).filter(row => row.props['data-row-list'] === 'changes')
  assert.equal(emptyRows.length, 0)
  assert.ok(textOf(empty).includes('session.empty'), '要说清为什么是空的')
})

test('会话归因（面板）：点了过滤开关就走 store', () => {
  const toggled = []
  const node = renderPanel(
    { sessionChanges: sessionSlice(['src/a.ts']) },
    { methods: { toggleOnlySession: () => toggled.push(true) } },
  )
  findAll(node, node2 => node2.props?.['data-session-filter'] === 'only')[0].props.onClick()
  assert.deepEqual(toggled, [true])
})

test('会话归因（胶囊）：改过东西才挂 `│ ●n`，没数据或 0 个都不显示', () => {
  const withChanges = pillText({ sessionChanges: sessionSlice(['src/a.ts']) })
  assert.ok(withChanges.includes('●1'), `要有本会话段，实际 ${withChanges}`)

  const none = pillText({ sessionChanges: sessionSlice([]) })
  assert.equal(none.includes('●'), false, '0 个不显示')

  const noData = pillText({ sessionChanges: { phase: 'idle', files: null, since: null, dropped: 0, errorCode: null } })
  assert.equal(noData.includes('●'), false, '没数据不显示')

  // 悬停里说清这个数字是什么。
  const node = findByAttr(renderPill({ sessionChanges: sessionSlice(['src/a.ts']) }), 'pill')
  assert.ok(String(node.props.title).includes('session.pill'), `悬停要解释，实际 ${node.props.title}`)
})

test('会话归因（诊断）：取回与失败各留一行现场', async () => {
  const ok = mountClient({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes') return Promise.resolve({ ok: true, value: sessionChangesValue(['src/a.ts']) })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  ok.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store.bindSession('session-1', '/Users/me/project')
  await flush()
  const line = ok.consoleLines.find(item => item.includes('session-changes {'))
  assert.ok(line, `要有一行取回现场，实际 ${JSON.stringify(ok.consoleLines)}`)
  assert.ok(line.includes('"files":1'), line)

  const failed = mountClient({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  failed.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store.bindSession('session-1', '/Users/me/project')
  await flush()
  const bad = failed.consoleLines.find(item => item.includes('session-changes-failed'))
  assert.ok(bad, '取不到也要说清是"宿主不认这个端点"还是传输失败')
  assert.ok(bad.includes('unknown-endpoint'), bad)
})

test('改动概览：计数芯片之间有间隔，不与相邻胶囊贴住', () => {
  // 用解析出来的规则断言：只测"文本里有 12px"会假绿 —— 规则被吞掉时文本照样在。
  const chips = cssRule('.dshh-chips')
  const chip = cssRule('.dshh-chip')

  assert.ok(chips, '这条规则必须真的成立（曾经因为删规则留下尾巴被浏览器整条吞掉，肉眼就是"没间隔"）')
  assert.ok(chips.body.includes('display:flex'), `芯片行要是 flex 容器（现在 ${chips.body}）`)
  assert.ok(chips.body.includes('gap:6px 12px'), `横向间隔要够（现在 ${chips.body}）`)
  assert.ok(chip && chip.body.includes('padding:1px 8px'), '胶囊自身也留一点内边距')
})

test('自诊断：apply 那行报出跑着的这一版 CSS 里芯片间隔是多少', () => {
  const bundle = mountClient()
  const line = bundle.consoleLines.find(item => item.includes('apply {'))
  assert.ok(line, `要有 apply 现场，实际 ${JSON.stringify(bundle.consoleLines)}`)
  assert.ok(line.includes('"chips":"6px 12px"'), `要报出真实值，实际 ${line}`)
})

test('最近提交：标题下面与改动清单一样有一条分隔线', () => {
  const commits = cssRule('.dshh-commits')
  const list = cssRule('.dshh-list')

  assert.ok(commits, '这条规则必须真的成立')
  assert.ok(commits.body.includes('border-top:1px solid'), `最近提交要有分隔线（现在 ${commits.body}）`)
  assert.ok(commits.body.includes('padding-top:4px'), '线与第一行之间要留出间距')
  // 与改动清单用同一条线：两处取同一个主题令牌，免得两个段落各是各的灰。
  const token = /border-top:1px solid ([^)]*\))/.exec(list?.body ?? '')?.[1]
  assert.ok(token && commits.body.includes(token), `要和改动清单同一条线（${token}）`)
})

/* ------------------------------------------------- 样式表结构（防"规则被吞"） */

test('样式表结构自检：没有孤儿片段、括号配平、关键规则都真的成立', () => {
  const css = stylesheetText()
  const { rules, orphan } = parseStylesheet(css)

  // 1) 孤儿片段：没成规则的文本（删规则留下尾巴、多出来的 }、未闭合的 {）。
  //    它们会把紧随其后的那条规则一起吞掉 —— 曾经就是这样让 .dshh-chips 失效的。
  assert.deepEqual(orphan, [], `样式表里有没成规则的片段：${JSON.stringify(orphan.slice(0, 3))}`)

  // 2) 注释外的中文：孤儿注释碎片会在这一步露头。
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const strayChinese = /[\u4e00-\u9fff][^;{}]{0,24}/.exec(code)
  assert.equal(strayChinese, null, `注释外不该有中文（找到 ${strayChinese?.[0]}）`)

  // 3) 每条规则的选择器都像个选择器。
  for (const rule of rules) {
    assert.ok(/^[.#:@*\[a-zA-Z]/.test(rule.selector), `可疑选择器：${rule.selector}`)
    assert.ok(!rule.selector.includes(';'), `选择器里有分号：${rule.selector}`)
  }

  // 4) 关键规则一条都不能少（少一条就是被前面某段垃圾吞了）。
  const expected = [
    '.dshh-panel', '.dshh-dock', '.dshh-pill', '.dshh-body', '.dshh-chips', '.dshh-chip',
    '.dshh-sectionTitle', '.dshh-list', '.dshh-row', '.dshh-commits', '.dshh-commit',
    '.dshh-diff', '.dshh-difrow-hunk', '.dshh-grip', '.dshh-session', '.dshh-marker',
  ]
  const have = new Set(rules.map(rule => rule.selector))
  const missing = expected.filter(selector => !have.has(selector))
  assert.deepEqual(missing, [], `这些关键规则没解析出来：${JSON.stringify(missing)}`)

  assert.ok(rules.length >= 70, `规则数偏少（${rules.length}），像是被吞了`)
})

/* --------------------------------------------- 命令旁听的分档显示（◐ 可能相关） */

/** 一条从命令旁听来的"可能相关"记录。 */
function possibleItem(file, reason = "sed -i 's/a/b/' " + file) {
  return { path: file, file, hits: 1, firstAt: 1_700_000_000_000, lastAt: 1_700_000_060_000, reason }
}

/** 一条命令历史。 */
function commandItem(command, overrides = {}) {
  return { tool: 'bash', command, at: 1_700_000_000_000, failed: false, readOnly: false, ...overrides }
}

test('命令旁听（面板）：命令里看出来的文件标 ◐，悬停说清是哪条命令', () => {
  const node = renderPanel({
    sessionChanges: sessionSlice([], { possible: { 'src/a.ts': possibleItem('src/a.ts') } }),
  })
  const marks = findAll(node, item => item.props?.['data-session-mark'])
  assert.deepEqual(marks.map(mark => [mark.props['data-session-mark'], textOf(mark)]), [
    ['possible', '◐'],
    ['other', '○'],
  ])

  const row = findAll(node, byClass('dshh-row')).filter(item => item.props['data-row-list'] === 'changes')[0]
  const title = String(row.props.title)
  assert.ok(title.includes('session.possibleTitle'), `悬停要给低一档的说明，实际 ${title}`)
  assert.ok(title.includes('sed -i'), '要把那条命令贴出来（让人自己判断）')
})

test('命令旁听（面板）：同一文件两档都有时只标 ●（确定赢过可能）', () => {
  const node = renderPanel({
    sessionChanges: sessionSlice(['src/a.ts'], { possible: { 'src/a.ts': possibleItem('src/a.ts') } }),
  })
  const marks = findAll(node, item => item.props?.['data-session-mark'])
  assert.deepEqual(marks.map(mark => mark.props['data-session-mark']), ['mine', 'other'])
})

test('命令旁听（面板）：那一行报出"另有 N 个可能相关"，悬停列出最近命令', () => {
  const node = renderPanel({
    sessionChanges: sessionSlice([], {
      possible: { 'src/a.ts': possibleItem('src/a.ts'), 'new file.txt': possibleItem('new file.txt') },
      commands: [
        commandItem('pnpm test', { readOnly: true }),
        commandItem('sed -i s/a/b/ src/a.ts', { failed: true }),
      ],
    }),
  })
  const line = findByAttr(node, 'session')
  assert.ok(textOf(line).includes('session.possible'), `要报出可能相关的个数，实际 ${textOf(line)}`)

  const text = findAll(line, byClass('dshh-sessionText'))[0]
  const title = String(text.props.title)
  assert.ok(title.includes('sed -i'), '悬停要能看到跑过的命令原文')
  assert.ok(title.includes('session.commandFailed'), '失败的那条要标出来')
})

test('命令旁听（面板）：过滤器把"可能相关"也算本会话动过的', () => {
  const filtered = renderPanel({
    onlySession: true,
    sessionChanges: sessionSlice([], { possible: { 'src/a.ts': possibleItem('src/a.ts') } }),
  })
  const rows = findAll(filtered, byClass('dshh-row')).filter(item => item.props['data-row-list'] === 'changes')
  assert.equal(rows.length, 1, '命令旁听到的那条要留下（过滤器的承诺是"本会话动过的"）')
  assert.ok(textOf(rows[0]).includes('src/a.ts'))
})

test('命令旁听（诊断）：取回时把文件数、可能相关数、命令数一起报出来', async () => {
  const bundle = mountClient({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes') {
        return Promise.resolve({
          ok: true,
          value: sessionChangesValue(['src/a.ts'], {
            possible: [possibleItem('src/b.ts')],
            commands: [commandItem('sed -i s/a/b/ src/b.ts')],
          }),
        })
      }
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store.bindSession('session-1', '/Users/me/project')
  await flush()

  const line = bundle.consoleLines.find(item => item.includes('session-changes {'))
  assert.ok(line, '要有现场')
  assert.ok(line.includes('"files":1'), line)
  assert.ok(line.includes('"possible":1'), line)
  assert.ok(line.includes('"commands":1'), line)
})

/* ------------------------------------------------------ 回合级归因（第几轮改的） */

/** 一份 `turnOutline` 投影快照（和宿主的形状一致）。 */
function turnOutline(entries) {
  return {
    turns: entries.map(([turn, prompt]) => ({ turn, seq: turn * 10, prompt, response: '' })),
    draft: '',
  }
}

/** 一套假的会话服务：`binding(id).session.projections.faceOf('turnOutline')`。 */
function fakeSessionsService(outline, options = {}) {
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
  const session = options.materialized === false
    ? undefined
    : { projections: { faceOf: key => (key === 'turnOutline' ? face : undefined) } }
  return {
    pushed: 0,
    setOutline(next) {
      outline = next
      for (const listener of listeners) listener()
    },
    binding: id => ({ session: id === forSession ? session : undefined }),
    faceOf: face,
  }
}

test('回合归因（store）：从 turnOutline 投影读回合并订阅，换会话时解绑', async () => {
  const sessions = fakeSessionsService(turnOutline([[0, '把面板改成两栏'], [1, '加上本会话改动']]))
  const store = realStore({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-changes') return Promise.resolve({ ok: true, value: sessionChangesValue(['src/a.ts']) })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
    services: { sessions },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  const turns = store.getSnapshot().turns
  assert.equal(turns.available, true)
  assert.equal(turns.latest, 1)
  assert.equal(turns.prompts[1], '加上本会话改动')

  // 投影推送新回合 → store 跟着走。
  sessions.setOutline(turnOutline([[0, 'a'], [1, 'b'], [2, 'c']]))
  assert.equal(store.getSnapshot().turns.latest, 2)
  assert.equal(store.getSnapshot().turns.prompts[2], 'c')

  // 换会话：旧的先解掉；换到那个"还没物化"的会话时，回合信息就该清空（不是留着上一条的）。
  store.bindSession('session-2', '/Users/me/project')
  assert.equal(store.getSnapshot().turns.available, false)
})

test('回合归因（store）：投影还没注册（会话没物化）时不崩，只是没有回合信息', async () => {
  const sessions = fakeSessionsService(turnOutline([[0, 'x']]), { materialized: false })
  const store = realStore({
    rpc: () => Promise.resolve({ ok: true, value: statusFixture() }),
    services: { sessions },
  })
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  assert.equal(store.getSnapshot().turns.available, false)
  assert.equal(store.getSnapshot().phase, 'ready', 'git 那半边照常')
})

test('回合归因（面板）：那一行报出"最近一轮 N 个"，行悬停说清是哪一轮', () => {
  const node = renderPanel({
    turns: { available: true, prompts: { 1: '加上本会话改动' }, latest: 1 },
    sessionChanges: sessionSlice(['src/a.ts'], {
      files: { 'src/a.ts': { path: 'src/a.ts', file: 'src/a.ts', writes: 1, edits: 0, firstAt: 1, lastAt: 2, lastTurn: 1 } },
    }),
  })
  const line = findByAttr(node, 'session')
  assert.ok(textOf(line).includes('session.latestTurn'), `要报最近一轮改了几个，实际 ${textOf(line)}`)

  const row = findAll(node, byClass('dshh-row')).filter(item => item.props['data-row-list'] === 'changes')[0]
  const title = String(row.props.title)
  assert.ok(title.includes('session.turnWithPrompt'), '悬停要给出轮次')
  assert.ok(title.includes('加上本会话改动'), '并带上那一轮的请求预览')
})

test('回合归因（面板）：投影里没有那一轮的 prompt 时只说"第 N 轮"，不编内容', () => {
  const node = renderPanel({
    turns: { available: true, prompts: {}, latest: 3 },
    sessionChanges: sessionSlice(['src/a.ts'], {
      files: { 'src/a.ts': { path: 'src/a.ts', file: 'src/a.ts', writes: 1, edits: 0, firstAt: 1, lastAt: 2, lastTurn: 3 } },
    }),
  })
  const row = findAll(node, byClass('dshh-row')).filter(item => item.props['data-row-list'] === 'changes')[0]
  assert.ok(String(row.props.title).includes('session.turn'), '有轮次')
  assert.ok(!String(row.props.title).includes('turnWithPrompt'), '没有 prompt 就不该出现带 prompt 的文案')
})

test('回合归因（面板）：第二枚开关只在拿得到回合时出现', () => {
  const withTurns = renderPanel({
    turns: { available: true, prompts: {}, latest: 1 },
    sessionChanges: sessionSlice(['src/a.ts'], {
      files: { 'src/a.ts': { path: 'src/a.ts', file: 'src/a.ts', writes: 1, edits: 0, firstAt: 1, lastAt: 2, lastTurn: 1 } },
    }),
  })
  const toggles = findAll(withTurns, item => item.props?.['data-session-filter'])
  assert.deepEqual(toggles.map(item => item.props['data-session-filter']), ['only', 'latest'])

  // 拿不到回合：整枚不画（不给一个按不动的按钮）。
  const withoutTurns = renderPanel({ sessionChanges: sessionSlice(['src/a.ts']) })
  assert.deepEqual(findAll(withoutTurns, item => item.props?.['data-session-filter']).map(item => item.props['data-session-filter']), ['only'])
})

test('回合归因（面板）：点"只看最近一轮"就走 store', () => {
  const toggled = []
  const node = renderPanel(
    {
      turns: { available: true, prompts: {}, latest: 1 },
      sessionChanges: sessionSlice(['src/a.ts'], {
        files: { 'src/a.ts': { path: 'src/a.ts', file: 'src/a.ts', writes: 1, edits: 0, firstAt: 1, lastAt: 2, lastTurn: 1 } },
      }),
    },
    { methods: { toggleOnlyLatest: () => toggled.push(true) } },
  )
  findAll(node, item => item.props?.['data-session-filter'] === 'latest')[0].props.onClick()
  assert.deepEqual(toggled, [true])
})

test('回合归因（面板）：「只看最近一轮」只留这一轮改的，并与本会话过滤叠加', () => {
  const state = {
    turns: { available: true, prompts: {}, latest: 1 },
    onlyLatest: true,
    sessionChanges: sessionSlice(['src/a.ts', 'new file.txt'], {
      files: {
        'src/a.ts': { path: 'src/a.ts', file: 'src/a.ts', writes: 1, edits: 0, firstAt: 1, lastAt: 2, lastTurn: 0 },
        'new file.txt': { path: 'new file.txt', file: 'new file.txt', writes: 1, edits: 0, firstAt: 1, lastAt: 2, lastTurn: 1 },
      },
    }),
  }
  const rows = findAll(renderPanel(state), byClass('dshh-row')).filter(item => item.props['data-row-list'] === 'changes')
  assert.deepEqual(rows.map(row => textOf(row).includes('new file.txt')), [true], `只该留最近一轮那条，实际 ${rows.length} 行`)

  // 叠加「只看本会话改的」：同一条仍在（它两档都满足）。
  const both = findAll(renderPanel({ ...state, onlySession: true }), byClass('dshh-row')).filter(item => item.props['data-row-list'] === 'changes')
  assert.equal(both.length, 1)
})

/* --------------------------------------------------------------- 审阅进度 */

/** 一份带签名的 status（`review` 是"这一版"的签名表）。 */
function reviewStatus(signatures, overrides = {}) {
  const base = statusFixture(overrides)
  return { ...base, review: signatures }
}

/** 已审存档键（与实现里的键一致）。 */
const REVIEWED_KEY = 'dsh-hud.reviewed.v1'
/** 存档键的分隔符：与实现一样用 NUL（不写字面量转义，免得源码里是两个反斜杠都看不出来）。 */
const REVIEW_SEP = String.fromCharCode(0)
function reviewKey(cwd, file) {
  return cwd + REVIEW_SEP + file
}

test('审阅进度（标记）：点行尾的 ○ 就标成已审，存进自己的键里（不跟界面开关混）', () => {
  const bundle = mountClient({ rpc: () => Promise.resolve({ ok: true, value: statusFixture() }) })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store

  store.bindSession('session-1', '/Users/me/project')
  store.setReviewForTest?.()
  // 直接把签名喂进快照（真实路径由 status 请求带回来，store 测试里单列）。
  store.refresh()
  store.toggleReviewed('src/a.ts')
  const saved = JSON.parse(bundle.windowStub.localStorage.values.get(REVIEWED_KEY) ?? '{}')
  assert.deepEqual(Object.keys(saved), [], '没有签名就不能标记 —— 标了也算不出"还是不是这一版"')
})

test('审阅进度（标记）：有签名时按签名落盘，再点一次取消', () => {
  const signatures = { 'src/a.ts': '10.1700000000000' }
  const bundle = mountClient({
    rpc: (channel, endpoint) => Promise.resolve({ ok: true, value: endpoint === 'status' ? reviewStatus(signatures) : statusFixture() }),
  })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  return flush().then(() => {
    store.toggleReviewed('src/a.ts')
    const saved = JSON.parse(bundle.windowStub.localStorage.values.get(REVIEWED_KEY) ?? '{}')
    const mark = saved[reviewKey('/Users/me/project', 'src/a.ts')]
    assert.deepEqual(Object.keys(saved), [reviewKey('/Users/me/project', 'src/a.ts')])
    assert.equal(mark.signature, '10.1700000000000', '存档里记的就是当前这一版的签名')
    assert.equal(typeof mark.at, 'number')
    assert.equal(store.getSnapshot().reviewed[reviewKey('/Users/me/project', 'src/a.ts')].signature, '10.1700000000000')

    // 再点一次：取消（同一个签名 = 同一次点击的开关语义）。
    store.toggleReviewed('src/a.ts')
    assert.deepEqual(Object.keys(store.getSnapshot().reviewed), [])
    assert.equal(bundle.windowStub.localStorage.values.get(REVIEWED_KEY), '{}')
  })
})

test('审阅进度（失效）：改动一落盘（签名变了）标记就降级成"需要重看"，不再算已审', async () => {
  let signatures = { 'src/a.ts': '10.1', 'new file.txt': '20.2' }
  const bundle = mountClient({
    rpc: (channel, endpoint) => Promise.resolve({ ok: true, value: endpoint === 'status' ? reviewStatus(signatures) : statusFixture() }),
  })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  store.toggleReviewed('src/a.ts')
  assert.equal(store.getSnapshot().reviewed[reviewKey('/Users/me/project', 'src/a.ts')].signature, '10.1')

  // 又改了一次 → 签名变了 → 那条标记变 stale（仍在存档里，但不再算"已审"）。
  signatures = { 'src/a.ts': '12.9', 'new file.txt': '20.2' }
  store.refresh()
  await flush()

  // 审阅进度只在面板打开时存在（签名也是那时才要的）：渲染快照时把面板打开。
  const node = renderPanel({ ...store.getSnapshot(), panelOpen: true })
  const marks = findAll(node, item => item.props?.['data-review'])
  assert.deepEqual(marks.map(mark => [mark.props['data-review'], textOf(mark)]), [
    ['stale', '✓'],
    ['none', '○'],
  ], '签名变了要降级成 stale，而不是继续显示已审')
  assert.ok(textOf(findByAttr(node, 'session')).includes('review.staleCount'), '行上要提一句"改动已变"')
})

test('审阅进度（清空）：只清当前工作区，别的仓库的标记不动', async () => {
  const signatures = { 'src/a.ts': '10.1' }
  const bundle = mountClient({
    rpc: (channel, endpoint) => Promise.resolve({ ok: true, value: endpoint === 'status' ? reviewStatus(signatures) : statusFixture() }),
  })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store

  // 在第一个工作区标一条。
  store.bindSession('session-1', '/Users/me/project')
  await flush()
  store.toggleReviewed('src/a.ts')

  // 换到另一个工作区再标一条（键里带 cwd，所以是两份互不相干的记录）。
  store.bindSession('session-2', '/Users/me/other')
  await flush()
  store.toggleReviewed('src/a.ts')

  const before = Object.keys(JSON.parse(bundle.windowStub.localStorage.values.get(REVIEWED_KEY)))
  assert.equal(before.length, 2, `两个工作区各一条，实际 ${JSON.stringify(before)}`)

  // 在第二个工作区里清空：只该清掉它自己那条。
  store.clearReviewed()
  const after = Object.keys(JSON.parse(bundle.windowStub.localStorage.values.get(REVIEWED_KEY)))
  assert.deepEqual(after, [reviewKey('/Users/me/project', 'src/a.ts')], '只该清掉当前工作区那条')
})

test('审阅进度（渲染）：行尾标记 + 那一行的"已审 n/总数"', () => {
  const node = renderPanel({
    status: statusFixture(),
    review: { 'src/a.ts': '1.1', 'new file.txt': '2.2' },
    reviewed: { [reviewKey('/Users/me/project', 'src/a.ts')]: { signature: '1.1', at: 1 } },
  })
  const rows = findAll(node, byClass('dshh-row')).filter(item => item.props['data-row-list'] === 'changes')
  const cells = findAll(node, item => item.props?.['data-review'])
  assert.deepEqual(cells.map(cell => [cell.props['data-review'], textOf(cell)]), [['fresh', '✓'], ['none', '○']])
  assert.ok(textOf(findByAttr(node, 'session')).includes('review.count'), '行上要报"已审 n/总数"')
  assert.equal(rows.length, 2, '行的结构没被行尾标记改坏')
})

test('审阅进度（渲染）：这次没要签名（胶囊那一路）就整列不画、也不报进度', () => {
  const node = renderPanel({ status: statusFixture(), review: {} })
  assert.deepEqual(findAll(node, item => item.props?.['data-review']), [])
  assert.ok(!textOf(findByAttr(node, 'session')).includes('review.count'), '没有签名就不该报进度')
})

test('审阅进度（键盘）：v 标记当前聚焦的那一行', () => {
  const marked = []
  const { bundle, calls } = mountArmedPanel(
    { cursor: 'src/a.ts', status: reviewStatus({ 'src/a.ts': '1.1', 'new file.txt': '2.2' }) },
    { methods: { toggleReviewed: file => marked.push(file) } },
  )
  const keydown = panelKeydown(bundle)
  const event = keyEvent('v')
  keydown(event)

  assert.deepEqual(marked, ['src/a.ts'], 'v 作用于光标所在那一行')
  assert.equal(event.prevented, true, '认领的键要阻止默认行为')
  assert.deepEqual(calls.stepFile, [], 'v 不该顺手移行')
})

/* --------------------------------------------- 侧栏行内状态 chip（会话一览） */

/** 一份会话一览的响应。 */
function overviewValue(sessions, overrides = {}) {
  return { sessions, unavailable: false, truncated: false, worktrees: sessions.length, ...overrides }
}

/** 一行摘要：`mine`/`possible` 是这个会话自己的改动数（与 git 无关）。 */
function overviewRow(sessionId, overrides = {}) {
  return {
    sessionId,
    cwd: '/Users/me/project',
    repo: true,
    branch: 'main',
    detached: false,
    dirty: true,
    ahead: 1,
    behind: 0,
    counts: { modified: 2, added: 1, deleted: 0, renamed: 0, copied: 0, typeChanged: 0, untracked: 1, conflicted: 0 },
    mine: 3,
    possible: 1,
    error: null,
    ...overrides,
  }
}

/** 渲染侧栏行内 chip（座位 props 只有 sessionId / displayTitle）。 */
function renderRowChip(state = {}, options = {}) {
  // 座位 props 只有 `sessionId` / `displayTitle`（产品就是这么传的）——所以两者分开传：
  // 第 3 个参数是快照，第 4 个才是 props。
  return renderSeat('dsh-hud-session-status', {
    phase: 'ready',
    cwd: '/Users/me/project',
    status: statusFixture(),
    sidebarMode: 'hover',
    rows: { phase: 'ready', byId: {}, unavailable: false, truncated: false, updatedAt: 1 },
  }, state, { sessionId: 'session-1', displayTitle: '会话', ...options })
}

test('侧栏 chip（store）：一次批量取回并按 sessionId 索引，换会话不用重取', async () => {
  const calls = []
  const bundle = mountClient({
    rpc: (channel, endpoint) => {
      calls.push(endpoint)
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-statuses') {
        return Promise.resolve({ ok: true, value: overviewValue([overviewRow('session-1'), overviewRow('session-2', { mine: 0 })]) })
      }
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  // 并发调用要合并成一次（定时器与手动刷新同时来的时候不该打两次）。
  await Promise.all([store.refreshRows(), store.refreshRows()])
  assert.equal(calls.filter(endpoint => endpoint === 'session-statuses').length, 1, '在途调用要合并（批量一次就够）')

  // 之后再来一次是新的请求（数据要能更新）。
  await store.refreshRows()
  assert.equal(calls.filter(endpoint => endpoint === 'session-statuses').length, 2)
  const rows = store.getSnapshot().rows
  assert.deepEqual(Object.keys(rows.byId).sort(), ['session-1', 'session-2'])
  assert.equal(rows.byId['session-1'].mine, 3)
})

test('侧栏悬停详情：分支/上游/计数/本会话改动都在；干净时如实说"干净"而不是整块不画', () => {
  const shown = renderSeat('dsh-hud-session-hover', {
    phase: 'ready',
    cwd: '/Users/me/project',
    status: statusFixture(),
    rows: { phase: 'ready', byId: { 'session-1': overviewRow('session-1') }, unavailable: false, truncated: false },
  }, {}, { sessionId: 'session-1' })
  const block = findByAttr(shown, 'row-hover')
  assert.ok(block, '有内容时要画')
  const text = textOf(block)
  assert.ok(text.includes('main*'), `要给出分支与脏标记，实际 ${text}`)
  assert.ok(text.includes('↑1'), '要有领先数')
  assert.ok(text.includes('count.modified 2'), '要有分类型计数')
  assert.ok(text.includes('session.pill'), '要有"本会话改过几个"')
  assert.ok(text.includes('rows.possible'), '要有"可能相关"那条')

  const clean = overviewRow('session-1', {
    dirty: false,
    counts: { modified: 0, added: 0, deleted: 0, renamed: 0, copied: 0, typeChanged: 0, untracked: 0, conflicted: 0 },
    mine: 0,
    possible: 0,
  })
  const hidden = renderSeat('dsh-hud-session-hover', {
    phase: 'ready',
    cwd: '/Users/me/project',
    status: statusFixture(),
    rows: { phase: 'ready', byId: { 'session-1': clean }, unavailable: false, truncated: false },
  }, {}, { sessionId: 'session-1' })
  const block2 = findByAttr(hidden, 'row-hover')
  assert.ok(block2, '干净时也该有（说清"干净"本身就是信息）')
  assert.ok(textOf(block2).includes('panel.clean'), '写明工作区干净')
  assert.ok(textOf(block2).includes('rows.ownNone'), '写明本会话没有改动记录')
})

/* ------------------------------------------- 侧栏状态的三档（常亮 / 悬停 / 关） */

/** 渲染行首那枚常亮标记。 */
function renderLeadingToken(state = {}, options = {}) {
  return renderSeat('dsh-hud-session-leading', {
    phase: 'ready',
    cwd: '/Users/me/project',
    status: statusFixture(),
    sidebarMode: 'always',
    rows: { phase: 'ready', byId: {}, unavailable: false, truncated: false, updatedAt: 1 },
  }, state, { sessionId: 'session-1', ...options })
}

/* ------------------------------------------ ⋯ 菜单里的只读摘要（B 方案） */

/** 渲染 ⋯ 菜单里那条摘要。 */
function renderMenuSummary(state = {}, options = {}) {
  return renderSeat('dsh-hud-session-menu', {
    phase: 'ready',
    cwd: '/Users/me/project',
    status: statusFixture(),
    sidebarMode: 'always',
    rows: { phase: 'ready', byId: {}, unavailable: false, truncated: false, updatedAt: 1 },
  }, state, { sessionId: 'session-1', displayTitle: '会话', ...options })
}

test('⋯ 菜单摘要：两行说清"工作区怎么了"与"本会话改了什么"', () => {
  const node = renderMenuSummary({ rows: { phase: 'ready', byId: { 'session-1': overviewRow('session-1') }, unavailable: false, truncated: false } })
  const readout = findByAttr(node, 'menu-readout')
  assert.ok(readout, '菜单里要有这条摘要')
  const text = textOf(readout)
  assert.ok(text.includes('main*'), `第一行是工作区：分支 + 脏标记，实际 ${text}`)
  assert.ok(text.includes('count.modified 2'), '第一行带上分类型计数')
  assert.ok(text.includes('session.pill'), '第二行是"本会话改过几个"')
  assert.ok(text.includes('rows.possible'), '第二行带上"可能相关"')
  assert.equal(String(readout.props.title), '/Users/me/project', '悬停给出工作区路径')
})

test('⋯ 菜单摘要：干净且本会话没改过时，明说"干净"与"没有改动记录"，而不是消失', () => {
  const clean = overviewRow('session-1', {
    dirty: false,
    counts: { modified: 0, added: 0, deleted: 0, renamed: 0, copied: 0, typeChanged: 0, untracked: 0, conflicted: 0 },
    mine: 0,
    possible: 0,
  })
  const node = renderMenuSummary({ rows: { phase: 'ready', byId: { 'session-1': clean }, unavailable: false, truncated: false } })
  const readout = findByAttr(node, 'menu-readout')
  assert.ok(readout, '干净时也要在（"这里没有东西"本身是信息，消失会让人以为功能没做）')
  assert.ok(textOf(readout).includes('panel.clean'))
  assert.ok(textOf(readout).includes('rows.ownNone'))
})

test('⋯ 菜单摘要：没有这个会话的数据时整条不画（其余情况照常显示）', () => {
  const rows = { phase: 'ready', byId: { 'session-1': overviewRow('session-1') }, unavailable: false, truncated: false }
  assert.ok(findByAttr(renderMenuSummary({ rows }), 'menu-readout'), '有数据就显示')
  assert.equal(findByAttr(renderMenuSummary({ rows: { phase: 'ready', byId: {}, unavailable: false, truncated: false } }), 'menu-readout'), null, '没有这个会话的数据时整条不画')
})

test('⋯ 菜单摘要：非仓库目录也能用（本会话改动与 git 无关）', () => {
  const node = renderMenuSummary({ rows: { phase: 'ready', byId: { 'session-1': overviewRow('session-1', { repo: false, counts: null, mine: 2 }) }, unavailable: false, truncated: false } })
  const text = textOf(findByAttr(node, 'menu-readout'))
  assert.ok(text.includes('rows.noRepo'), '说清不在仓库里')
  assert.ok(text.includes('session.pill'), '本会话改动照报')
})

/* ------------------------------------------------ 工具活动胶囊（像 codex-hud） */

const TOOLS_NOW = 1_700_000_000_000

/**
 * 渲染那一行（Git 胶囊所在的座位），在行内找工具胶囊 —— `now` 固定，便于断言实时秒数。
 *
 * 工具胶囊**不是独立座位**：dock 是竖列，独立注册会另起一整行（用户实测过"换行了"）。
 */
function renderTools(state = {}, options = {}) {
  return renderPill({
    tools: { phase: 'ready', active: null, recent: [], counts: [], total: 0, updatedAt: TOOLS_NOW },
    ...state,
  }, { now: TOOLS_NOW, ...options })
}{/* 下面的用例统一用 findByAttr(node, 'tools-pill') 取那一枚 */}

function toolsState(overrides = {}) {
  return { phase: 'ready', active: null, recent: [], counts: [], total: 0, updatedAt: TOOLS_NOW, ...overrides }
}

test('工具胶囊：正在跑就报工具名与实时秒数（秒数本地算，不靠轮询）', () => {
  const node = renderTools({ tools: toolsState({ active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW - 1200 } }) })
  const pill = findByAttr(node, 'tools-pill')
  assert.ok(pill, '有工具在跑时要画')
  const text = textOf(pill)
  assert.ok(text.includes('bash'), `要报工具名，实际 ${text}`)
  assert.ok(text.includes('1.2s'), `要报实时秒数，实际 ${text}`)
  assert.ok(String(pill.props.title).includes('tools.now'), '悬停说清"现在在跑什么"')
  assert.ok(String(pill.props.title).includes('pnpm test'), '并把参数摘要贴出来')
})

test('工具胶囊：空闲时把**每个工具各自几次**铺出来（像 codex-hud），每个带自己的 ✓/✗', () => {
  const node = renderTools({
    tools: toolsState({
      counts: [
        { name: 'bash', count: 16, ok: true },
        { name: 'apply_patch', count: 6, ok: true },
        { name: 'write_stdin', count: 3, ok: false },
      ],
      recent: [{ name: 'write_stdin', ok: false, ms: 200, summary: 'x' }],
      total: 25,
    }),
  })
  const text = textOf(findByAttr(node, 'tools-pill'))
  assert.ok(text.includes('bash ×16'), `第一个工具的次数要贴在一起，实际 ${text}`)
  assert.ok(text.includes('apply_patch ×6'), text)
  assert.ok(text.includes('write_stdin ×3'), text)
  assert.ok(text.includes('✗'), `最近一次失败的那个工具要打自己的 ✗，实际 ${text}`)
  assert.ok(text.includes('✓'), '成功的那个打 ✓')
})

test('工具胶囊：工具多于三个时收成 +k（完整清单在悬停里）', () => {
  const node = renderTools({
    tools: toolsState({
      counts: [
        { name: 'bash', count: 16, ok: true },
        { name: 'apply_patch', count: 6, ok: true },
        { name: 'write_stdin', count: 3, ok: true },
        { name: 'glob', count: 2, ok: true },
        { name: 'read_file', count: 1, ok: true },
      ],
      total: 28,
    }),
  })
  const text = textOf(findByAttr(node, 'tools-pill'))
  assert.ok(text.includes('+2'), `只铺三个，其余收成 +2，实际 ${text}`)
  assert.ok(!text.includes('glob'), '被收起来的工具不该在胶囊上出现')
  const title = String(findByAttr(node, 'tools-pill').props.title)
  assert.ok(title.includes('glob ×2'), '但悬停里要给完整清单')
})

test('工具胶囊：还在跑的时候，读数是"工具名 + 实时秒数"（不铺明细，省地方）', () => {
  const node = renderTools({
    tools: toolsState({
      active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW - 1200 },
      counts: [{ name: 'bash', count: 16, ok: true }],
      total: 16,
    }),
  })
  const text = textOf(findByAttr(node, 'tools-pill'))
  assert.ok(text.includes('bash'), text)
  assert.ok(text.includes('1.2s'), `要有实时秒数，实际 ${text}`)
  assert.ok(!text.includes('×16'), '跑的时候不铺明细')
})

test('工具胶囊：没跑过工具时那一枚不画，但 Git 胶囊照常在（界面不跳）', () => {
  const node = renderTools({})
  assert.equal(findByAttr(node, 'tools-pill'), null, 'total 0 且没有 active → 不画这一枚')
  assert.ok(findByAttr(node, 'pill'), 'Git 胶囊仍然在那一行')
  assert.equal(findByAttr(renderTools({ tools: toolsState({ phase: 'idle' }) }), 'tools-pill'), null, '还没取到数据时也不画')
})

test('工具胶囊：悬停给出总次数、各工具次数与最近几条（含耗时与命令摘要）', () => {
  const node = renderTools({
    tools: toolsState({
      recent: [
        { name: 'bash', ok: true, ms: 800, summary: 'pnpm test' },
        { name: 'read_file', ok: false, ms: 200, summary: 'src/a.ts' },
      ],
      counts: [{ name: 'bash', count: 9 }, { name: 'read_file', count: 3 }],
      total: 12,
    }),
  })
  const title = String(findByAttr(node, 'tools-pill').props.title)
  assert.ok(title.includes('tools.total'), '要有总次数')
  assert.ok(title.includes('tools.byTool'), '要有各工具次数')
  assert.ok(title.includes('bash ×9'), `各工具次数要对，实际 ${title}`)
  assert.ok(title.includes('tools.recent'), '要有最近几条')
  assert.ok(title.includes('0.8s'), '要有耗时')
  assert.ok(title.includes('pnpm test'), '要有命令摘要')
})

test('工具胶囊（store）：取回后归一，换会话先清空；宿主不认端点时不留残留', async () => {
  const calls = []
  const bundle = mountClient({
    rpc: (channel, endpoint) => {
      calls.push(endpoint)
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-tools') {
        return Promise.resolve({ ok: true, value: {
          sessionId: 'session-1', tracking: true,
          active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW },
          recent: [{ name: 'bash', ok: true, ms: 800, summary: 'pnpm test' }],
          counts: [{ name: 'bash', count: 1 }], total: 1,
        } })
      }
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  const tools = store.getSnapshot().tools
  assert.equal(tools.phase, 'ready')
  assert.equal(tools.active.name, 'bash')
  assert.equal(tools.total, 1)
  assert.ok(calls.includes('session-tools'), '要跟着刷新去取')
  const line = bundle.consoleLines.find(item => item.includes('session-tools {'))
  assert.ok(line && line.includes('"active":"bash"'), `要有现场日志，实际 ${line}`)

  // 换会话：先清空，别显示上一个会话正在跑的工具。
  store.bindSession('session-2', '/Users/me/project')
  assert.equal(store.getSnapshot().tools.active, null)
  assert.equal(store.getSnapshot().tools.total, 0)
})

test('工具胶囊（诊断）：渲染时留一行现场，能看出"画没画、哪一档"', () => {
  const bundle = mountClient()
  const component = bundle.registrations.find(item => item.options.id === 'dsh-hud-pill').component
  component({
    t: key => key,
    now: TOOLS_NOW,
    sessionId: 'session-1',
    useSessions: selector => selector({ byId: { 'session-1': { cwd: '/Users/me/project' } } }),
    store: fakeStore({
      phase: 'ready',
      sessionId: 'session-1',
      cwd: '/Users/me/project',
      status: statusFixture(),
      tools: toolsState({ active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW - 500 }, total: 7 }),
    }),
  })
  const line = bundle.consoleLines.find(item => item.includes('tools-pill {'))
  assert.ok(line, `要有渲染现场，实际 ${JSON.stringify(bundle.consoleLines)}`)
  assert.ok(line.includes('"active":"bash"') && line.includes('"total":7'), line)
})

/* ---------------------------------------------------------- 标签列表（面板） */

const TAG_FIXTURES = [
  { name: 'v0.8.0', sha: 'abc1234', annotated: true, date: '2026-10-16', committedAt: TOOLS_NOW, subject: '这一版加了工具胶囊' },
  { name: 'v0.7.1', sha: 'def5678', annotated: false, date: '2026-10-15', committedAt: TOOLS_NOW - 86400000, subject: '修好装不上的问题' },
]

test('标签列表：一行一个（tag 名 + 它指向的提交 sha + 时间），指向 HEAD 的标 HEAD', () => {
  const node = renderPanel({ tags: TAG_FIXTURES, status: statusFixture({ oid: 'abc1234' }) })
  const rows = findAll(node, item => item.props?.['data-tag-row'] !== undefined)
  const texts = rows.map(textOf)
  assert.equal(rows.length, 2, `两条 tag 两行，实际 ${rows.length}`)
  assert.ok(texts[0].includes('v0.8.0') && texts[0].includes('abc1234'), texts[0])
  assert.ok(texts[0].includes('HEAD'), '指向当前 HEAD 的那个要标 HEAD')
  assert.ok(!texts[1].includes('HEAD'), '另一个不该标')
})

test('标签列表：点一行 = 用右栏看它指向的那次提交（tag 自己不是提交，所以要填提交信息）', () => {
  const opened = []
  const node = renderPanel({ tags: TAG_FIXTURES }, { methods: { toggleCommit: commit => opened.push(commit) } })
  findAll(node, item => item.props?.['data-tag-row'] !== undefined)[1].props.onClick()

  assert.equal(opened.length, 1, '应当把这次点击交给提交明细那条管道')
  assert.equal(opened[0].sha, 'def5678', '打开的是 tag 指向的**提交**')
  assert.equal(opened[0].subject, '修好装不上的问题')
  assert.deepEqual(opened[0].refs, ['v0.7.1'], '把这个 tag 记进 refs，明细里能看出是从 tag 来的')
})

test('标签列表：没有 tag 时画一行写明（"仓库没有 tag"与"功能没做"必须能区分）；被截断时明说', () => {
  const none = renderPanel({ tags: [] })
  assert.equal(findAll(none, item => item.props?.['data-tag-row'] !== undefined).length, 0, '一行 tag 也不该有')
  const emptyNote = findAll(none, item => item.props?.['data-tags-empty'] !== undefined)
  assert.equal(emptyNote.length, 1, '要写明"还没有标签"（一行 tag 都不画，但话说清楚）')
  assert.ok(textOf(emptyNote[0]).includes('panel.tagsEmpty'))
  // 标题也要留着：整段不画的话，功能看起来像没做。
  assert.ok(findAll(none, item => (item.props?.className || '').includes('dshh-sectionTitle')).length > 0)

  assert.equal(findAll(renderPanel({ tags: null }), item => item.props?.['data-tags-empty'] !== undefined).length, 0,
    '还没取到数据时先不画，避免闪一下"还没有标签"')

  const capped = textOf(renderPanel({ tags: TAG_FIXTURES, tagsTruncated: true }))
  assert.ok(capped.includes('panel.tagsCapped'), '截断了要说清楚')
})

test('标签列表（store）：面板打开时去取；10s 新鲜度窗口内不重复问 git', async () => {
  const calls = []
  const bundle = mountClient({
    rpc: (channel, endpoint) => {
      calls.push(endpoint)
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture({ oid: 'abc1234' }) })
      if (endpoint === 'tags') return Promise.resolve({ ok: true, value: { repo: '/Users/me/project', tags: TAG_FIXTURES, truncated: false } })
      if (endpoint === 'log') return Promise.resolve({ ok: true, value: { commits: [] } })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await flush()
  const before = calls.filter(name => name === 'tags').length
  assert.equal(before, 0, '面板没打开时不该问 tag（省一次 for-each-ref）')

  store.togglePanel()
  await flush()
  await flush()
  assert.equal(store.getSnapshot().tags.length, 2, '面板打开后要有 tag')
  const after = calls.filter(name => name === 'tags').length
  assert.ok(after >= 1, '面板打开时要取一次')

  store.refreshRows()
  await flush()
  await flush()
  assert.equal(calls.filter(name => name === 'tags').length, after, '10s 内不重复问 git')
  const line = bundle.consoleLines.find(item => item.includes('tags {'))
  assert.ok(line && line.includes('"count":2'), `要有现场日志，实际 ${line}`)
})

test('侧栏文字摘要：把"旁听到几个"和"现在还有几个"分开说（同一个词两套口径会让人以为算错）', () => {
  const rows = {
    phase: 'ready',
    unavailable: false,
    truncated: false,
    byId: { 'session-1': overviewRow('session-1', { possible: 3, possibleNow: 1 }) },
  }
  const menu = textOf(findByAttr(renderMenuSummary({ rows }), 'menu-readout'))
  assert.ok(menu.includes('rows.possible'), `要出现那句话，实际 ${menu}`)
  assert.ok(menu.includes('n=3'), `历史总数（3）要说，实际 ${menu}`)
  assert.ok(menu.includes('now=1'), `其中现在还有差异的（1）也要说，实际 ${menu}`)

  const hoverNode = renderSeat('dsh-hud-session-hover', {
    phase: 'ready', sessionId: 'session-1', cwd: '/Users/me/project', rows: rows,
  }, {}, { sessionId: 'session-1' })
  const hover = textOf(findByAttr(hoverNode, 'row-hover'))
  assert.ok(hover.includes('n=3') && hover.includes('now=1'), `悬停卡片同样两个数，实际 ${hover}`)
})

test('工具胶囊（store）：密节拍里内容没变就不 set（3s 一次的无谓重渲染要挡住）', async () => {
  const bundle = mountClient({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-tools') return Promise.resolve({ ok: true, value: {
        sessionId: 'session-1', tracking: true, active: null,
        recent: [{ name: 'bash', ok: true, ms: 800, summary: 'pnpm test', at: TOOLS_NOW }],
        counts: [{ name: 'bash', count: 3 }], total: 3,
      } })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await flush()
  const first = store.getSnapshot().tools
  assert.equal(first.total, 3)

  await store.refresh()
  await flush()
  assert.equal(store.getSnapshot().tools, first, '内容一样就不该换新对象（否则每 3s 全界面重渲染）')
})

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
test('工具胶囊：同一行"先空闲、后正在跑"都能画（冒烟；钩子顺序的防线见 mini-react）', () => {
  const idle = renderTools({}, { now: undefined })
  assert.ok(findByAttr(idle, 'pill'), '空闲那一行照样在')

  const running = renderTools({
    tools: toolsState({ active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW - 500 } }),
  }, { now: undefined })
  assert.ok(findByAttr(running, 'pill'), '正在跑时 Git 胶囊还在')
  assert.ok(findByAttr(running, 'tools-pill'), '并且多了工具那一枚')
})


/* ---------------------------------------------------- 胶囊里的工作区名 */

/** 覆盖胶囊看到的会话 cwd（它取自 `useSessions` 快照，不是 state）。 */
function sessionOf(cwd) {
  return { useSessions: selector => selector({ byId: { 'session-1': { cwd } } }) }
}

test('胶囊：最前面是工作区名（cwd 的目录名），与分支用 `·` 隔开', () => {
  const text = textOf(renderPill())
  assert.ok(text.startsWith('project · git:('), `工作区名要在最前、且带分隔，实际 ${JSON.stringify(text)}`)
  assert.equal(findByAttr(renderPill(), 'pill').props.title.includes('/Users/me/project'), true,
    '悬停里仍给完整路径（名字只是短标签）')
})

test('胶囊：工作区名过长从中间省略，不吃掉分支的位置', () => {
  const long = '/Users/me/' + 'x'.repeat(40) + '-tail'
  // 注意：胶囊的 cwd 来自 `useSessions` 快照，不是 state —— 要覆盖得走 sessionOf()。
  const text = flatText(renderPill({}, sessionOf(long)))
  assert.ok(text.includes('…'), `要省略，实际 ${JSON.stringify(text)}`)
  assert.ok(text.endsWith('git:(main*)↑1↓2M2A1?1'), '分支摘要必须完整（去空格后比）')
  const name = text.slice(0, text.indexOf('·'))   // flatText 后分隔符两侧的空格也去掉了
  assert.ok(name.length <= 20, `工作区名不该超过 20 字符，实际 ${name.length}`)
})

test('胶囊：不是仓库（或还在读取）时也显示工作区名 —— 那是工作区的事，与 git 无关', () => {
  const outside = textOf(renderPill({ status: { repo: null } }))
  assert.ok(outside.startsWith('project · git:('), `非仓库时也要有名字，实际 ${JSON.stringify(outside)}`)
  const loading = textOf(renderPill({ status: null }))
  assert.ok(loading.startsWith('project · git:('), `读取中也一样，实际 ${JSON.stringify(loading)}`)
})

test('胶囊：cwd 为空或就是根目录时，不画名字也不画那个分隔符', () => {
  const none = textOf(renderPill({}, sessionOf(null)))
  assert.ok(!none.includes(' · git:('), `没有 cwd 就别画空名字，实际 ${JSON.stringify(none)}`)
  const root = textOf(renderPill({}, sessionOf('/')))
  assert.ok(!root.includes(' · git:('), `根目录也算不出名字，实际 ${JSON.stringify(root)}`)
})

test('工具胶囊配色：对齐 codex-hud —— 只有状态符上色，名字/次数/分隔符用正文色', () => {
  // codex-hud 的 activity-lines.ts：`◐`(yellow) + 工具名(cyan) + 目标(默认色)；
  // 已完成是 `✓`(green) + 名字(默认色) + `×count`(默认色)。它**不淡化**次数与分隔符。
  const running = renderTools({
    tools: toolsState({
      active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW - 500 },
      counts: [{ name: 'bash', count: 1, ok: true }],
      total: 1,
    }),
  })
  const runningPill = findByAttr(running, 'tools-pill')
  assert.equal(findAll(runningPill, byClass('dshh-toolsGlyphRun')).length, 1, '运行中用 ◐ + 警告色')
  assert.equal(findAll(runningPill, byClass('dshh-toolsName')).length, 1, '运行中的工具名走那一支青色')
  assert.ok(textOf(runningPill).includes('◐'), `运行中不再是 🛠，实际 ${textOf(runningPill)}`)

  const idle = renderTools({
    tools: toolsState({
      counts: [{ name: 'bash', count: 16, ok: true }, { name: 'apply_patch', count: 2, ok: false }],
      total: 18,
    }),
  })
  const idlePill = findByAttr(idle, 'tools-pill')
  assert.equal(findAll(idlePill, byClass('dshh-toolsGlyphOk')).length, 1, '成功的 ✓ 用成功色')
  assert.equal(findAll(idlePill, byClass('dshh-toolsGlyphBad')).length, 1, '失败的 ✗ 用错误色')
  assert.equal(findAll(idlePill, byClass('dshh-toolsName')).length, 0, '空闲时名字不上色（codex 也是默认色）')
  assert.equal(findAll(idlePill, byClass('dshh-toolsDim')).length, 0, '次数不该被淡化 —— 这是原来的偏离')
})

test('git 胶囊配色：对齐 codex-hud 的 gitSegment（git:( 品红、分支与 ↑↓ 青、? 用 dim）', () => {
  // codex-hud 的默认配色表：git: 'magenta'、gitBranch: 'cyan'、project: 'yellow'；
  // 简写符另有各自一色（R→cyan、T→magenta、?→dim，M/A/D/! 本来就是 yellow/green/red/critical）。
  const node = renderPill()
  assert.equal(findAll(node, byClass('dshh-gitWrap')).length, 2, 'git:( 与 ) 各一个，用品红')
  assert.equal(findAll(node, byClass('dshh-branch')).length, 1, '分支名（含 *）用青')
  assert.equal(findAll(node, byClass('dshh-ahead')).length, 2, '↑1 ↓2 各一个，同分支那支青')

  // 样式表里那几支颜色要真的存在（写死值也走变量，可覆盖）。
  const css = stylesheetText()
  for (const rule of ['.dshh-gitWrap', '.dshh-branch', '.dshh-ahead', '.dshh-workspace', '.dshh-toolsName']) {
    assert.ok(css.includes(rule), `${rule} 规则要在样式表里`)
  }
  assert.ok(/\.dshh-gitWrap\{[^}]*--dsh-hud-magenta/.test(css), 'git:( 用品红变量')
  assert.ok(/\.dshh-branch\{[^}]*--dsh-hud-cyan/.test(css), '分支用青变量')
})


test('工作台：拖动提交栏右边那条抓握改它的宽度，松手才落盘', () => {
  const state = commitDiffState()
  const { tree, bundle, calls } = mountPanel(state)
  const inner = findAll(tree, item => item.props?.['data-dsh-hud'] === 'grip-commit')[0]
  assert.ok(inner, '三栏时提交栏右边有一条抓握')

  inner.props.onPointerDown({ button: 0, pointerId: 7, clientX: 800, preventDefault: () => {} })
  const move = bundle.listeners.get('pointermove')?.[0]?.listener
  const up = bundle.listeners.get('pointerup')?.[0]?.listener
  move({ pointerId: 7, clientX: 740 })
  assert.deepEqual(calls.commitWidth, [300], '往左拖 60px → 提交栏 240 + 60')
  assert.deepEqual(calls.diffWidth, [], '不该动差异栏')

  up({ pointerId: 7 })
  assert.equal(calls.persist, 1, '松手落盘')
})

test('工作台：提交栏宽度按存档恢复，并有最小值下限', () => {
  const narrow = renderPanel({ ...commitDiffState(), commitWidth: 40 })
  // 40 小于下限 180 → 面板宽度按 180 算（否则路径全被截成一个字）。
  assert.equal(narrow.props.style.width, 380 + 180 + 6 + 470 + 6)

  // 用 300 而不是更大的值：面板总宽会被视口钳住（harness 的 innerWidth 约 1216），
  // 420 那一档会被钳到 1184，反而看不出"存档里的宽度有没有生效"。
  const wide = renderPanel({ ...commitDiffState(), commitWidth: 300 })
  assert.equal(wide.props.style.width, 380 + 300 + 6 + 470 + 6, '存档里的宽度要生效')
  assert.equal(findAll(wide, byClass('dshh-commitpane'))[0].props.style.width, 300, '栏自己按存档宽度渲染')
})

test('面（store）把拖动要用的方法都暴露出来了 —— 少一个，拖起来就是"没反应"', () => {
  // 这条是给一个真实事故留的：`setCommitWidth` 在 store 里定义了、也接进了 pointermove，
  // 但忘了挂到 store 返回的面上 → 拖动时 `store.setCommitWidth` 是 undefined → 直接抛错，
  // 表现就是"无法拖动"。而当时的拖动用例用的是 harness 自己拼的假 store（里面有这个方法），
  // 所以永远发现不了。这里直接检查**真 store 的面**。
  const bundle = mountClient()
  const store = bundle.registrations.find(item => item.options.id === 'dsh-hud-panel').options.inject().store
  for (const name of ['setDiffWidth', 'setCommitWidth', 'openDiff', 'closeDetail', 'refreshRows', 'commitPanel']) {
    assert.equal(typeof store[name], 'function', `store 面上缺 ${name}()`)
  }
})

/* ---------------------------------------------------------- 技能（skill 工具） */

test('工具胶囊：技能直接铺技能名，不再显示 `skill ×n`（那样看不出是哪个技能）', () => {
  const node = renderTools({
    tools: toolsState({
      counts: [{ name: 'bash', count: 12, ok: true }, { name: 'skill', count: 3, ok: true }],
      skills: [{ name: 'office-xlsx', count: 2, ok: true }, { name: 'pdf', count: 1, ok: false }],
      total: 15,
    }),
  })
  const text = textOf(findByAttr(node, 'tools-pill'))
  assert.ok(text.includes('bash ×12'), `工具那半照旧，实际 ${text}`)
  assert.ok(!text.includes('skill ×3'), '`skill` 工具本身不该出现在计数里（没信息量）')
  // 这里只能断言到 key —— harness 的 t() 回显 key（文案字面量另有一条词典用例钉住）。
  assert.ok(text.includes('tools.skills office-xlsx ×2'), `技能段要标签 + 技能名，实际 ${text}`)
  assert.ok(text.includes('office-xlsx ×2') && text.includes('pdf ×1'), `技能名要铺出来，实际 ${text}`)
  const pill = findByAttr(node, 'tools-pill')
  assert.equal(findAll(pill, byClass('dshh-skillName')).length, 1, '技能名有自己的颜色（与工具名区分）')
  // 最近一次失败的技能直接标红 —— 这条断言顺带钉住"谁失败谁红"，而不是整段变红。
  assert.equal(findAll(pill, byClass('dshh-toolsGlyphBad')).length, 1, '失败的技能标红')
})

test('工具胶囊：技能多于两个收成 +k；悬停里给完整清单与成败', () => {
  const node = renderTools({
    tools: toolsState({
      counts: [{ name: 'bash', count: 5, ok: true }],
      skills: [
        { name: 'a-skill', count: 3, ok: true },
        { name: 'b-skill', count: 2, ok: true },
        { name: 'c-skill', count: 1, ok: false },
      ],
      skillsDropped: 4,
      total: 11,
    }),
  })
  const pill = findByAttr(node, 'tools-pill')
  const text = textOf(pill)
  assert.ok(text.includes('a-skill ×3') && text.includes('b-skill ×2'), text)
  assert.ok(!text.includes('c-skill'), '第三个起收起来')
  assert.ok(text.includes('+1'), '收起来的用 +k 表示')

  const title = String(pill.props.title)
  assert.ok(title.includes('c-skill ×1 (✗)'), `悬停给完整清单并标出失败，实际 ${title}`)
})

test('工具胶囊：正在跑的时候带上参数摘要（codex-hud 的 `◐ exec_command: pnpm test`）', () => {
  const node = renderTools({
    tools: toolsState({
      active: { name: 'skill', summary: 'office-xlsx', startedAt: TOOLS_NOW - 500 },
      counts: [{ name: 'skill', count: 1, ok: null }],
      total: 1,
    }),
  })
  // flatText：harness 会在相邻子元素间插空格（DOM 里没有），拼出来的形状才算数。
  const text = flatText(findByAttr(node, 'tools-pill'))
  assert.ok(text.includes('skill:office-xlsx'), `要能看出正在加载哪个技能，实际 ${text}`)
})


test('词典：技能标签是字面的 `skills:`（不翻译，与 `git:(` 同一套）', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const values = [...source.matchAll(/"tools\.skills":\s*"([^"]*)"/g)].map(item => item[1])
  // 尾空格由渲染处补（`t("tools.skills") + " "`），文案本身保持干净 —— 悬停那处本来就自己加空格。
  assert.deepEqual(values, ['skills:', 'skills:'], `中英两份都该是 "skills:"，实际 ${JSON.stringify(values)}`)
})
