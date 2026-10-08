'use strict';
const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-addon-parity-v118.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv118')) process.exit(0);

function replaceOnce(name, before, after) {
  const at = source.indexOf(before);
  if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.18 anchor missing/non-unique: ' + name);
  source = source.slice(0, at) + after + source.slice(at + before.length);
}
function replaceSection(name, startText, endText, replacement) {
  const a = source.indexOf(startText);
  const b = source.indexOf(endText, a + startText.length);
  if (a < 0 || b < 0) throw new Error('v1.0.18 section missing: ' + name);
  source = source.slice(0, a) + replacement + source.slice(b);
}

replaceOnce(
  'runtime marker',
  'window.__subtitleBridgePOCv116 = !0, window.__subtitleBridgePOCv117 = !0;',
  'window.__subtitleBridgePOCv116 = !0, window.__subtitleBridgePOCv117 = !0, window.__subtitleBridgePOCv118 = !0;'
);

// Put the embedded interactive subtitle hit layer above Stremio controls without
// blocking controls outside actual word spans.
replaceOnce('embedded overlay fixed portal position', '__sbOverlay.style.position = "absolute"', '__sbOverlay.style.position = "fixed"');
replaceOnce('embedded overlay top z-index', '__sbOverlay.style.zIndex = "110"', '__sbOverlay.style.zIndex = "2147483000"');
replaceOnce(
  'embedded overlay body portal',
  't.style.position = t.style.position || "relative", t.appendChild(__sbOverlay), __sbDebug.setAttribute',
  't.style.position = t.style.position || "relative", (document.body || document.documentElement).appendChild(__sbOverlay), __sbDebug.setAttribute'
);

// Put the embedded dictionary popup in the document-level interaction layer too.
replaceOnce(
  'embedded popup fixed top layer',
  'e.setAttribute("data-subtitle-bridge-translation", "1"), e.className = "translation-popup", e.style.position = "absolute", e.style.zIndex = "140",',
  'e.setAttribute("data-subtitle-bridge-translation", "1"), e.className = "translation-popup", e.style.position = "fixed", e.style.zIndex = "2147483646",'
);
replaceOnce(
  'embedded popup body portal',
  'e.appendChild(r), e.appendChild(o), e.appendChild(l), t.appendChild(e), __sbTranslationPopup = e,',
  'e.appendChild(r), e.appendChild(o), e.appendChild(l), (document.body || document.documentElement).appendChild(e), __sbTranslationPopup = e,'
);
replaceOnce(
  'embedded outside pointer document listener',
  'window.addEventListener("keydown", __sbKeydown, !0), t.addEventListener("pointerdown", __sbTranslationOutsidePointer, !0);',
  'window.addEventListener("keydown", __sbKeydown, !0), document.addEventListener("pointerdown", __sbTranslationOutsidePointer, !0);'
);
replaceOnce(
  'embedded portal cleanup',
  'window.removeEventListener("keydown", __sbKeydown, !0), __sbStopNativeCueTap(), t.removeEventListener("pointerdown", __sbTranslationOutsidePointer, !0), __sbDismissTranslation(), __sbTranslationPopup && __sbTranslationPopup.parentNode === t && t.removeChild(__sbTranslationPopup), __sbOverlay.parentNode === t && t.removeChild(__sbOverlay), __sbDebug.parentNode === t && t.removeChild(__sbDebug),',
  'window.removeEventListener("keydown", __sbKeydown, !0), __sbStopNativeCueTap(), document.removeEventListener("pointerdown", __sbTranslationOutsidePointer, !0), __sbDismissTranslation(), __sbTranslationPopup && __sbTranslationPopup.parentNode && __sbTranslationPopup.parentNode.removeChild(__sbTranslationPopup), __sbOverlay.parentNode && __sbOverlay.parentNode.removeChild(__sbOverlay), __sbDebug.parentNode === t && t.removeChild(__sbDebug),'
);

