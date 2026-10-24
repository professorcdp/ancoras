# 0014. Learner chooses the steps

- **Date:** 2026-10-23
- **Status:** accepted (decided by Jim with the advisor, #18)

## Context
Since M3 a session runs every step for every cell (decisions 0005, 0007, 0008). Full preset
sessions reached 107–165 screens before retries (vir+ver: 165, 100 of them Discriminate
taps).

## Decision
- The picker has five checkboxes, "Steps: Meet · Recall · Echo · Discriminate · Transfer",
  all on by default and remembered with the rest of the selection. A missing or malformed
  stored value (e.g. one saved before this change) restores all five; Start is disabled when
  none is ticked.
- `planPhases(cells, enabled)` leaves switched-off steps out exactly as it leaves out empty
  ones. Recall still uses the Meet anchor when Meet is off.
- The count line shows the resulting screens before retries ("20 cells · ~125 screens"), from
  `screenCount()`: one per cell for Meet, Recall and Transfer, one per Echo cell, one per
  Discriminate item.
- Progress rules are unchanged (decision 0009): only Discriminate and Transfer feed mastery,
  so a session without both records nothing. Small print under the checkboxes says so.
- The summary shows "—" for switched-off steps; with Transfer off, the headline says so.

Reason: letting the learner drop steps they no longer need beats shortening every step for
everyone.

## Consequences
Mastery is only earned when the bare-form steps (Discriminate, Transfer) are on. Sessions can
be as short as Transfer alone (one screen per cell).
