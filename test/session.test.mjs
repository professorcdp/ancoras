// Tests for js/session.js. Run with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaultSelection, restoreSelection, presets, buildCells, pickMeetAnchor, pickTransfer,
  pickEchoAnchor, formsIn, targetsIn, describeCells, splitOnForm, orderCells, requeue, summarize,
} from '../js/session.js';

const data = JSON.parse(readFileSync(new URL('../anchors.json', import.meta.url), 'utf8'));

// Seeded random numbers so shuffles are repeatable.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test('presets come from confusion sets', () => {
  assert.deepEqual(presets(data), [['vir', 'ver'], ['ir', 'ser'], ['ter', 'estar'], ['pôr', 'poder']]);
});

test('default selection: no verbs, every tense and person', () => {
  assert.deepEqual(defaultSelection(data), {
    verbs: [], tenses: ['pres', 'pps'], persons: ['eu', 'tu', 'ele', 'nós', 'eles'],
  });
});

test('restoreSelection keeps known values and falls back on bad input', () => {
  const fallback = defaultSelection(data);
  for (const bad of [null, 'x', 42, []]) assert.deepEqual(restoreSelection(data, bad), fallback);
  assert.deepEqual(
    restoreSelection(data, { verbs: ['ver', 'nope', 'vir'], tenses: ['pps'], persons: 'eu' }),
    { verbs: ['vir', 'ver'], tenses: ['pps'], persons: fallback.persons },
  );
});

test('buildCells: vir+ver is 20 cells, nothing uncovered', () => {
  const { cells, skipped } = buildCells(data, { ...defaultSelection(data), verbs: ['vir', 'ver'] });
  assert.equal(cells.length, 20);
  assert.equal(skipped, 0);
});

test('buildCells skips uncovered cells and counts them', () => {
  const { cells, skipped } = buildCells(data, { ...defaultSelection(data), verbs: ['poder'] });
  assert.equal(cells.length + skipped, 10);
  assert.equal(skipped, 4); // poder.pres.tu/nós/eles, poder.pps.tu
  assert.ok(!cells.some(c => c.key === 'poder.pres.tu'));
});

test('buildCells: haver only has ele', () => {
  const { cells } = buildCells(data, { ...defaultSelection(data), verbs: ['haver'] });
  assert.deepEqual(cells.map(c => c.key), ['haver.pres.ele', 'haver.pps.ele']);
});

test('pickMeetAnchor prefers an established anchor, else the first', () => {
  const a = { id: 'a', established: false }, b = { id: 'b', established: true };
  assert.equal(pickMeetAnchor([a, b]), b);
  assert.equal(pickMeetAnchor([a, { id: 'c', established: false }]), a);
});

test('pickTransfer: other anchor, then transfer list, then bare', () => {
  const meet = { id: 'm', pt: 'Vim cá.', transfer: [] };
  const other = { id: 'o', pt: 'Ontem vim de comboio.', en: 'Yesterday I came by train.' };
  const cell = { form: 'vim', anchors: [meet, other] };
  assert.deepEqual(pickTransfer(cell, meet), { source: 'anchor', pt: other.pt, en: other.en, id: 'o' });

  const withList = { ...meet, transfer: ['Não sei.', { pt: 'Vim sozinho.', en: 'I came alone.' }] };
  assert.deepEqual(pickTransfer({ form: 'vim', anchors: [withList] }, withList),
    { source: 'transfer', pt: 'Vim sozinho.', en: 'I came alone.' });

  assert.deepEqual(pickTransfer({ form: 'vim', anchors: [meet] }, meet), { source: 'bare' });
});

test('splitOnForm blanks whole words only, any case', () => {
  assert.deepEqual(splitOnForm('Vim, vi e venci.', 'vi'), ['Vim, ', { form: 'vi' }, ' e venci.']);
  assert.deepEqual(splitOnForm('Vim, vi e venci.', 'vim'), [{ form: 'Vim' }, ', vi e venci.']);
});

test('orderCells: no cell or verb twice in a row when avoidable', () => {
  const { cells } = buildCells(data, { ...defaultSelection(data), verbs: ['vir', 'ver'] });
  for (let seed = 1; seed <= 50; seed++) {
    const order = orderCells(cells, rng(seed));
    assert.equal(order.length, cells.length);
    for (let i = 1; i < order.length; i++) assert.notEqual(order[i].verb, order[i - 1].verb);
    // The next list can avoid starting with the cell (and verb) just shown.
    const next = orderCells(cells, rng(seed + 1000), order.at(-1));
    assert.notEqual(next[0].key, order.at(-1).key);
  }
});

test('orderCells avoids the same cell even when the verb must repeat', () => {
  const cells = [{ key: 'a', verb: 'v' }, { key: 'b', verb: 'v' }];
  for (let seed = 1; seed <= 20; seed++) {
    assert.notEqual(orderCells(cells, rng(seed), cells[0])[0].key, 'a');
  }
});

