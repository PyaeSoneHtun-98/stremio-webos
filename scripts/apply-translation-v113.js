'use strict';

const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-translation-v113.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv113')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.13 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}

function replaceSection(name, startText, endText, replacement) {
    const a = source.indexOf(startText);
    const b = source.indexOf(endText, a + startText.length);
    if (a < 0 || b < 0) throw new Error('v1.0.13 section missing: ' + name);
    source = source.slice(0, a) + replacement + source.slice(b);
}

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0, window.__subtitleBridgePOCv112 = !0;',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0, window.__subtitleBridgePOCv112 = !0, window.__subtitleBridgePOCv113 = !0;',
);

replaceOnce(
    'translation popup state',
    '                    __sbFallbackCodec = "",\n                    __sbCueSource = "none";',
    '                    __sbFallbackCodec = "",\n                    __sbTranslationPopup = null,\n                    __sbTranslationHeading = null,\n                    __sbTranslationSubheading = null,\n                    __sbTranslationBody = null,\n                    __sbTranslationOpen = !1,\n                    __sbTranslationRequestVersion = 0,\n                    __sbTranslationLookupWord = "",\n                    __sbCueSource = "none";',
);

const helpers = `                function __sbTranslationMake(e, r) {
                    var n = document.createElement(e);
                    return null != r && (n.textContent = r), n
                }

                function __sbTranslationEnsurePopup() {
                    if (__sbTranslationPopup) return;
                    var e = __sbTranslationMake("div");
                    e.setAttribute("data-subtitle-bridge-translation", "1"), e.className = "translation-popup", e.style.position = "absolute", e.style.zIndex = "140", e.style.top = "50%", e.style.left = "50%", e.style.width = "560px", e.style.maxWidth = "calc(100% - 80px)", e.style.maxHeight = "380px", e.style.transform = "translate(-50%, -50%)", e.style.overflow = "auto", e.style.boxSizing = "border-box", e.style.padding = "24px 26px", e.style.border = "1px solid rgba(255,255,255,.24)", e.style.borderRadius = "22px", e.style.background = "linear-gradient(145deg, rgba(255,255,255,.17), rgba(255,255,255,.055) 46%, rgba(137,187,173,.11)), rgba(14,22,29,.94)", e.style.boxShadow = "0 28px 80px rgba(0,0,0,.48), 0 8px 26px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.28), inset 0 -1px 0 rgba(255,255,255,.06)", e.style.color = "#f4faf7", e.style.fontFamily = "inherit", e.style.textAlign = "left", e.style.pointerEvents = "auto", e.style.display = "none", e.style.backdropFilter = "blur(28px) saturate(145%)", e.style.webkitBackdropFilter = "blur(28px) saturate(145%)";
                    var r = __sbTranslationMake("div");
                    r.style.display = "flex", r.style.alignItems = "center", r.style.gap = "12px";
                    var n = __sbTranslationMake("div");
                    n.style.flex = "1", n.style.minWidth = "0", n.style.display = "flex", n.style.flexDirection = "column", n.style.gap = "5px";
                    var i = __sbTranslationMake("strong");
                    i.style.fontSize = "30px", i.style.fontWeight = "650", i.style.letterSpacing = "-.015em", i.style.color = "#f6fcf8";
                    var a = __sbTranslationMake("span");
                    a.style.fontSize = "15px", a.style.color = "rgba(225,237,232,.68)", a.style.letterSpacing = ".04em";
                    n.appendChild(i), n.appendChild(a);
                    var s = __sbTranslationMake("button", "×");
                    s.type = "button", s.setAttribute("aria-label", "Close translation"), s.style.flex = "0 0 44px", s.style.width = "44px", s.style.height = "44px", s.style.padding = "0", s.style.border = "1px solid rgba(255,255,255,.1)", s.style.borderRadius = "13px", s.style.background = "rgba(255,255,255,.06)", s.style.color = "#e8eeeb", s.style.font = "32px/1 sans-serif", s.style.cursor = "pointer", s.onclick = function(r) { r.preventDefault(), r.stopPropagation(), __sbDismissTranslation() };
                    r.appendChild(n), r.appendChild(s);
                    var o = __sbTranslationMake("div");
                    o.style.marginTop = "4px";
                    var l = __sbTranslationMake("div", "Back · Close");
                    l.style.marginTop = "18px", l.style.color = "rgba(225,237,232,.48)", l.style.fontSize = "13px", l.style.textAlign = "right";
                    e.appendChild(r), e.appendChild(o), e.appendChild(l), t.appendChild(e), __sbTranslationPopup = e, __sbTranslationHeading = i, __sbTranslationSubheading = a, __sbTranslationBody = o
                }

                function __sbDismissTranslation() {
                    __sbTranslationRequestVersion++, __sbTranslationOpen = !1, __sbTranslationLookupWord = "", __sbTranslationPopup && (__sbTranslationPopup.style.display = "none")
                }

                function __sbTranslationClearBody() {
                    __sbTranslationEnsurePopup(), __sbTranslationBody.innerHTML = ""
                }

                function __sbTranslationShowLoading(e) {
                    __sbTranslationEnsurePopup(), __sbTranslationClearBody(), __sbTranslationOpen = !0, __sbTranslationLookupWord = e, __sbTranslationHeading.textContent = e, __sbTranslationSubheading.textContent = "English → Burmese";
                    var r = __sbTranslationMake("div", "Translating…");
                    r.style.marginTop = "13px", r.style.fontSize = "18px", r.style.color = "rgba(231,241,236,.72)", __sbTranslationBody.appendChild(r), __sbTranslationPopup.style.display = "block"
                }

                function __sbTranslationSense(e, r) {
                    var n = __sbTranslationMake("section");
                    n.style.display = "grid", n.style.gap = "5px";
                    var i = __sbTranslationMake("span", e);
                    i.style.color = "rgba(225,237,232,.62)", i.style.fontSize = "13px", i.style.fontWeight = "700", i.style.letterSpacing = ".12em", i.style.textTransform = "uppercase";
                    var a = __sbTranslationMake("div", (r || []).join("၊ "));
                    a.setAttribute("lang", "my"), a.style.color = "#e0fff1", a.style.fontSize = "28px", a.style.lineHeight = "1.6";
                    n.appendChild(i), n.appendChild(a), __sbTranslationBody.appendChild(n)
                }

                function __sbTranslationShowResult(e, r) {
                    __sbTranslationEnsurePopup(), __sbTranslationClearBody(), __sbTranslationOpen = !0;
                    var n = r && r.phraseEntry, i = r && r.dictionaryEntry;
                    if (n) {
                        __sbTranslationHeading.textContent = n.phrase, __sbTranslationSubheading.textContent = "Detected phrase · " + (r.phraseTypeLabel || String(n.type || "phrase"));
                        var a = __sbTranslationMake("div");
                        a.style.display = "flex", a.style.flexDirection = "column", a.style.gap = "4px", a.style.borderTop = "1px solid rgba(255,255,255,.12)", a.style.marginTop = "14px", a.style.paddingTop = "14px", a.style.fontSize = "15px", a.style.color = "rgba(225,237,232,.68)";
                        var s = __sbTranslationMake("span", "Detected phrase: ");
                        var o = __sbTranslationMake("strong", n.phrase);
                        o.style.fontSize = "18px", o.style.color = "#d2f4e4", s.appendChild(o), a.appendChild(s);
                        r.phraseMatch && r.phraseMatch.source && r.phraseMatch.source !== n.phrase && ((o = __sbTranslationMake("small", r.phraseMatch.source + " → " + n.phrase)).style.fontSize = "13px", o.style.color = "rgba(225,237,232,.5)", a.appendChild(o));
                        __sbTranslationBody.appendChild(a);
                        var l = __sbTranslationMake("div");
                        l.style.display = "grid", l.style.gap = "13px", l.style.marginTop = "14px", l.style.paddingTop = "15px", l.style.borderTop = "1px solid rgba(255,255,255,.12)", __sbTranslationBody.appendChild(l);
                        var u = __sbTranslationBody;
                        __sbTranslationBody = l, __sbTranslationSense(r.phraseTypeLabel || String(n.type || "phrase"), n.burmese || []), __sbTranslationBody = u
                    } else if (i) {
                        __sbTranslationHeading.textContent = i.word, __sbTranslationSubheading.textContent = r.resolvedFromForm ? e + " → " + i.word : "English → Burmese";
                        if (i.pronunciation) {
                            var c = __sbTranslationMake("div", i.pronunciation);
                            c.style.marginTop = "9px", c.style.fontSize = "18px", c.style.letterSpacing = ".01em", c.style.color = "rgba(231,241,236,.72)", __sbTranslationBody.appendChild(c)
                        }
                        var d = __sbTranslationMake("div");
                        d.style.display = "grid", d.style.gap = "16px", d.style.marginTop = "14px", d.style.paddingTop = "15px", d.style.borderTop = "1px solid rgba(255,255,255,.12)", __sbTranslationBody.appendChild(d);
                        var h = __sbTranslationBody;
                        __sbTranslationBody = d, (i.meanings || []).forEach((function(e) { __sbTranslationSense(e.partOfSpeech || "", e.burmese || []) })), __sbTranslationBody = h
                    } else return void __sbTranslationShowError(e, "Translation unavailable");
                    __sbTranslationPopup.style.display = "block"
                }

                function __sbTranslationShowError(e, r) {
                    __sbTranslationEnsurePopup(), __sbTranslationClearBody(), __sbTranslationOpen = !0, __sbTranslationHeading.textContent = e, __sbTranslationSubheading.textContent = "English → Burmese";
                    var n = __sbTranslationMake("div");
                    n.style.display = "grid", n.style.gap = "7px", n.style.marginTop = "14px", n.style.fontSize = "17px", n.style.lineHeight = "1.5", n.style.color = "#ffbfaf";
                    var i = __sbTranslationMake("strong", "Translation unavailable"), a = __sbTranslationMake("span", r || "No offline Burmese translation is available for this word yet."), s = __sbTranslationMake("small", "Playback and subtitles still work. Try another word.");
                    s.style.color = "rgba(231,241,236,.72)", n.appendChild(i), n.appendChild(a), n.appendChild(s), __sbTranslationBody.appendChild(n), __sbTranslationPopup.style.display = "block"
                }

                function __sbLookupSelected() {
                    if (!__sbSelecting || __sbSelected < 0 || __sbSelected >= __sbWords.length) return;
                    var e = String(__sbWords[__sbSelected].textContent || "").trim();
                    if (!e) return;
                    var r = __sbWords.map((function(e) { return String(e.textContent || "") })), n = ++__sbTranslationRequestVersion;
                    __sbTranslationShowLoading(e);
                    var i = "/subtitle-bridge/lookup?word=" + encodeURIComponent(e) + "&tokens=" + encodeURIComponent(JSON.stringify(r)) + "&index=" + encodeURIComponent(String(__sbSelected));
                    __sbFetchTextWithTimeout(i, 7e3).then((function(i) {
                        if (n !== __sbTranslationRequestVersion) return;
                        var a;
                        try { a = JSON.parse(i) } catch (e) { throw new Error("Invalid dictionary response") }
                        a && a.found && a.result ? __sbTranslationShowResult(e, a.result) : __sbTranslationShowError(e, a && a.error ? a.error : "No offline Burmese translation is available for “" + e + "” yet.")
                    })).catch((function(r) {
                        n === __sbTranslationRequestVersion && __sbTranslationShowError(e, String(r && r.message || r || "Dictionary lookup failed"))
                    }))
                }

                function __sbPlainText(e) {`;

