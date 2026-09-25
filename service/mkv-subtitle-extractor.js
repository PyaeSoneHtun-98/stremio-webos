'use strict';

var http = require('http');
var https = require('https');
var zlib = require('zlib');
var URLCtor = require('url').URL;

var HEAD_BYTES = 4 * 1024 * 1024;
var MAX_CUES_BYTES = 12 * 1024 * 1024;
var MAX_CLUSTER_BYTES = 20 * 1024 * 1024;
var TAIL_BYTES = 8 * 1024 * 1024;
var metaCache = Object.create(null);

function readId(buf, off) {
    if (off >= buf.length) return null;
    var first = buf[off], len = 1, mask = 0x80;
    if (!first) return null;
    while (!(first & mask)) { len++; mask >>= 1; if (len > 4) return null; }
    if (off + len > buf.length) return null;
    var value = first;
    for (var i = 1; i < len; i++) value = value * 256 + buf[off + i];
    return { value: value, length: len };
}

function readVint(buf, off) {
    if (off >= buf.length) return null;
    var first = buf[off], len = 1, mask = 0x80;
    if (!first) return null;
    while (!(first & mask)) { len++; mask >>= 1; if (len > 8) return null; }
    if (off + len > buf.length) return null;
    var value = first & (mask - 1), unknown = true;
    for (var i = 1; i < len; i++) value = value * 256 + buf[off + i];
    if ((first & (mask - 1)) !== mask - 1) unknown = false;
    for (var j = 1; j < len && unknown; j++) if (buf[off + j] !== 255) unknown = false;
    return { value: value, length: len, unknown: unknown };
}

function headerAt(buf, off) {
    var id = readId(buf, off); if (!id) return null;
    var size = readVint(buf, off + id.length); if (!size) return null;
    return { id: id.value, headerLength: id.length + size.length, dataStart: off + id.length + size.length, size: size.value, unknown: size.unknown };
}

function readUInt(buf, off, len) {
    var n = 0;
    for (var i = 0; i < len; i++) n = n * 256 + buf[off + i];
    return n;
}

function readSigned16(buf, off) {
    var n = (buf[off] << 8) | buf[off + 1];
    return n & 0x8000 ? n - 0x10000 : n;
}

function text(buf, start, end) { return buf.slice(start, end).toString('utf8').replace(/\0+$/g, ''); }

function eachChild(buf, start, end, fn) {
    var pos = start, guard = 0;
    while (pos < end && guard++ < 100000) {
        var h = headerAt(buf, pos); if (!h) break;
        var dataEnd = h.unknown ? end : h.dataStart + h.size;
        if (dataEnd > end || dataEnd < h.dataStart) break;
        fn(h, pos, dataEnd);
        pos = dataEnd;
    }
}

function parseCompression(buf, start, end) {
    var algo = null, settings = null;
    function walk(a, b) {
        eachChild(buf, a, b, function(h, pos, dataEnd) {
            if (h.id === 0x4254) algo = readUInt(buf, h.dataStart, h.size);
            else if (h.id === 0x4255) settings = Buffer.from(buf.slice(h.dataStart, dataEnd));
            else if (h.id === 0x6240 || h.id === 0x5034 || h.id === 0x6D80) walk(h.dataStart, dataEnd);
        });
    }
    walk(start, end);
    return { algo: algo, settings: settings };
}

function parseTrackEntry(buf, start, end) {
    var t = { number: null, type: null, codec: '', language: null, name: null, compressionAlgo: null, compressionSettings: null };
    eachChild(buf, start, end, function(h, pos, dataEnd) {
        if (h.id === 0xD7) t.number = readUInt(buf, h.dataStart, h.size);
        else if (h.id === 0x83) t.type = readUInt(buf, h.dataStart, h.size);
        else if (h.id === 0x86) t.codec = text(buf, h.dataStart, dataEnd);
        else if (h.id === 0x22B59C) t.language = text(buf, h.dataStart, dataEnd);
        else if (h.id === 0x536E) t.name = text(buf, h.dataStart, dataEnd);
        else if (h.id === 0x6D80) {
            var c = parseCompression(buf, h.dataStart, dataEnd);
            t.compressionAlgo = c.algo; t.compressionSettings = c.settings;
        }
    });
    return t;
}

