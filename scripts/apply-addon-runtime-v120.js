'use strict';
const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-addon-runtime-v120.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv120')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.20 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}
function replaceSection(name, startText, endText, replacement) {
    const a = source.indexOf(startText);
    const b = source.indexOf(endText, a + startText.length);
    if (a < 0 || b < 0) throw new Error('v1.0.20 section missing: ' + name);
    source = source.slice(0, a) + replacement + source.slice(b);
}

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgePOCv116 = !0, window.__subtitleBridgePOCv117 = !0, window.__subtitleBridgePOCv118 = !0, window.__subtitleBridgePOCv119 = !0;',
    'window.__subtitleBridgePOCv116 = !0, window.__subtitleBridgePOCv117 = !0, window.__subtitleBridgePOCv118 = !0, window.__subtitleBridgePOCv119 = !0, window.__subtitleBridgePOCv120 = !0;'
);

replaceOnce(
    'addon runtime state',
    '__sbExtLookupVersion = 0,\n                        __sbExtMagicPortalTimer = null;',
    '__sbExtLookupVersion = 0,\n                        __sbExtMagicPortalTimer = null,\n                        __sbExtInteractiveOverlay = null,\n                        __sbExtCurrentLines = [],\n                        __sbExtRenderSignature = "",\n                        __sbExtPointerActive = !1;'
);

replaceOnce(
    'addon normal layer and separate interaction layer',
    'h.style.pointerEvents = "none", h.style.zIndex = "100", h.style.position = "absolute", h.style.left = "0", h.style.right = "0", h.style.width = "auto";',
    `h.style.pointerEvents = "none", h.style.zIndex = "1", h.style.position = "absolute", h.style.left = "0", h.style.right = "0", h.style.width = "auto";
                    __sbExtInteractiveOverlay = document.createElement("div"), __sbExtInteractiveOverlay.setAttribute("data-subtitle-bridge-external-interaction", "1"), __sbExtInteractiveOverlay.style.position = "fixed", __sbExtInteractiveOverlay.style.left = "0", __sbExtInteractiveOverlay.style.right = "0", __sbExtInteractiveOverlay.style.width = "100vw", __sbExtInteractiveOverlay.style.bottom = "0", __sbExtInteractiveOverlay.style.zIndex = "2147483000", __sbExtInteractiveOverlay.style.textAlign = "center", __sbExtInteractiveOverlay.style.pointerEvents = "none", __sbExtInteractiveOverlay.style.display = "none", (document.body || document.documentElement).appendChild(__sbExtInteractiveOverlay);`
);

