/**
 * 输入框上方那一行里的胶囊：分支摘要 / 非 git 仓库，点击开关面板；
 * 含两枚工具胶囊、技能清单与悬停气泡的锚点。
 */

import React from 'react'

import { balancePillNode } from './balance-pill.js'
import { branchLabel, countShorthands, fullWhen, shortBranch, workspaceNameOf } from '../format.js'
import { useStore } from '../hooks/use-store.js'
import type {
  HudState,
  HudStatusCounts,
  HudStore,
  HudToolActive,
  TipLine,
  ToolsState,
  Translate,
} from '../shared.js'
import {
  COUNT_COLOR,
  COUNT_ORDER,
  SKILLS_SHOWN,
  emphasize,
  formatDuration,
  h,
  probe,
  sessionChangeView,
} from '../shared.js'

/**
 * 框架 `useSessions` 快照里本插件用到的会话摘要字段（等 shared 收尾后视需要上提）。
 */
export interface SessionSummaryLike {
  cwd?: string | null
  /** 这个会话被哪些视图保留着；`mainView` 为 0 时说明它在内嵌的子会话里。 */
  retainedBy?: { mainView?: number | null } | null
}

/** `useSessions` 快照的子集：只用到按 sessionId 索引的那张表。 */
export interface SessionsSnapshotLike {
  byId?: Record<string, SessionSummaryLike>
}

/** 框架给座位的选择器 hook：选择器参数是必需的。 */
export type UseSessions = <T>(selector: (snapshot: SessionsSnapshotLike) => T) => T

/** `HudDockPill` 的 props：store + 框架注入的会话作用域信息。 */
export interface HudDockPillProps {
  t?: Translate
  /** 当前会话（座位按会话作用域注入）。 */
  sessionId?: string | null
  useSessions: UseSessions
  store: HudStore
  /** 测试/调试用：固定"现在"，省得等本地计时器。 */
  now?: number
}

/** 工具胶囊的选项。 */
export interface ToolPillOptions {
  t: Translate
  store: HudStore
  now: number
}

/** 计时胶囊的选项。 */
export interface TimerPillOptions {
  t: Translate
  store: HudStore
  sessionId: string | null | undefined
  now: number
}

