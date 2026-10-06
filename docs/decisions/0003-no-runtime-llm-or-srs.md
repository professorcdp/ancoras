# 0003. No runtime AI calls and no spaced-repetition scheduler

- **Date:** 2026-10-06 (recorded retroactively; decided in SPEC.md v0.1)
- **Status:** accepted

## Context
The tool is deliberately narrow ("this is not Radical"). It targets a handful of stuck forms,
not a whole curriculum.

## Decision
All content is static. No LLM calls at runtime, and no syllabus or spaced-repetition
scheduler. Mastery is a simple per-cell rule (streak ≥ 3 and correct on ≥ 2 distinct days).

## Consequences
Works offline and costs nothing to run. The learner chooses what to practise; the mastery
grid tells them when to move on.
