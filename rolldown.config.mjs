/**
 * 把 `src/client/**` 打成 `lib/client.js`。
 *
 * 为什么是 rolldown 而不是 esbuild：**注释必须保留**。产物是要被人读的（devtools、
 * 发布包），esbuild 会把注释全部删掉（只有 legal comments 那个选项），而我们这份代码的
 * 价值有一大半写在注释里。rolldown 与 rollup 一样默认保留注释，原生支持 TS，
 * 而且生态里那些插件（`dsh-better-sidebar` 等）产出的形状与这里逐字一致。
 *
 * 产物形状 = DSH 的契约：经典脚本 → `__ModuleLoader__.load({ id, factory })`，
 * `require` 由 DSH 交给 factory（所以 `require("react")` 必须落在 factory 里面，
 * 这也是 banner/footer 存在的唯一原因）。
 */
const ID = '@konnga/dsh-hud'

export default {
  input: 'src/client/index.ts',
  // 唯一的外部模块：由 DSH 的种子模块表提供（`dsh.client` 的 runtime 会喂给 factory）。
  external: ['react'],
  output: {
    file: 'lib/client.js',
    format: 'cjs',
    sourcemap: true,
    // 不加压缩：产物要能读、能 review、能在真机 devtools 里逐行对源码。
    minify: false,
    banner:
      `window.__ModuleLoader__.load({\n` +
      `  id: ${JSON.stringify(ID)},\n` +
      `  factory: (require) => {\n` +
      `    var module = { exports: {} };\n` +
      `    var exports = module.exports;\n`,
    footer: `    return module.exports;\n  },\n});\n`,
  },
}
