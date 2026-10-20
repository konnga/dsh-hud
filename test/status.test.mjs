import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readStatus, readTags } from '../lib/host/index.js'

/** 机器上没有 git 就整体跳过（CI 与开发机都装了，但不应因此变红）。 */
const HAS_GIT = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
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
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
    assert.equal(status.branch, branch)
    assert.equal(status.detached, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test(
  '改动分类：修改 / 删除 / 未跟踪（含空格路径）/ 暂存新增',
  { skip: !HAS_GIT && 'git 不可用' },
  async () => {
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

      const paths = status.changes.map((change) => change.path)
      assert.ok(paths.includes('a.txt'), `期望含 a.txt，实际 ${JSON.stringify(paths)}`)
      assert.ok(paths.includes('gone.txt'))
      assert.ok(paths.includes('has space.txt'), '带空格的路径必须原样保留')
      assert.ok(paths.includes('staged.txt'))
      assert.equal(status.changes.find((change) => change.path === 'staged.txt').status, 'A')
      assert.equal(status.changes.find((change) => change.path === 'a.txt').status, 'M')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
)

test('重命名在真实仓库里读作 old → new', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await makeRepo()
  try {
    git(dir, ['mv', 'a.txt', 'renamed.txt'])

    const status = await readStatus(dir)
    assert.equal(status.counts.renamed, 1)
    const renamed = status.changes.find((change) => change.status === 'R')
    assert.ok(renamed, `期望一条 R 记录，实际 ${JSON.stringify(status.changes)}`)
    assert.equal(renamed.path, 'a.txt → renamed.txt')
    assert.equal(renamed.origFile, 'a.txt')
    assert.equal(renamed.file, 'renamed.txt')
  } finally {
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
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('非仓库目录返回 repo: null 而不是抛错', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-hud-plain-'))
  try {
    const status = await readStatus(dir)
    assert.equal(status.repo, null)
    assert.equal(status.dirty, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('工作区目录不存在时抛出 no-cwd', { skip: !HAS_GIT && 'git 不可用' }, async () => {
  await assert.rejects(
    () => readStatus(path.join(tmpdir(), 'dsh-hud-definitely-missing-dir')),
    (error) => error.code === 'no-cwd',
  )
})

test(
  '未跟踪按"文件"计，不把目录折成一条（与编辑器 / git status -uall 同口径）',
  { skip: !HAS_GIT && 'git 不可用' },
  async () => {
    const dir = await makeRepo()
    try {
      await mkdir(path.join(dir, 'brandnew'), { recursive: true })
      for (const name of ['n1.txt', 'n2.txt', 'n3.txt'])
        await writeFile(path.join(dir, 'brandnew', name), 'x\n')

      const status = await readStatus(dir)
      // 这条是回归：`--untracked-files=normal` 会把整个 brandnew/ 折成一条 `?`，
      // 于是胶囊上的 `?n` 比编辑器报的数小得多（用户实测差到 1/3）。
      assert.equal(status.counts.untracked, 3, '目录里 3 个新文件要算 3 条')
      assert.equal(
        status.changes.filter((change) => change.status === '?').length,
        3,
        '清单里也是 3 条',
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
)

/* ---------------------------------------------------------------- 标签列表 */

test(
  '标签列表：附注 tag 显示它指向的提交 sha（不是 tag 对象），轻量 tag 两者相同',
  { skip: !HAS_GIT && 'git 不可用' },
  async () => {
    const dir = await makeRepo()
    try {
      git(dir, ['tag', 'v0.1.0']) // 轻量
      git(dir, ['tag', '-a', 'v0.2.0', '-m', '第二版：修了几个毛病']) // 附注

      const { tags, truncated } = await readTags(dir)
      assert.equal(truncated, false)
      const byName = Object.fromEntries(tags.map((tag) => [tag.name, tag]))
      assert.deepEqual(Object.keys(byName).sort(), ['v0.1.0', 'v0.2.0'])
      assert.equal(byName['v0.1.0'].annotated, false)
      assert.equal(byName['v0.2.0'].annotated, true)

      // 两个 tag 指向同一个提交 → 附注那个也必须给出**同一个提交 sha**（剥一层）。
      assert.equal(byName['v0.1.0'].sha, byName['v0.2.0'].sha, '附注 tag 要剥一层拿到提交 sha')
      assert.equal(byName['v0.1.0'].sha.length, 7, '短 sha')
      assert.equal(
        byName['v0.2.0'].subject,
        '第二版：修了几个毛病',
        '附注 tag 的主题是 tag 说明首行',
      )
      assert.equal(byName['v0.1.0'].subject, 'init', '轻量 tag 的主题是那次提交的标题')
      assert.equal(typeof byName['v0.2.0'].committedAt, 'number')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
)

test(
  '标签列表：最新创建的排在前面，超过上限只报 truncated',
  { skip: !HAS_GIT && 'git 不可用' },
  async () => {
    const dir = await makeRepo()
    try {
      for (const name of ['t1', 't2', 't3']) {
        await writeFile(path.join(dir, `${name}.txt`), 'x\n')
        git(dir, ['add', '.'])
        git(dir, ['commit', '-m', `commit ${name}`])
        git(dir, ['tag', name])
      }
      const all = await readTags(dir)
      assert.deepEqual(
        all.tags.map((tag) => tag.name),
        ['t3', 't2', 't1'],
        '最新的在前',
      )

      const capped = await readTags(dir, 2)
      assert.deepEqual(
        capped.tags.map((tag) => tag.name),
        ['t3', 't2'],
      )
      assert.equal(capped.truncated, true, '还有更多要如实报')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
)

test(
  '标签列表：一个 tag 都没有 / 不是仓库 / 目录不存在，都不该炸',
  { skip: !HAS_GIT && 'git 不可用' },
  async () => {
    const dir = await makeRepo()
    const plain = await mkdtemp(path.join(tmpdir(), 'dsh-hud-plain-'))
    try {
      const none = await readTags(dir)
      assert.deepEqual(none.tags, [], '没有 tag 就是空表')
      assert.equal(none.truncated, false)
      assert.ok(none.repo, '仍然报出真实的仓库顶层目录')

      const outside = await readTags(plain)
      assert.equal(outside.repo, null)
      assert.deepEqual(outside.tags, [])

      await assert.rejects(() => readTags(path.join(plain, 'does-not-exist')), /cwd does not exist/)
    } finally {
      await rm(dir, { recursive: true, force: true })
      await rm(plain, { recursive: true, force: true })
    }
  },
)
