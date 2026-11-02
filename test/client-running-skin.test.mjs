/**
 * 浏览器半用例：思考中动画换皮（`running-skin.ts` + 设置行 `SkinRow`）。
 *
 * 三件事分开盯：
 *   1. 默认状态 —— 没选过的时候按 `RUNNING_SKIN` 注入，且存储读不到不算错；
 *   2. 设置行 —— 三个方块、点一下写存储**并且当场换表**（不靠轮询、不用重启）；
 *   3. 选「官方」—— 整张表撤掉，不是注入一段空 CSS。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findAll, mountClient } from './client-harness.mjs'
import { createMiniReact } from './mini-react.mjs'

/** 取当前注入的换皮表（没注入就是 undefined）。 */
function skinTag(mounted) {
  return mounted.styles.find((element) => element.attributes['data-dsh-hud'] === 'running-skin')
}

/** 渲染设置行；`t` 直接回显 key，方便按 key 找方块。 */
function renderRow(mounted) {
  return mounted.components['dsh-hud-running-skin']({ t: (key) => key })
}

/** 三个方块（按渲染顺序）。 */
function cubes(mounted) {
  return findAll(
    renderRow(mounted),
    (node) => node.props !== undefined && node.props.className === 'dshh-skinCube',
  )
}

test('没选过的时候按默认皮肤注入，存储读不到也不至于整块不注入', () => {
  const mounted = mountClient()

  const tag = skinTag(mounted)
  assert.ok(tag, '默认应当注入一张换皮表')
  assert.equal(tag.attributes['data-plugin'], '@konnga/dsh-hud', '和自有样式表一样打所有权标记')
  assert.equal(
    tag.attributes['data-plugin-css'],
    'dsh-hud/running-skin.css',
    '独立 tag id，互不干扰',
  )
  assert.ok(
    tag.textContent.includes(
      '[data-chat-running][data-dsh-hud-running-text] [data-shimmer]{display:none}',
    ),
    '默认鲸鱼娘只隐藏已挂载成功的运行行，其他行保持官方文案',
  )
  assert.equal(
    mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'),
    null,
    '只读不写：打开设置之前不该往存储里塞东西',
  )
})

