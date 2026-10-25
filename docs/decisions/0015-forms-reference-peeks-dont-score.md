# 0015. Forms reference on every screen; peeks don't score

- **Date:** 2026-10-25
- **Status:** accepted (decided by Jim with the advisor, #38)

## Context
While practising, the learner sometimes needs to see a verb's whole paradigm, especially
next to the verb it collides with, rather than guess. The app already holds every form in
`anchors.json`; it just never showed them outside the Data view.

## Decision
- **A Forms button on every screen** (picker rows, Meet, Recall, Echo, Discriminate,
  Transfer, feedback, summary) opens a panel: a bottom sheet on phones, a dialog on laptops.
  Escape or a tap outside closes it, and focus returns to where it was. Opening it never
  stops speech.
- **What it shows:** the verb's paradigm from `data.verbs[verb].forms` (rows: persons;
  columns: present and PPS, labelled from `data.tenses`), with the verb and gloss as a title.
  A verb with a confusion set shows each verb of the set as its own block (vir and ver side
  by side on a laptop, stacked on a phone), so the collision is visible. The cells being
  practised are highlighted; for an echo pair or a contrast line, every target cell shown
  is. The picker's button shows that verb with nothing highlighted, and so does the summary.
  No new data and no conjugation engine (SPEC §2): it's a view of `anchors.json`. The grid
  code is shared with the Data view (js/forms.js).
- **Peeking during a graded item makes that attempt "looked up".** The answer is graded and
  shown exactly as usual (correct / almost / wrong; the retry rule is unchanged), but it is
  not fed to progress: it neither builds nor resets the streak and never adds a day. This
  applies to Recall, Echo, Transfer, and in Discriminate to the tap that follows a peek.
  Opening the panel after answering (from the feedback) or on Meet has no effect. The
  feedback and the summary show a small "looked up" tag. The rule is pure and tested:
  `isScored()` in js/progress.js returns false for an event with `lookedUp: true`.

Reason: the mastery grid must keep meaning "I can produce this without help", while the
learner is never punished for choosing to learn rather than guess.

## Consequences
A learner who peeks often will see their grid move more slowly, but never backwards because
of a peek. Peeking is free on Meet and after answering, so the panel also works as a plain
reference.
