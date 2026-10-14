import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { CHANNEL } from '../lib/index.js'
import { mount, rpcCall } from './helpers.mjs'

/**
 * 端到端契约测试：按浏览器半的方式发请求，验证宿主半返回的字段
 * 正是浏览器半要读的那些 —— 两半边之间的字段漂移会在这里变红。
 */

const HAS_GIT = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  }
  catch {
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
    for (const key of ['repo', 'branch', 'detached', 'oid', 'upstream', 'ahead', 'behind', 'dirty']) {
      assert.ok(key in status, `缺少胶囊要读的字段 ${key}`)
    }
    // 面板概览读这些
    for (const key of ['modified', 'added', 'deleted', 'renamed', 'copied', 'typeChanged', 'untracked', 'conflicted']) {
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
    assert.ok(status.changes.some(change => change.path === 'fresh.txt'))
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('端到端的失败码是浏览器半能翻译的那些', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const { handler } = mount()

  const relative = await rpcCall(handler, CHANNEL, 'status', { args: { cwd: 'not/absolute' } })
  assert.equal(relative.ok, false)
  assert.equal(relative.error.details.code, 'invalid-cwd')

  const missing = await rpcCall(handler, CHANNEL, 'status', { args: { cwd: path.join(tmpdir(), 'dsh-hud-absent-dir') } })
  assert.equal(missing.ok, false)
  assert.equal(missing.error.details.code, 'no-cwd')

  const unknown = await rpcCall(handler, CHANNEL, 'nope', { args: {} })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.details.code, 'unknown-endpoint')
})

test('两个半边写死的通道前缀完全一致', () => {
  // 客户端 bundle 是独立文件，通道前缀若与宿主半漂移，所有请求都会 404/405。
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const match = /var CHANNEL = "([^"]+)"/.exec(source)
  assert.ok(match, '客户端 bundle 必须声明 CHANNEL 常量')
  assert.equal(match[1], CHANNEL)
})
