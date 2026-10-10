# 0007. M2 Recall and Echo shape

- **Date:** 2026-10-09
- **Status:** accepted (decided by Jim with the advisor before M2, #3)

## Context
M2 adds SPEC §6 steps 2 (Recall) and 3 (Echo) to the M1 session (decision 0005: one phase
per step, one retry per miss). The spec left open where the new phases sit, what Recall asks
for when the cell's anchor is an echo pair, and whether the retry rule covers the new steps.

## Decision
- **Order:** Meet → Recall → Echo → Transfer → summary, each phase for all its cells
  (continues 0005). Echo covers only cells whose form is in an echo answer turn (0006) and is
  skipped entirely when no cell in the session has one.
- **Recall of an echo anchor is the whole exchange,** typed from the English of both turns.
  Echo already is "see the question, type the answer"; typing only the answer in Recall
  would duplicate Echo and leave the question's form (the tu forms) untyped until Transfer.
- **Recall and Echo are graded per SPEC §7:** strict on the target forms (whole word, accents
  count, missing accents are "almost"), lenient on everything else. Recall grades all the
  Meet anchor's targets (both forms of a contrast line); Echo grades the targets in the
  answer turn.
- **One retry everywhere:** 0005's rule (a miss goes to the back of the queue once) applies
  to Recall, Echo and Transfer alike.
- **Results:** the summary shows Recall, Echo and Transfer per cell, but per SPEC §8 only
  steps 4–5 will count toward mastery in M4. The headline counts Transfer first tries.

## Consequences
A session now has up to four phases; a full vir+ver selection (20 cells) is at least 65
screens before retries (20 Meet + 20 Recall + 5 Echo + 20 Transfer). Whether the picker should
let the learner choose steps is left open (#18) until Jim has practised with it. Nothing is
stored yet (M4, #5).
