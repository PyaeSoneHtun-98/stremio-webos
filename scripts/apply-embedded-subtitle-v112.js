'use strict';
const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-embedded-subtitle-v112.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv112')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.12 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0;',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0, window.__subtitleBridgePOCv112 = !0;',
);

replaceOnce(
    'refresh earlier',
    '__sbFallbackReady && t >= __sbFallbackStart + 1 && t <= __sbFallbackEnd - 3',
    '__sbFallbackReady && t >= __sbFallbackStart + 1 && t <= __sbFallbackEnd - 8',
);

replaceOnce(
    'preserve last good cue window while refreshing',
    '__sbFallbackLoading = !0, __sbFallbackReady = !1, __sbFallbackMethod = "mkv", __sbFallbackError = "";',
    'var o = __sbFallbackReady; __sbFallbackLoading = !0, __sbFallbackMethod = "mkv", __sbFallbackError = "";',
);

replaceOnce(
    'longer extractor timeout',
    '__sbFetchTextWithTimeout(i, 12e3)',
    '__sbFetchTextWithTimeout(i, 25e3)',
);

replaceOnce(
    'keep cached cues on refresh failure',
    '__sbFallbackRequestKey === n && (__sbFallbackLoading = !1, __sbFallbackReady = !1, __sbFallbackError = String(e && e.message || e || "MKV extraction failed"), __sbFallbackMethod = "mkv", __sbFallbackRetryAt = Date.now() + 15e3, U())',
    '__sbFallbackRequestKey === n && (__sbFallbackLoading = !1, __sbFallbackReady = o, __sbFallbackError = String(e && e.message || e || "MKV extraction failed"), __sbFallbackMethod = "mkv", __sbFallbackRetryAt = Date.now() + 1200, U())',
);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.12 MKV cue refresh reliability fixes');
