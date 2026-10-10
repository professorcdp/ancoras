// Tests for the pure part of js/audio.js. Run with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choosePtPtVoice, isPtPt } from '../js/audio.js';

const v = (name, lang) => ({ name, lang });
const VOICES = [
  v('Samantha', 'en-US'), v('Luciana', 'pt-BR'), v('Google português do Brasil', 'pt-BR'),
  v('Generic', 'pt'), v('Joana', 'pt-PT'), v('Catarina', 'pt-PT'),
];

test('picks a pt-PT voice among pt-BR, generic pt and English ones', () => {
  assert.equal(choosePtPtVoice(VOICES).name, 'Joana');
});

test('honours the remembered voice if it is pt-PT, else falls back to the first pt-PT', () => {
  assert.equal(choosePtPtVoice(VOICES, 'Catarina').name, 'Catarina');
  assert.equal(choosePtPtVoice(VOICES, 'Luciana').name, 'Joana');   // a pt-BR preference is ignored
  assert.equal(choosePtPtVoice(VOICES, 'Gone').name, 'Joana');      // a voice no longer installed
});

test('accepts pt_PT and case variants', () => {
  assert.equal(choosePtPtVoice([v('Android', 'pt_PT')]).name, 'Android');
  assert.equal(choosePtPtVoice([v('Odd', 'PT-pt')]).name, 'Odd');
  assert.ok(isPtPt('pt-pt') && isPtPt('PT_PT'));
});

test('never a pt-BR or generic pt voice: none → undefined', () => {
  assert.equal(choosePtPtVoice([v('Luciana', 'pt-BR'), v('Generic', 'pt'), v('Felipe', 'pt_BR')]), undefined);
  assert.equal(choosePtPtVoice([]), undefined);
  assert.equal(choosePtPtVoice(undefined), undefined);
  for (const lang of ['pt-BR', 'pt', 'pt-', 'en-PT', '', null]) assert.equal(isPtPt(lang), false, String(lang));
});
