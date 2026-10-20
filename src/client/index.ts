/**
 * 浏览器半的**入口**：只把插件面交给 DSH。
 *
 * 契约：DSH 用经典脚本加载产物、调用 `__ModuleLoader__.load({ id, factory })`，
 * 并把 `require` 交给 factory；这里 `export` 出来的东西会被挂到那个 `exports` 上
 * （外壳由 `rolldown.config.mjs` 的 banner/footer 提供）。
 */
export { apply, inject } from './plugin.js'