test('requeue: a first miss goes to the back once; retries never requeue', () => {
  const item = { cell: { key: 'x' }, attempt: 1 };
  const rest = [{ cell: { key: 'y' }, attempt: 1 }];
  assert.deepEqual(requeue(rest, item, 'correct'), rest);
  assert.deepEqual(requeue(rest, item, 'wrong'), [...rest, { cell: { key: 'x' }, attempt: 2 }]);
  assert.deepEqual(requeue(rest, item, 'almost'), [...rest, { cell: { key: 'x' }, attempt: 2 }]);
  assert.deepEqual(requeue(rest, { ...item, attempt: 2 }, 'wrong'), rest);
});

test('summarize: first try, on retry, missed, almost', () => {
  const cells = ['a', 'b', 'c', 'd'].map(key => ({ key }));
  const results = new Map([
    ['a', ['correct']], ['b', ['almost', 'correct']], ['c', ['wrong', 'wrong']], ['d', ['wrong', 'almost']],
  ]);
  assert.deepEqual(summarize(cells, results).map(r => [r.cell.key, r.status, r.almost]), [
    ['a', 'first', false], ['b', 'retry', true], ['c', 'missed', false], ['d', 'missed', true],
  ]);
});

const allCells = () => buildCells(data, { ...defaultSelection(data), verbs: Object.keys(data.verbs) }).cells;
const cellByKey = key => allCells().find(c => c.key === key);
const echoFor = key => {
  const cell = cellByKey(key);
  return pickEchoAnchor(cell, pickMeetAnchor(cell.anchors))?.id;
};

test('pickEchoAnchor: the answer turn decides, not the id', () => {
  assert.equal(echoFor('vir.pres.eu'), 'vir-pres-tu-1');   // "… — Venho do Porto."
  assert.equal(echoFor('ver.pps.nós'), 'ver-pps-eles-1');  // "Viram o jogo? — Vimos."
  assert.equal(echoFor('vir.pres.tu'), undefined);         // vens is only in the question
  assert.equal(echoFor('vir.pres.nós'), undefined);        // vimos (vir) isn't in an echo answer
});

test('pickEchoAnchor: 13 cells get an Echo item (decision 0006)', () => {
  const keys = allCells().filter(c => pickEchoAnchor(c, pickMeetAnchor(c.anchors))).map(c => c.key);
  assert.deepEqual(keys.sort(), [
    'estar.pps.eu', 'fazer.pps.ele', 'fazer.pps.eu', 'pôr.pps.eu', 'ser.pps.ele', 'ser.pps.eu',
    'ser.pres.eles', 'trazer.pps.eu', 'ver.pps.eu', 'ver.pps.nós', 'vir.pps.eles', 'vir.pps.eu',
    'vir.pres.eu',
  ].sort());
});

test('pickEchoAnchor prefers the Meet anchor when it qualifies', () => {
  const a = { id: 'a', kind: 'echo', turns: ['Quem foi?', 'Fui eu.'] };
  const b = { id: 'b', kind: 'echo', turns: ['Foste?', 'Fui.'] };
  const cell = { form: 'fui', anchors: [a, b] };
  assert.equal(pickEchoAnchor(cell, b), b);
  assert.equal(pickEchoAnchor(cell, { id: 'x', kind: 'formula' }), a);
  assert.equal(pickEchoAnchor({ form: 'fui', anchors: [{ id: 'c', kind: 'sentence', pt: 'Fui.' }] }), undefined);
});

test('formsIn: only the targets that appear in the given turn', () => {
  const echo = data.anchors.find(a => a.id === 'ser-pps-tu-1'); // Foste tu? — Não fui eu, foi ele.
  assert.deepEqual(formsIn(echo, echo.turns[1]).sort(), ['foi', 'fui']);
  assert.deepEqual(formsIn(echo, echo.turns[0]), ['foste']);
});

test('targetsIn: one target per cell, only those in the text', () => {
  const echo = data.anchors.find(a => a.id === 'trazer-pps-tu-1'); // Trouxeste …? — Trouxe.
  assert.deepEqual(targetsIn(echo, echo.turns[1]).map(t => `${t.verb}.${t.tense}.${t.person}`), ['trazer.pps.eu']);
});

test('describeCells names every graded cell, the session cell first', () => {
  const c = (verb, tense, person) => ({ verb, tense, person });
  const anchor = id => data.anchors.find(a => a.id === id);
  assert.equal(describeCells([], c('vir', 'pps', 'eu')), 'eu · vir · PPS');
  assert.equal(describeCells(anchor('vir-pres-tu-1').targets, c('vir', 'pres', 'tu')), 'tu + eu · vir · present');
  assert.equal(describeCells(anchor('vir-pps-eu-1').targets, c('ver', 'pps', 'eu')), 'eu · ver + vir · PPS');
  assert.equal(describeCells([c('vir', 'pres', 'eu'), c('ver', 'pps', 'tu')], c('vir', 'pres', 'eu')),
    'eu · vir · present + tu · ver · PPS');
});
