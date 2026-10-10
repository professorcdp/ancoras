# Âncoras — spec v0.1

Working title. A narrow practice tool for European Portuguese verb forms that won't stick.
Companion data file: `anchors.json` (same folder).

## 1. Problem

The learner (A2, European Portuguese) is stuck on a small set of irregular verb forms in the
present and the pretérito perfeito simples (PPS). Generic gap-fill practice (Linguno) can't
target fewer than about six verbs and gives no memorable context. The forms mostly fail for
one of three reasons:

1. **Collisions between verbs**: vir/ver, pôr/poder, ter/estar, ir/ser.
2. **The eu/ele vowel flip inside one verb**: fui/foi, tive/teve, pude/pôde, pus/pôs, fiz/fez.
3. **An odd stem with no close neighbor**: soube, quis, disse, trouxe.

The fix is a small set of **anchors**: short, memorable, contextualized EP phrases (fixed
formulas, question–answer echo pairs, and contrast lines that put two confusable forms in one
sentence), practiced until each form is retrievable on its own.

## 2. Non-goals

This is not "Radical". Do not build any of the following:

- A full conjugation system, a conjugation engine, or a verb library dependency (no verbecc).
- A syllabus, a curriculum, or a spaced-repetition scheduler.
- Runtime LLM calls of any kind. All content is static.
- Accounts, a backend, sync, or analytics.
- Tenses beyond present and PPS in v1 (the data format already allows more).
- Speech recognition.

## 3. Core model

- **Cell** = verb × tense × person. Example: `vir.pps.eu` → *vim*.
- Persons: `eu, tu, ele, nós, eles` (`ele` also covers ela/você; `eles` covers elas/vocês). No vós.
- Tenses: `pres`, `pps`.
- **Anchor** = one EP phrase with a gloss, targeting one or more cells.
- **Confusion set** = the verbs a given verb collides with.

Everything the app shows comes from `anchors.json`. The learner must be able to edit that file
by hand and see the change on reload, with no code changes.

## 4. Data: `anchors.json`

Top-level keys:

| Key | Contents |
|---|---|
| `verbs` | Per verb: `gloss`, `confusion_set`, `pps_pattern` (`flip` / `match` / `irregular`), and `forms[tense][person]` |
| `anchors` | List of anchors (below) |
| `rules` | Short explanatory rules, shown as hints (e.g. the eu/ele flip) |
| `uncovered_cells` | Cells with a form but no anchor yet. These are mostly regular forms left out on purpose. |
| `persons`, `tenses`, `person_notes` | Labels |

Anchor fields:

| Field | Meaning |
|---|---|
| `id` | Stable id, e.g. `vir-pps-eu-1` |
| `kind` | `formula` (established expression), `sentence`, `echo` (question — answer), `contrast` (targets more than one verb) |
| `pt`, `en` | Phrase and gloss |
| `turns` | For echo anchors: `[question, answer]` |
| `targets` | List of `{verb, tense, person, form}`. Every `form` appears verbatim in `pt`. |
| `established` | `true` for fixed expressions and proverbs |
| `needs_native_check` | `true` for composed sentences not yet verified by a native speaker |
| `transfer` | Empty in v0.1. Reserved for extra gap-fill sentences (see step 5). |

Current contents: 15 verbs, 126 anchors, 117 cells covered.

Known homographs the app must handle: *vimos* (vir pres. nós / ver PPS nós) and the whole
ir/ser PPS. Never ask "which verb is this?" for an ir/ser PPS form.

## 5. Session setup

The learner picks:

- one or more verbs (offer one-tap presets for each confusion set: vir+ver, pôr+poder, ter+estar, ir+ser),
- one or both tenses,
- any subset of persons.

The result is a list of cells. A session of 4–8 cells is typical; there is no minimum. Show
the cell count before starting. Remember the last selection.

## 6. Practice steps

Each selected cell moves through five steps. Steps 1–3 use the cell's anchors; 4 and 5 test
the bare form.

1. **Meet.** Show the anchor, gloss, and target form highlighted. Play audio. The learner
   repeats aloud and taps to continue. Not graded.
2. **Recall.** Show the English gloss. The learner types the whole phrase; for echo anchors,
   the whole exchange (both turns, from the English of both), since Echo already tests the
   answer alone (decision 0007).
3. **Echo.** Only for cells whose form appears in the answer turn of an echo anchor. Play and
   show the question; the learner types the answer, and the answer turn's targets are graded.
   Cells whose form appears only in the question turn (or in no echo anchor) skip this step;
   Recall and Transfer still cover them. See decision 0006.
