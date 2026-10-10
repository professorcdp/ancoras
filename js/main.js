// Entry point: load and validate anchors.json, then switch between views:
// home (session picker), practice, and data (the M0 tables, at #data).

import { validate, formatProblem, summary } from './validate.js';
import { $, el } from './dom.js';
import { renderDataView } from './data-view.js';
import { renderPicker } from './picker.js';
import { startSession } from './practice.js';

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
  showView(location.hash === '#data' ? 'data' : 'home');
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
    session = startSession(data, selection, { onHome: endSession, onAgain: () => run(selection) });
  };
  const endSession = () => {
    if (!session) return home();
    if (session.inProgress() && !confirm(LEAVE_PROMPT)) return;
    session = null;
    history.back(); // pops the session's entry; popstate below shows home
  };
  window.addEventListener('popstate', () => {
    if (session) {
      if (session.inProgress() && !confirm(LEAVE_PROMPT)) {
        history.pushState({ practice: true }, '', location.pathname); // stay in the session
        return;
      }
      session = null;
    }
    route();
  });

  $('home-link').addEventListener('click', e => { e.preventDefault(); endSession(); });
  $('nav-home').addEventListener('click', e => { e.preventDefault(); home(); });
  renderPicker(data, {
    ok,
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
