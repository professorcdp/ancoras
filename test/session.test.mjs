// Tests for js/session.js. Run with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaultSelection, restoreSelection, presets, buildCells, pickMeetAnchor, pickTransfer,
  pickEchoAnchor, formsIn, targetsIn, describeCells, splitOnForm, orderCells, requeue, summarize,
  planPhases, runPhases, decideLeave, discriminateItemsFor, interleave, DISCRIMINATE_ITEMS,
  tallyDiscriminate, screenCount,
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

test('default selection: no verbs, every tense, person and step', () => {
  assert.deepEqual(defaultSelection(data), {
    verbs: [], tenses: ['pres', 'pps'], persons: ['eu', 'tu', 'ele', 'nós', 'eles'],
    steps: ['meet', 'recall', 'echo', 'discriminate', 'transfer'],
  });
});

test('restoreSelection keeps known values and falls back on bad input', () => {
  const fallback = defaultSelection(data);
  for (const bad of [null, 'x', 42, []]) assert.deepEqual(restoreSelection(data, bad), fallback);
  assert.deepEqual(
    restoreSelection(data, { verbs: ['ver', 'nope', 'vir'], tenses: ['pps'], persons: 'eu' }),
    { verbs: ['vir', 'ver'], tenses: ['pps'], persons: fallback.persons, steps: fallback.steps },
  );
});

test('restoreSelection: a selection saved before #18 (or with bad steps) gets all steps', () => {
  const all = ['meet', 'recall', 'echo', 'discriminate', 'transfer'];
  const saved = { verbs: ['vir'], tenses: ['pres'], persons: ['eu'] };
  assert.deepEqual(restoreSelection(data, saved).steps, all);              // no steps key yet
  assert.deepEqual(restoreSelection(data, { ...saved, steps: 'meet' }).steps, all);
  assert.deepEqual(restoreSelection(data, { ...saved, steps: ['transfer', 'bogus', 'meet'] }).steps,
    ['meet', 'transfer']);                                                  // known ones, in order
  assert.deepEqual(restoreSelection(data, { ...saved, steps: [] }).steps, []); // none ticked stays none
});

test('buildCells: vir+ver is 20 cells, nothing uncovered', () => {
  const { cells, skipped } = buildCells(data, { ...defaultSelection(data), verbs: ['vir', 'ver'] });
  assert.equal(cells.length, 20);
  assert.equal(skipped, 0);
});

test('buildCells skips uncovered cells and counts them', () => {
  // Since #8 the real data covers every cell, so take poder's four newest anchors away.
  const removed = ['poder-pres-tu-1', 'poder-pres-nós-1', 'poder-pres-eles-1', 'poder-pps-tu-1'];
  const thinned = { ...data, anchors: data.anchors.filter(a => !removed.includes(a.id)) };
  const { cells, skipped } = buildCells(thinned, { ...defaultSelection(data), verbs: ['poder'] });
  assert.equal(cells.length + skipped, 10);
  assert.equal(skipped, 4);
  assert.ok(!cells.some(c => c.key === 'poder.pres.tu'));
});

