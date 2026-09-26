'use strict';
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync(process.argv[2], 'utf8');

assert(source.includes('__subtitleBridgePOCv120'), 'v1.0.20 marker missing');
assert(source.includes('h.style.pointerEvents = "none", h.style.zIndex = "1"'), 'normal addon subtitle must use original low player-local stacking');
assert(source.includes('data-subtitle-bridge-external-interaction'), 'separate addon interaction layer missing');
assert(source.includes('__sbExtInteractiveOverlay.style.opacity = e ? String(L) : "0.001"'), 'Magic Remote hit layer must stay visually invisible outside selection');
assert(source.includes('e && (h.style.visibility = "hidden")'), 'normal addon subtitle should only be hidden when interactive selection is visible');
assert(source.includes('__sbExtInteractiveOverlay.style.opacity = String(L)'), 'selection must reveal interactive addon subtitle');
assert(source.includes('__sbExtCurrentLines = n'), 'normal renderer must capture the current cue without wordifying it');

const renderStart = source.indexOf('function I() {', source.indexOf('data-subtitle-bridge-external-interaction'));
const renderEnd = source.indexOf('function w(e, t, r) {', renderStart);
assert(renderStart >= 0 && renderEnd > renderStart, 'addon renderer missing);
const renderer = source.slice(renderStart, renderEnd);
assert(!renderer.includes('__sbExtWordify(e)'), 'normal addon playback must not tokenize/rebuild words on every time update');
assert(renderer.includes('a === __sbExtRenderSignature && h.hasChildNodes()'), 'unchanged addon cues must avoid repeated DOM rebuilds');
assert(renderer.includes('h.appendChild(e)'), 'normal addon subtitle renderer must remain visible in the player layer');

assert(source.includes('__sbExtStart(t) && __sbExtLookupSelected()'), 'Magic Remote lookup must remain');
assert(source.includes('else if (s) __sbExtLookupSelected(), i = !0;'), 'addon OK dictionary lookup must remain');
assert(source.includes('__sbExtPhraseRange = r && t.phraseMatch'), 'phrase highlighting must remain');
assert(source.includes('/subtitle-bridge/lookup?word='), 'dictionary endpoint must remain');
assert(source.includes('/subtitle-bridge/mkv-active-cue'), 'embedded v1.0.17 indexed active-cue path must remain intact');
assert(source.includes('__sbMkvRequest && __sbMkvRequest.cancel()'), 'embedded stale seek cancellation must remain intact');

console.log('PASS: v1.0.20 keeps addon subtitles below settings, avoids normal-playback word DOM work, and preserves selection/Magic/dictionary + indexed MKV');
