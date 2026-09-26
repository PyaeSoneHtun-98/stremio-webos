'use strict';
const assert = require('assert');
const fs = require('fs');
const createLifecycle = require('./webos-subtitle-lifecycle');

const source = fs.readFileSync(process.argv[2], 'utf8');
assert(source.includes('__subtitleBridgePOCv122'));
assert(source.includes('if (!window.__subtitleBridgeDebugVisible) return;'), 'hidden debug work must be gated');
assert(source.includes('__sbMagicPortalRefreshAt = e + 750'), 'pointer portal timer must be throttled');
assert(source.includes('null === __sbExtUiSyncTimer'), 'UI sync timeout must be deduplicated');
assert(source.includes('window.__subtitleBridgePerformance = function()'), 'TV diagnostics hook must ship');
assert(source.includes('window.__subtitleBridgeWebOSPOC.textTrackCount = e.length'), 'time updates must reuse the public state object');
assert(!source.includes('document.addEventListener("pointermove", __sbExtMagicPointerMove'), 'addon must not query layout on every pointer move');
assert(!source.includes('document.addEventListener("mousemove", __sbExtMagicPointerMove'), 'addon mouse compatibility handler must stay idle');

let now = 0, mediaId = '', nextTimer = 0;
const timers = new Map(), calls = [];
function schedule(fn, delay) { const id=++nextTimer; timers.set(id,{fn,delay,next:now+delay}); return id; }
function advance(ms) {
    const end=now+ms;
    while (true) {
        let due=null, dueAt=Infinity;
        for (const [id,timer] of timers) if (timer.next<dueAt) {due=id;dueAt=timer.next;}
        if (dueAt>end) break;
        now=dueAt; const timer=timers.get(due); if (!timer) continue;
        timer.next+=timer.delay; timer.fn();
    }
    now=end;
}
const lifecycle=createLifecycle({mediaId:()=>mediaId,now:()=>now,setInterval:schedule,clearInterval:id=>timers.delete(id),
    request:call=>{calls.push(call);return{cancel(){}};},onError(){},onReset(){},onSourceInfo(){},onCue(){},onSelected(){}});
lifecycle.select('EMBEDDED_2'); lifecycle.start(); mediaId='movie'; advance(100);
calls.find(call=>call.method==='selectTrack').onSuccess({}); advance(100);
calls.find(call=>call.method==='setSubtitleEnable').onSuccess({}); advance(100);
assert.strictEqual(lifecycle.stats().pollDelay,1000,'settled LG lifecycle should poll once per second');
const settledTicks=lifecycle.stats().ticks; advance(60*60*1000);
assert(lifecycle.stats().ticks-settledTicks<=3601,'one-hour stable playback must not retain 100ms polling');
lifecycle.select('EMBEDDED_3');
assert.strictEqual(lifecycle.stats().pollDelay,100,'track changes must immediately restore fast polling');
lifecycle.stop(); assert.strictEqual(timers.size,0,'destroy must remove adaptive timer');

console.log('PASS: hidden debug, pointer/layout idle work, timer dedupe, diagnostics, and adaptive lifecycle polling');
