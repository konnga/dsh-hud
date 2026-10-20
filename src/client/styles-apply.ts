/**
 * 样式落地：把 `styles.ts` 那份表插进 `<head>`（用 `CSS_TAG_ID` 防重复注入），
 * 以及从已注入的样式里取一个值的助手。
 */

import { CSS } from './styles.js'
import { CSS_TAG_ID } from './shared.js'
/**
 * 审阅进度：`{ marks: {file → 'fresh'|'stale'}, done, total, staleCount }`。
 *
 * 判据是**签名**：宿主 stat 出来的 size+mtimeMs 和存档里的是同一个才算"这一版审过了"。
 * 签名变了（又被改动）就把那条标记降级成 `stale`，界面显示"改动已变，需要重看" ——
 * 而不是继续冒充已审。没有签名的文件（宿主这次没算）不参与统计。
 */

/**
 * 从自有样式表里抠出计数芯片的横向间隔。
 *
 * 用来回答"页面上跑着的到底是哪一版 CSS"—— 改完样式没生效时，这一眼就能分清是
 * "bundle 还是旧的"还是"样式规则没生效"。
 */
export function cssChipsGap(css: string): string | null {
  var match = /\.dshh-chips\{[^}]*gap:([^;}]+)/.exec(css)
  return match === null ? null : match[1].trim()
}

/* ---------------------------------------------------------------- 样式 */

/* ---------------------------------------------------------------- 样式注入 */

/**
 * 幂等注入自有样式表，并**自己打上 `data-plugin`**。
 *
 * 框架的 client-modules 会在每次模块物化后 `claimStyles(id)`：把当时所有
 * **没有 `data-plugin`** 的 `<style>` 认领给刚物化的那个模块，然后在 HMR 的
 * replace / invalidate / prune 路径上 `removeOwnedStyles(id)` 按 `data-plugin`
 * 删掉。不打标的表会被别的模块领走，在那次 rebuild 里连同别人的表一起删掉 ——
 * 而我们的注入只在插件激活时跑一次，于是页面永久退回骨架（原生 `button`、
 * 没有间隙 / 省略号 / 居中几何）。
 *
 * 框架自己的包与同门的 dsh-git-graph 都按这个约定打标；tag 存在时复用同一节点
 * （HMR 会先把旧表删掉，再由新的 fiber 重新调用本函数）。
 *
 * @returns 该样式节点；没有 `document` 时返回 `null`。
 */
export function ensureStyles(): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null
  var selector = 'style[data-plugin-css="' + CSS_TAG_ID + '"]'
  // 选择器只可能命中我们自己注入的 <style>（tag id 是插件私有的）：这里断言成 HTMLStyleElement。
  var tag = (
    typeof document.querySelector === 'function' ? document.querySelector(selector) : null
  ) as HTMLStyleElement | null
  if (!tag) {
    tag = document.createElement('style')
    // 值必须等于客户端模块 id（= 包名）：客户端的 `removeOwnedStyles(id)` 靠它回收样式。
    tag.setAttribute('data-plugin', '@konnga/dsh-hud')
    tag.setAttribute('data-plugin-css', CSS_TAG_ID)
    tag.setAttribute('data-dsh-hud', 'styles')
    document.head.appendChild(tag)
  }
  tag.textContent = CSS
  return tag
}
