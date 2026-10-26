// Native-speaker review page (decision 0016). One card per anchor, all on one page; answers
// are saved in this browser ("ancoras.review.v1") and leave it only via Copy / Download.
// The format and the "Updated" rule live in review-core.js (pure, tested).

import { el } from '../js/dom.js';
import { formRegex, isObject, ECHO_SEPARATOR } from '../js/validate.js';
import { describeCells } from '../js/session.js';
import { localDate } from '../js/progress.js';
import { initAudio, speak, audioAvailable, onVoicesChanged, NO_VOICE } from '../js/audio.js';
import { VERDICTS, isStale, isAnswered, formatAnswers } from './review-core.js';

const KEY = 'ancoras.review.v1';
const $ = id => document.getElementById(id);
const FILTERS = [
  ['all', 'All', () => true],
  ['unanswered', 'Unanswered', (a, ans) => !isAnswered(ans, a)],
  ['check', 'CHECK only', a => a.needs_native_check === true],
  ['set', 'Set phrases', a => a.established === true],
];

let anchors = [];
let store = { version: 1, answers: {} };
let filter = 'all';
const cards = new Map(); // id -> { card, refresh }

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (isObject(s) && s.version === 1 && isObject(s.answers)) store = s;
  } catch {
    // Unreadable: start empty (nothing is overwritten until the first answer).
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    $('save-note').hidden = true;
  } catch {
    $('save-note').hidden = false;
    $('save-note').textContent = 'Answers can\'t be saved in this browser. Tap Copy answers now and then so nothing is lost.';
  }
}

// The Portuguese with every target form in bold (same whole-word rule as the app).
function boldTargets(pt, forms) {
  const unique = [...new Set(forms)].filter(f => typeof f === 'string' && f).sort((a, b) => b.length - a.length);
  if (!unique.length) return [pt];
  const re = new RegExp(unique.map(f => formRegex(f).source).join('|'), 'giu');
  const out = [];
  let last = 0;
  for (const m of pt.normalize('NFC').matchAll(re)) {
    out.push(pt.slice(last, m.index), el('b', {}, m[0]));
    last = m.index + m[0].length;
  }
  out.push(pt.slice(last));
  return out;
}

const shownPt = a => (a.kind === 'echo' && Array.isArray(a.turns) ? a.turns.join(ECHO_SEPARATOR) : a.pt);

// The answer on show for a card: the stored one if current, else a blank one. A stale answer
// (the Portuguese changed since) is kept only to show as "your earlier answer".
function current(a) {
  const ans = store.answers[a.id];
  return ans && !isStale(ans, a) ? ans : null;
}

function update(a, change) {
  const base = current(a) ?? { verdict: null, pt: a.pt, en: a.en, note: '' };
  const next = { ...base, ...change, givenOn: a.pt };
  const empty = !next.verdict && !String(next.note ?? '').trim();
  if (empty) delete store.answers[a.id];
  else store.answers[a.id] = next;
  save();
  cards.get(a.id).refresh();
  progress();
}

function renderCard(a) {
  const targets = (Array.isArray(a.targets) ? a.targets : []).filter(isObject);
  const chips = el('span', { class: 'chips-inline' });
  const earlier = el('p', { class: 'small muted earlier' });
  const buttons = VERDICTS.map(v => el('button', {
    type: 'button', class: `verdict v-${v.toLowerCase()}`, 'aria-pressed': 'false',
    onclick: () => update(a, { verdict: current(a)?.verdict === v ? null : v }),
  }, v));
  const field = (label, value, key, rows) => {
    const area = el('textarea', { rows: String(rows), name: `${key}-${a.id}`, lang: key === 'pt' ? 'pt-PT' : 'en', 'aria-label': label });
    area.value = value;
    area.addEventListener('input', () => update(a, { [key]: area.value }));
    return { area, wrap: el('label', { class: 'field' }, el('span', { class: 'small muted' }, label), area) };
  };
  const ptField = field('Corrected Portuguese', a.pt, 'pt', 2);
  const enField = field('Corrected English', a.en ?? '', 'en', 2);
  const note = field('Comment', '', 'note', 1);
  const changeBox = el('div', { class: 'change-fields' }, ptField.wrap, enField.wrap);

  const card = el('article', { class: 'rcard', id: `a-${a.id}`, tabindex: '-1' },
    el('div', { class: 'rcard-head' }, el('code', { class: 'small muted' }, a.id), chips),
    el('div', { class: 'rcard-pt' },
      el('p', { class: 'pt', lang: 'pt-PT' }, boldTargets(shownPt(a), targets.map(t => t.form))),
      el('button', { type: 'button', class: 'play', 'aria-label': 'Play', onclick: () => speak(shownPt(a)) }, '▶')),
    el('p', { class: 'en' }, a.en ?? ''),
    el('p', { class: 'small muted', lang: 'pt-PT' },
      targets.length ? describeCells(targets, targets[0]) : '', ` · ${a.kind}`),
    earlier,
    el('div', { class: 'verdicts', role: 'group', 'aria-label': 'Verdict' }, buttons),
    changeBox,
    note.wrap,
  );

  const refresh = () => {
    const ans = current(a);
    const stored = store.answers[a.id];
    chips.replaceChildren(...[
      a.needs_native_check ? el('span', { class: 'chip-s check' }, 'CHECK') : null,
      a.established ? el('span', { class: 'chip-s set' }, 'set phrase') : null,
      stored && isStale(stored, a) ? el('span', { class: 'chip-s updated' }, 'Updated') : null,
      isAnswered(ans, a) ? el('span', { class: 'chip-s done' }, '✓ answered') : null,
    ].filter(Boolean));
    earlier.hidden = !(stored && isStale(stored, a));
    if (!earlier.hidden) {
      earlier.textContent = `This sentence changed since you answered (your earlier answer: ${stored.verdict ?? 'no verdict'}${stored.note ? `, “${stored.note}”` : ''}). Please answer again.`;
    }
    for (const b of buttons) b.setAttribute('aria-pressed', String(ans?.verdict === b.textContent));
    changeBox.hidden = ans?.verdict !== 'CHANGE';
    // Keep the fields in step with the stored answer, without disturbing the one being typed in.
    for (const [f, key, fallback] of [[ptField, 'pt', a.pt], [enField, 'en', a.en ?? ''], [note, 'note', '']]) {
      const value = ans?.[key] ?? fallback;
      if (document.activeElement !== f.area && f.area.value !== value) f.area.value = value;
    }
  };
  cards.set(a.id, { card, refresh });
  refresh();
  return card;
}

