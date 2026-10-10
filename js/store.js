// Saved progress ("ancoras.progress"). Thin wrapper around js/progress.js, written against a
// localStorage-like `storage` so it can be tested with a fake (test/store.test.mjs).
//
// - Every scored answer is applied to the LATEST stored copy and saved at once, so two open
//   tabs don't overwrite each other and leaving mid-session keeps what was done.
// - A damaged or wrong-version stored value is copied to "ancoras.progress.bad" before
//   anything overwrites it, and reported.
// - Blocked storage or a failed save is reported; progress then carries on in memory (and
//   can still be exported) until the page is closed.
// Problems are reported once each to the onProblem listeners as { kind, message }.
// Storage is per address (incl. the port): serve.mjs keeps to port 4791 for this reason.

import { applyEvent, emptyProgress, localDate, validateProgress } from './progress.js';

export const KEY = 'ancoras.progress';
export const BAD_KEY = 'ancoras.progress.bad';

const MESSAGES = {
  blocked: 'Progress can\'t be saved in this browser (storage is blocked), so it will be lost ' +
    'when you close the page. Use Export progress to keep a copy.',
  'save-failed': 'Progress could not be saved in this browser. It is kept until you close the ' +
    'page; use Export progress to keep a copy.',
  damaged: error => `Your saved progress couldn't be read (${error}). A copy was kept in this ` +
    `browser as "${BAD_KEY}", and progress starts fresh.`,
};

export function createStore(storage, { today = localDate } = {}) {
  const listeners = [];
  const reported = []; // problems so far, replayed to late listeners
  let unsaved = null; // progress that couldn't be saved: used instead of storage from then on

  function report(kind, detail) {
    if (reported.some(p => p.kind === kind)) return;
    const message = typeof MESSAGES[kind] === 'function' ? MESSAGES[kind](detail) : MESSAGES[kind];
    const problem = { kind, message };
    reported.push(problem);
    listeners.forEach(fn => fn(problem));
  }

  // The latest progress: what's stored now, or the in-memory copy if saving has failed.
  function load() {
    if (unsaved) return unsaved;
    let raw;
    try {
      if (!storage) throw new Error('no storage');
      raw = storage.getItem(KEY);
    } catch {
      report('blocked');
      unsaved = emptyProgress();
      return unsaved;
    }
    if (raw == null) return emptyProgress();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined;
    }
    const checked = validateProgress(parsed);
    if (checked.ok) return checked.progress;
    // Keep the damaged value before the next save replaces it.
    try {
      if (storage.getItem(BAD_KEY) !== raw) storage.setItem(BAD_KEY, raw);
    } catch {
      // Can't keep a copy; the warning still tells the learner.
    }
    report('damaged', checked.error);
    return emptyProgress();
  }

  function save(progress) {
    if (unsaved) {
      unsaved = progress;
      return false;
    }
    try {
      storage.setItem(KEY, JSON.stringify(progress));
      return true;
    } catch {
      report('save-failed');
      unsaved = progress;
      return false;
    }
  }

  return {
    get: load,
    // Apply one answer (see applyEvent) dated today to the latest copy, save, and return it.
    record(event) {
      const next = applyEvent(load(), event, today());
      save(next);
      return next;
    },
    replace(progress) {
      save(progress);
    },
    reset() {
      save(emptyProgress());
    },
    onProblem(fn) {
      listeners.push(fn);
      reported.forEach(p => fn(p));
    },
    problems: () => reported.slice(),
  };
}

// The browser's localStorage, or null where even touching it throws (some privacy modes).
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
