# 0002. anchors.json is the single, hand-editable content source

- **Date:** 2026-10-06 (recorded retroactively; decided in SPEC.md v0.1)
- **Status:** accepted

## Context
The learner wants to fix or replace anchors that don't stick, without touching code.

## Decision
Everything the app shows comes from `anchors.json`, loaded at startup. Editing the file by
hand and reloading the page must be enough to see the change.

## Consequences
The app must validate the file (M0) and fail clearly on mistakes. No conjugation engine or
verb library: forms are written out in the data.
