// Data view (M0): browsable verbs and anchors tables, behind the "Data" link.

import { isObject } from './validate.js';
import { $, el, highlight } from './dom.js';
import { formsGrid } from './forms.js';

export function renderDataView(data, result) {
  renderVerbs(data, result);
  renderAnchors(data);
}

function renderVerbs(data, { covered }) {
  const uncovered = new Set(Array.isArray(data.uncovered_cells) ? data.uncovered_cells : []);
  const verbs = Object.entries(isObject(data.verbs) ? data.verbs : {}).filter(([, v]) => isObject(v));

  const statusOf = (key, form) => {
    const ids = covered.get(key);
    const status = ids ? 'covered' : uncovered.has(key) ? 'uncovered' : 'gap';
    const title = ids ? `${key}: ${ids.join(', ')}` : `${key}: ${status === 'gap' ? 'no anchor, not listed' : 'in uncovered_cells'}`;
    return { class: status, title };
  };

  $('verbs-table').replaceChildren(
    el('thead', {}, el('tr', {},
      ['Verb', 'Gloss', 'Confusion set', 'PPS pattern', 'Forms'].map(h => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, verbs.map(([verb, v]) =>
      el('tr', {},
        el('th', { scope: 'row', lang: 'pt-PT' }, verb),
        el('td', { 'data-label': 'Gloss' }, v.gloss ?? ''),
        el('td', { 'data-label': 'Confusion set', lang: 'pt-PT' },
          (Array.isArray(v.confusion_set) ? v.confusion_set : []).join(', ') || '—'),
        el('td', { 'data-label': 'PPS pattern' }, v.pps_pattern ?? ''),
        el('td', { 'data-label': 'Forms', lang: 'pt-PT' }, formsGrid(data, verb, { cell: statusOf })),
      ))),
  );
  $('verbs-section').hidden = false;
}

function renderAnchors(data) {
  const anchors = (Array.isArray(data.anchors) ? data.anchors : []).filter(isObject);
  const targetsOf = a => (Array.isArray(a.targets) ? a.targets : []).filter(isObject);
  const select = $('verb-filter');
  for (const verb of Object.keys(isObject(data.verbs) ? data.verbs : {})) {
    select.append(el('option', { value: verb }, verb));
  }

  const cols = ['Id', 'Kind', 'Portuguese', 'English', 'Targets', 'Flags'];
  const row = a => {
    const targets = targetsOf(a);
    const flags = [
      a.established ? el('span', { class: 'flag est' }, 'established') : null,
      a.needs_native_check ? el('span', { class: 'flag check' }, 'needs native check') : null,
    ];
    return el('tr', {},
      el('td', { 'data-label': cols[0], class: 'id' }, a.id),
      el('td', { 'data-label': cols[1] }, a.kind),
      el('td', { 'data-label': cols[2], lang: 'pt-PT', class: 'pt' },
        highlight(typeof a.pt === 'string' ? a.pt : '', targets.map(t => t.form))),
      el('td', { 'data-label': cols[3] }, a.en),
      el('td', { 'data-label': cols[4], lang: 'pt-PT' },
        el('ul', { class: 'targets' }, targets.map(t =>
          el('li', {}, el('b', {}, t.form), ` ${t.verb} · ${t.tense} · ${t.person}`)))),
      el('td', { 'data-label': cols[5] }, flags),
    );
  };

  const table = $('anchors-table');
  const draw = () => {
    const verb = select.value;
    const shown = verb ? anchors.filter(a => targetsOf(a).some(t => t.verb === verb)) : anchors;
    $('anchor-count').textContent = `${shown.length} of ${anchors.length}`;
    table.replaceChildren(
      el('thead', {}, el('tr', {}, cols.map(h => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, shown.map(row)),
    );
  };
  select.addEventListener('change', draw);
  draw();
  $('anchors-section').hidden = false;
}
