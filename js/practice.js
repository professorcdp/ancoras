// Practice screens (SPEC §6 steps 1, 2, 3 and 5; decisions 0005–0007): Meet for every cell,
// then Recall, then Echo (cells whose form is in an echo answer), then Transfer, then a
// summary. In the graded steps a miss comes round once more. Nothing is stored yet (M4, #5).

import { isObject, ECHO_SEPARATOR } from './validate.js';
import { $, el, highlight } from './dom.js';
import { gradeForm, gradePhrase, normalize, CORRECT, ALMOST } from './grade.js';
import { speak } from './audio.js';
import {
  buildCells, pickMeetAnchor, pickTransfer, pickEchoAnchor, targetsIn, orderCells, requeue,
  splitOnForm, summarize, describeCells, tenseLabel, planPhases, runPhases,
} from './session.js';

const ACCENTS = ['á', 'à', 'â', 'ã', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú', 'ç'];
const BLANK = '____';
const targetForms = a => (Array.isArray(a?.targets) ? a.targets : []).filter(isObject).map(t => t.form);

// Returns a controller: inProgress() is true until the summary screen is reached.
export function startSession(data, selection, { onHome, onAgain }) {
  const notes = isObject(data.person_notes) ? data.person_notes : {};
  const plan = buildCells(data, selection).cells.map(cell => {
    const meet = pickMeetAnchor(cell.anchors);
    const echo = pickEchoAnchor(cell, meet);
    const meetTargets = (Array.isArray(meet.targets) ? meet.targets : []).filter(isObject);
    return {
      ...cell, meet,
      transfer: pickTransfer(cell, meet),
      echo,
      recallTargets: meetTargets, // Recall grades every target of the Meet anchor
      echoTargets: echo ? targetsIn(echo, echo.turns[1]) : [], // Echo grades the answer's
    };
  });
  const results = { recall: new Map(), echo: new Map(), transfer: new Map() }; // key -> grades
  let finished = false;

  const root = $('practice');
  const show = (...children) => {
    root.replaceChildren(
      el('div', { class: 'practice-top' },
        el('button', { type: 'button', class: 'link', onclick: onHome }, '← End session')),
      ...children.filter(c => c != null));
    window.scrollTo(0, 0);
  };

  const cueText = cell => `${cell.verb} · ${tenseLabel(cell.tense)} · ${cell.person}`;
  // The cue for the cell(s) being graded: "tu (…) · vir · present" for one cell, or e.g.
  // "tu + eu · vir · present" when a phrase grades several.
  const cueLine = (cell, targets = []) => {
    const text = describeCells(targets, cell);
    if (text !== describeCells([], cell)) return el('p', { class: 'cue', lang: 'pt-PT' }, el('b', {}, text));
    return el('p', { class: 'cue', lang: 'pt-PT' },
      el('b', {}, cell.person), notes[cell.person] ? ` (${notes[cell.person]})` : '',
      ` · ${cell.verb} · ${tenseLabel(cell.tense)}`);
  };

  // An anchor's phrase (both turns for echo) with all its targets marked.
  const phrase = a => el('p', { class: 'pt', lang: 'pt-PT' },
    highlight(a.kind === 'echo' && Array.isArray(a.turns) ? a.turns.join(ECHO_SEPARATOR) : a.pt,
      targetForms(a)));

  // The Meet anchor as shown on the Meet screen and as the hint after a miss.
  const anchorBlock = cell => el('div', { class: 'anchor' }, phrase(cell.meet), el('p', { class: 'en' }, cell.meet.en));

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

  // The English of an echo anchor's question, if `en` splits cleanly into two turns.
  function questionGloss(a) {
    const parts = typeof a.en === 'string' ? a.en.split(ECHO_SEPARATOR) : [];
    return parts.length === 2 ? parts[0] : null;
  }

  function meet(order, i, next) {
    if (i >= order.length) return next(order.at(-1));
    const cell = order[i];
    const nextBtn = el('button', { type: 'button', class: 'primary', onclick: () => meet(order, i + 1, next) }, 'Next');
    show(
      el('p', { class: 'step' }, `Meet · ${i + 1} of ${order.length}`),
      el('div', { class: 'card' },
        el('span', { class: 'kind' }, cell.meet.kind),
        anchorBlock(cell),
        el('p', { class: 'cue', lang: 'pt-PT' }, `${cueText(cell)} → `, el('b', {}, cell.form))),
      el('div', { class: 'actions' },
        el('button', { type: 'button', onclick: () => speak(cell.meet.pt) }, '▶ Play'),
        nextBtn),
    );
    nextBtn.focus();
  }

  // One graded phase (Recall, Echo or Transfer). `step` supplies the prompt, the grading and
  // the feedback; the input, accent buttons, empty-answer rule and one retry are shared.
  // Calls next(lastCellShown) when the queue is empty.
  function graded(step, cells, prev, next) {
    if (!cells.length) return next(prev);
    let queue = orderCells(cells, Math.random, prev).map(cell => ({ cell, attempt: 1 }));
    let done = 0;
    let last = prev;

    const ask = () => {
      if (!queue.length) return next(last);
      const [item, ...rest] = queue;
      const { cell } = item;
      last = cell;
      const input = el('input', {
        type: 'text', name: 'answer', class: 'answer', lang: 'pt-PT', autocomplete: 'off',
        autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Your answer',
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
        const outcome = step.grade(cell, input.value);
        const { result } = outcome;
        input.disabled = true;
        keys.forEach(k => { k.disabled = true; });
        const map = results[step.key];
        map.set(cell.key, [...(map.get(cell.key) ?? []), result]);
        queue = requeue(rest, item, result);
        done++;

        const nextBtn = el('button', { type: 'button', class: 'primary', onclick: ask }, 'Next');
        check.replaceWith(nextBtn);
        const retryNote = result !== CORRECT && item.attempt === 1
          ? el('p', { class: 'muted' }, 'This one will come round again.') : null;
        feedback.className = `feedback ${result}`;
        feedback.replaceChildren(...[...step.feedback(cell, outcome), retryNote].filter(c => c != null));
        nextBtn.focus();
      });

      show(
        el('p', { class: 'step' },
          `${step.name} · ${done + 1} of ${done + queue.length}`, item.attempt > 1 ? ' · second try' : ''),
        el('div', { class: 'card' }, ...step.prompt(cell).filter(c => c != null),
          form,
          el('div', { class: 'keys', 'aria-label': 'Accented letters' }, keys),
          feedback),
      );
      input.focus();
    };
    ask();
  }

  // Feedback for the phrase steps: verdict line naming any missed forms, then the canonical
  // phrase (or exchange) with its targets marked.
  function phraseFeedback(outcome, canonical) {
    const forms = outcome.missing.flatMap((f, i) => [i ? ', ' : '', el('b', { lang: 'pt-PT' }, f)]);
    const verdict = outcome.result === CORRECT ? el('p', {}, el('strong', {}, '✓ Correct'))
      : outcome.result === ALMOST ? el('p', {}, el('strong', {}, 'Almost: check the accents in '), forms, '.')
        : el('p', {}, el('strong', {}, '✗ Not quite. '), 'Check ', forms, '.');
    return [verdict, canonical];
  }

  const RECALL = {
    key: 'recall', name: 'Recall',
    prompt: cell => [
      cueLine(cell, cell.recallTargets),
      el('p', { class: 'gloss' }, cell.meet.en),
      el('p', { class: 'muted instruction' }, cell.meet.kind === 'echo'
        ? 'Type the whole exchange in Portuguese: question and answer.'
        : 'Type the whole phrase in Portuguese.'),
    ],
    grade: (cell, answer) => gradePhrase(answer, cell.recallTargets.map(t => t.form)),
    feedback: (cell, outcome) => phraseFeedback(outcome, phrase(cell.meet)),
  };

  const ECHO = {
    key: 'echo', name: 'Echo',
    prompt: cell => [
      cueLine(cell, cell.echoTargets),
      el('div', { class: 'question' },
        el('p', { class: 'pt', lang: 'pt-PT' }, cell.echo.turns[0]),
        el('button', { type: 'button', class: 'play', onclick: () => speak(cell.echo.turns[0]) }, '▶ Play')),
      questionGloss(cell.echo) ? el('p', { class: 'en' }, questionGloss(cell.echo)) : null,
      el('p', { class: 'muted instruction' }, 'Type the answer.'),
    ],
    grade: (cell, answer) => gradePhrase(answer, cell.echoTargets.map(t => t.form)),
    feedback: (cell, outcome) => phraseFeedback(outcome, phrase(cell.echo)),
  };

  const TRANSFER = {
    key: 'transfer', name: 'Transfer',
    prompt: cell => [
      cueLine(cell),
      sentence(cell, false),
      cell.transfer.en ? el('p', { class: 'en' }, cell.transfer.en) : null,
    ],
    grade: (cell, answer) => ({ result: gradeForm(answer, cell.form) }),
    feedback: (cell, { result }) => result === CORRECT
      ? [el('p', {}, el('strong', {}, '✓ Correct')), sentence(cell, true)]
      : [
        result === ALMOST
          ? el('p', {}, el('strong', {}, 'Almost: check the accents. '), 'The spelling is ',
            el('b', { lang: 'pt-PT' }, cell.form), '.')
          : el('p', {}, el('strong', {}, '✗ Not quite. '), 'The form is ',
            el('b', { lang: 'pt-PT' }, cell.form), '.'),
        sentence(cell, true),
        el('div', { class: 'hint' }, el('p', { class: 'hint-label' }, 'Remember'), anchorBlock(cell)),
      ],
  };

  function summary() {
    finished = true;
    const steps = [['Recall', 'recall'], ['Echo', 'echo'], ['Transfer', 'transfer']];
    const rows = Object.fromEntries(steps.map(([, key]) => [key, summarize(plan, results[key])]));
    const label = { first: '✓ first try', retry: '✓ on retry', missed: '✗' };
    const firstTry = rows.transfer.filter(r => r.status === 'first').length;
    const status = (key, i) => {
      if (key === 'echo' && !plan[i].echo) return el('td', { class: 'none' }, '—');
      const r = rows[key][i];
      return el('td', { class: r.status }, label[r.status],
        r.almost ? el('span', { class: 'almost-tag' }, 'almost') : null);
    };
    show(
      el('h2', {}, 'Done'),
      el('p', {}, `${firstTry} of ${plan.length} right first time in Transfer.`),
      el('p', { class: 'muted small' },
        'Transfer (typing the bare form) is the step mastery will count from M4; Recall and Echo are practice.'),
      el('div', { class: 'scroll' },
        el('table', { class: 'summary' },
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col' }, 'Cell'), el('th', { scope: 'col' }, 'Form'),
            steps.map(([name]) => el('th', { scope: 'col' }, name)))),
          el('tbody', {}, plan.map((cell, i) => el('tr', {},
            el('td', { lang: 'pt-PT' }, cueText(cell)),
            el('td', { lang: 'pt-PT' }, el('b', {}, cell.form)),
            steps.map(([, key]) => status(key, i))))))),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'primary', onclick: onAgain }, 'Practise again'),
        el('button', { type: 'button', onclick: onHome }, 'Home')),
    );
  }

  // Meet → Recall → Echo → Transfer → summary (planPhases leaves out empty phases); each
  // phase starts with a cell that differs from the last one shown.
  const GRADED = { recall: RECALL, echo: ECHO, transfer: TRANSFER };
  runPhases(planPhases(plan), (phase, prev, next) => {
    if (phase.name === 'meet') return meet(orderCells(phase.cells, Math.random, prev), 0, next);
    return graded(GRADED[phase.name], phase.cells, prev, next);
  }, summary);

  return { inProgress: () => !finished };
}
