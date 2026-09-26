'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const source = fs.readFileSync(process.argv[2], 'utf8');

assert(source.includes('__subtitleBridgePOCv118'), 'v1.0.18 marker missing');
assert(source.includes('function __sbExtTokenizeSubtitleText(e)'), 'addon Unicode tokenizer missing');
assert(source.includes('for (; e.firstChild;) e.removeChild(e.firstChild);'), 'addon renderer must clear original cue nodes before rebuilding clickable text');
assert(!source.slice(source.indexOf('function __sbExtWordify(e)'), source.indexOf('function __sbExtOutsidePointer', source.indexOf('function __sbExtWordify(e)'))).includes('.split(/\\s+/)'), 'addon wordifier must not select punctuation via whitespace splitting');
assert(source.includes('n.__sbLookupTerm = t.lookupTerm'), 'addon words must keep normalized lookup terms');
assert(source.includes('__sbExtStart(t) && __sbExtLookupSelected()'), 'Magic Remote addon click must open lookup');
assert(source.includes('else if (s) __sbExtLookupSelected(), i = !0;'), 'addon OK/Enter must open dictionary');
assert(source.includes('/subtitle-bridge/lookup?word='), 'addon dictionary endpoint missing');
assert(source.includes('__sbExtPhraseRange = r && t.phraseMatch'), 'addon phrase highlighting missing');
assert(source.includes('rgba(190,239,220,.94)'), 'desktop-style selected-word accent missing');
assert(source.includes('e.style.textShadow = "rgb(34, 34, 34) 1px 1px .1em"'), 'addon subtitle visual style must match embedded style');

assert(source.includes('function __sbExtSetMagicPointerPortal(e)'), 'addon on-demand pointer portal missing');
assert(source.includes('data-subtitle-bridge-external-interaction'), 'addon separate interaction layer missing');
assert(source.includes('__sbExtInteractiveOverlay.style.zIndex = "2147483000"'), 'addon invisible pointer layer must be above player controls');
assert(source.includes('(document.body || document.documentElement).appendChild(__sbExtInteractiveOverlay)'), 'addon interaction layer must attach at document level');
assert(source.includes('data-subtitle-bridge-translation", "external"'), 'addon popup marker missing');
assert(source.includes('e.style.position = "fixed", e.style.zIndex = "2147483646"'), 'dictionary popup must be document-level fixed UI');
assert(source.includes('(document.body || document.documentElement).appendChild(e), __sbExtPopup = e'), 'addon dictionary popup must attach outside player stacking context');
assert(source.includes('document.addEventListener("pointerdown", __sbExtOutsidePointer, !0)'), 'addon outside-pointer handler missing');
assert(source.includes('document.removeEventListener("pointerdown", __sbExtOutsidePointer, !0)'), 'addon outside-pointer cleanup missing');

assert(source.includes('function __sbSetMagicPointerPortal(e)'), 'embedded on-demand pointer portal missing');
assert(source.includes('__sbOverlay.style.position = "fixed"'), 'embedded Magic Remote hit layer must be able to become fixed');
assert(source.includes('__sbOverlay.style.zIndex = "2147483000"'), 'embedded Magic Remote hit layer must be able to rise above Stremio controls');
assert(source.includes('r.appendChild(__sbOverlay)'), 'embedded hit layer must be able to leave the player stacking context');
assert(source.includes('data-subtitle-bridge-translation", "1"), e.className = "translation-popup", e.style.position = "fixed"'), 'embedded popup must be fixed above controls');
assert(source.includes('document.addEventListener("pointerdown", __sbTranslationOutsidePointer, !0)'), 'embedded pointer close listener must be document-level');
assert(source.includes('document.removeEventListener("pointerdown", __sbTranslationOutsidePointer, !0)'), 'embedded pointer cleanup must be document-level');

const tokenizerStart = source.indexOf('function __sbExtTokenizeSubtitleText(e)');
const tokenizerEnd = source.indexOf('function __sbExtApplyHighlights()', tokenizerStart);
assert(tokenizerStart >= 0 && tokenizerEnd > tokenizerStart);
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(tokenizerStart, tokenizerEnd) + '\nthis.tokenize = __sbExtTokenizeSubtitleText;', context);
function inspect(text) {
  const segments = context.tokenize(text);
  return {
    rebuilt: segments.map(x => x.text).join(''),
    words: Array.from(segments.filter(x => x.kind === 'word'), x => x.text),
    lookup: Array.from(segments.filter(x => x.kind === 'word'), x => x.lookupTerm)
  };
}
let result = inspect('Like you, sat in this very hall.');
assert.strictEqual(result.rebuilt, 'Like you, sat in this very hall.');
assert.deepStrictEqual(result.words, ['Like', 'you', 'sat', 'in', 'this', 'very', 'hall']);
assert.deepStrictEqual(result.lookup, ['like', 'you', 'sat', 'in', 'this', 'very', 'hall']);
result = inspect("We're ready! 123 H264");
assert.deepStrictEqual(result.words, ["We're", 'ready', 'H264']);
result = inspect('...!?');
assert.deepStrictEqual(result.words, []);

const keyStart = source.indexOf('function __sbExtKeydown(e)');
const keyEnd = source.indexOf('window.addEventListener("keydown", __sbExtKeydown', keyStart);
const keySource = source.slice(keyStart, keyEnd);
assert(keySource.includes('__sbExtSetSelected(__sbExtSelected - 1)'), 'addon Left navigation missing');
assert(keySource.includes('__sbExtSetSelected(__sbExtSelected + 1)'), 'addon Right navigation missing');
assert(keySource.includes('__sbExtSetSelected(0)'), 'addon Up should match embedded selection behavior');
assert(keySource.includes('__sbExtExit(!0)'), 'addon Down/Back exit missing');

console.log('PASS: addon tokenizer/dictionary parity with separate selection/Magic interaction layer compatibility');
