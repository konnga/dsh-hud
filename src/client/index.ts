/**
 * 浏览器半的**入口**：只把插件面交给 DSH。
 *
 * 契约：DSH 用经典脚本加载产物、调用 `__ModuleLoader__.load({ id, factory })`，
 * 并把 `require` 交给 factory；这里 `export` 出来的东西会被挂到那个 `exports` 上
 * （外壳由 `rolldown.config.mjs` 的 banner/footer 提供）。
 */
export { apply, inject } from './plugin.js'

/**
 * 另外两个纯函数只导出给用例用：工具名怎么归组、官方文案里的「用时」怎么抠 ——
 * 这两处都是**拼错不会报错、只是悄悄降级**的地方（正则写歪 → 全落 `other`；
 * `···` 的位置变了 → 时长变空），值得单独盯。
 *
 * 框架只认 `apply` / `inject`，多出来的导出它不看。
 */
export {
  extractElapsed,
  groupOfTool,
  configureRunningText,
  refreshRunningText,
} from './running-text.js'
export {
  createActivitySelector,
  ACTION_POOL,
  FUN_PHRASES,
  pickFunPhrase,
} from './running-activity-cues.js'
export { watchRunningActivity } from './running-activity.js'

/** 同源文案动作表，供联动契约测试与离线预览共用。 */
export { RUNNING_CUES } from './running-cues.js'

/** Public pack facade also used by integration tests of the actual browser bundle. */
export { createExpressionPacks, getExpressionPackStore } from './expression-packs.js'
export {
  ExpressionPacks,
  guessExpressionAction,
  emptyExpressionDraft,
} from './components/expression-packs.js'
