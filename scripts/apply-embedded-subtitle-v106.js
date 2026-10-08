'use strict';

const fs = require('fs');

const target = process.argv[2];
if (!target) {
    console.error('Usage: node scripts/apply-embedded-subtitle-v106.js <video.chunk.js>');
    process.exit(2);
}

let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv106')) {
    console.log('    Embedded subtitle v1.0.6 hardening already applied');
    process.exit(0);
}

function replaceOnce(name, before, after) {
    const first = source.indexOf(before);
    if (first === -1) throw new Error('v1.0.6 hardening: anchor not found: ' + name);
    if (source.indexOf(before, first + before.length) !== -1) {
        throw new Error('v1.0.6 hardening: anchor is not unique: ' + name);
    }
    source = source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceSection(name, startText, endText, replacement, fromIndex) {
    const start = source.indexOf(startText, fromIndex || 0);
    if (start === -1) throw new Error('v1.0.6 hardening: section start not found: ' + name);
    const end = source.indexOf(endText, start + startText.length);
    if (end === -1) throw new Error('v1.0.6 hardening: section end not found: ' + name);
    source = source.slice(0, start) + replacement + source.slice(end);
}

replaceOnce(
    'state additions',
    '                    __sbLastKey = "none",\n                    __sbFallbackCues = [],',
    '                    __sbLastKey = "none",\n                    __sbUpPrimedUntil = 0,\n                    __sbPendingSelectionUntil = 0,\n                    __sbNativeCueRequest = null,\n                    __sbNativeCueMediaId = "",\n                    __sbNativeCueText = "",\n                    __sbNativeCueSeen = !1,\n                    __sbNativeCueUpdatedAt = 0,\n                    __sbNativeCueError = "",\n                    __sbNativeCueRetryAt = 0,\n                    __sbFallbackCues = [],',
);

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgeWebOSPOC = window.__subtitleBridgeWebOSPOC || {}, window.__subtitleBridgeEmbeddedActive = !1;',
    'window.__subtitleBridgeWebOSPOC = window.__subtitleBridgeWebOSPOC || {}, window.__subtitleBridgeEmbeddedActive = !1, window.__subtitleBridgePOCv106 = !0;',
);

