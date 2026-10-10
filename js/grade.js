// Grading (SPEC §7). Pure: no DOM or browser APIs, tested by test/grade.test.mjs.
// gradeForm grades a single form (Transfer); gradePhrase grades a typed phrase strictly on
// its target forms and leniently on everything else (Recall, Echo).

import { formRegex } from './validate.js';

export const CORRECT = 'correct';
export const ALMOST = 'almost';
export const WRONG = 'wrong';

// Lowercase, strip punctuation (any Unicode punctuation, so the echo dash goes too),
// collapse whitespace, trim. NFC first so "ô" typed two ways compares equal.
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\p{P}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

// Remove accent marks; ç becomes c (the cedilla is a combining mark under NFD).
export function stripDiacritics(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .normalize('NFC');
}

// 'correct' if the answer matches after normalizing; 'almost' if it matches only once
// accents are ignored (pôde/pode are different forms, so this is not a pass); else 'wrong'.
export function gradeForm(answer, expected) {
  const a = normalize(answer);
  const e = normalize(expected);
  if (!a) return WRONG;
  if (a === e) return CORRECT;
  if (stripDiacritics(a) === stripDiacritics(e)) return ALMOST;
  return WRONG;
}

// For phrases, punctuation becomes a space rather than vanishing, so a clitic stays a
// separate word: "Vai-se andando" → "vai se andando" (still contains "vai").
function normalizePhrase(s) {
  return normalize(String(s ?? '').replace(/\p{P}/gu, ' '));
}

// Grade a typed phrase against its target forms (SPEC §7): each form must appear as a whole
// word. A form found only once accents are ignored on both sides is 'almost'; a form not
// found is 'wrong'. Everything else in the phrase is not graded. The overall result is the
// worst of the per-form results. `missing` lists the forms that weren't exactly right.
export function gradePhrase(answer, targetForms) {
  const text = normalizePhrase(answer);
  const plain = stripDiacritics(text);
  const forms = [...new Set(targetForms.filter(f => typeof f === 'string' && f.trim()))];
  const perForm = forms.map(form => {
    if (!text) return { form, grade: WRONG };
    if (formRegex(form).test(text)) return { form, grade: CORRECT };
    if (formRegex(stripDiacritics(form)).test(plain)) return { form, grade: ALMOST };
    return { form, grade: WRONG };
  });
  const result = !text || perForm.some(f => f.grade === WRONG) ? WRONG
    : perForm.some(f => f.grade === ALMOST) ? ALMOST : CORRECT;
  return { result, missing: perForm.filter(f => f.grade !== CORRECT).map(f => f.form), forms: perForm };
}
