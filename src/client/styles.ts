/**
 * 面板与胶囊的样式表。
 *
 * 放在数组里逐段拼（不是模板字符串），是为了每段都能单独读懂；
 * `ensureStyles()` 把它插进 `<head>`，用 `CSS_TAG_ID` 防重复注入。
 */

/**
 * 只覆盖本插件自己的类名，配色一律走主题 CSS 变量，亮/暗主题自动跟随。
 * 不碰 document.body、window 或产品的 DOM 选择器。
 */
export const CSS = [
  // dock 座位给的是整栏宽的一行，而输入卡片有自己的最大宽度并居中
  // （--dsh-composer-card-max-width）。外层容器复刻框架自带 dock 占位元素
  // （队列公告）的几何，胶囊才会真正贴在输入卡片上方左端，而不是飘到栏的最左。
  '.dshh-dock{box-sizing:border-box;display:flex;align-items:center;gap:6px;justify-content:flex-start;',
  'width:calc(100% - var(--dsh-composer-side-clearance,16px) - var(--dsh-composer-side-clearance,16px)',
  ' - var(--dsh-composer-dock-inset,8px) - var(--dsh-composer-dock-inset,8px));',
  'max-width:calc(var(--dsh-composer-card-max-width,952px) - var(--dsh-composer-dock-inset,8px) - var(--dsh-composer-dock-inset,8px));',
  'margin:0 auto;}',
  '.dshh-pill{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.6;',
  'width:fit-content;max-width:100%;',
  'display:inline-flex;align-items:center;gap:4px;',
  'padding:2px 8px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.25));border-radius:999px;',
  'background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8f98);',
  'cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
  '.dshh-pill:hover{color:var(--dsw-alias-label-primary,#e5e7eb);border-color:var(--dsw-alias-border-l2,rgba(127,127,127,0.45));}',
  // 会话计时胶囊：只读读数，所以指针不该是"可点"；数字用等宽数字，跳动时宽度不抖。
  '.dshh-timer{cursor:default;gap:5px;}',
  // 悬停气泡：`pointer-events:none` 保证它永远不挡指针；`pre-wrap` 保留调用方给的多行结构。
  '.dshh-tip{position:fixed;z-index:60;box-sizing:border-box;max-width:420px;padding:6px 10px;border-radius:8px;' +
    'background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2,#2c2c2e));' +
    'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.25));' +
    'box-shadow:0 6px 20px rgba(0,0,0,0.28);color:var(--dsw-alias-label-primary,#f9fafb);' +
    'font-size:11.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;pointer-events:none;}',
  // 气泡逐行结构：标签（「余额」「账号已用」…）用次要色、数字用主色 ——
  // 一眼扫到数字，而不是让标签和数字抢同样的注意力。
  '.dshh-tipLine{display:block;}',
  // 行内分段的普通部分继承整行的颜色，只有带 tone 的段自己变色（见 `.dshh-tipSuccess` 等）。
  '.dshh-tipSeg{white-space:pre-wrap;}',
  // 数字用等宽数字：一屏里有好几处读数时，位数变化不会让文字左右抖。
  '.dshh-tipAccent,.dshh-tipSuccess,.dshh-tipWarn,.dshh-tipValue{font-variant-numeric:tabular-nums;}',
  '.dshh-tipLabel{color:var(--dsw-alias-label-secondary,#9aa0a6);}',
  '.dshh-tipValue{color:var(--dsw-alias-label-primary,#f9fafb);margin-left:2px;}',
  // 数字的分类色。三套都取**框架自己的状态/品牌令牌**（它们深浅主题各有取值，
  // 且框架本身就把它们当文字色用），不自己写死十六进制 —— 否则换主题就不对了。
  '.dshh-tipSuccess{color:var(--dsw-alias-state-success-primary,#22c55e);}',
  '.dshh-tipWarn{color:var(--dsw-alias-state-warn-primary,#f59e0b);}',
  '.dshh-tipAccent{color:var(--dsw-alias-state-business-primary,#7aaaff);}',
  '.dshh-tipMuted{color:var(--dsw-alias-label-tertiary,#6b7280);}',
  '.dshh-timerGlyph{flex:none;opacity:.85;}',
  '.dshh-timerValue{font-variant-numeric:tabular-nums;}',
  // 余额胶囊：数字用等宽数字（余额跳动时宽度不抖）。
  // 币种符号由 `formatBalance` 的输出自带，样式里**不另画字形**（早先多画一个就成了 `¥ ¥8.60`）。
  '.dshh-balance{cursor:pointer;gap:2px;font-variant-numeric:tabular-nums;}',
  '.dshh-balanceValue{letter-spacing:.2px;}',
  // 赠送余额的 `+`：不是数字，别让它抢走小数点的注意力。
  '.dshh-balanceBonus{opacity:.75;margin-left:1px;}',
  // `?` = 这一份是上一次的数（刷新失败）：用警示色标出来，但不刺眼。
  '.dshh-balanceStale{color:var(--dsw-alias-state-warning-primary,#d7a14a);margin-left:2px;}',
  // 低余额：`⚠` 与金额一起用警示色（金额本身也变色，扫一眼就知道该充值了）。
  '.dshh-balanceWarn{flex:none;color:var(--dsw-alias-state-warning-primary,#d7a14a);margin-right:2px;}',
  '.dshh-balanceLow{color:var(--dsw-alias-state-warning-primary,#d7a14a);}',
  // 「已用」前缀：比数字弱一档，读的时候不会把它当成余额的一部分。
  '.dshh-balanceUsed{flex:none;opacity:.65;margin-right:1px;}',
  // 读不到余额时那枚中性胶囊：整枚压暗，不与有数的胶囊争夺注意力。
  '.dshh-balanceUnknown{opacity:.7;}',
  '.dshh-balanceProvider{flex:none;margin-right:3px;opacity:.8;}',
  '.dshh-panel{color:var(--dsw-alias-label-primary,#e5e7eb);font-size:12.5px;line-height:1.6;}',
  // 后台令牌设置面板：浮在胶囊上方，宽度锁死（凭据是一行长字符串，宽了反而看不过来）。
  '.dshh-tokenPanel{position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:2147483000;',
  'width:min(420px,calc(100vw - 32px));box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:12px 14px;',
  'border-radius:12px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,0.28));',
  'background:var(--dsw-alias-bg-layer-1,#1c1d21);color:var(--dsw-alias-label-primary,#e5e7eb);',
  'box-shadow:0 12px 32px rgba(0,0,0,0.32);font-size:12.5px;line-height:1.55;}',
  '.dshh-tokenHead{display:flex;align-items:baseline;gap:6px;}',
  '.dshh-tokenTitle{font-size:13px;font-weight:600;}',
  '.dshh-tokenProvider{font-family:ui-monospace,Consolas,monospace;font-size:11px;padding:1px 6px;border-radius:6px;',
  'background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-tokenHint{font-size:11.5px;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-tokenInput{box-sizing:border-box;width:100%;height:30px;padding:0 9px;border-radius:8px;font:inherit;',
  'font-family:ui-monospace,Consolas,monospace;font-size:12px;',
  'border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,0.36));',
  'background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.10));color:var(--dsw-alias-label-primary,#e5e7eb);}',
  '.dshh-tokenInput:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#4b8bf5);}',
  '.dshh-tokenRef{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6b7280);',
  'font-family:ui-monospace,Consolas,monospace;}',
  '.dshh-tokenActions{display:flex;gap:8px;justify-content:flex-end;}',
  '.dshh-tokenSave,.dshh-tokenCancel{height:26px;padding:0 12px;border-radius:7px;font:inherit;font-size:12px;cursor:pointer;}',
  '.dshh-tokenSave{border:1px solid transparent;background:var(--dsw-alias-button-primary-fill,#4b8bf5);',
  'color:var(--dsw-alias-label-primary-foreground,#fff);}',
  '.dshh-tokenSave:disabled{opacity:.45;cursor:default;}',
  '.dshh-tokenCancel{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,0.36));background:transparent;',
  'color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-tokenError{font-size:11.5px;color:var(--dsw-alias-state-error-primary,#f87171);}',
  '.dshh-header{display:flex;align-items:center;gap:8px;padding:6px 8px;flex:none;cursor:move;line-height:1.4;',
  'user-select:none;touch-action:none;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}',
  '.dshh-title{font-size:13px;font-weight:600;flex:none;}',
  '.dshh-branch{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;padding:1px 6px;border-radius:6px;',
  'background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));color:var(--dsw-alias-label-secondary,#8a8f98);',
  'max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.dshh-spacer{flex:1;}',
  // 固定盒模型：⟳/⌖/✕ 这类符号可能落到行高夸张的 fallback 字体上，
  // 不锁死宽高就会把标题栏整个撑高（面板上方出现一片空白）。
  '.dshh-icon{font:inherit;font-size:12px;line-height:1;width:22px;height:22px;padding:0;border-radius:6px;',
  'display:inline-flex;align-items:center;justify-content:center;flex:none;',
  'border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#8a8f98);cursor:pointer;}',
  '.dshh-icon:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));color:var(--dsw-alias-label-primary,#e5e7eb);}',
  '.dshh-body{padding:10px;display:flex;flex-direction:column;gap:8px;overflow:auto;}',
  '.dshh-meta{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;}',
  // 不用 direction:rtl 做左省略号：它会把绝对路径开头的 “/” 重排到末尾。
  '.dshh-repo{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);',
  'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.dshh-kv{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-sectionTitle{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  // 计数芯片之间要留出横向间隔：11.5px 字号的描边胶囊挨在一起时看着是贴住的。
  '.dshh-chips{display:flex;flex-wrap:wrap;gap:6px 12px;}',
  '.dshh-chip{display:inline-flex;align-items:center;font-size:11.5px;padding:1px 8px;border-radius:999px;border:1px solid currentColor;}',
  '.dshh-clean{font-size:11.5px;color:var(--dsw-alias-state-success-primary,#3fb950);}',
  // 会话归因：概览下面那行 + 「只看本会话改的」开关 + 清单行首的标记。
  '.dshh-session{display:flex;align-items:baseline;gap:6px 10px;flex-wrap:wrap;font-size:11px;',
  'color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-sessionText{min-width:0;}',
  '.dshh-sessionToggle{font:inherit;font-size:11px;padding:0 6px;border-radius:999px;white-space:nowrap;',
  'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.35));background:transparent;',
  'color:var(--dsw-alias-label-secondary,#8a8f98);cursor:pointer;}',
  '.dshh-sessionToggle:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));',
  'color:var(--dsw-alias-label-primary,#e5e7eb);}',
  '.dshh-sessionToggle:focus-visible{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:1px;}',
  '.dshh-sessionToggleOn{border-color:var(--dsw-alias-brand-primary,#4b8bf5);',
  'color:var(--dsw-alias-brand-primary,#4b8bf5);}',
  '.dshh-marker{flex:none;width:8px;text-align:center;font-size:9px;line-height:inherit;',
  'color:var(--dsw-alias-brand-primary,#4b8bf5);}',
  '.dshh-markerPossible{color:var(--dsw-alias-state-warn-primary,#d9a63c);opacity:.75;}',
  // 行尾的审阅标记：`○` 未审 / `✓` 这一版已审 / `✓`(黄) 改动已变。
  // `⋯` 菜单里那条只读摘要：像一条说明，不像一个可点的菜单项。
  '.dshh-menureadout{display:flex;flex-direction:column;gap:2px;padding:4px 10px 6px;',
  'font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,#8a8f98));',
  'cursor:default;user-select:text;max-width:260px;}',
  '.dshh-menureadoutLine{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
  // 悬停卡片里那块详情：跟着卡片自己的字号，只做行距与弱化。
  '.dshh-rowhover{display:flex;flex-direction:column;gap:2px;font-size:11px;',
  'color:var(--dsw-alias-label-secondary,#8a8f98);min-width:0;}',
  '.dshh-rowhoverLine{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
  // 「已审 x/y」是个可点控件：同样不能用 label-dimmed（反相表面色，1.26:1 / 1.64:1），
  // 平时用次级文字色，悬停才升到正文色。
  '.dshh-review{flex:none;margin-left:auto;padding:0 2px;font-size:10.5px;cursor:pointer;',
  'color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-review:hover{color:var(--dsw-alias-label-primary,#e5e7eb);}',
  '.dshh-reviewOn{color:var(--dsw-alias-state-success-primary,#3fb950);}',
  '.dshh-reviewStale{color:var(--dsw-alias-state-warn-primary,#d9a63c);}',
  '.dshh-ctag{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
  'font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-state-warn-primary,#d9a63c);}',
  // 行首的 `○`（与本会话无关）：要"最不显眼"，但同样得看得见 —— 与上面同一个理由。
  '.dshh-markerOther{color:var(--dsw-alias-label-secondary,#8a8f98);}',
  // 工具活动胶囊：与 Git 胶囊同形，但它是只读读数，指针不该是“可点”。
  // 与 codex-hud 对齐的几支色（它的默认配色表：git=magenta、gitBranch=cyan、project=yellow）：
  // 产品没有青/品红的语义变量（只有 button-info-*，那是按钮用的），所以这两支写死值，
  // 但都走变量、可被覆盖。
  '.dshh-workspace{color:var(--dsw-alias-state-warn-primary,#d9a63c);flex:none;}',
  '.dshh-gitWrap{color:var(--dsh-hud-magenta,#d946ef);flex:none;}',
  '.dshh-branch{color:var(--dsh-hud-cyan,#22d3ee);flex:none;}',
  '.dshh-ahead{color:var(--dsh-hud-cyan,#22d3ee);flex:none;}',
  '.dshh-workspaceSep{color:var(--dsw-alias-label-tertiary,rgba(138,143,152,0.6));flex:none;}',
  '.dshh-toolsPill{cursor:default;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  // 配色对齐 codex-hud 的 activity-lines：只有状态符上色，名字/次数/分隔符都用正文色。
  '.dshh-toolsGlyph{flex:none;}',
  '.dshh-toolsGlyphOk{color:var(--dsw-alias-state-success-primary,#3fb950);}',
  '.dshh-toolsGlyphRun{color:var(--dsw-alias-state-warn-primary,#d9a63c);}',
  '.dshh-toolsGlyphBad{color:var(--dsw-alias-state-error-primary,#f06a6a);}',
  // 唯一一处写死的颜色：codex-hud 把"正在跑的工具名"画成青色，产品没有对应的语义变量
  // （只有 button-info-*，那是按钮用的）。留 `--dsh-hud-tool-name` 作为覆盖钩子。
  '.dshh-toolsName{color:var(--dsh-hud-cyan,#22d3ee);}',
  // 技能名与工具名同色系但不同支：工具那支是青，技能走品牌色（一眼能分开）。
  '.dshh-skillName{color:var(--dsw-alias-brand-primary,#4b8bf5);}',
  '.dshh-section{display:flex;flex-direction:column;gap:4px;}',
  '.dshh-list{display:flex;flex-direction:column;gap:1px;max-height:30vh;overflow:auto;',
  'border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.16));padding-top:4px;}',
  // 改动行是按钮（点击看差异），所以要把浏览器的按钮默认样式清掉。
  '.dshh-row{display:flex;align-items:baseline;gap:8px;padding:2px 3px;border-radius:4px;',
  'font:inherit;text-align:left;width:100%;box-sizing:border-box;color:inherit;background:transparent;',
  'border:1px solid transparent;cursor:pointer;}',
  '.dshh-row:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));}',
  '.dshh-row:focus-visible{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:-1px;}',
  '.dshh-status{flex:none;width:10px;text-align:center;font-family:ui-monospace,Consolas,monospace;font-weight:600;}',
  '.dshh-path{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  // 和改动清单一样：标题下面一条分隔线（最近提交是最后一段，用它把两段分开）。
  '.dshh-commits{display:flex;flex-direction:column;gap:1px;',
  'border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.16));padding-top:4px;}',
  // 提交行是按钮（点击看这次提交改了什么），因此要清掉浏览器默认的按钮样式。
  '.dshh-commit{display:flex;align-items:baseline;gap:8px;padding:1px 2px;border-radius:4px;font-size:11.5px;',
  'font:inherit;font-size:11.5px;text-align:left;width:100%;box-sizing:border-box;color:inherit;background:transparent;',
  'border:1px solid transparent;cursor:pointer;}',
  '.dshh-commit:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));}',
  '.dshh-commit:focus-visible{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:-1px;}',
  // 打开着的那条提交（明细在右栏，左栏只高亮它）。
  '.dshh-commitActive{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.22));',
  'box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary,#4b8bf5);}',
  // 中间那一栏（提交明细，默认 240px）：元信息头 + 这次提交的改动清单。
  // 与左栏同形：各自 border-right 分隔，内部自己滚。
  // 注意 flex 是 `0 1 auto` 而不是 `none`：窗口太窄时由它和差异栏一起被压缩，
  // 而不是把左栏挤出去（左栏是主面板，保持固定 380px）。
  '.dshh-commitpane{flex:0 1 auto;box-sizing:border-box;display:flex;flex-direction:column;',
  'min-width:0;min-height:0;overflow:hidden;border-right:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}',
  '.dshh-commitHead{flex:none;display:flex;flex-direction:column;gap:2px;padding:6px 8px;',
  'border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}',
  '.dshh-commitTitle{display:flex;align-items:baseline;gap:6px;min-width:0;}',
  '.dshh-commitSubject{font-size:12.5px;line-height:1.5;color:var(--dsw-alias-label-primary,#e5e7eb);',
  'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.dshh-commitMeta{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);',
  'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  // 清单吃掉这一栏剩下的高度（标题跟着一起滚，栏本身不滚动）。
  '.dshh-commitFiles{flex:1 1 auto;min-height:0;overflow:auto;padding:6px 8px 8px;}',
  '.dshh-commitFiles .dshh-list{max-height:none;}',
  '.dshh-csha{flex:none;font-family:ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-csubject{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.dshh-chead{flex:none;font-size:10px;line-height:1.4;padding:0 4px;border-radius:4px;',
  'color:var(--dsw-alias-brand-primary,#4b8bf5);border:1px solid currentColor;}',
  '.dshh-cwhen{flex:none;font-size:10.5px;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-note{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-empty{padding:14px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  // ---- 图片预览（二进制改动） ----
  '.dshh-imgWrap{flex:1 1 auto;min-height:0;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px;}',
  '.dshh-imgMeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;',
  'color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-imgDims{color:var(--dsw-alias-state-warn-primary,#d9a63c);}',
  '.dshh-imgBytes{font-family:ui-monospace,Consolas,monospace;}',
  '.dshh-imgPair{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;}',
  '.dshh-imgPairSingle{flex-wrap:nowrap;}',
  // 固定档位（非"适应宽度"）时：图片按固有像素算宽度，容器随内容撑开，外层横向滚动。
  '.dshh-imgPairZoomed{flex-wrap:nowrap;width:max-content;align-items:flex-start;}',
  '.dshh-imgPairZoomed .dshh-imgCell{flex:0 0 auto;}',
  '.dshh-imgPairZoomed .dshh-img{max-height:none;}',
  '.dshh-imgZoom{display:inline-flex;align-items:center;gap:2px;margin-left:auto;}',
  '.dshh-imgZoomBtn{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.25));',
  'background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;cursor:pointer;font:inherit;',
  'min-width:22px;height:20px;padding:0 6px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;}',
  '.dshh-imgZoomBtn:hover{color:var(--dsw-alias-label-primary,#e5e7eb);',
  'border-color:var(--dsw-alias-border-l2,rgba(127,127,127,0.45));}',
  '.dshh-imgZoomValue{min-width:74px;font-variant-numeric:tabular-nums;}',
  '.dshh-imgCell{flex:1 1 150px;min-width:0;display:flex;flex-direction:column;gap:4px;}',
  '.dshh-imgLabel{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-imgNote{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);padding:6px 0;}',
  // 透明像素要有底色才看得出边界：棋盘格由四段半透明渐变拼出来，两种主题都不用另配颜色。
  '.dshh-img{max-width:100%;max-height:420px;object-fit:contain;border-radius:6px;',
  'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.28));',
  'background-image:linear-gradient(45deg,rgba(127,127,127,0.12) 25%,transparent 25%),',
  'linear-gradient(-45deg,rgba(127,127,127,0.12) 25%,transparent 25%),',
  'linear-gradient(45deg,transparent 75%,rgba(127,127,127,0.12) 75%),',
  'linear-gradient(-45deg,transparent 75%,rgba(127,127,127,0.12) 75%);',
  'background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;}',
  // ---- 轮尾「本轮图片改动」条 ----
  '.dshh-imgstrip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;',
  'color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-imgstripTitle{flex:none;}',
  '.dshh-imgstripItems{display:flex;gap:6px;flex-wrap:wrap;}',
  '.dshh-imgstripItem{display:inline-flex;align-items:center;gap:2px;padding:2px 4px 2px 2px;',
  'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.25));border-radius:8px;',
  'background:var(--dsw-alias-bg-layer-1,transparent);}',
  '.dshh-imgstripOpen{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;',
  'color:inherit;cursor:pointer;padding:0;font:inherit;}',
  '.dshh-imgstripOpen:hover{color:var(--dsw-alias-label-primary,#e5e7eb);}',
  '.dshh-imgstripThumb{width:28px;height:28px;object-fit:cover;border-radius:5px;display:block;',
  'background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));}',
  '.dshh-imgstripThumbEmpty{align-items:center;justify-content:center;font-size:8px;letter-spacing:0.02em;',
  'display:flex;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-imgstripName{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.dshh-imgstripTier{flex:none;opacity:.7;}',
  '.dshh-imgstripCompare{border:0;background:transparent;color:inherit;cursor:pointer;padding:0 2px;',
  'font:inherit;opacity:.7;}',
  '.dshh-imgstripCompare:hover{opacity:1;color:var(--dsw-alias-brand-primary,#4b8bf5);}',
  '.dshh-imgstripMore{flex:none;}',
  '.dshh-footer{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;flex:none;',
  'border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));',
  'font-size:10.5px;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  // ---- 差异视图 ----
  '.dshh-workbench{display:flex;flex:1 1 auto;min-height:0;align-items:stretch;}',
  '.dshh-leftpane{flex:none;box-sizing:border-box;display:flex;flex-direction:column;min-height:0;overflow:hidden;',
  'border-right:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}',
  '.dshh-leftpane .dshh-list{max-height:none;}',
  '.dshh-rowActive{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.2));}',
  // 键盘选中的那行：选过还没打开时只它一个亮着，所以用描边而不是底色，
  // 与 .dshh-rowActive（正在看的那份差异）区分得开。
  '.dshh-rowCursor{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:-1px;}',
  // hunk 头可点（折叠 / 展开），并显示"当前 hunk"——键盘 n/p 与 Space 作用在它身上。
  '.dshh-difrow-hunk{cursor:pointer;user-select:none;}',
  '.dshh-difrow-hunk:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.22));}',
  '.dshh-difrow-hunkActive{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.2));',
  'box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary,#4b8bf5);}',
  '.dshh-hunkMark{text-align:right;}',
  '.dshh-grip{position:absolute;top:0;right:0;bottom:0;width:6px;cursor:col-resize;z-index:5;}',
  // 栏间那条抓握**必须占宽**：它是提交栏与差异栏之间的真实一格。绝对定位会让它贴到面板右边缘，
  // 与外面那条叠在一起（面板右边缘那条不占宽，靠宽度公式里预留的 6px 让位）。
  '.dshh-gripBetween{position:static;flex:none;width:6px;}',
  '.dshh-grip:hover{background:var(--dsw-alias-border-l2,rgba(127,127,127,0.35));}',
  '.dshh-diffview{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;}',
  '.dshh-toolbar{display:flex;align-items:center;gap:4px;padding:5px 8px;flex:none;overflow:hidden;',
  'border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}',
  '.dshh-difpath{font-family:ui-monospace,Consolas,monospace;font-size:11px;',
  'color:var(--dsw-alias-label-secondary,#8a8f98);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:38%;}',
  '.dshh-difcounts{display:inline-flex;gap:6px;flex:none;font-family:ui-monospace,Consolas,monospace;font-size:11px;}',
  '.dshh-tab{font:inherit;font-size:11.5px;padding:2px 7px;border-radius:6px;flex:none;cursor:pointer;',
  'border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-tab:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));color:var(--dsw-alias-label-primary,#e5e7eb);}',
  '.dshh-tabActive{color:var(--dsw-alias-label-primary,#e5e7eb);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.18));}',
  '.dshh-diff{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 0 8px;',
  'font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.5;}',
  '.dshh-difrow{display:flex;align-items:flex-start;white-space:pre;}',
  '.dshh-difrow-hunk{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));',
  'color:var(--dsw-alias-label-secondary,#8a8f98);}',
  '.dshh-difrow-meta{color:var(--dsw-alias-label-secondary,#8a8f98);opacity:.85;}',
  '.dshh-difno{flex:none;width:46px;text-align:right;padding-right:8px;user-select:none;',
  'color:var(--dsw-alias-label-secondary,#8a8f98);font-variant-numeric:tabular-nums;}',
  '.dshh-diftext{flex:1 1 auto;min-width:0;white-space:pre;overflow:hidden;text-overflow:ellipsis;}',
  '.dshh-diftext.dshh-wrap{white-space:pre-wrap;word-break:break-word;overflow:visible;text-overflow:clip;}',
].join('')
