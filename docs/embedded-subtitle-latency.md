# Embedded subtitle cue latency investigation (v1.0.17)

The desktop reference (`stremio_dictionary/src/main/media/MpvController.ts`) observes mpv IPC `sub-text`, `sub-start/full`, and `sub-end/full`. mpv's own demux pipeline supplies the live cue after a seek. The webOS `<video>` pipeline renders the selected embedded subtitle but does not expose that same text through a known JavaScript property on the tested retail TV.

## Direct LG pipeline investigation

On the tested TV, `EMBEDDED_2` is Matroska track 5 (`S_TEXT/ASS`). Native rendering works while `video.textTracks.length` remains zero. A 35-second raw `com.webos.media/subscribe` capture during changing visible subtitles contained 737 JSON messages: 473 `userDefinedEvent.userDefinedStr` values parsed as `subtitlePosition` only, 175 `currentTime` events, and 87 `bufferRange` events. No returned key or nested event contained cue text. The app was attached to a valid media ID and `lgPipe:ready`, so this is not a subscription timing failure. The existing native-cue path remains preferred if a future TV does expose text.

The [documented `com.webos.media` subscription events](https://www.webosose.org/docs/reference/ls2-api/com-webos-media/#subscribe) do not include a subtitle-text event. LG's [webOS TV developer response](https://forum.webostv.developer.lge.com/t/multi-subtitles-in-video-url/1297) says embedded track selection/text is not an officially supported web-app API. These references do not prove every undocumented retail interface is impossible, but the raw TV payload and JavaScript behavior provide no reliable direct cue source for this model. We did not add another timing probe or alter the working playback lifecycle.

## Container findings and implementation

The bundled Stremio server `/tracks/<media-url>` exposes metadata, not timed subtitle payloads. Its internal Matroska decoder can parse `Cues`, but the earlier window extractor read entire clusters, including video/audio. For the tested 1.8 GB Bleach MKV, the `Cues` element is about 59 KB and contains 2,322 points. Its selected text track has `CueRelativePosition` and `CueDuration`. A position points to the selected `BlockGroup` relative to the cluster **data** start, so the service can fetch the exact block without fetching a multi-megabyte cluster. We retain cluster parsing when an MKV lacks these index fields.

The player now asks `/subtitle-bridge/mkv-active-cue` for the current text first, then fills a short surrounding window from `/subtitle-bridge/mkv-cues`. The active response can make a word selectable without waiting for future subtitle ranges. Metadata and cue indexes are shared across requests; the initial header read is 256 KB, growing to 4 MB only when needed. Windows and active cues use bounded four-hour caches so revisits can be immediate. A distant seek aborts obsolete browser XHRs and their server range requests; distant background prefetch is cancelled. Playback, native subtitle selection/rendering, and dictionary/remote interaction code remain unchanged.

The tested Stremio stream ignored additional ranges in a multipart `Range` header and returned only the first range, so batching disjoint subtitle blocks into one HTTP request is not available on that path. We do not use `/subtitles.vtt?from=<movie>`, FFmpeg, or a full movie download.

## Measured limit

Correct `EMBEDDED_2` ASS text was extracted from the real Bleach stream through a TV SSH tunnel. In one warm run, an eight-cue indexed window took about 1.3 seconds; a different distant window took about 22 seconds because several sparse range requests stalled. Even a **single active-cue** request sometimes took about 30 seconds through the same stream. These measurements show why separating the current cue helps but cannot guarantee mpv-like or native LG latency: an uncached cue still depends on a separate Stremio HTTP range response, whose delay may be dominated by the stream/torrent source. Returning to a cached cue avoids that range. A real-TV check of v1.0.17 should measure active-cue availability, continued native rendering, and seek behavior without changing the known-good v1.0.16 load lifecycle.

Automated coverage includes indexed and cluster fallback parsing, ASS text/timing, blank cue gaps, cancelled range requests, cache revisits and prefetch cancellation, generated-bundle XHR cancellation, the existing WebOsVideo lifecycle/interaction suite, and Chromium playback dispatch.
