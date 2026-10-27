window.__ModuleLoader__.load({
  id: "@konnga/dsh-hud",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let react = require("react");
react = __toESM(react, 1);

//#region src/client/styles.ts
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
const CSS = [
	".dshh-dock{box-sizing:border-box;display:flex;align-items:center;gap:6px;justify-content:flex-start;",
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
	".dshh-timer{cursor:default;gap:5px;}",
	".dshh-tip{position:fixed;z-index:60;box-sizing:border-box;max-width:420px;padding:6px 10px;border-radius:8px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2,#2c2c2e));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.25));box-shadow:0 6px 20px rgba(0,0,0,0.28);color:var(--dsw-alias-label-primary,#f9fafb);font-size:11.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;pointer-events:none;}",
	".dshh-tipLine{display:block;}",
	".dshh-tipSeg{white-space:pre-wrap;}",
	".dshh-tipAccent,.dshh-tipSuccess,.dshh-tipWarn,.dshh-tipValue{font-variant-numeric:tabular-nums;}",
	".dshh-tipLabel{color:var(--dsw-alias-label-secondary,#9aa0a6);}",
	".dshh-tipValue{color:var(--dsw-alias-label-primary,#f9fafb);margin-left:2px;}",
	".dshh-tipSuccess{color:var(--dsw-alias-state-success-primary,#22c55e);}",
	".dshh-tipWarn{color:var(--dsw-alias-state-warn-primary,#f59e0b);}",
	".dshh-tipAccent{color:var(--dsw-alias-state-business-primary,#7aaaff);}",
	".dshh-tipMuted{color:var(--dsw-alias-label-tertiary,#6b7280);}",
	".dshh-timerGlyph{flex:none;opacity:.85;}",
	".dshh-timerValue{font-variant-numeric:tabular-nums;}",
	".dshh-balance{cursor:pointer;gap:2px;font-variant-numeric:tabular-nums;}",
	".dshh-balanceValue{letter-spacing:.2px;}",
	".dshh-balanceBonus{opacity:.75;margin-left:1px;}",
	".dshh-balanceStale{color:var(--dsw-alias-state-warning-primary,#d7a14a);margin-left:2px;}",
	".dshh-balanceWarn{flex:none;color:var(--dsw-alias-state-warning-primary,#d7a14a);margin-right:2px;}",
	".dshh-balanceLow{color:var(--dsw-alias-state-warning-primary,#d7a14a);}",
	".dshh-balanceUsed{flex:none;opacity:.65;margin-right:1px;}",
	".dshh-balanceUnknown{opacity:.7;}",
	".dshh-balanceProvider{flex:none;margin-right:3px;opacity:.8;}",
	".dshh-panel{color:var(--dsw-alias-label-primary,#e5e7eb);font-size:12.5px;line-height:1.6;}",
	".dshh-tokenPanel{position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:2147483000;",
	"width:min(420px,calc(100vw - 32px));box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:12px 14px;",
	"border-radius:12px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,0.28));",
	"background:var(--dsw-alias-bg-layer-1,#1c1d21);color:var(--dsw-alias-label-primary,#e5e7eb);",
	"box-shadow:0 12px 32px rgba(0,0,0,0.32);font-size:12.5px;line-height:1.55;}",
	".dshh-tokenHead{display:flex;align-items:baseline;gap:6px;}",
	".dshh-tokenTitle{font-size:13px;font-weight:600;}",
	".dshh-tokenProvider{font-family:ui-monospace,Consolas,monospace;font-size:11px;padding:1px 6px;border-radius:6px;",
	"background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-tokenHint{font-size:11.5px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-tokenInput{box-sizing:border-box;width:100%;height:30px;padding:0 9px;border-radius:8px;font:inherit;",
	"font-family:ui-monospace,Consolas,monospace;font-size:12px;",
	"border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,0.36));",
	"background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.10));color:var(--dsw-alias-label-primary,#e5e7eb);}",
	".dshh-tokenInput:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#4b8bf5);}",
	".dshh-tokenRef{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6b7280);",
	"font-family:ui-monospace,Consolas,monospace;}",
	".dshh-tokenActions{display:flex;gap:8px;justify-content:flex-end;}",
	".dshh-tokenSave,.dshh-tokenCancel{height:26px;padding:0 12px;border-radius:7px;font:inherit;font-size:12px;cursor:pointer;}",
	".dshh-tokenSave{border:1px solid transparent;background:var(--dsw-alias-button-primary-fill,#4b8bf5);",
	"color:var(--dsw-alias-label-primary-foreground,#fff);}",
	".dshh-tokenSave:disabled{opacity:.45;cursor:default;}",
	".dshh-tokenCancel{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,0.36));background:transparent;",
	"color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-tokenError{font-size:11.5px;color:var(--dsw-alias-state-error-primary,#f87171);}",
	".dshh-header{display:flex;align-items:center;gap:8px;padding:6px 8px;flex:none;cursor:move;line-height:1.4;",
	"user-select:none;touch-action:none;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
	".dshh-title{font-size:13px;font-weight:600;flex:none;}",
	".dshh-branch{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;padding:1px 6px;border-radius:6px;",
	"background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));color:var(--dsw-alias-label-secondary,#8a8f98);",
	"max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
	".dshh-spacer{flex:1;}",
	".dshh-icon{font:inherit;font-size:12px;line-height:1;width:22px;height:22px;padding:0;border-radius:6px;",
	"display:inline-flex;align-items:center;justify-content:center;flex:none;",
	"border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#8a8f98);cursor:pointer;}",
	".dshh-icon:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));color:var(--dsw-alias-label-primary,#e5e7eb);}",
	".dshh-body{padding:10px;display:flex;flex-direction:column;gap:8px;overflow:auto;}",
	".dshh-meta{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;}",
	".dshh-repo{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);",
	"max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
	".dshh-kv{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-sectionTitle{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-chips{display:flex;flex-wrap:wrap;gap:6px 12px;}",
	".dshh-chip{display:inline-flex;align-items:center;font-size:11.5px;padding:1px 8px;border-radius:999px;border:1px solid currentColor;}",
	".dshh-clean{font-size:11.5px;color:var(--dsw-alias-state-success-primary,#3fb950);}",
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
	".dshh-menureadout{display:flex;flex-direction:column;gap:2px;padding:4px 10px 6px;",
	"font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,#8a8f98));",
	"cursor:default;user-select:text;max-width:260px;}",
	".dshh-menureadoutLine{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
	".dshh-rowhover{display:flex;flex-direction:column;gap:2px;font-size:11px;",
	"color:var(--dsw-alias-label-secondary,#8a8f98);min-width:0;}",
	".dshh-rowhoverLine{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
	".dshh-review{flex:none;margin-left:auto;padding:0 2px;font-size:10.5px;cursor:pointer;",
	"color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-review:hover{color:var(--dsw-alias-label-primary,#e5e7eb);}",
	".dshh-reviewOn{color:var(--dsw-alias-state-success-primary,#3fb950);}",
	".dshh-reviewStale{color:var(--dsw-alias-state-warn-primary,#d9a63c);}",
	".dshh-ctag{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
	"font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-state-warn-primary,#d9a63c);}",
	".dshh-markerOther{color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-workspace{color:var(--dsw-alias-state-warn-primary,#d9a63c);flex:none;}",
	".dshh-gitWrap{color:var(--dsh-hud-magenta,#d946ef);flex:none;}",
	".dshh-branch{color:var(--dsh-hud-cyan,#22d3ee);flex:none;}",
	".dshh-ahead{color:var(--dsh-hud-cyan,#22d3ee);flex:none;}",
	".dshh-workspaceSep{color:var(--dsw-alias-label-tertiary,rgba(138,143,152,0.6));flex:none;}",
	".dshh-toolsPill{cursor:default;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
	".dshh-toolsGlyph{flex:none;}",
	".dshh-toolsGlyphOk{color:var(--dsw-alias-state-success-primary,#3fb950);}",
	".dshh-toolsGlyphRun{color:var(--dsw-alias-state-warn-primary,#d9a63c);}",
	".dshh-toolsGlyphBad{color:var(--dsw-alias-state-error-primary,#f06a6a);}",
	".dshh-toolsName{color:var(--dsh-hud-cyan,#22d3ee);}",
	".dshh-skillName{color:var(--dsw-alias-brand-primary,#4b8bf5);}",
	".dshh-section{display:flex;flex-direction:column;gap:4px;}",
	".dshh-list{display:flex;flex-direction:column;gap:1px;max-height:30vh;overflow:auto;",
	"border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.16));padding-top:4px;}",
	".dshh-row{display:flex;align-items:baseline;gap:8px;padding:2px 3px;border-radius:4px;",
	"font:inherit;text-align:left;width:100%;box-sizing:border-box;color:inherit;background:transparent;",
	"border:1px solid transparent;cursor:pointer;}",
	".dshh-row:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));}",
	".dshh-row:focus-visible{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:-1px;}",
	".dshh-status{flex:none;width:10px;text-align:center;font-family:ui-monospace,Consolas,monospace;font-weight:600;}",
	".dshh-path{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
	".dshh-commits{display:flex;flex-direction:column;gap:1px;",
	"border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.16));padding-top:4px;}",
	".dshh-commit{display:flex;align-items:baseline;gap:8px;padding:1px 2px;border-radius:4px;font-size:11.5px;",
	"font:inherit;font-size:11.5px;text-align:left;width:100%;box-sizing:border-box;color:inherit;background:transparent;",
	"border:1px solid transparent;cursor:pointer;}",
	".dshh-commit:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.16));}",
	".dshh-commit:focus-visible{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:-1px;}",
	".dshh-commitActive{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.22));",
	"box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary,#4b8bf5);}",
	".dshh-commitpane{flex:0 1 auto;box-sizing:border-box;display:flex;flex-direction:column;",
	"min-width:0;min-height:0;overflow:hidden;border-right:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
	".dshh-commitHead{flex:none;display:flex;flex-direction:column;gap:2px;padding:6px 8px;",
	"border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
	".dshh-commitTitle{display:flex;align-items:baseline;gap:6px;min-width:0;}",
	".dshh-commitSubject{font-size:12.5px;line-height:1.5;color:var(--dsw-alias-label-primary,#e5e7eb);",
	"overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
	".dshh-commitMeta{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);",
	"overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
	".dshh-commitFiles{flex:1 1 auto;min-height:0;overflow:auto;padding:6px 8px 8px;}",
	".dshh-commitFiles .dshh-list{max-height:none;}",
	".dshh-csha{flex:none;font-family:ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-csubject{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
	".dshh-chead{flex:none;font-size:10px;line-height:1.4;padding:0 4px;border-radius:4px;",
	"color:var(--dsw-alias-brand-primary,#4b8bf5);border:1px solid currentColor;}",
	".dshh-cwhen{flex:none;font-size:10.5px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-note{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-empty{padding:14px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-imgWrap{flex:1 1 auto;min-height:0;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px;}",
	".dshh-imgMeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;",
	"color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-imgDims{color:var(--dsw-alias-state-warn-primary,#d9a63c);}",
	".dshh-imgBytes{font-family:ui-monospace,Consolas,monospace;}",
	".dshh-imgPair{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;}",
	".dshh-imgPairSingle{flex-wrap:nowrap;}",
	".dshh-imgPairZoomed{flex-wrap:nowrap;width:max-content;align-items:flex-start;}",
	".dshh-imgPairZoomed .dshh-imgCell{flex:0 0 auto;}",
	".dshh-imgPairZoomed .dshh-img{max-height:none;}",
	".dshh-imgZoom{display:inline-flex;align-items:center;gap:2px;margin-left:auto;}",
	".dshh-imgZoomBtn{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.25));",
	"background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;cursor:pointer;font:inherit;",
	"min-width:22px;height:20px;padding:0 6px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;}",
	".dshh-imgZoomBtn:hover{color:var(--dsw-alias-label-primary,#e5e7eb);",
	"border-color:var(--dsw-alias-border-l2,rgba(127,127,127,0.45));}",
	".dshh-imgZoomValue{min-width:74px;font-variant-numeric:tabular-nums;}",
	".dshh-imgCell{flex:1 1 150px;min-width:0;display:flex;flex-direction:column;gap:4px;}",
	".dshh-imgLabel{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-imgNote{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f98);padding:6px 0;}",
	".dshh-img{max-width:100%;max-height:420px;object-fit:contain;border-radius:6px;",
	"border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.28));",
	"background-image:linear-gradient(45deg,rgba(127,127,127,0.12) 25%,transparent 25%),",
	"linear-gradient(-45deg,rgba(127,127,127,0.12) 25%,transparent 25%),",
	"linear-gradient(45deg,transparent 75%,rgba(127,127,127,0.12) 75%),",
	"linear-gradient(-45deg,transparent 75%,rgba(127,127,127,0.12) 75%);",
	"background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0;}",
	".dshh-imgstrip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;",
	"color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-imgstripTitle{flex:none;}",
	".dshh-imgstripItems{display:flex;gap:6px;flex-wrap:wrap;}",
	".dshh-imgstripItem{display:inline-flex;align-items:center;gap:2px;padding:2px 4px 2px 2px;",
	"border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.25));border-radius:8px;",
	"background:var(--dsw-alias-bg-layer-1,transparent);}",
	".dshh-imgstripOpen{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;",
	"color:inherit;cursor:pointer;padding:0;font:inherit;}",
	".dshh-imgstripOpen:hover{color:var(--dsw-alias-label-primary,#e5e7eb);}",
	".dshh-imgstripThumb{width:28px;height:28px;object-fit:cover;border-radius:5px;display:block;",
	"background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.14));}",
	".dshh-imgstripThumbEmpty{align-items:center;justify-content:center;font-size:8px;letter-spacing:0.02em;",
	"display:flex;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-imgstripName{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
	".dshh-imgstripTier{flex:none;opacity:.7;}",
	".dshh-imgstripCompare{border:0;background:transparent;color:inherit;cursor:pointer;padding:0 2px;",
	"font:inherit;opacity:.7;}",
	".dshh-imgstripCompare:hover{opacity:1;color:var(--dsw-alias-brand-primary,#4b8bf5);}",
	".dshh-imgstripMore{flex:none;}",
	".dshh-footer{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;flex:none;",
	"border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));",
	"font-size:10.5px;color:var(--dsw-alias-label-secondary,#8a8f98);}",
	".dshh-workbench{display:flex;flex:1 1 auto;min-height:0;align-items:stretch;}",
	".dshh-leftpane{flex:none;box-sizing:border-box;display:flex;flex-direction:column;min-height:0;overflow:hidden;",
	"border-right:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,0.22));}",
	".dshh-leftpane .dshh-list{max-height:none;}",
	".dshh-rowActive{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.2));}",
	".dshh-rowCursor{outline:1px solid var(--dsw-alias-brand-primary,#4b8bf5);outline-offset:-1px;}",
	".dshh-difrow-hunk{cursor:pointer;user-select:none;}",
	".dshh-difrow-hunk:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.22));}",
	".dshh-difrow-hunkActive{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,0.2));",
	"box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary,#4b8bf5);}",
	".dshh-hunkMark{text-align:right;}",
	".dshh-grip{position:absolute;top:0;right:0;bottom:0;width:6px;cursor:col-resize;z-index:5;}",
	".dshh-gripBetween{position:static;flex:none;width:6px;}",
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
	".dshh-diftext.dshh-wrap{white-space:pre-wrap;word-break:break-word;overflow:visible;text-overflow:clip;}"
].join("");

//#endregion
//#region src/client/shared.ts
/**
* 浏览器半的**内核**：常量、存储助手、诊断探针，以及几个到处都用得着的纯函数。
*
* 它是最底层 —— store 各片、hook、组件都从这里 import，它自己不 import 任何本包模块，
* 于是依赖方向永远是"由外向内"，不会绕成环。
*/
var h = react.default.createElement;
/**
* 一行在"拼平"（日志/断言/兼容 `state.text`）时长的样子。
*
* 标签与数值之间补一个空格：屏幕上它们之间是 CSS 的 `margin-left`，拼平之后没这个
* 间距，`余额$742.23` 读起来是错的，日志里也不好 grep。
*/
function tipLineText(line) {
	if (Array.isArray(line.segments)) return line.segments.map(function(segment) {
		return segment.text;
	}).join("");
	if (typeof line.text === "string") return line.text;
	var label = line.label ?? "";
	var value = line.value ?? "";
	if (label !== "" && value !== "") return label + " " + value;
	return label + value;
}
/**
* 把一句白话按给定的"读数"切成段：命中的部分高亮，其余保持普通文字。
*
* 做法是**字面量匹配**而不是猜数字：调用方知道这句话里哪些是读数
*（`3h 24m`、`1469`、`$742.23`），交给我们按出现顺序切段。
* 不去用 `\d+` 自动扫 —— 那样会把「2026-10-20 12:41」这类时间戳也染上，
* 满屏都是颜色，等于没有重点。
*
* @param text - 整句白话。
* @param readings - 要突出的字面量（按长度从长到短匹配，避免短串先吃长串）。
* @param tone - 用什么颜色。
* @returns 分段数组（没有命中就退化成一段）。
*/
function emphasize(text, readings, tone = "accent") {
	var hits = readings.filter(function(item) {
		return typeof item === "string" && item !== "";
	}).map(function(item) {
		return item;
	}).sort(function(left, right) {
		return right.length - left.length;
	});
	if (hits.length === 0 || text === "") return [{ text }];
	var segments = [];
	var plain = "";
	var index = 0;
	while (index < text.length) {
		var matched = null;
		for (var at = 0; at < hits.length; at += 1) if (text.startsWith(hits[at], index)) {
			matched = hits[at];
			break;
		}
		if (matched === null) {
			plain += text[index];
			index += 1;
			continue;
		}
		if (plain !== "") {
			segments.push({ text: plain });
			plain = "";
		}
		segments.push({
			text: matched,
			tone
		});
		index += matched.length;
	}
	if (plain !== "") segments.push({ text: plain });
	return segments.length === 0 ? [{ text }] : segments;
}
/**
* 把气泡内容归一成「逐行结构 + 拼平文本」。
*
* 两处都用它：真 store 的 tip 片（渲染用 `lines`，`text` 留给日志与断言），
* 以及测试 harness 的假 `showTip`（让老用例继续按字符串断言，不必全部重写）。
*/
function normalizeTipContent(content) {
	var lines = typeof content === "string" ? [{ text: content }] : Array.isArray(content) ? content.filter(function(line) {
		return line !== null && typeof line === "object";
	}) : [];
	return {
		lines,
		text: lines.map(function(line) {
			return tipLineText(line);
		}).join("\n")
	};
}
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
var POLL_MS = 8e3;
/**
* 侧栏行内 chip 的轮询节奏：比面板慢一档。
*
* 那些 chip 是"扫一眼"的信息（哪个会话脏了），不值得跟面板一样频繁；宿主侧还按目录
* 缓存 + 去重，多会话共用一个目录只跑一次 git。
*/
var ROWS_POLL_MS = 3e4;
/**
* 工具活动的节拍。比面板那 8s 密得多：宿主这一端是**内存读**（不碰 git、不跑子进程），
* 密一点才能让"正在跑什么"真的看到；代价用"内容没变就不 set"抵掉。
*/
var TOOLS_POLL_MS = 3e3;
/**
* 账号余额的轮询节拍：**比别的读数都慢**。
*
* 这一枚走的不是本地 git，而是宿主替我们去平台查账（一次真实网络请求），
* 而且余额是按分钟变的，密了纯属浪费。页面隐藏时照例跳过，点击胶囊可强制刷新。
*/
var BALANCE_POLL_MS = 3e5;
/** 同一次请求的 TTL：轮询与点击之间不重复打平台（失败时用更短的间隔重试，见切片）。 */
var BALANCE_TTL_MS = 24e4;
/** 失败后的重问间隔：账目查不到多半是网络/登录态，隔一小会儿再试就够。 */
var BALANCE_RETRY_MS = 3e4;
/** 「当前会话模型来源」余额的轮询节拍：真实请求由 store 的 TTL 兜着，这里只决定问的频率。 */
var PROVIDER_POLL_MS = 3e4;
/**
* 「还没问出来」时的重问间隔。
*
* 重启/刚开会话的那一下，宿主往往还没读到模型选择投影 —— 第一次问会落空。
* 用 30 秒节拍兜的话胶囊要空半分钟（用户报的就是这个）；1 秒问一次，
* 正常情况一两秒内就补上了。真的出错时也不会打风暴：store 的失败退避是
* 1s→2s→4s→…→30s，这里的轮询只是"看一眼"，多半被 TTL 直接挡回。
*/
var PROVIDER_RETRY_TICK_MS = 1e3;
/** 覆盖低余额阈值的 localStorage 键（值是十进制数，比如 `50`）。 */
var BALANCE_LOW_KEY = "dsh-hud.balanceLow";
/** 面板默认宽度与“停靠在输入框上方”的锚点高度。 */
var PANEL_WIDTH = 380;
var VIEWPORT_MARGIN = 8;
/**
* 中间那一栏（打开提交明细时：这次提交的元信息 + 改动清单）的宽度。
* 它夹在左栏与差异栏之间，是固定的——右边缘那个抓握仍只调整差异栏。
*/
var COMMIT_LIST_WIDTH = 240;
/** 提交明细栏的最小宽度（它装的是文件路径，不能太窄；默认 240 只是起点，可拖）。 */
var COMMIT_MIN_WIDTH = 180;
/** diff 模式的面板：更宽，且用固定高度（避免 bottom 锚定下"内容变高就跳位"）。 */
/** 右栏（差异）默认宽度、下限，以及面板右边缘抓握的宽度。 */
var DIFF_DEFAULT_WIDTH = 470;
var DIFF_MIN_WIDTH = 240;
var RESIZE_GRIP_WIDTH = 6;
var DIFF_PANEL_HEIGHT_VH = .72;
/** 改动类型的固定展示顺序，与宿主半的 counts 键一致。 */
var COUNT_ORDER = [
	"modified",
	"added",
	"deleted",
	"renamed",
	"copied",
	"typeChanged",
	"untracked",
	"conflicted"
];
/** 每类改动对应的主题色令牌（都带回退色，暗亮色主题都能看）。 */
var COUNT_COLOR = {
	modified: "var(--dsw-alias-state-warn-primary, #d9a63c)",
	added: "var(--dsw-alias-state-success-primary, #3fb950)",
	deleted: "var(--dsw-alias-state-error-primary, #f06a6a)",
	renamed: "var(--dsh-hud-cyan, #22d3ee)",
	copied: "var(--dsw-alias-brand-primary, #4b8bf5)",
	typeChanged: "var(--dsh-hud-magenta, #d946ef)",
	untracked: "var(--dsw-alias-label-secondary, #8a8f98)",
	conflicted: "var(--dsw-alias-state-error-primary, #f06a6a)"
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
	conflicted: "!"
};
/**
* 差异行的底色：半透明，压在面板表面色之上，因此亮/暗主题都可读
* （文本与行号仍走主题令牌）。
*/
var DIFF_ADD_BG = "rgba(63,185,80,0.12)";
var DIFF_DEL_BG = "rgba(240,106,106,0.13)";
var DIFF_GUTTER_COLOR = "var(--dsw-alias-label-secondary, #8a8f98)";
/**
* 时长格式化：**与 codex-hud 同一套口径**。
*
* 不足一分钟给 `<1m`；然后按 `Xd Yh Zm` 只列非零项（`45m` / `2h 14m` / `3d 2h`）。
* 取的是 floor —— 计时器宁可比真实少一点，也不要"明明刚过 1 分钟就写 2m"。
*/
function formatDuration(ms) {
	var safe = typeof ms === "number" && isFinite(ms) ? Math.max(0, ms) : 0;
	if (safe < 6e4) return "<1m";
	var minutes = Math.floor(safe / 6e4);
	var days = Math.floor(minutes / 1440);
	var hours = Math.floor(minutes % 1440 / 60);
	var rest = minutes % 60;
	var parts = [];
	if (days > 0) parts.push(String(days) + "d");
	if (hours > 0) parts.push(String(hours) + "h");
	if (rest > 0) parts.push(String(rest) + "m");
	return parts.join(" ");
}
/** 固定缩放档位：与内置文档预览的菜单一致（25% / 50% / 100% / 150% / 200%）。 */
var ZOOM_STEPS = [
	.25,
	.5,
	1,
	1.5,
	2
];
/** 落盘/读回的缩放值：只认档位里的数，其他一律当"适应宽度"。 */
function readZoom(ui) {
	return ui && typeof ui.zoom === "number" && ZOOM_STEPS.indexOf(ui.zoom) >= 0 ? ui.zoom : null;
}
/**
* 走一档缩放。
*
* `null`（适应宽度）出发：`＋` 从 100% 开始、`−` 从 50% 开始 —— 和"适应宽度"的直觉一致，
* 不用先经过 25% 才知道按了有反应。
*/
function stepZoom(current, direction) {
	if (current === null || current === void 0) return direction > 0 ? 1 : .5;
	var index = ZOOM_STEPS.indexOf(current);
	if (index < 0) return direction > 0 ? 1 : .5;
	var next = index + (direction > 0 ? 1 : -1);
	if (next < 0 || next >= ZOOM_STEPS.length) return current;
	return ZOOM_STEPS[next];
}
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
	} catch (error) {}
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
	return String(cwd || "") + "\0" + file;
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
		var source = parsed;
		var out = {};
		for (var key in source) {
			var item = source[key];
			if (!Object.prototype.hasOwnProperty.call(source, key) || !item || typeof item !== "object") continue;
			var entry = item;
			if (typeof entry.signature !== "string") continue;
			out[key] = {
				signature: entry.signature,
				at: typeof entry.at === "number" ? entry.at : 0
			};
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
		if (keys.length > 200) {
			keys.sort(function(left, right) {
				return (next[left].at || 0) - (next[right].at || 0);
			});
			var trimmed = {};
			var keep = keys.slice(keys.length - 200);
			for (var index = 0; index < keep.length; index += 1) trimmed[keep[index]] = next[keep[index]];
			next = trimmed;
		}
		window.localStorage.setItem(REVIEWED_KEY, JSON.stringify(next));
		return next;
	} catch (error) {
		return next;
	}
}
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
log: function(reason, detail) {
		var facts = detail === void 0 ? {} : detail;
		var line = reason + " " + JSON.stringify(facts);
		if (seen[line] === true) return;
		seen[line] = true;
		console.warn("[dsh-hud] " + line);
		try {
			var history = window.localStorage.getItem(DEBUG_KEY);
			var parsed = history === null ? [] : JSON.parse(history);
			var list = Array.isArray(parsed) ? parsed : [];
			list.push({
				at: Date.now(),
				line
			});
			window.localStorage.setItem(DEBUG_KEY, JSON.stringify(list.slice(-24)));
		} catch (error) {}
	} };
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
	if (view === null) return changes;
	var mineOf = view.mine;
	var possibleOf = view.possible;
	var rows = changes;
	if (onlySession) rows = rows.filter(function(change) {
		return mineOf[change.file] !== void 0 || possibleOf[change.file] !== void 0;
	});
	var latestTurn = view.latestTurn;
	if (onlyLatest && latestTurn !== null) rows = rows.filter(function(change) {
		var record = mineOf[change.file];
		return record !== void 0 && record.lastTurn === latestTurn;
	});
	return rows;
}
/** 进程内唯一一份探针：两个座位共用，去重也一起算。 */
var probe = createProbe();
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
/**
* 差异视图：两侧页签（宿主半一次把两侧都取回来了，切页签不再发请求）、
* 自动换行、复制差异。全部只读——它只是把 git 的输出画出来。
*/
/** 图片请求的缓存键：把请求的每个字段都带上，免得两侧共用一个键。 */
function imagePairKey(request) {
	return [
		request.cwd || "",
		request.path || "",
		request.origPath || "",
		request.side || "",
		request.sha || ""
	].join("\0");
}
/** 字节数：十进制 KB/MB，和文件管理器里看到的一致。 */
function formatBytes(bytes) {
	if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) return "?";
	if (bytes < 1e3) return String(bytes) + " B";
	if (bytes < 1e6) return (bytes / 1e3).toFixed(1) + " KB";
	return (bytes / 1e3 / 1e3).toFixed(2) + " MB";
}
/** 图片类文件的扩展名。这里只做粗筛 —— 真正"是不是图"由宿主按文件头判断。 */
var IMAGE_FILE_EXTENSIONS = [
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"bmp",
	"ico",
	"avif"
];
/**
* 当前右栏里有哪几栏 —— 样式、夹位置、渲染三处必须用同一份判断，抽出来免得漂移。
*
* @returns `{ diff, commit }`：`diff` = 有工作区/提交差异，`commit` = 打开着提交明细。
*/
function panelLayout(state) {
	return {
		diff: state.diff !== null && typeof state.diff === "object",
		commit: state.commit !== null && typeof state.commit === "object"
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
function panelWidthFor(layout, diffWidth, commitWidth) {
	var hasCommit = layout.commit === true;
	var hasDiff = layout.diff === true;
	if (!hasCommit && !hasDiff) return 380;
	var middle = hasCommit ? Math.max(180, typeof commitWidth === "number" ? commitWidth : 240) : 0;
	var right = hasDiff ? Math.max(240, typeof diffWidth === "number" ? diffWidth : 470) : 0;
	var outerGrip = 6;
	var innerGrip = hasCommit && hasDiff ? 6 : 0;
	var available = window.innerWidth - 2 * 8;
	return Math.min(380 + middle + innerGrip + right + outerGrip, available);
}
/** 把位置夹回视口内，避免拖到屏幕外再也点不到。 */
function clampPos(left, top, width) {
	var panelWidth = typeof width === "number" ? width : 380;
	var maxLeft = Math.max(8, window.innerWidth - panelWidth - 8);
	var maxTop = Math.max(8, window.innerHeight - 48);
	return {
		left: Math.min(Math.max(8, left), maxLeft),
		top: Math.min(Math.max(8, top), maxTop)
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
/**
* 面板当前该有多宽：从 store **现读**（模式切换会改宽度，别用可能过期的渲染闭包）。
*
* 原来它是组件里的 `panelWidthOf(store)`，被"视口夹取"和"拖动"两处用；提成顶层
* 纯函数后两边共用同一份判断。
*/
function panelWidthOf(store) {
	var snapshot = store.getSnapshot();
	return panelWidthFor(panelLayout(snapshot), snapshot.diffWidth, snapshot.commitWidth);
}
/** 自有样式表的稳定 tag id：`data-plugin-css` 用它做幂等插入。 */
var CSS_TAG_ID = "dsh-hud/styles.css";
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
	if (slice === null || slice === void 0) return null;
	var files = slice.files;
	if (files === null || files === void 0) return null;
	var possibleAll = slice.possible === void 0 ? null : slice.possible;
	var changes = state.status && Array.isArray(state.status.changes) ? state.status.changes : [];
	var mine = {};
	var possible = {};
	var gone = [];
	var index;
	var change;
	for (index = 0; index < changes.length; index += 1) {
		change = changes[index];
		if (Object.prototype.hasOwnProperty.call(files, change.file)) mine[change.file] = files[change.file];
	}
	for (index = 0; index < changes.length; index += 1) {
		change = changes[index];
		if (mine[change.file] !== void 0) continue;
		if (possibleAll !== null && Object.prototype.hasOwnProperty.call(possibleAll, change.file)) possible[change.file] = possibleAll[change.file];
	}
	for (var file in files) if (Object.prototype.hasOwnProperty.call(files, file) && mine[file] === void 0) gone.push(file);
	gone.sort();
	var commands = Array.isArray(slice.commands) ? slice.commands : [];
	var turns = state.turns !== void 0 && state.turns !== null && state.turns.available === true ? state.turns : null;
	var latestTurn = turns === null ? null : turns.latest;
	var byTurn = {};
	var latestCount = 0;
	for (var mineFile in mine) {
		if (!Object.prototype.hasOwnProperty.call(mine, mineFile)) continue;
		var turn = typeof mine[mineFile].lastTurn === "number" ? mine[mineFile].lastTurn : null;
		if (turn === null) continue;
		byTurn[turn] = (byTurn[turn] === void 0 ? 0 : byTurn[turn]) + 1;
		if (latestTurn !== null && turn === latestTurn) latestCount += 1;
	}
	return {
		mine,
		possible,
		/** 第几轮 → prompt 预览（来自 `turnOutline` 投影；没有就是空表）。 */
		turnPrompts: turns === null ? {} : turns.prompts,
		latestTurn,
		latestCount,
		byTurn,
		mineCount: Object.keys(mine).length,
		possibleCount: Object.keys(possible).length,
		/** 跑过的命令里"看着会写文件"的条数（含失败的，界面自己再分）。 */
		commandCount: commands.length,
		writingCommands: commands.filter(function(item) {
			return item && item.readOnly !== true;
		}).length,
		commands,
		gone,
		/** 本会话记录过的文件总数（宿主那边的集合大小）。 */
		tracked: Object.keys(files).length,
		since: slice.since === void 0 ? null : slice.since,
		dropped: slice.dropped === void 0 ? 0 : slice.dropped,
		possibleDropped: slice.possibleDropped === void 0 ? 0 : slice.possibleDropped,
		others: changes.length - Object.keys(mine).length
	};
}
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
		if (mark === void 0) continue;
		if (mark.signature === signature) {
			marks[file] = "fresh";
			done += 1;
		} else {
			marks[file] = "stale";
			staleCount += 1;
		}
	}
	return {
		marks,
		known,
		done,
		total,
		staleCount
	};
}

//#endregion
//#region src/client/format.ts
/** 从中间省略：保留头尾（路径/分支名两头的区分度都比中间高）。 */
function middleEllipsis(name, max) {
	if (name.length <= max) return name;
	var head = Math.ceil((max - 1) / 2);
	var tail = max - 1 - head;
	return name.slice(0, head) + "…" + name.slice(name.length - tail);
}
/**
* 工作区名 = 会话 cwd 的目录名（侧栏给工作区起的名字就是它）。
*
* 取的是 **cwd** 而不是仓库顶层：会话开在子目录时，用户认的是那个子目录；
* 完整路径在悬停与面板里，胶囊上只要一个能认出来的短名字。
*/
function workspaceNameOf(cwd) {
	if (typeof cwd !== "string" || cwd.length === 0) return null;
	var trimmed = cwd.replace(/[/\\]+$/, "");
	if (trimmed.length === 0) return null;
	var index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	var name = index === -1 ? trimmed : trimmed.slice(index + 1);
	if (name.length === 0) return null;
	return middleEllipsis(name, 20);
}
/** 分支名过长时中段省略，保留头尾信息量。 */
function shortBranch(name) {
	return middleEllipsis(name, 28);
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
		out.push({
			key,
			mark: COUNT_MARK[key],
			value
		});
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
	var pad = function(value) {
		return value < 10 ? "0" + String(value) : String(value);
	};
	return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
}
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
	if (row === void 0 || row === null || row.pending === true) return null;
	var mineCount = typeof row.mine === "number" ? row.mine : 0;
	var possibleCount = typeof row.possible === "number" ? row.possible : 0;
	var shorthands = row.repo === true ? countShorthands(row.counts) : [];
	var changed = 0;
	for (var index = 0; index < shorthands.length; index += 1) changed += shorthands[index].value;
	return {
		row,
		mine: mineCount,
		possibleNow: typeof row.possibleNow === "number" ? row.possibleNow : 0,
		possible: possibleCount,
		shorthands,
		changed,
		dirty: row.repo === true && row.dirty === true,
		hasContent: changed > 0 || mineCount > 0 || possibleCount > 0 || row.error !== null
	};
}
/** 相对时间；超过 30 天直接给提交自己的日期。 */
function commitWhen(commit, t) {
	if (typeof commit.committedAt !== "number") return commit.date || "";
	return fullWhen(commit.committedAt);
}
/**
* 时刻一律给完整年月日 + 时分（本地时区）：`2026-10-16 14:18`。
*
* 两级简化都被否掉了：先是从"2 小时前"改成具体时间（相对时间在对账场景不够用），
* 再是"今天只给 `14:18`"也被否 —— 用户要**年月日都在**。所以不再分档，一视同仁。
* 只到分钟：提交/标签不需要秒，列一排在面板里也塞得下。
*/
function fullWhen(at) {
	var then = new Date(at);
	return String(then.getFullYear()) + "-" + pad2(then.getMonth() + 1) + "-" + pad2(then.getDate()) + " " + pad2(then.getHours()) + ":" + pad2(then.getMinutes());
}
function pad2(value) {
	return value < 10 ? "0" + String(value) : String(value);
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
	if (code === "unknown-commit") return t("commit.unknown");
	if (code === "unknown-endpoint") return t("err.stale-host");
	return t("err.git-failed");
}
/**
* 这个金额真的大于 0 吗（不引 big.js：只看字符串里有没有非零数字、且不是负数）。
*
* 平台会给 0 余额的钱包（赠送额度用完了也还在列里），DSH 自己的账号卡片就是
* 这么过滤的（`new Big(wallet.balance).gt(0)`）—— 两边判定要一致，否则会出现
* "这里有 ¥0.00 的赠送余额"这种没人想看的一行。
*
* @param amount - 平台给的十进制字符串。
* @returns 严格大于 0 为 `true`。
*/
function isPositiveAmount(amount) {
	if (typeof amount !== "string") return false;
	var raw = amount.trim();
	if (raw.charAt(0) === "-") return false;
	return /[1-9]/.test(raw);
}
/** 币种 → 符号。认不出的币种原样接在后面（`123.45 XYZ`），不猜符号。 */
function currencySymbol(currency) {
	if (currency === "CNY") return "¥";
	if (currency === "USD") return "$";
	return null;
}
/**
* 十进制字符串 → 千分位整数部分，**不经过浮点**。
*
* 余额是账目数字：`Number('1234567.89')` 在极大值上会丢精度，所以整数部分只做字符串分组，
* 小数部分原样保留。符号与小数位由调用方决定（两者在本插件里是两条独立规则）。
*/
function groupDigits(integer) {
	var negative = integer.charAt(0) === "-";
	var digits = negative ? integer.slice(1) : integer;
	var out = "";
	for (var index = 0; index < digits.length; index += 1) {
		var rest = digits.length - index;
		out += digits.charAt(index);
		if (rest > 1 && rest % 3 === 1) out += ",";
	}
	return negative ? "-" + out : out;
}
/**
* 把十进制字符串拆成符号 / 整数 / 小数三块。
*
* 允许的写法与平台一致：`123`、`123.45`、`.5`、`5.`、科学计数法。
* 不接受空串、`+` 号以外的其它前缀、以及 `1,234`（千分位是我们**输出**的形状，不是输入）。
*
* @param amount - 十进制字符串。
* @returns 分解结果；非法输入回 `null`。
*/
function parseAmount(amount) {
	if (typeof amount !== "string") return null;
	var raw = amount.trim();
	if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return null;
	var negative = raw.charAt(0) === "-";
	var body = negative ? raw.slice(1) : raw;
	if (/[eE]/.test(body)) {
		var expanded = Number(raw);
		if (!Number.isFinite(expanded)) return null;
		negative = expanded < 0;
		body = String(Math.abs(expanded));
	}
	var dot = body.indexOf(".");
	var integerPart = dot === -1 ? body : body.slice(0, dot);
	var fractionPart = dot === -1 ? "" : body.slice(dot + 1);
	if (integerPart.length === 0) integerPart = "0";
	integerPart = integerPart.replace(/^0+(?=\d)/, "");
	if (fractionPart.length === 0) fractionPart = "0";
	return {
		negative,
		integer: integerPart,
		fraction: fractionPart
	};
}
/** 参与加减的最大小数位（Decimal 的 8 位对账目足够，再长也没人会看）。 */
var AMOUNT_SCALE_MAX = 8;
/**
* 把两个金额对齐到同一标度，转成 BigInt（值为 `真实值 × 10^scale`）。
*
* @param left - 第一个十进制字符串。
* @param right - 第二个十进制字符串。
* @returns 两个 BigInt 与它们共用的标度；任一非法回 `null`。
*/
function scaledPair(left, right) {
	var a = parseAmount(left);
	var b = parseAmount(right);
	if (a === null || b === null) return null;
	var scale = Math.min(AMOUNT_SCALE_MAX, Math.max(a.fraction.length, b.fraction.length));
	var toScaled = function(value) {
		var digits = (value.fraction + "0".repeat(scale)).slice(0, scale);
		var magnitude = BigInt(value.integer + digits);
		return value.negative ? -magnitude : magnitude;
	};
	return {
		left: toScaled(a),
		right: toScaled(b),
		scale
	};
}
/** 标度整数 → 十进制字符串（`-30` + scale 2 → `-0.30`）。 */
function formatScaled(value, scale) {
	var negative = value < BigInt(0);
	var digits = (negative ? -value : value).toString();
	if (scale === 0) return (negative ? "-" : "") + digits;
	var padded = digits.padStart(scale + 1, "0");
	var head = padded.slice(0, padded.length - scale);
	var tail = padded.slice(padded.length - scale);
	return (negative ? "-" : "") + head + "." + tail;
}
/**
* 两个金额相减（`left - right`），精确到小数末位。
*
* 为什么不用 `Number`：余额是账目数字，`8.6 - 8.3` 在 double 里是 `0.2999999999999998`，
* 两次刷新差一分钱就能看出误差。这里按十进制对齐后做整数减法，结果直接可用于展示。
*
* @param left - 被减数（十进制字符串）。
* @param right - 减数。
* @returns 差值（十进制字符串，可能带 `-`，小数位到 max(两侧位数)）；任一非法回 `null`。
*/
function subtractAmounts(left, right) {
	var pair = scaledPair(left, right);
	if (pair === null) return null;
	return formatScaled(pair.left - pair.right, pair.scale);
}
/**
* `amount` 是否严格小于 `limit`（同样走十进制对齐，不走浮点）。
*
* @param amount - 待比较的金额。
* @param limit - 阈值（十进制字符串）。
* @returns 严格小于为 `true`；任一非法回 `false`（拿不准就不报警）。
*/
function isBelowAmount(amount, limit) {
	var pair = scaledPair(amount, limit);
	if (pair === null) return false;
	return pair.left < pair.right;
}
/**
* 读取低余额阈值（`dsh-hud.balanceLow`，没有就用默认 10）。
*
* 键值是十进制数；解析不出正数就退回默认值 —— 一个写坏了的存储项不该让提醒消失。
*
* @param fallback - 默认阈值（`BALANCE_LOW_DEFAULT`）。
* @returns 阈值字符串（交给 `isBelowAmount`）。
*/
function lowThresholdOf(fallback) {
	try {
		var raw = globalThis.localStorage ? globalThis.localStorage.getItem(BALANCE_LOW_KEY) : null;
		if (typeof raw === "string" && raw.trim() !== "") {
			var value = Number(raw.trim());
			if (Number.isFinite(value) && value > 0) return String(value);
		}
	} catch (error) {}
	return String(fallback);
}
/**
* 变化量的展示文本：`+¥0.30` / `-¥0.30`（零值回 `null`，调用方据此不画那一行）。
*
* @param amount - `subtractAmounts` 的输出。
* @param currency - 币种。
* @returns 带正负号的文本；零值或金额非法回 `null`。
*/
function formatDelta(amount, currency) {
	var parsed = parseAmount(amount);
	if (parsed === null) return null;
	var abs = parsed.negative ? amount.slice(1) : amount;
	var text = formatBalance(abs, currency);
	if (text === null) return null;
	if (/^0*(\.0*)?$/.test(abs.trim())) return null;
	return (parsed.negative ? "-" : "+") + text;
}
/**
* 把一个钱包余额格式化成界面文本。
*
* 规则照 DSH 自己的账号卡片（`formatBalance`，`dsh-client-ui-settings-account`）：
* 0 → `¥0.00`；不足一分 → `<¥0.01`；负的小额进位成 `-¥0.01`；其余**向零截断**到两位并加千分位。
* 两边读同一份余额就该显示同一个数，所以这里刻意复刻而不是"差不多"。
*
* 认不出的币种没有符号可用：直接给 `123.45 XYZ` 这样带代码的文本，不做符号猜测。
*
* @param amount - 平台给的十进制字符串（可能带负号；非法输入按 0 处理）。
* @param currency - `CNY` / `USD`，其它值按代码显示。
* @returns 可展示文本；`amount` 非法时回 `null`（宁可不画，也不画错数字）。
*/
function formatBalance(amount, currency) {
	var parsed = parseAmount(amount);
	if (parsed === null) return null;
	var symbol = currencySymbol(currency);
	var suffix = symbol === null ? " " + currency : "";
	var negative = parsed.negative;
	var integerPart = parsed.integer;
	var fractionPart = parsed.fraction;
	var sign = negative ? "-" : "";
	/** 按币种符号规则拼一段文本。 */
	var render = function(value) {
		return symbol === null ? sign + value + suffix : sign + symbol + value;
	};
	var integerIsZero = /^0*$/.test(integerPart);
	var fractionHasDigit = /[1-9]/.test(fractionPart);
	if (integerIsZero && !fractionHasDigit) return render("0.00");
	if (integerIsZero && (fractionPart + "00").slice(0, 2) === "00") {
		if (negative) return render("0.01");
		return "<" + render("0.01");
	}
	var cents = (fractionPart + "00").slice(0, 2);
	return render(groupDigits(integerPart) + "." + cents);
}

