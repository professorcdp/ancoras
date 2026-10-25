# Commit ID map (history rewrites, 2026-10-11 and 2026-10-24)

The history was rewritten twice, so commit IDs quoted in older notes may not exist any more.
Content was otherwise unchanged; this table maps every old ID to the current one.

1. **2026-10-11** (decision 0012): the author email on the first 21 commits was replaced with
   the GitHub noreply address before the repo went public.
2. **2026-10-24** (review of 16fc5b1..97e91be): a personal email address written out in two
   docs was replaced with the words "a personal email address" in every commit, and
   `.vscode/settings.json` (which showed the Mac username path, #35) was removed from every
   commit. Every commit ID changed.

Columns: the original ID (before 2026-10-11), the ID between the two rewrites, and the
current ID. Commits made between the rewrites have no original ID ("—"). **For GitHub
Support:** the old IDs to purge are every value in the first two columns.

| original | 2026-10-11 to 2026-10-24 | current | commit |
|---|---|---|---|
| 4581f8d | 115fc0a | 9338a5b | Adopt 2nd brain workflow |
| 0bf6a19 | 1f191b8 | 7c26002 | M0: load, validate and browse anchors.json |
| 1ac38a3 | f27ba49 | cff1f81 | Harden validator against bad data; add checker tests |
| 6a4ab2e | 7a9140d | 7f9238f | M1: session picker, Meet and Transfer steps, grading |
| 9d76314 | 05e398e | 34690bf | Add serve.mjs: serve the app on a free port |
| aa5fb48 | 3f733af | 6a9ee8a | Stable serve port; ignore empty answers (review of 0bf6a19..9d76314) |
| e3657a4 | 581b899 | 7249bcb | Echo rule (decision 0006) and echo pt check |
| 1563c27 | 279b7e3 | 117687d | Ask before leaving a session in progress |
| 9017532 | 633dba2 | 0c78ccb | M2: Recall and Echo steps |
| 3e9a065 | e29919f | 18c1ed1 | Record review of 9d76314..9017532 |
| 2e817c3 | c99de6a | 9ad8a28 | Echo answers' English names the verb; cues name every graded cell |
| 9c99ca9 | 8acef36 | 2e62914 | Pure, tested leave-session decision and phase plan |
| 7074ee0 | 0ac7438 | 4803aa4 | M3: Discriminate step |
| 9d32a2c | d3a8206 | 2d2b7a3 | Record review of 3e9a065..7074ee0 |
| 7078a52 | 63cfd2d | 3f01390 | Discriminate: only items about the cell's own form are scored |
| 1a14b7d | b72f4eb | fa0f785 | M4: mastery tracking, status grid, export/import |
| 494a8ee | 16fc5b1 | a54c316 | Store: keep saved progress safe across tabs and storage problems |
| 180b451 | a508cd8 | 49227c8 | M5: pt-PT audio via speech synthesis |
| 1c8ef1d | 8a4e546 | b847ba7 | Theme switch: Follow system / Light / Dark |
| f27c67e | ae36c05 | bc5dda8 | Publish with GitHub Pages; repo renamed ancoras |
| 586853e | 6138777 | 86a9687 | No-voice notice: add the Android steps |
| — | d08cf35 | 5576501 | Business project: repo under professorcdp, public; restamped BUSINESS |
| — | 8b839d7 | 88cb8d6 | Every cell gets an anchor: 24 new anchors, no uncovered cells |
| — | 97e91be | b6aae01 | Learner chooses the steps |
| — | 04b5b8a | 32b87d9 | Remove a personal email address from public docs; record review |
| — | 38c2d85 | 3028364 | Runlog: reword so the review entry doesn't name the mail provider |
