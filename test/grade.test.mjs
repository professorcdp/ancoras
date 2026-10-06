// Tests for js/grade.js. Run with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, stripDiacritics, gradeForm } from '../js/grade.js';

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
