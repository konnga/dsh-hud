/** 浏览器半用例：recall（7 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMiniReact } from './mini-react.mjs'
import { mountClient, mountComposerRecall, statusFixture, turnOutline } from './client-harness.mjs'

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
  root.textContent = '\n' // `<p><br></p>` 的 innerText 就长这样
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
  await press('ArrowUp') // 到最旧
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
      if (endpoint === 'prompt-history')
        return Promise.resolve({
          ok: true,
          value: { available: true, sessionId: 'session-1', prompts: ['只有一句'] },
        })
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })

  let caret = 0
  let execCommandCalls = 0
  const frames = []
  const root = {
    textContent: '',
    get innerText() {
      return this.textContent
    },
    getAttribute: () => 'true',
    parentElement: null,
    // 粘贴是**异步**落地：这一帧里先什么都不做，下一帧才写入 —— Lexical 就是这样。
    dispatchEvent: (event) => {
      if (event.type === 'paste') {
        const text = event.clipboardData.getData('text/plain')
        frames.push(() => {
          root.textContent = text
        })
      }
      return true
    },
  }
  bundle.windowStub.getSelection = () => ({
    rangeCount: 1,
    isCollapsed: true,
    focusNode: root,
    focusOffset: caret,
    removeAllRanges() {},
    addRange() {},
  })
  bundle.documentStub.createRange = () => ({
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
  })
  bundle.documentStub.execCommand = () => {
    execCommandCalls += 1
    return true
  }
  bundle.windowStub.requestAnimationFrame = (callback) => {
    frames.push(callback)
    return frames.length
  }
  bundle.windowStub.ClipboardEvent = class {
    constructor(type, init) {
      this.type = type
      this.clipboardData = init.clipboardData
    }
  }
  bundle.windowStub.DataTransfer = class {
    setData(name, value) {
      this.text = value
    }
    getData() {
      return this.text
    }
  }

  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  await store.loadPromptHistory('session-1')

  const event = {
    key: 'ArrowUp',
    target: root,
    prevented: undefined,
    preventDefault() {
      this.prevented = true
    },
    stopPropagation() {},
  }
  ;(bundle.listeners.get('keydown') ?? [])[0].listener(event)
  assert.equal(event.prevented, true, '先挡住默认行为')

  // 把排队中的帧依次跑掉（模拟浏览器推进到内容真正落地）。
  // 注意不能把 `frames.length > 0` 写进循环守卫：第一轮时 promise 链还没跑、帧还没排上，
  // 守卫会直接判假、整个循环跳过 —— 那会变成"测了个空"。
  for (let round = 0; round < 8; round += 1) {
    const queue = frames.splice(0, frames.length)
    for (const callback of queue) callback()
    await new Promise((resolve) => setImmediate(resolve))
    if (frames.length === 0 && root.textContent !== '') break
  }

  assert.equal(
    root.textContent,
    '只有一句',
    `内容只该有一份，实际 ${JSON.stringify(root.textContent)}`,
  )
  assert.equal(execCommandCalls, 0, '粘贴落地后就不该再降级去 insertText（否则就是插两遍）')
})

test('输入框 ↑ 召回：不是输入框、带修饰键、输入法组合中，一律完全不介入', async () => {
  const { press, root } = await mountComposerRecall()
  const elsewhere = { getAttribute: () => null, parentElement: null }
  assert.equal((await press('ArrowUp', { target: elsewhere })).prevented, undefined, '别处按键不碰')
  assert.equal((await press('ArrowUp', { altKey: true })).prevented, undefined, '带修饰键让路')
  assert.equal((await press('ArrowUp', { ctrlKey: true })).prevented, undefined, '带 Ctrl 让路')
  assert.equal(
    (await press('ArrowUp', { isComposing: true })).prevented,
    undefined,
    '输入法组合中让路',
  )
  assert.equal((await press('ArrowRight')).prevented, undefined, '不是 ↑/↓ 不碰')
  assert.equal(root.textContent, '', '以上都不该写入任何内容')
})

test('输入框 ↑ 召回：拿不到历史（宿主没装 turnOutline 投影）时静默不启用', async () => {
  const mini = createMiniReact()
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) =>
      Promise.resolve({
        ok: true,
        value:
          endpoint === 'prompt-history'
            ? { available: false, sessionId: 'session-1', prompts: [] }
            : statusFixture(),
      }),
  })
  const root = {
    textContent: '',
    get innerText() {
      return this.textContent
    },
    getAttribute: () => 'true',
    parentElement: null,
    dispatchEvent: () => true,
  }
  bundle.windowStub.getSelection = () => ({
    rangeCount: 1,
    isCollapsed: true,
    focusNode: root,
    focusOffset: 0,
    removeAllRanges() {},
    addRange() {},
  })
  bundle.documentStub.createRange = () => ({
    selectNodeContents() {},
    cloneRange() {
      return this
    },
    setEnd() {},
    collapse() {},
    toString: () => '',
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  await store.loadPromptHistory('session-1')

  const event = {
    key: 'ArrowUp',
    target: root,
    prevented: undefined,
    preventDefault() {
      this.prevented = true
    },
    stopPropagation() {},
  }
  ;(bundle.listeners.get('keydown') ?? [])[0].listener(event)
  assert.equal(event.prevented, undefined, '没有历史就不该接管')
  assert.equal(root.textContent, '')
})
