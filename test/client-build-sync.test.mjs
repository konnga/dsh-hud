/** 浏览器半用例：产物与源码同步（1 条）。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { rolldown } from 'rolldown'

test('lib/client.js 与 src/client/** 同步（忘了 pnpm run build 就该红）', async () => {
  // 产物是**提交进仓库**的（DSH 直接读这个文件；本机 profile 也是 link 到这个仓库），
  // 所以"改了源码忘了 build"会静默地让人在真机上看到旧代码 —— 这条用例把它变成红灯。
  const config = (await import('../rolldown.config.mjs')).default
  const bundle = await rolldown({ input: config.input, external: config.external })
  const { output } = await bundle.generate({ ...config.output, file: undefined })
  const chunk = output.find((item) => item.type === 'chunk')
  assert.ok(chunk, '打包应当产出一个 chunk')

  const normalize = (text) => text.replace(/\/\/# sourceMappingURL=\S+\s*$/, '').trim()
  const committed = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.equal(
    normalize(committed),
    normalize(chunk.code),
    '产物与源码不同步：跑一下 `pnpm run build`（产物要一起提交）',
  )
})
