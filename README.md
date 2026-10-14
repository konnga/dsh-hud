# dsh-hud

> DeepSeek Harness 的**当前项目 Git 悬浮面板** —— 分支、ahead/behind、脏状态与改动清单，全部只读。
> A read-only Git HUD floating panel for DeepSeek Harness.

`dsh-hud` 是一个双面 npm 插件包：宿主半在本地跑 `git` 并把结果通过包私有 RPC 交给页面，浏览器半把结果渲染成输入框上方的**胶囊**和一块**可拖动的悬浮面板**。它跟着**当前会话的工作区**走：在侧栏切换会话/工作区时，面板会实时重新绑定到那个目录。

## 界面

- **胶囊**（输入框上方那一行，**靠左的紧凑胶囊**，不撑满整行）：`⎇ feat-mooen* ↑1 ↓2 M4 A1 ?1`。
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
  - 点击开关面板。
- **悬浮面板**（默认停在输入框上方居中）：
  - 标题栏：分支/DETACHED 标记，`⟳` 刷新、`⌖` 复位位置、`✕` 收起；**拖动标题栏可移动面板**，**双击标题栏复位**。
  - 仓库路径、上游分支、领先/落后、短 oid。
  - 改动概览：按类型分组的彩色计数（已修改 / 已暂存新增 / 已删除 / 重命名 / 复制 / 类型改变 / 未跟踪 / 冲突），**只显示非零项**；没有改动时显示"工作区干净"。
  - 改动清单：每行一个 porcelain-v2 状态字母 + 路径，重命名读作 `旧 → 新`。
  - 底栏：`只读` 与最近一次成功读取的时间。

面板的展开状态与拖动位置记在浏览器 `localStorage`（键 `dsh-hud.ui.v1`），刷新后保持。

## 架构

一个双面 npm 包：

| 半边 | 文件 | 职责 |
| --- | --- | --- |
| 宿主 | `lib/index.js` | Cordis 插件（bundle 行 `dsh-hud`），在自己的 `ctx.webServer` 上注册 `/dsh-hud-rpc` 前缀路由，收发与内置 `/api` 相同的 Connection RPC 信封，并把请求围栏交给 `connection.requestRejection`（Host/Origin + 浏览器会话认证）。所有 git 调用走 `execFile`（无 shell）、带超时、输出有界，并按 cwd 做 1.5s 缓存 + 在途请求合并。 |
| 浏览器 | `lib/client.js` | `dsh.client` bundle（`exports["./client"]`），两个座位 + 一个共享 store，只依赖种子模块 `react`。 |

### 为什么自持 HTTP 路由

`dsh >= 0.1.5-rc.1` 起，外部插件**不能**再用 `ctx.connection.rpc.handle()`：Connection 插件是在自己内部的 `ctx.inject(["webServer"], …)` 作用域里注册路由的，无论调用方 inject 了什么，那一行都会以 `cannot get property "webServer" without inject` 挂载失败。因此本插件自持 `/dsh-hud-rpc` 路由、自己实现同一套信封，只借用 Connection 的信任判定，安全等级与内置 `/api` 一致。

### 为什么面板要靠胶囊喂数据

`shell.overlay` 是 **root 作用域**的座位，读不到"当前会话"（`dsh 0.1.6-alpha.2` 起会话列表快照不再带 `current`，当前会话由渲染器只投递给**会话作用域**的座位）。所以：

- **胶囊**坐在会话作用域的 `conversation.input.dock`，框架直接给出 `sessionId`；它从 `useSessions` 快照里取该会话的 `cwd`，调用共享 store 的 `bindSession(sessionId, cwd)`。
- **面板**坐在 root 作用域的 `shell.overlay`，只读共享 store 的 `sessionId` / `cwd`。

