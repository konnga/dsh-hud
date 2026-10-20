import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile as writeFileAt } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test as nodeTest } from 'node:test'
import { CHANNEL } from '../lib/host/index.js'
import { mount as mountHost, rpcCall } from './helpers.mjs'

/**
 * 每个用例结束都拆掉自己挂的宿主半。
 *
 * 插件里有**模块级**状态（记录表、回合读取器…）——真实里整个进程只有一份实例，这是对的；
 * 但测试里必须逐个用例隔离，否则"上一个用例装上、下一个用例还留着"会造出假阴性/假阳性。
 */
const mountedBundles = []
function mount(options = {}) {
  const bundle = mountHost(options)
  mountedBundles.push(bundle)
  return bundle
}
function test(name, fn) {
  nodeTest(name, async (t) => {
    const before = mountedBundles.length
    t.after(() => {
      for (const bundle of mountedBundles.splice(before)) {
        for (const cleanup of bundle.cleanups) cleanup()
      }
    })
    await fn(t)
  })
}

/**
 * 会话归因（`session-changes`）的宿主半：用假 ctx 的 emit 驱动 `fs/*` 事件，
 * 再按浏览器半的方式发请求，断言它读到的字段。
 *
 * 事实源是 fs seam 的两类事件：意图（要动哪个文件）+ 观察（动完是什么状态）。只有配得上
 * 意图的观察才算一次落地 —— 单独一条观察也可能只是"读了一次文件"。
 *
 * 注意：记录是**进程级**的（真实里就该只有一份），所以每条用例用自己的 sessionId 隔离，
 * 只断言自己那一份。
 */

const CWD = '/Users/me/project'

/** 每条用例一个会话 id：模块级记录表是全进程共享的，靠会话隔离。 */
function sessionOf(name) {
  return `session-${name}`
}

/** 一次工具调用的执行上下文（形状与真实 `exec` 对齐，只放归因用得上的字段）。 */
function exec({ sessionId, cwd = CWD, callId = 'call-1' } = {}) {
  const agent =
    sessionId === null
      ? undefined
      : { session: { header: { id: sessionId, ...(cwd === null ? {} : { cwd }) } } }
  return { ...(callId === null ? {} : { callId }), ...(agent === undefined ? {} : { agent }) }
}

function fsTarget(absolute) {
  return { displayPath: absolute }
}

/** 一次完整写入：先意图、后观察（真实顺序就是这样）。 */
function writeFile(bundle, sessionId, relative, options = {}) {
  const absolute = path.join(CWD, relative)
  const context = exec({ sessionId, ...options })
  bundle.emit('fs/write-intent', fsTarget(absolute), context)
  bundle.emit('fs/observed', fsTarget(absolute), { kind: 'present', version: 'v1' }, context)
}

function editFile(bundle, sessionId, relative, options = {}) {
  const absolute = path.join(CWD, relative)
  const context = exec({ sessionId, ...options })
  bundle.emit('fs/edit-intent', fsTarget(absolute), context)
  bundle.emit('fs/observed', fsTarget(absolute), { kind: 'present', version: 'v1' }, context)
}

async function read(bundle, sessionId, args = {}) {
  const result = await rpcCall(bundle.handler, CHANNEL, 'session-changes', {
    args: { cwd: CWD, sessionId, ...args },
  })
  assert.equal(result.ok, true, `期望成功，实际 ${JSON.stringify(result)}`)
  return result.value
}

test('会话归因：端点返回浏览器半要读的全部字段', async () => {
  const session = sessionOf('fields')
  const bundle = mount()
  writeFile(bundle, session, 'src/a.ts')
  const value = await read(bundle, session)

  for (const key of [
    'repo',
    'sessionId',
    'tracking',
    'since',
    'firstChangeAt',
    'files',
    'dropped',
    'unconfirmed',
    'cwdMismatch',
  ]) {
    assert.ok(key in value, `缺少浏览器半要读的字段 ${key}`)
  }
  assert.equal(value.repo, CWD)
  assert.equal(value.sessionId, session)
  assert.equal(typeof value.since, 'number', '要说清"自 … 起记录"：那是监听开始的时刻')
  assert.equal(typeof value.firstChangeAt, 'number', '另有"这个会话第一次被记到改动"的时刻')
  assert.equal(value.files.length, 1)
  for (const key of ['path', 'file', 'writes', 'edits', 'firstAt', 'lastAt']) {
    assert.ok(key in value.files[0], `清单项缺少字段 ${key}`)
  }
  assert.equal(value.files[0].path, 'src/a.ts', 'cwd 之内的 posix 相对路径')
})

