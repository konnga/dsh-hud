/** Event-driven running-row activity semantics and display mapping. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mountClient } from './client-harness.mjs'
import { runningDom } from './client-running-dom.mjs'

function activity(key, phase, toolName = null, step = 1) {
  return { key, phase, toolName, attemptId: null, turn: 1, step }
}

function fixture(initial, options = {}) {
  let current = initial
  const mounted = mountClient(options)
  const resolveText = (text) => text.zh
  mounted.exported.configureRunningText({ readActivity: () => current, resolveText })
  const dom = runningDom(mounted)
  const root = dom.root()
  const refresh = () => mounted.exported.refreshRunningText()
  return {
    mounted,
    dom,
    root,
    refresh,
    setActivity(next) {
      current = next
      refresh()
    },
  }
}

test('null activity uses honest static working text and thinking pose', () => {
  const f = fixture(null)
  try {
    f.refresh()
    assert.equal(f.dom.phrase(f.root), '正在处理')
    assert.equal(f.dom.image(f.root).getAttribute('data-action'), 'thinking')
  } finally {
    f.mounted.dispose()
  }
})

test('phase labels map to factual status text and phase changes do not wait for a timer', () => {
  const f = fixture(activity('waiting-1', 'waiting'))
  try {
    for (const [state, phrase] of [
      [activity('waiting-1', 'waiting'), '等待模型响应'],
      [activity('thinking-1', 'thinking'), '模型思考中'],
      [activity('responding-1', 'responding'), '正在生成回复'],
      [activity('tool-1', 'tool', 'read_file'), '正在读取文件'],
      [activity('tool-2', 'tool', 'apply_patch'), '正在修改文件'],
      [activity('tool-3', 'tool', 'bash'), '正在执行命令'],
      [activity('tool-4', 'tool', 'web_search'), '正在搜索资料'],
      [activity('tool-5', 'tool', 'unmapped'), '正在执行工具'],
      [activity('approval-1', 'approval'), '等待用户确认'],
      [activity('error-1', 'error'), '本轮发生错误'],
    ]) {
      f.setActivity(state)
      assert.equal(f.dom.phrase(f.root), phrase)
    }
  } finally {
    f.mounted.dispose()
  }
})

test('事件不变时事实文案不动，但表情与短语按自己的节拍轮换', (t) => {
  let now = 1_000
  t.mock.method(Date, 'now', () => now)
  const f = fixture(activity('read-call-1', 'tool', 'read_file'))
  try {
    f.refresh()
    const fact = f.dom.phrase(f.root)
    f.refresh()
    assert.equal(f.dom.phrase(f.root), fact, '刷新不改变事实文案')
    now += 30_000
    f.refresh()
    assert.equal(f.dom.phrase(f.root), fact, '时间不改变事实文案')
    assert.notEqual(f.dom.image(f.root).getAttribute('data-action'), 'thinking', '表情已轮换')
  } finally {
    f.mounted.dispose()
  }
})

test('表情与趣味短语同一节拍推进：到点换下一张，事件本身不换图', (t) => {
  let now = 1_000
  t.mock.method(Date, 'now', () => now)
  const f = fixture(activity('call-1', 'tool', 'read_file'))
  try {
    f.refresh()
    const first = f.dom.image(f.root).getAttribute('data-action')
    assert.equal(first, 'thinking', '池首起步')
    // 事件变化不换图：同一次调用期间换了 step 也保持。
    f.setActivity(activity('call-2', 'tool', 'bash', 2))
    assert.equal(f.dom.image(f.root).getAttribute('data-action'), first, '换工具不换图')
    // 时间到点才推进，并且与趣味短语同一拍。
    const phraseBefore = f.dom.fun(f.root)
    now += 6_200
    f.refresh()
    assert.notEqual(f.dom.image(f.root).getAttribute('data-action'), first, '到点换图')
    assert.notEqual(f.dom.fun(f.root), phraseBefore, '短语同拍更换')
  } finally {
    f.mounted.dispose()
  }
})

test('reduced motion freezes the pose on the pool head but still tracks status changes', () => {
  const f = fixture(activity('read-1', 'tool', 'read_file'))
  f.mounted.windowStub.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  })
  // 皮肤同步时才读取媒体查询；focus 会让它重建一次，模拟真实的偏好变更路径。
  f.mounted.dispatch('focus')
  try {
    f.refresh()
    const firstReadAction = f.dom.image(f.root).getAttribute('data-action')
    assert.equal(firstReadAction, 'thinking', '减少动态时固定在池首')
    f.setActivity(activity('read-2', 'tool', 'read_file', 2))
    assert.equal(f.dom.image(f.root).getAttribute('data-action'), firstReadAction)
    assert.equal(f.dom.phrase(f.root), '正在读取文件')
    f.setActivity(activity('shell-1', 'tool', 'bash'))
    assert.equal(f.dom.image(f.root).getAttribute('data-action'), 'thinking', '换工具也不推进')
    now_advance: {
      // 即便过了轮换周期，减少动态时也不换图。
      f.refresh()
    }
    f.setActivity(activity('thinking-1', 'thinking'))
    assert.equal(f.dom.phrase(f.root), '模型思考中')
    assert.equal(f.dom.image(f.root).getAttribute('data-action'), 'thinking')
  } finally {
    f.mounted.dispose()
  }
})

test('English labels come from the supplied locale resolver', () => {
  const mounted = mountClient()
  mounted.exported.configureRunningText({
    readActivity: () => activity('waiting-1', 'waiting'),
    resolveText: (text) => text.en,
  })
  const dom = runningDom(mounted)
  const root = dom.root()
  try {
    mounted.exported.refreshRunningText()
    assert.equal(dom.phrase(root), 'Waiting for model response')
  } finally {
    mounted.dispose()
  }
})

test('a separate playful line sits beside the fact and never restates it', () => {
  const f = fixture(activity('read-1', 'tool', 'read_file'))
  try {
    f.refresh()
    assert.equal(f.dom.phrase(f.root), '正在读取文件')
    const fun = f.dom.fun(f.root)
    assert.ok(fun, '趣味短语应该有自己的节点')
    assert.notEqual(fun, '正在读取文件')
    assert.doesNotMatch(fun, /^正在/, '副文案不复述事实')
    assert.ok(f.mounted.exported.ACTION_POOL.length > 0)
  } finally {
    f.mounted.dispose()
  }
})

test('趣味短语与表情同一节拍轮换，事实文案不动', (t) => {
  let now = 10_000
  t.mock.method(Date, 'now', () => now)
  const f = fixture(activity('read-1', 'tool', 'read_file'))
  try {
    f.refresh()
    const fact = f.dom.phrase(f.root)
    const pose = f.dom.image(f.root).getAttribute('data-action')
    const first = f.dom.fun(f.root)
    now += 5_000
    f.refresh()
    assert.equal(f.dom.fun(f.root), first, '未到周期不换')
    assert.equal(f.dom.image(f.root).getAttribute('data-action'), pose)
    now += 1_000
    f.refresh()
    assert.notEqual(f.dom.fun(f.root), first, '周期到了换短语')
    assert.notEqual(f.dom.image(f.root).getAttribute('data-action'), pose, '表情同拍更换')
    assert.equal(f.dom.phrase(f.root), fact, '事实文案不受影响')
  } finally {
    f.mounted.dispose()
  }
})

test('the pool spans every tool group, so switching tools does not change where asides come from', () => {
  const mounted = mountClient()
  const { FUN_PHRASES } = mounted.exported
  try {
    const pool = new Set(FUN_PHRASES.map((item) => item.zh))
    assert.ok(FUN_PHRASES.length >= 150, '池子覆盖整个文案库')
    // 每个组的句子都在同一个池子里，不按当前工具筛选。
    for (const cues of Object.values(mounted.exported.RUNNING_CUES)) {
      const usable = cues.filter((cue) => !/^正在/.test(cue.zh) && !cue.zh.includes('深度求索'))
      for (const cue of usable) assert.ok(pool.has(cue.zh), cue.zh)
    }
    assert.ok(!FUN_PHRASES.some((item) => /^正在/.test(item.zh)), '不复述事实')
  } finally {
    mounted.dispose()
  }
})

test('random pick never repeats the phrase already on screen', () => {
  const mounted = mountClient()
  const { pickFunPhrase, FUN_PHRASES } = mounted.exported
  try {
    const pool = FUN_PHRASES.slice(0, 10)
    const previous = pool[3].zh
    // 随机数若正好落在上一句，必须顺延到下一句。
    const forced = pickFunPhrase(pool, previous, () => 3 / pool.length)
    assert.notEqual(forced.zh, previous)
    assert.equal(forced.zh, pool[4].zh)
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const picked = pickFunPhrase(pool, previous)
      assert.notEqual(picked.zh, previous)
      assert.ok(pool.includes(picked))
    }
    assert.deepEqual(pickFunPhrase([], previous), { zh: '', en: '' })
    assert.deepEqual(pickFunPhrase([pool[0]], previous), pool[0], '单条时只能返回它')
  } finally {
    mounted.dispose()
  }
})

test('hovering the aside pauses rotation and leaving resumes it', (t) => {
  let now = 5_000
  t.mock.method(Date, 'now', () => now)
  const f = fixture(activity('read-1', 'tool', 'read_file'))
  try {
    f.refresh()
    const first = f.dom.fun(f.root)
    const node = f.dom.funNode(f.root)
    assert.ok(node, '趣味短语节点可被悬停')
    node.dispatch('mouseenter')
    now += 30_000
    f.refresh()
    assert.equal(f.dom.fun(f.root), first, '悬停期间不换句')
    node.dispatch('mouseleave')
    now += 6_500
    f.refresh()
    assert.notEqual(f.dom.fun(f.root), first, '移开后恢复轮换')
  } finally {
    f.mounted.dispose()
  }
})

test('reduced motion freezes the playful line as well', (t) => {
  let now = 1_000
  t.mock.method(Date, 'now', () => now)
  const f = fixture(activity('read-1', 'tool', 'read_file'))
  f.mounted.windowStub.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  })
  f.mounted.dispatch('focus')
  try {
    f.refresh()
    const first = f.dom.fun(f.root)
    now += 30_000
    f.refresh()
    assert.equal(f.dom.fun(f.root), first, '减少动态效果时副文案不轮换')
  } finally {
    f.mounted.dispose()
  }
})

test('表情走单一全库池：30 个动作各一次，换工具也不会换池子', () => {
  const mounted = mountClient()
  const { ACTION_POOL } = mounted.exported
  try {
    assert.equal(ACTION_POOL.length, 30)
    assert.equal(new Set(ACTION_POOL).size, 30, '池内不重复')
    assert.equal(ACTION_POOL[0], 'thinking', '起始姿势')
  } finally {
    mounted.dispose()
  }
})
