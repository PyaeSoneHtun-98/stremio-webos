'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync(process.argv[2], 'utf8');
assert(source.includes('__subtitleBridgePOCv115'), 'v1.0.15 tokenizer marker missing');

const start = source.indexOf('function __sbTokenizeSubtitleText(e)');
const end = source.indexOf('function __sbRender(e)', start);
assert(start >= 0 && end > start, 'desktop-parity tokenizer function missing');

const code = source.slice(start, end) + '\nthis.tokenize = __sbTokenizeSubtitleText;';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function inspect(text) {
  const segments = sandbox.tokenize(text);
  return {
    rebuilt: segments.map((segment) => segment.text).join(''),
    words: segments.filter((segment) => segment.kind === 'word').map((segment) => segment.text),
    lookup: segments.filter((segment) => segment.kind === 'word').map((segment) => segment.lookupTerm),
    text: segments.filter((segment) => segment.kind === 'text').map((segment) => segment.text)
  };
}

let result = inspect('die? !');
assert.strictEqual(result.rebuilt, 'die? !');
assert.deepStrictEqual(Array.from(result.words), ['die']);
assert(result.text.join('').includes('? !'), 'punctuation must remain visible as non-selectable text');

result = inspect("We're ready!");
assert.strictEqual(result.rebuilt, "We're ready!");
assert.deepStrictEqual(Array.from(result.words), ["We're", 'ready']);
assert.deepStrictEqual(Array.from(result.lookup), ["we're", 'ready']);

result = inspect('can’t stop.');
assert.strictEqual(result.rebuilt, 'can’t stop.');
assert.deepStrictEqual(Array.from(result.words), ['can’t', 'stop']);

result = inspect('123 H264 1080p hello');
assert.strictEqual(result.rebuilt, '123 H264 1080p hello');
assert.deepStrictEqual(Array.from(result.words), ['H264', '1080p', 'hello']);

result = inspect('...!?');
assert.strictEqual(result.rebuilt, '...!?');
assert.deepStrictEqual(Array.from(result.words), []);

assert(source.includes('e.__sbLookupTerm || e.textContent'), 'phrase context must use normalized lookup terms');
assert(source.includes('r.style.pointerEvents = "none"'), 'punctuation/text segments must not be pointer targets');

console.log('PASS: desktop-parity subtitle tokenizer keeps punctuation visible but selects only dictionary words');
