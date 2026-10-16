/**
 * dsh-hud — 浏览器半（dsh.client bundle）。
 *
 * 两个座位，一个共享 store：
 *
 *   - `conversation.input.dock` → HudDockPill：输入框上方那一行里靠左的紧凑状态胶囊
 *     （分支摘要，或“非 git 仓库”），点击开关面板。这个座位是**会话作用域**，
 *     框架直接把当前 `sessionId` 交给它，它再从 `useSessions` 快照里取该会话的
 *     `cwd` 写进共享 store —— 这是 root 作用域的面板**读不到**的东西。
 *   - `shell.overlay` → HudFloatingPanel：收起来时渲染 `null`（不留会挡住输入框的气泡），
 *     展开时是悬浮面板，默认停在输入框上方。
 *
 * 所有 git 工作都在宿主半（`/dsh-hud-rpc`）；本文件只负责渲染与取数。
 * 手写对照客户端模块表（只用到种子模块 `react`），因此没有构建步骤。
 */

window.__ModuleLoader__.load({
  id: '@konnga/dsh-hud',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var h = React.createElement;

    var CHANNEL = "/dsh-hud-rpc";
    var NS = "dshHud";
    var UI_KEY = "dsh-hud.ui.v1";
    /**
     * 插件自诊断的留存键（最近 24 行）：会话归因每一步的事实都往这里留一行。
     *
     * 为什么落在这里：客户端插件的异常与"服务找不到"都不会进宿主日志，界面出问题时往往只有
     * 有/没有两种观察；把每一步的事实留一行在 localStorage，用户不用开 DevTools 也能把它捞出来，
     * 排查完可以随手删掉。
     */
    var DEBUG_KEY = "dsh-hud.debug";

    /** 轮询间隔：面板与胶囊共用，页面不可见时跳过。 */
    var POLL_MS = 8000;
    /**
     * 侧栏行内 chip 的轮询节奏：比面板慢一档。
     *
     * 那些 chip 是"扫一眼"的信息（哪个会话脏了），不值得跟面板一样频繁；宿主侧还按目录
     * 缓存 + 去重，多会话共用一个目录只跑一次 git。
     */
    var ROWS_POLL_MS = 12000;
    /** 面板默认宽度与“停靠在输入框上方”的锚点高度。 */
    var PANEL_WIDTH = 380;
    var COMPOSER_OFFSET = 168;
    var VIEWPORT_MARGIN = 8;
    /** 超过这个位移才算拖动，避免把头部上的普通点击当成拖动。 */
    var DRAG_THRESHOLD_PX = 3;
    /** 面板与胶囊所在 dock 行之间的间距。 */
    var PANEL_DOCK_GAP = 8;
    /**
     * 中间那一栏（打开提交明细时：这次提交的元信息 + 改动清单）的宽度。
     * 它夹在左栏与差异栏之间，是固定的——右边缘那个抓握仍只调整差异栏。
     */
    var COMMIT_LIST_WIDTH = 240;


    /** diff 模式的面板：更宽，且用固定高度（避免 bottom 锚定下"内容变高就跳位"）。 */
    /** 右栏（差异）默认宽度、下限，以及面板右边缘抓握的宽度。 */
    var DIFF_DEFAULT_WIDTH = 470;
    var DIFF_MIN_WIDTH = 240;
    var RESIZE_GRIP_WIDTH = 6;
    var DIFF_PANEL_HEIGHT_VH = 0.72;

    var inject = ["slots", "connection", "locale"];

    /* ------------------------------------------------------------- 文案 */

    var zh = {
      "panel.title": "Git",
      "panel.refresh": "刷新",
      "panel.reset": "复位位置",
      "panel.close": "收起面板",
      "panel.dragHint": "拖动标题可移动面板，双击标题复位",
      "panel.loading": "读取中…",
      "panel.clean": "工作区干净，没有未提交的改动",
      "panel.notRepo": "当前会话的工作区不是 Git 仓库",
      "panel.noSession": "还没有绑定到会话的工作区",
      "panel.summary": "改动概览",
      "panel.changes": "改动清单",
      "panel.truncated": "仅显示前 200 条",
      "panel.readonly": "只读",
      "panel.upstream": "上游",
      "panel.updated": "更新于 ",
      "panel.ahead": "领先 ",
      "panel.behind": "落后 ",
      "panel.detached": "detached",
      "panel.clickForDiff": "点击一行查看该文件的差异",
      "panel.rowKeys": "在面板里按过之后再按 ↑/↓ 选行、Enter 打开",
      "panel.commits": "最近提交",
      "time.now": "刚刚",
      "time.minutes": " 分钟前",
      "time.hours": " 小时前",
      "time.days": " 天前",
      "diff.close": "关闭差异",
      "diff.resize": "拖动右边缘调整差异宽度",
      "diff.worktree": "未暂存",
      "diff.index": "已暂存",
      "diff.wrap": "自动换行",
      "diff.copy": "复制差异",
      "diff.copied": "已复制",
      "diff.empty": "这一侧没有差异",
      "diff.binary": "二进制文件，没有可显示的文本差异",
      "diff.truncated": "差异过大，仅显示前面部分",
      "diff.untrackedHint": "未跟踪文件，与空文件对比",
      "diff.commitHint": "这次提交相对其父提交的差异（只读）",
      "diff.hunkToggle": "点这一行折叠 / 展开这个 hunk（滚动到它后按 Space 一样）",
      "commit.files": "这次提交改动",
      "commit.close": "收起提交明细",
      "commit.empty": "这次提交没有改动文件（空提交）",
      "commit.loading": "读取这次提交…",
      "commit.merge": "合并提交，按第一父提交比较",
      "commit.unknown": "找不到这次提交：可能已被 rebase / amend 换掉，刷新面板再看",
      "commit.click": "点击查看这次提交改了什么",
      // ── 会话归因（本会话改过哪些文件） ──
      "session.line": "本会话改过 {n} 个文件",
      "tools.now": "现在在跑：{name}",
      "tools.total": "本会话共 {n} 次工具调用",
      "tools.byTool": "各工具：",
      "tools.recent": "最近：",
      "rows.ownNone": "本会话没有改动记录",
      "rows.noRepo": "不在 git 仓库里",
      "rows.error": "读取失败（{code}）",
      "rows.possible": "另有 {n} 个可能相关（命令旁听）",
      "review.count": "已审 {n}/{total}",
      "review.staleCount": "{n} 个改动已变，需要重看",
      "review.mark": "标成「这一版我审过了」（键盘：v）",
      "review.unmark": "取消「已审」（键盘：v）",
      "review.stale": "改动已变，需要重看（标记的是更早的那一版）",
      "review.clear": "清空这个工作区的「已审」标记",
      "review.clearShort": "清空已审",
      "session.latestTurn": "最近一轮 {n} 个",
      "session.turn": "第 {n} 轮",
      "session.turnWithPrompt": "第 {n} 轮：{prompt}",
      "session.onlyLatest": "只看最近一轮",
      "session.onlyLatestTitle": "把清单收窄到最近这一轮动过的文件（「这一轮改了什么」）",
      "session.possible": "另有 {n} 个可能相关（命令旁听）",
      "session.possibleDropped": "还有 {n} 个超出上限未记",
      "session.possibleTitle": "可能相关（未确认）：{reason}",
      "session.commands": "最近跑过 {n} 条命令：",
      "session.commandsMore": "…另有 {n} 条会写文件的命令",
      "session.commandFailed": "（这条失败了）",
      "session.gone": "{n} 个已不在 git 现状里（改回去了 / 被忽略 / 被覆盖）",
      "session.dropped": "另有 {n} 个超出上限未记录",
      "session.only": "只看本会话改的",
      "session.onlyTitle": "把清单过滤成本会话动过的文件（确定的 + 命令旁听到的「可能相关」，与 git 现状求交）",
      "session.mine": "本会话改的",
      "session.other": "不是本会话改的（可能是你自己、编辑器或另一个会话）",
      "session.writes": "写入 {n} 次",
      "session.edits": "编辑 {n} 次",
      "session.since": "自 {time} 起记录（宿主进程启动之前的不算）",
      "session.pill": "本会话改过 {n} 个文件",
      "session.empty": "本会话还没有改动（清掉上面的过滤器看看工作区现状）",
      "pill.loading": "读取中…",
      "pill.notRepo": "非 git 仓库",
      "pill.error": "读取失败",
      "pill.title": "点击展开 Git 面板",
      "count.modified": "已修改",
      "count.added": "已暂存新增",
      "count.deleted": "已删除",
      "count.renamed": "重命名",
      "count.copied": "复制",
      "count.typeChanged": "类型改变",
      "count.untracked": "未跟踪",
      "count.conflicted": "冲突",
      "err.timeout": "git 超时：仓库过大或磁盘繁忙",
      "err.no-cwd": "工作区目录不存在",
      "err.git-missing": "找不到 git 可执行文件",
      "err.invalid-cwd": "无效的工作区路径",
      "err.git-failed": "git 执行失败",
      "err.invalid-path": "无效的文件路径",
      "err.stale-host": "宿主半还没有这个端点：插件刚更新，需要重启 DSH 让宿主半重新加载",
      "err.transport": "无法连接到宿主半",
    };

    var en = {
      "panel.title": "Git",
      "panel.refresh": "Refresh",
      "panel.reset": "Reset position",
      "panel.close": "Collapse panel",
      "panel.dragHint": "Drag the title to move the panel; double-click it to reset",
      "panel.loading": "Loading…",
      "panel.clean": "Working tree clean — nothing uncommitted",
      "panel.notRepo": "The current session workspace is not a Git repository",
      "panel.noSession": "Not bound to a session workspace yet",
      "panel.summary": "Summary",
      "panel.changes": "Changes",
      "panel.truncated": "Showing the first 200 entries only",
      "panel.readonly": "Read-only",
      "panel.upstream": "upstream",
      "panel.updated": "Updated ",
      "panel.ahead": "ahead ",
      "panel.behind": "behind ",
      "panel.detached": "detached",
      "panel.clickForDiff": "Click a file to see its diff",
      "panel.rowKeys": "Once you have clicked in the panel: ↑/↓ to select a row, Enter to open it",
      "panel.commits": "Recent commits",
      "time.now": "just now",
      "time.minutes": "m ago",
      "time.hours": "h ago",
      "time.days": "d ago",
      "diff.close": "Close diff",
      "diff.resize": "Drag the right edge to resize the diff",
      "diff.worktree": "Unstaged",
      "diff.index": "Staged",
      "diff.wrap": "Wrap lines",
      "diff.copy": "Copy diff",
      "diff.copied": "Copied",
      "diff.empty": "No changes on this side",
      "diff.binary": "Binary file — no text diff to show",
      "diff.truncated": "Diff is large; showing the beginning only",
      "diff.untrackedHint": "Untracked file, diffed against an empty file",
      "diff.commitHint": "What this commit changed against its parent (read-only)",
      "diff.hunkToggle": "Click this row to collapse or expand the hunk (same as Space once it is the current one)",
      "commit.files": "Files in this commit",
      "commit.close": "Close the commit detail",
      "commit.empty": "This commit changes no files (empty commit)",
      "commit.loading": "Reading this commit…",
      "commit.merge": "Merge commit, compared against its first parent",
      "commit.unknown": "Commit not found: it may have been rebased or amended away — refresh the panel",
      "commit.click": "Click to see what this commit changed",
      "session.line": "{n} file(s) changed by this session",
      "tools.now": "Running now: {name}",
      "tools.total": "{n} tool call(s) this session",
      "tools.byTool": "By tool:",
      "tools.recent": "Recent:",
      "rows.ownNone": "this session has no recorded changes",
      "rows.noRepo": "not in a git repository",
      "rows.error": "read failed ({code})",
      "rows.possible": "{n} more possibly related (from commands)",
      "review.count": "{n}/{total} reviewed",
      "review.staleCount": "{n} changed since reviewed",
      "review.mark": "Mark this revision as reviewed (key: v)",
      "review.unmark": "Unmark reviewed (key: v)",
      "review.stale": "Changed since you reviewed it (your mark was an earlier revision)",
      "review.clear": "Clear the reviewed marks for this workspace",
      "review.clearShort": "Clear reviewed",
      "session.latestTurn": "{n} in the latest turn",
      "session.turn": "turn {n}",
      "session.turnWithPrompt": "turn {n}: {prompt}",
      "session.onlyLatest": "Latest turn only",
      "session.onlyLatestTitle": "Narrow the list to the files the latest turn changed",
      "session.possible": "{n} more possibly related (seen in commands)",
      "session.possibleDropped": "{n} more over the cap",
      "session.possibleTitle": "Possibly related (unconfirmed): {reason}",
      "session.commands": "Last {n} command(s) run:",
      "session.commandsMore": "…plus {n} more that write files",
      "session.commandFailed": "(this one failed)",
      "session.gone": "{n} no longer in the git status (reverted, ignored, or overwritten)",
      "session.dropped": "{n} more not recorded (over the cap)",
      "session.only": "Only this session's",
      "session.onlyTitle": "Filter the list to files this session touched (confirmed plus command-inferred, intersected with git)",
      "session.mine": "Changed by this session",
      "session.other": "Not changed by this session (you, your editor, or another session)",
      "session.writes": "{n} write(s)",
      "session.edits": "{n} edit(s)",
      "session.since": "Recorded since {time} (anything before the host process started is not)",
      "session.pill": "{n} file(s) changed by this session",
      "session.empty": "This session has not changed anything yet (clear the filter above to see the workspace)",
      "pill.loading": "Loading…",
      "pill.notRepo": "not a git repo",
      "pill.error": "read failed",
      "pill.title": "Click to open the Git panel",
      "count.modified": "modified",
      "count.added": "added",
      "count.deleted": "deleted",
      "count.renamed": "renamed",
      "count.copied": "copied",
      "count.typeChanged": "type changed",
      "count.untracked": "untracked",
      "count.conflicted": "conflicted",
      "err.timeout": "git timed out: the repository is large or the disk is busy",
      "err.no-cwd": "The workspace directory does not exist",
      "err.git-missing": "git executable not found",
      "err.invalid-cwd": "Invalid workspace path",
      "err.git-failed": "git failed",
      "err.invalid-path": "Invalid file path",
      "err.stale-host": "The host half does not have this endpoint yet: the plugin was just updated, restart DSH so the host half reloads",
      "err.transport": "Cannot reach the host half",
    };

    /** 改动类型的固定展示顺序，与宿主半的 counts 键一致。 */
    var COUNT_ORDER = [
      "modified",
      "added",
      "deleted",
      "renamed",
      "copied",
      "typeChanged",
      "untracked",
      "conflicted",
    ];

    /** 每类改动对应的主题色令牌（都带回退色，暗亮色主题都能看）。 */
    var COUNT_COLOR = {
      modified: "var(--dsw-alias-state-warn-primary, #d9a63c)",
      added: "var(--dsw-alias-state-success-primary, #3fb950)",
      deleted: "var(--dsw-alias-state-error-primary, #f06a6a)",
      renamed: "var(--dsw-alias-brand-primary, #4b8bf5)",
      copied: "var(--dsw-alias-brand-primary, #4b8bf5)",
      typeChanged: "var(--dsw-alias-state-idle-primary, #8a8f98)",
      untracked: "var(--dsw-alias-label-secondary, #8a8f98)",
      conflicted: "var(--dsw-alias-state-error-primary, #f06a6a)",
    };

    /**
     * 每个改动类型在胶囊里的简写符，沿用 codex-hud / 上游 statusline 的 git 标记约定：
     * M 已修改、A 已暂存新增、D 已删除、R 重命名、C 复制、T 类型改变、? 未跟踪、! 冲突。
     */
    var COUNT_MARK = {
      modified: "M",
      added: "A",
      deleted: "D",
      renamed: "R",
      copied: "C",
      typeChanged: "T",
      untracked: "?",
      conflicted: "!",
    };

    /** 胶囊里分支名的显示上限；超出就中段省略，别把简写符挤出可见区。 */
    var PILL_BRANCH_MAX = 28;

    /**
     * 差异行的底色：半透明，压在面板表面色之上，因此亮/暗主题都可读
     * （文本与行号仍走主题令牌）。
     */
    var DIFF_ADD_BG = "rgba(63,185,80,0.12)";
    var DIFF_DEL_BG = "rgba(240,106,106,0.13)";
    var DIFF_GUTTER_COLOR = "var(--dsw-alias-label-secondary, #8a8f98)";

    /* --------------------------------------------------------- 本地 UI 状态 */

    function readUi() {
      try {
        var raw = window.localStorage.getItem(UI_KEY);
        if (!raw) return {};
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        return {};
      }
    }

    function writeUi(next) {
      try {
        window.localStorage.setItem(UI_KEY, JSON.stringify(next));
      } catch (error) {
        // 隐私模式等写入失败只影响“记住位置/展开状态”，不影响功能。
      }
    }

    /** 「审阅进度」的存档键：按"工作区 + 文件"记下审过的那一版签名。 */
    var REVIEWED_KEY = "dsh-hud.reviewed.v1";
    /**
     * 存档键的分隔符：NUL。
     *
     * 用 `String.fromCharCode(0)` 而不是 `"\u0000"` 字面量：路径里不可能有 NUL，而转义写法
     * 在源码与测试里极易被多转一层（写成字面量反斜杠），排查起来极其费劲。
     */
    var REVIEW_KEY_SEP = String.fromCharCode(0);

    /** 存档键：`工作区 NUL 文件`（同一个文件名在别的仓库里是另一码事）。 */
    function reviewKeyOf(cwd, file) {
      return String(cwd || "") + REVIEW_KEY_SEP + file;
    }
    /** 存档上限：超出丢最久没动的那些（不然用久了这个键会一直长）。 */
    var REVIEWED_MAX = 200;

    /** 读取"我审过哪些版本"：坏数据一律当空表（存档不该把插件带崩）。 */
    function readReviewed() {
      try {
        var raw = window.localStorage.getItem(REVIEWED_KEY);
        if (!raw) return {};
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        var out = {};
        for (var key in parsed) {
          var item = parsed[key];
          if (!Object.prototype.hasOwnProperty.call(parsed, key) || !item || typeof item !== "object") continue;
          if (typeof item.signature !== "string") continue;
          out[key] = { signature: item.signature, at: typeof item.at === "number" ? item.at : 0 };
        }
        return out;
      } catch (error) {
        return {};
      }
    }

    /** 写回"我审过哪些版本"：超上限就按最后触达时间丢最旧的。 */
    function writeReviewed(next) {
      try {
        var keys = Object.keys(next);
        if (keys.length > REVIEWED_MAX) {
          keys.sort(function (left, right) {
            return (next[left].at || 0) - (next[right].at || 0);
          });
          var trimmed = {};
          var keep = keys.slice(keys.length - REVIEWED_MAX);
          for (var index = 0; index < keep.length; index += 1) trimmed[keep[index]] = next[keep[index]];
          next = trimmed;
        }
        window.localStorage.setItem(REVIEWED_KEY, JSON.stringify(next));
        return next;
      } catch (error) {
        // 写不进去只意味着"这次不记住"，不影响功能。
        return next;
      }
    }

    /* --------------------------------------------------------------- store */

    /**
     * 插件自诊断的现场记录：只写控制台，不碰界面、不留全局。
     *
     * 客户端插件的异常和"服务找不到"都不会进宿主日志，所以控制台是排查时唯一的通道。
     * 同一个 reason + 同样的事实只报一次（轮询每 8s 会重试），一行 JSON 便于复制。
     */
    function createProbe() {
      var seen = {};
      return {
        /** 记一行现场：一行进控制台，同时留一份在 localStorage（都按 reason+事实去重）。 */
        log: function (reason, detail) {
          var facts = detail === undefined ? {} : detail;
          var line = reason + " " + JSON.stringify(facts);
          if (seen[line] === true) return;
          seen[line] = true;
          console.warn("[dsh-hud] " + line);
          try {
            var history = window.localStorage.getItem(DEBUG_KEY);
            var parsed = history === null ? [] : JSON.parse(history);
            var list = Array.isArray(parsed) ? parsed : [];
            list.push({ at: Date.now(), line: line });
            window.localStorage.setItem(DEBUG_KEY, JSON.stringify(list.slice(-24)));
          } catch (error) {
            // 隐私模式等写不进去只影响这行诊断，不影响功能。
          }
        },
      };
    }

    /* --------------------------------------------------- 会话归因（对账） */

    /**
     * 把"本会话改过哪些文件"（宿主半按 fs 事件记的）与 git 现状对起来。
     *
     * - `mine`：本会话改过、且工作区里还有差异（`status.changes` 里能找到）
     * - `gone`：本会话改过、但工作区里已经没有差异（被改回去了 / 被别的会话或你自己覆盖了）
     * - `others`：工作区里有差异、但不是本会话动的
     *
     * 名字能直接对上：宿主报的是 cwd 之内的 posix 相对路径，`status.changes[].file` 也是。
     * 还拿不到归因（老宿主 / 请求还没回来）时返回 `null` —— 界面这时**不打任何标记**，
     * 而不是把所有改动都标成"别人的"。
     */
    function sessionChangeView(state) {
      var slice = state.sessionChanges;
      var files = slice !== undefined && slice !== null && slice.files !== null && slice.files !== undefined ? slice.files : null;
      if (files === null) return null;
      var possibleAll = slice.possible !== undefined && slice.possible !== null ? slice.possible : null;
      var changes = state.status && Array.isArray(state.status.changes) ? state.status.changes : [];
      var mine = {};
      var possible = {};
      var gone = [];
      var index;
      var change;
      // 先认"确定改过"的：一档优先于一档，同一个文件不会被标两次。
      for (index = 0; index < changes.length; index += 1) {
        change = changes[index];
        if (Object.prototype.hasOwnProperty.call(files, change.file)) mine[change.file] = files[change.file];
      }
      // 再看"可能相关"：只标没有被确定认领的那些（命令旁听来的，置信度低一档）。
      for (index = 0; index < changes.length; index += 1) {
        change = changes[index];
        if (mine[change.file] !== undefined) continue;
        if (possibleAll !== null && Object.prototype.hasOwnProperty.call(possibleAll, change.file)) {
          possible[change.file] = possibleAll[change.file];
        }
      }
      for (var file in files) {
        if (Object.prototype.hasOwnProperty.call(files, file) && mine[file] === undefined) gone.push(file);
      }
      gone.sort();
      var commands = Array.isArray(slice.commands) ? slice.commands : [];
      var turns = state.turns !== undefined && state.turns !== null && state.turns.available === true ? state.turns : null;
      var latestTurn = turns === null ? null : turns.latest;
      var byTurn = {};
      var latestCount = 0;
      for (var file in mine) {
        if (!Object.prototype.hasOwnProperty.call(mine, file)) continue;
        var turn = typeof mine[file].lastTurn === "number" ? mine[file].lastTurn : null;
        if (turn === null) continue;
        byTurn[turn] = (byTurn[turn] === undefined ? 0 : byTurn[turn]) + 1;
        if (latestTurn !== null && turn === latestTurn) latestCount += 1;
      }
      return {
        mine: mine,
        possible: possible,
        /** 第几轮 → prompt 预览（来自 `turnOutline` 投影；没有就是空表）。 */
        turnPrompts: turns === null ? {} : turns.prompts,
        latestTurn: latestTurn,
        latestCount: latestCount,
        byTurn: byTurn,
        mineCount: Object.keys(mine).length,
        possibleCount: Object.keys(possible).length,
        /** 跑过的命令里"看着会写文件"的条数（含失败的，界面自己再分）。 */
        commandCount: commands.length,
        writingCommands: commands.filter(function (item) { return item && item.readOnly !== true; }).length,
        commands: commands,
        gone: gone,
        /** 本会话记录过的文件总数（宿主那边的集合大小）。 */
        tracked: Object.keys(files).length,
        since: slice.since === undefined ? null : slice.since,
        dropped: slice.dropped === undefined ? 0 : slice.dropped,
        possibleDropped: slice.possibleDropped === undefined ? 0 : slice.possibleDropped,
        others: changes.length - Object.keys(mine).length,
      };
    }

    /**
     * 审阅进度：`{ marks: {file → 'fresh'|'stale'}, done, total, staleCount }`。
     *
     * 判据是**签名**：宿主 stat 出来的 size+mtimeMs 和存档里的是同一个才算"这一版审过了"。
     * 签名变了（又被改动）就把那条标记降级成 `stale`，界面显示"改动已变，需要重看" ——
     * 而不是继续冒充已审。没有签名的文件（宿主这次没算）不参与统计。
     */
    function reviewView(state) {
      var changes = state.status && Array.isArray(state.status.changes) ? state.status.changes : [];
      var signatures = state.review && typeof state.review === "object" ? state.review : {};
      var reviewed = state.reviewed && typeof state.reviewed === "object" ? state.reviewed : {};
      var prefix = reviewKeyOf(state.cwd, "");
      var marks = {};
      var known = {};
      var done = 0;
      var total = 0;
      var staleCount = 0;
      for (var index = 0; index < changes.length; index += 1) {
        var file = changes[index].file;
        var signature = typeof signatures[file] === "string" ? signatures[file] : null;
        if (signature === null) continue;
        known[file] = true;
        total += 1;
        var mark = reviewed[prefix + file];
        if (mark === undefined) continue;
        if (mark.signature === signature) {
          marks[file] = "fresh";
          done += 1;
        } else {
          marks[file] = "stale";
          staleCount += 1;
        }
      }
      return { marks: marks, known: known, done: done, total: total, staleCount: staleCount };
    }

    /**
     * 面板左栏那份工作区清单 —— **渲染与键盘导航共用这一份**。
     *
     * 过滤必须发生在一个地方：键盘选中用的是行下标，如果渲染时过滤了而导航没过滤，
     * ↑/↓ 就会落在看不见的行上。
     */
    function visibleChangeRows(state) {
      var changes = state.status && Array.isArray(state.status.changes) ? state.status.changes : [];
      var onlySession = state.onlySession === true;
      var onlyLatest = state.onlyLatest === true;
      if (!onlySession && !onlyLatest) return changes;
      var view = sessionChangeView(state);
      // 归因还没到手时这些开关不该悄悄把清单清空：那时候它们还没有意义。
      if (view === null) return changes;
      var rows = changes;
      if (onlySession) {
        // "可能相关"（命令旁听）也算本会话碰过的：过滤器的承诺是"只看本会话动过的"。
        rows = rows.filter(function (change) {
          return view.mine[change.file] !== undefined || view.possible[change.file] !== undefined;
        });
      }
      if (onlyLatest && view.latestTurn !== null) {
        // "这一轮改了什么"：只留最近一轮确定动过的（"可能相关"没有可靠的回合归属，不收）。
        rows = rows.filter(function (change) {
          var record = view.mine[change.file];
          return record !== undefined && record.lastTurn === view.latestTurn;
        });
      }
      return rows;
    }

    /**
     * 从自有样式表里抠出计数芯片的横向间隔。
     *
     * 用来回答"页面上跑着的到底是哪一版 CSS"—— 改完样式没生效时，这一眼就能分清是
     * "bundle 还是旧的"还是"样式规则没生效"。
     */
    function cssChipsGap(css) {
      var match = /\.dshh-chips\{[^}]*gap:([^;}]+)/.exec(css);
      return match === null ? null : match[1].trim();
    }

    /** 进程内唯一一份探针：两个座位共用，去重也一起算。 */
    var probe = createProbe();

    /**
     * 两个座位共享的唯一数据源。
     *
     * 胶囊持有会话绑定（只有它知道 `sessionId` 与该会话的 `cwd`），面板只读这条路。
     * `ctx.connection.rpc.call` **不会**为业务失败抛异常：它 resolve 出
     * `{ ok: true, value } | { ok: false, error }` 信封，所以两种结果都要判。
     */
    function createStore(ctx) {
      var ui = readUi();
      var pos = ui.pos && typeof ui.pos === "object" && typeof ui.pos.left === "number" && typeof ui.pos.top === "number"
        ? { left: ui.pos.left, top: ui.pos.top }
        : null;

      var state = {
        phase: "idle",
        sessionId: null,
        cwd: null,
        status: null,
        errorCode: null,
        updatedAt: null,
        panelOpen: ui.open === true,
        pos: pos,
        /** 胶囊所在 dock 行的视口顶部坐标：面板据此贴到它上方，而不是用写死的偏移。 */
        anchorTop: null,
        /** 正在查看的差异；`null` 表示面板停在改动清单。 */
        diff: null,
        /**
         * 正在查看的提交（点了「最近提交」里的一行）；`null` 表示左栏是工作区清单。
         * 打开时左栏换成这次提交的改动清单，右栏打开它第一个文件的差异。
         */
        commit: null,
        /**
         * 键盘高亮的那个文件（清单里的 `file`）；`null` 表示还没用键盘选过。
         * 指向 `file` 而不是下标：轮询刷新后清单条目可能增减，下标会指错行。
         */
        cursor: null,
        /** 最近提交；`commitsOid` 记住它是哪个 HEAD 取的，oid 变了才重取。 */
        commits: null,
        commitsOid: null,
        /** 差异栏宽度（面板右边缘可拖），持久化。 */
        diffWidth: typeof ui.diffWidth === "number" ? ui.diffWidth : DIFF_DEFAULT_WIDTH,
        /**
         * 会话归因：本会话改过哪些文件（宿主半按 fs 事件记的）。
         *
         * `files` 为 `null` 表示"还没有这份数据"（老宿主 / 还没回来 / 请求失败）——
         * 界面据此不打标记、也不过这个滤。
         */
        sessionChanges: { phase: "idle", files: null, possible: null, commands: [], since: null, dropped: 0, possibleDropped: 0, errorCode: null },
        /** 「只看本会话改的」开关（持久化，跟"自动换行"一样）。 */
        onlySession: ui.onlySession === true,
        /** 「只看最近一轮」开关：把清单收窄到最近这一轮动过的文件。 */
        onlyLatest: ui.onlyLatest === true,
        /** 这一版每个改动文件的签名（`file → signature`）；空表表示"这次没要"。 */
        review: {},
        /**
         * 本会话的工具活动：`active`（正在跑哪个）+ `recent` + 计数。
         *
         * 实时秒数由客户端本地算（`active.startedAt`），不靠把轮询压到亚秒级。
         */
        tools: { phase: "idle", active: null, recent: [], counts: [], total: 0, updatedAt: null },
        /** 侧栏行内 chip 要的摘要：一次批量取回，按 sessionId 索引。 */
        rows: { phase: "idle", byId: {}, unavailable: false, truncated: false, updatedAt: null },
        /**
         * 我审过的版本：`工作区 + NUL + 文件 → { signature, at }`，存在自己的键里
         * （`dsh-hud.reviewed.v1`，不跟界面开关混在一起）。
         */
        reviewed: readReviewed(),
        /**
         * 回合信息（`turnOutline` 投影）：`第 N 轮 → 那一轮的请求预览`。
         *
         * `available: false` 表示这个宿主没有这个投影（或还没读到）——界面这时不提回合，
         * 也绝不因为读不到它影响别的部分。
         */
        turns: { available: false, prompts: {}, latest: null },
      };

      var listeners = new Set();
      var inflight = null;
      var diffInflight = null;
      var commitInflight = null;
      /** 会话归因那次请求（在途合并）。 */
      var sessionInflight = null;
      /** 工具活动那次请求（在途合并）。 */
      var toolsInflight = null;
      /** 侧栏摘要那次请求（在途合并）。 */
      var rowsInflight = null;
      /** 回合投影的订阅：`{ sessionId, dispose }`；`null` 表示没接。 */
      var turnsBound = null
      /** `sessions` 客户端服务（动态注入；没到齐就是 null，回合信息不显示）。 */
      var turnSessions = null

      function getSnapshot() {
        return state;
      }

      function subscribe(listener) {
        listeners.add(listener);
        return function () {
          listeners.delete(listener);
        };
      }

      function emit() {
        listeners.forEach(function (listener) {
          listener();
        });
      }

      function set(patch) {
        state = Object.assign({}, state, patch);
        emit();
      }

      function persist() {
        writeUi({
          onlySession: state.onlySession === true,
          onlyLatest: state.onlyLatest === true,
          open: state.panelOpen,
          pos: state.pos,
          wrap: state.diff ? state.diff.wrap === true : false,
          diffWidth: state.diffWidth,
        });
      }

      /** 拖动右边缘时只改内存；松手才落盘（persistLayout）。 */
      function setDiffWidth(width) {
        if (typeof width !== "number" || !Number.isFinite(width)) return;
        var next = Math.max(DIFF_MIN_WIDTH, Math.round(width));
        if (state.diffWidth === next) return;
        set({ diffWidth: next });
      }

      /**
       * 打开一个改动文件的差异视图：一次取回**两侧**的 rows，
       * 默认落在有内容的那一侧（工作区优先），页签切换因此不需要再发请求。
       */
      function openDiff(change) {
        if (!state.cwd || !change || !change.file) return Promise.resolve();
        var cwd = state.cwd;
        var wrap = state.diff ? state.diff.wrap === true : readUi().wrap === true;
        set({
          // 工作区差异与「某次提交的明细」是互斥的两种右栏内容，换过去就收起明细。
          commit: null,
          cursor: change.file,
          diff: { source: "worktree", phase: "loading", path: change.path, file: change.file, origPath: change.origFile || null, data: null, side: "worktree", wrap: wrap, hunk: 0, collapsed: [], errorCode: null },
        });

        diffInflight = Promise.resolve()
          .then(function () {
            return ctx.connection.rpc.call(CHANNEL, "diff", {
              args: { cwd: cwd, path: change.file, origPath: change.origFile || null },
            });
          })
          .then(function (result) {
            diffInflight = null;
            var current = state.diff;
            // 期间用户可能已经返回清单或换了文件。
            if (!current || current.file !== change.file || state.cwd !== cwd) return;
            if (result && result.ok === true && result.value) {
              var value = result.value;
              var worktreeRows = value.worktree && value.worktree.rows ? value.worktree.rows.length : 0;
              var indexRows = value.index && value.index.rows ? value.index.rows.length : 0;
              set({
                diff: {
                  source: "worktree",
                  phase: "ready",
                  path: change.path,
                  file: change.file,
                  origPath: change.origFile || null,
                  data: value,
                  side: worktreeRows > 0 || indexRows === 0 ? "worktree" : "index",
                  wrap: current.wrap,
                  hunk: 0,
                  collapsed: [],
                  errorCode: null,
                },
              });
              return;
            }
            var code = result && result.error && result.error.details ? result.error.details.code : null;
            set({
              diff: {
                source: "worktree",
                phase: "error",
                path: change.path,
                file: change.file,
                origPath: change.origFile || null,
                data: null,
                side: "worktree",
                wrap: current.wrap,
                errorCode: code || "git-failed",
              },
            });
          })
          .catch(function () {
            diffInflight = null;
            var current = state.diff;
            if (!current || current.file !== change.file) return;
            set({ diff: Object.assign({}, current, { phase: "error", errorCode: "transport" }) });
          });

        return diffInflight;
      }

      /**
       * 打开「某次提交」的视图：先取这次提交的改动清单，再自动打开第一个文件的差异，
       * 这样一次点击就能看到"这次提交改了什么"。
       *
       * 提交是历史事实，取回来就不再变，因此不参与轮询；只有 HEAD 变了它也不受影响
       * （面板显示的是你点的那一次提交）。
       */
      function openCommit(commit) {
        if (!state.cwd || !commit || !commit.sha) return Promise.resolve();
        var cwd = state.cwd;
        var sha = commit.sha;

        set({
          commit: {
            phase: "loading",
            sha: sha,
            shortSha: typeof commit.sha === "string" && commit.sha.length > 7 ? commit.sha.slice(0, 7) : sha,
            subject: commit.subject || "",
            author: commit.author || "",
            date: commit.date || "",
            committedAt: typeof commit.committedAt === "number" ? commit.committedAt : null,
            refs: commit.refs || [],
            merge: false,
            files: [],
            truncated: false,
            errorCode: null,
          },
          diff: null,
        });

        commitInflight = Promise.resolve()
          .then(function () {
            return ctx.connection.rpc.call(CHANNEL, "commit", { args: { cwd: cwd, sha: sha } });
          })
          .then(function (result) {
            commitInflight = null;
            var current = state.commit;
            // 期间用户可能已经返回清单、点了别的提交，或换了工作区。
            if (!current || current.sha !== sha || state.cwd !== cwd) return;
            if (result && result.ok === true && result.value && result.value.commit) {
              var value = result.value;
              var files = Array.isArray(value.files) ? value.files : [];
              var meta = value.commit;
              set({
                commit: {
                  phase: "ready",
                  sha: meta.sha || sha,
                  shortSha: meta.shortSha || sha,
                  subject: meta.subject || "",
                  author: meta.author || "",
                  date: meta.date || "",
                  committedAt: typeof meta.committedAt === "number" ? meta.committedAt : null,
                  refs: meta.refs || [],
                  merge: meta.merge === true,
                  files: files,
                  truncated: value.truncated === true,
                  errorCode: null,
                },
              });
              // 空提交（或者清单被截断到没内容）就停在左栏，不去开一个空差异。
              // 有内容就顺手打开第一个文件——一次点击就看到"改了什么"；这里把
              // diff 的 promise 交回去，于是 await openCommit 就是等整次点击完成。
              if (files.length > 0) return openCommitDiff(files[0]);
              return undefined;
            }
            var code = result && result.error && result.error.details ? result.error.details.code : null;
            set({
              commit: Object.assign({}, current, {
                phase: "error",
                files: [],
                errorCode: code || "git-failed",
              }),
            });
          })
          .catch(function () {
            commitInflight = null;
            var current = state.commit;
            if (!current || current.sha !== sha) return;
            set({ commit: Object.assign({}, current, { phase: "error", errorCode: "transport" }) });
          });

        return commitInflight;
      }

      /**
       * 打开这次提交里某个文件的差异。与工作区差异共用右栏，但只有一个"侧"
       * （提交相对其父提交），因此工具栏不显示 未暂存/已暂存 两个页签。
       */
      function openCommitDiff(file) {
        var current = state.commit;
        if (!state.cwd || !current || !file || !file.file) return Promise.resolve();
        var cwd = state.cwd;
        var sha = current.sha;
        var wrap = state.diff ? state.diff.wrap === true : readUi().wrap === true;

        set({
          cursor: file.file,
          diff: {
            source: "commit",
            phase: "loading",
            sha: sha,
            shortSha: current.shortSha,
            subject: current.subject,
            path: file.path || file.file,
            file: file.file,
            origPath: file.origFile || null,
            data: null,
            side: "commit",
            wrap: wrap,
            hunk: 0,
            collapsed: [],
            errorCode: null,
          },
        });

        diffInflight = Promise.resolve()
          .then(function () {
            return ctx.connection.rpc.call(CHANNEL, "commit-diff", {
              args: { cwd: cwd, sha: sha, path: file.file, origPath: file.origFile || null },
            });
          })
          .then(function (result) {
            diffInflight = null;
            var now = state.diff;
            // 期间可能已经返回清单、点了别的文件，或换了提交。
            if (!now || now.source !== "commit" || now.sha !== sha || now.file !== file.file || state.cwd !== cwd) return;
            if (result && result.ok === true && result.value) {
              set({ diff: Object.assign({}, now, { phase: "ready", data: result.value, errorCode: null }) });
              return;
            }
            var code = result && result.error && result.error.details ? result.error.details.code : null;
            set({ diff: Object.assign({}, now, { phase: "error", data: null, errorCode: code || "git-failed" }) });
          })
          .catch(function () {
            diffInflight = null;
            var now = state.diff;
            if (!now || now.source !== "commit" || now.file !== file.file) return;
            set({ diff: Object.assign({}, now, { phase: "error", errorCode: "transport" }) });
          });

        return diffInflight;
      }

      /**
       * 点最近提交里的一行：打开这次提交的明细；点已经打开的那条则收起。
       * （明细占的是右栏，左栏主面板只是高亮那一行。）
       */
      function toggleCommit(commit) {
        if (!commit || !commit.sha) return Promise.resolve();
        if (state.commit !== null && sameCommit(commit.sha, state.commit.sha)) return closeCommit();
        return openCommit(commit);
      }

      /** 收起提交明细：它带来的差异一起收起来（清单换了，光标也要清）。 */
      function closeCommit() {
        if (state.commit === null) return;
        var keep = state.diff && state.diff.source === "commit" ? null : state.diff;
        set({ commit: null, diff: keep, cursor: null });
      }

      function closeDiff() {
        if (state.diff === null) return;
        set({ diff: null });
      }

      /**
       * 收起右栏。提交明细把差异包在里面，所以它优先整体退掉；
       * 只有工作区差异时才只是关掉差异。
       */
      function closeDetail() {
        if (state.commit !== null) return closeCommit();
        return closeDiff();
      }

      function setDiffSide(side) {
        if (!state.diff || state.diff.source === "commit" || (side !== "worktree" && side !== "index")) return;
        // 换侧等于换了一份 rows：hunk 序号与折叠状态都不再对应得上。
        set({ diff: Object.assign({}, state.diff, { side: side, hunk: 0, collapsed: [] }) });
      }

      /**
       * 当前能上下选的那份清单：打开提交明细时是这次提交的改动，否则是工作区清单。
       *
       * 清单必须跟视图一致 —— 否则打开着提交明细时按 ↑/↓ 会去动工作区的行，
       * 高亮和打开的文件对不上。
       */
      function visibleFiles() {
        if (state.commit !== null) {
          return Array.isArray(state.commit.files) ? state.commit.files : [];
        }
        // 与面板渲染**共用同一份**过滤结果：过滤只发生在一个地方，↑/↓ 才不会落到看不见的行上。
        return visibleChangeRows(state);
      }

      /** 打开清单里的一条：提交明细打开时走提交差异，否则走工作区差异。 */
      function openListEntry(file) {
        if (state.commit !== null) return openCommitDiff(file);
        return openDiff(file);
      }

      /**
       * 在当前清单里上下移动一格（↑/↓ 只移动；`[`/`]` 移动并直接打开）。
       *
       * 还没选过时：向下从第一条开始，向上从最后一条开始 —— 这样 ↑ 和 ↓ 都能
       * "先落在一个合理的位置上"，不需要用户先点一行。
       *
       * @param delta - 1 向下、-1 向上。
       * @param open - 移动后是否立刻打开。
       * @returns 选中的那条，清单为空时返回 null。
       */
      function stepFile(delta, open) {
        var list = visibleFiles();
        if (list.length === 0) return null;

        var index = -1;
        for (var cursor = 0; cursor < list.length; cursor += 1) {
          if (list[cursor].file === state.cursor) {
            index = cursor;
            break;
          }
        }

        var next = index === -1
          ? (delta > 0 ? 0 : list.length - 1)
          : Math.min(Math.max(0, index + delta), list.length - 1);
        var entry = list[next];
        if (!entry || !entry.file) return null;

        set({ cursor: entry.file });
        if (open) openListEntry(entry);
        return entry;
      }

      /** Enter：打开键盘选中的那条；还没选过就打开第一条。 */
      function openCursor() {
        var list = visibleFiles();
        if (list.length === 0) return null;
        for (var index = 0; index < list.length; index += 1) {
          if (list[index].file === state.cursor) {
            openListEntry(list[index]);
            return list[index];
          }
        }
        return stepFile(1, true);
      }

      /** 当前差异里有几个 hunk —— n / p 的边界就是它。 */
      function hunkCount() {
        var payload = diffPayload(state.diff);
        var rows = payload && payload.rows ? payload.rows : [];
        var total = 0;
        for (var index = 0; index < rows.length; index += 1) {
          if (rows[index].kind === "hunk") total += 1;
        }
        return total;
      }

      /**
       * n / p：跳到下一个 / 上一个 hunk。跳到折叠着的 hunk 会顺手展开它 ——
       * 不然按键看起来什么都没发生。
       */
      function stepHunk(delta) {
        if (!state.diff) return;
        var total = hunkCount();
        if (total === 0) return;
        var current = typeof state.diff.hunk === "number" ? state.diff.hunk : 0;
        var next = Math.min(Math.max(0, current + delta), total - 1);
        var collapsed = (state.diff.collapsed || []).filter(function (index) { return index !== next });
        set({ diff: Object.assign({}, state.diff, { hunk: next, collapsed: collapsed }) });
      }

      /** 折叠 / 展开一个 hunk（点 hunk 头，或 Space 作用于当前 hunk）。 */
      function toggleHunk(index) {
        if (!state.diff || typeof index !== "number" || index < 0) return;
        var collapsed = state.diff.collapsed || [];
        var next = collapsed.indexOf(index) >= 0
          ? collapsed.filter(function (item) { return item !== index })
          : collapsed.concat([index]);
        set({ diff: Object.assign({}, state.diff, { hunk: index, collapsed: next }) });
      }

      function toggleDiffWrap() {
        if (!state.diff) return;
        set({ diff: Object.assign({}, state.diff, { wrap: state.diff.wrap !== true }) });
        persist();
      }

      /** dock 行的位置变了才写，避免每次测量都触发重渲染。 */
      function setAnchorTop(top) {
        if (state.anchorTop === top) return;
        set({ anchorTop: top });
      }

      /**
       * 取最近提交。失败只让这一段不显示，不影响面板其余部分——
       * 提交是背景信息，不该抢走「工作区状态」的注意力。
       */
      function loadCommits(cwd, oid) {
        return Promise.resolve()
          .then(function () {
            return ctx.connection.rpc.call(CHANNEL, "log", { args: { cwd: cwd, count: 10 } });
          })
          .then(function (result) {
            if (state.cwd !== cwd) return;
            var commits = result && result.ok === true && result.value && Array.isArray(result.value.commits)
              ? result.value.commits
              : [];
            set({ commits: commits, commitsOid: oid });
          })
          .catch(function () {
            if (state.cwd !== cwd) return;
            set({ commits: [], commitsOid: oid });
          });
      }

      function refresh() {
        // 会话归因跟 status 同一条命（两个都是"当前会话 + 当前工作区"的只读事实）。
        loadSessionChanges();
        // 工具活动只跟会话有关（没有工作区也该显示"正在跑什么"）。
        loadTools();
        // 回合投影：会话还没物化时这里会安静地不接，下一次刷新再试。
        bindTurns(state.sessionId);
        if (!state.cwd) return Promise.resolve();
        if (inflight) return inflight;
        var cwd = state.cwd;

        set({ phase: state.status ? "ready" : "loading" });

        inflight = Promise.resolve()
          .then(function () {
            // 面板打开时才要"这一版"的签名：胶囊那一路不需要，白付一次 stat。
            return ctx.connection.rpc.call(CHANNEL, "status", { args: { cwd: cwd, review: state.panelOpen === true } });
          })
          .then(function (result) {
            inflight = null;
            if (state.cwd !== cwd) return;
            if (result && result.ok === true) {
              var statusValue = result.value || null;
              set({
                phase: "ready",
                status: statusValue,
                // 送回来的"这一版"签名（没要或没改动就是空表）。
                review: statusValue && statusValue.review && typeof statusValue.review === "object"
                  ? statusValue.review
                  : {},
                errorCode: null,
                updatedAt: Date.now(),
              });
              // 提交只取一次：面板打开时取，且只有 HEAD 变了（提交过、切分支、拉取）才重取。
              if (statusValue && state.panelOpen
                && (state.commits === null || state.commitsOid !== statusValue.oid)) {
                loadCommits(cwd, statusValue.oid);
              }
              return;
            }
            var code = result && result.error && result.error.details ? result.error.details.code : null;
            set({ phase: "error", errorCode: code || "git-failed" });
          })
          .catch(function () {
            inflight = null;
            if (state.cwd !== cwd) return;
            set({ phase: "error", errorCode: "transport" });
          });

        return inflight;
      }

      /** 胶囊调用：把当前会话的工作区写进 store，变了才重新取数。 */
      function bindSession(sessionId, cwd) {
        if (state.sessionId === sessionId && state.cwd === (cwd || null)) return;
        set({
          sessionId: sessionId === undefined ? null : sessionId,
          cwd: cwd || null,
          status: null,
          errorCode: null,
          commits: null,
          commitsOid: null,
          // 差异与提交明细都绑定在某个工作区上：换了工作区就把它们收起，
          // 否则会显示另一个仓库的文件或提交。键盘光标同理，它指向的是清单里的行。
          diff: null,
          commit: null,
          cursor: null,
          phase: cwd ? "loading" : "idle",
        });
        // 工具活动同理：换会话就清空，别显示上一个会话正在跑的工具。
        set({ tools: { phase: "idle", active: null, recent: [], counts: [], total: 0, updatedAt: null } });
        // 归因是"这个会话"的事实：换会话就先清空，别把上一个会话的标记留在新会话的清单上。
        set({ sessionChanges: { phase: "idle", files: null, possible: null, commands: [], since: null, dropped: 0, possibleDropped: 0, errorCode: null } });
        // 回合信息同理：换会话就按新会话重新接（旧的先解掉）。
        bindTurns(sessionId);
        refresh();
      }

      /**
       * 取"本会话改过哪些文件"。
       *
       * 与 `status` 同一条命：状态刷新时顺带取一次（都是本进程内的读，很便宜）。失败就保持
       * `files: null`（界面不打标记、也不过这个滤），不会挡住 git 那半边。
       */
      function loadSessionChanges() {
        var cwd = state.cwd;
        var sessionId = state.sessionId;
        if (!cwd || !sessionId) return Promise.resolve();
        if (sessionInflight) return sessionInflight;
        if (state.sessionChanges.phase === "idle") set({ sessionChanges: Object.assign({}, state.sessionChanges, { phase: "loading" }) });

        sessionInflight = Promise.resolve()
          .then(function () {
            return ctx.connection.rpc.call(CHANNEL, "session-changes", { args: { cwd: cwd, sessionId: sessionId } });
          })
          .then(function (result) {
            sessionInflight = null;
            if (state.cwd !== cwd || state.sessionId !== sessionId) return;
            if (result && result.ok === true && result.value && result.value.cwdMismatch === true) {
              probe.log("session-changes", { cwdMismatch: true });
            }
            if (result && result.ok === true && result.value && result.value.cwdMismatch !== true) {
              var files = {};
              var list = Array.isArray(result.value.files) ? result.value.files : [];
              for (var index = 0; index < list.length; index += 1) {
                var item = list[index];
                if (item && typeof item.file === "string" && item.file !== "") files[item.file] = item;
              }
              var possible = {};
              var possibleList = Array.isArray(result.value.possible) ? result.value.possible : [];
              for (var pIndex = 0; pIndex < possibleList.length; pIndex += 1) {
                var possibleItem = possibleList[pIndex];
                if (possibleItem && typeof possibleItem.file === "string" && possibleItem.file !== "") {
                  possible[possibleItem.file] = possibleItem;
                }
              }
              var since = typeof result.value.since === "number" ? result.value.since : null;
              var dropped = typeof result.value.dropped === "number" ? result.value.dropped : 0;
              probe.log("session-changes", {
                files: Object.keys(files).length,
                possible: Object.keys(possible).length,
                commands: Array.isArray(result.value.commands) ? result.value.commands.length : 0,
                dropped: dropped,
                since: since === null ? null : new Date(since).toISOString(),
              });
              set({
                sessionChanges: {
                  phase: "ready",
                  files: files,
                  possible: possible,
                  commands: Array.isArray(result.value.commands) ? result.value.commands : [],
                  since: since,
                  dropped: dropped,
                  possibleDropped: typeof result.value.possibleDropped === "number" ? result.value.possibleDropped : 0,
                  errorCode: null,
                },
              });
              return;
            }
            // 宿主不认这个端点（插件刚更新、宿主半还是旧的）：保持"没有数据"，别打标记。
            var code = result && result.error && result.error.details ? result.error.details.code : null;
            probe.log("session-changes-failed", { code: code || "transport" });
            set({ sessionChanges: { phase: "error", files: null, possible: null, commands: [], since: null, dropped: 0, possibleDropped: 0, errorCode: code || "transport" } });
          })
          .catch(function () {
            sessionInflight = null;
            if (state.cwd !== cwd) return;
            probe.log("session-changes-failed", { code: "transport" });
            set({ sessionChanges: { phase: "error", files: null, possible: null, commands: [], since: null, dropped: 0, possibleDropped: 0, errorCode: "transport" } });
          });

        return sessionInflight;
      }

      // 回合信息要的 `sessions` 客户端服务：**动态注入**等它到齐（软依赖）——
      // 缺它时 git、归因、胶囊一切照旧，只是不显示"第几轮"。到齐后把当前会话接上。
      if (typeof ctx.inject === "function") {
        ctx.effect(function () {
          return ctx.inject(["sessions"], function (scope) {
            turnSessions = scope.sessions;
            probe.log("turn-services", { sessions: true });
            bindTurns(state.sessionId);
            return function () {
              turnSessions = null;
              unbindTurns();
            };
          });
        }, "dsh-hud: turn services");
      }

      /**
       * 接上 `turnOutline` 投影（"第几轮改的"）。
       *
       * 软依赖：`sessions` 服务、已物化的会话、这个投影三者缺一个就安静地不接 —— 归因、
       * git、胶囊一切照旧，只是不显示回合信息。整段包在 try/catch 里，读不到不该把面板带崩。
       */
      function unbindTurns() {
        if (turnsBound === null) return;
        try {
          if (typeof turnsBound.dispose === "function") turnsBound.dispose();
        } catch (error) {
          // 解绑失败不影响接下来的绑定。
        }
        turnsBound = null;
        set({ turns: { available: false, prompts: {}, latest: null } });
      }

      function bindTurns(sessionId) {
        if (turnsBound !== null && turnsBound.sessionId === sessionId) return;
        unbindTurns();
        if (!sessionId || turnSessions === null) return;
        try {
          var bound = turnSessions.binding(sessionId);
          var live = bound ? bound.session : undefined;
          if (!live || !live.projections || typeof live.projections.faceOf !== "function") return;
          var face = live.projections.faceOf("turnOutline");
          if (!face || typeof face.getSnapshot !== "function") return;
          var apply = function () {
            try {
              set({ turns: normalizeTurns(face.getSnapshot()) });
            } catch (error) {
              probe.log("turns-read-failed", { error: error instanceof Error ? error.message : String(error) });
            }
          };
          apply();
          var dispose = typeof face.subscribe === "function" ? face.subscribe(apply) : null;
          turnsBound = { sessionId: sessionId, dispose: dispose };
        } catch (error) {
          // 会话还没物化、投影还没注册、注入没到位 —— 都只意味着"这一轮拿不到回合信息"。
          probe.log("turns-bind-failed", { error: error instanceof Error ? error.message : String(error) });
        }
      }

      /** 归一 `turnOutline` 快照：`{ turns: [{ turn, prompt }], draft }`。 */
      function normalizeTurns(snapshot) {
        var entries = snapshot !== null && typeof snapshot === "object" && Array.isArray(snapshot.turns) ? snapshot.turns : null;
        if (entries === null) return { available: false, prompts: {}, latest: null };
        var prompts = {};
        var latest = null;
        for (var index = 0; index < entries.length; index += 1) {
          var entry = entries[index];
          if (!entry || typeof entry.turn !== "number") continue;
          if (typeof entry.prompt === "string" && entry.prompt.length > 0) prompts[entry.turn] = entry.prompt;
          if (latest === null || entry.turn > latest) latest = entry.turn;
        }
        return { available: true, prompts: prompts, latest: latest };
      }

      /**
       * 取侧栏每条会话行要的摘要（**一次批量**，不是 N 次 RPC）。
       *
       * 会话列表由**宿主**枚举（它有 `sessions` 服务），客户端不用把名单端过去；宿主没有
       * 那个服务时回 `unavailable: true`，那些 chip 就整片不画（其余功能照旧）。
       */
      function refreshRows() {
        if (rowsInflight) return rowsInflight;
        rowsInflight = Promise.resolve()
          .then(function () {
            return ctx.connection.rpc.call(CHANNEL, "session-statuses", { args: {} });
          })
          .then(function (result) {
            rowsInflight = null;
            if (result && result.ok === true && result.value) {
              var byId = {};
              var list = Array.isArray(result.value.sessions) ? result.value.sessions : [];
              for (var index = 0; index < list.length; index += 1) {
                var item = list[index];
                if (item && typeof item.sessionId === "string") byId[item.sessionId] = item;
              }
              probe.log("session-statuses", {
                sessions: list.length,
                unavailable: result.value.unavailable === true,
                worktrees: typeof result.value.worktrees === "number" ? result.value.worktrees : null,
                truncated: result.value.truncated === true,
              });
              set({
                rows: {
                  phase: "ready",
                  byId: byId,
                  unavailable: result.value.unavailable === true,
                  truncated: result.value.truncated === true,
                  updatedAt: Date.now(),
                },
              });
              return;
            }
            var code = result && result.error && result.error.details ? result.error.details.code : null;
            probe.log("session-statuses-failed", { code: code || "transport" });
            set({ rows: { phase: "error", byId: {}, unavailable: true, truncated: false, updatedAt: Date.now() } });
          })
          .catch(function () {
            rowsInflight = null;
            probe.log("session-statuses-failed", { code: "transport" });
            set({ rows: { phase: "error", byId: {}, unavailable: true, truncated: false, updatedAt: Date.now() } });
          });
        return rowsInflight;
      }

      /** 取本会话的工具活动（正在跑哪个 / 跑过哪些 / 各几次）。 */
      function loadTools() {
        var sessionId = state.sessionId;
        if (!sessionId) return Promise.resolve();
        if (toolsInflight) return toolsInflight;
        toolsInflight = Promise.resolve()
          .then(function () {
            return ctx.connection.rpc.call(CHANNEL, "session-tools", { args: { sessionId: sessionId } });
          })
          .then(function (result) {
            toolsInflight = null;
            if (state.sessionId !== sessionId) return;
            if (result && result.ok === true && result.value) {
              var value = result.value;
              var tools = {
                phase: "ready",
                active: value.active && typeof value.active === "object" ? value.active : null,
                recent: Array.isArray(value.recent) ? value.recent : [],
                counts: Array.isArray(value.counts) ? value.counts : [],
                total: typeof value.total === "number" ? value.total : 0,
                updatedAt: Date.now(),
              };
              probe.log("session-tools", {
                active: tools.active === null ? null : tools.active.name,
                total: tools.total,
              });
              set({ tools: tools });
              return;
            }
            var code = result && result.error && result.error.details ? result.error.details.code : null;
            probe.log("session-tools-failed", { code: code || "transport" });
            set({ tools: { phase: "error", active: null, recent: [], counts: [], total: 0, updatedAt: Date.now() } });
          })
          .catch(function () {
            toolsInflight = null;
            probe.log("session-tools-failed", { code: "transport" });
            set({ tools: { phase: "error", active: null, recent: [], counts: [], total: 0, updatedAt: Date.now() } });
          });
        return toolsInflight;
      }

      /** 审阅存档的键：**按工作区分开**，同一个文件名在别的仓库里是另一码事。 */
      function reviewedKeyOf(file) {
        return reviewKeyOf(state.cwd, file);
      }

      /**
       * 标记 / 取消"这个文件的这一版我审过了"。
       *
       * 签名用的是**当前**这一版（宿主 stat 出来的 size+mtimeMs）：下次改动一落盘签名就变，
       * 标记自动降级成"改动已变，需要重看" —— 而不是继续冒充"已审"。
       */
      function toggleReviewed(file) {
        if (typeof file !== "string" || file.length === 0) return;
        var signature = state.review ? state.review[file] : undefined;
        if (typeof signature !== "string") {
          // 没有签名就不能标记：标了也算不出"还是不是这一版"，那是假进度。
          probe.log("review-no-signature", { file: file });
          return;
        }
        var next = {};
        for (var key in state.reviewed) {
          if (Object.prototype.hasOwnProperty.call(state.reviewed, key)) next[key] = state.reviewed[key];
        }
        var markKey = reviewedKeyOf(file);
        if (next[markKey] !== undefined && next[markKey].signature === signature) delete next[markKey];
        else next[markKey] = { signature: signature, at: Date.now() };
        var written = writeReviewed(next);
        set({ reviewed: written });
      }

      /** 清掉**当前工作区**的全部"已审"标记（别的仓库不动）。 */
      function clearReviewed() {
        var prefix = reviewKeyOf(state.cwd, "");
        var next = {};
        var removed = 0;
        for (var key in state.reviewed) {
          if (!Object.prototype.hasOwnProperty.call(state.reviewed, key)) continue;
          if (key.indexOf(prefix) === 0) {
            removed += 1;
            continue;
          }
          next[key] = state.reviewed[key];
        }
        if (removed === 0) return;
        set({ reviewed: writeReviewed(next) });
      }

      /** 「只看最近一轮」开关：过滤发生在 `visibleChangeRows`（渲染与键盘共用）。 */
      function toggleOnlyLatest() {
        set({ onlyLatest: state.onlyLatest !== true });
        persist();
      }

      /** 「只看本会话改的」开关：过滤发生在 `visibleChangeRows`（渲染与键盘共用）。 */
      function toggleOnlySession() {
        set({ onlySession: state.onlySession !== true });
        persist();
      }

      function openPanel(open) {
        if (state.panelOpen === open) return;
        set({ panelOpen: open });
        persist();
        if (open) refresh();
      }

      function togglePanel() {
        openPanel(!state.panelOpen);
      }

      /** 拖动过程中的临时位置：只改内存，不写 localStorage。 */
      function movePanel(next) {
        set({ pos: next });
      }

      /** 松开指针后的位置：落盘。 */
      function commitPanel(next) {
        set({ pos: next });
        persist();
      }

      function resetPanel() {
        set({ pos: null });
        persist();
      }

      return {
        getSnapshot: getSnapshot,
        subscribe: subscribe,
        bindSession: bindSession,
        refresh: refresh,
        openPanel: openPanel,
        togglePanel: togglePanel,
        movePanel: movePanel,
        commitPanel: commitPanel,
        resetPanel: resetPanel,
        setAnchorTop: setAnchorTop,
        setDiffWidth: setDiffWidth,
        persistLayout: persist,
        openDiff: openDiff,
        closeDiff: closeDiff,
        closeDetail: closeDetail,
        setDiffSide: setDiffSide,
        toggleDiffWrap: toggleDiffWrap,
        openCommit: openCommit,
        openCommitDiff: openCommitDiff,
        toggleCommit: toggleCommit,
        closeCommit: closeCommit,
        stepFile: stepFile,
        openCursor: openCursor,
        stepHunk: stepHunk,
        toggleHunk: toggleHunk,
        toggleOnlySession: toggleOnlySession,
        toggleOnlyLatest: toggleOnlyLatest,
        refreshRows: refreshRows,
        toggleReviewed: toggleReviewed,
        clearReviewed: clearReviewed,
      };
    }

    /* ---------------------------------------------------------- 订阅 hook */

    /** 订阅共享 store 的经典写法（不依赖种子里的 useSyncExternalStore 构建）。 */
    function useStore(store) {
      var pair = React.useState(function () {
        return store.getSnapshot();
      });
      React.useEffect(function () {
        return store.subscribe(function () {
          pair[1](store.getSnapshot());
        });
      }, [store]);
      return pair[0];
    }

    /* ------------------------------------------------------------- 小组件 */

    function CountChips(props) {
      var counts = props.counts || {};
      var children = [];
      for (var index = 0; index < COUNT_ORDER.length; index += 1) {
        var key = COUNT_ORDER[index];
        var value = counts[key] || 0;
        if (value <= 0) continue;
        children.push(h("span", {
          key: key,
          className: "dshh-chip",
          style: { color: COUNT_COLOR[key], borderColor: "currentColor" },
          title: props.t("count." + key) + " " + String(value),
        }, props.t("count." + key) + " " + String(value)));
      }
      if (children.length === 0) {
        return h("span", { className: "dshh-clean" }, props.t("panel.clean"));
      }
      return h("div", { className: "dshh-chips" }, children);
    }

    function ChangeList(props) {
      var changes = props.changes || [];
      var activeFile = props.activeFile;
      var cursorFile = props.cursor || null;
      // 提交明细打开时，屏幕上会同时有两份清单（左栏工作区 + 右栏这次提交），
      // 所以行标记必须带上是哪一份，否则"把选中行滚进视野"会滚错栏。
      var listId = props.listId || "changes";

      // 键盘选中（或正在看）的那行可能被滚出视野：把它带回来。
      React.useEffect(function () {
        if (typeof document === "undefined" || typeof document.querySelector !== "function") return;
        var wanted = cursorFile || activeFile;
        if (!wanted) return;
        for (var index = 0; index < changes.length; index += 1) {
          if (changes[index].file !== wanted) continue;
          var node = document.querySelector('[data-dsh-hud="row"][data-row-list="' + listId + '"][data-row-index="' + String(index) + '"]');
          revealRow(node, "dshh-list");
          return;
        }
      }, [cursorFile, activeFile, changes.length, listId]);

      if (changes.length === 0) return null;

      // 会话归因标记：只在这份数据到手时才有（`sessionView` 为 null 就整列不画）。
      var sessionView = props.sessionView === undefined ? null : props.sessionView;
      // 审阅进度：`null` 表示这次没要签名（胶囊那一路的轮询就是这样），整列不画。
      var review = props.review === undefined ? null : props.review;

      var rows = changes.map(function (change, index) {
        // 整行可点：打开该文件的差异视图（只读，不改动任何东西）。
        // "正在看的那行"和"键盘选中的那行"可能是两行（选了还没打开），因此两种标记分开。
        return h("button", {
          type: "button",
          className: "dshh-row"
            + (activeFile && change.file === activeFile ? " dshh-rowActive" : "")
            + (cursorFile && change.file === cursorFile ? " dshh-rowCursor" : ""),
          key: String(index) + ":" + change.path,
          "data-dsh-hud": "row",
          "data-row-list": listId,
          "data-row-index": String(index),
          title: change.path
            + (sessionView === null ? "" : "\n" + sessionTitle(sessionView, change.file, props.t))
            + "\n" + props.t("panel.clickForDiff")
            + "\n" + props.t("panel.rowKeys"),
          onClick: function () {
            props.onOpen(change);
          },
        },
        sessionView === null
          ? null
          : h("span", {
            className: "dshh-marker"
              + (sessionMarkOf(sessionView, change.file) === "mine"
                ? ""
                : sessionMarkOf(sessionView, change.file) === "possible" ? " dshh-markerPossible" : " dshh-markerOther"),
            "data-session-mark": sessionMarkOf(sessionView, change.file),
            "aria-hidden": "true",
          }, sessionMarkOf(sessionView, change.file) === "mine"
            ? "●"
            : sessionMarkOf(sessionView, change.file) === "possible" ? "◐" : "○"),
        h("span", {
          className: "dshh-status",
          style: { color: COUNT_COLOR[statusKey(change.status)] || "var(--dsw-alias-label-secondary, #8a8f98)" },
        }, change.status),
        h("span", { className: "dshh-path" }, change.path),
        review === null || review.known === undefined || review.known[change.file] !== true
          ? null
          : h("span", {
            className: "dshh-review"
              + (review.marks[change.file] === "fresh" ? " dshh-reviewOn" : "")
              + (review.marks[change.file] === "stale" ? " dshh-reviewStale" : ""),
            "data-review": review.marks[change.file] === undefined ? "none" : review.marks[change.file],
            title: reviewTitle(review.marks[change.file], props.t),
            onClick: function (event) {
              // 行本身是按钮（点开差异）：这里必须拦住，否则标记一下就顺手打开了差异。
              event.stopPropagation();
              event.preventDefault();
              props.onToggleReviewed(change.file);
            },
          }, review.marks[change.file] === undefined ? "○" : "✓"));
      });

      var footer = props.truncated
        ? h("div", { className: "dshh-note" }, props.t("panel.truncated"))
        : null;

      return h("div", { className: "dshh-section" },
        h("div", { className: "dshh-sectionTitle" }, props.title || (props.t("panel.changes") + " · " + String(changes.length))),
        h("div", { className: "dshh-list" }, rows),
        footer);
    }

    /**
     * 清单里那一行的悬停说明：这行是不是本会话改的。
     *
     * `mine` 里有这条就把写入/编辑次数与时间区间说清楚；没有就直说"不是这个会话改的"
     * （可能是你自己、编辑器、或另一个会话）。
     */
    /**
     * 一轮的说明：`第 3 轮：<那一轮的请求预览>`。
     *
     * 回合号从宿主的 `turnBoundary` 投影来，请求预览从 `turnOutline` 投影来 —— 拿不到 prompt
     * 时只说"第 N 轮"，不编内容。
     */
    function turnLabel(view, turn, t) {
      var prompt = view.turnPrompts !== undefined && view.turnPrompts !== null ? view.turnPrompts[turn] : undefined;
      if (typeof prompt !== "string" || prompt.length === 0) return t("session.turn", { n: String(turn + 1) });
      return t("session.turnWithPrompt", { n: String(turn + 1), prompt: prompt });
    }

    /** 一个文件属于哪一档：`mine` 确定改过 / `possible` 命令旁听 / `other` 与本会话无关。 */
    function sessionMarkOf(view, file) {
      if (view.mine !== undefined && view.mine[file] !== undefined) return "mine";
      if (view.possible !== undefined && view.possible[file] !== undefined) return "possible";
      return "other";
    }

    function sessionTitle(view, file, t) {
      var record = view.mine !== undefined ? view.mine[file] : undefined;
      if (record === undefined) {
        var guess = view.possible !== undefined ? view.possible[file] : undefined;
        if (guess === undefined) return t("session.other");
        // 低一档的置信度：说清是"从命令里看出来的"，并把那条命令贴出来。
        return t("session.possibleTitle", { reason: String(guess.reason || "").slice(0, 80) });
      }
      var parts = [];
      if (record.writes > 0) parts.push(t("session.writes", { n: String(record.writes) }));
      if (record.edits > 0) parts.push(t("session.edits", { n: String(record.edits) }));
      var when = typeof record.lastAt === "number" ? timeLabel(record.lastAt) : "";
      var line = t("session.mine") + (parts.length === 0 ? "" : "（" + parts.join("、") + "）") + (when ? " " + when : "");
      // 回合是"这一轮改了什么"的锚点：有就一并说清是哪一轮、那一轮的请求是什么。
      var turn = typeof record.lastTurn === "number" ? record.lastTurn : null;
      if (turn !== null) line += "\n" + turnLabel(view, turn, t);
      return line;
    }

    /** 行尾那个标记的悬停说明：三种状态各说清下一步。 */
    function reviewTitle(state, t) {
      if (state === "fresh") return t("review.unmark");
      if (state === "stale") return t("review.stale");
      return t("review.mark");
    }

    /**
     * 那一行的悬停说明：自哪一刻起记录 + 跑过哪些命令。
     *
     * "可能相关"是从命令里看出来的，用户要能自己判断 —— 所以把命令原文贴出来，而不是只报一个数。
     */
    function sessionLineTitle(view, t) {
      // 没有归因数据（那一行只剩审阅进度）时没有"自 … 起记录"也没有命令可列。
      if (view === null) return undefined;
      var lines = [];
      if (view.since !== null) lines.push(t("session.since", { time: timeLabel(view.since) }));
      var commands = (view.commands || []).slice(-5).reverse();
      if (commands.length > 0) {
        lines.push(t("session.commands", { n: String(commands.length) }));
        for (var index = 0; index < commands.length; index += 1) {
          var item = commands[index] || {};
          lines.push("· " + String(item.command || "") + (item.failed === true ? " " + t("session.commandFailed") : ""));
        }
        if (view.writingCommands > commands.length) {
          lines.push(t("session.commandsMore", { n: String(view.writingCommands - commands.length) }));
        }
      }
      return lines.length === 0 ? undefined : lines.join("\n");
    }

    /**
     * 改动概览下面那一行：本会话改了几个文件 + 「只看本会话改的」开关。
     *
     * 归因数据没到手（`view === null`）时整行不渲染 —— 不显示一个"全部都是别人的"的假象。
     */
    function SessionChangesLine(props) {
      var t = props.t;
      var view = props.view;
      var review = props.review || null;
      // 这一行**总是渲染**：它带着三枚开关（只看本会话改的 / 侧栏档位 / 只看最近一轮），
      // 归因或审阅数据缺失时只是没有计数可报 —— 控件不能因为"数据还没到"就凭空消失。
      var notes = [];
      if (view !== null) {
        notes.push(t("session.line", { n: String(view.mineCount) }));
        // 回合信息拿得到时，"最近一轮改了几个"是最常问的那个问题，直接写在行上。
        if (view.latestTurn !== null && view.latestCount > 0) {
          notes.push(t("session.latestTurn", { n: String(view.latestCount), turn: String(view.latestTurn + 1) }));
        }
        if (view.possibleCount > 0) notes.push(t("session.possible", { n: String(view.possibleCount) }));
      }
      if (view !== null) {
        if (view.gone.length > 0) notes.push(t("session.gone", { n: String(view.gone.length) }));
        if (view.dropped > 0) notes.push(t("session.dropped", { n: String(view.dropped) }));
        if (view.possibleDropped > 0) notes.push(t("session.possibleDropped", { n: String(view.possibleDropped) }));
      }
      if (props.review && props.review.total > 0) {
        notes.push(t("review.count", { n: String(props.review.done), total: String(props.review.total) }));
      }
      if (props.review && props.review.staleCount > 0) notes.push(t("review.staleCount", { n: String(props.review.staleCount) }));
      return h("div", { className: "dshh-session", "data-dsh-hud": "session" },
        // 没有任何可报的计数时，文字位置留空（开关照旧在右边）。
        notes.length === 0
          ? null
          : h("span", { className: "dshh-sessionText", title: sessionLineTitle(view, t) }, notes.join(" · ")),
        h("button", {
          type: "button",
          className: "dshh-sessionToggle" + (props.onlySession === true ? " dshh-sessionToggleOn" : ""),
          "data-session-filter": "only",
          "aria-pressed": props.onlySession === true ? "true" : "false",
          title: t("session.onlyTitle"),
          onClick: props.onToggle,
        }, props.onlySession === true ? "◉ " : "○ ", t("session.only")),
        // 已经把某些文件标成"已审"时，给一个"清空"的出口（只清当前工作区）。
        props.review && props.review.done > 0
          ? h("button", {
            type: "button",
            className: "dshh-sessionToggle",
            "data-session-review": "clear",
            title: t("review.clear"),
            onClick: props.onClearReviewed,
          }, t("review.clearShort"))
          : null,
        // 第二枚开关只在"这一轮的归属拿得到"时出现：拿不到就整枚不画，别给一个按不动的按钮。
        view === null || view.latestTurn === null
          ? null
          : h("button", {
            type: "button",
            className: "dshh-sessionToggle" + (props.onlyLatest === true ? " dshh-sessionToggleOn" : ""),
            "data-session-filter": "latest",
            "aria-pressed": props.onlyLatest === true ? "true" : "false",
            title: turnLabel(view, view.latestTurn, t) + "\n" + t("session.onlyLatestTitle"),
            onClick: props.onToggleLatest,
          }, props.onlyLatest === true ? "◉ " : "○ ", t("session.onlyLatest")));
    }

    /** 取当前焦点节点；没有 document / activeElement 时给 null。 */
    function activeElement() {
      if (typeof document === "undefined") return null;
      return document.activeElement || null;
    }

    /** 事件目标是否落在面板里（走自己的 `data-dsh-hud="panel"` 标记，不碰产品 DOM）。 */
    function isInsidePanel(node) {
      return isInsideMarked(node, "panel");
    }

    /** 事件目标是否落在某个 `data-dsh-hud` 标记的子树里（自己的标记，不碰产品的选择器）。 */
    function isInsideMarked(node, mark) {
      var current = node;
      var depth = 0;
      while (current && depth < 64) {
        if (typeof current.getAttribute === "function" && current.getAttribute("data-dsh-hud") === mark) return true;
        current = current.parentNode;
        depth += 1;
      }
      return false;
    }

    /**
     * 事件目标是不是"正在输入"的地方。
     *
     * 产品的输入框是 contenteditable，所以不能只看 tagName；两种都认。
     */
    function isTypingTarget(node) {
      var current = node;
      var depth = 0;
      while (current && depth < 8) {
        var tag = typeof current.tagName === "string" ? current.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        if (current.isContentEditable === true) return true;
        if (typeof current.getAttribute === "function") {
          var editable = current.getAttribute("contenteditable");
          if (editable === "" || editable === "true" || editable === "plaintext-only") return true;
        }
        current = current.parentNode;
        depth += 1;
      }
      return false;
    }

    /** 当前这一侧的 rows 载体：提交差异只有一侧，工作区差异要按 side 取。 */
    function diffPayload(diff) {
      if (!diff || !diff.data) return null;
      if (diff.source === "commit") return diff.data;
      return diff.data[diff.side === "index" ? "index" : "worktree"] || null;
    }

    /**
     * 把 rows 整理成"要渲染的行 + 它属于哪个 hunk"。
     *
     * hunk 段从 hunk 头开始，到下一个 hunk 头（或结尾）结束；折叠某个 hunk 就是
     * 把该段里除头以外的行丢掉。hunk 头之前那些行（`diff --git`、`---`、`+++`）
     * 永远显示——它们是"这是哪个文件"的上下文。
     *
     * @returns `[{ row, hunk }]`，`hunk` 是 hunk 序号（头之前的行是 null，收起时是负数）。
     */
    function visibleDiffRows(rows, collapsed) {
      var folded = collapsed || [];
      var out = [];
      var ordinal = -1;
      for (var index = 0; index < rows.length; index += 1) {
        var row = rows[index];
        if (row.kind === "hunk") {
          ordinal += 1;
          out.push({ row: row, hunk: ordinal });
          continue;
        }
        if (ordinal >= 0 && folded.indexOf(ordinal) >= 0) continue;
        out.push({ row: row, hunk: ordinal >= 0 ? ordinal : null });
      }
      return out;
    }

    /**
     * 一行差异：两个行号槽 + 文本。
     *
     * hunk 头是**可点**的（折叠 / 展开这一段），因此它第一个行号槽放的是折叠标记，
     * 不是行号——那个位置本来就空着，放标记不会让文本错位。
     */
    function DiffRow(props) {
      var row = props.row;
      var style = row.kind === "add" ? { background: DIFF_ADD_BG } : row.kind === "del" ? { background: DIFF_DEL_BG } : null;
      var gutterStyle = { color: DIFF_GUTTER_COLOR };
      var text = row.text === "" ? "\u00a0" : row.text;

      if (row.kind === "hunk") {
        return h("div", {
          className: "dshh-difrow dshh-difrow-hunk" + (props.active ? " dshh-difrow-hunkActive" : ""),
          "data-dsh-hud": "hunk",
          "data-hunk-index": props.hunk === null || props.hunk === undefined ? undefined : String(props.hunk),
          title: props.hint,
          onClick: props.onToggle,
        },
        h("span", { className: "dshh-difno", style: gutterStyle }, ""),
        h("span", { className: "dshh-difno dshh-hunkMark", style: gutterStyle }, props.collapsed ? "▸" : "▾"),
        h("span", { className: "dshh-diftext" + (props.wrap ? " dshh-wrap" : "") }, text));
      }

      return h("div", { className: "dshh-difrow dshh-difrow-" + row.kind, style: style },
        h("span", { className: "dshh-difno", style: gutterStyle }, row.oldLine === null ? "" : String(row.oldLine)),
        h("span", { className: "dshh-difno", style: gutterStyle }, row.newLine === null ? "" : String(row.newLine)),
        h("span", { className: "dshh-diftext" + (props.wrap ? " dshh-wrap" : "") }, text));
    }

    /**
     * 把一个带自己标记的节点滚进它所在滚动容器的视野（最小滚动量）。
     *
     * 全走能力判断：假 DOM（测试）里没有 offsetTop / clientHeight，这个函数直接
     * no-op，测试断言的是状态与结构，不是像素。不用 `scrollIntoView`：那会连带
     * 滚动祖先容器（面板是浮层，滚了产品的会话列表就不好了）。
     */
    function revealRow(node, containerClassName) {
      if (!node || typeof node.parentNode === "undefined") return;
      var container = node.parentNode;
      var depth = 0;
      while (container && depth < 32) {
        if (String(container.className || "").indexOf(containerClassName) >= 0) break;
        container = container.parentNode;
        depth += 1;
      }
      if (!container || typeof container.scrollTop !== "number") return;
      var top = node.offsetTop;
      var height = node.offsetHeight;
      var view = container.clientHeight;
      if (typeof top !== "number" || typeof height !== "number" || typeof view !== "number") return;
      if (top < container.scrollTop) container.scrollTop = top;
      else if (top + height > container.scrollTop + view) container.scrollTop = top + height - view;
    }

    /** 用自己写在节点上的标记找节点；找不到或不支持就是 null。 */
    function findMarked(selector) {
      if (typeof document === "undefined" || typeof document.querySelector !== "function") return null;
      return document.querySelector(selector);
    }

    /**
     * 两个 sha 说的是不是同一次提交。
     *
     * 最近提交那份清单里是 **短 sha**，而提交明细里是宿主半解析回来的**完整 sha**，
     * 直接 `===` 永远配不上；按前缀对一下（git 自己认 rev 也是这个语义）。
     */
    function sameCommit(left, right) {
      if (typeof left !== "string" || typeof right !== "string" || left === "" || right === "") return false;
      return left === right || right.indexOf(left) === 0 || left.indexOf(right) === 0;
    }

    /** 相对时间；超过 30 天直接给提交自己的日期。 */
    function commitWhen(commit, t) {
      if (typeof commit.committedAt !== "number") return commit.date || "";
      var seconds = Math.max(0, Math.round((Date.now() - commit.committedAt) / 1000));
      if (seconds < 60) return t("time.now");
      var minutes = Math.round(seconds / 60);
      if (minutes < 60) return String(minutes) + t("time.minutes");
      var hours = Math.round(minutes / 60);
      if (hours < 24) return String(hours) + t("time.hours");
      var days = Math.round(hours / 24);
      if (days < 30) return String(days) + t("time.days");
      return commit.date || "";
    }

    /**
     * 最近提交：一行一条，sha + 标题 + HEAD 徽标 + 相对时间；整行可点看这次提交改了什么。
     * 打开的那条会高亮（再点一次收起）——提交明细在右栏，左栏这块主面板不动。
     */
    function CommitList(props) {
      var commits = props.commits || [];
      if (commits.length === 0) return null;
      var t = props.t;

      return h("div", { className: "dshh-section" },
        h("div", { className: "dshh-sectionTitle" }, t("panel.commits")),
        h("div", { className: "dshh-commits" }, commits.map(function (commit, index) {
          var refs = commit.refs || [];
          var isHead = refs.some(function (ref) { return ref.indexOf("HEAD") === 0; });
          var tip = [t("commit.click"), "", commit.subject, commit.author + " · " + commit.date].concat(refs).join("\n");
          // 整行是按钮：点了在左栏换成这次提交的改动清单（只读）。
          var open = sameCommit(commit.sha, props.activeSha);
          return h("button", {
            type: "button",
            className: "dshh-commit" + (open ? " dshh-commitActive" : ""),
            key: commit.sha + ":" + String(index),
            title: tip,
            onClick: function () {
              if (props.onOpen) props.onOpen(commit);
            },
          },
          h("span", { className: "dshh-csha" }, commit.sha),
          h("span", { className: "dshh-csubject" }, commit.subject || "—"),
          isHead ? h("span", { className: "dshh-chead" }, "HEAD") : null,
          h("span", { className: "dshh-cwhen" }, commitWhen(commit, t)));
        })));
    }

    /**
     * 一次提交的那一栏（**中间**栏，固定宽度）：元信息 + 这次提交的改动清单。
     *
     * 差异在它右边那一栏（DiffView）。打开提交不改动左栏——左栏始终是那块主面板，
     * 只是"最近提交"里对应的一行高亮起来。清单复用工作区那套 ChangeList（同一个
     * 行样式、同一套键盘移动）。
     */
    function CommitPane(props) {
      var t = props.t;
      var commit = props.commit;
      var style = { width: props.width };

      var head;
      if (commit.phase === "loading") {
        head = h("div", { className: "dshh-commitHead" },
          h("div", { className: "dshh-commitMeta" }, t("commit.loading")));
      } else if (commit.phase === "error") {
        head = h("div", { className: "dshh-commitHead" },
          h("div", { className: "dshh-commitMeta" }, errorText(commit.errorCode, t)));
      } else {
        var lines = [commit.author + " · " + commit.date];
        if (commit.refs && commit.refs.length > 0) lines.push(commit.refs.join(", "));
        if (commit.merge) lines.push(t("commit.merge"));
        head = h("div", { className: "dshh-commitHead" },
          h("div", { className: "dshh-commitTitle" },
            h("span", { className: "dshh-csha" }, commit.shortSha),
            h("span", { className: "dshh-commitSubject", title: commit.subject }, commit.subject || "—")),
          h("div", { className: "dshh-commitMeta" }, lines.join(" · ")));
      }

      var files = commit.files || [];
      var list = commit.phase !== "ready"
        ? null
        : files.length === 0
          ? h("div", { className: "dshh-commitFiles" }, h("div", { className: "dshh-note" }, t("commit.empty")))
          : h("div", { className: "dshh-commitFiles" },
            h(ChangeList, {
              changes: files,
              truncated: commit.truncated,
              t: t,
              title: t("commit.files") + " · " + String(files.length),
              onOpen: props.onOpenFile,
              activeFile: props.activeFile,
              cursor: props.cursor,
              listId: "commit",
            }));

      return h("div", { className: "dshh-commitpane", style: style }, head, list);
    }

    /** 把 rows 还原成 unified diff 文本（"复制差异"用）。 */
    function rowsToText(rows) {
      return rows.map(function (row) {
        if (row.kind === "add") return "+" + row.text;
        if (row.kind === "del") return "-" + row.text;
        if (row.kind === "ctx") return " " + row.text;
        return row.text;
      }).join("\n");
    }

    /**
     * 差异视图：两侧页签（宿主半一次把两侧都取回来了，切页签不再发请求）、
     * 自动换行、复制差异。全部只读——它只是把 git 的输出画出来。
     */
    function DiffView(props) {
      var t = props.t;
      var diff = props.diff;
      var store = props.store;

      var copiedRef = React.useState(false);
      var copied = copiedRef[0];
      var setCopied = copiedRef[1];
      var timerRef = React.useState(null);

      var isCommit = diff.source === "commit";
      // 提交差异没有"侧"这个概念，但只要不是提交，页签就得知道自己亮的是哪个。
      var side = diff.side === "index" ? "index" : "worktree";
      var data = diffPayload(diff);
      var untracked = isCommit ? false : (diff.data ? diff.data.untracked === true : false);
      var hunk = typeof diff.hunk === "number" ? diff.hunk : 0;
      var collapsed = diff.collapsed || [];
      var rows = data && data.rows ? data.rows : [];

      // 换了文件 / 侧 / 提交：回到顶部。否则会停在上一份 diff 的滚动位置
      // （React 复用同一个容器节点，scrollTop 会留下来）。
      React.useEffect(function () {
        var host = findMarked('[data-dsh-hud="diff"]');
        if (host && typeof host.scrollTop === "number") host.scrollTop = 0;
      }, [diff.file, diff.sha, diff.side]);

      // 键盘移动 hunk：把当前 hunk 滚进视野（已经看得见就一点都不动）。
      React.useEffect(function () {
        var host = findMarked('[data-dsh-hud="diff"]');
        if (!host || typeof host.querySelector !== "function") return;
        revealRow(host.querySelector('[data-dsh-hud="hunk"][data-hunk-index="' + String(hunk) + '"]'), "dshh-diff");
      }, [hunk, diff.file, diff.sha, diff.side, collapsed.length]);

      function onCopy() {
        if (!data) return;
        var clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
        if (!clipboard || typeof clipboard.writeText !== "function") return;
        Promise.resolve(clipboard.writeText(rowsToText(data.rows || []))).then(function () {
          setCopied(true);
          if (timerRef[0]) window.clearTimeout(timerRef[0]);
          timerRef[1](window.setTimeout(function () { setCopied(false); }, 1500));
        }).catch(function () {
          // 剪贴板被拒绝（无权限/非安全上下文）时不谎报成功。
        });
      }

      function tab(kind, label, title) {
        var active = side === kind;
        return h("button", {
          type: "button",
          className: "dshh-tab" + (active ? " dshh-tabActive" : ""),
          "aria-pressed": active ? "true" : "false",
          title: title,
          onClick: function () { store.setDiffSide(kind); },
        }, label);
      }

      var counts = data && data.binary !== true
        ? h("span", { className: "dshh-difcounts" },
            h("span", { style: { color: "var(--dsw-alias-state-success-primary, #3fb950)" } }, "+" + String(data.additions)),
            h("span", { style: { color: "var(--dsw-alias-state-error-primary, #f06a6a)" } }, "-" + String(data.deletions)))
        : null;

      var body;
      if (diff.phase === "loading") {
        body = h("div", { className: "dshh-empty" }, t("panel.loading"));
      } else if (diff.phase === "error") {
        body = h("div", { className: "dshh-empty" }, errorText(diff.errorCode, t));
      } else if (!data) {
        body = h("div", { className: "dshh-empty" }, t("diff.empty"));
      } else if (data.binary === true) {
        body = h("div", { className: "dshh-empty" }, t("diff.binary"));
      } else if (rows.length === 0) {
        body = h("div", { className: "dshh-empty" }, t("diff.empty"));
      } else {
        var visible = visibleDiffRows(rows, collapsed);
        body = h("div", { className: "dshh-diff", "data-dsh-hud": "diff" },
          visible.map(function (entry, index) {
            var isHunk = entry.row.kind === "hunk";
            return h(DiffRow, {
              key: String(index) + ":" + entry.row.kind,
              row: entry.row,
              wrap: diff.wrap === true,
              hunk: entry.hunk,
              active: isHunk && entry.hunk === hunk && collapsed.indexOf(entry.hunk) < 0,
              collapsed: isHunk && collapsed.indexOf(entry.hunk) >= 0,
              hint: isHunk ? t("diff.hunkToggle") : undefined,
              onToggle: isHunk
                ? function () { store.toggleHunk(entry.hunk); }
                : undefined,
            });
          }),
          data.truncated === true ? h("div", { className: "dshh-note" }, t("diff.truncated")) : null);
      }

      return h("div", { className: "dshh-diffview" },
        h("div", { className: "dshh-toolbar" },
          h("span", { className: "dshh-difpath", title: diff.path }, diff.path),
          counts,
          h("span", { className: "dshh-spacer" }),
          // 提交差异只有一个"侧"（相对父提交），因此不给 未暂存/已暂存 页签
          // （短 sha 与标题在右栏的明细头里，这里不重复）。
          untracked ? h("span", { className: "dshh-kv" }, t("diff.untrackedHint")) : null,
          isCommit ? null : tab("worktree", t("diff.worktree"), t("diff.worktree")),
          isCommit || untracked ? null : tab("index", t("diff.index"), t("diff.index")),
          h("button", {
            type: "button",
            className: "dshh-tab" + (diff.wrap === true ? " dshh-tabActive" : ""),
            "aria-pressed": diff.wrap === true ? "true" : "false",
            title: t("diff.wrap"),
            onClick: function () { store.toggleDiffWrap(); },
          }, t("diff.wrap")),
          h("button", {
            type: "button",
            className: "dshh-tab",
            title: t("diff.copy"),
            onClick: onCopy,
          }, copied ? t("diff.copied") : t("diff.copy")),
          h("button", {
            type: "button",
            className: "dshh-tab",
            // 提交明细里这个 ✕ 收的是整块明细（差异是明细的一段），文案跟着改。
            title: isCommit ? t("commit.close") : t("diff.close"),
            "aria-label": isCommit ? t("commit.close") : t("diff.close"),
            onClick: function () { store.closeDetail(); },
          }, "✕")),
        body);
    }

    /** porcelain-v2 的展示字母 → counts 键（用于配色）。 */
    function statusKey(letter) {
      if (letter === "M") return "modified";
      if (letter === "A") return "added";
      if (letter === "D") return "deleted";
      if (letter === "R") return "renamed";
      if (letter === "C") return "copied";
      if (letter === "T") return "typeChanged";
      if (letter === "?") return "untracked";
      if (letter === "!") return "conflicted";
      return "typeChanged";
    }

    /** 宿主半的 `details.code` → 本座位的本地化文案（store 只存机器码）。 */
    function errorText(code, t) {
      if (code === "timeout") return t("err.timeout");
      if (code === "no-cwd") return t("err.no-cwd");
      if (code === "git-missing") return t("err.git-missing");
      if (code === "invalid-cwd") return t("err.invalid-cwd");
      if (code === "transport") return t("err.transport");
      if (code === "invalid-path") return t("err.invalid-path");
      // 提交可能在两次请求之间被 rebase / amend 换掉：给一句能操作的提示，而不是"git 执行失败"。
      if (code === "unknown-commit") return t("commit.unknown");
      // 宿主半是启动时加载的：只刷新页面时，新端点还不存在，这个提示能省下一轮排查。
      if (code === "unknown-endpoint") return t("err.stale-host");
      return t("err.git-failed");
    }

    /** 分支名过长时中段省略，保留头尾信息量。 */
    function shortBranch(name) {
      if (name.length <= PILL_BRANCH_MAX) return name;
      var head = Math.ceil((PILL_BRANCH_MAX - 1) / 2);
      var tail = PILL_BRANCH_MAX - 1 - head;
      return name.slice(0, head) + "…" + name.slice(name.length - tail);
    }

    /**
     * 改动计数 → 简写符列表 `[{ key, mark, value }]`（只列非零项，顺序固定）。
     *
     * 胶囊与侧栏行内 chip 共用这一份：两处各写一套算法一定会漂。
     */
    function countShorthands(counts) {
      var out = [];
      var source = counts || {};
      for (var index = 0; index < COUNT_ORDER.length; index += 1) {
        var key = COUNT_ORDER[index];
        var value = source[key] || 0;
        if (value <= 0) continue;
        out.push({ key: key, mark: COUNT_MARK[key], value: value });
      }
      return out;
    }

    function branchLabel(status, t) {
      if (!status) return "—";
      if (status.branch) return status.branch;
      if (status.oid) return t("panel.detached") + " " + status.oid;
      return t("panel.detached");
    }

    function timeLabel(at) {
      var date = new Date(at);
      var pad = function (value) {
        return value < 10 ? "0" + String(value) : String(value);
      };
      return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    }

    /* --------------------------------------------------------- 胶囊（dock） */

    /**
     * 会话作用域的座位：框架给出 `sessionId`，`useSessions` 快照给出该会话的 `cwd`，
     * 因此它是唯一能完成绑定的座位。
     */
    /**
     * 侧栏每条会话行上的状态 chip（座位 `sidebar.workspaces.session.row.action`）。
     *
     * 一行只有 32px 高、悬停才露出来，所以只放**最该一眼看到的两件事**：这个工作区脏不脏
     * （git 简写符）与**这个会话自己改过几个文件**（`●n`，只我们有这个信息）。干净且本会话
     * 没改过就整枚不画 —— 不占位置、也不制造噪音。完整信息在悬停里。
     */
    /**
     * 一枚侧栏状态的"事实摘要"：三种呈现（常亮标记 / 悬停动条 / 卡片详情）共用这一份计算。
     *
     * 同一份数据要在三个地方以三种宽度呈现，各写一套一定会漂 —— 所以抽成一处。
     */
    function rowSummaryOf(row) {
      if (row === undefined || row === null || row.pending === true) return null;
      var mineCount = typeof row.mine === "number" ? row.mine : 0;
      var possibleCount = typeof row.possible === "number" ? row.possible : 0;
      var shorthands = row.repo === true ? countShorthands(row.counts) : [];
      var changed = 0;
      for (var index = 0; index < shorthands.length; index += 1) changed += shorthands[index].value;
      return {
        row: row,
        mine: mineCount,
        possible: possibleCount,
        shorthands: shorthands,
        changed: changed,
        dirty: row.repo === true && row.dirty === true,
        hasContent: changed > 0 || mineCount > 0 || possibleCount > 0 || row.error !== null,
      };
    }

    /**
     * `⋯` 菜单里的只读摘要（座位 `sidebar.workspaces.session.menu.item`）。
     *
     * 为什么要有这一处：会话行**行尾的常亮位置归产品**（`time` 自适应宽度 + 悬停才换上的动作条），
     * 插件在行尾拿不到常亮的座位；行首那格只有 16px，只能放一个双字符标记。所以要"完整信息 +
     * 不用等悬停卡片那 800ms"，`⋯` 菜单是最实在的地方 —— 点一下就有，且不用把鼠标停住。
     *
     * 它是**只读**的：不做任何动作，所以做得像一条说明（弱化颜色、不响应 hover 高亮）；
     * 工作区干净时也照实说"干净"，而不是消失（那样用户会以为没有这个功能）。
     */
    function SessionMenuSummary(props) {
      var t = props.t || function (key) { return key; };
      var sessionId = props.sessionId;
      var store = props.store;
      var state = useStore(store);
      if (!sessionId) return null;
      var row = state.rows && state.rows.byId ? state.rows.byId[sessionId] : undefined;
      var summary = rowSummaryOf(row);
      if (summary === null) return null;

      var head;
      if (summary.row.repo === true) {
        head = branchLabel(summary.row, t);
        if (summary.dirty === true) head += "*";
        if (summary.row.ahead > 0) head += " ↑" + String(summary.row.ahead);
        if (summary.row.behind > 0) head += " ↓" + String(summary.row.behind);
        var counts = summary.shorthands.map(function (item) {
          return t("count." + item.key) + " " + String(item.value);
        }).join(" ");
        head += counts === "" ? " · " + t("panel.clean") : " · " + counts;
      } else if (summary.row.error !== null) {
        head = t("rows.error", { code: String(summary.row.error) });
      } else {
        head = t("rows.noRepo");
      }

      var own = [];
      if (summary.mine > 0) own.push(t("session.pill", { n: String(summary.mine) }));
      if (summary.possible > 0) own.push(t("rows.possible", { n: String(summary.possible) }));
      var ownLine = own.length === 0 ? t("rows.ownNone") : own.join(" · ");

      return h("div", {
        className: "dshh-menureadout",
        "data-dsh-hud": "menu-readout",
        title: summary.row.cwd || undefined,
      }, [
        h("div", { key: "git", className: "dshh-menureadoutLine" }, head),
        h("div", { key: "own", className: "dshh-menureadoutLine" }, ownLine),
      ]);
    }

    /**
     * 侧栏会话行**悬停卡片**里的那一块（座位 `sidebar.session.row.hover`）。
     *
     * 动作条那一枚只有图标级宽度（`!4 ●3`），明细放不下；悬停卡是宽敞的地方 ——
     * 分支/上游、分类型计数、这个会话自己的改动，都在这里说清楚。
     * 没有任何可说的（干净、且本会话没改过）就整块不画，卡片保持原来的样子。
     */
    function SessionRowHoverChip(props) {
      var t = props.t || function (key) { return key; };
      var sessionId = props.sessionId;
      var store = props.store;
      var state = useStore(store);
      if (!sessionId) return null;
      var row = state.rows && state.rows.byId ? state.rows.byId[sessionId] : undefined;
      var summary = rowSummaryOf(row);
      if (summary === null) return null;
      var mineCount = summary.mine;
      var possibleCount = summary.possible;
      var shorthands = summary.shorthands;

      var lines = [];
      if (row.repo === true) {
        var head = branchLabel(row, t);
        if (row.dirty === true) head += "*";
        if (row.ahead > 0) head += " ↑" + String(row.ahead);
        if (row.behind > 0) head += " ↓" + String(row.behind);
        if (shorthands.length > 0) {
          head += " · " + shorthands.map(function (item) {
            return t("count." + item.key) + " " + String(item.value);
          }).join(" ");
        } else {
          // 干净也要说出来 —— 与悬停说明、⋯ 菜单同一个口径（空着看不出是"干净"还是"没读到"）。
          head += " · " + t("panel.clean");
        }
        lines.push(head);
      } else if (row.repo === false && row.error === null) {
        lines.push(t("rows.noRepo"));
      }
      if (row.error) lines.push(t("rows.error", { code: String(row.error) }));
      var own = [];
      if (mineCount > 0) own.push(t("session.pill", { n: String(mineCount) }));
      if (possibleCount > 0) own.push(t("rows.possible", { n: String(possibleCount) }));
      // 和第二行对齐：没有改动记录时也明说一句 —— 否则卡片上会缺一行，看着像没加载出来。
      lines.push(own.length === 0 ? t("rows.ownNone") : own.join(" · "));
      if (lines.length === 0) return null;

      return h("div", {
        className: "dshh-rowhover",
        "data-dsh-hud": "row-hover",
      }, lines.map(function (line, index) {
        return h("div", { key: String(index), className: "dshh-rowhoverLine" }, line);
      }));
    }

    function HudDockPill(props) {
      var t = props.t || function (key) { return key; };
      var sessionId = props.sessionId;
      var useSessions = props.useSessions;
      var store = props.store;

      // useSessions 是选择器 hook：选择器参数是必需的，裸调用会以
      // "selector is not a function" 崩掉。
      var sessions = useSessions(function (snapshot) { return snapshot; });
      var summary = sessionId !== undefined && sessions && sessions.byId ? sessions.byId[sessionId] : undefined;
      var cwd = summary ? summary.cwd : undefined;

      // 右栏里的嵌入式会话（子会话 chat）自带会话绑定；只有主视图座位可以驱动共享
      // 面板，否则一个子会话会把它下面的仓库从用户正在看的会话下抽走。
      // 快照不带这个计数（更旧的宿主）时按主视图放行，胶囊不会因此消失。
      var mainView = !summary || !summary.retainedBy
        ? true
        : (summary.retainedBy.mainView || 0) > 0;

      var state = useStore(store);

      React.useEffect(function () {
        if (!mainView) return;
        store.bindSession(sessionId, cwd);
      }, [sessionId, cwd, mainView, store]);

      if (!cwd || !mainView || state.sessionId !== sessionId) return null;

      // 会话归因的胶囊段：只有"确实改过东西"时才露头（没数据 / 0 个都不显示）。
      var sessionView = sessionChangeView(state);
      var sessionSegment = sessionView !== null && sessionView.mineCount > 0
        ? " │ ●" + String(sessionView.mineCount)
        : null;

      var children = [];
      if (state.phase === "error") {
        children.push("⎇ " + t("pill.error"));
      } else if (state.phase === "loading" || state.phase === "idle") {
        children.push("⎇ " + t("pill.loading"));
      } else if (!state.status || !state.status.repo) {
        children.push("⎇ " + t("pill.notRepo"));
      } else {
        var status = state.status;
        var head = "⎇ " + shortBranch(branchLabel(status, t)) + (status.dirty ? "*" : "");
        if (status.ahead > 0) head += " ↑" + String(status.ahead);
        if (status.behind > 0) head += " ↓" + String(status.behind);
        children.push(head);

        // 简写符：只列非零项，按固定顺序，各自上色（M 黄 / A 绿 / D 红 / ? 灰 …）。
        // 与侧栏行内 chip 共用 `countShorthands` —— 两处各写一套算法一定会漂。
        var shorthands = countShorthands(status.counts);
        for (var index = 0; index < shorthands.length; index += 1) {
          children.push(" ");
          children.push(h("span", {
            key: shorthands[index].key,
            style: { color: COUNT_COLOR[shorthands[index].key] },
          }, shorthands[index].mark + String(shorthands[index].value)));
        }
      }

      if (sessionSegment !== null) children.push(sessionSegment);

      // 悬停给出完整信息：总数型的托盘里放不下细节，这里补齐。
      var titleLines = [t("pill.title")];
      if (sessionView !== null) titleLines.push(t("session.pill", { n: String(sessionView.mineCount) }));
      if (cwd) titleLines.push(cwd);
      if (state.status && state.status.repo) {
        var tip = branchLabel(state.status, t);
        if (state.status.upstream) tip += " · " + t("panel.upstream") + " " + state.status.upstream;
        titleLines.push(tip);
        var labels = [];
        var counts2 = state.status.counts || {};
        for (var i2 = 0; i2 < COUNT_ORDER.length; i2 += 1) {
          var k2 = COUNT_ORDER[i2];
          var v2 = counts2[k2] || 0;
          if (v2 > 0) labels.push(t("count." + k2) + " " + String(v2));
        }
        if (labels.length > 0) titleLines.push(labels.join(" · "));
      }

      // 外层容器复刻框架自己的 dock 行几何（见 queue 公告）：仅靠胶囊自身对齐，
      // 胶囊会飘到整栏的最左边，而输入卡片是居中的。
      return h("div", { className: "dshh-dock", "data-dsh-hud": "dock" },
        h("button", {
          type: "button",
          className: "dshh-pill",
          "data-dsh-hud": "pill",
          title: titleLines.join("\n"),
          "aria-expanded": state.panelOpen ? "true" : "false",
          style: { color: state.panelOpen ? "var(--dsw-alias-brand-primary, #4b8bf5)" : undefined },
          onClick: function () {
            store.togglePanel();
          },
        }, children));
    }

    /**
     * 本会话工具活动的胶囊（座位 `conversation.input.dock`，与 Git 胶囊各自一行）。
     *
     * 照 codex-hud 那条 `Tools:` 的口径：**正在跑**就报工具名与实时秒数（秒数本地算，不靠轮询）；
     * 空闲就报最近一次是哪个工具、本会话一共几次（失败打叉）。完全没跑过工具时整枚不画 ——
     * 空白注册会白占一行（dock 是竖列，一条注册就是一整行）。
     */
    function HudToolsCapsule(props) {
      var t = props.t || function (key) { return key; };
      var store = props.store;
      var state = useStore(store);
      var tools = state.tools;
      if (!tools || (tools.active === null && tools.total === 0)) return null;

      var children = [];
      if (tools.active !== null) {
        var elapsed = toolElapsedLabel(tools.active, props.now === undefined ? Date.now() : props.now);
        children.push(h("span", { key: "glyph", className: "dshh-toolsGlyph" }, "\u{1F6E0}"));
        children.push(" " + String(tools.active.name === undefined ? "?" : tools.active.name));
        if (elapsed !== null) children.push(h("span", { key: "elapsed", className: "dshh-toolsDim" }, " " + elapsed));
      } else {
        var last = tools.recent.length > 0 ? tools.recent[0] : null;
        var failed = last !== null && last.ok === false;
        children.push(h("span", {
          key: "glyph",
          className: "dshh-toolsGlyph" + (failed ? " dshh-toolsGlyphBad" : ""),
        }, failed ? "\u2717" : "\u2713"));
        if (last !== null && typeof last.name === "string") children.push(" " + last.name);
        children.push(h("span", { key: "total", className: "dshh-toolsDim" }, " \u00d7" + String(tools.total)));
      }

      // 渲染现场：胶囊到底画没画、画的是哪一档（与 row-chip/row-token 同一套排查手段）。
      probe.log("tools-pill", {
        active: tools.active === null ? null : String(tools.active.name),
        total: tools.total,
      });
      return h("div", { className: "dshh-dock", "data-dsh-hud": "dock" },
        h("span", {
          className: "dshh-pill dshh-toolsPill",
          "data-dsh-hud": "tools-pill",
          title: toolsTitle(tools, t),
        }, children));
    }

    /** 已经跑了多久：`1.2s` / `12s`（拿不到开始时刻就返回 null，不编一个数）。 */
    function toolElapsedLabel(active, now) {
      if (active === null || typeof active !== "object") return null;
      if (typeof active.startedAt !== "number") return null;
      var seconds = Math.max(0, (now - active.startedAt) / 1000);
      return seconds < 10 ? seconds.toFixed(1) + "s" : String(Math.round(seconds)) + "s";
    }

    /** 工具胶囊的悬停说明：在跑什么、一共几次、各工具几次、最近几条的结果与耗时。 */
    function toolsTitle(tools, t) {
      var lines = [];
      if (tools.active !== null) {
        lines.push(t("tools.now", { name: String(tools.active.name) }));
        if (typeof tools.active.summary === "string" && tools.active.summary.length > 0) lines.push(tools.active.summary);
      }
      lines.push(t("tools.total", { n: String(tools.total) }));
      if (tools.counts.length > 0) {
        lines.push(t("tools.byTool") + " " + tools.counts.map(function (item) {
          return String(item.name) + " \u00d7" + String(item.count);
        }).join(" \u00b7 "));
      }
      var recent = tools.recent.slice(0, 3);
      if (recent.length > 0) {
        lines.push(t("tools.recent"));
        lines.push(recent.map(function (item) {
          var mark = item.ok === false ? "\u2717" : "\u2713";
          var ms = typeof item.ms === "number" ? " " + (item.ms / 1000).toFixed(1) + "s" : "";
          var summary = typeof item.summary === "string" && item.summary.length > 0 ? " \u00b7 " + item.summary : "";
          return mark + " " + String(item.name) + ms + summary;
        }).join("\n"));
      }
      return lines.join("\n");
    }

    /* ------------------------------------------------------- 悬浮面板 */

    /**
     * 当前右栏里有哪几栏 —— 样式、夹位置、渲染三处必须用同一份判断，抽出来免得漂移。
     *
     * @returns `{ diff, commit }`：`diff` = 有工作区/提交差异，`commit` = 打开着提交明细。
     */
    function panelLayout(state) {
      return {
        diff: state.diff !== null && typeof state.diff === "object",
        commit: state.commit !== null && typeof state.commit === "object",
      };
    }

    /**
     * 面板宽度：单栏紧凑；打开右栏就按"左栏 + [提交明细栏] + 抓握 + 差异栏"算。
     *
     * 右栏（差异）宽度由面板右边缘的抓握拖动调整并记忆；中间那栏是固定宽度。
     * 视口不够宽时只把弹性的一栏（差异）压小——左栏与提交明细栏是有下限的固定栏。
     *
     * @param layout - `panelLayout()` 的结果。
     * @param diffWidth - 差异栏的目标宽度。
     */
    function panelWidthFor(layout, diffWidth) {
      var middle = layout.commit === true ? COMMIT_LIST_WIDTH : 0;
      if (layout.diff !== true && layout.commit !== true) return PANEL_WIDTH;
      var right = layout.diff === true ? RESIZE_GRIP_WIDTH + (typeof diffWidth === "number" ? diffWidth : DIFF_DEFAULT_WIDTH) : 0;
      var available = window.innerWidth - 2 * VIEWPORT_MARGIN;
      var min = PANEL_WIDTH + middle + (layout.diff === true ? RESIZE_GRIP_WIDTH + DIFF_MIN_WIDTH : 0);
      return Math.max(Math.min(min, available), Math.min(PANEL_WIDTH + middle + right, available));
    }

    /** 把位置夹回视口内，避免拖到屏幕外再也点不到。 */
    function clampPos(left, top, width) {
      var panelWidth = typeof width === "number" ? width : PANEL_WIDTH;
      var maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - panelWidth - VIEWPORT_MARGIN);
      var maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - 48);
      return {
        left: Math.min(Math.max(VIEWPORT_MARGIN, left), maxLeft),
        top: Math.min(Math.max(VIEWPORT_MARGIN, top), maxTop),
      };
    }

    /**
     * 量出胶囊所在 dock 行的视口顶部坐标。
     *
     * 这里用**自己的** `data-dsh-hud` 标记，不碰产品的 DOM 选择器。dsh-git 把
     * "输入框堆叠高 168px"写成了常量并注明那只是一次测量；直接量真实位置可以同时
     * 适配 hero（空白会话，输入框居中）与 active 两种布局。
     *
     * @returns 视口坐标的顶部像素，量不到时返回 null。
     */
    function measureDockTop() {
      if (typeof document === "undefined" || typeof document.querySelector !== "function") return null;
      var node = document.querySelector('[data-dsh-hud="dock"]');
      if (!node || typeof node.getBoundingClientRect !== "function") return null;
      var rect = node.getBoundingClientRect();
      return typeof rect.top === "number" ? rect.top : null;
    }

    /**
     * 根作用域的座位：读不到当前会话，只读共享 store。
     * 收起时渲染 `null` —— 这样不会在输入框上留一个挡点击的气泡。
     */
    function HudFloatingPanel(props) {
      var t = props.t || function (key) { return key; };
      var store = props.store;
      var state = useStore(store);

      var dragRef = React.useState(null);
      var drag = dragRef[0];
      var setDrag = dragRef[1];

      var gripRef = React.useState(null);
      /**
       * "面板已激活"标记：在面板里按过指针（或 Tab 进去）才允许接管裸按键。
       *
       * 用可变对象而不是 React state：事件处理里读的必须是最新值，而重建监听
       * 只依赖 `panelOpen`，改这个标记不该触发重渲染。
       * 必须和其它 hook 一起放在下面那个 `!panelOpen → null` 早退之前。
       */
      var armedState = React.useState(function () { return { inside: false } });
      var armed = armedState[0];
      var grip = gripRef[0];
      var setGrip = gripRef[1];

      // 从 store 现读，别用可能过期的渲染闭包（模式切换会改宽度）。
      function currentPanelWidth() {
        var snapshot = store.getSnapshot();
        return panelWidthFor(panelLayout(snapshot), snapshot.diffWidth);
      }

      // Esc 收起面板。用捕获阶段监听：焦点可能在任何输入框里，捕获阶段先拿到。
      React.useEffect(function () {
        if (!state.panelOpen) return undefined;
        var onKeyDown = function (event) {
          // Esc 任何时候都收（和以前一样：焦点在输入框里也能收到）。
          if (event.key === "Escape") {
            // 和 dsh-git 一样"退一层"：右栏（差异 / 提交明细）→ 收起面板。
            var current = store.getSnapshot();
            if (current.diff || current.commit) store.closeDetail();
            else store.openPanel(false);
            return;
          }

          // 其余按键只在面板被激活时接管：先在面板里点一下（或 Tab 进去）。
          // 本插件是挂在输入框上方的浮层，抢键的代价（打字、翻菜单、滚会话
          // 全被吃掉）远大于多几个快捷键，所以宁可要一次"点进来"。
          if (!armed.inside && !isInsidePanel(activeElement())) return;
          // 正在输入时一律不管。
          if (isTypingTarget(event.target)) return;
          // 带修饰键的组合交给产品与浏览器。
          if (event.metaKey || event.ctrlKey || event.altKey) return;

          var handled = true;
          if (event.key === "ArrowDown") store.stepFile(1, false);
          else if (event.key === "ArrowUp") store.stepFile(-1, false);
          else if (event.key === "]") store.stepFile(1, true);
          else if (event.key === "[") store.stepFile(-1, true);
          else if (event.key === "Enter") store.openCursor();
          else if (event.key === "n") store.stepHunk(1);
          else if (event.key === "p") store.stepHunk(-1);
          else if (event.key === " " || event.code === "Space") store.toggleHunk(store.getSnapshot().diff ? store.getSnapshot().diff.hunk : 0);
          else if (event.key === "r") store.refresh();
          // `v`：把当前聚焦的那一行标成"这一版我审过了"（再按一次取消）。
          // 用键盘而不是给行尾那个标记加 tabindex：行本身是按钮，里面再塞一个按钮是无效结构。
          else if (event.key === "v") {
            var snapshot = store.getSnapshot();
            var rows = visibleChangeRows(snapshot);
            var target = snapshot.cursor !== null && snapshot.cursor !== undefined ? snapshot.cursor : null;
            if (target === null) target = rows[0] ? rows[0].file : null;
            if (target !== null) store.toggleReviewed(target);
          }
          else handled = false;

          if (handled) {
            // 认领了的键就别再让浏览器滚动页面，也别让产品再处理一遍。
            event.preventDefault();
            event.stopPropagation();
          }
        };

        var onPointerDown = function (event) {
          armed.inside = isInsidePanel(event.target);
        };

        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("pointerdown", onPointerDown, true);
        return function () {
          window.removeEventListener("keydown", onKeyDown, true);
          window.removeEventListener("pointerdown", onPointerDown, true);
        };
      }, [state.panelOpen, store]);

      // 视口变化后把已记忆的位置夹回来。
      React.useEffect(function () {
        if (!state.pos) return undefined;
        var onResize = function () {
          var next = clampPos(state.pos.left, state.pos.top, currentPanelWidth());
          if (next.left !== state.pos.left || next.top !== state.pos.top) store.movePanel(next);
        };
        window.addEventListener("resize", onResize);
        return function () {
          window.removeEventListener("resize", onResize);
        };
      }, [state.pos, store]);

      // 量 dock 行位置：面板据此贴到胶囊上方。会话/状态变化（含每轮轮询）都会重量一次，
      // 因此首条消息让 hero 变成 active、输入框换位置时，面板会跟着走。
      React.useEffect(function () {
        if (!state.panelOpen) return undefined;
        var measure = function () {
          store.setAnchorTop(measureDockTop());
        };
        measure();
        window.addEventListener("resize", measure);
        return function () {
          window.removeEventListener("resize", measure);
        };
      }, [state.panelOpen, state.sessionId, state.status, store]);

      /**
       * 拖动：只在头部按下、并且**不是**按在按钮上时开始；移动走 window 监听，
       * 刻意**不用** `setPointerCapture` —— 一旦在头部捕获指针，`pointerup` 会被
       * 重定向到头部，`click` 便落在按下与松开的公共祖先（头部）上，按钮的
       * `onClick` 永远不触发，面板就「关不掉」了。
       */
      React.useEffect(function () {
        if (!drag) return undefined;
        var moved = false;
        var onMove = function (event) {
          if (event.pointerId !== drag.pointerId) return;
          if (!moved
            && Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD_PX
            && Math.abs(event.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
          moved = true;
          store.movePanel(clampPos(event.clientX - drag.offsetX, event.clientY - drag.offsetY, currentPanelWidth()));
        };
        var finish = function (event) {
          if (event.pointerId !== drag.pointerId) return;
          setDrag(null);
          // 只有真的拖动过才落盘：头部上的普通点击不该改变位置。
          if (moved) store.commitPanel(store.getSnapshot().pos);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", finish);
        window.addEventListener("pointercancel", finish);
        return function () {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", finish);
          window.removeEventListener("pointercancel", finish);
        };
      }, [drag, store]);

      /**
       * 拖动面板**右边缘**调整差异栏宽度（与 dsh-git 的抓握位置一致）：
       * 往左拖变宽、往右拖变窄；松手才落盘。
       */
      React.useEffect(function () {
        if (!grip) return undefined;
        var onMove = function (event) {
          if (event.pointerId !== grip.pointerId) return;
          store.setDiffWidth(grip.startWidth - (event.clientX - grip.startX));
        };
        var finish = function (event) {
          if (event.pointerId !== grip.pointerId) return;
          setGrip(null);
          store.persistLayout();
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", finish);
        window.addEventListener("pointercancel", finish);
        return function () {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", finish);
          window.removeEventListener("pointercancel", finish);
        };
      }, [grip, store]);

      if (!state.panelOpen) return null;

      function onGripPointerDown(event) {
        if (event.button !== 0) return;
        var snapshot = store.getSnapshot();
        event.preventDefault();
        setGrip({
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: typeof snapshot.diffWidth === "number" ? snapshot.diffWidth : DIFF_DEFAULT_WIDTH,
        });
      }

      function onHeaderPointerDown(event) {
        if (event.button !== 0) return;
        // 头部里的按钮要保持普通点击，否则拖动会吞掉它们。
        if (event.target && typeof event.target.closest === "function" && event.target.closest("button")) return;
        var rect = event.currentTarget.parentNode.getBoundingClientRect();
        setDrag({
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
        });
      }

      function onHeaderDoubleClick() {
        store.resetPanel();
      }

      var layout = panelLayout(state);
      var diffMode = layout.diff;
      // 提交明细在场时右栏也在场（明细是中间那一栏，差异是右边那一栏），
      // 而当时 `state.diff` 可能还在路上 —— 因此两种情形都算"宽面板"。
      var commitMode = layout.commit;
      var wide = diffMode || commitMode;
      var dockTop = typeof state.anchorTop === "number" ? state.anchorTop : null;
      // 贴到胶囊所在行的上方；量不到就退回 dsh-git 记录的那次测量（168px）。
      var anchorBottom = dockTop === null
        ? COMPOSER_OFFSET
        : Math.max(VIEWPORT_MARGIN, window.innerHeight - dockTop + PANEL_DOCK_GAP);

      var panelStyle = {
        position: "fixed",
        zIndex: 30,
        boxSizing: "border-box",
        width: panelWidthFor(layout, state.diffWidth),
        maxWidth: "calc(100vw - 16px)",
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))",
        borderRadius: 12,
        // 表面用"抬升面"令牌：DSH 自己的浮层几乎都用 bg-layer-1，而 bg-overlay
        // 在暗色下是中灰 bluish-700，拿它当面板底色会发灰、与产品观感不一致。
        background: "var(--dsw-alias-bg-layer-1, #1f2126)",
        boxShadow: "var(--dsw-shadow-lv2, 0 4px 12px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12))",
        overflow: "hidden",
        pointerEvents: "auto",
      };

      if (wide) {
        // 固定高度：面板以 bottom 锚定，若只给 max-height，差异到达时面板会长高并整体跳位。
        var spaceAbove = (dockTop === null ? window.innerHeight - anchorBottom : dockTop - PANEL_DOCK_GAP) - VIEWPORT_MARGIN;
        panelStyle.height = Math.max(240, Math.min(Math.round(window.innerHeight * DIFF_PANEL_HEIGHT_VH), spaceAbove));
      } else {
        panelStyle.maxHeight = "62vh";
      }

      // 未拖动过：锚在胶囊上方居中；拖动过：显式坐标。
      if (state.pos) {
        panelStyle.left = state.pos.left;
        panelStyle.top = state.pos.top;
      } else {
        panelStyle.left = "50%";
        panelStyle.bottom = anchorBottom;
        panelStyle.transform = "translateX(-50%)";
      }

      // 单栏内容（"面板本来就长这样"）：两种模式共用同一份，
      // 打开差异时它原封不动地留在左栏，只有右栏是新出现的。
      // "正在看的那份差异"与"键盘选中的那行"是两件事：前者是打开的文件，
      // 后者可能只是选过还没打开（↑/↓ 移动，Enter 才打开）。两个标记都留着。
      // 左栏那份清单只关心工作区差异：提交明细打开时它不该跟着高亮。
      var worktreeOpen = diffMode && state.diff.source !== "commit";
      var openFile = worktreeOpen ? state.diff.file : null;
      var commitOpenFile = diffMode && state.diff.source === "commit" ? state.diff.file : null;

      // 会话归因视图与过滤后的清单：渲染期只算一次（标记、过滤、概览那行共用）。
      var sessionView = sessionChangeView(state);
      var sessionRows = visibleChangeRows(state);

      var emptyBody;
      if (state.phase === "error") {
        emptyBody = h("div", { className: "dshh-empty" }, errorText(state.errorCode, t));
      } else if (!state.cwd) {
        emptyBody = h("div", { className: "dshh-empty" }, t("panel.noSession"));
      } else if (state.phase === "loading" && !state.status) {
        emptyBody = h("div", { className: "dshh-empty" }, t("panel.loading"));
      } else {
        emptyBody = h("div", { className: "dshh-empty" }, t("panel.notRepo"));
      }

      var listBody;
      if (state.status && state.status.repo) {
        var status = state.status;
        var repoChildren = [
          h("div", { className: "dshh-meta" },
            h("span", { className: "dshh-repo", title: status.repo }, status.repo),
            status.upstream
              ? h("span", { className: "dshh-kv" }, t("panel.upstream") + " " + status.upstream)
              : null,
            status.ahead > 0 ? h("span", { className: "dshh-kv" }, "↑ " + t("panel.ahead") + String(status.ahead)) : null,
            status.behind > 0 ? h("span", { className: "dshh-kv" }, "↓ " + t("panel.behind") + String(status.behind)) : null,
            status.oid ? h("span", { className: "dshh-kv" }, status.oid) : null),
          h("div", { className: "dshh-sectionTitle" }, t("panel.summary")),
          h(CountChips, { counts: status.counts, t: t }),
          h(SessionChangesLine, {
            t: t,
            view: sessionView,
            onlySession: state.onlySession === true,
            onToggle: function () { store.toggleOnlySession(); },
            onlyLatest: state.onlyLatest === true,
            onToggleLatest: function () { store.toggleOnlyLatest(); },
            review: reviewView(state),
            onClearReviewed: function () { store.clearReviewed(); },
          }),
          // 顺序：改动概览 → **改动清单** → 最近提交。清单是"现在要处理的"，
          // 提交是背景信息；清单放前面，一屏不够时先看到的是眼前的事。
          sessionRows.length > 0
            ? h(ChangeList, {
              changes: sessionRows,
              truncated: status.truncated,
              t: t,
              onOpen: function (change) { store.openDiff(change); },
              activeFile: openFile,
              cursor: commitMode ? null : state.cursor,
              listId: "changes",
              sessionView: sessionView,
              review: reviewView(state),
              onToggleReviewed: function (file) { store.toggleReviewed(file); },
            })
            : state.status.changes.length > 0 && state.onlySession === true && sessionView !== null
              // 过滤器开着、本会话又什么都没改：说一句，而不是让清单整段消失。
              ? h("div", { className: "dshh-note" }, t("session.empty"))
              : null,
          h(CommitList, {
            commits: state.commits,
            t: t,
            activeSha: commitMode ? state.commit.sha : null,
            // 再点一次打开着的那条 = 收起明细（打开提交不改左栏，只高亮它）。
            onOpen: function (commit) { store.toggleCommit(commit); },
          }),
        ];
        listBody = h.apply(null, ["div", { className: "dshh-body" }].concat(repoChildren));
      } else {
        listBody = emptyBody;
      }

      // 工作台：左栏**始终**是上面那份单栏内容（宽度也与单栏一致）；打开提交明细时
      // 中间多一栏（这次提交的元信息 + 改动清单），差异固定在右边那一栏。
      // 左栏一个像素都不动，面板右边缘的抓握仍只调整差异栏——与 dsh-git 的 workbench 同形。
      var body = wide
        ? h("div", { className: "dshh-workbench" },
          h("div", { className: "dshh-leftpane", style: { width: PANEL_WIDTH } }, listBody),
          commitMode
            ? h(CommitPane, {
              t: t,
              commit: state.commit,
              onOpenFile: function (file) { store.openCommitDiff(file); },
              activeFile: commitOpenFile,
              cursor: state.cursor,
              width: COMMIT_LIST_WIDTH,
            })
            : null,
          diffMode ? h(DiffView, { t: t, diff: state.diff, store: store }) : null)
        : listBody;

      return h("div", { className: "dshh-panel", "data-dsh-hud": "panel", style: panelStyle },
        h("div", {
          className: "dshh-header",
          title: t("panel.dragHint"),
          onPointerDown: onHeaderPointerDown,
          onDoubleClick: onHeaderDoubleClick,
        },
          h("span", { className: "dshh-title" }, t("panel.title")),
          state.status && state.status.repo
            ? h("span", { className: "dshh-branch" }, branchLabel(state.status, t))
            : null,
          h("span", { className: "dshh-spacer" }),
          h("button", {
            type: "button",
            className: "dshh-icon",
            title: t("panel.refresh"),
            "aria-label": t("panel.refresh"),
            onClick: function () {
              store.refresh();
            },
          }, "⟳"),
          h("button", {
            type: "button",
            className: "dshh-icon",
            title: t("panel.reset"),
            "aria-label": t("panel.reset"),
            onClick: function () {
              store.resetPanel();
            },
          }, "⌖"),
          h("button", {
            type: "button",
            className: "dshh-icon",
            title: t("panel.close"),
            "aria-label": t("panel.close"),
            onClick: function () {
              store.openPanel(false);
            },
          }, "✕")),
        body,
        diffMode
          ? h("div", {
            className: "dshh-grip",
            "data-dsh-hud": "grip",
            title: t("diff.resize"),
            onPointerDown: onGripPointerDown,
          })
          : null,
        h("div", { className: "dshh-footer" },
          h("span", null, t("panel.readonly")),
          h("span", null, state.updatedAt ? t("panel.updated") + timeLabel(state.updatedAt) : "")));
    }

    /* ---------------------------------------------------------------- 样式 */

    /**
     * 只覆盖本插件自己的类名，配色一律走主题 CSS 变量，亮/暗主题自动跟随。
     * 不碰 document.body、window 或产品的 DOM 选择器。
     */
    var CSS = [
      // dock 座位给的是整栏宽的一行，而输入卡片有自己的最大宽度并居中
      // （--dsh-composer-card-max-width）。外层容器复刻框架自带 dock 占位元素
      // （队列公告）的几何，胶囊才会真正贴在输入卡片上方左端，而不是飘到栏的最左。
      ".dshh-dock{box-sizing:border-box;display:flex;justify-content:flex-start;",
      "width:calc(100% - var(--dsh-composer-side-clearance,16px) - var(--dsh-composer-side-clearance,16px)",
      " - var(--dsh-composer-dock-inset,8px) - var(--dsh-composer-dock-inset,8px));",
      "max-width:calc(var(--dsh-composer-card-max-width,952px) - var(--dsh-composer-dock-inset,8px) - var(--dsh-composer-dock-inset,8px));",
      "margin:0 auto;}",
      ".dshh-pill{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.6;",
      "width:fit-content;max-width:100%;",
      "display:inline-flex;align-items:center;gap:4px;",
      "padding:2px 8px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.25));border-radius:999px;",
      "background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8f98);",
      "cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".dshh-pill:hover{color:var(--dsw-alias-label-primary,#e5e7eb);border-color:var(--dsw-alias-border-l2,rgba(127,127,127,0.45));}",
      ".dshh-panel{color:var(--dsw-alias-label-primary,#e5e7eb);font-size:12.5px;line-height:1.6;}",
      ".dshh-header{display:flex;align-items:center;gap:8px;padding:6px 8px;flex:none;cursor:move;line-height:1.4;",
      "user-select:none;touch-action:none;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
      ".dshh-title{font-size:13px;font-weight:600;flex:none;}",
      ".dshh-branch{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;padding:1px 6px;border-radius:6px;",
      "background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));color:var(--dsw-alias-label-secondary,#8a8f98);",
      "max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".dshh-spacer{flex:1;}",
      // 固定盒模型：⟳/⌖/✕ 这类符号可能落到行高夸张的 fallback 字体上，
      // 不锁死宽高就会把标题栏整个撑高（面板上方出现一片空白）。
      ".dshh-icon{font:inherit;font-size:12px;line-height:1;width:22px;height:22px;padding:0;border-radius:6px;",
      "display:inline-flex;align-items:center;justify-content:center;flex:none;",
      "border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#8a8f98);cursor:pointer;}",
      ".dshh-icon:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));color:var(--dsw-alias-label-primary,#e5e7eb);}",
      ".dshh-body{padding:10px;display:flex;flex-direction:column;gap:8px;overflow:auto;}",
      ".dshh-meta{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;}",
      // 不用 direction:rtl 做左省略号：它会把绝对路径开头的 “/” 重排到末尾。
      ".dshh-repo{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);",
      "max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".dshh-kv{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-sectionTitle{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      // 计数芯片之间要留出横向间隔：11.5px 字号的描边胶囊挨在一起时看着是贴住的。
      ".dshh-chips{display:flex;flex-wrap:wrap;gap:6px 12px;}",
      ".dshh-chip{display:inline-flex;align-items:center;font-size:11.5px;padding:1px 8px;border-radius:999px;border:1px solid currentColor;}",
      ".dshh-clean{font-size:11.5px;color:var(--dsw-alias-state-success-primary,#3fb950);}",
      // 会话归因：概览下面那行 + 「只看本会话改的」开关 + 清单行首的标记。
      ".dshh-session{display:flex;align-items:baseline;gap:6px 10px;flex-wrap:wrap;font-size:11px;",
      "color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-sessionText{min-width:0;}",
      ".dshh-sessionToggle{font:inherit;font-size:11px;padding:0 6px;border-radius:999px;white-space:nowrap;",
      "border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.35));background:transparent;",
      "color:var(--dsw-alias-label-secondary,#8a8f98);cursor:pointer;}",
      ".dshh-sessionToggle:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));",
      "color:var(--dsw-alias-label-primary,#e5e7eb);}",
      ".dshh-sessionToggle:focus-visible{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:1px;}",
      ".dshh-sessionToggleOn{border-color:var(--dsw-alias-brand-primary,#4b8bf5);",
      "color:var(--dsw-alias-brand-primary,#4b8bf5);}",
      ".dshh-marker{flex:none;width:8px;text-align:center;font-size:9px;line-height:inherit;",
      "color:var(--dsw-alias-brand-primary,#4b8bf5);}",
      ".dshh-markerPossible{color:var(--dsw-alias-state-warn-primary,#d9a63c);opacity:.75;}",
      // 行尾的审阅标记：`○` 未审 / `✓` 这一版已审 / `✓`(黄) 改动已变。
      // `⋯` 菜单里那条只读摘要：像一条说明，不像一个可点的菜单项。
      ".dshh-menureadout{display:flex;flex-direction:column;gap:2px;padding:4px 10px 6px;",
      "font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,#8a8f98));",
      "cursor:default;user-select:text;max-width:260px;}",
      ".dshh-menureadoutLine{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      // 悬停卡片里那块详情：跟着卡片自己的字号，只做行距与弱化。
      ".dshh-rowhover{display:flex;flex-direction:column;gap:2px;font-size:11px;",
      "color:var(--dsw-alias-label-secondary,#8a8f98);min-width:0;}",
      ".dshh-rowhoverLine{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".dshh-review{flex:none;margin-left:auto;padding:0 2px;font-size:10.5px;cursor:pointer;",
      "color:var(--dsw-alias-label-dimmed,rgba(138,143,152,0.65));}",
      ".dshh-review:hover{color:var(--dsw-alias-label-primary,#e5e7eb);}",
      ".dshh-reviewOn{color:var(--dsw-alias-state-success-primary,#3fb950);}",
      ".dshh-reviewStale{color:var(--dsw-alias-state-warn-primary,#d9a63c);}",
      ".dshh-markerOther{color:var(--dsw-alias-label-dimmed,rgba(138,143,152,0.6));}",
      // 工具活动胶囊：与 Git 胶囊同形，但它是只读读数，指针不该是“可点”。
      ".dshh-toolsPill{cursor:default;}",
      ".dshh-toolsGlyph{flex:none;}",
      ".dshh-toolsGlyphBad{color:var(--dsw-alias-state-error-primary,#f06a6a);}",
      ".dshh-toolsDim{color:var(--dsw-alias-label-tertiary,rgba(138,143,152,0.75));}",
      ".dshh-section{display:flex;flex-direction:column;gap:4px;}",
      ".dshh-list{display:flex;flex-direction:column;gap:1px;max-height:30vh;overflow:auto;",
      "border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.16));padding-top:4px;}",
      // 改动行是按钮（点击看差异），所以要把浏览器的按钮默认样式清掉。
      ".dshh-row{display:flex;align-items:baseline;gap:8px;padding:2px 3px;border-radius:4px;",
      "font:inherit;text-align:left;width:100%;box-sizing:border-box;color:inherit;background:transparent;",
      "border:1px solid transparent;cursor:pointer;}",
      ".dshh-row:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));}",
      ".dshh-row:focus-visible{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:-1px;}",
      ".dshh-status{flex:none;width:10px;text-align:center;font-family:ui-monospace,Consolas,monospace;font-weight:600;}",
      ".dshh-path{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      // 和改动清单一样：标题下面一条分隔线（最近提交是最后一段，用它把两段分开）。
      ".dshh-commits{display:flex;flex-direction:column;gap:1px;",
      "border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.16));padding-top:4px;}",
      // 提交行是按钮（点击看这次提交改了什么），因此要清掉浏览器默认的按钮样式。
      ".dshh-commit{display:flex;align-items:baseline;gap:8px;padding:1px 2px;border-radius:4px;font-size:11.5px;",
      "font:inherit;font-size:11.5px;text-align:left;width:100%;box-sizing:border-box;color:inherit;background:transparent;",
      "border:1px solid transparent;cursor:pointer;}",
      ".dshh-commit:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));}",
      ".dshh-commit:focus-visible{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:-1px;}",
      // 打开着的那条提交（明细在右栏，左栏只高亮它）。
      ".dshh-commitActive{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.22));",
      "box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary,#4b8bf5);}",
      // 中间那一栏（提交明细，默认 240px）：元信息头 + 这次提交的改动清单。
      // 与左栏同形：各自 border-right 分隔，内部自己滚。
      // 注意 flex 是 `0 1 auto` 而不是 `none`：窗口太窄时由它和差异栏一起被压缩，
      // 而不是把左栏挤出去（左栏是主面板，保持固定 380px）。
      ".dshh-commitpane{flex:0 1 auto;box-sizing:border-box;display:flex;flex-direction:column;",
      "min-width:0;min-height:0;overflow:hidden;border-right:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
      ".dshh-commitHead{flex:none;display:flex;flex-direction:column;gap:2px;padding:6px 8px;",
      "border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
      ".dshh-commitTitle{display:flex;align-items:baseline;gap:6px;min-width:0;}",
      ".dshh-commitSubject{font-size:12.5px;line-height:1.5;color:var(--dsw-alias-label-primary,#e5e7eb);",
      "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".dshh-commitMeta{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);",
      "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      // 清单吃掉这一栏剩下的高度（标题跟着一起滚，栏本身不滚动）。
      ".dshh-commitFiles{flex:1 1 auto;min-height:0;overflow:auto;padding:6px 8px 8px;}",
      ".dshh-commitFiles .dshh-list{max-height:none;}",
      ".dshh-csha{flex:none;font-family:ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-csubject{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".dshh-chead{flex:none;font-size:10px;line-height:1.4;padding:0 4px;border-radius:4px;",
      "color:var(--dsw-alias-brand-primary,#4b8bf5);border:1px solid currentColor;}",
      ".dshh-cwhen{flex:none;font-size:10.5px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-note{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-empty{padding:14px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-footer{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;flex:none;",
      "border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));",
      "font-size:10.5px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      // ---- 差异视图 ----
      ".dshh-workbench{display:flex;flex:1 1 auto;min-height:0;align-items:stretch;}",
      ".dshh-leftpane{flex:none;box-sizing:border-box;display:flex;flex-direction:column;min-height:0;overflow:hidden;",
      "border-right:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
      ".dshh-leftpane .dshh-list{max-height:none;}",
      ".dshh-rowActive{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.2));}",
      // 键盘选中的那行：选过还没打开时只它一个亮着，所以用描边而不是底色，
      // 与 .dshh-rowActive（正在看的那份差异）区分得开。
      ".dshh-rowCursor{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:-1px;}",
      // hunk 头可点（折叠 / 展开），并显示"当前 hunk"——键盘 n/p 与 Space 作用在它身上。
      ".dshh-difrow-hunk{cursor:pointer;user-select:none;}",
      ".dshh-difrow-hunk:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.22));}",
      ".dshh-difrow-hunkActive{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.2));",
      "box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary,#4b8bf5);}",
      ".dshh-hunkMark{text-align:right;}",
      ".dshh-grip{position:absolute;top:0;right:0;bottom:0;width:6px;cursor:col-resize;z-index:5;}",
      ".dshh-grip:hover{background:var(--dsw-alias-border-l2,rgba(127,127,127,0.35));}",
      ".dshh-diffview{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;}",
      ".dshh-toolbar{display:flex;align-items:center;gap:4px;padding:5px 8px;flex:none;overflow:hidden;",
      "border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
      ".dshh-difpath{font-family:ui-monospace,Consolas,monospace;font-size:11px;",
      "color:var(--dsw-alias-label-secondary,#8a8f98);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:38%;}",
      ".dshh-difcounts{display:inline-flex;gap:6px;flex:none;font-family:ui-monospace,Consolas,monospace;font-size:11px;}",
      ".dshh-tab{font:inherit;font-size:11.5px;padding:2px 7px;border-radius:6px;flex:none;cursor:pointer;",
      "border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-tab:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));color:var(--dsw-alias-label-primary,#e5e7eb);}",
      ".dshh-tabActive{color:var(--dsw-alias-label-primary,#e5e7eb);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.18));}",
      ".dshh-diff{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 0 8px;",
      "font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.5;}",
      ".dshh-difrow{display:flex;align-items:flex-start;white-space:pre;}",
      ".dshh-difrow-hunk{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));",
      "color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-difrow-meta{color:var(--dsw-alias-label-secondary,#8a8f98);opacity:.85;}",
      ".dshh-difno{flex:none;width:46px;text-align:right;padding-right:8px;user-select:none;",
      "color:var(--dsw-alias-label-secondary,#8a8f98);font-variant-numeric:tabular-nums;}",
      ".dshh-diftext{flex:1 1 auto;min-width:0;white-space:pre;overflow:hidden;text-overflow:ellipsis;}",
      ".dshh-diftext.dshh-wrap{white-space:pre-wrap;word-break:break-word;overflow:visible;text-overflow:clip;}",
    ].join("");

    /* ---------------------------------------------------------------- 样式注入 */

    /** 自有样式表的稳定 tag id：`data-plugin-css` 用它做幂等插入。 */
    var CSS_TAG_ID = "dsh-hud/styles.css";

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
    function ensureStyles() {
      if (typeof document === "undefined") return null;
      var selector = 'style[data-plugin-css="' + CSS_TAG_ID + '"]';
      var tag = typeof document.querySelector === "function" ? document.querySelector(selector) : null;
      if (!tag) {
        tag = document.createElement("style");
        // 值必须等于客户端模块 id（= 包名）：客户端的 `removeOwnedStyles(id)` 靠它回收样式。
        tag.setAttribute("data-plugin", "@konnga/dsh-hud");
        tag.setAttribute("data-plugin-css", CSS_TAG_ID);
        tag.setAttribute("data-dsh-hud", "styles");
        document.head.appendChild(tag);
      }
      tag.textContent = CSS;
      return tag;
    }

    /* ---------------------------------------------------------------- 插件 */

    /**
     * 客户端插件主体。
     * @param ctx - 客户端根上下文（slots、connection、locale）。
     */
    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en });
      }, "dsh-hud: dictionaries");

      ctx.effect(function () {
        var element = ensureStyles();
        return function () {
          if (element && element.parentNode) element.parentNode.removeChild(element);
        };
      }, "dsh-hud: styles");

      var store = createStore(ctx);

      // 起手留一行：诊断里**有没有这一行**就足以区分"客户端半压根没加载"与"加载了但
      // 哪一环没接上"（这一行由 apply 发，与后面的投影/名单无关）。
      probe.log("apply", {
        inject: typeof ctx.inject === "function",
        slots: typeof ctx.slots === "object",
        // 跑着的那一版自有样式表里，计数芯片的间隔是多少：改完样式没生效时用它分辨
        // "bundle 还是旧的"还是"规则没生效"。
        chips: cssChipsGap(CSS),
      });

      // 面板与胶囊都要能反映磁盘上的实时变化；页面不可见时不打请求。
      // 顺手补一次样式表：框架的 HMR 记账会把插件的 `<style>` 删掉，删掉就自愈。
      ctx.effect(function () {
        var id = window.setInterval(function () {
          if (document.visibilityState === "hidden") return;
          ensureStyles();
          store.refresh();
        }, POLL_MS);
        return function () {
          window.clearInterval(id);
        };
      }, "dsh-hud: status poll");

      // 从别处回到页面时立刻补一次（定时器在隐藏期间被跳过）。
      ctx.effect(function () {
        var onFocus = function () {
          ensureStyles();
          store.refresh();
        };
        window.addEventListener("focus", onFocus);
        return function () {
          window.removeEventListener("focus", onFocus);
        };
      }, "dsh-hud: focus refresh");

      ctx.slots.inject("shell.overlay", function () {
        return ctx.slots.register({
          name: "shell.overlay",
          id: "dsh-hud-panel",
          order: 20,
          locale: NS,
          inject: function () {
            return { store: store };
          },
        }, HudFloatingPanel);
      });

      // 侧栏行内 chip 的数据：起手取一次，之后按自己的节奏更新（页面隐藏时跳过）。
      ctx.effect(function () {
        store.refreshRows();
        var id = window.setInterval(function () {
          if (document.visibilityState === "hidden") return;
          store.refreshRows();
        }, ROWS_POLL_MS);
        return function () {
          window.clearInterval(id);
        };
      }, "dsh-hud: session rows poll");

      // `⋯` 菜单里的一条只读摘要：行尾拿不到常亮座位，这里是最实在的"完整信息"落点。
      ctx.slots.inject("sidebar.workspaces.session.menu.item", function () {
        return ctx.slots.register({
          name: "sidebar.workspaces.session.menu.item",
          id: "dsh-hud-session-menu",
          order: 30,
          locale: NS,
          inject: function () {
            return { store: store };
          },
        }, SessionMenuSummary);
      });


      // 悬停卡片里那块详情（宽敞的地方；动作条那枚放不下的东西都在这儿）。
      ctx.slots.inject("sidebar.session.row.hover", function () {
        return ctx.slots.register({
          name: "sidebar.session.row.hover",
          id: "dsh-hud-session-hover",
          order: 30,
          locale: NS,
          inject: function () {
            return { store: store };
          },
        }, SessionRowHoverChip);
      });

      // 工具活动胶囊：独立一条注册 = dock 竖列上自己的一行（与 Git 胶囊分行）。
      ctx.slots.inject("conversation.input.dock", function () {
        return ctx.slots.register({
          name: "conversation.input.dock",
          id: "dsh-hud-tools",
          order: 21,
          locale: NS,
          inject: function () {
            return { store: store };
          },
        }, HudToolsCapsule);
      });

      ctx.slots.inject("conversation.input.dock", function () {
        return ctx.slots.register({
          name: "conversation.input.dock",
          id: "dsh-hud-pill",
          order: 20,
          locale: NS,
          inject: function (sessionId) {
            return { store: store, sessionId: sessionId };
          },
        }, HudDockPill);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
