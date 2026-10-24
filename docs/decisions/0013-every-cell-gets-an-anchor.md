# 0013. Every cell gets an anchor

- **Date:** 2026-10-23
- **Status:** accepted (decided by Jim with the advisor, #8)

## Context
v0.1 left 25 cells without an anchor (`uncovered_cells`): mostly regular forms such as
*podes, dizemos, sabem*, plus ir.pps.tu, ser.pps.nós and ter.pps.tu. Sessions skipped them
(decision 0005) and the mastery grid showed them as muted squares. The open question (#8)
was whether they need anchors or only bare-form drills.

## Decision
Give every cell an anchor. 24 new anchors (ids `<verb>-<tense>-<person>-1`) cover all 25
cells; two of them also target a second cell (*Trazes … trago*, *trazemos … trazem*).
Four are established formulas (*Fazes anos hoje?*, *Dizem que vai chover.*, *Queres um
café?*, *Tiveste sorte!*); the other 20 are composed sentences marked
`needs_native_check`. `uncovered_cells` is now empty; the key stays so new verbs can be added
gradually.

Reason: practising with the app, the learner found the muted squares made it feel
incomplete, and the regular forms still deserve a sentence to meet them in.

## Consequences
- Sessions no longer skip cells; the grid has no uncovered squares.
- 20 more sentences for the native-speaker check: 100 of 150 anchors (#7).
- The new cells have one anchor each, so Transfer uses the bare prompt for them: 109 of 142
  cells now (#13).