test('设置行三个方块：官方 / 纸飞机 / 鲸鱼娘，纸飞机合并轮播文案', () => {
  const mounted = mountClient()
  const buttons = cubes(mounted)
  assert.equal(buttons.length, 3)
  assert.deepEqual(
    buttons.map((button) => button.children[1].children[0]),
    ['skin.off', 'skin.plane', 'skin.whale'],
  )
  assert.equal(buttons[2].props['data-active'], '', '默认鲸鱼娘保持不变')
  buttons[1].props.onClick()
  assert.equal(mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'), 'plane')
  const css = skinTag(mounted).textContent
  assert.ok(css.includes('animation:dshh-plane'))
  assert.ok(
    css.includes('[data-chat-running][data-dsh-hud-running-text] [data-shimmer]{display:none}'),
  )
  assert.ok(!css.includes('dshh-breathe'))
  assert.ok(!css.includes('dshh-blink'))
  assert.equal(activeTickers(mounted).length, 1)
  mounted.dispose()
})

test('选纸飞机后启动文案轮播；重复选择不累积定时器', () => {
  const mounted = mountClient()
  cubes(mounted)[1].props.onClick()
  cubes(mounted)[1].props.onClick()
  assert.equal(mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'), 'plane')
  const tickers = activeTickers(mounted)
  assert.equal(tickers.length, 1)
  assert.doesNotThrow(() => tickers[0].callback())
  assert.ok(skinTag(mounted).textContent.includes('dshh-plane'))
  mounted.dispose()
})

test('工具名归组：认得出改文件 / 敲命令 / 查资料 / 翻代码，认不出的落 other', () => {
  const { exported } = mountClient()

  assert.equal(exported.groupOfTool(null), 'idle', '没有工具在跑才是「深度求索中」')
  assert.equal(exported.groupOfTool(''), 'idle')
  assert.equal(exported.groupOfTool('apply_patch'), 'edit')
  assert.equal(exported.groupOfTool('write'), 'edit')
  assert.equal(exported.groupOfTool('bash'), 'shell')
  assert.equal(exported.groupOfTool('Bash'), 'shell', '工具名大小写不固定')
  assert.equal(exported.groupOfTool('web_search'), 'search')
  assert.equal(exported.groupOfTool('read_file'), 'read')
  assert.equal(
    exported.groupOfTool('some_new_tool'),
    'other',
    '没见过的工具不能假装自己是 idle —— 那会显示「深度求索中」，而模型其实在调工具',
  )
})

test('从官方文案里抠「用时」：中英两种写法都要抠得出来', () => {
  const { exported } = mountClient()

  assert.equal(exported.extractElapsed('深度求索中，用时 1 分 1 秒 ···'), '1 分 1 秒')
  assert.equal(exported.extractElapsed('Deep diving for 1m 1s ···'), '1m 1s')
  assert.equal(exported.extractElapsed('深度求索中'), '', '刚起手还没有时长，不该编一个出来')
  assert.equal(exported.extractElapsed(''), '')
})

test('选「官方」是把整张表撤掉，而不是注入一段空 CSS', () => {
  const mounted = mountClient()
  assert.ok(skinTag(mounted), '先确认默认注入了')

  cubes(mounted)[0].props.onClick()

  assert.equal(mounted.windowStub.localStorage.getItem('dsh-hud:running-skin'), 'off')
  assert.equal(skinTag(mounted), undefined, 'off 就该没有这个 <style> 节点')
})

/** 最小 DOM 树：测试真实的挂载、标记、移除路径，而不只看定时器有没有注册。 */
function runningDom(mounted, options = {}) {
  const images = []
  function element(tagName) {
    const item = {
      tagName,
      hidden: false,
      complete: tagName === 'img' && !options.manualLoad,
      naturalWidth: tagName === 'img' && !options.manualLoad ? 112 : 0,
      attributes: {},
      className: '',
      textContent: '',
      children: [],
      parentNode: null,
      offsetWidth: 10,
      classList: { add() {}, remove() {} },
      setAttribute(key, value) {
        this.attributes[key] = value
      },
      getAttribute(key) {
        return this.attributes[key] ?? null
      },
      removeAttribute(key) {
        delete this.attributes[key]
      },
      appendChild(child) {
        this.children.push(child)
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
    }
    if (tagName === 'img') {
      if (options.decode) item.decode = () => options.decode(item)
      images.push(item)
    }
    return item
  }
  const roots = []
  mounted.documentStub.createElement = element
  mounted.documentStub.querySelectorAll = (selector) =>
    selector === '[data-chat-running]' ? roots : []
  function root(text = '深度求索中，用时 1 分 1 秒 ···') {
    const item = element()
    item.content = element()
    item.source = element()
    item.source.setAttribute('data-shimmer-text', text)
    item.querySelector = (selector) => {
      if (selector === '[class*="_runningContent"]') return item.content
      if (selector === '[data-shimmer-text]') return item.source
      return null
    }
    roots.push(item)
    return item
  }
  const tick = () => {
    const timer = mounted.intervals.findLast((item) => item.ms === 300 && !item.cancelled)
    assert.ok(timer, '轮播应有一个有效节拍')
    timer.callback()
  }
  const textNode = (item, className) => {
    const children = item.content.children[0]?.children ?? []
    const copy = children.find((child) => child.className === 'dshh-runCopy')
    return (copy ? copy.children : children).find((child) => child.className === className)
  }
  const phrase = (item) => textNode(item, 'dshh-runPhrase')?.textContent
  const time = (item) => textNode(item, 'dshh-runTime')?.textContent
  const marked = (item) => item.getAttribute('data-dsh-hud-running-text') !== null
  const image = (item) =>
    item.content.children[0]?.children.find((child) => child.tagName === 'img')
  const candidate = () =>
    images.findLast((item) => item.onload !== null && typeof item.onload === 'function')
  const load = () => candidate()?.onload()
  return { roots, root, tick, phrase, time, marked, image, candidate, load, images }
}

const storageKey = 'dsh-hud:running-skin'
function activeTickers(mounted) {
  return mounted.intervals.filter((item) => item.ms === 300 && !item.cancelled)
}
function picked(tree) {
  return findAll(
    tree,
    (item) => item.props?.className === 'dshh-skinCube' && item.props['aria-pressed'],
  ).map((item) => item.children[1].children[0])
}

test('单行挂载成功才接管文案，计时更新，轮次结束恢复官方并移除节点', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const root = dom.root()
  assert.equal(dom.marked(root), false, '挂载前不能隐藏官方文字')
  dom.tick()
  assert.equal(root.content.children.length, 1)
  assert.equal(dom.marked(root), true)
  assert.equal(dom.phrase(root), '深度求索中')
  assert.equal(dom.time(root), '1 分 1 秒')
  root.source.setAttribute('data-shimmer-text', '深度求索中，用时 1 分 2 秒 ···')
  dom.tick()
  assert.equal(dom.time(root), '1 分 2 秒')
  assert.equal(root.content.children.length, 1, '重复 tick 幂等')
  dom.roots.length = 0
  dom.tick()
  assert.equal(dom.marked(root), false)
  assert.equal(root.content.children.length, 0)
  mounted.dispose()
})

test('同时运行主会话与子会话时保留各自官方文案，回到单行后重新挂载', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const main = dom.root()
  dom.tick()
  assert.equal(dom.marked(main), true)
  const child = dom.root('深度求索中，用时 5 秒 ···')
  dom.tick()
  for (const root of [main, child]) {
    assert.equal(dom.marked(root), false, '多行不能隐藏任何会话的官方文字')
    assert.equal(root.content.children.length, 0)
  }
  dom.roots.pop()
  dom.tick()
  assert.equal(dom.marked(main), true)
  assert.equal(dom.time(main), '1 分 1 秒')
  mounted.dispose()
  assert.equal(dom.marked(main), false)
  assert.equal(main.content.children.length, 0)
})

test('替换运行行或挂载失败时清理旧节点，失败行保留官方文字', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const old = dom.root()
  dom.tick()
  dom.roots.length = 0
  const next = dom.root('深度求索中，用时 2 秒 ···')
  dom.tick()
  assert.equal(dom.marked(old), false)
  assert.equal(old.content.children.length, 0)
  assert.equal(dom.time(next), '2 秒')
  next.content = null
  dom.tick()
  assert.equal(dom.marked(next), false)
  const failed = dom.root()
  dom.roots.shift()
  failed.content.appendChild = () => {
    throw new Error('DOM changed')
  }
  assert.doesNotThrow(dom.tick)
  assert.equal(dom.marked(failed), false)
  mounted.dispose()
})

test('focus / 轮询同时同步样式、轮播启停和已打开设置行的选中态', () => {
  const mini = createMiniReact()
  const mounted = mountClient({ ReactImpl: mini.React })
  const dom = runningDom(mounted)
  const root = dom.root()
  dom.tick()
  mini.mount(mounted.components['dsh-hud-running-skin'], { t: (key) => key })
  assert.deepEqual(picked(mini.current()), ['skin.whale'])
  mounted.windowStub.localStorage.setItem(storageKey, 'off')
  mounted.dispatch('focus')
  assert.equal(skinTag(mounted), undefined)
  assert.equal(activeTickers(mounted).length, 0)
  assert.equal(dom.marked(root), false)
  assert.deepEqual(picked(mini.current()), ['skin.off'])
  mounted.windowStub.localStorage.setItem(storageKey, 'rotate')
  mounted.intervals.find((item) => item.ms === 8000).callback()
  assert.ok(skinTag(mounted))
  assert.equal(activeTickers(mounted).length, 1)
  assert.equal(dom.marked(root), true)
  assert.deepEqual(picked(mini.current()), ['skin.plane'])
  mini.unmount()
  mounted.dispose()
})

