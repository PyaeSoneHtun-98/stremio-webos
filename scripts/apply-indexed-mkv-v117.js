'use strict';
const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-indexed-mkv-v117.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv117')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.17 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}
function replaceSection(name, start, end, after) {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error('v1.0.17 section missing: ' + name);
    source = source.slice(0, a) + after + source.slice(b);
}

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgePOCv116 = !0;',
    'window.__subtitleBridgePOCv116 = !0, window.__subtitleBridgePOCv117 = !0;',
);
replaceOnce('refresh short indexed window', '__sbFallbackEnd - 12', '__sbFallbackEnd - 3');
replaceOnce(
    'cancel outstanding extraction on track/stream reset',
    '                function __sbResetFallback(e) {\n                    __sbFallbackCues',
    '                var __sbMkvRequest = null, __sbMkvRequestTime = 0, __sbMkvSerial = 0;\n                function __sbResetFallback(e) {\n                    __sbMkvRequest && __sbMkvRequest.cancel(), __sbMkvRequest = null, __sbFallbackCues',
);

replaceSection('indexed MKV request lifecycle', '                function __sbEnsureFallback() {', '                function __sbApplyWordHighlights() {', `                function __sbRequestMkvCues(url) {
                    var xhr = new XMLHttpRequest, settled = !1;
                    var promise = new Promise(function(resolve, reject) {
                        function fail(error) { if (!settled) settled = !0, reject(error) }
                        try {
                            xhr.open("GET", url, !0), xhr.timeout = 4e4;
                            xhr.onreadystatechange = function() {
                                if (4 !== xhr.readyState || settled) return;
                                settled = !0;
                                xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText || "") : reject(new Error((xhr.responseText || xhr.status + " " + xhr.statusText || "request failed").slice(0, 180)))
                            };
                            xhr.ontimeout = function() { fail(new Error("MKV request timeout")) };
                            xhr.onerror = function() { fail(new Error("MKV network error")) };
                            xhr.onabort = function() { fail(new Error("MKV request cancelled")) };
                            xhr.send()
                        } catch (error) { fail(error) }
                    });
                    return { promise: promise, cancel: function() { try { xhr.abort() } catch (_) {} } }
                }

                function __sbEnsureFallback() {
                    if (!D || !D.url || !y || !y.length || !p || m || __sbSelecting) return;
                    var track = __sbTrackIndex();
                    if (track < 0) return;
                    var time = isFinite(A.currentTime) ? Math.max(0, A.currentTime) : 0;
                    if (time < .25) return;
                    var key = D.url + "|" + track;
                    key !== __sbFallbackKey && (__sbResetFallback(!1), __sbFallbackKey = key);
                    if (__sbFallbackLoading && (time < __sbMkvRequestTime - 3 || time > __sbMkvRequestTime + 17)) {
                        __sbFallbackRequestKey = "", __sbMkvRequest && __sbMkvRequest.cancel(), __sbMkvRequest = null, __sbFallbackLoading = !1
                    }
                    if (__sbFallbackReady && time >= __sbFallbackStart + 1 && time <= __sbFallbackEnd - 3 || __sbFallbackLoading || Date.now() < __sbFallbackRetryAt) return;
                    var wasReady = __sbFallbackReady;
                    __sbFallbackLoading = !0, __sbFallbackMethod = "mkv", __sbFallbackError = "", __sbMkvRequestTime = time;
                    var token = key + "|" + ++__sbMkvSerial;
                    var query = "?from=" + encodeURIComponent(D.url) + "&track=" + track + "&time=" + encodeURIComponent(time.toFixed(3));
                    function current() { return __sbFallbackRequestKey === token && __sbFallbackKey === key }
                    function accept(body, partial) {
                        var result;
                        try { result = JSON.parse(body) } catch (_) { throw new Error("Invalid MKV extractor response") }
                        var cues = Array.isArray(result.cues) ? result.cues.map(function(cue) {
                            return { startTime: Number(cue.startTime), endTime: Number(cue.endTime), text: String(cue.text || "") }
                        }).filter(function(cue) { return isFinite(cue.startTime) && isFinite(cue.endTime) && cue.endTime >= cue.startTime && cue.text }) : [];
                        if (!cues.length && !Array.isArray(result.window)) throw new Error("MKV extractor returned no cues or window");
                        __sbFallbackCues = cues, __sbFallbackStart = result.window && isFinite(Number(result.window[0])) ? Number(result.window[0]) : cues[0].startTime, __sbFallbackEnd = result.window && isFinite(Number(result.window[1])) ? Number(result.window[1]) : cues[cues.length - 1].endTime, __sbFallbackLoading = !!partial, __sbFallbackReady = !0, __sbFallbackError = "", __sbFallbackMethod = result.method || "mkv", __sbFallbackTrackNumber = null == result.trackNumber ? null : Number(result.trackNumber), __sbFallbackCodec = String(result.codec || ""), __sbCueSource = "mkv", partial || (__sbMkvRequest = null), __sbMaybeStartPendingSelection(), U();
                        return result
                    }
                    function loadWindow() {
                        if (!current()) return;
                        __sbMkvRequest = __sbRequestMkvCues("/subtitle-bridge/mkv-cues" + query);
                        return __sbMkvRequest.promise.then(function(body) { current() && accept(body, !1) })
                    }
                    __sbFallbackRequestKey = token, __sbMkvRequest = __sbRequestMkvCues("/subtitle-bridge/mkv-active-cue" + query);
                    __sbMkvRequest.promise.then(function(body) {
                        if (!current()) return;
                        var result;
                        try { result = accept(body, !0) } catch (_) { return loadWindow() }
                        if (result.method === "cluster" || result.method === "indexed") return __sbFallbackLoading = !1, __sbMkvRequest = null, void 0;
                        return loadWindow()
                    }, function() {
                        return loadWindow()
                    }).catch(function(error) {
                        current() && (__sbFallbackLoading = !1, __sbFallbackReady = __sbFallbackReady || wasReady, __sbFallbackError = String(error && error.message || error || "MKV extraction failed"), __sbFallbackMethod = "mkv", __sbFallbackRetryAt = Date.now() + 1200, __sbMkvRequest = null, U())
                    })
                }

`);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.17 indexed MKV cue request and seek cancellation');
