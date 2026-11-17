/*
 * Regression suite for inline arrays (json_align `setFormat` / `stringify`).
 *
 *   INLINE  — an array of plain values goes on one line when it fits the line
 *             width; arrays of objects / arrays, the root array, and long
 *             arrays keep one item per line.
 *   SAFETY  — the output always parses back to the same value.
 *   ALIGN   — both panes keep the same number of lines, and a changed inline
 *             array is one row on each side.
 *
 * Run: node tests/format.test.js
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
for (const f of ['diff_ignore.js', 'value_equiv.js', 'json_align.js', 'json_context.js']) {
  vm.runInContext(fs.readFileSync(path.join(V6, f), 'utf8'), sandbox);
}
const A = sandbox.JSONAlign;

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; return; }
  failed++;
  console.log('  FAIL ' + name + (detail ? '\n       ' + detail : ''));
}
const lines = (t) => t.split('\n');
const reset = () => { A.setIndent('  '); A.setFormat({ arrays: 'auto', lineWidth: 120 }); };

// ---- INLINE ---------------------------------------------------------------
reset();
const doc = {
  months: [1, 2, 3, 4, 5, 10, 11, 12],
  mixed: ['a', 1.5, true, null],
  empty: [],
  periods: [{ name: 'Off peak', hours: [1, 2, 3] }],
  grid: [[1, 2], [3, 4]]
};
let out = A.stringify(doc);
ok('plain array on one line', out.includes('  "months": [1, 2, 3, 4, 5, 10, 11, 12],'), out);
ok('mixed plain values on one line', out.includes('  "mixed": ["a", 1.5, true, null],'));
ok('empty array stays []', out.includes('  "empty": [],'));
ok('array of objects stays multi-line', out.includes('  "periods": [\n    {\n'));
ok('array inside an object in an array is inline', out.includes('      "hours": [1, 2, 3]'));
ok('array of arrays: outer multi-line, inner inline', out.includes('  "grid": [\n    [1, 2],\n    [3, 4]\n  ]'));
ok('round trip', JSON.stringify(JSON.parse(out)) === JSON.stringify(doc));
ok('no trailing comma', !/,\s*[\]}]/.test(out));

ok('root array keeps one item per line', A.stringify([1, 2, 3]) === '[\n  1,\n  2,\n  3\n]');

const long = { v: Array.from({ length: 60 }, (_, i) => i * 1000) };
out = A.stringify(long);
ok('array wider than the line width stays multi-line', lines(out).length === 64, String(lines(out).length));
ok('no line over the width', lines(A.stringify(doc)).every((l) => l.length <= 121));

A.setFormat({ lineWidth: 0 });
ok('no limit: long array on one line', lines(A.stringify(long)).length === 3);

A.setFormat({ lineWidth: 20 });
ok('narrow width: 8 months no longer fit', A.stringify({ months: doc.months }).includes('"months": [\n'));
ok('narrow width: short array still fits', A.stringify({ a: [1, 2] }).includes('"a": [1, 2]'));

A.setFormat({ arrays: 'expanded', lineWidth: 120 });
ok('expanded mode matches JSON.stringify', A.stringify(doc) === JSON.stringify(doc, null, 2));

reset();
A.setIndent('    ');
ok('indent is honoured', A.stringify({ a: [1, 2] }) === '{\n    "a": [1, 2]\n}');
ok('bad settings are ignored', A.setFormat({ arrays: 'x', lineWidth: -5 }).lineWidth === 120);

// ---- ALIGN ----------------------------------------------------------------
reset();
function aligned(l, r, opts) {
  const res = A.align(JSON.stringify(l), JSON.stringify(r), opts || {});
  return { res, L: lines(res.left), R: lines(res.right) };
}

let x = aligned({ id: 1, months: [1, 2, 3], n: 1 }, { id: 1, months: [1, 2, 4], n: 1 });
ok('align ok', x.res.ok);
ok('same line count', x.L.length === x.R.length);
ok('changed inline array is one row per side',
  x.L.includes('  "months": [1, 2, 3],') && x.R.includes('  "months": [1, 2, 4],'), x.res.left);
ok('values kept', JSON.stringify(JSON.parse(x.res.right)) === '{"id":1,"months":[1,2,4],"n":1}');

// one side fits, the other does not → both multi-line, still level
const wide = Array.from({ length: 60 }, (_, i) => i * 1000);
x = aligned({ v: [1, 2, 3] }, { v: wide });
ok('fit / no-fit pair: same line count', x.L.length === x.R.length);
ok('fit / no-fit pair: neither is inline', !x.res.left.includes('[1, 2, 3]'));

// array only on one side
x = aligned({ a: 1 }, { a: 1, tags: ['x', 'y'] });
ok('one-sided inline array: same line count', x.L.length === x.R.length);
ok('one-sided inline array: one row', x.R.includes('  "tags": ["x", "y"]'));

// array vs array of objects
x = aligned({ v: [1, 2] }, { v: [{ a: 1 }] });
ok('plain vs object array: same line count', x.L.length === x.R.length);

// records in a collection
x = aligned([{ id: 1, h: [1, 2] }, { id: 2, h: [3] }], [{ id: 1, h: [1, 2] }, { id: 2, h: [3, 4] }]);
ok('collection: same line count', x.L.length === x.R.length);
ok('collection: inline in records', x.L.includes('    "h": [3]') && x.R.includes('    "h": [3, 4]'));
ok('collection: 1 changed', x.res.model && x.res.model.totals.changed === 1);

// equivalent values that differ in width: line counts must still match
A.setFormat({ lineWidth: 30 });
const canon = sandbox.ValueEquiv.make(Object.assign({}, sandbox.ValueEquiv.DEFAULTS, { enabled: true }));
x = aligned({ v: ['NaN', 'NaN', 'NaN', 'NaN'] }, { v: [null, null, null, null] }, { equiv: canon });
ok('equivalent arrays of different width: same line count', x.L.length === x.R.length,
  x.res.left + '\n---\n' + x.res.right);

// ---- the line reader used by the right-click menu --------------------------
reset();
const text = lines(A.stringify({ a: { months: [1, 2, 3], after: 5 }, list: [[1, 2], [3, 4]] }));
const getLine = (n) => text[n - 1];
const C = sandbox.JSONContext;
let at = C.at(getLine, text.findIndex((l) => l.includes('"months"')) + 1);
ok('context: inline array line has its key and path', at && at.key === 'months' && C.formatPath(at.segs) === 'a.months');
at = C.at(getLine, text.findIndex((l) => l.includes('"after"')) + 1);
ok('context: line after an inline array', at && C.formatPath(at.segs) === 'a.after');
at = C.at(getLine, text.findIndex((l) => l.includes('[3, 4]')) + 1);
ok('context: inline array as an element', at && C.formatPath(at.segs) === 'list[1]');

console.log('\n  ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