test('storage 事件立即同步，忽略无关键，删除 / clear 回到默认', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const root = dom.root()
  dom.tick()
  mounted.windowStub.localStorage.setItem(storageKey, 'off')
  mounted.dispatch('storage', { key: storageKey, newValue: 'off' })
  assert.equal(skinTag(mounted), undefined)
  assert.equal(activeTickers(mounted).length, 0)
  assert.equal(dom.marked(root), false)
  mounted.dispatch('storage', { key: 'something-else', newValue: 'rotate' })
  assert.equal(activeTickers(mounted).length, 0)
  mounted.windowStub.localStorage.values.delete(storageKey)
  mounted.dispatch('storage', { key: storageKey, newValue: null })
  assert.equal(activeTickers(mounted).length, 1)
  assert.equal(dom.marked(root), true)
  mounted.windowStub.localStorage.setItem(storageKey, 'off')
  mounted.dispatch('storage', { key: storageKey, newValue: 'off' })
  mounted.windowStub.localStorage.values.clear()
  mounted.dispatch('storage', { key: null, newValue: null })
  assert.equal(activeTickers(mounted).length, 1)
  mounted.dispose()
  assert.equal(mounted.listeners.get('storage').length, 0)
})

test('存储写入失败保留内存选择，focus 和轮询不能撤销它', () => {
  const mini = createMiniReact()
  const mounted = mountClient({ ReactImpl: mini.React, storageWriteFails: true })
  const dom = runningDom(mounted)
  const root = dom.root()
  dom.tick()
  mini.mount(mounted.components['dsh-hud-running-skin'], { t: (key) => key })
  const buttons = findAll(mini.current(), (item) => item.props?.className === 'dshh-skinCube')
  buttons[1].props.onClick()
  assert.deepEqual(picked(mini.current()), ['skin.plane'])
  assert.equal(activeTickers(mounted).length, 1)
  mounted.dispatch('focus')
  mounted.intervals.find((item) => item.ms === 8000).callback()
  assert.ok(skinTag(mounted).textContent.includes('dshh-plane'))
  assert.equal(activeTickers(mounted).length, 1)
  assert.equal(dom.marked(root), true)
  assert.deepEqual(picked(mini.current()), ['skin.plane'])
  // 明确的新跨窗口选择仍然可以覆盖这个非持久化值。
  mounted.dispatch('storage', { key: storageKey, newValue: 'rotate' })
  assert.equal(activeTickers(mounted).length, 1)
  assert.deepEqual(picked(mini.current()), ['skin.plane'])
  mini.unmount()
  mounted.dispose()
})

test('存储完全不可用仍能切换，已有存储值在启动时生效', () => {
  const mounted = mountClient({ storageReadFails: true, storageWriteFails: true })
  cubes(mounted)[0].props.onClick()
  mounted.dispatch('focus')
  assert.equal(skinTag(mounted), undefined)
  assert.equal(activeTickers(mounted).length, 0)
  mounted.dispose()
  const persisted = mountClient({ storageValues: { [storageKey]: 'off' } })
  assert.equal(skinTag(persisted), undefined)
  assert.equal(activeTickers(persisted).length, 0)
  persisted.dispose()
})

test('轮播跟随 DSH locale 而不是浏览器语言，应用内切换立即刷新并取消订阅', () => {
  let active = 'zh'
  const listeners = new Set()
  const locale = {
    getSnapshot: () => ({ active }),
    resolveText: (text) => (active === 'zh' ? text.zh : text.en),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const mounted = mountClient({ locale, browserLanguage: 'en-US' })
  const dom = runningDom(mounted)
  const root = dom.root()
  dom.tick()
  assert.equal(dom.phrase(root), '深度求索中')
  active = 'en'
  root.source.setAttribute('data-shimmer-text', 'Deep diving for 1m 2s ···')
  for (const listener of listeners) listener()
  assert.equal(dom.phrase(root), 'Deep diving')
  assert.equal(dom.time(root), '1m 2s')
  mounted.dispose()
  assert.equal(listeners.size, 0)
  assert.equal(root.content.children.length, 0)
})

test('HMR 删除样式后恢复，切过 off 重新建表后卸载也能完整清理', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const root = dom.root()
  dom.tick()
  mounted.head.removeChild(skinTag(mounted))
  mounted.dispatch('focus')
  assert.ok(skinTag(mounted))
  assert.equal(activeTickers(mounted).length, 1)
  cubes(mounted)[0].props.onClick()
  cubes(mounted)[1].props.onClick()
  assert.equal(dom.marked(root), true)
  mounted.dispose()
  assert.equal(skinTag(mounted), undefined)
  assert.equal(dom.marked(root), false)
  assert.equal(root.content.children.length, 0)
  assert.equal(activeTickers(mounted).length, 0)
})

test('官方计时来源缺失时撤销接管，不能把用时和官方文字一起吞掉', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const root = dom.root()
  dom.tick()
  root.source = null
  dom.tick()
  assert.equal(dom.marked(root), false)
  assert.equal(root.content.children.length, 0)
  mounted.dispose()
})