function seekIdValue(buf, start, end) {
    var n = 0;
    for (var i = start; i < end; i++) n = n * 256 + buf[i];
    return n;
}

function parseHeadBuffer(buf, totalSize) {
    var pos = 0, segment = null;
    while (pos < buf.length) {
        var h = headerAt(buf, pos); if (!h) break;
        var end = h.unknown ? buf.length : h.dataStart + h.size;
        if (h.id === 0x18538067) { segment = { dataStart: h.dataStart, end: end }; break; }
        if (end > buf.length) break;
        pos = end;
    }
    if (!segment) throw new Error('Matroska Segment not found');
    var info = { timecodeScale: 1000000, tracks: [], segmentDataStart: segment.dataStart, totalSize: totalSize || null, cuesAbsolute: null, seekCuesAbsolute: null };
    pos = segment.dataStart;
    while (pos < buf.length) {
        var el = headerAt(buf, pos); if (!el) break;
        var dataEnd = el.unknown ? buf.length : el.dataStart + el.size;
        if (dataEnd > buf.length) break;
        if (el.id === 0x1549A966) {
            eachChild(buf, el.dataStart, dataEnd, function(ch) {
                if (ch.id === 0x2AD7B1) info.timecodeScale = readUInt(buf, ch.dataStart, ch.size);
            });
        } else if (el.id === 0x1654AE6B) {
            eachChild(buf, el.dataStart, dataEnd, function(ch, childPos, childEnd) {
                if (ch.id === 0xAE) info.tracks.push(parseTrackEntry(buf, ch.dataStart, childEnd));
            });
        } else if (el.id === 0x114D9B74) {
            eachChild(buf, el.dataStart, dataEnd, function(ch, childPos, childEnd) {
                if (ch.id !== 0x4DBB) return;
                var sid = null, spos = null;
                eachChild(buf, ch.dataStart, childEnd, function(sh, sp, se) {
                    if (sh.id === 0x53AB) sid = seekIdValue(buf, sh.dataStart, se);
                    else if (sh.id === 0x53AC) spos = readUInt(buf, sh.dataStart, sh.size);
                });
                if (sid === 0x1C53BB6B && spos !== null) info.seekCuesAbsolute = info.segmentDataStart + spos;
            });
        } else if (el.id === 0x1C53BB6B) {
            info.cuesAbsolute = pos;
        } else if (el.id === 0x1F43B675) {
            break;
        }
        pos = dataEnd;
    }
    return info;
}

function isTextSubtitle(track) {
    if (!track || track.type !== 0x11) return false;
    var c = String(track.codec || '').toUpperCase();
    return c === 'S_TEXT/UTF8' || c === 'S_TEXT/ASS' || c === 'S_TEXT/SSA' || c === 'S_TEXT/WEBVTT';
}

function requestBuffer(target, start, end, redirects) {
    redirects = redirects || 0;
    return new Promise(function(resolve, reject) {
        var parsed;
        try { parsed = new URLCtor(target); } catch (e) { return reject(new Error('Invalid media URL')); }
        var client = parsed.protocol === 'https:' ? https : parsed.protocol === 'http:' ? http : null;
        if (!client) return reject(new Error('Unsupported media protocol'));
        var headers = {};
        if (start !== null && start !== undefined) headers.Range = 'bytes=' + start + '-' + end;
        var req = client.get(parsed, { headers: headers }, function(res) {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 4) {
                res.resume();
                return resolve(requestBuffer(new URLCtor(res.headers.location, parsed).toString(), start, end, redirects + 1));
            }
            if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
            if (start > 0 && res.statusCode !== 206) { res.resume(); return reject(new Error('Range requests are not supported')); }
            var chunks = [], length = 0;
            res.on('data', function(chunk) {
                length += chunk.length;
                if (length > Math.max(HEAD_BYTES, MAX_CLUSTER_BYTES, MAX_CUES_BYTES) + 1024) { req.destroy(new Error('Range response too large')); return; }
                chunks.push(chunk);
            });
            res.on('end', function() {
                var total = null, cr = String(res.headers['content-range'] || '');
                var m = /\/(\d+)$/.exec(cr); if (m) total = parseInt(m[1], 10);
                if (total === null && res.statusCode === 200 && res.headers['content-length']) total = parseInt(res.headers['content-length'], 10);
                resolve({ buffer: Buffer.concat(chunks), total: total, status: res.statusCode });
            });
        });
        req.setTimeout(8000, function() { req.destroy(new Error('Range request timeout')); });
        req.on('error', reject);
    });
}

