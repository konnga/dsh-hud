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
/**
 * 每个组件上一次渲染的**钩子种类序列**（跨 mount 也保留 —— React 的规则是按组件函数算的）。
 *
 * 有了它，"条件钩子 / 提前 return 改了钩子数量"这类错误会在测试里直接抛出来，
 * 而不是等它在真 React 里把整个座位炸掉（曾经真的炸过：一行 dock 两枚胶囊一起消失）。
 */
const hookSequences = new Map()

export function createMiniReact() {
  let instance = null

  const React = {
    createElement(type, props, ...children) {
      return { type, props: props || {}, children }
    },

    useState(initial) {
      const slot = instance.index
      instance.hookKinds.push('state')
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
      instance.hookKinds.push('effect')
      instance.index += 1
      instance.pending.push({ slot, fn, deps })
    },
  }

  function runEffects() {
    const queue = instance.pending
    instance.pending = []
    for (const entry of queue) {
      const previous = instance.effects.get(entry.slot)
      const unchanged =
        previous !== undefined &&
        Array.isArray(entry.deps) &&
        Array.isArray(previous.deps) &&
        entry.deps.length === previous.deps.length &&
        entry.deps.every((value, index) => Object.is(value, previous.deps[index]))
      if (unchanged) continue
      if (previous && typeof previous.cleanup === 'function') previous.cleanup()
      instance.effects.set(entry.slot, { deps: entry.deps, cleanup: entry.fn() })
    }
  }

  function renderOnce(component, props) {
    instance.index = 0
    instance.hookKinds = []
    instance.pending = []
    instance.tree = component(props)
    // React 的规则：同一次渲染里钩子的**数量与顺序**必须与上次一致。
    const kinds = instance.hookKinds.join(' → ')
    // 按**组件名**记账：每个用例都会重新求值模块，组件函数是新的对象，WeakMap 永远匹配不上，
    // 这道校验就形同虚设（第一版就是这样，撤掉修复也"全绿" ✗）。同名组件在同一进程里
    // 钩子用法是静态的，所以用名字做键既稳又不会误报。
    const key = component.name || '(anonymous)'
    const previous = hookSequences.get(key)
    if (previous !== undefined && previous !== kinds) {
      throw new Error(
        `组件 ${component.name || '(匿名)'} 的钩子数量/顺序变了：上次 [${previous}]，这次 [${kinds}]。` +
          ' 这通常是条件钩子或"提前 return 跳过了某些钩子" —— 真 React 会直接抛错并让整棵子树消失。',
      )
    }
    hookSequences.set(key, kinds)
    runEffects()
    return instance.tree
  }

  return {
    React,

    /** 挂载组件，返回第一棵渲染树；之后的 state 变化会同步刷新。 */
    mount(component, props) {
      instance = {
        state: {},
        effects: new Map(),
        pending: [],
        index: 0,
        hookKinds: [],
        tree: null,
        rerender: () => {},
      }
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
