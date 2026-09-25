'use strict';
// Run the actual bundled wrappers with real DOM and browser timers. Only the
// TV-specific Luna service and network media response are substituted.
const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({
        headless: true,
        ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {})
    });
    try {
        const page = await browser.newPage();
        // Leave media pending: this test checks load dispatch, not codec support.
        // No request is sent to this synthetic URL or any real movie server.
        await page.route('http://127.0.0.1:11470/**', () => {});
        await page.addScriptTag({ path: path.resolve(process.argv[2]) });
        const result = await page.evaluate(async () => {
            const modules = self.webpackChunkstremio_theater[0][1], cache = {};
            function requireModule(id) {
                if (cache[id]) return cache[id].exports;
                const module = cache[id] = { exports: {} };
                if (!modules[id]) throw new Error('Missing bundled module: ' + id);
                modules[id].call(module.exports, module, module.exports, requireModule);
                return module.exports;
            }
            requireModule.g = window;
            requireModule.nmd = module => module;
            requireModule.d = (exports, definitions) => Object.keys(definitions).forEach(key =>
                Object.defineProperty(exports, key, { get: definitions[key] }));
            requireModule.r = exports => Object.defineProperty(exports, '__esModule', { value: true });
            window.webOS = { service: { request() { return { cancel() {} }; } } };
            requireModule(3020).set('webOS');
            const WebOsVideo = requireModule(8803);
            const Player = requireModule(8131)(requireModule(1222)(WebOsVideo));
            const container = document.createElement('div');
            document.body.appendChild(container);
            const player = new Player({ containerElement: container });
            const errors = [];
            player.on('error', error => errors.push({ code: error.code, message: error.message,
                cause: String(error.error), stack: error.error && error.error.stack }));
            WebOsVideo.manifest.props.forEach(propName => player.dispatch({ type: 'observeProp', propName }));
            const url = 'http://127.0.0.1:11470/bc2882acbbfac2b4f1c48108b00860d8c46c1cd6/0?';
            player.dispatch({ type: 'command', commandName: 'load', commandArgs: {
                platform: 'webOS', stream: { url }, streamingServerURL: 'http://127.0.0.1:8080', autoplay: false
            } });
            // Flush conversion promises, including errors caught by withStreamingServer.
            await new Promise(resolve => window.setTimeout(resolve, 50));
            const video = container.querySelector('video');
            const loadedURL = video && video.getAttribute('src');
            let cleanupError = null;
            try {
                player.dispatch({ type: 'command', commandName: 'unload' });
                player.dispatch({ type: 'command', commandName: 'destroy' });
            } catch (error) { cleanupError = String(error); }
            return { errors, url, loadedURL, cleanupError };
        });
        assert.deepStrictEqual(result.errors, [], 'Actual bundled player failed: ' + JSON.stringify(result.errors));
        assert.strictEqual(result.loadedURL, result.url, 'Direct URL must reach WebOsVideo unchanged');
        assert.strictEqual(result.cleanupError, null, 'Browser timer cleanup must not throw');
        console.log('PASS: real Chromium DOM/timers, streaming-server + HTML-subtitle + WebOsVideo wrappers, unchanged direct URL, unload/destroy');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
