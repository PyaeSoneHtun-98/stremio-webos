'use strict';
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync(process.argv[2], 'utf8');

assert(source.includes('__subtitleBridgePOCv119'), 'v1.0.19 marker missing');
assert(source.includes('__sbOverlay.style.position = "absolute"'), 'embedded hit layer must be player-local while Magic Remote is idle');
assert(source.includes('__sbOverlay.style.zIndex = "110"'), 'embedded idle layer should use v1.0.17-style lightweight stacking');
assert(source.includes('function __sbSetMagicPointerPortal(e)'), 'embedded on-demand Magic Remote portal missing');
assert(source.includes('document.addEventListener("pointermove", __sbMagicPointerMove, !0)'), 'embedded pointer activation listener missing');
assert(source.includes('document.addEventListener("mousemove", __sbMagicPointerMove, !0)'), 'embedded mouse activation listener missing');
assert(source.includes('__sbOverlay.style.position = "fixed", __sbOverlay.style.zIndex = "2147483000"'), 'embedded pointer activation must elevate hit targets');

assert(source.includes('/^EMBEDDED_\\d+$/.test(String(e.selectedEmbeddedTrackId || ""))'), 'addon renderer must detect selected embedded tracks');
assert(source.includes('window.__subtitleBridgeEmbeddedActive || t'), 'addon renderer must stay out of embedded playback');
assert(source.includes('(null !== g || h.hasChildNodes()) && I()'), 'addon renderer must skip empty time-update work');
assert(source.includes('function __sbExtSetMagicPointerPortal(e)'), 'addon on-demand Magic Remote portal missing');
if (source.includes('__subtitleBridgePOCv122')) {
    assert(!source.includes('document.addEventListener("pointermove", __sbExtMagicPointerMove, !0)'), 'always-ready addon layer must not run layout work on pointer movement');
} else {
    assert(source.includes('document.addEventListener("pointermove", __sbExtMagicPointerMove, !0)'), 'addon pointer activation listener missing');
}
assert(source.includes('h.style.pointerEvents = "none", h.style.zIndex = "1", h.style.position = "absolute"'), 'addon visible layer must remain low and player-local');
assert(source.includes('data-subtitle-bridge-external-interaction'), 'addon Magic Remote must use a separate interaction layer');
assert(source.includes('data-subtitle-bridge-translation", "external"'), 'addon dictionary parity must remain intact');
assert(source.includes('__sbExtStart(t) && __sbExtLookupSelected()'), 'addon direct Magic Remote lookup must remain intact');
assert(source.includes('__sbStartSelection(i) && __sbLookupSelected()'), 'embedded direct Magic Remote lookup must remain intact');
assert(source.includes('/subtitle-bridge/mkv-active-cue'), 'v1.0.17 indexed active-cue path must remain intact');
assert(source.includes('__sbMkvRequest && __sbMkvRequest.cancel()'), 'v1.0.17 stale seek cancellation must remain intact');

console.log('PASS: indexed MKV path preserved while addon visible and Magic interaction layers stay isolated');
