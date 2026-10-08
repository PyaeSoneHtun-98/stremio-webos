'use strict';
const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-interaction-perf-v119.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv119')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.19 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgePOCv116 = !0, window.__subtitleBridgePOCv117 = !0, window.__subtitleBridgePOCv118 = !0;',
    'window.__subtitleBridgePOCv116 = !0, window.__subtitleBridgePOCv117 = !0, window.__subtitleBridgePOCv118 = !0, window.__subtitleBridgePOCv119 = !0;'
);

// v1.0.18 kept full-screen document-level subtitle hit layers alive all the time.
// On the TV that adds unnecessary compositing/DOM work while the indexed MKV
// request is trying to complete. Keep v1.0.17's lightweight player-local layer
// by default and elevate it only while the Magic Remote pointer is moving.
replaceOnce(
    'embedded pointer portal state',
    '__sbSelectionWaitUntil = 0,\n                    __sbPointerLayerActive = !1,',
    '__sbSelectionWaitUntil = 0,\n                    __sbPointerLayerActive = !1,\n                    __sbMagicPortalTimer = null,'
);
replaceOnce('embedded idle position', '__sbOverlay.style.position = "fixed"', '__sbOverlay.style.position = "absolute"');
replaceOnce('embedded idle z', '__sbOverlay.style.zIndex = "2147483000"', '__sbOverlay.style.zIndex = "110"');
replaceOnce(
    'embedded idle parent',
    't.style.position = t.style.position || "relative", (document.body || document.documentElement).appendChild(__sbOverlay), __sbDebug.setAttribute',
    't.style.position = t.style.position || "relative", t.appendChild(__sbOverlay), __sbDebug.setAttribute'
);

const embeddedPortal = `                function __sbSetMagicPointerPortal(e) {
                    var r = document.body || document.documentElement;
                    if (e) {
                        __sbOverlay.parentNode !== r && (__sbOverlay.parentNode && __sbOverlay.parentNode.removeChild(__sbOverlay), r.appendChild(__sbOverlay)), __sbOverlay.style.position = "fixed", __sbOverlay.style.zIndex = "2147483000"
                    } else {
                        __sbOverlay.parentNode !== t && (__sbOverlay.parentNode && __sbOverlay.parentNode.removeChild(__sbOverlay), t.appendChild(__sbOverlay)), __sbOverlay.style.position = "absolute", __sbOverlay.style.zIndex = "110"
                    }
                }

                function __sbMagicPointerMove() {
                    if (__sbSelecting || __sbTranslationOpen || !__sbFallbackReady || !__sbCurrentCueText()) return;
                    __sbSetMagicPointerPortal(!0), null !== __sbMagicPortalTimer && clearTimeout(__sbMagicPortalTimer), __sbMagicPortalTimer = setTimeout((function() {
                        __sbMagicPortalTimer = null, __sbSetMagicPointerPortal(!1)
                    }), 4e3)
                }
                document.addEventListener("pointermove", __sbMagicPointerMove, !0), document.addEventListener("mousemove", __sbMagicPointerMove, !0);

`;
replaceOnce(
    'embedded pointer portal helper',
    '                function __sbArmPointerLayer(e) {',
    embeddedPortal + '                function __sbArmPointerLayer(e) {'
);
replaceOnce(
    'embedded portal destroy cleanup',
    'window.removeEventListener("keydown", __sbKeydown, !0), __sbStopNativeCueTap(), document.removeEventListener("pointerdown", __sbTranslationOutsidePointer, !0), __sbDismissTranslation(),',
    'window.removeEventListener("keydown", __sbKeydown, !0), document.removeEventListener("pointermove", __sbMagicPointerMove, !0), document.removeEventListener("mousemove", __sbMagicPointerMove, !0), null !== __sbMagicPortalTimer && (clearTimeout(__sbMagicPortalTimer), __sbMagicPortalTimer = null), __sbStopNativeCueTap(), document.removeEventListener("pointerdown", __sbTranslationOutsidePointer, !0), __sbDismissTranslation(),'
);