const helpers = `                function __sbUpdateDebug(e, t, r) {
                    var n = __sbFallbackLoading ? "loading" : __sbFallbackReady ? "ready" : __sbFallbackError ? "error" : "idle";
                    __sbDebug.textContent = "SB POC | key:" + __sbLastKey + " | nativeTracks:" + (y ? y.length : 0) + " | selected:" + (p || "none") + " | lgCue:" + (__sbNativeCueSeen ? "yes" : "no") + " | textTracks:" + e + " | selectable:" + (r ? "yes" : "no") + " | source:" + __sbCueSource + " | backup:" + __sbFallbackMethod + "/" + n, __sbNativeCueError && (__sbDebug.textContent += " | lg:" + __sbNativeCueError.slice(0, 45)), __sbFallbackError && (__sbDebug.textContent += " | " + __sbFallbackError.slice(0, 55))
                }

                function __sbCleanNativeCue(e) {
                    var t = String(e || "").replace(/\\r/g, "").replace(/\\\\[Nn]/g, "\\n").replace(/\\{[^}]*\\}/g, "");
                    if (/^Dialogue\\s*:/i.test(t)) {
                        var r = t.indexOf(":");
                        t = t.slice(r + 1);
                        for (var n = 0, i = 0; i < t.length; i++) if ("," === t.charAt(i) && ++n === 9) { t = t.slice(i + 1); break }
                    }
                    return __sbPlainText(t).trim()
                }

                function __sbStopNativeCueTap() {
                    try { __sbNativeCueRequest && "function" == typeof __sbNativeCueRequest.cancel && __sbNativeCueRequest.cancel() } catch (e) {}
                    __sbNativeCueRequest = null, __sbNativeCueMediaId = ""
                }

                function __sbMaybeStartPendingSelection() {
                    if (__sbPendingSelectionUntil && Date.now() <= __sbPendingSelectionUntil) {
                        var e = __sbCurrentCueText();
                        e && (__sbPendingSelectionUntil = 0, __sbStartSelection(0))
                    }
                }

                function __sbEnsureNativeCueTap() {
                    if (!A.mediaId || !window.webOS || !window.webOS.service || Date.now() < __sbNativeCueRetryAt) return;
                    if (__sbNativeCueRequest && __sbNativeCueMediaId === A.mediaId) return;
                    __sbStopNativeCueTap(), __sbNativeCueMediaId = A.mediaId, __sbNativeCueError = "";
                    try {
                        __sbNativeCueRequest = window.webOS.service.request("luna://com.webos.media", {
                            method: "subscribe",
                            parameters: { mediaId: A.mediaId, subscribe: !0 },
                            onSuccess: function(e) {
                                var t = e && e.subtitleData;
                                if (t && Object.prototype.hasOwnProperty.call(t, "subtitleData")) {
                                    var r = __sbCleanNativeCue(t.subtitleData);
                                    __sbNativeCueSeen = !0, __sbNativeCueUpdatedAt = Date.now(), __sbNativeCueText = r, __sbCueSource = r ? "lg" : "none", __sbNativeCueError = "", __sbMaybeStartPendingSelection(), U()
                                }
                            },
                            onFailure: function(e) {
                                __sbNativeCueError = String(e && (e.errorText || e.errorCode) || "subscribe failed"), __sbNativeCueRetryAt = Date.now() + 5e3, __sbNativeCueRequest = null
                            }
                        })
                    } catch (e) {
                        __sbNativeCueError = String(e && e.message || e || "subscribe failed"), __sbNativeCueRetryAt = Date.now() + 5e3, __sbNativeCueRequest = null
                    }
                }

                function __sbFetchTextWithTimeout(e, t) {
                    return new Promise((function(r, n) {
                        var i = new XMLHttpRequest, a = !1, s = function(e) { a || (a = !0, n(e)) };
                        try {
                            i.open("GET", e, !0), i.timeout = t, i.onreadystatechange = function() {
                                4 === i.readyState && !a && (a = !0, i.status >= 200 && i.status < 300 ? r(i.responseText || "") : n(new Error((i.responseText || i.status + " " + i.statusText || "request failed").slice(0, 180))))
                            }, i.ontimeout = function() { s(new Error("timeout after " + t + "ms")) }, i.onerror = function() { s(new Error("network error")) }, i.onabort = function() { s(new Error("aborted")) }, i.send()
                        } catch (e) { s(e) }
                    }))
                }

                function __sbCurrentCueText() {
                    var e = Date.now();
                    if (__sbNativeCueText && e - __sbNativeCueUpdatedAt <= 1e4) return __sbNativeCueText;
                    if (__sbFallbackReady) {
                        var t = isFinite(A.currentTime) ? A.currentTime : 0, r = __sbFallbackCues.filter((function(e) { return e.startTime <= t && t <= e.endTime })).map((function(e) { return __sbPlainText(e.text) })).filter(Boolean).join("\\n");
                        if (r) return r
                    }
                    return ""
                }

`;

replaceSection(
    'debug + LG native cue helpers',
    '                function __sbUpdateDebug',
    '                function __sbParseTime',
    helpers,
);

replaceSection(
    'fallback reset',
    '                function __sbResetFallback(e) {',
    '                function __sbEnsureFallback() {',
    `                function __sbResetFallback(e) {
                    __sbFallbackCues = [], __sbFallbackKey = "", __sbFallbackRequestKey = "", __sbFallbackStart = 0, __sbFallbackEnd = 0, __sbFallbackLoading = !1, __sbFallbackReady = !1, __sbFallbackError = "", __sbFallbackMethod = "idle", __sbCueSource = __sbNativeCueText ? "lg" : "none", e && __sbSetNativeSubtitleEnabled(!0)
                }

`,
);

