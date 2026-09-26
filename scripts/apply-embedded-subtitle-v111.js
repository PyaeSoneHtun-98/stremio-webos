'use strict';
const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-embedded-subtitle-v111.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv111')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.11 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}
function replaceSection(name, startText, endText, replacement) {
    const a = source.indexOf(startText), b = source.indexOf(endText, a + startText.length);
    if (a < 0 || b < 0) throw new Error('v1.0.11 section missing: ' + name);
    source = source.slice(0, a) + replacement + source.slice(b);
}

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgePOCv108 = !0;',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0;',
);

replaceOnce(
    'extractor state',
    '                    __sbFallbackMethod = "idle",\n                    __sbCueSource = "none";',
    '                    __sbFallbackMethod = "idle",\n                    __sbFallbackRetryAt = 0,\n                    __sbFallbackTrackNumber = null,\n                    __sbFallbackCodec = "",\n                    __sbCueSource = "none";',
);

replaceSection(
    'fallback reset',
    '                function __sbResetFallback(e) {',
    '                function __sbEnsureFallback() {',
    `                function __sbResetFallback(e) {
                    __sbFallbackCues = [], __sbFallbackKey = "", __sbFallbackRequestKey = "", __sbFallbackStart = 0, __sbFallbackEnd = 0, __sbFallbackLoading = !1, __sbFallbackReady = !1, __sbFallbackError = "", __sbFallbackMethod = "idle", __sbFallbackRetryAt = 0, __sbFallbackTrackNumber = null, __sbFallbackCodec = "", __sbCueSource = __sbNativeCueText ? "lg" : "none", e && __sbSetNativeSubtitleEnabled(!0)
                }

`,
);

replaceSection(
    'MKV extractor fallback',
    '                function __sbEnsureFallback() {',
    '                function __sbSetSelected(e) {',
    `                function __sbEnsureFallback() {
                    if (!D || !D.url || !y || !y.length || !p || m || __sbSelecting) return;
                    var e = __sbTrackIndex();
                    if (e < 0) return;
                    var t = isFinite(A.currentTime) ? Math.max(0, A.currentTime) : 0;
                    if (t < .25) return;
                    var r = D.url + "|" + e;
                    r !== __sbFallbackKey && (__sbResetFallback(!1), __sbFallbackKey = r);
                    if (__sbFallbackReady && t >= __sbFallbackStart + 1 && t <= __sbFallbackEnd - 3 || __sbFallbackLoading || Date.now() < __sbFallbackRetryAt) return;
                    __sbFallbackLoading = !0, __sbFallbackReady = !1, __sbFallbackMethod = "mkv", __sbFallbackError = "";
                    var n = r + "|mkv|" + Math.floor(t / 20), i = "/subtitle-bridge/mkv-cues?from=" + encodeURIComponent(D.url) + "&track=" + e + "&time=" + encodeURIComponent(t.toFixed(3));
                    __sbFallbackRequestKey = n;
                    __sbFetchTextWithTimeout(i, 12e3).then((function(e) {
                        if (__sbFallbackRequestKey !== n || __sbFallbackKey !== r) return;
                        var i;
                        try { i = JSON.parse(e) } catch (e) { throw new Error("Invalid MKV extractor response") }
                        var a = Array.isArray(i.cues) ? i.cues.map((function(e) { return { startTime: Number(e.startTime), endTime: Number(e.endTime), text: String(e.text || "") } })).filter((function(e) { return isFinite(e.startTime) && isFinite(e.endTime) && e.endTime >= e.startTime && e.text })) : [];
                        if (!a.length) throw new Error("MKV extractor returned no cues");
                        __sbFallbackCues = a, __sbFallbackStart = i.window && isFinite(Number(i.window[0])) ? Number(i.window[0]) : a[0].startTime, __sbFallbackEnd = i.window && isFinite(Number(i.window[1])) ? Number(i.window[1]) : a[a.length - 1].endTime, __sbFallbackLoading = !1, __sbFallbackReady = !0, __sbFallbackError = "", __sbFallbackMethod = "mkv", __sbFallbackTrackNumber = null == i.trackNumber ? null : Number(i.trackNumber), __sbFallbackCodec = String(i.codec || ""), __sbCueSource = "mkv", U()
                    })).catch((function(e) {
                        __sbFallbackRequestKey === n && (__sbFallbackLoading = !1, __sbFallbackReady = !1, __sbFallbackError = String(e && e.message || e || "MKV extraction failed"), __sbFallbackMethod = "mkv", __sbFallbackRetryAt = Date.now() + 15e3, U())
                    }))
                }

`,
);

replaceOnce(
    'background extraction',
    '                    __sbApplyPendingEmbeddedTrack(), __sbEnsureNativeCueTap(!1);',
    '                    __sbApplyPendingEmbeddedTrack(), __sbEnsureNativeCueTap(!1), __sbEnsureFallback();',
);

replaceOnce(
    'debug extractor metadata',
    '__sbFallbackError && (__sbDebug.textContent += " | " + __sbFallbackError.slice(0, 55))',
    '__sbFallbackTrackNumber !== null && (__sbDebug.textContent += " | mkv:#" + __sbFallbackTrackNumber + "/" + (__sbFallbackCodec || "text")), __sbFallbackError && (__sbDebug.textContent += " | " + __sbFallbackError.slice(0, 55))',
);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.11 MKV/ASS cue extraction integration');
