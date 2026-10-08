# Subtitle Bridge for Stremio webOS — Product Requirements Document

## 1. Product goal

Modify the Stremio webOS experience so a user can pause on any visible English subtitle word, select it with an LG Magic Remote or D-pad, and see the same English → Burmese dictionary information used by the existing Subtitle Bridge desktop app.

The app should remain recognizably Stremio. This is not a separate general-purpose video player.

## 2. Target platform

- LG webOS TV
- Sideloaded `.ipk`
- No PC required while watching
- Keep Stremio's normal UI and playback flow
- Use Stremio's existing stream/subtitle selection behavior wherever possible

## 3. Core user experience

### 3.1 Subtitle source priority

1. Use the subtitle track Stremio normally auto-selects.
2. Prefer usable embedded text subtitles.
3. If an embedded subtitle is image-based or otherwise cannot provide selectable text, automatically fall back to an available external/addon text subtitle.
4. Do not use OCR for the initial product.

### 3.2 Subtitle rendering

- Preserve original Stremio subtitle styling/settings as closely as practical:
  - size
  - position
  - text color
  - background
  - opacity/outline where available
- Dialogue readability and clickability take priority over preserving complex ASS/SSA effects.
- Every visible dialogue word should be individually selectable/clickable.
- Selected word uses a visible box/highlight similar to the current Subtitle Bridge app.

### 3.3 D-pad behavior

While video is playing and a usable subtitle is visible:

- `↑`:
  - pause playback immediately
  - enter word-selection mode
  - select the first word from the left
- `←` / `→`: move to previous/next word
- `↑` / `↓`: move between subtitle lines when multiple lines are visible
- `OK`: open the translation popup for the highlighted word
- If no subtitle is visible, `↑` does nothing and playback continues

While the translation popup is open:

- subtitle word navigation is suspended
- `Back` closes the popup
- if playback was running before word selection, resume playback
- if playback was already manually paused, keep it paused

### 3.4 Magic Remote behavior

- Pointer hover can highlight/select a subtitle word
- Clicking a word pauses playback immediately and opens the translation popup

## 4. Translation popup

The popup should match the current Subtitle Bridge behavior and visual style rather than being redesigned to look like Stremio.

Placement:

- centered in the middle of the screen

Content:

- selected English word or phrase
- pronunciation text
- grouped parts of speech
- Burmese meanings
- same dictionary data and fallback behavior as current Subtitle Bridge

Not required initially:

- audio pronunciation

## 5. Dictionary behavior

Reuse the existing Subtitle Bridge offline dictionary data.

Current available data:

- 30,000 English headwords
- inflected/form lookup data
- phrase dictionary available for later integration
- pronunciation data available in the current structured entries

Initial priority:

1. single-word lookup
2. phrase lookup after the core TV interaction works reliably

The TV experience must work offline for dictionary lookup once the dictionary data is bundled.

## 6. Embedded subtitles

Embedded subtitles are the highest technical priority.

The first proof-of-concept must determine whether the selected embedded subtitle on real LG webOS exposes usable cue text through the native video/text-track path.

If usable cue text is available:

- suppress/replace the native subtitle display where necessary
- render the current cue as HTML
- split the cue into selectable words
- preserve Stremio styling as closely as practical

If usable cue text is not available:

- document the exact behavior
- move to a server-side/extraction fallback using the bundled Stremio streaming server and FFmpeg/ffprobe where practical

Image-based subtitles such as PGS are not required to become clickable in the initial version. When detected/unusable, fall back to external text subtitles when available.

## 7. External/addon subtitles

External text subtitles are already rendered through Stremio's HTML subtitle path and should be adapted to:

- split dialogue into selectable words
- support pointer and D-pad selection
- preserve Stremio subtitle settings
- support the same translation popup

External subtitle work follows the embedded subtitle proof-of-concept.

## 8. ASS/SSA handling

