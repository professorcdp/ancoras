// Check anchors.json from the command line: node validate.mjs
// Uses the same rules as the page (js/validate.js). Exits 1 if there are problems.

import { readFileSync } from 'node:fs';
import { validate, formatProblem, summary } from './js/validate.js';

const path = new URL('./anchors.json', import.meta.url);
let data;
try {
  data = JSON.parse(readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`Could not read anchors.json: ${err.message}`);
  process.exit(1);
}

const result = validate(data);
console.log(summary(result));
for (const p of result.problems) console.log(`  - ${formatProblem(p)}`);
process.exit(result.problems.length ? 1 : 0);
