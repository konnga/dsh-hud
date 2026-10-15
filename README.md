# dsh-hud

> DeepSeek Harness 的**当前项目 Git 悬浮面板** —— 分支、ahead/behind、脏状态与改动清单，全部只读；另有一行「本会话改了哪些文件」。
> A read-only Git HUD floating panel for DeepSeek Harness: branch, ahead/behind, dirty state, and the changed-file list — plus a per-session change readout.

`@konnga/dsh-hud` 是一个双面 npm 插件包：宿主半在本地跑 `git` 并把结果通过包私有 RPC 交给页面，浏览器半把结果渲染成输入框上方的**胶囊**和一块**可拖动的悬浮面板**。它跟着**当前会话的工作区**走：在侧栏切换会话/工作区时，面板会实时重新绑定到那个目录。

侧栏**每条会话行的悬停动作里**另挂一枚只读状态 chip（`!M2 A1 ?1 ●3`）：一眼看出"哪个会话的工作区脏了、哪个会话刚改过东西"。面板还会告诉你**这个会话改过哪些文件**（按会话归因，见下）：概览下面一行计数、清单每行行首标 `●`/`◐`/`○`、点一下可以只看本会话改的那几个；行尾另有**审阅标记**（`○`/`✓`，`v` 键切换）与 `已审 3/8` 进度。

## 界面

- **胶囊**（紧贴输入卡片上方那一行，与卡片同宽并左对齐，**自身是紧凑胶囊、不撑满整行**）：`⎇ feat-mooen* ↑1 ↓2 M4 A1 ?1`。
  - `⎇ 分支`：当前分支；detached 时显示 `detached <短oid>`；名字过长会中段省略。
  - `*`：工作区不干净。
  - `↑n` / `↓n`：与上游的领先 / 落后提交数，为 0 时不显示。
  - **简写符**：按类型分组的改动数，只列非零项，各自上色（与面板概览同一套配色）。沿用上游 statusline 的 git 标记约定：

    | 简写符 | 含义 | | 简写符 | 含义 |
    | --- | --- | --- | --- | --- |
    | `M` | 已修改 | | `C` | 复制 |
    | `A` | 已暂存新增 | | `T` | 类型改变 |
    | `D` | 已删除 | | `?` | 未跟踪 |
    | `R` | 重命名 | | `!` | 冲突 |

  - 悬停胶囊会给出完整信息：工作区绝对路径、上游分支、各类型的中文计数。
  - 点击开关面板。有本会话改动时，胶囊尾部挂一段 `│ ●3`（悬停说清这个数字是什么）—— 一眼能看出"这一轮 agent 到底动没动手"。
- **悬浮面板**（紧贴胶囊上方居中，位置是**实测**的，见下文"面板为什么贴着胶囊"）：
  - 标题栏：分支/DETACHED 标记，`⟳` 刷新、`⌖` 复位位置、`✕` 收起；**拖动标题栏可移动面板**，**双击标题栏复位**。
  - 仓库路径、上游分支、领先/落后、短 oid。
  - 改动概览：按类型分组的彩色计数（已修改 / 已暂存新增 / 已删除 / 重命名 / 复制 / 类型改变 / 未跟踪 / 冲突），**只显示非零项**；没有改动时显示"工作区干净"。
  - **本会话改了哪些**（会话归因）：概览下面一行 `本会话改过 3 个文件 · 另有 2 个可能相关（命令旁听） · 1 个已不在 git 现状里（改回去了 / 被忽略 / 被覆盖）`，右边一枚 `只看本会话改的` 开关（状态记在 `localStorage`）；改动清单每行行首标**三态**：`●` 确定改过（经写文件/编辑工具）/ `◐` 可能相关（从 shell 命令里看出来的，悬停给出那条命令原文）/ `○` 不是本会话改的（可能是你自己、编辑器或另一个会话）；`●` 的悬停给出写入/编辑次数与时间。那一行的悬停还会列出**最近跑过的命令**（失败的那条会标出来）。回合信息拿得到时（宿主有 `turnOutline` 投影），行上还会多一句 `最近一轮 3 个`，行悬停写着 `第 4 轮：<那一轮的请求>`，右边多一枚 `只看最近一轮` 开关 —— 用来回答"我刚才让它改的那几处是哪些"。过滤器打开而本会话什么都没改时，清单位置给一句说明，而不是整段消失。
  - **审阅到哪了**（「已审」标记）：改动清单每行**行尾**一枚标记 —— `○` 未审 / `✓` 绿 已审（这一版）/ `✓` 黄 改动已变需要重看；点它或按 `v` 切换。那一行报 `已审 3/8`，已有标记时右边多一枚 `清空已审`（只清当前工作区）。**这一行不依赖会话归因**：归因数据缺失时它照样出来 —— 归因没了不该把"审到哪了"一起带走。
  - 改动清单：每行一个 porcelain-v2 状态字母 + 路径，重命名读作 `旧 → 新`。**点击任意一行打开该文件的差异视图**（键盘选中是描边，正在看的那份是底色，两者可以同时在不同行上）。**排在最近提交之前**——清单是"现在要处理的"，提交是背景信息，一屏不够时先看到的应该是眼前的事。
  - **最近提交**：一行一条 `短sha 标题 [HEAD] 相对时间`，悬停给出作者、日期与 refs（本地/远端分支）。只在面板打开时取一次，且只有 HEAD 变了（提交、切分支、拉取）才重取；没有提交时整段不显示。**点击任意一行打开这次提交的明细**（见下，明细在中间新增的那一栏）——主面板不动，只是那一行高亮起来，**再点一次收起**。
  - 底栏：`只读` 与最近一次成功读取的时间。
