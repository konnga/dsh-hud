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
	".dshh-diftext.dshh-wrap{white-space:pre-wrap;word-break:break-word;overflow:visible;text-overflow:clip;}",
	".dshh-skin{display:flex;flex-direction:column;gap:8px;padding:16px 0;",
	"border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,0.3));}",
	".dshh-skinTitle{color:var(--dsw-alias-label-primary,#e5e7eb);font-size:14px;font-weight:400;line-height:22px;}",
	".dshh-skinCubes{display:flex;flex-wrap:wrap;align-items:stretch;gap:8px;}",
	".dshh-skinCube{box-sizing:border-box;flex:180px;display:flex;flex-direction:column;",
	"align-items:center;justify-content:center;gap:4px;padding:20px 32px;",
	"font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary,#e5e7eb);",
	"background:0 0;border:.5px solid var(--dsw-alias-border-l4,rgba(127,127,127,0.35));",
	"border-radius:var(--dsw-radius-xl,12px);cursor:pointer;}",
	".dshh-skinCube:hover:not([data-active]){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,0.12));}",
	".dshh-skinCube[data-active]{background:var(--dsw-alias-bg-module-platform,rgba(127,127,127,0.16));",
	"border-color:var(--dsw-static-neutral-bluish-400,#8a8f98);}",
	".dshh-runText{display:inline-flex;align-items:baseline;gap:6px;min-width:0;color:inherit;",
	"font-variant-numeric:tabular-nums;}",
	".dshh-runPhrase{white-space:nowrap;}",
	".dshh-runTime{opacity:.55;font-size:.92em;white-space:nowrap;}",
	".dshh-runTime:empty{display:none;}"
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
	var startedAt = typeof value.startedAt === "number" ? value.startedAt : createdAt;
	var age = Math.max(0, now - startedAt);
	var readings = [];
	var when = startedAt > createdAt ? t("timer.started", { time: fullWhen(startedAt) }) : t("timer.created", { time: fullWhen(createdAt) });
	var hints = [t("timer.title"), when];
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
//#region src/client/running-cues.ts
/** 共 100 条中英文文案：参考 WorkBuddy 的口语化语气，按实际工具类别改写。
* 每组首句在工具切换时显示；其余只表达同类活动，不承诺完成或下一步。 */
var RUNNING_CUES = {
	idle: [
		{
			zh: "深度求索中",
			en: "Deep diving",
			action: "thinking"
		},
		{
			zh: "正在翻上下文",
			en: "Reading the context",
			action: "context"
		},
		{
			zh: "把线索串起来",
			en: "Connecting the dots",
			action: "connect"
		},
		{
			zh: "换个角度想想",
			en: "Thinking from another angle",
			action: "question"
		},
		{
			zh: "给思路松个结",
			en: "Untangling a thought",
			action: "thread"
		},
		{
			zh: "脑内草稿铺开了",
			en: "Spreading out a mental draft",
			action: "sketching"
		},
		{
			zh: "把问题拆小一点",
			en: "Breaking the question into pieces",
			action: "puzzle"
		},
		{
			zh: "追着小念头转一圈",
			en: "Following a flutter of thought",
			action: "butterfly"
		},
		{
			zh: "让想法排个队",
			en: "Lining up the ideas",
			action: "notes"
		},
		{
			zh: "一边嚼饭，一边琢磨",
			en: "Having a bite and pondering",
			action: "rice_eating"
		},
		{
			zh: "这条思路值得琢磨",
			en: "Exploring this line of thought",
			action: "question"
		},
		{
			zh: "沿着线头想一想",
			en: "Following a thread of thought",
			action: "thread"
		},
		{
			zh: "追着思路转个弯",
			en: "Following a turn in the idea",
			action: "butterfly"
		},
		{
			zh: "把前因后果连上",
			en: "Linking causes and effects",
			action: "puzzle"
		},
		{
			zh: "换副眼镜看问题",
			en: "Looking through a different lens",
			action: "binoculars"
		},
		{
			zh: "这口饭配点思考",
			en: "A bite with a little thought",
			action: "rice_ponder"
		},
		{
			zh: "在脑海里画张草图",
			en: "Sketching an idea in mind",
			action: "sketching"
		},
		{
			zh: "想法有点挤，理一理",
			en: "Giving the ideas some room",
			action: "gears"
		},
		{
			zh: "把重点从背景里挑出来",
			en: "Picking out what matters",
			action: "notes"
		},
		{
			zh: "给这个假设转个圈",
			en: "Looking around this assumption",
			action: "question"
		},
		{
			zh: "让几个方案碰个面",
			en: "Bringing the options together",
			action: "puzzle"
		},
		{
			zh: "沿着逻辑走一走",
			en: "Walking through the logic",
			action: "map"
		},
		{
			zh: "精神食粮也不能少",
			en: "A little food for thought",
			action: "rice_reading"
		},
		{
			zh: "嚼一嚼这条思路",
			en: "Chewing over this idea",
			action: "rice_cheeks"
		},
		{
			zh: "把问题摊开看清楚",
			en: "Unfolding the question",
			action: "question"
		},
		{
			zh: "在脑内摆一摆拼图",
			en: "Arranging the mental puzzle",
			action: "puzzle"
		},
		{
			zh: "追一追飘过的想法",
			en: "Following a passing thought",
			action: "butterfly"
		},
		{
			zh: "米饭配上小纸条",
			en: "Rice with a few notes",
			action: "rice_notes"
		},
		{
			zh: "把零散念头收拢",
			en: "Gathering the scattered ideas",
			action: "sketching"
		},
		{
			zh: "把直觉放到逻辑里看看",
			en: "Examining the intuition with logic",
			action: "ponder"
		},
		{
			zh: "跟着小灵感兜一圈",
			en: "Taking a turn with a little idea",
			action: "butterfly"
		},
		{
			zh: "让细节和全局碰个头",
			en: "Putting details beside the big picture",
			action: "notes"
		}
	],
	edit: [
		{
			zh: "正在改文件",
			en: "Editing files",
			action: "writing"
		},
		{
			zh: "调整这几行",
			en: "Adjusting these lines",
			action: "writing"
		},
		{
			zh: "核对修改细节",
			en: "Working through the changes",
			action: "checking"
		},
		{
			zh: "把改动落在纸上",
			en: "Putting the changes on the page",
			action: "sketching"
		},
		{
			zh: "给代码修修边角",
			en: "Refining the edges of the code",
			action: "toolbox"
		},
		{
			zh: "让这段衔接自然些",
			en: "Smoothing the connection here",
			action: "writing"
		},
		{
			zh: "把意图写清楚",
			en: "Making the intent clearer",
			action: "writing"
		},
		{
			zh: "捋一捋修改的脉络",
			en: "Tracing the changes through",
			action: "notes"
		},
		{
			zh: "给细节挪个位置",
			en: "Repositioning a detail",
			action: "sketching"
		},
		{
			zh: "把这块拼得更贴合",
			en: "Fitting this piece into place",
			action: "puzzle"
		},
		{
			zh: "在改动里对齐线索",
			en: "Aligning clues in the changes",
			action: "notes"
		},
		{
			zh: "让命名少绕个弯",
			en: "Making the naming more direct",
			action: "writing"
		},
		{
			zh: "给这一处留好边界",
			en: "Defining the boundary here",
			action: "measuring"
		},
		{
			zh: "把修改范围圈清楚",
			en: "Keeping the scope of changes clear",
			action: "measuring"
		},
		{
			zh: "让新旧代码接上话",
			en: "Joining the old and new code",
			action: "gears"
		},
		{
			zh: "逐行照顾小细节",
			en: "Tending to the details line by line",
			action: "measuring"
		}
	],
	shell: [
		{
			zh: "在敲命令",
			en: "Running a command",
			action: "typing"
		},
		{
			zh: "等它跑完",
			en: "Waiting for output",
			action: "watching"
		},
		{
			zh: "看着输出",
			en: "Watching the output",
			action: "watching"
		},
		{
			zh: "等终端回个信",
			en: "Waiting to hear from the terminal",
			action: "watching"
		},
		{
			zh: "命令在跑，我在旁边",
			en: "Keeping the command company",
			action: "watching"
		},
		{
			zh: "把这一程交给终端",
			en: "Letting the terminal do this part",
			action: "typing"
		},
		{
			zh: "等进程交回接力棒",
			en: "Waiting for the process to hand back",
			action: "watching"
		},
		{
			zh: "饭在碗里，眼在终端",
			en: "Rice in the bowl, eyes on the terminal",
			action: "rice_terminal"
		},
		{
			zh: "和命令一起等一会儿",
			en: "Waiting alongside the command",
			action: "watching"
		},
		{
			zh: "终端那头还在忙",
			en: "The terminal is at work",
			action: "typing"
		},
		{
			zh: "等输出冒个头",
			en: "Waiting for output to appear",
			action: "watching"
		},
		{
			zh: "给进程一点运行时间",
			en: "Giving the process time to run",
			action: "watching"
		},
		{
			zh: "看命令往哪走",
			en: "Following the command as it runs",
			action: "typing"
		},
		{
			zh: "守着这段运行过程",
			en: "Keeping watch over the run",
			action: "watching"
		}
	],
	read: [
		{
			zh: "在翻代码",
			en: "Reading the code",
			action: "reading"
		},
		{
			zh: "找那一行",
			en: "Finding that line",
			action: "inspecting"
		},
		{
			zh: "顺着引用找",
			en: "Following the references",
			action: "reading"
		},
		{
			zh: "给调用链顺顺毛",
			en: "Untangling the call chain",
			action: "map"
		},
		{
			zh: "沿着函数往里看",
			en: "Looking inside the function",
			action: "flashlight"
		},
		{
			zh: "把入口和出口连起来",
			en: "Connecting entry and exit points",
			action: "reading"
		},
		{
			zh: "在代码里认认路",
			en: "Finding a way through the code",
			action: "map"
		},
		{
			zh: "看看这一层负责什么",
			en: "Examining this layer’s role",
			action: "flashlight"
		},
		{
			zh: "给关键分支放大一点",
			en: "Zooming in on a key branch",
			action: "binoculars"
		},
		{
			zh: "把引用关系铺开",
			en: "Laying out the references",
			action: "notes"
		},
		{
			zh: "顺着数据走一段",
			en: "Following the data flow",
			action: "map"
		},
		{
			zh: "把边界条件圈出来",
			en: "Looking closely at boundary cases",
			action: "measuring"
		},
		{
			zh: "抱着饭桶读两页",
			en: "A couple of pages with a rice bucket",
			action: "rice_reading"
		},
		{
			zh: "在细节里找线索",
			en: "Looking for clues in the details",
			action: "flashlight"
		},
		{
			zh: "把相邻几段一起看看",
			en: "Reading the surrounding code",
			action: "notes"
		},
		{
			zh: "让上下游接上话",
			en: "Tracing the links upstream and down",
			action: "binoculars"
		}
	],
	search: [
		{
			zh: "在查资料",
			en: "Searching references",
			action: "searching"
		},
		{
			zh: "翻两页看看",
			en: "Skimming results",
			action: "context"
		},
		{
			zh: "给关键词换个问法",
			en: "Trying another way to search",
			action: "binoculars"
		},
		{
			zh: "在资料里找线头",
			en: "Looking for a thread in the sources",
			action: "flashlight"
		},
		{
			zh: "把相关页面摊开",
			en: "Laying out relevant pages",
			action: "notes"
		},
		{
			zh: "往原始出处靠一靠",
			en: "Looking toward the original source",
			action: "map"
		},
		{
			zh: "把说法放在一起看",
			en: "Reading the accounts side by side",
			action: "notes"
		},
		{
			zh: "沿着链接多看一眼",
			en: "Following a link for a closer look",
			action: "binoculars"
		},
		{
			zh: "给资料里的重点画圈",
			en: "Picking out key details in the sources",
			action: "flashlight"
		},
		{
			zh: "把背景信息补进来",
			en: "Bringing in background information",
			action: "map"
		},
		{
			zh: "把检索范围收一收",
			en: "Narrowing the search",
			action: "binoculars"
		},
		{
			zh: "从资料堆里找关联",
			en: "Looking for connections in the sources",
			action: "puzzle"
		}
	],
	other: [
		{
			zh: "正在动手",
			en: "Working on it",
			action: "working"
		},
		{
			zh: "再理一理",
			en: "Thinking it through",
			action: "connect"
		},
		{
			zh: "给这件事搭把手",
			en: "Lending a hand to this task",
			action: "toolbox"
		},
		{
			zh: "把零散步骤串起来",
			en: "Joining the scattered steps",
			action: "gears"
		},
		{
			zh: "在这一步上花点心思",
			en: "Giving this step some care",
			action: "toolbox"
		},
		{
			zh: "边吃边理小纸条",
			en: "Having a bite while sorting notes",
			action: "rice_notes"
		},
		{
			zh: "把这件事稳稳接住",
			en: "Handling this part with care",
			action: "working"
		},
		{
			zh: "给任务理理线头",
			en: "Untangling the task’s threads",
			action: "thread"
		},
		{
			zh: "照看一下这块工作",
			en: "Tending to this part of the work",
			action: "toolbox"
		},
		{
			zh: "让手头的事情有条理",
			en: "Keeping the work in order",
			action: "gears"
		}
	]
};