replaceSection(
    'translation popup helpers',
    '                function __sbPlainText(e) {',
    '                function __sbRender(e) {',
    helpers,
);

replaceOnce(
    'dismiss translation when selection exits',
    '                    __sbSelecting && (__sbSelecting = !1, __sbSelected = -1,',
    '                    __sbSelecting && (__sbDismissTranslation(), __sbSelecting = !1, __sbSelected = -1,',
);

replaceSection(
    'TV dictionary keyboard flow',
    '                function __sbKeydown(e) {',
    '                window.addEventListener("keydown", __sbKeydown, !0);',
    `                function __sbKeydown(e) {
                    var t = e.key || "", r = e.keyCode || e.which, n = "ArrowUp" === t || 38 === r, i = "Enter" === t || 13 === r, a = "Escape" === t || "Backspace" === t || 27 === r || 461 === r;
                    __sbLastKey = t || String(r), U();
                    if (__sbTranslationOpen) {
                        if (a) __sbDismissTranslation();
                        else if ("ArrowLeft" === t || 37 === r) __sbSetSelected(__sbSelected - 1), __sbLookupSelected();
                        else if ("ArrowRight" === t || 39 === r) __sbSetSelected(__sbSelected + 1), __sbLookupSelected();
                        else if (i) return e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0;
                        else if ("ArrowDown" === t || 40 === r) __sbExitSelection(!0);
                        else return;
                        return e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0
                    }
                    if (!__sbSelecting && n) {
                        var s = Date.now();
                        if (e.repeat) return;
                        if (s > __sbUpPrimedUntil) return __sbUpPrimedUntil = s + 3500, void 0;
                        __sbUpPrimedUntil = 0;
                        if (__sbStartSelection(0)) return e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0;
                        return void 0
                    }
                    if (!__sbSelecting) __sbUpPrimedUntil = 0;
                    if (__sbSelecting) {
                        if ("ArrowLeft" === t || 37 === r) __sbSetSelected(__sbSelected - 1);
                        else if ("ArrowRight" === t || 39 === r) __sbSetSelected(__sbSelected + 1);
                        else if ("ArrowUp" === t || 38 === r) __sbSetSelected(0);
                        else if (i) __sbLookupSelected();
                        else if ("ArrowDown" === t || 40 === r) __sbExitSelection(!0);
                        else {
                            if (!a) return;
                            __sbExitSelection(!0)
                        }
                        e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation()
                    }
                }
`,
);

replaceOnce(
    'destroy popup cleanup',
    '__sbStopNativeCueTap(), __sbOverlay.parentNode === t',
    '__sbStopNativeCueTap(), __sbDismissTranslation(), __sbTranslationPopup && __sbTranslationPopup.parentNode === t && t.removeChild(__sbTranslationPopup), __sbOverlay.parentNode === t',
);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.13 desktop-style Burmese dictionary popup');
