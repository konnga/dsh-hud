import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { CHANNEL } from '../lib/host/index.js'
import { mount, rpcCall } from './helpers.mjs'

/**
 * 端到端契约测试：按浏览器半的方式发请求，验证宿主半返回的字段
 * 正是浏览器半要读的那些 —— 两半边之间的字段漂移会在这里变红。
 */

const HAS_GIT = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

async function makeRepo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-e2e-'))
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'dsh-hud e2e'], { cwd: dir, stdio: 'ignore' })
  await writeFile(path.join(dir, 'a.txt'), 'hello\n')
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' })
  return dir
}

test('status 端点返回浏览器半要读的全部字段', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'a.txt'), 'changed\n')
    await writeFile(path.join(dir, 'fresh.txt'), 'new\n')

    const { handler } = mount()
    const result = await rpcCall(handler, CHANNEL, 'status', { args: { cwd: dir } })

    assert.equal(result.ok, true, `期望成功，实际 ${JSON.stringify(result)}`)
    const status = result.value

    // 胶囊读这些
    for (const key of [
      'repo',
      'branch',
      'detached',
      'oid',
      'upstream',
      'ahead',
      'behind',
      'dirty',
    ]) {
      assert.ok(key in status, `缺少胶囊要读的字段 ${key}`)
    }
    // 面板概览读这些
    for (const key of [
      'modified',
      'added',
      'deleted',
      'renamed',
      'copied',
      'typeChanged',
      'untracked',
      'conflicted',
    ]) {
      assert.ok(key in status.counts, `缺少计数 ${key}`)
    }
    // 面板清单读这些
    for (const change of status.changes) {
      for (const key of ['status', 'index', 'worktree', 'path', 'file']) {
        assert.ok(key in change, `清单项缺少字段 ${key}`)
      }
    }
    assert.ok('truncated' in status)

    assert.equal(status.dirty, true)
    assert.equal(status.counts.modified, 1)
    assert.equal(status.counts.untracked, 1)
    assert.ok(status.changes.some((change) => change.path === 'fresh.txt'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('端到端的失败码是浏览器半能翻译的那些', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const { handler } = mount()

  const relative = await rpcCall(handler, CHANNEL, 'status', { args: { cwd: 'not/absolute' } })
  assert.equal(relative.ok, false)
  assert.equal(relative.error.details.code, 'invalid-cwd')

  const missing = await rpcCall(handler, CHANNEL, 'status', {
    args: { cwd: path.join(tmpdir(), 'dsh-hud-absent-dir') },
  })
  assert.equal(missing.ok, false)
  assert.equal(missing.error.details.code, 'no-cwd')

  const unknown = await rpcCall(handler, CHANNEL, 'nope', { args: {} })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.details.code, 'unknown-endpoint')
})

test('provider-balance 端点：读取器没装时报 unsupported（而不是 500 或抛）', async () => {
  const { setProviderBalanceReader } = await import('../lib/host/rpc.js')
  const { handler } = mount()
  // `apply` 会装一个真的读取器；这里显式卸掉，模拟"插件被卸载/更旧版本"的状态。
  setProviderBalanceReader(null)
  try {
    const result = await rpcCall(handler, CHANNEL, 'provider-balance', {
      args: { sessionId: 'session-1' },
    })
    assert.equal(result.ok, true, `信封层面要成功，实际 ${JSON.stringify(result)}`)
    assert.equal(result.value.available, false)
    assert.equal(result.value.reason, 'unsupported')
  } finally {
    // 别把"没装"这个状态漏给后面的用例：重新 mount 一次，让 `apply` 自己把它装回去。
    mount()
  }
})

