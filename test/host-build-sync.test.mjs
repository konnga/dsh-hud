/** 宿主半用例：产物与源码同步（2 条）。 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

/**
 * 宿主半的源码在 `src/host/**`、产物在 `lib/host/**`（`npx tsc -p tsconfig.host.json` 逐文件编译）。
 *
 * 产物是**提交进仓库**的（DSH 直接读 `lib/host/index.js`；本机 profile 也是 link 到这个仓库），
 * 所以"改了源码忘了 build"会静默地让人在真机上看到旧代码 —— 这两条用例把它变成红灯：
 *   1. 文件集合一一对应：源码有哪个模块、产物就得有哪个同名文件，反之亦然（无残留旧产物）；
 *   2. 每个产物与"现在重新编译一遍"的结果逐字节一致。
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const HOST_SRC = path.join(ROOT, 'src', 'host')
const HOST_LIB = path.join(ROOT, 'lib', 'host')
const TSCONFIG = path.join(ROOT, 'tsconfig.host.json')
// 与 `npx tsc` 同一个入口：直接跑 TypeScript 的 bin，免得依赖 PATH / npx 的网络行为。
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')

/** 目录里的 `.ts` / `.js` 文件名（只留模块名，便于两边比较）。 */
function moduleNames(dir, extension) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(extension))
    .map((name) => name.slice(0, -extension.length))
    .sort()
}

test('src/host/**/*.ts 与 lib/host/**/*.js 文件集合一一对应（没有残留旧产物）', () => {
  for (const directory of ['host', 'shared']) {
    const sources = moduleNames(path.join(ROOT, 'src', directory), '.ts')
    const artifacts = moduleNames(path.join(ROOT, 'lib', directory), '.js')
    assert.deepEqual(
      artifacts,
      sources,
      `${directory} 产物与源码的模块集合不一致：跑一下 pnpm run build`,
    )
  }
})

test('lib/host/*.js 与 src/host/**/*.ts 同步（忘了 build 就该红）', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'dsh-hud-host-build-'))
  try {
    try {
      execFileSync(process.execPath, [TSC, '-p', TSCONFIG, '--outDir', tempDir], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
      })
    } catch (error) {
      assert.fail(
        `tsc 编译失败（先修好类型再谈产物同步）：\n${error.stderr || error.stdout || error.message}`,
      )
    }

    const normalize = (text) => text.replace(/\r\n/g, '\n').replace(/\s+$/, '')
    for (const directory of ['host', 'shared']) {
      const builtDir = path.join(tempDir, directory)
      const committedDir = path.join(ROOT, 'lib', directory)
      const builtFiles = readdirSync(builtDir)
        .filter((name) => name.endsWith('.js'))
        .sort()
      assert.deepEqual(moduleNames(builtDir, '.js'), moduleNames(committedDir, '.js'))
      for (const name of builtFiles) {
        assert.equal(
          normalize(readFileSync(path.join(committedDir, name), 'utf8')),
          normalize(readFileSync(path.join(builtDir, name), 'utf8')),
          `lib/${directory}/${name} 与源码不同步：跑一下 pnpm run build`,
        )
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