export function HudDockPill(props: HudDockPillProps): React.ReactElement | null {
  var t: Translate =
    props.t ||
    function (key: string) {
      return key
    }
  var sessionId = props.sessionId
  var useSessions = props.useSessions
  var store = props.store

  // useSessions 是选择器 hook：选择器参数是必需的，裸调用会以
  // "selector is not a function" 崩掉。
  var sessions = useSessions(function (snapshot) {
    return snapshot
  })
  var summary =
    typeof sessionId === 'string' && sessions && sessions.byId
      ? sessions.byId[sessionId]
      : undefined
  var cwd = summary ? summary.cwd : undefined

  // 右栏里的嵌入式会话（子会话 chat）自带会话绑定；只有主视图座位可以驱动共享
  // 面板，否则一个子会话会把它下面的仓库从用户正在看的会话下抽走。
  // 快照不带这个计数（更旧的宿主）时按主视图放行，胶囊不会因此消失。
  var mainView = !summary || !summary.retainedBy ? true : (summary.retainedBy.mainView || 0) > 0

  var state = useStore(store)

  /**
   * 工具胶囊的"实时秒数"滴答。
   *
   * **必须在组件体里、无条件、固定顺序地调用**：早先放在普通函数 `toolPillNode` 里、还带
   * `if (now === undefined)` 的条件，就是条件钩子 —— React 会抛错，导致整行 dock 渲染失败，
   * 两枚胶囊一起消失（用户实测"胶囊都不显示了"）。回调里再判断要不要开定时器就没这问题。
   */
  var tick = React.useState(Date.now())
  var tickSet = tick[1]
  var toolsTickKey =
    state.tools && state.tools.active !== null && state.tools.active !== undefined
      ? String(state.tools.active.callId)
      : null
  // 会话计时 + 输入框 ↑ 召回的数据（两个 loader 各自带 TTL，这里按最密的节奏问就行）。
  React.useEffect(
    function () {
      if (typeof sessionId !== 'string') return undefined
      // 闭包里用局部常量保住上面的收窄（`var` 变量在回调里 TS 不再保留）。
      const id = sessionId
      var load = function () {
        if (store.loadSessionTime !== undefined) store.loadSessionTime(id)
        if (store.loadPromptHistory !== undefined) store.loadPromptHistory(id)
      }
      // 换了会话就换了账本：余额胶囊要跟着会话的模型来源走（中转站 / 官方 Key / 平台账号）。
      if (store.loadProviderBalance !== undefined) store.loadProviderBalance()
      load()
      var poll = window.setInterval(load, 3000)
      return function () {
        window.clearInterval(poll)
      }
    },
    [sessionId],
  )

  // 挂钟每 4 秒跳一次：计时胶囊的显示粒度是分钟，但跨分钟不用等下一次取数。
  React.useEffect(function () {
    var clock = window.setInterval(function () {
      tickSet(Date.now())
    }, 4000)
    return function () {
      window.clearInterval(clock)
    }
  }, [])

  React.useEffect(
    function () {
      if (toolsTickKey === null) return undefined
      var timer = window.setInterval(function () {
        tickSet(Date.now())
      }, 500)
      return function () {
        window.clearInterval(timer)
      }
    },
    [toolsTickKey],
  )

  React.useEffect(
    function () {
      if (!mainView) return
      store.bindSession(sessionId, cwd)
    },
    [sessionId, cwd, mainView, store],
  )

  if (!cwd || !mainView || state.sessionId !== sessionId) return null

  // 会话归因的胶囊段：只有"确实改过东西"时才露头（没数据 / 0 个都不显示）。
  var sessionView = sessionChangeView(state)
  var sessionSegment =
    sessionView !== null && sessionView.mineCount > 0
      ? ' │ ●' + String(sessionView.mineCount)
      : null

  var children: React.ReactNode[] = []
  // 工作区名放在最前、且与分支用 `·` 隔开：写成 `git:(dsh-hud/main*)` 会被读成"分支叫 dsh-hud/main"。
  // 三种"非仓库"状态也带上它 —— 工作区跟 git 没关系，没仓库时它反而更有用。
  var workspace = workspaceNameOf(cwd)
  if (workspace !== null) {
    children.push(h('span', { key: 'workspace', className: 'dshh-workspace' }, workspace))
    children.push(h('span', { key: 'workspaceSep', className: 'dshh-workspaceSep' }, ' · '))
  }
  if (state.phase === 'error') {
    children.push(
      h('span', { key: 'gitWraperr', className: 'dshh-gitWrap' }, 'git:(' + t('pill.error') + ')'),
    )
  } else if (state.phase === 'loading' || state.phase === 'idle') {
    children.push(
      h(
        'span',
        { key: 'gitWrapload', className: 'dshh-gitWrap' },
        'git:(' + t('pill.loading') + ')',
      ),
    )
  } else if (!state.status || !state.status.repo) {
    children.push(
      h(
        'span',
        { key: 'gitWrapnorepo', className: 'dshh-gitWrap' },
        'git:(' + t('pill.notRepo') + ')',
      ),
    )
  } else {
    var status = state.status
    // `git:(branch*)` —— codex-hud 的 gitSegment 就是这么拼的，配色也照它：
    // `git:(` 与 `)` 品红（colors.git）、分支名与 ↑↓ 青（colors.gitBranch），
    // 而 `*` 在括号**里面**、与分支名同色。
    children.push(h('span', { key: 'gitOpen', className: 'dshh-gitWrap' }, 'git:('))
    children.push(
      h(
        'span',
        { key: 'branch', className: 'dshh-branch' },
        shortBranch(branchLabel(status, t)) + (status.dirty ? '*' : ''),
      ),
    )
    children.push(h('span', { key: 'gitClose', className: 'dshh-gitWrap' }, ')'))
    if (status.ahead > 0)
      children.push(
        h('span', { key: 'ahead', className: 'dshh-ahead' }, ' ↑' + String(status.ahead)),
      )
    if (status.behind > 0)
      children.push(
        h('span', { key: 'behind', className: 'dshh-ahead' }, ' ↓' + String(status.behind)),
      )

    // 简写符：只列非零项，按固定顺序，各自上色（M 黄 / A 绿 / D 红 / ? 灰 …）。
    // 与侧栏行内 chip 共用 `countShorthands` —— 两处各写一套算法一定会漂。
    var shorthands = countShorthands(status.counts)
    for (var index = 0; index < shorthands.length; index += 1) {
      children.push(' ')
      children.push(
        h(
          'span',
          {
            key: shorthands[index].key,
            style: { color: COUNT_COLOR[shorthands[index].key] },
          },
          shorthands[index].mark + String(shorthands[index].value),
        ),
      )
    }
  }

  if (sessionSegment !== null) children.push(sessionSegment)

  // 悬停给出完整信息：总数型的托盘里放不下细节，这里补齐。
  // 读数（数字）要高亮，但路径、分支名、上游名这些不该染 —— 所以逐行决定怎么切段。
  var titleLines: TipLine[] = [{ text: t('pill.title'), tone: 'muted' }]
  if (sessionView !== null) {
    titleLines.push({
      segments: emphasize(t('session.pill', { n: String(sessionView.mineCount) }), [
        String(sessionView.mineCount),
      ]),
    })
  }
  // cwd 是路径不是读数：整行次要色（染路径等于满行是色）。
  if (cwd) titleLines.push({ text: cwd, tone: 'muted' })
  if (state.status && state.status.repo) {
    var tip = branchLabel(state.status, t)
    if (state.status.upstream) tip += ' · ' + t('panel.upstream') + ' ' + state.status.upstream
    titleLines.push({ text: tip })
    var labels: string[] = []
    var countReadings: string[] = []
    var counts2: Partial<HudStatusCounts> = state.status.counts || {}
    for (var i2 = 0; i2 < COUNT_ORDER.length; i2 += 1) {
      var k2 = COUNT_ORDER[i2]
      var v2 = counts2[k2] || 0
      if (v2 > 0) {
        labels.push(t('count.' + k2) + ' ' + String(v2))
        countReadings.push(String(v2))
      }
    }
    if (labels.length > 0) {
      // 领先/落后那两个数也要高亮，所以和改动计数一起交给 `emphasize`。
      var aheadBehind = aheadBehindReadings(state.status)
      titleLines.push({
        segments: emphasize(labels.join(' · '), countReadings.concat(aheadBehind)),
      })
    }
  }

  // 外层容器复刻框架自己的 dock 行几何（见 queue 公告）：仅靠胶囊自身对齐，
  // 胶囊会飘到整栏的最左边，而输入卡片是居中的。
  return h(
    'div',
    { className: 'dshh-dock', 'data-dsh-hud': 'dock' },
    h(
      'button',
      Object.assign(
        {
          type: 'button',
          className: 'dshh-pill',
          'data-dsh-hud': 'pill',
          'aria-expanded': state.panelOpen ? 'true' : 'false',
          style: { color: state.panelOpen ? 'var(--dsw-alias-brand-primary, #4b8bf5)' : undefined },
          onClick: function () {
            store.togglePanel()
          },
        },
        store.tipHandlers('pill', function () {
          return titleLines
        }),
      ),
      children,
    ),
    // 工具活动那一枚并排在后面 —— dock 是竖列，独立注册会另起一整行（用户实测"换行了"）。
    toolPillNode(state, { t: t, store: store, now: props.now === undefined ? tick[0] : props.now }),
    // 余额在计时之前：余额是会变的"钱"，计时是一直在涨的时长 —— 让读数靠前、节拍感靠后。
    // 读不到时 `balancePillNode` 自己回 null（不占位）。
    balancePillNode(state, { t: t, store: store }),
    // 计时胶囊放在**最后**（几枚同在一条注册里 → 同一行；独立注册会另起一整行）。
    timerPillNode(state, {
      t: t,
      store: store,
      sessionId: sessionId,
      now: props.now === undefined ? tick[0] : props.now,
    }),
  )
}

