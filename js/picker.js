// Session picker (SPEC §5): verbs (with confusion-set presets), tenses, persons, live count,
// plus each verb's mastery grid (SPEC §8) and export / import / reset of saved progress.
// The last selection is remembered in localStorage.

import { isObject, cellKey } from './validate.js';
import { $, el } from './dom.js';
import { anchorsByCell, buildCells, presets, restoreSelection, tenseLabel } from './session.js';
import { cellRecord, cellStatus, groupMastered, localDate, validateProgress } from './progress.js';
import {
  audioAvailable, voiceNames, currentVoiceName, setPreferredVoice, onVoicesChanged, speak,
} from './audio.js';

const THEME_KEY = 'ancoras.theme';
const THEMES = [['system', 'Follow system'], ['light', 'Light'], ['dark', 'Dark']];

// Theme override (the inline script in index.html applies the saved one on load).
function storedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}
function setTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  try {
    if (theme === 'light' || theme === 'dark') localStorage.setItem(THEME_KEY, theme);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    // Not remembered; the choice still applies until the page is closed.
  }
}

const NO_VOICE = 'No European Portuguese voice on this device, so audio is off. On a Mac or ' +
  'iPhone, add one under Accessibility › Spoken Content › System voice › Manage voices › ' +
  'Portuguese (Portugal).';

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
// `progress` is the store (js/store.js). Returns { refresh } to redraw the mastery grids.
export function renderPicker(data, { ok, onStart, progress }) {
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

  // Mastery grid per verb: one row per tense, one square per person, coloured by status.
  // Redrawn by refresh() (after a session, import or reset).
  const grids = new Map(); // verb -> { grid, badges }
  function drawGrid(verb) {
    const { grid, badges } = grids.get(verb);
    const p = progress.get();
    const forms = isObject(verbs[verb]?.forms) ? verbs[verb].forms : {};
    const done = [];
    grid.replaceChildren(...Object.keys(tenses).flatMap(t => persons.map(person => {
      const form = isObject(forms[t]) ? forms[t][person] : undefined;
      const key = cellKey(verb, t, person);
      if (typeof form !== 'string') return el('span', { class: 'sq none', title: `${verb} · ${tenseLabel(t)} · ${person}: no form` });
      if (!byCell.has(key)) return el('span', { class: 'sq uncovered', title: `${key} (${form}): uncovered, not practised in v1` });
      const status = cellStatus(p, key);
      const rec = cellRecord(p, key);
      return el('span', {
        class: `sq ${status}`,
        title: `${verb} · ${tenseLabel(t)} · ${person} (${form}): ${status}; streak ${rec.streak}, ` +
          `${rec.days.length} day${rec.days.length === 1 ? '' : 's'}`,
      });
    })));
    for (const t of Object.keys(tenses)) {
      const keys = persons.map(person => cellKey(verb, t, person)).filter(k => byCell.has(k));
      if (groupMastered(p, keys)) done.push(t);
    }
    badges.replaceChildren(...done.map(t => el('span', { class: 'mastered-tag', title: `${verb} ${tenseLabel(t)}: every covered cell mastered` }, `✓ ${tenseLabel(t)}`)));
  }
  const verbRow = (verb, v) => {
    const grid = el('span', { class: 'minigrid', style: `--cols: ${persons.length}`, 'aria-hidden': 'true' });
    const badges = el('span', { class: 'badges' });
    grids.set(verb, { grid, badges });
    return el('div', { class: 'verb-row' },
      checkbox('verbs', verb, el('b', { lang: 'pt-PT' }, verb), ' ',
        el('span', { class: 'muted' }, isObject(v) ? v.gloss ?? '' : ''), ' ', badges),
      grid);
  };
  const saveNote = el('p', { class: 'muted small' });
  const refresh = () => {
    for (const verb of grids.keys()) drawGrid(verb);
    const failing = progress.problems().some(p => p.kind !== 'damaged');
    saveNote.textContent = failing
      ? 'Not being saved in this browser (see the warning above). Export progress to keep a copy.'
      : 'Saved in this browser after every answer. Export to keep a copy or move it to another device.';
    saveNote.className = failing ? 'small warn-text' : 'muted small';
  };

  const legend = el('p', { class: 'legend grid-legend' },
    el('span', { class: 'sq new' }), ' new ', el('span', { class: 'sq learning' }), ' learning ',
    el('span', { class: 'sq mastered' }), ' mastered ', el('span', { class: 'sq uncovered' }), ' uncovered',
    el('span', { class: 'muted' }, ` · grid rows: ${Object.keys(tenses).map(tenseLabel).join(' / ')}; columns: ${persons.join(' ')}`));

  // Export / import / reset of saved progress.
  const status = el('p', { class: 'muted small progress-status', 'aria-live': 'polite' });
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      status.textContent = `Not imported: ${file.name} isn't valid JSON.`;
      return;
    }
    const checked = validateProgress(parsed);
    if (!checked.ok) {
      status.textContent = `Not imported: ${checked.error}.`;
      return;
    }
    if (!confirm('Replace your saved progress with this file?')) return;
    progress.replace(checked.progress);
    refresh();
    status.textContent = `Imported ${file.name}.`;
  });
  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(progress.get(), null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `ancoras-progress-${localDate()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Exported.';
  };
  const resetProgress = () => {
    if (!confirm('Reset all your saved progress? This can\'t be undone (export first to keep a copy).')) return;
    progress.reset();
    refresh();
    status.textContent = 'Progress reset.';
  };

  // Audio line (decision 0010): pick among pt-PT voices, or say once that audio is off.
  // Voices can arrive after the page loads, so it is redrawn when the list changes.
  const audioLine = el('div', { class: 'audio-line small' });
  const drawAudio = () => {
    if (!audioAvailable()) {
      audioLine.replaceChildren(el('span', { class: 'warn-text' }, NO_VOICE));
      return;
    }
    const select = el('select', { name: 'voice', 'aria-label': 'Voice' },
      voiceNames().map(name => el('option', { value: name }, name)));
    select.value = currentVoiceName() ?? '';
    select.addEventListener('change', () => {
      setPreferredVoice(select.value);
      speak('Vim, vi e venci.'); // let the learner hear the voice they picked
    });
    audioLine.replaceChildren(el('span', {}, 'Audio voice (European Portuguese):'), select);
  };
  onVoicesChanged(drawAudio);
  drawAudio();

  const themeSelect = el('select', { name: 'theme', 'aria-label': 'Theme' },
    THEMES.map(([value, label]) => el('option', { value }, label)));
  themeSelect.value = storedTheme();
  themeSelect.addEventListener('change', () => setTheme(themeSelect.value));
  const themeLine = el('div', { class: 'audio-line small' }, el('span', {}, 'Theme:'), themeSelect);

  const presetButtons = presets(data).map(group =>
    el('button', { type: 'button', class: 'chip', lang: 'pt-PT', onclick: () => setVerbs(group) },
      group.join(' + ')));

  $('picker').replaceChildren(el('div', {},
    el('h2', {}, 'Practise'),
    legend,
    el('fieldset', {},
      el('legend', {}, 'Verbs'),
      el('div', { class: 'chips' },
        presetButtons,
        el('button', { type: 'button', class: 'chip quiet', onclick: () => setVerbs(Object.keys(verbs)) }, 'All'),
        el('button', { type: 'button', class: 'chip quiet', onclick: () => setVerbs([]) }, 'None')),
      el('div', { class: 'verbs-grid' }, Object.entries(verbs).map(([verb, v]) => verbRow(verb, v)))),
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
    el('fieldset', { class: 'progress-box' },
      el('legend', {}, 'Progress and settings'),
      saveNote,
      el('div', { class: 'chips' },
        el('button', { type: 'button', onclick: exportProgress }, 'Export progress'),
        el('button', { type: 'button', onclick: () => fileInput.click() }, 'Import progress'),
        el('button', { type: 'button', class: 'quiet', onclick: resetProgress }, 'Reset progress'),
        fileInput),
      status,
      audioLine,
      themeLine),
  ));
  update();
  refresh();
  return { refresh };
}