replaceOnce(
  'external interaction state',
  '__sbExtNextLine = 0, __sbExtUpPrimedUntil = 0;',
  '__sbExtNextLine = 0, __sbExtUpPrimedUntil = 0,\n                        __sbExtPhraseRange = null,\n                        __sbExtPopup = null,\n                        __sbExtPopupHeading = null,\n                        __sbExtPopupSubheading = null,\n                        __sbExtPopupBody = null,\n                        __sbExtPopupOpen = !1,\n                        __sbExtLookupVersion = 0;'
);
replaceOnce(
  'external overlay body portal',
  'h.style.pointerEvents = "none", h.style.zIndex = "100";',
  'h.style.pointerEvents = "none", h.style.zIndex = "2147483000", h.style.position = "fixed", h.style.left = "0", h.style.right = "0", h.style.width = "100vw", h.parentNode && h.parentNode.removeChild(h), (document.body || document.documentElement).appendChild(h);'
);

const externalHelpers = `                    function __sbExtTokenizeSubtitleText(e) {
                        var t = String(e || ""), r = [], n = null, i = null;
                        try {
                            n = new RegExp("[\\\\p{L}\\\\p{N}]+(?:['’][\\\\p{L}\\\\p{N}]+)*", "gu"), i = new RegExp("\\\\p{L}", "u")
                        } catch (e) {
                            n = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g, i = /[A-Za-z]/
                        }
                        for (var a = 0, s = n.exec(t); s; s = n.exec(t)) {
                            var o = s[0], l = s.index;
                            if (!i.test(o)) continue;
                            l > a && r.push({ kind: "text", text: t.slice(a, l) });
                            var u = o;
                            try { u = u.normalize("NFKC").toLocaleLowerCase("en-US") } catch (e) { u = u.toLowerCase() }
                            r.push({ kind: "word", text: o, lookupTerm: u, start: l, end: l + o.length }), a = l + o.length
                        }
                        return a < t.length && r.push({ kind: "text", text: t.slice(a) }), r
                    }

                    function __sbExtApplyHighlights() {
                        __sbExtWords.forEach((function(e, t) {
                            var r = t === __sbExtSelected, n = __sbExtPhraseRange && t >= __sbExtPhraseRange[0] && t < __sbExtPhraseRange[1];
                            e.style.outline = r ? "2px solid rgba(255,255,255,.92)" : "none", e.style.backgroundColor = r ? "rgba(190,239,220,.94)" : n ? "rgba(181,230,209,.24)" : e.__sbBaseBackground, e.style.color = r ? "#112c21" : e.__sbBaseColor || "inherit", e.style.borderRadius = r || n ? "5px" : "0", e.style.boxShadow = r ? "0 5px 18px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.5)" : n ? "0 0 0 2px rgba(181,230,209,.08)" : "none"
                        }))
                    }

                    function __sbExtSetSelected(e) {
                        __sbExtWords.length && (__sbExtSelected = Math.max(0, Math.min(__sbExtWords.length - 1, e)), __sbExtApplyHighlights(), __sbExtDebug())
                    }

                    function __sbExtPopupMake(e, t) {
                        var r = document.createElement(e);
                        return null != t && (r.textContent = t), r
                    }

                    function __sbExtEnsurePopup() {
                        if (__sbExtPopup) return;
                        var e = __sbExtPopupMake("div");
                        e.setAttribute("data-subtitle-bridge-translation", "external"), e.className = "translation-popup", e.style.position = "fixed", e.style.zIndex = "2147483646", e.style.top = "50%", e.style.left = "50%", e.style.width = "560px", e.style.maxWidth = "calc(100% - 80px)", e.style.maxHeight = "380px", e.style.transform = "translate(-50%, -50%)", e.style.overflow = "auto", e.style.boxSizing = "border-box", e.style.padding = "24px 26px", e.style.border = "1px solid rgba(255,255,255,.24)", e.style.borderRadius = "22px", e.style.background = "linear-gradient(145deg, rgba(255,255,255,.17), rgba(255,255,255,.055) 46%, rgba(137,187,173,.11)), rgba(14,22,29,.94)", e.style.boxShadow = "0 28px 80px rgba(0,0,0,.48), 0 8px 26px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.28), inset 0 -1px 0 rgba(255,255,255,.06)", e.style.color = "#f4faf7", e.style.fontFamily = "inherit", e.style.textAlign = "left", e.style.pointerEvents = "auto", e.style.display = "none", e.style.backdropFilter = "blur(28px) saturate(145%)", e.style.webkitBackdropFilter = "blur(28px) saturate(145%)";
                        var t = __sbExtPopupMake("div");
                        t.style.display = "flex", t.style.alignItems = "center", t.style.gap = "12px";
                        var r = __sbExtPopupMake("div");
                        r.style.flex = "1", r.style.minWidth = "0", r.style.display = "flex", r.style.flexDirection = "column", r.style.gap = "5px";
                        var n = __sbExtPopupMake("strong");
                        n.style.fontSize = "30px", n.style.fontWeight = "650", n.style.letterSpacing = "-.015em", n.style.color = "#f6fcf8";
                        var i = __sbExtPopupMake("span");
                        i.style.fontSize = "15px", i.style.color = "rgba(225,237,232,.68)", i.style.letterSpacing = ".04em", r.appendChild(n), r.appendChild(i);
                        var a = __sbExtPopupMake("button", "×");
                        a.type = "button", a.setAttribute("aria-label", "Close translation"), a.style.flex = "0 0 44px", a.style.width = "44px", a.style.height = "44px", a.style.padding = "0", a.style.border = "1px solid rgba(255,255,255,.1)", a.style.borderRadius = "13px", a.style.background = "rgba(255,255,255,.06)", a.style.color = "#e8eeeb", a.style.font = "32px/1 sans-serif", a.style.cursor = "pointer", a.style.pointerEvents = "auto", a.onclick = function(e) { e.preventDefault(), e.stopPropagation(), __sbExtDismissPopup() };
                        t.appendChild(r), t.appendChild(a);
                        var s = __sbExtPopupMake("div");
                        s.style.marginTop = "4px";
                        var o = __sbExtPopupMake("div", "Back · Close");
                        o.style.marginTop = "18px", o.style.color = "rgba(225,237,232,.48)", o.style.fontSize = "13px", o.style.textAlign = "right", e.appendChild(t), e.appendChild(s), e.appendChild(o), (document.body || document.documentElement).appendChild(e), __sbExtPopup = e, __sbExtPopupHeading = n, __sbExtPopupSubheading = i, __sbExtPopupBody = s
                    }

                    function __sbExtDismissPopup() {
                        __sbExtLookupVersion++, __sbExtPopupOpen = !1, __sbExtPhraseRange = null, __sbExtPopup && (__sbExtPopup.style.display = "none"), __sbExtApplyHighlights()
                    }

                    function __sbExtClearPopupBody() {
                        __sbExtEnsurePopup(), __sbExtPopupBody.innerHTML = ""
                    }

                    function __sbExtPopupSense(e, t) {
                        var r = __sbExtPopupMake("section");
                        r.style.display = "grid", r.style.gap = "5px";
                        var n = __sbExtPopupMake("span", e);
                        n.style.color = "rgba(225,237,232,.62)", n.style.fontSize = "13px", n.style.fontWeight = "700", n.style.letterSpacing = ".12em", n.style.textTransform = "uppercase";
                        var i = __sbExtPopupMake("div", (t || []).join("၊ "));
                        i.setAttribute("lang", "my"), i.style.color = "#e0fff1", i.style.fontSize = "28px", i.style.lineHeight = "1.6", r.appendChild(n), r.appendChild(i), __sbExtPopupBody.appendChild(r)
                    }

                    function __sbExtShowLoading(e) {
                        __sbExtEnsurePopup(), __sbExtClearPopupBody(), __sbExtPopupOpen = !0, __sbExtPhraseRange = null, __sbExtApplyHighlights(), __sbExtPopupHeading.textContent = e, __sbExtPopupSubheading.textContent = "English → Burmese";
                        var t = __sbExtPopupMake("div", "Translating…");
                        t.style.marginTop = "13px", t.style.fontSize = "18px", t.style.color = "rgba(231,241,236,.72)", __sbExtPopupBody.appendChild(t), __sbExtPopup.style.display = "block"
                    }

                    function __sbExtShowError(e, t) {
                        __sbExtEnsurePopup(), __sbExtClearPopupBody(), __sbExtPopupOpen = !0, __sbExtPopupHeading.textContent = e, __sbExtPopupSubheading.textContent = "English → Burmese";
                        var r = __sbExtPopupMake("div");
                        r.style.display = "grid", r.style.gap = "7px", r.style.marginTop = "14px", r.style.fontSize = "17px", r.style.lineHeight = "1.5", r.style.color = "#ffbfaf";
                        var n = __sbExtPopupMake("strong", "Translation unavailable"), i = __sbExtPopupMake("span", t || "No offline Burmese translation is available for this word yet."), a = __sbExtPopupMake("small", "Playback and subtitles still work. Try another word.");
                        a.style.color = "rgba(231,241,236,.72)", r.appendChild(n), r.appendChild(i), r.appendChild(a), __sbExtPopupBody.appendChild(r), __sbExtPopup.style.display = "block"
                    }

                    function __sbExtShowResult(e, t) {
                        __sbExtEnsurePopup(), __sbExtClearPopupBody(), __sbExtPopupOpen = !0;
                        var r = t && t.phraseEntry, n = t && t.dictionaryEntry;
                        __sbExtPhraseRange = r && t.phraseMatch ? [Number(t.phraseMatch.startTokenIndex), Number(t.phraseMatch.endTokenIndex)] : null, __sbExtApplyHighlights();
                        if (r) {
                            __sbExtPopupHeading.textContent = r.phrase, __sbExtPopupSubheading.textContent = "Detected phrase · " + (t.phraseTypeLabel || String(r.type || "phrase"));
                            var i = __sbExtPopupMake("div");
                            i.style.display = "flex", i.style.flexDirection = "column", i.style.gap = "4px", i.style.borderTop = "1px solid rgba(255,255,255,.12)", i.style.marginTop = "14px", i.style.paddingTop = "14px", i.style.fontSize = "15px", i.style.color = "rgba(225,237,232,.68)";
                            var a = __sbExtPopupMake("span", "Detected phrase: "), s = __sbExtPopupMake("strong", r.phrase);
                            s.style.fontSize = "18px", s.style.color = "#d2f4e4", a.appendChild(s), i.appendChild(a), t.phraseMatch && t.phraseMatch.source && t.phraseMatch.source !== r.phrase && ((s = __sbExtPopupMake("small", t.phraseMatch.source + " → " + r.phrase)).style.fontSize = "13px", s.style.color = "rgba(225,237,232,.5)", i.appendChild(s)), __sbExtPopupBody.appendChild(i);
                            var o = __sbExtPopupMake("div");
                            o.style.display = "grid", o.style.gap = "13px", o.style.marginTop = "14px", o.style.paddingTop = "15px", o.style.borderTop = "1px solid rgba(255,255,255,.12)", __sbExtPopupBody.appendChild(o);
                            var l = __sbExtPopupBody;
                            __sbExtPopupBody = o, __sbExtPopupSense(t.phraseTypeLabel || String(r.type || "phrase"), r.burmese || []), __sbExtPopupBody = l
                        } else if (n) {
                            __sbExtPopupHeading.textContent = n.word, __sbExtPopupSubheading.textContent = t.resolvedFromForm ? e + " → " + n.word : "English → Burmese";
                            if (n.pronunciation) {
                                var u = __sbExtPopupMake("div", n.pronunciation);
                                u.style.marginTop = "9px", u.style.fontSize = "18px", u.style.letterSpacing = ".01em", u.style.color = "rgba(231,241,236,.72)", __sbExtPopupBody.appendChild(u)
                            }
                            var c = __sbExtPopupMake("div");
                            c.style.display = "grid", c.style.gap = "16px", c.style.marginTop = "14px", c.style.paddingTop = "15px", c.style.borderTop = "1px solid rgba(255,255,255,.12)", __sbExtPopupBody.appendChild(c);
                            var d = __sbExtPopupBody;
                            __sbExtPopupBody = c, (n.meanings || []).forEach((function(e) { __sbExtPopupSense(e.partOfSpeech || "", e.burmese || []) })), __sbExtPopupBody = d
                        } else return void __sbExtShowError(e, "Translation unavailable");
                        __sbExtPopup.style.display = "block"
                    }

                    function __sbExtLookupSelected() {
                        if (!__sbExtSelecting || __sbExtSelected < 0 || __sbExtSelected >= __sbExtWords.length) return;
                        var e = String(__sbExtWords[__sbExtSelected].textContent || "").trim();
                        if (!e) return;
                        var t = __sbExtWords.map((function(e) { return String(e.__sbLookupTerm || e.textContent || "") })), r = ++__sbExtLookupVersion;
                        __sbExtShowLoading(e);
                        var n = "/subtitle-bridge/lookup?word=" + encodeURIComponent(e) + "&tokens=" + encodeURIComponent(JSON.stringify(t)) + "&index=" + encodeURIComponent(String(__sbExtSelected));
                        fetch(n).then((function(e) { return e.ok ? e.text() : e.text().then((function(t) { throw new Error((t || e.status + " " + e.statusText || "request failed").slice(0, 180)) })) })).then((function(n) {
                            if (r !== __sbExtLookupVersion) return;
                            var i;
                            try { i = JSON.parse(n) } catch (e) { throw new Error("Invalid dictionary response") }
                            i && i.found && i.result ? __sbExtShowResult(e, i.result) : __sbExtShowError(e, i && i.error ? i.error : "No offline Burmese translation is available for “" + e + "” yet.")
                        })).catch((function(t) {
                            r === __sbExtLookupVersion && __sbExtShowError(e, String(t && t.message || t || "Dictionary lookup failed"))
                        }))
                    }

                    function __sbExtStart(e) {
                        if (!__sbExtWords.length) return !1;
                        return __sbExtSelecting || (__sbExtWasPaused = !0 === f.paused, r.dispatch({ type: "setProp", propName: "paused", propValue: !0 }), __sbExtSelecting = !0), __sbExtSetSelected("number" == typeof e ? e : 0), !0
                    }

                    function __sbExtExit(e) {
                        __sbExtSelecting && (__sbExtDismissPopup(), __sbExtSelecting = !1, __sbExtSelected = -1, __sbExtPhraseRange = null, __sbExtWords.forEach((function(e) { e.style.outline = "none", e.style.backgroundColor = e.__sbBaseBackground, e.style.color = e.__sbBaseColor || "inherit", e.style.borderRadius = "0", e.style.boxShadow = "none" })), e && !__sbExtWasPaused && r.dispatch({ type: "setProp", propName: "paused", propValue: !1 }), __sbExtDebug())
                    }

                    function __sbExtWordify(e) {
                        var t = __sbExtText(e);
                        for (; e.firstChild;) e.removeChild(e.firstChild);
                        if (!t.trim()) return;
                        var r = t.split("\\n");
                        for (var n = 0; n < r.length; n++) {
                            n > 0 && e.appendChild(document.createElement("br"));
                            var i = __sbExtNextLine++, a = 0;
                            __sbExtTokenizeSubtitleText(r[n]).forEach((function(t) {
                                if ("text" === t.kind) {
                                    var r = document.createElement("span");
                                    return r.textContent = t.text, r.style.pointerEvents = "none", void e.appendChild(r)
                                }
                                var n = document.createElement("span"), s = __sbExtWords.length;
                                n.setAttribute("data-subtitle-bridge-external-word", String(s)), n.setAttribute("data-sb-line", String(i)), n.setAttribute("data-sb-col", String(a++)), n.textContent = t.text, n.__sbLookupTerm = t.lookupTerm, n.__sbBaseBackground = "transparent", n.__sbBaseColor = "inherit", n.style.display = "inline", n.style.padding = ".04em .08em", n.style.pointerEvents = "auto", n.style.cursor = "pointer", n.style.backgroundColor = n.__sbBaseBackground, n.onmouseenter = function() { var e = parseInt(this.getAttribute("data-subtitle-bridge-external-word"), 10); __sbExtSelecting ? __sbExtSetSelected(e) : (this.style.backgroundColor = "rgba(181,230,209,.22)", this.style.borderRadius = "5px") }, n.onmouseleave = function() { __sbExtSelecting || (this.style.backgroundColor = this.__sbBaseBackground, this.style.borderRadius = "0") }, n.onclick = function(e) { e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(); var t = parseInt(this.getAttribute("data-subtitle-bridge-external-word"), 10); __sbExtStart(t) && __sbExtLookupSelected() }, __sbExtWords.push(n), e.appendChild(n)
                            }))
                        }
                    }

                    function __sbExtOutsidePointer(e) {
                        if (!__sbExtPopupOpen || !e || !e.target) return;
                        var t = e.target;
                        try { if (t.closest && (t.closest('[data-subtitle-bridge-translation="external"]') || t.closest("[data-subtitle-bridge-external-word]"))) return } catch (e) {}
                        __sbExtDismissPopup()
                    }

`;

