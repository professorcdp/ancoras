// Saved progress in localStorage ("ancoras.progress"). Thin wrapper around js/progress.js:
// every scored answer is applied and saved at once, so leaving mid-session keeps it.
// Storage is per address (incl. the port): serve.mjs keeps to port 4791 for this reason.

import { applyEvent, emptyProgress, localDate, validateProgress } from './progress.js';

const KEY = 'ancoras.progress';

function load() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return emptyProgress(); // storage blocked: practise without saving
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
  // Leave the stored value alone until the next save, in case it can be recovered by hand.
  console.warn(`Saved progress ignored (${checked.error}); starting empty.`);
  return emptyProgress();
}

function save(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage blocked or full: progress lasts until the page is closed.
  }
}

let current = load();

export function getProgress() {
  return current;
}

// Apply one answer (see applyEvent) dated today, save, and return the new progress.
export function record(event) {
  current = applyEvent(current, event, localDate());
  save(current);
  return current;
}

export function replaceProgress(progress) {
  current = progress;
  save(current);
}

export function resetProgress() {
  replaceProgress(emptyProgress());
}
