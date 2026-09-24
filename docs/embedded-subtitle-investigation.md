# Embedded subtitles: first-load lifecycle repair

Baseline: `f7d9bad57161dde5c0260ee8775e408e66e99249` on
`feat/issue-1-embedded-subtitle-cue-poc`. No TV install was performed for this change.

## Evidence and upstream comparison

The reported real TV enumerates seven tracks and selects `EMBEDDED_2`. LG renders
the subtitle, but `video.textTracks.length === 0` and no usable `subtitleData`
arrives. This proves native display works; it does not prove JavaScript can read
the embedded text. `lgPipe:wait` means no `sourceInfo` was observed, not necessarily
that the subscription was rejected. Silent subscriptions must not be continually
cancelled on that basis.

Compared the pinned Vidaa bundle (`208d437e5138adff0865443a2a88c4fcee84ece6`)
with [official WebOsVideo](https://github.com/Stremio/stremio-video/blob/8d9fa11634b7c9db18cc3ddb217191263a74de44/src/WebOsVideo/WebOsVideo.js)
(upstream master inspected September 24, 2026). Official code now keeps
`pendingSubtitlesEnabled`, calls `applyPendingSubtitlesToggle()`, rejects the
`<invalid mediaId>` sentinel, and polls every 300 ms until a valid ID exists.
It clears pending state when sending, rather than retrying a rejected command.
The old Vidaa `E()` simply drops the request if `mediaId` is missing and accepts
the invalid sentinel. Upstream still waits 500 ms for `selectTrack` and calls the
same completion callback for success and failure; copying that literally would
retain incorrect success reporting.

Reviewed the base embedded patcher, v106, v107, external patcher, native/audio
patches, build wiring, existing tests, extraction service, and subtitle commit
history. Findings:

- v107 marks a selection applied before calling `V()`, which clears that mark.
  Subsequent updates can reselect and clear cues repeatedly.
- v107 gates subscription on metadata, forces resubscription during selection,
  and treats absent `sourceInfo` as failure. Its scheduled retries can outlive
  playback, and regular updates can bypass the apparent eight-attempt bound.
- Original delayed selection callbacks can affect a new track or stream, and
  report success even when LG rejects selection.
- External subtitles still consume the first Up despite the embedded handler's
  two-press behavior. Held-key repeats can also act as the second press.
- The FFmpeg path has already failed on the TV. Its HTTP timeout does not cancel
  the longer server process, and filtered ffprobe ordering is not proof of LG
  track ordering. This change does not claim to fix extraction.
- `/subtitles.vtt?from=<movie>` is invalid for this use. Historical v106 inserts
  it, v107 removes it, and a final-bundle assertion prevents it from shipping.

## Implemented behavior

The v108 patch runs after both embedded and external patches. A readable,
independently tested lifecycle function is embedded into the generated adapter.
It polls at 100 ms during playback, subscribes when the first valid media ID is
observed (without waiting for metadata), then selects and enables subtitles in
acknowledged order. Explicit failures or missing command callbacks retry at most
eight times; silence on an existing subscription does not trigger cancellation.
There is no JavaScript mediaId-change event, so detection is within a polling
interval or an existing update, not synchronously at the native assignment.

Selection/off intents survive missing media IDs. Repeated updates do not reselect
an acknowledged track. Session/command tokens reject stale callbacks; unload and
destroy cancel subscriptions and both lifecycle and legacy load timers. Native
styling calls are retained. Selection hides native text temporarily and exit
restores it without changing the user's paused/running state.

Both embedded and external handlers pass the first Up to Stremio. A distinct
second Up within 3.5 seconds selects available words. A held repeat does not count.
With no readable cue, navigation passes through and playback continues; it does
not invoke the known-failing extractor or pause later on an unrelated cue.
The extraction endpoint remains in the service for separate investigation, but
normal navigation no longer calls it. No OCR or automatic external-track choice
is introduced by this lifecycle repair.

The latest user request overrides PRD sections 3.3/13's single-Up behavior.

## Validation and one TV test

Local validation used the entire pinned frontend archive, all four existing
unified patches, all subtitle patchers in build order, final JavaScript parsing,
and executable tests with fake Luna callbacks/timers. Tests cover pre-metadata
subscription, invalid IDs, select/enable failures, silent subscriptions, bounded
retries, off and track changes, mediaId changes, unload/reopen, stale callbacks,
cue clear events, both key handlers, and construction/dispatch of the generated
adapter. `make test` and the existing POC CI packaging job run these tests.
These are simulations, not proof that a TV exposes cues.

After CI produces the combined 1.0.8 package, install it once and check:

1. Cold-open the same stream and wait for dialogue without reopening. Confirm
   the expected embedded track and native subtitle visibility.
2. First Up must focus normal Stremio Play/Pause; second Up enters words only if
   readable cues exist. Back restores the previous paused/running state.
3. Switch embedded tracks, turn subtitles off/on, and reopen another stream.
   Check that no old track or cue reappears and native subtitles remain usable.
4. Try an external subtitle: the same two-press behavior must apply.
5. Record whether `lgCue` ever becomes `yes` or `textTracks` becomes nonzero.
   If both remain unavailable despite reliable native display, early subscription
   has not exposed text on this TV. Do not iterate more timing/debug-only builds;
   investigate a supported extraction path/track mapping or external text fallback
   as a separate implementation with its own local tests.

Remaining limits: no hardware validation, no proven embedded cue access on this
TV, no completed FFmpeg repair or automatic addon fallback. Runtime retry errors
remain visible in the existing diagnostic field; this is still a POC.