test('工具分组跟随 store 的当前工具，同组轮播与换组复位都生效', async () => {
  let name = 'bash'
  let count = 0
  const mounted = mountClient({
    rpc: async (_channel, method) =>
      method === 'session-tools'
        ? {
            ok: true,
            value: {
              active: name ? { name, callId: String(++count), startedAt: 1 } : null,
              total: count,
            },
          }
        : { ok: false },
  })
  const registration = mounted.registrations.find((item) => item.options.id === 'dsh-hud-pill')
  const store = registration.options.inject('running-session').store
  store.bindSession('running-session', '/tmp')
  const dom = runningDom(mounted)
  const root = dom.root()
  const now = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    await store.loadTools()
    dom.tick()
    assert.equal(dom.phrase(root), '在敲命令')
    name = 'apply_patch'
    await store.loadTools()
    dom.tick()
    assert.equal(dom.phrase(root), '正在改文件')
    clock += 3200
    dom.tick()
    assert.equal(dom.phrase(root), '调整这几行')
    name = null
    await store.loadTools()
    dom.tick()
    assert.equal(dom.phrase(root), '深度求索中', '换组立即复位，不沿用上一组的 index')
  } finally {
    Date.now = now
    mounted.dispose()
  }
})

test('鲸鱼娘是可选皮肤：真彩色 img，加载后才替换官方图标', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted, { manualLoad: true })
  const root = dom.root()
  cubes(mounted)[2].props.onClick()
  assert.equal(mounted.windowStub.localStorage.getItem(storageKey), 'whale')
  assert.equal(activeTickers(mounted).length, 1)
  const css = skinTag(mounted).textContent
  assert.ok(css.includes('[data-dsh-hud-running-whale]'))
  assert.ok(!css.includes('mask:'), '彩色人物不能被单色 mask 覆盖')
  assert.ok(css.includes('prefers-reduced-motion'))
  assert.equal(dom.marked(root), true)
  const image = dom.image(root)
  assert.match(dom.candidate().src, /^data:image\/webp;base64,/)
  assert.equal(image.src, undefined, '候选图片未就绪前不替换可见图标')
  assert.equal(image.getAttribute('aria-hidden'), 'true')
  assert.equal(image.alt, '')
  assert.equal(image.hidden, true)
  assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
  dom.load()
  assert.equal(image.hidden, false)
  assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
  assert.equal(dom.phrase(root), '深度求索中')
  assert.equal(dom.time(root), '1 分 1 秒')
  mounted.dispose()
})

test('所有文案、语言与动作来自同一配置，没完成暗示，每个动作有素材', () => {
  const mounted = mountClient()
  const cues = mounted.exported.RUNNING_CUES
  const actions = new Set()
  assert.deepEqual(Object.keys(cues), ['idle', 'edit', 'shell', 'read', 'search', 'other'])
  for (const rows of Object.values(cues)) {
    assert.ok(rows.length > 0)
    for (const cue of rows) {
      assert.ok(cue.zh && cue.en && cue.action)
      assert.doesNotMatch(cue.zh + cue.en, /快要有结论|改完跑一遍|Almost there|Re-running after/i)
      actions.add(cue.action)
    }
  }
  assert.equal(actions.size, 30)
  mounted.dispose()
})

test('文案轮播与动作同拍：换工具立即复位；切语言不改变动作；图片失败保留官方图标', async () => {
  let name = null
  let language = 'zh'
  const localeListeners = new Set()
  const mounted = mountClient({
    locale: {
      resolveText: (text) => text[language],
      subscribe: (listener) => {
        localeListeners.add(listener)
        return () => localeListeners.delete(listener)
      },
    },
    rpc: async (_channel, method) =>
      method === 'session-tools'
        ? {
            ok: true,
            value: { active: name ? { name, callId: name, startedAt: 1 } : null, total: 1 },
          }
        : { ok: false },
  })
  const registration = mounted.registrations.find((item) => item.options.id === 'dsh-hud-pill')
  const store = registration.options.inject('running-session').store
  store.bindSession('running-session', '/tmp')
  const dom = runningDom(mounted)
  const root = dom.root()
  const originalNow = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    cubes(mounted)[2].props.onClick()
    assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
    clock += 3200
    dom.tick()
    assert.equal(dom.phrase(root), '正在翻上下文')
    assert.equal(dom.image(root).getAttribute('data-action'), 'context')
    language = 'en'
    for (const listener of localeListeners) listener()
    assert.equal(dom.phrase(root), 'Reading the context')
    assert.equal(dom.image(root).getAttribute('data-action'), 'context')
    for (const [tool, phrase, action] of [
      ['functions.apply_patch', 'Editing files', 'writing'],
      ['functions.exec_command', 'Running a command', 'typing'],
      ['read_file', 'Reading the code', 'reading'],
      ['web.search_query', 'Searching references', 'searching'],
      ['custom_tool', 'Working on it', 'working'],
    ]) {
      name = tool
      await store.loadTools()
      // No timer tick: store publication should refresh the pose immediately.
      assert.equal(dom.phrase(root), phrase)
      assert.equal(dom.image(root).getAttribute('data-action'), action)
      dom.load()
      assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
    }
    dom.image(root).onerror()
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
    assert.equal(dom.image(root).hidden, true)
    assert.equal(dom.phrase(root), 'Working on it')
  } finally {
    Date.now = originalNow
    mounted.dispose()
  }
})

