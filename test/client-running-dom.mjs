/** Shared minimal running-status DOM for lifecycle tests. */
import assert from 'node:assert/strict'

/** 最小 DOM 树：测试真实的挂载、标记、移除路径，而不只看定时器有没有注册。 */
export function runningDom(mounted, options = {}) {
  const images = []
  function element(tagName) {
    const item = {
      tagName,
      hidden: false,
      complete: tagName === 'img' && !options.manualLoad,
      naturalWidth: tagName === 'img' && !options.manualLoad ? 224 : 0,
      attributes: {},
      className: '',
      textContent: '',
      children: [],
      parentNode: null,
      offsetWidth: 10,
      classList: { add() {}, remove() {} },
      setAttribute(key, value) {
        this.attributes[key] = value
      },
      getAttribute(key) {
        return this.attributes[key] ?? null
      },
      removeAttribute(key) {
        delete this.attributes[key]
      },
      listeners: {},
      addEventListener(name, listener) {
        ;(this.listeners[name] ??= []).push(listener)
      },
      removeEventListener(name, listener) {
        this.listeners[name] = (this.listeners[name] ?? []).filter((fn) => fn !== listener)
      },
      dispatch(name) {
        for (const listener of this.listeners[name] ?? []) listener({ type: name })
      },
      appendChild(child) {
        this.children.push(child)
        child.parentNode = this
        return child
      },
      removeChild(child) {
        const index = this.children.indexOf(child)
        if (index < 0) throw new Error('not a child')
        this.children.splice(index, 1)
        child.parentNode = null
        return child
      },
    }
    if (tagName === 'img') {
      if (options.decode) item.decode = () => options.decode(item)
      images.push(item)
    }
    return item
  }
  const roots = []
  mounted.documentStub.createElement = element
  mounted.documentStub.querySelectorAll = (selector) =>
    selector === '[data-chat-running]' ? roots : []
  function root(text = '深度求索中，用时 1 分 1 秒 ···') {
    const item = element()
    item.content = element()
    item.source = element()
    item.source.setAttribute('data-shimmer-text', text)
    item.querySelector = (selector) => {
      if (selector === '[class*="_runningContent"]') return item.content
      if (selector === '[data-shimmer-text]') return item.source
      return null
    }
    roots.push(item)
    return item
  }
  const tick = () => {
    const timer = mounted.intervals.findLast((item) => item.ms === 300 && !item.cancelled)
    assert.ok(timer, '轮播应有一个有效节拍')
    timer.callback()
  }
  // Phrase and playful aside share a `.dshh-runLine`; look through it and any nesting.
  const textNode = (item, className) => {
    const children = item.content.children[0]?.children ?? []
    const copy = children.find((child) => child.className === 'dshh-runCopy')
    const roots = copy ? copy.children : children
    const stack = [...roots]
    while (stack.length > 0) {
      const child = stack.shift()
      if (child.className === className) return child
      stack.push(...(child.children ?? []))
    }
    return undefined
  }
  const phrase = (item) => textNode(item, 'dshh-runPhrase')?.textContent
  const fun = (item) => textNode(item, 'dshh-runFun')?.textContent
  const funNode = (item) => textNode(item, 'dshh-runFun')
  const time = (item) => textNode(item, 'dshh-runTime')?.textContent
  const marked = (item) => item.getAttribute('data-dsh-hud-running-text') !== null
  const image = (item) =>
    item.content.children[0]?.children.find((child) => child.tagName === 'img')
  const candidate = () =>
    images.findLast((item) => item.onload !== null && typeof item.onload === 'function')
  const load = () => candidate()?.onload()
  return { roots, root, tick, phrase, fun, funNode, time, marked, image, candidate, load, images }
}