export function toolPillNode(state: HudState, options: ToolPillOptions): React.ReactElement | null {
  var t = options.t
  var tools = state.tools
  if (!tools || (tools.active === null && tools.total === 0)) return null
  var now = options.now

  var children: React.ReactNode[] = []
  if (tools.active !== null) {
    // 配色对齐 codex-hud 的 activity-lines：`◐` 黄 + 工具名青 + 目标/耗时用默认正文色。
    var elapsed = toolElapsedLabel(tools.active, now)
    children.push(
      h('span', { key: 'glyph', className: 'dshh-toolsGlyph dshh-toolsGlyphRun' }, '\u25d0'),
    )
    children.push(
      h(
        'span',
        { key: 'name', className: 'dshh-toolsName' },
        ' ' + String(tools.active.name === undefined ? '?' : tools.active.name),
      ),
    )
    // 带上参数摘要（codex-hud 就是 `◐ exec_command: pnpm test`）—— 技能调用因此能看出是哪个技能。
    if (typeof tools.active.summary === 'string' && tools.active.summary.length > 0) {
      children.push(': ' + tools.active.summary)
    }
    if (elapsed !== null) children.push(' ' + elapsed)
  } else {
    // 空闲时把**每个工具各自几次**铺出来（codex-hud 那条 `Tools:` 就是这么给的）：
    // `✓ bash ×16 │ ✓ apply_patch ×6 │ ✗ write_stdin ×3`。名字与数字贴在一起，
    // 就不会再有"×54 是总数还是这个工具的次数"那种误读。
    //
    // 最多铺 3 个（按次数排序，宿主已经排好），其余收成 `+k` —— 悬停里有完整清单与最近几条。
    // `skill` 工具本身对用户没信息量（`skill ×2` 说明不了是哪个技能）—— codex-hud 也是直接列技能名。
    // 所以把它从计数里剔掉，改由下面那段技能清单承担；总次数不受影响。
    var toolCounts = tools.counts.filter(function (item) {
      return item.name !== 'skill'
    })
    var shown = toolCounts.slice(0, 3)
    for (var i = 0; i < shown.length; i += 1) {
      var item = shown[i]
      var bad = item.ok === false
      if (i > 0) children.push(' \u2502 ')
      children.push(
        h(
          'span',
          {
            key: 'glyph' + String(i),
            className: 'dshh-toolsGlyph' + (bad ? ' dshh-toolsGlyphBad' : ' dshh-toolsGlyphOk'),
          },
          bad ? '\u2717' : '\u2713',
        ),
      )
      children.push(' ' + String(item.name) + ' \u00d7' + String(item.count))
    }
    // 技能清单：名字直接铺出来（"会话用了哪些 skill"要能一眼看到，不只是次数）。
    // 标签用字面的 `skills:`（不翻译）—— 与 `git:(` 同一套：它是约定写法，不是描述。
    var skills = tools.skills || []
    if (skills.length > 0) {
      if (children.length > 0) children.push(' \u2502 ')
      children.push(t('tools.skills') + ' ')
      for (var k = 0; k < skills.length && k < SKILLS_SHOWN; k += 1) {
        if (k > 0) children.push(' \u00b7 ')
        children.push(
          h(
            'span',
            {
              key: 'skill' + String(k),
              className: skills[k].ok === false ? 'dshh-toolsGlyphBad' : 'dshh-skillName',
            },
            String(skills[k].name) + ' \u00d7' + String(skills[k].count),
          ),
        )
      }
      if (skills.length > SKILLS_SHOWN) children.push(' +' + String(skills.length - SKILLS_SHOWN))
      if (tools.skillsDropped > 0) children.push(' +' + String(tools.skillsDropped))
    }
    if (toolCounts.length > shown.length)
      children.push(' +' + String(toolCounts.length - shown.length))
  }

  // 渲染现场：画没画、画的是哪一档（与 row-chip/row-token 同一套排查手段）。
  probe.log('tools-pill', {
    active: tools.active === null ? null : String(tools.active.name),
    total: tools.total,
  })
  return h(
    'span',
    Object.assign(
      {
        className: 'dshh-pill dshh-toolsPill',
        'data-dsh-hud': 'tools-pill',
        key: 'tools',
      },
      options.store.tipHandlers('tools-pill', function () {
        return toolsTitle(tools, t)
      }),
    ),
    children,
  )
}

