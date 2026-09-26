'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const create = require('./webos-subtitle-lifecycle');

function setup() {
    let now = 10000, id = '', counter = 0;
    const timers = new Map(), calls = [], cues = [], selected = [], errors = [];
    const lifecycle = create({
        mediaId: () => id, now: () => now,
        setInterval: (fn) => { timers.set(++counter, fn); return counter; },
        clearInterval: (key) => timers.delete(key),
        request: (call) => { calls.push(call); return { cancel: () => { call.cancelled = true; } }; },
        onError: (...args) => errors.push(args), onReset: () => cues.push('RESET'),
        onSourceInfo: () => {}, onCue: (text) => cues.push(text), onSelected: (track) => selected.push(track)
    });
    return { lifecycle, calls, cues, selected, errors, timers,
        id: (value) => { id = value; },
        advance: (ms = 100) => { for (let n = 0; n < ms; n += 100) { now += 100; Array.from(timers.values()).forEach(fn => fn()); } },
        method: (name) => calls.filter(call => call.method === name)
    };
}

// No metadata/timeupdate exists in this harness: first-load progress is timer-driven.
const first = setup();
first.lifecycle.select('EMBEDDED_2'); first.lifecycle.start();
first.advance(500); assert.equal(first.calls.length, 0);
first.id('<invalid mediaId>'); first.advance(); assert.equal(first.calls.length, 0);
first.id('one'); first.advance();
assert.deepEqual(first.calls.map(call => call.method), ['subscribe', 'selectTrack']);
assert.equal(first.calls[1].parameters.index, 2);
first.calls[1].onFailure({ errorText: 'not ready' });
first.advance(300);
assert.equal(first.method('selectTrack').length, 2);
assert.equal(first.method('setSubtitleEnable').length, 0);
first.method('selectTrack')[1].onSuccess({ returnValue: true }); first.advance();
const enable = first.method('setSubtitleEnable')[0];
assert.equal(enable.parameters.enable, true);
enable.onFailure({ errorText: 'pipeline not ready' }); first.advance(300);
first.method('setSubtitleEnable')[1].onSuccess({});
first.advance(10000);
assert.equal(first.method('subscribe').length, 1, 'silence must not cancel a healthy subscription');
assert.equal(first.method('selectTrack').length, 2, 'acknowledged selection must not loop');
first.calls[0].onSuccess({ subtitleData: { subtitleData: 'Hello' } });
first.calls[0].onSuccess({ subtitleData: '' });
assert.deepEqual(first.cues.slice(-2), ['Hello', '']);

// Off supersedes a selection; stale callbacks cannot enable or report the old track.
first.lifecycle.select('EMBEDDED_6');
const oldSelect = first.method('selectTrack').at(-1);
first.lifecycle.select(null);
oldSelect.onSuccess({}); first.advance();
assert.deepEqual(first.selected, ['EMBEDDED_2']);
assert.equal(first.method('setSubtitleEnable').at(-1).parameters.enable, false);
const oldSub = first.calls[0];
first.lifecycle.stop();
assert.equal(first.timers.size, 0); assert(oldSub.cancelled);
const length = first.cues.length;
oldSub.onSuccess({ subtitleData: 'late' }); assert.equal(first.cues.length, length);
first.id('two'); first.lifecycle.start(); first.lifecycle.select('EMBEDDED_1');
assert.equal(first.method('subscribe').at(-1).parameters.mediaId, 'two');
oldSelect.onSuccess({}); assert.deepEqual(first.selected, ['EMBEDDED_2']);

// Failures and missing callbacks cannot flood the service indefinitely.
const failures = setup(); failures.id('fail'); failures.lifecycle.start(); failures.lifecycle.select('EMBEDDED_0');
for (let i = 0; i < 20; i++) {
    failures.method('subscribe').at(-1).onFailure({});
    failures.advance(500);
}
failures.advance(30000);
assert.equal(failures.method('subscribe').length, 8);
assert.equal(failures.method('selectTrack').length, 8);
failures.lifecycle.stop(); assert.equal(failures.timers.size, 0);

// A mediaId change invalidates callbacks even before the next polling tick.
const changed = setup(); changed.id('a'); changed.lifecycle.start(); changed.lifecycle.select('EMBEDDED_2');
const stale = changed.method('selectTrack')[0]; changed.id('b'); stale.onSuccess({});
assert.equal(changed.selected.length, 0); changed.advance();
assert.equal(changed.method('subscribe').length, 2);
assert.equal(changed.method('selectTrack').at(-1).parameters.mediaId, 'b');

