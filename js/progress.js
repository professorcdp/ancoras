// Mastery progress (SPEC §8, decision 0009). Pure: no DOM or storage, tested by
// test/progress.test.mjs. Progress is plain JSON:
//   { version: 1, cells: { "vir.pps.eu": { streak, days: ["2026-10-09", …], events } } }
// streak  consecutive correct answers on the bare-form steps (scored Discriminate taps and
//         every Transfer attempt); any miss, including "almost", resets it to 0.
// days    distinct local dates on which Transfer's FIRST attempt was correct
//         (SPEC's sessions_correct = days.length).
// events  how many scored answers the cell has had (0 = never practised: 'new').
// Mastered is derived, never stored: streak ≥ 3 and at least 2 days.

import { CORRECT } from './grade.js';

export const VERSION = 1;
export const MASTERY_STREAK = 3;
export const MASTERY_DAYS = 2;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isCount = n => Number.isInteger(n) && n >= 0;

export function emptyProgress() {
  return { version: VERSION, cells: {} };
}

// Local calendar date "YYYY-MM-DD" (not UTC: a late-evening session counts as that day).
export function localDate(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const blank = () => ({ streak: 0, days: [], events: 0 });

export function cellRecord(progress, key) {
  return progress?.cells?.[key] ?? blank();
}

// Does this event count toward mastery? Only the bare-form steps, and for Discriminate only
// items about the cell's own form (decision 0008 amendment). Recall and Echo never do.
export function isScored(event) {
  if (event?.step === 'transfer') return true;
  if (event?.step === 'discriminate') return event.counts === true;
  return false;
}

// Apply one answer: { key, step: 'discriminate'|'transfer'|…, result, firstAttempt, counts }.
// Returns a new progress object; the input is not changed. `today` is "YYYY-MM-DD".
export function applyEvent(progress, event, today) {
  if (!isScored(event) || typeof event.key !== 'string') return progress;
  const old = cellRecord(progress, event.key);
  const correct = event.result === CORRECT;
  const addDay = correct && event.step === 'transfer' && event.firstAttempt === true &&
    !old.days.includes(today);
  const rec = {
    streak: correct ? old.streak + 1 : 0,
    days: addDay ? [...old.days, today].sort() : old.days.slice(),
    events: old.events + 1,
  };
  return { ...progress, version: VERSION, cells: { ...progress.cells, [event.key]: rec } };
}

export function isMastered(rec) {
  return rec.streak >= MASTERY_STREAK && rec.days.length >= MASTERY_DAYS;
}

// 'new' (no scored answers yet), 'learning', or 'mastered'.
export function cellStatus(progress, key) {
  const rec = cellRecord(progress, key);
  if (!rec.events) return 'new';
  return isMastered(rec) ? 'mastered' : 'learning';
}

// A verb+tense is mastered when it has covered cells and all of them are mastered.
export function groupMastered(progress, keys) {
  return keys.length > 0 && keys.every(k => cellStatus(progress, k) === 'mastered');
}

// Check a value read from storage or an imported file. Returns { ok: true, progress } (a
// clean copy) or { ok: false, error } with a short reason.
export function validateProgress(value) {
  if (!isObj(value)) return { ok: false, error: 'not a progress file (expected a JSON object)' };
  if (value.version !== VERSION) return { ok: false, error: `unsupported version ${JSON.stringify(value.version)} (expected ${VERSION})` };
  if (!isObj(value.cells)) return { ok: false, error: '"cells" is missing or not an object' };
  const cells = {};
  for (const [key, rec] of Object.entries(value.cells)) {
    if (!isObj(rec)) return { ok: false, error: `cell ${key} is not an object` };
    if (!isCount(rec.streak)) return { ok: false, error: `cell ${key}: streak must be a whole number ≥ 0` };
    if (!isCount(rec.events)) return { ok: false, error: `cell ${key}: events must be a whole number ≥ 0` };
    if (!Array.isArray(rec.days) || !rec.days.every(d => typeof d === 'string' && DATE.test(d))) {
      return { ok: false, error: `cell ${key}: days must be a list of "YYYY-MM-DD" dates` };
    }
    cells[key] = { streak: rec.streak, days: [...new Set(rec.days)].sort(), events: rec.events };
  }
  return { ok: true, progress: { version: VERSION, cells } };
}
