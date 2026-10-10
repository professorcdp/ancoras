// Tests for js/grade.js. Run with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, stripDiacritics, gradeForm, gradePhrase } from '../js/grade.js';

test('normalize: trim, lowercase, collapse spaces, strip punctuation incl. the echo dash', () => {
  assert.equal(normalize('  Vim. '), 'vim');
  assert.equal(normalize('Quem   vem? — Venho eu!'), 'quem vem venho eu');
  assert.equal(normalize('ô'), 'ô'); // decomposed ô typed as o + combining circumflex
  assert.equal(normalize(undefined), '');
});

test('stripDiacritics: accents go, ç becomes c', () => {
  assert.equal(stripDiacritics('pôde vêm cá ação'), 'pode vem ca acao');
});

const cases = [
  ['pode', 'pôde', 'almost'],
  ['vem', 'vêm', 'almost'],
  ['pos', 'pôs', 'almost'],
  ['ca', 'cá', 'almost'],
  ['faco', 'faço', 'almost'],
  ['  Vim. ', 'vim', 'correct'],
  ['fui!', 'fui', 'correct'],
  ['FUI', 'fui', 'correct'],
  ['pôde', 'pôde', 'correct'],
  ['vimos', 'viemos', 'wrong'],
  ['foi', 'fui', 'wrong'],
  ['', 'vim', 'wrong'],
  ['   ', 'vim', 'wrong'],
  ['?!', 'vim', 'wrong'],
];

for (const [answer, expected, grade] of cases) {
  test(`gradeForm(${JSON.stringify(answer)}, ${JSON.stringify(expected)}) is ${grade}`, () => {
    assert.equal(gradeForm(answer, expected), grade);
  });
}

test('an accented answer for an unaccented form is almost, not correct', () => {
  assert.equal(gradeForm('pôde', 'pode'), 'almost');
});

// Whole-phrase grading (Recall, Echo): strict on target forms, lenient elsewhere.
const phrase = (answer, forms) => {
  const { result, missing } = gradePhrase(answer, forms);
  return { result, missing };
};

test('gradePhrase: exact phrase is correct', () => {
  assert.deepEqual(phrase('Já venho!', ['venho']), { result: 'correct', missing: [] });
});

test('gradePhrase: different wording with the right form is correct', () => {
  assert.deepEqual(phrase('venho já', ['venho']), { result: 'correct', missing: [] });
});

test('gradePhrase: a form missing its accent is almost, and named in missing', () => {
  assert.deepEqual(phrase('Ele fez o que pode.', ['fez', 'pôde']), { result: 'almost', missing: ['pôde'] });
});

test('gradePhrase: an absent form is wrong', () => {
  assert.deepEqual(phrase('Já vou!', ['venho']), { result: 'wrong', missing: ['venho'] });
});

test('gradePhrase: echo pair typed with or without the dash is correct', () => {
  const forms = ['vens', 'venho'];
  assert.equal(gradePhrase('De onde vens? — Venho do Porto.', forms).result, 'correct');
  assert.equal(gradePhrase('de onde vens venho do porto', forms).result, 'correct');
  assert.equal(gradePhrase('De onde vens? - Venho do Porto', forms).result, 'correct');
});

test('gradePhrase: contrast anchor with one of two forms wrong is wrong', () => {
  assert.deepEqual(phrase('Vim, vim e venci.', ['vim', 'vi']), { result: 'wrong', missing: ['vi'] });
});

test('gradePhrase: wrong beats almost when both occur', () => {
  assert.equal(gradePhrase('pode e vem', ['pôde', 'vim']).result, 'wrong');
});

test('gradePhrase: empty answer is wrong', () => {
  assert.deepEqual(phrase('', ['vim']), { result: 'wrong', missing: ['vim'] });
  assert.deepEqual(phrase('  ?! ', ['vim']), { result: 'wrong', missing: ['vim'] });
});

test('gradePhrase: hyphenated clitics keep the form a separate word', () => {
  assert.equal(gradePhrase('Vai-se andando.', ['vai']).result, 'correct');
  assert.equal(gradePhrase('Dou-te a minha palavra.', ['dou']).result, 'correct');
  assert.equal(gradePhrase('Vaise andando.', ['vai']).result, 'wrong');
});

test('gradePhrase: a form inside a longer word does not count', () => {
  assert.equal(gradePhrase('Vimos tudo.', ['vi']).result, 'wrong');
});