test('会话归因：意图 + 观察配对才算一次落地，写入与编辑分开计数', async () => {
  const session = sessionOf('counts')
  const bundle = mount()
  writeFile(bundle, session, 'src/a.ts', { callId: 'call-1' })
  writeFile(bundle, session, 'src/a.ts', { callId: 'call-2' })
  editFile(bundle, session, 'src/b.ts', { callId: 'call-3' })

  const value = await read(bundle, session)
  assert.deepEqual(
    value.files.map((file) => [file.file, file.writes, file.edits]),
    [
      ['src/a.ts', 2, 0],
      ['src/b.ts', 0, 1],
    ],
  )
  assert.ok(value.files[0].firstAt <= value.files[0].lastAt, '首次不晚于末次')
})

test('会话归因：只有观察没有意图（读文件）不算改动', async () => {
  const session = sessionOf('readonly')
  const bundle = mount()
  const absolute = path.join(CWD, 'README.md')
  bundle.emit(
    'fs/observed',
    fsTarget(absolute),
    { kind: 'present', version: 'v1' },
    exec({ sessionId: session }),
  )

  const value = await read(bundle, session)
  assert.deepEqual(value.files, [], '读一次不该被算成"这个会话改过它"')
  assert.equal(value.firstChangeAt, null, '一次都没记过就没有"第一次改动"')
  assert.equal(typeof value.since, 'number', '但"自 … 起记录"照旧要报（监听一直在）')
})

test('会话归因：观察配不上那次调用的意图就不算（别把别的调用的观察记进来）', async () => {
  const session = sessionOf('mismatch')
  const bundle = mount()
  const absolute = path.join(CWD, 'src/a.ts')
  bundle.emit('fs/write-intent', fsTarget(absolute), exec({ sessionId: session, callId: 'call-1' }))
  // 另一次调用的观察（callId 不同）：配对不上。
  bundle.emit(
    'fs/observed',
    fsTarget(absolute),
    { kind: 'present' },
    exec({ sessionId: session, callId: 'call-2' }),
  )

  assert.deepEqual((await read(bundle, session)).files, [])
})

test('会话归因：没有 callId 时退回"会话 + 路径"配对，仍然记得到', async () => {
  const session = sessionOf('nocallid')
  const bundle = mount()
  writeFile(bundle, session, 'src/a.ts', { callId: null })
  assert.deepEqual(
    (await read(bundle, session)).files.map((file) => file.file),
    ['src/a.ts'],
  )
})

test('会话归因：cwd 之外的路径不记（git 只关心工作区里的）', async () => {
  const session = sessionOf('outside')
  const bundle = mount()
  const outside = '/tmp/hud-outside.txt'
  bundle.emit('fs/write-intent', fsTarget(outside), exec({ sessionId: session }))
  bundle.emit('fs/observed', fsTarget(outside), { kind: 'present' }, exec({ sessionId: session }))

  assert.deepEqual((await read(bundle, session)).files, [])
})

test('会话归因：非 agent 调用（没有会话身份）不记', async () => {
  const session = sessionOf('noagent')
  const bundle = mount()
  const absolute = path.join(CWD, 'src/a.ts')
  bundle.emit('fs/write-intent', fsTarget(absolute), { callId: 'call-x' })
  bundle.emit('fs/observed', fsTarget(absolute), { kind: 'present' }, { callId: 'call-x' })

  assert.deepEqual((await read(bundle, session)).files, [])
})

test('会话归因：会话之间互不串（问谁就只答谁）', async () => {
  const first = sessionOf('iso-a')
  const second = sessionOf('iso-b')
  const bundle = mount()
  writeFile(bundle, first, 'src/a.ts')
  writeFile(bundle, second, 'src/b.ts')

  assert.deepEqual(
    (await read(bundle, first)).files.map((file) => file.file),
    ['src/a.ts'],
  )
  assert.deepEqual(
    (await read(bundle, second)).files.map((file) => file.file),
    ['src/b.ts'],
  )
})

test('会话归因：不认识的会话返回空清单（不是错误）', async () => {
  const bundle = mount()
  const value = await read(bundle, sessionOf('never-seen'))
  assert.deepEqual(value.files, [])
  assert.equal(value.firstChangeAt, null)
  assert.equal(value.dropped, 0)
})

test('会话归因：没有 sessionId 时也只是空清单', async () => {
  const session = sessionOf('nosession')
  const bundle = mount()
  writeFile(bundle, session, 'src/a.ts')
  const value = await read(bundle, session, { sessionId: undefined })
  assert.deepEqual(value.files, [])
  assert.equal(value.sessionId, null)
})

