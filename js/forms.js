// Verb forms: the paradigm grid (shared by the Data view and the Forms panel) and the Forms
// panel itself (decision 0015). A view of what anchors.json holds; no conjugation engine.

import { cellKey, isObject } from './validate.js';
import { el } from './dom.js';

// One verb's forms: rows = persons, columns = tenses. `tenseHead(t)` labels a column;
// `cell(key, form)` returns extra attributes for a form's cell (e.g. a class to colour it).
export function formsGrid(data, verb, { tenseHead = t => t, cell = () => ({}) } = {}) {
  const persons = Array.isArray(data.persons) ? data.persons : [];
  const tenses = Object.keys(isObject(data.tenses) ? data.tenses : {});
  const forms = isObject(data.verbs?.[verb]?.forms) ? data.verbs[verb].forms : {};
  return el('table', { class: 'forms' },
    el('tr', {}, el('th', {}), tenses.map(t => el('th', { scope: 'col' }, tenseHead(t)))),
    persons.map(p => el('tr', {},
      el('th', { scope: 'row' }, p),
      tenses.map(t => {
        const form = isObject(forms[t]) ? forms[t][p] : undefined;
        if (form === undefined) return el('td', { class: 'cell none' }, '—');
        const { class: cls = '', ...attrs } = cell(cellKey(verb, t, p), form);
        return el('td', { class: `cell ${cls}`.trim(), ...attrs }, form);
      }),
    )),
  );
}

// The panel: a <dialog> (Escape closes it), a bottom sheet on phones by CSS. Tapping outside
// closes it too, and focus goes back to whatever had it before. Opening it never stops speech.
let dialog = null;
let opener = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = el('dialog', { class: 'forms-panel', 'aria-label': 'Verb forms' });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); // backdrop
  dialog.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus();
    opener = null;
  });
  document.body.append(dialog);
  return dialog;
}

// Show the forms of `verbs` (each its own block, in order), marking the cells in `highlight`
// (a Set of cell keys like "vir.pps.eu").
export function openFormsPanel(data, { verbs, highlight = new Set() }) {
  const d = ensureDialog();
  opener = document.activeElement;
  const tenses = isObject(data.tenses) ? data.tenses : {};
  const close = el('button', { type: 'button', class: 'link panel-close', onclick: () => d.close() }, 'Close ✕');
  d.replaceChildren(
    el('div', { class: 'panel-head' }, el('h2', {}, 'Forms'), close),
    el('div', { class: 'panel-blocks' }, verbs.filter(v => isObject(data.verbs?.[v])).map(verb =>
      el('section', { class: 'panel-block', lang: 'pt-PT' },
        el('h3', {}, verb, ' ', el('span', { class: 'muted', lang: 'en' }, data.verbs[verb].gloss ?? '')),
        formsGrid(data, verb, {
          tenseHead: t => tenses[t] ?? t,
          cell: key => (highlight.has(key) ? { class: 'here', 'aria-current': 'true' } : {}),
        })))),
  );
  d.showModal();
  close.focus();
}