//#endregion
//#region src/client/whale-assets.ts
var WHALE_ASSETS = {
	"binoculars": "data:image/webp;base64,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",
	"butterfly": "data:image/webp;base64,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",
	"checking": "data:image/webp;base64,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",
	"connect": "data:image/webp;base64,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",
	"context": "data:image/webp;base64,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",
	"flashlight": "data:image/webp;base64,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",
	"gears": "data:image/webp;base64,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",
	"inspecting": "data:image/webp;base64,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",
	"map": "data:image/webp;base64,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",
	"measuring": "data:image/webp;base64,UklGRlxCAABXRUJQVlA4TFBCAAAvb8AbEA04bCMpjHb3DrjT8v0XDMmnhIj+TwCfwfj/IXF+FBEADOALXInzI55A4oPg4pycmfkHgOgwOefITPzT6vaqqso0E++klnstVmWTfCHYskZ3XQm8IHpIGqQzaxUz3ugapA1JynyBvihoWJIFvJBUAkn70HwTS6pE2/aK7jUznwhXZfLobnFm4iEjuGaSpHdbsbfOQxG/1VXDpu2RgxE3RcSPZA13OyuWjCdJvzFsSbLUW5MRN2jVQZImtbiJG0iuCPtHUkWt5YgbgZZ4d4RAvCBp4MFQIt6RwKY37n8R3Ngb4Kc36Zsr3g1kKbat2k5xceGw454cXv+bFHfPfrZZHDbnS9MDSJJkq1YyfhjORRbwRtiIxbMCZ+Rf0Yvbl4tfNCRIkqTIUQyIWW/Q/98jHZaYNbW7DTWN/Z8AGEWQQhBYHIH/eGStVwUotkYGmGYRgLKUy5zdSHnIZe2G3bA6WxbAGcpZqvjNFY6CpYTI92zf75FB5sAVyzhzR2klbc/SQyaZ8rHcUrCrAEqfcSXFo7F9LLJClhr2kK0cs5+GXoAnBJmWp9daPjyyRgYAqDj+l8dIQy/CUxr6n4K7WzDJC3m6ZBy7ALieASBw1wq+g5RSKI/ZGlOyslc41oWj1e1+Ke97OZJpIiBxF+CtlsvmcoKpV9qeYZIJdr+b2A8EMApoA3T3o+9hkshdgVtdE2x/SwcIQJc3TOoEkrTO9fFQngQuATI9EPIaQGH0uCgDj+U1vBiCTMCTgAygNJzXe1FojOXjUzM/lvfyUcQR0BGESnVWxcz8/D4ys5QEj7zx1pVoutWvW1+vUsIlEZAhQHANS9FLVNe1XUIp6QEh1u6c3irbdXm7zpVEYscHfgSEgdjHJHqu/8YxjBXRn8S9Wp/73M9+WBytut5QUl3vUllHEG9vYiLZURxQ6VWno8V8Fl76IvCN54U3ZISC5wu8aFtWAjuo/0ClJlrksm87Au71I399w3iyS0n4ISTalvVn/6RnUFFR1aq5nex9s/zmflNB+caGWnZBkx3G5oK24nmlSKzviSbllmjD5DLwc+Pzp6e9j+zrPYcMIXtL2Cmr0iafLPmy1e29NeDqgzghf2NnZEXQv+LfoSc0kxFAusfN/bm/hn7Ukfj8fViOuiOc9O6kWR3tHazrpzdOG9p3WwqkZUHGoAPqBEXJWuih2zv8XppuTs6cdLGttSwRTD/iuYHJCCiasdxf0xcWRQ2NTAsFELY4mF9vyWmihSkMsLQ6DC0ClMUQABw6jeCgjSRHGhd/1ps+EIiICZh/ZwbjI+P8CddP1ih4i0q9WVoVvBCVjbtQqcI87MlblQ2FKws7zFXltivY1IHTjH12XXkNDmhJLWJujjnOVxzQ4fYw3xnvc/00rmfmYj66m08zXxizt4+SbW2K5OZFNlUzMzOKGUPMLIWYmZkpxDiWdgDmLbA98hY8phWw43SWKf6I9liStm3H3pzPF9u1rZHbUbKF4t9Ct5GuIBvJ0T3Y1jS2jY90ZdtWbVVt7uu4u7u72964Owt3dyLis++HEDn3xORcfoGU0DN/gi06sG2btq3R55zr4Nm2bds2vh3ZVsrItm3bymxmNq/2Wg7cRlKkDPNhX/fM3Ac8/v+vSm227YP7rbW27zHGBwmEQDzEiOeI1b3N0bSHu7u7u1YOP1J37+G11Nu4kMYFmARGgGFsz3ZZ6zhdvd22rUaSbVutjzElmcks3CM8MjhWrti8E/ZhZmZmZmZmZoZvzHzOL+Bz8tPBzYyLAhI8yMINJM05hi/8/1S3zbbt9/vPzCItyTLIdpw0djFtSrlOZiqczMznxczMzNf2eW3xdW0xM9PJUEjpaI4cOZPUcepYlmVpacHM/CnAtm3ajsa+96tt27Zt27Zt27Zt27ZtxGqmGSc/956ttm0bZk1vU/QBHUmSHEmSeURVVgMZuIeopY46CsN/3WMxpDAY1F1dmeEi9wrakSRJthWPnPPYREF/iRCB98VypiRGkqRIUkR2H2py+iv1zLg7XRl9AED/Rw4AADAk04MZEAjJgbECGMpkh2tXAicLBAJBUUJIPjbyBlMCAIBBZQOzp+XHyIk1jf90/5mq7PjsHWj2AqFhYyCHFKM56Fly0OfInq1Zz8xfKn9btXpCe1ZO6+LySV1YOSGzckZzVrf+1LDX5ygADU/f1LiDkQKAbk0DE08b2qm+mbt2SrumrunoxDVdH096Mn5Qd2aP5eNzp1v3jp+u9o1f15KVfarMOzYjQIq4AUMhoKq9fZ/hc6s/W377rLbMXNWKpcOatVZ9M2dx5WuLlnY8tnp+/XvrZg/+u2v8knbNXC5b58+27524VSasL3uWmrBS3WE5AgeWAI8VcCUEnXoG5ly34NYhbXpwXktvbGuZvLb4mkpdi6Fz+u6VM2rm6syrNk2e1s6pyx27p+5q3kz5MpC6+3RAhdAHoxxlpF8SMHCw2GAiADPLi6zQ1hlYUG/ol7+c3QcASmD0xFFLaw5TAmBRvPKFdx++z9bpe/Dt1HnkHBteAXdYuD+cn5v85J/rX/vWe+K+6wCs/m/hcgCJATAwDAYqg0cFJAHooX02AxSLZYCi+75O/wcAplhaG6LuiBzICSSQI1AJlunc2dccPmVJ94Lm+rvl8E9wNGPcSl9JrO2aZXfGREd/7i/mJeMLrmjeGXZyZ9pvn/Zz/wwEACwAYGUA8wIIUIKAaICiZAEYL+IDy7M7MtL9B2AEAuCrv0wFAAAGw3RwmJhbDjw6Htt9Lrw45d55O49xm9y0nyiaVsgmEAhd2p7rTVPvMn/t9q0sZmjR/gq1W/rn0YY+H9ze9yY8M8ATpRn3jYJ3BtpaDoDiIJpBdzUMfqKL/49XQgZQa2YE4JHf+qc1fH/AeFDP1P3c92jjn6deNvjj8ceOlu13Ot9fdnVKy9rrS9R/cZuPvHuvN3KLgUkpfGCU7TZxAAMY4BLz4MDmk86JHa8aZ1b3G2bqp6ahKvcjnmzaxamsl3xXF+Vqy897oSRCEFFUAmZUAJ2r427eNHVFeyZv5tkr6z+Fbt/m5+qNoBNAAFhx3q2tL353OtI0p+i5CplG0I594uPvvbu5qZk85MZpDAYEEDJVHzIkgAo8A8+gYWBCNYljIE20MEJSlINmVaZteNG0hmDbQ3M7gGkUoCCGDASC3Lz/0nmrh7Rz6ka1dvpQad4ZtgrBh74aXQAiOboDblkPxg11kM+s1bCtjaZFzBZajjfkk8fWFKCbUTQjQPmioKmDz/VXkrZ4Cb6Ba3B8IAvyAA2igCfyXEutY/qA7lQayvYBoK3f+rWmrTiHXt0BQ4T3Vu1Az+aCR9ctX9KW2bOavVi+BgyZW2egDo/pFndsB+wupYOWogIBA8UxxYAxvOkEBkxgvaY+BgDQoMnvfubLW4S25WS1Lgisy5FV5Q9bw3Vy3BrNHANcAq3PnLxY40MMVfPUneqVQR6wdG2bJhQTv2zwZw8QfEpACaDX9NXNP22av6A1s0kD68uORYpvLa0BiHeZ+2j8YivHhrJhAAUmOhUYUEEAjUNPTTnfvRfnylsfvNNH7jwMk5s+wslX+jtu6LmWT7nOPmmDv9vG4T1++PiaL375O/zmsmWrS0fRM8/C4zsn+dxP8AxFt9ROX/ft2y/PXZtbOlZtHdSEcq2KygGXgCUIPDAqAP1mx77ftsfFfMUn77byxfbmWAwAIZfy0q9+6XtLeVsWg5ZnQEUHyNq/BH50wTgGPPzRRRe8/RFKBMUXa4wdONlyuwA8istgdByIRAJnhxL4Lcdj8Cuve7WXfVubD53h1Ds+/vIKVxC2Y6BMA3bCMzRe2E58TD9ZvmC/1X56+BnJDRYDMDVAAABBZbrDwCemK97ZW97TtstvEO22TgCwap9Ovn/77shO+ZzohWueZUgGHJ6a3we+5OQmP/3mrw799DvfY0H/kdLHh1BZfBrIA08tQqsjS21ZJhFhMYjAIbLxgiTfqGXQtAL1gmJWzxDc6E95eX/VCEBFLzFX643XtnCyV61img9qT7v7WQFMQUUQQQEHGjbNXbG5+sN1z95f1p4N/r/4rD/x4+MDKjVrDYK9KEPEgMC8Pw7dhG69esSc8o36+IQ+3q3H3gRnKRRreA3IBp2AKIEcGMRMQRLLiCWRAAQ4KMMCvYt074pd8kDej2XD1+dvPvvnvX9+ed4YRAXFNZgKatYigI6ScjBJZtiHAMJIYYiARfNVkASw/88+8r1nh5Hnh3Oe05nWzSAADgTdZ7k/Dc42fZ3M8oD+48NWjN9gafcJffFJ/fmdkt1A2C0nKDckQB0ESYhA4AsQiiWxVCgJkiABQzhFkJ16V6luYenw/RbYd3rT+PV+8/pJxREY4BVFRdQdGq0Dupm/H46B7klSEDTCIACs+sc5jPVcMk9SGmIeU+GNERhQ72Dr+kNe/567CAtFFSVbmimSQAjNYJrU3bzf7NZ4JBmAKccsnIDMwSk8HEiI5NVFgxOB4wM2st1Dlpq0lNQmDEs9yTtN5DarQM2Mn5Rd972wKs+rnwDI+QtOynV3nAwgEwoG6o0foPMdxX1slEK5mZYBnkeWwUtr9dRY+YTer333FtlurgOIYsJLQA4UgAQisaQnJkrVaucgt5aQappFgikZQpBpeIB4ASSPmJSwUNNnDLXCs/Xoi3d5+fV7TE8bxj3aW+iHfsmOV1tVU9coH7fLffXyO0es/+TMxXXRuQYhJA+UMlABWO6vxdG6fnGIfMgHGKBZbR3vEt+/2eqXX0+1HLaELxUkCDKIwBMgAQSZp27HCWgbIIBpHR2jhROgolI7L90dg8SLo/ENN0ZkNI+KnNLAAGsp7gSnmvIrjFL6cfuCV/eWthvHl7914Bd/847Z+aNv5/6f8hialQsWBoMDiMUMHhwaNk2Xsp0WNCA9aTS8j9pbtR3eYO2rr/e2p7+GWgQmqICibAtKihqAYnDnNYzndBuCmIgChhKqSJYTAC012sOVxzIwX4meVx25CDNABzgSkSggo2Y0nEaDh3sxlaatoVsw59uMn/z65QxU5NBn7+re8G53S8b/IxUCC6F3IgURRI/97deVB/2JXpmEPINhW7U3Nm2794Dewe5aDhIgAZMwTZSpTDdo1MKUvIoCbwOCrw5OBKtaf8NQ5AMxE7wEJNuQPsn9VjtG8AU4VwzCPUVGo9QZxvWJ1+yrln3wMmvvlU5eDivt9Yl298BVlbUMPw7QpACAIVsRA+e9ecdfS/lYPh1VOY3loszS85l33yk7v8CMJiYvSIRSkYAyHlMUx0piCYhuxEC8U6krtQ6LnmSToUjRcFwoVsTy3WPnjeOq68SXryLgPGBEerRSXLLqW6/J/b+Zp3df0bDf1fNxqTwqfBjQF1tOD9zT0o7y/cbjOhs9EQD9WlJQsTH87P7jN/jgW+9tRiwqicYYOFJzi7fnLKoPyhHiylsGCIBBxcicQoEkuOmhhKioTsHwQfqwlQ2NSU0QgYDyTCwe4rXFlZm4nlYW3iPDFfrWq37+Y17oU/9x24b/dIfWN++Ys9pjls7Qf30Lv/W8/iItuzrva3X35i8ApUAT4uuBuRccmJa1vbtjP85jhrZkli86klvW33hAqr3ADfExmqITAoI3z0gjQwrJACAQ0DQMgBLA9GEKGg4OZg6VIAKpeI9/XCHtu4wNWkhABG4X2N9GV3ljZNxSWPpe+SVQ+1H00lcP3PGH36NY9oyrzu7m7arrHvld20BxfKbnv+FQUEi6z7dBjWAsru3pB0vCLShlgSE46qSXgvZnDkXrEM6EwYxGVcaxLYpGIeILVTUHOE0UACB4QqjQjYNwVtTgm3ASkAGGqiBigDnt/P6T138rjinzw1WVMwgud5T/14OkGws1n7h+sLqWyqM/ekFyr8r83+Tz9T0BTA5EwGsrURkOEBAAZv95sWPtIc06MRngmkcF4T/tWQrajstAoJYKuQgvspPiEChCPU2IAgcwpASTr4NsuXi5mbcBAgSkY5mDzdACCRVV3hlSP9cMrfFm0BC7X9c6zyxjDdFzOHHRCj8n/W1konetnuxIHAfThvLEDgrVfACgJ8AF0QSAmEU4cP+qrzSOWl8dUwED3pjH8n8blJbJKuhSK0KQBBxrCWZwCpARZhwoQXErbgoEySHMuTl9SODdw+3m5jOCQRhAaVQ9itChUGCqRqzKXhAfpWd2qadeH9rAoVfulma/DXZYtYSEIkzEQPKOJqRVhPX5hHmwGYACIwVSiPkPcABxQ3HXV7peVvtBw/BGCF6W2HrvYZVeKJELKQgLRhTm5aHLEslJLAkbTXWk0wFFt9wAQAlq8PD0mZCCr230dJVgaUQEFvA85sOTNEut8djYzTXDu2P9dxbsOqY8aUUA8PI4Cc8gEDEp5ggUqNASCaSTNeTDboERgpElAMS7Ale3So6BxldQd/ibzeXKfRYd7hXrVIByiZAAG2Co2gEJh0jgAJIALs8FUUAFIkTEBAAxgAmoqK7KXnvdXdbLOE7fnM/gqHU0E6gBhpAAoyNQKwP4bkC/R6Tua7QxlkAkfAeAAMEMsAKGYlh+MG1lxdFxrenaCD8On25p9nrL1tdeIECqMLB0O7+6Gpkuo9ZXwICH2nm5+gZdsY6zgAGKUVdfafPAFgQBQksFBkjEAejWybccRBAmahB5EAOQgAEImNaOWVZdGHL5OgLGyxZ9iDhNAxlgAqogQpxEUkSSmswNPQA5LCzARICBMXyjSaeQwDOvKcXFABVb6q52B8uz68rLfidCQRlCcyEQAJbd6Dv5kp9xPJB7ZWy58Wor9z8CF/IFDOKkRPcQouURCStqItl5HoAhtia6lLQZpA0mcUwUbwpD0dIBYH4i8UW5jf890RY4uUg6NonAgMsIQ6EoEUBFgXtVZsao1OXwRtSUC8jhFLpax3AeKlu8nFvLf9LZ1upcpvpg5nYevy/1gEKGOL2VUASB0ACw3Zt1r539He2Doq8//GEzeJU37z5NiwXAoJCLIkZBgq4OSSemaMYQEAO1REnZh8+0DzKKCiJGvCjbeTaW2gEnePl/mbo2ebh7u0XCuDorOJkRj6URyfI8RAWAACYBAkTCYeKwHRmXMdkfyUTN8575ftG79RkGPXz1hElxXqXbV1EaJ727t3z1QWbHqIgi1ezIADquG8+98us695RMu1xPefK0TNgPScAaF3mQ2R0RWQGukZoWp0DKTiJBcAVQgFIFEQe0kZc437726yOdqKCbKwnMq0sgFyCKYFKJRWc8z/GZ2VYlIadC0u4BQ512aHN0rmDsqhRNrE7rRLrOkU8yxz4ucuwj9E49rp096PoFpgIAFKFgRpuekONLvtGOZU+lM0VTwOSMHjO5eQjwSn71qDvLe8b34EYEIp6EXyAows3IAjyUb4GPkhU9vszPEpWHhONaC0+igPaGV1TqPWoOryiV4AiGzk1vP/7g6guqoAKOeMFwONii97Dwsc3TzLkT6wBMmYs48kzsvkwcek63tji6x8+DEsGnqiSmKP5USzi0rJ447ZUulFFH81ztO54nPPlsoCMt1kWiKW5Fr0agiFSDb6LqBuegyUIZUQNwMJrSFvjz7Dg8bHghU5PkCYOAPIY2tMpGoSAq6eIkQ5fXh0/3/jd4quoGCA4MVK0jemfu6rpitcQK2U1kV1Mmn3beugw/XnvVHgJgIQBCbqI6CijrS5tt7xZuj7xsn9YUJ4UPQ1wHAAg6XeoBGXgGJA0e0UCAiA8AEYfBBXiWMjA6/sb54YKRoWF0QzA0vUFGYjHYo8A3oyZoVyqGscs6h39XL45QiiYDMAMpnCPlkNlFV/fwhInaHM021zxA65d3iisBBJcIq9sl5agDAJ0fOXvT5w90Q/d1y631F+aCSDEDZEprqsLBUXUIV0UCoJOD1FWD7K3n3AogUE6AISEugToVVj6y5B/53yjEK4IS0AI2kTMesumdOAKLkEgHh+EAQMnUpMNf6LvMJw6yhbwe6Bglf6idOr1NBn3uNS4BUDkAgUCCcnTm6sRh31XrJzZp7OZxOIEIUICqALR8vaCggKirltGsEZVGEQmUCtQ0BWUcxCO5CPMz6/p/1iPqn/SwSNSkIIXfMRU9dVeKQEqHiUjDIEBE0wGPmixTY928idKxEPVMetosWa1Es2Q/hoXhWhVUGUkYqPr9zAm3CS5Zv63l5x4wwRAgcDg8FWKU7U4PBBJEmto8fMjP9qekB5FDYQCoCCqxK6OIxssSdyngjYiNkClRMo2lU2N9Rh8DOdRUNHPUBWESAAmCBObQ7I+FlhPe1ISanoEIiqSJK57BJPNBufGn2FdVAHJYtQGIle2hN67r3u7y6etbGeFBTAaITFJBguQYhVCCiMqS+tvOvIsNGSNGgAoFIhEgQCB2QqWwCO9dr6OclLdpeevaYbf44dOP8ilWrlEoSQpEKAkBoHwBkrA0o7d18+TMbc6kj5V8T1CLwCHJlcLXj9/uD0WrQgyL3SdX15hjtS0tW9wJeuxV23PGqXRyQgMlspVH3XigkAEZ8CbopwynwBT1ojMCoIzQYIRIUECRJ2bCWYyeYyB+N3zyh3WeeiyuyJd629P3e8+zT7jx4/ezHTzAt4gHFGEC8WJ6SK5sbFAIGk8kzsIe2+/TrHEIF1PqcByTMPNX3ZQAwAcgZrEocvyIqTq7y9M4lopHEevrOTQNVKtZrCetTGMrAgogNQsHzHlI2g2196zq61RrokKMhDTgwgBintqAGdz07YZY4dpJfPffPO63P6z15kdr3sJrvP3Fu3hnEHiKmcWbIQAqAxRptwHWMi04TFXO1tx+Ze/lGawRHI/fKVkm3613eEs/7DeTKQAQ04ABAD+PEd9fnxlcUZ7jsX8Bo05Tw7TG2D1sgFYaAIDvoncdSQ+P/MXT5wxMIFhDNRIg3moygAQJpfbQk3sJl0M//fa/1zJQACb1mx/YWHobRCWGVl9VWp138nzOGYw8DcMPZL/AJGRAAlpW1a1kNrNOna8eAOCvwjp/Y9w5Bg4aTo7pXd0HISnvAIH2wKuiU5gKtLX5Sz/SjcPk4IVTp966LK2zumWyasNDrBe6CfERff/rO1A5uKzRURVYJXw7DQy0iPJ9x3jTt/GdhnKjNo5x8rL21lBqAAAgqEwTOodGx0NuBqSFA1U573bZiTuYQMiUsiQCmlYOhNldPOODd17ZDwCr7Q/S46gXOTEf/53xcJALgInovOBEYPzhK5/o1c5qw2hreZXZXhWKVGAAgGFwBbCOvZz7W0MR7LvqpRKcH2nvgncd+ua+u4dDiCYoCpngUBwBQREBv6DEIgVoR/X+kM94+Hs3nrrlvQMAAAAvEhEbEcboS3dXzbsDHfvTQtOSvimInDiFZZWWdwBCRgQRW4Z0WxRfQsibd/zu536umv+5B7qAAv+v6T+x/T8zdFPjL429Nt2Fk0C/lgAjfnwApK1o2Jb92WiLBw4lJEAiAJwExbF7Htb+nmqOSXNLweCHqPdlYctXr3rf7anm3ScRUnIHroAzwlJEKjSu4sNVNIiiyGqmo9a+3XltKQBYnZ692+TtzvCLYNO6LLDyJnSxBBEUx1UhYMCQakCBA3GhmlCSDDzDJ0XI4ZKxMlz1xKP/mNiuaiKoMuLiaWcuavGNHX9lujtHIAAXIH0t9F7HCc1WtBb5zB/bcPu0QcgWC2AQ6Sz4AMVmN/wLL4wDwlhkmNt/Kb4xvNoznxkp+XMOlSeRArqULovHYqJ2hwTbtYHSjOaP+/wjwQhC9PXv3uA7/W12fItAC6gBMA90vZxr3wGqBaxomyNTdQ2MbBwnhO5CxokCYkCuGd2WFE4Fddk6GInZY1oDvL5twpT2zj1t088eU+/p6UdK6PgAmBJAMqyK0JJXQCQez2CnFUwBgxjkRA1HwW9lX3/2w/5sRU08tVRL3T7ySYNtLeqXM8A27WyPlrVUNU5ao1CIqrT46SiJCJk46xObtrtIS7zvbrTkeM6SJ98q/fLdGn4gzVx/wIHMJGcanEhYSlTR5W2chGirY5BjgCkn1jJy8/hGKCBtad0tppTDbRi6GAoMAaN6+3f+O3T0UOk5MuMKQKuSCBjaTbJ0CirVkobihfysMp5GVwgKroZiCd8mDBSnSGiwdX7I994VrXGGquYOMHzH2XvdeXUqpb5zLAy8cg36jFLHMyIiYoHnFBNkS+BJXRkLnKgnA/WNuu5bjBO64qK7IntadYJKtqP60cFLEKRnV0eQxwCE0fBGEIXAI1O5g2RRiQIAE5OZVC1d/hmmAqXlkM39+V5NiaSWWHANgJ6QwKodenvOSS0PoBU4J86+EzLG6TlVzJFOiDY7QlSzCjHFGmw7u8+er5hjBFYX5LfRaYdJYMd12PUytaaJWacj8sXMTA0Vr9YI0dci4bmVySUTTGy9+KItO3W5X3P6g9fZ8Jm5zi+9IvEwOv144PF9zb7dd+zVQFJRPpXoEeeBb+RJ1GsCIEcBqqtWnQUiSCowwCIJEwut/LP98M+Bden0J6elpzQ7Oa6uWHEeoCerJADKBBSmfc63aaf2FFuMDVBn8dyR6Hr63I1KwyQJIteGWmXKxCj0C5vvLfnCzdY7erG5y42FKgMmCcAhLESvDbxzvWBNQyu3ExuV+sHemi0jJ2/G5im4BV4he6j4Lfe7b3pAaYjIo5np65nqLSf3Pu3MW0x9lBlezehJCZujAi8zZQc9CqRQZtmQgh6RZ4QGACBAAB8hD9ef19b6XRpJF2tCmspCh9WVjlkDIIU/WFpDUJBb25yurCy3xbaq8nzBh2qp/bMx1/717qgVcFhLQy0TzqjYOs2LK/ixAwAAwCqh5mKLs2Z96MjxbvwRrPXA3ReJxVxzwgKcqlLpghHExcNpIQK/GPZKiV67+Af/l0PHTY0fmXLvQ3gL5x7T49+mGl9ChQvVv0RMARcwbo0xhJhLYqIoiS416u0m+TLdAIQELEAUHapP5UT9qXxIqubkh9Ufcz4A7Ovawfx1QkBBawbhOvtLyl7YVrGpK7cDoVNb7UB/qTSLUlI4RA1bQCYCoKxCGcB5FBA1C+3bBEqKzdH3bg11Pj+nm3P03/oihd+1yQrK7grljvYe4Kss++TPHxcsccKL58BQr5zAVND16Ruu+PmPifQkAk6J8tDWd7+k894lBzek1BaHogG1qYZUQN4npGJEHcALVI7JFQmwyGuCNZAtEqQCiyxfCz6rfxtn+9cA8PKP+bnKOyAXpaY9JP0YZFnIrAqoK747VvPOZeFtNhXtlaEZuUUYmOoWwIhCtdTTPio4eZJao93QSaL1fd+r905743bfhbuzmlg980h6GWg5Xfjtlp0F/Lrge+Plv+g5zy85Y6XGGgECJKJhOZFiEqRZHtbgc7qunjc6w1kjLtV01MxpJLzsCAREjpSeD0RFe+lv2ycCgYgEkuE1mlBkNYEjCyuK5KekCjOY1r+VTgKAJjw7IUt75dZKI+gobKbpIy+rUFu6Qda7WTlQpnlrAdFAtqkgVIQIra6zCTgTVpsRWxJFxCNsQFbRBV+m7nwnF0g9eKOgJ9wQA59fqfe+/azcsbXjzS1YAIkgqjIeSV09XCkQBIo4kSQIBBgj85KeDEgvVKqFMUEDqE6KqEdyijkkWqRnDRpIGe0jznFp4CEOQBKCTBpRGYvzA7Tp+ghvyaGWFF62tc5EwGyYr+wGA+X593Mde7J3no+rnjqNSplGdtXGdWutpG5QdZShdcCMfsJgIRpQmcW01XgZfsYrOQCKwCOwyF+86/2sl96tMYGv1g0/9bPKrwx5onnvPmt6FSR/2FXzvpy8YjBFwuHVSuoAgImCAGiUepWyrPLjI9z/Xf+KLQMnBlWNRhCCIyEbdJHJKaMSlfFwEBaBieNrFkGAkggCwSJOjFY56Jdf6S6Vs8EH5kbwhfgVK5PxiILORyP9NxDrfRpRdGLkmPxGDutX9HW9ffNSnzd2n2u/e/yws91Pn74j9TY3PhxSCzTnIb/1cB6AAixFJIgEK4E9NuzSwC1CRKnXC8Yepi96hIV+WUl9MjJwawJuiblfBoPfL2VCkUCHbgiAU/gCIPKdAIjsA+rR68cz/viZp5z9zd8iRoKLvvC0DVlCtUyHqRwkp0p6ptjPEPqICxwAK4rbuUudeSpI2NSplHTlTgCfGfN0uJBzovk033QxMZn5GGBf1g74gYahO4NAKgIIoGKv33kL24vP03WXpl3kbi9TMVwcmo5pDUHEm5BREgEfAaLlUamNUOnBWMPY687fL2Hju2Oztq3AHXF2BDqhACsEljAEG1FP2HNuxEOt3gFpkb0Odo3R3Tbw519fgt3tIvKASKxDGCNhMEeZVCYkAIWCrEynJdUMEiCEWMHgLe9u0dQHCxaIvBrWs4PP1OxqAGTJ9CSM4JDHxmp/Ke9um+0tu8EMUKOeJQ0VweDBn33XVrtkxVndZ7/za3nu9/jxiukoWfooB8PGsTslJck4khRHQ4QCSqHrj9r6478o/2AP+iHLun/8LVZceH3eCZohNQGzEIIY4IdCo4QqUK/WTkpZoireC0P0hAaGDqcI04pEgEQDpeDl+fJEn5ujvghKTJAjUzyN+TWTPG3zUBAAATCgmvD/6/R/9u81EVfgaxbV2PeGf2U3pMvjYZssrHLTulwU7cn8ima2zzgH0Eeq5L/ng6CubFm3zIa2JdW13H3nH8p2Sdc7hmGkBEpRTTR0D6gR1IGWt4a3u3xrgSvjYqLj7qd9q7zfD7/kvxXrCruuiJwPpfzIJeTm7Upu34kAIQwM+QrEsC58+mdqM43te85cFn7zPYXzrZQ8bFq2KlzuNf/tpxg1oVTgAK+7bGZYanhRBW2puKYMSiFfJxIFaVgASgMnme9Y4lb+3+1/OfEiSGYNql2cWf7jmPref3T9E607475Hutfrk15Pr2hjrLgP+GAkhfcKRCGT6TDtzI3yxnnI/XGkVczwje//eGeJSxO7+zJKFtSXiu0TJhSi4M2FsdzTqh3LoP/+L7r2z69K2T6rD8Z9Jr8/oH0+SM7OnGs35K7tazfoUSLagqZatkU1dVCkml2hdJuaZ5nk9wTVy9YLFwne1epVYom2tVc63M80rg50XW7ge+CXI/EDkdkTag3LqcyHJFsCWiAoNVS9dVASL1gB3oEAroOw09RsNYGoAXGLVzI3AI+9d27ytorpnNbiRBDr3QBs4w/SV5BatUFnt+rvvI9CyDDeITRrzzlg3oMr/2qTl3WqE+ElQKnO0Il13gwrsehjNWW7IV//snXdQ1L7uX61hNo6M0C+lvA3vQ26/pzyjaf1d50lflptP3IwLzrtTvRVSugKc60mPBjjlRh7IazdQCgy51c1QTOcdun9vrVsqPStfRe72KsRmxo9kT+R2BoQhl89YoIQ8AgJMgKs9NKSZApgEAAIlTKlVRoxkIqlKJ0UgZy1tRsPFjOb3bKJdkvVEg0Aj+lT4auFQvlo/sXVyixe8DNDR6XncxW7vzK116C+KSRYIoAHiUnEgnwjLYNMp9oXI4oXmgSZeuJ/94tWLw8IyzAFzVVP8QB/+baX+PoYLCVjBtgERvadWdTLZo3PfeRg1c6u2XRronhatueQ6j+JtCheW0o/hde7zhXja2sRv20tIvqbw0jf8VF6VSIdWJwc1NJM1te4fQeIlHCKKSzxkoh3KIADRDyrUFyWSVRGqInvmDjVJqWX9dosOZAGiXq31weA3z5ieNYh9Gqlnjl/4WilnPoLrNHmeAR+0nYY69FWVAyMEiRQEhFgIzOoMqkJn4plp3OC+EvV+RGRudP1z/6EICOASPSxWnh6t2P55Rnv2CeoCcsC04NGgg2M9somOip6fha9ZY5kbWMEMcHsCSpS87GmHVomcpWsiJRr8KhEUdRYHNGUPsOgVs2qhyoyajwJQXKCn+Lrl9bEkQ4DEERQgHAK9IN6qH+2qdps6rdtl16Z17I5bEKGCjoqvm+4u/wEQK987r+KHxt5XQWo0Nkdm/vKqyQvvli8tn1Exy0zu1gAwaQgkSKcatJ6jNlqa3L8xRimEvaKVFU8o95f8lnn/9lP0RxkErFGlE5laIUJFlrLMzrqfbw+3yNCGR5sPvN++Nz46vfP737++2V3mZZmTt3nwdLwS8DUGloI2brnH5B8dWzjpZEK4rvawnbZnjhJYETMAhHImQgQYjp0CSQFvGqZqoUZqAO88fJCiURawZSSkMgWX6IU+jqnHoEsI+E9Em+KGd2a6Jy3r+RZPpiVnJsKLAlmCd8AiRRAMbR2BEXgz9CixUXAGohTSfhhY1O/93e0zqDVcsTHula7nPGIYo4AFDk5rR6QPBitWWzso/f3+7I1v0g4bdhYEBSYUdtGx4tQixHrR2o28+KtnNoWaFERH6DjfRRKYAERyUZuEApwqmcvtIhBImLxBBqSW06mCJqKQSaFE8ur8VBzSLMAngD/BUCwY/Wj8+ISldVJoiUX7gFL0svAFEEKgFShrH9c7mSJCqRQLoFZa3IVLD3/clvx5dCBv/HzkAPvFS4SWgfDXSYuQRUBoKaaZzBuaq6TLvmV0wocqECNABozGq99oQKtnJIzQTeW2i0jxYFIKQIBwAQIxSNoFahBHNCWQ8faZDzJRqYhZQdJmaRCXcR3UWjFKSEw8wOyt2b4Cu9PgFl+9dj34VsWNJvubKNzawKnKvAcJxVJQglxqKzx11seQdKyiTgd4JZICSBJtqB2fWrnX/51lVYQFEUapDRxtle05d75lyqEamDkFaqF6ofmb84fAEQB2hGYAU7DqcpSaq/0nMmxjlulGkXNjIwuaCyOqgyfgI0AgEj4S22K8w7pq7CvtgemykcHAzTAzjRZt9B962Bc5h0AlKkBzHdWJMAZ+4LQl6jHrS6nJuFMexPM9fkfrOMB1ByEwO4wgBdMoqQ5pdsFiclTsJYBqYzqrHmN21nm1c6DqkTPl37B1T/tr6AQtZpR1pXqHqL0YAtQKixFAbMafoWcA0k4HBQAiEFCUdMlqA/wl9Y3NYwReQDFOU0oJbMXSEDM8c1AspQwFECg47NwqjzC705zDY2h46RBXAOuAoi8DqD188XpP2Kk6LrKMSanzBgCsm9q1Zjr4g9D40EQLriWFQ20U7Ld4uO1haz82kjFSEhAVdFmcBgtkT85UYGbE3i+bF5NJcw413YM+6ajGxH2DMFo0bn87QP+lz6m1lLKdoGaV2qdnZaLDeQZOEYgQ4PCEhGnkWYllRlQgKQ1frL2r2DNDO/ujt2027KqnBBjFTioOSRYzgQUhFAgUCSmCqOiCUfKIzi/I9PaCW/c/Q9uHP0oTkpsklwIlMSQJHIR6pkwDlhxeXrDEON96tzW0GcWyKsKye+rc0HP3FjTLjkhdMrqJkeMzZ3VdB1M2cojggvJiEuii2FLTYaXXQrUAiZyATuO+NWbKJHvUd2BmZih04h5U8Mhb+6cejEw9uJ28D0fcGG80uub6CX1ybI8DEFwxiFlpFYxKjCLgcAzpQheulRCB/tNbJvEF87GKltC2wqyTGrawhD2stARFjLhp8ABCpGAcsq2eFkJrjTU5nr67rKKq0t+ZuAgKciCiEgdhr5p/fcDxwwAyGQzZk3Zqd6DgowPRhLo7Gr3SRK+jkabnfty6Pnxyzd7uSIf+4lrAgVIKIko4tbp4UDysEIyhYKogS+BsPQGfkaetc6WCRgSHboFdc9pXuTWs7J//Wd9dH23y3S7XbsS2zRe7IWbqXiSaXBEsDwDHDRAGD2DBFaUfVRgxkVNJafIMeoYa7c+oQ7rY682EaBKJ3Q81D2BgROkCCIRroZEX6psiVhNciAxDCuyRRL3GHDoIAQHRUJZXSY13ex1/QT9kfz8x3HehiPW12yNHrp67PC3CJRCHgnwkeMVpBRYTLIu3GxiJPYuCfLgsMZ84bPe2wzZm8JXwCkUE0abq1aj05Z41kFmcAjkwiBq0QmJOlNxXU0qGc8msHISRLbqyk2hD7ifhcECW94Yc68/7eD2mmLkbBcm0C1wO0X0uIyRVKAbjaZhhSFJQCdCAF11BkvHfuml7xuuOlrdl1XNhgSEYkKzMVEFtRtS6x527NNZCK2MyS/cwX+0N0GRL0JLUsiWvCCYyJ1y5cGX9A95tOLWM/u+66z+ZPqIefvrX3T+yp6r8WvApsEYOGPSm++b17bBGl1Lr42va0LOk0dwSSJi8ipKtDVCaTGAT+KTIK1mRsg80SIkMgrJnQNqoFT8WJn99KSeNeirhWs2dMSjfOTQ1UhBnROZqZKSZLQ34UIjRzWorgkXI4pAKGsVtF8JcabjK6u6lOqrkrUYXkBn1tqKsrMToSZilFgwlJKoyHMf3zwuDNoC/NGIMjbdytm4spY2Ml0MIZsQwxcIsFnirCUnWGrwWNR9Rq/oyMZsvz/Znc1r7nNUvMUzR7TXVAzSW55uk67ekz3iMdimNZlUiAaKiCeSMsAtap6i/iwRC7y0wEgmMFKIWKoEZwIHNQHJLCpFpbI45l4te+cyWiJdIlKNDXsRPw0Ne2qSxHBmIs2ILJafAjh9bOmYEaSxEKO9QX0M8LXa3htwcBpxmgWr3NTnMsxpJg5N4L0jeieIikTCR8QPHWsea0sPBqts1P8ctKjH4xFtYfX5CTx+HDuudsvFEVcIbempxCrbxVEul1wto5A1NKl45T90rEJWPXcfaNGE2IqJc7j/iIGLsO/Rj+MAc3ZJQKCMCIo0haySwQg10nA4A6II01DIgAQRREKZqbhi4XBYU6YRWE6O0pkVLd5ZzSImr0ewzoVXU/72qsOLkcGDJBaiiImHaZdoDQvPllH8yHlxijbcGpLm3OmnpcMXRiKgtu4IbSaTCxwkughMeW2stxiygM4Oqa3AiBIl0soeZ+OHnrfvtL3eiPbxziuaP/3TZ7f/zX/f7Wj4P0eI4Wfs0un+Pb9UHx2Yv3idr5aWWp5fOtPirQA6Vq7XX14/3OZ9FBM3sX7H+uxdMyIUh7ya3cT51svzI5tGiiBA8WaYOKpNEMgngUSRSlWO+Z5QWoVieTPht1YduRyKfapx2dmeVc/GHrl+uwdGi2sTqT4qfuL80J6y4tWM22esIsoFGhEVwyji1GrBa4Xj08RRTXi11BO5gkRIPWZUhLmyfieiucISWKZwArJEdQZlAa5FCYAUghql+9TvvBhyers5bPVbK6sPParv/us3dSc2v9fhsB2/8FPL/fBHvQCAaQH8C+Cf/yGL3PYBAoC2duaClDbXRGLMXPZm7o7BO+8SRK+tlCU6u1j7kteMzgKOHPk8WIicRaG+AmlZkaESIc2hBGSqsBUt9UwjlIQQNHUFsZut/X1jRZQ+8eRm8zdT+ATUW5kvfQRqVuMA6x/n2lrf6ASerNh6lRE5zBBHQQmQ6Zxk5q254+HhinKNEnWFHy07Gl3z3JY3G0wdw0DAJlEKpKptn0eA+kAcwUuFJxGo9Wdsk1wlHe54UsicL/6W77Qzbh/TUW4/Lv53F+fXHL8AAKCrgxcd13ts2HIA3IPHfwxbACKdzJsOzARgHgABIAby+LIRTUthyBsnc5DEOqvH+rxMm1MRqKsOSoJwLHOIhCoYG1vQOe0UbBkNGqIshpF/XgttZh5aqPayECuJd4+dpIlT26dVN1Onv2uV8C3gOuHqgKKtX2HpV0H+yog/XLNu01cXjRD0SFxqOVHgWKBGn6rcJNd0TzOLdBOUUZtuIqQk74bN1JRgalTQA52EPIsoxA+GW536ULApMtAQHu6dnNy9/bBmvPJAFPVHSBgG6RZnsss09o3cAfhsn3/rESoAbOmvs1o79RVlMnRO7J0Iq2yt3mF6dmt/o6Re1bWqjoexu8kjdEKPRKoA35zJJcdLIBpMifMdaRuRdiF7Je5eBQMysuWpPa1atrxzU3CN1pvgZblpRSr8+RSFX0Lq42j4EMkziIcInTdifTT8KvrwDyisurliT9czDlz38obD5yDlCnVa1eY5yYUb0XhctXRZtZR78ZqJnGDF4SS7fY3mVJCjyXCVyFbAGKLXfAANwtKA0xtBzKnLShvrz02KWgCtBQrG+OMHAYv7FDQJaO2YdvKhwWvqoWHMC/XWyNVMrA74VsF9hIsqFE0oqZMScUG1ORVWTzoh2ZG2vwqXGSiOQC6pNYllAHBaHPGy55oOZtmSkz2dJ5OS0Uml367K/KCM8izV5dGrr4yjL7bEUkCNpor42A+FwREqq8xYmeGlDM3cnjOxY659LsgGTBFnQrXSxKsL3vLgVguUCi/jEdHdI+PbJARZroCa5fSGcFDJgwoKAMJG2ALiHkkRMa2nbZGeMAGph3XDuQFMiVqAVxeHQTd9bvWHa89uXiI7H4zjK7q8Bq60YmJwfcQ5jcugMq8M8iAugYUKG6Raqe02RC92hc8DWolIBPJC4RB34ljG3rpz9j43iqXUipGYLNBnlZ75eQt/2g2PfQGU78p4C7xQl0xu17ED9H2VuPn+37E8sfecrJjb/Kb04FB4tI2ka4IqCOgEBEDEExU+WqRcvxyDo3+tUEftk195f6aHFya2OXASIgEoEZVYgOsEiAQJUsgz5VoUDC3kpqHuhGx5SgA93+WB4vczCIArgNGb/e5nBrrTi3fQkrJGTiHDnYdWEuNJ68MbIfhEAhyAUYIZiQO0jUvOvZ4Y+GG04B1PNqIASs9PsOQpuTDQQbmfW25XDJo3FgM2kEc4lktby/do/2VUeGXUVuCvRbLCmouE2mdGjTijZROoE7lr0bEWvDqBOgTDtw4ycoyidy+kf7EXh/5f+U8PL5tyhu6YhFMbyIlZRMzgsXgH3klCBQCRsAWauQwMDaUoAehs1Nl/ACDgf/6DQQDoVANtdHTnZnuXXGKB7EmqlBa0T+07UtSXf73d/eJ2mDgVDrKbZckzHguUmw5/9aHzn9m18Ydt6HpIVTtCJXLbYz3dgdcvKXFrWfj5NuFi1/Z+rCtaSK/T0hBNKPnAuUFl1kYaUE6B44nJE1EsqdakEFG1TumGA/G832rNog25nYI+IEU46ThSsbuXDfzkR7z0L+439YWOSGayzdmKqIgUy8jGJNd6686sj8sFm8vAJEpS1ogI+jQqrh2l+pzK9MhNAEYx4H+DCagIAKjnDbTNVPvVdT70/W7de6p1Y+/8TpveEcKupCQR4vE4QbGBe8pImTJfl8zLhNCv0AUTB2NJZ1hp3Jgeu71vb6iTr0SqdvKDwKcTBNXA5vbkRQA4pTTKKg1rFjc4JcUSir6ij6nEMgHAV2LdzSpEiDoWRyYh2nXX37lgYLgsnAkTD+a+XLXmFkoOyNFPfYaPMNJgJqo15Ic4898Lde7enfpce4Cx2zF1tQkUqXVi/a2D3/ceWX57hmWAQjKHEEYKFQUAmAQxCQauuetzS6wT2phUlAgns83QjtCl1oxkZFZ9yy7mB/yd4p8alZu7nOJ17NZwZU/3OFNdTRwrE4tu980tU09+XUE8bgsUNH3m7etdb+oafdHYocQaYNE8AwAAv3ZRhpa79Q/RjmPEn9Z03R3bclb5a9nQ1eZK2w0bNv+uM72hPeGAELnoYRDqtKR06wIkFhMqRJNsvp47vqf+koGLGHiwtcIdL21vffNtzQ8Lv5mY7sNo6AmMLgRF6IwTrKWla8hAYmcA8ZgWG33vP4RenBnmbSuLrbQMqsLS1UdCIk2OlU70kMi8mdHfao1m5PfHkgXI9eukahROiq5m7CVYe1YIhk71tKNnWBXZwPknnX3PLH6ckkujMKv+dXSxt3inAt4TeyW1AvFUogSzzPDHEe5swS59udPUc55aZlDYHJgePeSt6tzw6ghultc/w4ijKshZVVka6SlaMAyr+/9eGJP/NW+/9Zcf3DL7vztNpQWjGVJ3VdKXY4U3jQt3ePx9/Uv6fjsf+uz3fzCDhrzGg+sw0erAy938w/C5u9j8/M++ZY70s2L94JMuv7/t85lYd976m1T6lMp0x8pX25RrB7zFETrvyt1Z951qkVymImZ8epk5C/Si4w+iuGuwK1XvrZ67M7DQ+FMnsoXEtYyvUqhQ6hqUKxXfjL0+QYMl4WXozHEkPJVGNkBfzRwfD1gb6o87c1vzMvaZ4afy87d0V6bKUGh63t3/UI3/yncq/ufLo++4H/f6wGcm935Q6NzO+wtwNsEE980BKAw3wjx/fVzNfD4iZ799KBkQ3joMOrU5eO7Fdv52eZoM+ehnTj1/fttX/QGaZaNalDxX47Hu02ff6aM3vt77z98lzQNWjZ3R6FyxipZCN0mF3aJGZA6cK/IWks5KiQ7yu2DtzZlPjkFru+Img8omYa6Vv3foKQqfHdLkhDJq7odErcjWkdDNMbtl4LBusmsMbDtfefgj7jrS708u9y7JhEse7c2rlf3h2DK1kuQmn+l7gqb1YObc+0/0zH70eWYSBfqIJH/fAAYDSAC5HHS233lo/u7SO8a7HG2QC23t3SgfdbSOXDJARzwgGjM6xsIVqzdrbMZWfdGRjs+/0OxWee/zN0jXVeJ5EB8XpMHwzWAe+UvHXig9Vq6UMN155VZfMyOrBVxmIkPgKqjsIv5loXJeue79qPvahHBnorW9bHBwVvZjlbbjxXQYUEB6/54Qs2TgqF29GRVEYXOyTYDIvTIkpfy3jJNdY98BSxSYz+J/mRsbV+zj6kHlZAEwZ1ctFxlPXRm+9co1M89qyotLWjcHMtNqx3u3dypYouRF81xuNOOEZAADplq0fe0dvjn1/ssdXOk8Fs/bNS+YbzbIp3V214lNEOscMgrwAEG+IiCI1kSQXouO2RynFbTWKpzta699IuINWcEIUy9L157Dh3TJzLhup9bsy6Z1OtPUerjm9n3P3/n57JjqtScvz+f/DQ5n0hEakBmYpbNg7NNtvBnZpu3F9IegL/B/gOIBFADU/tQSyTfXlxPfHNbDd3ujf3opi3x0uOWG99zEbzuB70Vfdcw5xEIzooKHdJM+DqykMjb2pLLzbIqncp07z1W7qQZgnDp1amzJxWOTa6BrhsdhPRADnowy1KKduECRtupxygm8VbbyrFNlIFVE/3QVF116q7Tckfue1Q3fevCapwF0Y2EcIKPPlr/a+rT/2zBPDb7XzjPX6EkV5eT62Y492S3Nsbelv27SS1GOpgbof13w91Mn6Lu0/L7/991Dx9+zSgsDnCLt4dWg2eGn+VIuQpMFqTp9U29pbM19zehpKjCjcsvTUxKpRlLMKl7UhYjHLfBK3bYyvbEcGKo7jCxUMnOXn+UWhwGlIckDfd4YxTV27xxbiUX17S91+HkYkAA4OAIY2mPFdfOln9fEOW0sT2l5ekQLivTPzGTX2z0mHYWcQAEcGqZ1G+hzih2uGPaybKf6E4GWgB1varHPAVm3rpwfzEVqQ9HalqQny7NcPDd1x3MgI98AQnDQa/PQ/IDdKlyZx7xOwQwATK6caswxwHegUgEwVoZty5LGK7bVts5vDPb09BiH7bXXN+6DGuBwsFQuKgEA/QurcQvqi5Hbaou+G2B0ekYW8EKMxkEAAsCkSwPbvafg3F+/aPxF0SFSBWWaIY5s4Yp9JDdwJRikOyETkqjPF4KEQOCjbHfWMnaOjOUJ2xIWKdecv/qS015qZHQr+kfXuHz+FWcbxwNYBkCoCDQJyDow8zuFguxMDjNfBSio29ajg4MBIAAEAzsczebZrV+WDf3yD6ROm+eydYxjLyC9gzSJUAnqqO2XbHFPmxgKOimCBACapx7PPZrUkDKjyhzosryV1Ow+3vMeqy672qt9AcwEIAAEhvGv0r85MKQYdemZePCrrj/pBUAAiKu61QduevsudOMbfoOOaudV0gtaAE/F5O7ATfW36/MET0b0aETbzRWvTytk171jFbXZwGN5pJ5ZxqfNKvoijoV+AJCAJukhCTzCu6G3gp5vg3ogVo462m1QFjSnu0HH1GqgtV7S2gbBFgleB+d4k4HHA8PDLxj2ypo94YPTg5dkuhOl9/FrKtReILk+ptQ6k0sb+WF/eC1dHcl6mbL9I2Qb6EAgiG9u9pLnNrVQAFSQMKEVlSLizLKiLrL5ytP/ta3soV57U55ZYcZV34kodOcUUAM0gTr2b/Ex4AgAiBMAnUgIccFhF/q632mvmQAdL8uYTqEYSJnFIKtE0M1Ax2dXmJTxpx1KP9wHW26o28tWn0chRzhylyK5b2hifD8dpWQMESsQQM2G5SWW5tUrhGqX4saTMaBGfGn89lovv6bbIvammxzAtAaQX/W97geFfsln8tL0Ue+C318t+x653qv1jF5NfndCHyqJ9ootAujfdDDv/y5MN2Iv5rRRzO47U73obUulezo0vnABYMp3NaByr+1Vul/O52JaQX8k1KyUFZA7odM8Iu2gb8z3o8Ea9sffE2tndxYriwGTc59tUHeTekAX6vrIBIZEHWjY7/OCu6DruYam6pLjc89Mb83bs8c4fjFF9r4GoTdHCziQOfhvhMqph9va6RUiNa8ZoGGow5Uo9N2A6O7oezBIQHnxZ2/ND3eaNW3N6F5tCW0qqBybyN1eHP5izwEMMihml8fk0tahc36L9t7+IOPxctDHoP4cwIiskIRBRfrPUgaMTVr65Kr2cXtKfRsPxB0AREFWdiaAAI00gCEyskAgAAEYEPv/BVAaCADgvxNAAZB/1a9QAvpv8vL/e98BAA==",
	"notes": "data:image/webp;base64,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",
	"ponder": "data:image/webp;base64,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",
	"puzzle": "data:image/webp;base64,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",
	"question": "data:image/webp;base64,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",
	"reading": "data:image/webp;base64,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",
	"rice_cheeks": "data:image/webp;base64,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",
	"rice_eating": "data:image/webp;base64,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",
	"rice_notes": "data:image/webp;base64,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",
	"rice_ponder": "data:image/webp;base64,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",
	"rice_reading": "data:image/webp;base64,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",
	"rice_terminal": "data:image/webp;base64,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",
	"searching": "data:image/webp;base64,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",
	"sketching": "data:image/webp;base64,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",
	"thinking": "data:image/webp;base64,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",
	"thread": "data:image/webp;base64,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",
	"toolbox": "data:image/webp;base64,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",
	"typing": "data:image/webp;base64,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",
	"watching": "data:image/webp;base64,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",
	"working": "data:image/webp;base64,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",
	"writing": "data:image/webp;base64,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"
};