test('会话归因：非法 cwd 照旧按 invalid-cwd 拒绝', async () => {
  const bundle = mount()
  const result = await rpcCall(bundle.handler, CHANNEL, 'session-changes', {
    args: { cwd: 'relative/path', sessionId: sessionOf('bad-cwd') },
  })
  assert.equal(result.ok, false)
  assert.equal(result.error.details.code, 'invalid-cwd')
})

test('会话归因：超过单会话上限只计数不增长，也不抛', async () => {
  const session = sessionOf('cap')
  const bundle = mount()
  for (let index = 0; index < 505; index += 1) {
    writeFile(bundle, session, `src/f${index}.ts`, { callId: `call-${index}` })
  }

  const value = await read(bundle, session)
  assert.equal(value.files.length, 500, '上限就是上限')
  assert.equal(value.dropped, 5, '丢掉的要如实计数')
})

test('会话归因：卸载时把记录清掉（不留上一个进程的会话）', async () => {
  const session = sessionOf('teardown')
  const bundle = mount()
  writeFile(bundle, session, 'src/a.ts')
  assert.equal((await read(bundle, session)).files.length, 1)

  for (const cleanup of bundle.cleanups) cleanup()
  assert.deepEqual((await read(bundle, session)).files, [], '卸载后不该还留着记录')
})

test('会话归因：会话记录的 cwd 与请求的 cwd 不一致时返回空清单（不对错账）', async () => {
  const session = sessionOf('cwd-mismatch')
  const bundle = mount()
  writeFile(bundle, session, 'src/a.ts')

  const same = await read(bundle, session)
  assert.deepEqual(
    same.files.map((file) => file.file),
    ['src/a.ts'],
    '同工作区照常',
  )

  const other = await read(bundle, session, { cwd: '/Users/me/other-project' })
  assert.deepEqual(other.files, [], '换了个工作区就不该拿它的相对路径去对账')
  assert.equal(other.cwdMismatch, true, '要能看出是"对不上"而不是"没有改动"')
})

test('会话归因：unconfirmed 只数这个会话的待配对意图', async () => {
  const mine = sessionOf('pending-mine')
  const theirs = sessionOf('pending-theirs')
  const bundle = mount()
  // 两边都只发意图、不发观察（写入还在路上）。
  bundle.emit(
    'fs/write-intent',
    fsTarget(path.join(CWD, 'src/a.ts')),
    exec({ sessionId: mine, callId: 'call-a' }),
  )
  bundle.emit(
    'fs/write-intent',
    fsTarget(path.join(CWD, 'src/b.ts')),
    exec({ sessionId: theirs, callId: 'call-b' }),
  )

  const value = await read(bundle, mine)
  assert.equal(value.unconfirmed, 1, '只数自己的那条')
  assert.deepEqual(value.files, [], '没配对成功就还没算落地')
})

/* ------------------------------------------------ 命令旁听（bash 间接改动） */

/**
 * 一次 shell 工具调用：走 `tools/post-execute` 的真实形状（exec + result + next）。
 *
 * 这个事件是 **waterfall**：宿主用 `waterfall(name, exec, result, () => ({kind:'accept'}))`
 * 派发，监听器必须把 `next()` 的判定原样返回 —— 吞掉就等于把工具结果的裁决改掉了。
 */
function bashCall(bundle, sessionId, command, options = {}) {
  const context = {
    name: options.name ?? 'bash',
    callId: options.callId ?? 'call-bash',
    arguments: { command },
    agent: { session: { header: { id: sessionId, cwd: options.cwd ?? CWD } } },
  }
  const result = options.result ?? { ok: true }
  const decision = { kind: 'accept' }
  let returned
  for (const listener of bundle.listeners.get('tools/post-execute') ?? []) {
    returned = listener(context, result, () => decision)
  }
  return { returned, decision }
}

test('命令旁听：必须把 waterfall 的判定原样透传（不能吞掉工具结果的裁决）', () => {
  const bundle = mount()
  const { returned, decision } = bashCall(bundle, sessionOf('passthrough'), 'echo hi')
  assert.equal(returned, decision, 'next() 的返回值要原样返回')
})

test('命令旁听：只读命令不产生"可能相关"，但会留在命令历史里', async () => {
  const session = sessionOf('readonly-cmd')
  const bundle = mount()
  bashCall(bundle, session, 'cat src/a.ts && grep -n foo src/b.ts')
  bashCall(bundle, session, 'git status --short')

  const value = await read(bundle, session)
  assert.deepEqual(value.possible, [], '看了不等于改了')
  assert.equal(value.commands.length, 2, '跑过什么要记下来')
  assert.equal(
    value.commands.every((item) => item.readOnly === true),
    true,
    '要标出"看着只读"',
  )
})