- **侧栏会话行上的状态**（三个座位，**三档可配**，默认**常亮**）：
  - **档位**（面板那一行右边那枚开关，点一下循环）：`侧栏 常亮` → `侧栏 悬停` → `侧栏 关`，记在 `localStorage`（`dsh-hud.ui.v1` 的 `sidebarMode`）。
  - **常亮**（`sidebar.session.row.leading`，行首那一格）：只放得下**一个双字符标记** —— `●n`（本会话确定改过 n 个）/ `◐n`（命令旁听的"可能相关"）/ `!n`（工作区脏，n 个改动文件），两位数收成 `+`。**产品自己在那一格显示"会话状态点"时这个座位不会被渲染**（那一格归它），这种情况下请用悬停档或看悬停卡片。
  - **悬停**（`sidebar.workspaces.session.row.action`，动条上）：`!4 ●3` —— 脏标记 + 改动总数 + 本会话改动数，信息比常亮那枚多一位。
  - **`⋯` 菜单里的只读摘要**（`sidebar.workspaces.session.menu.item`）：点开行尾那颗 `⋯` 就能看到两行 —— `主分支* ↑0 ↓0 · 已修改 7 未跟踪 2` 与 `本会话改过 3 个文件 · 另有 1 个可能相关（命令旁听）`（都没有时明说"干净"与"没有改动记录"，而不是消失）。**这是"行尾 + 完整信息"目前唯一能落的地方**：会话行行尾的常亮位置（相对时间那一格、以及悬停才换上的动作条）归产品自己，插件在那里没有座位。
  - **悬停卡片**（`sidebar.session.row.hover`，同一行的悬停卡里；档位为"关"时这块也一起撤）：`main* ↑1 ↓2 · 已修改 2 已暂存新增 1 未跟踪 1` 与 `本会话改过 3 个文件 · 另有 1 个可能相关（命令旁听）`。宽敞的地方才放得下明细，这也是"悬停就能下判断"的地方。
  - **干净且本会话没改过就整枚不画** —— 侧栏那行只有 32px 高，不占位置也不制造噪音。
  - 悬停给出分支、上游位置、各类型计数、工作区路径，以及"这个会话改过几个"。
  - 数据是**一次批量**取回的（宿主自己枚举会话 + 按目录去重，见下），节奏 12s（比面板的 8s 慢一档，页面隐藏时跳过）。这一版是只读的，点了不会切会话。
- **提交明细**（点击最近提交里的一行，**中间多出一栏**——三栏并排：主面板 │ 这次提交 │ 差异；左栏一个像素都不动）：
  - 中间那一栏（默认 240px）上段是**元信息**（短 sha、标题、作者 · 日期 · refs，合并提交会说明**按第一父提交比较**），下段是**这次提交的改动清单**（状态字母 + 路径，样式与工作区清单一致，重命名同样读作 `旧 → 新`）。
  - 右边那一栏是**选中文件的差异**（就是平时那个差异栏，只是没有 未暂存 / 已暂存 两个页签）。
  - **自动打开这次提交的第一个文件**——一次点击就能看到"改了什么"；点中间栏里其他文件即可切换。空提交会写明"这次提交没有改动文件"，不会开一个空差异。
  - 清单与左栏的工作区清单是两份独立的行（行标记里带着是哪一份），所以键盘移动只会滚对那一栏。
  - 收起：清单里再点一次那条提交、按 `Esc`、或差异工具栏的 `✕`。打开别的提交则直接切换明细。
- **差异视图**（点击改动行进入，**两栏并排**——打开提交明细时是三栏，与 dsh-git 的 workbench 同形）：
  - **左栏就是单栏视图本身**（同为 380px，一字不差）：仓库路径 / 上游 / 短 oid、改动概览的彩色计数、改动清单、最近提交全都在（顺序与单栏一致），正在查看的那一行高亮。**打开差异不改变左栏任何内容**，点左栏另一行即刻切换差异；切换会话/工作区时它也一直在；打开提交明细时左栏同样一个字不动。
  - **最右那一栏是差异**：工具栏给出文件路径、`+新增 -删除` 计数、`未暂存` / `已暂存` 页签、`自动换行`、`复制差异`、`✕ 关闭差异`。看提交的差异时没有两侧页签（短 sha 与标题在左边那一栏的明细头里，不重复显示）。
  - **hunk 头可折叠**：点 hunk 头收起那一段（头本身留着，`▸`/`▾` 表示状态），`n` / `p` 在上一个 / 下一个 hunk 之间跳——跳到折叠着的 hunk 会顺手展开它。当前 hunk 有高亮，切文件时自动回到顶部，键盘跳转时只做最小滚动。
  - **面板右边缘可拖动**调整差异栏宽度（默认 470px、下限 240px，宽度记在 `localStorage`）——与 dsh-git 的抓握位置一致；这一栏在"工作区差异"与"提交明细"两种情形下是同一个抓握。
  - 逐行渲染 unified diff：**旧/新两个行号槽**（`user-select:none`，方便直接拖选代码），新增行绿底、删除行红底、hunk 头加深、`diff --git` 等文件头压暗。
  - 两侧**一次取回**，切换页签不再发请求；未跟踪文件隐藏“已暂存”页签并说明它是与空文件对比。
  - 差异模式下面板**高度固定**——面板以 `bottom` 锚定，若只给 `max-height`，内容变高时整块会跳位（dsh-git 的注释里记录过这个坑）；三栏共用这个高度。
  - `Esc` 是"退一层"：右栏在场（差异 / 提交明细）就先收起它，都没有时才收起面板。

