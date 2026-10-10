# 0008. Discriminate item design

- **Date:** 2026-10-09
- **Status:** accepted (decided by Jim with the advisor before M3, #4)

## Context
SPEC §6 step 4 asks for fast tap items for verbs that collide with others (vir/ver, ir/ser,
ter/estar, pôr/poder): show a form and pick the verb, or show an English cue and pick the
form. SPEC §4 forbids asking "which verb is this?" for an ir/ser PPS form, and *vimos* is
both vir present nós and ver PPS nós.

## Decision
- **Place:** after Echo and before Transfer, only for cells whose verb has a non-empty
  `confusion_set`. Steps 1–3 use anchors and 4–5 test the bare form, so 4 warms up 5.
- **About 5 items per cell, two kinds,** built by a pure, tested function
  (`discriminateItemsFor` in js/session.js):
  - **"Which verb?"** Show a form (the cell's own, or the same tense+person form of a
    confusable verb); the options are the infinitives of the set. Never used for a form that
    also appears anywhere in the paradigm of another verb in the set. This is derived from
    the data, not a hard-coded list, and catches all of ir/ser PPS and *vimos* (SPEC §4).
  - **"Which form?"** The cue is person + verb + gloss + tense, e.g. "nós · ver (to see) ·
    PPS"; the options are the same tense+person forms of the set's verbs. The spec's
    "English cue" would need English per cell, which the data doesn't have; this cue uses
    what exists. Revisit if it feels weak.
  - The kinds alternate. If only one kind is possible, all items are that kind. Options are
    shuffled and hold the right answer exactly once; with one confusable verb there are two
    options, otherwise one per verb in the set.
- **Interleaved across cells** so the same cell never comes twice in a row when that can be
  avoided (`interleave`: always take from the cell with most items left).
- **Tap grades at once.** Correct: marked, then the next item after about 600 ms. Wrong: the
  right answer is shown and the learner taps Next. No retry queue, since 5 items already
  repeat the cell.
- **Results:** the summary shows "Discriminate n/5" per cell ("—" when the cell had no
  items). Nothing is stored yet; per SPEC §8 these results will feed `streak` in M4.

## Consequence found while building
For ir/ser PPS cells **neither kind is possible**: the two verbs share every PPS form, so a
"which form?" item would offer two identical buttons (*fui* / *fui*). Those cells get no
Discriminate items; the ir/ser present cells get both kinds. (The plan expected ir+ser
sessions to show only "which form?" items; with identical forms that isn't possible without
breaking the "right answer exactly once" rule.) Telling ir and ser PPS apart is left to the
anchors, where context decides.

## Consequences
At 5 items per cell, Discriminate is the longest phase: 95 taps for ter+estar (19 cells),
100 for vir+ver, 50 for ir+ser (present only). Taps are quick, but a full session is now
long; see #18 (let the picker choose steps).
