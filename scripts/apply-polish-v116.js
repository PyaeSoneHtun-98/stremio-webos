'use strict';

const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-polish-v116.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv116')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.16 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0, window.__subtitleBridgePOCv112 = !0, window.__subtitleBridgePOCv113 = !0, window.__subtitleBridgePOCv114 = !0, window.__subtitleBridgePOCv115 = !0;',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0, window.__subtitleBridgePOCv112 = !0, window.__subtitleBridgePOCv113 = !0, window.__subtitleBridgePOCv114 = !0, window.__subtitleBridgePOCv115 = !0, window.__subtitleBridgePOCv116 = !0;',
);

replaceOnce(
    'polish state',
    '                    __sbTranslationPhraseRange = null,\n                    __sbCueSource = "none";',
    '                    __sbTranslationPhraseRange = null,\n                    __sbStatus = document.createElement("div"),\n                    __sbDebugVisible = !1,\n                    __sbSelectionWaitUntil = 0,\n                    __sbPointerLayerActive = !1,\n                    __sbCueSource = "none";',
);

replaceOnce(
    'debug/status UI',
    '__sbDebug.textContent = "SB POC loaded", t.appendChild(__sbDebug),',
    '__sbDebug.textContent = "Subtitle Bridge debug", __sbDebug.style.display = "none", t.appendChild(__sbDebug), __sbStatus.setAttribute("data-subtitle-bridge-status", "1"), __sbStatus.style.position = "absolute", __sbStatus.style.left = "50%", __sbStatus.style.bottom = "23%", __sbStatus.style.transform = "translateX(-50%)", __sbStatus.style.zIndex = "130", __sbStatus.style.padding = "9px 14px", __sbStatus.style.border = "1px solid rgba(181,230,209,.22)", __sbStatus.style.borderRadius = "999px", __sbStatus.style.background = "rgba(10,18,24,.9)", __sbStatus.style.color = "#d9eee4", __sbStatus.style.font = "600 14px/1.25 sans-serif", __sbStatus.style.boxShadow = "0 8px 28px rgba(0,0,0,.35)", __sbStatus.style.pointerEvents = "none", __sbStatus.style.display = "none", t.appendChild(__sbStatus),',
);

replaceOnce('debug prefix', '"SB POC | key:" + __sbLastKey', '"Subtitle Bridge | key:" + __sbLastKey');
replaceOnce('prefetch earlier', '__sbFallbackEnd - 8', '__sbFallbackEnd - 12');
replaceOnce(
    'start pending selection after MKV refresh',
    '__sbFallbackCodec = String(i.codec || ""), __sbCueSource = "mkv", U()',
    '__sbFallbackCodec = String(i.codec || ""), __sbCueSource = "mkv", __sbMaybeStartPendingSelection(), U()',
);
replaceOnce(
    'pending selection completion',
    'e && (__sbPendingSelectionUntil = 0, __sbStartSelection(0))',
    'e && (__sbPendingSelectionUntil = 0, __sbSelectionWaitUntil = 0, __sbSetStatus(""), __sbStartSelection(0))',
);

const uiHelpers = [
'                function __sbSetStatus(e) {',
'                    __sbStatus && (__sbStatus.textContent = String(e || ""), __sbStatus.style.display = e ? "block" : "none")',
'                }',
'',
'                function __sbRefreshStatus() {',
'                    if (__sbSelecting || __sbTranslationOpen) return void __sbSetStatus("");',
'                    if (__sbSelectionWaitUntil && Date.now() <= __sbSelectionWaitUntil && !__sbCurrentCueText()) return void __sbSetStatus(__sbFallbackLoading ? "Preparing interactive subtitles…" : "Interactive subtitles are not ready yet");',
'                    __sbSelectionWaitUntil = 0, __sbSetStatus("")',
'                }',
'',
'                function __sbToggleDebug() {',
'                    __sbDebugVisible = !__sbDebugVisible, __sbDebug.style.display = __sbDebugVisible ? "block" : "none"',
'                }',
'                window.__subtitleBridgeToggleDebug = __sbToggleDebug;',
'',
'                function __sbArmPointerLayer(e) {',
'                    if (__sbSelecting || __sbTranslationOpen || !e) return;',
'                    (__sbLastCueText !== e || !__sbWords.length) && __sbRender(e), __sbPointerLayerActive = __sbWords.length > 0, __sbPointerLayerActive && (__sbOverlay.style.opacity = "0.001", __sbOverlay.style.display = "block")',
'                }',
'',
].join('\\n');

