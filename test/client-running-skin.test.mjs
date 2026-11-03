/**
 * 浏览器半用例：思考中动画换皮（`running-skin.ts` + 设置行 `SkinRow`）。
 *
 * 三件事分开盯：
 *   1. 默认状态 —— 没选过的时候按 `RUNNING_SKIN` 注入，且存储读不到不算错；
 *   2. 设置行 —— 皮肤方块、点一下写存储**并且当场换表**（不靠轮询、不用重启）；
 *   3. 选「官方」—— 整张表撤掉，不是注入一段空 CSS。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findAll, mountClient } from './client-harness.mjs'
import { createMiniReact } from './mini-react.mjs'
import { runningDom } from './client-running-dom.mjs'

/** 取当前注入的换皮表（没注入就是 undefined）。 */
function skinTag(mounted) {
  return mounted.styles.find((element) => element.attributes['data-dsh-hud'] === 'running-skin')
}

/** 渲染设置行；`t` 直接回显 key，方便按 key 找方块。 */
function renderRow(mounted) {
  return mounted.components['dsh-hud-running-skin']({ t: (key) => key })
}

/** 皮肤方块（按渲染顺序）。 */
function cubes(mounted) {
  return findAll(renderRow(mounted), (node) => node.props?.className === 'dshh-skinCube')
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

test('设置行提供官方与三种鲸鱼娘皮肤，不再显示纸飞机', () => {
  const mounted = mountClient()
  const buttons = cubes(mounted)
  assert.equal(buttons.length, 4)
  assert.deepEqual(
    buttons.map((button) => button.children[1].children[0]),
    ['skin.off', 'skin.whale', 'skin.cyber-whale', 'skin.longdress-whale'],
  )
  assert.equal(buttons[1].props['data-active'], '', '默认鲸鱼娘保持不变')
  assert.equal(
    findAll(renderRow(mounted), (node) => node.type === 'select').length,
    0,
    '自定义表情包选择器已移到「表情包」页',
  )
  mounted.dispose()
})

test('官方线稿与角色图同框：56px 图标框内居中，墨迹约 2/3 高、线宽 1.7px', () => {
  const mounted = mountClient()
  const buttons = cubes(mounted)
  const play = buttons.map((button) => button.children[0]).filter((icon) => icon.type !== 'span')
  assert.equal(play.length, 4, '四张卡片都有图标节点')
  for (const icon of play.slice(1)) {
    assert.equal(icon.type, 'img')
    assert.equal(icon.props.className, 'dshh-skinFace')
    assert.equal(icon.props.width, 56, '角色图 56px')
    assert.equal(icon.props.height, 56)
  }
  const glyph = play[0]
  assert.equal(glyph.type, 'svg', '官方是线稿，不是图片')
  assert.equal(glyph.props.className, 'dshh-skinFace', '和角色图共用同一个尺寸类')
  assert.equal(glyph.props.width, 56, '不再缩在 16px 的角落')
  assert.equal(glyph.props.height, 56, '仍占满图标框，四张卡片的文字才会落在同一条基线上')
  // 官方原路径只占 viewBox 的 12.34×12.60，且偏左上。这里按它自己的外接框取一个居中的方框，
  // 让墨迹落在框高的约 2/3 处：再大就比角色图还抢眼，再小又像随手贴上去的。
  const box = glyph.props.viewBox.split(' ').map(Number)
  assert.equal(box.length, 4)
  assert.equal(box[2], box[3], '方形裁剪框，宽高不拉伸')
  assert.ok(Math.abs(box[0] + box[2] / 2 - 8.9096) < 0.001, '横向按墨迹中心 8.9096 居中')
  assert.ok(Math.abs(box[1] + box[3] / 2 - 7.4428) < 0.001, '纵向按墨迹中心 7.4428 居中')
  const inkPx = (12.5985 * 56) / box[2]
  assert.ok(Math.abs(inkPx - 38) < 0.1, '墨迹约 38px，四周留出气口')
  const strokePx = (glyph.children[0].props.strokeWidth * 56) / box[2]
  assert.ok(Math.abs(strokePx - 1.7) < 0.02, '屏幕上线宽约 1.7px，与角色图描边同一重量级')
  mounted.dispose()
})

test('选赛博鲸鱼娘时保存独立 ID 并应用鲸鱼布局', () => {
  const mounted = mountClient({
    storageValues: { 'dsh-hud:display-settings': JSON.stringify({ imageSize: 40 }) },
  })
  const button = cubes(mounted).find((item) => item.children[1].children[0] === 'skin.cyber-whale')
  button.props.onClick()
  assert.equal(mounted.windowStub.localStorage.getItem(storageKey), 'cyber-whale')
  assert.ok(skinTag(mounted).textContent.includes('width:40px;height:40px'))
  mounted.dispose()
})

test('赛博鲸鱼娘启动独立轮播 ticker 且重复切换不累积', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const root = dom.root()
  const button = cubes(mounted).find((item) => item.children[1].children[0] === 'skin.cyber-whale')
  button.props.onClick()
  assert.equal(activeTickers(mounted).length, 1)
  assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
  assert.match(dom.image(root).src, /^data:image\/webp;base64,/)
  button.props.onClick()
  assert.equal(activeTickers(mounted).length, 1)
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

const storageKey = 'dsh-hud:running-skin'
function activeTickers(mounted) {
  return mounted.intervals.filter((item) => item.ms === 300 && !item.cancelled)
}
function configureActivity(mounted) {
  let current = {
    key: 'thinking-1',
    phase: 'thinking',
    toolName: null,
    attemptId: null,
    turn: 1,
    step: 1,
  }
  mounted.exported.configureRunningText({
    readActivity: () => current,
    resolveText: (text) => text.zh,
  })
  return (key, step = 1, phase = 'thinking', toolName = null) => {
    current = { ...current, key, step, phase, toolName }
    mounted.exported.refreshRunningText()
  }
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
  assert.equal(dom.phrase(root), '正在处理')
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
  mounted.windowStub.localStorage.setItem(storageKey, 'whale')
  mounted.intervals.find((item) => item.ms === 8000).callback()
  assert.ok(skinTag(mounted))
  assert.equal(activeTickers(mounted).length, 1)
  assert.equal(dom.marked(root), true)
  assert.deepEqual(picked(mini.current()), ['skin.whale'])
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
  assert.deepEqual(picked(mini.current()), ['skin.whale'])
  assert.equal(activeTickers(mounted).length, 1)
  mounted.dispatch('focus')
  mounted.intervals.find((item) => item.ms === 8000).callback()
  assert.ok(skinTag(mounted).textContent.includes('.dshh-runWhale'))
  assert.equal(activeTickers(mounted).length, 1)
  assert.equal(dom.marked(root), true)
  assert.deepEqual(picked(mini.current()), ['skin.whale'])
  mounted.dispatch('storage', { key: storageKey, newValue: 'cyber-whale' })
  assert.equal(activeTickers(mounted).length, 1)
  assert.deepEqual(picked(mini.current()), ['skin.cyber-whale'])
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
  assert.equal(dom.phrase(root), '正在处理')
  active = 'en'
  root.source.setAttribute('data-shimmer-text', 'Deep diving for 1m 2s ···')
  for (const listener of listeners) listener()
  assert.equal(dom.phrase(root), 'Working')
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
  cubes(mounted)
    .find((button) => button.children[1].children[0] === 'skin.off')
    .props.onClick()
  cubes(mounted)
    .find((button) => button.children[1].children[0] === 'skin.whale')
    .props.onClick()
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

test('工具分组与活动事件同步：稳定文本不受时间影响，同组新调用推进动作', async () => {
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
  let activity = { key: 'bash-1', phase: 'tool', toolName: 'bash', turn: 1, step: 1 }
  mounted.exported.configureRunningText({
    readActivity: () => activity,
    resolveText: (text) => text.zh,
  })
  try {
    await store.loadTools()
    mounted.exported.refreshRunningText()
    assert.equal(dom.phrase(root), '正在执行命令')
    const firstAction = dom.image(root).getAttribute('data-action')
    mounted.exported.refreshRunningText()
    assert.equal(dom.image(root).getAttribute('data-action'), firstAction)
    activity = { ...activity, key: 'bash-2', step: 2 }
    mounted.exported.refreshRunningText()
    assert.ok(dom.image(root).getAttribute('data-action'))
    name = 'apply_patch'
    activity = { ...activity, key: 'edit-1', toolName: name, step: 1 }
    await store.loadTools()
    mounted.exported.refreshRunningText()
    assert.equal(dom.phrase(root), '正在修改文件')
    name = null
    activity = null
    await store.loadTools()
    mounted.exported.refreshRunningText()
    assert.equal(dom.phrase(root), '正在处理', 'missing activity uses honest generic text')
  } finally {
    mounted.dispose()
  }
})

test('鲸鱼娘是可选皮肤：真彩色 img，加载后才替换官方图标', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted, { manualLoad: true })
  const root = dom.root()
  cubes(mounted)
    .find((button) => button.children[1].children[0] === 'skin.whale')
    .props.onClick()
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
  assert.equal(dom.phrase(root), '正在处理')
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

test('文案按活动事件更新，切语言只重译文本；图片失败不吞掉当前状态', () => {
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
  })
  let activity = { key: 'think-1', phase: 'thinking', toolName: null, turn: 1, step: 1 }
  mounted.exported.configureRunningText({
    readActivity: () => activity,
    resolveText: (text) => text[language],
  })
  const dom = runningDom(mounted)
  const root = dom.root()
  try {
    cubes(mounted)
      .find((button) => button.children[1].children[0] === 'skin.whale')
      .props.onClick()
    assert.equal(dom.phrase(root), '模型思考中')
    language = 'en'
    mounted.exported.refreshRunningText()
    assert.equal(dom.phrase(root), 'Model is reasoning')
    assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
    for (const [phase, toolName, phrase] of [
      ['tool', 'functions.apply_patch', 'Editing files'],
      ['tool', 'functions.exec_command', 'Running command'],
      ['tool', 'read_file', 'Reading files'],
      ['tool', 'web.search_query', 'Searching'],
      ['tool', 'custom_tool', 'Running tool'],
    ]) {
      activity = { ...activity, key: `${toolName}-1`, phase, toolName, step: activity.step + 1 }
      mounted.exported.refreshRunningText()
      assert.equal(dom.phrase(root), phrase)
      // 图片只受"新事件"驱动，与工具种类无关；顺序由全库池决定。
      assert.ok(dom.image(root).getAttribute('data-action'))
    }
    dom.image(root).onerror()
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
    assert.equal(dom.image(root).hidden, true)
    assert.equal(dom.phrase(root), 'Running tool')
  } finally {
    mounted.dispose()
  }
})

test('事件可访问全部动作素材；减弱动态冻结组内变体但仍反映状态变化', () => {
  let reduced = false
  let motionListener = null
  const mounted = mountClient()
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
  let activity = null
  mounted.exported.configureRunningText({
    readActivity: () => activity,
    resolveText: (text) => text.zh,
  })
  const dom = runningDom(mounted)
  const root = dom.root()
  try {
    cubes(mounted)
      .find((button) => button.children[1].children[0] === 'skin.whale')
      .props.onClick()
    // 全库池里的每个动作都能拿到素材。
    const pool = mounted.exported.ACTION_POOL
    assert.equal(pool.length, 30, '池子覆盖全部动作')
    activity = { key: 'seed', phase: 'tool', toolName: 'read_file', turn: 1, step: 99 }
    mounted.exported.refreshRunningText()
    reduced = true
    motionListener()
    activity = { ...activity, key: 'reduced-read-1', phase: 'tool', toolName: 'read_file' }
    mounted.exported.refreshRunningText()
    assert.equal(dom.image(root).getAttribute('data-action'), pool[0], '减少动态时固定在池首')
    activity = { ...activity, key: 'reduced-read-2', step: 100 }
    mounted.exported.refreshRunningText()
    assert.equal(dom.image(root).getAttribute('data-action'), pool[0])
    assert.equal(dom.phrase(root), '正在读取文件')
    activity = { ...activity, key: 'reduced-shell', toolName: 'bash' }
    mounted.exported.refreshRunningText()
    assert.equal(dom.phrase(root), '正在执行命令')
    assert.equal(dom.image(root).getAttribute('data-action'), pool[0], '换工具也不推进')
  } finally {
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
  cubes(mounted)
    .find((button) => button.children[1].children[0] === 'skin.whale')
    .props.onClick()
  assert.equal(dom.image(root).hidden, true)
  assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
  assert.equal(dom.phrase(root), '正在处理')
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
  assert.equal(
    cubes(mounted).find((button) => button.children[1].children[0] === 'skin.whale').props[
      'aria-pressed'
    ],
    true,
  )
  assert.equal(mounted.windowStub.localStorage.getItem(storageKey), null)
  mounted.dispose()

  for (const skin of ['off', 'whale', 'cyber-whale', 'longdress-whale']) {
    const existing = mountClient({ storageValues: { [storageKey]: skin } })
    const selected = cubes(existing).filter((button) => button.props['aria-pressed'])
    assert.equal(selected.length, 1)
    assert.equal(selected[0].children[1].children[0], 'skin.' + skin)
    assert.equal(existing.windowStub.localStorage.getItem(storageKey), skin)
    existing.dispose()
  }
})

test('扩充文案：200 条双语短句、六组均有足量选择、组内无重复且不承诺进度', () => {
  const mounted = mountClient()
  const cues = mounted.exported.RUNNING_CUES
  const counts = { idle: 64, edit: 32, shell: 32, read: 32, search: 24, other: 16 }
  const all = Object.values(cues).flat()
  assert.equal(all.length, 200)
  assert.equal(new Set(all.map((cue) => cue.zh)).size, 200)
  assert.equal(new Set(all.map((cue) => cue.en)).size, 200)
  for (const [group, count] of Object.entries(counts)) {
    assert.equal(cues[group].length, count, group)
    for (const cue of cues[group]) {
      assert.equal(cue.zh.trim(), cue.zh)
      assert.equal(cue.en.trim(), cue.en)
      assert.ok(cue.zh.length <= 18, `${group}: ${cue.zh} 超出短句长度`)
      assert.ok(cue.en.length <= 64, `${group}: ${cue.en} 过长`)
      // 旁白允许玩笑和「快了」这种语气：事实由独立的主文案负责，短句不冒充进度。
      // 只保留一条：不写具体数字（秒数、百分比），那是会被当真的硬承诺。
      assert.doesNotMatch(cue.zh, /\d/, `${group}: ${cue.zh} 不该出现具体数字`)
      // 中文文案不夹拉丁字母：产品名、指标、按键名都不该出现在这里。
      assert.doesNotMatch(cue.zh, /[A-Za-z]/, `${group}: ${cue.zh} 不该夹英文`)
      assert.doesNotMatch(cue.en, /\d/, `${group}: ${cue.en} 不该出现具体数字`)
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
  // 每组都要把该组的动作覆盖到，避免某个动作永远轮不到素材。
  const covered = new Set(
    Object.values(cues)
      .flat()
      .map((cue) => cue.action),
  )
  for (const action of [
    'question',
    'butterfly',
    'gears',
    'puzzle',
    'thread',
    'sketching',
    'flashlight',
    'binoculars',
    'map',
    'measuring',
    'toolbox',
    'notes',
  ]) {
    assert.ok(covered.has(action), `缺动作 ${action}`)
  }
  assert.equal(Object.values(cues).flat().length, 200, '扩充动作不减少双语文案数量')
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
  const coveredRice = new Set(
    Object.values(cues)
      .flat()
      .map((cue) => cue.action),
  )
  for (const action of [
    'rice_eating',
    'rice_cheeks',
    'rice_terminal',
    'rice_ponder',
    'rice_reading',
    'rice_notes',
  ]) {
    assert.ok(coveredRice.has(action), `缺米饭动作 ${action}`)
  }
  // 表情已改为全库共用池，动作不再绑定某个工具的上下文，只在全库出现即可。
  assert.ok(coveredRice.has('rice_terminal'))
  assert.equal(Object.values(cues).flat().length, 200)
  mounted.dispose()
})

test('鲸鱼娘两行布局：上方用时、下方文案，图片在左', () => {
  const mounted = mountClient()
  const dom = runningDom(mounted)
  const root = dom.root('深度求索中，用时 39 分 5 秒 ···')
  dom.tick()
  const text = root.content.children[0]
  const copy = text.children.find((child) => child.className === 'dshh-runCopy')
  assert.ok(copy, '鲸鱼娘使用独立文字列')
  assert.deepEqual(
    copy.children.map((child) => child.className),
    ['dshh-runTime', 'dshh-runLine'],
    'DOM 阅读顺序与上下位置一致',
  )
  assert.equal(dom.time(root), '39 分 5 秒')
  assert.equal(dom.phrase(root), '正在处理')
  const css = skinTag(mounted).textContent
  assert.ok(css.includes('.dshh-runCopy{display:inline-flex;flex-direction:column;'))
  assert.ok(css.includes('.dshh-runWhale{order:-1;'), '图片仍在文字列左侧')
  assert.ok(css.includes('.dshh-runTime{line-height:1.2}'))
  assert.ok(
    /\[data-chat-running\] \.dshh-runTime,\[data-chat-running\] \.dshh-runPhrase,\[data-chat-running\] \.dshh-runFun\{font-size:1em/.test(
      css,
    ),
    'time, fact and flavour share one type size',
  )
  assert.ok(
    !/\.dshh-runFun\{[^}]*font-size:\.92em/.test(css),
    'the flavour line must not be scaled down',
  )
  assert.match(
    css,
    /\[data-chat-running\] \.dshh-runFun\{[^}]*background-image:linear-gradient/,
    'the flavour text also carries the ripple',
  )
  assert.match(
    css,
    /prefers-reduced-motion[^}]*\{[\s\S]*\.dshh-runFun\{[^}]*animation:none/,
    'reduced motion also stills the flavour ripple',
  )
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
  assert.equal(dom.phrase(root), '正在处理', '图片失败不丢失文字列')
  assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
  assert.ok(skinTag(mounted).textContent.includes('.dshh-runCopy'))
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

test('切换动作先在界面外解码：旧图保持可见，真实状态与用时仍及时更新', async () => {
  const mounted = mountClient()
  const advance = configureActivity(mounted)
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

    clock += 6200
    advance('thinking-' + clock)
    dom.tick()
    const next = dom.candidate()
    assert.ok(next)
    assert.equal(next.parentNode, null, '候选图片不能挂到可见 DOM')
    assert.notEqual(next.src, oldSrc)
    assert.equal(image.src, oldSrc)
    assert.equal(image.getAttribute('data-action'), 'thinking')
    assert.equal(dom.phrase(root), '模型思考中')
    root.source.setAttribute('data-shimmer-text', '深度求索中，用时 1 分 2 秒 ···')
    dom.tick()
    assert.equal(dom.time(root), '1 分 2 秒', '不能为等待图片而暂停用时')
    dom.load()
    assert.equal(image.src, oldSrc, 'load 完成还不够，必须等待 decode')
    assert.equal(dom.phrase(root), '模型思考中')
    assert.equal(image.hidden, false)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
    decoding[1].resolve()
    await Promise.resolve()
    assert.equal(image.src, next.src)
    assert.ok(image.getAttribute('data-action'), '新调用仍带姿势标识')
    assert.equal(dom.phrase(root), '模型思考中')
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

test('whale 切到 cyber-whale 时相同动作切换独立资源，旧皮肤的 pending decode 不能抢先提交', async () => {
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
  try {
    dom.tick()
    const whaleCandidate = dom.candidate()
    dom.load()
    assert.equal(whaleCandidate.getAttribute('data-action'), null)
    assert.match(whaleCandidate.src, /^data:image\/webp;base64,/)
    assert.equal(decoding.length, 1)

    cubes(mounted)
      .find((button) => button.props.key === 'cyber-whale')
      .props.onClick()
    const cyberCandidate = dom.candidate()
    dom.load()
    const cyberImage = dom.image(root)
    assert.notEqual(cyberCandidate, whaleCandidate)
    assert.notEqual(
      cyberCandidate.src,
      whaleCandidate.src,
      '相同 thinking 动作必须使用 cyber 独立资源',
    )
    assert.equal(cyberImage.hidden, true, '新皮肤图片仍等待自己的 decode')
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)
    assert.equal(decoding.length, 2)

    decoding[0].resolve()
    await Promise.resolve()
    assert.equal(cyberImage.hidden, true, '旧 whale 解码不能提交或提前隐藏官方图标')
    assert.equal(cyberImage.src, undefined)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), null)

    decoding[1].resolve()
    await Promise.resolve()
    assert.equal(cyberImage.hidden, false)
    assert.equal(cyberImage.src, cyberCandidate.src)
    assert.equal(cyberImage.getAttribute('data-action'), 'thinking')
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
  } finally {
    mounted.dispose()
  }
})
test('新图加载或解码失败保留上一张成功图，不隐藏、不闪回官方，文案继续更新', async () => {
  const mounted = mountClient()
  const advance = configureActivity(mounted)
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
    clock += 6200
    advance('thinking-' + clock)
    dom.tick()
    dom.candidate().onerror()
    assert.equal(image.src, oldSrc)
    assert.equal(image.hidden, false)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
    assert.equal(dom.phrase(root), '模型思考中')
    clock += 6200
    advance('thinking-' + clock)
    dom.tick()
    dom.load()
    decoding[1].reject(new Error('decode failed'))
    await Promise.resolve()
    assert.equal(image.src, oldSrc)
    assert.equal(image.hidden, false)
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
    assert.equal(dom.phrase(root), '模型思考中')
  } finally {
    Date.now = originalNow
    mounted.dispose()
  }
})

test('快速换动作或结束轮次后，过期解码不能覆盖新图、文案或恢复旧状态行', async () => {
  const mounted = mountClient()
  const advance = configureActivity(mounted)
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
    clock += 6200
    advance('thinking-' + clock)
    dom.tick()
    dom.load() // context 解码仍在后台。
    clock += 6200
    advance('thinking-' + clock)
    dom.tick()
    dom.load() // connect 后来居上。
    decoding[2].resolve()
    await Promise.resolve()
    assert.ok(dom.image(root).getAttribute('data-action'))
    assert.equal(dom.phrase(root), '模型思考中')
    decoding[1].resolve()
    await Promise.resolve()
    assert.ok(dom.image(root).getAttribute('data-action'))
    assert.equal(dom.phrase(root), '模型思考中')
    clock += 6200
    advance('thinking-' + clock)
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
  assert.equal(dom.phrase(root), 'Working')
  assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
  mounted.dispose()
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
  const advance = configureActivity(mounted)
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
    assert.equal(dom.phrase(root), '模型思考中')
    assert.equal(dom.marked(root), true)
    clock += 6200
    advance('thinking-' + clock)
    dom.tick()
    dom.load()
    requests[1].resolve()
    await Promise.resolve()
    assert.equal(dom.image(root).hidden, false)
    assert.ok(dom.image(root).getAttribute('data-action'))
    assert.equal(dom.phrase(root), '模型思考中')
    assert.equal(root.getAttribute('data-dsh-hud-running-whale'), '')
  } finally {
    Date.now = originalNow
    mounted.dispose()
  }
})

test('旧纸飞机与轮播偏好在首次读取时回退到默认鲸鱼娘', () => {
  for (const legacy of ['pulse', 'rotate']) {
    const mounted = mountClient({ storageValues: { [storageKey]: legacy } })
    try {
      const dom = runningDom(mounted)
      const root = dom.root()
      dom.tick()
      const buttons = cubes(mounted)
      assert.equal(buttons.length, 4)
      assert.equal(buttons[1].props['aria-pressed'], true, legacy)
      assert.equal(dom.phrase(root), '正在处理')
      assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
      assert.equal(dom.marked(root), true)
      assert.equal(activeTickers(mounted).length, 1)
      assert.ok(!skinTag(mounted).textContent.includes('plane'))
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
        'whale',
        '再次选择保存默认角色 id',
      )
      assert.equal(activeTickers(mounted).length, 1)
    } finally {
      mounted.dispose()
    }
  }
})

test('旧轮播偏好与跨窗口无效皮肤值不会启用已移除的纸飞机', () => {
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
      assert.deepEqual(picked(mini.current()), ['skin.whale'])
      assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
      assert.equal(dom.marked(root), true)
      const ticker = activeTickers(mounted)[0]
      mounted.dispatch('focus')
      mounted.intervals.find((item) => item.ms === 8000).callback()
      assert.equal(activeTickers(mounted).length, 1)
      assert.equal(activeTickers(mounted)[0], ticker, '规范化后的同皮肤不重复起节拍')
      assert.deepEqual(picked(mini.current()), ['skin.whale'])
    }
  } finally {
    mini.unmount()
    mounted.dispose()
  }
})

test('旧 plane 存储回退到默认鲸鱼娘并继续安全轮播', () => {
  const mounted = mountClient({ storageValues: { [storageKey]: 'plane' } })
  const dom = runningDom(mounted)
  const root = dom.root('深度求索中，用时 39 分 5 秒 ···')
  const originalNow = Date.now
  let clock = 1000
  Date.now = () => clock
  try {
    dom.tick()
    assert.equal(dom.phrase(root), '正在处理')
    assert.equal(dom.time(root), '39 分 5 秒')
    assert.equal(dom.image(root).getAttribute('data-action'), 'thinking')
    const css = skinTag(mounted).textContent
    assert.ok(css.includes('.dshh-runWhale'))
    assert.ok(!css.includes('plane'))
    assert.ok(!css.includes('dshh-breathe'))
    clock += 6200
    dom.tick()
    assert.equal(dom.phrase(root), '正在处理')
    assert.equal(dom.time(root), '39 分 5 秒')
    const child = dom.root('深度求索中，用时 5 秒 ···')
    dom.tick()
    assert.equal(dom.marked(root), false)
    assert.equal(dom.marked(child), false)
    dom.roots.pop()
    dom.tick()
    assert.equal(dom.phrase(root), '正在处理')
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
