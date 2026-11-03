/** Event identity selects a pose; elapsed time and stream token count never do. */
import type { RunningActivityView } from '../shared/running-activity.js'
import { RUNNING_CUES } from './running-cues.js'
import type { RunningCue, RunningGroup, WhaleAction } from './running-cues.js'

export type DisplayActivity = RunningActivityView & { sessionId?: string }

const GROUP_RULES: Array<[RegExp, RunningGroup]> = [
  [/^write_stdin$/i, 'shell'],
  [/^(apply_patch|edit|write|create_file|str_replace|patch)/i, 'edit'],
  [/^(bash|shell|exec|run|terminal|command|process)/i, 'shell'],
  [/^(web_search|web_fetch|fetch|browse|search_web|http)/i, 'search'],
  [/^(read|read_file|grep|glob|list|ls|search_data|inspect)/i, 'read'],
]
export function groupOfTool(name: string | null): RunningGroup {
  if (!name) return 'idle'
  if (/^(web|browser)[.:/]/i.test(name)) return 'search'
  name = name.replace(/^.*[.:/]/, '')
  for (const [pattern, group] of GROUP_RULES) if (pattern.test(name)) return group
  return 'other'
}

/**
 * 全库共用的表情池：30 个动作各出现一次，不按当前工具筛选。
 * 顺序是按"相邻两张语义拉得开"排的（思考 → 读写 → 搜索 → 工具 → 吃饭），
 * 免得连着两次新调用都看到很像的姿势。同一次调用内不换图，新调用才推进。
 */
export const ACTION_POOL: WhaleAction[] = [
  'thinking',
  'reading',
  'typing',
  'searching',
  'writing',
  'watching',
  'inspecting',
  'checking',
  'notes',
  'toolbox',
  'context',
  'flashlight',
  'map',
  'binoculars',
  'measuring',
  'sketching',
  'puzzle',
  'thread',
  'gears',
  'working',
  'connect',
  'ponder',
  'question',
  'rice_eating',
  'rice_notes',
  'rice_reading',
  'rice_terminal',
  'rice_ponder',
  'rice_cheeks',
  'butterfly',
]

const TOOL_TEXT: Record<RunningGroup, { zh: string; en: string }> = {
  idle: { zh: '正在执行工具', en: 'Running tool' },
  read: { zh: '正在读取文件', en: 'Reading files' },
  edit: { zh: '正在修改文件', en: 'Editing files' },
  shell: { zh: '正在执行命令', en: 'Running command' },
  search: { zh: '正在搜索资料', en: 'Searching' },
  other: { zh: '正在执行工具', en: 'Running tool' },
}
const PHASE_TEXT = {
  waiting: { zh: '等待模型响应', en: 'Waiting for model response' },
  thinking: { zh: '模型思考中', en: 'Model is reasoning' },
  responding: { zh: '正在生成回复', en: 'Generating response' },
  preparing: { zh: '正在准备工具调用', en: 'Preparing tool call' },
  approval: { zh: '等待用户确认', en: 'Waiting for confirmation' },
  error: { zh: '本轮发生错误', en: 'Turn failed' },
  working: { zh: '正在处理', en: 'Working' },
  idle: { zh: '本轮已结束', en: 'Turn ended' },
}

/** Group used both for the pose pool and for the playful second line. */
export function displayGroup(activity: DisplayActivity | null): RunningGroup {
  const phase = activity?.phase || 'working'
  if (phase === 'tool') return groupOfTool(activity?.toolName || null)
  return phase === 'responding' ? 'edit' : 'idle'
}

/**
 * Every phrase in the library, regardless of tool group. The aside is decoration,
 * not a status report, so it is not tied to what is currently running: the same
 * pool is used while reading, running a command, or waiting for the model.
 */
export const FUN_PHRASES: { zh: string; en: string }[] = (() => {
  const seen = new Set<string>()
  const picked: { zh: string; en: string }[] = []
  for (const cues of Object.values(RUNNING_CUES)) {
    for (const cue of cues) {
      const zh = cue.zh.trim()
      // Skip lines that restate an activity or repeat the official wording: beside
      // "正在读取文件", an "正在读文件" aside reads as a second factual claim.
      if (zh === '' || /^正在/.test(zh) || zh.includes('深度求索') || seen.has(zh)) continue
      seen.add(zh)
      picked.push({ zh, en: cue.en })
    }
  }
  return picked
})()

/**
 * Pick at random, never the one on screen. With a single entry (or an exhausted
 * pool) returning the same line is the only honest option.
 */
export function pickFunPhrase(
  pool: { zh: string; en: string }[],
  previous: string | null,
  random: () => number = Math.random,
): { zh: string; en: string } {
  if (pool.length === 0) return { zh: '', en: '' }
  if (pool.length === 1) return pool[0]
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length))
  const candidate = pool[index]
  if (candidate.zh !== previous) return candidate
  return pool[(index + 1) % pool.length]
}

/** 主文案只描述事实；表情由播放器按趣味短语的节拍推进，这里不决定图片。 */
export interface ActivityText {
  zh: string
  en: string
}

export function createActivitySelector(): (activity: DisplayActivity | null) => ActivityText {
  let sessionId: string | undefined
  return function (activity) {
    if (sessionId !== activity?.sessionId) sessionId = activity?.sessionId
    const phase = activity?.phase || 'working'
    const group = displayGroup(activity)
    return phase === 'tool' ? TOOL_TEXT[group] : PHASE_TEXT[phase]
  }
}
