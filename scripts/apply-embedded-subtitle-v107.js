'use strict';

const fs = require('fs');

const target = process.argv[2];
if (!target) {
    console.error('Usage: node scripts/apply-embedded-subtitle-v107.js <video.chunk.js>');
    process.exit(2);
}

let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv107')) {
    console.log('    Embedded subtitle v1.0.7 hardening already applied');
    process.exit(0);
}

function replaceOnce(name, before, after) {
    const first = source.indexOf(before);
    if (first === -1) throw new Error('v1.0.7 hardening: anchor not found: ' + name);
    if (source.indexOf(before, first + before.length) !== -1) {
        throw new Error('v1.0.7 hardening: anchor is not unique: ' + name);
    }
    source = source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceSection(name, startText, endText, replacement, fromIndex) {
    const start = source.indexOf(startText, fromIndex || 0);
    if (start === -1) throw new Error('v1.0.7 hardening: section start not found: ' + name);
    const end = source.indexOf(endText, start + startText.length);
    if (end === -1) throw new Error('v1.0.7 hardening: section end not found: ' + name);
    source = source.slice(0, start) + replacement + source.slice(end);
}

replaceOnce(
    'v1.0.7 runtime marker',
    'window.__subtitleBridgeWebOSPOC = window.__subtitleBridgeWebOSPOC || {}, window.__subtitleBridgeEmbeddedActive = !1, window.__subtitleBridgePOCv106 = !0;',
    'window.__subtitleBridgeWebOSPOC = window.__subtitleBridgeWebOSPOC || {}, window.__subtitleBridgeEmbeddedActive = !1, window.__subtitleBridgePOCv106 = !0, window.__subtitleBridgePOCv107 = !0;',
);

replaceOnce(
    'first-load and subscription state',
    '                    __sbNativeCueRetryAt = 0,\n                    __sbFallbackCues = [],',
    '                    __sbNativeCueRetryAt = 0,\n                    __sbNativeCueAttempt = 0,\n                    __sbNativeCueSourceInfoSeen = !1,\n                    __sbNativeCueWatchdog = null,\n                    __sbPendingEmbeddedTrackId = null,\n                    __sbAppliedEmbeddedTrackKey = "",\n                    __sbPendingEmbeddedApplyTimer = null,\n                    __sbFallbackCues = [],',
);

replaceOnce(
    'debug first-load state',
    ' | lgCue:" + (__sbNativeCueSeen ? "yes" : "no") + " | textTracks:"',
    ' | lgPipe:" + (__sbNativeCueSourceInfoSeen ? "ready" : "wait") + " | lgCue:" + (__sbNativeCueSeen ? "yes" : "no") + " | pending:" + (__sbPendingEmbeddedTrackId || "none") + " | textTracks:"',
);

replaceSection(
    'LG cue subscription retry and first-load apply helpers',
    '                function __sbStopNativeCueTap() {',
    '                function __sbFetchTextWithTimeout',
    `                function __sbClearNativeCueWatchdog() {
                    null !== __sbNativeCueWatchdog && (clearTimeout(__sbNativeCueWatchdog), __sbNativeCueWatchdog = null)
                }

                function __sbStopNativeCueTap() {
                    __sbClearNativeCueWatchdog();
                    try { __sbNativeCueRequest && "function" == typeof __sbNativeCueRequest.cancel && __sbNativeCueRequest.cancel() } catch (e) {}
                    __sbNativeCueRequest = null, __sbNativeCueMediaId = ""
                }

                function __sbMaybeStartPendingSelection() {
                    if (__sbPendingSelectionUntil && Date.now() <= __sbPendingSelectionUntil) {
                        var e = __sbCurrentCueText();
                        e && (__sbPendingSelectionUntil = 0, __sbStartSelection(0))
                    }
                }

                function __sbApplyPendingEmbeddedTrack() {
                    !__sbPendingEmbeddedTrackId && "string" == typeof p && 0 === p.indexOf("EMBEDDED_") && (__sbPendingEmbeddedTrackId = p);
                    if (!__sbPendingEmbeddedTrackId || !D || !A.mediaId || "<invalid mediaId>" === A.mediaId || A.readyState < A.HAVE_METADATA) return;
                    var e = A.mediaId + "|" + __sbPendingEmbeddedTrackId;
                    if (e === __sbAppliedEmbeddedTrackKey || null !== __sbPendingEmbeddedApplyTimer) return;
                    var t = __sbPendingEmbeddedTrackId;
                    __sbPendingEmbeddedApplyTimer = setTimeout((function() {
                        __sbPendingEmbeddedApplyTimer = null;
                        if (D && A.mediaId && "<invalid mediaId>" !== A.mediaId && t === __sbPendingEmbeddedTrackId) {
                            __sbAppliedEmbeddedTrackKey = A.mediaId + "|" + t, V("selectedSubtitlesTrackId", t), __sbSetNativeSubtitleEnabled(!0), __sbEnsureNativeCueTap(!0)
                        }
                    }), 350)
                }

                function __sbScheduleNativeCueRetry(e) {
                    __sbNativeCueAttempt >= 8 || setTimeout((function() {
                        D && A.mediaId && __sbEnsureNativeCueTap(!0)
                    }), e)
                }

                function __sbEnsureNativeCueTap(e) {
                    if (!D || !A.mediaId || "<invalid mediaId>" === A.mediaId || !window.webOS || !window.webOS.service || A.readyState < A.HAVE_METADATA) return;
                    if (!e && __sbNativeCueRequest && __sbNativeCueMediaId === A.mediaId) return;
                    __sbStopNativeCueTap(), __sbNativeCueMediaId = A.mediaId, __sbNativeCueError = "", __sbNativeCueAttempt++;
                    var t = A.mediaId, r = __sbNativeCueAttempt;
                    try {
                        var n = window.webOS.service.request("luna://com.webos.media", {
                            method: "subscribe",
                            parameters: { mediaId: t, subscribe: !0 },
                            onSuccess: function(e) {
                                if (__sbNativeCueMediaId !== t) return;
                                e && e.sourceInfo && (__sbNativeCueSourceInfoSeen = !0, __sbNativeCueError = "", __sbClearNativeCueWatchdog(), __sbApplyPendingEmbeddedTrack());
                                var r = null;
                                e && e.subtitleData && "object" == typeof e.subtitleData ? r = e.subtitleData : e && "string" == typeof e.subtitleData && (r = e), e && e.userDefinedEvent && e.userDefinedEvent.subtitleData && (r = e.userDefinedEvent.subtitleData);
                                if (r && Object.prototype.hasOwnProperty.call(r, "subtitleData")) {
                                    var n = __sbCleanNativeCue(r.subtitleData);
                                    __sbNativeCueSeen = !0, __sbNativeCueSourceInfoSeen = !0, __sbNativeCueUpdatedAt = Date.now(), __sbNativeCueText = n, __sbCueSource = n ? "lg" : "none", __sbNativeCueError = "", __sbClearNativeCueWatchdog(), __sbMaybeStartPendingSelection(), U()
                                }
                            },
                            onFailure: function(e) {
                                __sbNativeCueMediaId === t && (__sbStopNativeCueTap(), __sbNativeCueError = String(e && (e.errorText || e.errorCode) || "subscribe failed"), __sbNativeCueRetryAt = Date.now() + 400, __sbScheduleNativeCueRetry(400))
                            }
                        });
                        __sbNativeCueRequest = n, __sbNativeCueWatchdog = setTimeout((function() {
                            __sbNativeCueRequest === n && __sbNativeCueMediaId === t && !__sbNativeCueSourceInfoSeen && !__sbNativeCueSeen && (__sbStopNativeCueTap(), __sbNativeCueError = "pipeline subscribe timeout #" + r, __sbScheduleNativeCueRetry(450))
                        }), 1800)
                    } catch (e) {
                        __sbStopNativeCueTap(), __sbNativeCueError = String(e && e.message || e || "subscribe failed"), __sbScheduleNativeCueRetry(450)
                    }
                }

                function __sbFetchTextWithTimeout`,
);

replaceOnce(
    'queue embedded selection before mediaId exists',
    '                        case "selectedSubtitlesTrackId":\n                            if (A.mediaId && null !== D && 0 === (t || "").indexOf("EMBEDDED_")) {',
    '                        case "selectedSubtitlesTrackId":\n                            0 === (t || "").indexOf("EMBEDDED_") && (__sbPendingEmbeddedTrackId = t, p = t, __sbAppliedEmbeddedTrackKey = "");\n                            if (A.mediaId && null !== D && 0 === (t || "").indexOf("EMBEDDED_")) {',
);

replaceOnce(
    'clear pending selection when subtitles disabled',
    '} - 1 === (t || "").indexOf("EMBEDDED_") && (p = null, G("selectedSubtitlesTrackId"), E(!1));',
    '} - 1 === (t || "").indexOf("EMBEDDED_") && (__sbPendingEmbeddedTrackId = null, __sbAppliedEmbeddedTrackKey = "", p = null, G("selectedSubtitlesTrackId"), E(!1));',
);

replaceSection(
    'safe last-resort extraction',
    '                function __sbEnsureFallback() {',
    '                function __sbSetSelected(e) {',
    `                function __sbEnsureFallback() {
                    if (D && D.url && y && y.length) {
                        var e = __sbTrackIndex();
                        if (e < 0 || __sbFallbackLoading) return;
                        var t = D.url + "|" + e, r = isFinite(A.currentTime) ? Math.max(0, A.currentTime) : 0;
                        t !== __sbFallbackKey && (__sbResetFallback(!1), __sbFallbackKey = t);
                        if (__sbFallbackReady && r >= __sbFallbackStart && r <= __sbFallbackEnd) return;
                        __sbEnsureNativeCueTap(!0);
                        var n = Math.max(0, Math.floor(r - 15)), i = 120, a = t + "|ffmpeg|" + n;
                        __sbFallbackLoading = !0, __sbFallbackMethod = "ffmpeg", __sbFallbackRequestKey = a, __sbFallbackError = "";
                        var s = "/subtitle-bridge/embedded.vtt?from=" + encodeURIComponent(D.url) + "&track=" + e + "&start=" + n + "&duration=" + i;
                        __sbFetchTextWithTimeout(s, 4e3).then((function(e) {
                            if (__sbFallbackRequestKey !== a || __sbFallbackKey !== t) return;
                            var r = __sbParseVtt(e, n);
                            if (!r.length) throw new Error("FFmpeg returned no text cues");
                            __sbFallbackCues = r, __sbFallbackStart = n, __sbFallbackEnd = n + i - 15, __sbFallbackLoading = !1, __sbFallbackReady = !0, __sbFallbackError = "", __sbFallbackMethod = "ffmpeg", __sbCueSource = "ffmpeg", __sbMaybeStartPendingSelection(), U()
                        })).catch((function(e) {
                            __sbFallbackRequestKey === a && (__sbFallbackLoading = !1, __sbFallbackReady = !1, __sbFallbackError = String(e && e.message || e || "failed"), __sbFallbackMethod = "failed", __sbPendingSelectionUntil = 0, U())
                        }))
                    }
                }

`,
);

const updateStart = source.indexOf('function __sbKeydown');
if (updateStart < 0) throw new Error('v1.0.7 hardening: keydown marker missing');
const uStart = source.indexOf('                function U() {', updateStart);
if (uStart < 0) throw new Error('v1.0.7 hardening: U() after keydown missing');
const ensureCall = '                    __sbEnsureNativeCueTap();';
const ensurePos = source.indexOf(ensureCall, uStart);
if (ensurePos < 0) throw new Error('v1.0.7 hardening: U native cue call missing');
source = source.slice(0, ensurePos) +
    '                    __sbApplyPendingEmbeddedTrack(), __sbEnsureNativeCueTap(!1);' +
    source.slice(ensurePos + ensureCall.length);

replaceOnce(
    'unload first-load state cleanup',
    '__sbExitSelection(!1), __sbRender(""), __sbResetFallback(!1), __sbStopNativeCueTap(), __sbNativeCueText = "", __sbNativeCueSeen = !1, __sbNativeCueUpdatedAt = 0, D = null, C = null,',
    '__sbExitSelection(!1), __sbRender(""), __sbResetFallback(!1), __sbStopNativeCueTap(), __sbNativeCueText = "", __sbNativeCueSeen = !1, __sbNativeCueSourceInfoSeen = !1, __sbNativeCueAttempt = 0, __sbNativeCueUpdatedAt = 0, __sbPendingEmbeddedTrackId = null, __sbAppliedEmbeddedTrackKey = "", null !== __sbPendingEmbeddedApplyTimer && (clearTimeout(__sbPendingEmbeddedApplyTimer), __sbPendingEmbeddedApplyTimer = null), D = null, C = null,',
);

fs.writeFileSync(target, source);
console.log('    Applied embedded subtitle v1.0.7 first-load + subscription hardening');