//#endregion
//#region src/client/components/balance-pill.ts
/**
* 挑出要摆在胶囊上的那个钱包。
*
* 平台一般只给一个充值钱包；真给了多个，取**第一个**（顺序由平台决定），其余全在
* 悬停里 —— 胶囊上塞两个币种会挤掉它"扫一眼"的价值。
*
* @param state - 快照（只读 `balance`）。
* @returns 主钱包，或 `null`（没有可展示的钱包）。
*/
function primaryWallet(state) {
	var balance = state.balance;
	if (!balance || !Array.isArray(balance.wallets)) return null;
	for (var index = 0; index < balance.wallets.length; index += 1) {
		var wallet = balance.wallets[index];
		if (!wallet || typeof wallet.balance !== "string") continue;
		if (typeof wallet.currency !== "string") continue;
		return wallet;
	}
	return null;
}
/**
* 赠送钱包里**真正有钱**的那些。
*
* 平台会把用完的赠送额度继续挂在 `bonusWallets` 里（余额 `0`），过滤规则与 DSH 自己的
* 账号卡片一致（`isPositiveAmount`，等价于它的 `new Big(…).gt(0)`）—— store 那侧已经过滤
* 过一次，这里再兜一次：组件不该假设上游一定干净。
*
* @param balance - 余额快照。
* @returns 余额大于 0 的赠送钱包。
*/
function visibleBonus(balance) {
	var bonus = Array.isArray(balance.bonus) ? balance.bonus : [];
	var out = [];
	for (var index = 0; index < bonus.length; index += 1) {
		var wallet = bonus[index];
		if (!wallet || typeof wallet.balance !== "string") continue;
		if (!isPositiveAmount(wallet.balance)) continue;
		out.push(wallet);
	}
	return out;
}
/**
* 某个钱包**较上一次成功刷新**变化了多少。
*
* 只在我们自己采样到的两个时刻之间比较（不是平台账单的"今日消耗"）：所以文案写的是
* "较上次刷新"，而不是"今天花了多少"。上一次读数与这次币种对不上、或数值没变，都回
* `null`（那时没有可展示的变化量）。
*
* @param balance - 余额快照（含 `prev`）。
* @param wallet - 当前主钱包。
* @returns `{ delta, at }`；没有变化或没有前一份读数时回 `null`。
*/
function deltaOf(balance, wallet) {
	var prev = balance.prev;
	if (!prev || !Array.isArray(prev.wallets)) return null;
	for (var index = 0; index < prev.wallets.length; index += 1) {
		var older = prev.wallets[index];
		if (!older || older.currency !== wallet.currency) continue;
		if (typeof older.balance !== "string") return null;
		var diff = subtractAmounts(wallet.balance, older.balance);
		if (diff === null) return null;
		var text = formatDelta(diff, wallet.currency);
		if (text === null) return null;
		return {
			delta: text,
			at: prev.at
		};
	}
	return null;
}
/**
* 这个钱包是否低于低余额阈值。
*
* 阈值默认 `BALANCE_LOW_DEFAULT`，可被 `dsh-hud.balanceLow` 覆盖（见 README）。
* 拿不准（金额非法、阈值读坏）时**不报警**：误报比漏报更烦人。
*
* @param wallet - 钱包。
* @returns 严格低于阈值为 `true`。
*/
function isLowWallet(wallet) {
	return isBelowAmount(wallet.balance, lowThresholdOf(10));
}
/**
* 从提供方余额里挑出胶囊该画的那个数。
*
* 顺序是有讲究的：**剩余优先**。中转站把额度写成"无限"占位值时 `remaining` 是 `null`
* （站点自己也不知道剩多少），这时只能画已用 —— 一个能核对的数字，胜过编一个天文数字。
*
* @param balance - 提供方余额快照。
* @returns 主数字；一个能画的都没有时回 `null`（那就不画胶囊）。
*/
function providerFigureOf(balance) {
	if (typeof balance.remaining === "string") return {
		amount: balance.remaining,
		currency: balance.currency,
		kind: "remaining"
	};
	if (typeof balance.usedKey === "string") return {
		amount: balance.usedKey,
		currency: balance.currency,
		kind: "used"
	};
	if (typeof balance.usedAccount === "string") return {
		amount: balance.usedAccount,
		currency: balance.currency,
		kind: "used"
	};
	var wallets = Array.isArray(balance.wallets) ? balance.wallets : [];
	for (var index = 0; index < wallets.length; index += 1) {
		var wallet = wallets[index];
		if (wallet && typeof wallet.balance === "string") return {
			amount: wallet.balance,
			currency: wallet.currency,
			kind: "remaining"
		};
	}
	return null;
}
/**
* 金额文本：币种未知时不要凭空造一个符号。
*
* @param amount - 十进制字符串。
* @param currency - 币种（可能为 `null`）。
* @returns 展示文本；金额非法回 `null`。
*/
function amountText(amount, currency) {
	var text = formatBalance(amount, currency === null ? "" : currency);
	if (text === null) return null;
	return currency === null ? text.trim() : text;
}
/** `amountText` 的"可能没有"版本：不是十进制字符串就回 `null`。 */
function amountTextOf(amount, currency) {
	if (typeof amount !== "string") return null;
	return amountText(amount, currency);
}
/** i18n 模板里用来定位"标签/数值"分界点的哨兵（不可能出现在译文里）。 */
const TIP_SPLIT = "\0";
/**
* 把 `'余额 {amount}'` 这样的模板拆成「标签 + 数值」两段。
*
* 为什么要拆：用户要「数字亮、标签灰」，而一整段文本在 DOM 里只有一个文本节点。
* 做法是把参数换成一个哨兵再渲染，按哨兵位置切开 —— 这样**标签部分始终来自词典**，
* 中英文都自动跟着走，不需要为每种语言另立一个"只有标签"的 key。
*
* @param t - 取词。
* @param key - 词典里那条带 `{param}` 的模板。
* @param param - 模板里的参数名。
* @param value - 已经格式化好的数值文本。
* @returns 逐行结构里的一行。
*/
function labelledLine(t, key, param, value, tone = "primary") {
	var probe = {};
	probe[param] = TIP_SPLIT;
	var rendered = t(key, probe);
	var at = rendered.indexOf(TIP_SPLIT);
	if (at < 0) return { text: t(key, probe) };
	return {
		label: rendered.slice(0, at).trim(),
		value,
		tone
	};
}
/**
* 提供方余额的悬停明细。
*
* 只放读数：提供方 id、余额、账号已用、请求数、本 Key 已用、更新时间。
* 不再解释"为什么没有剩余额度"—— 没有那一行本身就是答案。
*
* @param balance - 提供方余额快照。
* @param t - 取词。
* @returns 逐行结构（标签灰、数字亮）。
*/
function providerBalanceTitle(balance, t) {
	var lines = [{
		text: balance.provider,
		tone: "muted"
	}];
	var figure = providerFigureOf(balance);
	if (figure !== null && figure.kind === "remaining") {
		var remainingText = amountText(figure.amount, figure.currency);
		if (remainingText !== null) lines.push(labelledLine(t, "balance.providerRemaining", "amount", remainingText, "success"));
	}
	var bonus = Array.isArray(balance.bonus) ? balance.bonus : [];
	var parts = [];
	for (var index = 0; index < bonus.length; index += 1) {
		if (!isPositiveAmount(bonus[index].balance)) continue;
		var bonusText = amountText(bonus[index].balance, bonus[index].currency);
		if (bonusText !== null) parts.push(bonusText);
	}
	if (parts.length > 0) lines.push({
		label: t("balance.bonus"),
		value: parts.join(" · "),
		tone: "muted"
	});
	if (typeof balance.requests === "number" && balance.requests > 0) lines.push(labelledLine(t, "balance.providerRequests", "count", balance.requests.toLocaleString("en-US"), "accent"));
	var accountUsed = amountTextOf(balance.usedAccount, balance.currency);
	if (accountUsed !== null) lines.push(labelledLine(t, "balance.providerUsedAccount", "amount", accountUsed, "warn"));
	var keyUsed = amountTextOf(balance.usedKey, balance.currency);
	if (keyUsed !== null) lines.push(labelledLine(t, "balance.providerUsedKey", "amount", keyUsed, "warn"));
	lines.push({
		text: t("balance.updated", { time: fullWhen(balance.at) }),
		tone: "muted"
	});
	return lines;
}
/**
* 点胶囊该干什么。
*
* 分两种情况，因为"点了没反应"是最难查的那种问题：
*   - 这个提供方的**后台凭据还没配**（`token.configured === false`）→ 直接弹设置面板。
*     这才是用户此刻真正要做的事；让他自己去翻配置文件就是把人挡在门外。
*   - 配了（或宿主没告诉我们状态）→ 刷新一次读数（跳过宿主 60 秒缓存）。
*
* @param ledger - 当前账本结论（`token` 在里面）。
* @param store - 共享 store。
*/
function onPillClick(ledger, store) {
	var token = ledger.token;
	if (token !== null && token !== void 0 && token.configured === false) {
		store.openTokenPanel(typeof ledger.provider === "string" && ledger.provider !== "" ? ledger.provider : "", token.ref);
		return;
	}
	store.loadProviderBalance(true);
}
/** 平台用量页地址（没有就回 `null`：更旧的宿主不给这个链接）。 */
function usageUrlOf(balance) {
	var url = balance.usageUrl;
	return typeof url === "string" && url !== "" ? url : null;
}
/**
* 在新标签页打开一个外链。
*
* 为什么要 try/catch：`window.open` 在假 DOM 与某些沙箱里不存在，而"打不开链接"
* 不该把整枚胶囊的点击路径打崩（它是只读读数，不是导航控件）。
*
* @param url - 目标地址。
* @returns 是否成功发起打开。
*/
function openExternal(url) {
	try {
		var opened = globalThis.open;
		if (typeof opened === "function") {
			opened.call(globalThis, url, "_blank");
			return true;
		}
	} catch (error) {}
	return false;
}
/**
* 悬停明细：每个钱包一行、赠送余额、变化量、低余额提醒、更新时间，以及失败时那句"可能已过期"。
*
* 刻意**不写操作说明**（"点一下刷新" / "右键开用量页"）：气泡是读数，不是帮助文档；
* 两句话就把本来五行的明细撑成七行，还挤掉了真正会变的那几个数。
*
* @param balance - 余额快照。
* @param t - 取词。
* @returns 多行文本（气泡按 `pre-wrap` 原样显示）。
*/
function balanceTitle(balance, t) {
	var lines = [{
		text: t("balance.title"),
		tone: "muted"
	}];
	var wallets = Array.isArray(balance.wallets) ? balance.wallets : [];
	for (var index = 0; index < wallets.length; index += 1) {
		var text = formatBalance(wallets[index].balance, wallets[index].currency);
		if (text === null) continue;
		lines.push({
			text: index === 0 ? text : text + " (" + wallets[index].currency + ")",
			tone: "success"
		});
	}
	var bonus = visibleBonus(balance);
	if (bonus.length > 0) {
		var parts = [];
		for (var k = 0; k < bonus.length; k += 1) {
			var bonusText = formatBalance(bonus[k].balance, bonus[k].currency);
			if (bonusText !== null) parts.push(bonusText);
		}
		if (parts.length > 0) lines.push({
			label: t("balance.bonus"),
			value: parts.join(" · "),
			tone: "muted"
		});
	}
	var wallet = primaryWallet({ balance });
	if (wallet !== null) {
		var move = deltaOf(balance, wallet);
		if (move !== null) lines.push({
			text: t("balance.delta", {
				delta: move.delta,
				time: fullWhen(move.at)
			}),
			tone: "muted"
		});
	}
	lines.push({
		text: t("balance.updated", { time: fullWhen(balance.at) }),
		tone: "muted"
	});
	if (balance.failed === true) lines.push({
		text: t("balance.stale", { time: fullWhen(balance.at) }),
		tone: "muted"
	});
	return lines;
}
/**
* 画那枚余额胶囊。
* @param state - store 快照（只读 `balance`）。
* @param options - 取词与 store（悬停接线、刷新都经它）。
* @returns 胶囊节点；没有可展示的余额时 `null`。
*/
function balancePillNode(state, options) {
	var t = options.t;
	var ledger = state.provider;
	if (ledger && ledger.mode === "provider" && ledger.balance !== null) {
		var accountUsage = state.balance && typeof state.balance === "object" ? usageUrlOf(state.balance) : null;
		return providerPillNode(ledger, ledger.balance, accountUsage, options);
	}
	if (ledger && ledger.mode === "unavailable") {
		if (typeof ledger.provider === "string" && ledger.provider !== "") return unknownProviderPillNode(ledger, options);
		return placeholderPillNode(ledger, options);
	}
	if (ledger !== void 0 && ledger !== null && ledger.mode === "unknown") return placeholderPillNode(ledger, options);
	var snapshot = state.balance;
	if (!snapshot || typeof snapshot !== "object") return null;
	const balance = snapshot;
	var wallet = primaryWallet({ balance });
	if (wallet === null) return null;
	var text = formatBalance(wallet.balance, wallet.currency);
	if (text === null) return null;
	var low = isLowWallet(wallet);
	var children = [];
	if (low) children.push(h("span", {
		key: "low",
		className: "dshh-balanceWarn"
	}, "⚠"));
	children.push(h("span", {
		key: "value",
		className: "dshh-balanceValue" + (low ? " dshh-balanceLow" : "")
	}, text));
	if (visibleBonus(balance).length > 0) children.push(h("span", {
		key: "bonus",
		className: "dshh-balanceBonus"
	}, "+"));
	if (balance.failed === true) children.push(h("span", {
		key: "stale",
		className: "dshh-balanceStale"
	}, "?"));
	probe.log("balance-pill", {
		ledger: "account",
		currency: wallet.currency,
		failed: balance.failed === true,
		bonus: Array.isArray(balance.bonus) ? balance.bonus.length : 0,
		low,
		delta: deltaOf(balance, wallet) === null ? null : "yes"
	});
	return h("button", Object.assign({
		type: "button",
		className: "dshh-pill dshh-balance",
		"data-dsh-hud": "balance-pill",
		key: "balance",
		"aria-label": t("balance.title"),
		onClick: function() {
			options.store.loadBalance(true);
		},
		onContextMenu: function(event) {
			var url = usageUrlOf(balance);
			if (url === null) return;
			if (event && typeof event.preventDefault === "function") event.preventDefault();
			if (event && typeof event.stopPropagation === "function") event.stopPropagation();
			openExternal(url);
		}
	}, options.store.tipHandlers("balance-pill", function() {
		return balanceTitle(balance, t);
	})), children);
}
/**
* 画"还没有读数"的占位胶囊：`--`。
*
* 为什么不是干脆不画：不画就分不清"还在查"和"插件没装好"（用户当年正是这么误判的）。
* 为什么不用平台账号的余额顶上：那是**另一个账本**的钱；新会话还不知道要用谁的钱，
* 拿官方账号余额去填，等于报一个和本次会话无关的数。
*
* 点击照样重取一次 —— 用户点它，通常就是"怎么还没出来"。
*
* @param ledger - 当前账本结论（可能是 `null`：连结论都还没有）。
* @param options - 取词与 store。
* @returns 胶囊节点。
*/
function placeholderPillNode(ledger, options) {
	var t = options.t;
	probe.log("balance-pill", {
		ledger: "placeholder",
		reason: ledger?.reason ?? null
	});
	var text = t("balance.providerUnknown");
	return h("button", Object.assign({
		type: "button",
		className: "dshh-pill dshh-balance dshh-balanceUnknown",
		"data-dsh-hud": "balance-pill",
		key: "balance",
		"aria-label": text,
		onClick: function() {
			options.store.loadProviderBalance(true);
		}
	}, options.store.tipHandlers("balance-pill", function() {
		return text;
	})), [h("span", {
		key: "value",
		className: "dshh-balanceValue"
	}, text)]);
}
/**
* 画"知道是哪个提供方、但读不到它的余额"的胶囊：`站名 --`。
*
* 为什么值得画：`—` 是一个**读数**（"这个账本的数读不到"），而空白只是一个疑点。
* 用户看到空白的第一反应是"插件坏了"，于是去翻日志、重装、重启 —— 那才是真正的成本。
*
* @param ledger - 账本结论（含提供方与原因）。
* @param options - 取词与 store。
* @returns 胶囊节点。
*/
function unknownProviderPillNode(ledger, options) {
	var t = options.t;
	var provider = typeof ledger.provider === "string" ? ledger.provider : "?";
	var reason = typeof ledger.reason === "string" && ledger.reason !== "" ? t("balance.reason." + ledger.reason) : "";
	probe.log("balance-pill", {
		ledger: "unavailable",
		provider,
		reason: ledger.reason
	});
	return h("button", Object.assign({
		type: "button",
		className: "dshh-pill dshh-balance dshh-balanceUnknown",
		"data-dsh-hud": "balance-pill",
		key: "balance",
		"aria-label": provider,
		onClick: function() {
			onPillClick(ledger, options.store);
		}
	}, options.store.tipHandlers("balance-pill", function() {
		return reason === "" ? provider : provider + "\n" + reason;
	})), [h("span", {
		key: "provider",
		className: "dshh-balanceProvider"
	}, provider), h("span", {
		key: "value",
		className: "dshh-balanceValue"
	}, t("balance.providerUnknown"))]);
}
/**
* 画"当前提供方"的余额胶囊（中转站 / 官方 API Key）。
*
* 与账号那一路的两处不同：
*   - 没有赠送标记 `+` 那一套区分含义（中转站只报一个数），但官方 Key 带 `bonus`，照旧缀起来；
*   - 只有"已用"可画时（站点把额度写成无限占位值）在数字前加一个词，否则读的人会把它当成余额。
*
* @param balance - 提供方余额快照。
* @param options - 取词与 store。
* @returns 胶囊节点；没有可画的数字时 `null`。
*/
function providerPillNode(ledger, balance, usageUrl, options) {
	var t = options.t;
	var figure = providerFigureOf(balance);
	if (figure === null) return null;
	var text = amountText(figure.amount, figure.currency);
	if (text === null) return null;
	var low = figure.kind === "remaining" && isBelowAmount(figure.amount, lowThresholdOf(10));
	var children = [];
	if (low) children.push(h("span", {
		key: "low",
		className: "dshh-balanceWarn"
	}, "⚠"));
	if (figure.kind === "used") children.push(h("span", {
		key: "label",
		className: "dshh-balanceUsed"
	}, t("balance.usedShort")));
	children.push(h("span", {
		key: "value",
		className: "dshh-balanceValue" + (low ? " dshh-balanceLow" : "")
	}, text));
	if (balance.bonus.length > 0) children.push(h("span", {
		key: "bonus",
		className: "dshh-balanceBonus"
	}, "+"));
	probe.log("balance-pill", {
		ledger: "provider",
		provider: balance.provider,
		kind: balance.kind,
		figure: figure.kind,
		placeholder: balance.placeholderLimit,
		low
	});
	return h("button", Object.assign({
		type: "button",
		className: "dshh-pill dshh-balance",
		"data-dsh-hud": "balance-pill",
		key: "balance",
		"aria-label": balance.provider,
		onClick: function() {
			onPillClick(ledger, options.store);
		},
		onContextMenu: function(event) {
			var url = usageUrl;
			if (url === null) return;
			if (event && typeof event.preventDefault === "function") event.preventDefault();
			if (event && typeof event.stopPropagation === "function") event.stopPropagation();
			openExternal(url);
		}
	}, options.store.tipHandlers("balance-pill", function() {
		return providerBalanceTitle(balance, t);
	})), children);
}

