# 收录到插件市场（awesome-dsh-plugin）

投稿是**一个文件**：`data/plugins/konnga__dsh-hud.yml`（文件名 = `<owner>__<repo>`）。
两个 README 由他们的脚本从 `data/plugins/*.yml` 生成 —— **不要手工编辑**，也不要一次改多条。

## 提交内容

```yaml
url: https://github.com/konnga/dsh-hud
name: konnga/dsh-hud
category: git
description:
  en: "Read-only Git panel for the current workspace: branch, changed files and diffs, plus which files this session changed, what has been reviewed, and which tools and skills it ran."
  zh: "当前工作区的只读 Git 面板：分支、改动清单与差异，另有「这个会话改过哪些文件、审到哪了、跑了哪些工具与技能」。"
```

- `category: git` 在他们的合法取值里，也正是这个插件实际做的事；选得不够准不会被打回（维护者会直接改）。
- **`en` 里含 `: ` 必须加引号**，否则 YAML 会当成嵌套键（我们已加）。
- 描述会被**对着代码核**：写到的每一项都要真存在 —— 只写实际有的（只读面板 / 改动清单与差异 / 会话归因 / 审阅进度 / 工具与技能），不加营销词。
- 提交方式：打开 `https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/new/main/data/plugins`，文件名填 `konnga__dsh-hud.yml`，粘贴上面 7 行，GitHub 会自动 fork 并提 PR。

## 前置条件（CI 会逐条查）

| 条件 | 状态 |
| --- | --- |
| `package.json` 声明 `dsh.bundle`（只声明 `dsh.client` 不算） | ✓ `{ "patch": "./cordis.patch.yml" }` |
| 仓库根有 `cordis.patch.yml`（`insert: id/name` 两条） | ✓ |
| 真实可用的代码，非占位 / 非纯 README | ✓ |
| **仓库创建满 1 天** | 2026-10-16 建 → **10-17 之后**才过 |
| 仓库加了 `dsh-plugin` topic | ✓ 2026-10-16 已加 |
| `@deepseek-ai/*` 用 `peerDependencies` | ✓ 6 个客户端包都是 optional peer |
| 已发布 npm（可选；只影响下载量数字） | ✓ 0.9.0 |
| `screenshots.json` 放在**本仓库**（可选，市场详情页用） | ✓ 三张：`docs/images/capsules.webp`、`panel.webp`、`turn-images.webp` |

## 以后更新自己的条目

只改 `data/plugins/konnga__dsh-hud.yml` 再提 PR。截图不用来这里改 —— 推本仓库的
`screenshots.json` 即可，下一次构建自动生效。

## 两个已知的坑（来自他们的 contributing）

- **`latest/download/` 只在请求时解析 `latest`，文件名按字面取**：资产名带版本号的话，
  提 PR 当天有效、下次发版就 404。我们没用到这个字段（不发 tarball，走 npm）。条目里也**不要**手写 `npm:` 键（会被校验拒绝，映射自动采集）。
- **不带显式预发布分支的 peer 范围会静默排除 harness 的预发布构建**：node-semver 只有当范围里
  某个比较符与该版本的 `major.minor.patch` 完全一致、且自身带预发布标签时才放行预发布。
  我们的客户端 peer 写的是 `"*"`，按此规则同样匹配不到 `0.1.0-rc.6` 这类版本 —— 目前是
  optional peer、实际安装正常，所以没动；若哪天有人报 `ERESOLVE`，按他们的 `||` 分支写法改。
