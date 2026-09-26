process.env.NODE_PATH = (process.env.NODE_PATH || '') + ':/usr/lib/node_modules:/usr/lib/nodejs';
require('module').Module._initPaths();
process.env.APP_PATH = process.env.APP_PATH || __dirname;

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var Service = require('webos-service');
var mkvSubtitleExtractor = require('./mkv-subtitle-extractor');
var mkvCueWindowCache = require('./mkv-cue-window-cache').createMkvCueWindowCache(mkvSubtitleExtractor.extractWindow, { maxEntries: 2048, maxBytes: 4 * 1024 * 1024, ttlMs: 4 * 60 * 60 * 1000, bucketSeconds: 20 });
var dictionaryProvider = require('./dictionary-provider');

var service = new Service('com.pyaesone.stremiosb.server');
var ready = false;
var pendingMessages = [];

var ffmpegBin = path.join(__dirname, 'bin', 'ffmpeg');
var ffprobeBin = path.join(__dirname, 'bin', 'ffprobe');
var activeCueCache = Object.create(null);
var activeCueBytes = 0;
var activeSubtitleMediaUrl = null;
var startedAt = Date.now();
var requestMetrics = { mkvCueRequests:0, activeCueRequests:0, dictionaryRequests:0, mkvCueLatencyMs:0, activeCueLatencyMs:0, dictionaryLatencyMs:0 };

function activateSubtitleMedia(mediaUrl) {
    if (activeSubtitleMediaUrl === mediaUrl) return;
    activeSubtitleMediaUrl = mediaUrl;
    activeCueCache = Object.create(null);
    activeCueBytes = 0;
    mkvCueWindowCache.activate(mediaUrl);
    if (mkvSubtitleExtractor.activateMedia) mkvSubtitleExtractor.activateMedia(mediaUrl);
}

function rememberActiveCue(cacheKey, entry) {
    var body; try { body = JSON.stringify(entry.result); } catch (_) { body = ''; }
    entry.bytes = Buffer.byteLength(cacheKey, 'utf8') + Buffer.byteLength(body, 'utf8') + 160;
    var previous = activeCueCache[cacheKey];
    if (previous) activeCueBytes = Math.max(0, activeCueBytes - previous.bytes);
    activeCueCache[cacheKey] = entry;
    activeCueBytes += entry.bytes;
    var keys = Object.keys(activeCueCache);
    keys.sort(function(a,b) { return activeCueCache[a].at-activeCueCache[b].at; });
    while (keys.length > 512 || activeCueBytes > 1024 * 1024) {
        var oldest=keys.shift(), old=activeCueCache[oldest];
        if (old) { activeCueBytes=Math.max(0,activeCueBytes-old.bytes); delete activeCueCache[oldest]; }
    }
}

function removeActiveCuesCoveredBy(mediaUrl, trackOrdinal, window) {
    if (!Array.isArray(window)) return;
    Object.keys(activeCueCache).forEach(function(cacheKey) {
        var entry=activeCueCache[cacheKey];
        if (entry.mediaUrl===mediaUrl && entry.trackOrdinal===trackOrdinal && entry.from>=Number(window[0]) && entry.to<=Number(window[1])) {
            activeCueBytes=Math.max(0,activeCueBytes-entry.bytes);
            delete activeCueCache[cacheKey];
        }
    });
}