test('完整轮播能访问所有动作素材，减弱动态冻结当前组但工具变化仍响应', async () => {
  let name = null
  let reduced = false
  let motionListener = null
  const mounted = mountClient({
    rpc: async (_channel, method) =>
      method === 'session-tools'
        ? {
            ok: true,
            value: { active: name ? { name, callId: name, startedAt: 1 } : null, total: 1 },
          }
        : { ok: false },
  })
  mounted.windowStub.matchMedia = () => ({
    get matches() {
      return reduced
    },
    addEventListener(_event, listener) {
      motionListener = listener
    },
    removeEventListener(_event, listener) {
      if (motionListener === listener) motionListener = null
    },
  })
  const registration = mounted.registrations.find((item) => item.options.id === 'dsh-hud-pill')
  const store = registration.options.inject('running-session').store
  store.bindSession('running-session', '/tmp')
  const dom = runningDom(mounted)
  const root = dom.root()
  const originalNow = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    cubes(mounted)[2].props.onClick()
    const tools = {
      idle: null,
      edit: 'apply_patch',
      shell: 'bash',
      read: 'read_file',
      search: 'web_search',
      other: 'custom',
    }
    for (const [group, tool] of Object.entries(tools)) {
      name = tool
      await store.loadTools()
      for (const cue of mounted.exported.RUNNING_CUES[group]) {
        assert.equal(dom.phrase(root), cue.zh)
        assert.equal(dom.image(root).getAttribute('data-action'), cue.action)
        assert.match(dom.image(root).src, /^data:image\/webp;base64,/)
        clock += 3200
        dom.tick()
      }
    }
    reduced = true
    motionListener()
    const before = dom.phrase(root)
    clock += 20_000
    dom.tick()
    assert.equal(dom.phrase(root), before)
    name = 'bash'
    await store.loadTools()
    assert.equal(dom.phrase(root), '在敲命令')
    assert.equal(dom.image(root).getAttribute('data-action'), 'typing')
    reduced = false
    motionListener()
    clock += 3200
    dom.tick()
    assert.equal(dom.phrase(root), '等它跑完')
    assert.equal(dom.image(root).getAttribute('data-action'), 'watching')
  } finally {
    Date.now = originalNow
    mounted.dispose()
    assert.equal(motionListener, null, '卸载时释放媒体监听')
  }
})

test('鲸鱼娘：多会话、换皮与新轮次都清理图片，过期加载回调不能接管旧行', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted, { manualLoad: true })
  const root = dom.root()
  cubes(mounted)[2].props.onClick()
  const image = dom.image(root)
  const candidate = dom.candidate()
  const lateLoad = candidate.onload
  dom.root()
  dom.tick()
  lateLoad()
  assert.equal(dom.marked(root), false)
  assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
  assert.equal(candidate.onload, null)
  assert.equal(root.content.children.length, 0)
  dom.roots.pop()
  dom.tick()
  dom.load()
  assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
  cubes(mounted)[1].props.onClick()
  assert.equal(dom.image(root), undefined)
  assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
  assert.equal(dom.phrase(root), '深度求索中')
  cubes(mounted)[0].props.onClick()
  assert.equal(dom.marked(root), false)
  assert.equal(root.content.children.length, 0)
  mounted.dispose()
})

test('确认的 v4 默认启用：首次启动挂载全身动作，不写入偏好，已有选择保留', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const root = dom.root()
  dom.tick()
  assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
  assert.match(dom.image(root).src, /^data:image\/webp;base64,/)
  assert.equal(cubes(mounted)[2].props['aria-pressed'], true)
  assert.equal(mounted.windowStub.localStorage.getItem(storageKey), null)
  mounted.dispose()

  for (const skin of ['off', 'plane', 'whale']) {
    const existing = mountClient({ storageValues: { [storageKey]: skin } })
    const selected = cubes(existing).filter((button) => button.props['aria-pressed'])
    assert.equal(selected.length, 1)
    assert.equal(selected[0].children[1].children[0], 'skin.' + skin)
    assert.equal(existing.windowStub.localStorage.getItem(storageKey), skin)
    existing.dispose()
  }
})

test('扩充文案：100 条双语短句、六组均有足量选择、组内无重复且不承诺进度', () => {
  const mounted = mountClient()
  const cues = mounted.exported.RUNNING_CUES
  const counts = { idle: 32, edit: 16, shell: 14, read: 16, search: 12, other: 10 }
  const all = Object.values(cues).flat()
  assert.equal(all.length, 100)
  assert.equal(new Set(all.map((cue) => cue.zh)).size, 100)
  assert.equal(new Set(all.map((cue) => cue.en)).size, 100)
  for (const [group, count] of Object.entries(counts)) {
    assert.equal(cues[group].length, count, group)
    for (const cue of cues[group]) {
      assert.equal(cue.zh.trim(), cue.zh)
      assert.equal(cue.en.trim(), cue.en)
      assert.ok(cue.zh.length <= 18, `${group}: ${cue.zh} 超出短句长度`)
      assert.ok(cue.en.length <= 64, `${group}: ${cue.en} 过长`)
      assert.doesNotMatch(
        cue.zh,
        /马上|快好了|快要|最后|完成了|已完成|百分之|\d+%|CPU|死机|没卡|WorkBuddy|点击|设置|重启/,
      )
      assert.doesNotMatch(
        cue.en,
        /almost there|nearly done|finished|completed|final check|last step|\d+%|CPU|not stuck/i,
      )
    }
  }
  mounted.dispose()
})

test('新增动作按语义联动：问号、蝴蝶和小工具都能通过真实文案访问', () => {
  const mounted = mountClient()
  const cues = mounted.exported.RUNNING_CUES
  const byPhrase = new Map(
    Object.values(cues)
      .flat()
      .map((cue) => [cue.zh, cue]),
  )
  for (const [phrase, action] of [
    ['换个角度想想', 'question'],
    ['追着小念头转一圈', 'butterfly'],
    ['想法有点挤，理一理', 'gears'],
    ['把问题拆小一点', 'puzzle'],
    ['给思路松个结', 'thread'],
    ['在脑海里画张草图', 'sketching'],
    ['沿着函数往里看', 'flashlight'],
    ['给关键分支放大一点', 'binoculars'],
    ['在代码里认认路', 'map'],
    ['把修改范围圈清楚', 'measuring'],
    ['给代码修修边角', 'toolbox'],
    ['让想法排个队', 'notes'],
  ]) {
    assert.equal(byPhrase.get(phrase)?.action, action, phrase)
  }
  assert.equal(Object.values(cues).flat().length, 100, '扩充动作不减少双语文案数量')
  // A shell command remains a command (rice_terminal watches it), never a butterfly chase.
  assert.ok(cues.shell.every((cue) => ['typing', 'watching', 'rice_terminal'].includes(cue.action)))
  mounted.dispose()
})