export function timerPillNode(
  state: HudState,
  options: TimerPillOptions,
): React.ReactElement | null {
  var t = options.t
  var sessionId = options.sessionId
  var now = options.now
  var snapshot = state.sessionTime
  var value =
    snapshot !== null && snapshot !== undefined && snapshot.sessionId === sessionId
      ? snapshot.value
      : null
  // 会话不在（还没恢复进存储、已归档、子会话已回收）、宿主服务缺失：不画这枚胶囊，也不占位。
  if (value === null || value.available !== true) return null
  var createdAt = value.createdAt
  if (typeof createdAt !== 'number') return null

  var age = Math.max(0, now - createdAt)
  // 整句话不变（用户没要求改排版），只把里面的**读数**挑出来高亮：
  // 创建时间留灰（时间戳染上就等于满屏是色，重点反而没了），时长/轮/步上色。
  var readings: string[] = []
  var hints: string[] = [t('timer.title'), t('timer.created', { time: fullWhen(createdAt) })]
  if (typeof value.llmMs === 'number' && typeof value.toolMs === 'number') {
    var llmText = formatDuration(value.llmMs)
    var toolText = formatDuration(value.toolMs)
    readings.push(llmText, toolText)
    hints.push(t('timer.work', { llm: llmText, tool: toolText }))
  }
  if (typeof value.turns === 'number' && typeof value.steps === 'number') {
    readings.push(String(value.turns), String(value.steps))
    hints.push(t('timer.turns', { turns: String(value.turns), steps: String(value.steps) }))
  }
  probe.log('timer-pill', { age: Math.round(age / 60000) })
  var tipKey = 'session-timer'
  return h(
    'span',
    Object.assign(
      {
        className: 'dshh-pill dshh-timer',
        'data-dsh-hud': 'session-timer',
        key: 'timer',
      },
      options.store.tipHandlers(tipKey, function () {
        // 一句一行、用 `·` 连起来（原样式），只把数字染成强调色。
        return [{ segments: emphasize(hints.join(' · '), readings) }]
      }),
    ),
    [
      h('span', { key: 'glyph', className: 'dshh-timerGlyph' }, '⏱'),
      h('span', { key: 'value', className: 'dshh-timerValue' }, formatDuration(age)),
    ],
  )
}

