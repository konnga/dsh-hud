/**
 * dsh-hud — 浏览器半（`dsh.client` bundle）的**插件面**。
 *
 * 两个座位，一个共享 store：
 *
 *   - `conversation.input.dock` → 胶囊：输入框上方那一行里靠左的紧凑状态胶囊
 *     （分支摘要，或"非 git 仓库"），点击开关面板。这个座位是**会话作用域**，
 *     框架直接把当前 `sessionId` 交给它，它再从 `useSessions` 快照里取该会话的
 *     `cwd` 写进共享 store —— 这是 root 作用域的面板**读不到**的东西。
 *   - `shell.overlay` → 悬浮面板：收起来时渲染 `null`（不留会挡住输入框的气泡），
 *     展开时是悬浮面板，默认停在输入框上方。
 *
 * 所有 git 工作都在宿主半（`/dsh-hud-rpc`）；这里只负责座位注册、轮询节拍、
 * 语言字典与样式注入 —— 具体行为都在 store / hooks / components 里。
 *
 * ⚠️ `lib/client.js` 是从 `src/client/**` **打包出来的产物**（`npm run build`）：浏览器半只支持
 * "一个经典脚本"，所以源码分模块、产物是单文件（见 `rolldown.config.mjs`）。别直接改产物。
 */

import { CSS } from './styles.js'
import { HudDockPill } from './components/dock-pill.js'
import { HudFloatingPanel } from './components/floating-panel.js'
import { PillTip } from './components/pill-tip.js'
import { TokenPanel } from './components/token-panel.js'
import { SessionMenuSummary, SessionRowHoverChip } from './components/sidebar.js'
import { TurnImages } from './components/turn-images.js'
import { bindPromptHistory } from './composer.js'
import { en, zh } from './i18n.js'
import {
  BALANCE_POLL_MS,
  NS,
  POLL_MS,
  PROVIDER_POLL_MS,
  PROVIDER_RETRY_TICK_MS,
  ROWS_POLL_MS,
  TOOLS_POLL_MS,
  probe,
} from './shared.js'
import { watchModelSelection } from './model-watch.js'
import { createStore } from './store/index.js'
import type { StoreContext } from './store/types.js'
import { cssChipsGap, ensureStyles } from './styles-apply.js'
// 侧栏标记删掉之后，这份数据只剩"悬停卡片 / ⋯ 菜单"两处**按需展示**在用 ——
// 所以从 12s 放宽到 30s：按下不表的东西没必要那么勤地去问 git。

export var inject = ['slots', 'connection', 'locale']

/* --------------------------------------------------------- 框架注入面 */

/**
 * 客户端插件上下文里用到的部分（框架给的 `ctx`）。
 *
 * 座位定义在注册时才拿到 `sessionId`（会话作用域座位有、root 作用域没有），
 * 所以这里把 `inject` 的形参声明出来，让回调里的 `sessionId` 有类型可依。
 */
interface HudSlotDefinition {
  name: string
  id: string
  order?: number
  locale?: string
  inject?: (sessionId?: string) => Record<string, unknown>
}

interface HudSlots {
  inject(slot: string, callback: () => unknown): unknown
  register(definition: HudSlotDefinition, component: unknown): unknown
}

interface HudLocale {
  register(
    namespace: string,
    dictionaries: { zh: Record<string, string>; en: Record<string, string> },
  ): (() => void) | void
}

interface HudPluginContext extends StoreContext {
  slots: HudSlots
  locale: HudLocale
  /** 按名取其它客户端服务；宿主没装那个半边时返回 `undefined`（`sessions` 就是软依赖）。 */
  get: (name: string) => unknown
}

/* ---------------------------------------------------------------- 插件 */

/**
 * 客户端插件主体。
 * @param ctx - 客户端根上下文（slots、connection、locale）。
 */
