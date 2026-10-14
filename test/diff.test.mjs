import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { parseDiff, readDiff, validateDiffPath } from '../lib/index.js'

const HAS_GIT = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
})()

/* ------------------------------------------------------------- 纯解析 */

test('解析：按 hunk 头重置行号，并区分增删上下文', () => {
  const raw = [
    'diff --git a/a.ts b/a.ts',
    'index 1111111..2222222 100644',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -1,3 +1,4 @@',
    ' keep',
    '-gone',
    '+added',
    '+also',
    '@@ -20,2 +21,2 @@ context @@',
    '-x',
    '+y',
  ].join('\n')

  const result = parseDiff(raw)
  assert.equal(result.additions, 3)
  assert.equal(result.deletions, 2)
  assert.equal(result.hunks, 2)
  assert.equal(result.binary, false)
  assert.equal(result.truncated, false)

  // git 自己的文件头只在 hunk 之外被识别为 meta。
  assert.deepEqual(result.rows.slice(0, 4).map(row => row.kind), ['meta', 'meta', 'meta', 'meta'])
  assert.deepEqual(result.rows[4].kind, 'hunk')

  const ctx = result.rows.find(row => row.kind === 'ctx')
  assert.deepEqual([ctx.oldLine, ctx.newLine, ctx.text], [1, 1, 'keep'])
  const del = result.rows.find(row => row.kind === 'del')
  assert.deepEqual([del.oldLine, del.newLine, del.text], [2, null, 'gone'])
  const add = result.rows.filter(row => row.kind === 'add')[0]
  assert.deepEqual([add.oldLine, add.newLine, add.text], [null, 2, 'added'])
  assert.equal(result.rows.filter(row => row.kind === 'add')[1].newLine, 3)

  // 第二个 hunk 从自己的起点重新计数。
  const second = result.rows.filter(row => row.kind === 'del')[1]
  assert.deepEqual([second.oldLine, second.text], [20, 'x'])
  const lastAdd = result.rows.filter(row => row.kind === 'add')[2]
  assert.deepEqual([lastAdd.newLine, lastAdd.text], [21, 'y'])
})

test('解析：内容行以 -- / ++ / @@ 开头不会被误判成文件头或 hunk', () => {
  const raw = [
    'diff --git a/x b/x',
    '--- a/x',
    '+++ b/x',
    '@@ -1,3 +1,3 @@',
    '---starts with dashes',
    '+++starts with pluses',
    ' @@not a hunk header, too',
  ].join('\n')

  const result = parseDiff(raw)
  assert.equal(result.hunks, 1, '内容行里的 @@ 不算新 hunk')
  const kinds = result.rows.slice(4).map(row => row.kind)
  assert.deepEqual(kinds, ['del', 'add', 'ctx'], '按 diff 前缀解释，而不是按内容')
  assert.equal(result.rows[4].text, '--starts with dashes')
  assert.equal(result.rows[5].text, '++starts with pluses')
  assert.equal(result.rows[6].text, '@@not a hunk header, too')
})

test('解析：二进制与行数上限', () => {
  assert.equal(parseDiff('diff --git a/b.bin b/b.bin\nBinary files a/b.bin and b/b.bin differ\n').binary, true)
  assert.equal(parseDiff('GIT binary patch\n').binary, true)

  const many = ['@@ -1,1 +1,3000 @@']
  for (let index = 0; index < 3000; index += 1) many.push(`+line ${String(index)}`)
  const capped = parseDiff(many.join('\n'))
  assert.equal(capped.rows.length, 2000, '行数有上限')
  assert.equal(capped.truncated, true)
})

test('解析：空 diff 得到空 rows', () => {
  const empty = parseDiff('')
  assert.deepEqual(empty.rows, [])
  assert.equal(empty.additions, 0)
  assert.equal(empty.deletions, 0)
})

/* --------------------------------------------------------- 路径校验 */

