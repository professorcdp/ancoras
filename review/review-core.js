// Native-speaker review: the parts shared by the review page (review/review.js) and the
// import script (review-import.mjs). Pure: no DOM, no files. Tested by test/review.test.mjs.
// Decision 0016.
//
// Answers file, one line per answered anchor (anything else is never written):
//   ÂNCORAS REVIEW — 2026-10-26 — 3 answers
//   vir-pres-tu-1 OK
//   poder-pps-tu-1 CHANGE | pt: Não pudeste vir ontem? | en: … | note: …
//   ser-pps-ele-1 FORM | note: …

import { containsForm, ECHO_SEPARATOR } from '../js/validate.js';

export const VERDICTS = ['OK', 'CHANGE', 'FORM'];
export const HEADER = 'ÂNCORAS REVIEW';
const FIELDS = ['pt', 'en', 'note'];

const oneLine = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const same = (a, b) => String(a ?? '').normalize('NFC') === String(b ?? '').normalize('NFC');

// Has the anchor's Portuguese changed since this answer was given? Then the answer is stale:
// it is shown as "Updated" and never copied (EPspokenfrequency decision 0009).
export function isStale(answer, anchor) {
  return !same(answer?.givenOn, anchor?.pt);
}

// A usable answer: has a verdict and isn't stale.
export function isAnswered(answer, anchor) {
  return Boolean(answer && VERDICTS.includes(answer.verdict) && anchor && !isStale(answer, anchor));
}

// One answer as a line. Corrected Portuguese/English go in only if they differ from the
// current text (prefilled fields she left alone are not "filled"); the note if non-empty.
export function formatLine(anchor, answer) {
  const parts = [`${anchor.id} ${answer.verdict}`];
  if (answer.verdict === 'CHANGE') {
    if (oneLine(answer.pt) && !same(oneLine(answer.pt), anchor.pt)) parts.push(`pt: ${oneLine(answer.pt)}`);
    if (oneLine(answer.en) && !same(oneLine(answer.en), anchor.en)) parts.push(`en: ${oneLine(answer.en)}`);
  }
  if (oneLine(answer.note)) parts.push(`note: ${oneLine(answer.note)}`);
  return parts.join(' | ');
}

// The whole answers text: a header, then one line per answered, current anchor, in file
// order. Unanswered and stale answers never travel.
export function formatAnswers(anchors, answers, date) {
  const lines = anchors.filter(a => isAnswered(answers?.[a.id], a)).map(a => formatLine(a, answers[a.id]));
  return [`${HEADER} — ${date} — ${lines.length} answer${lines.length === 1 ? '' : 's'}`, ...lines].join('\n');
}

// Parse an answers text. Fields are split on " | " only where the next text starts a known
// field ("pt: ", "en: ", "note: "), so a "|" inside a comment survives.
export function parseAnswers(text) {
  const answers = [];
  const errors = [];
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.normalize('NFC').trim();
    if (!line || line.startsWith(HEADER)) return;
    const m = line.match(/^(\S+)\s+(OK|CHANGE|FORM)(?:\s+\|\s+(.*))?$/u);
    if (!m) {
      errors.push({ line: i + 1, text: raw, reason: 'not "<id> OK|CHANGE|FORM [| field: …]"' });
      return;
    }
    const answer = { id: m[1], verdict: m[2] };
    if (m[3] !== undefined) {
      for (const chunk of m[3].split(/\s+\|\s+(?=(?:pt|en|note):\s)/u)) {
        const f = chunk.match(/^(pt|en|note):\s*(.*)$/su);
        if (!f) {
          errors.push({ line: i + 1, text: raw, reason: `unknown field "${chunk.slice(0, 20)}"` });
          return;
        }
        answer[f[1]] = f[2].trim();
      }
    }
    if (answers.some(a => a.id === answer.id)) {
      errors.push({ line: i + 1, text: raw, reason: `${answer.id} answered twice; the first answer is kept` });
      return;
    }
    answers.push(answer);
  });
  return { answers, errors };
}

// Split an echo pair's Portuguese into its two turns, or null if it isn't exactly two.
export function splitEcho(pt) {
  const turns = String(pt).split(ECHO_SEPARATOR).map(t => t.trim());
  return turns.length === 2 && turns.every(Boolean) ? turns : null;
}

// What one answer does to its anchor. Returns { status: 'applied' | 'skipped' | 'flagged',
// anchor (the new anchor when applied), reason }. Never changes the input.
//   OK     → needs_native_check false (established untouched)
//   CHANGE → new pt (an echo pair is re-split into turns) and en if given, needs_native_check
//            false; skipped if any target form is no longer in the new pt as a whole word
//   FORM   → no change; flagged for Jim
export function applyAnswer(anchor, answer) {
  if (!anchor) return { status: 'skipped', reason: `unknown anchor id "${answer.id}"` };
  if (answer.verdict === 'OK') {
    return { status: 'applied', anchor: { ...anchor, needs_native_check: false }, reason: 'OK' };
  }
  if (answer.verdict === 'FORM') {
    return { status: 'flagged', reason: `FORM${answer.note ? `: ${answer.note}` : ''}` };
  }
  const pt = answer.pt ? answer.pt.normalize('NFC') : anchor.pt;
  const next = { ...anchor, pt, needs_native_check: false };
  if (answer.en) next.en = answer.en;
  const missing = (anchor.targets ?? []).map(t => t.form).filter(f => !containsForm(pt, f));
  if (missing.length) {
    return { status: 'skipped', reason: `target form${missing.length > 1 ? 's' : ''} ${missing.map(f => `"${f}"`).join(', ')} no longer in the new Portuguese` };
  }
  if (anchor.kind === 'echo') {
    const turns = splitEcho(pt);
    if (!turns) return { status: 'skipped', reason: `echo pair must be "question${ECHO_SEPARATOR}answer"` };
    next.turns = turns;
    next.pt = turns.join(ECHO_SEPARATOR);
  }
  return { status: 'applied', anchor: next, reason: `CHANGE${answer.pt ? ' pt' : ''}${answer.en ? ' en' : ''}` };
}
