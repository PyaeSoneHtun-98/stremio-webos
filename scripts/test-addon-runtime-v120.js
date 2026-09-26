'use strict';
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync(process.argv[2], 'utf8');

assert(source.includes('__subtitleBridgePOCv120'), 'v1.0.20 marker missing');
assert(source.includes('__subtitleBridgePOCv121'), 'v1.0.21 marker missing');
assert(source.includes('h.style.pointerEvents = "none", h.style.zIndex = "1"'), 'normal addon subtitle must use original low player-local stacking');
assert(source.includes('data-subtitle-bridge-external-interaction'), 'separate addon interaction layer missing');
assert(source.includes('__sbExtInteractiveOverlay.style.opacity = __sbExtSelecting ? String(L) : "0.001"'), 'Magic Remote hit layer must stay visually invisible outside selection');
assert(source.includes('__sbExtInteractiveSignature === __sbExtRenderSignature'), 'unchanged addon cue hit targets must be reused');
assert(source.includes('__sbExtBuildInteractive(), __sbExtSyncInteractive(), __sbExtDebug()'), 'new addon cues must prebuild hit targets immediately');
assert(source.includes('document.querySelector(".menu-KhHHT")'), 'settings/menu guard missing');
assert(source.includes('window.__subtitleBridgeExternalActive = null != t'), 'addon ownership flag missing');
assert(source.includes('if ("undefined" != typeof window && window.__subtitleBridgeExternalActive && !__sbSelecting && !__sbTranslationOpen) return;'), 'embedded key handler must not start MKV fallback for addon subtitles');
assert(source.includes('h.style.visibility = __sbExtSelecting ? "hidden" : "visible"'), 'normal addon subtitle should only be hidden during interactive selection');
assert(source.includes('__sbExtInteractiveOverlay.style.opacity = __sbExtSelecting ? String(L) : "0.001"'), 'selection must reveal interactive addon subtitle while normal playback keeps the hit layer transparent');
assert(source.includes('__sbExtCurrentLines = n'), 'normal renderer must capture the current cue without wordifying it');

const renderStart = source.indexOf('function I() {', source.indexOf('data-subtitle-bridge-external-interaction'));
const renderEnd = source.indexOf('function w(e, t, r) {', renderStart);
assert(renderStart >= 0 && renderEnd > renderStart, 'addon renderer missing');
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

console.log('PASS: v1.0.21 addon cues stay ready/Magic-clickable, remain below settings, and never invoke embedded MKV fallback');
