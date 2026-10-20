/**
 * 输入框（composer）读写与 ↑ 召回。
 *
 * 这里全部是**纯 DOM 操作**（Lexical 的 contenteditable），最讲究的是"写进去之后到底成没成"：
 * 粘贴是异步落地的，所以每次写完都要等一拍再核对（`settleComposer`），否则会写第二遍。
 */

import { probe } from './shared.js'
import type { HudStore } from './shared.js'

/* ------------------------------------------------------- 输入框的 DOM 面 */

/**
 * 插件只用到输入框根节点的这几样：找根（`getAttribute` / `isContentEditable` /
 * `parentElement`）、读文本（`innerText` / `textContent`）、写回（`textContent` /
 * `dispatchEvent`）。用**结构类型**而不是 `HTMLElement`：测试里的假 DOM 也满足它，
 * 真实节点天然满足 —— 这里要的本来也不是"一个 HTMLElement"，而是"能当输入框用的节点"。
 */
interface ComposerRoot {
  getAttribute?: (name: string) => string | null
  isContentEditable?: boolean
  parentElement?: ComposerRoot | null
  innerText?: string
  textContent?: string | null
  dispatchEvent?: (event: Event) => boolean
}

/**
 * 结构类型 → 真 `Node`。运行时它本来就是 contenteditable 元素；`ComposerRoot` 只是为了让
 * 测试里的假 DOM 也能满足，所以这里不做运行时检查，只把类型交回给 DOM API。
 */
function nodeOf(root: ComposerRoot): Node {
  return root as unknown as Node
}

/** 历史翻页方向。 */
type HistoryDirection = 'up' | 'down'
/** 翻完之后光标摆在哪一端。 */
type HistoryCaret = 'start' | 'end'

/** 翻页状态机自己的状态：不在历史里时 `index === -1`。 */
interface PromptHistoryNavState {
  index: number
  draft: string | null
}

/** 翻页输入：历史条目（新的在前）与当前输入框的文本/光标。 */
interface PromptHistoryInput {
  entries: string[]
  text?: string
  caret?: number
}

/** 状态机结果：没接管时调用方什么都不做；接管时必然给出要写入的文本与光标位置。 */
type PromptHistoryStep =
  | { handled: false; state: PromptHistoryNavState }
  | { handled: true; state: PromptHistoryNavState; text: string; caret: HistoryCaret }

/* ------------------------------------------------------------- 文案 */

/* --------------------------------------------------------- 本地 UI 状态 */

/**
 * 光标此刻允许上下翻历史吗？—— 照抄 OpenCode Desktop 的 `canNavigateHistoryAtCursor`。
 *
 * 它的规矩比 Codex 保守得多：**不在历史里时，`↑` 只在输入框完全为空时才接管**。
 * 于是多行草稿里 `↑` 永远是光标移动，跟内置的 `/` 命令、`@` 提及弹窗也天然不冲突
 * （弹窗必然带着文字）。进了历史之后，只要光标在两端就能继续翻。
 */
export function canNavigatePromptHistory(
  direction: HistoryDirection,
  text: string,
  caret: number,
  inHistory: boolean,
): boolean {
  var length = typeof text === 'string' ? text.length : 0
  var position = Math.max(0, Math.min(typeof caret === 'number' ? caret : 0, length))
  if (inHistory) return position === 0 || position === length
  if (direction === 'up') return position === 0 && length === 0
  return position === length
}

/**
 * `↑` / `↓` 翻 prompt 历史的**纯状态机**（语义照抄 OpenCode Desktop 的 `navigatePromptHistory`）。
 *
 * `index === -1` 表示"不在历史里"；`entries[0]` 是最新一条。往旧翻时先把当前草稿存进
 * `draft`，一直翻到最新再往下就把草稿**原样放回**（连光标位置都按方向摆好：往旧放开头、
 * 往新放末尾）。没接管的情况一律回 `handled: false`，调用方据此**不**调用 preventDefault。
 */
