'use strict';

var fs = require('fs');
var path = require('path');

var CORE_ENTRIES = [
    {word:'bad',pronunciation:'/bæd/',forms:[],meanings:[{partOfSpeech:'adjective',burmese:['မကောင်းသော']}]},
    {word:'big',pronunciation:'/bɪɡ/',forms:[],meanings:[{partOfSpeech:'adjective',burmese:['ကြီးသော']}]},
    {word:'day',pronunciation:'/deɪ/',forms:['days'],meanings:[{partOfSpeech:'noun',burmese:['နေ့']}]},
    {word:'do',pronunciation:'/du/',forms:['does','did','done','doing'],meanings:[{partOfSpeech:'verb',burmese:['လုပ်သည်']}]},
    {word:'go',pronunciation:'/ɡoʊ/',forms:['goes','went','gone','going'],meanings:[{partOfSpeech:'verb',burmese:['သွားသည်']}]},
    {word:'humiliating',pronunciation:'/hjuˈmɪliˌeɪtɪŋ/',forms:[],meanings:[{partOfSpeech:'adjective',burmese:['အရှက်ရစေသော']}]},
    {word:'love',pronunciation:'/lʌv/',forms:['loves','loved','loving'],meanings:[{partOfSpeech:'verb',burmese:['ချစ်သည်']},{partOfSpeech:'noun',burmese:['ချစ်ခြင်း']}]},
    {word:'man',pronunciation:'/mæn/',forms:['men'],meanings:[{partOfSpeech:'noun',burmese:['အမျိုးသား']}]},
    {word:'new',pronunciation:'/nu/',forms:[],meanings:[{partOfSpeech:'adjective',burmese:['အသစ်']}]},
    {word:'no',pronunciation:'/noʊ/',forms:[],meanings:[{partOfSpeech:'interjection',burmese:['မဟုတ်ပါ']}]},
    {word:'run',pronunciation:'/rʌn/',forms:['runs','ran','running'],meanings:[{partOfSpeech:'verb',burmese:['ပြေးသည်','လည်ပတ်သည်','စီမံခန့်ခွဲသည်']}]},
    {word:'say',pronunciation:'/seɪ/',forms:['says','said','saying'],meanings:[{partOfSpeech:'verb',burmese:['ပြောသည်']}]},
    {word:'see',pronunciation:'/si/',forms:['sees','saw','seen','seeing'],meanings:[{partOfSpeech:'verb',burmese:['မြင်သည်']}]},
    {word:'thanks',pronunciation:'/θæŋks/',forms:[],meanings:[{partOfSpeech:'interjection',burmese:['ကျေးဇူးတင်ပါတယ်']}]},
    {word:'wait',pronunciation:'/weɪt/',forms:['waits','waited','waiting'],meanings:[{partOfSpeech:'verb',burmese:['စောင့်သည်']}]},
    {word:'yes',pronunciation:'/jɛs/',forms:[],meanings:[{partOfSpeech:'interjection',burmese:['ဟုတ်ကဲ့']}]}
];

var LEGACY_ALIASES = {
    child:['children'], father:['fathers'], friend:['friends'], lifespan:['lifespans'],
    mother:['mothers'], night:['nights'], sign:['signed','signing'], sister:['sisters'],
    time:['times'], woman:['women']
};

var singleton = null;

function normalize(value) {
    value = String(value == null ? '' : value);
    try { value = value.normalize('NFKC'); } catch (_) {}
    return value.trim().toLowerCase();
}

