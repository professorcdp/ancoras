# 0001. Static web app, no backend

- **Date:** 2026-10-06 (recorded retroactively; decided in SPEC.md v0.1)
- **Status:** accepted

## Context
The tool needs to work on a phone and a laptop for a single learner, with as little to run
and maintain as possible.

## Decision
A single-page web app made of static files (plain HTML/CSS/JS modules, Vite only if needed).
No backend, accounts, sync or analytics. Progress is kept in `localStorage`, with JSON
export/import for moving it between devices.

## Consequences
Can be hosted anywhere static and runs from a local server. Progress doesn't sync
automatically; moving it between devices is a manual export/import.
