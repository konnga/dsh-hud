import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readLog } from '../lib/index.js'

const HAS_GIT = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
})()

async function makeRepo(commits = 2) {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-log-'))
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'dsh-hud log'], { cwd: dir, stdio: 'ignore' })
  for (let index = 0; index < commits; index += 1) {
    await writeFile(path.join(dir, `file-${String(index)}.txt`), `content ${String(index)}\n`)
    execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', `subject ${String(index)}`], { cwd: dir, stdio: 'ignore' })
  }
  return dir
}

test('readLog：最新在前，带短 sha、作者、日期、refs 与标题', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo(2)
  try {
    const result = await readLog(dir, 10)
    assert.equal(result.repo, realpathSync(dir), 'repo 指向仓库根（realpath，tmpdir 在 macOS 上是符号链接）')
    assert.equal(result.commits.length, 2)

    const [newest, older] = result.commits
    assert.equal(newest.subject, 'subject 1', '最新的排在最前')
    assert.equal(older.subject, 'subject 0')
    assert.equal(newest.sha.length, 7, '短 sha')
    assert.equal(newest.author, 'dsh-hud log')
    assert.match(newest.date, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(typeof newest.committedAt, 'number')
    assert.ok(newest.refs.some(ref => ref.startsWith('HEAD')), `最新提交应带 HEAD ref，实际 ${JSON.stringify(newest.refs)}`)
    assert.ok(newest.committedAt >= older.committedAt)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readLog：标题含特殊字符也完整保留（NUL 分隔而不是按列切）', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo(1)
  try {
    const subject = 'fix: 「引号」与 "双引号" 和 多个   空格'
    await writeFile(path.join(dir, 'x.txt'), 'x\n')
    execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', subject], { cwd: dir, stdio: 'ignore' })

    const result = await readLog(dir, 1)
    assert.equal(result.commits[0].subject, subject)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readLog：条数钳制在 1..50', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo(2)
  try {
    assert.equal((await readLog(dir, 0)).commits.length, 1, '下界 1')
    assert.equal((await readLog(dir, 999)).commits.length, 2, '上界 50，但仓库只有 2 条')
    assert.equal((await readLog(dir)).commits.length, 2, '默认 10 条')
    assert.equal((await readLog(dir, Number.NaN)).commits.length, 2, '非法条数回退默认值')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readLog：还没有任何提交的空仓库返回空列表而不是错误', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo(0)
  try {
    const result = await readLog(dir, 10)
    assert.ok(result.repo, '仍应识别出仓库根')
    assert.deepEqual(result.commits, [])
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readLog：非仓库目录 repo 为 null', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-log-plain-'))
  try {
    const result = await readLog(dir, 10)
    assert.equal(result.repo, null)
    assert.deepEqual(result.commits, [])
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})
