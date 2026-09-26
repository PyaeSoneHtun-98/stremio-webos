'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(process.argv[2], 'utf8');
assert(source.includes('__subtitleBridgePOCv117'), 'v1.0.17 marker missing');
const start = source.indexOf('var __sbMkvRequest = null');
const end = source.indexOf('function __sbSetSelected(e) {', start);
assert(start >= 0 && end > start, 'request lifecycle block missing');

const requests = [];
class FakeXHR {
    constructor() { this.readyState = 0; this.status = 0; this.aborted = false; requests.push(this); }
    open(method, url) { this.method = method; this.url = url; }
    send() {}
    abort() { this.aborted = true; if (this.onabort) this.onabort(); }
    complete(body) {
        this.responseText = JSON.stringify(body);
        this.status = 200;
        this.readyState = 4;
        if (this.onreadystatechange) this.onreadystatechange();
    }
}
const context = vm.createContext({
    XMLHttpRequest: FakeXHR,
    Promise,
    Date,
    D: { url: 'http://127.0.0.1:11470/stream' },
    A: { currentTime: 100 },
    y: [{}], p: 'EMBEDDED_2', m: false, __sbSelecting: false,
    __sbFallbackCues: [], __sbFallbackKey: '', __sbFallbackRequestKey: '',
    __sbFallbackStart: 0, __sbFallbackEnd: 0, __sbFallbackLoading: false,
    __sbFallbackReady: false, __sbFallbackError: '', __sbFallbackMethod: 'idle',
    __sbFallbackRetryAt: 0, __sbFallbackTrackNumber: null,
    __sbFallbackCodec: '', __sbNativeCueText: '', __sbCueSource: 'none',
    __sbTrackIndex: () => 2,
    __sbSetNativeSubtitleEnabled: () => {},
    __sbMaybeStartPendingSelection: () => {},
    U: () => {},
});
vm.runInContext(source.slice(start, end), context);

async function flush() { await new Promise(resolve => setImmediate(resolve)); }
async function main() {
    vm.runInContext('__sbEnsureFallback()', context);
    assert.strictEqual(requests.length, 1);
    assert(requests[0].url.includes('/mkv-active-cue'));
    assert(requests[0].url.includes('time=100.000'));
    context.A.currentTime = 900;
    vm.runInContext('__sbEnsureFallback()', context);
    assert(requests[0].aborted, 'distant seek should abort stale XHR');
    assert.strictEqual(requests.length, 2, 'distant seek should dispatch immediately');
    assert(requests[1].url.includes('time=900.000'));
    requests[1].complete({
        cues: [{ startTime: 900, endTime: 902, text: 'current cue' }],
        window: [900, 901], trackNumber: 5, codec: 'S_TEXT/ASS', method: 'active-indexed',
    });
    await flush();
    assert.strictEqual(context.__sbFallbackCues[0].text, 'current cue');
    assert.strictEqual(context.__sbFallbackMethod, 'active-indexed');
    assert.strictEqual(context.__sbFallbackTrackNumber, 5);
    assert.strictEqual(context.__sbFallbackLoading, true, 'surrounding window may keep loading after active cue is ready');
    assert.strictEqual(requests.length, 3);
    assert(requests[2].url.includes('/mkv-cues'));
    requests[2].complete({
        cues: [{ startTime: 900, endTime: 902, text: 'current cue' }, { startTime: 904, endTime: 906, text: 'next cue' }],
        window: [898, 907], trackNumber: 5, codec: 'S_TEXT/ASS', method: 'indexed',
    });
    await flush();
    assert.strictEqual(context.__sbFallbackMethod, 'indexed');
    assert.strictEqual(context.__sbFallbackLoading, false);
    context.A.currentTime = 100;
    vm.runInContext('__sbEnsureFallback()', context);
    assert.strictEqual(requests.length, 4, 'backward seek should dispatch a new request');
    requests[3].complete({
        cues: [{ startTime: 100, endTime: 102, text: 'previous area' }],
        window: [100, 101], trackNumber: 5, codec: 'S_TEXT/ASS', method: 'active-indexed',
    });
    await flush();
    assert.strictEqual(requests.length, 5, 'active cue should start its surrounding window');
    context.A.currentTime = 2000;
    vm.runInContext('__sbEnsureFallback()', context);
    assert(requests[4].aborted, 'a second seek should abort an obsolete surrounding window');
    assert.strictEqual(requests.length, 6);
    requests[4].complete({ cues: [{ startTime: 100, endTime: 102, text: 'stale cue' }], window: [98, 107] });
    await flush();
    assert.notStrictEqual(context.__sbFallbackCues[0].text, 'stale cue');
    vm.runInContext('__sbResetFallback(false)', context);
    assert(requests[5].aborted, 'track or stream reset should abort active extraction');
    await flush();
    assert.strictEqual(context.__sbFallbackCues.length, 0);
    console.log('PASS: final bundle aborts stale MKV work, accepts only current cues, and cancels on reset');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
