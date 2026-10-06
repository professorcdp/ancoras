// M0 data check page: load anchors.json, show the validator result, browse verbs and anchors.

import { validate, formatProblem, summary, cellKey, isObject } from './validate.js';

const $ = id => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c != null) node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

function showError(title, detail) {
  const banner = $('banner');
  banner.className = 'banner fail';
  banner.replaceChildren(el('strong', {}, title), el('p', {}, detail));
}

async function load() {
  let res;
  try {
    res = await fetch('anchors.json', { cache: 'no-store' });
  } catch (err) {
    showError('Could not load anchors.json.',
      `${err.message}. Serve this folder with a local server (python3 -m http.server 8000) rather than opening the file directly.`);
    return;
  }
  if (!res.ok) {
    showError('Could not load anchors.json.', `The server answered ${res.status} ${res.statusText}.`);
    return;
  }
  let data;
  try {
    data = JSON.parse(await res.text());
  } catch (err) {
    showError('anchors.json is not valid JSON.', err.message);
    return;
  }
  try {
    render(data);
  } catch (err) {
    console.error(err);
    showError('Could not display anchors.json.',
      `${err.message}. Run "node validate.mjs" in the project folder to find the problem.`);
  }
}

function render(data) {
  const result = validate(data);
  renderBanner(result);
  renderVerbs(data, result);
  renderAnchors(data);
}

function renderBanner(result) {
  const banner = $('banner');
  const ok = result.problems.length === 0;
  banner.className = `banner ${ok ? 'ok' : 'fail'}`;
  banner.replaceChildren(el('strong', {}, summary(result)));
  if (!ok) {
    banner.append(el('ul', {}, result.problems.map(p => el('li', {}, formatProblem(p)))));
  }
}

function renderVerbs(data, { covered }) {
  const persons = Array.isArray(data.persons) ? data.persons : [];
  const tenses = Object.keys(isObject(data.tenses) ? data.tenses : {});
  const uncovered = new Set(Array.isArray(data.uncovered_cells) ? data.uncovered_cells : []);
  const verbs = Object.entries(isObject(data.verbs) ? data.verbs : {}).filter(([, v]) => isObject(v));

  const formsGrid = (verb, v) => el('table', { class: 'forms' },
    el('tr', {}, el('th', {}), tenses.map(t => el('th', { scope: 'col' }, t))),
    persons.map(p => el('tr', {},
      el('th', { scope: 'row' }, p),
      tenses.map(t => {
        const form = isObject(v.forms?.[t]) ? v.forms[t][p] : undefined;
        if (form === undefined) return el('td', { class: 'cell none' }, '—');
        const key = cellKey(verb, t, p);
        const ids = covered.get(key);
        const status = ids ? 'covered' : uncovered.has(key) ? 'uncovered' : 'gap';
        const title = ids ? `${key}: ${ids.join(', ')}` : `${key}: ${status === 'gap' ? 'no anchor, not listed' : 'in uncovered_cells'}`;
        return el('td', { class: `cell ${status}`, title }, form);
      }),
    )),
  );

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
        el('td', { 'data-label': 'Forms', lang: 'pt-PT' }, formsGrid(verb, v)),
      ))),
  );
  $('verbs-section').hidden = false;
}

// Wrap each target form in the phrase with <mark>, matching the validator's rule
// (whole word, case-insensitive, accents significant).
function highlight(pt, forms) {
  const unique = [...new Set(forms)].filter(f => typeof f === 'string' && f)
    .sort((a, b) => b.length - a.length)
    .map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!unique.length) return [pt];
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(${unique.join('|')})(?![\\p{L}\\p{M}])`, 'giu');
  const out = [];
  let last = 0;
  for (const m of pt.matchAll(re)) {
    out.push(pt.slice(last, m.index), el('mark', {}, m[0]));
    last = m.index + m[0].length;
  }
  out.push(pt.slice(last));
  return out;
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

load();