test('provider-balance 端点：按会话把三种结论原样转给浏览器半', async () => {
  // 端点只做"参数收窄 + 结论翻译"：协议在 providers.js、编排在 provider-balance.js，
  // 这里装一个假的"已解析结论"来验那条转发路径。
  const { handler } = mount()
  const { setProviderBalanceReader } = await import('../lib/host/rpc.js')
  const seen = []
  const cases = [
    {
      outcome: {
        ok: true,
        value: {
          provider: 'relay-b',
          kind: 'relay',
          remaining: '1',
          usedAccount: null,
          usedKey: null,
        },
      },
      expect: (value) => {
        assert.equal(value.available, true)
        assert.equal(value.balance.provider, 'relay-b')
      },
    },
    {
      // 这个提供方的账本就是平台账号：让浏览器半自己去取，宿主不重复取。
      outcome: { ok: true, value: null, account: true },
      expect: (value) => {
        assert.equal(value.available, true)
        assert.equal(value.account, true)
      },
    },
    {
      outcome: {
        ok: false,
        failure: { provider: 'relay-x', kind: 'relay', reason: 'unsupported', message: null },
      },
      expect: (value) => {
        assert.equal(value.available, false)
        assert.equal(value.provider, 'relay-x')
        assert.equal(value.reason, 'unsupported')
      },
    },
  ]
  setProviderBalanceReader((sessionId) => {
    seen.push(sessionId)
    // 第 4 次（没有会话 id 那一次）不在 cases 里：回最后一条就够，只为看参数形状。
    const index = Math.min(seen.length - 1, cases.length - 1)
    return Promise.resolve(cases[index].outcome)
  })
  try {
    for (const item of cases) {
      const result = await rpcCall(handler, CHANNEL, 'provider-balance', {
        args: { sessionId: 'session-a' },
      })
      assert.equal(result.ok, true)
      item.expect(result.value)
    }
    assert.deepEqual(seen, ['session-a', 'session-a', 'session-a'])
    // 没有会话 id 时传 null（不是空串，也不是丢参数）。
    const blank = await rpcCall(handler, CHANNEL, 'provider-balance', { args: {} })
    assert.equal(blank.ok, true)
    assert.deepEqual(seen.slice(-1), [null])
  } finally {
    setProviderBalanceReader(null)
  }
})

test('provider-credential 端点：写入器没装时报 unsupported（不是静默成功）', async () => {
  const { setProviderTokenWriter } = await import('../lib/host/rpc.js')
  // 先 mount 再卸：`apply` 自己会把真实写入器装进去，顺序反了就等于没卸掉。
  const { handler } = mount()
  setProviderTokenWriter(null)
  try {
    const result = await rpcCall(handler, CHANNEL, 'provider-credential', {
      args: { provider: 'relay-a', token: 'x' },
    })
    assert.equal(result.ok, true)
    assert.equal(result.value.saved, false)
    assert.equal(result.value.reason, 'unsupported')
  } finally {
    mount()
  }
})

test('provider-credential 端点：令牌只经宿主写一次，答复里绝不回显', async () => {
  const { setProviderTokenWriter } = await import('../lib/host/rpc.js')
  // 同样是"先 mount 再替换"：反过来会被 `apply` 装的那个真写入器盖掉。
  const { handler } = mount()
  const seen = []
  setProviderTokenWriter((provider, token) => {
    seen.push({ provider, token })
    return Promise.resolve({ ok: true, ref: 'RELAY_A_ACCESS_TOKEN' })
  })
  try {
    const result = await rpcCall(handler, CHANNEL, 'provider-credential', {
      args: { provider: 'relay-a', token: 'sk-dashboard-token' },
    })
    assert.equal(result.ok, true)
    assert.deepEqual(result.value, { saved: true, ref: 'RELAY_A_ACCESS_TOKEN' })
    // 载荷里除了 `ref` 什么都没有 —— 令牌绝不能出现在答复里。
    assert.equal(JSON.stringify(result.value).includes('sk-dashboard-token'), false)
    assert.deepEqual(seen, [{ provider: 'relay-a', token: 'sk-dashboard-token' }])
  } finally {
    setProviderTokenWriter(null)
  }
})

test('provider-credential 端点：没有提供方 id 就直接拒（不去猜是哪个站）', async () => {
  const { handler } = mount()
  const result = await rpcCall(handler, CHANNEL, 'provider-credential', {
    args: { token: 'sk-x' },
  })
  assert.equal(result.ok, true)
  assert.equal(result.value.saved, false)
  assert.equal(result.value.reason, 'unknown-provider')
})

test('两个半边写死的通道前缀完全一致', () => {
  // 客户端 bundle 是独立文件，通道前缀若与宿主半漂移，所有请求都会 404/405。
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const match = /var CHANNEL = "([^"]+)"/.exec(source)
  assert.ok(match, '客户端 bundle 必须声明 CHANNEL 常量')
  assert.equal(match[1], CHANNEL)
})

