// Validator for anchors.json. Pure: takes parsed data, returns problems and stats.
// No DOM or browser APIs, so the page (js/main.js) and Node (validate.mjs) share it.
// It never throws on malformed data: bad entries are skipped and reported as problems.

const ANCHOR_KINDS = ['formula', 'sentence', 'echo', 'contrast'];

// A plain JSON object (not null, not an array).
export function isObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

export function cellKey(verb, tense, person) {
  return `${verb}.${tense}.${person}`;
}

// Every cell that has a form in the paradigms: verb × tense × person.
// Persons a verb doesn't have (e.g. haver only has ele) are simply absent.
export function allCells(data) {
  const cells = [];
  const verbs = isObject(data?.verbs) ? data.verbs : {};
  for (const [verb, v] of Object.entries(verbs)) {
    if (!isObject(v?.forms)) continue;
    for (const [tense, persons] of Object.entries(v.forms)) {
      if (!isObject(persons)) continue;
      for (const person of Object.keys(persons)) {
        cells.push(cellKey(verb, tense, person));
      }
    }
  }
  return cells;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True if `form` occurs in `text` as a whole word. Case-insensitive (so "Vim" at the
// start of a sentence matches "vim"), but accents count: "pode" does not match "pôde".
// Hyphens are word boundaries, so "Vi-o" contains "vi".
export function containsForm(text, form) {
  const re = new RegExp(
    `(?<![\\p{L}\\p{M}])${escapeRegExp(form.normalize('NFC'))}(?![\\p{L}\\p{M}])`,
    'iu'
  );
  return re.test(text.normalize('NFC'));
}

export function validate(data) {
  const problems = [];
  const add = (ref, msg) => problems.push({ ref, msg });

  if (!isObject(data)) {
    add('file', 'top level is not a JSON object');
    return { problems, covered: new Map(), stats: { verbs: 0, anchors: 0, cells: 0, covered: 0 } };
  }
  for (const key of ['persons', 'tenses', 'verbs', 'anchors', 'uncovered_cells']) {
    if (!(key in data)) add('file', `missing top-level key "${key}"`);
  }
  if ('verbs' in data && !isObject(data.verbs)) add('file', '"verbs" is not an object');
  for (const key of ['persons', 'anchors', 'uncovered_cells']) {
    if (key in data && !Array.isArray(data[key])) add('file', `"${key}" is not a list`);
  }

  const verbs = isObject(data.verbs) ? data.verbs : {};
  const anchors = Array.isArray(data.anchors) ? data.anchors : [];
  const persons = Array.isArray(data.persons) ? data.persons : [];
  const tenses = isObject(data.tenses) ? data.tenses : {};
  const uncovered = Array.isArray(data.uncovered_cells) ? data.uncovered_cells : [];

  // Verbs: forms use known tenses/persons; confusion sets are symmetric.
  for (const [verb, v] of Object.entries(verbs)) {
    if (!isObject(v)) {
      add(`verb ${verb}`, 'is not an object');
      continue;
    }
    if (!isObject(v.forms)) add(`verb ${verb}`, '"forms" is missing or not an object');
    for (const [tense, forms] of Object.entries(isObject(v.forms) ? v.forms : {})) {
      if (!(tense in tenses)) add(`verb ${verb}`, `unknown tense "${tense}" in forms`);
      if (!isObject(forms)) {
        add(`verb ${verb}`, `forms.${tense} is not an object`);
        continue;
      }
      for (const [person, form] of Object.entries(forms)) {
        if (!persons.includes(person)) add(`verb ${verb}`, `unknown person "${person}" in forms.${tense}`);
        if (typeof form !== 'string' || !form.trim()) add(`cell ${cellKey(verb, tense, person)}`, 'empty form');
      }
    }
    if (v.confusion_set !== undefined && !Array.isArray(v.confusion_set)) {
      add(`verb ${verb}`, 'confusion_set is not a list');
    }
    for (const other of Array.isArray(v.confusion_set) ? v.confusion_set : []) {
      if (!(other in verbs)) {
        add(`verb ${verb}`, `confusion_set lists "${other}", which is not in verbs`);
      } else {
        const back = verbs[other]?.confusion_set;
        if (!Array.isArray(back) || !back.includes(verb)) {
          add(`verb ${verb}`, `confusion_set lists "${other}", but ${other} does not list ${verb}`);
        }
      }
    }
  }

  // Anchors.
  const seenIds = new Set();
  const covered = new Map(); // cell -> [anchor ids]
  anchors.forEach((a, i) => {
    if (!isObject(a)) {
      add(`anchor #${i + 1}`, 'is not an object');
      return;
    }
    const ref = `anchor ${a.id ?? `#${i + 1} (no id)`}`;
    if (!a.id) add(ref, 'missing id');
    else if (seenIds.has(a.id)) add(ref, 'duplicate id');
    else seenIds.add(a.id);

    if (!ANCHOR_KINDS.includes(a.kind)) add(ref, `unknown kind "${a.kind}"`);
    if (typeof a.pt !== 'string' || !a.pt.trim()) add(ref, 'missing pt');
    if (typeof a.en !== 'string' || !a.en.trim()) add(ref, 'missing en');

    if (a.kind === 'echo') {
      const ok = Array.isArray(a.turns) && a.turns.length === 2 &&
        a.turns.every(t => typeof t === 'string' && t.trim());
      if (!ok) add(ref, 'echo anchor needs a "turns" array of two non-empty strings');
    }

    if (!Array.isArray(a.targets)) {
      add(ref, '"targets" is missing or not a list');
      return;
    }
    if (!a.targets.length) add(ref, 'no targets');
    a.targets.forEach((t, k) => {
      if (!isObject(t)) {
        add(ref, `target #${k + 1} is not an object`);
        return;
      }
      const cell = cellKey(t.verb, t.tense, t.person);
      const paradigm = isObject(verbs[t.verb]) ? verbs[t.verb].forms?.[t.tense]?.[t.person] : undefined;
      if (!(t.verb in verbs)) add(ref, `target verb "${t.verb}" is not in verbs`);
      else if (paradigm === undefined) add(ref, `target cell ${cell} has no form in verbs`);
      else {
        if (t.form !== paradigm) add(ref, `target ${cell} form "${t.form}" differs from verbs form "${paradigm}"`);
        if (!covered.has(cell)) covered.set(cell, []);
        if (!covered.get(cell).includes(a.id)) covered.get(cell).push(a.id);
      }
      if (typeof t.form !== 'string' || !t.form.trim()) add(ref, `target ${cell} has no form`);
      else if (typeof a.pt === 'string' && !containsForm(a.pt, t.form)) {
        add(ref, `target form "${t.form}" (${cell}) not found in pt "${a.pt}"`);
      }
    });
  });

  // Coverage: every cell is covered or listed as uncovered, never both.
  const cells = allCells(data);
  const cellSet = new Set(cells);
  const uncoveredSet = new Set();
  for (const c of uncovered) {
    if (uncoveredSet.has(c)) add(`uncovered_cells ${c}`, 'listed twice');
    uncoveredSet.add(c);
    if (!cellSet.has(c)) add(`uncovered_cells ${c}`, 'not a cell with a form in verbs');
    else if (covered.has(c)) add(`uncovered_cells ${c}`, `is covered by ${covered.get(c).join(', ')}`);
  }
  for (const c of cells) {
    if (!covered.has(c) && !uncoveredSet.has(c)) {
      add(`cell ${c}`, 'has no anchor and is not listed in uncovered_cells');
    }
  }

  return {
    problems,
    covered,
    stats: {
      verbs: Object.keys(verbs).length,
      anchors: anchors.length,
      cells: cells.length,
      covered: covered.size,
    },
  };
}

export function formatProblem(p) {
  return `${p.ref}: ${p.msg}`;
}

export function summary({ problems, stats }) {
  if (problems.length) {
    return `anchors.json has ${problems.length} problem${problems.length === 1 ? '' : 's'}`;
  }
  return `anchors.json OK: ${stats.verbs} verbs, ${stats.anchors} anchors, ${stats.covered} cells covered`;
}
