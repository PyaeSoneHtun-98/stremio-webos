'use strict';
const path=require('path');
const modulePath=process.argv[2]?path.resolve(process.argv[2]):path.join(__dirname,'..','service','mkv-cue-window-cache.js');
const create=require(modulePath).createMkvCueWindowCache;
let calls=0;
const cache=create((media,track,time)=>{calls++;return Promise.resolve({trackNumber:track,codec:'S_TEXT/ASS',window:[time-2,time+7],cues:[{startTime:time,endTime:time+4,text:'A representative subtitle cue '+time}]});},{maxEntries:2048,maxBytes:16*1024*1024,ttlMs:4*60*60*1000,bucketSeconds:20});
(async()=>{
    for(let i=0;i<2048;i++)await cache.load('http://example.test/long.mkv',0,i*20,{forceNew:true});
    const started=process.hrtime.bigint();
    for(let i=0;i<100000;i++)cache.peek('http://example.test/long.mkv',0,(i%2048)*20);
    const elapsed=Number(process.hrtime.bigint()-started)/1e6;
    console.log('CACHE_BENCHMARK '+JSON.stringify({entries:cache._entryCount(),lookups:100000,lookupMs:elapsed,lookupsPerSecond:Math.round(100000/(elapsed/1000)),estimatedBytes:cache.stats?cache.stats().estimatedBytes:null,calls}));
})().catch(error=>{console.error(error);process.exitCode=1;});