function fetchRange(target, start, length) { return requestBuffer(target, start, start + length - 1, 0); }

function findCuesMagic(buf) {
    for (var i = 0; i + 4 <= buf.length; i++) if (buf[i] === 0x1c && buf[i+1] === 0x53 && buf[i+2] === 0xbb && buf[i+3] === 0x6b) return i;
    return -1;
}

function loadMetadata(target) {
    var cached = metaCache[target];
    if (cached && Date.now() - cached.at < 20 * 60 * 1000) return Promise.resolve(cached.value);
    return fetchRange(target, 0, HEAD_BYTES).then(function(head) {
        var info = parseHeadBuffer(head.buffer, head.total);
        metaCache[target] = { at: Date.now(), value: info };
        var keys = Object.keys(metaCache);
        if (keys.length > 8) keys.sort(function(a,b){ return metaCache[a].at - metaCache[b].at; }).slice(0, keys.length - 8).forEach(function(k){ delete metaCache[k]; });
        return info;
    });
}

function parseCues(buf, absoluteBase, expectedRoot) {
    var rootOffset = expectedRoot || 0;
    var root = headerAt(buf, rootOffset);
    if (!root || root.id !== 0x1C53BB6B) {
        rootOffset = findCuesMagic(buf);
        if (rootOffset < 0) throw new Error('Matroska Cues not found');
        root = headerAt(buf, rootOffset);
    }
    if (!root || root.id !== 0x1C53BB6B) throw new Error('Invalid Matroska Cues');
    var end = root.unknown ? buf.length : Math.min(buf.length, root.dataStart + root.size), out = [];
    eachChild(buf, root.dataStart, end, function(point, pp, pe) {
        if (point.id !== 0xBB) return;
        var cueTime = null, positions = [];
        eachChild(buf, point.dataStart, pe, function(ch, cp, ce) {
            if (ch.id === 0xB3) cueTime = readUInt(buf, ch.dataStart, ch.size);
            else if (ch.id === 0xB7) {
                var tr = null, pos = null;
                eachChild(buf, ch.dataStart, ce, function(ph) {
                    if (ph.id === 0xF7) tr = readUInt(buf, ph.dataStart, ph.size);
                    else if (ph.id === 0xF1) pos = readUInt(buf, ph.dataStart, ph.size);
                });
                if (pos !== null) positions.push({ track: tr, clusterPosition: pos });
            }
        });
        if (cueTime !== null && positions.length) out.push({ time: cueTime, positions: positions });
    });
    if (!out.length) throw new Error('Matroska Cues are empty');
    return out;
}

function loadCues(target, info) {
    if (info._cues) return Promise.resolve(info._cues);
    var abs = info.cuesAbsolute || info.seekCuesAbsolute;
    function loadAt(pos) {
        return fetchRange(target, pos, 64).then(function(first) {
            var h = headerAt(first.buffer, 0);
            if (!h || h.id !== 0x1C53BB6B) throw new Error('Cues seek target is invalid');
            var need = h.unknown ? MAX_CUES_BYTES : h.headerLength + h.size;
            if (need > MAX_CUES_BYTES) throw new Error('Cues element too large');
            return fetchRange(target, pos, need).then(function(full) { return parseCues(full.buffer, pos, 0); });
        });
    }
    var promise;
    if (abs !== null && abs !== undefined) promise = loadAt(abs);
    else if (info.totalSize) {
        var len = Math.min(TAIL_BYTES, info.totalSize), start = info.totalSize - len;
        promise = fetchRange(target, start, len).then(function(tail) { return parseCues(tail.buffer, start, null); });
    } else promise = Promise.reject(new Error('Cues location unavailable'));
    return promise.then(function(cues) { info._cues = cues; return cues; });
}

