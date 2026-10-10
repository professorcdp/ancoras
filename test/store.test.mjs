// Tests for js/store.js with a fake, localStorage-like storage. Run with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, KEY, BAD_KEY } from '../js/store.js';
import { cellRecord } from '../js/progress.js';

// A Map-backed stand-in for localStorage; failSet / failGet make it throw like a full or
// blocked browser storage.
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    failSet: false,
    failGet: false,
    getItem(k) { if (this.failGet) throw new Error('blocked'); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (this.failSet) throw new Error('full'); map.set(k, String(v)); },
  };
}
const today = () => '2026-10-09';
const transfer = (key, result = 'correct') => ({ key, step: 'transfer', result, firstAttempt: true });
const stored = s => JSON.parse(s.map.get(KEY));

test('two tabs sharing one storage both keep their answers', () => {
  const storage = fakeStorage();
  const tabA = createStore(storage, { today });
  const tabB = createStore(storage, { today });
  tabA.get(); tabB.get(); // both "open" before either answers
  tabA.record(transfer('vir.pps.eu'));
  tabB.record(transfer('ver.pps.eu'));
  tabA.record(transfer('vir.pps.eu'));
  const p = stored(storage);
  assert.equal(cellRecord(p, 'vir.pps.eu').streak, 2);
  assert.equal(cellRecord(p, 'ver.pps.eu').streak, 1);
  assert.deepEqual(tabB.get(), p); // either tab sees the latest copy
});

test('damaged saved progress is copied aside before being overwritten, and reported once', () => {
  const raw = '{"version":1,"cells":{"x":{"streak":"lots"}}}';
  const storage = fakeStorage({ [KEY]: raw });
  const store = createStore(storage, { today });
  const seen = [];
  store.onProblem(p => seen.push(p.kind));
  assert.deepEqual(store.get(), { version: 1, cells: {} });
  assert.equal(storage.map.get(BAD_KEY), raw);
  store.record(transfer('vir.pps.eu'));
  assert.equal(storage.map.get(BAD_KEY), raw);              // copy kept
  assert.equal(cellRecord(stored(storage), 'vir.pps.eu').streak, 1);
  store.get();
  assert.deepEqual(seen, ['damaged']);
  assert.match(store.problems()[0].message, /streak must be a whole number/);
});

test('wrong-version and unreadable saved values are kept aside too', () => {
  for (const raw of ['{"version":2,"cells":{}}', 'not json']) {
    const storage = fakeStorage({ [KEY]: raw });
    const store = createStore(storage, { today });
    store.record(transfer('vir.pps.eu'));
    assert.equal(storage.map.get(BAD_KEY), raw);
    assert.equal(store.problems()[0].kind, 'damaged');
  }
});

test('a failed save is reported once and progress carries on in memory', () => {
  const storage = fakeStorage();
  const store = createStore(storage, { today });
  store.record(transfer('vir.pps.eu'));
  storage.failSet = true;
  const seen = [];
  store.onProblem(p => seen.push(p.kind));
  store.record(transfer('vir.pps.eu'));
  store.record(transfer('vir.pps.eu'));
  assert.deepEqual(seen, ['save-failed']);
  assert.equal(cellRecord(store.get(), 'vir.pps.eu').streak, 3); // nothing lost in this page
  assert.equal(cellRecord(stored(storage), 'vir.pps.eu').streak, 1); // storage kept its last good copy
});

test('blocked or missing storage is reported, and practice still works in memory', () => {
  for (const storage of [null, Object.assign(fakeStorage(), { failGet: true })]) {
    const store = createStore(storage, { today });
    const seen = [];
    store.onProblem(p => seen.push(p.kind));
    store.record(transfer('vir.pps.eu'));
    store.record(transfer('vir.pps.eu'));
    assert.deepEqual(seen, ['blocked']);
    assert.equal(cellRecord(store.get(), 'vir.pps.eu').streak, 2);
  }
});

test('listeners added later still hear about earlier problems', () => {
  const store = createStore(null, { today });
  store.get();
  const seen = [];
  store.onProblem(p => seen.push(p.kind));
  assert.deepEqual(seen, ['blocked']);
});

test('replace and reset save at once', () => {
  const storage = fakeStorage();
  const store = createStore(storage, { today });
  store.replace({ version: 1, cells: { a: { streak: 2, days: [], events: 2 } } });
  assert.equal(stored(storage).cells.a.streak, 2);
  store.reset();
  assert.deepEqual(stored(storage), { version: 1, cells: {} });
});
