// Tests for js/progress.js. Run with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProgress, applyEvent, cellRecord, cellStatus, isMastered, groupMastered, validateProgress,
  localDate, isScored,
} from '../js/progress.js';

const K = 'vir.pps.eu';
const transfer = (result, firstAttempt = true, key = K) => ({ key, step: 'transfer', result, firstAttempt });
const tap = (result, counts = true, key = K) => ({ key, step: 'discriminate', result, counts });
const run = (events, day = '2026-10-09', start = emptyProgress()) =>
  events.reduce((p, e) => applyEvent(p, e, day), start);

test('streak builds on correct bare-form answers and resets on a miss', () => {
  let p = run([tap('correct'), tap('correct'), transfer('correct')]);
  assert.equal(cellRecord(p, K).streak, 3);
  p = run([tap('wrong')], '2026-10-09', p);
  assert.equal(cellRecord(p, K).streak, 0);
  assert.equal(cellRecord(p, K).events, 4);
});

test('"almost" is a miss for mastery', () => {
  const p = run([transfer('correct'), transfer('almost', false)]);
  assert.equal(cellRecord(p, K).streak, 0);
});

test('days are distinct dates of a correct FIRST Transfer attempt', () => {
  let p = run([transfer('correct'), transfer('correct')], '2026-10-09');
  assert.deepEqual(cellRecord(p, K).days, ['2026-10-09']);           // same day twice → 1
  p = run([transfer('correct')], '2026-10-10', p);
  assert.deepEqual(cellRecord(p, K).days, ['2026-10-09', '2026-10-10']);
  p = run([transfer('correct')], '2026-10-08', p);                   // kept in date order
  assert.deepEqual(cellRecord(p, K).days, ['2026-10-08', '2026-10-09', '2026-10-10']);
});

test('a correct retry builds the streak but adds no day; Discriminate adds no day', () => {
  const p = run([transfer('wrong'), transfer('correct', false), tap('correct')]);
  assert.deepEqual(cellRecord(p, K).days, []);
  assert.equal(cellRecord(p, K).streak, 2);
});

test('mastered is derived: streak ≥ 3 and 2 days; a miss un-derives it, days stay', () => {
  let p = run([transfer('correct')], '2026-10-09');
  p = run([transfer('correct'), tap('correct')], '2026-10-10', p);
  assert.equal(cellStatus(p, K), 'mastered');
  assert.ok(isMastered(cellRecord(p, K)));
  p = run([tap('wrong')], '2026-10-10', p);
  assert.equal(cellStatus(p, K), 'learning');
  assert.equal(cellRecord(p, K).days.length, 2);
  // streak 3 on a single day is not enough
  assert.equal(cellStatus(run([transfer('correct'), tap('correct'), tap('correct')]), K), 'learning');
});

test('Recall, Echo and practice-only Discriminate taps never touch progress', () => {
  const start = emptyProgress();
  for (const e of [{ key: K, step: 'recall', result: 'correct' }, { key: K, step: 'echo', result: 'wrong' },
    tap('correct', false), tap('wrong', false)]) {
    assert.equal(isScored(e), false);
    assert.equal(applyEvent(start, e, '2026-10-09'), start);
  }
  assert.equal(cellStatus(start, K), 'new');
});

test('status: new → learning → mastered, per cell', () => {
  const p = run([tap('wrong')]);
  assert.equal(cellStatus(p, K), 'learning');
  assert.equal(cellStatus(p, 'ver.pps.eu'), 'new');
});

test('a verb+tense is mastered only when all its covered cells are', () => {
  const two = ['vir.pps.eu', 'vir.pps.tu'];
  let p = emptyProgress();
  for (const key of two) {
    p = run([transfer('correct', true, key)], '2026-10-09', p);
    p = run([transfer('correct', true, key), tap('correct', true, key)], '2026-10-10', p);
  }
  assert.equal(groupMastered(p, two), true);
  assert.equal(groupMastered(p, [...two, 'vir.pps.ele']), false);
  assert.equal(groupMastered(p, []), false);
});

test('applyEvent does not change its input', () => {
  const p = run([transfer('correct')]);
  const copy = JSON.parse(JSON.stringify(p));
  applyEvent(p, tap('wrong'), '2026-10-11');
  applyEvent(p, transfer('correct'), '2026-10-11');
  assert.deepEqual(p, copy);
});

test('progress round-trips through JSON with version 1', () => {
  const p = run([transfer('correct'), tap('correct')]);
  const back = validateProgress(JSON.parse(JSON.stringify(p)));
  assert.equal(back.ok, true);
  assert.deepEqual(back.progress, p);
  assert.equal(p.version, 1);
});

test('validateProgress rejects bad shapes and versions', () => {
  const bad = [
    [null, /JSON object/], [[], /JSON object/], ['x', /JSON object/],
    [{ version: 2, cells: {} }, /version 2/], [{ cells: {} }, /version undefined/],
    [{ version: 1 }, /"cells"/], [{ version: 1, cells: [] }, /"cells"/],
    [{ version: 1, cells: { a: 1 } }, /cell a is not an object/],
    [{ version: 1, cells: { a: { streak: -1, days: [], events: 0 } } }, /streak/],
    [{ version: 1, cells: { a: { streak: 1.5, days: [], events: 0 } } }, /streak/],
    [{ version: 1, cells: { a: { streak: 0, days: ['9/10/2026'], events: 0 } } }, /days/],
    [{ version: 1, cells: { a: { streak: 0, days: [], events: 'x' } } }, /events/],
  ];
  for (const [value, re] of bad) {
    const r = validateProgress(value);
    assert.equal(r.ok, false, JSON.stringify(value));
    assert.match(r.error, re);
  }
  assert.equal(validateProgress(emptyProgress()).ok, true);
});

test('localDate uses the local calendar date', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('a looked-up attempt is graded elsewhere but never touches progress (decision 0015)', () => {
  const start = run([transfer('correct'), tap('correct')]);
  const before = cellRecord(start, K);
  for (const e of [
    { ...transfer('correct'), lookedUp: true },              // would build streak and add a day
    { ...transfer('wrong'), lookedUp: true },                // would reset the streak
    { ...tap('correct'), lookedUp: true },
    { ...tap('wrong'), lookedUp: true },
  ]) {
    assert.equal(isScored(e), false);
    assert.equal(applyEvent(start, e, '2026-10-26'), start);
  }
  assert.deepEqual(cellRecord(start, K), before);
  // lookedUp: false (or absent) changes nothing about the normal rules
  assert.equal(isScored({ ...transfer('correct'), lookedUp: false }), true);
});