test('命令旁听：重定向 / tee / sed -i / touch 的目标算"可能相关"，并带上原因', async () => {
  const session = sessionOf('cmd-writes')
  const bundle = mount()
  bashCall(bundle, session, 'printf x > src/a.ts', { callId: 'c1' })
  bashCall(bundle, session, 'echo y >> build/out.log', { callId: 'c2' })
  bashCall(bundle, session, 'cat src/b.ts | tee src/c.ts', { callId: 'c3' })
  bashCall(bundle, session, "sed -i 's/foo/bar/' src/d.ts", { callId: 'c4' })
  bashCall(bundle, session, 'touch src/e.ts src/f.ts', { callId: 'c5' })

  const value = await read(bundle, session)
  assert.deepEqual(
    value.possible.map((item) => item.file),
    ['build/out.log', 'src/a.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts', 'src/f.ts'],
  )
  assert.ok(
    value.possible.every((item) => typeof item.reason === 'string' && item.reason.length > 0),
    '每个都要说清是哪条命令',
  )
  assert.equal(
    value.possible.every((item) => item.hits >= 1),
    true,
  )
})

test('命令旁听：mv 的源与目标都记（源会消失），cp 只记目标', async () => {
  const session = sessionOf('cmd-move')
  const bundle = mount()
  bashCall(bundle, session, 'mv src/old.ts src/new.ts', { callId: 'c1' })
  bashCall(bundle, session, 'cp src/new.ts src/copy.ts', { callId: 'c2' })

  const files = (await read(bundle, session)).possible.map((item) => item.file)
  assert.ok(
    files.includes('src/old.ts'),
    `mv 的源也要记（会被删掉），实际 ${JSON.stringify(files)}`,
  )
  assert.ok(files.includes('src/new.ts'))
  assert.ok(files.includes('src/copy.ts'), 'cp 的目标要记')
})

test('命令旁听：失败的命令只进历史，不算"可能相关"', async () => {
  const session = sessionOf('cmd-failed')
  const bundle = mount()
  bashCall(bundle, session, 'printf x > src/a.ts', {
    result: { ok: false, error: { code: 'exit-1' } },
  })

  const value = await read(bundle, session)
  assert.deepEqual(value.possible, [], '失败的命令没改文件')
  assert.equal(value.commands[0].failed, true, '但要说清它失败了')
})

test('命令旁听：非 shell 工具、以及 cwd 之外的目标都不记', async () => {
  const session = sessionOf('cmd-scope')
  const bundle = mount()
  bashCall(bundle, session, 'echo hi', { name: 'read_file' })
  bashCall(bundle, session, 'printf x > /tmp/hud-outside.txt', { callId: 'c2' })
  bashCall(bundle, session, 'printf x > /dev/null', { callId: 'c3' })

  const value = await read(bundle, session)
  assert.deepEqual(value.possible, [], '别的工具与工作区之外都不参与路径归因')
  assert.equal(value.commands.length, 2, '两条 bash 仍要留在历史里（它们确实跑过）')
  assert.deepEqual(
    value.commands.map((item) => item.tool),
    ['bash', 'bash'],
  )
})

test('命令旁听：命令历史留最近 20 条', async () => {
  const session = sessionOf('cmd-history')
  const bundle = mount()
  for (let index = 0; index < 25; index += 1)
    bashCall(bundle, session, `echo ${index}`, { callId: `c${index}` })

  const value = await read(bundle, session)
  assert.equal(value.commands.length, 20)
  assert.ok(value.commands[value.commands.length - 1].command.endsWith('24'), '保留最新的')
})

test('命令旁听：抽路径有上限，超出只计数', async () => {
  const session = sessionOf('cmd-cap')
  const bundle = mount()
  for (let index = 0; index < 320; index += 1)
    bashCall(bundle, session, `touch src/p${index}.ts`, { callId: `c${index}` })

  const value = await read(bundle, session)
  assert.equal(value.possible.length, 300)
  assert.equal(value.possibleDropped, 20)
})

test('命令旁听：与"确定改过"分开记（同名文件两档并存，互不污染）', async () => {
  const session = sessionOf('cmd-vs-confirmed')
  const bundle = mount()
  writeFile(bundle, session, 'src/a.ts')
  bashCall(bundle, session, 'sed -i s/x/y/ src/a.ts')

  const value = await read(bundle, session)
  assert.deepEqual(
    value.files.map((item) => item.file),
    ['src/a.ts'],
    '确定改过在 files 里',
  )
  assert.deepEqual(
    value.possible.map((item) => item.file),
    ['src/a.ts'],
    '命令也给了一条"可能"',
  )
  assert.equal(value.files[0].writes, 1, '互不污染')
})

