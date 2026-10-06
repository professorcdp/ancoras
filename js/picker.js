// Session picker (SPEC §5): verbs (with confusion-set presets), tenses, persons, live count.
// The last selection is remembered in localStorage.

import { isObject } from './validate.js';
import { $, el } from './dom.js';
import { anchorsByCell, buildCells, presets, restoreSelection } from './session.js';

const STORAGE_KEY = 'ancoras.selection';

function loadStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function save(selection) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Storage blocked (private window etc.): the picker still works, it just won't remember.
  }
}

// `ok` is false when anchors.json has validator problems: Start stays disabled.
export function renderPicker(data, { ok, onStart }) {
  const verbs = isObject(data.verbs) ? data.verbs : {};
  const tenses = isObject(data.tenses) ? data.tenses : {};
  const persons = Array.isArray(data.persons) ? data.persons : [];
  const notes = isObject(data.person_notes) ? data.person_notes : {};
  const byCell = anchorsByCell(data);
  const selection = restoreSelection(data, loadStored());

  const boxes = { verbs: new Map(), tenses: new Map(), persons: new Map() };
  const checkbox = (group, value, ...label) => {
    const input = el('input', { type: 'checkbox', value, onchange: update });
    input.checked = selection[group].includes(value);
    boxes[group].set(value, input);
    return el('label', { class: 'check' }, input, el('span', {}, ...label));
  };

  const count = el('span', { class: 'cell-count' });
  const skipped = el('span', { class: 'skipped' });
  const start = el('button', { type: 'button', class: 'primary', onclick: () => onStart(read()) }, 'Start');
  const note = ok ? null : el('p', { class: 'start-note' },
    'Start is off until anchors.json is fixed: see the problems above, the ',
    el('a', { href: '#data' }, 'Data'), ' page, or run ', el('code', {}, 'node validate.mjs'), '.');

  function read() {
    const pick = group => [...boxes[group]].filter(([, b]) => b.checked).map(([v]) => v);
    return { verbs: pick('verbs'), tenses: pick('tenses'), persons: pick('persons') };
  }

  function update() {
    const sel = read();
    save(sel);
    const result = buildCells(data, sel, byCell);
    const n = result.cells.length;
    count.textContent = `${n} cell${n === 1 ? '' : 's'}`;
    skipped.textContent = result.skipped
      ? `(${result.skipped} uncovered cell${result.skipped === 1 ? '' : 's'} skipped)` : '';
    start.disabled = !ok || n === 0;
  }

  function setVerbs(list) {
    for (const [v, b] of boxes.verbs) b.checked = list.includes(v);
    update();
  }

  const presetButtons = presets(data).map(group =>
    el('button', { type: 'button', class: 'chip', lang: 'pt-PT', onclick: () => setVerbs(group) },
      group.join(' + ')));

  $('picker').replaceChildren(el('div', {},
    el('h2', {}, 'Practise'),
    el('fieldset', {},
      el('legend', {}, 'Verbs'),
      el('div', { class: 'chips' },
        presetButtons,
        el('button', { type: 'button', class: 'chip quiet', onclick: () => setVerbs(Object.keys(verbs)) }, 'All'),
        el('button', { type: 'button', class: 'chip quiet', onclick: () => setVerbs([]) }, 'None')),
      el('div', { class: 'checks verbs-grid' }, Object.entries(verbs).map(([verb, v]) =>
        checkbox('verbs', verb, el('b', { lang: 'pt-PT' }, verb), ' ',
          el('span', { class: 'muted' }, isObject(v) ? v.gloss ?? '' : ''))))),
    el('fieldset', {},
      el('legend', {}, 'Tenses'),
      el('div', { class: 'checks' }, Object.entries(tenses).map(([t, name]) =>
        checkbox('tenses', t, el('b', {}, t), ' ', el('span', { class: 'muted', lang: 'pt-PT' }, name))))),
    el('fieldset', {},
      el('legend', {}, 'Persons'),
      el('div', { class: 'checks' }, persons.map(p =>
        checkbox('persons', p, el('b', { lang: 'pt-PT' }, p),
          notes[p] ? el('span', { class: 'muted' }, ` (${notes[p]})`) : null)))),
    el('div', { class: 'start-row' }, start, el('span', {}, count, ' ', skipped)),
    note,
  ));
  update();
}
