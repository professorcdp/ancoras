# 0016. Native review by page, not spreadsheet

- **Date:** 2026-10-26
- **Status:** accepted (decided by Jim with the advisor, #43, for #7)

## Context
100 of 150 anchors are marked `needs_native_check` (#7). A native speaker from Portugal will
review them. EPspokenfrequency used review pages too; its known problems were that paging
hid 243 of 500 rows, one note box carried three kinds of answer, verdicts were set as a side
effect of other clicks, answers given on text that later changed were counted, and a raw
paste needed to be kept verbatim.

## Decision
- **A page in the repo, served by Pages** at /ancoras/review/: plain HTML/JS like the app,
  fetching ../anchors.json, so it always shows the current data. One card per anchor, in file
  order, all on one page (no paging). Each card shows the Portuguese with every target form in
  bold, the English, the cells, the kind, CHECK / set phrase chips and a pt-PT ▶ button (the
  app's audio; hidden with the app's notice when there is no pt-PT voice).
- **Three separate inputs:** OK / CHANGE / FORM buttons (exclusive, tap again to clear);
  "Corrected Portuguese" and "Corrected English", which appear only for CHANGE and are
  prefilled so she edits rather than retypes; and a "Comment" always available. Nothing sets a
  verdict as a side effect, and filters apply only when a chip is tapped, so a card never
  vanishes mid-answer.
- **Saved in her browser** ("ancoras.review.v1", prefixed because the origin is shared, #37)
  on every change. Each answer records the Portuguese it was given on; if that has changed,
  the card shows "Updated", asks again, and the old answer is never copied (EPspokenfrequency
  decision 0009).
- **Answers leave only as plain text** (Copy / Download): a header and one line per answered,
  current anchor, keyed by the stable anchor id; fields only when she filled them.
- **review-import.mjs** applies a pasted file: the raw text is saved verbatim under review/ and
  committed before anything is applied; OK clears `needs_native_check`; CHANGE replaces the
  Portuguese (re-split into turns for echo pairs) and English, unless a target form would no
  longer appear as a whole word; FORM is only reported, for Jim. Dry run by default; the
  result is validated before anchors.json is written.
- **The reviewer stays anonymous:** no name in the repo or on the page (EPspokenfrequency
  decision 0006). The page asks search engines not to index it.

Reasons: the reviewer needs nothing but a link; answers can't be lost in transcription; the
page always shows the current data.

## Consequences
- Answers are kept per browser on her side, so she should use one device; Copy answers can be
  sent at any time as a backup.
- The raw paste, committed under review/, is the record of what she said.
- The answers text carries no record of which Portuguese each answer was given on, so if
  anchors.json changes between her Copy and the import, an OK applies to the new text; the
  import's "target form still present" check catches only the worst case. Import soon after
  receiving answers.