//#endregion
//#region src/client/hooks/use-store.ts
/**
* 订阅共享 store 的经典写法（不依赖种子里的 `useSyncExternalStore` 构建）。
*/
/** 订阅共享 store 的经典写法（不依赖种子里的 useSyncExternalStore 构建）。 */
function useStore(store) {
	var pair = react.default.useState(function() {
		return store.getSnapshot();
	});
	react.default.useEffect(function() {
		return store.subscribe(function() {
			pair[1](store.getSnapshot());
		});
	}, [store]);
	return pair[0];
}

//#endregion
//#region src/client/components/dock-pill.ts
/**
* 输入框上方那一行里的胶囊：分支摘要 / 非 git 仓库，点击开关面板；
* 含两枚工具胶囊、技能清单与悬停气泡的锚点。
*/
function HudDockPill(props) {
	var t = props.t || function(key) {
		return key;
	};
	var sessionId = props.sessionId;
	var useSessions = props.useSessions;
	var store = props.store;
	var sessions = useSessions(function(snapshot) {
		return snapshot;
	});
	var summary = typeof sessionId === "string" && sessions && sessions.byId ? sessions.byId[sessionId] : void 0;
	var cwd = summary ? summary.cwd : void 0;
	var mainView = !summary || !summary.retainedBy ? true : (summary.retainedBy.mainView || 0) > 0;
	var state = useStore(store);
	/**
	* 工具胶囊的"实时秒数"滴答。
	*
	* **必须在组件体里、无条件、固定顺序地调用**：早先放在普通函数 `toolPillNode` 里、还带
	* `if (now === undefined)` 的条件，就是条件钩子 —— React 会抛错，导致整行 dock 渲染失败，
	* 两枚胶囊一起消失（用户实测"胶囊都不显示了"）。回调里再判断要不要开定时器就没这问题。
	*/
	var tick = react.default.useState(Date.now());
	var tickSet = tick[1];
	var toolsTickKey = state.tools && state.tools.active !== null && state.tools.active !== void 0 ? String(state.tools.active.callId) : null;
	react.default.useEffect(function() {
		if (typeof sessionId !== "string") return void 0;
		const id = sessionId;
		var load = function() {
			if (store.loadSessionTime !== void 0) store.loadSessionTime(id);
			if (store.loadPromptHistory !== void 0) store.loadPromptHistory(id);
		};
		if (store.loadProviderBalance !== void 0) store.loadProviderBalance();
		load();
		var poll = window.setInterval(load, 3e3);
		return function() {
			window.clearInterval(poll);
		};
	}, [sessionId]);
	react.default.useEffect(function() {
		var clock = window.setInterval(function() {
			tickSet(Date.now());
		}, 4e3);
		return function() {
			window.clearInterval(clock);
		};
	}, []);
	react.default.useEffect(function() {
		if (toolsTickKey === null) return void 0;
		var timer = window.setInterval(function() {
			tickSet(Date.now());
		}, 500);
		return function() {
			window.clearInterval(timer);
		};
	}, [toolsTickKey]);
	react.default.useEffect(function() {
		if (!mainView) return;
		store.bindSession(sessionId, cwd);
	}, [
		sessionId,
		cwd,
		mainView,
		store
	]);
	if (!cwd || !mainView || state.sessionId !== sessionId) return null;
	var sessionView = sessionChangeView(state);
	var sessionSegment = sessionView !== null && sessionView.mineCount > 0 ? " │ ●" + String(sessionView.mineCount) : null;
	var children = [];
	var workspace = workspaceNameOf(cwd);
	if (workspace !== null) {
		children.push(h("span", {
			key: "workspace",
			className: "dshh-workspace"
		}, workspace));
		children.push(h("span", {
			key: "workspaceSep",
			className: "dshh-workspaceSep"
		}, " · "));
	}
	if (state.phase === "error") children.push(h("span", {
		key: "gitWraperr",
		className: "dshh-gitWrap"
	}, "git:(" + t("pill.error") + ")"));
	else if (state.phase === "loading" || state.phase === "idle") children.push(h("span", {
		key: "gitWrapload",
		className: "dshh-gitWrap"
	}, "git:(" + t("pill.loading") + ")"));
	else if (!state.status || !state.status.repo) children.push(h("span", {
		key: "gitWrapnorepo",
		className: "dshh-gitWrap"
	}, "git:(" + t("pill.notRepo") + ")"));
	else {
		var status = state.status;
		children.push(h("span", {
			key: "gitOpen",
			className: "dshh-gitWrap"
		}, "git:("));
		children.push(h("span", {
			key: "branch",
			className: "dshh-branch"
		}, shortBranch(branchLabel(status, t)) + (status.dirty ? "*" : "")));
		children.push(h("span", {
			key: "gitClose",
			className: "dshh-gitWrap"
		}, ")"));
		if (status.ahead > 0) children.push(h("span", {
			key: "ahead",
			className: "dshh-ahead"
		}, " ↑" + String(status.ahead)));
		if (status.behind > 0) children.push(h("span", {
			key: "behind",
			className: "dshh-ahead"
		}, " ↓" + String(status.behind)));
		var shorthands = countShorthands(status.counts);
		for (var index = 0; index < shorthands.length; index += 1) {
			children.push(" ");
			children.push(h("span", {
				key: shorthands[index].key,
				style: { color: COUNT_COLOR[shorthands[index].key] }
			}, shorthands[index].mark + String(shorthands[index].value)));
		}
	}
	if (sessionSegment !== null) children.push(sessionSegment);
	var titleLines = [{
		text: t("pill.title"),
		tone: "muted"
	}];
	if (sessionView !== null) titleLines.push({ segments: emphasize(t("session.pill", { n: String(sessionView.mineCount) }), [String(sessionView.mineCount)]) });
	if (cwd) titleLines.push({
		text: cwd,
		tone: "muted"
	});
	if (state.status && state.status.repo) {
		var tip = branchLabel(state.status, t);
		if (state.status.upstream) tip += " · " + t("panel.upstream") + " " + state.status.upstream;
		titleLines.push({ text: tip });
		var labels = [];
		var countReadings = [];
		var counts2 = state.status.counts || {};
		for (var i2 = 0; i2 < COUNT_ORDER.length; i2 += 1) {
			var k2 = COUNT_ORDER[i2];
			var v2 = counts2[k2] || 0;
			if (v2 > 0) {
				labels.push(t("count." + k2) + " " + String(v2));
				countReadings.push(String(v2));
			}
		}
		if (labels.length > 0) {
			var aheadBehind = aheadBehindReadings(state.status);
			titleLines.push({ segments: emphasize(labels.join(" · "), countReadings.concat(aheadBehind)) });
		}
	}
	return h("div", {
		className: "dshh-dock",
		"data-dsh-hud": "dock"
	}, h("button", Object.assign({
		type: "button",
		className: "dshh-pill",
		"data-dsh-hud": "pill",
		"aria-expanded": state.panelOpen ? "true" : "false",
		style: { color: state.panelOpen ? "var(--dsw-alias-brand-primary, #4b8bf5)" : void 0 },
		onClick: function() {
			store.togglePanel();
		}
	}, store.tipHandlers("pill", function() {
		return titleLines;
	})), children), toolPillNode(state, {
		t,
		store,
		now: props.now === void 0 ? tick[0] : props.now
	}), balancePillNode(state, {
		t,
		store
	}), timerPillNode(state, {
		t,
		store,
		sessionId,
		now: props.now === void 0 ? tick[0] : props.now
	}));
}
function toolPillNode(state, options) {
	var t = options.t;
	var tools = state.tools;
	if (!tools || tools.active === null && tools.total === 0) return null;
	var now = options.now;
	var children = [];
	if (tools.active !== null) {
		var elapsed = toolElapsedLabel(tools.active, now);
		children.push(h("span", {
			key: "glyph",
			className: "dshh-toolsGlyph dshh-toolsGlyphRun"
		}, "◐"));
		children.push(h("span", {
			key: "name",
			className: "dshh-toolsName"
		}, " " + String(tools.active.name === void 0 ? "?" : tools.active.name)));
		if (typeof tools.active.summary === "string" && tools.active.summary.length > 0) children.push(": " + tools.active.summary);
		if (elapsed !== null) children.push(" " + elapsed);
	} else {
		var toolCounts = tools.counts.filter(function(item) {
			return item.name !== "skill";
		});
		var shown = toolCounts.slice(0, 3);
		for (var i = 0; i < shown.length; i += 1) {
			var item = shown[i];
			var bad = item.ok === false;
			if (i > 0) children.push(" │ ");
			children.push(h("span", {
				key: "glyph" + String(i),
				className: "dshh-toolsGlyph" + (bad ? " dshh-toolsGlyphBad" : " dshh-toolsGlyphOk")
			}, bad ? "✗" : "✓"));
			children.push(" " + String(item.name) + " ×" + String(item.count));
		}
		var skills = tools.skills || [];
		if (skills.length > 0) {
			if (children.length > 0) children.push(" │ ");
			children.push(t("tools.skills") + " ");
			for (var k = 0; k < skills.length && k < 2; k += 1) {
				if (k > 0) children.push(" · ");
				children.push(h("span", {
					key: "skill" + String(k),
					className: skills[k].ok === false ? "dshh-toolsGlyphBad" : "dshh-skillName"
				}, String(skills[k].name) + " ×" + String(skills[k].count)));
			}
			if (skills.length > 2) children.push(" +" + String(skills.length - 2));
			if (tools.skillsDropped > 0) children.push(" +" + String(tools.skillsDropped));
		}
		if (toolCounts.length > shown.length) children.push(" +" + String(toolCounts.length - shown.length));
	}
	probe.log("tools-pill", {
		active: tools.active === null ? null : String(tools.active.name),
		total: tools.total
	});
	return h("span", Object.assign({
		className: "dshh-pill dshh-toolsPill",
		"data-dsh-hud": "tools-pill",
		key: "tools"
	}, options.store.tipHandlers("tools-pill", function() {
		return toolsTitle(tools, t);
	})), children);
}
function timerPillNode(state, options) {
	var t = options.t;
	var sessionId = options.sessionId;
	var now = options.now;
	var snapshot = state.sessionTime;
	var value = snapshot !== null && snapshot !== void 0 && snapshot.sessionId === sessionId ? snapshot.value : null;
	if (value === null || value.available !== true) return null;
	var createdAt = value.createdAt;
	if (typeof createdAt !== "number") return null;
	var age = Math.max(0, now - createdAt);
	var readings = [];
	var hints = [t("timer.title"), t("timer.created", { time: fullWhen(createdAt) })];
	if (typeof value.llmMs === "number" && typeof value.toolMs === "number") {
		var llmText = formatDuration(value.llmMs);
		var toolText = formatDuration(value.toolMs);
		readings.push(llmText, toolText);
		hints.push(t("timer.work", {
			llm: llmText,
			tool: toolText
		}));
	}
	if (typeof value.turns === "number" && typeof value.steps === "number") {
		readings.push(String(value.turns), String(value.steps));
		hints.push(t("timer.turns", {
			turns: String(value.turns),
			steps: String(value.steps)
		}));
	}
	probe.log("timer-pill", { age: Math.round(age / 6e4) });
	return h("span", Object.assign({
		className: "dshh-pill dshh-timer",
		"data-dsh-hud": "session-timer",
		key: "timer"
	}, options.store.tipHandlers("session-timer", function() {
		return [{ segments: emphasize(hints.join(" · "), readings) }];
	})), [h("span", {
		key: "glyph",
		className: "dshh-timerGlyph"
	}, "⏱"), h("span", {
		key: "value",
		className: "dshh-timerValue"
	}, formatDuration(age))]);
}
function toolsTitle(tools, t) {
	var readings = [];
	function countUnit() {
		readings.push(String(tools.total));
	}
	var lines = [];
	if (tools.active !== null) {
		lines.push({
			text: t("tools.now", { name: String(tools.active.name) }),
			tone: "muted"
		});
		if (typeof tools.active.summary === "string" && tools.active.summary.length > 0) lines.push({
			text: tools.active.summary,
			tone: "muted"
		});
	}
	var totalText = t("tools.total", { n: String(tools.total) });
	countUnit();
	lines.push({ segments: emphasize(totalText, readings) });
	if (tools.counts.length > 0) {
		var byTool = t("tools.byTool") + " ";
		lines.push({ segments: emphasize(byTool + tools.counts.map(function(item) {
			return String(item.name) + " ×" + String(item.count);
		}).join(" · "), tools.counts.map(function(item) {
			return "×" + String(item.count);
		})) });
	}
	if (tools.skills && tools.skills.length > 0) lines.push({ segments: emphasize(t("tools.skills") + " " + tools.skills.map(function(item) {
		return String(item.name) + " ×" + String(item.count) + (item.ok === false ? " (✗)" : "");
	}).join(" · "), tools.skills.map(function(item) {
		return "×" + String(item.count);
	})) });
	var recent = tools.recent.slice(0, 3);
	if (recent.length > 0) {
		lines.push({
			text: t("tools.recent"),
			tone: "muted"
		});
		var recentReadings = [];
		for (var at = 0; at < recent.length; at += 1) {
			var entry = recent[at];
			var mark = entry.ok === false ? "✗" : "✓";
			var ms = typeof entry.ms === "number" ? " " + (entry.ms / 1e3).toFixed(1) + "s" : "";
			if (ms !== "") recentReadings.push(ms.trim());
			var summary = typeof entry.summary === "string" && entry.summary.length > 0 ? " · " + entry.summary : "";
			lines.push({ segments: emphasize(mark + " " + String(entry.name) + ms + summary, recentReadings) });
		}
	}
	return lines;
}
/**
* `↑2 ↓1` 这类领先/落后标记里的数字（给悬停高亮用）。
*
* 直接扫字符串而不是重算一遍 git 语义：这里要的只是"已经画出去的那几个数"。
*/
function aheadBehindReadings(status) {
	var out = [];
	if (typeof status.ahead === "number" && status.ahead > 0) out.push(String(status.ahead));
	if (typeof status.behind === "number" && status.behind > 0) out.push(String(status.behind));
	return out;
}
function toolElapsedLabel(active, now) {
	if (active === null || typeof active !== "object") return null;
	if (typeof active.startedAt !== "number") return null;
	var seconds = Math.max(0, (now - active.startedAt) / 1e3);
	return seconds < 10 ? seconds.toFixed(1) + "s" : String(Math.round(seconds)) + "s";
}

//#endregion
//#region src/client/components/session-changes.ts
/**
* 改动概览下面那一行：本会话改了几个文件 + 「只看本会话改的」开关。
*
* 归因数据没到手（`view === null`）时整行不渲染 —— 不显示一个"全部都是别人的"的假象。
*/
function SessionChangesLine(props) {
	var t = props.t;
	var view = props.view;
	props.review;
	var notes = [];
	if (view !== null) {
		notes.push(t("session.line", { n: String(view.mineCount) }));
		if (view.latestTurn !== null && view.latestCount > 0) notes.push(t("session.latestTurn", {
			n: String(view.latestCount),
			turn: String(view.latestTurn + 1)
		}));
		if (view.possibleCount > 0) notes.push(t("session.possible", { n: String(view.possibleCount) }));
	}
	if (view !== null) {
		if (view.gone.length > 0) notes.push(t("session.gone", { n: String(view.gone.length) }));
		if (view.dropped > 0) notes.push(t("session.dropped", { n: String(view.dropped) }));
		if (view.possibleDropped > 0) notes.push(t("session.possibleDropped", { n: String(view.possibleDropped) }));
	}
	if (props.review && props.review.total > 0) notes.push(t("review.count", {
		n: String(props.review.done),
		total: String(props.review.total)
	}));
	if (props.review && props.review.staleCount > 0) notes.push(t("review.staleCount", { n: String(props.review.staleCount) }));
	return h("div", {
		className: "dshh-session",
		"data-dsh-hud": "session"
	}, notes.length === 0 ? null : h("span", {
		className: "dshh-sessionText",
		title: sessionLineTitle(view, t)
	}, notes.join(" · ")), h("button", {
		type: "button",
		className: "dshh-sessionToggle" + (props.onlySession === true ? " dshh-sessionToggleOn" : ""),
		"data-session-filter": "only",
		"aria-pressed": props.onlySession === true ? "true" : "false",
		title: t("session.onlyTitle"),
		onClick: props.onToggle
	}, props.onlySession === true ? "◉ " : "○ ", t("session.only")), props.review && props.review.done > 0 ? h("button", {
		type: "button",
		className: "dshh-sessionToggle",
		"data-session-review": "clear",
		title: t("review.clear"),
		onClick: props.onClearReviewed
	}, t("review.clearShort")) : null, view === null || view.latestTurn === null ? null : h("button", {
		type: "button",
		className: "dshh-sessionToggle" + (props.onlyLatest === true ? " dshh-sessionToggleOn" : ""),
		"data-session-filter": "latest",
		"aria-pressed": props.onlyLatest === true ? "true" : "false",
		title: turnLabel(view, view.latestTurn, t) + "\n" + t("session.onlyLatestTitle"),
		onClick: props.onToggleLatest
	}, props.onlyLatest === true ? "◉ " : "○ ", t("session.onlyLatest")));
}
/** 一个文件属于哪一档：`mine` 确定改过 / `possible` 命令旁听 / `other` 与本会话无关。 */
function sessionMarkOf(view, file) {
	if (view.mine !== void 0 && view.mine[file] !== void 0) return "mine";
	if (view.possible !== void 0 && view.possible[file] !== void 0) return "possible";
	return "other";
}
function sessionTitle(view, file, t) {
	var record = view.mine !== void 0 ? view.mine[file] : void 0;
	if (record === void 0) {
		var guess = view.possible !== void 0 ? view.possible[file] : void 0;
		if (guess === void 0) return t("session.other");
		return t("session.possibleTitle", { reason: String(guess.reason || "").slice(0, 80) });
	}
	var parts = [];
	if (record.writes > 0) parts.push(t("session.writes", { n: String(record.writes) }));
	if (record.edits > 0) parts.push(t("session.edits", { n: String(record.edits) }));
	var when = typeof record.lastAt === "number" ? timeLabel(record.lastAt) : "";
	var line = t("session.mine") + (parts.length === 0 ? "" : "（" + parts.join("、") + "）") + (when ? " " + when : "");
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
	if (view === null) return void 0;
	var lines = [];
	if (view.since !== null) lines.push(t("session.since", { time: timeLabel(view.since) }));
	var commands = (view.commands || []).slice(-5).reverse();
	if (commands.length > 0) {
		lines.push(t("session.commands", { n: String(commands.length) }));
		for (var index = 0; index < commands.length; index += 1) {
			var item = commands[index] || {};
			lines.push("· " + String(item.command || "") + (item.failed === true ? " " + t("session.commandFailed") : ""));
		}
		if (view.writingCommands > commands.length) lines.push(t("session.commandsMore", { n: String(view.writingCommands - commands.length) }));
	}
	return lines.length === 0 ? void 0 : lines.join("\n");
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
	var prompt = view.turnPrompts !== void 0 && view.turnPrompts !== null ? view.turnPrompts[turn] : void 0;
	if (typeof prompt !== "string" || prompt.length === 0) return t("session.turn", { n: String(turn + 1) });
	return t("session.turnWithPrompt", {
		n: String(turn + 1),
		prompt
	});
}

//#endregion
//#region src/client/dom.ts
/** 把未知值收窄成"结构上像个 DOM 节点"；不是对象就给 null。 */
function asDomNode(value) {
	return value !== null && typeof value === "object" ? value : null;
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
	var current = asDomNode(node);
	var depth = 0;
	while (current && depth < 64) {
		if ((typeof current.getAttribute === "function" ? current.getAttribute("data-dsh-hud") : null) === mark) return true;
		current = asDomNode(current.parentNode);
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
	var current = asDomNode(node);
	var depth = 0;
	while (current && depth < 8) {
		var tag = typeof current.tagName === "string" ? current.tagName.toLowerCase() : "";
		if (tag === "input" || tag === "textarea" || tag === "select") return true;
		if (current.isContentEditable === true) return true;
		var editable = typeof current.getAttribute === "function" ? current.getAttribute("contenteditable") : null;
		if (editable === "" || editable === "true" || editable === "plaintext-only") return true;
		current = asDomNode(current.parentNode);
		depth += 1;
	}
	return false;
}
/** 用自己写在节点上的标记找节点；找不到或不支持就是 null。 */
function findMarked(selector) {
	if (typeof document === "undefined" || typeof document.querySelector !== "function") return null;
	return document.querySelector(selector);
}
/**
* 把一个带自己标记的节点滚进它所在滚动容器的视野（最小滚动量）。
*
* 全走能力判断：假 DOM（测试）里没有 offsetTop / clientHeight，这个函数直接
* no-op，测试断言的是状态与结构，不是像素。不用 `scrollIntoView`：那会连带
* 滚动祖先容器（面板是浮层，滚了产品的会话列表就不好了）。
*/
function revealRow(node, containerClassName) {
	var start = asDomNode(node);
	if (!start || typeof start.parentNode === "undefined") return;
	var container = asDomNode(start.parentNode);
	var depth = 0;
	while (container && depth < 32) {
		if (String(container.className || "").indexOf(containerClassName) >= 0) break;
		container = asDomNode(container.parentNode);
		depth += 1;
	}
	if (!container || typeof container.scrollTop !== "number") return;
	var top = start.offsetTop;
	var height = start.offsetHeight;
	var view = container.clientHeight;
	if (typeof top !== "number" || typeof height !== "number" || typeof view !== "number") return;
	if (top < container.scrollTop) container.scrollTop = top;
	else if (top + height > container.scrollTop + view) container.scrollTop = top + height - view;
}
function measureDockTop() {
	if (typeof document === "undefined" || typeof document.querySelector !== "function") return null;
	var node = document.querySelector("[data-dsh-hud=\"dock\"]");
	if (!node || typeof node.getBoundingClientRect !== "function") return null;
	var rect = node.getBoundingClientRect();
	return typeof rect.top === "number" ? rect.top : null;
}

//#endregion
//#region src/client/components/change-list.ts
/**
* 改动清单（面板左栏）：分组、计数、每行的状态标记，以及只显示本会话/最近一轮的过滤。
*/
function ChangeList(props) {
	var changes = props.changes || [];
	var activeFile = props.activeFile;
	var cursorFile = props.cursor || null;
	var listId = props.listId || "changes";
	react.default.useEffect(function() {
		if (typeof document === "undefined" || typeof document.querySelector !== "function") return;
		var wanted = cursorFile || activeFile;
		if (!wanted) return;
		for (var index = 0; index < changes.length; index += 1) {
			if (changes[index].file !== wanted) continue;
			var node = document.querySelector("[data-dsh-hud=\"row\"][data-row-list=\"" + listId + "\"][data-row-index=\"" + String(index) + "\"]");
			revealRow(node, "dshh-list");
			return;
		}
	}, [
		cursorFile,
		activeFile,
		changes.length,
		listId
	]);
	if (changes.length === 0) return null;
	var sessionView = props.sessionView === void 0 ? null : props.sessionView;
	var review = props.review === void 0 ? null : props.review;
	var rows = changes.map(function(change, index) {
		return h("button", {
			type: "button",
			className: "dshh-row" + (activeFile && change.file === activeFile ? " dshh-rowActive" : "") + (cursorFile && change.file === cursorFile ? " dshh-rowCursor" : ""),
			key: String(index) + ":" + change.path,
			"data-dsh-hud": "row",
			"data-row-list": listId,
			"data-row-index": String(index),
			title: change.path + (sessionView === null ? "" : "\n" + sessionTitle(sessionView, change.file, props.t)) + "\n" + props.t("panel.clickForDiff") + "\n" + props.t("panel.rowKeys"),
			onClick: function() {
				props.onOpen(change);
			}
		}, sessionView === null ? null : h("span", {
			className: "dshh-marker" + (sessionMarkOf(sessionView, change.file) === "mine" ? "" : sessionMarkOf(sessionView, change.file) === "possible" ? " dshh-markerPossible" : " dshh-markerOther"),
			"data-session-mark": sessionMarkOf(sessionView, change.file),
			"aria-hidden": "true"
		}, sessionMarkOf(sessionView, change.file) === "mine" ? "●" : sessionMarkOf(sessionView, change.file) === "possible" ? "◐" : "○"), h("span", {
			className: "dshh-status",
			style: { color: COUNT_COLOR[statusKey(change.status)] || "var(--dsw-alias-label-secondary, #8a8f98)" }
		}, change.status), h("span", { className: "dshh-path" }, change.path), review === null || review.known === void 0 || review.known[change.file] !== true ? null : h("span", {
			className: "dshh-review" + (review.marks[change.file] === "fresh" ? " dshh-reviewOn" : "") + (review.marks[change.file] === "stale" ? " dshh-reviewStale" : ""),
			"data-review": review.marks[change.file] === void 0 ? "none" : review.marks[change.file],
			title: reviewTitle(review.marks[change.file], props.t),
			onClick: function(event) {
				event.stopPropagation();
				event.preventDefault();
				if (props.onToggleReviewed) props.onToggleReviewed(change.file);
			}
		}, review.marks[change.file] === void 0 ? "○" : "✓"));
	});
	var footer = props.truncated ? h("div", { className: "dshh-note" }, props.t("panel.truncated")) : null;
	return h("div", { className: "dshh-section" }, h("div", { className: "dshh-sectionTitle" }, props.title || props.t("panel.changes") + " · " + String(changes.length)), h("div", { className: "dshh-list" }, rows), footer);
}

//#endregion
//#region src/client/components/commit-list.ts
/**
* 最近提交清单（面板中间那一栏）：一条一行，短 sha + 标题 + HEAD 徽标 + 时刻。
*/
/**
* 最近提交：一行一条，sha + 标题 + HEAD 徽标 + 相对时间；整行可点看这次提交改了什么。
* 打开的那条会高亮（再点一次收起）——提交明细在右栏，左栏这块主面板不动。
*/
function CommitList(props) {
	var commits = props.commits || [];
	if (commits.length === 0) return null;
	var t = props.t;
	return h("div", { className: "dshh-section" }, h("div", { className: "dshh-sectionTitle" }, t("panel.commits")), h("div", { className: "dshh-commits" }, commits.map(function(commit, index) {
		var refs = commit.refs || [];
		var isHead = refs.some(function(ref) {
			return ref.indexOf("HEAD") === 0;
		});
		var when = typeof commit.committedAt === "number" ? fullWhen(commit.committedAt) : commit.date || "";
		var tip = [
			t("commit.click"),
			"",
			commit.subject,
			commit.author + " · " + when
		].concat(refs).join("\n");
		var open = sameCommit(commit.sha, props.activeSha);
		return h("button", {
			type: "button",
			className: "dshh-commit" + (open ? " dshh-commitActive" : ""),
			key: commit.sha + ":" + String(index),
			title: tip,
			onClick: function() {
				if (props.onOpen) props.onOpen(commit);
			}
		}, h("span", { className: "dshh-csha" }, commit.sha), h("span", { className: "dshh-csubject" }, commit.subject || "—"), isHead ? h("span", { className: "dshh-chead" }, "HEAD") : null, h("span", { className: "dshh-cwhen" }, commitWhen(commit, t)));
	})));
}

//#endregion
//#region src/client/components/commit-pane.ts
/**
* 提交明细（右栏）：某次提交的元信息与它改过的文件。
*/
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
	if (commit.phase === "loading") head = h("div", { className: "dshh-commitHead" }, h("div", { className: "dshh-commitMeta" }, t("commit.loading")));
	else if (commit.phase === "error") head = h("div", { className: "dshh-commitHead" }, h("div", { className: "dshh-commitMeta" }, errorText(commit.errorCode, t)));
	else {
		var lines = [commit.author + " · " + commit.date];
		if (commit.refs && commit.refs.length > 0) lines.push(commit.refs.join(", "));
		if (commit.merge) lines.push(t("commit.merge"));
		head = h("div", { className: "dshh-commitHead" }, h("div", { className: "dshh-commitTitle" }, h("span", { className: "dshh-csha" }, commit.shortSha), h("span", {
			className: "dshh-commitSubject",
			title: commit.subject
		}, commit.subject || "—")), h("div", { className: "dshh-commitMeta" }, lines.join(" · ")));
	}
	var files = commit.files || [];
	var list = commit.phase !== "ready" ? null : files.length === 0 ? h("div", { className: "dshh-commitFiles" }, h("div", { className: "dshh-note" }, t("commit.empty"))) : h("div", { className: "dshh-commitFiles" }, h(ChangeList, {
		changes: files,
		truncated: commit.truncated,
		t,
		title: t("commit.files") + " · " + String(files.length),
		onOpen: props.onOpenFile,
		activeFile: props.activeFile,
		cursor: props.cursor,
		listId: "commit"
	}));
	return h("div", {
		className: "dshh-commitpane",
		style
	}, head, list);
}

