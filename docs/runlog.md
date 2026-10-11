# Runlog

Newest entries at the bottom.

## 2026-10-06: Adopted 2nd brain workflow
- **Changed:** started git tracking; added PROJECT.md, CLAUDE.md, docs/runlog.md,
  docs/decisions/ (template + 4 retroactive decisions), .gitignore. Created the private GitHub
  repo and the issue list (milestones M0–M5 plus open items).
- **Issues touched:** created the initial set.
- **Next:** M0, the data check (load and validate `anchors.json`, browsable table).

## 2026-10-06: M0 data check (#1)
- **Changed:** built the static page (`index.html`, `style.css`, `js/main.js`) and the shared
  validator (`js/validate.js`, plus `node validate.mjs` for the command line). The page shows a
  pass/fail banner, a verbs table with each form colored covered / uncovered, and an anchors
  table filterable by verb with target forms highlighted. Both tables stack into cards on phones.
- **Validator checks:** target forms appear in `pt` (whole word, case-insensitive, accents
  significant); unique ids; symmetric confusion sets; targets match the paradigm; every cell
  is covered or in `uncovered_cells` (never both); echo anchors have two `turns`; known kinds.
- **What it found:** nothing. anchors.json OK: 15 verbs, 126 anchors, 117 cells covered
  (+ 25 listed uncovered = all 142 cells). No data edits were made.
