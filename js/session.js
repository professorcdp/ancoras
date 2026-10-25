// Session building (SPEC §5, §6). Pure: no DOM or storage, tested by test/session.test.mjs.
// A session is a list of cells; each cell gets a Meet anchor and a Transfer item.

import { isObject, cellKey, formRegex } from './validate.js';
import { CORRECT } from './grade.js';

const list = x => (Array.isArray(x) ? x : []);
const verbsOf = data => (isObject(data?.verbs) ? data.verbs : {});

// The picker's selection. `steps` are the phases to run (decision 0014): all on by default.
export function defaultSelection(data) {
  return {
    verbs: [],
    tenses: Object.keys(isObject(data?.tenses) ? data.tenses : {}),
    persons: list(data?.persons).slice(),
    steps: PHASES.slice(),
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
    steps: keep('steps', fallback.steps), // missing or malformed (e.g. saved before #18): all on
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

// The phases of a session, in order (SPEC §6; decisions 0005, 0007, 0008), each with the
// cells it covers. Phases with no cells are left out: Echo needs an echo anchor (`cell.echo`),
// Discriminate needs items (`cell.discriminate`). So are phases the learner switched off
// (`enabled`, decision 0014).
export const PHASES = ['meet', 'recall', 'echo', 'discriminate', 'transfer'];
export function planPhases(cells, enabled = PHASES) {
  const covers = {
    meet: () => true,
    recall: () => true,
    echo: c => Boolean(c.echo),
    discriminate: c => list(c.discriminate).length > 0,
    transfer: () => true,
  };
  return PHASES
    .filter(name => enabled.includes(name))
    .map(name => ({ name, cells: cells.filter(covers[name]) }))
    .filter(p => p.cells.length);
}

// Give each cell what the phase plan needs: its Meet anchor, Echo anchor and Discriminate
// items. (Recall uses the Meet anchor even when Meet is switched off.)
export function prepareCells(data, cells, rng = Math.random) {
  return cells.map(cell => {
    const meet = pickMeetAnchor(cell.anchors);
    return { ...cell, meet, echo: pickEchoAnchor(cell, meet), discriminate: discriminateItemsFor(data, cell, rng) };
  });
}

// About how many screens a session takes before retries: one per cell in Meet, Recall and
// Transfer, one per Echo cell, one per Discriminate item.
export function screenCount(data, cells, steps = PHASES) {
  return planPhases(prepareCells(data, cells), steps).reduce((n, p) =>
    n + (p.name === 'discriminate' ? p.cells.reduce((m, c) => m + c.discriminate.length, 0) : p.cells.length), 0);
}

// Run the phases one after another: run(phase, prev, next) shows a phase starting after
// `prev` (the last cell shown) and calls next(lastCellShown) when done; then done(last).
export function runPhases(phases, run, done, prev = null) {
  const step = (i, last) => (i >= phases.length ? done(last) : run(phases[i], last, l => step(i + 1, l)));
  step(0, prev);
}

// Leaving a practice session (Back, the End button, the title link). Pass `confirmed` once
// the learner has answered the question. Returns:
//   { action: 'ask' }                                   ask first (session unfinished)
//   { action: 'leave', popHistory }                     go home; popHistory: also pop the
//                                                       session's history entry (not Back,
//                                                       which already popped it)
//   { action: 'stay', restoreHistory }                  keep the session; restoreHistory: put
//                                                       back the entry Back popped
export function decideLeave({ via, inProgress, confirmed }) {
  if (inProgress && confirmed === undefined) return { action: 'ask' };
  if (!inProgress || confirmed) return { action: 'leave', popHistory: via !== 'back' };
  return { action: 'stay', restoreHistory: via === 'back' };
}

// Discriminate (SPEC §6 step 4, decision 0008): about 5 tap items per cell whose verb has a
// confusion set, of two kinds:
//   'verb'  "Which verb?": show a form, pick the infinitive. The form is the cell's own or the
//           same tense+person form of a confusable verb. Never used for a form that also
//           appears anywhere in another set verb's paradigm (all of ir/ser PPS, vimos …).
//   'form'  "Which form?": cue person + verb + gloss + tense, pick among the same tense+person
//           forms of the set's verbs. Not possible when two of those forms are identical.
// Kinds alternate; if only one kind is possible, all items are that kind; if neither, the
// cell gets no items. Options are shuffled and hold the right answer exactly once.
// `counts` (decision 0008, amended for #23): only items about the cell's OWN form count
// toward its mastery: its 'form' items and 'verb' items showing its own form. 'verb' items
// showing a confusable verb's form are practice, scored for no cell.
export const DISCRIMINATE_ITEMS = 5;

const formKey = f => String(f).normalize('NFC').toLowerCase();

export function discriminateItemsFor(data, cell, rng = Math.random) {
  const verbs = verbsOf(data);
  const set = [cell.verb, ...list(verbs[cell.verb]?.confusion_set)]
    .filter((v, i, a) => v in verbs && a.indexOf(v) === i);
  if (set.length < 2) return [];
  const formAt = v => verbs[v]?.forms?.[cell.tense]?.[cell.person];
  const paradigm = v => Object.values(isObject(verbs[v]?.forms) ? verbs[v].forms : {})
    .flatMap(ps => Object.values(isObject(ps) ? ps : {})).map(formKey);
  const sharedWithOther = (form, v) => set.some(w => w !== v && paradigm(w).includes(formKey(form)));

  // Kind 'verb' candidates: (form, verb) pairs at this tense+person, unambiguous in the set.
  const verbItems = set
    .filter(v => typeof formAt(v) === 'string' && !sharedWithOther(formAt(v), v))
    .map(v => ({ form: formAt(v), answer: v }));
  // Kind 'form' is possible when the set's forms at this tense+person are all different.
  const choices = set.filter(v => typeof formAt(v) === 'string').map(formAt);
  const formOk = choices.length >= 2 && new Set(choices.map(formKey)).size === choices.length;

  const kinds = verbItems.length && formOk ? ['verb', 'form'] : verbItems.length ? ['verb'] : formOk ? ['form'] : [];
  if (!kinds.length) return [];
  const items = [];
  for (let i = 0; i < DISCRIMINATE_ITEMS; i++) {
    const kind = kinds[i % kinds.length];
    if (kind === 'verb') {
      const pick = verbItems[Math.floor(i / kinds.length) % verbItems.length];
      items.push({
        kind, key: cell.key, counts: pick.answer === cell.verb,
        form: pick.form, answer: pick.answer, options: shuffle(set, rng),
      });
    } else {
      items.push({
        kind, key: cell.key, counts: true, verb: cell.verb, gloss: verbs[cell.verb]?.gloss, tense: cell.tense,
        person: cell.person, answer: cell.form, options: shuffle(choices, rng),
      });
    }
  }
  return items;
}

// Discriminate tally per cell from the taps in a session ({ key, counts, right } each):
// key -> { scored: { right, total }, practice: { right, total } }. Only `scored` will feed
// mastery (M4); `practice` is shown but scored for no cell.
export function tallyDiscriminate(taps) {
  const out = new Map();
  for (const t of list(taps)) {
    if (!out.has(t.key)) out.set(t.key, { scored: { right: 0, total: 0 }, practice: { right: 0, total: 0 } });
    const bucket = out.get(t.key)[t.counts ? 'scored' : 'practice'];
    bucket.total++;
    if (t.right) bucket.right++;
  }
  return out;
}

// Interleave several lists of items so that no two neighbours come from the same list (cell)
// when that's possible: always take from the list with most items left that differs from the
// last one taken (ties broken at random). `prevKey` is the cell shown just before.
export function interleave(lists, keyOf, rng = Math.random, prevKey = null) {
  const pools = lists.map(l => l.slice()).filter(l => l.length);
  const out = [];
  let last = prevKey;
  while (pools.length) {
    const ok = pools.filter(p => keyOf(p[0]) !== last);
    const from = ok.length ? ok : pools;
    const most = Math.max(...from.map(p => p.length));
    const top = from.filter(p => p.length === most);
    const pool = top[Math.floor(rng() * top.length)];
    const item = pool.shift();
    out.push(item);
    last = keyOf(item);
    if (!pool.length) pools.splice(pools.indexOf(pool), 1);
  }
  return out;
}

// Why Start can't be pressed, or null if it can (#34). `ok` is false when anchors.json has
// problems (the banner explains those, so no message here).
export function startBlocker({ ok, cells, steps, screens }) {
  if (!ok) return { reason: 'data', message: '' };
  if (!cells) return { reason: 'no-cells', message: '' };
  if (!steps) return { reason: 'no-steps', message: '(tick at least one step)' };
  if (!screens) {
    return {
      reason: 'no-screens',
      message: '(nothing to practise: none of these cells has the ticked steps — Echo needs a ' +
        'question-and-answer anchor, Discriminate a verb with a confusion set)',
    };
  }
  return null;
}

// What the Forms panel shows for a screen (decision 0015): the verbs to show, each as its own
// block, and the cells to highlight. `cells` are the cell(s) being practised or shown (e.g. an
// echo pair's targets). The first cell's verb comes first, then its confusion set, then any
// other verb among the cells. Nothing is highlighted when `highlight` is false (the picker).
export function formsFocus(data, cells, { highlight = true } = {}) {
  const verbs = verbsOf(data);
  const shown = list(cells).filter(c => isObject(c) && c.verb in verbs);
  const order = [];
  const add = v => { if (v in verbs && !order.includes(v)) order.push(v); };
  if (shown.length) {
    add(shown[0].verb);
    list(verbs[shown[0].verb]?.confusion_set).forEach(add);
    shown.forEach(c => add(c.verb));
  }
  const keys = highlight ? shown.filter(c => c.tense && c.person).map(c => cellKey(c.verb, c.tense, c.person)) : [];
  return { verbs: order, highlight: new Set(keys) };
}