//#endregion
//#region src/client/components/count-chips.ts
function CountChips(props) {
	var counts = props.counts || {};
	var children = [];
	for (var index = 0; index < COUNT_ORDER.length; index += 1) {
		var key = COUNT_ORDER[index];
		var value = counts[key] || 0;
		if (value <= 0) continue;
		children.push(h("span", {
			key,
			className: "dshh-chip",
			style: {
				color: COUNT_COLOR[key],
				borderColor: "currentColor"
			},
			title: props.t("count." + key) + " " + String(value)
		}, props.t("count." + key) + " " + String(value)));
	}
	if (children.length === 0) return h("span", { className: "dshh-clean" }, props.t("panel.clean"));
	return h("div", { className: "dshh-chips" }, children);
}

//#endregion
//#region src/client/components/image-diff.ts
/**
* 图片改动的前后对比：两侧缩略、尺寸与字节数、可缩放，认不出的二进制退回一句话说明。
*/
/**
* 二进制（图片）改动的预览：并排两张图，或按需在两张之间切换。
*
* 只在文本 diff 报 `binary` 时挂上来。字节来自宿主的 `image` 端点（只读），
* 这里只负责画：单侧画不出来就画那一侧的原因，两侧都不行才退回原来那句话。
*/
function ImageDiff(props) {
	var t = props.t;
	var store = props.store;
	var diff = props.diff;
	var request = imageRequest(diff, props.cwd);
	var key = request === null ? null : imagePairKey(request);
	var viewRef = react.default.useState(function() {
		return request !== null && store.cachedImagePair ? asPairEntry(store.cachedImagePair(request)) : null;
	});
	var modeRef = react.default.useState("pair");
	var flipRef = react.default.useState("after");
	react.default.useEffect(function() {
		if (request === null || key === null) return void 0;
		var cancelled = false;
		var cached = store.cachedImagePair ? asPairEntry(store.cachedImagePair(request)) : null;
		if (cached !== null) {
			viewRef[1](cached);
			return;
		}
		viewRef[1](null);
		store.loadImagePair(request).then(function(entry) {
			if (!cancelled) viewRef[1](asPairEntry(entry));
		});
		return function() {
			cancelled = true;
		};
	}, [key]);
	if (key === null) return h("div", {
		className: "dshh-empty",
		"data-dsh-hud": "image"
	}, t("diff.binary"));
	var view = viewRef[0];
	if (view === null) return h("div", {
		className: "dshh-empty",
		"data-dsh-hud": "image"
	}, t("image.loading"));
	if (view.phase === "error") return h("div", {
		className: "dshh-empty",
		"data-dsh-hud": "image"
	}, errorText(view.code, t));
	var value = view.value || {};
	var before = value.before || { kind: "missing" };
	var after = value.after || { kind: "missing" };
	if (before.kind !== "image" && after.kind !== "image") return h("div", {
		className: "dshh-empty",
		"data-dsh-hud": "image"
	}, imageFallbackText(t, before, after));
	var labels = imageLabels(diff, t);
	var mode = modeRef[0];
	var flip = flipRef[0];
	var zoom = diff.zoom === void 0 ? null : diff.zoom;
	var cells = mode === "pair" ? [{
		key: "before",
		label: labels.before,
		side: before
	}, {
		key: "after",
		label: labels.after,
		side: after
	}] : [{
		key: flip,
		label: flip === "after" ? labels.after : labels.before,
		side: flip === "after" ? after : before
	}];
	function cell(entry) {
		var side = entry.side;
		var body = side.kind === "image" ? h("img", {
			className: "dshh-img",
			alt: entry.label,
			style: zoom === null || typeof side.width !== "number" ? void 0 : {
				width: Math.round(side.width * zoom) + "px",
				maxWidth: "none"
			},
			src: "data:" + side.mime + ";base64," + String(side.base64 || "")
		}) : h("div", { className: "dshh-imgNote" }, sideReasonText(side, t));
		return h("div", {
			className: "dshh-imgCell",
			key: entry.key
		}, h("div", { className: "dshh-imgLabel" }, entry.label), body);
	}
	function tab(id, label) {
		var active = mode === id;
		return h("button", {
			type: "button",
			className: "dshh-tab" + (active ? " dshh-tabActive" : ""),
			"aria-pressed": active ? "true" : "false",
			onClick: function() {
				modeRef[1](id);
			}
		}, label);
	}
	var dimsChanged = before.kind === "image" && after.kind === "image" && typeof before.width === "number" && typeof after.width === "number" && (before.width !== after.width || before.height !== after.height) ? h("span", { className: "dshh-imgDims" }, t("image.dimsChanged", {
		from: t("image.dims", {
			w: String(before.width),
			h: String(before.height)
		}),
		to: t("image.dims", {
			w: String(after.width),
			h: String(after.height)
		})
	})) : null;
	var bytes = before.kind === "image" && after.kind === "image" ? h("span", { className: "dshh-imgBytes" }, formatBytes(before.bytes) + " → " + formatBytes(after.bytes)) : null;
	var zoomControls = h("span", {
		className: "dshh-imgZoom",
		"data-dsh-hud": "image-zoom"
	}, [
		h("button", {
			key: "out",
			type: "button",
			className: "dshh-imgZoomBtn",
			title: t("image.zoomOut"),
			"data-dsh-hud": "image-zoom-out",
			onClick: function() {
				store.setZoom(stepZoom(zoom, -1));
			}
		}, "−"),
		h("button", {
			key: "value",
			type: "button",
			className: "dshh-imgZoomBtn dshh-imgZoomValue",
			title: t("image.fitWidth"),
			"data-dsh-hud": "image-zoom-value",
			onClick: function() {
				store.setZoom(null);
			}
		}, zoom === null ? t("image.fitWidth") : t("image.zoomValue", { percent: String(Math.round(zoom * 100)) })),
		h("button", {
			key: "in",
			type: "button",
			className: "dshh-imgZoomBtn",
			title: t("image.zoomIn"),
			"data-dsh-hud": "image-zoom-in",
			onClick: function() {
				store.setZoom(stepZoom(zoom, 1));
			}
		}, "＋")
	]);
	return h("div", {
		className: "dshh-imgWrap",
		"data-dsh-hud": "image"
	}, h("div", { className: "dshh-imgMeta" }, tab("pair", t("image.pair")), mode === "flip" ? h("button", {
		type: "button",
		className: "dshh-tab",
		title: t("image.flip"),
		"data-dsh-hud": "image-flip",
		onClick: function() {
			flipRef[1](flip === "after" ? "before" : "after");
		}
	}, t("image.flip")) : null, zoomControls, dimsChanged, bytes), h("div", { className: "dshh-imgPair" + (mode === "flip" ? " dshh-imgPairSingle" : "") + (zoom === null ? "" : " dshh-imgPairZoomed") }, cells.map(cell)));
}
/**
* 差异视图：两侧页签（宿主半一次把两侧都取回来了，切页签不再发请求）、
* 自动换行、复制差异。全部只读——它只是把 git 的输出画出来。
*/
/**
* 由 diff 状态推出 `image` 请求；推不出（没有 cwd / 文件）返回 null。
*
* 页签语义与文本 diff 完全一致：未暂存看「索引 → 工作区」，已暂存看「HEAD → 索引」，
* 提交明细按 sha 取，所以两个视图里"未暂存 / 已暂存"指的是同一件事。
*/
function imageRequest(diff, cwd) {
	if (!diff || !diff.file || !cwd) return null;
	var request = {
		cwd,
		path: diff.file
	};
	if (diff.origPath) request.origPath = diff.origPath;
	if (diff.source === "commit" && diff.sha) request.sha = diff.sha;
	else request.side = diff.side === "index" ? "index" : "worktree";
	return request;
}
/** 两侧的标签跟着"看的到底是哪两条记录"走。 */
function imageLabels(diff, t) {
	if (diff.source === "commit") return {
		before: t("image.beforeCommit"),
		after: t("image.afterCommit")
	};
	if (diff.side === "index") return {
		before: t("image.beforeIndex"),
		after: t("image.afterIndex")
	};
	return {
		before: t("image.beforeWorktree"),
		after: t("image.afterWorktree")
	};
}
/** 一侧画不出来时的原因文案（每一侧各有各的原因）。 */
function sideReasonText(side, t) {
	if (side.kind === "too-large") return t("image.tooLarge", {
		limit: String(Math.round((typeof side.limit === "number" ? side.limit : 0) / 1024 / 1024)),
		size: formatBytes(side.bytes)
	});
	if (side.kind === "not-image") return t("image.notImage", { size: formatBytes(side.bytes) });
	return t("image.missing");
}
/**
* 两张都画不出来时说什么：能说清原因就说原因，否则退回原来那句话。
* "太大"优先于"不是图" —— 前者才是用户会想处理的那件事。
*/
function imageFallbackText(t, before, after) {
	var sides = [before, after];
	var tooLarge = sides.filter(function(side) {
		return side.kind === "too-large";
	})[0];
	if (tooLarge !== void 0) return sideReasonText(tooLarge, t);
	var notImage = sides.filter(function(side) {
		return side.kind === "not-image";
	})[0];
	if (notImage !== void 0) return sideReasonText(notImage, t);
	return t("diff.binary");
}
/** 按扩展名粗筛"这看起来是张图"。 */
function looksLikeImage(file) {
	if (typeof file !== "string") return false;
	var dot = file.lastIndexOf(".");
	if (dot < 0 || dot === file.length - 1) return false;
	return IMAGE_FILE_EXTENSIONS.indexOf(file.slice(dot + 1).toLowerCase()) >= 0;
}
/**
* store 边界：图片缓存条目由 store 的 image 片构造（形状见 `store/image.ts`），
* 到这里只做一次"是不是对象"的收窄；坏值当没有缓存（会再发一次请求，行为不变）。
*/
function asPairEntry(value) {
	return value !== null && value !== void 0 && typeof value === "object" ? value : null;
}

//#endregion
//#region src/client/components/diff-view.ts
/**
* 差异视图：两侧页签、逐行渲染、折叠 hunk、复制为文本。
*/
function DiffView(props) {
	var t = props.t;
	var diff = props.diff;
	var store = props.store;
	var cwd = props.cwd;
	var copiedRef = react.default.useState(false);
	var copied = copiedRef[0];
	var setCopied = copiedRef[1];
	var timerRef = react.default.useState(null);
	var isCommit = diff.source === "commit";
	var side = diff.side === "index" ? "index" : "worktree";
	var data = diffPayload(diff);
	var untracked = isCommit ? false : payloadUntracked(diff.data);
	var hunk = typeof diff.hunk === "number" ? diff.hunk : 0;
	var collapsed = diff.collapsed || [];
	var rows = data && data.rows ? data.rows : [];
	react.default.useEffect(function() {
		var host = findMarked("[data-dsh-hud=\"diff\"]");
		if (host && typeof host.scrollTop === "number") host.scrollTop = 0;
	}, [
		diff.file,
		diff.sha,
		diff.side
	]);
	react.default.useEffect(function() {
		var host = findMarked("[data-dsh-hud=\"diff\"]");
		if (!host || typeof host.querySelector !== "function") return;
		revealRow(host.querySelector("[data-dsh-hud=\"hunk\"][data-hunk-index=\"" + String(hunk) + "\"]"), "dshh-diff");
	}, [
		hunk,
		diff.file,
		diff.sha,
		diff.side,
		collapsed.length
	]);
	function onCopy() {
		if (!data) return;
		var clipboard = typeof navigator !== "undefined" ? navigator.clipboard : void 0;
		if (!clipboard || typeof clipboard.writeText !== "function") return;
		Promise.resolve(clipboard.writeText(rowsToText(data.rows || []))).then(function() {
			setCopied(true);
			if (timerRef[0]) window.clearTimeout(timerRef[0]);
			timerRef[1](window.setTimeout(function() {
				setCopied(false);
			}, 1500));
		}).catch(function() {});
	}
	function tab(kind, label, title) {
		var active = side === kind;
		return h("button", {
			type: "button",
			className: "dshh-tab" + (active ? " dshh-tabActive" : ""),
			"aria-pressed": active ? "true" : "false",
			title,
			onClick: function() {
				store.setDiffSide(kind);
			}
		}, label);
	}
	var counts = data && data.binary !== true ? h("span", { className: "dshh-difcounts" }, h("span", { style: { color: "var(--dsw-alias-state-success-primary, #3fb950)" } }, "+" + String(data.additions)), h("span", { style: { color: "var(--dsw-alias-state-error-primary, #f06a6a)" } }, "-" + String(data.deletions))) : null;
	var body;
	if (diff.phase === "loading") body = h("div", { className: "dshh-empty" }, t("panel.loading"));
	else if (diff.phase === "error") body = h("div", { className: "dshh-empty" }, errorText(diff.errorCode, t));
	else if (!data) body = h("div", { className: "dshh-empty" }, t("diff.empty"));
	else if (data.binary === true) body = h(ImageDiff, {
		t,
		store,
		diff,
		cwd
	});
	else if (rows.length === 0) body = h("div", { className: "dshh-empty" }, t("diff.empty"));
	else {
		var visible = visibleDiffRows(rows, collapsed);
		body = h("div", {
			className: "dshh-diff",
			"data-dsh-hud": "diff"
		}, visible.map(function(entry, index) {
			var entryHunk = entry.hunk === null ? -1 : entry.hunk;
			var isHunk = entry.row.kind === "hunk";
			return h(DiffRow, {
				key: String(index) + ":" + entry.row.kind,
				row: entry.row,
				wrap: diff.wrap === true,
				hunk: entry.hunk,
				active: isHunk && entry.hunk === hunk && collapsed.indexOf(entryHunk) < 0,
				collapsed: isHunk && collapsed.indexOf(entryHunk) >= 0,
				hint: isHunk ? t("diff.hunkToggle") : void 0,
				onToggle: isHunk ? function() {
					store.toggleHunk(entry.hunk === null ? void 0 : entry.hunk);
				} : void 0
			});
		}), data.truncated === true ? h("div", { className: "dshh-note" }, t("diff.truncated")) : null);
	}
	return h("div", { className: "dshh-diffview" }, h("div", { className: "dshh-toolbar" }, h("span", {
		className: "dshh-difpath",
		title: diff.path
	}, diff.path), counts, h("span", { className: "dshh-spacer" }), untracked ? h("span", { className: "dshh-kv" }, t("diff.untrackedHint")) : null, isCommit ? null : tab("worktree", t("diff.worktree"), t("diff.worktree")), isCommit || untracked ? null : tab("index", t("diff.index"), t("diff.index")), h("button", {
		type: "button",
		className: "dshh-tab" + (diff.wrap === true ? " dshh-tabActive" : ""),
		"aria-pressed": diff.wrap === true ? "true" : "false",
		title: t("diff.wrap"),
		onClick: function() {
			store.toggleDiffWrap();
		}
	}, t("diff.wrap")), h("button", {
		type: "button",
		className: "dshh-tab",
		title: t("diff.copy"),
		onClick: onCopy
	}, copied ? t("diff.copied") : t("diff.copy")), h("button", {
		type: "button",
		className: "dshh-tab",
		title: isCommit ? t("commit.close") : t("diff.close"),
		"aria-label": isCommit ? t("commit.close") : t("diff.close"),
		onClick: function() {
			store.closeDetail();
		}
	}, "✕")), body);
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
	var text = row.text === "" ? "\xA0" : row.text;
	if (row.kind === "hunk") return h("div", {
		className: "dshh-difrow dshh-difrow-hunk" + (props.active ? " dshh-difrow-hunkActive" : ""),
		"data-dsh-hud": "hunk",
		"data-hunk-index": props.hunk === null || props.hunk === void 0 ? void 0 : String(props.hunk),
		title: props.hint,
		onClick: props.onToggle
	}, h("span", {
		className: "dshh-difno",
		style: gutterStyle
	}, ""), h("span", {
		className: "dshh-difno dshh-hunkMark",
		style: gutterStyle
	}, props.collapsed ? "▸" : "▾"), h("span", { className: "dshh-diftext" + (props.wrap ? " dshh-wrap" : "") }, text));
	return h("div", {
		className: "dshh-difrow dshh-difrow-" + row.kind,
		style
	}, h("span", {
		className: "dshh-difno",
		style: gutterStyle
	}, row.oldLine === null ? "" : String(row.oldLine)), h("span", {
		className: "dshh-difno",
		style: gutterStyle
	}, row.newLine === null ? "" : String(row.newLine)), h("span", { className: "dshh-diftext" + (props.wrap ? " dshh-wrap" : "") }, text));
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
			out.push({
				row,
				hunk: ordinal
			});
			continue;
		}
		if (ordinal >= 0 && folded.indexOf(ordinal) >= 0) continue;
		out.push({
			row,
			hunk: ordinal >= 0 ? ordinal : null
		});
	}
	return out;
}
/** 把 rows 还原成 unified diff 文本（"复制差异"用）。 */
function rowsToText(rows) {
	return rows.map(function(row) {
		if (row.kind === "add") return "+" + row.text;
		if (row.kind === "del") return "-" + row.text;
		if (row.kind === "ctx") return " " + row.text;
		return row.text;
	}).join("\n");
}
/** 工作区差异的载荷形状：两侧都在。提交差异是单侧，没有这个形状。 */
function isWorktreePayload(payload) {
	return "worktree" in payload && "index" in payload;
}
/** 工作区差异载荷里的 `untracked`；单侧载荷（提交差异）没有这个字段。 */
function payloadUntracked(payload) {
	return payload !== null && isWorktreePayload(payload) ? payload.untracked === true : false;
}
/** 当前这一侧的 rows 载体：提交差异只有一侧，工作区差异要按 side 取。 */
function diffPayload(diff) {
	if (!diff || !diff.data) return null;
	if (diff.source === "commit") return diff.data;
	if (!isWorktreePayload(diff.data)) return null;
	return diff.data[diff.side === "index" ? "index" : "worktree"] || null;
}

//#endregion
//#region src/client/components/tag-list.ts
/**
* 标签列表：一行一个，tag 名 + 它指向的提交 sha + 相对时间；指向当前 HEAD 的标 HEAD。
* 点一行 = 用右栏的提交明细看这个 tag 指向的那次提交（复用同一条管道，不新增界面）。
*/
function TagList(props) {
	var tags = props.tags;
	var t = props.t;
	if (!Array.isArray(tags)) return null;
	if (tags.length === 0) return h("div", { className: "dshh-section" }, h("div", { className: "dshh-sectionTitle" }, t("panel.tags")), h("div", {
		className: "dshh-note",
		"data-tags-empty": "1"
	}, t("panel.tagsEmpty")));
	var headSha = props.headSha;
	return h("div", { className: "dshh-section" }, h("div", { className: "dshh-sectionTitle" }, t("panel.tags")), h("div", { className: "dshh-commits" }, tags.map(function(tag, index) {
		var isHead = typeof headSha === "string" && headSha.length > 0 && (tag.sha === headSha || headSha.indexOf(tag.sha) === 0);
		var tip = [
			t("tag.click"),
			"",
			tag.subject || "",
			t(tag.annotated ? "tag.annotated" : "tag.lightweight") + " · " + tag.sha + " · " + (typeof tag.committedAt === "number" ? fullWhen(tag.committedAt) : tag.date || "")
		].join("\n");
		var open = sameCommit(tag.sha, props.activeSha);
		return h("button", {
			type: "button",
			className: "dshh-commit" + (open ? " dshh-commitActive" : ""),
			"data-tag-row": tag.name,
			key: tag.name + ":" + String(index),
			title: tip,
			onClick: function() {
				if (props.onOpen) props.onOpen(tag);
			}
		}, h("span", { className: "dshh-ctag" }, tag.name), h("span", { className: "dshh-csha" }, tag.sha), isHead ? h("span", { className: "dshh-chead" }, "HEAD") : null, h("span", { className: "dshh-cwhen" }, commitWhen(tag, t)));
	})), props.truncated === true ? h("div", { className: "dshh-note" }, t("panel.tagsCapped", { n: String(tags.length) })) : null);
}