//#endregion
//#region src/client/running-text.ts
/** 每隔多久在同一组里换一句。3.2s 是「读得完一句、又不至于等」的折中。 */
var ROTATE_MS = 3200;
/**
* 检查节拍。300ms 是「轮次开始后几乎立刻出现」与「几乎不耗」的折中：
* 只读取现有运行行；多会话时保留官方文案，避免冒用主会话的工具状态。
*/
var TICK_MS = 300;
/** 文案分组：按「现在在干什么」切，不是纯按时间轮。 */
/**
* 工具名 → 分组。按前缀匹配，认不出的一律落 `other`（在跑，但不知道在跑什么）。
*
* 名字来自宿主报上来的工具名（`bash` / `apply_patch` / …），这里放宽一点，
* 常见别名一起认，免得换个工具名就退回「正在动手」。
*/
var GROUP_RULES = [
	[/^write_stdin$/i, "shell"],
	[/^(apply_patch|edit|write|create_file|str_replace|patch)/i, "edit"],
	[/^(bash|shell|exec|run|terminal|command|process)/i, "shell"],
	[/^(web_search|web_fetch|fetch|browse|search_web|http)/i, "search"],
	[/^(read|read_file|grep|glob|list|ls|search_data|inspect)/i, "read"]
];
/** 正在跑的节拍（`null` = 没跑）。 */
var timer = null;
/** 挂载节点与文案 / 用时引用；鲸鱼娘把文字包成两行。 */
var node = null;
var phraseEl = null;
var timeEl = null;
var imageEl = null;
var imageAction = null;
var pendingImage = null;
var pendingPhrase = "";
var activeSkin = null;
var motionQuery = null;
/** 上一拍看到的那个 `[data-chat-running]`：换了就说明是新的一轮，从第一句重来。 */
var lastRoot = null;
/** 当前分组：工具一换就跳回该组的第一句。 */
var group = "idle";
var index = 0;
var lastRotate = 0;
/** 读「现在在跑哪个工具」；插件在 apply 时把它接上（`store.getSnapshot().tools.active`）。 */
var readTool = null;
/** 应用的语言解析器；没有服务的旧环境安全回落中文，不读取浏览器语言。 */
var resolveText = function(text) {
	return text.zh;
};
/** 配置只借用客户端服务，卸载时释放对 store / locale 的引用。 */
function configureRunningText(options) {
	readTool = options.readTool;
	resolveText = options.resolveText;
	return function() {
		stopRunningText();
		readTool = null;
		resolveText = function(text) {
			return text.zh;
		};
	};
}
function phraseAt() {
	return resolveText(RUNNING_CUES[group][index]);
}
/** locale 订阅通知时立即更新，不必等下一拍。 */
function refreshRunningText() {
	if (timer !== null) tick();
}
/**
* 工具名归到哪一组。
*
* @param name - 正在跑的工具名；没有工具在跑是 `null`。
* @returns 该用哪一组文案。
*/
function groupOfTool(name) {
	if (name === null || name === "") return "idle";
	if (/^(web|browser)[.:/]/i.test(name)) return "search";
	name = name.replace(/^.*[.:/]/, "");
	for (var cursor = 0; cursor < GROUP_RULES.length; cursor += 1) if (GROUP_RULES[cursor][0].test(name)) return GROUP_RULES[cursor][1];
	return "other";
}
/**
* 从官方文案里抠出「用时」那一段。
*
* 官方两种语言都长这样：`深度求索中，用时 1 分 1 秒 ···` / `Deep diving for 1m 1s ···`。
* 共同点是「末尾一串 ···」和「时长从第一个数字开始」，所以先砍掉 ···，再从第一个数字取到结尾。
* 没有数字（轮次刚开始、`startTime` 还没给）就返回空串 —— 那时不显示时长。
*
* @param text - 官方那行的 `data-shimmer-text`。
* @returns 形如 `1 分 1 秒` / `1m 1s`；抠不出来是 `''`。
*/
function extractElapsed(text) {
	var cut = text.lastIndexOf("···");
	var head = cut > 0 ? text.slice(0, cut) : text;
	var start = head.search(/\d/);
	if (start < 0) return "";
	return head.slice(start).trim();
}
/** 直接更新文字，不清空、不重放透明度动画，也不强制回流。 */
function show(phrase) {
	if (phraseEl !== null && phraseEl.textContent !== phrase) phraseEl.textContent = phrase;
}
/** 把我们的 span 挂进 `.runningContent`（末尾），返回它。 */
function mountInto(content) {
	var span = document.createElement("span");
	span.className = "dshh-runText";
	span.setAttribute("data-dsh-hud", "running-text");
	var phrase = document.createElement("span");
	phrase.className = "dshh-runPhrase";
	phrase.textContent = phraseAt();
	var time = document.createElement("span");
	time.className = "dshh-runTime";
	if (activeSkin === "whale") {
		var copy = document.createElement("span");
		copy.className = "dshh-runCopy";
		copy.appendChild(time);
		copy.appendChild(phrase);
		span.appendChild(copy);
		var image = document.createElement("img");
		image.className = "dshh-runWhale";
		image.alt = "";
		image.setAttribute("aria-hidden", "true");
		image.setAttribute("draggable", "false");
		image.hidden = true;
		span.appendChild(image);
		image.onerror = function() {
			if (imageEl !== image) return;
			image.hidden = true;
			if (lastRoot !== null) lastRoot.removeAttribute("data-dsh-hud-running-whale");
		};
		imageEl = image;
	} else {
		span.appendChild(phrase);
		span.appendChild(time);
	}
	content.appendChild(span);
	phraseEl = phrase;
	timeEl = time;
	return span;
}
function cancelPendingImage() {
	if (pendingImage !== null) {
		pendingImage.onload = null;
		pendingImage.onerror = null;
	}
	pendingImage = null;
}
/** 界面外准备新图，解码完成后同拍更新图片与文案，期间保留上一张图。 */
function syncAction(root) {
	var action = RUNNING_CUES[group][index].action;
	var phrase = phraseAt();
	if (imageEl === null) {
		if (node !== null) node.setAttribute("data-action", action);
		show(phrase);
		return;
	}
	pendingPhrase = phrase;
	if (imageAction === action) {
		if (pendingImage === null) show(phrase);
		return;
	}
	cancelPendingImage();
	imageAction = action;
	var image = imageEl;
	var candidate = document.createElement("img");
	pendingImage = candidate;
	function isCurrent() {
		return lastRoot === root && imageEl === image && pendingImage === candidate;
	}
	function commit() {
		if (!isCurrent()) return;
		cancelPendingImage();
		image.src = WHALE_ASSETS[action];
		image.setAttribute("data-action", action);
		image.hidden = false;
		if (node !== null) node.setAttribute("data-action", action);
		show(pendingPhrase);
		root.setAttribute("data-dsh-hud-running-whale", "");
	}
	function failed() {
		if (!isCurrent()) return;
		cancelPendingImage();
		show(pendingPhrase);
	}
	function loaded() {
		if (!isCurrent()) return;
		candidate.onload = null;
		if (typeof candidate.decode === "function") try {
			candidate.decode().then(commit, failed);
		} catch (error) {
			failed();
		}
		else commit();
	}
	candidate.onload = loaded;
	candidate.onerror = failed;
	candidate.src = WHALE_ASSETS[action];
	if (candidate.complete && candidate.naturalWidth > 0) loaded();
}
/** 把官方那行里的「用时」抄到我们这一行。 */
function syncTime(root) {
	if (timeEl === null) return false;
	var source = root.querySelector("[data-shimmer-text]");
	if (source === null) return false;
	var elapsed = extractElapsed(source.getAttribute("data-shimmer-text") || "");
	if (timeEl.textContent !== elapsed) timeEl.textContent = elapsed;
	return true;
}
/** 撤回接管：先取消隐藏标记，再移除自己的节点。 */
function unmount() {
	if (lastRoot !== null) {
		lastRoot.removeAttribute("data-dsh-hud-running-text");
		lastRoot.removeAttribute("data-dsh-hud-running-whale");
	}
	if (imageEl !== null) {
		imageEl.onload = null;
		imageEl.onerror = null;
	}
	cancelPendingImage();
	pendingPhrase = "";
	imageEl = null;
	imageAction = null;
	if (node !== null && node.parentNode !== null) node.parentNode.removeChild(node);
	lastRoot = null;
	node = null;
	phraseEl = null;
	timeEl = null;
	group = "idle";
	index = 0;
	lastRotate = 0;
}
/** 只接管唯一运行行；多会话无法可靠关联工具时全部保留官方文案。 */
function tick() {
	if (typeof document === "undefined") return;
	var roots = typeof document.querySelectorAll === "function" ? Array.from(document.querySelectorAll("[data-chat-running]")) : [];
	if (roots.length !== 1) {
		unmount();
		return;
	}
	var root = roots[0];
	if (root !== lastRoot) unmount();
	var content = root.querySelector("[class*=\"_runningContent\"]");
	if (content === null) {
		unmount();
		return;
	}
	try {
		var next = groupOfTool(readTool === null ? null : readTool());
		if (node === null || node.parentNode !== content) {
			unmount();
			lastRoot = root;
			group = next;
			node = mountInto(content);
			lastRotate = Date.now();
		} else if (next !== group) {
			group = next;
			index = 0;
			lastRotate = Date.now();
		}
		if (!syncTime(root)) {
			unmount();
			return;
		}
		var now = Date.now();
		if (now - lastRotate >= ROTATE_MS && !(activeSkin === "whale" && motionQuery?.matches)) {
			lastRotate = now;
			index = (index + 1) % RUNNING_CUES[group].length;
		}
		syncAction(root);
		root.setAttribute("data-dsh-hud-running-text", "");
	} catch (error) {
		unmount();
	}
}
/** 开始轮播（幂等）；重新确保状态时也立即检查 DOM。 */
function startRunningText() {
	if (typeof window === "undefined" || typeof document === "undefined") return;
	tick();
	if (timer === null) timer = window.setInterval(tick, TICK_MS);
}
/** 停掉轮播并恢复官方文案。 */
function stopRunningText() {
	if (timer !== null) {
		window.clearInterval(timer);
		timer = null;
	}
	if (motionQuery !== null) motionQuery.removeEventListener("change", onMotionChange);
	motionQuery = null;
	activeSkin = null;
	unmount();
}
/** 减弱动态设置切换时重新计拍，不在恢复动画的瞬间跳帧。 */
function onMotionChange() {
	lastRotate = Date.now();
	refreshRunningText();
}
/** 所有皮肤变更（包括轮询 / focus / storage）都经过这里。 */
function syncRunningText(id) {
	if (id !== "plane" && id !== "whale") {
		stopRunningText();
		return;
	}
	if (activeSkin !== id) stopRunningText();
	activeSkin = id;
	if (motionQuery === null && typeof window.matchMedia === "function") {
		motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		motionQuery.addEventListener("change", onMotionChange);
	}
	startRunningText();
}

