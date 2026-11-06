/*
 * Regression suite for JSON held inside string values (json_align `expand`).
 *
 *   EXPAND  — a string holding a JSON object/array, or a Python dict repr, is
 *             compared and shown as structure; anything that does not parse
 *             strictly stays a string, character for character.
 *   DIFF    — two such strings that differ in one number differ in one line,
 *             not one 900-character line.
 *   SAFETY  — expansion is display only: the result is flagged `changed` (so
 *             the app keeps the original text for saving/export), and
 *             nothing is re-written when there is nothing to expand.
 *
 * Run: node tests/embedded_json.test.js
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
for (const f of ['vendor/jsonrepair.umd.js', 'json_repair.js', 'diff_ignore.js', 'json_align.js']) {
  vm.runInContext(fs.readFileSync(path.join(V6, f), 'utf8'), sandbox);
}
const A = sandbox.JSONAlign;

let pass = 0, fail = 0;
const failures = [];
function check(group, name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push(`${group} :: ${name}${detail ? '\n      ' + detail : ''}`);
}
const expand = (v) => A.expandEmbedded(JSON.parse(JSON.stringify(v)));

// The value from the bug report: a Python dict repr stored as a string.
const PY = "{'base_elec_kwh': {'summer': {'mid peak': 2513.889, 'off peak': 1496.389, 'on peak': 1043.889}, " +
  "'winter': {'off peak': 9454.722, 'on peak': 1120.278}}, 'utility_baseline_region': '9'}";

// ---------------------------------------------------------------------------
// EXPAND
{
  const r = expand({ k: PY });
  check('EXPAND', 'a Python dict string becomes an object', r.count === 1 &&
    r.value.k.base_elec_kwh.summer['mid peak'] === 2513.889, JSON.stringify(r.value).slice(0, 120));
  check('EXPAND', 'its string values keep their exact text', r.value.k.utility_baseline_region === '9');
}
{
  const r = expand({ k: '{"a": 1, "b": [true, null]}', l: '[1, 2]' });
  check('EXPAND', 'a stringified JSON object and array expand', r.count === 2 &&
    r.value.k.b[0] === true && r.value.l[1] === 2, JSON.stringify(r.value));
}
{
  const r = expand({ k: "{'a': None, 'b': True, 'c': (1, 2)}" });
  check('EXPAND', 'Python None / True / tuples', r.count === 1 && r.value.k.a === null &&
    r.value.k.b === true && r.value.k.c[1] === 2, JSON.stringify(r.value));
}
{
  const inner = JSON.stringify({ deep: 1 });
  const r = expand({ k: JSON.stringify({ x: inner }) });
  check('EXPAND', 'a structure inside a structure expands too', r.count === 2 && r.value.k.x.deep === 1,
    JSON.stringify(r.value));
}
{
  const keep = ['{not json at all}', "{'a': 1", '[see note]', 'plain text', '{}x', 'x{}', '{', '', '42',
    '  {"a": 1} trailing', '"quoted"'];
  const r = expand({ v: keep });
  check('EXPAND', 'anything that does not parse strictly stays a string', r.count === 0 &&
    JSON.stringify(r.value.v) === JSON.stringify(keep), JSON.stringify(r.value.v));
}
{
  const r = expand({ k: '  {"a": 1}  ' });
  check('EXPAND', 'surrounding whitespace is allowed', r.count === 1 && r.value.k.a === 1);
}

// ---------------------------------------------------------------------------
// DIFF
{
  const L = JSON.stringify({ id: 1, v: PY }, null, 2);
  const R = JSON.stringify({ id: 1, v: PY.replace('1043.889', '1043.9') }, null, 2);
  const on = A.align(L, R, { expand: true });
  const off = A.align(L, R, {});
  const differing = (res) => {
    const a = res.left.split('\n'), b = res.right.split('\n');
    return a.filter((line, i) => line !== b[i]);
  };
  check('DIFF', 'with expand, exactly one line differs', on.ok && differing(on).length === 1 &&
    /"on peak": 1043.889/.test(differing(on)[0]), JSON.stringify(differing(on)));
  check('DIFF', 'without expand, the whole string is the one changed line', off.ok &&
    differing(off).length === 1 && differing(off)[0].length > 150);
  check('DIFF', 'the expanded panes are valid JSON with the nested keys', (() => {
    try { return JSON.parse(on.left).v.base_elec_kwh.winter['off peak'] === 9454.722; } catch (e) { return false; }
  })());
}
{
  // A collection of records, each with an embedded structure (the prepare path).
  const recs = (bump) => Array.from({ length: 12 }, (_, i) => ({
    id: i, data: JSON.stringify({ n: i, x: i === 5 && bump ? 99 : 1 })
  }));
  const res = A.align(JSON.stringify(recs(false)), JSON.stringify(recs(true)), { expand: true });
  const changed = res.model && res.model.items.filter((it) => it.status === 'changed');
  // The model names top-level fields; the panes show the nested line.
  check('DIFF', 'one record changed, and the panes mark only the nested field',
    changed && changed.length === 1 && changed[0].changed.join() === 'data' &&
    res.left.split('\n').filter((l, i) => l !== res.right.split('\n')[i]).length === 1,
    JSON.stringify(changed && changed.map((c) => c.changed)));
}

// ---------------------------------------------------------------------------
// SAFETY
{
  const L = JSON.stringify({ v: '{"a": 1}' }), R = JSON.stringify({ v: '{"a": 2}' });
  const res = A.align(L, R, { expand: true });
  check('SAFETY', 'an expanded render is flagged changed (caller keeps the original)',
    res.ok && res.changed === true && res.expanded === 2, JSON.stringify({ changed: res.changed, expanded: res.expanded }));
  const plain = A.align(JSON.stringify({ v: 'a' }), JSON.stringify({ v: 'b' }), { expand: true });
  check('SAFETY', 'nothing to expand: not flagged', plain.ok && plain.changed === false && plain.expanded === 0);
  const n0 = A.normalize(JSON.stringify({ v: 'a' }), JSON.stringify({ v: 'b' }), null, null, true);
  check('SAFETY', 'expand alone with nothing to expand leaves the text alone (normalize)', n0.ok === false);
  const n1 = A.normalize(L, R, null, null, true);
  check('SAFETY', 'normalize expands when there is something', n1.ok && n1.changed && /"a": 2/.test(n1.right));
  const off = A.align(L, R, {});
  check('SAFETY', 'off by default in json_align (the app passes the setting)', off.ok && off.expanded === 0);
}

// ---------------------------------------------------------------------------
console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log('');
  process.exit(1);
}