### 键盘

**前提：先在面板里点一下**（或 Tab 进去）。本插件是挂在输入框上方的浮层，裸按键一旦全局接管，就会把打字、翻菜单、滚会话一起吃掉——所以默认不接管，点到面板外面就把按键交还。

| 按键 | 作用 |
| --- | --- |
| `↑` / `↓` | 在清单里上下移动选中行（只移动，不打开）。还没选过时：`↓` 落在第一条、`↑` 落在最后一条 |
| `Enter` | 打开选中的那条；还没选过就打开第一条 |
| `[` / `]` | 上一个 / 下一个文件，并直接打开（少按一次 Enter） |
| `n` / `p` | 下一个 / 上一个 hunk（跳到折叠着的 hunk 会展开它） |
| `Space` | 折叠 / 展开当前 hunk |
| `r` | 重新读取（同标题栏的 `⟳`） |
| `v` | 把当前聚焦的那一行标成「这一版我审过了」（再按一次取消） |
| `Esc` | 退一层：先收起右栏（差异 / 提交明细），再按才收起面板 |

清单跟着视图走：打开提交明细时，`↑` / `↓` / `Enter` / `[` / `]` 作用于**明细里这次提交的清单**，而不是左栏的工作区清单。带 Cmd / Ctrl / Alt 的组合键一律不接管，输入框（contenteditable）里的按键也一律不碰。

面板的展开状态、拖动位置、"自动换行"、两枚过滤器开关记在浏览器 `localStorage`（键 `dsh-hud.ui.v1`）；「已审」标记单独存一个键（`dsh-hud.reviewed.v1`，键是"工作区 + NUL + 文件"，最多 200 条按最后触达淘汰）。两者刷新后都保持。

## 架构

一个双面 npm 包：

| 半边 | 文件 | 职责 |
| --- | --- | --- |
| 宿主 | `lib/index.js` | Cordis 插件（bundle 行 `dsh-hud`），在自己的 `ctx.webServer` 上注册 `/dsh-hud-rpc` 前缀路由，收发与内置 `/api` 相同的 Connection RPC 信封，并把请求围栏交给 `connection.requestRejection`（Host/Origin + 浏览器会话认证）。所有 git 调用走 `execFile`（无 shell）、带超时、输出有界，并按 cwd 做 1.5s 缓存 + 在途请求合并。 |
| 浏览器 | `lib/client.js` | `dsh.client` bundle（`exports["./client"]`），两个座位 + 一个共享 store，只依赖种子模块 `react`。dock 座位渲染那枚 Git 胶囊，overlay 座位渲染悬浮面板。 |

### 会话归因用的是什么事实

"本会话改过哪些文件"听起来像要读会话日志，其实不用 —— 宿主进程里已经有两条现成的事实：

| 事件 | 形状 | 用途 |
| --- | --- | --- |
| `fs/write-intent` / `fs/edit-intent` | waterfall，`(target, exec)` | 这次**要**动哪个文件（`dsh-tool-fs` 的写入/编辑与 `dsh-tool-str-replace-editor` 都走 `ctx.fs`，因此都会发） |
| `fs/observed` | emit，`(target, observation, exec)` | 那一下**之后**文件是 `present` 还是 `absent` |

`exec.agent.session.header` 同时给出 `id`（哪个会话）与 `cwd`（哪个工作区），所以"谁改的"不用猜。**必须两类配对**才记一次：`fs/observed` 对**读取**也发（"编辑前必须先读"那个策略插件就是靠它），只看它会把"读过"算成"改过"；只有意图而没有观察的（写入失败）也不算落地。配对的键优先用 `exec.callId`（一次调用一个意图），拿不到就退化成"会话 + 路径"。

只记 `cwd` 之内的路径（git 只关心这些），单会话上限 500 个文件（超出只计数 `dropped`）、最多 32 个会话（按最近改动淘汰）。端点 `session-changes` 只回答"这个会话动过哪些路径"，与工作区现状的关系由浏览器半拿 `status` 求交 —— 两个事实各自只有一个来源。

### 侧栏那一行是怎么拿到数据的

会话列表由**宿主**枚举（`sessions` 服务里有活着的会话，带 `header.{id,cwd}`），客户端只发一个空请求 `session-statuses`：

1. 按 `cwd` **去重**（三个会话同一个仓库 → 只跑一次 git，复用面板那套带 TTL 的缓存）；
2. git 那半给分支/脏状态/计数，`mine` / `possible` 那半**直接来自归因记录**（本来就按 `sessionId` 分，不用再问 git）—— 所以**不是仓库的目录也有"这个会话改过几个文件"**；
3. 一次最多看 8 个工作区（超出置 `truncated: true`，界面不假装看全了），响应里**不带 `changes`**（那一行只要摘要，别把清单拖过来）。

四处（行首标记 / 动条那枚 / ⋯ 菜单摘要 / 悬停卡片）用的都是同一份"事实摘要"（`rowSummaryOf`）：同一份数据要在四种宽度里呈现，各写一套一定会漂。都没内容（工作区干净、且这个会话没改过任何东西）时**整处不画**：动作条上不占位置，悬停卡里也不留空行。

