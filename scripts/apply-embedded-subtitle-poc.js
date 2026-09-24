'use strict';

const fs = require('fs');

const target = process.argv[2];
if (!target) {
    console.error('Usage: node scripts/apply-embedded-subtitle-poc.js <video.chunk.js>');
    process.exit(2);
}

let source = fs.readFileSync(target, 'utf8');
const marker = 'data-subtitle-bridge-poc';
if (source.includes(marker)) {
    console.log('    Subtitle Bridge embedded cue POC already applied');
    process.exit(0);
}

function replaceOnce(name, before, after) {
    const first = source.indexOf(before);
    if (first === -1) {
        throw new Error(`Subtitle Bridge POC: anchor not found: ${name}`);
    }
    if (source.indexOf(before, first + before.length) !== -1) {
        throw new Error(`Subtitle Bridge POC: anchor is not unique: ${name}`);
    }
    source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
    'webOS timeupdate probe',
    `                }, A.ontimeupdate = function() {\n                    G("time"), G("buffered")\n                }, A.ondurationchange = function() {`,
    `                }, A.ontimeupdate = function() {\n                    G("time"), G("buffered"), U()\n                }, A.ondurationchange = function() {`,
);

replaceOnce(
    'webOS POC state',
    `                }, t.appendChild(A);\n                var k = null,`,
    `                }, t.appendChild(A);\n                var __sbOverlay = document.createElement("div"),\n                    __sbWords = [],\n                    __sbSelected = -1,\n                    __sbSelecting = !1,\n                    __sbWasPaused = !0,\n                    __sbLastCueText = "";\n                __sbOverlay.setAttribute("data-subtitle-bridge-poc", "embedded-cues"), __sbOverlay.style.position = "absolute", __sbOverlay.style.left = "0", __sbOverlay.style.right = "0", __sbOverlay.style.bottom = "0", __sbOverlay.style.zIndex = "6", __sbOverlay.style.textAlign = "center", __sbOverlay.style.pointerEvents = "none", __sbOverlay.style.padding = "0 5vw", __sbOverlay.style.boxSizing = "border-box", __sbOverlay.style.display = "none", t.style.position = t.style.position || "relative", t.appendChild(__sbOverlay), window.__subtitleBridgeWebOSPOC = window.__subtitleBridgeWebOSPOC || {};\n                var k = null,`,
);

