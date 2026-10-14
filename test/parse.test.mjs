import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseStatus, validateCwd } from '../lib/index.js'

/** 拼一条 porcelain-v2 记录流（`-z` 用 NUL 分隔）。 */
function stream(records) {
  return `${records.join('\0')}\0`
}

test('解析分支头信息', () => {
  const status = parseStatus(stream([
    '# branch.head main',
    `# branch.oid ${'a'.repeat(40)}`,
    '# branch.upstream origin/main',
    '# branch.ab +2 -1',
  ]))

  assert.equal(status.branch, 'main')
  assert.equal(status.detached, false)
  assert.equal(status.oid, 'aaaaaaa')
  assert.equal(status.upstream, 'origin/main')
  assert.equal(status.ahead, 2)
  assert.equal(status.behind, 1)
  assert.equal(status.dirty, false)
  assert.deepEqual(status.changes, [])
})

test('detached HEAD 回退到短 oid', () => {
  const status = parseStatus(stream([
    '# branch.head (detached)',
    `# branch.oid ${'b'.repeat(40)}`,
  ]))

  assert.equal(status.detached, true)
  assert.equal(status.branch, 'bbbbbbb')
})

test('干净仓库的计数全为 0', () => {
  const status = parseStatus(stream(['# branch.head main']))
  assert.equal(status.dirty, false)
  assert.deepEqual(Object.values(status.counts), [0, 0, 0, 0, 0, 0, 0, 0])
})

test('普通改动按 index 侧字母归类，路径里的空格被保留', () => {
  const status = parseStatus(stream([
    '# branch.head main',
    '1 M. N... 100644 100644 100644 aaa bbb src/has space.ts',
    '1 .M N... 100644 100644 100644 aaa bbb worktree-only.ts',
    '1 A. N... 000000 100644 100644 000 bbb staged-new.ts',
    '1 D. N... 100644 000000 000000 aaa 000 deleted.ts',
    '1 T. N... 100644 100644 100644 aaa bbb type.ts',
  ]))

  assert.equal(status.counts.modified, 2)
  assert.equal(status.counts.added, 1)
  assert.equal(status.counts.deleted, 1)
  assert.equal(status.counts.typeChanged, 1)
  assert.equal(status.dirty, true)
  assert.equal(status.changes[0].path, 'src/has space.ts')
  assert.equal(status.changes[0].status, 'M')
  assert.equal(status.changes[1].status, 'M', 'index 为 . 时取 worktree 字母')
  assert.equal(status.changes[2].status, 'A')
})

test('重命名消费掉紧随其后的原路径记录', () => {
  const status = parseStatus(stream([
    '# branch.head main',
    '2 R. N... 100644 100644 100644 aaa bbb R100 new/name.ts',
    'src/old name.ts',
    '? after.ts',
  ]))

  assert.equal(status.counts.renamed, 1)
  assert.equal(status.counts.untracked, 1)
  assert.equal(status.changes.length, 2, 'rename 记录不能把原路径当成独立改动')
  assert.equal(status.changes[0].file, 'new/name.ts')
  assert.equal(status.changes[0].origFile, 'src/old name.ts')
  assert.equal(status.changes[0].path, 'src/old name.ts → new/name.ts')
  assert.equal(status.changes[1].status, '?')
})

test('复制记为 copied', () => {
  const status = parseStatus(stream([
    '# branch.head main',
    '2 C. N... 100644 100644 100644 aaa bbb C75 copy.ts',
    'src/orig.ts',
  ]))

  assert.equal(status.counts.copied, 1)
  assert.equal(status.changes[0].status, 'C')
})

test('未合并记录计入冲突', () => {
  const status = parseStatus(stream([
    '# branch.head main',
    'u UU N... 100644 100644 100644 100644 aaa bbb ccc conflict file.ts',
  ]))

  assert.equal(status.counts.conflicted, 1)
  assert.equal(status.changes[0].status, '!')
  assert.equal(status.changes[0].path, 'conflict file.ts')
})

test('未跟踪路径只出现在清单里', () => {
  const status = parseStatus(stream(['# branch.head main', '? nope.txt']))
  assert.equal(status.counts.untracked, 1)
  assert.equal(status.changes[0].index, '.')
  assert.equal(status.changes[0].worktree, '?')
})

test('超过清单上限后只计数并置 truncated', () => {
  const records = ['# branch.head main']
  for (let index = 0; index < 250; index += 1) {
    records.push(`? file-${String(index)}.txt`)
  }
  const status = parseStatus(stream(records))

  assert.equal(status.counts.untracked, 250)
  assert.equal(status.changes.length, 200)
  assert.equal(status.truncated, true)
})

test('cwd 校验只接受绝对、干净、有界的路径', () => {
  assert.equal(validateCwd('/Users/me/project').ok, true)
  assert.equal(validateCwd('relative/path').code, 'invalid-cwd')
  assert.equal(validateCwd('').code, 'invalid-cwd')
  assert.equal(validateCwd(null).code, 'invalid-cwd')
  assert.equal(validateCwd('/tmp/with\nnewline').code, 'invalid-cwd')
  assert.equal(validateCwd(`/${'x'.repeat(5000)}`).code, 'invalid-cwd')
})
