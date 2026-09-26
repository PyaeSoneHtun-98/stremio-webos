# LG webOS performance audit (v1.0.22)

This audit covers the webOS shell, generated Vidaa/Stremio player, Subtitle Bridge embedded and addon paths, dictionary service, Matroska extractor, caches, build inputs, and package layout. The v1.0.17 indexed Matroska path remains the embedded fast path.

## Measurements

- The pinned dictionary and phrase datasets contain 30,000 and 3,000 entries and occupy 10,359,666 bytes as compact JSON.
- In a forced-GC Node benchmark, loading, parsing, and indexing both datasets used 19,550,920 bytes of heap and 40,763,392 bytes of RSS. The previous provider used 21,288,720 bytes of heap and 42,123,264 bytes of RSS in the same benchmark. Initialization was 132 ms and 100,000 representative lookups took 141 ms.
- A full 2,048-window cache occupied about 770 KB with representative ASS cues. The old global linear coverage scan performed 100,000 lookups in 14,010 ms. Bucket-indexed coverage performed the same lookups in 27 ms on the development machine.
- The generated v1.0.22 bundle is checked in real Chromium. A stress run covering 600 cue/time updates, repeated seeks and subtitle-track changes, and 40 title switches finished with the same 13 tracked listeners, zero intervals, zero timeouts, and four DOM nodes as its warmed baseline.
- The stable LG media lifecycle now polls at 1,000 ms instead of 100 ms. It immediately returns to 100 ms while a media ID, track selection, enable command, or retry is pending. This changes the steady-state rate from 36,000 to 3,600 ticks per hour without changing first-load command ordering.

The service exposes `/subtitle-bridge/diagnostics` for one real-TV acceptance session. It reports process memory, cache entries and estimated bytes, request averages, Matroska range count/bytes, metadata and cue-index reuse, cancellations, and dictionary initialization cost. The player exposes `window.__subtitleBridgePerformance()` for DOM and interaction-layer counts. The debug overlay remains hidden by default and no longer formats text while hidden.

## Cache policy

- MKV cue windows retain up to 2,048 current-title entries for instant seeks, with a 4 MiB byte ceiling and four-hour TTL. Coverage lookup is bucket-indexed. Loading another movie or episode clears windows and cancels old inflight/prefetch requests. Multiple tracks from the current title may coexist so track switching remains fast.
- Exact active cues retain up to 512 current-title entries, with a 1 MiB ceiling and 30-minute TTL. Expired entries are removed during lookup; title changes clear the cache.
- Matroska metadata and the cue index retain only the active title in normal service use. A title change cancels incomplete metadata/index range requests and drops prior-title references.
- Dictionary indexes remain lazy. The duplicate exact-headword map and combined entry-array copy were removed; dataset coverage, forms, aliases, phrase variants, and longest-phrase matching remain intact.

## Runtime changes

- Hidden embedded/addon debug string and DOM work is gated behind the debug toggle.
- The embedded public diagnostic object is mutated rather than replaced on every time update.
- The embedded Magic Remote portal timeout is refreshed at most once per 750 ms while the pointer moves.
- Addon pointer-move handlers that repeatedly queried menu layout were removed. The existing always-ready word hit layer still handles direct Magic Remote clicks. Menu synchronization timeouts are deduplicated and cleared on destroy.
- The obsolete FFmpeg embedded-subtitle HTTP endpoint and its probe/window caches were removed. Bundled FFmpeg and ffprobe remain because the official Stremio server needs them for playback, remuxing, and transcoding.
- Generated `.orig` patch backups are removed before packaging; they duplicated 2.69 MB of frontend JavaScript and were never loaded.
- The transient version badge removes its DOM node after fading.

## Automated coverage

Cache tests cover shared requests, byte and entry ceilings, current-title revisits, title switches, seek cancellation, and prefetch reuse. Extractor tests cover indexed blocks, sparse ranges, retry, cancellation, active cues, blank gaps, and cluster fallback. Generated-bundle tests retain playback URL/load-order, native LG selection, addon interaction, tokenization, dictionary, phrase, D-pad, Magic Remote, popup, and settings-layer behavior. Chromium tests cover playback dispatch plus long-session listener, timer, and DOM bounds. CI packages the IPK and publishes a machine-readable package resource report alongside it.

## Remaining hardware risk

Chromium and Node cannot reproduce LG's exact JavaScript heap, compositor, media pipeline, or Luna service cost. The diagnostic endpoints therefore avoid guesses about TV memory and make one long real-TV session sufficient to check cold startup, memory after seeks/title changes, interaction readiness, and playback stability. FFmpeg/ffprobe dominate package size but are retained for Stremio compatibility.