test('real data: every cell is covered, nothing is skipped (#8)', () => {
  const { cells, skipped } = buildCells(data, { ...defaultSelection(data), verbs: Object.keys(data.verbs) });
  assert.equal(skipped, 0);
  assert.equal(cells.length, 142);
  assert.equal(buildCells(data, { ...defaultSelection(data), verbs: ['saber'] }).cells.length, 10);
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

// Phase plan (decisions 0005, 0007, 0008).
const names = phases => phases.map(p => `${p.name}:${p.cells.length}`);

test('planPhases: full order, empty phases left out', () => {
  const a = { key: 'a', echo: {}, discriminate: [1, 2] };
  const b = { key: 'b' };
  assert.deepEqual(names(planPhases([a, b])),
    ['meet:2', 'recall:2', 'echo:1', 'discriminate:1', 'transfer:2']);
  assert.deepEqual(names(planPhases([b])), ['meet:1', 'recall:1', 'transfer:1']);
  assert.deepEqual(planPhases([]), []);
});

test('planPhases on a real vir+ver session: Echo covers the 5 vir/ver echo cells', () => {
  const cells = buildCells(data, { ...defaultSelection(data), verbs: ['vir', 'ver'] }).cells
    .map(c => ({ ...c, echo: pickEchoAnchor(c, pickMeetAnchor(c.anchors)) }));
  assert.deepEqual(names(planPhases(cells)), ['meet:20', 'recall:20', 'echo:5', 'transfer:20']);
});

test('runPhases hands each phase the last cell of the one before, then calls done', () => {
  const phases = [{ name: 'meet', cells: ['m1', 'm2'] }, { name: 'recall', cells: ['r1'] }];
  const calls = [];
  let finished;
  runPhases(phases, (phase, prev, next) => { calls.push([phase.name, prev]); next(phase.cells.at(-1)); },
    last => { finished = last; }, 'start');
  assert.deepEqual(calls, [['meet', 'start'], ['recall', 'm2']]);
  assert.equal(finished, 'r1');
  runPhases([], () => assert.fail('no phases to run'), last => { finished = last; }, 'x');
  assert.equal(finished, 'x');
});

// Leaving a session (#15, #20).
test('decideLeave: an unfinished session asks first', () => {
  for (const via of ['back', 'end', 'title']) {
    assert.deepEqual(decideLeave({ via, inProgress: true }), { action: 'ask' });
  }
});

test('decideLeave: confirmed → leave; only Back has already popped the history entry', () => {
  assert.deepEqual(decideLeave({ via: 'back', inProgress: true, confirmed: true }), { action: 'leave', popHistory: false });
  assert.deepEqual(decideLeave({ via: 'end', inProgress: true, confirmed: true }), { action: 'leave', popHistory: true });
  assert.deepEqual(decideLeave({ via: 'title', inProgress: true, confirmed: true }), { action: 'leave', popHistory: true });
});

test('decideLeave: cancelled → stay; Back puts its entry back', () => {
  assert.deepEqual(decideLeave({ via: 'back', inProgress: true, confirmed: false }), { action: 'stay', restoreHistory: true });
  assert.deepEqual(decideLeave({ via: 'end', inProgress: true, confirmed: false }), { action: 'stay', restoreHistory: false });
});

test('decideLeave: from the summary, leave without asking', () => {
  assert.deepEqual(decideLeave({ via: 'back', inProgress: false }), { action: 'leave', popHistory: false });
  assert.deepEqual(decideLeave({ via: 'end', inProgress: false }), { action: 'leave', popHistory: true });
});

// Discriminate (decision 0008).
const cellsFor = verbs => buildCells(data, { ...defaultSelection(data), verbs }).cells;
const itemsFor = verbs => cellsFor(verbs).map(c => ({ cell: c, items: discriminateItemsFor(data, c, rng(7)) }));

test('Discriminate: never a "which verb?" item for a form shared within the set', () => {
  // Derived independently: every form that appears in two verbs of one confusion set.
  const shared = new Set();
  for (const [v, info] of Object.entries(data.verbs)) {
    for (const w of info.confusion_set) {
      const mine = Object.values(info.forms).flatMap(Object.values);
      const theirs = Object.values(data.verbs[w].forms).flatMap(Object.values);
      for (const f of mine) if (theirs.includes(f)) shared.add(f);
    }
  }
  assert.ok(shared.has('vimos') && ['fui', 'foste', 'foi', 'fomos', 'foram'].every(f => shared.has(f)));
  for (const verbs of [['vir', 'ver'], ['ir', 'ser'], ['ter', 'estar'], ['pôr', 'poder']]) {
    for (const { items } of itemsFor(verbs)) {
      for (const it of items.filter(x => x.kind === 'verb')) assert.ok(!shared.has(it.form), it.form);
    }
  }
});

test('Discriminate: ir/ser PPS cells get no items (identical forms), present cells do', () => {
  for (const { cell, items } of itemsFor(['ir', 'ser'])) {
    if (cell.tense === 'pps') assert.deepEqual(items, [], cell.key);
    else assert.equal(items.length, DISCRIMINATE_ITEMS, cell.key);
  }
});

test('Discriminate: a ter+estar cell yields 5 items of both kinds, 2 options each', () => {
  for (const { cell, items } of itemsFor(['ter', 'estar'])) {
    assert.equal(items.length, 5, cell.key);
    assert.ok(items.every(it => it.options.length === 2), cell.key);
    assert.deepEqual([...new Set(items.map(it => it.kind))].sort(), ['form', 'verb'], cell.key);
  }
});

test('Discriminate: options always hold the right answer exactly once, no duplicates', () => {
  for (const verbs of [['vir', 'ver'], ['ir', 'ser'], ['ter', 'estar'], ['pôr', 'poder']]) {
    for (const { items } of itemsFor(verbs)) {
      for (const it of items) {
        assert.equal(it.options.filter(o => o === it.answer).length, 1, JSON.stringify(it));
        assert.equal(new Set(it.options).size, it.options.length, JSON.stringify(it));
      }
    }
  }
});

test('Discriminate: a "which verb?" item names the verb its form belongs to', () => {
  for (const { items } of itemsFor(['vir', 'ver'])) {
    for (const it of items.filter(x => x.kind === 'verb')) {
      assert.ok(Object.values(data.verbs[it.answer].forms).flatMap(Object.values).includes(it.form));
    }
  }
  const vimos = itemsFor(['vir']).find(x => x.cell.key === 'vir.pres.nós').items;
  assert.ok(vimos.filter(x => x.kind === 'verb').every(x => x.form === 'vemos'));
});

test('Discriminate: verbs without a confusion set yield no items', () => {
  for (const verb of ['fazer', 'dizer', 'querer', 'saber', 'trazer', 'dar', 'haver']) {
    for (const { items } of itemsFor([verb])) assert.deepEqual(items, []);
  }
});

test('interleave: no cell twice in a row when avoidable, nothing lost', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const lists = cellsFor(['ter', 'estar']).slice(0, 6).map(c => discriminateItemsFor(data, c, rng(seed)));
    const out = interleave(lists, it => it.key, rng(seed), lists[0][0].key);
    assert.equal(out.length, lists.flat().length);
    assert.notEqual(out[0].key, lists[0][0].key);
    for (let i = 1; i < out.length; i++) assert.notEqual(out[i].key, out[i - 1].key);
  }
  assert.deepEqual(interleave([['a1', 'a2']], x => x[0]), ['a1', 'a2']); // one cell: repeats are unavoidable
});

