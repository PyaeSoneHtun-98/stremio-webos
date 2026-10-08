'use strict';

const fs = require('fs');
const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/apply-word-tokenizer-v115.js <video.chunk.js>');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('__subtitleBridgePOCv115')) process.exit(0);

function replaceOnce(name, before, after) {
    const at = source.indexOf(before);
    if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('v1.0.15 anchor missing/non-unique: ' + name);
    source = source.slice(0, at) + after + source.slice(at + before.length);
}
function replaceSection(name, startText, endText, replacement) {
    const a = source.indexOf(startText);
    const b = source.indexOf(endText, a + startText.length);
    if (a < 0 || b < 0) throw new Error('v1.0.15 section missing: ' + name);
    source = source.slice(0, a) + replacement + source.slice(b);
}

replaceOnce(
    'runtime marker',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0, window.__subtitleBridgePOCv112 = !0, window.__subtitleBridgePOCv113 = !0, window.__subtitleBridgePOCv114 = !0;',
    'window.__subtitleBridgePOCv108 = !0, window.__subtitleBridgePOCv111 = !0, window.__subtitleBridgePOCv112 = !0, window.__subtitleBridgePOCv113 = !0, window.__subtitleBridgePOCv114 = !0, window.__subtitleBridgePOCv115 = !0;',
);

const tokenizerAndRender = `                function __sbTokenizeSubtitleText(e) {
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

                function __sbRender(e) {
                    if (__sbOverlay.style.bottom = Math.max(0, Math.min(35, x || 0)) + "%", __sbOverlay.style.color = k || "rgb(255, 255, 255)", __sbOverlay.style.opacity = Math.max(0, Math.min(1, (_ || 100) / 100)), __sbOverlay.style.fontSize = Math.max(2.6, 4 * ((f || 75) / 75)) + "vmin", __sbOverlay.style.fontFamily = "inherit", __sbOverlay.style.fontWeight = "600", __sbOverlay.style.textShadow = "rgb(34, 34, 34) 1px 1px .1em", e === __sbLastCueText && __sbOverlay.childNodes.length) return;
                    __sbLastCueText = e, __sbOverlay.innerHTML = "", __sbWords = [], __sbSelected = -1, __sbTranslationPhraseRange = null;
                    if (!e) return __sbOverlay.style.display = "none", void 0;
                    __sbOverlay.style.display = "block", String(e).split("\\n").forEach((function(e) {
                        var t = document.createElement("div");
                        t.style.lineHeight = "1.35", t.style.margin = ".1em 0", __sbTokenizeSubtitleText(e).forEach((function(e) {
                            if ("text" === e.kind) {
                                var r = document.createElement("span");
                                return r.textContent = e.text, r.style.pointerEvents = "none", void t.appendChild(r)
                            }
                            var n = document.createElement("span"), i = __sbWords.length;
                            n.textContent = e.text, n.__sbLookupTerm = e.lookupTerm, n.setAttribute("data-subtitle-bridge-word", "1"), n.style.display = "inline", n.style.padding = ".04em .08em", n.style.pointerEvents = "auto", n.style.cursor = "pointer", n.__sbBaseBackground = L && "rgba(0, 0, 0, 0)" !== L ? L : "transparent", n.__sbBaseColor = n.style.color || "inherit", n.style.backgroundColor = n.__sbBaseBackground, n.onmouseenter = function() {
                                __sbSelecting ? __sbSetSelected(i) : n.style.outline = "1px solid rgba(255,255,255,.65)"
                            }, n.onmouseleave = function() {
                                __sbSelecting || (n.style.outline = "none")
                            }, n.onclick = function(e) {
                                e.preventDefault(), e.stopPropagation(), __sbStartSelection(i) && __sbLookupSelected()
                            }, __sbWords.push(n), t.appendChild(n)
                        })), __sbOverlay.appendChild(t)
                    })), console.log("[SubtitleBridge POC] embedded cue:", e)
                }

`;

replaceSection(
    'desktop word tokenizer and render',
    '                function __sbRender(e) {',
    '                function __sbKeydown(e) {',
    tokenizerAndRender,
);

replaceOnce(
    'phrase context uses normalized lookup terms',
    'var r = __sbWords.map((function(e) { return String(e.textContent || "") })), n = ++__sbTranslationRequestVersion;',
    'var r = __sbWords.map((function(e) { return String(e.__sbLookupTerm || e.textContent || "") })), n = ++__sbTranslationRequestVersion;',
);

fs.writeFileSync(target, source);
console.log('    Applied v1.0.15 desktop-parity word tokenization');
