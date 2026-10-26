// Apply a native-speaker review to anchors.json: node review-import.mjs <answers.txt> [--write]
// (decision 0016). Dry run by default: prints what would be applied / skipped / flagged.
//
// First rule: the raw answers text is saved verbatim as review/answers-YYYY-MM-DD.txt, and with
// --write it is committed (that file alone) BEFORE anything is applied, so the paste is never
// lost. Then each answer is applied by anchor id (review/review-core.js); the result is checked
// with the validator, and anchors.json is written only if it passes.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { applyAnswer, parseAnswers } from './review/review-core.js';
import { validate, formatProblem, summary } from './js/validate.js';
import { localDate } from './js/progress.js';

const args = process.argv.slice(2);
const write = args.includes('--write');
const source = args.find(a => !a.startsWith('--'));
if (!source) {
  console.error('Usage: node review-import.mjs <answers.txt> [--write]');
  process.exit(1);
}
const here = p => new URL(p, import.meta.url);
const raw = readFileSync(source, 'utf8');

// 1. Keep the raw text, verbatim, under review/ (reuse an identical copy; never overwrite).
let rawPath;
for (let n = 1; ; n++) {
  const name = `review/answers-${localDate()}${n > 1 ? `-${n}` : ''}.txt`;
  if (!existsSync(here(name))) {
    writeFileSync(here(name), raw);
    rawPath = name;
    break;
  }
  if (readFileSync(here(name), 'utf8') === raw) {
    rawPath = name;
    break;
  }
}
console.log(`Raw answers kept as ${rawPath}`);

// 2. Parse and work out what each answer does.
const { answers, errors } = parseAnswers(raw);
const data = JSON.parse(readFileSync(here('anchors.json'), 'utf8'));
const index = new Map(data.anchors.map((a, i) => [a.id, i]));
const report = { applied: [], skipped: [], flagged: [] };
for (const answer of answers) {
  const i = index.get(answer.id);
  const r = applyAnswer(i === undefined ? undefined : data.anchors[i], answer);
  report[r.status].push(`${answer.id}: ${r.reason}`);
  if (r.status === 'applied') data.anchors[i] = r.anchor;
}
for (const e of errors) report.skipped.push(`line ${e.line}: ${e.reason} — ${e.text.trim()}`);

for (const [status, lines] of Object.entries(report)) {
  console.log(`\n${status.toUpperCase()} (${lines.length})`);
  for (const l of lines) console.log(`  ${l}`);
}

if (!write) {
  console.log(`\nDry run: anchors.json not changed. Run again with --write to commit ${rawPath} and apply.`);
  process.exit(0);
}

// 3. --write: commit the raw file first; stop if that fails.
const git = (...a) => execFileSync('git', a, { cwd: here('.'), encoding: 'utf8' }).trim();
try {
  git('add', '--', rawPath);
  if (git('diff', '--cached', '--name-only', '--', rawPath)) {
    git('commit', '-q', '-m', `Review answers ${localDate()} (raw, verbatim)`, '--', rawPath);
    console.log(`\nCommitted ${rawPath} before applying anything.`);
  } else {
    console.log(`\n${rawPath} was already committed.`);
  }
} catch (err) {
  console.error(`\nCould not commit ${rawPath}; nothing applied.\n${err.message}`);
  process.exit(1);
}

// 4. Check the result before writing it.
const checked = validate(data);
console.log(`\n${summary(checked)}`);
if (checked.problems.length) {
  for (const p of checked.problems) console.log(`  - ${formatProblem(p)}`);
  console.error('anchors.json NOT written: the result has problems.');
  process.exit(1);
}
writeFileSync(here('anchors.json'), JSON.stringify(data, null, 1));
console.log(`anchors.json written: ${report.applied.length} applied, ${report.skipped.length} skipped, ${report.flagged.length} flagged for Jim.`);