两处依赖都是**软依赖**（`ctx.inject`）：`sessions` 或 `sessionProjections` 没到齐时对应功能安静降级，自动模式/会话归因/面板一律照旧。

### "这一版我审过了"是怎么判定的

签名 = 文件的 `size` + `mtimeMs`（宿主 `stat`，一次 syscall）。**只在面板打开时**才要（`status` 请求带 `review: true`），胶囊那一路的轮询不付这个钱。签名和存档里的一致才算"已审"；一改动签名就变，标记自动降级成"改动已变，需要重看"，**不再计入已审数** —— 而不是继续冒充。

为什么不用 `git diff --numstat`：行数变化抓不到"同数改写"（`foo` → `bar`），而 mtime 对任何一次写都会变，还更便宜。反过来它也会**过报**：`touch` 一下（内容没变）就会让"已审"失效 —— 宁可让人多看一眼。另外面板关着时的改动要等你下次打开面板（那时才会重新取签名）才被发现。

### "第几轮改的"从哪来

宿主投影 `turnBoundary` 里有当前回合号（`stateOf(session, 'turnBoundary').lastTurn`），每个改动落地的瞬间就把它记在那条记录上（`lastTurn` + `turns`，后者最多留 8 个去重后的轮次）。请求预览（`第 4 轮：把面板改成两栏`）来自另一个投影 `turnOutline`（`{ turns: [{ turn, prompt }], draft }`），由**浏览器半**读同一个会话对象时取回 —— 两个投影各管一半：宿主记"哪一轮"，界面说"那一轮要干嘛"。

`sessionProjections` 是**软依赖**（`ctx.inject` 动态等它）：拿不到就记 `null`，界面不提回合，归因照常；读取抛错也只当"这一轮拿不到"，不会把面板带崩（这两种情形都有测试）。

### 命令旁听（"可能相关"那一档）

fs 事件只覆盖经工具写入的路径。agent 用 `bash` 间接改文件（`sed -i`、脚本、格式化、`git checkout --`…）时看不到，于是再旁听一路 `tools/post-execute`，从命令行里**抽候选路径**，全部记进**低一档**的 `possible`，绝不混进"确定改过"：

| 认得的形态 | 抽出来的路径 |
| --- | --- |
| `> file`、`>> file`、`tee file` | 重定向 / tee 的目标（`/dev/*` 除外） |
| `sed -i`、`perl -i` | 该段命令的最后一个非 flag 参数 |
| `mv` / `cp` / `ln` / `install` / `rsync` / `patch` | `mv` 的源与目标都记（源会消失），其余记目标 |
| `rm` / `touch` / `truncate` | 全部非 flag 参数 |
| `dd of=…` | `of=` 后面的路径 |
| `git checkout|restore <path>` | 那个路径（会覆盖工作区文件） |

其余命令（`pnpm build`、`prettier --write`、`npm test`…）**不猜路径**，只记进命令历史 —— 那一行的悬停里能看到"跑过这些命令"，由你自己判断。只读命令（`cat`/`grep`/`git status`…）连候选都不产生。**失败的命令**（`ok:false` / `isError` / 带 `error`）只进命令历史，不参与归因。

**已知不覆盖 / 会出错的地方**（界面上如实分档，不假装全知）：启发式认不出的写法会漏（例如 `python - <<EOF` 里写文件、`make`、自定义脚本）；反过来 `sed -i` 之类若把替换表达式写成裸路径也可能多报一条 —— 所以这一档是 `◐` 而不是 `●`。本进程启动**之前**的改动也照旧不记（fs 观察不持久化），每个会话都报一个 `since`，界面说的是"自 … 起记录"。

### 为什么自持 HTTP 路由

`dsh >= 0.1.5-rc.1` 起，外部插件**不能**再用 `ctx.connection.rpc.handle()`：Connection 插件是在自己内部的 `ctx.inject(["webServer"], …)` 作用域里注册路由的，无论调用方 inject 了什么，那一行都会以 `cannot get property "webServer" without inject` 挂载失败。因此本插件自持 `/dsh-hud-rpc` 路由、自己实现同一套信封，只借用 Connection 的信任判定，安全等级与内置 `/api` 一致。

### 为什么面板要靠胶囊喂数据

`shell.overlay` 是 **root 作用域**的座位，读不到"当前会话"（`dsh 0.1.6-alpha.2` 起会话列表快照不再带 `current`，当前会话由渲染器只投递给**会话作用域**的座位）。所以：

- **胶囊**坐在会话作用域的 `conversation.input.dock`，框架直接给出 `sessionId`；它从 `useSessions` 快照里取该会话的 `cwd`，调用共享 store 的 `bindSession(sessionId, cwd)`。
- **面板**坐在 root 作用域的 `shell.overlay`，只读共享 store 的 `sessionId` / `cwd`。

右栏里的嵌入式会话（子会话 chat）自带会话绑定，胶囊用快照的 `retainedBy.mainView` 排除它们，避免一个子会话把面板下面的仓库抽走；快照不带这个计数（更旧的宿主）时按主视图放行，胶囊不会因此消失。

### 面板为什么贴着胶囊

`bottom: 168px` 是 dsh-git 记录的一次测量（"输入框堆叠高度"），而 DSH 在空白会话（hero）里会把输入框垂直居中，不同版本的底部状态栏高度也不同——写死就会在 hero 状态下面板飘在输入框上方很远的地方。

