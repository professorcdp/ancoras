# Âncoras (repo: ancoras; folder: TVFpractice)

Live: https://professorcdp.github.io/ancoras/ (GitHub Pages from `main`; decisions 0011, 0012)

## Stamp
BUSINESS (folder marker: .claude-account = business; GitHub: professorcdp/ancoras, public; see decision 0012)

## Started
2026-10-06 (inferred from file dates)

## Overview
A narrow practice tool for European Portuguese verb forms that won't stick: the irregular
present and pretérito perfeito simples forms that collide (vir/ver, pôr/poder, ter/estar,
ir/ser), flip between eu and ele (fui/foi, tive/teve), or have odd stems (soube, quis).
It drills short, memorable "anchor" phrases until each form can be recalled on its own.

The full design lives in [SPEC.md](SPEC.md). This file is the one-page summary.

## Expected output
A single-page static web app (plain HTML/CSS/JS), usable on phone and laptop, that reads
`anchors.json` at startup and runs practice sessions through five steps (Meet, Recall, Echo,
Discriminate, Transfer), with a per-verb mastery grid on the home screen.

## Requirements
**Must (v1, from SPEC.md §11):**
- M0: load and validate `anchors.json`, browsable table of verbs and anchors
- M1: session picker, Meet and Transfer steps, grading, accent buttons
- M2: Recall and Echo steps
- M3: Discriminate step
- M4: mastery tracking, status grid, progress export/import
- M5: pt-PT audio via browser speech synthesis
- All content comes from `anchors.json`, editable by hand with no code changes

**Nice to have (after v1, SPEC.md §12):**
- Clitic placement mode, more verbs, pretérito imperfeito, pre-generated audio, SwiftUI version

## Assumptions
- Single learner, one device at a time; progress lives in the browser (`localStorage`) (inferred)
- Run from a local static server for now; static hosting later (inferred)

## Out of scope
See SPEC.md §2: no conjugation engine, syllabus, spaced-repetition scheduler, runtime LLM
calls, accounts/backend/sync/analytics, extra tenses in v1, or speech recognition.

## Open questions
- Native-speaker check of the 100 anchors marked `needs_native_check` (#7)
- ~~Do `uncovered_cells` need anchors?~~ Resolved 2026-10-23: every cell has an anchor (decision 0013)
- ~~Where to host once it works~~ Resolved 2026-10-10: GitHub Pages (decision 0011); since 2026-10-11 https://professorcdp.github.io/ancoras/ (decision 0012)

## Current status
2026-10-25: a Forms button on every screen shows the verb's paradigm (and its confusion
set's); answers given after peeking are graded but not counted (decision 0015). Every cell
has an anchor (0013); the learner chooses the steps (0014). Live at
https://professorcdp.github.io/ancoras/ (BUSINESS, 0012). Still in the learner-feedback phase
(SPEC §11). Open: #7 (native check, 100 of 150), #13 (Transfer content), #36, #37, GitHub
Support purge of old commits (list in the runlog, 2026-10-24).