//#endregion
//#region src/client/hooks/panel.ts
/**
* 面板的三段行为，各自一个 hook：键盘与"点进来"手势、视口变化后夹回位置、量 dock 行位置。
*
* 提成 hook 的理由：这些是 `FloatingPanel` 里最费劲的部分，而它们只依赖 `store` 与几个快照字段 ——
* 组件从此只剩"hooks 调用 + JSX"。
*/
/**
* 根作用域的座位：读不到当前会话，只读共享 store。
* 收起时渲染 `null` —— 这样不会在输入框上留一个挡点击的气泡。
*/
/**
* 面板的键盘与"点进来"手势：Esc 逐层退（右栏 → 收起面板），其余键只在面板被激活时接管。
*
* 提成顶层 hook 的理由：这段是面板里最费劲的一部分，而它只依赖 `store` 与 `panelOpen`
* （`armed` 是就地可变的对象，按引用传进来，语义与原来完全一致）。
*/
function usePanelKeys(store, panelOpen, armed) {
	react.default.useEffect(function() {
		if (!panelOpen) return void 0;
		var onKeyDown = function(event) {
			if (event.key === "Escape") {
				var current = store.getSnapshot();
				if (current.diff || current.commit) store.closeDetail();
				else store.openPanel(false);
				return;
			}
			if (!armed.inside && !isInsidePanel(activeElement())) return;
			if (isTypingTarget(event.target)) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			var handled = true;
			if (event.key === "ArrowDown") store.stepFile(1, false);
			else if (event.key === "ArrowUp") store.stepFile(-1, false);
			else if (event.key === "]") store.stepFile(1, true);
			else if (event.key === "[") store.stepFile(-1, true);
			else if (event.key === "Enter") store.openCursor();
			else if (event.key === "n") store.stepHunk(1);
			else if (event.key === "p") store.stepHunk(-1);
			else if (event.key === " " || event.code === "Space") {
				var openDiff = store.getSnapshot().diff;
				store.toggleHunk(openDiff ? openDiff.hunk : 0);
			} else if (event.key === "r") store.refresh();
			else if (event.key === "v") {
				var snapshot = store.getSnapshot();
				var rows = visibleChangeRows(snapshot);
				var target = snapshot.cursor !== null && snapshot.cursor !== void 0 ? snapshot.cursor : null;
				if (target === null) target = rows[0] ? rows[0].file : null;
				if (target !== null) store.toggleReviewed(target);
			} else handled = false;
			if (handled) {
				event.preventDefault();
				event.stopPropagation();
			}
		};
		var onPointerDown = function(event) {
			armed.inside = isInsidePanel(event.target);
		};
		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("pointerdown", onPointerDown, true);
		return function() {
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [panelOpen, store]);
}
/** 视口变化后把已记忆的面板位置夹回可见区域。 */
function usePanelClamp(store, pos) {
	react.default.useEffect(function() {
		if (!pos) return void 0;
		var onResize = function() {
			var next = clampPos(pos.left, pos.top, panelWidthOf(store));
			if (next.left !== pos.left || next.top !== pos.top) store.movePanel(next);
		};
		window.addEventListener("resize", onResize);
		return function() {
			window.removeEventListener("resize", onResize);
		};
	}, [pos, store]);
}
/** 量 dock 行位置：面板据此贴到胶囊上方（会话/状态变化都会重量一次，所以输入框移位时面板跟着走）。 */
function useDockAnchor(store, panelOpen, sessionId, status) {
	react.default.useEffect(function() {
		if (!panelOpen) return void 0;
		var measure = function() {
			store.setAnchorTop(measureDockTop());
		};
		measure();
		window.addEventListener("resize", measure);
		return function() {
			window.removeEventListener("resize", measure);
		};
	}, [
		panelOpen,
		sessionId,
		status,
		store
	]);
}

//#endregion
//#region src/client/components/floating-panel.ts
/**
* 悬浮面板本体：头部、概览、左栏改动清单、中间提交栏、右栏差异/提交明细，以及拖拽与抓握。
*
* 三段行为（键盘、视口夹回、dock 锚点）在 `hooks/panel.ts` 里；这里只剩 hooks 调用与 JSX。
*/
function HudFloatingPanel(props) {
	var t = props.t || function(key) {
		return key;
	};
	var store = props.store;
	var state = useStore(store);
	var dragRef = react.default.useState(null);
	var drag = dragRef[0];
	var setDrag = dragRef[1];
	var gripRef = react.default.useState(null);
	var armed = react.default.useState(function() {
		return { inside: false };
	})[0];
	usePanelKeys(store, state.panelOpen, armed);
	usePanelClamp(store, state.pos);
	useDockAnchor(store, state.panelOpen, state.sessionId, state.status);
	var grip = gripRef[0];
	var setGrip = gripRef[1];
	/**
	* 拖动：只在头部按下、并且**不是**按在按钮上时开始；移动走 window 监听，
	* 刻意**不用** `setPointerCapture` —— 一旦在头部捕获指针，`pointerup` 会被
	* 重定向到头部，`click` 便落在按下与松开的公共祖先（头部）上，按钮的
	* `onClick` 永远不触发，面板就「关不掉」了。
	*/
	react.default.useEffect(function() {
		if (!drag) return void 0;
		const activeDrag = drag;
		var moved = false;
		var onMove = function(event) {
			if (event.pointerId !== activeDrag.pointerId) return;
			if (!moved && Math.abs(event.clientX - activeDrag.startX) < 3 && Math.abs(event.clientY - activeDrag.startY) < 3) return;
			moved = true;
			store.movePanel(clampPos(event.clientX - activeDrag.offsetX, event.clientY - activeDrag.offsetY, panelWidthOf(store)));
		};
		var finish = function(event) {
			if (event.pointerId !== activeDrag.pointerId) return;
			setDrag(null);
			if (moved) {
				var next = store.getSnapshot().pos;
				if (next !== null) store.commitPanel(next);
			}
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", finish);
		window.addEventListener("pointercancel", finish);
		return function() {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", finish);
			window.removeEventListener("pointercancel", finish);
		};
	}, [drag, store]);
	/**
	* 拖动面板**右边缘**调整差异栏宽度（与 dsh-git 的抓握位置一致）：
	* 往左拖变宽、往右拖变窄；松手才落盘。
	*/
	react.default.useEffect(function() {
		if (!grip) return void 0;
		const activeGrip = grip;
		var onMove = function(event) {
			if (event.pointerId !== activeGrip.pointerId) return;
			if (activeGrip.kind === "commit") store.setCommitWidth(activeGrip.startWidth - (event.clientX - activeGrip.startX));
			else store.setDiffWidth(activeGrip.startWidth - (event.clientX - activeGrip.startX));
		};
		var finish = function(event) {
			if (event.pointerId !== activeGrip.pointerId) return;
			setGrip(null);
			store.persistLayout();
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", finish);
		window.addEventListener("pointercancel", finish);
		return function() {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", finish);
			window.removeEventListener("pointercancel", finish);
		};
	}, [grip, store]);
	if (!state.panelOpen) return null;
	/**
	* 抓握按下。
	*
	* `kind` 决定它调哪一栏：`diff` = 面板右边缘那条（调差异栏）；`commit` = 提交栏右边那条
	* （调提交明细栏）。只有提交栏、没有差异栏时，右边缘那条也调提交栏 —— 它是右边界上唯一
	* 还能变宽的东西，不该按下去没反应。
	*/
	function onGripPointerDown(kind, event) {
		if (event.button !== 0) return;
		var snapshot = store.getSnapshot();
		event.preventDefault();
		var start = kind === "commit" ? typeof snapshot.commitWidth === "number" ? snapshot.commitWidth : 240 : typeof snapshot.diffWidth === "number" ? snapshot.diffWidth : 470;
		setGrip({
			kind,
			pointerId: event.pointerId,
			startX: event.clientX,
			startWidth: start
		});
	}
	function onHeaderPointerDown(event) {
		if (event.button !== 0) return;
		var target = event.target;
		if (target && typeof target.closest === "function" && target.closest("button")) return;
		var rect = event.currentTarget.parentNode.getBoundingClientRect();
		setDrag({
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			offsetX: event.clientX - rect.left,
			offsetY: event.clientY - rect.top
		});
	}
	function onHeaderDoubleClick() {
		store.resetPanel();
	}
	var layout = panelLayout(state);
	var diffMode = layout.diff;
	var commitMode = layout.commit;
	var wide = diffMode || commitMode;
	var dockTop = typeof state.anchorTop === "number" ? state.anchorTop : null;
	var anchorBottom = dockTop === null ? 168 : Math.max(8, window.innerHeight - dockTop + 8);
	var panelStyle = {
		position: "fixed",
		zIndex: 30,
		boxSizing: "border-box",
		width: panelWidthFor(layout, state.diffWidth, state.commitWidth),
		maxWidth: "calc(100vw - 16px)",
		display: "flex",
		flexDirection: "column",
		border: "1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3))",
		borderRadius: 12,
		background: "var(--dsw-alias-bg-layer-1, #1f2126)",
		boxShadow: "var(--dsw-shadow-lv2, 0 4px 12px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12))",
		overflow: "hidden",
		pointerEvents: "auto"
	};
	if (wide) {
		var spaceAbove = (dockTop === null ? window.innerHeight - anchorBottom : dockTop - 8) - 8;
		panelStyle.height = Math.max(240, Math.min(Math.round(window.innerHeight * DIFF_PANEL_HEIGHT_VH), spaceAbove));
	} else panelStyle.maxHeight = "62vh";
	if (state.pos) {
		panelStyle.left = state.pos.left;
		panelStyle.top = state.pos.top;
	} else {
		panelStyle.left = "50%";
		panelStyle.bottom = anchorBottom;
		panelStyle.transform = "translateX(-50%)";
	}
	var openDiff = state.diff;
	var openCommit = state.commit;
	var openFile = openDiff !== null && openDiff.source !== "commit" ? openDiff.file : null;
	var commitOpenFile = openDiff !== null && openDiff.source === "commit" ? openDiff.file : null;
	var sessionView = sessionChangeView(state);
	var sessionRows = visibleChangeRows(state);
	var emptyBody;
	if (state.phase === "error") emptyBody = h("div", { className: "dshh-empty" }, errorText(state.errorCode, t));
	else if (!state.cwd) emptyBody = h("div", { className: "dshh-empty" }, t("panel.noSession"));
	else if (state.phase === "loading" && !state.status) emptyBody = h("div", { className: "dshh-empty" }, t("panel.loading"));
	else emptyBody = h("div", { className: "dshh-empty" }, t("panel.notRepo"));
	var listBody;
	if (state.status && state.status.repo) {
		var status = state.status;
		var repoChildren = [
			h("div", { className: "dshh-meta" }, h("span", {
				className: "dshh-repo",
				title: status.repo
			}, status.repo), status.upstream ? h("span", { className: "dshh-kv" }, t("panel.upstream") + " " + status.upstream) : null, status.ahead > 0 ? h("span", { className: "dshh-kv" }, "↑ " + t("panel.ahead") + String(status.ahead)) : null, status.behind > 0 ? h("span", { className: "dshh-kv" }, "↓ " + t("panel.behind") + String(status.behind)) : null, status.oid ? h("span", { className: "dshh-kv" }, status.oid) : null),
			h("div", { className: "dshh-sectionTitle" }, t("panel.summary")),
			h(CountChips, {
				counts: status.counts,
				t
			}),
			h(SessionChangesLine, {
				t,
				view: sessionView,
				onlySession: state.onlySession === true,
				onToggle: function() {
					store.toggleOnlySession();
				},
				onlyLatest: state.onlyLatest === true,
				onToggleLatest: function() {
					store.toggleOnlyLatest();
				},
				review: reviewView(state),
				onClearReviewed: function() {
					store.clearReviewed();
				}
			}),
			sessionRows.length > 0 ? h(ChangeList, {
				changes: sessionRows,
				truncated: status.truncated,
				t,
				onOpen: function(change) {
					store.openDiff(change);
				},
				activeFile: openFile,
				cursor: commitMode ? null : state.cursor,
				listId: "changes",
				sessionView,
				review: reviewView(state),
				onToggleReviewed: function(file) {
					store.toggleReviewed(file);
				}
			}) : state.status.changes.length > 0 && state.onlySession === true && sessionView !== null ? h("div", { className: "dshh-note" }, t("session.empty")) : null,
			h(CommitList, {
				commits: state.commits,
				t,
				activeSha: commitMode && openCommit !== null ? openCommit.sha : null,
				onOpen: function(commit) {
					store.toggleCommit(commit);
				}
			}),
			h(TagList, {
				tags: state.tags,
				truncated: state.tagsTruncated,
				t,
				headSha: state.status && state.status.oid ? state.status.oid : null,
				activeSha: commitMode && openCommit !== null ? openCommit.sha : null,
				onOpen: function(tag) {
					store.toggleCommit({
						sha: tag.sha,
						subject: tag.subject || "",
						author: "",
						date: tag.date || "",
						committedAt: typeof tag.committedAt === "number" ? tag.committedAt : null,
						refs: [tag.name]
					});
				}
			})
		];
		listBody = h("div", { className: "dshh-body" }, ...repoChildren);
	} else listBody = emptyBody;
	var body = wide ? h("div", { className: "dshh-workbench" }, h("div", {
		className: "dshh-leftpane",
		style: { width: 380 }
	}, listBody), commitMode && openCommit !== null ? h(CommitPane, {
		t,
		commit: openCommit,
		onOpenFile: function(file) {
			store.openCommitDiff(file);
		},
		activeFile: commitOpenFile,
		cursor: state.cursor,
		width: typeof state.commitWidth === "number" ? state.commitWidth : 240
	}) : null, commitMode && diffMode ? h("div", {
		className: "dshh-grip dshh-gripBetween",
		"data-dsh-hud": "grip-commit",
		title: t("diff.resizeCommit"),
		onPointerDown: function(event) {
			onGripPointerDown("commit", event);
		}
	}) : null, diffMode && openDiff !== null ? h(DiffView, {
		t,
		diff: openDiff,
		store,
		cwd: state.cwd
	}) : null) : listBody;
	return h("div", {
		className: "dshh-panel",
		"data-dsh-hud": "panel",
		style: panelStyle
	}, h("div", {
		className: "dshh-header",
		title: t("panel.dragHint"),
		onPointerDown: function(event) {
			onHeaderPointerDown(event);
		},
		onDoubleClick: onHeaderDoubleClick
	}, h("span", { className: "dshh-title" }, t("panel.title")), state.status && state.status.repo ? h("span", { className: "dshh-branch" }, branchLabel(state.status, t)) : null, h("span", { className: "dshh-spacer" }), h("button", {
		type: "button",
		className: "dshh-icon",
		title: t("panel.refresh"),
		"aria-label": t("panel.refresh"),
		onClick: function() {
			store.refresh();
		}
	}, "⟳"), h("button", {
		type: "button",
		className: "dshh-icon",
		title: t("panel.reset"),
		"aria-label": t("panel.reset"),
		onClick: function() {
			store.resetPanel();
		}
	}, "⌖"), h("button", {
		type: "button",
		className: "dshh-icon",
		title: t("panel.close"),
		"aria-label": t("panel.close"),
		onClick: function() {
			store.openPanel(false);
		}
	}, "✕")), body, diffMode ? h("div", {
		className: "dshh-grip",
		"data-dsh-hud": "grip",
		title: t("diff.resize"),
		onPointerDown: function(event) {
			onGripPointerDown("diff", event);
		}
	}) : commitMode ? h("div", {
		className: "dshh-grip",
		"data-dsh-hud": "grip-commit",
		title: t("diff.resizeCommit"),
		onPointerDown: function(event) {
			onGripPointerDown("commit", event);
		}
	}) : null, h("div", { className: "dshh-footer" }, h("span", null, t("panel.readonly")), h("span", null, state.updatedAt ? t("panel.updated") + timeLabel(state.updatedAt) : "")));
}

//#endregion
//#region src/client/components/pill-tip.ts
/**
* 胶囊悬停提示的气泡。**自己画**，不用浏览器原生 `title`。
*
* 由一个独立的 `shell.overlay` 座位渲染、`position:fixed` 定位 —— 这样它不受 dock 那行的
* 裁切与堆叠上下文限制。位置只用锚点矩形的 `top` 与 `right`：
* 贴在那枚胶囊**上方**，横向按视口夹住（不量自己的宽度，避免"先渲染再回填"的抖动）。
*/
function PillTip(props) {
	var store = props.store;
	var tip = useStore(store).tip;
	if (tip === null || tip === void 0) return null;
	var innerWidth = typeof window.innerWidth === "number" ? window.innerWidth : 1200;
	var innerHeight = typeof window.innerHeight === "number" ? window.innerHeight : 800;
	var margin = 8;
	var left = Math.max(margin, Math.min(typeof tip.rect.left === "number" ? tip.rect.left : margin, innerWidth - 428));
	var bottom = Math.max(margin, innerHeight - (typeof tip.rect.top === "number" ? tip.rect.top : 0) + 6);
	return h("div", {
		className: "dshh-tip",
		"data-dsh-hud": "pill-tip",
		role: "tooltip",
		style: {
			left: String(left) + "px",
			bottom: String(bottom) + "px"
		}
	}, tipLines(tip));
}
/**
* 把 `tip.lines` 画成一行一个元素。
*
* 为什么要拆元素：用户要「数字亮、标签灰」。一整段字符串在 DOM 里只有一个文本节点，
* 一种颜色，做不到；拆成行以后标签与数字各自带类名，颜色由 CSS 决定。
*
* 三种行：`label + value`（两段）、整行 `text` 带 `tone`、以及只有 `text` 的普通行。
*/
/** `tone` → 类名。默认（`primary`）不加类，走 `.dshh-tipValue` 的主文字色。 */
function toneClass(tone) {
	if (tone === "muted") return " dshh-tipMuted";
	if (tone === "success") return " dshh-tipSuccess";
	if (tone === "warn") return " dshh-tipWarn";
	if (tone === "accent") return " dshh-tipAccent";
	return "";
}
function tipLines(tip) {
	var lines = Array.isArray(tip.lines) ? tip.lines : [];
	if (lines.length === 0) return [tip.text];
	return lines.map(function(line, index) {
		if (Array.isArray(line.segments)) return h("div", {
			key: "line-" + index,
			className: "dshh-tipLine"
		}, line.segments.map(function(segment, at) {
			var segmentTone = segment.tone === void 0 ? toneClass(line.tone) : toneClass(segment.tone);
			return h("span", {
				key: "seg-" + at,
				className: "dshh-tipSeg" + segmentTone
			}, segment.text);
		}));
		if (typeof line.label === "string" || typeof line.value === "string") return h("div", {
			key: "line-" + index,
			className: "dshh-tipLine"
		}, h("span", {
			key: "label",
			className: "dshh-tipLabel"
		}, line.label ?? ""), h("span", {
			key: "value",
			className: "dshh-tipValue" + toneClass(line.tone)
		}, line.value ?? ""));
		return h("div", {
			key: "line-" + index,
			className: "dshh-tipLine" + toneClass(line.tone)
		}, line.text ?? "");
	});
}

//#endregion
//#region src/client/components/token-panel.ts
/**
* 「给这个中转站配一枚后台凭据」的小面板。
*
* 为什么要有它：中转站的**账号余额**（后台那个"当前余额"）挂在 new-api 的
* `/api/user/self` 上，只认后台凭据（PAT / 登录会话），`sk-` API Key 读不到。
* 没有这枚凭据，胶囊就只能报"本 Key 已用"。
*
* 而没有这个面板时，唯一的配法是让用户去手改 `~/.dsh/.credentials.yaml` ——
* 那是 DSH 的凭据库，手滑一个缩进整份凭据就读不出来了。所以这里做三件事：
*
*   1. 只问**一样东西**：令牌。引用名（`SITE_ACCESS_TOKEN`）由宿主从设置投影推导，
*      用户不用知道它叫什么；
*   2. 粘贴即存：`⌘V` 或按钮都行，存完立刻重取一次读数（`saveProviderToken` 里做）；
*   3. 令牌**不回显**：输入框 `type=password`，store 不持有它，宿主也不回传。
*
* 令牌本身从不进 localStorage、不进日志、不进快照 —— 它只走一次 RPC 到宿主的凭据服务。
*/
/**
* 后台凭据设置面板。
*
* 平时返回 `null`（不占位）；`tokenPanel.open` 为真时才渲染。
*
* @param props - 取词与 store。
* @returns 面板节点或 `null`。
*/
function TokenPanel(props) {
	var store = props.store;
	var t = props.t || function(key) {
		return key;
	};
	var panel = useStore(store).tokenPanel;
	var draftRef = react.default.useState("");
	var draft = draftRef[0];
	var setDraft = draftRef[1];
	react.default.useEffect(function() {
		if (!panel.open) setDraft("");
	}, [panel.open]);
	if (!panel.open) return null;
	var provider = panel.provider ?? "";
	/** 存一次；失败原因由 store 写进 `tokenPanel.error`。 */
	function submit() {
		var value = draft.trim();
		if (value === "" || panel.saving) return;
		setDraft("");
		store.saveProviderToken(value);
	}
	var children = [h("div", {
		key: "head",
		className: "dshh-tokenHead"
	}, h("span", {
		key: "title",
		className: "dshh-tokenTitle"
	}, t("balance.tokenTitle")), h("span", {
		key: "provider",
		className: "dshh-tokenProvider"
	}, provider)), h("div", {
		key: "hint",
		className: "dshh-tokenHint"
	}, t("balance.tokenHint"))];
	children.push(h("input", {
		key: "input",
		className: "dshh-tokenInput",
		"data-dsh-hud": "token-input",
		type: "password",
		value: draft,
		placeholder: t("balance.tokenPlaceholder"),
		spellCheck: false,
		autoComplete: "off",
		disabled: panel.saving,
		onInput: function(event) {
			var next = event && event.target ? event.target.value : "";
			setDraft(typeof next === "string" ? next : "");
		},
		onKeyDown: function(event) {
			if (event && event.key === "Enter") {
				if (typeof event.preventDefault === "function") event.preventDefault();
				submit();
			}
			if (event && event.key === "Escape") store.closeTokenPanel();
		}
	}));
	var refTitle = typeof panel.ref === "string" && panel.ref !== "" ? (panel.provider ?? "") + " · " + panel.ref : void 0;
	children.push(h("div", {
		key: "ref",
		className: "dshh-tokenRef",
		"data-dsh-hud": "token-ref",
		title: refTitle
	}, t("balance.tokenRef")));
	children.push(h("div", {
		key: "actions",
		className: "dshh-tokenActions",
		"data-dsh-hud": "token-actions"
	}, h("button", {
		key: "cancel",
		type: "button",
		className: "dshh-tokenCancel",
		"data-dsh-hud": "token-cancel",
		onClick: function() {
			store.closeTokenPanel();
		}
	}, t("balance.tokenCancel")), h("button", {
		key: "save",
		type: "button",
		className: "dshh-tokenSave",
		"data-dsh-hud": "token-save",
		disabled: panel.saving || draft.trim() === "",
		onClick: submit
	}, panel.saving ? t("balance.tokenSaving") : t("balance.tokenSave"))));
	if (panel.error !== null) children.push(h("div", {
		key: "error",
		className: "dshh-tokenError",
		role: "alert"
	}, t("balance.tokenError." + panel.error)));
	return h("div", {
		className: "dshh-tokenPanel",
		"data-dsh-hud": "token-panel",
		role: "dialog",
		"aria-label": t("balance.tokenTitle")
	}, children);
}

//#endregion
//#region src/client/components/sidebar.ts
/**
* 侧栏那两处按需展示：⋯ 菜单里的会话摘要、悬停卡片。
*/
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
	var t = props.t || function(key) {
		return key;
	};
	var sessionId = props.sessionId;
	var store = props.store;
	var state = useStore(store);
	if (!sessionId) return null;
	var row = state.rows && state.rows.byId ? state.rows.byId[sessionId] : void 0;
	var summary = rowSummaryOf(row);
	if (summary === null) return null;
	var head;
	if (summary.row.repo === true) {
		head = branchLabel(summary.row, t);
		if (summary.dirty === true) head += "*";
		var aheadOf = summary.row.ahead;
		var behindOf = summary.row.behind;
		if (typeof aheadOf === "number" && aheadOf > 0) head += " ↑" + String(aheadOf);
		if (typeof behindOf === "number" && behindOf > 0) head += " ↓" + String(behindOf);
		var counts = summary.shorthands.map(function(item) {
			return t("count." + item.key) + " " + String(item.value);
		}).join(" ");
		head += counts === "" ? " · " + t("panel.clean") : " · " + counts;
	} else if (summary.row.error !== null) head = t("rows.error", { code: String(summary.row.error) });
	else head = t("rows.noRepo");
	var own = [];
	if (summary.mine > 0) own.push(t("session.pill", { n: String(summary.mine) }));
	if (summary.possible > 0) own.push(t("rows.possible", {
		n: String(summary.possible),
		now: String(summary.possibleNow)
	}));
	var ownLine = own.length === 0 ? t("rows.ownNone") : own.join(" · ");
	return h("div", {
		className: "dshh-menureadout",
		"data-dsh-hud": "menu-readout",
		title: summary.row.cwd || void 0
	}, [h("div", {
		key: "git",
		className: "dshh-menureadoutLine"
	}, head), h("div", {
		key: "own",
		className: "dshh-menureadoutLine"
	}, ownLine)]);
}
/**
* 侧栏会话行**悬停卡片**里的那一块（座位 `sidebar.session.row.hover`）。
*
* 动作条那一枚只有图标级宽度（`!4 ●3`），明细放不下；悬停卡是宽敞的地方 ——
* 分支/上游、分类型计数、这个会话自己的改动，都在这里说清楚。
* 没有任何可说的（干净、且本会话没改过）就整块不画，卡片保持原来的样子。
*/
function SessionRowHoverChip(props) {
	var t = props.t || function(key) {
		return key;
	};
	var sessionId = props.sessionId;
	var store = props.store;
	var state = useStore(store);
	if (!sessionId) return null;
	var row = state.rows && state.rows.byId ? state.rows.byId[sessionId] : void 0;
	var summary = rowSummaryOf(row);
	if (summary === null) return null;
	var rowData = summary.row;
	var mineCount = summary.mine;
	var possibleCount = summary.possible;
	var shorthands = summary.shorthands;
	var lines = [];
	if (rowData.repo === true) {
		var head = branchLabel(rowData, t);
		if (rowData.dirty === true) head += "*";
		var aheadOf = rowData.ahead;
		var behindOf = rowData.behind;
		if (typeof aheadOf === "number" && aheadOf > 0) head += " ↑" + String(aheadOf);
		if (typeof behindOf === "number" && behindOf > 0) head += " ↓" + String(behindOf);
		if (shorthands.length > 0) head += " · " + shorthands.map(function(item) {
			return t("count." + item.key) + " " + String(item.value);
		}).join(" ");
		else head += " · " + t("panel.clean");
		lines.push(head);
	} else if (rowData.repo === false && rowData.error === null) lines.push(t("rows.noRepo"));
	if (rowData.error) lines.push(t("rows.error", { code: String(rowData.error) }));
	var own = [];
	if (mineCount > 0) own.push(t("session.pill", { n: String(mineCount) }));
	if (possibleCount > 0) own.push(t("rows.possible", {
		n: String(possibleCount),
		now: String(summary.possibleNow)
	}));
	lines.push(own.length === 0 ? t("rows.ownNone") : own.join(" · "));
	if (lines.length === 0) return null;
	return h("div", {
		className: "dshh-rowhover",
		"data-dsh-hud": "row-hover"
	}, lines.map(function(line, index) {
		return h("div", {
			key: String(index),
			className: "dshh-rowhoverLine"
		}, line);
	}));
}

//#endregion
//#region src/client/components/turn-images.ts
/**
* 轮尾那一行「本轮图片改动」：只列本轮动过的图，点缩略图走内置预览，⇄ 进 hud 看前后对比。
*/
/**
* 轮尾那条「本轮图片改动」：每项一张缩略图 + 文件名。
*
* 内置的改动卡片点一行是打开 review tab（图片在那儿看不见），这条是补上的门：
* **点缩略图 → 槽位给的 `openFile(path)`**，即内置的右侧文档预览（图片原生渲染、可缩放）；
* 旁边那个 `⇄` 才打开 dsh-hud 面板看前后两张 —— 前后对比只有我们有。
*/
function TurnImages(props) {
	var t = props.t;
	var store = props.store;
	var sessionId = props.sessionId;
	var useSessions = props.useSessions;
	var openFile = props.openFile;
	var turnNumber = turnNumberOf(props.turn);
	var sessions = typeof useSessions === "function" ? useSessions(function(snapshot) {
		return snapshot;
	}) : null;
	var summary = typeof sessionId === "string" && sessions && sessions.byId ? sessions.byId[sessionId] : void 0;
	var cwd = summary ? summary.cwd : void 0;
	var state = useStore(store);
	var bump = react.default.useState(0)[1];
	react.default.useEffect(function() {
		if (sessionId === void 0 || cwd === void 0) return void 0;
		store.bindSession(sessionId, cwd);
		if (state.sessionChanges === void 0 || state.sessionChanges.phase === "idle") store.loadSessionChanges();
	}, [sessionId, cwd]);
	var picked = imageChangesOf(state.sessionChanges, turnNumber);
	var shown = picked.files.slice(0, 4);
	var keys = shown.map(function(entry) {
		return entry.file;
	}).join("\0");
	react.default.useEffect(function() {
		if (keys === "" || typeof cwd !== "string") return void 0;
		const cwdOf = cwd;
		var cancelled = false;
		var wanted = shown.map(function(entry) {
			return {
				cwd: cwdOf,
				path: entry.file,
				side: "worktree"
			};
		}).filter(function(request) {
			return store.cachedImagePair(request) === null;
		});
		if (wanted.length === 0) return void 0;
		Promise.all(wanted.map(function(request) {
			return store.loadImagePair(request);
		})).then(function() {
			if (!cancelled) bump(function(count) {
				return count + 1;
			});
		});
		return function() {
			cancelled = true;
		};
	}, [keys, cwd]);
	if (state.sessionChanges === void 0 || state.sessionChanges.phase !== "ready") return null;
	if (shown.length === 0) return null;
	var rest = picked.files.length - shown.length;
	function chip(entry) {
		var thumb = thumbSideOf(typeof cwd === "string" ? store.cachedImagePair({
			cwd,
			path: entry.file,
			side: "worktree"
		}) : null);
		var dot = entry.name.lastIndexOf(".");
		var extension = dot > 0 ? entry.name.slice(dot + 1).toUpperCase() : "?";
		var hint = entry.file + " · " + t("turnImages.open");
		if (entry.tier === "possible" && entry.reason !== "") hint += " · " + t("session.possibleTitle", { reason: entry.reason });
		return h("span", {
			key: entry.file,
			className: "dshh-imgstripItem",
			"data-dsh-hud": "turn-image",
			"data-file": entry.file,
			"data-tier": entry.tier
		}, [h("button", {
			key: "open",
			type: "button",
			className: "dshh-imgstripOpen",
			title: hint,
			onClick: function() {
				if (typeof openFile === "function") openFile(entry.file);
			}
		}, [
			thumb === null ? h("span", {
				key: "ph",
				className: "dshh-imgstripThumb dshh-imgstripThumbEmpty"
			}, extension) : h("img", {
				key: "img",
				className: "dshh-imgstripThumb",
				alt: entry.name,
				src: "data:" + thumb.mime + ";base64," + String(thumb.base64 || "")
			}),
			entry.tier === "possible" ? h("span", {
				key: "tier",
				className: "dshh-imgstripTier",
				title: hint
			}, "◐") : null,
			h("span", {
				key: "name",
				className: "dshh-imgstripName"
			}, entry.name)
		]), h("button", {
			key: "compare",
			type: "button",
			className: "dshh-imgstripCompare",
			title: t("turnImages.compare"),
			"data-dsh-hud": "turn-image-compare",
			onClick: function() {
				var change = {
					file: entry.file,
					path: entry.file,
					origFile: null
				};
				store.openPanel(true);
				store.openDiff(change);
			}
		}, "⇄")]);
	}
	return h("div", {
		className: "dshh-imgstrip",
		"data-dsh-hud": "turn-images"
	}, [
		h("span", {
			key: "title",
			className: "dshh-imgstripTitle"
		}, picked.exact ? t("turnImages.title") : t("turnImages.titleSession")),
		h("span", {
			key: "items",
			className: "dshh-imgstripItems"
		}, shown.map(chip)),
		rest > 0 ? h("span", {
			key: "more",
			className: "dshh-imgstripMore"
		}, t("turnImages.more", { n: String(rest) })) : null
	]);
}
/**
* 从会话改动里挑出"这一轮改过的图片"，最近的在前。
*
* **两档都收**：`●` 确定改过（写文件 / 编辑工具）与 `◐` 命令旁听（`>`、`tee`、`cp`、`rm`…）。
* 只收确定档不够用 —— 图几乎都是脚本/命令产出的（`python gen.py`、`cp`、`curl -o`），
* 那些永远进不了确定档，而"点一下看图"对它们一样有用。`◐` 是猜的，所以 chip 上带 `◐`、
* 悬停给出那条命令（措辞与面板里改动清单一致）。
*
* 回合号拿不到（`turnNumberOf` 回 null）就不按回合收窄，退回"本会话最近的图片改动"。
*
* @returns `{ files, exact }`；`exact` 为 false 表示标题该说"本会话"而不是"本轮"。
*/
function imageChangesOf(changes, turnNumber) {
	if (changes === null || changes === void 0) return {
		files: [],
		exact: turnNumber !== null
	};
	var confirmed = changes.files ? changes.files : {};
	var guessed = changes.possible ? changes.possible : {};
	var picked = [];
	var seen = {};
	for (var file in confirmed) {
		if (!Object.prototype.hasOwnProperty.call(confirmed, file)) continue;
		if (!looksLikeImage(file)) continue;
		var record = confirmed[file] || {};
		if (turnNumber !== null) {
			if ((Array.isArray(record.turns) ? record.turns : []).indexOf(turnNumber) < 0 && record.lastTurn !== turnNumber) continue;
		}
		seen[file] = true;
		picked.push({
			file,
			name: baseNameOf(file),
			tier: "confirmed",
			reason: "",
			at: typeof record.lastAt === "number" ? record.lastAt : 0
		});
	}
	for (var guess in guessed) {
		if (!Object.prototype.hasOwnProperty.call(guessed, guess)) continue;
		if (seen[guess] === true) continue;
		if (!looksLikeImage(guess)) continue;
		var item = guessed[guess] || {};
		if (turnNumber !== null && item.lastTurn !== turnNumber) continue;
		seen[guess] = true;
		picked.push({
			file: guess,
			name: baseNameOf(guess),
			tier: "possible",
			reason: typeof item.reason === "string" ? item.reason : "",
			at: typeof item.lastAt === "number" ? item.lastAt : 0
		});
	}
	picked.sort(function(left, right) {
		return right.at - left.at;
	});
	return {
		files: picked,
		exact: turnNumber !== null
	};
}
/** 缩略图用哪一侧的字节：优先工作区，其次基线（新增/删除时只有一侧有）。 */
function thumbSideOf(entry) {
	var pair = entry !== null && entry !== void 0 && typeof entry === "object" ? entry : null;
	if (pair === null || pair.phase !== "ready" || !pair.value) return null;
	var value = pair.value;
	if (value.after && value.after.kind === "image") return value.after;
	if (value.before && value.before.kind === "image") return value.before;
	return null;
}
/**
* 槽位给的是宿主的 `TurnLocation`。
*
* 形状属于宿主内部约定（槽位文档只说"receives the Turn"），所以这里宽松取值：
* 取不到就回 null，由调用方退到"本会话"的说法，而不是整条不显示。
*/
function turnNumberOf(turn) {
	if (typeof turn === "number" && isFinite(turn)) return turn;
	if (turn !== null && turn !== void 0 && typeof turn === "object") {
		var record = turn;
		if (typeof record.turn === "number") return record.turn;
	}
	return null;
}
/** 只取文件名（chip 上放不下整条路径）。 */
function baseNameOf(file) {
	var parts = String(file).split("/");
	return parts[parts.length - 1] || String(file);
}

//#endregion
//#region src/client/composer.ts
/**
* 输入框（composer）读写与 ↑ 召回。
*
* 这里全部是**纯 DOM 操作**（Lexical 的 contenteditable），最讲究的是"写进去之后到底成没成"：
* 粘贴是异步落地的，所以每次写完都要等一拍再核对（`settleComposer`），否则会写第二遍。
*/
/**
* 结构类型 → 真 `Node`。运行时它本来就是 contenteditable 元素；`ComposerRoot` 只是为了让
* 测试里的假 DOM 也能满足，所以这里不做运行时检查，只把类型交回给 DOM API。
*/
function nodeOf(root) {
	return root;
}
/**
* 光标此刻允许上下翻历史吗？—— 照抄 OpenCode Desktop 的 `canNavigateHistoryAtCursor`。
*
* 它的规矩比 Codex 保守得多：**不在历史里时，`↑` 只在输入框完全为空时才接管**。
* 于是多行草稿里 `↑` 永远是光标移动，跟内置的 `/` 命令、`@` 提及弹窗也天然不冲突
* （弹窗必然带着文字）。进了历史之后，只要光标在两端就能继续翻。
*/
function canNavigatePromptHistory(direction, text, caret, inHistory) {
	var length = typeof text === "string" ? text.length : 0;
	var position = Math.max(0, Math.min(typeof caret === "number" ? caret : 0, length));
	if (inHistory) return position === 0 || position === length;
	if (direction === "up") return position === 0 && length === 0;
	return position === length;
}
/**
* `↑` / `↓` 翻 prompt 历史的**纯状态机**（语义照抄 OpenCode Desktop 的 `navigatePromptHistory`）。
*
* `index === -1` 表示"不在历史里"；`entries[0]` 是最新一条。往旧翻时先把当前草稿存进
* `draft`，一直翻到最新再往下就把草稿**原样放回**（连光标位置都按方向摆好：往旧放开头、
* 往新放末尾）。没接管的情况一律回 `handled: false`，调用方据此**不**调用 preventDefault。
*/
function promptHistoryStep(state, direction, input) {
	var entries = input && input.entries || [];
	var text = input && typeof input.text === "string" ? input.text : "";
	var caret = input && typeof input.caret === "number" ? input.caret : 0;
	var index = state.index;
	var draft = state.draft;
	if (!canNavigatePromptHistory(direction, text, caret, index >= 0)) return {
		handled: false,
		state
	};
	if (direction === "up") {
		if (entries.length === 0) return {
			handled: false,
			state
		};
		if (index === -1) return {
			handled: true,
			state: {
				index: 0,
				draft: text
			},
			text: entries[0],
			caret: "start"
		};
		if (index < entries.length - 1) return {
			handled: true,
			state: {
				index: index + 1,
				draft
			},
			text: entries[index + 1],
			caret: "start"
		};
		return {
			handled: false,
			state
		};
	}
	if (index > 0) return {
		handled: true,
		state: {
			index: index - 1,
			draft
		},
		text: entries[index - 1],
		caret: "end"
	};
	if (index === 0) return {
		handled: true,
		state: {
			index: -1,
			draft: null
		},
		text: draft === null || draft === void 0 ? "" : draft,
		caret: "end"
	};
	return {
		handled: false,
		state
	};
}
/**
* 从一个事件目标往上找"输入框根节点"。
*
* DSH 的输入框是 **Lexical** 的 contenteditable（根节点带 `data-lexical-editor="true"`），
* 不是 textarea —— 所以不能读 `value`。手写 parentElement 上溯（不用 `closest`）：
* 一来少依赖一个 API，二来深度有上限，绝不会误判到页面别处。
*/
function composerRootOf(target) {
	var node = target;
	for (var depth = 0; depth < 6 && node !== null && node !== void 0; depth += 1) {
		if (typeof node.getAttribute === "function") {
			var marker = node.getAttribute("data-lexical-editor");
			var editable = typeof node.isContentEditable === "boolean" ? node.isContentEditable : node.getAttribute("contenteditable") === "true";
			if (marker === "true" || editable) return node;
		}
		node = node.parentElement;
	}
	return null;
}
/** 输入框里的纯文本（Lexical 会把内容画在 DOM 里，`innerText` 最贴近用户看到的）。 */
function composerText(root) {
	if (root === null || root === void 0) return "";
	return (typeof root.innerText === "string" ? root.innerText : typeof root.textContent === "string" ? root.textContent : "").replace(/\u200b/g, "");
}
/**
* "输入框实际上是空的吗"用的归一化文本。
*
* Lexical 的空根节点在 DOM 里通常是 `<p><br></p>`，`innerText` 会给出一个换行符 ——
* 拿它当"有内容"就会让 `↑` 永远排不上队（整个功能静默失效）。所以去掉零宽字符与
* **只在末尾的空白**：开头的空格是用户真的敲进去的，不能吞。
*/
function composerTextKey(root) {
	return composerText(root).replace(/\s+$/, "");
}
/** 写入是否成功：两边都归一化再比 —— Lexical 可能补一个尾换行，那不是"没写进去"。 */
function composerTextMatches(text, expected) {
	return text.replace(/\s+$/, "") === expected.replace(/\s+$/, "");
}
/** 光标在输入框里的字符偏移；没有选区、有选中内容、或拿不到选区时回 null（一律不接管）。 */
function composerCaretOffset(root) {
	var selection = typeof window.getSelection === "function" ? window.getSelection() : null;
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed !== true) return null;
	var node = selection.focusNode;
	if (!node) return null;
	var range = document.createRange();
	range.selectNodeContents(nodeOf(root));
	var before = range.cloneRange();
	try {
		before.setEnd(node, selection.focusOffset);
	} catch (error) {
		return null;
	}
	return before.toString().length;
}
/** 把光标放到开头或末尾（`↑` 往旧翻放开头，`↓` 往回翻放末尾 —— 与 OpenCode 一致）。 */
function placeCaretInComposer(root, position) {
	var selection = typeof window.getSelection === "function" ? window.getSelection() : null;
	if (!selection) return;
	try {
		var range = document.createRange();
		range.selectNodeContents(nodeOf(root));
		range.collapse(position !== "end");
		selection.removeAllRanges();
		selection.addRange(range);
	} catch (error) {}
}
/** 全选输入框内容（模拟粘贴前先选中，粘贴才能"替换"而不是"追加"）。 */
function selectComposerContents(root) {
	var selection = typeof window.getSelection === "function" ? window.getSelection() : null;
	if (!selection) return;
	try {
		var range = document.createRange();
		range.selectNodeContents(nodeOf(root));
		selection.removeAllRanges();
		selection.addRange(range);
	} catch (error) {}
}
/** 等"写入落地"：微任务总有，有 rAF 的浏览器里再多等一帧（Lexical 的粘贴是帧后落 DOM）。 */
function settleComposer() {
	var chain = Promise.resolve();
	if (typeof window.requestAnimationFrame === "function") chain = chain.then(function() {
		return new Promise(function(resolve) {
			window.requestAnimationFrame(function() {
				resolve();
			});
		});
	});
	return chain;
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
function writeComposerText(root, value, caret) {
	function satisfied() {
		return composerTextMatches(composerText(root), value);
	}
	return settleComposer().then(function() {
		if (typeof window.ClipboardEvent !== "function" || typeof window.DataTransfer !== "function") return false;
		if (typeof root.dispatchEvent !== "function") return false;
		try {
			selectComposerContents(root);
			var data = new window.DataTransfer();
			data.setData("text/plain", value);
			root.dispatchEvent(new window.ClipboardEvent("paste", {
				clipboardData: data,
				bubbles: true,
				cancelable: true
			}));
		} catch (error) {
			return false;
		}
		return settleComposer().then(satisfied);
	}).then(function(wrote) {
		if (wrote) return true;
		try {
			if (typeof document.execCommand === "function") {
				selectComposerContents(root);
				if (document.execCommand("insertText", false, value) === true) return settleComposer().then(satisfied);
			}
		} catch (error) {}
		return settleComposer().then(function() {
			if (satisfied()) return true;
			try {
				selectComposerContents(root);
				root.textContent = value;
				if (typeof window.Event === "function") root.dispatchEvent(new window.Event("input", { bubbles: true }));
				return true;
			} catch (error) {
				return false;
			}
		});
	}).then(function(wrote) {
		if (!wrote) return false;
		placeCaretInComposer(root, caret);
		if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(function() {
			placeCaretInComposer(root, caret);
		});
		return true;
	});
}
/**
* 把"输入框里按 ↑/↓ 召回上一条 prompt"接到窗口上 —— 只接线，判断与翻页逻辑都在纯函数里。
*
* 门禁（任一不满足就**完全不介入**，`↑`/`↓` 行为与不装插件时一模一样）：
* 默认行为没被别处吃掉、不是输入法组合中、无修饰键、目标是输入框、历史非空、
* 选区收起、光标位置通过 `canNavigatePromptHistory`。**接管了才 preventDefault**。
*/
function bindPromptHistory(store) {
	var nav = {
		sessionId: null,
		index: -1,
		draft: null,
		writing: false
	};
	function onKeyDown(event) {
		if (event === null || event === void 0) return;
		if (event.defaultPrevented === true || event.isComposing === true) return;
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
		if (event.altKey === true || event.ctrlKey === true || event.metaKey === true) return;
		if (typeof event.preventDefault !== "function") return;
		var root = composerRootOf(event.target);
		if (root === null) return;
		var snapshot = store.getSnapshot().promptHistory;
		var value = snapshot !== null && snapshot !== void 0 && snapshot.sessionId !== null ? snapshot.value : null;
		var entries = value !== null && value !== void 0 && value.available === true && Array.isArray(value.prompts) ? value.prompts : [];
		if (entries.length === 0) return;
		if (nav.sessionId !== snapshot.sessionId) {
			nav.sessionId = snapshot.sessionId;
			nav.index = -1;
			nav.draft = null;
		}
		var caret = composerCaretOffset(root);
		if (caret === null) return;
		var direction = event.key === "ArrowUp" ? "up" : "down";
		var text = composerTextKey(root);
		var step = promptHistoryStep({
			index: nav.index,
			draft: nav.draft
		}, direction, {
			entries,
			text,
			caret: Math.max(0, Math.min(caret, text.length))
		});
		if (!step.handled) return;
		event.preventDefault();
		if (typeof event.stopPropagation === "function") event.stopPropagation();
		var previous = {
			index: nav.index,
			draft: nav.draft
		};
		nav.index = step.state.index;
		nav.draft = step.state.draft;
		nav.writing = true;
		writeComposerText(root, step.text, step.caret).then(function(wrote) {
			nav.writing = false;
			if (wrote === true) {
				probe.log("prompt-history", {
					index: nav.index,
					entries: entries.length,
					direction
				});
				return;
			}
			nav.index = previous.index;
			nav.draft = previous.draft;
			probe.log("prompt-history: 写不进输入框（三层都失败），已回滚并放弃接管", { entries: entries.length });
		});
	}
	/** 用户自己动了内容（不是我们写进去的）→ 退出历史、草稿作废，免得把草稿还原到新内容上。 */
	function onInput(event) {
		if (nav.writing) return;
		if (composerRootOf(event && event.target) === null) return;
		nav.index = -1;
		nav.draft = null;
	}
	if (typeof window.addEventListener !== "function") return function() {};
	window.addEventListener("keydown", onKeyDown, true);
	window.addEventListener("input", onInput, true);
	return function() {
		window.removeEventListener("keydown", onKeyDown, true);
		window.removeEventListener("input", onInput, true);
	};
}

//#endregion
//#region src/client/i18n.ts
/**
* 两份词典（`dshHud` 命名空间）。键一致、值分别是中文与英文；`t()` 取不到会回落成键本身，
* 所以"漏翻"会直接显示给人看 —— 有一条用例专门盯这件事（它扫的是源码，不是产物）。
*/
const zh = {
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
	"panel.tags": "标签",
	"panel.tagsEmpty": "这个仓库还没有标签",
	"panel.tagsCapped": "只显示最近 {n} 个",
	"tag.click": "点一下看它指向的提交",
	"tag.annotated": "附注标签",
	"tag.lightweight": "轻量标签",
	"diff.close": "关闭差异",
	"diff.resize": "拖动右边缘调整差异宽度",
	"diff.resizeCommit": "拖动调整提交明细栏宽度",
	"diff.worktree": "未暂存",
	"diff.index": "已暂存",
	"diff.wrap": "自动换行",
	"diff.copy": "复制差异",
	"diff.copied": "已复制",
	"diff.empty": "这一侧没有差异",
	"diff.binary": "二进制文件，没有可显示的文本差异",
	"image.loading": "读取图片…",
	"image.pair": "并排",
	"image.flip": "切换",
	"image.beforeWorktree": "索引",
	"image.afterWorktree": "工作区",
	"image.beforeIndex": "HEAD",
	"image.afterIndex": "索引",
	"image.beforeCommit": "父提交",
	"image.afterCommit": "这次提交",
	"image.dims": "{w}×{h}",
	"image.dimsChanged": "尺寸 {from} → {to}",
	"image.tooLarge": "超过 {limit} MB 预览上限（{size}）",
	"image.notImage": "不是可预览的图片（{size}）",
	"image.missing": "这一侧没有这个文件",
	"image.zoomOut": "缩小",
	"image.zoomIn": "放大",
	"image.fitWidth": "适应宽度",
	"image.zoomValue": "{percent}%",
	"timer.title": "本次会话运行时长",
	"timer.created": "创建于 {time}",
	"timer.work": "其中模型 {llm}、工具 {tool}",
	"timer.turns": "{turns} 轮 / {steps} 步",
	"balance.title": "DeepSeek 账号余额",
	"balance.bonus": "赠送余额",
	"balance.updated": "更新于 {time}",
	"balance.stale": "最近一次刷新失败，显示的是 {time} 的数",
	"balance.delta": "较上次刷新 {delta}（{time}）",
	"balance.providerRemaining": "余额 {amount}",
	"balance.providerUsedKey": "本 Key 已用 {amount}",
	"balance.providerUsedAccount": "账号已用 {amount}",
	"balance.providerRequests": "API 请求 {count}",
	"balance.tokenTitle": "添加访问令牌",
	"balance.tokenHint": "去站点「个人设置 → 访问令牌」新建，权限勾 profile:read，粘贴即可",
	"balance.tokenPlaceholder": "粘贴访问令牌",
	"balance.tokenSave": "保存",
	"balance.tokenSaving": "保存中…",
	"balance.tokenCancel": "取消",
	"balance.tokenRef": "只存储于本地",
	"balance.tokenError.unknown-provider": "不认识这个提供方，先确认会话用的模型来自哪个站",
	"balance.tokenError.not-supported": "这个站不支持后台令牌",
	"balance.tokenError.no-credentials": "凭据服务不可用",
	"balance.tokenError.bad-token": "令牌格式不对（不该有空格或换行）",
	"balance.tokenError.failed": "保存失败，稍后再试",
	"balance.tokenError.unsupported": "这个宿主不支持在这里保存",
	"balance.tokenError.reason": "保存失败",
	"balance.usedShort": "已用",
	"balance.providerUnknown": "--",
	"balance.reason.unsupported": "该站不提供余额接口",
	"balance.reason.no-key": "未配置密钥",
	"balance.reason.network": "网络失败",
	"balance.reason.unknown-provider": "模型来源不在设置里",
	"balance.reason.no-provider": "会话还没定下模型来源",
	"balance.reason.no-session": "会话还没就绪",
	"turnImages.title": "本轮图片改动",
	"turnImages.titleSession": "本会话图片改动",
	"turnImages.open": "在内置预览里打开",
	"turnImages.compare": "在 dsh-hud 里前后对比",
	"turnImages.more": "还有 {n} 个",
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
	"session.line": "本会话改过 {n} 个文件",
	"tools.now": "现在在跑：{name}",
	"tools.total": "本会话共 {n} 次工具调用",
	"tools.byTool": "各工具：",
	"tools.skills": "skills:",
	"tools.recent": "最近：",
	"rows.ownNone": "本会话没有改动记录",
	"rows.noRepo": "不在 git 仓库里",
	"rows.error": "读取失败（{code}）",
	"rows.possible": "命令旁听到 {n} 个可能改动的路径（{now} 个现在有差异）",
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
	"err.transport": "无法连接到宿主半"
};
const en = {
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
	"panel.tags": "Tags",
	"panel.tagsEmpty": "No tags in this repository yet",
	"panel.tagsCapped": "Showing the newest {n}",
	"tag.click": "Click to open the commit it points at",
	"tag.annotated": "Annotated tag",
	"tag.lightweight": "Lightweight tag",
	"diff.close": "Close diff",
	"diff.resize": "Drag the right edge to resize the diff",
	"diff.resizeCommit": "Drag to resize the commit pane",
	"diff.worktree": "Unstaged",
	"diff.index": "Staged",
	"diff.wrap": "Wrap lines",
	"diff.copy": "Copy diff",
	"diff.copied": "Copied",
	"diff.empty": "No changes on this side",
	"diff.binary": "Binary file — no text diff to show",
	"image.loading": "Reading image…",
	"image.pair": "Side by side",
	"image.flip": "Flip",
	"image.beforeWorktree": "index",
	"image.afterWorktree": "worktree",
	"image.beforeIndex": "HEAD",
	"image.afterIndex": "index",
	"image.beforeCommit": "parent",
	"image.afterCommit": "this commit",
	"image.dims": "{w}×{h}",
	"image.dimsChanged": "size {from} → {to}",
	"image.tooLarge": "over the {limit} MB preview limit ({size})",
	"image.notImage": "not a previewable image ({size})",
	"image.missing": "not present on this side",
	"image.zoomOut": "Zoom out",
	"image.zoomIn": "Zoom in",
	"image.fitWidth": "Fit width",
	"image.zoomValue": "{percent}%",
	"timer.title": "This session's running time",
	"timer.created": "started {time}",
	"timer.work": "model {llm}, tools {tool}",
	"timer.turns": "{turns} turns / {steps} steps",
	"balance.title": "DeepSeek account balance",
	"balance.bonus": "Bonus balance",
	"balance.updated": "updated {time}",
	"balance.stale": "Last refresh failed; this is the balance from {time}",
	"balance.delta": "{delta} since last refresh ({time})",
	"balance.providerRemaining": "balance {amount}",
	"balance.providerUsedKey": "{amount} used on this key",
	"balance.providerUsedAccount": "{amount} used on this account",
	"balance.providerRequests": "API requests {count}",
	"balance.tokenTitle": "Add a dashboard access token",
	"balance.tokenHint": "This site only exposes its current balance to a dashboard session (API keys cannot read it). Create an access token with the profile:read scope in the site settings, then paste it here.",
	"balance.tokenPlaceholder": "Paste access token",
	"balance.tokenSave": "Save",
	"balance.tokenSaving": "Saving…",
	"balance.tokenCancel": "Cancel",
	"balance.tokenRef": "Stored locally only",
	"balance.tokenError.unknown-provider": "Unknown provider — check which site this session’s model comes from",
	"balance.tokenError.not-supported": "This site does not support dashboard tokens",
	"balance.tokenError.no-credentials": "Credentials service unavailable",
	"balance.tokenError.bad-token": "Malformed token (it must not contain spaces or newlines)",
	"balance.tokenError.failed": "Could not save; try again",
	"balance.tokenError.unsupported": "This host cannot save tokens here",
	"balance.tokenError.reason": "Could not save",
	"balance.usedShort": "used",
	"balance.providerUnknown": "--",
	"balance.reason.unsupported": "this site exposes no balance API",
	"balance.reason.no-key": "no key configured",
	"balance.reason.network": "network failure",
	"balance.reason.unknown-provider": "model provider not in settings",
	"balance.reason.no-provider": "session has no model provider yet",
	"balance.reason.no-session": "session not ready",
	"turnImages.title": "Images this turn",
	"turnImages.titleSession": "Images this session",
	"turnImages.open": "Open in the built-in preview",
	"turnImages.compare": "Compare before/after in dsh-hud",
	"turnImages.more": "{n} more",
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
	"tools.skills": "skills:",
	"tools.recent": "Recent:",
	"rows.ownNone": "this session has no recorded changes",
	"rows.noRepo": "not in a git repository",
	"rows.error": "read failed ({code})",
	"rows.possible": "{n} path(s) commands may have touched ({now} still differ)",
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
	"err.transport": "Cannot reach the host half"
};

//#endregion
//#region src/client/model-watch.ts
/** 多久检查一次"这个会话的投影挂上了没"（纯本地读取，不发请求）。 */
const BIND_RETRY_MS = 2e3;
/**
* 从投影读数里取"当前属于哪个提供方"。
*
* `pending` 优先：菜单里刚点下的那个模型还没真正用过，但账本已经该换了 ——
* 胶囊跟的是"接下来要花谁的钱"，不是"上一次花了谁的钱"。
*/
function providerOf(value) {
	if (value === null || typeof value !== "object") return null;
	const chosen = value.pending ?? value.lastUsed;
	if (chosen === null || typeof chosen !== "object") return null;
	const provider = chosen.provider;
	return typeof provider === "string" && provider !== "" ? provider : null;
}
/**
* 盯着当前会话的 `modelSelection`：提供方一变就**立刻**重取一次余额。
*
* @param ctx - 客户端插件上下文（只用 `get`）。
* @param store - 共享 store（`loadProviderBalance(true)` 会跳过 TTL）。
* @returns 卸载函数（停掉定时器与订阅）。
*/
function watchModelSelection(ctx, store) {
	const raw = ctx.get("sessions");
	if (raw === void 0 || raw === null || typeof raw.binding !== "function") return function() {};
	const sessions = raw;
	let disposed = false;
	let boundSession = null;
	let unsubscribe = null;
	let lastProvider = null;
	let retry = null;
	/** 投影还没就绪时才需要补挂；挂上了就把定时器停掉（不白跑）。 */
	function startRetry() {
		if (retry !== null || disposed) return;
		retry = window.setInterval(function() {
			sync(store.getSnapshot());
		}, BIND_RETRY_MS);
	}
	function stopRetry() {
		if (retry === null) return;
		window.clearInterval(retry);
		retry = null;
	}
	function detach() {
		if (unsubscribe !== null) {
			const stop = unsubscribe;
			unsubscribe = null;
			try {
				stop();
			} catch {}
		}
		boundSession = null;
		lastProvider = null;
	}
	/** 把订阅挂到当前会话的投影上（投影/绑定还没就绪就下次再试）。 */
	function attach(sessionId) {
		const faceOf = (sessions.binding?.(sessionId))?.session?.projections?.faceOf;
		if (typeof faceOf !== "function") return;
		let face;
		try {
			face = faceOf("modelSelection");
		} catch {
			return;
		}
		if (face === void 0 || face === null || typeof face.subscribe !== "function") return;
		boundSession = sessionId;
		stopRetry();
		lastProvider = providerOf(face.getSnapshot());
		unsubscribe = face.subscribe(function() {
			if (disposed) return;
			const next = providerOf(face.getSnapshot());
			if (next === null || next === lastProvider) return;
			lastProvider = next;
			store.loadProviderBalance(true);
		});
	}
	/** 看一眼当前会话，必要时重挂。 */
	function sync(state) {
		if (disposed) return;
		const sessionId = state.sessionId;
		if (typeof sessionId !== "string" || sessionId === "") {
			detach();
			return;
		}
		if (sessionId === boundSession) return;
		detach();
		attach(sessionId);
		if (boundSession === null) startRetry();
	}
	const stopStore = store.subscribe(function() {
		sync(store.getSnapshot());
	});
	sync(store.getSnapshot());
	return function() {
		disposed = true;
		stopRetry();
		stopStore();
		detach();
	};
}

//#endregion
//#region src/client/store/account.ts
/**
* 建「账号余额」这一片。
* @param ctx - 客户端根上下文（用到 `effect` / `inject` / `locale`）。
* @param getState - 读当前快照。
* @param set - 浅合并写快照。
* @returns 本片对外暴露的方法。
*/
function createAccountSlice(ctx, getState, set) {
	/** 账号命名空间；没注入到就是 `null`（这个宿主没有账号插件，或还没起来）。 */
	var accountService = null;
	/** 启动清单服务：只借用它的 `manifest.release.version`。 */
	var modulesService = null;
	/** 平台链接（用量页 / 充值页）：`getState()` 给，取到一次就一直用。 */
	var links = {
		usageUrl: null,
		topUpUrl: null
	};
	/** 在途请求：三次触发撞到一起时共用一次。 */
	var inflight = null;
	/** 上次真正发请求的时刻（TTL 的起点）。 */
	var lastAttemptAt = 0;
	/** 上次的结果档位：成功用长 TTL，其它用短 TTL。 */
	var lastReady = false;
	if (typeof ctx.inject === "function") {
		ctx.effect(function() {
			return ctx.inject(["remote", "remote.account"], function(scope) {
				accountService = scope.remote && scope.remote.account ? scope.remote.account : null;
				probe.log("account", { bound: accountService !== null });
				if (accountService !== null) loadBalance();
				return function() {
					accountService = null;
				};
			});
		}, "dsh-hud: account service");
		ctx.effect(function() {
			return ctx.inject(["modules"], function(scope) {
				modulesService = scope.modules || null;
				if (modulesService !== null) loadBalance();
				return function() {
					modulesService = null;
				};
			});
		}, "dsh-hud: boot manifest");
	}
	/**
	* 宿主这一版的版本号。
	*
	* 为什么非要它：账号接口的调用元数据要带 `x-client-version`，而 DSH 内置插件那半边
	* 是打包时**内联**了版本常量的（`"0.2.1-rc.3"`），外部插件的产物里没有这行字面量。
	* 所以从启动清单里现取：`window.__DSH_BOOT__.release.version` 是宿主自己发布在每份
	* 图里的发布身份，`ctx.modules.manifest.release.version` 是同一份数据的服务视角。
	* 两条都取不到就**不发请求**（宁可没有这一枚胶囊，也不要带一个假版本号去问平台）。
	*
	* @returns 版本字符串；都取不到回 `null`。
	*/
	function releaseVersion() {
		var boot = globalThis.__DSH_BOOT__;
		var fromBoot = boot && boot.release ? boot.release.version : void 0;
		if (typeof fromBoot === "string" && fromBoot !== "") return fromBoot;
		var manifest = modulesService ? modulesService.manifest : null;
		var fromModules = manifest && manifest.release ? manifest.release.version : void 0;
		if (typeof fromModules === "string" && fromModules !== "") return fromModules;
		return null;
	}
	/** 当前界面语言（宿主再把它折成平台用的 `zh_CN` / `en_US`）。 */
	function activeLocale() {
		try {
			var locale = ctx.locale;
			var snapshot = locale && typeof locale.getSnapshot === "function" ? locale.getSnapshot() : null;
			var active = snapshot && snapshot.active;
			if (typeof active === "string" && active !== "") return active;
		} catch (error) {}
		return "en-US";
	}
	/**
	* 读账号投影里的两个平台链接。
	*
	* 为什么单独要它：余额接口只回钱包，**累计消耗 / 本月消耗只在平台用量页上**
	* （平台页还有「今天 / 本月 / 自定」那种时间维度，DSH 不代理那份数据）。
	* 这一枚胶囊因此提供一条直达那一页的路 —— 链接从账号投影里拿，不写死域名。
	*
	* `getState` 是直连方法（不碰网络），也不是所有宿主版本都有：缺了就安静地
	* 返回上一次的值，胶囊退化成"只有余额"。
	*
	* @param service - 账号命名空间。
	* @returns 两个链接（取不到就是上一次的、可能都是 `null`）。
	*/
	function readLinks(service) {
		if (typeof service.getState !== "function") return Promise.resolve(links);
		return Promise.resolve().then(function() {
			return service.getState();
		}).then(function(result) {
			var value = result && result.ok === true ? result.value : null;
			var next = value && value.links ? value.links : null;
			if (next === null) return links;
			var usageUrl = typeof next.usageUrl === "string" ? next.usageUrl : null;
			var topUpUrl = typeof next.topUpUrl === "string" ? next.topUpUrl : null;
			if (usageUrl === null && topUpUrl === null) return links;
			return {
				usageUrl,
				topUpUrl
			};
		}).catch(function() {
			return links;
		});
	}
	/** 账号接口的调用元数据（时区偏移按"东为正"给，与 DSH 自己一致）。 */
	function clientMetadata(version) {
		return {
			version,
			locale: activeLocale(),
			timezoneOffsetSeconds: -(/* @__PURE__ */ new Date()).getTimezoneOffset() * 60
		};
	}
	/** 平台给的数组 → 本片的钱包列表（逐项校验；形状不对的项直接丢，不猜）。 */
	function walletsOf(value) {
		if (!Array.isArray(value)) return [];
		var out = [];
		for (var index = 0; index < value.length; index += 1) {
			var item = value[index];
			if (!item || typeof item !== "object") continue;
			if (typeof item.currency !== "string" || typeof item.balance !== "string") continue;
			out.push({
				currency: item.currency,
				balance: item.balance
			});
		}
		return out;
	}
	/** 两份快照的账目是否一致（一致就不 set，省一次重渲染）。 */
	function sameWallets(left, right) {
		if (left.length !== right.length) return false;
		for (var index = 0; index < left.length; index += 1) {
			if (left[index].currency !== right[index].currency) return false;
			if (left[index].balance !== right[index].balance) return false;
		}
		return true;
	}
	function publish(next) {
		var previous = getState().balance;
		if (next === null) {
			if (previous !== null) set({ balance: null });
			return null;
		}
		var previousPrev = previous !== null && previous.prev ? previous.prev.at : null;
		var nextPrev = next.prev ? next.prev.at : null;
		if (!(previous !== null && previous.failed === next.failed && previous.usageUrl === next.usageUrl && previousPrev === nextPrev && sameWallets(previous.wallets, next.wallets) && sameWallets(previous.bonus, next.bonus))) set({ balance: next });
		return next;
	}
	/** 读失败：留着上一次的数字、打上 `failed`，让界面能说"可能已过期"。 */
	function markFailed() {
		lastReady = false;
		var previous = getState().balance;
		if (previous === null) {
			probe.log("balance", {
				failed: true,
				had: false
			});
			return null;
		}
		probe.log("balance", {
			failed: true,
			had: true
		});
		return publish({
			wallets: previous.wallets,
			bonus: previous.bonus,
			at: previous.at,
			failed: true,
			usageUrl: previous.usageUrl,
			topUpUrl: previous.topUpUrl,
			prev: previous.prev || {
				wallets: previous.wallets,
				at: previous.at
			}
		});
	}
	/**
	* 取一次余额。
	* @param force - 跳过 TTL（点击胶囊时用）。
	* @returns 最新快照；没法取时回上一次的（可能为 `null`）。**从不 reject**。
	*/
	function loadBalance(force) {
		var now = Date.now();
		if (force !== true && lastAttemptAt !== 0) {
			var ttl = lastReady ? BALANCE_TTL_MS : BALANCE_RETRY_MS;
			if (now - lastAttemptAt < ttl) return Promise.resolve(getState().balance);
		}
		if (accountService === null) return Promise.resolve(getState().balance);
		var version = releaseVersion();
		if (version === null) {
			probe.log("balance", { skipped: "no-release-version" });
			return Promise.resolve(getState().balance);
		}
		if (inflight !== null) return inflight;
		var service = accountService;
		lastAttemptAt = now;
		inflight = Promise.resolve().then(function() {
			return Promise.all([service.getBalance(clientMetadata(version)), readLinks(service)]);
		}).then(function(pair) {
			links = pair[1];
			inflight = null;
			var result = pair[0];
			if (!result || result.ok !== true) return markFailed();
			var payload = result.value;
			if (payload === null || payload === void 0) {
				lastReady = false;
				probe.log("balance", { signedOut: true });
				return publish(null);
			}
			if (payload.status !== "ready") return markFailed();
			var wallets = walletsOf(payload.value);
			var bonus = walletsOf(payload.bonusWallets).filter(function(wallet) {
				return isPositiveAmount(wallet.balance);
			});
			if (wallets.length === 0 && bonus.length === 0) {
				lastReady = false;
				probe.log("balance", { empty: true });
				return publish(null);
			}
			lastReady = true;
			var at = Date.now();
			var before = getState().balance;
			probe.log("balance", {
				wallets: wallets.length,
				bonus: bonus.length
			});
			return publish({
				wallets,
				bonus,
				at,
				failed: false,
				usageUrl: links.usageUrl,
				topUpUrl: links.topUpUrl,
				prev: before !== null ? {
					wallets: before.wallets,
					at: before.at
				} : null
			});
		}).catch(function(error) {
			inflight = null;
			probe.log("balance", { thrown: error instanceof Error ? error.message : String(error) });
			return markFailed();
		});
		return inflight;
	}
	return { loadBalance };
}

//#endregion
//#region src/client/store/provider.ts
/** 同一会话两次取数的最小间隔（宿主侧缓存一分钟，这里配合它不空转）。 */
const PROVIDER_TTL_MS = 6e4;
/** 没取到时多久再试。 */
const PROVIDER_RETRY_MS = 3e4;
/**
* 失败后的第一次重试间隔，之后逐次翻倍，到 `PROVIDER_RETRY_MS` 封顶。
*
* 为什么要退避而不是一上来就 30 秒：重启/刚开会话时**宿主常常还答不上来**
*（模型选择投影还没就绪），第一次问必然落空。用固定 30 秒兜的话，胶囊要空半分钟 ——
* 用户看到的就是"重启后没立即显示"。1 秒起、翻倍到 30 秒，正常情况一两秒内就出来了，
* 而真出故障时也不会变成每秒一次的重试风暴。
*/
const PROVIDER_RETRY_BASE_MS = 1e3;
/** 端点名（宿主半 `rpc.ts` 里登记的那个）。 */
const ENDPOINT = "provider-balance";
/** 一个可展示的钱包列表（逐项校验，形状不对的项直接丢，不猜）。 */
function walletsOf(value) {
	if (!Array.isArray(value)) return [];
	var out = [];
	for (var index = 0; index < value.length; index += 1) {
		var item = value[index];
		if (!item || typeof item !== "object") continue;
		if (typeof item.currency !== "string" || typeof item.balance !== "string") continue;
		out.push({
			currency: item.currency,
			balance: item.balance
		});
	}
	return out;
}
/** 十进制字符串校验（不合法就当没给）。 */
function amountOf(value) {
	if (typeof value !== "string") return null;
	var raw = value.trim();
	return /^-?\d+(?:\.\d+)?$/.test(raw) ? raw : null;
}
/** 端点答复 → 快照；形状不对回 `null`（当作"读不到"）。 */
function balanceOf(payload) {
	if (payload.available !== true || payload.account === true) return null;
	var raw = payload.balance;
	if (raw === null || typeof raw !== "object") return null;
	var item = raw;
	if (typeof item.provider !== "string" || item.provider === "") return null;
	if (item.kind !== "official" && item.kind !== "relay") return null;
	var remaining = amountOf(item.remaining);
	var usedAccount = amountOf(item.usedAccount);
	var usedKey = amountOf(item.usedKey);
	var requests = typeof item.requests === "number" && Number.isFinite(item.requests) ? item.requests : null;
	var wallets = walletsOf(item.wallets);
	if (remaining === null && usedAccount === null && usedKey === null && wallets.length === 0) return null;
	return {
		provider: item.provider,
		kind: item.kind,
		currency: typeof item.currency === "string" && item.currency !== "" ? item.currency : null,
		remaining,
		usedAccount,
		usedKey,
		requests,
		placeholderLimit: item.placeholderLimit === true,
		wallets,
		bonus: walletsOf(item.bonus),
		at: typeof item.at === "number" && Number.isFinite(item.at) ? item.at : Date.now()
	};
}
/**
* 失败答复里的"是哪个提供方 / 为什么读不到"。
*
* 有这两个字段，胶囊就能画成 `站名 —`（并说清是"该站没有余额接口"还是"没配密钥"），
* 而不是直接消失 —— 消失分不清"这个站真的没有"和"插件坏了"。
*
* @param result - 宿主的答复信封。
* @returns `{provider, reason}`；读不出就给 `null`（调用方按无信息处理）。
*/
function failureFieldsOf(result) {
	var payload = result?.value;
	if (payload === null || typeof payload !== "object") return {
		provider: null,
		reason: null
	};
	var item = payload;
	return {
		provider: typeof item.provider === "string" && item.provider !== "" ? item.provider : null,
		reason: typeof item.reason === "string" && item.reason !== "" ? item.reason : null
	};
}
/** 宿主给的「后台凭据配了没」；形状不对就当没有（老宿主不给这个字段）。 */
function tokenOf(payload) {
	if (payload === null || typeof payload !== "object") return null;
	var item = payload.token;
	if (item === null || typeof item !== "object") return null;
	var token = item;
	if (typeof token.ref !== "string" || token.ref === "") return null;
	return {
		ref: token.ref,
		configured: token.configured === true
	};
}
/**
* 建「提供方余额」这一片。
* @param ctx - 客户端根上下文（只用 `connection.rpc`）。
* @param getState - 读当前快照。
* @param set - 浅合并写快照。
* @returns 本片对外暴露的方法。
*/
/**
* 失败后的重试间隔：1s、2s、4s、8s、16s，然后封顶在 `PROVIDER_RETRY_MS`。
*
* @param failStreak - 连续失败次数（0 = 还没失败过）。
* @returns 毫秒。
*/
function providerRetryDelayMs(failStreak) {
	if (!(failStreak > 0)) return PROVIDER_RETRY_BASE_MS;
	var delay = PROVIDER_RETRY_BASE_MS * Math.pow(2, failStreak - 1);
	return delay > 3e4 ? PROVIDER_RETRY_MS : delay;
}
function createProviderSlice(ctx, getState, set) {
	/** 在途请求（一次只打一个）。 */
	var inflight = null;
	/** 请求代次：每发一次 +1，落地时对不上号就作废（见 `loadProviderBalance`）。 */
	var requestTicket = 0;
	/** 连续失败次数（成功即归零）：只用来算退避间隔。 */
	var failStreak = 0;
	/** 上次真正发请求的时刻。 */
	var lastAttemptAt = 0;
	/** 上次取数针对哪个会话 —— 换了会话就必须重取，不能吃上一个会话的账本。 */
	var lastSessionId = null;
	/** 上次是成功（长 TTL）还是失败（短 TTL）。 */
	var lastReady = false;
	/** 写一份新结论（没变化就不 set，省一次重渲染）。 */
	function publish(mode, balance, extra, token) {
		var previous = getState().provider;
		var nextToken = token === void 0 ? previous?.token ?? null : token;
		var next = {
			mode,
			balance,
			provider: extra?.provider ?? balance?.provider ?? null,
			reason: extra?.reason ?? null,
			token: nextToken
		};
		if (previous === void 0 || previous.mode !== next.mode || previous.provider !== next.provider || previous.reason !== next.reason || (previous.token?.configured ?? null) !== (next.token?.configured ?? null) || (previous.token?.ref ?? null) !== (next.token?.ref ?? null) || previous.balance === null !== (next.balance === null) || previous.balance !== null && next.balance !== null && (previous.balance.provider !== next.balance.provider || previous.balance.remaining !== next.balance.remaining || previous.balance.usedAccount !== next.balance.usedAccount || previous.balance.usedKey !== next.balance.usedKey || previous.balance.requests !== next.balance.requests || previous.balance.at !== next.balance.at)) set({ provider: next });
		return next;
	}
	/**
	* 换会话时把账本清成"还不知道"。
	*
	* 为什么必须清：不清就会**在新会话里继续挂着上一个会话的读数和站名**，直到新答案回来。
	* 那段时间屏幕上写的是上一个站的钱，而这次会话花的可能是另一个站的钱 —— 正是
	* "绝不把别人的钱画成你的"那条约束要防的事。清成 `unknown` 后胶囊画 `--`，
	* 一眼就知道"还在查"，比显示一个错的数强。
	*/
	function resetForSession() {
		requestTicket += 1;
		inflight = null;
		lastAttemptAt = 0;
		lastSessionId = null;
		failStreak = 0;
		lastReady = false;
		set({ provider: {
			mode: "unknown",
			balance: null,
			provider: null,
			reason: null,
			token: null
		} });
	}
	/**
	* 取一次"当前会话模型来源"的余额。
	* @param force - 跳过 TTL（点击胶囊时用）。
	* @returns 最新结论（可能沿用上一次）；**从不 reject**。
	*/
	function loadProviderBalance(force) {
		var sessionId = getState().sessionId;
		var now = Date.now();
		var switched = sessionId !== lastSessionId;
		if (force !== true && !switched && lastAttemptAt !== 0) {
			var ttl = lastReady ? PROVIDER_TTL_MS : providerRetryDelayMs(failStreak);
			if (now - lastAttemptAt < ttl) return Promise.resolve(getState().provider);
		}
		if (inflight !== null && !switched && force !== true) return inflight;
		if (typeof sessionId !== "string" || sessionId === "") {
			lastSessionId = null;
			return Promise.resolve(publish("unknown", null));
		}
		if (switched) failStreak = 0;
		lastAttemptAt = now;
		lastSessionId = sessionId;
		var ticket = ++requestTicket;
		inflight = Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, ENDPOINT, { args: {
				sessionId,
				force: force === true
			} });
		}).then(function(result) {
			if (ticket !== requestTicket) return getState().provider;
			inflight = null;
			if (getState().sessionId !== sessionId) return getState().provider;
			if (!result || result.ok !== true || !result.value) {
				lastReady = false;
				failStreak += 1;
				probe.log("provider-balance", { failed: true });
				return keepOr("unavailable", failureFieldsOf(result), tokenOf(result?.value));
			}
			var payload = result.value;
			var token = tokenOf(payload);
			if (payload.available === true && payload.account === true) {
				lastReady = true;
				failStreak = 0;
				probe.log("provider-balance", { account: true });
				return publish("account", null, void 0, token);
			}
			var balance = balanceOf(payload);
			if (balance === null) {
				lastReady = false;
				failStreak += 1;
				probe.log("provider-balance", {
					unavailable: payload.available !== true ? payload.reason : "empty",
					message: payload.message ?? null
				});
				return keepOr("unavailable", failureFieldsOf(result), token);
			}
			lastReady = true;
			failStreak = 0;
			probe.log("provider-balance", {
				provider: balance.provider,
				kind: balance.kind,
				remaining: balance.remaining === null,
				usedAccount: balance.usedAccount === null,
				usedKey: balance.usedKey === null,
				placeholder: balance.placeholderLimit
			});
			return publish("provider", balance, void 0, token);
		}).catch(function(error) {
			if (ticket !== requestTicket) return getState().provider;
			inflight = null;
			lastReady = false;
			failStreak += 1;
			probe.log("provider-balance", { thrown: error instanceof Error ? error.message : String(error) });
			return keepOr("unavailable");
		});
		return inflight;
	}
	/**
	* 读不到时的结论：**有**上一次的 provider 余额就继续用它（网络抖一下不该让胶囊消失），
	* 没有才落到 `unavailable`。
	*
	* @param fallbackMode - 没有上一次结果时用的模式。
	* @returns 写进快照的结论。
	*/
	function keepOr(fallbackMode, extra, token) {
		var previous = getState().provider;
		var stale = previous !== void 0 && previous.mode === "provider" && previous.balance !== null ? previous.balance : null;
		if (stale !== null) return publish("provider", stale, void 0, token);
		return publish(fallbackMode, null, extra, token);
	}
	/**
	* 打开后台凭据设置面板。
	*
	* @param provider - 哪个提供方。
	* @param ref - 宿主给的凭据引用名（老宿主不给就 `null`，面板照样能存）。
	*/
	function openTokenPanel(provider, ref) {
		set({ tokenPanel: {
			open: true,
			provider,
			ref,
			supported: true,
			saving: false,
			error: null
		} });
	}
	/** "关着"的面板状态：取消、存成功、初始值都从这里来（免得三份各自漂移）。 */
	function closedTokenPanel() {
		return {
			open: false,
			provider: null,
			ref: null,
			supported: true,
			saving: false,
			error: null
		};
	}
	/** 收起设置面板（取消 / 存完自动收起都走这里）。 */
	function closeTokenPanel() {
		set({ tokenPanel: closedTokenPanel() });
	}
	/**
	* 把用户粘贴的令牌交给宿主，写进凭据存储。
	*
	* 为什么由宿主写：令牌只该落在 DSH 自己的凭据库里（`~/.dsh/.credentials.yaml`），
	* 客户端不碰文件、不存 localStorage —— 存那里等于把密钥摊在一个任何脚本都读得到的地方。
	*
	* @param token - 用户粘贴的令牌（宿主会校验长度与形状）。
	* @returns 是否存成功（面板据此显示错误或自动收起）。
	*/
	async function saveProviderToken(token) {
		var panel = getState().tokenPanel;
		var provider = panel.provider;
		if (provider === null || provider === "") {
			probe.log("provider-credential", { failed: "no-provider" });
			set({ tokenPanel: {
				...getState().tokenPanel,
				saving: false,
				error: "unknown-provider"
			} });
			return false;
		}
		set({ tokenPanel: {
			...panel,
			saving: true,
			error: null
		} });
		try {
			var result = await ctx.connection.rpc.call(CHANNEL, "provider-credential", { args: {
				provider,
				token
			} });
			var value = result && result.ok === true ? result.value : null;
			if (!value || value.saved !== true) {
				var reason = value?.reason ?? "failed";
				probe.log("provider-credential", {
					provider,
					reason,
					message: value?.message ?? null
				});
				set({ tokenPanel: {
					...getState().tokenPanel,
					saving: false,
					error: reason
				} });
				return false;
			}
			probe.log("provider-credential", {
				provider,
				saved: true,
				ref: value.ref ?? null
			});
			set({ tokenPanel: closedTokenPanel() });
			loadProviderBalance(true);
			return true;
		} catch (error) {
			probe.log("provider-credential", { thrown: error instanceof Error ? error.message : String(error) });
			set({ tokenPanel: {
				...getState().tokenPanel,
				saving: false,
				error: "failed"
			} });
			return false;
		}
	}
	return {
		loadProviderBalance,
		resetForSession,
		openTokenPanel,
		closeTokenPanel,
		saveProviderToken
	};
}

