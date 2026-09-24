'use strict';
const fs = require('fs');
const assert = require('assert');
const vm = require('vm');
const source = fs.readFileSync(process.argv[2], 'utf8');
new vm.Script(source);
for (const marker of ['data-subtitle-bridge-poc', '__subtitleBridgePOCv108', 'data-subtitle-bridge-external-word']) {
    assert(source.includes(marker), 'Missing integration marker: ' + marker);
}
assert(source.includes('p = "EMBEDDED_" + r'), 'Default track ID must use EMBEDDED_n');
assert(source.includes('mode: "EMBEDDED_" + r === p ? "showing" : "disabled"'));
assert(source.includes('A.src = D.url, __sbLifecycle.start()'), 'Lifecycle must start at load, before metadata');
assert(source.includes('__sbLifecycle.select(p), G("selectedSubtitlesTrackId")'));
assert(source.includes('function __sbStopNativeCueTap() { __sbLifecycle.stop() }'));
assert(source.includes('clearInterval(__sbLoadTimer), __sbLoadTimer = null'));
assert(!source.includes('V("selectedSubtitlesTrackId", t), __sbSetNativeSubtitleEnabled'), 'Recursive selection loop returned');
assert(!source.includes('"/subtitles.vtt?from=" + encodeURIComponent(D.url)'), 'Movie sent to external subtitle converter');
assert(!source.includes('__sbPendingSelectionUntil = i + 9e3'), 'Failed extraction must not pause later playback');
assert(source.includes('__sbSetNativeSubtitleEnabled(!1)'), 'Selection must hide duplicate native subtitles');
assert(source.includes('__sbSetNativeSubtitleEnabled(!0)'), 'Exit must restore native subtitles');
console.log('PASS: generated bundle syntax, lifecycle wiring, native subtitle safety, external integration');
