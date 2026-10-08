'use strict';

// Policy for *server-side* MKV range fetches. Only the bundled Stremio
// server on loopback and public Internet media hosts are eligible.
var dns = require('dns');
var net = require('net');
var URLCtor = require('url').URL;

function isPublicAddress(address) {
    if (net.isIP(address) === 4) {
        var parts = address.split('.').map(Number), a = parts[0], b = parts[1], c = parts[2];
        return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
            (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
            (a === 203 && b === 0 && c === 113));
    }
    if (net.isIP(address) === 6) {
        var value = address.toLowerCase();
        // Excludes loopback, link-local, ULA, multicast, mapped IPv4 and
        // tunnelling prefixes that could conceal an internal IPv4 address.
        var first = parseInt(value.split(':')[0], 16);
        return first >= 0x2000 && first <= 0x3fff &&
            !/^2001:db8:/i.test(value) && !/^2001:0:/i.test(value) &&
            !/^2002:/i.test(value);
    }
    return false;
}

function parseMediaUrl(input) {
    var parsed;
    try { parsed = new URLCtor(input); }
    catch (_) { throw new Error('Invalid subtitle media URL'); }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
        !parsed.hostname || parsed.username || parsed.password) {
        throw new Error('Unsupported subtitle media URL');
    }

    // Native Stremio remux/range requests run on the same TV at port 11470.
    if (parsed.hostname === 'localhost' && parsed.protocol === 'http:' && parsed.port === '11470') {
        parsed.hostname = '127.0.0.1';
    }
    var hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (hostname === '127.0.0.1' && parsed.protocol === 'http:' && parsed.port === '11470') return parsed;
    if (net.isIP(hostname)) {
        if (!isPublicAddress(hostname)) throw new Error('Private subtitle media host is not allowed');
    } else if (hostname === 'localhost' || /(?:^|\.)(?:localhost|local|internal)$/.test(hostname)) {
        throw new Error('Local subtitle media hostname is not allowed');
    }
    return parsed;
}

// Pin the verified DNS result to the socket connection: resolving once for
// validation then allowing the HTTP client to resolve again permits rebinding.
function createSafeLookup(resolver) {
    resolver = resolver || dns.lookup;
    return function(hostname, options, callback) {
        if (typeof options === 'function') { callback = options; options = {}; }
        options = options || {};
        resolver(hostname, { all: true }, function(error, addresses) {
            if (error) return callback(error);
            if (!Array.isArray(addresses) || !addresses.length ||
                addresses.some(function(row) { return !row || !isPublicAddress(row.address); })) {
                return callback(new Error('Unsafe subtitle media DNS result'));
            }
            var suitable = options.family ?
                addresses.filter(function(row) { return row.family === options.family; }) : addresses;
            if (!suitable.length) return callback(new Error('No allowed address for media host'));
            if (options.all) return callback(null, suitable);
            return callback(null, suitable[0].address, suitable[0].family);
        });
    };
}

function isAuthorizedMkvRequest(headers) {
    var host = String(headers && headers.host || '').toLowerCase();
    var origin = headers && headers.origin;
    return (host === '127.0.0.1:8080' || host === 'localhost:8080') &&
        headers['x-subtitle-bridge-request'] === '1' &&
        (!origin || origin === 'http://127.0.0.1:8080' || origin === 'http://localhost:8080');
}

module.exports = {
    parseMediaUrl: parseMediaUrl,
    safeLookup: createSafeLookup(),
    createSafeLookup: createSafeLookup,
    isAuthorizedMkvRequest: isAuthorizedMkvRequest,
    isPublicAddress: isPublicAddress
};