export function promptHistoryStep(
  state: PromptHistoryNavState,
  direction: HistoryDirection,
  input: PromptHistoryInput | null | undefined,
): PromptHistoryStep {
  var entries = (input && input.entries) || []
  var text = input && typeof input.text === 'string' ? input.text : ''
  var caret = input && typeof input.caret === 'number' ? input.caret : 0
  var index = state.index
  var draft = state.draft

  if (!canNavigatePromptHistory(direction, text, caret, index >= 0))
    return { handled: false, state: state }

  if (direction === 'up') {
    if (entries.length === 0) return { handled: false, state: state }
    if (index === -1)
      return { handled: true, state: { index: 0, draft: text }, text: entries[0], caret: 'start' }
    if (index < entries.length - 1) {
      return {
        handled: true,
        state: { index: index + 1, draft: draft },
        text: entries[index + 1],
        caret: 'start',
      }
    }
    return { handled: false, state: state } // 已经到最旧一条：把 ↑ 还给编辑器
  }

  if (index > 0)
    return {
      handled: true,
      state: { index: index - 1, draft: draft },
      text: entries[index - 1],
      caret: 'end',
    }
  if (index === 0) {
    return {
      handled: true,
      state: { index: -1, draft: null },
      text: draft === null || draft === undefined ? '' : draft,
      caret: 'end',
    }
  }
  return { handled: false, state: state }
}

/* -------------------------------------------- 输入框的 ↑ 召回（纯文本） */

/**
 * 从一个事件目标往上找"输入框根节点"。
 *
 * DSH 的输入框是 **Lexical** 的 contenteditable（根节点带 `data-lexical-editor="true"`），
 * 不是 textarea —— 所以不能读 `value`。手写 parentElement 上溯（不用 `closest`）：
 * 一来少依赖一个 API，二来深度有上限，绝不会误判到页面别处。
 */
export function composerRootOf(target: unknown): ComposerRoot | null {
  // 事件目标是 DOM 边界：调用方可能是 EventTarget，我们按结构类型读它的属性。
  var node = target as ComposerRoot | null | undefined
  for (var depth = 0; depth < 6 && node !== null && node !== undefined; depth += 1) {
    if (typeof node.getAttribute === 'function') {
      var marker = node.getAttribute('data-lexical-editor')
      var editable =
        typeof node.isContentEditable === 'boolean'
          ? node.isContentEditable
          : node.getAttribute('contenteditable') === 'true'
      if (marker === 'true' || editable) return node
    }
    node = node.parentElement
  }
  return null
}

/** 输入框里的纯文本（Lexical 会把内容画在 DOM 里，`innerText` 最贴近用户看到的）。 */
export function composerText(root: ComposerRoot | null | undefined): string {
  if (root === null || root === undefined) return ''
  var text =
    typeof root.innerText === 'string'
      ? root.innerText
      : typeof root.textContent === 'string'
        ? root.textContent
        : ''
  return text.replace(/\u200b/g, '')
}

/**
 * "输入框实际上是空的吗"用的归一化文本。
 *
 * Lexical 的空根节点在 DOM 里通常是 `<p><br></p>`，`innerText` 会给出一个换行符 ——
 * 拿它当"有内容"就会让 `↑` 永远排不上队（整个功能静默失效）。所以去掉零宽字符与
 * **只在末尾的空白**：开头的空格是用户真的敲进去的，不能吞。
 */
export function composerTextKey(root: ComposerRoot | null | undefined): string {
  return composerText(root).replace(/\s+$/, '')
}

/** 写入是否成功：两边都归一化再比 —— Lexical 可能补一个尾换行，那不是"没写进去"。 */
export function composerTextMatches(text: string, expected: string): boolean {
  return text.replace(/\s+$/, '') === expected.replace(/\s+$/, '')
}

