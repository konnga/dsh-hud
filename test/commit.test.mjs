import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { parseNameStatus, readCommit, readCommitDiff, validateCommitSha } from '../lib/index.js'

const HAS_GIT = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
})()

const SKIP = (() => (HAS_GIT ? {} : { skip: 'git 不可用' }))()

function git(cwd, args) {
  return execFileSync('git', args, { cwd, stdio: 'ignore' })
}

/** 一个带根提交的仓库；返回目录与根提交的 sha。 */
async function makeRepo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-commit-'))
  git(dir, ['init'])
  git(dir, ['config', 'user.email', 'test@example.com'])
  git(dir, ['config', 'user.name', 'dsh-hud commit'])
  await writeFile(path.join(dir, 'a.txt'), 'one\ntwo\n')
  await writeFile(path.join(dir, 'bin.dat'), Buffer.from([0, 1, 2, 255, 10]))
  git(dir, ['add', '.'])
  git(dir, ['commit', '-m', 'root commit'])
  return dir
}

function head(cwd, rev = 'HEAD') {
  return execFileSync('git', ['rev-parse', rev], { cwd, encoding: 'utf8' }).trim()
}

/* ------------------------------------------------------------------ 纯函数 */

test('validateCommitSha：只收 4..40 位十六进制', () => {
  assert.deepEqual(validateCommitSha('2eed74e'), { ok: true, value: '2eed74e' })
  assert.equal(validateCommitSha('a'.repeat(40)).ok, true, '完整 sha')
  for (const bad of ['', 'abc', 'HEAD', 'HEAD~1', 'origin/main', '--help', 'main', '2eed74e; rm -rf /', 'z'.repeat(7), 'a'.repeat(41), null, 42]) {
    const checked = validateCommitSha(bad)
    assert.equal(checked.ok, false, `${JSON.stringify(bad)} 应当被拒绝`)
    assert.equal(checked.code, 'invalid-sha')
  }
})

test('parseNameStatus：普通状态、重命名成对路径、空段与垃圾段都跳过', () => {
  const parsed = parseNameStatus('M\0src/a.ts\0A\0with space.txt\0R075\0old/name.ts\0new/name.ts\0D\0gone.ts\0')
  assert.deepEqual(parsed.files, [
    { status: 'M', path: 'src/a.ts', file: 'src/a.ts', origFile: null },
    { status: 'A', path: 'with space.txt', file: 'with space.txt', origFile: null },
    { status: 'R', path: 'old/name.ts → new/name.ts', file: 'new/name.ts', origFile: 'old/name.ts' },
    { status: 'D', path: 'gone.ts', file: 'gone.ts', origFile: null },
  ])
  assert.equal(parsed.truncated, false)

  // 复制的分数也当字母看；末尾空段不产出条目。
  assert.deepEqual(parseNameStatus('C100\0a\0b\0\0').files, [
    { status: 'C', path: 'a → b', file: 'b', origFile: 'a' },
  ])
  assert.deepEqual(parseNameStatus('').files, [])
  assert.deepEqual(parseNameStatus('\0\0garbage\0').files, [], '认不出的段落跳过而不是当路径')
})

test('parseNameStatus：超过清单上限就置 truncated', () => {
  const raw = Array.from({ length: 260 }, (_, index) => `M\0file-${String(index)}.txt`).join('\0') + '\0'
  const parsed = parseNameStatus(raw)
  assert.equal(parsed.files.length, 200)
  assert.equal(parsed.truncated, true)
})

/* -------------------------------------------------------------- 真实仓库 */

