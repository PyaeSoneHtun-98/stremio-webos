'use strict';
const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-performance-v122.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv122')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.22 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}

replaceOnce('runtime marker',
    'window.__subtitleBridgePOCv120 = !0, window.__subtitleBridgePOCv121 = !0;',
    'window.__subtitleBridgePOCv120 = !0, window.__subtitleBridgePOCv121 = !0, window.__subtitleBridgePOCv122 = !0;');

replaceOnce('addon UI timer state',
    '__sbExtPointerActive = !1;',
    '__sbExtPointerActive = !1,\n                        __sbExtUiSyncTimer = null;');

replaceOnce('hidden addon debug guard',
    '                    function __sbExtDebug() {\n                        var e = document.querySelector("[data-subtitle-bridge-debug]");',
    '                    function __sbExtDebug() {\n                        if (!window.__subtitleBridgeDebugVisible) return;\n                        var e = document.querySelector("[data-subtitle-bridge-debug]");');

replaceOnce('hidden embedded debug guard',
    '                function __sbUpdateDebug(e, t, r) {\n                    var n = __sbFallbackLoading',
    '                function __sbUpdateDebug(e, t, r) {\n                    if (!window.__subtitleBridgeDebugVisible) return;\n                    var n = __sbFallbackLoading');

replaceOnce('debug visibility state',
    '                function __sbToggleDebug() {\n                    __sbDebugVisible = !__sbDebugVisible, __sbDebug.style.display = __sbDebugVisible ? "block" : "none"\n                }',
    '                function __sbToggleDebug() {\n                    __sbDebugVisible = !__sbDebugVisible, window.__subtitleBridgeDebugVisible = __sbDebugVisible, __sbDebug.style.display = __sbDebugVisible ? "block" : "none", __sbDebugVisible && U()\n                }');

replaceOnce('embedded portal throttle state',
    '__sbMagicPortalTimer = null,\n                    __sbCueSource = "none";',
    '__sbMagicPortalTimer = null,\n                    __sbMagicPortalRefreshAt = 0,\n                    __sbCueSource = "none";');

replaceOnce('embedded pointer timer throttle',
    '                    __sbSetMagicPointerPortal(!0), null !== __sbMagicPortalTimer && clearTimeout(__sbMagicPortalTimer), __sbMagicPortalTimer = setTimeout((function() {\n                        __sbMagicPortalTimer = null, __sbSetMagicPointerPortal(!1)\n                    }), 4e3)',
    '                    var e = Date.now();\n                    if (null !== __sbMagicPortalTimer && e < __sbMagicPortalRefreshAt) return;\n                    __sbMagicPortalRefreshAt = e + 750, __sbSetMagicPointerPortal(!0), null !== __sbMagicPortalTimer && clearTimeout(__sbMagicPortalTimer), __sbMagicPortalTimer = setTimeout((function() {\n                        __sbMagicPortalTimer = null, __sbMagicPortalRefreshAt = 0, __sbSetMagicPointerPortal(!1)\n                    }), 4e3)');

replaceOnce('deduplicated addon UI sync',
    '                    function __sbExtScheduleUiSync() {\n                        setTimeout(__sbExtSyncInteractive, 0)\n                    }',
    '                    function __sbExtScheduleUiSync() {\n                        null === __sbExtUiSyncTimer && (__sbExtUiSyncTimer = setTimeout((function() { __sbExtUiSyncTimer = null, __sbExtSyncInteractive() }), 0))\n                    }');

replaceOnce('remove idle addon pointer listeners',
    ', document.addEventListener("pointermove", __sbExtMagicPointerMove, !0), document.addEventListener("mousemove", __sbExtMagicPointerMove, !0), window.addEventListener("keyup", __sbExtScheduleUiSync, !0)',
    ', window.addEventListener("keyup", __sbExtScheduleUiSync, !0)');

replaceOnce('remove idle addon pointer cleanup',
    ', document.removeEventListener("pointermove", __sbExtMagicPointerMove, !0), document.removeEventListener("mousemove", __sbExtMagicPointerMove, !0), window.removeEventListener("keyup", __sbExtScheduleUiSync, !0)',
    ', window.removeEventListener("keyup", __sbExtScheduleUiSync, !0)');

