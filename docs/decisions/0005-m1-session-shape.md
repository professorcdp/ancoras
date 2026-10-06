# 0005. Shape of an M1 practice session

- **Date:** 2026-10-06
- **Status:** accepted (decided by Jim with the advisor before M1, #2)

## Context
M1 builds the first practice loop: the session picker plus SPEC §6 steps 1 (Meet) and 5
(Transfer). The spec leaves open how the two steps are sequenced, what happens after a miss,
what to do with cells that have no anchor, and where the M0 data tables go once the front
page becomes the picker.

## Decision
- **Two phases.** A session runs Meet for every selected cell, then Transfer for every cell,
  then a summary. Cells are shuffled so the same cell never comes twice in a row and, where
  possible, neither does the same verb.
- **One retry.** A wrong or "almost" Transfer answer sends that cell to the back of the queue
  once. After the retry the session moves on whatever the result. Every session therefore
  ends with each form typed correctly at least once where the learner can, without the app
  becoming a scheduler (decision 0003).
- **Uncovered cells are skipped in v1.** A session's cells are the selected
  verb × tense × person combinations that have a form and at least one anchor. The rest are
  shown as "(n uncovered cells skipped)". Whether they get drills is #8.
- **Data tables behind a link.** The front page is the picker. The M0 verbs/anchors tables
  stay one click away under "Data" (`#data`), so the data check is still one reload away
  after editing anchors.json (decision 0002). Validator problems show a red banner on the
  front page and disable Start.

## Consequences
Sessions are short and predictable, and no results are stored yet (mastery is M4, #5).
A learner who misses a form twice sees it marked ✗ in the summary but gets no further
repetition this session. Transfer often falls back to a bare prompt because most cells have
only one anchor (#13).
