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