4. **Discriminate.** Only for verbs with a non-empty confusion set. Show a form; the learner
   picks the verb, or shows an English cue ("we saw") and the learner picks between the two
   confusable forms (*vimos* / *viemos*). Fast, tap-based, about 5 items per cell.
5. **Transfer.** Show a sentence with the target form blanked, plus person and infinitive as
   the cue. The learner types the form. In v1, draw the sentence from another anchor that
   targets the same cell when one exists, otherwise from `transfer`; if neither exists, fall
   back to a bare prompt (`vir · PPS · eles → ____`). On a miss, show the anchor as the hint.

Interleave cells within a step, so the learner never answers the same cell twice in a row.

## 7. Grading

- Compare after trimming, lowercasing, and collapsing whitespace. Ignore punctuation,
  including the dash in echo pairs.
- **Accents count, but are reported separately.** An answer that is right except for
  diacritics is marked "almost" and shows the correct spelling; it does not count as correct
  for mastery. Reason: *pôde/pode*, *vêm/vem*, *pôs/pos* are different forms.
- For whole-phrase recall, grade the target form(s) strictly and the rest leniently: if every
  target form is present and correct, accept the answer and show the canonical phrase.
- Provide on-screen buttons for á à â ã é ê í ó ô õ ú ç.

## 8. Mastery

Per cell, stored locally:

- `streak`: consecutive correct answers on steps 4–5 (the bare-form steps).
- `sessions_correct`: number of distinct days with a correct first attempt on step 5.

A cell is **mastered** when `streak ≥ 3` and `sessions_correct ≥ 2`. A miss resets `streak`
to 0 and clears mastered status. A verb+tense is mastered when all its covered cells are.

The home screen shows a grid per verb (persons × tenses) colored by status: new, in progress,
mastered. This grid is the "am I allowed to move on?" answer.

## 9. Audio

Browser `speechSynthesis`, selecting a `pt-PT` voice. If no pt-PT voice is available, say so
once and run silently; never fall back to pt-BR. Keep audio behind one small function so
pre-generated audio files can replace it later.

## 10. Platform and stack

- Single-page web app, static files only, usable on phone and laptop.
- No build step if practical (plain HTML/CSS/JS modules), or Vite if the code needs it.
- `anchors.json` loaded at startup via fetch. Progress in `localStorage`, with export and
  import of progress as a JSON file.
- Runs from a local static server; deployable later to any static host.

## 11. Milestones

- **M0. Data check.** Load `anchors.json`, validate it (every target form appears in `pt`,
  ids unique, confusion sets symmetric), and render a browsable table of verbs and anchors.
- **M1. Setup + Meet + Transfer.** Session picker, steps 1 and 5, grading, accent buttons.
- **M2. Recall + Echo.** Steps 2 and 3.
- **M3. Discriminate.** Step 4, generated from `confusion_set` and the paradigms.
- **M4. Mastery.** Per-cell tracking, the status grid, progress export/import.
- **M5. Audio.** pt-PT speech synthesis.

Stop after M5 and get the learner's feedback before adding anything.

## 12. Planned, not in v1

- **Clitic placement mode.** Enclisis (*Vi-o*) versus proclisis (*Não o vi*), using the same
  echo format: one base sentence flipped by each trigger (negation, question words,
  *que/se/quando*, adverbs like *já/também/só/ainda*, subjects like *ninguém/todos*). First
  with *me/te/lhe*, which never change the verb; later the *-lo/-no* changes
  (*fi-lo, viram-no, vemo-nos*). Keep anchors generic enough that a `mode` field can be added.
- **More verbs.** The learner's wider list falls into three cheaper groups:
  - Odd present, regular PPS: ler, perder, ouvir, pedir, dormir, fugir, subir, rir, cair, sair.
  - -uir verbs, two model patterns: atribuir, constituir, distribuir, retribuir, substituir / construir, destruir.
  - Regular PPS, one model per conjugation plus spelling changes (*fiquei, paguei, comecei*)
    and the *falamos/falámos* accent: abrir, acordar, almoçar, começar, comer, comprar,
    encontrar, falar, ficar, jantar, pagar, telefonar, tomar, trabalhar, voltar.
- **Pretérito imperfeito** as a third tense column.
- Pre-generated audio; spoken answers; a SwiftUI version.

## 13. Open items for the learner

- Have a native speaker check anchors with `needs_native_check: true` (80 of 126).
- Replace anchors that don't stick with sentences true of his own life.
- Decide whether `uncovered_cells` (mostly regular forms such as *podes, dizemos, sabem*) need
  anchors or just bare-form transfer items.
