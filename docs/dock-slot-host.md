# 把 composer dock 那一行做成可注册的行内宿主

**提案**：dsh-hud 现在往 `conversation.input.dock` 注册一枚胶囊，占掉的是整行。改成"dsh-hud 只注册**一个容器**，并在同一次注册里声明两条私有子座位（lane），别的插件把自己的小块注册进 lane"——让别人花掉一格，而不是一行。
**核实基准**：产品代码 `/tmp/dsh_asar/dsh/node_modules/@deepseek-ai/`（`lib/*.js` 为编译产物，行号即该文件行号）；本仓库 `/Users/cheng/Documents/code/konnga/dsh-hud`；第三方实例 `~/.dsh/profiles/desktop/node_modules/@xia-sc/dsh-git@0.7.1`。行号按写作时的工作树；仓库里的行号随改动会漂，所以每条都同时给了可检索的标识符。

## 1. 问题：那条座位是一列，不是一条

核实到的四个事实：

1. **座位是 `list`，且渲染在竖排容器里。** `conversation.input.dock` 由 factory `conversation.content` 声明为 `{ kind: "list", scope: "session" }`（`dsh-client-ui-conversation/lib/client.js:18167`），产品静态目录里的说明是 "Full-width entries above the composer card"（`dsh-cordis-client-runner/lib/client.js:3004-3010`）。它渲染进 `.composerStack`（同文件 `:16309`），而 `.composerStack` 是 `flex-direction: column; gap: var(--dsh-composer-stack-gap, 6px)`（同文件 `:15797` 的 CSS 片段）；outlet 外壳用 `display: contents`（`dsh-client-ui-renderer/lib/client.js:1094`）。**一条注册 = 一个 flex item = 一整行**，一枚小胶囊也要占满一行。
2. **这条列上已经排了至少五条。** `grep -rn 'conversation.input.dock'` 结果：产品 `queue`（order 20，`ui-conversation:15677`）、`todo`（order 0，`:17752`）、`goal`（order 10，`dsh-client-ui-goal/lib/client.js:557`）；第三方 `dsh-git-pill`（order 20，`@xia-sc/dsh-git/lib/client.js:3192`）与本仓库 `dsh-hud-pill`（order 20，`lib/client.js:2568`，检索 `grep -n 'conversation.input.dock' lib/client.js`）。三枚胶囊的 order 和产品的 queue 撞在 20：list 的排序是 priority 升序 → order 升序，同值保持登记顺序（`dsh-client-ui-slots/lib/index.js:221` 的 sort，渲染端再按 order 稳定排序一次，`renderer:1193`），所以"我排第几"实际由加载顺序决定，插件无法自证。
3. **对齐几何是各抄一份，而且抄得不一样。** 产品把三个变量定义在 `.body`/`.embeddedBody` 上（`--dsh-composer-card-max-width` / `--dsh-composer-side-clearance` / `--dsh-composer-dock-inset`，`ui-conversation:15797`），没有对外契约。于是同一行里：
   - `queue` 的 dock 壳：`width: calc(100% - clearance*2 - inset*2)`，`max-width: calc(card-max-width - inset*2)`，另外自己 `margin-bottom: calc(0px - gap - 3px)`；
   - `goal` 的 dock 壳：`width: calc(100% - clearance*2 - inset*4)`，**没有** `max-width`；
   - `todo` 的 TodoPanel 卡（同文件 `:17624-17625` 的 `TodoPanel.module.css` 片段）：两个方向都减 4 个 inset；
   - 本仓库 `.dshh-dock`（检索 `grep -n 'dshh-dock{' lib/client.js`，当前 `:2325` 起）：减 2 个 inset，带 952px / 16px / 8px 兜底。
   inset 默认 8px：同一条座位上的 queue 与 todo，盒宽公式就差了 2 个 inset（16px），queue 还自己加了一层 `padding: 0 inset`——两条 entry 的卡片左边缘并不在同一个位置。