test('白米饭系列六个动作均有双语文案，端饭看终端不冒充思考或任务完成', () => {
  const mounted = mountClient()
  const cues = mounted.exported.RUNNING_CUES
  const byPhrase = new Map(
    Object.values(cues)
      .flat()
      .map((cue) => [cue.zh, cue]),
  )
  for (const [phrase, action] of [
    ['一边嚼饭，一边琢磨', 'rice_eating'],
    ['嚼一嚼这条思路', 'rice_cheeks'],
    ['饭在碗里，眼在终端', 'rice_terminal'],
    ['这口饭配点思考', 'rice_ponder'],
    ['精神食粮也不能少', 'rice_reading'],
    ['米饭配上小纸条', 'rice_notes'],
  ]) {
    assert.equal(byPhrase.get(phrase)?.action, action, phrase)
    assert.ok(byPhrase.get(phrase)?.en, '新短句必须有英文')
  }
  assert.ok(cues.shell.some((cue) => cue.action === 'rice_terminal'))
  assert.ok(cues.read.some((cue) => cue.action === 'rice_reading'))
  assert.equal(Object.values(cues).flat().length, 100)
  mounted.dispose()
})

test('鲸鱼娘两行布局：上方用时、下方文案，图片在左，切到纸飞机轮播仍为一行', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const root = dom.root('深度求索中，用时 39 分 5 秒 ···')
  dom.tick()
  const text = root.content.children[0]
  const copy = text.children.find((child) => child.className === 'dshh-runCopy')
  assert.ok(copy, '鲸鱼娘使用独立文字列')
  assert.deepEqual(
    copy.children.map((child) => child.className),
    ['dshh-runTime', 'dshh-runPhrase'],
    'DOM 阅读顺序与上下位置一致',
  )
  assert.equal(dom.time(root), '39 分 5 秒')
  assert.equal(dom.phrase(root), '深度求索中')
  const css = skinTag(mounted).textContent
  assert.ok(css.includes('.dshh-runCopy{display:inline-flex;flex-direction:column;'))
  assert.ok(css.includes('.dshh-runWhale{order:-1;'), '图片仍在文字列左侧')
  assert.ok(css.includes('.dshh-runTime{font-size:.78em;line-height:1.2}'))
  root.source.setAttribute('data-shimmer-text', '深度求索中，用时 39 分 6 秒 ···')
  dom.tick()
  assert.equal(copy.children[0].textContent, '39 分 6 秒')
  assert.equal(
    text.children.find((child) => child.className === 'dshh-runCopy'),
    copy,
  )
  root.source.setAttribute('data-shimmer-text', '深度求索中')
  dom.tick()
  assert.equal(dom.time(root), '', '无用时不伪造数值，:empty 收起上行')
  dom.image(root).onerror()
  assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
  assert.equal(dom.phrase(root), '深度求索中', '图片失败不丢失文字列')
  cubes(mounted)[1].props.onClick()
  const planeText = root.content.children[0]
  assert.deepEqual(
    planeText.children.map((child) => child.className),
    ['dshh-runPhrase', 'dshh-runTime'],
    '其他皮肤布局不受影响',
  )
  assert.ok(!skinTag(mounted).textContent.includes('.dshh-runCopy'))
  mounted.dispose()
})

function deferredDecode() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

test('切换动作先在界面外解码：旧图和旧文案保持可见，用时仍更新，准备好后一起替换', async () => {
  const mounted = mountClient()
  const decoding = []
  const dom = runningDom(mounted, {
    manualLoad: true,
    decode: () => {
      const request = deferredDecode()
      decoding.push(request)
      return request.promise
    },
  })
  const root = dom.root()
  const originalNow = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    dom.tick()
    const image = dom.image(root)
    const text = root.content.children[0]
    const copy = text.children.find((child) => child.className === 'dshh-runCopy')
    const phrase = copy.children[1]
    Object.defineProperty(phrase, 'offsetWidth', {
      get() {
        throw new Error('文案切换不能强制读取布局')
      },
    })
    dom.load()
    assert.equal(decoding.length, 1)
    assert.equal(image.hidden, true, '首次解码期间保留官方图标')
    decoding[0].resolve()
    await Promise.resolve()
    const oldSrc = image.src
    assert.equal(image.getAttribute('data-action'), 'thinking')
    assert.equal(image.hidden, false)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
    let hidden = false
    const hiddenWrites = []
    Object.defineProperty(image, 'hidden', {
      get() {
        return hidden
      },
      set(value) {
        hiddenWrites.push(value)
        hidden = value
      },
    })
    const removals = []
    const removeAttribute = root.removeAttribute
    root.removeAttribute = function (key) {
      removals.push(key)
      removeAttribute.call(this, key)
    }

    clock += 3200
    dom.tick()
    const next = dom.candidate()
    assert.ok(next)
    assert.equal(next.parentNode, null, '候选图片不能挂到可见 DOM')
    assert.notEqual(next.src, oldSrc)
    assert.equal(image.src, oldSrc)
    assert.equal(image.getAttribute('data-action'), 'thinking')
    assert.equal(dom.phrase(root), '深度求索中')
    root.source.setAttribute('data-shimmer-text', '深度求索中，用时 1 分 2 秒 ···')
    dom.tick()
    assert.equal(dom.time(root), '1 分 2 秒', '不能为等待图片而暂停用时')
    dom.load()
    assert.equal(image.src, oldSrc, 'load 完成还不够，必须等待 decode')
    assert.equal(dom.phrase(root), '深度求索中')
    assert.equal(image.hidden, false)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
    decoding[1].resolve()
    await Promise.resolve()
    assert.equal(image.src, next.src)
    assert.equal(image.getAttribute('data-action'), 'context')
    assert.equal(dom.phrase(root), '正在翻上下文')
    assert.equal(root.content.children[0], text, '不能重建状态行')
    assert.equal(text.children[0], copy, '不能重建文字列')
    assert.ok(!hiddenWrites.includes(true), '不得隐藏旧图片造成空白闪烁')
    assert.ok(!removals.includes('data-dsh-hud-running-whale'), '不得闪回官方图标')
    assert.ok(!skinTag(mounted).textContent.includes('whale-settle'))
    assert.ok(skinTag(mounted).textContent.includes('min-height:56px'))
    assert.ok(!mounted.styles.some((tag) => tag.textContent.includes('.dshh-runPhrase.dshh-fade')))
  } finally {
    Date.now = originalNow
    mounted.dispose()
  }
})

