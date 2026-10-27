/** 浏览器半用例：contract（8 条）。共享设施见 client-harness.mjs。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMiniReact } from './mini-react.mjs'
import { loadBundle, mountClient, parseStylesheet, stylesheetText } from './client-harness.mjs'
import { readFileSync, readdirSync } from 'node:fs'

test('bundle 以 dsh.client 契约注册自己', () => {
  const { registry } = loadBundle()
  assert.equal(
    registry.definition.id,
    '@konnga/dsh-hud',
    '客户端模块 id 必须等于包名（参照插件同此约定：宿主按包名发模块并记账）',
  )
  assert.equal(typeof registry.definition.factory, 'function')
})

test('客户端插件面声明 apply 与三个硬依赖服务', () => {
  const { registry, requireModule } = loadBundle()
  const exported = registry.definition.factory(requireModule)
  assert.equal(typeof exported.apply, 'function')
  assert.deepEqual(exported.inject, ['slots', 'connection', 'locale'])
})

test('apply 注册七个座位：Git 胶囊（含计时与工具两枚）、悬停气泡、令牌面板、面板、轮尾图片条、⋯ 菜单摘要、悬停详情', () => {
  const { registrations } = mountClient()

  assert.equal(
    registrations.length,
    7,
    '应当注册七条座位 —— 工具与计时胶囊都在 Git 那一行里，不另注册',
  )
  const byId = Object.fromEntries(registrations.map((entry) => [entry.options.id, entry.options]))
  assert.deepEqual(Object.keys(byId).sort(), [
    'dsh-hud-panel',
    'dsh-hud-pill',
    'dsh-hud-pill-tip',
    'dsh-hud-session-hover',
    'dsh-hud-session-menu',
    'dsh-hud-token-panel',
    'dsh-hud-turn-images',
  ])
  assert.equal(
    byId['dsh-hud-pill-tip'].name,
    'shell.overlay',
    '气泡浮在 dock 行之外，才不被行内裁切',
  )
  assert.ok(byId['dsh-hud-pill-tip'].order < byId['dsh-hud-panel'].order, '面板开着时仍压在最上层')
  assert.ok(
    byId['dsh-hud-token-panel'].order > byId['dsh-hud-pill-tip'].order,
    '令牌面板盖住悬停气泡',
  )
  assert.ok(
    byId['dsh-hud-token-panel'].order < byId['dsh-hud-panel'].order,
    '但主面板仍然压在令牌面板之上',
  )
  const dockEntries = registrations.filter(
    (entry) => entry.options.name === 'conversation.input.dock',
  )
  assert.equal(
    dockEntries.length,
    1,
    'dock 是**竖列**：一条注册就是一整行。计时胶囊若单独注册会另起一行（工具胶囊当年就这么踩过），所以它必须由同一个占位画',
  )
})

test('词典：代码里用到的每个 key 在 zh / en 里都有值（漏一个就会把 key 显示给用户）', () => {
  // 词典取**真正注册进框架的那两份**（`apply` 里 locale.register 的参数），而不是正则扫源码：
  // 源码排版由 prettier 统一管，解析字面量太脆；源码扫描只留给 `t('…')` 的调用点。
  const { dictionaries } = mountClient()
  const registered = dictionaries.find(
    (item) => item.dictionary?.zh !== undefined && item.dictionary.en !== undefined,
  )
  assert.ok(registered, 'apply 应当把 zh / en 两份词典注册给 locale')
  const zh = registered.dictionary.zh
  const en = registered.dictionary.en

  // 代码里所有 t("...") / t('...') 的 key（跳过词典自身的字面量行）。
  // 前缀一个非标识符字符：否则 `createElement("button")` 里的 t 也会被当成 t("button")。
  const srcDir = new URL('../src/client/', import.meta.url)
  const source = readdirSync(srcDir, { recursive: true })
    .filter((name) => String(name).endsWith('.ts'))
    .map((name) => readFileSync(new URL(String(name).split('\\').join('/'), srcDir), 'utf8'))
    .join('\n')
  const used = new Set(
    [...source.matchAll(/(?:^|[^\w$])t\(\s*['"]([^'"]+)['"]\s*\)/gm)].map((match) => match[1]),
  )
  assert.ok(used.size > 20, `应当抽到足够多的 key，实际 ${String(used.size)}`)

  for (const key of used) {
    assert.ok(key in zh, `zh 缺少 ${key}`)
    assert.ok(key in en, `en 缺少 ${key}`)
    assert.notEqual(en[key], '', `en.${key} 不能是空串`)
  }
  // 两份词典的 key 集合必须一致（否则切语言会出现原始 key）。
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())

  // 动态 key 也要在（errorText 会按宿主半的 code 拼 key）。
  for (const key of [
    'err.timeout',
    'err.no-cwd',
    'err.git-missing',
    'err.invalid-cwd',
    'err.git-failed',
    'err.invalid-path',
    'err.stale-host',
    'err.transport',
    'commit.unknown',
  ]) {
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
  assert.ok(labels.includes('dsh-hud: account balance poll'))
  assert.ok(labels.includes('dsh-hud: provider balance poll'))
  // 四个 `setInterval` 节拍：面板 8s（跟着看的）、工具活动 3s（宿主是内存读，密一点才看得到
  // "正在跑"）、摘要 30s（只在悬停/⋯ 菜单里按需展示，没必要那么勤问 git）、
  // 账号余额 300s（打的是 DeepSeek 平台的网络，余额按分钟变，密了纯属浪费）。
  //
  // 模型来源余额那一路**不在这个列表里**：它改成了自适应 `setTimeout` 链 ——
  // 还没问出来时 1 秒重问（重启后宿主常常还没就绪，固定 30 秒会让胶囊空等半分钟），
  // 问出来之后才是 30 秒。这是刻意换掉的，不是漏了。
  assert.deepEqual(
    intervals.map((item) => item.ms).sort((left, right) => left - right),
    [3000, 8000, 30000, 300000],
  )
  assert.ok(listeners.has('focus'), '需要 focus 时补一次刷新')
})

test('自有样式表打上 DSH 的所有权标记，且被 HMR 记账删掉后能自愈', () => {
  const { styles, head, intervals, listeners, dispatch } = mountClient()

  // client-modules 靠 data-plugin 认领/清理样式：不打标就会被别的模块领走并删掉。
  assert.equal(
    styles[0].attributes['data-plugin'],
    '@konnga/dsh-hud',
    '值 = 客户端模块 id（= 包名），客户端运行器按它回收样式',
  )
  assert.equal(
    styles[0].attributes['data-plugin-css'],
    'dsh-hud/styles.css',
    '稳定 tag id，重复注入复用同一节点',
  )

  // 框架在 replace/invalidate/prune 里删掉整张表 —— 轮询周期要把它补回来。
  head.removeChild(styles[0])
  assert.equal(styles.length, 0, '先模拟框架把表删掉')

  intervals[0].callback()
  assert.equal(styles.length, 1, '下一个轮询周期补回样式表')
  assert.equal(
    styles[0].attributes['data-plugin'],
    '@konnga/dsh-hud',
    '值 = 客户端模块 id（= 包名），客户端运行器按它回收样式',
  )
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
    '.dshh-panel',
    '.dshh-dock',
    '.dshh-pill',
    '.dshh-body',
    '.dshh-chips',
    '.dshh-chip',
    '.dshh-sectionTitle',
    '.dshh-list',
    '.dshh-row',
    '.dshh-commits',
    '.dshh-commit',
    '.dshh-diff',
    '.dshh-difrow-hunk',
    '.dshh-grip',
    '.dshh-session',
    '.dshh-marker',
  ]
  const have = new Set(rules.map((rule) => rule.selector))
  const missing = expected.filter((selector) => !have.has(selector))
  assert.deepEqual(missing, [], `这些关键规则没解析出来：${JSON.stringify(missing)}`)

  assert.ok(rules.length >= 70, `规则数偏少（${rules.length}），像是被吞了`)
})

test('词典：技能标签是字面的 `skills:`（不翻译，与 `git:(` 同一套）', () => {
  // 同前：拿真正注册进 locale 的词典值（不扫源码字面量）。
  const { dictionaries } = mountClient()
  const registered = dictionaries.find(
    (item) => item.dictionary?.zh !== undefined && item.dictionary.en !== undefined,
  )
  assert.ok(registered, 'apply 应当把 zh / en 两份词典注册给 locale')
  const values = [
    registered.dictionary.zh['tools.skills'],
    registered.dictionary.en['tools.skills'],
  ]
  // 尾空格由渲染处补（`t('tools.skills') + ' '`），文案本身保持干净 —— 悬停那处本来就自己加空格。
  assert.deepEqual(
    values,
    ['skills:', 'skills:'],
    `中英两份都该是 "skills:"，实际 ${JSON.stringify(values)}`,
  )
})

test('自诊断：apply 那行报出跑着的这一版 CSS 里芯片间隔是多少', () => {
  const bundle = mountClient()
  const line = bundle.consoleLines.find((item) => item.includes('apply {'))
  assert.ok(line, `要有 apply 现场，实际 ${JSON.stringify(bundle.consoleLines)}`)
  assert.ok(line.includes('"chips":"6px 12px"'), `要报出真实值，实际 ${line}`)
})

test('工具活动那条 3 秒节拍真的接上了 store（回归：它曾调用作用域外的裸 loadTools）', async () => {
  const mini = createMiniReact()
  const calls = []
  const bundle = mountClient({
    ReactImpl: mini.React,
    rpc: (channel, endpoint) => {
      calls.push(endpoint)
      return Promise.resolve({
        ok: true,
        value:
          endpoint === 'session-tools'
            ? { phase: 'ready', active: null, recent: [], counts: [], skills: [], total: 0 }
            : statusFixture(),
      })
    },
  })
  const store = bundle.registrations
    .find((item) => item.options.id === 'dsh-hud-panel')
    .options.inject().store

  assert.equal(
    typeof store.loadTools,
    'function',
    'store 必须把 loadTools 暴露出来 —— 节拍就是靠它取数',
  )
  store.bindSession('session-1', '/Users/me/project') // 没绑会话时 loader 会提前返回，那就不算"跑过"了

  // 找出工具活动那条（3s）并真的跑一次它的回调：以前这里会抛 ReferenceError，
  // 被 setInterval 吞掉，所以"看起来正常、其实从来没跑过"。
  const polls = bundle.intervals.filter((item) => item.ms === 3000)
  assert.ok(
    polls.length >= 1,
    `应当注册 3 秒节拍，实际 ${JSON.stringify(bundle.intervals.map((i) => i.ms))}`,
  )
  for (const poll of polls) poll.callback()
  await new Promise((resolve) => setImmediate(resolve))
  assert.ok(
    calls.includes('session-tools'),
    `节拍跑起来就该去取工具活动，实际请求了 ${JSON.stringify(calls)}`,
  )
})
