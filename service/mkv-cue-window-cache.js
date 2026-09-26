'use strict';

function createMkvCueWindowCache(extractWindow, options) {
    options = options || {};
    var maxEntries = options.maxEntries || 2048;
    var maxBytes = options.maxBytes || 4 * 1024 * 1024;
    var ttlMs = options.ttlMs || 4 * 60 * 60 * 1000;
    var bucketSeconds = options.bucketSeconds || 20;
    var cache = Object.create(null), coverage = Object.create(null);
    var inflight = Object.create(null), prefetches = Object.create(null);
    var activeMediaUrl = null, totalBytes = 0;
    var counters = { hits:0, misses:0, shared:0, evictions:0, mediaClears:0, cancelled:0, prefetches:0 };

    function trackKey(mediaUrl, trackOrdinal) { return mediaUrl + '\n' + trackOrdinal; }
    function key(mediaUrl, trackOrdinal, time) { return trackKey(mediaUrl, trackOrdinal) + '\n' + Math.floor(Math.max(0, time) / bucketSeconds); }
    function createContext() { return { cancelled:false, requests:[], cancel:function() {
        if (this.cancelled) return;
        this.cancelled = true; counters.cancelled++;
        this.requests.slice().forEach(function(request) { request.destroy(new Error('Subtitle request cancelled')); });
    } }; }
    function estimateBytes(cacheKey, result) {
        var body; try { body = JSON.stringify(result); } catch (_) { body = ''; }
        return Buffer.byteLength(cacheKey, 'utf8') + Buffer.byteLength(body, 'utf8') + 192;
    }
    function remove(cacheKey, eviction) {
        var entry = cache[cacheKey]; if (!entry) return;
        delete cache[cacheKey]; totalBytes = Math.max(0, totalBytes - entry.bytes);
        (entry.coverageKeys||[]).forEach(function(coverageKey){
            var list=coverage[coverageKey]; if(!list)return;
            var i=list.indexOf(cacheKey);if(i>=0)list.splice(i,1);if(!list.length)delete coverage[coverageKey];
        });
        if (eviction) counters.evictions++;
    }
    function cancelMap(map) { Object.keys(map).forEach(function(k) { var item=map[k]; if (item && item.context) item.context.cancel(); }); }
    function activate(mediaUrl) {
        if (!mediaUrl || activeMediaUrl === mediaUrl) return false;
        if (activeMediaUrl !== null) {
            cancelMap(prefetches); cancelMap(inflight);
            Object.keys(cache).forEach(function(k) { remove(k, false); });
            inflight = Object.create(null); prefetches = Object.create(null); counters.mediaClears++;
        }
        activeMediaUrl = mediaUrl; return true;
    }
    function prune() {
        var now=Date.now();
        Object.keys(cache).forEach(function(k) { if (now-cache[k].at > ttlMs) remove(k, true); });
        var keys=Object.keys(cache); if (keys.length <= maxEntries && totalBytes <= maxBytes) return;
        keys.sort(function(a,b) { return cache[a].at-cache[b].at; });
        while (keys.length && (keys.length > maxEntries || totalBytes > maxBytes)) remove(keys.shift(), true);
    }
    function findCovering(mediaUrl, trackOrdinal, time) {
        if (activeMediaUrl && activeMediaUrl !== mediaUrl) return null;
        var now=Date.now(), coverageKey=trackKey(mediaUrl,trackOrdinal)+'\n'+Math.floor(Math.max(0,time)/bucketSeconds);
        var list=(coverage[coverageKey]||[]).slice();
        for (var i=list.length-1;i>=0;i--) {
            var entry=cache[list[i]]; if (!entry) continue;
            if (now-entry.at > ttlMs) { remove(list[i], true); continue; }
            var window=entry.result && entry.result.window;
            if (Array.isArray(window) && Number(window[0]) <= time && time <= Number(window[1])) { entry.at=now; counters.hits++; return entry.result; }
        }
        return null;
    }
    function remember(cacheKey, mediaUrl, trackOrdinal, result) {
        if (activeMediaUrl !== mediaUrl) return;
        remove(cacheKey, false);
        var tKey=trackKey(mediaUrl,trackOrdinal);
        var window=result&&result.window,start=Array.isArray(window)?Math.floor(Math.max(0,Number(window[0])||0)/bucketSeconds):0;
        var end=Array.isArray(window)?Math.floor(Math.max(0,Number(window[1])||0)/bucketSeconds):start;
        end=Math.min(end,start+32);
        var coverageKeys=[];for(var bucket=start;bucket<=end;bucket++)coverageKeys.push(tKey+'\n'+bucket);
        var entry={at:Date.now(),mediaUrl:mediaUrl,trackOrdinal:trackOrdinal,trackKey:tKey,coverageKeys:coverageKeys,result:result,bytes:estimateBytes(cacheKey,result)};
        cache[cacheKey]=entry; totalBytes+=entry.bytes;
        coverageKeys.forEach(function(coverageKey){(coverage[coverageKey]||(coverage[coverageKey]=[])).push(cacheKey);});prune();
    }
    function load(mediaUrl, trackOrdinal, time, loadOptions) {
        time=Math.max(0,Number(time)||0); loadOptions=loadOptions||{}; activate(mediaUrl);
        var covering=loadOptions.forceNew?null:findCovering(mediaUrl,trackOrdinal,time);
        if (covering) return Promise.resolve({result:covering,cache:'hit'});
        var cacheKey=key(mediaUrl,trackOrdinal,time);
        if (!loadOptions.context && inflight[cacheKey]) { counters.shared++; return inflight[cacheKey].promise.then(function(result){return {result:result,cache:'shared'};}); }
        counters.misses++;
        var context=loadOptions.context||createContext();
        var promise=Promise.resolve().then(function(){return extractWindow(mediaUrl,trackOrdinal,time,context);}).then(function(result){
            if(context.cancelled) throw new Error('Subtitle request cancelled');
            remember(cacheKey,mediaUrl,trackOrdinal,result); if(!loadOptions.context) delete inflight[cacheKey]; return result;
        },function(error){if(!loadOptions.context) delete inflight[cacheKey]; throw error;});
        if(!loadOptions.context) inflight[cacheKey]={promise:promise,context:context};
        return promise.then(function(result){return {result:result,cache:'miss'};});
    }
    function prefetchNext(mediaUrl,trackOrdinal,requestedTime,result) {
        if(activeMediaUrl!==mediaUrl) return Promise.resolve(null);
        var window=result&&result.window; if(!Array.isArray(window)||!isFinite(Number(window[1]))) return Promise.resolve(null);
        var nextTime=Number(window[1])+2; if(!(nextTime>Number(requestedTime)+8)) return Promise.resolve(null);
        var tKey=trackKey(mediaUrl,trackOrdinal), current=prefetches[tKey];
        if(current&&Math.abs(current.time-nextTime)<8) return current.promise; if(current) current.context.cancel();
        counters.prefetches++; var context=createContext();
        var promise=load(mediaUrl,trackOrdinal,nextTime,{context:context}).then(function(packet){return packet.result;},function(){return null;});
        prefetches[tKey]={time:nextTime,context:context,promise:promise};
        promise.then(function(){if(prefetches[tKey]&&prefetches[tKey].promise===promise) delete prefetches[tKey];}); return promise;
    }
    function cancelDistantPrefetch(mediaUrl,trackOrdinal,time) { var tKey=trackKey(mediaUrl,trackOrdinal), current=prefetches[tKey]; if(current&&Math.abs(current.time-time)>30){current.context.cancel();delete prefetches[tKey];} }
    function clear() { cancelMap(prefetches);cancelMap(inflight);cache=Object.create(null);coverage=Object.create(null);inflight=Object.create(null);prefetches=Object.create(null);totalBytes=0;activeMediaUrl=null; }
    function stats(){return {entries:Object.keys(cache).length,estimatedBytes:totalBytes,maxEntries:maxEntries,maxBytes:maxBytes,inflight:Object.keys(inflight).length,prefetchesActive:Object.keys(prefetches).length,activeMedia:!!activeMediaUrl,hits:counters.hits,misses:counters.misses,shared:counters.shared,evictions:counters.evictions,mediaClears:counters.mediaClears,cancelled:counters.cancelled,prefetches:counters.prefetches};}
    return {load:load,peek:findCovering,activate:activate,prefetchNext:prefetchNext,cancelDistantPrefetch:cancelDistantPrefetch,clear:clear,stats:stats,_entryCount:function(){return Object.keys(cache).length;},_inflightCount:function(){return Object.keys(inflight).length;}};
}

module.exports = { createMkvCueWindowCache: createMkvCueWindowCache };
