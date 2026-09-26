'use strict';
const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
    const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
    try {
        const page=await browser.newPage();
        await page.route('http://127.0.0.1:11470/**',route=>route.abort());
        await page.evaluate(() => {
            const nativeSetTimeout=window.setTimeout.bind(window),nativeClearTimeout=window.clearTimeout.bind(window);
            const nativeSetInterval=window.setInterval.bind(window),nativeClearInterval=window.clearInterval.bind(window);
            const timeouts=new Set(),intervals=new Set(),listeners=new Map();
            const targetIds=new WeakMap(),fnIds=new WeakMap();let targetId=0,fnId=0;
            function id(map,value,next){if(!map.has(value))map.set(value,next());return map.get(value);}
            window.setTimeout=function(fn,delay,...args){let timer=nativeSetTimeout(()=>{timeouts.delete(timer);fn(...args);},delay);timeouts.add(timer);return timer;};
            window.clearTimeout=function(timer){timeouts.delete(timer);return nativeClearTimeout(timer);};
            window.setInterval=function(fn,delay,...args){const timer=nativeSetInterval(fn,delay,...args);intervals.add(timer);return timer;};
            window.clearInterval=function(timer){intervals.delete(timer);return nativeClearInterval(timer);};
            const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
            EventTarget.prototype.addEventListener=function(type,fn,options){
                if(fn){const capture=typeof options==='boolean'?options:!!(options&&options.capture);const key=id(targetIds,this,()=>++targetId)+'|'+type+'|'+id(fnIds,fn,()=>++fnId)+'|'+capture;listeners.set(key,(listeners.get(key)||0)+1);}
                return add.call(this,type,fn,options);
            };
            EventTarget.prototype.removeEventListener=function(type,fn,options){
                if(fn){const capture=typeof options==='boolean'?options:!!(options&&options.capture);const key=(targetIds.get(this)||0)+'|'+type+'|'+(fnIds.get(fn)||0)+'|'+capture;const count=listeners.get(key)||0;if(count<=1)listeners.delete(key);else listeners.set(key,count-1);}
                return remove.call(this,type,fn,options);
            };
            window.__resourceTracker={snapshot:()=>({listeners:listeners.size,timeouts:timeouts.size,intervals:intervals.size,domNodes:document.getElementsByTagName('*').length}),wait:ms=>new Promise(resolve=>nativeSetTimeout(resolve,ms))};
        });
        await page.addScriptTag({path:path.resolve(process.argv[2])});
        const result=await page.evaluate(async()=>{
            const modules=self.webpackChunkstremio_theater[0][1],cache={};
            function req(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id].call(module.exports,module,module.exports,req);return module.exports;}
            req.g=window;req.nmd=module=>module;req.d=(exports,defs)=>Object.keys(defs).forEach(key=>Object.defineProperty(exports,key,{get:defs[key]}));req.r=exports=>Object.defineProperty(exports,'__esModule',{value:true});
            window.webOS={service:{request(uri,options){window.setTimeout(()=>options.onSuccess&&options.onSuccess({returnValue:true}),0);return{cancel(){}};}}};
            req(3020).set('webOS');const WebOsVideo=req(8803),Player=req(8131)(req(1222)(WebOsVideo));
            async function cycle(index,timeEvents){
                const container=document.createElement('div');document.body.appendChild(container);const player=new Player({containerElement:container});
                WebOsVideo.manifest.props.forEach(propName=>player.dispatch({type:'observeProp',propName}));
                player.dispatch({type:'command',commandName:'load',commandArgs:{platform:'webOS',stream:{url:'http://127.0.0.1:11470/title-'+index+'/0?'},streamingServerURL:'http://127.0.0.1:8080',autoplay:false}});
                const video=container.querySelector('video');Object.defineProperty(video,'mediaId',{configurable:true,value:'media-'+index});
                player.dispatch({type:'setProp',propName:'selectedSubtitlesTrackId',propValue:'EMBEDDED_'+index%3});
                for(let n=0;n<timeEvents;n++){video.currentTime=n*17.3;video.dispatchEvent(new Event('timeupdate'));if(n%25===0)video.dispatchEvent(new Event('seeking'));}
                player.dispatch({type:'setProp',propName:'selectedSubtitlesTrackId',propValue:null});
                player.dispatch({type:'setProp',propName:'selectedExtraSubtitlesTrackId',propValue:index%2?'addon-'+index:null});
                document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true}));
                player.dispatch({type:'command',commandName:'unload'});player.dispatch({type:'command',commandName:'destroy'});container.remove();
                await window.__resourceTracker.wait(5);
            }
            await cycle(0,10);await window.__resourceTracker.wait(20);const baseline=window.__resourceTracker.snapshot();
            let maxDom=baseline.domNodes;
            for(let i=1;i<=40;i++){await cycle(i,i===1?600:30);maxDom=Math.max(maxDom,window.__resourceTracker.snapshot().domNodes);}
            await window.__resourceTracker.wait(50);const final=window.__resourceTracker.snapshot();
            return {baseline,final,maxDom,diagnostics:window.__subtitleBridgePerformance&&window.__subtitleBridgePerformance()};
        });
        assert(result.final.listeners<=result.baseline.listeners+2,'listeners grew across 40 title switches: '+JSON.stringify(result));
        assert(result.final.intervals<=result.baseline.intervals,'intervals leaked across title switches: '+JSON.stringify(result));
        assert(result.final.timeouts<=result.baseline.timeouts+1,'timeouts leaked across title switches: '+JSON.stringify(result));
        assert(result.final.domNodes<=result.baseline.domNodes+4,'DOM nodes leaked across title switches: '+JSON.stringify(result));
        assert(result.maxDom<result.baseline.domNodes+200,'subtitle interaction DOM grew without a bound: '+JSON.stringify(result));
        console.log('BROWSER_RESOURCE '+JSON.stringify(result));
        console.log('PASS: 4h-equivalent cue updates, seeks, track changes, and 40 title switches keep listeners/timers/DOM bounded');
    } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