本插件改成**实测**：面板打开时（以及每次会话/状态变化、窗口 resize）量一次自己胶囊所在 dock 行的位置，把面板贴到它上方 8px。用**自己的** `data-dsh-hud="dock"` 标记取节点，不碰产品的 DOM 选择器；量不到就退回 168px 这个常量。

### 为什么样式表必须自己打 `data-plugin`

框架的 `client-modules` 会对 `<style>` 做所有权登记（`claimStyles` / `removeOwnedStyles`）：

- 任何模块**物化之后**，它把当下所有**没有 `data-plugin`** 的 `<style>` 认领给刚物化的那个模块；
- HMR 的 replace / invalidate / prune 路径上按 `data-plugin` 删除该模块名下的样式表。

所以没打标的表会被**别的**模块领走，并在那个模块下一次重建时被一起删掉。样式注入只跑一次的话，页面就永久退回骨架：胶囊变成原生 `button`（灰底、白字、贴着整栏最左），面板只剩内联样式撑着的壳（标题没有间隙、路径不省略、改动行是原生按钮）。

本插件因此按框架自身与 `dsh-git-graph` 的约定注入：`data-plugin="dsh-hud"` + `data-plugin-css="dsh-hud/styles.css"`，注入前先按 `data-plugin-css` 复用同一节点，并在**已有的 8s 轮询与 `focus` 回调里各补一次**——被框架删掉也能自愈。

## 安装

```sh
# 开发/本地源码（symlink，改动即时可见）
dsh plugin --profile desktop add link:/Users/cheng/Documents/code/konnga/dsh-hud

# 或从 npm
dsh plugin --profile desktop add dsh-hud
```

然后**重启 DSH web**（bundle 行与浏览器 roster 在启动时组合）。刷新页面后，当前会话的工作区是 git 仓库时，输入框上方会出现胶囊，点击即可展开面板。

> `--profile` 换成你自己的 profile 名（本机为 `desktop`；官方示例里常用 `web`）。

卸载：

```sh
dsh plugin --profile desktop remove dsh-hud
```

## 端点约定（`/dsh-hud-rpc`）

浏览器侧通过 `ctx.connection.rpc.call("/dsh-hud-rpc", endpoint, { args })` 调用；宿主侧是本插件自持的 `/dsh-hud-rpc/*` 前缀路由，收发与 `/api` 相同的 Connection 信封：

- 请求：`POST /dsh-hud-rpc/<endpoint>`，`content-type: application/json`，
  `{ type: "client-request", rpcId, method: <endpoint>, payload: { args } }`
- 响应：`{ type: "server-response", rpcId, result: { ok: true, value } | { ok: false, error } }`
- 围栏：`connection.requestRejection`；非 `POST` → 405，非 JSON → 415，请求体超重 → 413，通道外路径 → 404，未知端点 → **200 + 错误信封**（`details.code: unknown-endpoint`）。
  未知方法特意不用 404：非 2xx 会被浏览器侧的传输层当成连接失败，插件自己的诊断码就永远到不了界面。

> 失败结果的 `error.code` 在线路上固定为 `"internal"`（Connection 信封只要求它是字符串），插件自己的诊断码放在 `error.details.code`，由浏览器半按码做本地化文案。

| 端点 | 参数 | 结果（`value`） |
| --- | --- | --- |
| `status` | `{ cwd, review? }` | `{ repo, branch, detached, oid, upstream, ahead, behind, dirty, counts: { modified, added, deleted, renamed, copied, typeChanged, untracked, conflicted }, changes: [{ status, index, worktree, path, file, origFile }], truncated }`。`cwd` 必须是绝对路径；不是仓库时 `repo` 为 `null`（这是成功结果，不是错误）。`path` 是展示串（重命名读作 `旧 → 新`），`file`/`origFile` 是原始路径，`index`/`worktree` 是 porcelain-v2 的两个字母。 |
| `log` | `{ cwd, count? }` | `{ repo, commits: [{ sha, author, date, committedAt, refs, subject }] }`，最新在前；`count` 钳制在 1..50，默认 10。空仓库（还没有任何提交）返回空列表而不是错误。 |
| `diff` | `{ cwd, path, origPath? }` | `{ repo, path, origPath, untracked, worktree, index }`，两侧各自是 `{ rows: [{ kind: "add"\|"del"\|"ctx"\|"hunk"\|"meta", text, oldLine, newLine }], additions, deletions, hunks, binary, truncated }`。`path` 必须是**仓库内相对路径**（拒绝绝对路径、`..`、前导 `-`、控制字符）。未跟踪文件与空文件对比并把 `untracked` 置真；二进制只置 `binary`；文本按行截断（单侧 200k 字符 / 2000 行）。**解析在宿主侧完成**，浏览器半只负责渲染。 |
| `commit` | `{ cwd, sha }` | `{ repo, commit: { sha, shortSha, subject, author, date, committedAt, refs, merge }, files: [{ status, path, file, origFile }], truncated }`。`files` 与 `status.changes` 同形（少了 porcelain 的两个字母），上限同为 200 条。`sha` 只收 **4..40 位十六进制**（`HEAD`、`HEAD~1`、`origin/main` 一律拒绝），短 sha 会解析成完整 sha 返回。非仓库时 `repo` 为 `null`；认不出的 sha 是 `unknown-commit` 错误。 |
| `session-statuses` | `{}` | `{ sessions: [{ sessionId, cwd, mine, possible, repo, branch, detached, dirty, ahead, behind, counts, error }], unavailable, truncated, worktrees }`。**侧栏每条会话行**要的摘要（一次批量）：会话列表由宿主枚举，`cwd` 去重后按目录读 git（上限 8 个），`mine`/`possible` 来自归因记录。宿主没有 `sessions` 服务时 `unavailable: true`（界面整片不画，而不是画一排错误）。 |
| `session-changes` | `{ cwd, sessionId }` | `{ repo, sessionId, tracking, since, firstChangeAt, files: [{ path, file, writes, edits, firstAt, lastAt }], dropped, possible: [{ path, file, hits, firstAt, lastAt, reason }], possibleDropped, commands: [{ tool, command, at, failed, readOnly }], unconfirmed, cwdMismatch }`。`files` 是"确定改过"（每条带 `lastTurn` 与 `turns`），`possible` 是命令旁听来的"可能相关"（`reason` 是那条命令片段，带 `lastTurn`），`commands` 是最近 20 条命令（带 `turn`）。回合号为 `null` 表示当时读不到回合信息 —— **不是 0**（0 是"第一轮"）。**本会话改过哪些文件**（按会话归因，见上文"会话归因用的是什么事实"）。`files` 只含 `cwd` 之内的 posix 相对路径；`since` 是本次监听开始的时刻、`firstChangeAt` 是这个会话第一次被记到改动的时刻（都不持久化）；不认识的会话返回空清单（不是错误）；`cwd` 非法照旧 `invalid-cwd`；会话记录里的 cwd 与请求的 cwd 不一致时返回空清单并置 `cwdMismatch`（记的是相对那个工作区的路径，跟另一个工作区对账只会标错行）。 |
| `commit-diff` | `{ cwd, sha, path, origPath? }` | `{ repo, sha, shortSha, file, path, origPath, rows, additions, deletions, hunks, binary, truncated }`——与 `diff` 的**单侧**同形，所以浏览器半可以直接把它当右栏的数据。路径校验与 `diff` 相同。 |

