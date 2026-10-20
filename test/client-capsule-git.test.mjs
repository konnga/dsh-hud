/** 浏览器半用例：capsule-git（13 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  T,
  byClass,
  fakeStore,
  findAll,
  findByAttr,
  flatText,
  hoverPill,
  mountClient,
  renderPill,
  sessionOf,
  statusFixture,
  stylesheetText,
  textOf,
} from './client-harness.mjs'

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
  const text = textOf(
    renderPill({
      status: statusFixture({
        counts: {
          modified: 4,
          added: 0,
          deleted: 2,
          renamed: 1,
          copied: 0,
          typeChanged: 0,
          untracked: 3,
          conflicted: 1,
        },
      }),
    }),
  )
  assert.ok(
    flatText(
      renderPill({
        status: statusFixture({
          counts: {
            modified: 4,
            added: 0,
            deleted: 2,
            renamed: 1,
            copied: 0,
            typeChanged: 0,
            untracked: 3,
            conflicted: 1,
          },
        }),
      }),
    ).endsWith('git:(main*)↑1↓2M4D2R1?3!1'),
    '简写符顺序与内容',
  )
})

test('胶囊：悬停给出完整信息（路径、上游、各类型计数）—— 走自己画的气泡，不靠原生 title', () => {
  const tips = []
  const node = renderPill(
    {},
    { methods: { showTip: (key, text, rect) => tips.push({ key, text, rect }) } },
  )
  hoverPill(node, 'pill', { left: 100, top: 300, right: 190 })

  assert.equal(tips.length, 1, '悬停应当把文案交给 store（由 overlay 里那枚气泡座位画）')
  assert.equal(tips[0].key, 'pill')
  assert.deepEqual(tips[0].rect, { left: 100, top: 300, right: 190 }, '锚点用胶囊自己的矩形')
  const lines = tips[0].text.split('\n')
  assert.equal(lines[0], 'pill.title')
  assert.equal(lines[1], '/Users/me/project')
  assert.ok(lines[2].includes('main') && lines[2].includes('origin/main'), '上游分支')
  assert.ok(
    lines[3].includes('count.modified 2') && lines[3].includes('count.untracked 1'),
    '各类型计数',
  )
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
  assert.ok(
    dockRule.includes('max-width:calc(var(--dsh-composer-card-max-width'),
    '必须跟输入卡片的最大宽度对齐',
  )
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
  const text = textOf(
    renderPill({
      status: statusFixture({
        dirty: false,
        ahead: 0,
        behind: 0,
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
      }),
    }),
  )
  assert.ok(
    flatText(
      renderPill({
        status: statusFixture({
          dirty: false,
          ahead: 0,
          behind: 0,
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
        }),
      }),
    ).endsWith('git:(main)'),
    '干净仓库',
  )
})

test('胶囊：非仓库、读取中、失败三种状态各有文案', () => {
  assert.ok(textOf(renderPill({ status: { repo: null } })).includes('pill.notRepo'))
  assert.ok(textOf(renderPill({ phase: 'loading', status: null })).includes('pill.loading'))
  assert.ok(
    textOf(renderPill({ phase: 'error', errorCode: 'timeout', status: null })).includes(
      'pill.error',
    ),
  )
})

test('胶囊：未绑定工作区或不是主视图时不渲染', () => {
  const { components } = mountClient()
  const base = {
    t: T,
    sessionId: 'session-1',
    store: fakeStore({
      phase: 'loading',
      sessionId: 'session-1',
      cwd: null,
      panelOpen: false,
      status: null,
    }),
  }

  const withoutCwd = components['dsh-hud-pill']({
    ...base,
    useSessions: (selector) => selector({ byId: { 'session-1': {} } }),
  })
  assert.equal(withoutCwd, null, '没有 cwd 就不该有胶囊')

  const embedded = components['dsh-hud-pill']({
    ...base,
    useSessions: (selector) =>
      selector({ byId: { 'session-1': { cwd: '/x', retainedBy: { mainView: 0 } } } }),
  })
  assert.equal(embedded, null, '右栏嵌入式会话（子会话 chat）不驱动共享面板')
})

test('胶囊：最前面是工作区名（cwd 的目录名），与分支用 `·` 隔开', () => {
  const text = textOf(renderPill())
  assert.ok(
    text.startsWith('project · git:('),
    `工作区名要在最前、且带分隔，实际 ${JSON.stringify(text)}`,
  )
  const tips = []
  const node = renderPill({}, { methods: { showTip: (key, text) => tips.push(text) } })
  hoverPill(node, 'pill')
  assert.ok(tips[0].includes('/Users/me/project'), '悬停里仍给完整路径（名字只是短标签）')
})

test('胶囊：工作区名过长从中间省略，不吃掉分支的位置', () => {
  const long = '/Users/me/' + 'x'.repeat(40) + '-tail'
  // 注意：胶囊的 cwd 来自 `useSessions` 快照，不是 state —— 要覆盖得走 sessionOf()。
  const text = flatText(renderPill({}, sessionOf(long)))
  assert.ok(text.includes('…'), `要省略，实际 ${JSON.stringify(text)}`)
  assert.ok(text.endsWith('git:(main*)↑1↓2M2A1?1'), '分支摘要必须完整（去空格后比）')
  const name = text.slice(0, text.indexOf('·')) // flatText 后分隔符两侧的空格也去掉了
  assert.ok(name.length <= 20, `工作区名不该超过 20 字符，实际 ${name.length}`)
})

test('胶囊：不是仓库（或还在读取）时也显示工作区名 —— 那是工作区的事，与 git 无关', () => {
  const outside = textOf(renderPill({ status: { repo: null } }))
  assert.ok(
    outside.startsWith('project · git:('),
    `非仓库时也要有名字，实际 ${JSON.stringify(outside)}`,
  )
  const loading = textOf(renderPill({ status: null }))
  assert.ok(loading.startsWith('project · git:('), `读取中也一样，实际 ${JSON.stringify(loading)}`)
})

test('胶囊：cwd 为空或就是根目录时，不画名字也不画那个分隔符', () => {
  const none = textOf(renderPill({}, sessionOf(null)))
  assert.ok(!none.includes(' · git:('), `没有 cwd 就别画空名字，实际 ${JSON.stringify(none)}`)
  const root = textOf(renderPill({}, sessionOf('/')))
  assert.ok(!root.includes(' · git:('), `根目录也算不出名字，实际 ${JSON.stringify(root)}`)
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
  for (const rule of [
    '.dshh-gitWrap',
    '.dshh-branch',
    '.dshh-ahead',
    '.dshh-workspace',
    '.dshh-toolsName',
  ]) {
    assert.ok(css.includes(rule), `${rule} 规则要在样式表里`)
  }
  assert.ok(/\.dshh-gitWrap\{[^}]*--dsh-hud-magenta/.test(css), 'git:( 用品红变量')
  assert.ok(/\.dshh-branch\{[^}]*--dsh-hud-cyan/.test(css), '分支用青变量')
})
