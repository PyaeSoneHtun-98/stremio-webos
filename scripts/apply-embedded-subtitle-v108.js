'use strict';
const fs = require('fs');
const createLifecycle = require('./webos-subtitle-lifecycle');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-embedded-subtitle-v108.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv108')) process.exit(0);
function replace(before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('Non-unique/missing v108 anchor: ' + before);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}
function section(start, end, after, from = 0) {
    const a = source.indexOf(start, from), b = source.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error('Missing v108 section: ' + start);
    source = source.slice(0, a) + after + source.slice(b);
}

section('                    E = function(e) {', '                    S = document.createElement("style");',
    '                    E = function(e) { m = !e; __sbLifecycle.enable(!!e) },\n');

section('                function __sbClearNativeCueWatchdog() {', '                function __sbFetchTextWithTimeout', `
                var __sbLoadTimer = null;
                var __sbLifecycle = (${createLifecycle.toString()})({
                    mediaId: function() { return A.mediaId },
                    now: function() { return Date.now() },
                    // Window timer methods require Window as their receiver.
                    // Passing them directly makes options.setInterval() throw
                    // Illegal invocation in Chromium (Node mocks do not).
                    setInterval: function(callback, delay) { return window.setInterval(callback, delay) },
                    clearInterval: function(timer) { window.clearInterval(timer) },
                    request: function(options) { return window.webOS.service.request("luna://com.webos.media", options) },
                    onError: function(method, error) { __sbNativeCueError = method + ": " + String(error && (error.errorText || error.message || error.errorCode) || "failed") },
                    onSourceInfo: function() { __sbNativeCueSourceInfoSeen = !0 },
                    onReset: function() { __sbNativeCueText = "", __sbNativeCueSeen = !1, __sbNativeCueUpdatedAt = 0 },
                    onCue: function(text) {
                        __sbNativeCueText = __sbCleanNativeCue(text), __sbNativeCueSeen = !0, __sbNativeCueUpdatedAt = Date.now(), __sbCueSource = text ? "lg" : "none", __sbNativeCueError = "";
                    },
                    onSelected: function(id) {
                        __sbAppliedEmbeddedTrackKey = A.mediaId + "|" + id;
                        b.bg_opacity = "none" === b.bg_color ? 0 : 255;
                        ["setSubtitleCharacterColor", "setSubtitleBackgroundColor", "setSubtitlePosition", "setSubtitleFontSize", "setSubtitleBackgroundOpacity", "setSubtitleCharacterOpacity"].forEach(function(method) {
                            l({ method: method, parameters: { mediaId: A.mediaId, charColor: b.color, bgColor: b.bg_color === "none" ? "black" : b.bg_color, position: b.position, fontSize: b.font_size, bgOpacity: b.bg_opacity, charOpacity: b.char_opacity } });
                        });
                        y = y.map(function(track) { track.mode = track.id === id ? "showing" : "disabled"; return track });
                        var selected = y.find(function(track) { return track.id === id });
                        selected && I.emit("subtitlesTrackLoaded", selected), G("selectedSubtitlesTrackId");
                    }
                });
                window.__subtitleBridgePOCv108 = !0;
                function __sbStopNativeCueTap() { __sbLifecycle.stop() }
                function __sbEnsureNativeCueTap() { __sbLifecycle.tick() }
                function __sbApplyPendingEmbeddedTrack() { __sbLifecycle.tick() }
                function __sbMaybeStartPendingSelection() {}

`);

section('                        case "selectedSubtitlesTrackId":', '                        case "subtitlesOffset":', `                        case "selectedSubtitlesTrackId":
                            __sbExitSelection(!1), __sbRender(""), __sbResetFallback(!1);
                            __sbPendingEmbeddedTrackId = /^EMBEDDED_\\d+$/.test(t || "") ? t : null;
                            p = __sbPendingEmbeddedTrackId, m = !p, __sbAppliedEmbeddedTrackKey = "";
                            __sbLifecycle.select(p), G("selectedSubtitlesTrackId");
                            break;
`, source.indexOf('                function V(e, t) {'));

section('                function __sbSetNativeSubtitleEnabled(e) {', '                function __sbResetFallback(e) {',
    '                function __sbSetNativeSubtitleEnabled(e) { __sbLifecycle.enable(!!e) }\n\n');
replace('A.src = D.url, i = function() {', 'A.src = D.url, __sbLifecycle.start(), i = function() {');
// Preserve Vidaa's load path: calling H("unload") here removes src and calls
// A.load() on an empty source before the new URL, disrupting the LG pipeline.
// Teardown remains exclusively in the explicit unload/destroy command paths.
replace('if (A.mediaId) return clearInterval(a), F(), g(), void i();', 'if (A.mediaId && A.mediaId !== "<invalid mediaId>") return __sbEnsureNativeCueTap(), clearInterval(a), F(), g(), void i();');
replace('}, a = setInterval((function() {\n                                    if (A.mediaId', '}, a = __sbLoadTimer = setInterval((function() {\n                                    if (A.mediaId');
replace('__sbExitSelection(!1), __sbRender(""), __sbResetFallback(!1), __sbStopNativeCueTap(),',
    'clearInterval(__sbLoadTimer), __sbLoadTimer = null, __sbUpPrimedUntil = 0, __sbPendingSelectionUntil = 0, __sbExitSelection(!1), __sbRender(""), __sbResetFallback(!1), __sbStopNativeCueTap(), p = null, m = !0, P = !1, y = [], T = [],');

// Failed extraction must not eat navigation or pause later on an unrelated cue.
replace('return __sbPendingSelectionUntil = i + 9e3, __sbEnsureFallback(), e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0', 'return void 0');
replace('if (i > __sbUpPrimedUntil) return', 'if (e.repeat) return;\n                        if (i > __sbUpPrimedUntil) return');
replace('else if ("ArrowDown" === t || 40 === r) return __sbExitSelection(!0), void 0;', 'else if ("ArrowDown" === t || 40 === r) __sbExitSelection(!0);');

// Both capture listeners must pass through the first Up, including external cues.
replace('                        __sbExtNextLine = 0;', '                        __sbExtNextLine = 0, __sbExtUpPrimedUntil = 0;');
replace('if (!__sbExtSelecting && ("ArrowUp" === t || 38 === n)) i = __sbExtStart(0);', `if (!__sbExtSelecting && ("ArrowUp" === t || 38 === n)) {
                            if (e.repeat) return;
                            var now = Date.now();
                            if (now > __sbExtUpPrimedUntil) return __sbExtUpPrimedUntil = now + 3500, void 0;
                            __sbExtUpPrimedUntil = 0, i = __sbExtStart(0);
                        }`);
replace('i && (e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation())',
    '!("ArrowUp" === t || 38 === n) && (__sbExtUpPrimedUntil = 0);\n                        i && (e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation())');
replace('return __sbExtExit(!1), g = null,', 'return __sbExtUpPrimedUntil = 0, __sbExtExit(!1), g = null,');
// Clear expired HTML cues instead of treating a disappeared cue as current for ten seconds.
replace('i && (__sbNativeCueText = i,', '(i || __sbCueSource === "html") && (__sbNativeCueText = i,');
replace('var e = Date.now();\n                    if (__sbNativeCueText', 'if (!p || m) return "";\n                    var e = Date.now();\n                    if (__sbNativeCueText');

fs.writeFileSync(target, source);
console.log('    Applied v1.0.8 native subtitle lifecycle and navigation fixes');
