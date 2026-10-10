// Entry point: load and validate anchors.json, then switch between views:
// home (session picker), practice, and data (the M0 tables, at #data).

import { validate, formatProblem, summary } from './validate.js';
import { $, el } from './dom.js';
import { renderDataView } from './data-view.js';
import { renderPicker } from './picker.js';
import { startSession } from './practice.js';
import { decideLeave } from './session.js';
import * as store from './store.js';

// The saved-progress store, as the picker and practice screens use it.
const progress = {
  get: store.getProgress,
  record: store.record,
  replace: store.replaceProgress,
  reset: store.resetProgress,
};
let picker = null;

const VIEWS = ['home', 'practice', 'data'];

const LEAVE_PROMPT = 'End this session? What you\'ve done in it will be lost.';

let session = null; // the running practice session's controller, if any

function showView(name) {
  for (const v of VIEWS) $(`${v}-view`).hidden = v !== name;
  $('banner').hidden = name === 'practice';
  $('nav-data').hidden = name !== 'home';
  $('nav-home').hidden = name !== 'data';
}

function route() {
  const view = location.hash === '#data' ? 'data' : 'home';
  if (view === 'home') picker?.refresh(); // the grid reflects any session just finished
  showView(view);
}

function showError(title, detail) {
  const banner = $('banner');
  banner.hidden = false;
  banner.className = 'banner fail';
  banner.replaceChildren(el('strong', {}, title), el('p', {}, detail));
}

async function load() {
  let res;
  try {
    res = await fetch('anchors.json', { cache: 'no-store' });
  } catch (err) {
    showError('Could not load anchors.json.',
      `${err.message}. Start the app with "node serve.mjs" in the project folder rather than opening the file directly.`);
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
  const ok = result.problems.length === 0;
  renderBanner(result);
  renderDataView(data, result);

  const home = () => {
    if (location.hash) history.pushState(null, '', location.pathname);
    route();
  };

  // A session gets its own history entry, so the browser's Back button returns home.
  // Leaving an unfinished session (Back, "End session", the title link) asks first.
  const run = selection => {
    session = startSession(data, selection, { onHome: () => leave('end'), onAgain: () => run(selection), progress });
  };
  const leave = via => {
    if (!session) return via === 'back' ? route() : home();
    let decision = decideLeave({ via, inProgress: session.inProgress() });
    if (decision.action === 'ask') {
      decision = decideLeave({ via, inProgress: true, confirmed: confirm(LEAVE_PROMPT) });
    }
    if (decision.action === 'stay') {
      if (decision.restoreHistory) history.pushState({ practice: true }, '', location.pathname);
      return;
    }
    session = null;
    if (decision.popHistory) history.back(); // popstate below then shows home
    else route();
  };
  window.addEventListener('popstate', () => leave('back'));

  $('home-link').addEventListener('click', e => { e.preventDefault(); leave('title'); });
  $('nav-home').addEventListener('click', e => { e.preventDefault(); home(); });
  picker = renderPicker(data, {
    ok,
    progress,
    onStart: selection => {
      history.pushState({ practice: true }, '', location.pathname);
      showView('practice');
      run(selection);
    },
  });
  window.addEventListener('hashchange', route);
  route();
}

// Quiet one line when the data is fine; the full red list when it isn't.
function renderBanner(result) {
  const banner = $('banner');
  const ok = result.problems.length === 0;
  banner.className = `banner ${ok ? 'ok' : 'fail'}`;
  banner.replaceChildren(el(ok ? 'span' : 'strong', {}, summary(result)));
  if (!ok) {
    banner.append(el('ul', {}, result.problems.map(p => el('li', {}, formatProblem(p)))));
  }
}

load();