- **Issues touched:** #1 closed.
- **Next:** M1 (#2): session picker, Meet and Transfer steps, grading, accent buttons.

## 2026-10-06 (review)
- **Reviewed:** 4581f8d..0bf6a19
- **Verdict:** Sound work with nothing urgent; crash-on-bad-data and missing checker tests to fix before M1.
- **Findings:** Should fix: (1) null entries crash checker / page stuck on Loading; (2) no tests of the checker. Could fix: (3) echo pt vs turns not checked; (4) verb can list itself in confusion_set; (5) highlighter duplicates the match rule and skips NFC normalising. Note for M2: in 10 of 13 echo anchors the id's cell is only in the question turn.
- **Fixed:** (1) `validate()` now skips null or wrong-shaped verbs, anchors, targets and top-level fields and reports them (e.g. "anchor vir-pres-eu-1: target #2 is not an object"); the page wraps rendering so any unexpected error shows a red banner instead of "Loading…", and skips bad entries when drawing tables. (2) Added `test/validate.test.mjs` (run with `node --test`, no dependencies): a valid sample, one broken case per rule, the null cases, and a check that the real anchors.json passes. 15 tests pass; the 4 null-case tests fail against the old checker, as they should.
- **Deferred:** (3) #9, (4) #10, (5) #11, M2 echo note #12.
- **Next:** decide #12 and do #9 before M2; start M1 (#2).

## 2026-10-06: M1 session picker, Meet and Transfer (#2)
- **Changed:** the front page is now the session picker (verbs with confusion-set presets
  derived from the data, tenses, persons, live cell count, last selection remembered in
  localStorage). Sessions run Meet for every cell, then Transfer (sentence from another anchor
  → `transfer` list → bare prompt; form blanked by the validator's whole-word rule; accent
  buttons; correct / almost / wrong with the Meet anchor as hint), then a summary. A miss
  comes round once more. M0 tables moved to `js/data-view.js`, behind the "Data" link.
  New modules: `js/grade.js`, `js/session.js` (both pure), `js/picker.js`, `js/practice.js`,
  `js/dom.js`, `js/audio.js` (silent stub for M5). No changes to anchors.json.
- **Tests:** `node --test` now runs 45 tests (15 validator, 17 grading, 13 session) — all
  pass; `node validate.mjs` OK. Checked in the browser: presets and counts, reload keeps the
  selection, a corrupt stored selection falls back to defaults, a full vir+ver session
  (20 cells, misses retried once, summary), broken data disables Start, phone width.
- **Decisions:** 0005 (M1 session shape).
- **Issues touched:** #2 closed. Opened #13: 85 of 117 cells have no second sentence, so
  Transfer shows the bare prompt for most cells (worst for dar, ir, estar, ter, ser).
- **Next:** decide #12 and do #9, then M2 (#3). #13 needs Jim's call on content.

## 2026-10-09: Start-up script on a free port (#14)
- **Changed:** added `serve.mjs` (Node, no dependencies): serves the folder with correct
  Content-Type (incl. `text/javascript` for modules), `Cache-Control: no-store`, localhost only
  (127.0.0.1 and ::1), 404 for missing and hidden files, refuses paths outside the folder.
  Tries port 8000, then 8001…8020 (or from a port given as the first argument); before
  claiming a port it checks nothing already answers there, so a server bound to all addresses
  (e.g. python http.server) isn't shadowed. Prints the address and opens it in the browser
  (`--no-open` to skip). CLAUDE.md "Run locally" and the load-error hint in js/main.js now say
  `node serve.mjs`.
- **Checked:** with python on 8000, two copies of `serve.mjs` landed on 8001 and 8002 and
  said so; the app loaded from 8002 with no console errors and a session started; headers,
  404s, `..` paths, `.git/`, a custom port, a bad port argument and all-ports-busy all behave.
  The browser-opening step wasn't exercised (tests used `--no-open`). `node --test` 45/45,
  `node validate.mjs` OK.
- **Issues touched:** #14 closed.
- **Next:** decide #12 and do #9, then M2 (#3). #13 still needs Jim's call on content.

## 2026-10-09 (review)
- **Reviewed:** 0bf6a19..9d76314
- **Verdict:** Sound; nothing must-fix. Port-scoped localStorage to fix before M4.
- **Findings:** Should fix: (1) port-scoped localStorage — saved selection (and later M4 mastery) splits across localhost:8000, :8001, … because serve.mjs hops ports; (2) an empty answer is graded wrong and uses up the first attempt. Could fix: (3) Data link visible during practice, Back/Data drops the session with no warning (js/main.js:15-21); (4) orderCells leaves same-verb neighbours in ~46% of ter+estar sessions though alternation is always possible (js/session.js:139-150; test only covers vir+ver); (5) serve.mjs Content-Length from stat before streaming can truncate a file saved mid-request, and its path rules have no automated test.
- **Fixed:** (1) `serve.mjs` now defaults to port 4791 (uncommon, so rarely busy); if it has to fall back (4792–4811) or is given another port, it prints a warning that saved settings and progress live on 4791. CLAUDE.md "Run locally" updated. Note: the selection saved on :8000 doesn't carry over; pick it once more on :4791. (2) Submitting an empty box (or only spaces/punctuation) does nothing and keeps focus in the input; uses the existing tested `normalize()`, so no new pure function or test. Checked in the browser with real keystrokes; `node --test` 45/45, `node validate.mjs` OK.
- **Deferred:** (3) #15, (4) #16 (measured 48% over 5000 runs; pôr+poder repeats are unavoidable, 10 vs 6 cells), (5) #17.
- **Next:** decide #12 and do #9, then M2 (#3). #15 before M4. #13 still needs Jim's call on content.

## 2026-10-09: Echo pairs credit both turns (#12) and echo pt check (#9)
- **#12 decided (Jim with the advisor):** Echo (M2) tests the targets in the answer turn;
  cells whose form is only in the question skip Echo. SPEC §6 step 3 reworded; decision 0006.
- **Data finding:** the planned data change was not needed. The brief expected 12 answer-turn
  forms to be missing from `targets` (venho, vim, vi, vimos, fui ×2, foi, estive, pus, fiz,
  fez, trouxe); all of them have been listed since the first commit, with homographs already
  assigned by meaning (vimos → ver.pps.nós; fui/foi → ser). The earlier review note ("in 10
  of 13 echo anchors the id's cell is only in the question turn") was true of the id's cell,
  not of the targets. anchors.json unchanged; nothing to remove from `uncovered_cells`.
  Under the rule, Echo will test 13 cells and skip 9 question-only (mostly tu) cells.
- **Transfer:** unchanged, still 85 of 117 cells on the bare prompt (#13 not updated). vir.pres.eu
  and vir.pps.eu already draw their echo sentences; confirmed in a vir+ver session.
- **#9 validator rule:** for `kind: "echo"`, `pt` must equal `turns[0] + " — " + turns[1]`
  (space, em dash, space; confirmed on all 13 echo anchors). Validator checks are now: target
  forms appear in `pt` (whole word, case-insensitive, accents significant); unique ids;
  symmetric confusion sets; targets match the paradigm; every cell is covered or in
  `uncovered_cells` (never both); echo anchors have two `turns` **and `pt` equals them joined**;
  known kinds; malformed entries reported, not crashed on.
- **Tests:** `node --test` 47/47 (2 new: echo pt passing and failing case; the failing case
  fails against the old validator). `node validate.mjs` OK.
- **Issues touched:** #12 and #9 closed.
- **Next:** M2 (#3). #15 before M4. #13 still needs Jim's call on content.

## 2026-10-09: Leaving a session asks first (#15); M2 Recall and Echo (#3)
- **#15:** the Data link is hidden during practice; a session gets its own history entry so
  Back returns home; Back, "End session" and the title link ask before abandoning an
  unfinished session (Cancel keeps the current item); from the summary they go home without
  asking. Checked in the browser, incl. after "Practise again". Separate commit.
- **M2:** sessions now run Meet → Recall → Echo → Transfer → summary (decision 0007). Recall
  asks for the Meet anchor's whole phrase from its English (the whole exchange for echo
  pairs); Echo shows the question of an echo pair whose answer contains the cell's form and
  asks for the answer. Both grade with the new `gradePhrase()` (js/grade.js): strict on target
  forms, lenient elsewhere; punctuation becomes a space so hyphenated clitics (Vai-se,
  Dou-te, foi-se) still count. New `pickEchoAnchor()` and `formsIn()` in js/session.js. All
  graded steps share one input / accent / empty-answer / one-retry routine in js/practice.js.
  Summary has Recall, Echo and Transfer columns; the headline counts Transfer first tries.
  SPEC §6 step 2 updated. No change to anchors.json.
- **Session length:** a full vir+ver session (20 cells) is now at least 65 screens: 20 Meet +
  20 Recall + 5 Echo + 20 Transfer, plus one per miss (my test run with 4 misses: 69).
  Opened #18 (question): let the picker choose which steps to run.
- **Tests:** `node --test` 61/61 (14 new: gradePhrase incl. echo with/without dash, contrast
  with one form wrong, clitics, empty; pickEchoAnchor incl. a question-only cell → none,
  ver.pps.nós → ver-pps-eles-1, exactly the 13 cells of decision 0006). `node validate.mjs` OK.
  Browser: vir+ver ran Meet 20, Recall 20+3, Echo 5+1, Transfer 20; echo cells show both
  turns' English in Recall and only the question in Echo; question-only tu cells get no Echo;
  the "Vim, vi e venci" contrast is graded on both forms; Back mid-session asks; phone width.
- **Issues touched:** #15 and #3 closed; opened #18.
- **Next:** M3 (#4), Discriminate. Jim: run /second-opinion in a new chat on these commits.

## 2026-10-09 (review)
- **Reviewed:** 9d76314..9017532
- **Verdict:** Sound; nothing must-fix. Echo-pair English glosses omit the graded verb.
- **Findings:** Should fix: (1) echo anchors' answer English omits the verb that Recall and Echo grade (e.g. "From Porto." → "Venho do Porto."; "Me." → "Fui eu."), so a natural answer is marked wrong; in Recall the cue line names the question's cell, not the answer's; (2) no automated tests for the leave-session/Back logic (js/main.js:75-95) or the phase chaining in js/practice.js. Could fix: (3) reload or closing the tab mid-session gives no warning (no beforeunload); (4) after leaving via Back, Forward lands on a dead history entry that shows home, and if the browser suppresses dialogs, confirm() returns false so Back/title link can't leave a session; (5) stale comment on requeue (js/session.js:169) says "After a Transfer answer".
- **Fixed:** none (no must-fix items).
- **Deferred:** (1) #19 (confirmed against the data: 12 of 13 echo answers' English omits the verb; full table in the issue), (2) #20, (3)+(4) #21, (5) #22.
- **Next:** Jim to choose the approach for #19; then M3 (#4), with #20 before M4 (#5).

## 2026-10-09: Echo English (#19, #22); leave/phase tests (#20); M3 Discriminate (#4)
- **#19 (+#22):** reworded the answer half of `en` for the 13 echo anchors so it names the
  verb ("From Porto." → "I come from Porto.", "Me." → "It was me.", …); only those 13 `en`
  lines changed. Recall's and Echo's cue lines now name every graded cell ("tu + eu · vir ·
  present", "eu · ver + vir · PPS") via `describeCells()`/`targetsIn()`. Fixed the stale
  requeue() comment. Browser: Recall on vir-pres-tu-1 shows the new English; the full
  exchange grades correct there, and "Venho do Porto" grades correct in Echo (vir.pres.eu).
  (In Recall, which grades both vens and venho, the answer half alone is a miss, by design.)
- **#20:** `decideLeave()` (ask / leave / stay, plus what to do with the history entry) and
  `planPhases()`/`runPhases()` (phase order, empty phases left out, last-cell hand-off) are
  pure in js/session.js; main.js and practice.js call them. 7 new tests. Back / End / title /
  summary re-checked in the browser: unchanged.
- **M3 (decision 0008):** Discriminate runs after Echo, 5 tap items per cell of a verb with a
  confusion set, alternating "which verb?" (never for a form shared within the set, derived
  from the data) and "which form?" (cue person · verb (gloss) · tense). Interleaved across
  cells; a correct tap moves on after ~600 ms, a wrong one shows the answer and waits for
  Next; no retries. Summary column "n/5". Found while building: **ir/ser PPS cells get no
  Discriminate items** (identical forms make both kinds impossible); ir/ser present cells
  get both kinds, so an ir+ser session shows both kinds, not only "which form?" as planned.
  Glosses with their own brackets show as "estar, to be (state/location)".
- **Tests:** `node --test` 77/77 (63 → 70 → 77); the shared-form rule was mutation-checked
  (3 tests fail with it switched off). `node validate.mjs` OK.
- **Browser:** ter+estar showed both kinds (95 items); ir+ser showed 50 items from the
  present cells only; auto-advance on correct, Next on wrong; summary column; phone width;
  leaving during the auto-advance pause doesn't advance the old session; no console errors.
- **Session length:** full presets are now 107–165 screens before retries (vir+ver 165: 100
  of them Discriminate taps). Numbers added to #18.
- **Issues touched:** #19, #22, #20, #4 closed; commented on #18.
- **Next:** M4 (#5). Jim: run /second-opinion in a new chat on 3e9a065..HEAD; decide #18.

## 2026-10-09 (review)
- **Reviewed:** 3e9a065..7074ee0
- **Verdict:** Sound; nothing must-fix. Discriminate files "which verb?" taps about another verb's form under the session cell; settle before M4.
- **Findings:** Should fix: (1) Discriminate credits each tap to the session cell even when the item is about a different verb's form (js/session.js:282-296; tally js/practice.js:249). E.g. ver.pps.nós gets "viemos→vir" for 3 of its 5 items and never its own form. SPEC §8 builds streak from these taps in M4, so a cell could advance on another verb's form. (2) The Discriminate tap tally lives in js/practice.js and is untested; M4 will store it, so it should be a pure, tested function in js/session.js. Could fix: (3) a partial score like 4/5 uses the same red "missed" style as 0/5 (js/practice.js:307); (4) identical "which verb?" questions are generated by both cells of a confusable pair (e.g. "vens → vir" from vir.pres.tu and ver.pres.tu), and interleave() can place them back to back (adds to #18); (5) after a correct tap, keyboard focus stays on a removed button (js/practice.js:256), unverified.
- **Fixed:** none (no must-fix items).
- **Deferred:** (1) #23 (bug, now; blocks M4, needs Jim's decision; checked: 22 of 60 "which verb?" items in a vir+ver session are about the other verb), (2) #24, (3) #25, (4) #26 (checked: 18 duplicate questions in a vir+ver session; linked to #18), (5) #27 (to be checked in the browser first).
- **Next:** Jim decides #23 (credit by the form shown, or count only the cell's own form); then M4 (#5) with #24.

## 2026-10-09: Discriminate scoring (#23, #24, #25); M4 mastery (#5)
- **#23 (decided, decision 0008 amended):** only Discriminate items about the cell's own form
  count (`counts` on each item): its "which form?" items and "which verb?" items showing its
  own form; "which verb?" items about a confusable verb's form are practice for no cell.
  **#24:** `tallyDiscriminate()` in js/session.js (scored and practice per cell), tested.
  **#25:** summary shows e.g. "3/3 (+2/2 practice)": full green, partial amber, zero red.
  Separate commit.
- **M4 (decision 0009):** js/progress.js (pure): per-cell `streak`, `days` (local dates of a
  correct first Transfer attempt), `events`; mastered derived (streak ≥ 3, ≥ 2 days); "almost"
  is a miss; scored Discriminate taps and every Transfer attempt feed streak in answer order;
  Recall/Echo never do; `validateProgress` for storage and import. js/store.js saves to
  "ancoras.progress" after every scored answer; a malformed value is ignored with a console
  warning and left in place until the next save. Picker: mastery mini grid beside each verb
  (rows tenses, columns persons; new / learning / mastered / uncovered; tooltip with streak
  and days; "✓ tense" when a tense is fully mastered), legend, Progress section with Export
  (ancoras-progress-YYYY-MM-DD.json), Import (validated, confirmed, replaces) and Reset.
  Summary: Progress column with streak and "mastered" / "streak reset". No rule had to change
  from the advisor's defaults; SPEC unchanged. No change to anchors.json.
- **Tests:** `node --test` 93/93 (81 after Part 1; 12 new progress tests). `node validate.mjs` OK.
- **Browser (isolated test profile):** vir · PPS · tu+nós: cells turn learning; a second
  session the same day raised streaks (5→10, 6→12) with days staying 1; a Transfer miss reset
  a streak ("streak reset"); export → reset (grid cleared) → import (grid back); a version-2
  file is refused with a message; with a previous day imported, a clean session reached
  "mastered" (2 days); leaving after 4 Discriminate taps kept them; a malformed stored value
  gives one console warning; phone width.
- **Issues touched:** #23, #24, #25, #5 closed.
- **Next:** M5 (#6), then stop for learner feedback. Jim: run /second-opinion in a new chat on
  9d32a2c..HEAD; try the grid and decide #18.

## 2026-10-09 (review)
- **Reviewed:** 7074ee0..1a14b7d
- **Verdict:** Sound; nothing must-fix. Three quiet ways to lose saved progress (two tabs, silent save failure, damaged data wiped) should be closed before M5.
- **Findings:** Should fix: (1) two tabs overwrite each other (js/store.js:38, :45); (2) failed saves are silent while the page says it saved (js/store.js:33, js/picker.js:185); (3) damaged saved progress wiped on next answer with only a console warning (js/store.js:26). Could fix: (4) "streak reset" badge shows after the streak was rebuilt in the same session (js/practice.js:316); (5) grid streak/days only in hover tooltips, invisible on phones, grid aria-hidden (js/picker.js:102); (6) no test for the event glue in js/practice.js:156 and :259.
- **Fixed:** (1)–(3). js/store.js is now `createStore(storage)`: `record()` re-reads the stored copy (`load()`) before applying each answer, so two tabs build on each other; a damaged or wrong-version value is copied to "ancoras.progress.bad" before the first save and reported; blocked storage or a failed save is reported once and progress carries on in memory (exportable). Problems show in a warning bar on every view (index.html `#store-warning`), and the Progress box says "Not being saved" instead of "Saved". 7 new tests in test/store.test.mjs with a fake storage (incl. two tabs sharing it); `node --test` 100/100; `node validate.mjs` OK. Browser-checked in an isolated profile: two real tabs answering in turn kept both cells' progress; a planted version-2 value showed the page warning and was kept as "ancoras.progress.bad"; a forced setItem failure showed the warning bar and the "Not being saved" note while the grid kept the in-memory answer. Decision 0009 amended.
- **Deferred:** (4) #28, (5) #29, (6) #30.
- **Next:** M5 (#6), then stop for learner feedback.

## 2026-10-09: M5 pt-PT audio (#6)
- **Changed (decision 0010):** js/audio.js now speaks via speechSynthesis: `choosePtPtVoice`
  (pure, tested) takes only pt-PT voices (pt_PT and case variants accepted), honours the
  remembered voice ("ancoras.voice"), never pt-BR or generic "pt"; voices are re-read on
  `voiceschanged`; speak() cancels, then speaks at rate 0.9 in pt-PT, or does nothing without
  a pt-PT voice. Meet plays its anchor on show, Echo plays its question on show; graded
  feedback gets a Play button (no auto-play); speech stops on every screen change and on
  leaving. Home: "Progress and audio" box with a pt-PT voice dropdown (plays a sample on
  change), or the one-line no-voice notice; Play buttons hidden via `body.no-audio`.
- **Tests:** `node --test` 104/104 (4 new voice-choice tests). `node validate.mjs` OK.
- **Browser:** this Mac's Chrome has 3 pt-PT voices (Joana, Joana (Enhanced), Joaquim
  (Enhanced)) among 13 Portuguese ones; the dropdown lists exactly those 3. The first read of
  the voice list came back partial (only a pt-BR voice), and the Audio line redrew itself when
  the full list arrived, which confirms the late-loading handling. A real Joana utterance ran
  start → end (volume forced to 0 so nothing was heard). With a fake voice list: Meet spoke on
  show and on Play, Echo spoke only the question, nothing auto-played after answers, the
  chosen voice was remembered across reloads, leaving cancelled speech; with only pt-BR /
  generic voices the notice showed, no Play button appeared and nothing was spoken.
- **Issues touched:** #6 closed.
- **Next:** stop for learner feedback (SPEC §11). Jim practises; then decide #18 and review
  the open issues before building anything new.

## 2026-10-10: Theme switch (#31)
- Added "Theme: Follow system / Light / Dark" next to Audio in the home screen's "Progress and
  settings" box, remembered in localStorage ("ancoras.theme"; absent = follow system). An
  inline script at the top of <head> sets data-theme on <html> before the stylesheet loads;
  style.css keeps the dark palette under prefers-color-scheme (guarded with
  :root:not([data-theme="light"])), repeats it under :root[data-theme="dark"], and sets
  color-scheme to match. Browser-checked with emulated light/dark: Dark darkens the picker,
  grid, practice screens, feedback and Data tables while the system is light; the theme is set
  before the stylesheet on reload (no flash); Light holds while the system is dark; Follow
  system tracks it. `node --test` 104/104. Issue #31 closed.

## 2026-10-10: Repo renamed `ancoras`; published with GitHub Pages (#32)
- Renamed the GitHub repo TVFpractice → `ancoras` (`gh repo rename`; local remote updated;
  still private; folder and `.claude-account` unchanged). Before publishing, listed the repo:
  no secrets, but Pages exposes every file (notes, docs, `.vscode/settings.json` with the Mac
  username path); Jim chose to publish everything as planned.
- Enabled Pages from `main` / root: https://jamminalley.github.io/ancoras/. Added
  `.nojekyll`, `manifest.webmanifest` (standalone, light-palette colours), home-screen icons
  `icons/icon-192.png` and `icons/icon-512.png` (the "Â" favicon design, drawn on a canvas
  in Chrome since no image tools are installed), and the apple-mobile-web-app meta tags.
  serve.mjs learned the `.webmanifest` content type. Decision 0011.
- Checks: `node --test` 104/104; `node validate.mjs` OK; local serve.mjs serves the new files
  with the right types.

## 2026-10-10: Android steps in the no-voice notice
- The home screen's no-voice notice (js/picker.js) and decision 0010 now also say how to add a Portuguese (Portugal) voice on Android (Jim's phone is a Pixel); the Mac/iPhone wording is unchanged.

## 2026-10-11: Business project; repo moved to professorcdp and made public (#33)
- Transferred jamminalley/ancoras → **professorcdp/ancoras** (HTTP 202; issues and Pages
  config moved; local remote updated). The site then would not build: GitHub replied "current
  plan does not support private GitHub Pages" (professorcdp is on the free plan per GitHub's
  API; epcompanheiro's Pages site is down for the same reason). Jim chose to make the repo
  public.
- Before going public: scanned the full history and all issues: no secrets; the only personal
  item was jmranalli@yahoo.com on all 21 commits. With Jim's approval, rewrote the history
  (git filter-branch) to the noreply address 190651337+jamminalley@users.noreply.github.com,
  author and committer; content verified identical; backup bundle kept outside the repo;
  force-pushed with lease; this clone's git config now uses the noreply address. Old→new IDs:
  docs/commit-id-map.md.
- Made the repo public; Pages built; https://professorcdp.github.io/ancoras/ serves index,
  anchors.json, js/, manifest and icons (200) and a session starts with no console errors.
  The old jamminalley address returns 404, as expected.
- **Still to do (Jim):** GitHub still serves the old commits by ID (checked: 200 anonymously,
  with the old email), and issue timelines link some. Ask GitHub Support to remove cached
  views of the rewritten commits in professorcdp/ancoras.
- Docs: PROJECT.md (stamp BUSINESS, address, status), CLAUDE.md (address, public repo,
  noreply), decision 0012, note in 0011. Restamped BUSINESS last (`claude-stamp business .`).
  Issue #33 closed.
