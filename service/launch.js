process.env.NODE_PATH = (process.env.NODE_PATH || '') + ':/usr/lib/node_modules:/usr/lib/nodejs';
require('module').Module._initPaths();
process.env.APP_PATH = process.env.APP_PATH || __dirname;

var http = require('http');
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var url = require('url');
var Service = require('webos-service');
var mkvSubtitleExtractor = require('./mkv-subtitle-extractor');
var dictionaryProvider = require('./dictionary-provider');

var service = new Service('com.pyaesone.stremiosb.server');
var ready = false;
var pendingMessages = [];

var ffmpegBin = path.join(__dirname, 'bin', 'ffmpeg');
var ffprobeBin = path.join(__dirname, 'bin', 'ffprobe');
var subtitleProbeCache = Object.create(null);
var subtitleWindowCache = Object.create(null);
var BITMAP_SUBTITLE_CODECS = { hdmv_pgs_subtitle: true, dvd_subtitle: true, dvb_subtitle: true, xsub: true };

function pruneCache(cache, maxEntries) {
    var keys = Object.keys(cache);
    if (keys.length <= maxEntries) return;
    keys.sort(function(a, b) { return (cache[a].at || 0) - (cache[b].at || 0); });
    while (keys.length > maxEntries) delete cache[keys.shift()];
}

function probeTextSubtitleStreams(mediaUrl, callback) {
    var cached = subtitleProbeCache[mediaUrl];
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) return callback(null, cached.streams);
    childProcess.execFile(ffprobeBin, ['-v','error','-select_streams','s','-show_entries','stream=index,codec_name,codec_long_name:stream_tags=language,title','-of','json',mediaUrl], { timeout: 30000, maxBuffer: 2 * 1024 * 1024 }, function(err, stdout, stderr) {
        if (err) return callback(new Error((stderr || err.message || 'ffprobe failed').trim()));
        var parsed;
        try { parsed = JSON.parse(stdout || '{}'); } catch (e) { return callback(e); }
        var streams = Array.isArray(parsed.streams) ? parsed.streams.filter(function(stream) {
            var codec = String(stream.codec_name || '').toLowerCase();
            return codec && !BITMAP_SUBTITLE_CODECS[codec];
        }) : [];
        subtitleProbeCache[mediaUrl] = { at: Date.now(), streams: streams };
        pruneCache(subtitleProbeCache, 8);
        callback(null, streams);
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
    } catch (error) {
        res.writeHead(500, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify({found:false,error:String(error && error.message || error || 'Dictionary lookup failed').slice(0,500)}));
    }
}

function serveMkvSubtitleCues(req, res) {
    var query = url.parse(req.url, true).query || {};
    var mediaUrl = typeof query.from === 'string' ? normalizeMkvMediaUrl(query.from) : '';
    var trackOrdinal = parseInt(query.track, 10);
    var time = parseFloat(query.time);
    if (!/^https?:\/\//i.test(mediaUrl)) { res.writeHead(400, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({error:'Unsupported media URL'})); }
    if (!isFinite(trackOrdinal) || trackOrdinal < 0) trackOrdinal = 0;
    if (!isFinite(time) || time < 0) time = 0;
    mkvSubtitleExtractor.extractWindow(mediaUrl, trackOrdinal, time).then(function(result) {
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify(result));
    }).catch(function(error) {
        res.writeHead(502, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify({error:String(error && error.message || error || 'MKV extraction failed').slice(0,500)}));
    });
}

function serveEmbeddedSubtitleWindow(req, res) {
    var query = url.parse(req.url, true).query || {};
    var mediaUrl = typeof query.from === 'string' ? query.from : '';
    var track = parseInt(query.track, 10);
    var start = parseFloat(query.start);
    var duration = parseFloat(query.duration);
    if (mediaUrl.charAt(0) === '/') mediaUrl = 'http://127.0.0.1:8080' + mediaUrl;
    if (!/^https?:\/\//i.test(mediaUrl)) { res.writeHead(400, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Unsupported media URL'); }
    if (!isFinite(track) || track < 0) track = 0;
    if (!isFinite(start) || start < 0) start = 0;
    if (!isFinite(duration) || duration < 30) duration = 180;
    duration = Math.min(duration, 300);
    probeTextSubtitleStreams(mediaUrl, function(probeErr, streams) {
        if (probeErr) { res.writeHead(502, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Subtitle probe failed: ' + probeErr.message.slice(0,300)); }
        if (!streams.length || !streams[track]) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('No usable embedded text subtitle track ' + track); }
        var stream = streams[track];
        var cacheKey = mediaUrl + '\n' + stream.index + '\n' + Math.floor(start) + '\n' + Math.floor(duration);
        var cached = subtitleWindowCache[cacheKey];
        if (cached) { res.writeHead(200, {'Content-Type':'text/vtt; charset=utf-8','Cache-Control':'no-store','X-Subtitle-Bridge-Offset':String(start),'X-Subtitle-Bridge-Codec':String(stream.codec_name || '')}); return res.end(cached.body); }
        var args = ['-nostdin','-hide_banner','-loglevel','error'];
        if (start > 0) args.push('-ss', start.toFixed(3));
        args.push('-i',mediaUrl,'-t',duration.toFixed(3),'-map','0:' + String(stream.index),'-vn','-an','-c:s','webvtt','-f','webvtt','pipe:1');
        childProcess.execFile(ffmpegBin, args, { timeout: 45000, maxBuffer: 8 * 1024 * 1024 }, function(err, stdout, stderr) {
            if (err) { res.writeHead(502, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Subtitle extraction failed: ' + String(stderr || err.message || '').trim().slice(0,300)); }
            var body = String(stdout || '');
            if (body.indexOf('WEBVTT') !== 0) body = 'WEBVTT\n\n' + body;
            subtitleWindowCache[cacheKey] = { at: Date.now(), body: body };
            pruneCache(subtitleWindowCache, 12);
            res.writeHead(200, {'Content-Type':'text/vtt; charset=utf-8','Cache-Control':'no-store','X-Subtitle-Bridge-Offset':String(start),'X-Subtitle-Bridge-Codec':String(stream.codec_name || '')});
            res.end(body);
        });
    });
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
    if (req.method === 'GET' && urlPath === '/subtitle-bridge/embedded.vtt') return serveEmbeddedSubtitleWindow(req, res);
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
