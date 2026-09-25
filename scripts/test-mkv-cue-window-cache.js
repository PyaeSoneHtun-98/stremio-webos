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
    const cache = cacheModule.createMkvCueWindowCache(fakeExtract, { maxEntries: 4, ttlMs: 60000, bucketSeconds: 20 });

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

    console.log('PASS: MKV cue cache deduplicates in-flight extraction, reuses windows, prefetches ahead, and stays bounded');
}
main().catch(function(error) { console.error(error); process.exitCode = 1; });
