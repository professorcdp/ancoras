// Practice screens (SPEC §6 steps 1, 2, 3 and 5; decisions 0005–0007): Meet for every cell,
// then Recall, then Echo (cells whose form is in an echo answer), then Transfer, then a
// summary. In the graded steps a miss comes round once more. Nothing is stored yet (M4, #5).

import { isObject, ECHO_SEPARATOR } from './validate.js';
import { $, el, highlight } from './dom.js';
import { gradeForm, gradePhrase, normalize, CORRECT, ALMOST } from './grade.js';
import { speak, stop } from './audio.js';
import { openFormsPanel, formsPanelOpen } from './forms.js';
import { cellRecord, cellStatus, isScored } from './progress.js';
import {
  buildCells, pickMeetAnchor, pickTransfer, pickEchoAnchor, targetsIn, orderCells, requeue,
  splitOnForm, summarize, describeCells, tenseLabel, planPhases, runPhases,
  discriminateItemsFor, interleave, tallyDiscriminate, PHASES, formsFocus,
} from './session.js';

const ACCENTS = ['á', 'à', 'â', 'ã', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú', 'ç'];
const BLANK = '____';
const AUTO_ADVANCE_MS = 600; // Discriminate: pause on a correct tap before the next item
const targetForms = a => (Array.isArray(a?.targets) ? a.targets : []).filter(isObject).map(t => t.form);
const targetCells = a => (Array.isArray(a?.targets) ? a.targets : []).filter(isObject);

// Returns a controller: inProgress() is true until the summary screen is reached.
// `progress` is the store: every scored answer is recorded (and saved) as it happens.
export function startSession(data, selection, { onHome, onAgain, progress }) {
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
      discriminate: discriminateItemsFor(data, cell), // empty: no confusion set (or no item)
    };
  });
  const results = { recall: new Map(), echo: new Map(), transfer: new Map() }; // key -> grades
  const steps = Array.isArray(selection.steps) ? selection.steps : PHASES; // decision 0014
  const taps = []; // Discriminate: { key, counts, right } per tap, in order
  const before = progress.get(); // to show what this session changed
  const missedThisSession = new Set(); // cells whose streak a scored miss reset
  const recordEvent = event => {
    if (!isScored(event)) return; // Recall, Echo and practice-only taps don't touch progress
    if (event.result !== CORRECT) missedThisSession.add(event.key);
    progress.record(event);
  };
  let finished = false;
  // Attempts made after opening the Forms panel (decision 0015): step -> cell keys.
  const lookedUp = { recall: new Set(), echo: new Set(), discriminate: new Set(), transfer: new Set() };

  // What the Forms button shows on the current screen, and what peeking does there: each
  // screen calls setFocus(cells, onPeek). onPeek marks an unanswered attempt as looked up.
  let focus = { cells: [], onPeek: null };
  const setFocus = (cells, onPeek = null) => { focus = { cells, onPeek }; };
  const openForms = () => {
    focus.onPeek?.();
    openFormsPanel(data, formsFocus(data, focus.cells, { highlight: !finished }));
  };
  const lookedUpTag = () => el('span', { class: 'looked-tag', title: 'Forms panel opened before answering: not counted toward progress' }, 'looked up');

  const root = $('practice');
  const show = (...children) => {
    stop(); // whatever was playing belongs to the previous screen
    root.replaceChildren(
      el('div', { class: 'practice-top' },
        el('button', { type: 'button', class: 'link', onclick: onHome }, '← End session'),
        el('button', { type: 'button', class: 'forms-btn', onclick: openForms, 'aria-haspopup': 'dialog' }, 'Forms')),
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

  // What to say for an anchor: both turns for an echo pair, else its phrase.
  const spokenPhrase = a => (a.kind === 'echo' && Array.isArray(a.turns) ? a.turns.join(ECHO_SEPARATOR) : a.pt);
  // A Play button; hidden by CSS when there is no pt-PT voice (body.no-audio).
  const playButton = text => el('button', { type: 'button', class: 'play', onclick: () => speak(text) }, '▶ Play');

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
        playButton(spokenPhrase(cell.meet)),
        nextBtn),
    );
    nextBtn.focus();
    setFocus([cell, ...targetCells(cell.meet)]); // Meet isn't graded: peeking changes nothing
    speak(spokenPhrase(cell.meet)); // Meet plays its anchor when shown (decision 0010)
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
      // Forms opened before this attempt was answered, or still open as the item appears.
      let peeked = formsPanelOpen();

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
        recordEvent({ key: cell.key, step: step.key, result, firstAttempt: item.attempt === 1, lookedUp: peeked });
        if (peeked) lookedUp[step.key].add(cell.key);
        queue = requeue(rest, item, result);
        done++;

        const nextBtn = el('button', { type: 'button', class: 'primary', onclick: ask }, 'Next');
        check.replaceWith(nextBtn);
        const retryNote = result !== CORRECT && item.attempt === 1
          ? el('p', { class: 'muted' }, 'This one will come round again.') : null;
        feedback.className = `feedback ${result}`;
        const shown = step.feedback(cell, outcome);
        if (peeked) shown[0].append(' ', lookedUpTag()); // verdict line, e.g. "✓ Correct looked up"
        feedback.replaceChildren(...[
          ...shown,
          el('div', { class: 'replay' }, playButton(step.spoken(cell))), // no auto-play here
          retryNote,
        ].filter(c => c != null));
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
      setFocus(step.focusCells(cell), () => { if (!input.disabled) peeked = true; });
      step.onShow?.(cell);
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
    focusCells: cell => [cell, ...cell.recallTargets],
    feedback: (cell, outcome) => phraseFeedback(outcome, phrase(cell.meet)),
    spoken: cell => spokenPhrase(cell.meet),
  };

  const ECHO = {
    key: 'echo', name: 'Echo',
    prompt: cell => [
      cueLine(cell, cell.echoTargets),
      el('div', { class: 'question' },
        el('p', { class: 'pt', lang: 'pt-PT' }, cell.echo.turns[0]),
        playButton(cell.echo.turns[0])),
      questionGloss(cell.echo) ? el('p', { class: 'en' }, questionGloss(cell.echo)) : null,
      el('p', { class: 'muted instruction' }, 'Type the answer.'),
    ],
    grade: (cell, answer) => gradePhrase(answer, cell.echoTargets.map(t => t.form)),
    focusCells: cell => [cell, ...targetCells(cell.echo)], // the whole exchange is shown after
    feedback: (cell, outcome) => phraseFeedback(outcome, phrase(cell.echo)),
    spoken: cell => spokenPhrase(cell.echo),
    onShow: cell => speak(cell.echo.turns[0]), // Echo plays its question when shown
  };

  const TRANSFER = {
    key: 'transfer', name: 'Transfer',
    prompt: cell => [
      cueLine(cell),
      sentence(cell, false),
      cell.transfer.en ? el('p', { class: 'en' }, cell.transfer.en) : null,
    ],
    grade: (cell, answer) => ({ result: gradeForm(answer, cell.form) }),
    focusCells: cell => [cell],
    spoken: cell => (cell.transfer.source === 'bare' ? cell.form : cell.transfer.pt),
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

  // Discriminate (decision 0008): tap items interleaved across cells. A correct tap is marked
  // and moves on by itself; a wrong one shows the answer and waits for Next. No retries.
  function discriminate(cells, prev, next) {
    const items = interleave(cells.map(c => c.discriminate), it => it.key, Math.random, prev?.key);
    const byKey = new Map(cells.map(c => [c.key, c]));
    let i = 0;
    const ask = () => {
      if (i >= items.length) return next(byKey.get(items.at(-1)?.key) ?? prev);
      const item = items[i];
      const feedback = el('div', { class: 'feedback', 'aria-live': 'polite' });
      const buttons = item.options.map(opt => el('button', {
        type: 'button', class: 'option', lang: 'pt-PT', onclick: () => choose(opt),
      }, opt));
      const advance = () => { i++; ask(); };
      // Forms opened before this tap, or still open as the item appears (it can be, when a
      // correct tap moves on by itself while the learner is peeking): the tap is looked up.
      let peeked = formsPanelOpen();
      function choose(opt) {
        if (buttons.some(b => b.disabled)) return;
        buttons.forEach(b => { b.disabled = true; });
        const right = opt === item.answer;
        taps.push({ key: item.key, counts: item.counts, right });
        recordEvent({ key: item.key, step: 'discriminate', result: right ? CORRECT : 'wrong', counts: item.counts, lookedUp: peeked });
        if (peeked) lookedUp.discriminate.add(item.key);
        for (const b of buttons) {
          if (b.textContent === item.answer) b.classList.add('right');
          else if (b.textContent === opt) b.classList.add('wrong');
        }
        if (right) {
          // Only advance if this screen is still showing (the learner may have left).
          setTimeout(() => { if (buttons[0].isConnected) advance(); }, AUTO_ADVANCE_MS);
          return;
        }
        const nextBtn = el('button', { type: 'button', class: 'primary', onclick: advance }, 'Next');
        feedback.className = 'feedback wrong';
        feedback.replaceChildren(item.kind === 'verb'
          ? el('p', {}, el('strong', {}, '✗ '), el('b', { lang: 'pt-PT' }, item.form), ' is ',
            el('b', { lang: 'pt-PT' }, item.answer), withGloss('', verbGloss(item.answer)), '.')
          : el('p', {}, el('strong', {}, '✗ '), 'The form is ', el('b', { lang: 'pt-PT' }, item.answer), '.'),
        el('div', { class: 'actions' }, nextBtn));
        nextBtn.focus();
      }
      show(
        el('p', { class: 'step' }, `Discriminate · ${i + 1} of ${items.length}`),
        el('div', { class: 'card' },
          item.kind === 'verb'
            ? [el('p', { class: 'muted instruction' }, 'Which verb?'),
              el('p', { class: 'pt big', lang: 'pt-PT' }, item.form)]
            : [el('p', { class: 'cue', lang: 'pt-PT' },
              el('b', {}, item.person), notes[item.person] ? ` (${notes[item.person]})` : '',
              ` · ${withGloss(item.verb, item.gloss)} · ${tenseLabel(item.tense)}`),
            el('p', { class: 'muted instruction' }, 'Which form?')],
          el('div', { class: 'options' }, buttons),
          feedback),
      );
      const cell = byKey.get(item.key);
      setFocus(cell ? [cell] : [], () => { if (!buttons.some(b => b.disabled)) peeked = true; });
    };
    ask();
  }

  // "ver (to see)"; "estar, to be (state/location)" when the gloss has its own brackets.
  function withGloss(verb, gloss) {
    if (!gloss) return verb;
    return gloss.includes('(') ? `${verb}, ${gloss}` : `${verb} (${gloss})`;
  }

  function verbGloss(verb) {
    return isObject(data.verbs?.[verb]) ? data.verbs[verb].gloss ?? '' : '';
  }

  function summary() {
    finished = true;
    const columns = [['Recall', 'recall'], ['Echo', 'echo'], ['Discriminate', 'discriminate'], ['Transfer', 'transfer']];
    const after = progress.get();
    // Progress column: the cell's streak now, "mastered" if this session got it there, or
    // "streak reset" if a scored miss this session reset it.
    const progressCell = cell => {
      const rec = cellRecord(after, cell.key);
      const nowMastered = cellStatus(after, cell.key) === 'mastered';
      const badge = nowMastered && cellStatus(before, cell.key) !== 'mastered'
        ? el('span', { class: 'mastered-tag' }, 'mastered')
        : missedThisSession.has(cell.key) && !nowMastered ? el('span', { class: 'reset-tag' }, 'streak reset') : null;
      return el('td', { title: `${rec.days.length} day${rec.days.length === 1 ? '' : 's'} with a first-try Transfer` },
        `streak ${rec.streak}`, badge);
    };
    const rows = Object.fromEntries(columns.filter(([, key]) => results[key])
      .map(([, key]) => [key, summarize(plan, results[key])]));
    const label = { first: '✓ first try', retry: '✓ on retry', missed: '✗' };
    const firstTry = rows.transfer.filter(r => r.status === 'first').length;
    const tally = tallyDiscriminate(taps);
    const status = (key, i) => {
      if (!steps.includes(key)) return el('td', { class: 'none', title: 'step switched off' }, '—');
      if (key === 'echo' && !plan[i].echo) return el('td', { class: 'none' }, '—');
      if (key === 'discriminate') {
        const t = tally.get(plan[i].key);
        if (!t) return el('td', { class: 'none' }, '—');
        const { scored, practice } = t;
        const style = !scored.total ? 'none' : scored.right === scored.total ? 'first'
          : scored.right ? 'partial' : 'missed';
        return el('td', { class: style }, scored.total ? `${scored.right}/${scored.total}` : '—',
          practice.total ? el('span', { class: 'practice-tag' }, ` (+${practice.right}/${practice.total} practice)`) : null,
          lookedUp.discriminate.has(plan[i].key) ? lookedUpTag() : null);
      }
      const r = rows[key][i];
      return el('td', { class: r.status }, label[r.status],
        r.almost ? el('span', { class: 'almost-tag' }, 'almost') : null,
        lookedUp[key].has(plan[i].key) ? lookedUpTag() : null);
    };
    show(
      el('h2', {}, 'Done'),
      el('p', {}, steps.includes('transfer')
        ? `${firstTry} of ${plan.length} right first time in Transfer.`
        : 'Transfer was switched off for this session.'),
      el('p', { class: 'muted small' },
        'Mastery counts the bare-form steps: Discriminate and Transfer (SPEC §8). ' +
        'Recall and Echo are practice. Progress is saved after every answer.'),
      el('div', { class: 'scroll' },
        el('table', { class: 'summary' },
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col' }, 'Cell'), el('th', { scope: 'col' }, 'Form'),
            columns.map(([name]) => el('th', { scope: 'col' }, name)), el('th', { scope: 'col' }, 'Progress'))),
          el('tbody', {}, plan.map((cell, i) => el('tr', {},
            el('td', { lang: 'pt-PT' }, cueText(cell)),
            el('td', { lang: 'pt-PT' }, el('b', {}, cell.form)),
            columns.map(([, key]) => status(key, i)), progressCell(cell)))))),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'primary', onclick: onAgain }, 'Practise again'),
        el('button', { type: 'button', onclick: onHome }, 'Home')),
    );
    setFocus(plan); // the session's verbs; nothing highlighted once finished
  }

  // Meet → Recall → Echo → Discriminate → Transfer → summary (planPhases leaves out empty
  // phases); each phase starts with a cell that differs from the last one shown.
  const GRADED = { recall: RECALL, echo: ECHO, transfer: TRANSFER };
  runPhases(planPhases(plan, steps), (phase, prev, next) => {
    if (phase.name === 'meet') return meet(orderCells(phase.cells, Math.random, prev), 0, next);
    if (phase.name === 'discriminate') return discriminate(phase.cells, prev, next);
    return graded(GRADED[phase.name], phase.cells, prev, next);
  }, summary);

  return { inProgress: () => !finished };
}
