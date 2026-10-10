# 0009. Progress rules

- **Date:** 2026-10-09
- **Status:** accepted (advisor's defaults for M4, #5; agreed by Jim)

## Context
SPEC §8 defines per-cell `streak` and `sessions_correct` and a mastered rule, but leaves open
how they are stored, which answers feed them, when they are saved, and how the learner sees
them. M4 builds this on top of the M1–M3 session (decisions 0005, 0007, 0008).

## Decision
Rules live in a pure, tested module (js/progress.js); storage is a thin wrapper
(js/store.js).

- **Per cell:** `streak` (consecutive correct answers on steps 4–5) and `days`, the list of
  local dates "YYYY-MM-DD" on which Transfer's **first** attempt was correct;
  `sessions_correct` = `days.length`. Storing the dates rather than a count is what makes
  "distinct days" hold across sessions. An `events` count records whether the cell has ever
  been practised.
- **Mastered is derived:** streak ≥ 3 and days.length ≥ 2. A miss resets streak to 0, which
  clears mastered; the days stay. Nothing has to be "un-set" by hand (SPEC §8).
- **Correct** means `result === 'correct'`; "almost" is a miss for mastery (SPEC §7).
- **What feeds it, in order as the learner answers:** scored Discriminate taps (only items
  about the cell's own form, 0008 amendment) and every Transfer attempt (first and retry)
  update streak; only a correct Transfer first attempt adds today's date. Recall and Echo
  never touch progress.
- **Status:** 'new' (no scored answers yet), 'learning', 'mastered'. A verb+tense is mastered
  when all its covered cells are.
- **Format:** plain JSON with `version: 1`; `applyEvent` returns a new object (no mutation).
- **Storage:** localStorage key "ancoras.progress", saved after **every** scored answer, so
  leaving mid-session (#21) keeps what was done. A malformed stored value is ignored with a
  one-line console warning and treated as empty, and isn't overwritten until the next save.
  Storage is per address including the port; serve.mjs keeps to port 4791 for this.
- **Home screen:** next to each verb's checkbox, a mini grid (rows: tenses; columns: persons)
  coloured new / learning / mastered, uncovered cells muted, with a "✓ tense" mark when a
  tense is fully mastered and a tooltip per cell with streak and days. Putting it beside the
  checkbox makes "what should I practise?" and "pick it" the same glance. Legend once at the
  top. A Progress section offers Export (ancoras-progress-YYYY-MM-DD.json), Import (checked
  for shape and version, confirmed, replaces rather than merges) and Reset (confirmed).
- **Session summary:** a Progress column with each cell's streak after the session and a
  "mastered" badge when the session got it there, or "streak reset" after a scored miss.

## Consequences
Progress builds up across sessions with no scheduler (decision 0003): the grid answers "am I
allowed to move on?". Every scored answer writes to localStorage, which is cheap at this
size. Progress stays in one browser on one address; export/import is the way to move or back
it up. Changing a rule later (e.g. the thresholds) changes the derived status of existing
progress immediately, because mastered is never stored.

## Amendment, 2026-10-09: storage safety (review of 7074ee0..1a14b7d)
- Every save re-reads the stored copy first and applies the answer to it, so two open tabs
  build on each other instead of overwriting.
- A damaged or wrong-version stored value is copied to "ancoras.progress.bad" before any
  save replaces it, and a warning appears on the page (not only in the console).
- Blocked storage or a failed save shows a warning on every view; the Progress box says
  progress is not being saved, and progress carries on in memory (still exportable) until
  the page is closed.
