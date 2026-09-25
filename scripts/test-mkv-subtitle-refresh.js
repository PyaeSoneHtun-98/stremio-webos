'use strict';
const fs=require('fs'), assert=require('assert');
const source=fs.readFileSync(process.argv[2],'utf8');
assert(source.includes('__subtitleBridgePOCv112'),'v1.0.12 marker missing');
assert(source.includes('__sbFallbackReady = o'),'refresh failure must preserve previous ready cue window');
assert(source.includes('__sbFallbackRetryAt = Date.now() + 1200'),'refresh retry must be quick');
assert(source.includes('__sbFetchTextWithTimeout(i, 25e3)'),'MKV extractor request timeout must allow slow TV range reads');
assert(source.includes('__sbFallbackEnd - 12'),'refresh must begin earlier so the prefetched next window is ready before expiry');
console.log('PASS: MKV cue refresh keeps last-good cues, retries quickly, and refreshes early for prefetched handoff');