export function apply(ctx: HudPluginContext): void {
  ctx.effect(function () {
    return ctx.locale.register(NS, { zh: zh, en: en })
  }, 'dsh-hud: dictionaries')

  ctx.effect(function () {
    var element = ensureStyles()
    return function () {
      if (element && element.parentNode) element.parentNode.removeChild(element)
    }
  }, 'dsh-hud: styles')

  var store = createStore(ctx)

  // 起手留一行：诊断里**有没有这一行**就足以区分"客户端半压根没加载"与"加载了但
  // 哪一环没接上"（这一行由 apply 发，与后面的投影/名单无关）。
  probe.log('apply', {
    inject: typeof ctx.inject === 'function',
    slots: typeof ctx.slots === 'object',
    // 跑着的那一版自有样式表里，计数芯片的间隔是多少：改完样式没生效时用它分辨
    // "bundle 还是旧的"还是"规则没生效"。
    chips: cssChipsGap(CSS),
  })

  // 面板与胶囊都要能反映磁盘上的实时变化；页面不可见时不打请求。
  // 顺手补一次样式表：框架的 HMR 记账会把插件的 `<style>` 删掉，删掉就自愈。
  ctx.effect(function () {
    var id = window.setInterval(function () {
      if (document.visibilityState === 'hidden') return
      ensureStyles()
      store.refresh()
    }, POLL_MS)
    return function () {
      window.clearInterval(id)
    }
  }, 'dsh-hud: status poll')

  // 从别处回到页面时立刻补一次（定时器在隐藏期间被跳过）。
  ctx.effect(function () {
    var onFocus = function () {
      ensureStyles()
      store.refresh()
    }
    window.addEventListener('focus', onFocus)
    return function () {
      window.removeEventListener('focus', onFocus)
    }
  }, 'dsh-hud: focus refresh')

  // 余额（账号那一路 + 当前模型来源那一路）：**最慢的一条节拍**（默认 5 分钟）。
  //
  // 它背后是宿主替我们去 DeepSeek 平台查账（一次真实网络请求），而余额按分钟变；
  // 页面隐藏时照例跳过。点击胶囊会带 `force` 立刻重取一次（见 `balance-pill.ts`）。
  // 这一条起手也跑一次：胶囊要在首屏就出现，而不是等五分钟。
  ctx.effect(function () {
    store.loadBalance()
    var id = window.setInterval(function () {
      if (document.visibilityState === 'hidden') return
      store.loadBalance()
    }, BALANCE_POLL_MS)
    return function () {
      window.clearInterval(id)
    }
  }, 'dsh-hud: account balance poll')

  /**
   * 「当前会话模型来源」的余额：自己的节拍，比账号那一路快。
   *
   * 为什么是 30 秒而不是 5 分钟：第一次取数常常赶在投影就绪之前（刚开会话、刚换模型），
   * 那时宿主答不上来；如果下一次机会在五分钟之后，胶囊就有五分钟是空白的。
   * 真实请求次数由 store 自己的 TTL 兜着（成功 60s、失败 30s），这里只是"多久问一次"。
   */
  ctx.effect(function () {
    var stopped = false
    var handle: number | null = null

    /**
     * 下一次隔多久再问。
     *
     * 稳态是 `PROVIDER_POLL_MS`（30 秒）；**还没问出来**的时候用 1 秒重问 ——
     * 这才是"重启后胶囊迟迟不出现"的症结：宿主在刚启动那一下常常还读不到模型选择投影，
     * 第一次问必然落空，而原来的固定 30 秒节拍意味着胶囊要空半分钟。
     * 真实请求次数仍由 store 的 TTL 兜着（成功 60s、失败按 1s 起指数退避到 30s），
     * 这里只是"多久看一眼"，看的时候多半是空转。
     */
    function nextDelay(): number {
      var ledger = store.getSnapshot().provider
      var settled =
        ledger !== undefined &&
        ledger !== null &&
        ledger.mode !== 'unknown' &&
        typeof ledger.provider === 'string' &&
        ledger.provider !== ''
      return settled ? PROVIDER_POLL_MS : PROVIDER_RETRY_TICK_MS
    }

    function tick(): void {
      if (stopped) return
      if (document.visibilityState !== 'hidden') store.loadProviderBalance()
      // 用 `window.setTimeout`（而不是裸 `setTimeout`）：测试 harness 只替换 `window.*`，
      // 裸调用会落到真的 Node 定时器上 —— 表现就是"用例全过、进程永不退出"。
      handle = window.setTimeout(tick, nextDelay())
    }

    tick()
    return function () {
      stopped = true
      if (handle !== null) window.clearTimeout(handle)
    }
  }, 'dsh-hud: provider balance poll')

  // 换模型 = 换账本：TTL 按时钟算、不按事实算，所以模型一变就得主动重取一次
  // （否则切到中转站之后会先盯着平台账号的 `¥8.60` 看满一分钟）。
  ctx.effect(function () {
    return watchModelSelection(ctx, store)
  }, 'dsh-hud: model selection -> provider balance')

  // 悬停气泡单独一枚 overlay 座位：它要浮在 dock 行之外（行内会被裁切/堆叠上下文限制）。
  // order 比面板小 —— 面板开着时仍然压在最上层。
  ctx.slots.inject('shell.overlay', function () {
    return ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'dsh-hud-pill-tip',
        order: 10,
        locale: NS,
        inject: function () {
          return { store: store }
        },
      },
      PillTip,
    )
  })

  // 后台令牌设置面板：与气泡同一层（都是浮在 dock 之上、面板之下）。
  ctx.slots.inject('shell.overlay', function () {
    return ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'dsh-hud-token-panel',
        order: 15,
        locale: NS,
        inject: function () {
          return { store: store }
        },
      },
      TokenPanel,
    )
  })

  ctx.slots.inject('shell.overlay', function () {
    return ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'dsh-hud-panel',
        order: 20,
        locale: NS,
        inject: function () {
          return { store: store }
        },
      },
      HudFloatingPanel,
    )
  })

  // 侧栏行内 chip 的数据：起手取一次，之后按自己的节奏更新（页面隐藏时跳过）。
  ctx.effect(function () {
    store.refreshRows()
    var id = window.setInterval(function () {
      if (document.visibilityState === 'hidden') return
      store.refreshRows()
    }, ROWS_POLL_MS)
    return function () {
      window.clearInterval(id)
    }
  }, 'dsh-hud: session rows poll')

  // 工具活动单独一条节拍（3s；宿主是内存读，密一点才看得到"正在跑"）。
  //
  // 走 `store.loadTools()`：这里**曾经是裸 `loadTools()`**，而那个函数只存在于 store 内部、
  // 也没暴露出来 —— 于是这条节拍每 3 秒抛一次 ReferenceError（被 interval 吞掉，只在控制台
  // 留痕），工具读数实际靠 `refresh()` 的 8 秒节拍在维持。已暴露并改为经 store 调用。
  ctx.effect(function () {
    var id = window.setInterval(function () {
      if (document.visibilityState === 'hidden') return
      store.loadTools()
    }, TOOLS_POLL_MS)
    return function () {
      window.clearInterval(id)
    }
  }, 'dsh-hud: tool activity poll')

  // `⋯` 菜单里的一条只读摘要：行尾拿不到常亮座位，这里是最实在的"完整信息"落点。
  ctx.slots.inject('sidebar.workspaces.session.menu.item', function () {
    return ctx.slots.register(
      {
        name: 'sidebar.workspaces.session.menu.item',
        id: 'dsh-hud-session-menu',
        order: 30,
        locale: NS,
        inject: function () {
          return { store: store }
        },
      },
      SessionMenuSummary,
    )
  })

  // 悬停卡片里那块详情（宽敞的地方；动作条那枚放不下的东西都在这儿）。
  ctx.slots.inject('sidebar.session.row.hover', function () {
    return ctx.slots.register(
      {
        name: 'sidebar.session.row.hover',
        id: 'dsh-hud-session-hover',
        order: 30,
        locale: NS,
        inject: function () {
          return { store: store }
        },
      },
      SessionRowHoverChip,
    )
  })

  ctx.slots.inject('conversation.input.dock', function () {
    return ctx.slots.register(
      {
        name: 'conversation.input.dock',
        id: 'dsh-hud-pill',
        order: 20,
        locale: NS,
        inject: function (sessionId) {
          return { store: store, sessionId: sessionId }
        },
      },
      HudDockPill,
    )
  })

  // 轮尾（内置「已编辑 N 个文件」卡片所在的那条尾巴）的一扇门：本轮动过图，
  // 点缩略图就在内置文档预览里打开；`⇄` 才进本面板看前后对比。
  ctx.slots.inject('conversation.chat.turnTail', function () {
    return ctx.slots.register(
      {
        name: 'conversation.chat.turnTail',
        id: 'dsh-hud-turn-images',
        order: 30,
        locale: NS,
        inject: function (sessionId) {
          return { store: store, sessionId: sessionId }
        },
      },
      TurnImages,
    )
  })

  // 输入框里的 ↑ 召回（纯文本）：**最后接线** —— 逻辑全在纯函数里，这一层只负责
  // 读值 / 写值 / 摆光标，且**真接管了才拦默认行为**。刻意排在最后注册，好让
  // "第一个 keydown 监听是面板那条"这个既有事实保持不变。
  ctx.effect(function () {
    return bindPromptHistory(store)
  }, 'dsh-hud: prompt history (↑ 召回)')
}