test('新图加载或解码失败保留上一张成功图，不隐藏、不闪回官方，文案继续更新', async () => {
  const mounted = mountClient()
  const decoding = []
  const dom = runningDom(mounted, {
    manualLoad: true,
    decode: () => {
      const request = deferredDecode()
      decoding.push(request)
      return request.promise
    },
  })
  const root = dom.root()
  const originalNow = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    dom.tick()
    dom.load()
    decoding[0].resolve()
    await Promise.resolve()
    const image = dom.image(root)
    const oldSrc = image.src
    clock += 3200
    dom.tick()
    dom.candidate().onerror()
    assert.equal(image.src, oldSrc)
    assert.equal(image.hidden, false)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
    assert.equal(dom.phrase(root), '正在翻上下文')
    clock += 3200
    dom.tick()
    dom.load()
    decoding[1].reject(new Error('decode failed'))
    await Promise.resolve()
    assert.equal(image.src, oldSrc)
    assert.equal(image.hidden, false)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
    assert.equal(dom.phrase(root), '把线索串起来')
  } finally {
    Date.now = originalNow
    mounted.dispose()
  }
})

test('快速换动作或结束轮次后，过期解码不能覆盖新图、文案或恢复旧状态行', async () => {
  const mounted = mountClient()
  const decoding = []
  const dom = runningDom(mounted, {
    manualLoad: true,
    decode: () => {
      const request = deferredDecode()
      decoding.push(request)
      return request.promise
    },
  })
  const root = dom.root()
  const originalNow = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    dom.tick()
    dom.load()
    decoding[0].resolve()
    await Promise.resolve()
    clock += 3200
    dom.tick()
    dom.load() // context 解码仍在后台。
    clock += 3200
    dom.tick()
    dom.load() // connect 后来居上。
    decoding[2].resolve()
    await Promise.resolve()
    assert.equal(dom.image(root).getAttribute('data-action'), 'connect')
    assert.equal(dom.phrase(root), '把线索串起来')
    decoding[1].resolve()
    await Promise.resolve()
    assert.equal(dom.image(root).getAttribute('data-action'), 'connect')
    assert.equal(dom.phrase(root), '把线索串起来')
    clock += 3200
    dom.tick()
    dom.load()
    const oldImage = dom.image(root)
    const oldSrc = oldImage.src
    dom.roots.length = 0
    dom.tick()
    decoding[3].resolve()
    await Promise.resolve()
    assert.equal(oldImage.src, oldSrc)
    assert.equal(root.content.children.length, 0)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
    assert.equal(dom.marked(root), false)
  } finally {
    Date.now = originalNow
    mounted.dispose()
  }
})

test('等待解码时切换语言，提交使用最新文案，不重新加载相同动作', async () => {
  let language = 'zh'
  const listeners = new Set()
  const mounted = mountClient({
    locale: {
      resolveText: (text) => text[language],
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
  })
  const decoded = deferredDecode()
  const dom = runningDom(mounted, { manualLoad: true, decode: () => decoded.promise })
  const root = dom.root()
  dom.tick()
  const count = dom.images.length
  dom.load()
  language = 'en'
  for (const listener of listeners) listener()
  assert.equal(dom.images.length, count, '同一动作不重复请求')
  decoded.resolve()
  await Promise.resolve()
  assert.equal(dom.phrase(root), 'Deep diving')
  assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
  mounted.dispose()
})

test('纸飞机轮播文案直接更新，不透明度闪烁，也不强制回流', () => {
  const mounted = mountClient({ storageValues: { [storageKey]: 'rotate' } })
  const dom = runningDom(mounted)
  const root = dom.root()
  const originalNow = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    dom.tick()
    const phrase = root.content.children[0].children[0]
    Object.defineProperty(phrase, 'offsetWidth', {
      get() {
        throw new Error('不该读布局')
      },
    })
    phrase.classList.add = () => {
      throw new Error('不该重放淡入')
    }
    phrase.classList.remove = () => {
      throw new Error('不该摘掉淡入类')
    }
    clock += 3200
    dom.tick()
    assert.equal(dom.phrase(root), '正在翻上下文')
    assert.equal(dom.marked(root), true)
  } finally {
    Date.now = originalNow
    mounted.dispose()
  }
})

