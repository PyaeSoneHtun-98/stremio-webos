'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dictionary = require(process.argv[3] ? path.resolve(process.argv[3]) : '../service/dictionary-provider');

const dataDir = process.argv[2] || path.join(__dirname, '..', 'service', 'data');
const dictionaryPath = path.join(dataDir, 'dictionary.json');
const phrasesPath = path.join(dataDir, 'phrases.json');
const extensionPath = path.join(dataDir, 'dictionary-extension.json');
const phraseExtensionPath = path.join(dataDir, 'phrases-extension.json');
const correctionPath = path.join(dataDir, 'dictionary-extension-corrections.json');
assert([dictionaryPath,phrasesPath,extensionPath,phraseExtensionPath,correctionPath].every(file=>fs.existsSync(file)), 'all five built dictionary datasets are required');
if (global.gc) global.gc();
const before=process.memoryUsage();
const started=process.hrtime.bigint();
let dictionaryText=fs.readFileSync(dictionaryPath,'utf8');
let phrasesText=fs.readFileSync(phrasesPath,'utf8');
let extensionText=fs.readFileSync(extensionPath,'utf8');
let phraseExtensionText=fs.readFileSync(phraseExtensionPath,'utf8');
let correctionText=fs.readFileSync(correctionPath,'utf8');
const dictionaryData=JSON.parse(dictionaryText), phraseData=JSON.parse(phrasesText);
const extensionData=JSON.parse(extensionText), phraseExtensionData=JSON.parse(phraseExtensionText);
const correctionData=JSON.parse(correctionText);
dictionaryText=null; phrasesText=null; extensionText=null; phraseExtensionText=null; correctionText=null;
const provider=dictionary.createProvider(dictionaryData,phraseData,[],{},extensionData,phraseExtensionData,correctionData);
if (global.gc) global.gc();
const initialized=process.hrtime.bigint();
for(let i=0;i<100000;i++) provider.lookup(i%2?'challenge':'love',['come','up','with','love'],3);
const finished=process.hrtime.bigint();
const after=process.memoryUsage();
const report={dictionaryEntries:provider.counts.dictionary,phraseEntries:provider.counts.phrases,
    dictionaryKeys:provider.counts.dictionaryKeys,phraseVariants:provider.counts.phraseVariants,
    initializationMs:Number(initialized-started)/1e6,lookup100kMs:Number(finished-initialized)/1e6,
    heapDeltaBytes:Math.max(0,after.heapUsed-before.heapUsed),rssDeltaBytes:Math.max(0,after.rss-before.rss),
    datasetBytes:[dictionaryPath,phrasesPath,extensionPath,phraseExtensionPath,correctionPath].reduce((sum,file)=>sum+fs.statSync(file).size,0)};
assert.strictEqual(report.dictionaryEntries,40000,'40K dictionary coverage regressed');
assert.strictEqual(report.phraseEntries,4000,'4K phrase coverage regressed');
assert(report.heapDeltaBytes<80*1024*1024,'dictionary runtime exceeds LG memory budget');
assert(report.initializationMs<5000,'dictionary startup is unexpectedly slow');
assert(report.lookup100kMs<5000,'dictionary lookup is unexpectedly slow');
const launch=fs.readFileSync(path.join(__dirname,'..','service','launch.js'),'utf8');
assert(!launch.includes('/subtitle-bridge/embedded.vtt'),'dead FFmpeg embedded endpoint must stay removed');
assert(!launch.includes("require('child_process')"),'subtitle service must not load child_process for dead extraction');
assert(launch.includes('/subtitle-bridge/diagnostics'),'real-TV resource diagnostics endpoint must ship');
assert(launch.includes('maxBytes: 4 * 1024 * 1024'),'MKV window cache must keep its byte ceiling');
const wwwDir=path.join(__dirname,'..','service','www');
if(fs.existsSync(wwwDir)) assert(!fs.readdirSync(wwwDir).some(name=>/\.orig$/.test(name)),'patch backup files must not ship in the app');
console.log('RESOURCE '+JSON.stringify(report));
console.log('PASS: 40K words/4K phrases coverage, resource bounds, and dead extraction removal');
