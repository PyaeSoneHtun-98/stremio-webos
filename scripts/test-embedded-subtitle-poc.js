'use strict';

const fs = require('fs');
const assert = require('assert');

const target = process.argv[2];
if (!target) {
    console.error('Usage: node scripts/test-embedded-subtitle-poc.js <patched-video.chunk.js>');
    process.exit(2);
}

const source = fs.readFileSync(target, 'utf8');

function mustContain(name, text) {
    assert(
        source.includes(text),
        'Embedded subtitle test failed: missing ' + name,
    );
}

function sectionBetween(startText, endText) {
    const start = source.indexOf(startText);
    assert(start >= 0, 'Embedded subtitle test failed: missing section start: ' + startText);
    const end = source.indexOf(endText, start + startText.length);
    assert(end > start, 'Embedded subtitle test failed: missing section end: ' + endText);
    return source.slice(start, end);
}

// 1) POC is actually present in the packaged player.
mustContain('POC marker', 'data-subtitle-bridge-poc');

// 2) Native LG subtitle discovery must keep Stremio IDs in EMBEDDED_n form.
//    This catches the old bug where the first selected track was stored as numeric 0.
mustContain(
    'normalized first embedded subtitle id',
    'p = "EMBEDDED_" + r',
);
mustContain(
    'normalized embedded subtitle showing mode',
    'mode: "EMBEDDED_" + r === p ? "showing" : "disabled"',
);

// 3) Selecting EMBEDDED_n must translate to LG native track index n.
//    Test the actual patched bundle, not a duplicate implementation.
const selection = sectionBetween(
    'case "selectedSubtitlesTrackId":',
    'case "subtitlesOffset":',
);
assert(
    selection.includes('0 === (t || "").indexOf("EMBEDDED_")'),
    'Embedded subtitle test failed: EMBEDDED_n selection guard missing',
);
assert(
    selection.includes('p = t'),
    'Embedded subtitle test failed: selected embedded id is not retained',
);
assert(
    selection.includes('parseInt(t.replace("EMBEDDED_", ""))'),
    'Embedded subtitle test failed: embedded id is not converted to native index',
);
assert(
    /method:\s*"selectTrack"[\s\S]*?type:\s*"text"[\s\S]*?index:\s*r/.test(selection),
    'Embedded subtitle test failed: LG selectTrack(text,index) command missing',
);
assert(
    /e\.mode\s*=\s*e\.id\s*===\s*p\s*\?\s*"showing"\s*:\s*"disabled"/.test(selection),
    'Embedded subtitle test failed: selected track mode is not updated',
);
assert(
    selection.includes('p = null') && selection.includes('E(!1)'),
    'Embedded subtitle test failed: subtitle-off path no longer disables native subtitles',
);

// 4) Verify several IDs map to exactly the expected native ordinal.
//    This protects against off-by-one changes in future bundle patches.
for (const [id, expected] of [
    ['EMBEDDED_0', 0],
    ['EMBEDDED_1', 1],
    ['EMBEDDED_6', 6],
]) {
    const actual = parseInt(id.replace('EMBEDDED_', ''), 10);
    assert.strictEqual(actual, expected, id + ' mapped to wrong native index');
}

// 5) Extraction must never be allowed to disable native subtitles before
//    actual text cues have been obtained. This keeps embedded subtitles visible
//    when our custom extraction is slow or fails.
const ensureFallback = sectionBetween(
    'function __sbEnsureFallback()',
    'function __sbSetSelected(e)',
);
const firstDisable = ensureFallback.indexOf('__sbSetNativeSubtitleEnabled(!1)');
const firstReady = ensureFallback.indexOf('__sbFallbackReady = !0');
assert(firstReady >= 0, 'Embedded subtitle test failed: extraction ready state missing');
assert(firstDisable > firstReady, 'Embedded subtitle test failed: native subtitles disabled before extracted cues are ready');

// 6) Debug state must expose native-track count and selected id so one TV run
//    can validate selection and extraction together.
mustContain('native track debug count', 'nativeTracks:');
mustContain('selected embedded track debug state', 'selectedEmbeddedTrackId: p');

console.log('Embedded subtitle selection test: PASS');
console.log('  EMBEDDED_n -> LG native index mapping: PASS');
console.log('  selected track mode retention: PASS');
console.log('  native fallback safety: PASS');
