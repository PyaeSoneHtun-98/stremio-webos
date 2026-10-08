'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dictionary = require(process.argv[3] ? path.resolve(process.argv[3]) : '../service/dictionary-provider');

const dataDir = process.argv[2] || path.join(__dirname, '..', 'service', 'data');
const dictionaryPath = path.join(dataDir, 'dictionary.json');
const phrasesPath = path.join(dataDir, 'phrases.json');
assert(fs.existsSync(dictionaryPath) && fs.existsSync(phrasesPath), 'built dictionary datasets are required');
if (global.gc) global.gc();
const before=process.memoryUsage();
const started=process.hrtime.bigint();
let dictionaryText=fs.readFileSync(dictionaryPath,'utf8');
let phrasesText=fs.readFileSync(phrasesPath,'utf8');
const dictionaryData=JSON.parse(dictionaryText), phraseData=JSON.parse(phrasesText);
dictionaryText=null; phrasesText=null;
const provider=dictionary.createProvider(dictionaryData,phraseData,[],{});
if (global.gc) global.gc();
const initialized=process.hrtime.bigint();
for(let i=0;i<100000;i++) provider.lookup(i%2?'challenge':'love',['come','up','with','love'],3);
const finished=process.hrtime.bigint();
const after=process.memoryUsage();
const report={dictionaryEntries:provider.counts.dictionary,phraseEntries:provider.counts.phrases,
    dictionaryKeys:provider.counts.dictionaryKeys,phraseVariants:provider.counts.phraseVariants,
    initializationMs:Number(initialized-started)/1e6,lookup100kMs:Number(finished-initialized)/1e6,
    heapDeltaBytes:Math.max(0,after.heapUsed-before.heapUsed),rssDeltaBytes:Math.max(0,after.rss-before.rss),
    datasetBytes:fs.statSync(dictionaryPath).size+fs.statSync(phrasesPath).size};
assert(report.dictionaryEntries>=30000,'dictionary coverage regressed');
assert(report.phraseEntries>=1000,'phrase coverage regressed');
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
console.log('PASS: dictionary coverage/performance/memory bounds and dead extraction removal');
