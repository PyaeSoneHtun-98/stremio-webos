'use strict';

const assert = require('assert');
const cacheModule = require('../service/mkv-cue-window-cache');

let calls = 0;
function fakeExtract(mediaUrl, trackOrdinal, time) {
    calls++;
    return new Promise(function(resolve) {
        setTimeout(function() {
            resolve({
                trackNumber: trackOrdinal + 3,
                codec: 'S_TEXT/ASS',
                cues: [{ startTime: time, endTime: time + 4, text: 'cue ' + calls }],
                window: [Math.max(0, time - 8), time + 32]
            });
        }, 15);
    });
}

async function main() {
    const cache = cacheModule.createMkvCueWindowCache(fakeExtract, { maxEntries: 4, maxBytes: 4096, ttlMs: 60000, bucketSeconds: 20 });

    const both = await Promise.all([
        cache.load('http://example.test/a.mkv', 2, 100),
        cache.load('http://example.test/a.mkv', 2, 101)
    ]);
    assert.strictEqual(calls, 1, 'same in-flight window should be deduplicated');
    assert(['miss','shared'].includes(both[0].cache));
    assert(['miss','shared'].includes(both[1].cache));

    const hit = await cache.load('http://example.test/a.mkv', 2, 110);
    assert.strictEqual(hit.cache, 'hit', 'covered time should use cached cue window');
    assert.strictEqual(calls, 1);

    await cache.prefetchNext('http://example.test/a.mkv', 2, 100, both[0].result);
    assert(calls >= 2, 'next cue window should be prefetched');

    const before = calls;
    const nextHit = await cache.load('http://example.test/a.mkv', 2, 128);
    assert.strictEqual(nextHit.cache, 'hit', 'prefetched next cue window should be immediately reusable');
    assert.strictEqual(calls, before, 'prefetched hit should not start a new extraction');

    for (let i = 0; i < 8; i++) {
        await cache.load('http://example.test/' + i + '.mkv', 0, i * 100);
    }
    assert(cache._entryCount() <= 4, 'cue cache must stay bounded');
    assert(cache.stats().estimatedBytes <= 4096, 'cue cache must obey its byte ceiling');
    assert(cache.stats().mediaClears >= 1, 'movie changes must clear prior cue windows');

    const revisit = cacheModule.createMkvCueWindowCache(fakeExtract, { maxEntries: 64, ttlMs: 4 * 60 * 60 * 1000, bucketSeconds: 20 });
    for (let time = 0; time < 800; time += 20) await revisit.load('http://example.test/long.mkv', 2, time);
    const previousCalls = calls;
    assert.strictEqual((await revisit.load('http://example.test/long.mkv', 2, 0)).cache, 'hit', 'previously visited movie area should remain immediate');
    assert.strictEqual(calls, previousCalls);
    const prefetched = revisit.prefetchNext('http://example.test/long.mkv', 2, 1000, { window: [992, 1032] });
    revisit.cancelDistantPrefetch('http://example.test/long.mkv', 2, 2000);
    assert.strictEqual(await prefetched, null, 'distant seek should cancel stale background prefetch');

    const lifecycle = cacheModule.createMkvCueWindowCache(fakeExtract, { maxEntries: 2048, maxBytes: 1024 * 1024, ttlMs: 4 * 60 * 60 * 1000 });
    await lifecycle.load('http://example.test/episode-1.mkv', 0, 10);
    await lifecycle.load('http://example.test/episode-1.mkv', 1, 20);
    assert.strictEqual(lifecycle.stats().entries, 2);
    await lifecycle.load('http://example.test/episode-2.mkv', 0, 10);
    assert.strictEqual(lifecycle.stats().entries, 1, 'episode switch must discard old stream data');
    assert.strictEqual(lifecycle.peek('http://example.test/episode-1.mkv', 0, 10), null);

    console.log('PASS: MKV cue cache deduplicates, prefetches, retains current-title areas, cancels stale work, and obeys entry/byte/lifecycle bounds');
}
main().catch(function(error) { console.error(error); process.exitCode = 1; });
