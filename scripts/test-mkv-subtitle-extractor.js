'use strict';
const assert = require('assert');
const http = require('http');
const extractor = require('../service/mkv-subtitle-extractor');

function id(n) { const a=[]; while(n){a.unshift(n&255);n=Math.floor(n/256)} return Buffer.from(a); }
function vint(n) { if(n<0x7f)return Buffer.from([0x80|n]); if(n<0x3fff)return Buffer.from([0x40|((n>>8)&0x3f),n&255]); if(n<0x1fffff)return Buffer.from([0x20|((n>>16)&0x1f),(n>>8)&255,n&255]); return Buffer.from([0x10|((n>>>24)&15),(n>>>16)&255,(n>>>8)&255,n&255]); }
function el(i,data){ return Buffer.concat([id(i),vint(data.length),data]); }
function uint(n,len){ len=len||Math.max(1,Math.ceil(Math.log(n+1)/Math.log(256))); const b=Buffer.alloc(len); for(let i=len-1;i>=0;i--){b[i]=n&255;n=Math.floor(n/256)} return b; }
function track(no,type,codec){ return el(0xAE,Buffer.concat([el(0xD7,uint(no)),el(0x83,uint(type)),el(0x86,Buffer.from(codec)),el(0x22B59C,Buffer.from('eng'))])); }
function block(no,rel,payload){ const tc=Buffer.alloc(2);tc.writeInt16BE(rel,0);return Buffer.concat([Buffer.from([0x80|no]),tc,Buffer.from([0]),Buffer.from(payload)]); }
function cluster(time,rows){ const children=[el(0xE7,uint(time,4))]; for(const row of rows) children.push(el(0xA0,Buffer.concat([el(0xA1,block(5,row.rel,row.text)),el(0x9B,uint(row.dur,2))]))); return el(0x1F43B675,Buffer.concat(children)); }
function cuePoint(time,pos,relative,duration){
  const children=[el(0xF7,uint(relative===null?1:5)),el(0xF1,uint(pos,4))];
  if(relative!==null){ children.push(el(0xF0,uint(relative,4)),el(0xB2,uint(duration,4))); }
  return el(0xBB,Buffer.concat([el(0xB3,uint(time,4)),el(0xB7,Buffer.concat(children))]));
}

function makeFixture(indexed){
  const info=el(0x1549A966,el(0x2AD7B1,uint(1000000,4)));
  const tracks=el(0x1654AE6B,Buffer.concat([track(1,1,'V_MPEG4/ISO/AVC'),track(3,0x11,'S_TEXT/UTF8'),track(4,0x11,'S_TEXT/SSA'),track(5,0x11,'S_TEXT/ASS')]));
  const c1=cluster(359000,[{rel:660,dur:2690,text:'0,0,Default,,0,0,0,,use Sotenkishun on his sword again.'}]);
  const c2=cluster(362000,[{rel:920,dur:2290,text:"1,0,Default,,0,0,0,,Even if it's a future\\Nrewritten by a {\\i1}powerful force{\\i0}"}]);
  const relative1=indexed?el(0xE7,uint(359000,4)).length:null;
  const relative2=indexed?el(0xE7,uint(362000,4)).length:null;
  const dummy=el(0x1C53BB6B,Buffer.concat([cuePoint(359660,0,relative1,2690),cuePoint(362920,0,relative2,2290)]));
  const p1=info.length+tracks.length+dummy.length,p2=p1+c1.length;
  const cues=el(0x1C53BB6B,Buffer.concat([cuePoint(359660,p1,relative1,2690),cuePoint(362920,p2,relative2,2290)]));
  assert.strictEqual(cues.length,dummy.length);
  const segment=el(0x18538067,Buffer.concat([info,tracks,cues,c1,c2]));
  return Buffer.concat([el(0x1A45DFA3,el(0x4282,Buffer.from('matroska'))),segment]);
}

async function main(){
  const indexedFile=makeFixture(true), fallbackFile=makeFixture(false); let rangeRequests=0, transientFailures=0, bytesRead=0, slowBlock=false;
  const server=http.createServer((req,res)=>{
    const file=req.url.startsWith('/indexed')?indexedFile:fallbackFile;
    let start=0,end=file.length-1; const m=/bytes=(\d+)-(\d+)/.exec(req.headers.range||'');
    if(m){
      rangeRequests++;
      if(transientFailures===0){ transientFailures++; res.statusCode=503; return res.end('temporary'); }
      start=Number(m[1]);end=Math.min(Number(m[2]),file.length-1);res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${file.length}`);
    }
    res.setHeader('Content-Length',end-start+1);bytesRead+=end-start+1;
    if(slowBlock && start>300 && end-start<600) return setTimeout(()=>res.end(file.slice(start,end+1)),500);
    res.end(file.slice(start,end+1));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const port=server.address().port;
    const result=await extractor.extractWindow(`http://127.0.0.1:${port}/indexed.mkv`,2,361);
    assert.strictEqual(result.method,'indexed','CueRelativePosition should use direct subtitle block reads');
    assert.strictEqual(result.trackNumber,5,'third text subtitle must map to Matroska TrackNumber 5');
    assert.strictEqual(result.codec,'S_TEXT/ASS');
    assert(result.cues.length>=2);
    assert.strictEqual(result.cues[0].text,'use Sotenkishun on his sword again.');
    assert.strictEqual(result.cues[0].startTime,359.66);
    assert.strictEqual(result.cues[0].endTime,362.35);
    assert.strictEqual(result.cues[1].text,"Even if it's a future\nrewritten by a powerful force");
    assert(rangeRequests>0,'extractor must use HTTP Range requests');
    assert.strictEqual(transientFailures,1,'test must exercise transient Range retry');
    assert(bytesRead<4096,'indexed extraction should not download whole video clusters');
    const active=await extractor.extractActiveCue(`http://127.0.0.1:${port}/indexed.mkv`,2,363);
    assert.strictEqual(active.method,'active-indexed');
    assert.deepStrictEqual(active.cues.map(cue=>cue.text),["Even if it's a future\nrewritten by a powerful force"],'active request should return exact current text without waiting for future cues');
    const activeGap=await extractor.extractActiveCue(`http://127.0.0.1:${port}/indexed.mkv`,2,100);
    assert.deepStrictEqual(activeGap.cues,[],'blank subtitle time should not fetch unrelated blocks');
    const context={cancelled:false,requests:[],cancel(){this.cancelled=true;this.requests.slice().forEach(request=>request.destroy(new Error('Subtitle request cancelled')))}};
    slowBlock=true;
    const pending=extractor.extractActiveCue(`http://127.0.0.1:${port}/indexed.mkv`,2,363,context);
    setTimeout(()=>context.cancel(),30);
    await assert.rejects(pending,/cancelled/,'aborted seek must stop its active HTTP range without retrying');
    slowBlock=false;
    const blank=await extractor.extractWindow(`http://127.0.0.1:${port}/indexed.mkv`,2,100);
    assert.deepStrictEqual(blank.cues,[],'indexed cue gaps should return a cheap empty window');
    const fallback=await extractor.extractWindow(`http://127.0.0.1:${port}/fallback.mkv`,2,361);
    assert.strictEqual(fallback.method,'cluster','files without CueRelativePosition retain cluster fallback');
    assert.strictEqual(fallback.cues[1].text,result.cues[1].text);
    console.log('PASS: indexed subtitle blocks, bounded bytes, transient retry, ASS cleanup, and cluster fallback');
  } finally { server.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
