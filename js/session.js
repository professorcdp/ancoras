// Session building (SPEC §5, §6). Pure: no DOM or storage, tested by test/session.test.mjs.
// A session is a list of cells; each cell gets a Meet anchor and a Transfer item.

import { isObject, cellKey, formRegex } from './validate.js';
import { CORRECT } from './grade.js';

const list = x => (Array.isArray(x) ? x : []);
const verbsOf = data => (isObject(data?.verbs) ? data.verbs : {});

export function defaultSelection(data) {
  return {
    verbs: [],
    tenses: Object.keys(isObject(data?.tenses) ? data.tenses : {}),
    persons: list(data?.persons).slice(),
  };
}

// Keep only known values; fall back to the defaults if the stored value is malformed.
export function restoreSelection(data, stored) {
  const fallback = defaultSelection(data);
  if (!isObject(stored)) return fallback;
  const keep = (key, known) =>
    Array.isArray(stored[key]) ? known.filter(k => stored[key].includes(k)) : fallback[key];
  return {
    verbs: keep('verbs', Object.keys(verbsOf(data))),
    tenses: keep('tenses', fallback.tenses),
    persons: keep('persons', fallback.persons),
  };
}

// One preset per group of verbs linked by confusion_set (vir+ver, ir+ser, ...), in data order.
export function presets(data) {
  const verbs = verbsOf(data);
  const seen = new Set();
  const groups = [];
  for (const start of Object.keys(verbs)) {
    if (seen.has(start) || !list(verbs[start]?.confusion_set).length) continue;
    const group = [];
    const stack = [start];
    while (stack.length) {
      const v = stack.pop();
      if (seen.has(v) || !(v in verbs)) continue;
      seen.add(v);
      group.push(v);
      stack.push(...list(verbs[v]?.confusion_set));
    }
    const order = Object.keys(verbs);
    groups.push(group.sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  }
  return groups;
}

// cell key -> anchors targeting it, in file order.
export function anchorsByCell(data) {
  const map = new Map();
  for (const a of list(data?.anchors)) {
    if (!isObject(a)) continue;
    for (const t of list(a.targets)) {
      if (!isObject(t)) continue;
      const key = cellKey(t.verb, t.tense, t.person);
      if (!map.has(key)) map.set(key, []);
      if (!map.get(key).includes(a)) map.get(key).push(a);
    }
  }
  return map;
}

// The selected verb × tense × person combinations that have a form and at least one anchor.
// Combinations with a form but no anchor (uncovered cells) are counted in `skipped` (#8).
export function buildCells(data, selection, byCell = anchorsByCell(data)) {
  const verbs = verbsOf(data);
  const cells = [];
  let skipped = 0;
  for (const verb of Object.keys(verbs)) {
    if (!selection.verbs.includes(verb)) continue;
    for (const tense of selection.tenses) {
      for (const person of selection.persons) {
        const form = verbs[verb]?.forms?.[tense]?.[person];
        if (typeof form !== 'string') continue;
        const key = cellKey(verb, tense, person);
        const anchors = byCell.get(key) ?? [];
        if (!anchors.length) skipped++;
        else cells.push({ key, verb, tense, person, form, anchors });
      }
    }
  }
  return { cells, skipped };
}

// Meet anchor: an established one if there is one, otherwise the first in file order.
export function pickMeetAnchor(anchors) {
  return anchors.find(a => a.established === true) ?? anchors[0];
}

// Echo anchor (SPEC §6 step 3, decision 0006): an echo anchor whose answer turn contains the
// cell's form as a whole word. Prefer the Meet anchor if it qualifies, else the first in file
// order. Undefined if none: the cell skips Echo (e.g. a tu form only in the question).
export function pickEchoAnchor(cell, meet) {
  const qualifies = a => a?.kind === 'echo' && Array.isArray(a.turns) && a.turns.length === 2 &&
    a.turns.every(t => typeof t === 'string') &&
    formRegex(cell.form).test(a.turns[1].normalize('NFC'));
  if (meet && cell.anchors.includes(meet) && qualifies(meet)) return meet;
  return cell.anchors.find(qualifies);
}

// The targets of an anchor whose form appears in `text` (e.g. an echo anchor's answer
// turn), one per cell, in target order.
export function targetsIn(anchor, text) {
  const t = String(text).normalize('NFC');
  const seen = new Set();
  return list(anchor?.targets).filter(isObject).filter(x => {
    const key = cellKey(x.verb, x.tense, x.person);
    if (seen.has(key) || typeof x.form !== 'string' || !formRegex(x.form).test(t)) return false;
    seen.add(key);
    return true;
  });
}

// The target forms of an anchor that appear in `text`, without repeats.
export function formsIn(anchor, text) {
  return [...new Set(targetsIn(anchor, text).map(x => x.form))];
}

export const TENSE_SHORT = { pres: 'present', pps: 'PPS' };
export const tenseLabel = t => TENSE_SHORT[t] ?? t;

// A cue naming the cells being graded, with `first` (the session's cell) leading:
// one cell "tu · vir · present"; same verb and tense "tu + eu · vir · present";
// same person and tense "eu · vir + ver · PPS"; otherwise full cues joined by " + ".
export function describeCells(targets, first) {
  const cells = [];
  for (const t of [first, ...list(targets)].filter(isObject)) {
    if (!cells.some(c => c.verb === t.verb && c.tense === t.tense && c.person === t.person)) {
      cells.push({ verb: t.verb, tense: t.tense, person: t.person });
    }
  }
  const same = k => cells.every(c => c[k] === cells[0][k]);
  const join = k => [...new Set(cells.map(c => c[k]))].join(' + ');
  if (cells.length <= 1 || (same('verb') && same('tense'))) {
    return `${join('person')} · ${cells[0]?.verb} · ${tenseLabel(cells[0]?.tense)}`;
  }
  if (same('person') && same('tense')) return `${cells[0].person} · ${join('verb')} · ${tenseLabel(cells[0].tense)}`;
  return cells.map(c => `${c.person} · ${c.verb} · ${tenseLabel(c.tense)}`).join(' + ');
}

// Transfer sentence (SPEC §6 step 5): another anchor for the same cell, then an entry from
// the cell's anchors' `transfer` lists (a string, or {pt, en}), then a bare prompt.
// Sentences that don't contain the form as a whole word can't be blanked, so are skipped.
export function pickTransfer(cell, meet, rng = Math.random) {
  const has = text => typeof text === 'string' && formRegex(cell.form).test(text.normalize('NFC'));
  const others = cell.anchors.filter(a => a !== meet && has(a.pt));
  if (others.length) {
    const a = others[Math.floor(rng() * others.length)];
    return { source: 'anchor', pt: a.pt, en: a.en, id: a.id };
  }
  for (const a of [meet, ...cell.anchors.filter(a => a !== meet)]) {
    for (const entry of list(a.transfer)) {
      const pt = typeof entry === 'string' ? entry : entry?.pt;
      if (has(pt)) return { source: 'transfer', pt, en: isObject(entry) ? entry.en : undefined };
    }
  }
  return { source: 'bare' };
}

// Split `text` around whole-word occurrences of `form`:
// ["Ele ", {form: "veio"}, " ontem."]. The page renders the parts as blanks or marks.
export function splitOnForm(text, form) {
  const t = text.normalize('NFC');
  const parts = [];
  let last = 0;
  for (const m of t.matchAll(formRegex(form, 'giu'))) {
    parts.push(t.slice(last, m.index), { form: m[0] });
    last = m.index + m[0].length;
  }
  parts.push(t.slice(last));
  return parts.filter(p => p !== '');
}

function shuffle(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle, then a swap pass so neighbours differ in cell and, where possible, in verb.
// `prev` is the item shown just before this list (e.g. the last Meet before Transfer).
export function orderCells(cells, rng = Math.random, prev = null) {
  const a = shuffle(cells, rng);
  const clash = (x, y) => y && (x.key === y.key || x.verb === y.verb);
  for (let i = 0; i < a.length; i++) {
    const before = i === 0 ? prev : a[i - 1];
    if (!clash(a[i], before)) continue;
    let j = a.findIndex((c, k) => k > i && !clash(c, before));
    if (j === -1 && a[i].key === before.key) j = a.findIndex((c, k) => k > i && c.key !== before.key);
    if (j !== -1) [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// After a graded answer (Recall, Echo or Transfer; decision 0007): a miss (wrong or almost)
// on the first attempt sends the cell to the back of the queue once. Returns the new queue; the answered item is already removed.
export function requeue(queue, item, result) {
  if (result !== CORRECT && item.attempt === 1) return [...queue, { ...item, attempt: 2 }];
  return queue;
}

// One summary row per cell: 'first' (right first time), 'retry' (right on the retry) or
// 'missed', plus whether any attempt was 'almost'.
export function summarize(cells, results) {
  return cells.map(cell => {
    const r = results.get(cell.key) ?? [];
    const status = r[0] === CORRECT ? 'first' : r[1] === CORRECT ? 'retry' : 'missed';
    return { cell, status, attempts: r, almost: r.includes('almost') };
  });
}