function decompress(track, payload) {
    if (track.compressionAlgo === null || track.compressionAlgo === undefined) return payload;
    if (track.compressionAlgo === 0) return zlib.inflateSync(payload);
    if (track.compressionAlgo === 3) return Buffer.concat([track.compressionSettings || Buffer.alloc(0), payload]);
    throw new Error('Unsupported subtitle compression algorithm ' + track.compressionAlgo);
}

function stripAssTags(s) {
    return String(s || '').replace(/\\N/gi, '\n').replace(/\\h/gi, ' ').replace(/\{[^}]*\}/g, '').replace(/<[^>]+>/g, '').replace(/\r/g, '').trim();
}

function parsePayload(track, payload) {
    payload = decompress(track, payload);
    var s = payload.toString('utf8').replace(/\0+$/g, '').trim();
    if (!s) return '';
    var codec = String(track.codec || '').toUpperCase();
    if (codec === 'S_TEXT/ASS' || codec === 'S_TEXT/SSA') {
        if (/^Dialogue\s*:/i.test(s)) {
            s = s.replace(/^Dialogue\s*:\s*/i, '');
            var full = s.split(',');
            s = full.length >= 10 ? full.slice(9).join(',') : full.slice(8).join(',');
        } else {
            var parts = s.split(',');
            if (parts.length >= 9) s = parts.slice(8).join(',');
        }
        return stripAssTags(s);
    }
    return s.replace(/\r/g, '').replace(/<[^>]+>/g, '').trim();
}

function parseBlock(buf, start, end, track, clusterTicks, timecodeScale, durationTicks, out) {
    var tn = readVint(buf, start); if (!tn || tn.value !== track.number) return;
    var tcOff = start + tn.length;
    if (tcOff + 3 > end) return;
    var relative = readSigned16(buf, tcOff), flags = buf[tcOff + 2];
    if ((flags & 0x06) !== 0) return;
    var payload = Buffer.from(buf.slice(tcOff + 3, end)), cueText;
    try { cueText = parsePayload(track, payload); } catch (e) { return; }
    if (!cueText) return;
    var startSec = (clusterTicks + relative) * timecodeScale / 1e9;
    var durationSec = durationTicks === null || durationTicks === undefined ? null : durationTicks * timecodeScale / 1e9;
    out.push({ startTime: startSec, endTime: durationSec === null ? null : startSec + durationSec, text: cueText });
}

function parseCluster(buf, track, timecodeScale, out) {
    var root = headerAt(buf, 0); if (!root || root.id !== 0x1F43B675) return;
    var rootEnd = root.unknown ? buf.length : Math.min(buf.length, root.dataStart + root.size), clusterTicks = 0;
    eachChild(buf, root.dataStart, rootEnd, function(ch, cp, ce) {
        if (ch.id === 0xE7) clusterTicks = readUInt(buf, ch.dataStart, ch.size);
        else if (ch.id === 0xA3) parseBlock(buf, ch.dataStart, ce, track, clusterTicks, timecodeScale, null, out);
        else if (ch.id === 0xA0) {
            var block = null, duration = null;
            eachChild(buf, ch.dataStart, ce, function(bg, bp, be) {
                if (bg.id === 0xA1) block = { start: bg.dataStart, end: be };
                else if (bg.id === 0x9B) duration = readUInt(buf, bg.dataStart, bg.size);
            });
            if (block) parseBlock(buf, block.start, block.end, track, clusterTicks, timecodeScale, duration, out);
        }
    });
}