// Which Discriminate items count toward a cell's mastery (#23).
const itemsOf = key => itemsFor([key.split('.')[0]]).find(x => x.cell.key === key).items;

test('Discriminate counts: ver.pps.nós has no scored "which verb?" items, its "which form?" items are scored', () => {
  const items = itemsOf('ver.pps.nós');
  assert.ok(items.length);
  assert.ok(items.filter(i => i.kind === 'verb').every(i => !i.counts && i.form === 'viemos'));
  const forms = items.filter(i => i.kind === 'form');
  assert.ok(forms.length && forms.every(i => i.counts));
});

test('Discriminate counts: under vir.pres.tu, "vens → vir" is scored and "vês → ver" is not', () => {
  const verbItems = itemsOf('vir.pres.tu').filter(i => i.kind === 'verb');
  const vens = verbItems.filter(i => i.form === 'vens');
  const ves = verbItems.filter(i => i.form === 'vês');
  assert.ok(vens.length && vens.every(i => i.counts && i.answer === 'vir'));
  assert.ok(ves.length && ves.every(i => !i.counts && i.answer === 'ver'));
});

test('Discriminate counts: every item says whether it counts, and own-form items always do', () => {
  for (const verbs of [['vir', 'ver'], ['ir', 'ser'], ['ter', 'estar'], ['pôr', 'poder']]) {
    for (const { cell, items } of itemsFor(verbs)) {
      for (const it of items) {
        assert.equal(typeof it.counts, 'boolean');
        assert.equal(it.counts, it.kind === 'form' || it.answer === cell.verb, JSON.stringify(it));
      }
    }
  }
});

test('tallyDiscriminate sums scored and practice taps per cell', () => {
  const taps = [
    { key: 'a', counts: true, right: true }, { key: 'a', counts: false, right: true },
    { key: 'a', counts: true, right: false }, { key: 'b', counts: false, right: false },
    { key: 'a', counts: false, right: true }, { key: 'a', counts: true, right: true },
  ];
  const t = tallyDiscriminate(taps);
  assert.deepEqual(t.get('a'), { scored: { right: 2, total: 3 }, practice: { right: 2, total: 2 } });
  assert.deepEqual(t.get('b'), { scored: { right: 0, total: 0 }, practice: { right: 0, total: 1 } });
  assert.equal(tallyDiscriminate([]).size, 0);
});

// Choosing steps (#18, decision 0014).
test('planPhases leaves out switched-off steps like empty ones', () => {
  const a = { key: 'a', echo: {}, discriminate: [1, 2] };
  const b = { key: 'b' };
  assert.deepEqual(names(planPhases([a, b], ['echo', 'discriminate', 'transfer'])),
    ['echo:1', 'discriminate:1', 'transfer:2']);
  assert.deepEqual(names(planPhases([a, b], ['transfer', 'meet'])), ['meet:2', 'transfer:2']); // order fixed
  assert.deepEqual(names(planPhases([b], ['echo'])), []);           // on, but no cell has it
  assert.deepEqual(planPhases([a, b], []), []);
});

test('screenCount: per-step screens for a vir+ver session', () => {
  const cells = buildCells(data, { ...defaultSelection(data), verbs: ['vir', 'ver'] }).cells;
  assert.equal(screenCount(data, cells), 20 + 20 + 5 + 100 + 20);
  assert.equal(screenCount(data, cells, ['transfer']), 20);
  assert.equal(screenCount(data, cells, ['echo', 'discriminate']), 105);
  assert.equal(screenCount(data, cells, []), 0);
  const fazer = buildCells(data, { ...defaultSelection(data), verbs: ['fazer'] }).cells;
  assert.equal(screenCount(data, fazer, ['discriminate']), 0);       // no confusion set
});