4. **产品自己的答案是"别挤这行"。** `shell.overlay` 的目录文档写着它 "deliberately generic and unowned by any feature: a badge, a toast stack or a status pill all belong here"（`runner:4816`）。也就是说：一枚状态胶囊放进竖列，是在用不合适的座位做对的事。

对用户的实际后果：

- **竖向浪费**：三枚小胶囊 = 三行 + 两个 6px 间隙，全在输入框正上方那块本来就紧的地方；产品自己的两条还各自带一张卡（QueueDock 的圆角背景、TodoPanel 的圆角背景）。
- **位置互相牵连**：dsh-hud 的悬浮面板锚点是"实测自己那枚胶囊所在行的位置"（README「面板为什么贴着胶囊」），另一条 entry 出现/消失会改变列高，面板随之漂；量不到时回落到 `COMPOSER_OFFSET = 168`（`lib/client.js:43`），那是 dsh-git 记下的数字，不是契约。
- **样式不一致**：dsh-git 用内联样式画胶囊，dsh-hud 用自己的样式表画胶囊，产品用模块样式画卡片——同一行三种"胶囊"。
- **崩溃不可读**：某条 entry 抛错时框架把该 cell 换成 `<div data-slot-error="…">x<id></div>`（`renderer:1196`），而产品**没有任何 CSS 给 `[data-slot-error]`**（grep 只命中 renderer 的 JSX），用户看到的是一行裸文字 `xdsh-hud-pill`。

## 2. 可行性：能在座位里再开插座吗

**能，不需要产品改一行代码，而且产品自己就是这么搭界面的。** 机制是 `register()` 的 `children` 声明表：

- `dsh-client-ui-slots/lib/index.js:193-215`：一次注册可以带 `children`，每条子座位被记成 `declaredBy = 'an entry in "<父座位>" (<registrant>)'`、`parent = "<父座位>"`，并推进 `declarationEpoch`；子座位 key 已被别人声明过则直接抛 `slot "X" is already declared`。
- `dsh-client-ui-renderer/lib/client.js:733`：当 entry 声明了 `children`，框架给这个组件一个**只对它有效**的 `renderSlot` prop；拿它渲染未声明的 key 抛 `SlotOwnershipError`（`renderer:331`），渲染别的 entry 的子座位也不被授权。
- 结论：**dsh-hud 只要在自己那条 dock 注册里多写一张 `children` 表，它渲染出来的容器就自动成为别人的挂载点。**

产品内部先例（都是"注册进别人的座位 + 声明自己的子座位"，消费方是别的包）：

- `dsh-client-ui-user-questions/lib/client.js:1911-1924`：注册进 `conversation.composer`，声明 `conversation.plan-review.actions`（list/session）。
- `dsh-client-ui-subagent/lib/client.js:815-825`：注册进 `sidebar.right.pane.tab`，声明 `sidebar.chat.conversation`（single/session）。
- `dsh-client-ui-plugin-manager/lib/client.js:3724+`：注册 `main`，一次声明 `plugins.item`、`plugins.bundle.activation`、`plugins.bundle.config`、`plugins.row.config`。
- 消费端例子：`ui-settings-*`、`ui-plan` 等包往上面这些 key 注册。

反面现状：对第三方插件（`@xia-sc/dsh-git`、`@tt-a1i/archify-dsh`）grep `renderSlot` 与 `children: {` 零命中——目录外没有任何插件在开插座。

**限制（逐条带依据）：**

