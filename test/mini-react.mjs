/**
 * 极简 React 运行时：只实现组件交互测试需要的那部分 hooks 语义。
 *
 * - `useState` 写入后同步重渲染，`useEffect` 做依赖比较并在重跑前清理；
 * - 因此「点击 ✕ 是否真的触发 onClick」「拖动是否真的注册了 window 监听」
 *   这类**交互路径**可以被断言，而不只是断言 handler 存在。
 *
 * 它不是 React 的替代品：没有 children 协调、没有并发、没有事件系统 ——
 * 我们只把组件当成函数调用，并记录它返回的元素树。
 */
export function createMiniReact() {
  let instance = null

  const React = {
    createElement(type, props, ...children) {
      return { type, props: props || {}, children }
    },

    useState(initial) {
      const slot = instance.index
      instance.index += 1
      if (!Object.prototype.hasOwnProperty.call(instance.state, slot)) {
        instance.state[slot] = typeof initial === 'function' ? initial() : initial
      }
      const read = instance.state[slot]
      const write = (next) => {
        const value = typeof next === 'function' ? next(instance.state[slot]) : next
        if (Object.is(value, instance.state[slot])) return value
        instance.state[slot] = value
        instance.rerender()
        return value
      }
      return [read, write]
    },

    useEffect(fn, deps) {
      const slot = instance.index
      instance.index += 1
      instance.pending.push({ slot, fn, deps })
    },
  }

  function runEffects() {
    const queue = instance.pending
    instance.pending = []
    for (const entry of queue) {
      const previous = instance.effects.get(entry.slot)
      const unchanged = previous !== undefined
        && Array.isArray(entry.deps)
        && Array.isArray(previous.deps)
        && entry.deps.length === previous.deps.length
        && entry.deps.every((value, index) => Object.is(value, previous.deps[index]))
      if (unchanged) continue
      if (previous && typeof previous.cleanup === 'function') previous.cleanup()
      instance.effects.set(entry.slot, { deps: entry.deps, cleanup: entry.fn() })
    }
  }

  function renderOnce(component, props) {
    instance.index = 0
    instance.pending = []
    instance.tree = component(props)
    runEffects()
    return instance.tree
  }

  return {
    React,

    /** 挂载组件，返回第一棵渲染树；之后的 state 变化会同步刷新。 */
    mount(component, props) {
      instance = { state: {}, effects: new Map(), pending: [], index: 0, tree: null, rerender: () => {} }
      instance.rerender = () => renderOnce(component, props)
      return renderOnce(component, props)
    },

    /** 最新一棵渲染树。 */
    current() {
      return instance.tree
    },

    /** 卸载：跑掉所有 effect 清理函数（断言监听被解除）。 */
    unmount() {
      for (const { cleanup } of instance.effects.values()) {
        if (typeof cleanup === 'function') cleanup()
      }
      instance = null
    },
  }
}