replaceOnce(
    'status/debug helper insertion',
    '                function __sbTokenizeSubtitleText(e) {',
    uiHelpers + '                function __sbTokenizeSubtitleText(e) {',
);

replaceOnce(
    'status refresh and Magic pointer layer in update loop',
    '__sbUpdateDebug(e.length, __sbSelecting ? __sbWords.length : 0, a), __sbSelecting || __sbOverlay.style.display === "none" || __sbRender("")',
    '__sbUpdateDebug(e.length, __sbSelecting ? __sbWords.length : 0, a), __sbRefreshStatus(), __sbSelecting ? (__sbPointerLayerActive = !1, __sbOverlay.style.opacity = Math.max(0, Math.min(1, (_ || 100) / 100))) : a && __sbFallbackReady ? __sbArmPointerLayer(a) : (__sbPointerLayerActive = !1, __sbOverlay.style.display === "none" || __sbRender(""))',
);

replaceOnce(
    'short pending selection wait',
    'if (__sbStartSelection(0)) return e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0;\n                        return void 0',
    'if (__sbStartSelection(0)) return e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0;\n                        return __sbPendingSelectionUntil = s + 5e3, __sbSelectionWaitUntil = s + 5e3, __sbSetStatus("Preparing interactive subtitles…"), __sbEnsureFallback(), e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0',
);

replaceOnce(
    'red-key hidden debug toggle',
    '__sbLastKey = t || String(r), U();\n                    if (__sbTranslationOpen) {',
    '__sbLastKey = t || String(r), U();\n                    if (403 === r || "ColorF0Red" === t) return __sbToggleDebug(), e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0;\n                    if (__sbTranslationOpen) {',
);

replaceOnce(
    'selection reveals pointer layer',
    '__sbSelecting || (__sbWasPaused = !!A.paused, A.paused || A.pause(), __sbSelecting = !0, window.__subtitleBridgeEmbeddedActive = !0, __sbSetNativeSubtitleEnabled(!1)), __sbSetSelected("number" == typeof e ? e : 0), !0',
    '__sbSelecting || (__sbWasPaused = !!A.paused, A.paused || A.pause(), __sbSelecting = !0, __sbPointerLayerActive = !1, __sbOverlay.style.opacity = Math.max(0, Math.min(1, (_ || 100) / 100)), window.__subtitleBridgeEmbeddedActive = !0, __sbSetNativeSubtitleEnabled(!1)), __sbSetSelected("number" == typeof e ? e : 0), !0',
);

replaceOnce(
    'Magic Remote hover polish',
    '__sbSelecting ? __sbSetSelected(i) : n.style.outline = "1px solid rgba(255,255,255,.65)"\n                            }, n.onmouseleave = function() {\n                                __sbSelecting || (n.style.outline = "none")',
    '__sbSelecting ? __sbSetSelected(i) : (n.style.backgroundColor = "rgba(181,230,209,.22)", n.style.borderRadius = "5px")\n                            }, n.onmouseleave = function() {\n                                __sbSelecting || (n.style.outline = "none", n.style.backgroundColor = n.__sbBaseBackground, n.style.borderRadius = "0")',
);

replaceOnce(
    'remove POC cue console label',
    'console.log("[SubtitleBridge POC] embedded cue:", e)',
    '__sbDebugVisible && console.log("[Subtitle Bridge] embedded cue:", e)',
);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.16 prefetch UX, hidden debug, loading status, and Magic Remote polish');