- **生命周期绑在宿主那条 entry 上**：宿主 registration 的 disposer 会走 `releaseChildren`——子座位 spec 清空、`entries` 直接置空、每个贡献者被级联 release（`ui-slots:500-520`）。所以 chip 插件**必须用 `ctx.slots.inject(lane, cb)` 注册，不能裸 `register`**：`inject` 订阅 declarationEpoch，声明塌缩再开后回调会重跑（`renderer:1360-1400`）；裸 `register` 在声明还不存在时直接抛 `slot "X" is not declared`（`ui-slots:165`），声明塌缩后也不会自愈。
- **hot reload**：宿主 bundle 重跑 = 新 fiber、新 entry，旧 entry 释放 → lane 塌缩再开，按 `inject` 写法的 chip 自动回来（组件状态会丢，这是 HMR 本身的设计）。反过来不成立：chip 只要不 require 宿主模块（走字符串键），就不在宿主的重载级联里，宿主重载不连带重载 chip——除非把宿主写进 `dsh.client.inject`（那会引入 bundle 图边与级联，见 `dsh-client-modules/lib/index.js:66,388-410`）。
- **locale**：`t` 只在 entry 自己声明 `locale: NS` 时由框架注入，且要求 locale face 已安装，否则抛 `SlotAssemblyError`（`renderer:723`）。宿主**不能**替别人提供 `t`，chip 必须自己 `ctx.locale.register(NS, …)`。locale 切换经 `useLocaleRevision` 重渲 outlet（`renderer:1098`），不需要重注册。
- **主题**：框架对 entry 一律不注入样式（只套 `display:contents` 锚点），产品的颜色全是 `--dsw-*` 自定义属性，chip 用令牌就自动跟随主题；宿主容器不会隔离它。
- **错误隔离**：框架已给每条 entry 一层 `SlotErrorBoundary`，list 的崩溃会 `abdicate` 该 entry（`renderer:611-625,1117`；`ui-slots:455-470`），**整行不会挂**。代价两条：(a) 那条 registration 在它剩下的生命里永久退场（`entriesOfSlot` 不再选它）；(b) 原地留一个没有样式的 `x<id>` 占位。想要"重试一次就好"的隔离只能宿主自己包——但宿主够不着"框架 outlet 与 chip"之间那一层，所以真实选项只有：接受框架语义 + 宿主收起占位并把崩溃写进自己的诊断行，或放弃座位机制改用宿主自己的 registry（§3 的 B 方案）。
- **命名空间**：子座位 key 是全局字符串，重名即抛（`ui-slots:80,193`），宿主必须给 lane 起带前缀的名字（例如 `dsh-hud.dock.chip`），不要碰 `plugins.item` 这类产品名。

## 3. 接口草案

**A 方案（推荐，用框架座位机制）：**两条 lane + 一个可选能力服务。

```js
// dsh-hud 浏览器半（宿主）
ctx.slots.inject("conversation.input.dock", function () {
  return ctx.slots.register({
    name: "conversation.input.dock",
    id: "dsh-hud",                 // 自己的 id；不要复用 "todo"/"queue"/"goal"（复用 = 顶掉那一格）
    order: 20,
    locale: NS,
    children: {
      "dsh-hud.dock.row":  { kind: "list", scope: "session" }, // 想独占一整行的走这里
      "dsh-hud.dock.chip": { kind: "list", scope: "session" }, // 行内小格
    },
    inject: function (sessionId) { return { store: store, sessionId: sessionId }; },
  }, HudDockLane);
});

// 可选：让"装没装、哪一版、现在能放几格"可问（不是用 lane 的必要条件）
var disposeCapability = ctx.provide("hudLane", {
  version: 1,
  lanes: { chip: "dsh-hud.dock.chip", row: "dsh-hud.dock.row" },
  policy: { order: "ascending", overflow: "hide from the largest order" },
  maxVisible: function () { return /* 实测出来的可见格数 */; },
});
ctx.effect(function () { return disposeCapability; }, "dsh-hud: lane capability");
```

别的插件把 chip 挂上来的真实写法（手写 JS，无构建）：

