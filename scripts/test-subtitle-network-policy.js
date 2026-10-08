'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const policy = require('../service/mkv-network-policy');
const extractor = require('../service/mkv-subtitle-extractor');

function rejected(url) {
    assert.throws(function() { policy.parseMediaUrl(url); }, /(?:Private|Local|Unsupported|Invalid)/, url);
}

function checkLookup(records, family, all) {
    return new Promise(function(resolve) {
        const lookup = policy.createSafeLookup(function(hostname, options, callback) {
            assert.strictEqual(options.all, true, 'DNS resolution must return all addresses for validation');
            callback(null, records);
        });
        lookup('example.org', { family: family || 0, all: !!all }, function(error, address, resolvedFamily) {
            resolve({ error: error, address: address, family: resolvedFamily });
        });
    });
}

async function main() {
    assert.strictEqual(policy.parseMediaUrl('http://127.0.0.1:11470/media.mkv').hostname, '127.0.0.1');
    assert.strictEqual(policy.parseMediaUrl('http://localhost:11470/media.mkv').hostname, '127.0.0.1');
    assert.strictEqual(policy.parseMediaUrl('https://media.example.org:8443/movie.mkv').hostname, 'media.example.org');
    assert.strictEqual(policy.parseMediaUrl('https://8.8.8.8/a').hostname, '8.8.8.8');

    [
        'http://127.0.0.1:8080/diagnostics', 'http://127.0.0.2:11470/private',
        'http://localhost:8080/', 'http://192.168.1.5:8096/', 'http://10.0.0.5/a',
        'http://172.16.0.1/a', 'http://100.64.0.1/a', 'http://169.254.169.254/metadata',
        'http://0x7f000001:8080/', 'http://[::1]:8080/', 'http://[::ffff:127.0.0.1]/',
        'http://[fc00::1]/', 'http://192.0.2.1/a', 'http://example.local/',
        'file:///etc/passwd', 'http://user:password@media.example.com/video.mkv'
    ].forEach(rejected);

    assert(policy.isPublicAddress('93.184.216.34'));
    assert(policy.isPublicAddress('2606:4700:4700::1111'));
    assert(!policy.isPublicAddress('127.0.0.1'));
    assert(!policy.isPublicAddress('192.168.0.1'));
    assert(!policy.isPublicAddress('::ffff:10.0.0.1'));

    const headers = { host: '127.0.0.1:8080', 'x-subtitle-bridge-request': '1' };
    assert(policy.isAuthorizedMkvRequest(headers));
    assert(policy.isAuthorizedMkvRequest({ host: 'localhost:8080', 'x-subtitle-bridge-request': '1' }));
    assert(!policy.isAuthorizedMkvRequest({ host: '192.168.1.20:8080', 'x-subtitle-bridge-request': '1' }));
    assert(!policy.isAuthorizedMkvRequest({ host: '127.0.0.1:8080' }));
    assert(!policy.isAuthorizedMkvRequest(Object.assign({}, headers, { origin: 'https://attacker.example' })));

    const publicIp = { address: '93.184.216.34', family: 4 };
    const privateIp = { address: '192.168.1.12', family: 4 };
    const good = await checkLookup([publicIp], 4);
    assert.ifError(good.error);
    assert.strictEqual(good.address, publicIp.address, 'validated address must be pinned for socket use');
    assert((await checkLookup([publicIp, privateIp])).error, 'mixed public/private DNS must fail closed');
    assert((await checkLookup([privateIp])).error, 'private DNS must be rejected');
    const allResult = await checkLookup([publicIp], 0, true);
    assert.ifError(allResult.error);
    assert.deepStrictEqual(allResult.address, [publicIp], 'Node multi-address DNS lookup must be supported');
    assert((await checkLookup([publicIp], 6)).error, 'requested address family must be available');

    const playerPath = process.argv[2] || path.join(__dirname, '..', 'service', 'www', 'video.chunk.js');
    const player = fs.readFileSync(playerPath, 'utf8');
    assert(player.includes('xhr.setRequestHeader("X-Subtitle-Bridge-Request", "1")'), 'generated embedded requests must send the custom header');
    const launch = fs.readFileSync(path.join(__dirname, '..', 'service', 'launch.js'), 'utf8');
    assert(launch.includes(".listen(8080, '127.0.0.1'"), 'bridge listener must be loopback-only');
    assert(launch.includes('isAuthorizedMkvRequest(req.headers)'), 'MKV endpoint must reject cross-origin simple GETs');
    const extractorSrc = fs.readFileSync(path.join(__dirname, '..', 'service', 'mkv-subtitle-extractor.js'), 'utf8');
    assert(extractorSrc.includes('lookup: mkvNetworkPolicy.safeLookup'), 'outbound DNS must be pinned and validated');

    // Exercise the actual redirect path. Permit only the ephemeral fixture URL;
    // any redirected location must go through the production validation policy.
    const server = http.createServer(function(req, res) {
        res.writeHead(302, { Location: 'http://127.0.0.1:8080/private' });
        res.end();
    });
    await new Promise(function(resolve) { server.listen(0, '127.0.0.1', resolve); });
    const fixture = 'http://127.0.0.1:' + server.address().port + '/media.mkv';
    const originalParse = policy.parseMediaUrl;
    let checkedRedirect = false;
    try {
        policy.parseMediaUrl = function(target) {
            if (target === fixture) return new (require('url').URL)(target);
            checkedRedirect = true;
            return originalParse(target);
        };
        await assert.rejects(extractor.extractWindow(fixture, 0, 4), /Private subtitle media host is not allowed/);
        assert(checkedRedirect, 'redirect destinations must be revalidated');
    } finally {
        policy.parseMediaUrl = originalParse;
        await new Promise(function(resolve) { server.close(resolve); });
    }
    console.log('PASS: MKV request ingress, public/local URL policy, pinned DNS, redirect denial, and generated player header');
}

main().catch(function(error) { console.error(error); process.exitCode = 1; });
