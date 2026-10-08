# LG webOS dictionary expansion — v1.0.24

## Purpose

Extend the previous 30,000-word/3,000-phrase offline dictionary with the same validated assets used in the Windows Subtitle Bridge. No changes to TV media playback, indexed Matroska extraction, subtitle rendering, Magic Remote or D-pad interactions are required.

## Source and integrity

The existing frozen 30k dictionary/3k phrase datasets are still pinned to desktop commit
\`f875a3b5a52be294f27e5d6907c86c253f494714\`.

The extension files are downloaded at the **desktop merged PR #80 commit**
\`91cb213a7f0e77018ff7fc14ec6e93c40d872fba\` and **checked for exact SHA-256 before compacting**:

| File | Entries | Source SHA-256 |
| --- | ---: | --- |
| dictionary-extension.json | 10,000 | 2c0818ba6d5d835af2a28a5d2a98c0a96b6414d0af2c252bf9caf32a1bc16086 |
| phrases-extension.json | 1,000 | 26a932d88b8bda52638de7eaf2bc1adb78e0b36099250fa8523f550853ffbb85 |
| dictionary-extension-corrections.json | 19 | a12cd2cffe7da1ee3d43f7f8757b410df73dbfbf908bf4c199585adea8c9d145 |

Source: [Desktop dictionary expansion](https://github.com/PyaeSoneHtun-98/stremio_dictionary/blob/91cb213a7f0e77018ff7fc14ec6e93c40d872fba/docs/DICTIONARY_EXPANSION.md).
The dataset repository maintains immutable frozen v1 datasets and separate extension batches. The zipped lookup exclusion indexes are **not** translation payloads.

## Runtime integration

- 30,000 frozen entries + 10,000 extension entries + 11 nonoverlapping core entries = **40,011 distinct available headwords**.
- Five core heads (\`go\`, \`love\`, \`run\`, \`see\`, \`wait\`) are explicitly reconciled with reviewed extension corrections; unknown overlaps fail closed.
- The 19 corrections preserve original extension forms and subtitle-friendly senses for \`went\`, \`ran\`, \`can\`, \`die\`, \`let\`, etc.
- 3,000 frozen phrases + 1,000 extension phrases = **4,000 phrases**.
- Indexing phrases now uses actual subtitle tokenizer word boundaries. For example, \`went pear-shaped\` creates three clickable word tokens, and \`bird's-eye view\` retains its original canonical display text.
- As before, phrase matching precedes single-word lookup; canonical heads precede forms and legacy aliases.
- Source JSON is compacted inside the build artifact to keep IPK footprint controlled. All data remains offline at runtime.

## Automated verification

\`make package\` verifies exact downloaded data digests, schema/counts, all 16,361 extension head/form keys, 11,509 stored phrase variants from every clicked token, correction semantics, canonical precedence, runtime heap/lookup bounds, and existing full player lifecycle/buffer/extraction/Chromium coverage.

LG hardware acceptance of v1.0.24 remains distinct from CI; v1.0.22 was the last long-session real-TV acceptance reported before this dictionary-only expansion.
