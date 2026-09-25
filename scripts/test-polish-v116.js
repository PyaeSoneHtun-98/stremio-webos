'use strict';

const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync(process.argv[2], 'utf8');

assert(source.includes('__subtitleBridgePOCv116'), 'v1.0.16 polish marker missing');
assert(source.includes('data-subtitle-bridge-status'), 'small interactive-subtitle status pill missing');
assert(source.includes('__sbDebug.style.display = "none"'), 'debug overlay must be hidden by default');
assert(source.includes('window.__subtitleBridgeToggleDebug = __sbToggleDebug'), 'hidden debug toggle API missing');
assert(source.includes('403 === r || "ColorF0Red" === t'), 'red remote key debug toggle missing');
assert(source.includes('Preparing interactive subtitles…'), 'selection loading status missing');
assert(source.includes('__sbPendingSelectionUntil = s + 5e3'), 'bounded pending selection window missing');
assert(source.includes('__sbFallbackEnd - 3'), 'short indexed cue window must refresh before expiry');
assert(source.includes('__sbMaybeStartPendingSelection(), U()'), 'ready MKV refresh must complete a pending selection request');
assert(source.includes('__sbArmPointerLayer'), 'Magic Remote pointer hit layer missing');
assert(source.includes('__sbOverlay.style.opacity = "0.001"'), 'normal playback pointer layer should be visually invisible');
assert(source.includes('a && __sbFallbackReady ? __sbArmPointerLayer(a)'), 'ready embedded cues must arm direct Magic Remote hit targets');
assert(source.includes('rgba(181,230,209,.22)'), 'Magic Remote hover accent missing');
assert(source.includes('__sbStartSelection(i) && __sbLookupSelected()'), 'Magic Remote click lookup must remain enabled');
assert(!source.includes('console.log("[SubtitleBridge POC] embedded cue:"'), 'POC cue console label should be removed from normal builds');
assert(source.includes('"Subtitle Bridge | key:" + __sbLastKey'), 'debug label should use Subtitle Bridge branding');

console.log('PASS: prefetch UX, hidden debug, bounded loading state, direct Magic Remote hit layer, hover/click, and production branding');