右栏里的嵌入式会话（子会话 chat）自带会话绑定，胶囊用快照的 `retainedBy.mainView` 排除它们，避免一个子会话把面板下面的仓库抽走；快照不带这个计数（更旧的宿主）时按主视图放行，胶囊不会因此消失。

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
| `status` | `{ cwd }` | `{ repo, branch, detached, oid, upstream, ahead, behind, dirty, counts: { modified, added, deleted, renamed, copied, typeChanged, untracked, conflicted }, changes: [{ status, index, worktree, path, file, origFile }], truncated }`。`cwd` 必须是绝对路径；不是仓库时 `repo` 为 `null`（这是成功结果，不是错误）。`path` 是展示串（重命名读作 `旧 → 新`），`file`/`origFile` 是原始路径，`index`/`worktree` 是 porcelain-v2 的两个字母。 |

`details.code` 取值：`invalid-cwd`、`no-cwd`、`git-missing`、`git-failed`、`timeout`、`unknown-endpoint`。

## 数据来源与边界

数据来自两条只读命令：

```bash
git rev-parse --show-toplevel
git status --porcelain=v2 --branch -z --untracked-files=normal
```

- **只读**：不执行 `add`/`commit`/`checkout`/`fetch` 等任何写操作，不碰 index、工作区或 git 配置，不读取文件内容，不显示凭证。想改东西请用编辑器或终端（也可以配 `dsh-git` 那类带写操作的插件）。
- 路径解析按 porcelain-v2 的字段数用 `indexOf` 切分，**不整行切空格**，所以含空格的路径原样保留（有测试守着）。
- 改动清单上限 200 条，超出只计数并置 `truncated`；`git status` 单次超时 30s，输出上限 8 MiB。
- 同一 cwd 的状态缓存 1.5s、最多 32 个；浏览器每 8s 轮询一次（页面不可见时跳过，回到页面立刻补一次）。

## 已知边界

- **胶囊不可省**：面板本身读不到当前会话，见上文"为什么面板要靠胶囊喂数据"。若把胶囊座位去掉，面板会停在最后一次绑定的目录上。
- 面板默认锚点 `bottom: 168px` 是**对输入框堆叠高度的一次测量**（输入框卡片 + 工具行 + dock 行），不是公开契约。输入框变高变矮时需要重新测量 `lib/client.js` 里的 `COMPOSER_OFFSET`。
- 拖动过位置后，视图尺寸变化只会把面板**夹回**可视区域内；想回到默认锚点用 `⌖` 或双击标题栏。
- 只显示改动清单，不含单文件 diff。
- 需要 `dsh >= 0.1.5-rc.1`（`connection.requestRejection` 可用），且插件只在 Web GUI（`platform: web`）里有界面。

## 开发

没有构建步骤：两个半边都是手写的普通 JavaScript，直接发布 `lib/*.js`。

```sh
node --test test/*.test.mjs   # 或 npm test
```

测试分五层（`test/helpers.mjs` 是两个半边共用的假 ctx/req/res 与 RPC 客户端）：

| 文件 | 覆盖 |
| --- | --- |
| `test/parse.test.mjs` | porcelain-v2 解析的纯函数用例（含空格路径、重命名原路径、冲突、清单截断） |
| `test/route.test.mjs` | 线路层：假 ctx/req/res 驱动真实处理器（405 / 401 / 415 / 413 / 404 / 400 / 信封形状 / `details.code`） |
| `test/status.test.mjs` | 在临时目录里 `git init` 的真实仓库：干净、改动分类、重命名、detached、非仓库、目录不存在 |
| `test/client.test.mjs` | 浏览器半：假 window/document/React 评估 bundle，验证模块契约、两条座位、共享 store、样式与轮询，并直接渲染胶囊与面板的各种状态 |
| `test/e2e.test.mjs` | 端到端契约：按浏览器半的方式发请求打到真实仓库，断言返回字段正是浏览器半要读的那些 |

改代码后如果装的是 `link:`，刷新页面即可；改了 `package.json` 的 `dsh.client` 或 `cordis.patch.yml` 需要重启 DSH。

## 许可

[MIT](./LICENSE)
