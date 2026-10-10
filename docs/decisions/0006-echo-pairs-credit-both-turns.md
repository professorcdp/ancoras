# 0006. Echo pairs credit both turns

- **Date:** 2026-10-09
- **Status:** accepted (decided by Jim with the advisor, #12)

## Context
Most echo anchors are a tu-question answered in the eu form ("De onde vens? — Venho do
Porto."). The anchor's id names the question's cell (vir-pres-tu-1 → *vens*), but SPEC §6
step 3 has the learner type the answer. So for 10 of 13 echo anchors the id's cell is never
typed in the Echo step, while the answer form, often the hard eu form (*vim, vi, fui, pus,
estive, trouxe*), is.

When this was decided, the working assumption was that the answer forms weren't listed in
`targets` and would need adding. Checking the data showed they already were: every verb
form in every answer turn has been a target since the file was first committed, with the
homographs assigned by meaning (*vimos* in ver-pps-eles-1 is ver PPS nós; the *fui/foi* in
the ser anchors are ser). No data change was needed.

## Decision
The Echo step (M2) tests the targets that appear in the answer turn. A cell whose form
appears only in the question turn skips Echo; Recall and Transfer still cover it. Answer-turn
targets count toward a cell's mastery like any other (M4).

With the current data, Echo tests 13 cells (vir.pres.eu, vir.pps.eu, vir.pps.eles,
ver.pps.eu, ver.pps.nós, ser.pres.eles, ser.pps.eu, ser.pps.ele, estar.pps.eu, pôr.pps.eu,
fazer.pps.eu, fazer.pps.ele, trazer.pps.eu) and skips 9 question-only cells (mostly the tu
forms).

## Alternatives rejected
- **Test the id's cell (the question's form).** The learner would be graded on a form they
  read, not one they produce.
- **Flip the pairs so the target sits in the answer.** Unnatural: you answer questions, you
  don't echo them.

## Consequences
Echo practises what the learner actually types, and the eu forms the pairs were built to
teach get credited. The tu cells of these pairs get no Echo item; they rely on Recall and
Transfer. A future echo anchor must list its answer forms in `targets` to be tested by Echo;
the validator checks that targets appear in `pt`, but not that every answer form is listed.