replaceOnce(
    'webOS cue renderer',
    `                function U() {\n                    Array.from(A.textTracks).forEach((function(e) {\n                        Array.from(e.cues || []).forEach((function(e) {\n                            e.snapToLines = !1, e.line = 100 - x\n                        }))\n                    }))\n                }`,
    `                function __sbSetSelected(e) {\n                    if (__sbWords.length) {\n                        __sbSelected = Math.max(0, Math.min(__sbWords.length - 1, e)), __sbWords.forEach((function(e, t) {\n                            var r = t === __sbSelected;\n                            e.style.outline = r ? "2px solid rgba(255,255,255,.95)" : "none", e.style.backgroundColor = r ? "rgba(20,20,20,.72)" : e.__sbBaseBackground, e.style.borderRadius = r ? "4px" : "0"\n                        }))\n                    }\n                }\n\n                function __sbStartSelection(e) {\n                    return __sbWords.length ? (__sbSelecting || (__sbWasPaused = !!A.paused, A.paused || A.pause(), __sbSelecting = !0), __sbSetSelected("number" == typeof e ? e : 0), !0) : !1\n                }\n\n                function __sbExitSelection(e) {\n                    __sbSelecting && (__sbSelecting = !1, __sbSelected = -1, __sbWords.forEach((function(e) {\n                        e.style.outline = "none", e.style.backgroundColor = e.__sbBaseBackground, e.style.borderRadius = "0"\n                    })), e && !__sbWasPaused && A.play())\n                }\n\n                function __sbPlainText(e) {\n                    var t = document.createElement("div");\n                    return t.innerHTML = String(e || "").replace(/<br[^>]*>/gi, "\\n"), (t.textContent || t.innerText || "").replace(/\\r/g, "")\n                }\n\n                function __sbRender(e) {\n                    if (__sbOverlay.style.bottom = Math.max(0, Math.min(35, x || 0)) + "%", __sbOverlay.style.color = k || "rgb(255, 255, 255)", __sbOverlay.style.opacity = Math.max(0, Math.min(1, (_ || 100) / 100)), __sbOverlay.style.fontSize = Math.max(2.6, 4 * ((f || 75) / 75)) + "vmin", __sbOverlay.style.fontFamily = "inherit", __sbOverlay.style.fontWeight = "600", __sbOverlay.style.textShadow = "rgb(34, 34, 34) 1px 1px .1em", e === __sbLastCueText && __sbOverlay.childNodes.length) return;\n                    __sbLastCueText = e, __sbOverlay.innerHTML = "", __sbWords = [], __sbSelected = -1;\n                    if (!e) return __sbOverlay.style.display = "none", void 0;\n                    __sbOverlay.style.display = "block", e.split(/\\n+/).forEach((function(e) {\n                        var t = document.createElement("div");\n                        t.style.lineHeight = "1.35", t.style.margin = ".1em 0", e.trim().split(/\\s+/).filter(Boolean).forEach((function(e) {\n                            var r = document.createElement("span"), n = __sbWords.length;\n                            r.textContent = e, r.style.display = "inline-block", r.style.margin = "0 .12em", r.style.padding = ".04em .08em", r.style.pointerEvents = "auto", r.style.cursor = "pointer", r.__sbBaseBackground = L && "rgba(0, 0, 0, 0)" !== L ? L : "transparent", r.style.backgroundColor = r.__sbBaseBackground, r.onmouseenter = function() {\n                                __sbSelecting ? __sbSetSelected(n) : r.style.outline = "1px solid rgba(255,255,255,.65)"\n                            }, r.onmouseleave = function() {\n                                __sbSelecting || (r.style.outline = "none")\n                            }, r.onclick = function(e) {\n                                e.preventDefault(), e.stopPropagation(), __sbStartSelection(n)\n                            }, __sbWords.push(r), t.appendChild(r)\n                        })), __sbOverlay.appendChild(t)\n                    })), console.log("[SubtitleBridge POC] embedded cue:", e)\n                }\n\n                function __sbKeydown(e) {\n                    var t = e.key || "", r = e.keyCode || e.which;\n                    if (!__sbSelecting && ("ArrowUp" === t || 38 === r)) {\n                        if (!__sbStartSelection(0)) return;\n                        return e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), void 0\n                    }\n                    if (__sbSelecting) {\n                        if ("ArrowLeft" === t || 37 === r) __sbSetSelected(__sbSelected - 1);\n                        else if ("ArrowRight" === t || 39 === r) __sbSetSelected(__sbSelected + 1);\n                        else if ("ArrowUp" === t || 38 === r) __sbSetSelected(0);\n                        else if (!("ArrowDown" === t || 40 === r)) {\n                            if (!("Escape" === t || "Backspace" === t || 27 === r || 461 === r)) return;\n                            __sbExitSelection(!0)\n                        }\n                        e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation()\n                    }\n                }\n                window.addEventListener("keydown", __sbKeydown, !0);\n\n                function U() {\n                    var e = A.textTracks ? Array.from(A.textTracks) : [], t = null, r = -1;\n                    "string" == typeof p && 0 === p.indexOf("EMBEDDED_") && (r = parseInt(p.replace("EMBEDDED_", ""), 10)), r >= 0 && r < e.length && (t = e[r]), t || e.some((function(e) {\n                        return "showing" === e.mode || "hidden" === e.mode ? (t = e, !0) : !1\n                    })), t || e.length && (t = e[0]);\n                    var n = [];\n                    e.forEach((function(e) {\n                        Array.from(e.cues || []).forEach((function(e) {\n                            e.snapToLines = !1, e.line = 100 - x\n                        }))\n                    })), t && !m && (n = Array.from(t.activeCues || []), n.length || (n = Array.from(t.cues || []).filter((function(e) {\n                        return isFinite(e.startTime) && isFinite(e.endTime) && e.startTime <= A.currentTime && A.currentTime <= e.endTime\n                    }))));\n                    var i = n.map((function(e) {\n                        return __sbPlainText(e.text)\n                    })).filter(Boolean).join("\\n");\n                    window.__subtitleBridgeWebOSPOC = {\n                        textTrackCount: e.length,\n                        activeCueCount: n.length,\n                        selectedEmbeddedTrackId: p,\n                        cueText: i,\n                        selecting: __sbSelecting\n                    }, __sbRender(i)\n                }`,
);

replaceOnce(
    'webOS unload cleanup',
    `                        case "unload":\n                            D = null, C = null, Array.from(A.textTracks).forEach((function(e) {`,
    `                        case "unload":\n                            __sbExitSelection(!1), __sbRender(""), D = null, C = null, Array.from(A.textTracks).forEach((function(e) {`,
);

replaceOnce(
    'webOS destroy cleanup',
    `A.onratechange = null, A.textTracks.onchange = null, t.removeChild(A), t.removeChild(S)`,
    `A.onratechange = null, A.textTracks.onchange = null, window.removeEventListener("keydown", __sbKeydown, !0), __sbOverlay.parentNode === t && t.removeChild(__sbOverlay), t.removeChild(A), t.removeChild(S)`,
);

fs.writeFileSync(target, source);
console.log('    Applied Subtitle Bridge embedded subtitle cue POC');
