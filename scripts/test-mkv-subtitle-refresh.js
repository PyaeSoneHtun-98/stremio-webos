'use strict';
const fs=require('fs'), assert=require('assert');
const source=fs.readFileSync(process.argv[2],'utf8');
assert(source.includes('__subtitleBridgePOCv112'),'v1.0.12 marker missing');
assert(source.includes('__sbFallbackReady = __sbFallbackReady || wasReady'),'refresh failure must preserve the active cue or previous ready window');
assert(source.includes('__sbFallbackRetryAt = Date.now() + 1200'),'refresh retry must be quick');
assert(source.includes('xhr.timeout = 4e4'),'MKV extractor request timeout must allow slow TV range reads');
assert(source.includes('__sbFallbackEnd - 3'),'refresh must begin before the short indexed window expires');
console.log('PASS: MKV cue refresh keeps last-good cues, retries quickly, and refreshes early for prefetched handoff');
