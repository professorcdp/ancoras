# Commit ID map (history rewrite, 2026-10-11)

On 2026-10-11 the history was rewritten to replace the author email with the GitHub noreply
address before the repo went public (decision 0012). Content is unchanged, but every commit ID
changed. The runlog and review notes before that date use the old IDs; this table maps them.

| old | new | commit |
|---|---|---|
| 4581f8d | 115fc0a | Adopt 2nd brain workflow |
| 0bf6a19 | 1f191b8 | M0: load, validate and browse anchors.json |
| 1ac38a3 | f27ba49 | Harden validator against bad data; add checker tests |
| 6a4ab2e | 7a9140d | M1: session picker, Meet and Transfer steps, grading |
| 9d76314 | 05e398e | Add serve.mjs: serve the app on a free port |
| aa5fb48 | 3f733af | Stable serve port; ignore empty answers (review of 0bf6a19..9d76314) |
| e3657a4 | 581b899 | Echo rule (decision 0006) and echo pt check |
| 1563c27 | 279b7e3 | Ask before leaving a session in progress |
| 9017532 | 633dba2 | M2: Recall and Echo steps |
| 3e9a065 | e29919f | Record review of 9d76314..9017532 |
| 2e817c3 | c99de6a | Echo answers' English names the verb; cues name every graded cell |
| 9c99ca9 | 8acef36 | Pure, tested leave-session decision and phase plan |
| 7074ee0 | 0ac7438 | M3: Discriminate step |
| 9d32a2c | d3a8206 | Record review of 3e9a065..7074ee0 |
| 7078a52 | 63cfd2d | Discriminate: only items about the cell's own form are scored |
| 1a14b7d | b72f4eb | M4: mastery tracking, status grid, export/import |
| 494a8ee | 16fc5b1 | Store: keep saved progress safe across tabs and storage problems |
| 180b451 | a508cd8 | M5: pt-PT audio via speech synthesis |
| 1c8ef1d | 8a4e546 | Theme switch: Follow system / Light / Dark |
| f27c67e | ae36c05 | Publish with GitHub Pages; repo renamed ancoras |
| 586853e | 6138777 | No-voice notice: add the Android steps |
