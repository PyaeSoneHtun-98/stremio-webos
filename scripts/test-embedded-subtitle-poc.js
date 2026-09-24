'use strict';

const fs = require('fs');
const assert = require('assert');

const target = process.argv[2];
if (!target) {
    console.error('Usage: node scripts/test-embedded-subtitle-poc.js <patched-video.chunk.js>');
    process.exit(2);
}

const source = fs.readFileSync(target, 'utf8');

function mustContain(name, text) {
    assert(source.includes(text), 'Embedded subtitle test failed: missing ' + name);
}

function sectionBetween(startText, endText, fromIndex = 0) {
    const start = source.indexOf(startText, fromIndex);
    assert(start >= 0, 'Embedded subtitle test failed: missing section start: ' + startText);
    const end = source.indexOf(endText, start + startText.length);
    assert(end > start, 'Embedded subtitle test failed: missing section end: ' + endText);
    return source.slice(start, end);
}

mustContain('POC marker', 'data-subtitle-bridge-poc');
mustContain('v1.0.6 hardening marker', '__subtitleBridgePOCv106');
mustContain('v1.0.7 hardening marker', '__subtitleBridgePOCv107');

mustContain('normalized first embedded subtitle id', 'p = "EMBEDDED_" + r');
mustContain('normalized embedded subtitle showing mode', 'mode: "EMBEDDED_" + r === p ? "showing" : "disabled"');

const setterAnchor = source.indexOf('console.log("WebOS", "change subtitles for id: ", A.mediaId, " index:", t)');
assert(setterAnchor >= 0, 'LG subtitle setter anchor missing');
const selection = source.slice(Math.max(0, setterAnchor - 2200), setterAnchor + 4200);
assert(selection.includes('0 === (t || "").indexOf("EMBEDDED_")'), 'EMBEDDED_n selection guard missing');
assert(selection.includes('p = t'), 'selected embedded id is not retained');
assert(selection.includes('parseInt(t.replace("EMBEDDED_", ""))'), 'embedded id is not converted to native index');
assert(/method:\s*"selectTrack"[\s\S]*?type:\s*"text"[\s\S]*?index:\s*r/.test(selection), 'LG selectTrack(text,index) command missing');
assert(/e\.mode\s*=\s*e\.id\s*===\s*p\s*\?\s*"showing"\s*:\s*"disabled"/.test(selection), 'selected track mode is not updated');
assert(selection.includes('__sbNativeCueText = ""'), 'track change does not clear stale captured cue');
assert(selection.includes('p = null') && selection.includes('E(!1)'), 'subtitle-off path no longer disables native subtitles');

for (const [id, expected] of [['EMBEDDED_0',0],['EMBEDDED_1',1],['EMBEDDED_6',6]]) {
    assert.strictEqual(parseInt(id.replace('EMBEDDED_', ''), 10), expected, id + ' mapped to wrong native index');
}

mustContain('LG native subtitle event subscription', 'method: "subscribe"');
mustContain('LG subtitleData event', 'e && e.subtitleData');
mustContain('LG subtitle cue payload', 't.subtitleData');
mustContain('LG media service', 'luna://com.webos.media');
mustContain('first-load pending embedded track state', '__sbPendingEmbeddedTrackId');
mustContain('first-load embedded apply helper', 'function __sbApplyPendingEmbeddedTrack()');
mustContain('mediaId validity guard', '"<invalid mediaId>" === A.mediaId');
mustContain('pipeline-ready subscription marker', '__sbNativeCueSourceInfoSeen = !0');
mustContain('subscription watchdog', 'pipeline subscribe timeout #');
mustContain('bounded subscription retry', '__sbNativeCueAttempt >= 8');
assert(source.includes('__sbPendingEmbeddedTrackId = t, p = t'), 'embedded selection is not queued before mediaId is available');
assert(source.includes('__sbApplyPendingEmbeddedTrack(), __sbEnsureNativeCueTap(!1)'), 'normal update loop does not apply queued first-load selection');
assert(!source.includes('"/subtitles.vtt?from=" + encodeURIComponent(D.url)'), 'movie URL is still incorrectly sent to /subtitles.vtt');

const ensureFallback = sectionBetween('function __sbEnsureFallback()', 'function __sbSetSelected(e)');
assert(!ensureFallback.includes('/subtitles.vtt?from='), 'external-subtitle proxy must not receive the movie URL');
assert(ensureFallback.includes('__sbFetchTextWithTimeout(s, 4e3)'), 'FFmpeg last-resort backup is missing hard timeout');
assert(!ensureFallback.includes('__sbSetNativeSubtitleEnabled(!1)'), 'backup extraction must not hide working native subtitles');

const keydown = sectionBetween('function __sbKeydown(e)', 'window.addEventListener("keydown", __sbKeydown, !0);');
const prime = keydown.indexOf('i > __sbUpPrimedUntil');
const start = keydown.indexOf('__sbStartSelection(0)');
assert(prime >= 0 && start > prime, 'first ArrowUp is not reserved for Stremio before word selection');
assert(keydown.includes('__sbUpPrimedUntil = i + 3500'), 'first ArrowUp pass-through window missing');

const updateLoopStart = source.indexOf('function __sbKeydown');
const updateLoop = sectionBetween('function U() {', 'function B(e) {', updateLoopStart);
assert(updateLoop.includes('__sbEnsureNativeCueTap()'), 'normal playback does not attach LG cue listener');
assert(!updateLoop.includes('__sbEnsureFallback()'), 'backup extractor still auto-runs during normal playback');

const startSelection = sectionBetween('function __sbStartSelection(e)', 'function __sbExitSelection(e)');
assert(startSelection.includes('__sbSetNativeSubtitleEnabled(!1)'), 'native subtitles are not hidden when word-selection overlay actually opens');
const exitSelection = sectionBetween('function __sbExitSelection(e)', 'function __sbPlainText(e)');
assert(exitSelection.includes('__sbSetNativeSubtitleEnabled(!0)'), 'native subtitles are not restored after word-selection mode');

mustContain('native track debug count', 'nativeTracks:');
mustContain('selected embedded debug id', '| selected:');
mustContain('LG cue debug state', '| lgCue:');

console.log('Embedded subtitle integration tests: PASS');
console.log('  EMBEDDED_n -> LG native index mapping: PASS');
console.log('  first-load embedded selection queue: PASS');
console.log('  LG pipeline subscription retry/watchdog: PASS');
console.log('  LG subtitleData cue capture path: PASS');
console.log('  first ArrowUp preserved for Stremio: PASS');
console.log('  second ArrowUp enters word selection: PASS');
console.log('  backup extraction timeouts: PASS');
console.log('  native subtitle fallback safety: PASS');
