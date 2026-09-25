'use strict';

const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync(process.argv[2], 'utf8');

assert(source.includes('__subtitleBridgePOCv114'), 'v1.0.14 interaction marker missing');
assert(source.includes('data-subtitle-bridge-word'), 'word pointer marker missing');
assert(source.includes('__sbStartSelection(n) && __sbLookupSelected()'), 'Magic Remote click must select and open lookup');
assert(source.includes('__sbTranslationPhraseRange'), 'phrase highlight state missing');
assert(source.includes('r.phraseMatch.startTokenIndex'), 'phrase start index must drive highlight');
assert(source.includes('r.phraseMatch.endTokenIndex'), 'phrase end index must drive highlight');
assert(source.includes('rgba(190,239,220,.94)'), 'desktop-style selected-word accent missing');
assert(source.includes('rgba(181,230,209,.24)'), 'phrase-range accent missing');
assert(source.includes('__sbTranslationOutsidePointer'), 'outside-pointer close handler missing');
assert(source.includes('t.addEventListener("pointerdown", __sbTranslationOutsidePointer, !0)'), 'outside-pointer listener missing');
assert(source.includes('t.removeEventListener("pointerdown", __sbTranslationOutsidePointer, !0)'), 'outside-pointer cleanup missing');

const dismissStart = source.indexOf('function __sbDismissTranslation()');
const dismissEnd = source.indexOf('function __sbTranslationClearBody()', dismissStart);
assert(dismissStart >= 0 && dismissEnd > dismissStart);
const dismiss = source.slice(dismissStart, dismissEnd);
assert(dismiss.includes('__sbTranslationPhraseRange = null'), 'closing popup must clear phrase-range state');
assert(dismiss.includes('__sbApplyWordHighlights()'), 'closing popup must restore selected-word-only styling');

console.log('PASS: Magic Remote click lookup, desktop selected-word styling, phrase highlighting, outside-click close');