// Build interactive words only on demand. Normal addon playback keeps the lightweight
// visible subtitle renderer in its original player-local stacking context.
replaceSection(
    'addon selection and pointer runtime',
    '                    function __sbExtStart(e) {',
    '                    function __sbExtOutsidePointer(e) {',
    `                    function __sbExtBuildInteractive() {
                        if (!__sbExtCurrentLines.length) return !1;
                        for (; __sbExtInteractiveOverlay.firstChild;) __sbExtInteractiveOverlay.removeChild(__sbExtInteractiveOverlay.firstChild);
                        __sbExtWords = [], __sbExtNextLine = 0, __sbExtInteractiveOverlay.style.bottom = Math.max(0, Math.min(35, E || 0)) + "%", __sbExtInteractiveOverlay.style.fontFamily = "inherit", __sbExtInteractiveOverlay.style.textAlign = "center";
                        for (var e = 0; e < __sbExtCurrentLines.length; e++) {
                            var t = document.createElement("div");
                            t.textContent = __sbExtCurrentLines[e], t.style.display = "inline-block", t.style.padding = "0", t.style.whiteSpace = "pre-wrap", t.style.fontWeight = "600", t.style.lineHeight = "1.35", t.style.margin = ".1em 0";
                            var r = window.screen720p ? 1.538 : 1;
                            t.style.fontSize = Math.floor(b / 25 * r) + "vmin", t.style.color = S, t.style.backgroundColor = A, t.style.textShadow = "rgb(34, 34, 34) 1px 1px .1em", __sbExtWordify(t), __sbExtInteractiveOverlay.appendChild(t), __sbExtInteractiveOverlay.appendChild(document.createElement("br"))
                        }
                        return __sbExtWords.length > 0
                    }

                    function __sbExtShowInteractive(e) {
                        __sbExtBuildInteractive() && (__sbExtPointerActive = !e, __sbExtInteractiveOverlay.style.opacity = e ? String(L) : "0.001", __sbExtInteractiveOverlay.style.display = "block", e && (h.style.visibility = "hidden"))
                    }

                    function __sbExtHideInteractive() {
                        __sbExtPointerActive = !1, __sbExtInteractiveOverlay.style.display = "none", h.style.visibility = "visible"
                    }

                    function __sbExtStart(e) {
                        if (!__sbExtWords.length && !__sbExtBuildInteractive() || !__sbExtWords.length) return !1;
                        return __sbExtSelecting || (__sbExtWasPaused = !0 === f.paused, r.dispatch({ type: "setProp", propName: "paused", propValue: !0 }), __sbExtSelecting = !0), __sbExtPointerActive = !1, __sbExtInteractiveOverlay.style.opacity = String(L), __sbExtInteractiveOverlay.style.display = "block", h.style.visibility = "hidden", __sbExtSetSelected("number" == typeof e ? e : 0), !0
                    }

                    function __sbExtExit(e) {
                        __sbExtSelecting && (__sbExtDismissPopup(), __sbExtSelecting = !1, __sbExtSelected = -1, __sbExtPhraseRange = null, __sbExtWords.forEach((function(e) { e.style.outline = "none", e.style.backgroundColor = e.__sbBaseBackground, e.style.color = e.__sbBaseColor || "inherit", e.style.borderRadius = "0", e.style.boxShadow = "none" })), __sbExtHideInteractive(), e && !__sbExtWasPaused && r.dispatch({ type: "setProp", propName: "paused", propValue: !1 }), __sbExtDebug())
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
                                n.setAttribute("data-subtitle-bridge-external-word", String(s)), n.setAttribute("data-sb-line", String(i)), n.setAttribute("data-sb-col", String(a++)), n.textContent = t.text, n.__sbLookupTerm = t.lookupTerm, n.__sbBaseBackground = "transparent", n.__sbBaseColor = "inherit", n.style.display = "inline", n.style.padding = ".04em .08em", n.style.pointerEvents = "auto", n.style.cursor = "pointer", n.style.backgroundColor = n.__sbBaseBackground, n.onmouseenter = function() { var e = parseInt(this.getAttribute("data-subtitle-bridge-external-word"), 10); __sbExtSelecting && __sbExtSetSelected(e) }, n.onmouseleave = function() {}, n.onclick = function(e) { e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(); var t = parseInt(this.getAttribute("data-subtitle-bridge-external-word"), 10); __sbExtStart(t) && __sbExtLookupSelected() }, __sbExtWords.push(n), e.appendChild(n)
                            }))
                        }
                    }

                    function __sbExtSetMagicPointerPortal(e) {
                        e ? __sbExtShowInteractive(!1) : !__sbExtSelecting && __sbExtHideInteractive()
                    }

                    function __sbExtMagicPointerMove(e) {
                        if (!g || __sbExtSelecting || __sbExtPopupOpen || !__sbExtCurrentLines.length) return;
                        var t = window.__subtitleBridgeWebOSPOC, r = t && /^EMBEDDED_\\d+$/.test(String(t.selectedEmbeddedTrackId || ""));
                        if (r) return;
                        __sbExtSetMagicPointerPortal(!0), null !== __sbExtMagicPortalTimer && clearTimeout(__sbExtMagicPortalTimer), __sbExtMagicPortalTimer = setTimeout((function() {
                            __sbExtMagicPortalTimer = null, __sbExtSetMagicPointerPortal(!1)
                        }), 2500)
                    }

`
);