test('解码期间切换到官方皮肤，过期结果不能重新挂载文字或图片', async () => {
  const mounted = mountClient()
  const decoding = deferredDecode()
  const dom = runningDom(mounted, { manualLoad: true, decode: () => decoding.promise })
  const root = dom.root()
  try {
    dom.tick()
    const oldImage = dom.image(root)
    dom.load()
    cubes(mounted)[0].props.onClick()
    assert.equal(root.content.children.length, 0)
    assert.equal(dom.marked(root), false)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
    assert.equal(activeTickers(mounted).length, 0)
    decoding.resolve()
    await Promise.resolve()
    assert.equal(root.content.children.length, 0)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
    assert.equal(oldImage.hidden, true)
    assert.equal(oldImage.src, undefined)
  } finally {
    mounted.dispose()
  }
})

test('首次候选解码失败不吞官方图标，后续动作仍可加载', async () => {
  const mounted = mountClient()
  const requests = []
  const dom = runningDom(mounted, {
    manualLoad: true,
    decode: () => {
      const request = deferredDecode()
      requests.push(request)
      return request.promise
    },
  })
  const root = dom.root()
  const originalNow = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    dom.tick()
    dom.load()
    requests[0].reject(new Error('first decode failed'))
    await Promise.resolve()
    assert.equal(dom.image(root).hidden, true)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
    assert.equal(dom.phrase(root), '深度求索中')
    assert.equal(dom.marked(root), true)
    clock += 3200
    dom.tick()
    dom.load()
    requests[1].resolve()
    await Promise.resolve()
    assert.equal(dom.image(root).hidden, false)
    assert.equal(dom.image(root).getAttribute('data-action'), 'context')
    assert.equal(dom.phrase(root), '正在翻上下文')
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
  } finally {
    Date.now = originalNow
    mounted.dispose()
  }
})

test('旧呼吸光标与轮播偏好在首次读取时归入纸飞机，设置只显示三个选项', () => {
  for (const legacy of ['pulse', 'rotate']) {
    const mounted = mountClient({ storageValues: { [storageKey]: legacy } })
    try {
      const dom = runningDom(mounted)
      const root = dom.root()
      dom.tick()
      const buttons = cubes(mounted)
      assert.equal(buttons.length, 3)
      assert.equal(buttons[1].props['aria-pressed'], true, legacy)
      assert.equal(dom.phrase(root), '深度求索中')
      assert.equal(dom.image(root), undefined)
      assert.equal(dom.marked(root), true)
      assert.equal(activeTickers(mounted).length, 1)
      assert.ok(skinTag(mounted).textContent.includes('dshh-plane'))
      assert.ok(!skinTag(mounted).textContent.includes('dshh-breathe'))
      assert.ok(!skinTag(mounted).textContent.includes('dshh-blink'))
      assert.equal(
        mounted.windowStub.localStorage.getItem(storageKey),
        legacy,
        '读取不主动改写存储',
      )
      buttons[1].props.onClick()
      assert.equal(
        mounted.windowStub.localStorage.getItem(storageKey),
        'plane',
        '再次选择保存规范 id',
      )
      assert.equal(activeTickers(mounted).length, 1)
    } finally {
      mounted.dispose()
    }
  }
})

test('旧皮肤的跨窗口变更、focus 和轮询都规范化为同一纸飞机状态', () => {
  const mini = createMiniReact()
  const mounted = mountClient({ ReactImpl: mini.React })
  const dom = runningDom(mounted)
  const root = dom.root()
  try {
    dom.tick()
    mini.mount(mounted.components['dsh-hud-running-skin'], { t: (key) => key })
    for (const legacy of ['pulse', 'rotate']) {
      mounted.windowStub.localStorage.setItem(storageKey, legacy)
      mounted.dispatch('storage', { key: storageKey, newValue: legacy })
      assert.deepEqual(picked(mini.current()), ['skin.plane'])
      assert.equal(dom.image(root), undefined)
      assert.equal(dom.marked(root), true)
      const ticker = activeTickers(mounted)[0]
      mounted.dispatch('focus')
      mounted.intervals.find((item) => item.ms === 8000).callback()
      assert.equal(activeTickers(mounted).length, 1)
      assert.equal(activeTickers(mounted)[0], ticker, '规范化后的同皮肤不重复起节拍')
      assert.deepEqual(picked(mini.current()), ['skin.plane'])
    }
  } finally {
    mini.unmount()
    mounted.dispose()
  }
})

test('纸飞机同时保留图标动效、文案轮播和官方用时；多会话回退、官方开关仍安全', () => {
  const mounted = mountClient({ storageValues: { [storageKey]: 'plane' } })
  const dom = runningDom(mounted)
  const root = dom.root('深度求索中，用时 39 分 5 秒 ···')
  const originalNow = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    dom.tick()
    assert.equal(dom.phrase(root), '深度求索中')
    assert.equal(dom.time(root), '39 分 5 秒')
    assert.equal(dom.image(root), undefined)
    const css = skinTag(mounted).textContent
    assert.ok(css.includes('animation:dshh-plane 2.6s'))
    assert.ok(css.includes('prefers-reduced-motion:reduce'))
    assert.ok(!css.includes('dshh-breathe'))
    clock += 3200
    dom.tick()
    assert.equal(dom.phrase(root), '正在翻上下文')
    assert.equal(dom.time(root), '39 分 5 秒')
    const child = dom.root('深度求索中，用时 5 秒 ···')
    dom.tick()
    assert.equal(dom.marked(root), false)
    assert.equal(dom.marked(child), false)
    dom.roots.pop()
    dom.tick()
    assert.equal(dom.phrase(root), '深度求索中')
    assert.equal(dom.marked(root), true)
    cubes(mounted)[0].props.onClick()
    assert.equal(dom.marked(root), false)
    assert.equal(root.content.children.length, 0)
    assert.equal(skinTag(mounted), undefined)
    assert.equal(activeTickers(mounted).length, 0)
  } finally {
    Date.now = originalNow
    mounted.dispose()
  }
})
