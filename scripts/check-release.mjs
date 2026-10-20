#!/usr/bin/env node
/**
 * 发版前自检：**版本号 ↔ git tag 必须对得上**。
 *
 * 为什么有这条：0.7.0 / 0.7.1 都是手改 `package.json` 发的（`npm version` 才会顺带打 tag），
 * 结果仓库里一个 tag 都没有 —— 事后想找"当时发出去的到底是哪一份代码"只能靠比对文件 sha。
 * 现在让它成为 `prepublishOnly` 的一部分：对不上就别发。
 *
 *   node scripts/check-release.mjs            # 检查（prepublishOnly 用）
 *   node scripts/check-release.mjs --create   # 在 HEAD 上创建附注标签 v<版本>
 *
 * 逃生口：`DSH_HUD_SKIP_TAG_CHECK=1 pnpm publish`（真有急事时用，日志里会留一条警告）。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

if (process.env.DSH_HUD_SKIP_TAG_CHECK === '1') {
  console.warn('⚠ 跳过发版 tag 自检（DSH_HUD_SKIP_TAG_CHECK=1）—— 这次发出去的版本不会有标签')
  process.exit(0)
}

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const tag = `v${pkg.version}`
const create = process.argv.includes('--create')

function git(...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function die(problem, hint) {
  console.error(`\n✗ ${problem}`)
  if (hint) console.error(`  ${hint}`)
  process.exit(1)
}

// 发出去的必须是"某个提交"的内容，不能是半路的工作树。
const dirty = git('status', '--porcelain')
if (dirty !== '')
  die(
    `工作区不干净，先提交再发版：\n${dirty
      .split('\n')
      .map((line) => '    ' + line)
      .join('\n')}`,
  )

const head = git('rev-parse', 'HEAD')
let tagged = null
try {
  tagged = git('rev-parse', `refs/tags/${tag}^{commit}`)
} catch {
  tagged = null
}

if (create) {
  if (tagged !== null) {
    die(
      `标签 ${tag} 已经存在（指向 ${tagged.slice(0, 7)}）`,
      [
        ``,
        `  想把它挪到当前 HEAD：git tag -d ${tag} && pnpm run tag`,
        `  （版本还没发出去时这样做是对的；已经发过就别动历史标签）`,
        ``,
      ].join('\n'),
    )
  }
  git('tag', '-a', tag, '-m', pkg.version, 'HEAD')
  console.log(`✓ 已打标签 ${tag} → ${head.slice(0, 7)}`)
  process.exit(0)
}

if (tagged === null) {
  die(
    `版本 ${pkg.version} 还没有对应的 git tag（${tag}）`,
    `先打标签再发版：pnpm run tag    # 等价于 git tag -a ${tag} -m "${pkg.version}"`,
  )
}
if (tagged !== head) {
  // 已经发布过的版本最容易踩这里：代码又前进了，但版本号没抬。这时标签是**对的**，
  // 该做的是抬版本号发新版，而不是把已发布版本的标签挪到 HEAD。
  die(
    `标签 ${tag} 指向 ${tagged.slice(0, 7)}，但 HEAD 是 ${head.slice(0, 7)}`,
    [
      '',
      `  · 若 ${pkg.version} 还没发布：把标签挪到 HEAD —— git tag -d ${tag} && pnpm run tag`,
      `  · 若 ${pkg.version} 已经发布：先抬版本号（改 package.json 的 version 并提交），再 pnpm run tag`,
      '  已发布版本的标签不要挪 —— 它标记的是"这份内容就是那一版"。',
      '',
    ].join('\n'),
  )
}
console.log(`✓ ${tag} = ${head.slice(0, 7)}，工作区干净 —— 可以发布`)
