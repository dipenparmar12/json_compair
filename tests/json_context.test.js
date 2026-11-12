/*
 * Regression suite for the right-click menu's resolver (v6/utils/json_context.js).
 *
 *   LINE — what one line holds: key, value, or an opening bracket.
 *   PATH — the path of every line equals the real path in the parsed document,
 *          at 2/3/4 spaces and tabs, with gap lines in between.
 *
 * Run: node tests/json_context.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'v6', 'utils', 'json_context.js'), 'utf8'), sandbox);
const C = sandbox.JSONContext;

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push(name + (detail ? '\n      ' + detail : ''));
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- LINE -------------------------------------------------------------------
{
  const p = C.parseLine;
  check('LINE property', same(p('  "a": true,'), { key: 'a', value: true, hasValue: true, opens: null }));
  check('LINE string value with a comma and colon', p('  "a": "x, y: z",').value === 'x, y: z');
  check('LINE escaped key', p('  "a\\"b": 1').key === 'a"b');
  check('LINE element', same(p('    null,'), { value: null, hasValue: true, opens: null }));
  check('LINE opens object', same(p('  "a": {'), { key: 'a', hasValue: false, opens: '{' }));
  check('LINE bare open', p('  [').opens === '[' && p('  [').key === undefined);
  check('LINE empty containers are values', same(p('"a": {},').value, {}) && same(p('"b": []').value, []));
  check('LINE closers and blanks are nothing', p('  },') === null && p(']') === null && p('   ') === null && p('') === null);
  check('LINE compact record', same(p('  {"a":1,"b":[2]},').value, { a: 1, b: [2] }));
}

// --- PATH -------------------------------------------------------------------
function everyLine(value, indent, label, withGaps) {
  let lines = JSON.stringify(value, null, indent).split('\n');
  if (withGaps) lines = lines.flatMap((l, i) => (i % 3 === 1 ? [l, '', ''] : [l]));   // gap rows
  const getLine = (n) => lines[n - 1];
  let bad = null, n = 0;
  for (let i = 1; i <= lines.length && !bad; i++) {
    const c = C.at(getLine, i);
    if (!c) continue;
    n++;
    let v = value;
    for (const s of c.segs) v = v == null ? undefined : v[s];
    if (v === undefined) bad = `line ${i} "${lines[i - 1].trim()}" → ${C.formatPath(c.segs)}: nothing there`;
    else if (c.hasValue && !same(v, c.value)) bad = `line ${i} → ${C.formatPath(c.segs)}: value differs`;
    else if (!c.hasValue && (Array.isArray(v) ? '[' : '{') !== c.opens) bad = `line ${i} → ${C.formatPath(c.segs)}: wrong container`;
  }
  check(`PATH ${label}`, !bad && n > 0, bad);
}
{
  const doc = {
    user: { status: 'active', tags: ['a', 'b'], 'odd key': { 'x.y': 1 } },
    order: { status: 'pending', lines: [{ id: 1, q: [1, [2, 3]] }, { id: 2, q: [] }, null, 7] },
    empty: {}, n: null, t: true
  };
  const arr = [{ id: 1, a: { b: [{ c: 'None' }] } }, { id: 2, a: null }, [1, 2], 'x'];
  for (const [ind, name] of [[2, '2 spaces'], [3, '3 spaces'], [4, '4 spaces'], ['\t', 'tabs']]) {
    everyLine(doc, ind, `object, ${name}`);
    everyLine(arr, ind, `root array, ${name}`);
  }
  everyLine(doc, 2, 'object with gap rows', true);
  everyLine(arr, 3, 'root array with gap rows', true);

  const lines = JSON.stringify(doc, null, 2).split('\n');
  const g = (n) => lines[n - 1];
  const find = (t) => lines.findIndex((l) => l.trim().startsWith(t)) + 1;
  check('PATH same key, different places', C.formatPath(C.at(g, find('"status": "active"')).segs) === 'user.status'
    && C.formatPath(C.at(g, find('"status": "pending"')).segs) === 'order.status');
  check('PATH key that is not an identifier', C.formatPath(C.at(g, find('"x.y"')).segs) === 'user["odd key"]["x.y"]');
  check('PATH array index', C.formatPath(C.at(g, find('"id": 2')).segs) === 'order.lines[1].id');
  check('PATH root line has an empty path', same(C.at(g, 1).segs, []));
  check('PATH closer → null', C.at(g, lines.length) === null);
}

// --- TOKEN ------------------------------------------------------------------
check('TOKEN', same([true, 1, null, 'NaN', '', 0].map(C.token), ['true', '1', 'null', 'NaN', '""', '0']));
check('FORMAT * for an unknown index', C.formatPath(['*', 'a']) === '[*].a');

console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log('');
  process.exit(1);
}
