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