For ASS/SSA subtitles:

- prioritize readable dialogue text
- prioritize selectable/clickable words
- complex effects, karaoke, positioning, drawings, or advanced styling may be simplified

## 9. Playback behavior

Word selection must not permanently alter normal playback behavior.

Required state tracking:

- whether playback was running before selection
- whether playback was already manually paused
- currently selected word
- currently visible subtitle line(s)
- whether translation popup is open

Closing selection/popup should restore the appropriate playback state.

## 10. Non-goals for the initial version

- OCR for image-based subtitles
- audio pronunciation
- full preservation of advanced ASS visual effects
- replacing Stremio's entire player UI
- watch-progress or continue-watching changes
- new account/login system
- separate standalone Subtitle Bridge TV player

## 11. Technical base

Primary webOS packaging base:

- `PyaeSoneHtun-98/stremio-webos`
- forked from `kieranbrown/stremio-webos`

This base already provides:

- LG webOS app packaging
- bundled Stremio streaming server
- bundled FFmpeg/ffprobe
- Stremio Theater/web frontend
- LG webOS playback integration

Likely upstream code areas involved:

### stremio-video

- `src/WebOsVideo/WebOsVideo.js`
- `src/withHTMLSubtitles/withHTMLSubtitles.js`
- `src/withHTMLSubtitles/subtitlesRenderer.js`
- subtitle parsing/conversion helpers as required

### stremio-web

- `src/routes/Player/useVideo.js`
- `src/routes/Player/useSubtitles.ts`
- new word-selection / translation popup UI and state

The webOS repository currently consumes a built frontend. During implementation we may need to maintain source forks or reproducible patches rather than editing generated/minified bundles manually.

## 12. Development and test strategy

### Fast local testing

Use browser/webOS Simulator for:

- popup UI
- dictionary lookup
- word tokenization
- D-pad navigation
- focus/highlight behavior
- pause/resume state logic

### Real LG TV testing

Required for:

- embedded subtitle cue availability
- native webOS video-track behavior
- real streams
- codec behavior
- Magic Remote pointer behavior
- performance
- final focus/key handling

TV deployment should remain one-command where possible through the existing `make deploy` flow.

## 13. Implementation milestones

### Milestone 1 — Embedded subtitle cue proof-of-concept

- play a stream with an embedded English subtitle
- observe active embedded cue text
- render a temporary HTML subtitle overlay
- split cue into words
- `↑` pauses and selects first word from the left
- `←` / `→` navigate words
- Magic Remote can select a word
- verify on real LG TV

### Milestone 2 — Stable word-selection layer

- multi-line navigation
- selected-word highlight
- reliable pause/resume behavior
- no-subtitle behavior
- cleanup when cue changes

### Milestone 3 — Dictionary popup

- bundle/reuse Subtitle Bridge dictionary
- centered popup
- pronunciation
- parts of speech
- Burmese meanings
- close/resume behavior

### Milestone 4 — External subtitle support

- apply the same selectable-word layer to addon/external subtitles
- automatic fallback when embedded subtitle is not usable text

### Milestone 5 — ASS/SSA readable mode

- simplify styled subtitle content into readable selectable dialogue where needed

### Milestone 6 — Hardening

- performance
- edge cases
- stream switching
- subtitle switching
- release packaging
- real-TV regression tests

## 14. Success criteria

The first usable release is successful when, on a real LG webOS TV:

1. Stremio plays streams normally without a PC.
2. A usable English subtitle is displayed in the normal Stremio style.
3. The user can pause into word-selection mode with `↑`.
4. The first word from the left is selected.
5. The user can navigate words with the D-pad.
6. The user can click a word with the Magic Remote.
7. The selected word opens the Subtitle Bridge-style English → Burmese popup.
8. Closing the popup restores the correct playback state.
9. If an embedded subtitle cannot provide text, an external text subtitle can be used automatically when available.
