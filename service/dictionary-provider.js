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
var defaultStats = { loaded:false, initializationMs:0, heapDeltaBytes:0, dictionaryFileBytes:0, phraseFileBytes:0 };

function normalize(value) {
    value = String(value == null ? '' : value);
    try { value = value.normalize('NFKC'); } catch (_) {}
    return value.trim().toLowerCase();
}

function normalizePhraseToken(value) {
    return normalize(value).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

function normalizePhrase(value) {
    // Match the word boundaries of the desktop/player subtitle tokenizer.
    // "went pear-shaped" has three selectable words, not two.
    var source = String(value == null ? '' : value);
    var pieces;
    try { pieces = source.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []; }
    catch (_) { pieces = source.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g) || []; }
    return pieces.filter(function(piece) {
        try { return /\p{L}/u.test(piece); } catch (_) { return /[A-Za-z]/.test(piece); }
    }).map(normalizePhraseToken).filter(Boolean).join(' ');
}

function phraseTypeLabel(type) {
    if (type === 'phrasal_verb') return 'Phrasal verb';
    if (type === 'idiom') return 'Idiom';
    if (type === 'expression') return 'Expression';
    return String(type || 'Phrase');
}

function createProvider(dictionaryDataset, phraseDataset, coreEntries, aliases, dictionaryExtension, phraseExtension, correctionDataset) {
    var dictionaryEntries = dictionaryDataset && Array.isArray(dictionaryDataset.entries) ? dictionaryDataset.entries : [];
    var rawExtension = dictionaryExtension && Array.isArray(dictionaryExtension.entries) ? dictionaryExtension.entries : [];
    var corrections = correctionDataset && Array.isArray(correctionDataset.entries) ? correctionDataset.entries : [];
    var rawByWord = Object.create(null), correctionByWord = Object.create(null);
    var baseHeads = Object.create(null), extensionHeads = Object.create(null);
    dictionaryEntries.forEach(function(entry) { baseHeads[normalize(entry.word)] = true; });
    rawExtension.forEach(function(entry) {
        var key = normalize(entry.word);
        if (!key || baseHeads[key] || rawByWord[key]) throw new Error('Dictionary extension headword collision: ' + key);
        rawByWord[key] = entry;
        extensionHeads[key] = true;
    });
    corrections.forEach(function(entry) {
        var key = normalize(entry.word);
        if (!rawByWord[key] || correctionByWord[key]) throw new Error('Invalid dictionary correction target: ' + key);
        var storedForms = (entry.forms || []).map(normalize);
        if ((rawByWord[key].forms || []).some(function(form) { return storedForms.indexOf(normalize(form)) === -1; })) {
            throw new Error('Dictionary correction loses an original form: ' + key);
        }
        correctionByWord[key] = entry;
    });
    var extensionEntries = rawExtension.map(function(entry) { return correctionByWord[normalize(entry.word)] || entry; });
    var reconciledCore = { go:true, love:true, run:true, see:true, wait:true };
    var extraEntries = (coreEntries || []).filter(function(entry) {
        var key = normalize(entry.word);
        if (!extensionHeads[key]) return true;
        if (!reconciledCore[key] || !correctionByWord[key]) throw new Error('Unreviewed core overlap: ' + key);
        return false;
    });
    var index = Object.create(null), phraseVariants = Object.create(null), maxPhraseTokens = 0;

    function eachEntry(callback) {
        dictionaryEntries.forEach(callback);
        extensionEntries.forEach(callback);
        extraEntries.forEach(callback);
    }
    eachEntry(function(entry) {
        var key = normalize(entry.word);
        if (key && !index[key]) index[key] = entry;
    });

    eachEntry(function(entry) {
        (entry.forms || []).forEach(function(form) {
            var key = normalize(form);
            if (key && !index[key]) index[key] = entry;
        });
    });

    Object.keys(aliases || {}).forEach(function(headword) {
        var entry = index[normalize(headword)];
        if (!entry) return;
        aliases[headword].forEach(function(alias) {
            var key = normalize(alias);
            if (key && !index[key]) index[key] = entry;
        });
    });

    var phraseEntries = phraseDataset && Array.isArray(phraseDataset.entries) ? phraseDataset.entries.slice() : [];
    if (phraseExtension && Array.isArray(phraseExtension.entries)) {
        Array.prototype.push.apply(phraseEntries, phraseExtension.entries);
    }
    phraseEntries.forEach(function(entry) {
        [entry.phrase].concat(entry.forms || []).forEach(function(raw) {
            var variant = normalizePhrase(raw);
            if (!variant) return;
            var count = variant.split(' ').length;
            if (count < 2) return;
            if (phraseVariants[variant] && phraseVariants[variant].entry !== entry) {
                throw new Error('Phrase variant collision: ' + variant);
            }
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
        counts: { dictionary: dictionaryEntries.length + extensionEntries.length + extraEntries.length, phrases: phraseEntries.length,
            dictionaryKeys: Object.keys(index).length, phraseVariants: Object.keys(phraseVariants).length }
    };
}

function loadDefaultProvider() {
    if (singleton) return singleton;
    var started = Date.now();
    var beforeHeap = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
    var dictionaryPath = path.join(__dirname, 'data', 'dictionary.json');
    var phrasesPath = path.join(__dirname, 'data', 'phrases.json');
    var extensionPath = path.join(__dirname, 'data', 'dictionary-extension.json');
    var correctionPath = path.join(__dirname, 'data', 'dictionary-extension-corrections.json');
    var phraseExtensionPath = path.join(__dirname, 'data', 'phrases-extension.json');
    var dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
    var phrases = JSON.parse(fs.readFileSync(phrasesPath, 'utf8'));
    var extension = JSON.parse(fs.readFileSync(extensionPath, 'utf8'));
    var phraseExtension = JSON.parse(fs.readFileSync(phraseExtensionPath, 'utf8'));
    var corrections = JSON.parse(fs.readFileSync(correctionPath, 'utf8'));
    if (dictionary.version !== 1 || dictionary.entries.length !== 30000 ||
        phrases.version !== 1 || phrases.entries.length !== 3000 ||
        extension.version !== 1 || extension.entries.length !== 10000 ||
        phraseExtension.version !== 1 || phraseExtension.entries.length !== 1000 ||
        corrections.version !== 1 || corrections.entries.length !== 19) {
        throw new Error('Unexpected Subtitle Bridge dictionary corpus');
    }
    singleton = createProvider(dictionary, phrases, CORE_ENTRIES, LEGACY_ALIASES,
        extension, phraseExtension, corrections);
    defaultStats = { loaded:true, initializationMs:Date.now()-started,
        heapDeltaBytes:Math.max(0,(process.memoryUsage ? process.memoryUsage().heapUsed : beforeHeap)-beforeHeap),
        dictionaryFileBytes:fs.statSync(dictionaryPath).size + fs.statSync(extensionPath).size + fs.statSync(correctionPath).size,
        phraseFileBytes:fs.statSync(phrasesPath).size + fs.statSync(phraseExtensionPath).size,
        counts:singleton.counts };
    return singleton;
}

function lookup(word, contextTokens, clickedTokenIndex) {
    return loadDefaultProvider().lookup(word, contextTokens, clickedTokenIndex);
}

module.exports = {
    lookup: lookup,
    createProvider: createProvider,
    getStats: function() { return defaultStats; },
    _normalizePhraseToken: normalizePhraseToken,
    _phraseTypeLabel: phraseTypeLabel
};