```js
// acme 插件的 client.js
var LANE = "dsh-hud.dock.chip", NS = "acme-coverage";
exports.inject = ["slots"];
exports.apply = function (ctx) {
  ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "acme: dictionaries");
  // 必需：用 inject 等声明出现，而不是裸 register（宿主没装 / 正在热重载时不至于加载失败）
  ctx.slots.inject(LANE, function () {
    return ctx.slots.register({
      name: LANE,
      id: "acme-coverage",           // 自己的格子；同 id + 同 priority 会抛
      order: 30,                     // 行内从左到右；溢出时先藏 order 大的
      label: function () { return t("chip"); }, // 被收进 "+N" 时宿主投影这句，thunk 跟随 locale
      locale: NS,
      inject: function (sessionId) { return { coverage: coverageStore(sessionId) }; },
    }, CoverageChip);
  });
  // 宿主不支持 lane 时的降级：退回产品已有的横向小座位
  if (ctx.slots.specDynamic(LANE) === undefined) {
    ctx.slots.inject("conversation.input.right", function () {
      return ctx.slots.register({ name: "conversation.input.right", id: "acme-coverage", order: 50 }, CoverageChip);
    });
  }
};
function CoverageChip(props) { // props：框架标准套件 + sessionId + t + 自己的 coverage
  return h("button", { className: "acme-chip", type: "button", title: props.t("chip") }, text(props));
}
```

要求逐条对应：

- **注册与注销**：`ctx.slots.inject(lane, cb)` 的返回值就是那条注册的 disposer，框架已经把它挂在调用者 fiber 的 effect 上，插件卸载即收回（自己再包一层 `ctx.effect` 也可以，`register` 直接手写时才必须）；宿主热重载时 lane 塌缩会强制 release，重开后 `inject` 自动重注册（这是"必须用 inject"的唯一理由）。
- **排序**：沿用产品语义——`order` 升序、同值保持登记顺序。chip 之间给足间隔（10/20/30），不要赌 tie。
- **宽度预算与溢出降级**：预算**实测**，不是常量。宿主的 lane 容器复刻产品几何（§1.3 那三个变量，带兜底），用 `ResizeObserver` 量可用宽度；超了就从 `order` 最大的开始把对应 DOM 节点 `display:none`（不卸载，chip 的 React 状态与订阅保留），行尾画 `+N`；`+N` 展开的清单读 `ctx.slots.entriesOfSlot(lane)` + `resolveSlotLabel`（`ui-slots` 导出）拿每格 `label`，天然跟随 locale。窗口窄到放不下两格时整行退成一枚胶囊 + `+N`；再窄只留宿主自己的胶囊。
- **不可用时的降级**：两级探测——`specDynamic(lane)` 看"现在有没有"，`ctx.inject(["hudLane"], (scope) => …)` 看"有没有能力服务"（**不要**写进插件级 `inject` 硬依赖，否则宿主缺席时你整个插件不加载，用法见 `ui-conversation:18111`、`ui-model-selection:1209` 这类 `ctx.inject(["…"], scope)`）。
- **错误隔离**：框架每格一层边界，崩一格只黑一格。宿主额外做三件事：lane 容器内用 CSS 收起 `[data-slot-error]`（产品没给它样式）、把 `(key, entry, error)` 经 `ctx.slots.onEntryError` 写进自己 `localStorage["dsh-hud.debug"]` 的诊断行（沿用仓库现有做法）、在 `+N` 菜单里说明"N 格已停用"。同时宿主自己的 lane 组件只做布局、不读数据——**宿主一崩，abdicate 的是整行（含所有 chip）**。
- **主题与 locale**：chip 用 `--dsw-*` 令牌即跟随主题；要文案就自己注册 NS 并在注册里声明 `locale`。
- **"想自己排一行"**：走 `dsh-hud.dock.row`（宿主按两段渲染：row 段在上、chip 段在下，段内仍按 `order`）；或者继续直接注册到 `conversation.input.dock`——原座位不会被关掉，lane 只是把"一枚小胶囊"的成本从一整行降到一格。