replaceSection(
    'on-demand timed backup extractor',
    '                function __sbEnsureFallback() {',
    '                function __sbSetSelected(e) {',
    `                function __sbEnsureFallback() {
                    if (D && D.url && y && y.length) {
                        var e = __sbTrackIndex();
                        if (e < 0) return;
                        var t = D.url + "|" + e, r = isFinite(A.currentTime) ? Math.max(0, A.currentTime) : 0;
                        t !== __sbFallbackKey && (__sbResetFallback(!1), __sbFallbackKey = t);
                        if (__sbFallbackReady && r >= __sbFallbackStart && r <= __sbFallbackEnd || __sbFallbackLoading) return;
                        __sbFallbackLoading = !0, __sbFallbackMethod = "server", __sbFallbackRequestKey = t + "|server", __sbFallbackError = "";
                        var n = __sbFallbackRequestKey, i = "/subtitles.vtt?from=" + encodeURIComponent(D.url);
                        __sbFetchTextWithTimeout(i, 5e3).then((function(e) {
                            if (__sbFallbackRequestKey !== n || __sbFallbackKey !== t) return;
                            var r = __sbParseVtt(e, 0);
                            if (!r.length) throw new Error("server returned no text cues");
                            __sbFallbackCues = r, __sbFallbackStart = 0, __sbFallbackEnd = 1e12, __sbFallbackLoading = !1, __sbFallbackReady = !0, __sbFallbackError = "", __sbFallbackMethod = "server", __sbCueSource = "server", __sbMaybeStartPendingSelection(), U()
                        })).catch((function(i) {
                            if (__sbFallbackRequestKey !== n || __sbFallbackKey !== t) return;
                            var a = String(i && i.message || i || "server demux failed"), s = Math.max(0, Math.floor(r - 15)), o = 180, l = t + "|ffmpeg|" + s;
                            __sbFallbackMethod = "ffmpeg", __sbFallbackRequestKey = l, __sbFallbackError = "server:" + a;
                            var u = "/subtitle-bridge/embedded.vtt?from=" + encodeURIComponent(D.url) + "&track=" + e + "&start=" + s + "&duration=" + o;
                            __sbFetchTextWithTimeout(u, 3500).then((function(e) {
                                if (__sbFallbackRequestKey !== l || __sbFallbackKey !== t) return;
                                var r = __sbParseVtt(e, s);
                                if (!r.length) throw new Error("FFmpeg returned no text cues");
                                __sbFallbackCues = r, __sbFallbackStart = s, __sbFallbackEnd = s + o - 20, __sbFallbackLoading = !1, __sbFallbackReady = !0, __sbFallbackError = "", __sbFallbackMethod = "ffmpeg", __sbCueSource = "ffmpeg", __sbMaybeStartPendingSelection(), U()
                            })).catch((function(e) {
                                __sbFallbackRequestKey === l && (__sbFallbackLoading = !1, __sbFallbackReady = !1, __sbFallbackError = "server:" + a + " | ffmpeg:" + String(e && e.message || e || "failed"), __sbFallbackMethod = "failed", __sbPendingSelectionUntil = 0, U())
                            }))
                        }))
                    }
                }

`,
);

replaceSection(
    'selection lifecycle',
    '                function __sbStartSelection(e) {',
    '                function __sbPlainText(e) {',
    `                function __sbStartSelection(e) {
                    var t = __sbCurrentCueText();
                    return __sbWords.length || !t || __sbRender(t), __sbWords.length ? (__sbSelecting || (__sbWasPaused = !!A.paused, A.paused || A.pause(), __sbSelecting = !0, window.__subtitleBridgeEmbeddedActive = !0, __sbSetNativeSubtitleEnabled(!1)), __sbSetSelected("number" == typeof e ? e : 0), !0) : !1
                }

                function __sbExitSelection(e) {
                    __sbSelecting && (__sbSelecting = !1, __sbSelected = -1, __sbWords.forEach((function(e) {
                        e.style.outline = "none", e.style.backgroundColor = e.__sbBaseBackground, e.style.borderRadius = "0"
                    })), window.__subtitleBridgeEmbeddedActive = !1, __sbSetNativeSubtitleEnabled(!0), __sbRender(""), e && !__sbWasPaused && A.play())
                }

`,
);

