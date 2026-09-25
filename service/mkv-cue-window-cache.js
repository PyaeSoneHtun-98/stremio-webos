'use strict';

function createMkvCueWindowCache(extractWindow, options) {
    options = options || {};
    var maxEntries = options.maxEntries || 12;
    var ttlMs = options.ttlMs || 3 * 60 * 1000;
    var bucketSeconds = options.bucketSeconds || 20;
    var cache = Object.create(null);
    var inflight = Object.create(null);

    function key(mediaUrl, trackOrdinal, time) {
        return mediaUrl + '\n' + trackOrdinal + '\n' + Math.floor(Math.max(0, time) / bucketSeconds);
    }

    function prune() {
        var now = Date.now();
        Object.keys(cache).forEach(function(k) {
            if (now - cache[k].at > ttlMs) delete cache[k];
        });
        var keys = Object.keys(cache);
        if (keys.length <= maxEntries) return;
        keys.sort(function(a, b) { return cache[a].at - cache[b].at; });
        while (keys.length > maxEntries) delete cache[keys.shift()];
    }

    function findCovering(mediaUrl, trackOrdinal, time) {
        var now = Date.now(), keys = Object.keys(cache);
        for (var i = 0; i < keys.length; i++) {
            var entry = cache[keys[i]];
            if (!entry || now - entry.at > ttlMs) continue;
            if (entry.mediaUrl !== mediaUrl || entry.trackOrdinal !== trackOrdinal) continue;
            var w = entry.result && entry.result.window;
            if (Array.isArray(w) && Number(w[0]) <= time && time <= Number(w[1])) {
                entry.at = now;
                return entry.result;
            }
        }
        return null;
    }

    function remember(cacheKey, mediaUrl, trackOrdinal, result) {
        cache[cacheKey] = {
            at: Date.now(),
            mediaUrl: mediaUrl,
            trackOrdinal: trackOrdinal,
            result: result
        };
        prune();
    }

    function load(mediaUrl, trackOrdinal, time, options) {
        time = Math.max(0, Number(time) || 0);
        options = options || {};
        var covering = options.forceNew ? null : findCovering(mediaUrl, trackOrdinal, time);
        if (covering) return Promise.resolve({ result: covering, cache: 'hit' });

        var cacheKey = key(mediaUrl, trackOrdinal, time);
        if (inflight[cacheKey]) {
            return inflight[cacheKey].then(function(result) {
                return { result: result, cache: 'shared' };
            });
        }

        var promise = Promise.resolve()
            .then(function() { return extractWindow(mediaUrl, trackOrdinal, time); })
            .then(function(result) {
                remember(cacheKey, mediaUrl, trackOrdinal, result);
                delete inflight[cacheKey];
                return result;
            }, function(error) {
                delete inflight[cacheKey];
                throw error;
            });

        inflight[cacheKey] = promise;
        return promise.then(function(result) { return { result: result, cache: 'miss' }; });
    }

    function prefetchNext(mediaUrl, trackOrdinal, requestedTime, result) {
        var w = result && result.window;
        if (!Array.isArray(w) || !isFinite(Number(w[1]))) return Promise.resolve(null);
        var nextTime = Math.max(Number(requestedTime) + 18, Number(w[1]) - 4);
        if (!(nextTime > Number(requestedTime) + 8)) return Promise.resolve(null);
        return load(mediaUrl, trackOrdinal, nextTime, { forceNew: true }).then(function(packet) {
            return packet.result;
        }, function() {
            return null;
        });
    }

    function clear() {
        cache = Object.create(null);
        inflight = Object.create(null);
    }

    return {
        load: load,
        prefetchNext: prefetchNext,
        clear: clear,
        _entryCount: function() { return Object.keys(cache).length; },
        _inflightCount: function() { return Object.keys(inflight).length; }
    };
}

module.exports = { createMkvCueWindowCache: createMkvCueWindowCache };