`details.code` 取值：`invalid-cwd`、`invalid-path`、`invalid-sha`、`no-cwd`、`git-missing`、`git-failed`、`unknown-commit`、`timeout`、`unknown-endpoint`。

## 数据来源与边界

数据来自这些只读命令（`diff` 只在你点击某个文件时才跑）：

```bash
git rev-parse --show-toplevel
git status --porcelain=v2 --branch -z --untracked-files=normal
git log -n<count> --no-color --date=short --pretty=format:…       # 最近提交（NUL 分隔字段）
git ls-files --error-unmatch -- <path>                            # 是否未跟踪
git diff --no-color --no-ext-diff -- <path> [<origPath>]          # 工作区侧
git diff --cached --no-color --no-ext-diff -- <path> [<origPath>] # 已暂存侧
git diff --no-index --no-color --no-ext-diff -- /dev/null <path>  # 未跟踪文件
git log -1 --no-color --date=short --pretty=format:… <sha>        # 提交元信息（NUL 分隔字段）
git diff --name-status -z -M --no-color --no-ext-diff <base> <sha>          # 这次提交的改动清单
git diff --no-color --no-ext-diff -M <base> <sha> -- <path> [<origPath>]    # 该提交里某个文件
git show --format= --name-status -z -M <sha>                      # 根提交（没有父提交时）
```

`base` 是**第一父提交**（`git log -1` 的 `%P` 第一个字段）；根提交没有父提交，改用 `git show`
与空树比较。合并提交因此也给出"相对第一父提交"的清单，而不是 `git show` 默认那段常常为空的
组合差异。

- **git 数据只读**：不执行 `add`/`commit`/`checkout`/`fetch` 等任何写操作，不碰 index、工作区或 git 配置，不读取文件内容，不显示凭证。想改东西请用编辑器或终端（也可以配 `dsh-git` 那类带写操作的插件）。
- **会话归因只是旁听**：宿主半监听 `fs/*` 事件与 `tools/post-execute` 来记"哪个会话动过哪个文件"，不拦截、不修改、不写任何东西。`fs/*` 是瀑布但调用方自带兜底（`ctx.waterfall(..., () => void 0)`），旁听者不调 `next` 是官方写法；`tools/post-execute` 的兜底是 `{ kind: 'accept' }`，所以**必须把 `next()` 的判定原样透传**（吞掉就等于改掉了工具结果的裁决）—— 这条有专门测试钉住。
- 路径解析按 porcelain-v2 的字段数用 `indexOf` 切分，**不整行切空格**，所以含空格的路径原样保留（有测试守着）。
- 改动清单上限 200 条，超出只计数并置 `truncated`；`git status` 单次超时 30s，输出上限 8 MiB。
- 同一 cwd 的状态缓存 1.5s、最多 32 个；浏览器每 8s 轮询一次（页面不可见时跳过，回到页面立刻补一次）。

## 已知边界