test('命令旁听：卸载后命令历史与"可能相关"一起清掉', async () => {
  const session = sessionOf('cmd-teardown')
  const bundle = mount()
  bashCall(bundle, session, 'touch src/a.ts')
  assert.equal((await read(bundle, session)).possible.length, 1)

  for (const cleanup of bundle.cleanups) cleanup()
  assert.deepEqual((await read(bundle, session)).possible, [])
  assert.deepEqual((await read(bundle, session)).commands, [])
})

/* ----------------------------------------------------- 回合级归因（宿主半） */

/** 一套假的 `sessionProjections`：只要 `stateOf(session, 'turnBoundary').lastTurn`。 */
function fakeSessionProjections(options = {}) {
  const state = { turn: options.turn ?? 0 }
  return {
    state,
    setTurn(next) {
      state.turn = next
    },
    stateOf: (session, key) => {
      if (options.throwing === true) throw new Error('projection unavailable')
      if (key !== 'turnBoundary') return undefined
      if (session === undefined || session === null) return undefined
      return options.missing === true ? undefined : { lastTurn: state.turn }
    },
  }
}

/** 挂一个带回合服务的宿主半。 */
function mountWithTurns(options = {}) {
  const sessionProjections = fakeSessionProjections(options)
  return { bundle: mount({ services: { sessionProjections } }), sessionProjections }
}

test('回合归因（宿主）：记下"第几轮动的它"，多轮动过同一个文件时两轮都留着', async () => {
  const { bundle, sessionProjections } = mountWithTurns({ turn: 0 })
  const session = sessionOf('turn-files')

  writeFile(bundle, session, 'src/a.ts', { callId: 'c1' })
  writeFile(bundle, session, 'src/b.ts', { callId: 'c2' })
  sessionProjections.setTurn(1)
  writeFile(bundle, session, 'src/a.ts', { callId: 'c3' })

  const value = await read(bundle, session)
  const a = value.files.find((item) => item.file === 'src/a.ts')
  assert.equal(a.lastTurn, 1, '最近一次是第 1 轮')
  assert.deepEqual(a.turns, [0, 1], '两轮都动过就都留着')
  assert.equal(value.files.find((item) => item.file === 'src/b.ts').lastTurn, 0)
})

test('回合归因（宿主）：命令与"可能相关"也带回合号', async () => {
  const { bundle, sessionProjections } = mountWithTurns({ turn: 4 })
  const session = sessionOf('turn-commands')
  bashCall(bundle, session, 'sed -i s/a/b/ src/a.ts')

  const value = await read(bundle, session)
  assert.equal(value.commands[0].turn, 4, '命令属于哪一轮')
  assert.equal(value.possible[0].lastTurn, 4, '可能相关也属于那一轮')
})

test('回合归因（宿主）：没有这个服务（或它抛错）时记 null，归因本身照常', async () => {
  const plain = mount()
  const session = sessionOf('turn-missing')
  writeFile(plain, session, 'src/a.ts')
  const value = await read(plain, session)
  assert.equal(value.files[0].lastTurn, null, '拿不到回合就记 null')
  assert.deepEqual(value.files[0].turns, [], '不是记 0 —— 0 是"第一轮"，含义完全不同')

  // 服务在、但读它抛错：同样只该是 null，不能把归因带崩。
  const { bundle } = mountWithTurns({ throwing: true })
  const other = sessionOf('turn-throwing')
  writeFile(bundle, other, 'src/b.ts')
  const otherValue = await read(bundle, other)
  assert.equal(otherValue.files[0].lastTurn, null)
  assert.equal(otherValue.files[0].writes, 1, '改动本身照记')
})

/* ------------------------------------------------- 会话一览（侧栏行内 chip） */

/** 一套假的宿主 `sessions` 服务：`list()` 返回若干活着的会话。 */
function fakeHostSessions(rows) {
  return {
    list: () => rows.map((row) => ({ header: { id: row.sessionId, cwd: row.cwd } })),
  }
}

test('会话一览：没有 sessions 服务时报"不可用"，而不是空列表冒充"没有会话"', async () => {
  const bundle = mount()
  const value = await rpcCall(bundle.handler, CHANNEL, 'session-statuses', { args: {} })
  assert.equal(value.ok, true)
  assert.equal(value.value.unavailable, true, '要能分辨"服务不在"与"一个会话都没有"')
  assert.deepEqual(value.value.sessions, [])
})