//#endregion
//#region src/client/store/attribution.ts
function createAttributionSlice(ctx, getState, set, helpers) {
	/** 会话归因那次请求（在途合并）。 */
	var sessionInflight = null;
	/** 胶囊调用：把当前会话的工作区写进 store，变了才重新取数。 */
	function bindSession(sessionId, cwd) {
		if (getState().sessionId === sessionId && getState().cwd === (cwd || null)) return;
		set({
			sessionId: sessionId === void 0 ? null : sessionId,
			cwd: cwd || null,
			status: null,
			errorCode: null,
			commits: null,
			commitsOid: null,
			tags: null,
			tagsAt: 0,
			tagsTruncated: false,
			diff: null,
			commit: null,
			cursor: null,
			phase: cwd ? "loading" : "idle"
		});
		set({ tools: {
			phase: "idle",
			active: null,
			recent: [],
			counts: [],
			skills: [],
			skillsDropped: 0,
			total: 0,
			updatedAt: null
		} });
		set({ sessionChanges: {
			phase: "idle",
			files: null,
			possible: null,
			commands: [],
			since: null,
			dropped: 0,
			possibleDropped: 0,
			errorCode: null
		} });
		helpers.bindTurns(sessionId);
		helpers.refresh();
	}
	/**
	* 取"本会话改过哪些文件"。
	*
	* 与 `status` 同一条命：状态刷新时顺带取一次（都是本进程内的读，很便宜）。失败就保持
	* `files: null`（界面不打标记、也不过这个滤），不会挡住 git 那半边。
	*/
	function loadSessionChanges() {
		var cwd = getState().cwd;
		var sessionId = getState().sessionId;
		if (!cwd || !sessionId) return Promise.resolve();
		if (sessionInflight) return sessionInflight;
		if (getState().sessionChanges.phase === "idle") set({ sessionChanges: Object.assign({}, getState().sessionChanges, { phase: "loading" }) });
		var task = Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "session-changes", { args: {
				cwd,
				sessionId
			} });
		}).then(function(result) {
			sessionInflight = null;
			if (getState().cwd !== cwd || getState().sessionId !== sessionId) return;
			if (result && result.ok === true && result.value && result.value.cwdMismatch === true) probe.log("session-changes", { cwdMismatch: true });
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
					if (possibleItem && typeof possibleItem.file === "string" && possibleItem.file !== "") possible[possibleItem.file] = possibleItem;
				}
				var since = typeof result.value.since === "number" ? result.value.since : null;
				var dropped = typeof result.value.dropped === "number" ? result.value.dropped : 0;
				probe.log("session-changes", {
					files: Object.keys(files).length,
					possible: Object.keys(possible).length,
					commands: Array.isArray(result.value.commands) ? result.value.commands.length : 0,
					dropped,
					since: since === null ? null : new Date(since).toISOString()
				});
				set({ sessionChanges: {
					phase: "ready",
					files,
					possible,
					commands: Array.isArray(result.value.commands) ? result.value.commands : [],
					since,
					dropped,
					possibleDropped: typeof result.value.possibleDropped === "number" ? result.value.possibleDropped : 0,
					errorCode: null
				} });
				return;
			}
			var code = result && result.error && result.error.details ? result.error.details.code : null;
			probe.log("session-changes-failed", { code: code || "transport" });
			set({ sessionChanges: {
				phase: "error",
				files: null,
				possible: null,
				commands: [],
				since: null,
				dropped: 0,
				possibleDropped: 0,
				errorCode: code || "transport"
			} });
		}).catch(function() {
			sessionInflight = null;
			if (getState().cwd !== cwd) return;
			probe.log("session-changes-failed", { code: "transport" });
			set({ sessionChanges: {
				phase: "error",
				files: null,
				possible: null,
				commands: [],
				since: null,
				dropped: 0,
				possibleDropped: 0,
				errorCode: "transport"
			} });
		});
		sessionInflight = task;
		return task;
	}
	/**
	* 标记 / 取消"这个文件的这一版我审过了"。
	*
	* 签名用的是**当前**这一版（宿主 stat 出来的 size+mtimeMs）：下次改动一落盘签名就变，
	* 标记自动降级成"改动已变，需要重看" —— 而不是继续冒充"已审"。
	*/
	function toggleReviewed(file) {
		if (typeof file !== "string" || file.length === 0) return;
		var signature = getState().review ? getState().review[file] : void 0;
		if (typeof signature !== "string") {
			probe.log("review-no-signature", { file });
			return;
		}
		var next = {};
		for (var key in getState().reviewed) if (Object.prototype.hasOwnProperty.call(getState().reviewed, key)) next[key] = getState().reviewed[key];
		var markKey = helpers.reviewedKeyOf(file);
		if (next[markKey] !== void 0 && next[markKey].signature === signature) delete next[markKey];
		else next[markKey] = {
			signature,
			at: Date.now()
		};
		set({ reviewed: writeReviewed(next) });
	}
	/** 清掉**当前工作区**的全部"已审"标记（别的仓库不动）。 */
	function clearReviewed() {
		var prefix = reviewKeyOf(getState().cwd, "");
		var next = {};
		var removed = 0;
		for (var key in getState().reviewed) {
			if (!Object.prototype.hasOwnProperty.call(getState().reviewed, key)) continue;
			if (key.indexOf(prefix) === 0) {
				removed += 1;
				continue;
			}
			next[key] = getState().reviewed[key];
		}
		if (removed === 0) return;
		set({ reviewed: writeReviewed(next) });
	}
	return {
		bindSession,
		clearReviewed,
		loadSessionChanges,
		toggleReviewed
	};
}

