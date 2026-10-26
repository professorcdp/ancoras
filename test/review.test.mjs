// Tests for review/review-core.js (decision 0016). Run with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isStale, isAnswered, formatLine, formatAnswers, parseAnswers, splitEcho, applyAnswer,
} from '../review/review-core.js';

const data = JSON.parse(readFileSync(new URL('../anchors.json', import.meta.url), 'utf8'));
const byId = id => data.anchors.find(a => a.id === id);

test('parse: verdicts, fields, header and blank lines', () => {
  const { answers, errors } = parseAnswers([
    'ÂNCORAS REVIEW — 2026-10-26 — 3 answers', '',
    'vir-pres-tu-1 OK',
    'poder-pps-tu-1 CHANGE | pt: Não pudeste vir ontem? | en: Couldn\'t you come? | note: mais natural',
    'ser-pps-ele-1 FORM | note: aqui diria «foi ele»',
  ].join('\n'));
  assert.deepEqual(errors, []);
  assert.deepEqual(answers, [
    { id: 'vir-pres-tu-1', verdict: 'OK' },
    { id: 'poder-pps-tu-1', verdict: 'CHANGE', pt: 'Não pudeste vir ontem?', en: 'Couldn\'t you come?', note: 'mais natural' },
    { id: 'ser-pps-ele-1', verdict: 'FORM', note: 'aqui diria «foi ele»' },
  ]);
});

test('parse: a "|" inside a field stays in the text; accents survive (incl. decomposed)', () => {
  const { answers, errors } = parseAnswers('dar-pres-eu-1 CHANGE | pt: Dou-te a minha palavra | ou não | note: a | b é igual\r\n');
  assert.deepEqual(errors, []);
  assert.equal(answers[0].pt, 'Dou-te a minha palavra | ou não');
  assert.equal(answers[0].note, 'a | b é igual');
  const decomposed = parseAnswers('x-1 FORM | note: pôde');
  assert.equal(decomposed.answers[0].note, 'pôde');
});

test('parse: bad lines, unknown verdicts and repeats are reported, not applied', () => {
  const { answers, errors } = parseAnswers('vir-pres-tu-1 MAYBE\njust some text\nvir-pres-eu-1 OK | colour: red\nvir-pres-ele-1 OK\nvir-pres-ele-1 FORM');
  assert.deepEqual(answers.map(a => a.id), ['vir-pres-ele-1']);
  assert.equal(errors.length, 4);
  assert.match(errors[3].reason, /answered twice/);
});

test('format → parse round-trips; prefilled fields left alone are not sent', () => {
  const a = byId('poder-pps-tu-1');
  const untouched = { verdict: 'CHANGE', pt: a.pt, en: a.en, note: '', givenOn: a.pt };
  assert.equal(formatLine(a, untouched), 'poder-pps-tu-1 CHANGE');
  const edited = { verdict: 'CHANGE', pt: 'Ontem  não\npudeste vir?', en: a.en, note: 'ordem | ritmo', givenOn: a.pt };
  const line = formatLine(a, edited);
  assert.equal(line, 'poder-pps-tu-1 CHANGE | pt: Ontem não pudeste vir? | note: ordem | ritmo');
  assert.deepEqual(parseAnswers(line).answers[0], { id: 'poder-pps-tu-1', verdict: 'CHANGE', pt: 'Ontem não pudeste vir?', note: 'ordem | ritmo' });
});

test('stale rule: an answer given on different Portuguese is "Updated" and never copied', () => {
  const a = byId('vir-pres-tu-1');
  const fresh = { verdict: 'OK', givenOn: a.pt };
  const stale = { verdict: 'OK', givenOn: 'De onde vens? — Venho de Lisboa.' };
  assert.equal(isStale(fresh, a), false);
  assert.equal(isStale(stale, a), true);
  assert.equal(isAnswered(stale, a), false);
  assert.equal(isAnswered({ verdict: null, givenOn: a.pt, note: 'só nota' }, a), false); // no verdict
  const text = formatAnswers(data.anchors, { 'vir-pres-tu-1': stale, 'vir-pres-eu-1': { verdict: 'OK', givenOn: byId('vir-pres-eu-1').pt } }, '2026-10-26');
  assert.deepEqual(text.split('\n'), ['ÂNCORAS REVIEW — 2026-10-26 — 1 answer', 'vir-pres-eu-1 OK']);
});

test('apply OK: clears needs_native_check only', () => {
  const a = byId('poder-pres-tu-1');
  const r = applyAnswer(a, { id: a.id, verdict: 'OK' });
  assert.equal(r.status, 'applied');
  assert.deepEqual(r.anchor, { ...a, needs_native_check: false });
  assert.equal(a.needs_native_check, true); // input unchanged
});

test('apply CHANGE: new pt and en; skipped if a target form is gone', () => {
  const a = byId('poder-pps-tu-1'); // target: pudeste
  const ok = applyAnswer(a, { id: a.id, verdict: 'CHANGE', pt: 'Ontem não pudeste vir?', en: 'Couldn\'t you come yesterday?' });
  assert.equal(ok.status, 'applied');
  assert.equal(ok.anchor.pt, 'Ontem não pudeste vir?');
  assert.equal(ok.anchor.en, 'Couldn\'t you come yesterday?');
  assert.equal(ok.anchor.needs_native_check, false);
  const gone = applyAnswer(a, { id: a.id, verdict: 'CHANGE', pt: 'Não conseguiste vir ontem?' });
  assert.equal(gone.status, 'skipped');
  assert.match(gone.reason, /"pudeste" no longer/);
  const accent = applyAnswer(a, { id: a.id, verdict: 'CHANGE', pt: 'Não pudeste vir?'.replace('pudeste', 'púdeste') });
  assert.equal(accent.status, 'skipped'); // accents count: the form must stay exactly as it is
});

test('apply CHANGE on an echo pair: re-split into turns; needs both turns', () => {
  const a = byId('vir-pres-tu-1'); // De onde vens? — Venho do Porto.
  const r = applyAnswer(a, { id: a.id, verdict: 'CHANGE', pt: 'De onde é que vens? — Venho do Porto.' });
  assert.equal(r.status, 'applied');
  assert.deepEqual(r.anchor.turns, ['De onde é que vens?', 'Venho do Porto.']);
  assert.equal(r.anchor.pt, 'De onde é que vens? — Venho do Porto.');
  const one = applyAnswer(a, { id: a.id, verdict: 'CHANGE', pt: 'De onde vens? Venho do Porto.' });
  assert.equal(one.status, 'skipped');
  assert.match(one.reason, /question — answer/);
  assert.deepEqual(splitEcho('A? — B.'), ['A?', 'B.']);
  assert.equal(splitEcho('A? — B. — C.'), null);
});

test('apply FORM and unknown ids: nothing changes', () => {
  const a = byId('ser-pps-ele-1');
  assert.equal(applyAnswer(a, { id: a.id, verdict: 'FORM', note: 'x' }).status, 'flagged');
  assert.equal(applyAnswer(undefined, { id: 'nope-1', verdict: 'OK' }).status, 'skipped');
});