function progress() {
  const n = anchors.filter(a => isAnswered(store.answers[a.id], a)).length;
  $('progress-text').textContent = `${n} of ${anchors.length} answered`;
  $('progress-bar').style.width = `${anchors.length ? (100 * n) / anchors.length : 0}%`;
}

// Filters apply when a chip is tapped, not as answers change, so a card never vanishes
// from under the reviewer mid-answer.
function applyFilter(name) {
  filter = name;
  const test = FILTERS.find(([k]) => k === name)[2];
  for (const a of anchors) cards.get(a.id).card.hidden = !test(a, store.answers[a.id]);
  for (const b of $('filters').children) b.setAttribute('aria-pressed', String(b.dataset.filter === name));
}

function jumpToUnanswered() {
  const visible = anchors.filter(a => !cards.get(a.id).card.hidden);
  let target = visible.find(a => !isAnswered(store.answers[a.id], a));
  if (!target) {
    target = anchors.find(a => !isAnswered(store.answers[a.id], a));
    if (target) applyFilter('all');
  }
  if (!target) {
    for (const s of document.querySelectorAll('.copy-status')) s.textContent = 'Everything is answered. Tap Copy answers to send them.';
    return;
  }
  const { card } = cards.get(target.id);
  card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  card.focus({ preventScroll: true });
}

function answersText() {
  return formatAnswers(anchors, store.answers, localDate());
}

async function copy() {
  const text = answersText();
  const n = text.split('\n').length - 1;
  const status = msg => { for (const s of document.querySelectorAll('.copy-status')) s.textContent = msg; };
  try {
    await navigator.clipboard.writeText(text);
    $('fallback').hidden = true;
    status(`Copied ${n} answer${n === 1 ? '' : 's'}. Paste them into a message to Jim.`);
  } catch {
    // No clipboard access (some browsers): show the text, selected, to copy by hand.
    const box = $('fallback');
    box.hidden = false;
    box.value = text;
    box.focus();
    box.select();
    status('Copy the selected text below and paste it into a message to Jim.');
  }
}

function download() {
  const url = URL.createObjectURL(new Blob([answersText()], { type: 'text/plain;charset=utf-8' }));
  const a = el('a', { href: url, download: `ancoras-review-${localDate()}.txt` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function start() {
  load();
  initAudio();
  const note = () => { $('audio-note').hidden = audioAvailable(); $('audio-note').textContent = NO_VOICE; };
  onVoicesChanged(note);
  note();
  try {
    const res = await fetch('../anchors.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`the server answered ${res.status}`);
    anchors = (JSON.parse(await res.text()).anchors ?? []).filter(isObject);
  } catch (err) {
    $('progress-text').textContent = `Could not load the sentences (${err.message}). Please try again later.`;
    return;
  }
  $('filters').replaceChildren(...FILTERS.map(([k, label]) =>
    el('button', { type: 'button', class: 'chip', 'data-filter': k, onclick: () => applyFilter(k) }, label)));
  $('cards').replaceChildren(...anchors.map(renderCard));
  $('jump').addEventListener('click', jumpToUnanswered);
  for (const b of document.querySelectorAll('button.copy')) b.addEventListener('click', copy);
  for (const b of document.querySelectorAll('button.download')) b.addEventListener('click', download);
  applyFilter(filter);
  progress();
}

start();