//#endregion
//#region src/client/running-skin.ts
/**
* 运行状态换皮：把官方「深度求索中」那一行的图标和扫光，换成自己的。
*
* 官方那套在 `@deepseek-ai/dsh-client-ui-chat` 的 `RunningStatus` 里，由两半组成：
*
*   - 图标 `RunningWhaleTail`：一张 APNG 当 CSS `mask`、`background:currentColor` 上色，
*     静态 SVG 只在 `prefers-reduced-motion` 时兜底。帧时长在素材里 —— 所以它只能被整个
*     换掉，调不了速率。
*   - 文字 `TextShimmer`：叠两层同样的字，上层 `decoration > sweep` 带一条 105deg 的遮罩
*     从 -100% 平移到 100%，`1.5s / 延迟 .3s / steps(48,end)`，走完 2/3 个周期就停住。
*
* 这两段都硬编码在组件 CSS 里：既不是主题 token（`ctx.theme` 只能覆盖颜色），也改不了
* i18n（`locale.register` 对同 namespace + 同 locale 直接抛错）。所以只剩一条路 ——
* 注入一份**独立**的样式表把它俩盖掉。
*
* ⚠️ 这份表确实碰了产品的 DOM 选择器，和 `styles.ts` 头注释那条约定相反。因此它单独一个
* 模块、单独一个 `<style>` 节点：把 `RUNNING_SKIN` 改成 `'off'` 就整体不注入，胶囊与面板
* 一行都不受影响。选择器一律走 `data-*` 与结构（`[class*="_runningIcon"]`），不用每次构建
* 都会变的 hash 类名。
*/
/**
* 当前启用的皮肤。
*
* 这是**默认值**，不是最终生效值：`currentSkin()` 从 localStorage 初始化后
* 维护内存状态，持久化失败也不会撤销本次选择。
* 想换成自己的动画：改下面 `PRESETS` 里对应那一段 CSS 就行，选择器不用动。
*/
var RUNNING_SKIN = "whale";
/**
* 设置面板里的方块的顺序。`off` 排第一：想回到原样的人一眼能找到。
* （默认选中鲸鱼娘；已有存储选择保持不变。）
*/
var SKIN_IDS = [
	"off",
	"plane",
	"whale"
];
/** 运行时选择的存储键。浏览器控制台里改它再刷新，等价于点设置面板。 */
var STORAGE_KEY = "dsh-hud:running-skin";
/** 自己这块样式表的 tag，用于幂等注入；与 `styles.ts` 那块互不干扰。 */
var TAG_ID = "dsh-hud/running-skin.css";
/** 内存状态是生效值；存储只负责初始化、持久化与跨窗口同步。 */
var selected = null;
var storageFailed = false;
var listeners = /* @__PURE__ */ new Set();
function storedSkin(value) {
	if (value === "rotate" || value === "pulse") return "plane";
	return value !== null && Object.prototype.hasOwnProperty.call(PRESETS, value) ? value : RUNNING_SKIN;
}
/** 存储不可读时保留内存选择，不把异常当成「恢复默认」。 */
function readStoredSkin() {
	try {
		return storedSkin(window.localStorage.getItem(STORAGE_KEY));
	} catch (error) {
		return null;
	}
}
/** 设置行订阅同一份生效状态。 */
function subscribeRunningSkin(listener) {
	listeners.add(listener);
	return function() {
		listeners.delete(listener);
	};
}
function notify() {
	listeners.forEach(function(listener) {
		listener();
	});
}
var PRESETS = {
	off: "",
	plane: [
		"[data-chat-running] [class*=\"_runningIcon\"]>span,",
		"[data-chat-running] [class*=\"_runningIcon\"]>svg{display:none}",
		"[data-chat-running] [class*=\"_runningIcon\"]{background:currentColor;mask:",
		"url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHBhdGggZD0iTTE0LjYgMS40IDEuNCA2LjlsNSAxLjcgMS43IDV6IiBmaWxsPSIjMDAwIi8+PC9zdmc+\")",
		" center/contain no-repeat;animation:dshh-plane 2.6s ease-in-out infinite}",
		"[data-chat-running][data-dsh-hud-running-text] [data-shimmer]{display:none}",
		"@keyframes dshh-plane{0%,100%{transform:translate3d(0,0,0) rotate(0)}",
		"50%{transform:translate3d(1px,-2px,0) rotate(-8deg)}}",
		"@media(prefers-reduced-motion:reduce){",
		"[data-chat-running] [class*=\"_runningIcon\"]{animation:none!important}}"
	].join(""),
	whale: [
		"[data-chat-running][data-dsh-hud-running-text] [data-shimmer]{display:none}",
		"[data-chat-running][data-dsh-hud-running-whale] [class*=\"_runningIcon\"]{display:none}",
		"[data-chat-running] .dshh-runWhale{order:-1;width:56px;height:56px;flex:0 0 56px;",
		"object-fit:contain}",
		"[data-chat-running] .dshh-runWhale[hidden]{display:none}",
		"[data-chat-running] .dshh-runText{align-items:center;gap:10px;min-height:56px}",
		"[data-chat-running] .dshh-runCopy{display:inline-flex;flex-direction:column;",
		"align-items:flex-start;justify-content:center;gap:2px;min-width:0}",
		"[data-chat-running] .dshh-runTime{font-size:.78em;line-height:1.2}",
		"[data-chat-running] .dshh-runPhrase{white-space:normal;overflow-wrap:anywhere;line-height:1.4}",
		"@media(prefers-reduced-motion:reduce){[data-chat-running] .dshh-runWhale{animation:none}}"
	].join("")
};
/** 当前生效值：只在第一次读取存储，之后由统一入口更新。 */
function currentSkin() {
	if (selected === null) selected = readStoredSkin() || "whale";
	return selected;
}
/** 统一更新样式、轮播生命周期与设置选中态。 */
function applySkin(id) {
	var previous = selected;
	selected = id;
	var tag = applySkinStyles(id);
	syncRunningText(id);
	if (previous !== id) notify();
	return tag;
}
/** 切换立即生效；持久化失败后轮询不能拿旧存储值撤销这次选择。 */
function setSkin(id) {
	currentSkin();
	try {
		window.localStorage.setItem(STORAGE_KEY, id);
		storageFailed = false;
	} catch (error) {
		storageFailed = true;
	}
	applySkin(id);
	return id;
}
/** 跨窗口变更立刻同步；clear() 与删除该键恢复默认。 */
function watchRunningSkin() {
	var onStorage = function(event) {
		if (event.key !== STORAGE_KEY && event.key !== null) return;
		try {
			if (event.storageArea && event.storageArea !== window.localStorage) return;
		} catch (error) {
			return;
		}
		storageFailed = false;
		applySkin(storedSkin(event.newValue));
	};
	window.addEventListener("storage", onStorage);
	ensureRunningSkin();
	return function() {
		window.removeEventListener("storage", onStorage);
		stopRunningText();
		applySkinStyles("off");
	};
}
/**
* 某个皮肤要注入的样式表。
*
* @param id - 皮肤 id，默认取当前生效的那个（`currentSkin()`）；`'off'` 返回空串。
* @returns 可以直接塞进 `<style>` 的 CSS 文本。
*/
function runningSkinCss(id = currentSkin()) {
	return PRESETS[id] || "";
}
/**
* 幂等注入（或撤掉）自己这块样式表。
*
* 和 `ensureStyles()` 一样必须打 `data-plugin`：框架的 client-modules 在每次模块物化后
* 会把当时**没有 `data-plugin`** 的 `<style>` 认领走，并在 HMR 的 replace / prune 路径上
* 连带删除。不打标的表会被别人领走，页面就退回官方那套。
*
* 轮询 / focus 也经过同一入口；持久化失败时保留内存选择。
* @returns 注入后的样式节点；皮肤为 `'off'` 或没有 `document` 时返回 `null`。
*/
function ensureRunningSkin() {
	var id = currentSkin();
	if (!storageFailed) id = readStoredSkin() || id;
	return applySkin(id);
}
/** 只操作自己的样式节点；调用方负责同步运行状态。 */
function applySkinStyles(id) {
	if (typeof document === "undefined") return null;
	var selector = "style[data-plugin-css=\"" + TAG_ID + "\"]";
	var tag = typeof document.querySelector === "function" ? document.querySelector(selector) : null;
	var css = runningSkinCss(id);
	if (css === "") {
		if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
		return null;
	}
	if (!tag) {
		tag = document.createElement("style");
		tag.setAttribute("data-plugin", "@konnga/dsh-hud");
		tag.setAttribute("data-plugin-css", TAG_ID);
		tag.setAttribute("data-dsh-hud", "running-skin");
		document.head.appendChild(tag);
	}
	if (tag.textContent !== css) tag.textContent = css;
	return tag;
}

