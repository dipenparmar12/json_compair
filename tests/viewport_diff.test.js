/*
 * Regression suite for the status-bar "differences in view" count
 * (v6/utils/viewport_diff.js).
 *
 *   COST   — one very long line in view (raw CSV: a 148 KB header row) used to
 *            run a CHARACTER diff to diff_match_patch's 1 s timeout, on every
 *            status update. The count is line by line now.
 *   COUNT  — it still counts runs of changed lines.
 *
 * Run: node tests/viewport_diff.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { console, setTimeout, clearTimeout, module: {} };   // the DMP file ends in module.exports
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'v5', 'js', 'diff_match_patch.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'v6', 'utils', 'viewport_diff.js'), 'utf8'), sandbox);

// The slice of a CM6 editor the manager reads: viewport + doc line lookups.
function editor(text) {
  const lines = text.split('\n');
  const starts = [];
  let p = 0;
  for (const l of lines) { starts.push(p); p += l.length + 1; }
  const line = (n) => ({ number: n, from: starts[n - 1], to: starts[n - 1] + lines[n - 1].length });
  const doc = {
    length: text.length,
    lines: lines.length,
    line,
    lineAt(pos) {
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; }
      return line(lo + 1);
    },
    sliceString: (a, b) => text.slice(a, b),
  };
  return { viewport: { from: 0, to: Math.min(text.length, 4000) }, state: { doc } };
}

function count(left, right) {
  const m = new sandbox.ViewportDiffManager({ a: editor(left), b: editor(right) });
  m.enabled = true;
  const t0 = Date.now();
  const r = m.calculateViewportDiff();
  return { ms: Date.now() - t0, n: r && r.diffCount };
}

let pass = 0, fail = 0;
const failures = [];
function check(group, name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push(`${group} :: ${name}${detail ? '\n      ' + detail : ''}`);
}

{
  // Raw CSV with a very wide header opposite the same data as JSON.
  const header = Array.from({ length: 6000 }, (_, i) => `column_${i}`);
  const values = header.map((_, i) => String(i * 1.5));
  const csv = header.join(',') + '\n' + values.join(',') + '\n';
  const json = JSON.stringify([Object.fromEntries(header.map((h, i) => [h, values[i]]))], null, 2);
  const r = count(csv, json);
  check('COST', `a ${Math.round(csv.length / 1024)} KB line in view counts fast`, r.ms < 300, `${r.ms} ms`);
  check('COST', 'and reports the panes as different', r.n >= 1, JSON.stringify(r));
}
{
  const a = ['{', '  "a": 1,', '  "b": 2,', '  "c": 3,', '  "d": 4', '}'].join('\n');
  const b = ['{', '  "a": 1,', '  "b": 20,', '  "c": 3,', '  "d": 40', '}'].join('\n');
  check('COUNT', 'two separate changed lines are two differences', count(a, b).n === 2, JSON.stringify(count(a, b)));
  check('COUNT', 'identical text has none', count(a, a).n === 0);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log('');
  process.exit(1);
}
