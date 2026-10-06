// Grading (SPEC §7). Pure: no DOM or browser APIs, tested by test/grade.test.mjs.
// M1 grades single forms (Transfer). Whole-phrase grading for Recall (M2, #3) will sit
// alongside gradeForm and reuse normalize/stripDiacritics.

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
