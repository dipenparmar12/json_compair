/*
 * Regression suite for "Treat specific values as equivalent" (utils/value_equiv.js
 * + json_align's eqKind kind 3).
 *
 *   RULES   — the PRD's table: each rule makes only its own values equal.
 *   SAFETY  — off means exact; text never equals a number/boolean/date by accident.
 *   ALIGN   — equivalent records count as equal, and each pane keeps its OWN value.
 *   ROWS    — the row check the diff uses: `"a": "NaN",` ~ `"a": null`.
 *
 * Run: node tests/value_equiv.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const V6 = path.join(__dirname, '..', 'v6', 'utils');
const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['vendor/jsonrepair.umd.js', 'json_repair.js', 'diff_ignore.js', 'json_align.js', 'value_equiv.js']) {
  vm.runInContext(fs.readFileSync(path.join(V6, f), 'utf8'), sandbox);
}
const A = sandbox.JSONAlign, E = sandbox.ValueEquiv;

let pass = 0, fail = 0;
const failures = [];
function check(group, name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push(`${group} :: ${name}${detail ? '\n      ' + detail : ''}`);
}
const NONE = { name: 'x', values: [], on: false };
function rules(extra) { return E.make(Object.assign({ enabled: true, groups: [NONE] }, extra)); }
const eq = (c, a, b) => c && c(a) === c(b);

// --- RULES ------------------------------------------------------------------
{
  const g = rules({ groups: E.DEFAULTS.groups });           // default: "Missing values" on
  check('RULES', '"NaN" ~ null (default group)', eq(g, 'NaN', null));
  check('RULES', '"None" ~ null', eq(g, 'None', null));
  check('RULES', '"N/A" ~ "NA"', eq(g, 'N/A', 'NA'));
  check('RULES', '"NaN" vs "0" differ', !eq(g, 'NaN', '0'));
  check('RULES', '"active" vs "inactive" differ', !eq(g, 'active', 'inactive'));
  check('RULES', 'disabled groups do not apply ("yes" vs true)', !eq(g, 'yes', true));

  const bt = rules({ groups: [{ name: 'T', values: ['true', 'True', 'yes', '1'], on: true }] });
  check('RULES', 'custom group: "True" ~ true', eq(bt, 'True', true));
  check('RULES', 'custom group: 1 ~ "yes"', eq(bt, 1, 'yes'));

  const n = rules({ numeric: true });
  check('RULES', 'numeric: "100" ~ 100', eq(n, '100', 100));
  check('RULES', 'numeric: "100.00" ~ 100', eq(n, '100.00', 100));
  check('RULES', 'numeric: "1e2" ~ "0100"', eq(n, '1e2', '0100'));
  check('RULES', 'numeric: exact decimals, "0.1" vs "0.10000000000000001" differ',
    !eq(n, '0.1', '0.10000000000000001'));
  check('RULES', 'numeric: "12abc" stays text', !eq(n, '12abc', 12));

  const tc = rules({ trim: true, ignoreCase: true, booleans: true });
  check('RULES', 'trim + case + booleans: " TRUE " ~ "true"', eq(tc, ' TRUE ', 'true'));
  check('RULES', 'booleans: "yes" ~ true', eq(tc, 'yes', true));
  check('RULES', 'booleans: "y" stays text', !eq(tc, 'y', true));

  const d = rules({ dates: true });
  check('RULES', 'dates: "2026-01-01" ~ "01/01/2026"', eq(d, '2026-01-01', '01/01/2026'));
  check('RULES', 'dates: midnight ~ date', eq(d, '2026-01-01T00:00:00', '2026-01-01'));
  check('RULES', 'dates: zones compare as instants', eq(d, '2026-01-01T05:30:00+05:30', '2026-01-01T00:00:00Z'));
  check('RULES', 'dates: "2026-02-30" is not a date', !eq(d, '2026-02-30', '2026-03-02'));

  const na = rules({ na: true });
  check('RULES', 'NA: "" ~ null ~ "#N/A"', eq(na, '', null) && eq(na, '#N/A', null));
}

// --- SAFETY -----------------------------------------------------------------
{
  check('SAFETY', 'master switch off → no rules', E.make(Object.assign({}, E.DEFAULTS)) === null);
  check('SAFETY', 'on but nothing selected → no rules', rules({}) === null);
  const c = rules({ trim: true });
  check('SAFETY', '"100" vs 100 differ without numeric', !eq(c, '100', 100));
  check('SAFETY', '"true" vs true differ without booleans', !eq(c, 'true', true));
  check('SAFETY', '"null" vs null differ without NA/group', !eq(c, 'null', null));
}

// --- ALIGN ------------------------------------------------------------------
{
  const canon = rules({ groups: E.DEFAULTS.groups });
  const L = JSON.stringify([{ id: 1, 'Cooling Date': 'NaN', kwh: 5 }, { id: 2, 'Cooling Date': 'x', kwh: 6 }]);
  const R = JSON.stringify([{ id: 1, 'Cooling Date': null, kwh: 5 }, { id: 2, 'Cooling Date': 'y', kwh: 6 }]);
  const off = A.align(L, R, {});
  const on = A.align(L, R, { equiv: canon });
  check('ALIGN', 'off: both records changed', off.model.totals.changed === 2, JSON.stringify(off.model.totals));
  check('ALIGN', 'on: only the real change counts', on.model.totals.changed === 1, JSON.stringify(on.model.totals));
  check('ALIGN', 'on: left pane keeps "NaN"', /"Cooling Date": "NaN"/.test(on.left));
  check('ALIGN', 'on: right pane keeps null', /"Cooling Date": null/.test(on.right));
  check('ALIGN', 'on: panes stay row-aligned', on.left.split('\n').length === on.right.split('\n').length);
  check('ALIGN', 'on: nothing normalized, so nothing to snapshot', on.changed === false);

  const nl = JSON.stringify({ a: { b: [{ c: 'None' }] } }), nr = JSON.stringify({ a: { b: [{ c: null }] } });
  const nested = A.align(nl, nr, { equiv: canon });
  check('ALIGN', 'nested arrays/objects: equal under rules', nested.left.split('\n').every((l, i) =>
    l === nested.right.split('\n')[i] || E.rowsEquivalent(l, nested.right.split('\n')[i], canon)));
  const model = A.diffModel(L, R, { equiv: canon });
  check('ALIGN', 'diffModel honours equiv', model.model.totals.changed === 1);
}

// --- ROWS -------------------------------------------------------------------
{
  const c = rules({ groups: E.DEFAULTS.groups });
  check('ROWS', 'key row', E.rowsEquivalent('    "Duct Date": "NaN",', '    "Duct Date": null', c));
  check('ROWS', 'different keys differ', !E.rowsEquivalent('  "a": "NaN"', '  "b": null', c));
  check('ROWS', 'array element row', E.rowsEquivalent('  "None",', '  null,', c));
  check('ROWS', 'compact record row', E.rowsEquivalent('  {"a":"NaN","b":1},', '  {"a":null,"b":1}', c));
  check('ROWS', 'bracket rows are not values', !E.rowsEquivalent('  {', '  [', c));
  check('ROWS', 'no rules → false', !E.rowsEquivalent('"a": "NaN"', '"a": null', null));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log('');
  process.exit(1);
}
