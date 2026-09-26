'use strict';

var assert = require('assert');
var dictionary = require('../service/dictionary-provider');

var provider = dictionary.createProvider(
    {
        version: 1,
        entries: [
            {
                word: 'enjoyable',
                pronunciation: '/ɪnˈdʒɔɪəbəl/',
                forms: [],
                meanings: [{ partOfSpeech: 'adjective', burmese: ['ပျော်စရာကောင်းသော', 'နှစ်သက်ဖွယ်ကောင်းသော'] }]
            },
            {
                word: 'challenge',
                pronunciation: '/ˈtʃælɪndʒ/',
                forms: ['challenged', 'challenging'],
                meanings: [{ partOfSpeech: 'verb', burmese: ['စိန်ခေါ်သည်'] }]
            }
        ]
    },
    {
        version: 1,
        entries: [
            { phrase: 'come up with', type: 'phrasal_verb', forms: ['came up with'], burmese: ['စဉ်းစားထုတ်သည်'] },
            { phrase: 'up with', type: 'expression', forms: [], burmese: ['နှင့်အတူ'] }
        ]
    },
    [],
    {}
);

var exact = provider.lookup('enjoyable', ['your','resistance','was','enjoyable'], 3);
assert(exact && exact.dictionaryEntry);
assert.strictEqual(exact.dictionaryEntry.word, 'enjoyable');
assert.strictEqual(exact.dictionaryEntry.meanings[0].partOfSpeech, 'adjective');

var form = provider.lookup('challenging', ['before','challenging','him'], 1);
assert(form && form.dictionaryEntry);
assert.strictEqual(form.dictionaryEntry.word, 'challenge');
assert.strictEqual(form.resolvedFromForm, true);

var phrase = provider.lookup('up', ['at','least','come','up','with','a','plan'], 3);
assert(phrase && phrase.phraseEntry);
assert.strictEqual(phrase.phraseEntry.phrase, 'come up with');
assert.strictEqual(phrase.phraseMatch.source, 'come up with');
assert.strictEqual(phrase.phraseTypeLabel, 'Phrasal verb');

var punctuation = provider.lookup('enjoyable.', ['your','resistance','was','enjoyable.'], 3);
assert(punctuation && punctuation.dictionaryEntry);
assert.strictEqual(punctuation.dictionaryEntry.word, 'enjoyable');

console.log('PASS: desktop-compatible dictionary lookup, forms, punctuation, and longest phrase matching');