replaceOnce('addon UI timer cleanup',
    'document.removeEventListener("pointerup", __sbExtScheduleUiSync, !0), null !== __sbExtMagicPortalTimer &&',
    'document.removeEventListener("pointerup", __sbExtScheduleUiSync, !0), null !== __sbExtUiSyncTimer && (clearTimeout(__sbExtUiSyncTimer), __sbExtUiSyncTimer = null), null !== __sbExtMagicPortalTimer &&');

replaceOnce('performance diagnostic hook',
    'window.__subtitleBridgeEmbeddedActive = !1, window.__subtitleBridgePOCv106 = !0',
    'window.__subtitleBridgeEmbeddedActive = !1, window.__subtitleBridgeDebugVisible = !1, window.__subtitleBridgePerformance = function() { var e = window.__subtitleBridgeWebOSPOC || {}, t = document.querySelector("[data-subtitle-bridge-external-interaction]"), r = document.querySelector("[data-subtitle-bridge-poc]"); return { domNodes: document.getElementsByTagName("*").length, embedded: { active: !!window.__subtitleBridgeEmbeddedActive, words: r ? r.querySelectorAll("[data-sb-word]").length : 0, nodes: r ? r.getElementsByTagName("*").length : 0, lifecycle: e.lifecyclePerformance || null }, addon: { active: !!window.__subtitleBridgeExternalActive, words: t ? t.querySelectorAll("[data-subtitle-bridge-external-word]").length : 0, nodes: t ? t.getElementsByTagName("*").length : 0 }, debugVisible: !!window.__subtitleBridgeDebugVisible }; }, window.__subtitleBridgePOCv106 = !0');

replaceOnce('lifecycle diagnostic state',
    'fallbackWindow: [__sbFallbackStart, __sbFallbackEnd], selecting: __sbSelecting, lastKey: __sbLastKey }',
    'fallbackWindow: [__sbFallbackStart, __sbFallbackEnd], selecting: __sbSelecting, lastKey: __sbLastKey, lifecyclePerformance: __sbLifecycle.stats ? __sbLifecycle.stats() : null }');

replaceOnce('stable public state object',
    'window.__subtitleBridgeWebOSPOC = { textTrackCount: e.length, activeCueCount: n.length, nativeTrackCount: y ? y.length : 0, selectedEmbeddedTrackId: p, cueText: a, cueSource: __sbCueSource, nativeCueSeen: __sbNativeCueSeen, nativeCueError: __sbNativeCueError, fallbackReady: __sbFallbackReady, fallbackLoading: __sbFallbackLoading, fallbackError: __sbFallbackError, fallbackWindow: [__sbFallbackStart, __sbFallbackEnd], selecting: __sbSelecting, lastKey: __sbLastKey, lifecyclePerformance: __sbLifecycle.stats ? __sbLifecycle.stats() : null }',
    'window.__subtitleBridgeWebOSPOC.textTrackCount = e.length, window.__subtitleBridgeWebOSPOC.activeCueCount = n.length, window.__subtitleBridgeWebOSPOC.nativeTrackCount = y ? y.length : 0, window.__subtitleBridgeWebOSPOC.selectedEmbeddedTrackId = p, window.__subtitleBridgeWebOSPOC.cueText = a, window.__subtitleBridgeWebOSPOC.cueSource = __sbCueSource, window.__subtitleBridgeWebOSPOC.nativeCueSeen = __sbNativeCueSeen, window.__subtitleBridgeWebOSPOC.nativeCueError = __sbNativeCueError, window.__subtitleBridgeWebOSPOC.fallbackReady = __sbFallbackReady, window.__subtitleBridgeWebOSPOC.fallbackLoading = __sbFallbackLoading, window.__subtitleBridgeWebOSPOC.fallbackError = __sbFallbackError, window.__subtitleBridgeWebOSPOC.fallbackWindow = [__sbFallbackStart, __sbFallbackEnd], window.__subtitleBridgeWebOSPOC.selecting = __sbSelecting, window.__subtitleBridgeWebOSPOC.lastKey = __sbLastKey, window.__subtitleBridgeWebOSPOC.lifecyclePerformance = window.__subtitleBridgeDebugVisible && __sbLifecycle.stats ? __sbLifecycle.stats() : null');

fs.writeFileSync(target, source);
console.log('    Applied v1.0.22 bounded idle work, timer cleanup, and performance diagnostics');