/** 光标在输入框里的字符偏移；没有选区、有选中内容、或拿不到选区时回 null（一律不接管）。 */
export function composerCaretOffset(root: ComposerRoot): number | null {
  var selection = typeof window.getSelection === 'function' ? window.getSelection() : null
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed !== true) return null
  var node = selection.focusNode
  if (!node) return null
  var range = document.createRange()
  range.selectNodeContents(nodeOf(root))
  var before = range.cloneRange()
  try {
    before.setEnd(node, selection.focusOffset)
  } catch (error) {
    return null
  }
  return before.toString().length
}

/** 把光标放到开头或末尾（`↑` 往旧翻放开头，`↓` 往回翻放末尾 —— 与 OpenCode 一致）。 */
export function placeCaretInComposer(root: ComposerRoot, position: HistoryCaret): void {
  var selection = typeof window.getSelection === 'function' ? window.getSelection() : null
  if (!selection) return
  try {
    var range = document.createRange()
    range.selectNodeContents(nodeOf(root))
    range.collapse(position !== 'end')
    selection.removeAllRanges()
    selection.addRange(range)
  } catch (error) {
    // 光标没摆好不影响内容已经写进去了
  }
}

/** 全选输入框内容（模拟粘贴前先选中，粘贴才能"替换"而不是"追加"）。 */
export function selectComposerContents(root: ComposerRoot): void {
  var selection = typeof window.getSelection === 'function' ? window.getSelection() : null
  if (!selection) return
  try {
    var range = document.createRange()
    range.selectNodeContents(nodeOf(root))
    selection.removeAllRanges()
    selection.addRange(range)
  } catch (error) {
    // 选不中也还能走 execCommand 那条退路
  }
}

/** 等"写入落地"：微任务总有，有 rAF 的浏览器里再多等一帧（Lexical 的粘贴是帧后落 DOM）。 */
export function settleComposer(): Promise<void> {
  var chain = Promise.resolve()
  if (typeof window.requestAnimationFrame === 'function') {
    chain = chain.then(function () {
      return new Promise(function (resolve) {
        window.requestAnimationFrame(function () {
          resolve()
        })
      })
    })
  }
  return chain
}

/**
 * 把一段纯文本写进 Lexical 输入框 —— **三层依次降级，每层都等落地了再回读**。
 *
 * 为什么要等：Lexical 的粘贴处理是**异步**的（它得先把剪贴板读出来）。写完立刻回读会读到
 * 旧内容、误判成失败，于是下一层再插一次 —— 实测表现就是**文字出现两遍**（第一次真机上
 * 就是这样：粘贴插了一遍，`insertText` 又追加了一遍）。
 *
 * 三层次序：① 模拟粘贴（Lexical 的正规插入通道）② `execCommand("insertText")`
 * ③ 直接改文本 + 派发 `input`。**每次降级前都重新全选**，让重试是"替换"而不是"追加"。
 */