replaceSection(
  'external parity helpers',
  '                    function __sbExtSetSelected(e) {',
  '                    function __sbExtKeydown(e) {',
  externalHelpers
);

const externalKeydown = `                    function __sbExtKeydown(e) {
                        var t = e.key || "", n = e.keyCode || e.which, i = !1, a = "Escape" === t || "Backspace" === t || 27 === n || 461 === n, s = "Enter" === t || 13 === n;
                        if (__sbExtPopupOpen) {
                            if (a) __sbExtDismissPopup();
                            else if ("ArrowLeft" === t || 37 === n) __sbExtSetSelected(__sbExtSelected - 1), __sbExtLookupSelected();
                            else if ("ArrowRight" === t || 39 === n) __sbExtSetSelected(__sbExtSelected + 1), __sbExtLookupSelected();
                            else if ("ArrowDown" === t || 40 === n) __sbExtExit(!0);
                            else if (!s) return;
                            return e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0
                        }
                        if (!__sbExtSelecting && ("ArrowUp" === t || 38 === n)) {
                            if (e.repeat) return;
                            var o = Date.now();
                            if (o > __sbExtUpPrimedUntil) return __sbExtUpPrimedUntil = o + 3500, void 0;
                            __sbExtUpPrimedUntil = 0, i = __sbExtStart(0)
                        } else if (__sbExtSelecting) {
                            if ("ArrowLeft" === t || 37 === n) __sbExtSetSelected(__sbExtSelected - 1), i = !0;
                            else if ("ArrowRight" === t || 39 === n) __sbExtSetSelected(__sbExtSelected + 1), i = !0;
                            else if ("ArrowUp" === t || 38 === n) __sbExtSetSelected(0), i = !0;
                            else if (s) __sbExtLookupSelected(), i = !0;
                            else if ("ArrowDown" === t || 40 === n) __sbExtExit(!0), i = !0;
                            else if (a) __sbExtExit(!0), i = !0
                        }
                        !("ArrowUp" === t || 38 === n) && (__sbExtUpPrimedUntil = 0), i && (e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation())
                    }
`;
replaceSection(
  'external keyboard parity',
  '                    function __sbExtKeydown(e) {',
  '                    window.addEventListener("keydown", __sbExtKeydown, !0);',
  externalKeydown
);
replaceOnce(
  'external document outside listener',
  '                    window.addEventListener("keydown", __sbExtKeydown, !0);',
  '                    window.addEventListener("keydown", __sbExtKeydown, !0), document.addEventListener("pointerdown", __sbExtOutsidePointer, !0);'
);

