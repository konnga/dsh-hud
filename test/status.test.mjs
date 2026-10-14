import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readStatus } from '../lib/index.js'

/** 机器上没有 git 就整体跳过（CI 与开发机都装了，但不应因此变红）。 */
const HAS_GIT = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
})()

function git(cwd, args) {
  execFileSync('git', args, { cwd, stdio: 'ignore' })
}

async function makeRepo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-repo-'))
  git(dir, ['init'])
  git(dir, ['config', 'user.email', 'test@example.com'])
  git(dir, ['config', 'user.name', 'dsh-hud test'])
  await writeFile(path.join(dir, 'a.txt'), 'hello\n')
  await writeFile(path.join(dir, 'gone.txt'), 'bye\n')
  git(dir, ['add', '.'])
  git(dir, ['commit', '-m', 'init'])
  return dir
}

test('干净仓库：repo 是真实的顶层目录，计数全零', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    const status = await readStatus(dir)
    assert.equal(status.repo, realpathSync(dir))
    assert.equal(status.dirty, false)
    assert.deepEqual(status.changes, [])
    assert.equal(status.oid.length, 7)
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()
    assert.equal(status.branch, branch)
    assert.equal(status.detached, false)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('改动分类：修改 / 删除 / 未跟踪（含空格路径）/ 暂存新增', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'a.txt'), 'changed\n')
    await unlink(path.join(dir, 'gone.txt'))
    await writeFile(path.join(dir, 'untracked.txt'), 'new\n')
    await writeFile(path.join(dir, 'has space.txt'), 'spaced\n')
    await writeFile(path.join(dir, 'staged.txt'), 'staged\n')
    git(dir, ['add', 'staged.txt'])

    const status = await readStatus(dir)
    assert.equal(status.dirty, true)
    assert.equal(status.counts.modified, 1)
    assert.equal(status.counts.deleted, 1)
    assert.equal(status.counts.added, 1)
    assert.equal(status.counts.untracked, 2)
    assert.equal(status.counts.renamed, 0)

    const paths = status.changes.map(change => change.path)
    assert.ok(paths.includes('a.txt'), `期望含 a.txt，实际 ${JSON.stringify(paths)}`)
    assert.ok(paths.includes('gone.txt'))
    assert.ok(paths.includes('has space.txt'), '带空格的路径必须原样保留')
    assert.ok(paths.includes('staged.txt'))
    assert.equal(status.changes.find(change => change.path === 'staged.txt').status, 'A')
    assert.equal(status.changes.find(change => change.path === 'a.txt').status, 'M')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('重命名在真实仓库里读作 old → new', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    git(dir, ['mv', 'a.txt', 'renamed.txt'])

    const status = await readStatus(dir)
    assert.equal(status.counts.renamed, 1)
    const renamed = status.changes.find(change => change.status === 'R')
    assert.ok(renamed, `期望一条 R 记录，实际 ${JSON.stringify(status.changes)}`)
    assert.equal(renamed.path, 'a.txt → renamed.txt')
    assert.equal(renamed.origFile, 'a.txt')
    assert.equal(renamed.file, 'renamed.txt')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('detached HEAD 不再报分支名', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    git(dir, ['checkout', '--detach'])

    const status = await readStatus(dir)
    assert.equal(status.detached, true)
    assert.equal(status.branch, status.oid, 'detached 时展示短 oid')
    assert.equal(status.branch.length, 7)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('非仓库目录返回 repo: null 而不是抛错', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-plain-'))
  try {
    const status = await readStatus(dir)
    assert.equal(status.repo, null)
    assert.equal(status.dirty, false)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('工作区目录不存在时抛出 no-cwd', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  await assert.rejects(
    () => readStatus(path.join(tmpdir(), 'dsh-hud-definitely-missing-dir')),
    (error) => error.code === 'no-cwd',
  )
})
