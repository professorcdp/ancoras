// Practice screens (SPEC §6 steps 1 and 5): Meet for every cell, then Transfer for every
// cell (a miss comes round once more), then a summary. Nothing is stored yet (M4, #5).

import { isObject } from './validate.js';
import { $, el, highlight } from './dom.js';
import { gradeForm, normalize, CORRECT, ALMOST } from './grade.js';
import { speak } from './audio.js';
import {
  buildCells, pickMeetAnchor, pickTransfer, orderCells, requeue, splitOnForm, summarize,
} from './session.js';

const ACCENTS = ['á', 'à', 'â', 'ã', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú', 'ç'];
const TENSE_SHORT = { pres: 'present', pps: 'PPS' };
const tenseLabel = t => TENSE_SHORT[t] ?? t;
const BLANK = '____';

export function startSession(data, selection, { onHome }) {
  const notes = isObject(data.person_notes) ? data.person_notes : {};
  const plan = buildCells(data, selection).cells.map(cell => {
    const meet = pickMeetAnchor(cell.anchors);
    return { ...cell, meet, transfer: pickTransfer(cell, meet) };
  });
  const meetOrder = orderCells(plan);
  let queue = orderCells(plan, Math.random, meetOrder.at(-1)).map(cell => ({ cell, attempt: 1 }));
  let transferTotal = queue.length;
  let transferDone = 0;
  const results = new Map(); // cell key -> ['wrong', 'correct'] (one entry per attempt)

  const root = $('practice');
  const show = (...children) => {
    root.replaceChildren(
      el('div', { class: 'practice-top' },
        el('button', { type: 'button', class: 'link', onclick: onHome }, '← End session')),
      ...children.filter(c => c != null));
    window.scrollTo(0, 0);
  };

  const cueText = cell => `${cell.verb} · ${tenseLabel(cell.tense)} · ${cell.person}`;

  // The Meet anchor as shown on the Meet screen and as the hint after a miss.
  function anchorBlock(cell) {
    const a = cell.meet;
    const text = a.kind === 'echo' && Array.isArray(a.turns) ? a.turns.join(' — ') : a.pt;
    const forms = (Array.isArray(a.targets) ? a.targets : []).filter(isObject).map(t => t.form);
    return el('div', { class: 'anchor' },
      el('p', { class: 'pt', lang: 'pt-PT' }, highlight(text, forms)),
      el('p', { class: 'en' }, a.en));
  }

  // The Transfer sentence with the form either blanked or filled in (marked).
  function sentence(cell, filled) {
    const t = cell.transfer;
    if (t.source === 'bare') {
      return el('p', { class: 'pt sentence', lang: 'pt-PT' }, `${cueText(cell)} → `,
        filled ? el('mark', {}, cell.form) : el('span', { class: 'blank' }, BLANK));
    }
    return el('p', { class: 'pt sentence', lang: 'pt-PT' }, splitOnForm(t.pt, cell.form).map(p =>
      typeof p === 'string' ? p : filled ? el('mark', {}, p.form) : el('span', { class: 'blank' }, BLANK)));
  }

  function meet(i) {
    if (i >= meetOrder.length) return transfer();
    const cell = meetOrder[i];
    const next = el('button', { type: 'button', class: 'primary', onclick: () => meet(i + 1) }, 'Next');
    show(
      el('p', { class: 'step' }, `Meet · ${i + 1} of ${meetOrder.length}`),
      el('div', { class: 'card' },
        el('span', { class: 'kind' }, cell.meet.kind),
        anchorBlock(cell),
        el('p', { class: 'cue', lang: 'pt-PT' }, `${cueText(cell)} → `, el('b', {}, cell.form))),
      el('div', { class: 'actions' },
        el('button', { type: 'button', onclick: () => speak(cell.meet.pt) }, '▶ Play'),
        next),
    );
    next.focus();
  }

  function transfer() {
    if (!queue.length) return summary();
    const [item, ...rest] = queue;
    const { cell } = item;
    const input = el('input', {
      type: 'text', name: 'answer', class: 'answer', lang: 'pt-PT', autocomplete: 'off', autocapitalize: 'none',
      autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Your answer',
    });
    const keys = ACCENTS.map(ch => el('button', {
      type: 'button', class: 'key', tabindex: '-1',
      onmousedown: e => e.preventDefault(), // keep focus (and the cursor) in the input
      onclick: () => {
        if (input.disabled) return;
        input.setRangeText(ch, input.selectionStart, input.selectionEnd, 'end');
        input.focus();
      },
    }, ch));
    const check = el('button', { type: 'submit', class: 'primary' }, 'Check');
    const feedback = el('div', { class: 'feedback', 'aria-live': 'polite' });
    const form = el('form', { class: 'answer-form' }, el('div', { class: 'answer-row' }, input, check));

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (input.disabled) return;
      // An empty box (or only spaces/punctuation) isn't an answer: don't grade or use the try.
      if (!normalize(input.value)) {
        input.focus();
        return;
      }
      const result = gradeForm(input.value, cell.form);
      input.disabled = true;
      keys.forEach(k => { k.disabled = true; });
      results.set(cell.key, [...(results.get(cell.key) ?? []), result]);
      queue = requeue(rest, item, result);
      transferDone++;
      transferTotal = transferDone + queue.length;

      const next = el('button', { type: 'button', class: 'primary', onclick: () => transfer() }, 'Next');
      check.replaceWith(next);
      const retryNote = result !== CORRECT && item.attempt === 1
        ? el('p', { class: 'muted' }, 'This one will come round again.') : null;
      if (result === CORRECT) {
        feedback.className = 'feedback correct';
        feedback.replaceChildren(el('p', {}, el('strong', {}, '✓ Correct')), sentence(cell, true));
      } else {
        feedback.className = `feedback ${result}`;
        feedback.replaceChildren(...[
          result === ALMOST
            ? el('p', {}, el('strong', {}, 'Almost: check the accents. '), 'The spelling is ',
              el('b', { lang: 'pt-PT' }, cell.form), '.')
            : el('p', {}, el('strong', {}, '✗ Not quite. '), 'The form is ',
              el('b', { lang: 'pt-PT' }, cell.form), '.'),
          sentence(cell, true),
          el('div', { class: 'hint' }, el('p', { class: 'hint-label' }, 'Remember'), anchorBlock(cell)),
          retryNote,
        ].filter(c => c != null));
      }
      next.focus();
    });

    show(
      el('p', { class: 'step' },
        `Transfer · ${transferDone + 1} of ${transferTotal}`, item.attempt > 1 ? ' · second try' : ''),
      el('div', { class: 'card' },
        el('p', { class: 'cue', lang: 'pt-PT' },
          el('b', {}, cell.person), notes[cell.person] ? ` (${notes[cell.person]})` : '',
          ` · ${cell.verb} · ${tenseLabel(cell.tense)}`),
        sentence(cell, false),
        cell.transfer.en ? el('p', { class: 'en' }, cell.transfer.en) : null,
        form,
        el('div', { class: 'keys', 'aria-label': 'Accented letters' }, keys),
        feedback),
    );
    input.focus();
  }

  function summary() {
    const rows = summarize(plan, results);
    const label = { first: '✓ first try', retry: '✓ on retry', missed: '✗' };
    const firstTry = rows.filter(r => r.status === 'first').length;
    show(
      el('h2', {}, 'Done'),
      el('p', {}, `${firstTry} of ${rows.length} right first time.`),
      el('table', { class: 'summary' },
        el('tbody', {}, rows.map(r => el('tr', { class: r.status },
          el('td', { lang: 'pt-PT' }, cueText(r.cell)),
          el('td', { lang: 'pt-PT' }, el('b', {}, r.cell.form)),
          el('td', {}, label[r.status], r.almost ? el('span', { class: 'almost-tag' }, 'almost') : null))))),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'primary', onclick: () => startSession(data, selection, { onHome }) },
          'Practise again'),
        el('button', { type: 'button', onclick: onHome }, 'Home')),
    );
  }

  meet(0);
}
