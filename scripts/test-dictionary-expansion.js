'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dictionary = require('../service/dictionary-provider');
const dataDir = path.join(__dirname, '..', 'service', 'data');
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const base = read('dictionary.json');
const phrases = read('phrases.json');
const extension = read('dictionary-extension.json');
const phraseExtension = read('phrases-extension.json');
const corrections = read('dictionary-extension-corrections.json');

assert.strictEqual(base.entries.length, 30000);
assert.strictEqual(extension.entries.length, 10000);
assert.strictEqual(phrases.entries.length, 3000);
assert.strictEqual(phraseExtension.entries.length, 1000);
assert.strictEqual(corrections.entries.length, 19);

const provider = dictionary.createProvider(base, phrases, [], {}, extension, phraseExtension, corrections);
assert.strictEqual(provider.counts.dictionary, 40000);
assert.strictEqual(provider.counts.phrases, 4000);

const corrected = new Map(corrections.entries.map(entry => [entry.word, entry]));
const headByWord = new Map(extension.entries.map(entry => [entry.word, entry]));
let keysTested = 0;
for (const entry of extension.entries) {
    const expected = corrected.get(entry.word) || entry;
    for (const key of [entry.word, ...entry.forms]) {
        const result = provider.lookup(key);
        assert(result && result.dictionaryEntry && result.dictionaryEntry.word === entry.word,
            'Unresolved extension key ' + key + ' for ' + entry.word);
        assert.deepStrictEqual(result.dictionaryEntry.meanings, expected.meanings,
            'Correction or Burmese meaning mismatch at ' + entry.word);
        keysTested++;
    }
}
assert.strictEqual(keysTested, 16361);

const defaultCases = [
    ['go', 'သွားသည်'],
    ['went', 'သွားသည်'],
    ['gone', 'သွားသည်'],
    ['run', 'ပြေးသည်'],
    ['ran', 'စီမံခန့်ခွဲသည်'],
    ['see', 'မြင်သည်'],
    ['seen', 'နားလည်သဘောပေါက်သည်'],
    ['love', 'ချစ်သည်'],
    ['waited', 'စောင့်သည်'],
    ['going', 'သွားသည်'],
    ['running', 'လည်ပတ်သည်'],
    ['can', 'နိုင်သည်'],
    ['die', 'သေဆုံးသည်'],
    ['let', 'ခွင့်ပြုသည်'],
    ['in', 'အထဲ၌'],
    ['lot', 'များပြားသောပမာဏ']
];
for (const [word, burmese] of defaultCases) {
    const found = dictionary.lookup(word);
    assert(found && found.dictionaryEntry &&
        found.dictionaryEntry.meanings.some(group => group.burmese.includes(burmese)),
        'Desktop compatibility lost for ' + word + ': ' + burmese);
}
assert.strictEqual(dictionary.getStats().counts.dictionary, 40011,
    '40K corpus + 11 non-overlapping core headwords must be preserved');
assert.strictEqual(dictionary.getStats().counts.phrases, 4000);

function tokenize(source) {
    const words = String(source).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
    return words.filter(w => /\p{L}/u.test(w)).map(w => w.normalize('NFKC').toLowerCase());
}
let variantsTested = 0, clickedTested = 0;
for (const entry of [...phrases.entries, ...phraseExtension.entries]) {
    for (const surface of [entry.phrase, ...entry.forms]) {
        const tokens = tokenize(surface);
        assert(tokens.length >= 2 && tokens.length <= 5, 'Phrase has invalid selectable-token count: ' + surface);
        for (let clicked = 0; clicked < tokens.length; clicked++) {
            const result = provider.lookup(tokens[clicked], tokens, clicked);
            assert(result && result.phraseEntry && result.phraseEntry.phrase === entry.phrase,
                'Incorrect phrase match for ' + surface + ' at token ' + clicked);
            assert.strictEqual(result.phraseMatch.startTokenIndex, 0);
            assert.strictEqual(result.phraseMatch.endTokenIndex, tokens.length);
            clickedTested++;
        }
        variantsTested++;
    }
}
assert.strictEqual(variantsTested, 11509);

for (const [text, expected] of [
    ['went pear-shaped', 'go pear-shaped'],
    ["bird's-eye view", "bird's-eye view"]
]) {
    const tokens = tokenize(text);
    tokens.forEach((word, index) => {
        const result = dictionary.lookup(word, tokens, index);
        assert(result && result.phraseEntry && result.phraseEntry.phrase === expected,
            'Hyphenated phrase missed in subtitle tokens: ' + text);
    });
}
assert.throws(() => dictionary.createProvider(base, phrases,
    [{word:'tailgater',forms:[],meanings:[]}], {}, extension, phraseExtension, corrections),
    /Unreviewed core overlap/);
assert.throws(() => dictionary.createProvider(base, phrases, [], {}, extension, phraseExtension,
    {version:1,entries:[{word:'not-in-extension',forms:[],meanings:[]}]}),
    /Invalid dictionary correction target/);

console.log('PASS: 40,011 effective headwords, all ' + keysTested +
    ' extension head/form keys, desktop corrections, ' + variantsTested +
    ' phrase variants/' + clickedTested + ' click positions, hyphen matching and overlap guards');