//#endregion
//#region src/client/components/skin-row.ts
/**
* 「思考中动画」设置行：注册进 dsh「设置 → 通用」的 item 座位，紧挨在官方「外观」下面。
*
* 预设方块对应 `running-skin.ts` 里的预设。点一下立刻换 —— 不用重启、不用刷新：
* `setSkin()` 写完存储就地把那张 `<style>` 换掉。
*
* 视觉照抄官方 `AppearanceRow` 的几何（`.dshh-skin*` 那几条规则是它的等价物），
* 这样它和上下几行看起来是同一个界面，而不是插件贴上来的一块。
*/
/** 官方那只摆尾的轮廓（和 `RunningWhaleTail` 的静态 SVG 同一条路径）。 */
var WHALE_PATH = "M8.844 13.742C8.967 12.328 8.45 10.4 8.45 9.65C8.45 8.94 8.88 8.43 9.6 8.43C11.285 8.43 12.106 8.281 12.685 8.104C13.71 7.791 14.585 6.768 15.055 5.945C15.137 5.803 14.99 5.641 14.829 5.671C13.829 5.86 12.828 5.376 11.827 4.978C10.659 4.514 9.491 4.707 8.935 4.876C8.805 4.915 8.658 4.819 8.636 4.686C8.468 3.643 7.405 2.615 5.498 2.238C4.54 2.048 3.748 1.574 3.347 1.202C3.252 1.113 3.088 1.125 3.03 1.242C2.628 2.059 2.168 3.82 5.248 6.115C5.82 6.494 6.31 6.785 6.574 7.637C6.72 8.104 6.157 9.168 6.061 9.368C5.157 11.27 5.089 12.19 4.926 13.742";
/**
* 每个方块里的小图标：不用 emoji，走和官方一样的 16×16 描边 SVG，
* 这样深浅主题都跟着 `currentColor` 走。
*/
function skinIcon(id) {
	if (id === "whale") return h("img", {
		key: "icon",
		src: WHALE_ASSETS.thinking,
		width: 32,
		height: 32,
		alt: ""
	});
	if (id === "plane") return h("svg", {
		key: "icon",
		width: 16,
		height: 16,
		viewBox: "0 0 16 16",
		fill: "none"
	}, h("path", {
		d: "M14.6 1.4 1.4 6.9l5 1.7 1.7 5z",
		stroke: "currentColor",
		strokeWidth: 1
	}));
	return h("svg", {
		key: "icon",
		width: 16,
		height: 16,
		viewBox: "0 0 16 16",
		fill: "none"
	}, h("path", {
		d: WHALE_PATH,
		stroke: "currentColor",
		strokeWidth: 1
	}));
}
/**
* 渲染这一行。
*
* @param props - 座位组装的 props（`t` 已绑定到本插件词典）。
* @returns 标题 + 预设方块。
*/
function SkinRow(props) {
	var state = react.default.useState(currentSkin);
	var active = state[0];
	var setActive = state[1];
	react.default.useEffect(function() {
		var update = function() {
			setActive(currentSkin());
		};
		var dispose = subscribeRunningSkin(update);
		update();
		return dispose;
	}, []);
	/**
	* 点一下：写存储、立刻换表、再同步选中态。
	*
	* 单独包一层是因为循环里用的是 `var id` —— 直接把闭包塞进 onClick，预设方块会
	* 一起指向最后那个 id。这个函数每次调用都把当时的 id 定住。
	*/
	function picker(id) {
		return function() {
			setActive(setSkin(id));
		};
	}
	var cubes = [];
	for (var index = 0; index < SKIN_IDS.length; index += 1) {
		var id = SKIN_IDS[index];
		cubes.push(h("button", {
			key: id,
			type: "button",
			className: "dshh-skinCube",
			"data-active": id === active ? "" : void 0,
			"aria-pressed": id === active,
			onClick: picker(id)
		}, skinIcon(id), h("span", { key: "label" }, props.t("skin." + id))));
	}
	return h("div", { className: "dshh-skin" }, h("div", {
		key: "title",
		className: "dshh-skinTitle"
	}, props.t("skin.title")), h("div", {
		key: "cubes",
		className: "dshh-skinCubes"
	}, cubes));
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
	"timer.started": "开始于 {time}",
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
	"err.transport": "无法连接到宿主半",
	"skin.title": "思考中动画",
	"skin.off": "官方",
	"skin.plane": "纸飞机",
	"skin.whale": "鲸鱼娘"
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
	"timer.started": "first message {time}",
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
	"err.transport": "Cannot reach the host half",
	"skin.title": "Thinking animation",
	"skin.off": "Official",
	"skin.plane": "Paper plane",
	"skin.whale": "Whale girl"
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
			if (!(previous !== null && previous.available === value.available && previous.createdAt === value.createdAt && previous.startedAt === value.startedAt && previous.llmMs === value.llmMs && previous.toolMs === value.toolMs && previous.turns === value.turns && previous.steps === value.steps)) set({ sessionTime: {
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
	ctx.slots.inject("settings.general.item", function() {
		return ctx.slots.register({
			name: "settings.general.item",
			id: "dsh-hud-running-skin",
			order: 12,
			locale: NS
		}, SkinRow);
	});
	var store = createStore(ctx);
	ctx.effect(function() {
		var dispose = configureRunningText({
			readTool: function() {
				var snapshot = store.getSnapshot();
				var active = snapshot.tools ? snapshot.tools.active : null;
				return active ? active.name : null;
			},
			resolveText: function(text) {
				if (typeof ctx.locale.resolveText === "function") return ctx.locale.resolveText(text);
				var locale = ctx.locale.getSnapshot ? ctx.locale.getSnapshot() : null;
				return locale && locale.active && !locale.active.toLowerCase().startsWith("zh") ? text.en : text.zh;
			}
		});
		var unsubscribeStore = store.subscribe(refreshRunningText);
		var unsubscribe = ctx.locale.subscribe ? ctx.locale.subscribe(refreshRunningText) : null;
		return function() {
			if (unsubscribe) unsubscribe();
			unsubscribeStore();
			dispose();
		};
	}, "dsh-hud: running text");
	ctx.effect(function() {
		return watchRunningSkin();
	}, "dsh-hud: running skin");
	probe.log("apply", {
		inject: typeof ctx.inject === "function",
		slots: typeof ctx.slots === "object",
		chips: cssChipsGap(CSS)
	});
	ctx.effect(function() {
		var id = window.setInterval(function() {
			if (document.visibilityState === "hidden") return;
			ensureStyles();
			ensureRunningSkin();
			store.refresh();
		}, POLL_MS);
		return function() {
			window.clearInterval(id);
		};
	}, "dsh-hud: status poll");
	ctx.effect(function() {
		var onFocus = function() {
			ensureStyles();
			ensureRunningSkin();
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
exports.RUNNING_CUES = RUNNING_CUES;
exports.apply = apply;
exports.extractElapsed = extractElapsed;
exports.groupOfTool = groupOfTool;
exports.inject = inject;
    return module.exports;
  },
});

//# sourceMappingURL=client.js.map