test('readCommit：元信息 + 这次提交的改动清单', { ...SKIP }, async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'a.txt'), 'one\ntwo\nthree\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'add a line'])

    const result = await readCommit(dir, 'HEAD')
    assert.equal(result.repo, realpathSync(dir))
    assert.equal(result.commit.subject, 'add a line')
    assert.equal(result.commit.author, 'dsh-hud commit')
    assert.match(result.commit.date, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(result.commit.shortSha.length, 7)
    assert.equal(result.commit.sha, head(dir), '短 sha 也要能解析成完整 sha')
    assert.equal(result.commit.merge, false)
    assert.deepEqual(result.files, [{ status: 'M', path: 'a.txt', file: 'a.txt', origFile: null }])
    assert.equal(result.truncated, false)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readCommit：根提交与空树比较（没有父提交也不能报错）', { ...SKIP }, async () => {
  const dir = await makeRepo()
  try {
    const root = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()
    const result = await readCommit(dir, root)
    assert.equal(result.commit.subject, 'root commit')
    assert.deepEqual(result.files.map(file => [file.status, file.file]), [['A', 'a.txt'], ['A', 'bin.dat']])
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readCommit：重命名给出原路径，删掉的文件是 D', { ...SKIP }, async () => {
  const dir = await makeRepo()
  try {
    await mkdir(path.join(dir, 'sub'))
    await writeFile(path.join(dir, 'sub/old name.txt'), 'x\ny\nz\nq\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'add sub'])
    git(dir, ['mv', 'sub/old name.txt', 'sub/new name.txt'])
    await writeFile(path.join(dir, 'sub/new name.txt'), 'x\ny\nz\nq\nw\n')
    await rm(path.join(dir, 'a.txt'))
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-m', 'rename + delete'])

    const result = await readCommit(dir, 'HEAD')
    const byFile = Object.fromEntries(result.files.map(file => [file.file, file]))
    assert.equal(byFile['sub/new name.txt'].status, 'R')
    assert.equal(byFile['sub/new name.txt'].origFile, 'sub/old name.txt')
    assert.equal(byFile['sub/new name.txt'].path, 'sub/old name.txt → sub/new name.txt', '展示路径与工作区清单同形')
    assert.equal(byFile['a.txt'].status, 'D')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readCommit：合并提交按第一父提交比较，不返回空的组合差异', { ...SKIP }, async () => {
  const dir = await makeRepo()
  try {
    // 一条 main 上的改动 + 一条侧分支改动 → 合并。
    await writeFile(path.join(dir, 'main.txt'), 'main\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'main side'])
    git(dir, ['checkout', '-q', '-b', 'topic', 'HEAD~1'])
    await writeFile(path.join(dir, 'topic.txt'), 'topic\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'topic side'])
    git(dir, ['checkout', '-q', 'main'])
    git(dir, ['merge', '--no-edit', 'topic'])

    const result = await readCommit(dir, 'HEAD')
    assert.equal(result.commit.merge, true, '要让 UI 能说明"按第一父提交比较"')
    assert.deepEqual(result.files.map(file => file.file), ['topic.txt'], '第一父提交（main）没有的东西才是这次合并带进来的')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readCommitDiff：带行号的 rows、增删计数与二进制标记', { ...SKIP }, async () => {
  const dir = await makeRepo()
  try {
    const root = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()
    const text = await readCommitDiff(dir, root, 'a.txt')
    assert.equal(text.repo, realpathSync(dir))
    assert.equal(text.path, 'a.txt')
    assert.equal(text.binary, false)
    assert.deepEqual(text.rows.filter(row => row.kind === 'add').map(row => row.text), ['one', 'two'])
    assert.deepEqual(text.rows.filter(row => row.kind === 'add').map(row => row.newLine), [1, 2])

    const binary = await readCommitDiff(dir, root, 'bin.dat')
    assert.equal(binary.binary, true, '二进制文件只报标记，不塞一堆乱码')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readCommitDiff：重命名要把原路径一起作为 pathspec（否则只看到新增 + 删除）', { ...SKIP }, async () => {
  const dir = await makeRepo()
  try {
    await mkdir(path.join(dir, 'sub'))
    await writeFile(path.join(dir, 'sub/old.txt'), 'x\ny\nz\nq\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'add sub'])
    git(dir, ['mv', 'sub/old.txt', 'sub/new.txt'])
    await writeFile(path.join(dir, 'sub/new.txt'), 'x\ny\nz\nq\nw\n')
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-m', 'rename'])

    const result = await readCommitDiff(dir, 'HEAD', 'sub/new.txt', 'sub/old.txt')
    assert.equal(result.origPath, 'sub/old.txt')
    const meta = result.rows.filter(row => row.kind === 'meta').map(row => row.text)
    assert.ok(meta.some(line => line.includes('rename from sub/old.txt')), `缺少重命名头：${JSON.stringify(meta)}`)
    assert.equal(result.additions, 1)
    assert.equal(result.deletions, 0)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readCommit：认不出的 sha 抛 unknown-commit，非仓库返回 null 而不是抛错', { ...SKIP }, async () => {
  const dir = await makeRepo()
  try {
    await assert.rejects(() => readCommit(dir, 'deadbeef'), error => error.code === 'unknown-commit')
    await assert.rejects(() => readCommitDiff(dir, 'deadbeef', 'a.txt'), error => error.code === 'unknown-commit')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }

  const plain = await mkdtemp(path.join(tmpdir(), 'dsh-hud-commit-plain-'))
  try {
    const result = await readCommit(plain, 'deadbeef')
    assert.equal(result.repo, null)
    assert.deepEqual(result.files, [])
    const diff = await readCommitDiff(plain, 'deadbeef', 'a.txt')
    assert.equal(diff.repo, null)
    assert.deepEqual(diff.rows, [])
  }
  finally {
    await rm(plain, { recursive: true, force: true })
  }
})

test('readCommit：空提交的清单是空数组（不是错误）', { ...SKIP }, async () => {
  const dir = await makeRepo()
  try {
    git(dir, ['commit', '--allow-empty', '-m', 'nothing changed'])
    const result = await readCommit(dir, 'HEAD')
    assert.equal(result.commit.subject, 'nothing changed')
    assert.deepEqual(result.files, [])
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})