- **胶囊不可省**：面板本身读不到当前会话，见上文"为什么面板要靠胶囊喂数据"。若把胶囊座位去掉，面板会停在最后一次绑定的目录上。
- **`完全权限`带一次行内风险确认**：与产品自带控件一致（只有这一档要勾）。确认状态在面板收起、换会话或切完一次之后丢掉——不会留着一个"半按下的"危险按钮。
- **间接改动只到"可能相关"为止**：`bash` 里改的文件走命令旁听，标 `◐` 并附上命令原文，不升级成 `●` —— 少报可以接受，冒充"确定"不行。
- **自有样式表的结构是一条不变量**：规则被删时**必须整条删干净**（连跨行的声明尾巴一起）。留下悬空声明或多余的 `}` 会让 CSS 解析器对它**后面那条规则**做错误恢复，整条规则被丢弃 —— 表现是"样式改了没反应"，而所有基于文本的断言依然全绿。`apply` 那行自诊断里的 `chips` 值用来分辨"跑着的是哪一版样式表"，`test/client.test.mjs` 里的结构自检用来钉住"样式表没有孤儿片段"。
- **界面没变化先看现场**：接线每一步都留一行自诊断（同一情形只报一次）——一行进控制台，一行留在 `localStorage["dsh-hud.debug"]`（最近 24 行，排查完可以删）。客户端插件的异常与"服务找不到"都不会进宿主日志，而界面上往往只有"有/没有"两种观察，这行现场就是唯一的线索：`apply` 说明客户端半被加载并 apply 了；`session-changes {"files":n,…}` 说明归因取回了几条，`session-changes-failed {"code":…}` 则是端点没取到（例如宿主半还是旧的）。
- **会话归因不持久化、有上限**：记录活在宿主进程里，所以每个会话都带一个 `since`（界面写"自 … 起记录"）；单会话上限 500 个文件（超出只计数 `dropped` 并在界面上说一句）、最多 32 个会话。换会话时界面先清空，避免把上一个会话的标记留在新会话的清单上。
- **菜单与面板互斥**：同一时刻只开一个（都由 store 保证）。菜单的位置是"贴着胶囊上方"算出来的，量不到胶囊时兜底居中。
- **胶囊的横向位置依赖框架的 CSS 变量**：`conversation.input.dock` 给的是整栏宽的一行，而输入卡片自身有最大宽度并居中。胶囊的外层容器复刻了框架自带 dock 占位元素（队列公告）的几何——`--dsh-composer-card-max-width`、`--dsh-composer-side-clearance`、`--dsh-composer-dock-inset`——这样才会与输入卡片左边缘对齐。这些变量名若在新版 dsh 里改动，胶囊会退回"贴着整栏最左边"（功能不受影响，只是位置不好看）。
  - 注意这条**只有在样式表还在**时才谈得上：整张表被框架的 HMR 记账删掉时，走的是另一条路——胶囊是未样式化的原生 `button`，天然落在行首（也就是整栏最左），见「为什么样式表必须自己打 `data-plugin`」。
- 面板锚点优先用**实测**的 dock 行位置（见「面板为什么贴着胶囊」），`COMPOSER_OFFSET = 168` 只是量不到时的兜底；那个数字来自 dsh-git 记录的「输入框堆叠高度」，不是公开契约。
- 面板表面色用主题的**抬升面令牌** `--dsw-alias-bg-layer-1`、阴影用 `--dsw-shadow-lv2`。`--dsw-alias-bg-overlay` 在暗色下是 `neutral-bluish-700`（中灰），拿它当浮层底色会明显比产品本身「发灰」；差异行的增删底色是半透明 rgba（压在表面色之上，亮暗主题都可读），行号与 hunk 头走主题令牌。
- 拖动过位置后，视图尺寸变化只会把面板**夹回**可视区域内；想回到默认锚点用 `⌖` 或双击标题栏。
- 差异视图是**只读**的线条级着色（新增 / 删除 / 上下文 / hunk / 文件头），不含词级高亮与语法着色；不提供暂存、提交等任何写操作。
- **提交明细也是只读的**，而且只认 `sha`：不提供 checkout / cherry-pick / revert 之类任何动作。提交行给的是 `log` 里的**短 sha**（明细里显示完整 sha 的短形式），两次请求之间的 HEAD 移动不影响已经打开的明细（它显示的就是你点的那一次）。
- 打开提交明细**不改动左栏**：左栏始终是那块主面板（仓库路径 / 概览 / 提交列表 / 工作区清单），明细是中间新增的一栏。三栏宽度是 `左栏 380px（固定）+ 明细栏 240px + 抓握 6px + 差异栏（可拖，默认 470px）`，窗口不够宽时明细栏与差异栏一起被压缩（左栏不动）；明细栏宽度目前不可拖。
- 合并提交按**第一父提交**比较（见上文数据来源）；要看"相对第二父提交"的差异请用 `git show -m <sha>` 之类的命令。
- 切换会话/工作区会收起差异与提交明细——它们绑定在具体仓库上，跨仓库显示会误导。
- 差异模式的面板宽度是 `左栏 380px + 抓握 6px + 差异栏宽度`（左栏与单栏视图同宽，只有差异栏可拖）；打开提交明细时是 `左栏 380px + 明细栏 240px + 抓握 6px + 差异栏宽度`（明细栏宽度固定）。窗口不够宽时先压明细栏与差异栏，左栏不动。
- 需要 `dsh >= 0.1.5-rc.1`（`connection.requestRejection` 可用），且插件只在 Web GUI（`platform: web`）里有界面。

## 开发

没有构建步骤：两个半边都是手写的普通 JavaScript，直接发布 `lib/*.js`。

```sh
node --test test/*.test.mjs   # 或 npm test
```

测试分层（`test/helpers.mjs` 是两个半边共用的假 ctx/req/res 与 RPC 客户端）：