//#endregion
//#region src/client/store/commits.ts
function createCommitsSlice(ctx, getState, set, helpers) {
	/**
	* 打开「某次提交」的视图：先取这次提交的改动清单，再自动打开第一个文件的差异，
	* 这样一次点击就能看到"这次提交改了什么"。
	*
	* 提交是历史事实，取回来就不再变，因此不参与轮询；只有 HEAD 变了它也不受影响
	* （面板显示的是你点的那一次提交）。
	*/
	function openCommit(commit) {
		if (!getState().cwd || !commit || !commit.sha) return Promise.resolve();
		var cwd = getState().cwd;
		var sha = commit.sha;
		set({
			commit: {
				phase: "loading",
				sha,
				shortSha: typeof commit.sha === "string" && commit.sha.length > 7 ? commit.sha.slice(0, 7) : sha,
				subject: commit.subject || "",
				author: commit.author || "",
				date: commit.date || "",
				committedAt: typeof commit.committedAt === "number" ? commit.committedAt : null,
				refs: commit.refs || [],
				merge: false,
				files: [],
				truncated: false,
				errorCode: null
			},
			diff: null
		});
		return Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "commit", { args: {
				cwd,
				sha
			} });
		}).then(function(result) {
			var current = getState().commit;
			if (!current || current.sha !== sha || getState().cwd !== cwd) return;
			if (result && result.ok === true && result.value) {
				var value = result.value;
				var files = Array.isArray(value.files) ? value.files : [];
				var meta = value.commit;
				if (meta !== null && meta !== void 0) {
					set({ commit: {
						phase: "ready",
						sha: meta.sha || sha,
						shortSha: meta.shortSha || sha,
						subject: meta.subject || "",
						author: meta.author || "",
						date: meta.date || "",
						committedAt: typeof meta.committedAt === "number" ? meta.committedAt : null,
						refs: meta.refs || [],
						merge: meta.merge === true,
						files,
						truncated: value.truncated === true,
						errorCode: null
					} });
					if (files.length > 0) return openCommitDiff(files[0]);
					return;
				}
			}
			var code = result && result.error && result.error.details ? result.error.details.code : null;
			set({ commit: Object.assign({}, current, {
				phase: "error",
				files: [],
				errorCode: code || "git-failed"
			}) });
		}).catch(function() {
			var current = getState().commit;
			if (!current || current.sha !== sha) return;
			set({ commit: Object.assign({}, current, {
				phase: "error",
				errorCode: "transport"
			}) });
		});
	}
	/**
	* 打开这次提交里某个文件的差异。与工作区差异共用右栏，但只有一个"侧"
	* （提交相对其父提交），因此工具栏不显示 未暂存/已暂存 两个页签。
	*/
	function openCommitDiff(file) {
		var current = getState().commit;
		if (!getState().cwd || !current || !file || !file.file) return Promise.resolve();
		var cwd = getState().cwd;
		var sha = current.sha;
		var currentDiff = getState().diff;
		var wrap = currentDiff ? currentDiff.wrap === true : readUi().wrap === true;
		set({
			cursor: file.file,
			diff: {
				source: "commit",
				phase: "loading",
				sha,
				shortSha: current.shortSha,
				subject: current.subject,
				path: file.path || file.file,
				file: file.file,
				origPath: file.origFile || null,
				data: null,
				side: "commit",
				wrap,
				zoom: currentDiff && typeof currentDiff.zoom === "number" && ZOOM_STEPS.indexOf(currentDiff.zoom) >= 0 ? currentDiff.zoom : readZoom(readUi()),
				hunk: 0,
				collapsed: [],
				errorCode: null
			}
		});
		return Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "commit-diff", { args: {
				cwd,
				sha,
				path: file.file,
				origPath: file.origFile || null
			} });
		}).then(function(result) {
			var now = getState().diff;
			if (!now || now.source !== "commit" || now.sha !== sha || now.file !== file.file || getState().cwd !== cwd) return;
			if (result && result.ok === true && result.value) {
				set({ diff: Object.assign({}, now, {
					phase: "ready",
					data: result.value,
					errorCode: null
				}) });
				return;
			}
			var code = result && result.error && result.error.details ? result.error.details.code : null;
			set({ diff: Object.assign({}, now, {
				phase: "error",
				data: null,
				errorCode: code || "git-failed"
			}) });
		}).catch(function() {
			var now = getState().diff;
			if (!now || now.source !== "commit" || now.file !== file.file) return;
			set({ diff: Object.assign({}, now, {
				phase: "error",
				errorCode: "transport"
			}) });
		});
	}
	/**
	* 点最近提交里的一行：打开这次提交的明细；点已经打开的那条则收起。
	* （明细占的是右栏，左栏主面板只是高亮那一行。）
	*/
	function toggleCommit(commit) {
		if (!commit || !commit.sha) return Promise.resolve();
		var openCommitState = getState().commit;
		if (openCommitState !== null && sameCommit(commit.sha, openCommitState.sha)) return closeCommit();
		return openCommit(commit);
	}
	/** 收起提交明细：它带来的差异一起收起来（清单换了，光标也要清）。 */
	function closeCommit() {
		if (getState().commit === null) return;
		var openDiff = getState().diff;
		set({
			commit: null,
			diff: openDiff && openDiff.source === "commit" ? null : openDiff,
			cursor: null
		});
	}
	/**
	* 取最近提交。失败只让这一段不显示，不影响面板其余部分——
	* 提交是背景信息，不该抢走「工作区状态」的注意力。
	*/
	function loadCommits(cwd, oid) {
		return Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "log", { args: {
				cwd,
				count: 10
			} });
		}).then(function(result) {
			if (getState().cwd !== cwd) return;
			set({
				commits: result && result.ok === true && result.value && Array.isArray(result.value.commits) ? result.value.commits : [],
				commitsOid: oid
			});
		}).catch(function() {
			if (getState().cwd !== cwd) return;
			set({
				commits: [],
				commitsOid: oid
			});
		});
	}
	/** 取标签列表（面板开着时才取）。失败只让这一段不显示。 */
	function loadTags(cwd) {
		if (getState().tags !== null && Date.now() - getState().tagsAt < 1e4) return Promise.resolve();
		return Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "tags", { args: { cwd } });
		}).then(function(result) {
			if (getState().cwd !== cwd) return;
			var value = result && result.ok === true ? result.value : null;
			var tags = value && Array.isArray(value.tags) ? value.tags : [];
			probe.log("tags", {
				count: tags.length,
				truncated: value ? value.truncated === true : false
			});
			set({
				tags,
				tagsAt: Date.now(),
				tagsTruncated: value ? value.truncated === true : false
			});
		}).catch(function() {
			if (getState().cwd !== cwd) return;
			probe.log("tags-failed", { code: "transport" });
			set({
				tags: [],
				tagsAt: Date.now(),
				tagsTruncated: false
			});
		});
	}
	return {
		closeCommit,
		loadCommits,
		loadTags,
		openCommit,
		openCommitDiff,
		toggleCommit
	};
}

//#endregion
//#region src/client/store/diff.ts
function createDiffSlice(ctx, getState, set, helpers) {
	/**
	* 打开一个改动文件的差异视图：一次取回**两侧**的 rows，
	* 默认落在有内容的那一侧（工作区优先），页签切换因此不需要再发请求。
	*/
	function openDiff(change) {
		if (!getState().cwd || !change || !change.file) return Promise.resolve();
		var cwd = getState().cwd;
		var currentDiff = getState().diff;
		var wrap = currentDiff ? currentDiff.wrap === true : readUi().wrap === true;
		var zoom = currentDiff && typeof currentDiff.zoom === "number" && ZOOM_STEPS.indexOf(currentDiff.zoom) >= 0 ? currentDiff.zoom : readZoom(readUi());
		set({
			commit: null,
			cursor: change.file,
			diff: {
				source: "worktree",
				phase: "loading",
				path: change.path,
				file: change.file,
				origPath: change.origFile || null,
				data: null,
				side: "worktree",
				wrap,
				zoom,
				hunk: 0,
				collapsed: [],
				errorCode: null
			}
		});
		return Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "diff", { args: {
				cwd,
				path: change.file,
				origPath: change.origFile || null
			} });
		}).then(function(result) {
			var current = getState().diff;
			if (!current || current.file !== change.file || getState().cwd !== cwd) return;
			if (result && result.ok === true && result.value) {
				var value = result.value;
				var worktreeRows = value.worktree && value.worktree.rows ? value.worktree.rows.length : 0;
				var indexRows = value.index && value.index.rows ? value.index.rows.length : 0;
				set({ diff: {
					source: "worktree",
					phase: "ready",
					path: change.path,
					file: change.file,
					origPath: change.origFile || null,
					data: value,
					side: worktreeRows > 0 || indexRows === 0 ? "worktree" : "index",
					wrap: current.wrap,
					zoom: current.zoom,
					hunk: 0,
					collapsed: [],
					errorCode: null
				} });
				return;
			}
			var code = result && result.error && result.error.details ? result.error.details.code : null;
			set({ diff: {
				source: "worktree",
				phase: "error",
				path: change.path,
				file: change.file,
				origPath: change.origFile || null,
				data: null,
				side: "worktree",
				wrap: current.wrap,
				errorCode: code || "git-failed"
			} });
		}).catch(function() {
			var current = getState().diff;
			if (!current || current.file !== change.file) return;
			set({ diff: Object.assign({}, current, {
				phase: "error",
				errorCode: "transport"
			}) });
		});
	}
	function closeDiff() {
		if (getState().diff === null) return;
		set({ diff: null });
	}
	function setDiffSide(side) {
		var diff = getState().diff;
		if (!diff || diff.source === "commit" || side !== "worktree" && side !== "index") return;
		set({ diff: Object.assign({}, diff, {
			side,
			hunk: 0,
			collapsed: []
		}) });
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
		var list = helpers.visibleFiles();
		if (list.length === 0) return null;
		var index = -1;
		for (var cursor = 0; cursor < list.length; cursor += 1) if (list[cursor].file === getState().cursor) {
			index = cursor;
			break;
		}
		var entry = list[index === -1 ? delta > 0 ? 0 : list.length - 1 : Math.min(Math.max(0, index + delta), list.length - 1)];
		if (!entry || !entry.file) return null;
		set({ cursor: entry.file });
		if (open) helpers.openListEntry(entry);
		return entry;
	}
	/** Enter：打开键盘选中的那条；还没选过就打开第一条。 */
	function openCursor() {
		var list = helpers.visibleFiles();
		if (list.length === 0) return null;
		for (var index = 0; index < list.length; index += 1) if (list[index].file === getState().cursor) {
			helpers.openListEntry(list[index]);
			return list[index];
		}
		return stepFile(1, true);
	}
	/**
	* n / p：跳到下一个 / 上一个 hunk。跳到折叠着的 hunk 会顺手展开它 ——
	* 不然按键看起来什么都没发生。
	*/
	function stepHunk(delta) {
		var diff = getState().diff;
		if (!diff) return;
		var total = helpers.hunkCount();
		if (total === 0) return;
		var current = typeof diff.hunk === "number" ? diff.hunk : 0;
		var next = Math.min(Math.max(0, current + delta), total - 1);
		var collapsed = (diff.collapsed || []).filter(function(index) {
			return index !== next;
		});
		set({ diff: Object.assign({}, diff, {
			hunk: next,
			collapsed
		}) });
	}
	/** 折叠 / 展开一个 hunk（点 hunk 头，或 Space 作用于当前 hunk）。 */
	function toggleHunk(index) {
		var diff = getState().diff;
		if (!diff || typeof index !== "number" || index < 0) return;
		var collapsed = diff.collapsed || [];
		var next = collapsed.indexOf(index) >= 0 ? collapsed.filter(function(item) {
			return item !== index;
		}) : collapsed.concat([index]);
		set({ diff: Object.assign({}, diff, {
			hunk: index,
			collapsed: next
		}) });
	}
	function toggleDiffWrap() {
		var diff = getState().diff;
		if (!diff) return;
		set({ diff: Object.assign({}, diff, { wrap: diff.wrap !== true }) });
		helpers.persist();
	}
	return {
		closeDiff,
		openCursor,
		openDiff,
		setDiffSide,
		stepFile,
		stepHunk,
		toggleDiffWrap,
		toggleHunk
	};
}

//#endregion
//#region src/client/store/image.ts
/**
* 「图片预览」这一片 store：二进制改动两侧的字节与尺寸，带一个同步缓存。
*/
function createImageSlice(ctx) {
	var imagePairs = /* @__PURE__ */ new Map();
	/** 这一片自己的缓存上限（照宿主半的 `CACHE_MAX_ENTRIES` 同一个量级）。 */
	var IMAGE_CACHE_MAX = 8;
	/**
	* 同步看一眼缓存：命中就返回条目，否则 null。
	*
	* 有了它，`ImageDiff` 的**第一次渲染**就能把已经取过的图画出来 ——
	* 关掉再打开同一张图不该先闪一下"读取图片…"，也不该再发一次请求。
	*/
	function cachedImagePair(request) {
		if (request === null || request === void 0) return null;
		var entry = imagePairs.get(imagePairKey(request));
		return entry === void 0 ? null : entry;
	}
	/** 供 `ImageDiff` 用：取一个二进制改动两侧的字节与尺寸（同一个请求只发一次）。 */
	function loadImagePair(request) {
		var key = imagePairKey(request);
		var cached = imagePairs.get(key);
		if (cached !== void 0) return Promise.resolve(cached);
		return Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "image", { args: request });
		}).then(function(result) {
			var entry = result && result.ok === true && result.value ? {
				phase: "ready",
				value: result.value
			} : {
				phase: "error",
				code: result && result.error && result.error.details ? result.error.details.code : null
			};
			if (imagePairs.size >= IMAGE_CACHE_MAX) imagePairs.clear();
			imagePairs.set(key, entry);
			return entry;
		}).catch(function() {
			return {
				phase: "error",
				code: "transport"
			};
		});
	}
	return {
		cachedImagePair,
		loadImagePair
	};
}