function chooseAnchors(cues, trackNumber, timeSec, timecodeScale) {
    var rows = [], hasTarget = false;
    cues.forEach(function(c) { c.positions.forEach(function(p) { if (p.track === trackNumber) hasTarget = true; }); });
    cues.forEach(function(c) {
        var positions = hasTarget ? c.positions.filter(function(p){ return p.track === trackNumber; }) : c.positions.slice(0,1);
        positions.forEach(function(p) { rows.push({ timeSec: c.time * timecodeScale / 1e9, clusterPosition: p.clusterPosition }); });
    });
    rows.sort(function(a,b){ return a.timeSec - b.timeSec || a.clusterPosition - b.clusterPosition; });
    var dedup = [], seen = Object.create(null);
    rows.forEach(function(r){ if (!seen[r.clusterPosition]) { seen[r.clusterPosition] = true; dedup.push(r); } });
    var idx = 0;
    for (var i=0;i<dedup.length;i++) { if (dedup[i].timeSec <= timeSec) idx=i; else break; }
    var start = Math.max(0, idx - 1), endTime = timeSec + 30, chosen=[];
    for (var j=start;j<dedup.length && chosen.length<16;j++) { chosen.push(dedup[j]); if (dedup[j].timeSec > endTime && chosen.length>=3) break; }
    return chosen;
}

function loadCluster(target, info, anchor, nextAnchor) {
    var abs = info.segmentDataStart + anchor.clusterPosition;
    return fetchRange(target, abs, 64).then(function(first) {
        var h = headerAt(first.buffer, 0); if (!h || h.id !== 0x1F43B675) throw new Error('Cluster seek target is invalid');
        var need;
        if (!h.unknown) need = h.headerLength + h.size;
        else if (nextAnchor) need = (info.segmentDataStart + nextAnchor.clusterPosition) - abs;
        else need = MAX_CLUSTER_BYTES;
        if (need <= 0 || need > MAX_CLUSTER_BYTES) need = MAX_CLUSTER_BYTES;
        return fetchRange(target, abs, need).then(function(full) { return full.buffer; });
    });
}

function finalizeCues(cues, from, to) {
    cues.sort(function(a,b){ return a.startTime - b.startTime; });
    var out=[];
    for(var i=0;i<cues.length;i++) {
        var c=cues[i], next=cues[i+1];
        if (c.endTime === null || !isFinite(c.endTime) || c.endTime <= c.startTime) c.endTime = Math.min(next ? next.startTime : c.startTime + 5, c.startTime + 5);
        if (c.endTime < from || c.startTime > to) continue;
        var last=out[out.length-1];
        if(last && Math.abs(last.startTime-c.startTime)<0.001 && last.text===c.text) continue;
        out.push(c);
    }
    return out;
}

function extractWindow(target, subtitleOrdinal, timeSec) {
    subtitleOrdinal = Math.max(0, parseInt(subtitleOrdinal, 10) || 0);
    timeSec = Math.max(0, Number(timeSec) || 0);
    return loadMetadata(target).then(function(info) {
        var textTracks = info.tracks.filter(isTextSubtitle);
        var track = textTracks[subtitleOrdinal];
        if (!track) throw new Error('No text subtitle track at ordinal ' + subtitleOrdinal);
        return loadCues(target, info).then(function(cues) {
            var anchors = chooseAnchors(cues, track.number, timeSec, info.timecodeScale);
            if (!anchors.length) throw new Error('No cluster anchors near requested time');
            var collected=[];
            var chain=Promise.resolve();
            anchors.forEach(function(anchor, i) {
                chain=chain.then(function(){ return loadCluster(target, info, anchor, anchors[i+1]).then(function(buf){ parseCluster(buf, track, info.timecodeScale, collected); }); });
            });
            return chain.then(function() {
                var from=Math.max(0,timeSec-6), to=timeSec+26, cuesOut=finalizeCues(collected,from,to);
                if (!cuesOut.length) throw new Error('No subtitle cues found near ' + timeSec.toFixed(1) + 's');
                return { trackNumber: track.number, codec: track.codec, cues: cuesOut, window: [from,to] };
            });
        });
    });
}

module.exports = { extractWindow: extractWindow, _parseHeadBuffer: parseHeadBuffer, _parseCues: parseCues };