replaceSection(
    'addon normal renderer',
    '                    function I() {',
    '                    function w(e, t, r) {',
    `                    function I() {
                        var e = window.__subtitleBridgeWebOSPOC, t = e && /^EMBEDDED_\\d+$/.test(String(e.selectedEmbeddedTrackId || ""));
                        if (window.__subtitleBridgeEmbeddedActive || t) {
                            __sbExtCurrentLines = [], __sbExtRenderSignature = "", __sbExtWords = [], __sbExtNextLine = 0, __sbExtHideInteractive();
                            for (; h.hasChildNodes();) h.removeChild(h.lastChild);
                            return __sbExtDebug(), void 0
                        }
                        if (__sbExtSelecting) return;
                        if (null === g || null === f.time || !isFinite(f.time)) {
                            __sbExtCurrentLines = [], __sbExtRenderSignature = "", __sbExtHideInteractive();
                            for (; h.hasChildNodes();) h.removeChild(h.lastChild);
                            return __sbExtDebug(), void 0
                        }
                        var r = u.render(g, f.time - T), n = r.map((function(e) { return __sbExtText(e) })).filter(Boolean), i = n.join("\\n"), a = [i, E, L, b, S, A, k].join("|");
                        __sbExtCurrentLines = n;
                        if (a === __sbExtRenderSignature && h.hasChildNodes()) return __sbExtDebug(), void 0;
                        __sbExtRenderSignature = a, __sbExtPhraseRange = null;
                        for (; h.hasChildNodes();) h.removeChild(h.lastChild);
                        h.style.bottom = Math.max(0, Math.min(35, E || 0)) + "%", h.style.opacity = L, h.style.visibility = "visible", r.forEach((function(e) {
                            e.style.display = "inline-block", e.style.padding = "0", e.style.whiteSpace = "pre-wrap", e.style.fontWeight = "600", e.style.lineHeight = "1.35", e.style.margin = ".1em 0";
                            var t = window.screen720p ? 1.538 : 1;
                            e.style.fontSize = Math.floor(b / 25 * t) + "vmin", e.style.color = S, e.style.backgroundColor = A, e.style.textShadow = "rgb(34, 34, 34) 1px 1px .1em", h.appendChild(e), h.appendChild(document.createElement("br"))
                        })), __sbExtPointerActive && __sbExtShowInteractive(!1), __sbExtDebug()
                    }

`
);

replaceOnce(
    'addon selected-track reset',
    '                            case "selectedExtraSubtitlesTrackId":\n                                g = null, y = null, T = null;',
    '                            case "selectedExtraSubtitlesTrackId":\n                                __sbExtCurrentLines = [], __sbExtRenderSignature = "", __sbExtWords = [], __sbExtHideInteractive(), g = null, y = null, T = null;'
);
replaceOnce(
    'addon unload reset',
    'return __sbExtUpPrimedUntil = 0, __sbExtExit(!1), g = null, v = [], y = null, T = null, I()',
    'return __sbExtUpPrimedUntil = 0, __sbExtExit(!1), __sbExtCurrentLines = [], __sbExtRenderSignature = "", __sbExtWords = [], __sbExtHideInteractive(), g = null, v = [], y = null, T = null, I()'
);
replaceOnce(
    'addon interaction cleanup',
    '__sbExtDismissPopup(), __sbExtPopup && __sbExtPopup.parentNode && __sbExtPopup.parentNode.removeChild(__sbExtPopup), m.removeAllListeners(), h.parentNode && h.parentNode.removeChild(h), !0;',
    '__sbExtDismissPopup(), __sbExtPopup && __sbExtPopup.parentNode && __sbExtPopup.parentNode.removeChild(__sbExtPopup), __sbExtInteractiveOverlay && __sbExtInteractiveOverlay.parentNode && __sbExtInteractiveOverlay.parentNode.removeChild(__sbExtInteractiveOverlay), m.removeAllListeners(), h.parentNode && h.parentNode.removeChild(h), !0;'
);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.20 addon fast-path renderer + selection-only visible interaction overlay');