const visibility = setup(); visibility.id('visibility'); visibility.lifecycle.start();
visibility.lifecycle.enable(false);
visibility.method('setSubtitleEnable')[0].onSuccess({});
visibility.lifecycle.enable(true);
const staleEnable = visibility.method('setSubtitleEnable').at(-1);
visibility.lifecycle.enable(false);
assert.equal(visibility.method('setSubtitleEnable').at(-1).parameters.enable, false);
staleEnable.onSuccess({});
visibility.method('setSubtitleEnable').at(-1).onSuccess({});
visibility.advance(1000);
assert.equal(visibility.method('setSubtitleEnable').length, 3);

// Execute actual patched key handlers rather than checking their wording.
const source = fs.readFileSync(process.argv[2], 'utf8');
new vm.Script(source);
assert(source.includes(create.toString()), 'tested lifecycle must be the one shipped in the bundle');
assert(!source.includes('"/subtitles.vtt?from=" + encodeURIComponent(D.url)'));
function keyHarness(external) {
    const name = external ? '__sbExtKeydown' : '__sbKeydown';
    const start = source.indexOf('function ' + name + '(e)');
    const end = source.indexOf('window.addEventListener("keydown", ' + name, start);
    let starts = 0, available = true, extractionStarts = 0, status = '';
    const context = {
        Date: { now: () => 10000 }, U: () => {}, __sbLastKey: '',
        __sbSelecting: false, __sbUpPrimedUntil: 0, __sbTranslationOpen: false,
        __sbPendingSelectionUntil: 0, __sbSelectionWaitUntil: 0,
        __sbExtSelecting: false, __sbExtUpPrimedUntil: 0, __sbExtPopupOpen: false,
        __sbStartSelection: () => { starts++; return available; },
        __sbExtStart: () => { starts++; return available; },
        __sbSetStatus: value => { status = value; },
        __sbEnsureFallback: () => { extractionStarts++; },
        __sbToggleDebug: () => {}
    };
    vm.createContext(context); vm.runInContext(source.slice(start, end), context);
    function up(repeat = false) {
        const event = { key: 'ArrowUp', repeat, prevented: false,
            preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} };
        context[name](event); return event.prevented;
    }
    assert.equal(up(), false); assert.equal(starts, 0, 'first Up belongs to Stremio');
    assert.equal(up(true), false); assert.equal(starts, 0, 'held Up is not a second press');
    assert.equal(up(), true); assert.equal(starts, 1);
    available = false;
    assert.equal(up(), false);
    if (external) {
        assert.equal(up(), false, 'external no-cue path must keep navigation unchanged');
        assert.equal(extractionStarts, 0);
    } else {
        assert.equal(up(), true, 'embedded second Up should wait for interactive subtitle extraction');
        assert.equal(extractionStarts, 1, 'embedded pending selection should start or join extraction');
        assert.equal(status, 'Preparing interactive subtitles…');
        assert.equal(context.__sbPendingSelectionUntil, 15000);
        assert.equal(context.__sbSelectionWaitUntil, 15000);
    }
}
keyHarness(false); keyHarness(true);