function normalizePhraseToken(value) {
    return normalize(value).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

function normalizePhrase(value) {
    return normalize(value).split(/\s+/).map(normalizePhraseToken).filter(Boolean).join(' ');
}

function phraseTypeLabel(type) {
    if (type === 'phrasal_verb') return 'Phrasal verb';
    if (type === 'idiom') return 'Idiom';
    if (type === 'expression') return 'Expression';
    return String(type || 'Phrase');
}

function createProvider(dictionaryDataset, phraseDataset, coreEntries, aliases) {
    var entries = (dictionaryDataset && Array.isArray(dictionaryDataset.entries) ? dictionaryDataset.entries : []).slice();
    (coreEntries || []).forEach(function(entry) { entries.push(entry); });

    var exact = Object.create(null), index = Object.create(null), phraseVariants = Object.create(null), maxPhraseTokens = 0;

    entries.forEach(function(entry) {
        var key = normalize(entry.word);
        if (key && !exact[key]) { exact[key] = entry; index[key] = entry; }
    });

    entries.forEach(function(entry) {
        (entry.forms || []).forEach(function(form) {
            var key = normalize(form);
            if (key && !index[key]) index[key] = entry;
        });
    });

    Object.keys(aliases || {}).forEach(function(headword) {
        var entry = exact[normalize(headword)];
        if (!entry) return;
        aliases[headword].forEach(function(alias) {
            var key = normalize(alias);
            if (key && !index[key]) index[key] = entry;
        });
    });

    var phraseEntries = phraseDataset && Array.isArray(phraseDataset.entries) ? phraseDataset.entries : [];
    phraseEntries.forEach(function(entry) {
        [entry.phrase].concat(entry.forms || []).forEach(function(raw) {
            var variant = normalizePhrase(raw);
            if (!variant) return;
            var count = variant.split(' ').length;
            if (count < 2) return;
            if (!phraseVariants[variant]) phraseVariants[variant] = { entry: entry, tokenCount: count };
            if (count > maxPhraseTokens) maxPhraseTokens = count;
        });
    });

    function matchPhrase(tokens, clickedTokenIndex) {
        if (!Array.isArray(tokens) || clickedTokenIndex < 0 || clickedTokenIndex >= tokens.length || maxPhraseTokens < 2) return null;
        var normalizedTokens = tokens.map(normalizePhraseToken), best = null, bestStart = -1, bestEnd = -1;
        var earliestStart = Math.max(0, clickedTokenIndex - maxPhraseTokens + 1);
        for (var start = earliestStart; start <= clickedTokenIndex; start++) {
            var latestEnd = Math.min(tokens.length, start + maxPhraseTokens);
            for (var end = clickedTokenIndex + 1; end <= latestEnd; end++) {
                var tokenCount = end - start;
                if (tokenCount < 2 || (best && tokenCount < best.tokenCount)) continue;
                var slice = normalizedTokens.slice(start, end);
                if (slice.some(function(token) { return !token; })) continue;
                var candidate = phraseVariants[slice.join(' ')];
                if (!candidate) continue;
                if (!best || candidate.tokenCount > best.tokenCount || (candidate.tokenCount === best.tokenCount && start < bestStart)) {
                    best = candidate; bestStart = start; bestEnd = end;
                }
            }
        }
        if (!best) return null;
        return {
            entry: best.entry,
            match: {
                source: normalizedTokens.slice(bestStart, bestEnd).join(' '),
                startTokenIndex: bestStart,
                endTokenIndex: bestEnd
            }
        };
    }

    return {
        lookup: function(word, contextTokens, clickedTokenIndex) {
            var originalWord = String(word || '').trim();
            if (!originalWord) return null;

            var phrase = matchPhrase(contextTokens, clickedTokenIndex);
            if (phrase) {
                return {
                    originalWord: originalWord,
                    provider: 'local-dictionary',
                    targetLanguage: 'my',
                    phraseEntry: phrase.entry,
                    phraseMatch: phrase.match,
                    phraseTypeLabel: phraseTypeLabel(phrase.entry.type)
                };
            }

            var lookupWord = normalizePhraseToken(originalWord);
            var entry = index[lookupWord];
            if (!entry) return null;
            return {
                originalWord: originalWord,
                provider: 'local-dictionary',
                targetLanguage: 'my',
                dictionaryEntry: entry,
                pronunciation: entry.pronunciation,
                resolvedFromForm: normalize(entry.word) !== normalize(lookupWord)
            };
        },
        counts: { dictionary: entries.length, phrases: phraseEntries.length }
    };
}

function loadDefaultProvider() {
    if (singleton) return singleton;
    var dictionaryPath = path.join(__dirname, 'data', 'dictionary.json');
    var phrasesPath = path.join(__dirname, 'data', 'phrases.json');
    var dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
    var phrases = JSON.parse(fs.readFileSync(phrasesPath, 'utf8'));
    singleton = createProvider(dictionary, phrases, CORE_ENTRIES, LEGACY_ALIASES);
    return singleton;
}

function lookup(word, contextTokens, clickedTokenIndex) {
    return loadDefaultProvider().lookup(word, contextTokens, clickedTokenIndex);
}

module.exports = {
    lookup: lookup,
    createProvider: createProvider,
    _normalizePhraseToken: normalizePhraseToken,
    _phraseTypeLabel: phraseTypeLabel
};
