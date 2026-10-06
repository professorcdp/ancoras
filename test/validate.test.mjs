// Tests for js/validate.js. Run with: node --test
// Each test starts from a tiny valid sample, breaks one thing, and checks that
// the expected problem is reported.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, formatProblem, containsForm } from '../js/validate.js';

const SAMPLE = {
  version: 1,
  language: 'pt-PT',
  persons: ['eu', 'ele'],
  person_notes: {},
  tenses: { pres: 'Presente', pps: 'Pretérito perfeito simples' },
  verbs: {
    vir: {
      gloss: 'to come', confusion_set: ['ver'], pps_pattern: 'irregular',
      forms: { pres: { eu: 'venho', ele: 'vem' }, pps: { eu: 'vim', ele: 'veio' } },
    },
    ver: {
      gloss: 'to see', confusion_set: ['vir'], pps_pattern: 'irregular',
      forms: { pres: { eu: 'vejo', ele: 'vê' }, pps: { eu: 'vi', ele: 'viu' } },
    },
  },
  rules: [],
  anchors: [
    {
      id: 'vir-pps-eu-1', kind: 'contrast', pt: 'Vim, vi e venci.', en: 'I came, I saw, I conquered.',
      established: true, needs_native_check: false, transfer: [],
      targets: [
        { verb: 'vir', tense: 'pps', person: 'eu', form: 'vim' },
        { verb: 'ver', tense: 'pps', person: 'eu', form: 'vi' },
      ],
    },
    {
      id: 'vir-pres-ele-1', kind: 'echo', pt: 'Quem vem? — Venho eu.', en: "Who's coming? — I am.",
      turns: ['Quem vem?', 'Venho eu.'], established: false, needs_native_check: true, transfer: [],
      targets: [
        { verb: 'vir', tense: 'pres', person: 'ele', form: 'vem' },
        { verb: 'vir', tense: 'pres', person: 'eu', form: 'venho' },
      ],
    },
    {
      id: 'vir-pps-ele-1', kind: 'sentence', pt: 'Ele veio ontem.', en: 'He came yesterday.',
      established: false, needs_native_check: true, transfer: [],
      targets: [{ verb: 'vir', tense: 'pps', person: 'ele', form: 'veio' }],
    },
    {
      id: 'ver-pres-eu-1', kind: 'formula', pt: 'Vejo que sim.', en: 'I see so.',
      established: true, needs_native_check: false, transfer: [],
      targets: [{ verb: 'ver', tense: 'pres', person: 'eu', form: 'vejo' }],
    },
  ],
  uncovered_cells: ['ver.pres.ele', 'ver.pps.ele'],
};

const sample = () => structuredClone(SAMPLE);
const anchor = (d, id) => d.anchors.find(a => a.id === id);

// Validate `data` and assert that some problem matches `ref` and `msg` (regexes).
function expectProblem(data, ref, msg) {
  const { problems } = validate(data);
  const lines = problems.map(formatProblem);
  assert.ok(
    problems.some(p => ref.test(p.ref) && msg.test(p.msg)),
    `expected a problem matching ${ref} / ${msg}, got:\n  ${lines.join('\n  ') || '(none)'}`
  );
  return problems;
}

test('the sample is valid', () => {
  const { problems, stats } = validate(sample());
  assert.deepEqual(problems.map(formatProblem), []);
  assert.deepEqual(stats, { verbs: 2, anchors: 4, cells: 8, covered: 6 });
});

test('the real anchors.json passes', () => {
  const data = JSON.parse(readFileSync(new URL('../anchors.json', import.meta.url), 'utf8'));
  const { problems } = validate(data);
  assert.deepEqual(problems.map(formatProblem), []);
});

test('target form missing from pt', () => {
  const d = sample();
  anchor(d, 'vir-pps-ele-1').pt = 'Ele chegou ontem.';
  expectProblem(d, /^anchor vir-pps-ele-1$/, /"veio".*not found in pt/);
});

test('form matching: case-insensitive, whole word, accents significant', () => {
  assert.equal(containsForm('Vim, vi e venci.', 'vim'), true);
  assert.equal(containsForm('Vim!', 'vi'), false);
  assert.equal(containsForm('Vi-o ontem.', 'vi'), true);
  assert.equal(containsForm('Ele pôde.', 'pode'), false);
});

test('duplicate anchor id', () => {
  const d = sample();
  anchor(d, 'vir-pps-ele-1').id = 'ver-pres-eu-1';
  expectProblem(d, /^anchor ver-pres-eu-1$/, /duplicate id/);
});

test('one-sided confusion set', () => {
  const d = sample();
  d.verbs.ver.confusion_set = [];
  expectProblem(d, /^verb vir$/, /lists "ver", but ver does not list vir/);
});

test('target form differs from the paradigm', () => {
  const d = sample();
  d.verbs.vir.forms.pps.ele = 'veiu';
  expectProblem(d, /^anchor vir-pps-ele-1$/, /form "veio" differs from verbs form "veiu"/);
});

test('cell listed as uncovered but actually covered', () => {
  const d = sample();
  d.uncovered_cells.push('vir.pps.ele');
  expectProblem(d, /^uncovered_cells vir\.pps\.ele$/, /is covered by vir-pps-ele-1/);
});

test('cell neither covered nor listed as uncovered', () => {
  const d = sample();
  d.uncovered_cells = ['ver.pres.ele'];
  expectProblem(d, /^cell ver\.pps\.ele$/, /no anchor and is not listed/);
});

test('echo anchor with bad turns', () => {
  const d = sample();
  anchor(d, 'vir-pres-ele-1').turns = ['Quem vem?'];
  expectProblem(d, /^anchor vir-pres-ele-1$/, /two non-empty strings/);
});

test('unknown anchor kind', () => {
  const d = sample();
  anchor(d, 'ver-pres-eu-1').kind = 'proverb';
  expectProblem(d, /^anchor ver-pres-eu-1$/, /unknown kind "proverb"/);
});

test('null target is reported, not a crash', () => {
  const d = sample();
  anchor(d, 'vir-pps-eu-1').targets.splice(1, 0, null);
  expectProblem(d, /^anchor vir-pps-eu-1$/, /target #2 is not an object/);
});

test('null anchor is reported, not a crash', () => {
  const d = sample();
  d.anchors.splice(2, 0, null);
  expectProblem(d, /^anchor #3$/, /is not an object/);
});

test('null verb is reported, not a crash', () => {
  const d = sample();
  d.verbs.ver = null;
  expectProblem(d, /^verb ver$/, /is not an object/);
});

test('wrong-shaped top-level fields are reported, not a crash', () => {
  for (const bad of [null, [], 'text']) {
    const d = sample();
    d.verbs = bad;
    d.anchors = bad;
    expectProblem(d, /^file$/, /"verbs" is not an object/);
  }
  assert.ok(validate(null).problems.length);
});
