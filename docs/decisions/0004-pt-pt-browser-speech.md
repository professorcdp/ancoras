# 0004. Audio via browser speech, pt-PT only

- **Date:** 2026-10-06 (recorded retroactively; decided in SPEC.md v0.1)
- **Status:** accepted

## Context
Hearing the phrases helps them stick, but Brazilian pronunciation would teach the wrong sounds.

## Decision
Use the browser's `speechSynthesis` with a pt-PT voice. If none is available, say so once
and run silently. Never fall back to pt-BR. Keep audio behind one small function so
pre-generated audio files can replace it later.

## Consequences
No audio files to produce for now. Voice quality and availability depend on the device.