test('路径校验：只接受仓库内相对路径', () => {
  assert.equal(validateDiffPath('apps/admin/src/a.ts').ok, true)
  assert.equal(validateDiffPath('/etc/passwd').code, 'invalid-path', '绝对路径')
  assert.equal(validateDiffPath('../../etc/passwd').code, 'invalid-path', '上跳')
  assert.equal(validateDiffPath('a/../../b').code, 'invalid-path', '隐藏在中间的上跳')
  assert.equal(validateDiffPath('--cached').code, 'invalid-path', '前导横线')
  assert.equal(validateDiffPath('a\nb').code, 'invalid-path', '控制字符')
  assert.equal(validateDiffPath('').code, 'invalid-path')
  assert.equal(validateDiffPath(null).code, 'invalid-path')
  assert.equal(validateDiffPath('\\windows\\path').code, 'invalid-path', '前导分隔符')
})

/* --------------------------------------------------------- 真实仓库 */

async function makeRepo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-diff-'))
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'dsh-hud diff'], { cwd: dir, stdio: 'ignore' })
  await writeFile(path.join(dir, 'tracked.txt'), 'line1\nline2\nline3\n')
  await writeFile(path.join(dir, 'gone.txt'), 'bye\n')
  await writeFile(path.join(dir, 'bin.dat'), Buffer.from([0, 1, 2, 3, 0, 255, 7]))
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' })
  return dir
}

test('未暂存的修改：工作区侧有 rows，已暂存侧为空', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'tracked.txt'), 'line1\nchanged\nline3\n')

    const result = await readDiff(dir, 'tracked.txt')
    assert.equal(result.untracked, false)
    assert.equal(result.worktree.additions, 1)
    assert.equal(result.worktree.deletions, 1)
    assert.equal(result.worktree.rows.filter(row => row.kind === 'add')[0].text, 'changed')
    assert.equal(result.index.rows.length, 0, '尚未暂存')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('已暂存的修改：两侧各自读回（暂存后工作区侧为空）', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'tracked.txt'), 'staged line\n')
    execFileSync('git', ['add', 'tracked.txt'], { cwd: dir, stdio: 'ignore' })

    const stagedOnly = await readDiff(dir, 'tracked.txt')
    assert.equal(stagedOnly.index.additions, 1)
    assert.equal(stagedOnly.worktree.rows.length, 0)

    // 再改一次：两侧同时有内容。
    await writeFile(path.join(dir, 'tracked.txt'), 'staged line\nplus worktree\n')
    const both = await readDiff(dir, 'tracked.txt')
    assert.ok(both.index.rows.length > 0, '已暂存侧有内容')
    assert.ok(both.worktree.rows.length > 0, '工作区侧也有内容')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('未跟踪文件：与空文件对比，且会标记 untracked', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'fresh.txt'), 'a\nb\n')

    const result = await readDiff(dir, 'fresh.txt')
    assert.equal(result.untracked, true)
    assert.equal(result.worktree.hunks, 1)
    assert.equal(result.worktree.rows.filter(row => row.kind === 'add').length, 2, '整份文件都是新增')
    assert.equal(result.index.rows.length, 0)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('删除文件也能读出差异', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    await unlink(path.join(dir, 'gone.txt'))
    const result = await readDiff(dir, 'gone.txt')
    assert.equal(result.worktree.deletions, 1)
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('二进制文件只报 binary', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    await writeFile(path.join(dir, 'bin.dat'), Buffer.from([0, 9, 9, 0, 4, 4, 4]))
    const result = await readDiff(dir, 'bin.dat')
    assert.equal(result.worktree.binary, true)
    assert.equal(result.worktree.rows.filter(row => row.kind === 'add').length, 0, '不冒充文本差异')
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('非仓库目录返回 repo: null 而不是抛错', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-diff-plain-'))
  try {
    const result = await readDiff(dir, 'whatever.txt')
    assert.equal(result.repo, null)
    assert.deepEqual(result.worktree.rows, [])
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
})