**B 方案（备选）：宿主自己开一个客户端服务**（如 `ctx.provide("hudChips", { register(chip) })`），chip 由宿主自己渲染、自己包错误边界、自己排宽度。好处是错误隔离可重试、溢出策略完全自控；代价是丢掉框架的登记账本：`ctx.slots.snapshot()` 里看不到这些格、排序规则要自己再定义一遍、`slots/changed` 与 HMR 级联都要自己接。建议**只在 A 方案被上游否掉时**才走 B。

## 4. 契约与兼容

- **冻结项**：两个 lane key 字符串、语义（`order` 升序、溢出从右往左、`list`/`session`）、"`id` 必须带自己前缀"。改 key 就是破坏性变更，所以第一版就要定死；真要大改就并行开 `dsh-hud.dock.chip@2` 一年，两版同时声明。
- **版本耦合**：宿主升级只许**加**不许**改**——加一条新 lane、给 `hudLane` 加一个字段，消费者无感；不许改已有 lane 的 key/kind/scope（`session` 改成 `session-maybe` 会让 chip 的 `inject(sessionId)` 拿到 `undefined`）。宿主的 README 里维护一张 lane 表（key/kind/scope/order 语义/溢出策略/最后变更版本）。
- **探测**：三层，代价递增——① `ctx.slots.specDynamic(lane) !== undefined`（零依赖，回答"现在有没有"）；② `ctx.slots.inject(lane, cb)`（等声明出现，宿主装了就会到）；③ `ctx.inject(["hudLane"], (scope) => …)`（读 `version` / `maxVisible()`，宿主不在就不进这个 scope）。工具侧也能看到：runner 的 Slots 检查把 `slots.snapshot()` 实时树与静态目录合并（`runner:6206,6262`），宿主的 lane 会以 `declaredBy: an entry in "conversation.input.dock" (dsh-hud)` 出现在实时树里，但**没有 catalog 文档**（静态目录只来自产品源码）。所以"能被机器发现"与"能被机器读懂"是两件事——文档得宿主自己发，可以照 `dsh-agent-preset/skills/cordis-plugin-development/templates/decoration/client.js` 那种可复制模板发一份。
- **被上游原生取代**：如果 DSH 以后把这行做成原生横条，或给 `conversation.input.dock` 加宽度预算/溢出策略，退路是现成的——lane 只是"一张声明表 + 一个容器"，把 chip 的注册目标换成上游的 key 即可，chip 组件不用改；宿主在那天应主动从"宿主"退成"其中一个 chip"，并把 `hudLane` 改成转发。观察信号：静态目录里 `conversation.input.dock` 的 `registerOptions` 多出宽度/溢出类字段，或出现新的 `conversation.input.*` 横向座位。

## 5. 落地路径

**阶段一：只给自己用（一个 PR）**。把自己那枚胶囊和"本会话改动"计数拆成两个 chip，走自己的 lane，不对外宣告。
验收：输入框上方仍只有一行；两枚 chip 的间距与卡片左边缘对齐（复刻 §1.3 三个变量并带兜底）；窗口 ≈640px 以下时计数 chip 收进 `+N`；宿主热重载后两枚 chip 都回来；chip 抛错只黑一格且诊断行有记录。
风险：多一层"自己调自己"的间接。若阶段一结束说不出 chip 契约长什么样，这层就是纯成本。

**阶段二：1–2 个合作插件验证（例如 dsh-git 那枚胶囊）**。
验收：两个第三方 chip 同时在线，签名/位置互不影响；把其中一个改成 `throw`，只黑它、行仍在、另一个照常；不重启页面地装上/卸下 dsh-hud，对方能从降级路径正确回到 lane；宿主与 chip 各自热重载都能自愈。
风险：第一个外部消费者会用需求推着契约跑（tooltip、点击开自己的面板）。此时改契约还便宜，但要有"这一阶段只加字段、不改 key"的纪律。

**阶段三：对外公开 SDK**。
验收：README 有 lane 表 + 可复制模板 + 降级范例；有"宿主不在时不加载失败"的测试；`hudLane.version` 语义明确；至少一个第三方插件在**没读宿主源码**的情况下接上。
风险：公开 = 长期兼容负担。需要先有 §6 的对齐结论，至少确认 `conversation.input.dock` 的竖列语义近期不变；上游要做就按 §4 最后一条主动让位。

