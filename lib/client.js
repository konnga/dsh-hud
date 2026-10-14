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
  id: 'dsh-hud',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var h = React.createElement;

    var CHANNEL = "/dsh-hud-rpc";
    var NS = "dshHud";
    var UI_KEY = "dsh-hud.ui.v1";

    /** 轮询间隔：面板与胶囊共用，页面不可见时跳过。 */
    var POLL_MS = 8000;
    /** 面板默认宽度与“停靠在输入框上方”的锚点高度。 */
    var PANEL_WIDTH = 380;
    var COMPOSER_OFFSET = 168;
    var VIEWPORT_MARGIN = 8;
    /** 超过这个位移才算拖动，避免把头部上的普通点击当成拖动。 */
    var DRAG_THRESHOLD_PX = 3;
    /** 面板与胶囊所在 dock 行之间的间距。 */
    var PANEL_DOCK_GAP = 8;
    /** diff 模式的面板：更宽，且用固定高度（避免 bottom 锚定下"内容变高就跳位"）。 */
    var DIFF_PANEL_WIDTH = 920;
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
      "panel.commits": "最近提交",
      "time.now": "刚刚",
      "time.minutes": " 分钟前",
      "time.hours": " 小时前",
      "time.days": " 天前",
      "diff.back": "返回清单",
      "diff.worktree": "未暂存",
      "diff.index": "已暂存",
      "diff.wrap": "自动换行",
      "diff.copy": "复制差异",
      "diff.copied": "已复制",
      "diff.empty": "这一侧没有差异",
      "diff.binary": "二进制文件，没有可显示的文本差异",
      "diff.truncated": "差异过大，仅显示前面部分",
      "diff.untrackedHint": "未跟踪文件，与空文件对比",
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
      "panel.commits": "Recent commits",
      "time.now": "just now",
      "time.minutes": "m ago",
      "time.hours": "h ago",
      "time.days": "d ago",
      "diff.back": "Back to list",
      "diff.worktree": "Unstaged",
      "diff.index": "Staged",
      "diff.wrap": "Wrap lines",
      "diff.copy": "Copy diff",
      "diff.copied": "Copied",
      "diff.empty": "No changes on this side",
      "diff.binary": "Binary file — no text diff to show",
      "diff.truncated": "Diff is large; showing the beginning only",
      "diff.untrackedHint": "Untracked file, diffed against an empty file",
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

    /* --------------------------------------------------------------- store */

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
        /** 最近提交；`commitsOid` 记住它是哪个 HEAD 取的，oid 变了才重取。 */
        commits: null,
        commitsOid: null,
      };

      var listeners = new Set();
      var inflight = null;
      var diffInflight = null;

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
        writeUi({ open: state.panelOpen, pos: state.pos, wrap: state.diff && state.diff.wrap === true });
      }

      /**
       * 打开一个改动文件的差异视图：一次取回**两侧**的 rows，
       * 默认落在有内容的那一侧（工作区优先），页签切换因此不需要再发请求。
       */
      function openDiff(change) {
        if (!state.cwd || !change || !change.file) return Promise.resolve();
        var cwd = state.cwd;
        var wrap = state.diff ? state.diff.wrap === true : readUi().wrap === true;
        set({ diff: { phase: "loading", path: change.path, file: change.file, origPath: change.origFile || null, data: null, side: "worktree", wrap: wrap, errorCode: null } });

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
                  phase: "ready",
                  path: change.path,
                  file: change.file,
                  origPath: change.origFile || null,
                  data: value,
                  side: worktreeRows > 0 || indexRows === 0 ? "worktree" : "index",
                  wrap: current.wrap,
                  errorCode: null,
                },
              });
              return;
            }
            var code = result && result.error && result.error.details ? result.error.details.code : null;
            set({
              diff: {
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

      function closeDiff() {
        if (state.diff === null) return;
        set({ diff: null });
      }

      function setDiffSide(side) {
        if (!state.diff || (side !== "worktree" && side !== "index")) return;
        set({ diff: Object.assign({}, state.diff, { side: side }) });
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
        if (!state.cwd) return Promise.resolve();
        if (inflight) return inflight;
        var cwd = state.cwd;

        set({ phase: state.status ? "ready" : "loading" });

        inflight = Promise.resolve()
          .then(function () {
            return ctx.connection.rpc.call(CHANNEL, "status", { args: { cwd: cwd } });
          })
          .then(function (result) {
            inflight = null;
            if (state.cwd !== cwd) return;
            if (result && result.ok === true) {
              var statusValue = result.value || null;
              set({
                phase: "ready",
                status: statusValue,
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
          phase: cwd ? "loading" : "idle",
        });
        refresh();
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
        openDiff: openDiff,
        closeDiff: closeDiff,
        setDiffSide: setDiffSide,
        toggleDiffWrap: toggleDiffWrap,
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
      if (changes.length === 0) return null;

      var rows = changes.map(function (change, index) {
        // 整行可点：打开该文件的差异视图（只读，不改动任何东西）。
        return h("button", {
          type: "button",
          className: "dshh-row",
          key: String(index) + ":" + change.path,
          title: change.path + "\n" + props.t("panel.clickForDiff"),
          onClick: function () {
            props.onOpen(change);
          },
        },
        h("span", {
          className: "dshh-status",
          style: { color: COUNT_COLOR[statusKey(change.status)] || "var(--dsw-alias-label-secondary, #8a8f98)" },
        }, change.status),
        h("span", { className: "dshh-path" }, change.path));
      });

      var footer = props.truncated
        ? h("div", { className: "dshh-note" }, props.t("panel.truncated"))
        : null;

      return h("div", { className: "dshh-section" },
        h("div", { className: "dshh-sectionTitle" }, props.t("panel.changes") + " · " + String(changes.length)),
        h("div", { className: "dshh-list" }, rows),
        footer);
    }

    /** 一行差异：两个行号槽 + 文本。 */
    function DiffRow(props) {
      var row = props.row;
      var style = row.kind === "add" ? { background: DIFF_ADD_BG } : row.kind === "del" ? { background: DIFF_DEL_BG } : null;
      var gutterStyle = { color: DIFF_GUTTER_COLOR };
      var text = row.text === "" ? "\u00a0" : row.text;

      return h("div", { className: "dshh-difrow dshh-difrow-" + row.kind, style: style },
        h("span", { className: "dshh-difno", style: gutterStyle }, row.oldLine === null ? "" : String(row.oldLine)),
        h("span", { className: "dshh-difno", style: gutterStyle }, row.newLine === null ? "" : String(row.newLine)),
        h("span", { className: "dshh-diftext" + (props.wrap ? " dshh-wrap" : "") }, text));
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

    /** 最近提交：一行一条，sha + 标题 + HEAD 徽标 + 相对时间。 */
    function CommitList(props) {
      var commits = props.commits || [];
      if (commits.length === 0) return null;
      var t = props.t;

      return h("div", { className: "dshh-section" },
        h("div", { className: "dshh-sectionTitle" }, t("panel.commits")),
        h("div", { className: "dshh-commits" }, commits.map(function (commit, index) {
          var refs = commit.refs || [];
          var isHead = refs.some(function (ref) { return ref.indexOf("HEAD") === 0; });
          var tip = [commit.subject, commit.author + " · " + commit.date].concat(refs).join("\n");
          return h("div", { className: "dshh-commit", key: commit.sha + ":" + String(index), title: tip },
            h("span", { className: "dshh-csha" }, commit.sha),
            h("span", { className: "dshh-csubject" }, commit.subject || "—"),
            isHead ? h("span", { className: "dshh-chead" }, "HEAD") : null,
            h("span", { className: "dshh-cwhen" }, commitWhen(commit, t)));
        })));
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

      var side = diff.side === "index" ? "index" : "worktree";
      var data = diff.data ? diff.data[side] : null;
      var untracked = diff.data ? diff.data.untracked === true : false;

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
      } else if (!data.rows || data.rows.length === 0) {
        body = h("div", { className: "dshh-empty" }, t("diff.empty"));
      } else {
        body = h("div", { className: "dshh-diff" },
          data.rows.map(function (row, index) {
            return h(DiffRow, { key: String(index), row: row, wrap: diff.wrap === true });
          }),
          data.truncated === true ? h("div", { className: "dshh-note" }, t("diff.truncated")) : null);
      }

      return h("div", { className: "dshh-diffview" },
        h("div", { className: "dshh-toolbar" },
          h("button", {
            type: "button",
            className: "dshh-tab",
            title: t("diff.back"),
            onClick: function () { store.closeDiff(); },
          }, "← " + t("diff.back")),
          h("span", { className: "dshh-difpath", title: diff.path }, diff.path),
          counts,
          h("span", { className: "dshh-spacer" }),
          untracked ? h("span", { className: "dshh-kv" }, t("diff.untrackedHint")) : null,
          tab("worktree", t("diff.worktree"), t("diff.worktree")),
          untracked ? null : tab("index", t("diff.index"), t("diff.index")),
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
          }, copied ? t("diff.copied") : t("diff.copy"))),
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
        var counts = status.counts || {};
        for (var index = 0; index < COUNT_ORDER.length; index += 1) {
          var key = COUNT_ORDER[index];
          var value = counts[key] || 0;
          if (value <= 0) continue;
          children.push(" ");
          children.push(h("span", {
            key: key,
            style: { color: COUNT_COLOR[key] },
          }, COUNT_MARK[key] + String(value)));
        }
      }

      // 悬停给出完整信息：总数型的托盘里放不下细节，这里补齐。
      var titleLines = [t("pill.title")];
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

    /* ------------------------------------------------------- 悬浮面板 */

    /** 面板宽度随模式变化：清单模式紧凑，差异模式给足横向空间。 */
    function panelWidthFor(diffMode) {
      if (!diffMode) return PANEL_WIDTH;
      return Math.max(240, Math.min(DIFF_PANEL_WIDTH, window.innerWidth - 2 * VIEWPORT_MARGIN));
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

      // 从 store 现读，别用可能过期的渲染闭包（模式切换会改宽度）。
      function currentPanelWidth() {
        return panelWidthFor(store.getSnapshot().diff !== null);
      }

      // Esc 收起面板。用捕获阶段监听：焦点可能在任何输入框里，捕获阶段先拿到。
      React.useEffect(function () {
        if (!state.panelOpen) return undefined;
        var onKeyDown = function (event) {
          if (event.key === "Escape") store.openPanel(false);
        };
        window.addEventListener("keydown", onKeyDown, true);
        return function () {
          window.removeEventListener("keydown", onKeyDown, true);
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

      if (!state.panelOpen) return null;

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

      var diffMode = state.diff !== null && typeof state.diff === "object";
      var dockTop = typeof state.anchorTop === "number" ? state.anchorTop : null;
      // 贴到胶囊所在行的上方；量不到就退回 dsh-git 记录的那次测量（168px）。
      var anchorBottom = dockTop === null
        ? COMPOSER_OFFSET
        : Math.max(VIEWPORT_MARGIN, window.innerHeight - dockTop + PANEL_DOCK_GAP);

      var panelStyle = {
        position: "fixed",
        zIndex: 30,
        boxSizing: "border-box",
        width: panelWidthFor(diffMode),
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

      if (diffMode) {
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

      var body;
      if (diffMode) {
        body = h(DiffView, { t: t, diff: state.diff, store: store });
      } else if (state.phase === "error") {
        body = h("div", { className: "dshh-empty" }, errorText(state.errorCode, t));
      } else if (!state.cwd) {
        body = h("div", { className: "dshh-empty" }, t("panel.noSession"));
      } else if (state.phase === "loading" && !state.status) {
        body = h("div", { className: "dshh-empty" }, t("panel.loading"));
      } else if (!state.status || !state.status.repo) {
        body = h("div", { className: "dshh-empty" }, t("panel.notRepo"));
      } else {
        var status = state.status;
        body = h("div", { className: "dshh-body" },
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
          h(CommitList, { commits: state.commits, t: t }),
          h(ChangeList, {
            changes: status.changes,
            truncated: status.truncated,
            t: t,
            onOpen: function (change) { store.openDiff(change); },
          }));
      }

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
      ".dshh-chips{display:flex;flex-wrap:wrap;gap:6px;}",
      ".dshh-chip{display:inline-flex;align-items:center;font-size:11.5px;padding:1px 7px;border-radius:999px;border:1px solid currentColor;}",
      ".dshh-clean{font-size:11.5px;color:var(--dsw-alias-state-success-primary,#3fb950);}",
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
      ".dshh-commits{display:flex;flex-direction:column;gap:1px;}",
      ".dshh-commit{display:flex;align-items:baseline;gap:8px;padding:1px 2px;border-radius:4px;font-size:11.5px;}",
      ".dshh-commit:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));}",
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
      ".dshh-diffview{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;}",
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
        var element = document.createElement("style");
        element.setAttribute("data-dsh-hud", "styles");
        element.textContent = CSS;
        document.head.appendChild(element);
        return function () {
          if (element.parentNode) element.parentNode.removeChild(element);
        };
      }, "dsh-hud: styles");

      var store = createStore(ctx);

      // 面板与胶囊都要能反映磁盘上的实时变化；页面不可见时不打请求。
      ctx.effect(function () {
        var id = window.setInterval(function () {
          if (document.visibilityState === "hidden") return;
          store.refresh();
        }, POLL_MS);
        return function () {
          window.clearInterval(id);
        };
      }, "dsh-hud: status poll");

      // 从别处回到页面时立刻补一次（定时器在隐藏期间被跳过）。
      ctx.effect(function () {
        var onFocus = function () {
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
