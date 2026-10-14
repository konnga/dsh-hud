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
      };

      var listeners = new Set();
      var inflight = null;

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
        writeUi({ open: state.panelOpen, pos: state.pos });
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
              set({
                phase: "ready",
                status: result.value || null,
                errorCode: null,
                updatedAt: Date.now(),
              });
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

    function countTotal(counts) {
      var total = 0;
      for (var index = 0; index < COUNT_ORDER.length; index += 1) {
        total += counts[COUNT_ORDER[index]] || 0;
      }
      return total;
    }

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
        return h("div", { className: "dshh-row", key: String(index) + ":" + change.path, title: change.path },
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
      return t("err.git-failed");
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

      var text;
      if (state.phase === "error") {
        text = "⎇ " + t("pill.error");
      } else if (state.phase === "loading" || state.phase === "idle") {
        text = "⎇ " + t("pill.loading");
      } else if (!state.status || !state.status.repo) {
        text = "⎇ " + t("pill.notRepo");
      } else {
        var status = state.status;
        var total = countTotal(status.counts || {});
        text = "⎇ " + branchLabel(status, t) + (status.dirty ? "*" : "");
        if (status.ahead > 0) text += " ↑" + String(status.ahead);
        if (status.behind > 0) text += " ↓" + String(status.behind);
        if (total > 0) text += " · " + String(total);
      }

      return h("button", {
        type: "button",
        className: "dshh-pill",
        "data-dsh-hud": "pill",
        title: t("pill.title") + (cwd ? "\n" + cwd : ""),
        "aria-expanded": state.panelOpen ? "true" : "false",
        style: { color: state.panelOpen ? "var(--dsw-alias-brand-primary, #4b8bf5)" : undefined },
        onClick: function () {
          store.togglePanel();
        },
      }, text);
    }

    /* ------------------------------------------------------- 悬浮面板 */

    /** 把位置夹回视口内，避免拖到屏幕外再也点不到。 */
    function clampPos(left, top) {
      var maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
      var maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - 48);
      return {
        left: Math.min(Math.max(VIEWPORT_MARGIN, left), maxLeft),
        top: Math.min(Math.max(VIEWPORT_MARGIN, top), maxTop),
      };
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

      // Esc 收起面板。
      React.useEffect(function () {
        if (!state.panelOpen) return undefined;
        var onKeyDown = function (event) {
          if (event.key === "Escape") store.openPanel(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return function () {
          window.removeEventListener("keydown", onKeyDown);
        };
      }, [state.panelOpen, store]);

      // 视口变化后把已记忆的位置夹回来。
      React.useEffect(function () {
        if (!state.pos) return undefined;
        var onResize = function () {
          var next = clampPos(state.pos.left, state.pos.top);
          if (next.left !== state.pos.left || next.top !== state.pos.top) store.movePanel(next);
        };
        window.addEventListener("resize", onResize);
        return function () {
          window.removeEventListener("resize", onResize);
        };
      }, [state.pos, store]);

      if (!state.panelOpen) return null;

      /**
       * 拖动标题移动面板：未拖动过时面板由 CSS 锚定在输入框上方，
       * 一旦开始拖动就改用显式 left/top（起点取自 getBoundingClientRect，
       * 因此切换瞬间不会跳位）。
       */
      function onHeaderPointerDown(event) {
        if (event.button !== 0) return;
        var rect = event.currentTarget.parentNode.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
      }

      function onHeaderPointerMove(event) {
        if (!drag || drag.pointerId !== event.pointerId) return;
        store.movePanel(clampPos(event.clientX - drag.offsetX, event.clientY - drag.offsetY));
      }

      function onHeaderPointerUp(event) {
        if (!drag || drag.pointerId !== event.pointerId) return;
        setDrag(null);
        // 从 store 现读，而不是用可能过期的渲染闭包。
        store.commitPanel(store.getSnapshot().pos);
      }

      function onHeaderDoubleClick() {
        store.resetPanel();
      }

      var panelStyle = {
        position: "fixed",
        zIndex: 30,
        boxSizing: "border-box",
        width: PANEL_WIDTH,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "62vh",
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))",
        borderRadius: 12,
        background: "var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-base, #1e1e1e))",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        overflow: "hidden",
        pointerEvents: "auto",
      };

      // 未拖动过：锚在输入框上方居中；拖动过：显式坐标。
      if (state.pos) {
        panelStyle.left = state.pos.left;
        panelStyle.top = state.pos.top;
      } else {
        panelStyle.left = "50%";
        panelStyle.bottom = COMPOSER_OFFSET;
        panelStyle.transform = "translateX(-50%)";
      }

      var body;
      if (state.phase === "error") {
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
          h(ChangeList, { changes: status.changes, truncated: status.truncated, t: t }));
      }

      return h("div", { className: "dshh-panel", "data-dsh-hud": "panel", style: panelStyle },
        h("div", {
          className: "dshh-header",
          title: t("panel.dragHint"),
          onPointerDown: onHeaderPointerDown,
          onPointerMove: onHeaderPointerMove,
          onPointerUp: onHeaderPointerUp,
          onPointerCancel: onHeaderPointerUp,
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
      ".dshh-pill{font:inherit;font-size:12px;line-height:1.6;display:inline-flex;align-items:center;gap:4px;",
      "padding:2px 8px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.25));border-radius:999px;",
      "background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8f98);",
      "cursor:pointer;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;}",
      ".dshh-pill:hover{color:var(--dsw-alias-label-primary,#e5e7eb);border-color:var(--dsw-alias-border-l2,rgba(127,127,127,0.45));}",
      ".dshh-panel{color:var(--dsw-alias-label-primary,#e5e7eb);font-size:12.5px;line-height:1.6;}",
      ".dshh-header{display:flex;align-items:center;gap:8px;padding:8px 10px;flex:none;cursor:move;",
      "user-select:none;touch-action:none;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
      ".dshh-title{font-size:13px;font-weight:600;flex:none;}",
      ".dshh-branch{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;padding:1px 6px;border-radius:6px;",
      "background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,0.12));color:var(--dsw-alias-label-secondary,#8a8f98);",
      "max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".dshh-spacer{flex:1;}",
      ".dshh-icon{font:inherit;font-size:12px;line-height:1;padding:3px 6px;border-radius:6px;",
      "border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#8a8f98);cursor:pointer;}",
      ".dshh-icon:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));color:var(--dsw-alias-label-primary,#e5e7eb);}",
      ".dshh-body{padding:10px;display:flex;flex-direction:column;gap:8px;overflow:auto;}",
      ".dshh-meta{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;}",
      ".dshh-repo{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);",
      "direction:rtl;text-align:left;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".dshh-kv{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-sectionTitle{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-chips{display:flex;flex-wrap:wrap;gap:6px;}",
      ".dshh-chip{display:inline-flex;align-items:center;font-size:11.5px;padding:1px 7px;border-radius:999px;border:1px solid currentColor;}",
      ".dshh-clean{font-size:11.5px;color:var(--dsw-alias-state-success-primary,#3fb950);}",
      ".dshh-section{display:flex;flex-direction:column;gap:4px;}",
      ".dshh-list{display:flex;flex-direction:column;gap:1px;max-height:38vh;overflow:auto;",
      "border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.16));padding-top:4px;}",
      ".dshh-row{display:flex;align-items:baseline;gap:8px;padding:1px 2px;border-radius:4px;}",
      ".dshh-row:hover{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,0.12));}",
      ".dshh-status{flex:none;width:10px;text-align:center;font-family:ui-monospace,Consolas,monospace;font-weight:600;}",
      ".dshh-path{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".dshh-note{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-empty{padding:14px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
      ".dshh-footer{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;flex:none;",
      "border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));",
      "font-size:10.5px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
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
