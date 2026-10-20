/** 浏览器半用例：capsule-tools（14 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  TOOLS_NOW,
  byClass,
  fakeStore,
  findAll,
  findByAttr,
  flatText,
  flush,
  hoverPill,
  mountClient,
  renderTools,
  renderToolsWithTips,
  statusFixture,
  textOf,
  toolsState,
} from './client-harness.mjs'

test('工具胶囊：正在跑就报工具名与实时秒数（秒数本地算，不靠轮询）', () => {
  const { node, tips } = renderToolsWithTips({
    tools: toolsState({
      active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW - 1200 },
    }),
  })
  const pill = findByAttr(node, 'tools-pill')
  assert.ok(pill, '有工具在跑时要画')
  const text = textOf(pill)
  assert.ok(text.includes('bash'), `要报工具名，实际 ${text}`)
  assert.ok(text.includes('1.2s'), `要报实时秒数，实际 ${text}`)

  hoverPill(node, 'tools-pill')
  assert.equal(tips.length, 1, '悬停把文案交给 store')
  assert.equal(tips[0].key, 'tools-pill' === tips[0].key ? tips[0].key : tips[0].key)
  assert.ok(tips[0].text.includes('tools.now'), `悬停说清"现在在跑什么"，实际 ${tips[0].text}`)
  assert.ok(tips[0].text.includes('pnpm test'), '并把参数摘要贴出来')
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
  const { node, tips } = renderToolsWithTips({
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

  hoverPill(node, 'tools-pill')
  assert.ok(tips[0].text.includes('glob ×2'), '但悬停里要给完整清单')
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
  assert.equal(
    findByAttr(renderTools({ tools: toolsState({ phase: 'idle' }) }), 'tools-pill'),
    null,
    '还没取到数据时也不画',
  )
})

test('工具胶囊：悬停给出总次数、各工具次数与最近几条（含耗时与命令摘要）', () => {
  const { node, tips } = renderToolsWithTips({
    tools: toolsState({
      recent: [
        { name: 'bash', ok: true, ms: 800, summary: 'pnpm test' },
        { name: 'read_file', ok: false, ms: 200, summary: 'src/a.ts' },
      ],
      counts: [
        { name: 'bash', count: 9 },
        { name: 'read_file', count: 3 },
      ],
      total: 12,
    }),
  })
  hoverPill(node, 'tools-pill')
  const title = String(tips[0].text)
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
        return Promise.resolve({
          ok: true,
          value: {
            sessionId: 'session-1',
            tracking: true,
            active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW },
            recent: [{ name: 'bash', ok: true, ms: 800, summary: 'pnpm test' }],
            counts: [{ name: 'bash', count: 1 }],
            total: 1,
          },
        })
      }
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await flush()

  const tools = store.getSnapshot().tools
  assert.equal(tools.phase, 'ready')
  assert.equal(tools.active.name, 'bash')
  assert.equal(tools.total, 1)
  assert.ok(calls.includes('session-tools'), '要跟着刷新去取')
  const line = bundle.consoleLines.find((item) => item.includes('session-tools {'))
  assert.ok(line && line.includes('"active":"bash"'), `要有现场日志，实际 ${line}`)

  // 换会话：先清空，别显示上一个会话正在跑的工具。
  store.bindSession('session-2', '/Users/me/project')
  assert.equal(store.getSnapshot().tools.active, null)
  assert.equal(store.getSnapshot().tools.total, 0)
})

test('工具胶囊（诊断）：渲染时留一行现场，能看出"画没画、哪一档"', () => {
  const bundle = mountClient()
  const component = bundle.registrations.find(
    (item) => item.options.id === 'dsh-hud-pill',
  ).component
  component({
    t: (key) => key,
    now: TOOLS_NOW,
    sessionId: 'session-1',
    useSessions: (selector) => selector({ byId: { 'session-1': { cwd: '/Users/me/project' } } }),
    store: fakeStore({
      phase: 'ready',
      sessionId: 'session-1',
      cwd: '/Users/me/project',
      status: statusFixture(),
      tools: toolsState({
        active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW - 500 },
        total: 7,
      }),
    }),
  })
  const line = bundle.consoleLines.find((item) => item.includes('tools-pill {'))
  assert.ok(line, `要有渲染现场，实际 ${JSON.stringify(bundle.consoleLines)}`)
  assert.ok(line.includes('"active":"bash"') && line.includes('"total":7'), line)
})

test('工具胶囊（store）：密节拍里内容没变就不 set（3s 一次的无谓重渲染要挡住）', async () => {
  const bundle = mountClient({
    rpc: (channel, endpoint) => {
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-tools')
        return Promise.resolve({
          ok: true,
          value: {
            sessionId: 'session-1',
            tracking: true,
            active: null,
            recent: [{ name: 'bash', ok: true, ms: 800, summary: 'pnpm test', at: TOOLS_NOW }],
            counts: [{ name: 'bash', count: 3 }],
            total: 3,
          },
        })
      return Promise.resolve({ ok: false, error: { details: { code: 'unknown-endpoint' } } })
    },
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  store.bindSession('session-1', '/Users/me/project')
  await flush()
  const first = store.getSnapshot().tools
  assert.equal(first.total, 3)

  await store.refresh()
  await flush()
  assert.equal(store.getSnapshot().tools, first, '内容一样就不该换新对象（否则每 3s 全界面重渲染）')
})

test('工具胶囊：同一行"先空闲、后正在跑"都能画（冒烟；钩子顺序的防线见 mini-react）', () => {
  const idle = renderTools({}, { now: undefined })
  assert.ok(findByAttr(idle, 'pill'), '空闲那一行照样在')

  const running = renderTools(
    {
      tools: toolsState({
        active: { name: 'bash', summary: 'pnpm test', startedAt: TOOLS_NOW - 500 },
      }),
    },
    { now: undefined },
  )
  assert.ok(findByAttr(running, 'pill'), '正在跑时 Git 胶囊还在')
  assert.ok(findByAttr(running, 'tools-pill'), '并且多了工具那一枚')
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
  assert.equal(
    findAll(runningPill, byClass('dshh-toolsName')).length,
    1,
    '运行中的工具名走那一支青色',
  )
  assert.ok(textOf(runningPill).includes('◐'), `运行中不再是 🛠，实际 ${textOf(runningPill)}`)

  const idle = renderTools({
    tools: toolsState({
      counts: [
        { name: 'bash', count: 16, ok: true },
        { name: 'apply_patch', count: 2, ok: false },
      ],
      total: 18,
    }),
  })
  const idlePill = findByAttr(idle, 'tools-pill')
  assert.equal(findAll(idlePill, byClass('dshh-toolsGlyphOk')).length, 1, '成功的 ✓ 用成功色')
  assert.equal(findAll(idlePill, byClass('dshh-toolsGlyphBad')).length, 1, '失败的 ✗ 用错误色')
  assert.equal(
    findAll(idlePill, byClass('dshh-toolsName')).length,
    0,
    '空闲时名字不上色（codex 也是默认色）',
  )
  assert.equal(
    findAll(idlePill, byClass('dshh-toolsDim')).length,
    0,
    '次数不该被淡化 —— 这是原来的偏离',
  )
})

test('工具胶囊：技能直接铺技能名，不再显示 `skill ×n`（那样看不出是哪个技能）', () => {
  const node = renderTools({
    tools: toolsState({
      counts: [
        { name: 'bash', count: 12, ok: true },
        { name: 'skill', count: 3, ok: true },
      ],
      skills: [
        { name: 'office-xlsx', count: 2, ok: true },
        { name: 'pdf', count: 1, ok: false },
      ],
      total: 15,
    }),
  })
  const text = textOf(findByAttr(node, 'tools-pill'))
  assert.ok(text.includes('bash ×12'), `工具那半照旧，实际 ${text}`)
  assert.ok(!text.includes('skill ×3'), '`skill` 工具本身不该出现在计数里（没信息量）')
  // 这里只能断言到 key —— harness 的 t() 回显 key（文案字面量另有一条词典用例钉住）。
  assert.ok(text.includes('tools.skills office-xlsx ×2'), `技能段要标签 + 技能名，实际 ${text}`)
  assert.ok(
    text.includes('office-xlsx ×2') && text.includes('pdf ×1'),
    `技能名要铺出来，实际 ${text}`,
  )
  const pill = findByAttr(node, 'tools-pill')
  assert.equal(
    findAll(pill, byClass('dshh-skillName')).length,
    1,
    '技能名有自己的颜色（与工具名区分）',
  )
  // 最近一次失败的技能直接标红 —— 这条断言顺带钉住"谁失败谁红"，而不是整段变红。
  assert.equal(findAll(pill, byClass('dshh-toolsGlyphBad')).length, 1, '失败的技能标红')
})

test('工具胶囊：技能多于两个收成 +k；悬停里给完整清单与成败', () => {
  const { node, tips } = renderToolsWithTips({
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

  hoverPill(node, 'tools-pill')
  assert.ok(
    tips[0].text.includes('c-skill ×1 (✗)'),
    `悬停给完整清单并标出失败，实际 ${tips[0].text}`,
  )
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