test('会话一览：每个会话带上它自己的工作区摘要，并按目录去重只读一次', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-overview-'))
  try {
    const bundle = mount({
      services: {
        sessions: fakeHostSessions([
          { sessionId: 'session-a', cwd: dir },
          { sessionId: 'session-b', cwd: dir },
          { sessionId: 'session-c', cwd: null },
        ]),
      },
    })
    const result = await rpcCall(bundle.handler, CHANNEL, 'session-statuses', { args: {} })
    assert.equal(result.ok, true)
    const value = result.value
    assert.equal(value.unavailable, false)
    assert.equal(value.sessions.length, 3)
    assert.equal(value.worktrees, 1, '两个会话同一个目录 → 只读一个工作区')
    assert.equal(value.truncated, false)

    const byId = Object.fromEntries(value.sessions.map((item) => [item.sessionId, item]))
    // 目录不是仓库：两行都报 repo:false，但仍要有 mine/possible（归因与 git 无关）。
    assert.equal(byId['session-a'].repo, false)
    assert.equal(byId['session-b'].repo, false)
    assert.equal(byId['session-c'].repo, false, '没有 cwd 的会话也要有一行（repo:false）')
    assert.equal(byId['session-a'].mine, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('会话一览：把"这个会话自己改过什么"一并带上（非仓库也有）', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-overview2-'))
  try {
    const bundle = mount({
      services: { sessions: fakeHostSessions([{ sessionId: 'session-x', cwd: dir }]) },
    })
    writeFile(bundle, 'session-x', 'src/a.ts')
    bashCall(bundle, 'session-x', 'sed -i s/a/b/ src/b.ts')

    const value = (await rpcCall(bundle.handler, CHANNEL, 'session-statuses', { args: {} })).value
    const row = value.sessions[0]
    assert.equal(row.mine, 1, '确定改过 1 个')
    assert.equal(row.possible, 1, '命令旁听 1 个')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

/* --------------------------------------------------- 工具活动（胶囊那一段） */

/**
 * 一次工具调用：走真实的两条 waterfall（`tools/pre-execute` / `tools/post-execute`）。
 *
 * 两条都要求监听器把 `next()` 的判定原样透传（兜底分别是 `{kind:'allow'}` 与 `{kind:'accept'}`），
 * 所以这里同时断言透传 —— 吞掉判定就等于改掉宿主对工具结果的裁决。
 */
/** 只跑"开跑"那一步（要观察 active 的用例需要它）。 */
function toolStart(bundle, options = {}) {
  const context = {
    name: options.name ?? 'bash',
    callId: options.callId ?? 'call-1',
    arguments: options.arguments ?? { command: 'pnpm test' },
    agent: {
      session: { header: { id: options.sessionId ?? 'session-x', cwd: options.cwd ?? CWD } },
    },
  }
  const allow = { kind: 'allow' }
  let returned
  for (const listener of bundle.listeners.get('tools/pre-execute') ?? [])
    returned = listener(context, () => allow)
  return { context, returned, allow }
}

/** 只跑"结束"那一步。 */
function toolFinish(bundle, context, options = {}) {
  const accept = { kind: 'accept' }
  let returned
  for (const listener of bundle.listeners.get('tools/post-execute') ?? [])
    returned = listener(context, options.result ?? { ok: true }, () => accept)
  return { returned, accept }
}

/** 一次完整调用 = 开跑 + 结束（大多数用例只关心计数）。 */
function toolCall(bundle, options = {}) {
  const { context, returned: startReturned, allow } = toolStart(bundle, options)
  const { returned: finishReturned, accept } = toolFinish(bundle, context, options)
  return { startReturned, allow, finishReturned, accept, context }
}

async function readTools(bundle, sessionId) {
  const result = await rpcCall(bundle.handler, CHANNEL, 'session-tools', { args: { sessionId } })
  assert.equal(result.ok, true, JSON.stringify(result))
  return result.value
}

test('工具活动：pre-execute 必须透传判定，post-execute 也要（不能吞掉工具结果的裁决）', () => {
  const bundle = mount()
  const { startReturned, allow, finishReturned, accept } = toolCall(bundle)
  assert.equal(startReturned, allow, 'pre-execute 的判定要原样返回')
  assert.equal(finishReturned, accept, 'post-execute 的判定要原样返回')
})

test('工具活动：开跑时记下名字、参数摘要与开始时刻，结束后进"最近"并带上耗时', async () => {
  const session = sessionOf('tools-basic')
  const bundle = mount()
  const { context } = toolStart(bundle, {
    sessionId: session,
    name: 'bash',
    arguments: { command: 'pnpm test --filter foo' },
    callId: 'c1',
  })

  const running = await readTools(bundle, session)
  assert.equal(running.active.name, 'bash', '跑的时候要能报出工具名')
  assert.equal(running.active.summary, 'pnpm test --filter foo', '参数摘要给命令原文（截断）')
  assert.equal(
    typeof running.active.startedAt,
    'number',
    '实时秒数由客户端本地计时，所以要给开始时刻',
  )
  assert.equal(running.total, 1)

  toolFinish(bundle, context, { result: { ok: false, error: { code: 'exit-1' } } })
  const done = await readTools(bundle, session)
  assert.equal(done.active, null, '结束后不该还挂着 active')
  assert.equal(done.recent.length, 1)
  assert.equal(done.recent[0].ok, false, '失败要如实标出来')
  assert.equal(typeof done.recent[0].ms, 'number', '要有耗时')
  assert.equal(done.total, 1, '同一次调用不该被算两次')
})

test('工具活动：按工具名累计次数，并按次数排序', async () => {
  const session = sessionOf('tools-counts')
  const bundle = mount()
  for (const [callId, name] of [
    ['c1', 'bash'],
    ['c2', 'bash'],
    ['c3', 'bash'],
    ['c4', 'read_file'],
  ]) {
    toolCall(bundle, { sessionId: session, name, callId, arguments: { command: 'x' } })
  }
  const value = await readTools(bundle, session)
  assert.deepEqual(value.counts, [
    { name: 'bash', count: 3, ok: true },
    { name: 'read_file', count: 1, ok: true },
  ])
  assert.equal(value.total, 4)

  // 每个工具**各自**最近一次的结果：胶囊上那个 ✓/✗ 用它（没结束过就是 null，不编一个）。
  toolCall(bundle, {
    sessionId: session,
    name: 'read_file',
    callId: 'c5',
    result: { ok: false, error: { code: 'boom' } },
  })
  toolStart(bundle, { sessionId: session, name: 'glob', callId: 'c6' })
  const after = await readTools(bundle, session)
  const byName = Object.fromEntries(after.counts.map((item) => [item.name, item.ok]))
  assert.equal(byName.bash, true)
  assert.equal(byName.read_file, false, '失败的工具有自己的 ✗')
  assert.equal(byName.glob, null, '还在跑（或从没结束过）就不给结论')
})

test('工具活动：参数摘要只认路径/命令类字段，认不出来就留空（不把文件内容贴到界面上）', async () => {
  const session = sessionOf('tools-privacy')
  const bundle = mount()
  toolCall(bundle, {
    sessionId: session,
    name: 'write',
    callId: 'c1',
    arguments: { filePath: 'src/a.ts', content: 'SECRET BODY 不应该出现在摘要里' },
  })
  toolCall(bundle, {
    sessionId: session,
    name: 'weird',
    callId: 'c2',
    arguments: { content: 'SECRET BODY 不应该出现在摘要里' },
  })

  const value = await readTools(bundle, session)
  const byName = Object.fromEntries(value.recent.map((item) => [item.name, item]))
  assert.equal(byName['write'].summary, 'src/a.ts', '有路径就用路径')
  assert.equal(byName['weird'].summary, null, '只有 content 时留空，绝不猜')
  assert.ok(!JSON.stringify(value).includes('SECRET BODY'), '整个载荷里都不该出现文件内容')
})

test('工具活动：并发调用时 active 记最后一次，先结束的那次仍进"最近"（耗时为 null）', async () => {
  const session = sessionOf('tools-concurrent')
  const bundle = mount()
  const pre = bundle.listeners.get('tools/pre-execute')
  const post = bundle.listeners.get('tools/post-execute')
  const make = (callId) => ({
    name: 'bash',
    callId,
    arguments: { command: 'x' },
    agent: { session: { header: { id: session, cwd: CWD } } },
  })
  for (const listener of pre) listener(make('c1'), () => ({ kind: 'allow' }))
  for (const listener of pre) listener(make('c2'), () => ({ kind: 'allow' }))
  for (const listener of post) listener(make('c1'), { ok: true }, () => ({ kind: 'accept' }))

  const value = await readTools(bundle, session)
  assert.equal(value.active.callId, 'c2', 'active 是最后一次开跑的那个')
  assert.equal(value.recent[0].ms, null, '配不上开始时刻就给 null，不编一个数')
})

test('工具活动：只留最近 12 条，端点只回最近 5 条', async () => {
  const session = sessionOf('tools-ring')
  const bundle = mount()
  for (let i = 0; i < 20; i += 1)
    toolCall(bundle, {
      sessionId: session,
      name: 'bash',
      callId: `c${i}`,
      arguments: { command: `run ${i}` },
    })

  const value = await readTools(bundle, session)
  assert.equal(value.recent.length, 5, '端点只回最近 5 条（悬停里够用）')
  assert.equal(value.recent[0].summary, 'run 19', '最新的在最前')
  assert.equal(value.total, 20, '总数不受环形缓冲影响')
})

test('工具活动：会话之间互不串，没有记录的会话回空壳而不是报错', async () => {
  const first = sessionOf('tools-iso-a')
  const second = sessionOf('tools-iso-b')
  const bundle = mount()
  toolCall(bundle, { sessionId: first, name: 'bash', callId: 'c1' })

  assert.equal((await readTools(bundle, first)).total, 1)
  const other = await readTools(bundle, second)
  assert.deepEqual(other, {
    sessionId: second,
    tracking: true,
    active: null,
    recent: [],
    counts: [],
    skills: [],
    skillsDropped: 0,
    total: 0,
  })
  const none = await readTools(bundle, null)
  assert.equal(none.sessionId, null)
})

test('工具活动：卸载时清空', async () => {
  const session = sessionOf('tools-teardown')
  const bundle = mount()
  toolCall(bundle, { sessionId: session, name: 'bash', callId: 'c1' })
  assert.equal((await readTools(bundle, session)).total, 1)

  for (const cleanup of bundle.cleanups) cleanup()
  assert.equal((await readTools(bundle, session)).total, 0, '卸载后不该留着上一个进程的工具活动')
})

test('会话一览：「可能相关」同时报"记录到几个"和"其中几个现在还有差异"', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-overview3-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
  try {
    git('init')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'dsh-hud test')
    await writeFileAt(path.join(dir, 'tracked.ts'), 'a\n')
    git('add', '.')
    git('commit', '-m', 'init')

    const bundle = mount({
      services: { sessions: fakeHostSessions([{ sessionId: 'session-y', cwd: dir }]) },
    })
    // 一条命令改的是**真的被改了**的文件（盘上也改，才会出现在 status 里）；
    // 另一条只提到一个并不存在、也没被改的路径（`bashCall` 只告诉插件"跑过这条命令"，不执行它）。
    await writeFileAt(path.join(dir, 'tracked.ts'), 'b\n')
    bashCall(bundle, 'session-y', 'sed -i s/a/b/ tracked.ts')
    bashCall(bundle, 'session-y', 'rm gone.ts')

    const value = (await rpcCall(bundle.handler, CHANNEL, 'session-statuses', { args: {} })).value
    const row = value.sessions[0]
    assert.equal(row.repo, true, '这是个真仓库')
    assert.equal(row.possible, 2, '命令旁听到 2 个路径（历史）')
    assert.equal(row.possibleNow, 1, '其中只有 1 个现在还有差异（现在的）')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('技能：`skill` 工具调用会被单独记下来（能从"skill ×2"看出是哪两个技能）', async () => {
  const session = sessionOf('tools-skills')
  const bundle = mount()
  toolCall(bundle, {
    sessionId: session,
    name: 'skill',
    callId: 's1',
    arguments: { name: 'office-xlsx' },
  })
  toolCall(bundle, {
    sessionId: session,
    name: 'skill',
    callId: 's2',
    arguments: { name: 'office-xlsx' },
  })
  toolCall(bundle, {
    sessionId: session,
    name: 'skill',
    callId: 's3',
    arguments: { name: 'pdf' },
    result: { ok: false, error: { code: 'boom' } },
  })
  toolCall(bundle, { sessionId: session, name: 'bash', callId: 'b1', arguments: { command: 'ls' } })

  const value = await readTools(bundle, session)
  assert.deepEqual(
    value.skills,
    [
      { name: 'office-xlsx', count: 2, ok: true },
      { name: 'pdf', count: 1, ok: false },
    ],
    '按次数排序，并带上各技能自己最近一次的结果',
  )
  // 摘要也要给技能名（否则悬停里只能看到 `skill`，看不出是哪个）。
  const byName = Object.fromEntries(value.recent.map((item) => [item.summary, item]))
  assert.ok(
    byName['office-xlsx'],
    `skill 调用的摘要应是技能名，实际 ${JSON.stringify(value.recent)}`,
  )
})

test('技能：只有 `skill` 工具的参数才被当成技能名（别的工具的 name 不能被误认）', async () => {
  const session = sessionOf('tools-skills-guard')
  const bundle = mount()
  // 另一个工具也带 name 参数：它不该出现在技能表里。
  toolCall(bundle, {
    sessionId: session,
    name: 'some_tool',
    callId: 'x1',
    arguments: { name: 'not-a-skill' },
  })
  const value = await readTools(bundle, session)
  assert.deepEqual(value.skills, [], '只有 skill 工具的 name 才算技能名')
})
