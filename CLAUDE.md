# Âncoras (TVFpractice)

## Project notes
- What it is: a static practice web app for European Portuguese verb forms. Full design in
  [SPEC.md](SPEC.md); content in `anchors.json`.
- Language: plain HTML, CSS and JavaScript modules. No build step unless the code needs one
  (then Vite). See SPEC.md §10.
- Run locally: `node serve.mjs` in the project folder. It serves the app on
  http://localhost:4791, prints the address and opens it in the browser (`--no-open` to skip).
  Keep to 4791: the browser stores saved data (last selection; mastery progress from M4) per
  address including the port, so another port starts empty. If 4791 is busy it falls back to
  4792–4811 with a warning saying so. No caching, so edits to anchors.json show on reload.
  (`python3 -m http.server 4791` also works, same port for the same saved data.) Opening the
  HTML file directly won't work: `fetch` of `anchors.json` needs a server.
- `serve.mjs` binds localhost only and refuses paths outside the folder and hidden files.
- Test: run `node validate.mjs` in the project folder after any edit to `anchors.json`. It
  prints "anchors.json OK: …" or a list of problems, and exits non-zero on problems. The rules
  live in `js/validate.js` (pure, no DOM), shared with the page's banner.
  Run `node --test` after any code change: it runs every file in `test/` (validator rules,
  form and phrase grading, session building incl. Echo anchor choice, Discriminate items
  and tally, the phase plan, the leave-session decision, and the progress rules) and checks that the real anchors.json passes. No dependencies.
  Browser-only behaviour (history, confirm()) lives in js/main.js and stays thin: the
  decisions it acts on (`decideLeave`, `planPhases`, `runPhases`) are pure, in js/session.js.
- Layout: `index.html`, `style.css`; `js/main.js` (load, validate, switch views),
  `js/picker.js` (session picker), `js/practice.js` (Meet / Recall / Echo / Discriminate /
  Transfer / summary screens; the typed steps share one input-grade-retry routine),
  `js/data-view.js` (M0 tables at `#data`), `js/dom.js` (DOM helpers), `js/store.js` (saved
  progress in localStorage, "ancoras.progress"). Pure, tested modules: `js/validate.js`,
  `js/grade.js`, `js/session.js`, `js/progress.js` (mastery rules, decision 0009).
  `js/audio.js` is a silent stub until M5.
  `validate.mjs` is the Node wrapper; `serve.mjs` the local server; `test/` holds the
  `node --test` files.
- Keep to the spec's non-goals (SPEC.md §2). Build milestones in order and stop after M5 for
  learner feedback.
- Never fall back to a pt-BR voice.

## 2nd brain workflow

### At the start of every session
0. Open by stating this project's stamp in one line, e.g. "This is a BUSINESS project." Read it from the `.claude-account` marker file in the project folder (that marker is what actually routes the folder to the right Claude Max account) and check it agrees with PROJECT.md. If they disagree or the marker is missing, tell Jim and fix it with `claude-stamp personal .` or `claude-stamp business .` (**Where:** VS Code terminal, in the project folder), then ask him to reload the VS Code window before continuing.
1. Read PROJECT.md, the latest 3 entries in the runlog (docs/runlog.md), and the decision records (docs/decisions/). SPEC.md holds the detailed design; consult it for the task at hand.
2. Check open issues: `gh issue list`
3. Give Jim a short summary of where things stand and propose the next step (usually the top "priority: now" issue). Wait for his go-ahead before starting large changes.

### Task tracking (GitHub Issues)
- All work is tracked as GitHub Issues, using the `gh` tool.
- Labels: type (`feature`, `bug`, `chore`, `question`) and priority (`priority: now`, `priority: next`, `priority: later`).
- Reference issues in commit messages ("Fixes #12" when a commit completes one).
- Close an issue when its work is done and committed.
- New work discovered along the way becomes a new issue rather than quietly expanding the current task.

### At the end of every session
1. Add a runlog entry (date, what changed, issues touched, what's next).
2. Update "Current status" in PROJECT.md if it changed.
3. Record significant decisions as new decision records.
4. Commit and push.

### Rules
- Never commit secrets: API keys, passwords, certificates, .p8 keys, .env files.
- Before creating issues or pushing, check `gh auth status` matches the project's stamp.
- The Claude account is chosen by the folder's `.claude-account` marker, never by signing in or out. `claude auth status` shows which account this folder is metered to.