| 文件 | 覆盖 |
| --- | --- |
| `test/parse.test.mjs` | porcelain-v2 解析的纯函数用例（含空格路径、重命名原路径、冲突、清单截断） |
| `test/log.test.mjs` | 最近提交：短 sha、refs、特殊字符标题（NUL 分隔而不是按列切）、条数钳制、空仓库、非仓库 |
| `test/diff.test.mjs` | diff 解析（行号、hunk 重置、`--`/`++`/`@@` 内容行不误判、二进制、行数上限）、路径校验，以及真实仓库的工作区 / 已暂存 / 未跟踪 / 删除 / 二进制读取 |
| `test/commit.test.mjs` | 提交明细的宿主半：`--name-status -z` 解析（重命名成对路径、空格路径、截断）、sha 校验（`HEAD`/`HEAD~1`/`--help` 一律拒绝），以及真实仓库的元信息、根提交、重命名 / 删除、合并提交按第一父提交、空提交、`unknown-commit` |
| `test/session-changes.test.mjs` | 会话归因的宿主半：**会话一览**（没有服务时报 unavailable 而不是空列表、按目录去重只读一次、把"这个会话改过什么"一并带上）、**命令旁听**（只读命令不产候选、重定向/tee/sed -i/mv/cp/touch 各认一遍、失败命令只进历史、非 shell 工具与 cwd 之外不记、命令历史上限、候选上限、"可能相关"与"确定改过"互不污染、**必须把 waterfall 判定原样透传**）、**回合归属**（多轮动过同一文件时两轮都留、命令与候选也带回合、服务缺失或抛错时记 `null` 而不是 0）、意图 + 观察配对（读文件不算、别的调用不算、没有 callId 时退化配对）、cwd 之外不记、非 agent 调用不记、会话之间隔离、上限只计数、非法 cwd、卸载清空 |
| `test/route.test.mjs` | 线路层：假 ctx/req/res 驱动真实处理器（405 / 401 / 415 / 413 / 404 / 400 / 信封形状 / `details.code`） |
| `test/status.test.mjs` | 在临时目录里 `git init` 的真实仓库：干净、改动分类、重命名、detached、非仓库、目录不存在 |
| `test/client.test.mjs` | 浏览器半：**⋯ 菜单摘要**（两行内容、干净时明说而不是消失、随档位开关、没有数据不画、非仓库也能用）、**侧栏状态三档**（默认常亮、循环顺序、坏存档退回常亮、常亮标记的优先级 `●n`→`◐n`→`!n`、两位数收成 `+`、干净且没改过不画、常亮只在行首画、悬停只在动条画、关了一处都不画、关掉时卡片详情一起撤、面板开关显示当前档位）、**侧栏状态**（动作条那枚只有图标级宽度、脏+改动才有、干净且没改过整枚不画、非仓库但本会话改过仍要画、悬停详情的内容与"空则整块不画"、宿主不认端点时整片不画、批量取回按 sessionId 索引、12s 自己的节奏）、**审阅进度**（点行尾标记按签名落盘、再点取消、签名变了降级成"需要重看"、清空只清当前工作区、没有归因数据时那一行照样出来、`v` 键作用于光标那一行）、**样式表结构自检**（解析自有样式表：不允许"没成规则的片段"、注释外不许有中文、每条规则都要有合法选择器、15 条关键规则一条不能少）—— 只断言"文本里有某个值"是挡不住的：规则被浏览器整条吞掉时文本照样在（这个坑踩过一次，见下"已知边界"）；假 window/document/React 评估 bundle，验证模块契约、两条座位、共享 store、样式表所有权标记与自愈、轮询，直接渲染胶囊与面板的各种状态，并用真实 store + rpc stub 走通「点提交 → 取提交 → 自动打开第一个文件 → 再点收起」以及键盘移动（↑/↓、Enter、`[`/`]`、n/p、Space、Esc，含"没激活就不接管按键"）整条接线。**会话归因**另有一组：store 面（随刷新取回并归一成以文件为键的表、宿主不认端点时保持"没有数据"、换会话先清空、过滤器与键盘导航共用同一份清单、开关落盘）与组件面（那行的计数与开关、行首 `●`/`○`、没有数据时整列不画、过滤后清空给一句说明、胶囊只在真有改动时挂 `│ ●n`）。 |
| `test/e2e.test.mjs` | 端到端契约：按浏览器半的方式发请求打到真实仓库，断言返回字段正是浏览器半要读的那些（含 `commit` / `commit-diff` 的短 sha → 完整 sha 链路） |

改完代码**最稳的是完全退出 DSH 再打开**，而不是只刷新页面：

- 浏览器半的 bundle body 由 host 在内存里缓存，脚本 URL 带着启动时算出的 `?rev=<rev>`（`plugins/dsh-hud/client.web.js?rev=…`）；按框架自己的说法，"bundle 内容变更只能通过 `rebuilt()`（HMR 钩子）进入图"。
- 而 desktop profile 里 host 侧的 HMR 是关掉的（`cordis-plugin-hmr: disabled: true`），所以没有重建信号：页面刷新拿到的可能仍是旧 body。**只刷新页面时如果没看到改动，重启一次应用再看**。
- 改了 `package.json` 的 `dsh.client` 或 `cordis.patch.yml` 同样必须重启。

排查"改完了但界面没变"时，先看 `localStorage["dsh-hud.debug"]` 里有没有 `apply` 这一行（见「已知边界」）：有它就说明浏览器跑的是新代码，没有就说明还在旧 bundle 上。

## 许可

[MIT](./LICENSE)
