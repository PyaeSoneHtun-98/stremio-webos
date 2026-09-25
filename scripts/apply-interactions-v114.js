'use strict';

const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-interactions-v114.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv114')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.14 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}

function replaceSection(name, startText, endText, replacement) {
    const a = source.indexOf(startText);
    const b = source.indexOf(endText, a + startText.length);
    if (a < 0 || b < 0) throw new Error('v1.0.14 section missing: ' + name);
    source = source.slice(0, a) + replacement + source.slice(b);
}

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0, window.__subtitleBridgePOCv112 = !0, window.__subtitleBridgePOCv113 = !0;',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0, window.__subtitleBridgePOCv112 = !0, window.__subtitleBridgePOCv113 = !0, window.__subtitleBridgePOCv114 = !0;',
);

replaceOnce(
    'phrase range state',
    '                    __sbTranslationLookupWord = "",\n                    __sbCueSource = "none";',
    '                    __sbTranslationLookupWord = "",\n                    __sbTranslationPhraseRange = null,\n                    __sbCueSource = "none";',
);

replaceSection(
    'desktop-style word highlighting',
    '                function __sbSetSelected(e) {',
    '                function __sbStartSelection(e) {',
    `                function __sbApplyWordHighlights() {
                    __sbWords.forEach((function(e, t) {
                        var r = t === __sbSelected, n = __sbTranslationPhraseRange && t >= __sbTranslationPhraseRange[0] && t < __sbTranslationPhraseRange[1];
                        e.style.outline = r ? "2px solid rgba(255,255,255,.92)" : "none", e.style.backgroundColor = r ? "rgba(190,239,220,.94)" : n ? "rgba(181,230,209,.24)" : e.__sbBaseBackground, e.style.color = r ? "#112c21" : e.__sbBaseColor || "inherit", e.style.borderRadius = r || n ? "5px" : "0", e.style.boxShadow = r ? "0 5px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.5)" : n ? "0 0 0 2px rgba(181,230,209,.08)" : "none"
                    }))
                }

                function __sbSetSelected(e) {
                    __sbWords.length && (__sbSelected = Math.max(0, Math.min(__sbWords.length - 1, e)), __sbApplyWordHighlights())
                }

`,
);

replaceOnce(
    'word marker and base color',
    'r.textContent = e, r.style.display = "inline-block", r.style.margin = "0 .12em", r.style.padding = ".04em .08em", r.style.pointerEvents = "auto", r.style.cursor = "pointer", r.__sbBaseBackground = L && "rgba(0, 0, 0, 0)" !== L ? L : "transparent",',
    'r.textContent = e, r.setAttribute("data-subtitle-bridge-word", "1"), r.style.display = "inline-block", r.style.margin = "0 .12em", r.style.padding = ".04em .08em", r.style.pointerEvents = "auto", r.style.cursor = "pointer", r.__sbBaseBackground = L && "rgba(0, 0, 0, 0)" !== L ? L : "transparent", r.__sbBaseColor = r.style.color || "inherit",',
);

replaceOnce(
    'Magic Remote click opens lookup',
    'r.onclick = function(e) {\n                                e.preventDefault(), e.stopPropagation(), __sbStartSelection(n)\n                            }',
    'r.onclick = function(e) {\n                                e.preventDefault(), e.stopPropagation(), __sbStartSelection(n) && __sbLookupSelected()\n                            }',
);

replaceOnce(
    'clear phrase range while loading',
    '__sbTranslationEnsurePopup(), __sbTranslationClearBody(), __sbTranslationOpen = !0, __sbTranslationLookupWord = e, __sbTranslationHeading.textContent = e,',
    '__sbTranslationEnsurePopup(), __sbTranslationClearBody(), __sbTranslationOpen = !0, __sbTranslationLookupWord = e, __sbTranslationPhraseRange = null, __sbApplyWordHighlights(), __sbTranslationHeading.textContent = e,',
);

replaceOnce(
    'highlight phrase result',
    'var n = r && r.phraseEntry, i = r && r.dictionaryEntry;\n                    if (n) {',
    'var n = r && r.phraseEntry, i = r && r.dictionaryEntry;\n                    __sbTranslationPhraseRange = n && r.phraseMatch ? [Number(r.phraseMatch.startTokenIndex), Number(r.phraseMatch.endTokenIndex)] : null, __sbApplyWordHighlights();\n                    if (n) {',
);

replaceOnce(
    'clear phrase highlight on dismiss',
    '__sbTranslationRequestVersion++, __sbTranslationOpen = !1, __sbTranslationLookupWord = "", __sbTranslationPopup && (__sbTranslationPopup.style.display = "none")',
    '__sbTranslationRequestVersion++, __sbTranslationOpen = !1, __sbTranslationLookupWord = "", __sbTranslationPhraseRange = null, __sbTranslationPopup && (__sbTranslationPopup.style.display = "none"), __sbApplyWordHighlights()',
);

const outsideHelper = `                function __sbTranslationOutsidePointer(e) {
                    if (!__sbTranslationOpen || !e || !e.target) return;
                    var r = e.target;
                    try {
                        if (r.closest && (r.closest("[data-subtitle-bridge-translation]") || r.closest("[data-subtitle-bridge-word]"))) return
                    } catch (e) {}
                    __sbDismissTranslation()
                }

`;
replaceOnce(
    'outside pointer helper',
    '                function __sbLookupSelected() {',
    outsideHelper + '                function __sbLookupSelected() {',
);

replaceOnce(
    'pointer listener',
    '                window.addEventListener("keydown", __sbKeydown, !0);',
    '                window.addEventListener("keydown", __sbKeydown, !0), t.addEventListener("pointerdown", __sbTranslationOutsidePointer, !0);',
);

replaceOnce(
    'pointer listener cleanup',
    '__sbStopNativeCueTap(), __sbDismissTranslation(), __sbTranslationPopup && __sbTranslationPopup.parentNode === t && t.removeChild(__sbTranslationPopup), __sbOverlay.parentNode === t',
    '__sbStopNativeCueTap(), t.removeEventListener("pointerdown", __sbTranslationOutsidePointer, !0), __sbDismissTranslation(), __sbTranslationPopup && __sbTranslationPopup.parentNode === t && t.removeChild(__sbTranslationPopup), __sbOverlay.parentNode === t',
);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.14 Magic Remote + phrase highlighting interactions');