//#endregion
//#region src/client/store/session-info.ts
function createSessionInfoSlice(ctx, getState, set) {
	/**
	* 会话运行时长的缓存：每分钟最多问一次（统计数字不需要更密），同会话复用。
	*
	* 与图片那种"重"缓存分开存：这个条目只有几十字节，TTL 到期直接覆盖。
	*/
	var sessionTimes = /* @__PURE__ */ new Map();
	/** 拿到数的缓存时长。 */
	var SESSION_TIME_TTL_MS = 6e4;
	/**
	* **没拿到**时的重问间隔。
	*
	* 会话是异步恢复到宿主 `sessions` 存储里的：重启后头几百毫秒问 `session-time` 得到的是
	* "这个会话还不存在"（实测启动 0.6 秒时 live=0，30 秒后才 live=1）。
	* 把这种答案按 60 秒缓存，就会让计时胶囊在你重启后一两分钟才出现 —— 所以负面结果只记 3 秒。
	*/
	var SESSION_TIME_RETRY_MS = 3e3;
	/** 取一个会话的运行时长（含内置 `sessionStats` 的累计数字）；拿不到回 `available: false`。 */
	function loadSessionTime(sessionId) {
		if (typeof sessionId !== "string" || sessionId === "") return Promise.resolve({ available: false });
		var cached = sessionTimes.get(sessionId);
		if (cached !== void 0) {
			var ttl = cached.value && cached.value.available === true ? SESSION_TIME_TTL_MS : SESSION_TIME_RETRY_MS;
			if (Date.now() - cached.at < ttl) return Promise.resolve(cached.value);
		}
		return Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "session-time", { args: { sessionId } });
		}).then(function(result) {
			var value = result && result.ok === true && result.value ? result.value : {
				available: false,
				sessionId
			};
			if (sessionTimes.size >= 16) sessionTimes.clear();
			sessionTimes.set(sessionId, {
				at: Date.now(),
				value
			});
			var previous = getState().sessionTime && getState().sessionTime.sessionId === sessionId ? getState().sessionTime.value : null;
			if (!(previous !== null && previous.available === value.available && previous.createdAt === value.createdAt && previous.llmMs === value.llmMs && previous.toolMs === value.toolMs && previous.turns === value.turns && previous.steps === value.steps)) set({ sessionTime: {
				sessionId,
				value
			} });
			return value;
		}).catch(function() {
			return {
				available: false,
				sessionId
			};
		});
	}
	/**
	* prompt 历史：宿主从内置 `turnOutline` 投影里取，比客户端自己记一份可靠得多
	* （分页、压实、重启、换设备都不影响）。prompt 只在"一整轮发出去"之后才会变，
	* 所以 5 秒 TTL 足够，而且顺手把值写进快照 —— 按键那侧只读快照，不必再 await。
	*/
	var promptHistories = /* @__PURE__ */ new Map();
	var PROMPT_HISTORY_TTL_MS = 5e3;
	function loadPromptHistory(sessionId) {
		if (typeof sessionId !== "string" || sessionId === "") return Promise.resolve({
			available: false,
			prompts: []
		});
		var cached = promptHistories.get(sessionId);
		if (cached !== void 0 && Date.now() - cached.at < PROMPT_HISTORY_TTL_MS) return Promise.resolve(cached.value);
		return Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "prompt-history", { args: {
				sessionId,
				limit: 100
			} });
		}).then(function(result) {
			var value = result && result.ok === true && result.value ? result.value : {
				available: false,
				sessionId,
				prompts: []
			};
			if (promptHistories.size >= 16) promptHistories.clear();
			promptHistories.set(sessionId, {
				at: Date.now(),
				value
			});
			var previous = getState().promptHistory && getState().promptHistory.sessionId === sessionId ? getState().promptHistory.value : null;
			if (!(previous !== null && previous.available === value.available && (previous.prompts || []).length === (value.prompts || []).length && (previous.prompts || []).every(function(item, index) {
				return item === value.prompts[index];
			}))) set({ promptHistory: {
				sessionId,
				value
			} });
			return value;
		}).catch(function() {
			return {
				available: false,
				sessionId,
				prompts: []
			};
		});
	}
	return {
		loadPromptHistory,
		loadSessionTime
	};
}

//#endregion
//#region src/client/store/tip.ts
function createTipSlice(getState, set) {
	/** 显示某枚胶囊的悬停提示（`rect` 由调用方从 `getBoundingClientRect()` 给）。 */
	function showTip(key, content, rect) {
		var normalized = normalizeTipContent(content);
		if (normalized.text.length === 0) return;
		var at = rect && typeof rect === "object" ? {
			left: rect.left,
			top: rect.top,
			right: rect.right
		} : {
			left: 0,
			top: 0,
			right: 0
		};
		set({ tip: {
			key,
			text: normalized.text,
			lines: normalized.lines,
			rect: at
		} });
	}
	/** 收起悬停提示。带 `key` 时只在"还是这一枚"的情况下收 —— 免得旧的 leave 把新的提示关掉。 */
	function hideTip(key) {
		var current = getState().tip;
		if (current === null || current === void 0) return;
		if (typeof key === "string" && current.key !== key) return;
		set({ tip: null });
	}
	/**
	* 一枚胶囊的悬停接线：算出锚点矩形，把文案交给 store。
	*
	* 为什么走 store 而不是就地渲染气泡：气泡必须**逃出行内盒**（不被 dock 那行的裁切与
	* 堆叠上下文限制），所以它由 `shell.overlay` 里一枚单独的座位画，位置用 `position:fixed`。
	*/
	function tipHandlers(key, contentOf) {
		return {
			onPointerEnter: function(event) {
				var target = event && event.currentTarget ? event.currentTarget : null;
				var rect = target && typeof target.getBoundingClientRect === "function" ? target.getBoundingClientRect() : null;
				showTip(key, contentOf(), rect);
			},
			onPointerLeave: function() {
				hideTip(key);
			},
			onPointerDown: function() {
				hideTip(key);
			}
		};
	}
	return {
		hideTip,
		showTip,
		tipHandlers
	};
}

//#endregion
//#region src/client/store/tools.ts
function createToolsSlice(ctx, getState, set) {
	/** 工具活动那次请求（在途合并）。 */
	var toolsInflight = null;
	/** 侧栏摘要那次请求（在途合并）。 */
	var rowsInflight = null;
	/** 回合投影的订阅：`{ sessionId, dispose }`；`null` 表示没接。 */
	var turnsBound = null;
	/** `sessions` 客户端服务（动态注入；没到齐就是 null，回合信息不显示）。 */
	var turnSessions = null;
	if (typeof ctx.inject === "function") ctx.effect(function() {
		return ctx.inject(["sessions"], function(scope) {
			turnSessions = scope.sessions;
			probe.log("turn-services", { sessions: true });
			bindTurns(getState().sessionId);
			return function() {
				turnSessions = null;
				unbindTurns();
			};
		});
	}, "dsh-hud: turn services");
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
		} catch (error) {}
		turnsBound = null;
		set({ turns: {
			available: false,
			prompts: {},
			latest: null
		} });
	}
	function bindTurns(sessionId) {
		if (turnsBound !== null && turnsBound.sessionId === sessionId) return;
		unbindTurns();
		if (!sessionId || turnSessions === null) return;
		try {
			var bound = turnSessions.binding(sessionId);
			var live = bound ? bound.session : void 0;
			if (!live || !live.projections || typeof live.projections.faceOf !== "function") return;
			var face = live.projections.faceOf("turnOutline");
			if (!face || typeof face.getSnapshot !== "function") return;
			var liveFace = face;
			var apply = function() {
				try {
					set({ turns: normalizeTurns(liveFace.getSnapshot()) });
				} catch (error) {
					probe.log("turns-read-failed", { error: error instanceof Error ? error.message : String(error) });
				}
			};
			apply();
			turnsBound = {
				sessionId,
				dispose: typeof liveFace.subscribe === "function" ? liveFace.subscribe(apply) : null
			};
		} catch (error) {
			probe.log("turns-bind-failed", { error: error instanceof Error ? error.message : String(error) });
		}
	}
	/** 归一 `turnOutline` 快照：`{ turns: [{ turn, prompt }], draft }`。 */
	function normalizeTurns(snapshot) {
		var record = snapshot !== null && typeof snapshot === "object" ? snapshot : null;
		var entries = record !== null && Array.isArray(record.turns) ? record.turns : null;
		if (entries === null) return {
			available: false,
			prompts: {},
			latest: null
		};
		var prompts = {};
		var latest = null;
		for (var index = 0; index < entries.length; index += 1) {
			var entry = entries[index];
			if (!entry || typeof entry !== "object") continue;
			var item = entry;
			if (typeof item.turn !== "number") continue;
			if (typeof item.prompt === "string" && item.prompt.length > 0) prompts[item.turn] = item.prompt;
			if (latest === null || item.turn > latest) latest = item.turn;
		}
		return {
			available: true,
			prompts,
			latest
		};
	}
	/**
	* 取侧栏每条会话行要的摘要（**一次批量**，不是 N 次 RPC）。
	*
	* 会话列表由**宿主**枚举（它有 `sessions` 服务），客户端不用把名单端过去；宿主没有
	* 那个服务时回 `unavailable: true`，那些 chip 就整片不画（其余功能照旧）。
	*/
	function refreshRows() {
		if (rowsInflight) return rowsInflight;
		var task = Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "session-statuses", { args: {} });
		}).then(function(result) {
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
					truncated: result.value.truncated === true
				});
				set({ rows: {
					phase: "ready",
					byId,
					unavailable: result.value.unavailable === true,
					truncated: result.value.truncated === true,
					updatedAt: Date.now()
				} });
				return;
			}
			var code = result && result.error && result.error.details ? result.error.details.code : null;
			probe.log("session-statuses-failed", { code: code || "transport" });
			set({ rows: {
				phase: "error",
				byId: {},
				unavailable: true,
				truncated: false,
				updatedAt: Date.now()
			} });
		}).catch(function() {
			rowsInflight = null;
			probe.log("session-statuses-failed", { code: "transport" });
			set({ rows: {
				phase: "error",
				byId: {},
				unavailable: true,
				truncated: false,
				updatedAt: Date.now()
			} });
		});
		rowsInflight = task;
		return task;
	}
	/** 取本会话的工具活动（正在跑哪个 / 跑过哪些 / 各几次）。 */
	function loadTools() {
		var sessionId = getState().sessionId;
		if (!sessionId) return Promise.resolve();
		if (toolsInflight) return toolsInflight;
		var task = Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "session-tools", { args: { sessionId } });
		}).then(function(result) {
			toolsInflight = null;
			if (getState().sessionId !== sessionId) return;
			if (result && result.ok === true && result.value) {
				var value = result.value;
				var tools = {
					phase: "ready",
					active: value.active && typeof value.active === "object" ? value.active : null,
					recent: Array.isArray(value.recent) ? value.recent : [],
					counts: Array.isArray(value.counts) ? value.counts : [],
					skills: Array.isArray(value.skills) ? value.skills : [],
					skillsDropped: typeof value.skillsDropped === "number" ? value.skillsDropped : 0,
					total: typeof value.total === "number" ? value.total : 0,
					updatedAt: Date.now()
				};
				var previous = getState().tools;
				if (previous !== null && previous.active !== null && tools.active !== null ? previous.active.callId === tools.active.callId && previous.total === tools.total : previous !== null && previous.active === null && tools.active === null && previous.total === tools.total && previous.recent.length === tools.recent.length && (previous.recent.length === 0 || previous.recent[0].at === tools.recent[0].at)) return;
				probe.log("session-tools", {
					active: tools.active === null ? null : tools.active.name,
					total: tools.total,
					kinds: tools.counts.length,
					skills: tools.skills.length
				});
				set({ tools });
				return;
			}
			var code = result && result.error && result.error.details ? result.error.details.code : null;
			probe.log("session-tools-failed", { code: code || "transport" });
			set({ tools: {
				phase: "error",
				active: null,
				recent: [],
				counts: [],
				skills: [],
				skillsDropped: 0,
				total: 0,
				updatedAt: Date.now()
			} });
		}).catch(function() {
			toolsInflight = null;
			probe.log("session-tools-failed", { code: "transport" });
			set({ tools: {
				phase: "error",
				active: null,
				recent: [],
				counts: [],
				skills: [],
				skillsDropped: 0,
				total: 0,
				updatedAt: Date.now()
			} });
		});
		toolsInflight = task;
		return task;
	}
	return {
		bindTurns,
		loadTools,
		refreshRows,
		unbindTurns
	};
}

//#endregion
//#region src/client/store/index.ts
/**
* 共享 store 的组装层：自己管状态、订阅、持久化与布局，七片各自管自己的域。
*
* 它对外只暴露浏览器半需要的那一套（打开面板 / 差异 / 提交 / 会话列表摘要 / 审阅 …），
* 每个"片"的入口都只是转发到这个文件外面的小工厂。
*/
function createStore(ctx) {
	var imageSlice = createImageSlice(ctx);
	var ui = readUi();
	var pos = ui.pos && typeof ui.pos === "object" && typeof ui.pos.left === "number" && typeof ui.pos.top === "number" ? {
		left: ui.pos.left,
		top: ui.pos.top
	} : null;
	var state = {
		phase: "idle",
		sessionId: null,
		cwd: null,
		status: null,
		errorCode: null,
		updatedAt: null,
		panelOpen: ui.open === true,
		pos,
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
		/**
		* 标签列表。与提交不同，**新 tag 可以打在老提交上**（HEAD 不动），所以不能只按 oid 判断；
		* 改用"上次取的时刻"做新鲜度窗口：面板开着时每次刷新都看一眼，但 10s 内不重复问 git。
		*/
		tags: null,
		tagsAt: 0,
		tagsTruncated: false,
		/** 差异栏宽度（面板右边缘可拖），持久化。 */
		diffWidth: typeof ui.diffWidth === "number" ? ui.diffWidth : 470,
		/** 提交明细栏宽度（它与差异栏之间那条抓握可拖），持久化。 */
		commitWidth: typeof ui.commitWidth === "number" ? ui.commitWidth : 240,
		/**
		* 会话归因：本会话改过哪些文件（宿主半按 fs 事件记的）。
		*
		* `files` 为 `null` 表示"还没有这份数据"（老宿主 / 还没回来 / 请求失败）——
		* 界面据此不打标记、也不过这个滤。
		*/
		sessionChanges: {
			phase: "idle",
			files: null,
			possible: null,
			commands: [],
			since: null,
			dropped: 0,
			possibleDropped: 0,
			errorCode: null
		},
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
		tools: {
			phase: "idle",
			active: null,
			recent: [],
			counts: [],
			skills: [],
			skillsDropped: 0,
			total: 0,
			updatedAt: null
		},
		sessionTime: {
			sessionId: null,
			value: null
		},
		promptHistory: {
			sessionId: null,
			value: null
		},
		balance: null,
		provider: {
			mode: "unknown",
			balance: null
		},
		tokenPanel: {
			open: false,
			provider: null,
			ref: null,
			supported: true,
			saving: false,
			error: null
		},
		tip: null,
		/** 侧栏行内 chip 要的摘要：一次批量取回，按 sessionId 索引。 */
		rows: {
			phase: "idle",
			byId: {},
			unavailable: false,
			truncated: false,
			updatedAt: null
		},
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
		turns: {
			available: false,
			prompts: {},
			latest: null
		}
	};
	var listeners = /* @__PURE__ */ new Set();
	var inflight = null;
	/** 会话归因那次请求（在途合并）。 */
	function getSnapshot() {
		return state;
	}
	function subscribe(listener) {
		listeners.add(listener);
		return function() {
			listeners.delete(listener);
		};
	}
	function emit() {
		listeners.forEach(function(listener) {
			listener();
		});
	}
	function set(patch) {
		state = Object.assign({}, state, patch);
		emit();
	}
	var tipSlice = createTipSlice(function() {
		return state;
	}, set);
	var sessionInfoSlice = createSessionInfoSlice(ctx, function() {
		return state;
	}, set);
	var accountSlice = createAccountSlice(ctx, function() {
		return state;
	}, set);
	var providerSlice = createProviderSlice(ctx, function() {
		return state;
	}, set);
	var toolsSlice = createToolsSlice(ctx, function() {
		return state;
	}, set);
	var commitsSlice = createCommitsSlice(ctx, function() {
		return state;
	}, set, { closeDiff: function() {
		return diffSlice.closeDiff();
	} });
	var attributionSlice = createAttributionSlice(ctx, function() {
		return state;
	}, set, {
		bindTurns: function(sessionId) {
			return toolsSlice.bindTurns(sessionId);
		},
		loadTools: function() {
			return toolsSlice.loadTools();
		},
		refresh: function() {
			return refresh();
		},
		refreshRows: function() {
			return toolsSlice.refreshRows();
		},
		reviewedKeyOf
	});
	var diffSlice = createDiffSlice(ctx, function() {
		return state;
	}, set, {
		hunkCount,
		openCommitDiff: commitsSlice.openCommitDiff,
		openListEntry,
		persist,
		visibleFiles
	});
	function persist() {
		var diff = state.diff;
		writeUi({
			onlySession: state.onlySession === true,
			onlyLatest: state.onlyLatest === true,
			open: state.panelOpen,
			pos: state.pos,
			wrap: diff ? diff.wrap === true : false,
			zoom: diff && typeof diff.zoom === "number" && ZOOM_STEPS.indexOf(diff.zoom) >= 0 ? diff.zoom : null,
			diffWidth: state.diffWidth,
			commitWidth: state.commitWidth
		});
	}
	/** 拖动提交栏右边那条抓握时只改内存；松手才落盘。 */
	function setCommitWidth(width) {
		if (typeof width !== "number" || !Number.isFinite(width)) return;
		var next = Math.max(180, Math.round(width));
		if (state.commitWidth === next) return;
		set({ commitWidth: next });
	}
	/** 拖动右边缘时只改内存；松手才落盘（persistLayout）。 */
	function setDiffWidth(width) {
		if (typeof width !== "number" || !Number.isFinite(width)) return;
		var next = Math.max(240, Math.round(width));
		if (state.diffWidth === next) return;
		set({ diffWidth: next });
	}
	/**
	* 图片两侧的缓存：键与请求一一对应。
	*
	* 一张图的 base64 可能上兆，所以命中就不重取；条目数有上限（超了整表清空，
	* 和宿主的 `CACHE_MAX_ENTRIES` 同一个思路：宁可少缓存，也不要无界增长）。
	*/
	/**
	* 收起右栏。提交明细把差异包在里面，所以它优先整体退掉；
	* 只有工作区差异时才只是关掉差异。
	*/
	function closeDetail() {
		if (state.commit !== null) return commitsSlice.closeCommit();
		return diffSlice.closeDiff();
	}
	/**
	* 当前能上下选的那份清单：打开提交明细时是这次提交的改动，否则是工作区清单。
	*
	* 清单必须跟视图一致 —— 否则打开着提交明细时按 ↑/↓ 会去动工作区的行，
	* 高亮和打开的文件对不上。
	*/
	function visibleFiles() {
		if (state.commit !== null) return Array.isArray(state.commit.files) ? state.commit.files : [];
		return visibleChangeRows(state);
	}
	/** 打开清单里的一条：提交明细打开时走提交差异，否则走工作区差异。 */
	function openListEntry(file) {
		if (state.commit !== null) return commitsSlice.openCommitDiff(file);
		return diffSlice.openDiff(file);
	}
	/** 当前差异里有几个 hunk —— n / p 的边界就是它。 */
	function hunkCount() {
		var payload = diffPayload(state.diff);
		var rows = payload && payload.rows ? payload.rows : [];
		var total = 0;
		for (var index = 0; index < rows.length; index += 1) if (rows[index].kind === "hunk") total += 1;
		return total;
	}
	/**
	* 图片缩放的档位（`null` = 适应宽度）。
	*
	* 放在 store 而不是组件里：一来记住（和"自动换行"一样落盘），二来组件的 hooks
	* 在这个假 React 里驱动不了嵌套状态 —— store 的状态任何位置都读得到。
	*/
	function setZoom(value) {
		var diff = state.diff;
		if (!diff) return;
		var next = value === null || ZOOM_STEPS.indexOf(value) >= 0 ? value : null;
		set({ diff: Object.assign({}, diff, { zoom: next }) });
		persist();
	}
	/** dock 行的位置变了才写，避免每次测量都触发重渲染。 */
	function setAnchorTop(top) {
		if (state.anchorTop === top) return;
		set({ anchorTop: top });
	}
	function refresh() {
		attributionSlice.loadSessionChanges();
		toolsSlice.loadTools();
		toolsSlice.bindTurns(state.sessionId);
		if (!state.cwd) return Promise.resolve();
		if (inflight) return inflight;
		var cwd = state.cwd;
		set({ phase: state.status ? "ready" : "loading" });
		inflight = Promise.resolve().then(function() {
			return ctx.connection.rpc.call(CHANNEL, "status", { args: {
				cwd,
				review: state.panelOpen === true
			} });
		}).then(function(result) {
			inflight = null;
			if (state.cwd !== cwd) return;
			if (result && result.ok === true) {
				var statusValue = result.value || null;
				set({
					phase: "ready",
					status: statusValue,
					review: statusValue && statusValue.review && typeof statusValue.review === "object" ? statusValue.review : {},
					errorCode: null,
					updatedAt: Date.now()
				});
				if (statusValue && state.panelOpen && (state.commits === null || state.commitsOid !== statusValue.oid)) commitsSlice.loadCommits(cwd, statusValue.oid);
				if (statusValue && state.panelOpen) commitsSlice.loadTags(cwd);
				return;
			}
			set({
				phase: "error",
				errorCode: (result && result.error && result.error.details ? result.error.details.code : null) || "git-failed"
			});
		}).catch(function() {
			inflight = null;
			if (state.cwd !== cwd) return;
			set({
				phase: "error",
				errorCode: "transport"
			});
		});
		return inflight;
	}
	/** 审阅存档的键：**按工作区分开**，同一个文件名在别的仓库里是另一码事。 */
	function reviewedKeyOf(file) {
		return reviewKeyOf(state.cwd, file);
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
		getSnapshot,
		subscribe,
		/**
		* 绑定当前会话（胶囊/turn-images 的 effect 调它）。
		*
		* 绑完之后**立刻**去问"这个会话的模型来源是哪个账本"：早先这一步挂在另一个 effect 里，
		* 而那个 effect 的依赖只有 `sessionId` —— 它先于 `bindSession` 跑，此时 store 里的
		* `sessionId` 还是 `null`，于是 provider 侧永远是 `unknown`（胶囊一直画平台账号余额），
		* 要等五分钟那一次轮询才会纠正。会话一换就顺手问，才是对的时机。
		*/
		bindSession: function(sessionId, cwd) {
			var previous = state.sessionId;
			attributionSlice.bindSession(sessionId, cwd);
			if (state.sessionId === previous) return;
			providerSlice.resetForSession();
			if (state.sessionId !== null) providerSlice.loadProviderBalance();
		},
		refresh,
		openPanel,
		togglePanel,
		movePanel,
		commitPanel,
		resetPanel,
		setAnchorTop,
		setDiffWidth,
		setCommitWidth,
		persistLayout: persist,
		openDiff: diffSlice.openDiff,
		loadImagePair: imageSlice.loadImagePair,
		cachedImagePair: imageSlice.cachedImagePair,
		loadSessionChanges: attributionSlice.loadSessionChanges,
		loadSessionTime: sessionInfoSlice.loadSessionTime,
		loadPromptHistory: sessionInfoSlice.loadPromptHistory,
		loadBalance: accountSlice.loadBalance,
		resetForSession: providerSlice.resetForSession,
		loadProviderBalance: providerSlice.loadProviderBalance,
		openTokenPanel: providerSlice.openTokenPanel,
		closeTokenPanel: providerSlice.closeTokenPanel,
		saveProviderToken: providerSlice.saveProviderToken,
		showTip: tipSlice.showTip,
		hideTip: tipSlice.hideTip,
		tipHandlers: tipSlice.tipHandlers,
		closeDiff: diffSlice.closeDiff,
		closeDetail,
		setDiffSide: diffSlice.setDiffSide,
		toggleDiffWrap: diffSlice.toggleDiffWrap,
		setZoom,
		openCommit: commitsSlice.openCommit,
		openCommitDiff: commitsSlice.openCommitDiff,
		toggleCommit: commitsSlice.toggleCommit,
		closeCommit: commitsSlice.closeCommit,
		stepFile: diffSlice.stepFile,
		openCursor: diffSlice.openCursor,
		stepHunk: diffSlice.stepHunk,
		toggleHunk: diffSlice.toggleHunk,
		toggleOnlySession,
		toggleOnlyLatest,
		refreshRows: toolsSlice.refreshRows,
		loadTools: toolsSlice.loadTools,
		toggleReviewed: attributionSlice.toggleReviewed,
		clearReviewed: attributionSlice.clearReviewed
	};
}

//#endregion
//#region src/client/styles-apply.ts
/**
* 样式落地：把 `styles.ts` 那份表插进 `<head>`（用 `CSS_TAG_ID` 防重复注入），
* 以及从已注入的样式里取一个值的助手。
*/
/**
* 审阅进度：`{ marks: {file → 'fresh'|'stale'}, done, total, staleCount }`。
*
* 判据是**签名**：宿主 stat 出来的 size+mtimeMs 和存档里的是同一个才算"这一版审过了"。
* 签名变了（又被改动）就把那条标记降级成 `stale`，界面显示"改动已变，需要重看" ——
* 而不是继续冒充已审。没有签名的文件（宿主这次没算）不参与统计。
*/
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
	var selector = "style[data-plugin-css=\"" + CSS_TAG_ID + "\"]";
	var tag = typeof document.querySelector === "function" ? document.querySelector(selector) : null;
	if (!tag) {
		tag = document.createElement("style");
		tag.setAttribute("data-plugin", "@konnga/dsh-hud");
		tag.setAttribute("data-plugin-css", CSS_TAG_ID);
		tag.setAttribute("data-dsh-hud", "styles");
		document.head.appendChild(tag);
	}
	tag.textContent = CSS;
	return tag;
}

//#endregion
//#region src/client/plugin.ts
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
var inject = [
	"slots",
	"connection",
	"locale"
];
/**
* 客户端插件主体。
* @param ctx - 客户端根上下文（slots、connection、locale）。
*/
function apply(ctx) {
	ctx.effect(function() {
		return ctx.locale.register(NS, {
			zh,
			en
		});
	}, "dsh-hud: dictionaries");
	ctx.effect(function() {
		var element = ensureStyles();
		return function() {
			if (element && element.parentNode) element.parentNode.removeChild(element);
		};
	}, "dsh-hud: styles");
	var store = createStore(ctx);
	probe.log("apply", {
		inject: typeof ctx.inject === "function",
		slots: typeof ctx.slots === "object",
		chips: cssChipsGap(CSS)
	});
	ctx.effect(function() {
		var id = window.setInterval(function() {
			if (document.visibilityState === "hidden") return;
			ensureStyles();
			store.refresh();
		}, POLL_MS);
		return function() {
			window.clearInterval(id);
		};
	}, "dsh-hud: status poll");
	ctx.effect(function() {
		var onFocus = function() {
			ensureStyles();
			store.refresh();
		};
		window.addEventListener("focus", onFocus);
		return function() {
			window.removeEventListener("focus", onFocus);
		};
	}, "dsh-hud: focus refresh");
	ctx.effect(function() {
		store.loadBalance();
		var id = window.setInterval(function() {
			if (document.visibilityState === "hidden") return;
			store.loadBalance();
		}, BALANCE_POLL_MS);
		return function() {
			window.clearInterval(id);
		};
	}, "dsh-hud: account balance poll");
	/**
	* 「当前会话模型来源」的余额：自己的节拍，比账号那一路快。
	*
	* 为什么是 30 秒而不是 5 分钟：第一次取数常常赶在投影就绪之前（刚开会话、刚换模型），
	* 那时宿主答不上来；如果下一次机会在五分钟之后，胶囊就有五分钟是空白的。
	* 真实请求次数由 store 自己的 TTL 兜着（成功 60s、失败 30s），这里只是"多久问一次"。
	*/
	ctx.effect(function() {
		var stopped = false;
		var handle = null;
		/**
		* 下一次隔多久再问。
		*
		* 稳态是 `PROVIDER_POLL_MS`（30 秒）；**还没问出来**的时候用 1 秒重问 ——
		* 这才是"重启后胶囊迟迟不出现"的症结：宿主在刚启动那一下常常还读不到模型选择投影，
		* 第一次问必然落空，而原来的固定 30 秒节拍意味着胶囊要空半分钟。
		* 真实请求次数仍由 store 的 TTL 兜着（成功 60s、失败按 1s 起指数退避到 30s），
		* 这里只是"多久看一眼"，看的时候多半是空转。
		*/
		function nextDelay() {
			var ledger = store.getSnapshot().provider;
			return ledger !== void 0 && ledger !== null && ledger.mode !== "unknown" && typeof ledger.provider === "string" && ledger.provider !== "" ? PROVIDER_POLL_MS : PROVIDER_RETRY_TICK_MS;
		}
		function tick() {
			if (stopped) return;
			if (document.visibilityState !== "hidden") store.loadProviderBalance();
			handle = window.setTimeout(tick, nextDelay());
		}
		tick();
		return function() {
			stopped = true;
			if (handle !== null) window.clearTimeout(handle);
		};
	}, "dsh-hud: provider balance poll");
	ctx.effect(function() {
		return watchModelSelection(ctx, store);
	}, "dsh-hud: model selection -> provider balance");
	ctx.slots.inject("shell.overlay", function() {
		return ctx.slots.register({
			name: "shell.overlay",
			id: "dsh-hud-pill-tip",
			order: 10,
			locale: NS,
			inject: function() {
				return { store };
			}
		}, PillTip);
	});
	ctx.slots.inject("shell.overlay", function() {
		return ctx.slots.register({
			name: "shell.overlay",
			id: "dsh-hud-token-panel",
			order: 15,
			locale: NS,
			inject: function() {
				return { store };
			}
		}, TokenPanel);
	});
	ctx.slots.inject("shell.overlay", function() {
		return ctx.slots.register({
			name: "shell.overlay",
			id: "dsh-hud-panel",
			order: 20,
			locale: NS,
			inject: function() {
				return { store };
			}
		}, HudFloatingPanel);
	});
	ctx.effect(function() {
		store.refreshRows();
		var id = window.setInterval(function() {
			if (document.visibilityState === "hidden") return;
			store.refreshRows();
		}, ROWS_POLL_MS);
		return function() {
			window.clearInterval(id);
		};
	}, "dsh-hud: session rows poll");
	ctx.effect(function() {
		var id = window.setInterval(function() {
			if (document.visibilityState === "hidden") return;
			store.loadTools();
		}, TOOLS_POLL_MS);
		return function() {
			window.clearInterval(id);
		};
	}, "dsh-hud: tool activity poll");
	ctx.slots.inject("sidebar.workspaces.session.menu.item", function() {
		return ctx.slots.register({
			name: "sidebar.workspaces.session.menu.item",
			id: "dsh-hud-session-menu",
			order: 30,
			locale: NS,
			inject: function() {
				return { store };
			}
		}, SessionMenuSummary);
	});
	ctx.slots.inject("sidebar.session.row.hover", function() {
		return ctx.slots.register({
			name: "sidebar.session.row.hover",
			id: "dsh-hud-session-hover",
			order: 30,
			locale: NS,
			inject: function() {
				return { store };
			}
		}, SessionRowHoverChip);
	});
	ctx.slots.inject("conversation.input.dock", function() {
		return ctx.slots.register({
			name: "conversation.input.dock",
			id: "dsh-hud-pill",
			order: 20,
			locale: NS,
			inject: function(sessionId) {
				return {
					store,
					sessionId
				};
			}
		}, HudDockPill);
	});
	ctx.slots.inject("conversation.chat.turnTail", function() {
		return ctx.slots.register({
			name: "conversation.chat.turnTail",
			id: "dsh-hud-turn-images",
			order: 30,
			locale: NS,
			inject: function(sessionId) {
				return {
					store,
					sessionId
				};
			}
		}, TurnImages);
	});
	ctx.effect(function() {
		return bindPromptHistory(store);
	}, "dsh-hud: prompt history (↑ 召回)");
}

//#endregion
exports.apply = apply;
exports.inject = inject;
    return module.exports;
  },
});

//# sourceMappingURL=client.js.map