// Instantiate the actual generated WebOsVideo constructor with a minimal DOM/Luna.
// This catches closure/variable wiring errors that isolated controller tests cannot.
class Element {
    constructor(tag) {
        this.tag = tag; this.style = {}; this.childNodes = []; this.textTracks = [];
        this.sheet = { insertRule() {} }; this.paused = false; this.readyState = 0;
        this.HAVE_METADATA = 1; this.mediaId = ''; this.buffered = { length: 0 };
        this.operations = []; this.listeners = {};
    }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    removeEventListener(name, fn) { if (this.listeners[name] === fn) delete this.listeners[name]; }
    appendChild(node) { this.childNodes.push(node); node.parentNode = this; }
    removeChild(node) { this.childNodes = this.childNodes.filter(item => item !== node); }
    set src(value) { this._src = value; this.operations.push(['src', value]); }
    get src() { return this._src; }
    setAttribute() {}
    removeAttribute(name) { this.operations.push(['removeAttribute', name]); }
    load() { this.operations.push(['load', this.src]); }
    play() { this.operations.push(['play', this.src]); this.paused = false; }
    pause() { this.paused = true; }
}
const elements = [], nativeCalls = [], adapterTimers = new Map();
let timerId = 0;
const adapterDocumentBody = new Element('body');
const adapterDocument = {
    body: adapterDocumentBody,
    documentElement: adapterDocumentBody,
    createElement: tag => { const element = new Element(tag); elements.push(element); return element; },
    addEventListener() {},
    removeEventListener() {}
};
const adapterContext = {
    HTMLElement: Element,
    document: adapterDocument,
    window: { addEventListener() {}, removeEventListener() {}, webOS: { service: {
        request: (uri, options) => { nativeCalls.push(options); return { cancel() {} }; }
    } } },
    setInterval: fn => { adapterTimers.set(++timerId, fn); return timerId; },
    clearInterval: id => adapterTimers.delete(id), clearTimeout() {},
    n: require('events').EventEmitter, a: value => value, i: value => value,
    h: { unsupportedSubs: [], unsupportedAudio: [] },
    l: options => nativeCalls.push(options), g() {}, o: (url, cb) => cb({ subs: [], audio: [] }),
    console
};
vm.createContext(adapterContext);
adapterContext.window.setInterval = adapterContext.setInterval;
adapterContext.window.clearInterval = adapterContext.clearInterval;
const constructorStart = source.lastIndexOf('            function m(e) {', source.indexOf('E = function(e) { m = !e;'));
const constructorEnd = source.indexOf('            m.canPlayStream', constructorStart);
assert(constructorStart >= 0 && constructorEnd > constructorStart);
vm.runInContext(source.slice(constructorStart, constructorEnd), adapterContext);
const adapter = new adapterContext.m({ containerElement: new Element('div') });
// The actual private Bleach URL is not stored in this repository. Accept it from
// the environment for local replay; CI uses an explicit synthetic direct-MKV URL.
// Neither fixture is fetched: this regression checks lossless load dispatch.
const directUrl = process.env.SUBTITLE_BRIDGE_TEST_STREAM_URL || 'https://example.test/Bleach.S04E08.mkv?token=a%2Fb%2Bc&download=1';
const directStream = { url: directUrl, name: 'Bleach', behaviorHints: { notWebReady: true } };
adapter.dispatch({ type: 'command', commandName: 'load', commandArgs: { stream: directStream, time: 287000, autoplay: false } });
const video = elements.find(element => element.tag === 'video');
assert.deepEqual(video.operations, [['src', directUrl]], 'load must assign the direct URL without prior unload/removeAttribute/load');
assert.strictEqual(video.src, directUrl, 'direct stream URL must not be rewritten');
assert.strictEqual(video.autoplay, false);
let observedStream;
adapter.on('propValue', (name, value) => { if (name === 'stream') observedStream = value; });
adapter.dispatch({ type: 'observeProp', propName: 'stream' });
assert.strictEqual(observedStream, directStream, 'original stream must reach WebOsVideo unchanged');
adapter.dispatch({ type: 'setProp', propName: 'selectedSubtitlesTrackId', propValue: 'EMBEDDED_2' });
video.mediaId = 'early';
Array.from(adapterTimers.values()).forEach(fn => fn());
assert.deepEqual(video.operations, [['src', directUrl], ['load', directUrl], ['play', directUrl]], 'preserve original delayed WebOsVideo load/play order');
assert.equal(video.readyState, 0);
assert.equal(nativeCalls[0].method, 'subscribe');
assert.equal(nativeCalls.find(call => call.method === 'selectTrack').parameters.index, 2);
nativeCalls.find(call => call.method === 'selectTrack').onSuccess({});
Array.from(adapterTimers.values()).forEach(fn => fn());
assert.equal(nativeCalls.find(call => call.method === 'setSubtitleEnable').parameters.enable, true);
adapter.dispatch({ type: 'command', commandName: 'unload' });
assert.deepEqual(video.operations.slice(-2), [['removeAttribute', 'src'], ['load', directUrl]], 'explicit unload must still tear down the source');
assert.equal(adapterTimers.size, 0, 'unload must stop lifecycle AND legacy load polling');
adapter.dispatch({ type: 'command', commandName: 'destroy' });
console.log('PASS: early mediaId, select/enable retries, silence, off, stale callbacks, reopen, retry bounds, both ArrowUp handlers');