test(
  'diff 端点返回两侧已解析的 rows，浏览器半只负责渲染',
  { skip: !HAS_GIT && 'git 不可用' },
  async () => {
    const dir = await makeRepo()
    try {
      await writeFile(path.join(dir, 'a.txt'), 'changed\n')

      const { handler } = mount()
      const result = await rpcCall(handler, CHANNEL, 'diff', { args: { cwd: dir, path: 'a.txt' } })

      assert.equal(result.ok, true, `期望成功，实际 ${JSON.stringify(result)}`)
      const value = result.value
      assert.equal(value.path, 'a.txt')
      assert.equal(value.untracked, false)
      for (const key of ['rows', 'additions', 'deletions', 'hunks', 'binary', 'truncated']) {
        assert.ok(key in value.worktree, `工作区侧缺少 ${key}`)
        assert.ok(key in value.index, `已暂存侧缺少 ${key}`)
      }
      for (const row of value.worktree.rows) {
        for (const key of ['kind', 'text', 'oldLine', 'newLine']) {
          assert.ok(key in row, `row 缺少 ${key}`)
        }
      }
      assert.equal(value.worktree.additions, 1)
      assert.equal(value.index.rows.length, 0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
)

test('diff 端点拒绝越界路径与非法 cwd，且走信封错误', async () => {
  const { handler } = mount()

  const escaping = await rpcCall(handler, CHANNEL, 'diff', {
    args: { cwd: '/tmp', path: '../../etc/passwd' },
  })
  assert.equal(escaping.ok, false)
  assert.equal(escaping.error.details.code, 'invalid-path')

  const absolute = await rpcCall(handler, CHANNEL, 'diff', {
    args: { cwd: '/tmp', path: '/etc/passwd' },
  })
  assert.equal(absolute.ok, false)
  assert.equal(absolute.error.details.code, 'invalid-path')

  const dashed = await rpcCall(handler, CHANNEL, 'diff', {
    args: { cwd: '/tmp', path: '--upload-pack=evil' },
  })
  assert.equal(dashed.error.details.code, 'invalid-path')

  const badCwd = await rpcCall(handler, CHANNEL, 'diff', {
    args: { cwd: 'relative', path: 'a.txt' },
  })
  assert.equal(badCwd.error.details.code, 'invalid-cwd')

  const noPath = await rpcCall(handler, CHANNEL, 'diff', { args: { cwd: '/tmp' } })
  assert.equal(noPath.error.details.code, 'invalid-path')
})

test('log 端点返回最近提交，且条数被钳制', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    // makeRepo 已经提交过一次
    await writeFile(path.join(dir, 'b.txt'), 'b\n')
    execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'second'], { cwd: dir, stdio: 'ignore' })

    const { handler } = mount()
    const result = await rpcCall(handler, CHANNEL, 'log', { args: { cwd: dir, count: 10 } })

    assert.equal(result.ok, true, `期望成功，实际 ${JSON.stringify(result)}`)
    assert.equal(result.value.commits.length, 2)
    const [newest] = result.value.commits
    for (const key of ['sha', 'author', 'date', 'committedAt', 'refs', 'subject']) {
      assert.ok(key in newest, `提交缺少字段 ${key}`)
    }
    assert.equal(newest.subject, 'second')
    assert.ok(newest.refs.some((ref) => ref.startsWith('HEAD')))

    const clamped = await rpcCall(handler, CHANNEL, 'log', { args: { cwd: dir, count: 999 } })
    assert.ok(clamped.value.commits.length <= 50)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('log 端点：非仓库与非法 cwd 的行为', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const plain = await mkdtemp(path.join(tmpdir(), 'dsh-hud-e2e-log-'))
  try {
    const { handler } = mount()
    const notRepo = await rpcCall(handler, CHANNEL, 'log', { args: { cwd: plain } })
    assert.equal(notRepo.ok, true, '非仓库是成功结果')
    assert.equal(notRepo.value.repo, null)
    assert.deepEqual(notRepo.value.commits, [])

    const badCwd = await rpcCall(handler, CHANNEL, 'log', { args: { cwd: 'relative' } })
    assert.equal(badCwd.ok, false)
    assert.equal(badCwd.error.details.code, 'invalid-cwd')
  } finally {
    await rm(plain, { recursive: true, force: true })
  }
})

test('commit 端点返回浏览器半要读的元信息与清单', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'a.txt'), 'hello\nworld\n')
    await writeFile(path.join(dir, 'fresh.txt'), 'new\n')
    execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'second'], { cwd: dir, stdio: 'ignore' })

    const { handler } = mount()
    // 浏览器半点提交行给的是 log 里的短 sha：整条链路必须能从短 sha 走通。
    const log = await rpcCall(handler, CHANNEL, 'log', { args: { cwd: dir, count: 1 } })
    const short = log.value.commits[0].sha

    const result = await rpcCall(handler, CHANNEL, 'commit', { args: { cwd: dir, sha: short } })
    assert.equal(result.ok, true, `期望成功，实际 ${JSON.stringify(result)}`)
    for (const key of [
      'sha',
      'shortSha',
      'subject',
      'author',
      'date',
      'committedAt',
      'refs',
      'merge',
    ]) {
      assert.ok(key in result.value.commit, `提交缺少字段 ${key}`)
    }
    assert.equal(result.value.commit.subject, 'second')
    assert.equal(result.value.commit.sha.length, 40, '短 sha 会解析成完整 sha')
    assert.ok('truncated' in result.value)
    for (const file of result.value.files) {
      for (const key of ['status', 'path', 'file', 'origFile']) {
        assert.ok(key in file, `提交清单项缺少字段 ${key}`)
      }
    }
    assert.deepEqual(result.value.files.map((file) => file.file).sort(), ['a.txt', 'fresh.txt'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('commit-diff 端点返回单侧已解析的 rows', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'a.txt'), 'hello\nworld\n')
    execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'second'], { cwd: dir, stdio: 'ignore' })

    const { handler } = mount()
    // 只收十六进制 sha（`HEAD`、`HEAD~1` 这类 rev 表达式一律拒绝），所以先解析出来。
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()
    const result = await rpcCall(handler, CHANNEL, 'commit-diff', {
      args: { cwd: dir, sha, path: 'a.txt' },
    })

    assert.equal(result.ok, true, `期望成功，实际 ${JSON.stringify(result)}`)
    const value = result.value
    assert.equal(value.path, 'a.txt')
    assert.equal(value.origPath, null)
    assert.equal(typeof value.sha, 'string')
    for (const key of ['rows', 'additions', 'deletions', 'hunks', 'binary', 'truncated']) {
      assert.ok(key in value, `提交差异缺少 ${key}`)
    }
    for (const row of value.rows) {
      for (const key of ['kind', 'text', 'oldLine', 'newLine']) {
        assert.ok(key in row, `row 缺少 ${key}`)
      }
    }
    assert.equal(value.additions, 1, '新增的那一行')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('commit / commit-diff：非法 sha 与越界路径都走信封错误', async () => {
  const { handler } = mount()

  // sha 会被当位置参数交给 git，因此必须在入口就挡住选项形状与 rev 表达式。
  for (const sha of ['HEAD~1', 'HEAD', 'origin/main', '--help', 'abc']) {
    const result = await rpcCall(handler, CHANNEL, 'commit', { args: { cwd: '/tmp', sha } })
    assert.equal(result.ok, false, `${sha} 应当被拒绝`)
    assert.equal(result.error.details.code, 'invalid-sha')
  }

  const noSha = await rpcCall(handler, CHANNEL, 'commit', { args: { cwd: '/tmp' } })
  assert.equal(noSha.error.details.code, 'invalid-sha')

  const badPath = await rpcCall(handler, CHANNEL, 'commit-diff', {
    args: { cwd: '/tmp', sha: '2eed74e', path: '../../etc/passwd' },
  })
  assert.equal(badPath.error.details.code, 'invalid-path')

  const badOrig = await rpcCall(handler, CHANNEL, 'commit-diff', {
    args: { cwd: '/tmp', sha: '2eed74e', path: 'a.txt', origPath: '/etc/passwd' },
  })
  assert.equal(badOrig.error.details.code, 'invalid-path')

  const badCwd = await rpcCall(handler, CHANNEL, 'commit-diff', {
    args: { cwd: 'relative', sha: '2eed74e', path: 'a.txt' },
  })
  assert.equal(badCwd.error.details.code, 'invalid-cwd')
})