function normalizeMkvMediaUrl(mediaUrl) {
    if (mediaUrl.charAt(0) === '/') return 'http://127.0.0.1:11470' + mediaUrl;
    try {
        var parsed = new url.URL(mediaUrl);
        if ((parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') && parsed.port === '8080') parsed.port = '11470';
        return parsed.toString();
    } catch (_) { return mediaUrl; }
}

function serveDictionaryLookup(req, res) {
    var requestStarted = Date.now();
    requestMetrics.dictionaryRequests++;
    var query = url.parse(req.url, true).query || {};
    var word = typeof query.word === 'string' ? query.word.slice(0, 160) : '';
    var clickedTokenIndex = parseInt(query.index, 10);
    var contextTokens = [];
    if (typeof query.tokens === 'string' && query.tokens.length <= 4096) {
        try {
            var parsedTokens = JSON.parse(query.tokens);
            if (Array.isArray(parsedTokens)) {
                contextTokens = parsedTokens.slice(0, 32).map(function(token) { return String(token || '').slice(0, 120); });
            }
        } catch (_) {}
    }
    if (!isFinite(clickedTokenIndex)) clickedTokenIndex = -1;
    try {
        var result = dictionaryProvider.lookup(word, contextTokens, clickedTokenIndex);
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify(result ? {found:true,result:result} : {
            found:false,
            error:'No offline Burmese translation is available for “' + word + '” yet.'
        }));
        requestMetrics.dictionaryLatencyMs += Date.now() - requestStarted;
    } catch (error) {
        requestMetrics.dictionaryLatencyMs += Date.now() - requestStarted;
        res.writeHead(500, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify({found:false,error:String(error && error.message || error || 'Dictionary lookup failed').slice(0,500)}));
    }
}

function serveMkvSubtitleCues(req, res) {
    var requestStarted = Date.now();
    requestMetrics.mkvCueRequests++;
    var query = url.parse(req.url, true).query || {};
    var mediaUrl = typeof query.from === 'string' ? normalizeMkvMediaUrl(query.from) : '';
    var trackOrdinal = parseInt(query.track, 10);
    var time = parseFloat(query.time);
    if (!/^https?:\/\//i.test(mediaUrl)) { res.writeHead(400, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({error:'Unsupported media URL'})); }
    if (!isFinite(trackOrdinal) || trackOrdinal < 0) trackOrdinal = 0;
    if (!isFinite(time) || time < 0) time = 0;

    activateSubtitleMedia(mediaUrl);
    mkvCueWindowCache.cancelDistantPrefetch(mediaUrl, trackOrdinal, time);
    var context = { cancelled: false, requests: [], cancel: function() {
        this.cancelled = true;
        this.requests.slice().forEach(function(request) { request.destroy(new Error('Subtitle request cancelled')); });
    } };
    res.once('close', function() { if (!res.writableEnded) context.cancel(); });
    mkvCueWindowCache.load(mediaUrl, trackOrdinal, time, { context: context }).then(function(packet) {
        if (context.cancelled) return;
        var result = packet.result;
        res.writeHead(200, {
            'Content-Type':'application/json; charset=utf-8',
            'Cache-Control':'no-store',
            'X-Subtitle-Bridge-Cache':packet.cache
        });
        res.end(JSON.stringify(result));
        removeActiveCuesCoveredBy(mediaUrl, trackOrdinal, result.window);
        requestMetrics.mkvCueLatencyMs += Date.now() - requestStarted;
        setTimeout(function() {
            mkvCueWindowCache.prefetchNext(mediaUrl, trackOrdinal, time, result);
        }, 0);
    }).catch(function(error) {
        if (context.cancelled) return;
        requestMetrics.mkvCueLatencyMs += Date.now() - requestStarted;
        res.writeHead(502, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify({error:String(error && error.message || error || 'MKV extraction failed').slice(0,500)}));
    });
}

function serveMkvActiveCue(req, res) {
    var requestStarted = Date.now();
    requestMetrics.activeCueRequests++;
    var query = url.parse(req.url, true).query || {};
    var mediaUrl = typeof query.from === 'string' ? normalizeMkvMediaUrl(query.from) : '';
    var trackOrdinal = parseInt(query.track, 10);
    var time = parseFloat(query.time);
    if (!/^https?:\/\//i.test(mediaUrl)) { res.writeHead(400, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({error:'Unsupported media URL'})); }
    if (!isFinite(trackOrdinal) || trackOrdinal < 0) trackOrdinal = 0;
    if (!isFinite(time) || time < 0) time = 0;
    activateSubtitleMedia(mediaUrl);
    var cached = mkvCueWindowCache.peek(mediaUrl, trackOrdinal, time);
    if (cached) {
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Subtitle-Bridge-Cache':'hit'});
        requestMetrics.activeCueLatencyMs += Date.now() - requestStarted;
        return res.end(JSON.stringify({ trackNumber: cached.trackNumber, codec: cached.codec,
            cues: cached.cues.filter(function(cue) { return cue.startTime <= time && time <= cue.endTime; }),
            window: [time, time + 1], method: 'active-cache' }));
    }
    var activeKeys = Object.keys(activeCueCache);
    for (var i = 0; i < activeKeys.length; i++) {
        var entry = activeCueCache[activeKeys[i]];
        if (Date.now() - entry.at >= 30 * 60 * 1000) {
            activeCueBytes = Math.max(0, activeCueBytes - entry.bytes);
            delete activeCueCache[activeKeys[i]];
            continue;
        }
        if (entry.mediaUrl === mediaUrl && entry.trackOrdinal === trackOrdinal && entry.from <= time && time <= entry.to) {
            entry.at = Date.now();
            res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Subtitle-Bridge-Cache':'active-hit'});
            requestMetrics.activeCueLatencyMs += Date.now() - requestStarted;
            return res.end(JSON.stringify(entry.result));
        }
    }
    var context = { cancelled: false, requests: [], cancel: function() {
        this.cancelled = true;
        this.requests.slice().forEach(function(request) { request.destroy(new Error('Subtitle request cancelled')); });
    } };
    res.once('close', function() { if (!res.writableEnded) context.cancel(); });
    mkvSubtitleExtractor.extractActiveCue(mediaUrl, trackOrdinal, time, context).then(function(result) {
        if (context.cancelled) return;
        var first = result.cues[0], last = result.cues[result.cues.length - 1];
        rememberActiveCue(mediaUrl + '\n' + trackOrdinal + '\n' + (first ? first.startTime : time), {
            at: Date.now(), mediaUrl: mediaUrl, trackOrdinal: trackOrdinal,
            from: first ? first.startTime : time, to: last ? last.endTime : time + 0.5, result: result
        });
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
        res.end(JSON.stringify(result));
        requestMetrics.activeCueLatencyMs += Date.now() - requestStarted;
    }).catch(function(error) {
        if (context.cancelled) return;
        requestMetrics.activeCueLatencyMs += Date.now() - requestStarted;
        res.writeHead(502, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify({error:String(error && error.message || error || 'Active cue extraction failed').slice(0,500)}));
    });
}

function serveDiagnostics(res) {
    var memory=process.memoryUsage();
    function average(total,count){return count?Math.round(total/count*10)/10:0;}
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({version:1,uptimeMs:Date.now()-startedAt,memory:{rss:memory.rss,heapTotal:memory.heapTotal,
        heapUsed:memory.heapUsed,external:memory.external||0},caches:{mkvWindows:mkvCueWindowCache.stats(),
        activeCues:{entries:Object.keys(activeCueCache).length,estimatedBytes:activeCueBytes,maxEntries:512,maxBytes:1024*1024}},
        extractor:mkvSubtitleExtractor.getStats?mkvSubtitleExtractor.getStats():null,dictionary:dictionaryProvider.getStats(),
        requests:{mkvCues:requestMetrics.mkvCueRequests,activeCues:requestMetrics.activeCueRequests,dictionary:requestMetrics.dictionaryRequests,
            averageMkvCueMs:average(requestMetrics.mkvCueLatencyMs,requestMetrics.mkvCueRequests),
            averageActiveCueMs:average(requestMetrics.activeCueLatencyMs,requestMetrics.activeCueRequests),
            averageDictionaryMs:average(requestMetrics.dictionaryLatencyMs,requestMetrics.dictionaryRequests)}}));
}

// Keep the service alive indefinitely
service.activityManager.create('keepAlive', function() {});

// Register the start method — responds once the HTTP server is listening
service.register('start', function(message) {
    if (ready) {
        message.respond({ ready: true });
    } else {
        pendingMessages.push(message);
    }
});

// Static file serving
var wwwDir = path.join(__dirname, 'www');
var mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon', '.gif': 'image/gif', '.webp': 'image/webp',
    '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json',
    '.map': 'application/json', '.txt': 'text/plain', '.mp3': 'audio/mpeg'
};

function serveStatic(urlPath, res, next) {
    // Reject path traversal
    var filePath = path.join(wwwDir, urlPath === '/' ? 'index.html' : urlPath);
    if (filePath.indexOf(wwwDir) !== 0) return next();

    fs.stat(filePath, function(err, stat) {
        if (err || !stat.isFile()) return next();
        var ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        var stream = fs.createReadStream(filePath);
        stream.on('error', function() { try { res.end(); } catch (_) {} });
        stream.pipe(res);
    });
}

function proxyToStreaming(req, res) {
    var opts = { hostname: '127.0.0.1', port: 11470, path: req.url, method: req.method, headers: req.headers };
    var proxy = http.request(opts, function(proxyRes) {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });
    proxy.on('error', function() { res.writeHead(502); res.end(); });
    req.pipe(proxy);
}

// Single server: static files first, then proxy to streaming server
http.createServer(function(req, res) {
    var urlPath = req.url.split('?')[0];
    if (req.method === 'GET' && urlPath === '/subtitle-bridge/lookup') return serveDictionaryLookup(req, res);
    if (req.method === 'GET' && urlPath === '/subtitle-bridge/mkv-cues') return serveMkvSubtitleCues(req, res);
    if (req.method === 'GET' && urlPath === '/subtitle-bridge/mkv-active-cue') return serveMkvActiveCue(req, res);
    if (req.method === 'GET' && urlPath === '/subtitle-bridge/diagnostics') return serveDiagnostics(res);
    serveStatic(urlPath, res, function() { proxyToStreaming(req, res); });
}).listen(8080, function() {
    ready = true;
    // Respond to any start calls that arrived before the server was ready
    pendingMessages.forEach(function(msg) { msg.respond({ ready: true }); });
    pendingMessages = [];
});

// Point the streaming server at the bundled ffmpeg binaries.
// HLS remux/transcode requires ffmpeg+ffprobe; without these the streaming
// server's /hlsv2/* endpoints return 500 "no ffmpeg found".
process.env.FFMPEG_BIN = ffmpegBin;
process.env.FFPROBE_BIN = ffprobeBin;

require('./server.js');