replaceSection(
  'external renderer parity',
  '                    function I() {',
  '                    function w(e, t, r) {',
  `                    function I() {
                        if (window.__subtitleBridgeEmbeddedActive) {
                            __sbExtWords = [], __sbExtNextLine = 0;
                            for (; h.hasChildNodes();) h.removeChild(h.lastChild);
                            return __sbExtDebug(), void 0
                        }
                        if (__sbExtSelecting) return;
                        __sbExtWords = [], __sbExtNextLine = 0, __sbExtPhraseRange = null;
                        for (; h.hasChildNodes();) h.removeChild(h.lastChild);
                        null !== g && null !== f.time && isFinite(f.time) && (h.style.bottom = Math.max(0, Math.min(35, E || 0)) + "%", h.style.opacity = L, u.render(g, f.time - T).forEach((function(e) {
                            e.style.display = "inline-block", e.style.padding = "0", e.style.whiteSpace = "pre-wrap", e.style.fontWeight = "600", e.style.lineHeight = "1.35", e.style.margin = ".1em 0";
                            var t = window.screen720p ? 1.538 : 1;
                            e.style.fontSize = Math.floor(b / 25 * t) + "vmin", e.style.color = S, e.style.backgroundColor = A, e.style.textShadow = "rgb(34, 34, 34) 1px 1px .1em", __sbExtWordify(e), h.appendChild(e), h.appendChild(document.createElement("br"))
                        }))), __sbExtDebug()
                    }

`
);

replaceOnce(
  'external destroy portal cleanup',
  'window.removeEventListener("keydown", __sbExtKeydown, !0), m.removeAllListeners(), d.removeChild(h), !0;',
  'window.removeEventListener("keydown", __sbExtKeydown, !0), document.removeEventListener("pointerdown", __sbExtOutsidePointer, !0), __sbExtDismissPopup(), __sbExtPopup && __sbExtPopup.parentNode && __sbExtPopup.parentNode.removeChild(__sbExtPopup), m.removeAllListeners(), h.parentNode && h.parentNode.removeChild(h), !0;'
);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.18 addon subtitle parity + document-level Magic Remote interaction layer');