## 6. 顺带一条同源需求：会话行需要一个"行尾常亮"座位

写侧栏状态 chip 时撞上的：`sidebar.workspaces` 的行（`dsh-client-ui-workspace/lib/client.js` 的 session row）结构是

```
[span.slot 16px] [span.title] [span.time] [PinnedIndicator?] [span.rowActions]
     ↑ 座位 leading              ↑ flex:none         ↑ 产品自己的指示    ↑ 座位 row.action
                                 自适应宽度           常亮               display:none → hover 才 inline-flex
```

四个座位（`row.leading` / `row.action` / `menu.item` / `row.hover`）里**只有 `row.leading` 是常亮**，而它只有 16px（`.slot{width:16px;height:20px;flex:none}`，实测；产品自己在那一格显示会话状态点时这个座位根本不渲染）。行尾的常亮位置（`time` 与 `PinnedIndicator` 之间）**没有任何座位**，且 `time` 宽度自适应、只在悬停时被动作条替换 —— 所以"想在行尾常亮显示一个状态"的插件只有三条路：挤行首 16px、等悬停、或者绝对定位去盖住产品的时间文字（后者等于改产品界面，不该做）。

**建议**：在 `time` 与 `PinnedIndicator` 之间加一个 `sidebar.workspaces.session.row.trailing`（或 `sidebar.session.row.trailing`）座位，语义与 `leading` 对称：

- 传参 `{ sessionId }`（与 `leading` / `hover` 一致）；
- 位置在 `time` 之后、`PinnedIndicator` 之前，宽度自适应、`text-overflow` 交给插件；
- 若上游希望"紧凑优先"，可以给一个宽度预算（例如 ≤48px）并声明超出由框架截断；
- 产品自己的 `trailingLabel`（`primaryStatus.trailingLabel`）与它是互斥还是共存，需要上游给个说法 —— 现在 `time` 那一格里已经在"相对时间"与"状态标签"之间二选一了，插件座位进来后这个二选一要不要让位，是实现细节但影响观感。

## 7. 决策清单（需要与上游/合作方对齐）

1. `conversation.input.dock` "一条 entry 占一整行"（`.composerStack` 是 column）是稳定语义还是实现细节，未来会不会改成横向条？
2. 上游有没有给这一行（或整个 dock）加公共宽度预算与溢出策略的计划？如果有，插件自建 lane 是不是白做？
3. `--dsh-composer-card-max-width` / `--dsh-composer-side-clearance` / `--dsh-composer-dock-inset` 能不能从内部变量升成文档化的对齐契约（至少给出"要与输入卡片对齐就减这两个 inset"的说明）？
4. `[data-slot-error]` 占位该不该由框架自带样式（或允许占位方声明不显示）？现在它是一行裸文字。
5. entry 崩溃后的 `abdicate` 是终身的，能不能给一个正规的"重试/复活"姿势（现在只有"重新注册"或"宿主重载"）？
6. "第三方插件在别人的 entry 里声明子座位"是否被认可为公开模式，上游愿不愿意把它写进 slot 系统文档，而不只是自家包在用？
7. lane key 要不要约定前缀（如 `插件短名.dock.*`）？现在没有任何校验，只能靠自律。
8. 静态目录（`CLIENT_SLOT_API`）会不会收录第三方声明的座位？如果不会，agent 与工具只能看到"有这条 key"，用途与署名得由插件自己发文档。
9. **会话行能不能给一个行尾常亮座位**（`sidebar.session.row.trailing`，见上一节）？这是"插件想在行尾常亮显示一个状态"目前唯一没有答案的地方。
10. `sidebar.session.row.leading` 被产品自己的会话状态点抢占（`showStatus` 为真时不渲染座位）——这是有意的优先级，还是希望插件改到别处显示？