export function writeComposerText(
  root: ComposerRoot,
  value: string,
  caret: HistoryCaret,
): Promise<boolean> {
  function satisfied() {
    return composerTextMatches(composerText(root), value)
  }

  return settleComposer()
    .then(function () {
      if (typeof window.ClipboardEvent !== 'function' || typeof window.DataTransfer !== 'function')
        return false
      if (typeof root.dispatchEvent !== 'function') return false
      try {
        selectComposerContents(root)
        var data = new window.DataTransfer()
        data.setData('text/plain', value)
        root.dispatchEvent(
          new window.ClipboardEvent('paste', {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        )
      } catch (error) {
        return false
      }
      return settleComposer().then(satisfied)
    })
    .then(function (wrote) {
      if (wrote) return true
      try {
        if (typeof document.execCommand === 'function') {
          selectComposerContents(root)
          if (document.execCommand('insertText', false, value) === true) {
            return settleComposer().then(satisfied)
          }
        }
      } catch (error) {
        // 落到最后一层
      }
      return settleComposer().then(function () {
        if (satisfied()) return true
        try {
          selectComposerContents(root)
          root.textContent = value
          // 上一层的不变量（dispatchEvent 存在）不跨回调作用域，这里用 ! 保留原来的"抛了就被 catch 掉"语义。
          if (typeof window.Event === 'function')
            root.dispatchEvent!(new window.Event('input', { bubbles: true }))
          return true
        } catch (error) {
          return false
        }
      })
    })
    .then(function (wrote) {
      if (!wrote) return false
      placeCaretInComposer(root, caret)
      // 重写内容会让编辑器失焦/滚动跳，下一帧再摆一次光标（OpenCode 也是这么做的）。
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(function () {
          placeCaretInComposer(root, caret)
        })
      }
      return true
    })
}

/**
 * 把"输入框里按 ↑/↓ 召回上一条 prompt"接到窗口上 —— 只接线，判断与翻页逻辑都在纯函数里。
 *
 * 门禁（任一不满足就**完全不介入**，`↑`/`↓` 行为与不装插件时一模一样）：
 * 默认行为没被别处吃掉、不是输入法组合中、无修饰键、目标是输入框、历史非空、
 * 选区收起、光标位置通过 `canNavigatePromptHistory`。**接管了才 preventDefault**。
 */
export function bindPromptHistory(store: HudStore): () => void {
  var nav: { sessionId: string | null; index: number; draft: string | null; writing: boolean } = {
    sessionId: null,
    index: -1,
    draft: null,
    writing: false,
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event === null || event === undefined) return
    if (event.defaultPrevented === true || event.isComposing === true) return
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    if (event.altKey === true || event.ctrlKey === true || event.metaKey === true) return
    if (typeof event.preventDefault !== 'function') return

    var root = composerRootOf(event.target)
    if (root === null) return

    var snapshot = store.getSnapshot().promptHistory
    var value =
      snapshot !== null && snapshot !== undefined && snapshot.sessionId !== null
        ? snapshot.value
        : null
    var entries =
      value !== null &&
      value !== undefined &&
      value.available === true &&
      Array.isArray(value.prompts)
        ? value.prompts
        : []
    if (entries.length === 0) return

    if (nav.sessionId !== snapshot.sessionId) {
      nav.sessionId = snapshot.sessionId
      nav.index = -1
      nav.draft = null
    }

    var caret = composerCaretOffset(root)
    if (caret === null) return
    var direction: HistoryDirection = event.key === 'ArrowUp' ? 'up' : 'down'
    // 归一化后再判"空不空"与"光标在哪端"：Lexical 空输入框里的那个换行不算内容。
    var text = composerTextKey(root)
    var step = promptHistoryStep({ index: nav.index, draft: nav.draft }, direction, {
      entries: entries,
      text: text,
      caret: Math.max(0, Math.min(caret, text.length)),
    })
    if (!step.handled) return

    // 到这里才确定要接管：先挡住默认行为（别让 ↑ 先把光标移走），再写内容。
    event.preventDefault()
    if (typeof event.stopPropagation === 'function') event.stopPropagation()

    // 写入是异步的（粘贴要等落地），但翻页状态先记下：连按 ↑ 时不会两次都从同一条开始。
    // 真写不进去再回滚 —— 宁可状态与画面都对不上时退回一步，也不要悄悄漂移。
    var previous = { index: nav.index, draft: nav.draft }
    nav.index = step.state.index
    nav.draft = step.state.draft
    nav.writing = true

    writeComposerText(root, step.text, step.caret).then(function (wrote) {
      nav.writing = false
      if (wrote === true) {
        probe.log('prompt-history', {
          index: nav.index,
          entries: entries.length,
          direction: direction,
        })
        return
      }
      nav.index = previous.index
      nav.draft = previous.draft
      probe.log('prompt-history: 写不进输入框（三层都失败），已回滚并放弃接管', {
        entries: entries.length,
      })
    })
  }

  /** 用户自己动了内容（不是我们写进去的）→ 退出历史、草稿作废，免得把草稿还原到新内容上。 */
  function onInput(event: Event): void {
    if (nav.writing) return
    if (composerRootOf(event && event.target) === null) return
    nav.index = -1
    nav.draft = null
  }

  if (typeof window.addEventListener !== 'function') return function () {}
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('input', onInput, true)
  return function () {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('input', onInput, true)
  }
}