export function toolsTitle(tools: ToolsState, t: Translate): TipLine[] {
  // 每一行都是"一句白话里夹着读数"：句式不动，只把**数字**挑出来高亮。
  var readings: string[] = []
  function countUnit(): void {
    readings.push(String(tools.total))
  }
  var lines: TipLine[] = []
  if (tools.active !== null) {
    lines.push({ text: t('tools.now', { name: String(tools.active.name) }), tone: 'muted' })
    if (typeof tools.active.summary === 'string' && tools.active.summary.length > 0)
      lines.push({ text: tools.active.summary, tone: 'muted' })
  }
  var totalText = t('tools.total', { n: String(tools.total) })
  countUnit()
  lines.push({ segments: emphasize(totalText, readings) })
  if (tools.counts.length > 0) {
    var byTool = t('tools.byTool') + ' '
    lines.push({
      segments: emphasize(
        byTool +
          tools.counts
            .map(function (item) {
              return String(item.name) + ' \u00d7' + String(item.count)
            })
            .join(' \u00b7 '),
        tools.counts.map(function (item) {
          return '\u00d7' + String(item.count)
        }),
      ),
    })
  }
  if (tools.skills && tools.skills.length > 0) {
    lines.push({
      segments: emphasize(
        t('tools.skills') +
          ' ' +
          tools.skills
            .map(function (item) {
              return (
                String(item.name) +
                ' \u00d7' +
                String(item.count) +
                (item.ok === false ? ' (\u2717)' : '')
              )
            })
            .join(' \u00b7 '),
        tools.skills.map(function (item) {
          return '\u00d7' + String(item.count)
        }),
      ),
    })
  }
  var recent = tools.recent.slice(0, 3)
  if (recent.length > 0) {
    lines.push({ text: t('tools.recent'), tone: 'muted' })
    var recentReadings: string[] = []
    for (var at = 0; at < recent.length; at += 1) {
      var entry = recent[at]
      var mark = entry.ok === false ? '\u2717' : '\u2713'
      var ms = typeof entry.ms === 'number' ? ' ' + (entry.ms / 1000).toFixed(1) + 's' : ''
      if (ms !== '') recentReadings.push(ms.trim())
      var summary =
        typeof entry.summary === 'string' && entry.summary.length > 0
          ? ' \u00b7 ' + entry.summary
          : ''
      lines.push({
        segments: emphasize(mark + ' ' + String(entry.name) + ms + summary, recentReadings),
      })
    }
  }
  return lines
}

/**
 * `↑2 ↓1` 这类领先/落后标记里的数字（给悬停高亮用）。
 *
 * 直接扫字符串而不是重算一遍 git 语义：这里要的只是"已经画出去的那几个数"。
 */
function aheadBehindReadings(status: { ahead?: number; behind?: number }): string[] {
  var out: string[] = []
  if (typeof status.ahead === 'number' && status.ahead > 0) out.push(String(status.ahead))
  if (typeof status.behind === 'number' && status.behind > 0) out.push(String(status.behind))
  return out
}

export function toolElapsedLabel(active: HudToolActive | null, now: number): string | null {
  if (active === null || typeof active !== 'object') return null
  if (typeof active.startedAt !== 'number') return null
  var seconds = Math.max(0, (now - active.startedAt) / 1000)
  return seconds < 10 ? seconds.toFixed(1) + 's' : String(Math.round(seconds)) + 's'
}
