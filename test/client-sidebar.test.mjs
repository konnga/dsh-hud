/** 浏览器半用例：sidebar（7 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  findByAttr,
  mountClient,
  overviewRow,
  overviewValue,
  renderMenuSummary,
  renderSeat,
  statusFixture,
  textOf,
} from './client-harness.mjs'

test('侧栏 chip（store）：一次批量取回并按 sessionId 索引，换会话不用重取', async () => {
  const calls = []
  const bundle = mountClient({
    rpc: (channel, endpoint) => {
      calls.push(endpoint)
      if (endpoint === 'status') return Promise.resolve({ ok: true, value: statusFixture() })
      if (endpoint === 'session-statuses') {
        return Promise.resolve({
          ok: true,
          value: overviewValue([overviewRow('session-1'), overviewRow('session-2', { mine: 0 })]),
        })
      }
      return Promise.resolve({ ok: true, value: statusFixture() })
    },
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store
  // 并发调用要合并成一次（定时器与手动刷新同时来的时候不该打两次）。
  await Promise.all([store.refreshRows(), store.refreshRows()])
  assert.equal(
    calls.filter((endpoint) => endpoint === 'session-statuses').length,
    1,
    '在途调用要合并（批量一次就够）',
  )

  // 之后再来一次是新的请求（数据要能更新）。
  await store.refreshRows()
  assert.equal(calls.filter((endpoint) => endpoint === 'session-statuses').length, 2)
  const rows = store.getSnapshot().rows
  assert.deepEqual(Object.keys(rows.byId).sort(), ['session-1', 'session-2'])
  assert.equal(rows.byId['session-1'].mine, 3)
})

test('侧栏悬停详情：分支/上游/计数/本会话改动都在；干净时如实说"干净"而不是整块不画', () => {
  const shown = renderSeat(
    'dsh-hud-session-hover',
    {
      phase: 'ready',
      cwd: '/Users/me/project',
      status: statusFixture(),
      rows: {
        phase: 'ready',
        byId: { 'session-1': overviewRow('session-1') },
        unavailable: false,
        truncated: false,
      },
    },
    {},
    { sessionId: 'session-1' },
  )
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
    counts: {
      modified: 0,
      added: 0,
      deleted: 0,
      renamed: 0,
      copied: 0,
      typeChanged: 0,
      untracked: 0,
      conflicted: 0,
    },
    mine: 0,
    possible: 0,
  })
  const hidden = renderSeat(
    'dsh-hud-session-hover',
    {
      phase: 'ready',
      cwd: '/Users/me/project',
      status: statusFixture(),
      rows: { phase: 'ready', byId: { 'session-1': clean }, unavailable: false, truncated: false },
    },
    {},
    { sessionId: 'session-1' },
  )
  const block2 = findByAttr(hidden, 'row-hover')
  assert.ok(block2, '干净时也该有（说清"干净"本身就是信息）')
  assert.ok(textOf(block2).includes('panel.clean'), '写明工作区干净')
  assert.ok(textOf(block2).includes('rows.ownNone'), '写明本会话没有改动记录')
})

test('⋯ 菜单摘要：两行说清"工作区怎么了"与"本会话改了什么"', () => {
  const node = renderMenuSummary({
    rows: {
      phase: 'ready',
      byId: { 'session-1': overviewRow('session-1') },
      unavailable: false,
      truncated: false,
    },
  })
  const readout = findByAttr(node, 'menu-readout')
  assert.ok(readout, '菜单里要有这条摘要')
  const text = textOf(readout)
  assert.ok(text.includes('main*'), `第一行是工作区：分支 + 脏标记，实际 ${text}`)
  assert.ok(text.includes('count.modified 2'), '第一行带上分类型计数')
  assert.ok(text.includes('session.pill'), '第二行是"本会话改过几个"')
  assert.ok(text.includes('rows.possible'), '第二行带上"可能相关"')
  assert.equal(String(readout.props.title), '/Users/me/project', '工作区名自己那一段仍给完整路径')
})

test('⋯ 菜单摘要：干净且本会话没改过时，明说"干净"与"没有改动记录"，而不是消失', () => {
  const clean = overviewRow('session-1', {
    dirty: false,
    counts: {
      modified: 0,
      added: 0,
      deleted: 0,
      renamed: 0,
      copied: 0,
      typeChanged: 0,
      untracked: 0,
      conflicted: 0,
    },
    mine: 0,
    possible: 0,
  })
  const node = renderMenuSummary({
    rows: { phase: 'ready', byId: { 'session-1': clean }, unavailable: false, truncated: false },
  })
  const readout = findByAttr(node, 'menu-readout')
  assert.ok(readout, '干净时也要在（"这里没有东西"本身是信息，消失会让人以为功能没做）')
  assert.ok(textOf(readout).includes('panel.clean'))
  assert.ok(textOf(readout).includes('rows.ownNone'))
})

test('⋯ 菜单摘要：没有这个会话的数据时整条不画（其余情况照常显示）', () => {
  const rows = {
    phase: 'ready',
    byId: { 'session-1': overviewRow('session-1') },
    unavailable: false,
    truncated: false,
  }
  assert.ok(findByAttr(renderMenuSummary({ rows }), 'menu-readout'), '有数据就显示')
  assert.equal(
    findByAttr(
      renderMenuSummary({
        rows: { phase: 'ready', byId: {}, unavailable: false, truncated: false },
      }),
      'menu-readout',
    ),
    null,
    '没有这个会话的数据时整条不画',
  )
})

test('⋯ 菜单摘要：非仓库目录也能用（本会话改动与 git 无关）', () => {
  const node = renderMenuSummary({
    rows: {
      phase: 'ready',
      byId: { 'session-1': overviewRow('session-1', { repo: false, counts: null, mine: 2 }) },
      unavailable: false,
      truncated: false,
    },
  })
  const text = textOf(findByAttr(node, 'menu-readout'))
  assert.ok(text.includes('rows.noRepo'), '说清不在仓库里')
  assert.ok(text.includes('session.pill'), '本会话改动照报')
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

  const hoverNode = renderSeat(
    'dsh-hud-session-hover',
    {
      phase: 'ready',
      sessionId: 'session-1',
      cwd: '/Users/me/project',
      rows: rows,
    },
    {},
    { sessionId: 'session-1' },
  )
  const hover = textOf(findByAttr(hoverNode, 'row-hover'))
  assert.ok(hover.includes('n=3') && hover.includes('now=1'), `悬停卡片同样两个数，实际 ${hover}`)
})
