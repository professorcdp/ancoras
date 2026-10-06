# Âncoras (TVFpractice)

## Stamp
PERSONAL (folder marker: `.claude-account` = `personal`; GitHub: jamminalley)

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
- Native-speaker check of the 80 anchors marked `needs_native_check`
- Do `uncovered_cells` need anchors, or just bare-form transfer items?
- Where to host once it works (any static host)

## Current status
M0 done (2026-10-06): the data-check page and validator work, and anchors.json passes
every check (15 verbs, 126 anchors, 117 cells covered).
Next: M1 (#2), session picker + Meet and Transfer steps.