// External/addon subtitles should do no renderer/tokenizer DOM work while an
// embedded track is selected. This keeps addon parity from competing with the
// v1.0.17 active-cue XHR on low-power TVs.
replaceOnce(
    'addon pointer portal state',
    '__sbExtLookupVersion = 0;',
    '__sbExtLookupVersion = 0,\n                        __sbExtMagicPortalTimer = null;'
);
replaceOnce(
    'addon idle local layer',
    'h.style.pointerEvents = "none", h.style.zIndex = "2147483000", h.style.position = "fixed", h.style.left = "0", h.style.right = "0", h.style.width = "100vw", h.parentNode && h.parentNode.removeChild(h), (document.body || document.documentElement).appendChild(h);',
    'h.style.pointerEvents = "none", h.style.zIndex = "100", h.style.position = "absolute", h.style.left = "0", h.style.right = "0", h.style.width = "auto";'
);

const externalPortal = `                    function __sbExtSetMagicPointerPortal(e) {
                        var t = document.body || document.documentElement;
                        if (e) {
                            h.parentNode !== t && (h.parentNode && h.parentNode.removeChild(h), t.appendChild(h)), h.style.position = "fixed", h.style.left = "0", h.style.right = "0", h.style.width = "100vw", h.style.zIndex = "2147483000"
                        } else {
                            h.parentNode !== d && (h.parentNode && h.parentNode.removeChild(h), d.appendChild(h)), h.style.position = "absolute", h.style.left = "0", h.style.right = "0", h.style.width = "auto", h.style.zIndex = "100"
                        }
                    }

                    function __sbExtMagicPointerMove() {
                        if (!g || __sbExtSelecting || __sbExtPopupOpen) return;
                        var e = window.__subtitleBridgeWebOSPOC, t = e && /^EMBEDDED_\\d+$/.test(String(e.selectedEmbeddedTrackId || ""));
                        if (t) return;
                        __sbExtSetMagicPointerPortal(!0), null !== __sbExtMagicPortalTimer && clearTimeout(__sbExtMagicPortalTimer), __sbExtMagicPortalTimer = setTimeout((function() {
                            __sbExtMagicPortalTimer = null, __sbExtSetMagicPointerPortal(!1)
                        }), 4e3)
                    }

`;
replaceOnce(
    'addon pointer portal helper',
    '                    function __sbExtOutsidePointer(e) {',
    externalPortal + '                    function __sbExtOutsidePointer(e) {'
);

replaceOnce(
    'addon embedded-mode fast path',
    '                    function I() {\n                        if (window.__subtitleBridgeEmbeddedActive) {',
    '                    function I() {\n                        var __sbExtInfo = window.__subtitleBridgeWebOSPOC, __sbExtEmbeddedSelected = __sbExtInfo && /^EMBEDDED_\\d+$/.test(String(__sbExtInfo.selectedEmbeddedTrackId || ""));\n                        if (window.__subtitleBridgeEmbeddedActive || __sbExtEmbeddedSelected) {'
);
replaceOnce(
    'addon skip empty time renders',
    '                        if ("time" === t) f.time = r, I();',
    '                        if ("time" === t) f.time = r, (null !== g || h.hasChildNodes()) && I();'
);
replaceOnce(
    'addon pointer move listeners',
    'window.addEventListener("keydown", __sbExtKeydown, !0), document.addEventListener("pointerdown", __sbExtOutsidePointer, !0);',
    'window.addEventListener("keydown", __sbExtKeydown, !0), document.addEventListener("pointerdown", __sbExtOutsidePointer, !0), document.addEventListener("pointermove", __sbExtMagicPointerMove, !0), document.addEventListener("mousemove", __sbExtMagicPointerMove, !0);'
);
replaceOnce(
    'addon portal destroy cleanup',
    'window.removeEventListener("keydown", __sbExtKeydown, !0), document.removeEventListener("pointerdown", __sbExtOutsidePointer, !0), __sbExtDismissPopup(),',
    'window.removeEventListener("keydown", __sbExtKeydown, !0), document.removeEventListener("pointerdown", __sbExtOutsidePointer, !0), document.removeEventListener("pointermove", __sbExtMagicPointerMove, !0), document.removeEventListener("mousemove", __sbExtMagicPointerMove, !0), null !== __sbExtMagicPortalTimer && (clearTimeout(__sbExtMagicPortalTimer), __sbExtMagicPortalTimer = null), __sbExtDismissPopup(),'
);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.19 interaction performance isolation with on-demand Magic Remote portals');
