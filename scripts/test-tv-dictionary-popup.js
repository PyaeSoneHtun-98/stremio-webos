'use strict';

const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync(process.argv[2], 'utf8');

assert(source.includes('__subtitleBridgePOCv113'), 'v1.0.13 translation marker missing');
assert(source.includes('data-subtitle-bridge-translation'), 'desktop-style translation popup missing');
assert(source.includes('English → Burmese'), 'desktop popup language label missing');
assert(source.includes('Detected phrase · '), 'phrase detection UI missing');
assert(source.includes('Translation unavailable'), 'translation error state missing');
assert(source.includes('Back · Close'), 'TV popup close hint missing');
assert(source.includes('/subtitle-bridge/lookup?word='), 'offline dictionary lookup endpoint not wired');
assert(source.includes('"Enter" === t || 13 === r'), 'OK/Enter dictionary action missing');
assert(source.includes('__sbTranslationOpen'), 'translation popup state missing');
assert(source.includes('__sbDismissTranslation(), __sbSelecting = !1'), 'selection exit must dismiss translation popup');

const keyStart = source.indexOf('function __sbKeydown(e)');
const keyEnd = source.indexOf('window.addEventListener("keydown", __sbKeydown, !0);', keyStart);
assert(keyStart >= 0 && keyEnd > keyStart, 'keydown integration missing');
const keydown = source.slice(keyStart, keyEnd);
const translationBranch = keydown.indexOf('if (__sbTranslationOpen)');
const normalSelection = keydown.indexOf('if (!__sbSelecting && n)');
assert(translationBranch >= 0 && translationBranch < normalSelection, 'popup keys must be handled before normal player navigation');
assert(keydown.includes('if (a) __sbDismissTranslation()'), 'Back must close popup first');
assert(keydown.includes('__sbSetSelected(__sbSelected - 1), __sbLookupSelected()'), 'Left should move and refresh popup lookup');
assert(keydown.includes('__sbSetSelected(__sbSelected + 1), __sbLookupSelected()'), 'Right should move and refresh popup lookup');
assert(keydown.includes('else if (i) __sbLookupSelected()'), 'Enter on selected word must open dictionary');

console.log('PASS: centered desktop-style dictionary popup, Enter lookup, phrase UI, D-pad navigation, Back close');