replaceSection(
    'two-step ArrowUp navigation',
    '                function __sbKeydown(e) {',
    '                window.addEventListener("keydown", __sbKeydown, !0);',
    `                function __sbKeydown(e) {
                    var t = e.key || "", r = e.keyCode || e.which, n = "ArrowUp" === t || 38 === r;
                    __sbLastKey = t || String(r), U();
                    if (!__sbSelecting && n) {
                        var i = Date.now();
                        if (i > __sbUpPrimedUntil) return __sbUpPrimedUntil = i + 3500, void 0;
                        __sbUpPrimedUntil = 0;
                        if (__sbStartSelection(0)) return e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0;
                        return __sbPendingSelectionUntil = i + 9e3, __sbEnsureFallback(), e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0
                    }
                    if (!__sbSelecting) __sbUpPrimedUntil = 0;
                    if (__sbSelecting) {
                        if ("ArrowLeft" === t || 37 === r) __sbSetSelected(__sbSelected - 1);
                        else if ("ArrowRight" === t || 39 === r) __sbSetSelected(__sbSelected + 1);
                        else if ("ArrowUp" === t || 38 === r) __sbSetSelected(0);
                        else if ("ArrowDown" === t || 40 === r) return __sbExitSelection(!0), void 0;
                        else {
                            if (!("Escape" === t || "Backspace" === t || 27 === r || 461 === r)) return;
                            __sbExitSelection(!0)
                        }
                        e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation()
                    }
                }
`,
);

const keydownPos = source.indexOf('function __sbKeydown');
replaceSection(
    'non-invasive normal playback update loop',
    '                function U() {',
    '                function B(e) {',
    `                function U() {
                    __sbEnsureNativeCueTap();
                    var e = A.textTracks ? Array.from(A.textTracks) : [], t = null, r = __sbTrackIndex();
                    r >= 0 && r < e.length && (t = e[r]), t || e.some((function(e) { return "showing" === e.mode || "hidden" === e.mode ? (t = e, !0) : !1 })), t || e.length && (t = e[0]);
                    var n = [];
                    e.forEach((function(e) { Array.from(e.cues || []).forEach((function(e) { e.snapToLines = !1, e.line = 100 - x })) })), t && !m && (n = Array.from(t.activeCues || []), n.length || (n = Array.from(t.cues || []).filter((function(e) { return isFinite(e.startTime) && isFinite(e.endTime) && e.startTime <= A.currentTime && A.currentTime <= e.endTime }))));
                    var i = n.map((function(e) { return __sbPlainText(e.text) })).filter(Boolean).join("\\n");
                    i && (__sbNativeCueText = i, __sbNativeCueSeen = !0, __sbNativeCueUpdatedAt = Date.now(), __sbCueSource = "html");
                    var a = __sbCurrentCueText();
                    window.__subtitleBridgeWebOSPOC = { textTrackCount: e.length, activeCueCount: n.length, nativeTrackCount: y ? y.length : 0, selectedEmbeddedTrackId: p, cueText: a, cueSource: __sbCueSource, nativeCueSeen: __sbNativeCueSeen, nativeCueError: __sbNativeCueError, fallbackReady: __sbFallbackReady, fallbackLoading: __sbFallbackLoading, fallbackError: __sbFallbackError, fallbackWindow: [__sbFallbackStart, __sbFallbackEnd], selecting: __sbSelecting, lastKey: __sbLastKey }, __sbUpdateDebug(e.length, __sbSelecting ? __sbWords.length : 0, a), __sbSelecting || __sbOverlay.style.display === "none" || __sbRender("")
                }

`,
    keydownPos
);

replaceOnce(
    'reset cue when embedded track changes',
    'console.log("WebOS", "change subtitles for id: ", A.mediaId, " index:", t), p = t;',
    'console.log("WebOS", "change subtitles for id: ", A.mediaId, " index:", t), p = t, __sbNativeCueText = "", __sbNativeCueSeen = !1, __sbNativeCueUpdatedAt = 0, __sbPendingSelectionUntil = 0, __sbResetFallback(!1);',
);

replaceOnce(
    'unload native cue subscription cleanup',
    '__sbExitSelection(!1), __sbRender(""), __sbResetFallback(!1), D = null, C = null,',
    '__sbExitSelection(!1), __sbRender(""), __sbResetFallback(!1), __sbStopNativeCueTap(), __sbNativeCueText = "", __sbNativeCueSeen = !1, __sbNativeCueUpdatedAt = 0, D = null, C = null,',
);

replaceOnce(
    'destroy native cue subscription cleanup',
    'window.removeEventListener("keydown", __sbKeydown, !0), __sbOverlay.parentNode === t',
    'window.removeEventListener("keydown", __sbKeydown, !0), __sbStopNativeCueTap(), __sbOverlay.parentNode === t',
);

fs.writeFileSync(target, source);
console.log('    Applied embedded subtitle v1.0.6 hardening');
