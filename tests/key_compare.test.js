/*
 * Regression suite for v6/utils/key_compare.js and the record pairing it
 * shares with json_align.js.
 *
 *   PAIR    — records whose schema drifted must still pair. One record per
 *             side, the same UUID, thousands of keys each and only a fifth of
 *             them shared, used to render as "1 removed, 1 added, 0 field
 *             changes": two blocks side by side with no key aligned and no
 *             missing key reported. (docs/test-cases-example/
 *             json-compare-snapshot-2026-10-28T15-37-48.zip)
 *   STATUS  — every leaf lands in exactly one of equal / changed / leftOnly /
 *             rightOnly / ignored, at any depth, in arrays, for null and for
 *             type changes. Formatting and key order never count.
 *   FILTER  — the filters partition rows the way their names say, for single
 *             rows and for per-column aggregates over many records.
 *   EXPORT  — CSV and JSON carry path, both values, status and the missing side.
 *
 * Run: node tests/key_compare.test.js
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
const run = (f) => vm.runInContext(fs.readFileSync(path.join(V6, f), 'utf8'), sandbox);
run('diff_ignore.js');
run('json_align.js');
run('key_compare.js');

const A = sandbox.JSONAlign;
const K = sandbox.KeyCompare;
const DI = sandbox.DiffIgnore;

let pass = 0, fail = 0;
const failures = [];
function check(group, name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push(`${group} :: ${name}${detail ? '\n      ' + detail : ''}`);
}

const cmp = (l, r, opts) => K.compare(l, r, Object.assign({ matchArray: A.matchArray }, opts || {}));
const byPath = (res) => {
  const m = {};
  for (const r of res.rows) m[r.path] = r;
  return m;
};

// A wide record whose schema drifted between two exports: same identity,
// a few shared columns, many columns on each side the other lacks.
function driftedPair(withId) {
  const l = {}, r = {};
  if (withId) { l.UUID = 'u-1d4d4655'; r.UUID = 'u-1d4d4655'; }
  l.City = 'SACRAMENTO'; r.City = 'SACRAMENTO';
  l.Zip = 95822; r.Zip = 95822;
  l.Street = 'BEESTON'; r.Street = 'BEESTON';
  l.Heating = null; r.Heating = 'NaN';
  l.Lat = 38.489959; r.Lat = 38.489959000000006;
  for (let i = 0; i < 60; i++) l['left_' + i] = i;
  for (let i = 0; i < 150; i++) r['right_' + i] = i;
  return [l, r];
}

// ---------------------------------------------------------------------------
// PAIR
// ---------------------------------------------------------------------------
{
  const [l, r] = driftedPair(true);
  const res = A.align(JSON.stringify([l]), JSON.stringify([r]), {});
  const t = res.model.totals;
  check('PAIR', 'one record per side with a shared UUID pairs', t.changed === 1 && t.added === 0 && t.removed === 0,
    JSON.stringify(t));
  const it = res.model.items[0];
  check('PAIR', 'field diff reports both missing sides',
    it.onlyA.length === 60 && it.onlyB.length === 150 && it.changed.length === 2,
    `changed ${it.changed.length}, onlyA ${it.onlyA.length}, onlyB ${it.onlyB.length}`);
  const La = res.left.split('\n'), Rb = res.right.split('\n');
  const row = La.findIndex(s => s.includes('"City"'));
  check('PAIR', 'shared keys sit on the same row in both panes', row > 0 && Rb[row].includes('"City"'),
    `${La[row]} | ${Rb[row]}`);
  check('PAIR', 'panes still parse to the original values',
    JSON.stringify(JSON.parse(res.left)) === JSON.stringify([l]) &&
    JSON.stringify(JSON.parse(res.right)) === JSON.stringify([r]));
}
{
  // No identifier-named key: the shared columns mostly agree, so it is the
  // same record.
  const [l, r] = driftedPair(false);
  const t = A.align(JSON.stringify([l]), JSON.stringify([r]), {}).model.totals;
  check('PAIR', 'drifted record without an id pairs on shared-value agreement', t.changed === 1, JSON.stringify(t));
}
{
  // Genuinely different records must stay apart.
  const t = A.align(JSON.stringify([{ a: 1, b: 2 }]), JSON.stringify([{ c: 3, d: 4 }]), {}).model.totals;
  check('PAIR', 'unrelated records stay removed + added', t.added === 1 && t.removed === 1, JSON.stringify(t));
  const t2 = A.align(JSON.stringify([{ id: 'x1', v: 1, w: 9, z: 0 }]),
                     JSON.stringify([{ id: 'y2', v: 2, w: 8, q: 0 }]), {}).model.totals;
  check('PAIR', 'different ids + different values stay apart', t2.added === 1 && t2.removed === 1, JSON.stringify(t2));
}
{
  // A shared foreign key is not an identity: `category_id` repeats.
  const l = [{ category_id: 7, n: 'a', p: 1, q: 1 }, { category_id: 7, n: 'b', p: 2, q: 2 }];
  const r = [{ category_id: 7, n: 'x', p: 9, q: 9, extra: 1 }];
  const t = A.align(JSON.stringify(l), JSON.stringify(r), {}).model.totals;
  check('PAIR', 'a repeated *_id value does not force a pair', t.changed === 0, JSON.stringify(t));
}
{
  // Pairing by id inside a small array keeps document order.
  const l = [{ id: 'a1', x: 1, p: 1 }, { id: 'b2', x: 2, p: 2 }];
  const r = [{ id: 'a1', x: 5, extra: 1, more: 2, yet: 3 }, { id: 'b2', x: 6, extra: 1, more: 2, yet: 3 }];
  const m = A.align(JSON.stringify(l), JSON.stringify(r), {}).model;
  check('PAIR', 'small array pairs every record on its id', m.totals.changed === 2 && m.totals.added === 0,
    JSON.stringify(m.totals));
}

// ---------------------------------------------------------------------------
// STATUS
// ---------------------------------------------------------------------------
{
  const [l, r] = driftedPair(true);
  const res = cmp([l], [r]);
  const p = byPath(res);
  check('STATUS', 'equal value', p['[0].City'] && p['[0].City'].status === 'equal');
  check('STATUS', 'null vs "NaN" is a changed value with a type note',
    p['[0].Heating'].status === 'changed' && p['[0].Heating'].note === 'type');
  check('STATUS', 'float noise is a change without tolerance', p['[0].Lat'].status === 'changed');
  check('STATUS', 'left-only key', p['[0].left_3'].status === 'leftOnly' && p['[0].left_3'].right === undefined);
  check('STATUS', 'right-only key', p['[0].right_9'].status === 'rightOnly' && p['[0].right_9'].left === undefined);
  check('STATUS', 'totals add up',
    res.totals.equal === 4 && res.totals.changed === 2 && res.totals.leftOnly === 60 && res.totals.rightOnly === 150,
    JSON.stringify(res.totals));
  check('STATUS', 'records are tagged with their index', p['[0].City'].li === 0 && p['[0].City'].ri === 0);

  const tol = byPath(cmp([l], [r], { numTol: 1e-9 }));
  check('STATUS', 'numeric tolerance makes near-equal numbers equal',
    tol['[0].Lat'].status === 'equal' && tol['[0].Lat'].note === 'tolerance');

  const ign = DI.makePredicate(DI.makeMatcher(DI.parsePatterns(['Heating', '/^left_/'])), 'key');
  const ig = cmp([l], [r], { ignore: ign });
  check('STATUS', 'ignore patterns mark keys ignored, on one side or both',
    ig.totals.ignored === 61 && ig.totals.leftOnly === 0, JSON.stringify(ig.totals));
}
{
  // Key order and formatting are irrelevant: compare parsed values.
  const l = JSON.parse('{"a":1,"b":{"c":[1,2,3],"d":null}}');
  const r = JSON.parse('{\n  "b": {\n    "d": null,\n    "c": [1, 2, 3]\n  },\n  "a": 1\n}');
  const res = cmp(l, r);
  check('STATUS', 'reordered keys + reformatted text → all equal',
    res.totals.changed + res.totals.leftOnly + res.totals.rightOnly === 0, JSON.stringify(res.totals));
}
{
  // Nested objects and arrays.
  const l = { user: { name: 'Ann', tags: ['a', 'b'], addr: { zip: '1' } }, items: [{ id: 1, q: 1 }, { id: 2, q: 2 }] };
  const r = { user: { name: 'Ann', tags: ['a', 'c'], addr: { zip: 1, city: 'X' } }, items: [{ id: 2, q: 3 }] };
  const p = byPath(cmp(l, r));
  check('NESTED', 'nested equal', p['user.name'].status === 'equal');
  check('NESTED', 'nested type change string → number',
    p['user.addr.zip'].status === 'changed' && p['user.addr.zip'].note === 'type');
  check('NESTED', 'nested right-only key', p['user.addr.city'].status === 'rightOnly');
  check('NESTED', 'array of scalars: changed element', p['user.tags[1]'] && p['user.tags[1]'].status === 'changed',
    Object.keys(p).join(', '));
  check('NESTED', 'array of records: removed record is left-only', p['items[0]'] && p['items[0]'].status === 'leftOnly',
    Object.keys(p).join(', '));
  check('NESTED', 'array of records: survivor compared field by field', p['items[1].q'] && p['items[1].q'].status === 'changed',
    Object.keys(p).join(', '));
  check('NESTED', 'column path collapses indices', p['items[1].q'].col === 'items[*].q');

  const e = byPath(cmp({ a: {}, b: [] }, { a: {}, b: [] }));
  check('NESTED', 'empty containers compare equal', e['a'].status === 'equal' && e['b'].status === 'equal');
  const t = byPath(cmp({ a: { x: 1 } }, { a: [1] }));
  check('NESTED', 'object vs array is a type change', t['a'].status === 'changed' && t['a'].note === 'type');
}
{
  // Keys needing quotes: spaces, dots, parentheses.
  const k = 'New Const. or New Addition (R-8)';
  const res = cmp({ [k]: 1 }, { [k]: 2 });
  const row = res.rows[0];
  check('PATH', 'odd key is quoted in the path', row.path === '[' + JSON.stringify(k) + ']', row.path);
  const lab = K.columns(cmp([{ id: 'a1', 'WI-x (y)': 1 }], [{ id: 'a1', 'WI-x (y)': 2 }]))[1].label;
  check('PATH', 'a top-level odd key is labelled bare', lab === 'WI-x (y)', lab);
  const segs = K.parsePath('a.b[3]["x.y z"].c[*]');
  check('PATH', 'parsePath', JSON.stringify(segs) === JSON.stringify(['a', 'b', 3, 'x.y z', 'c', '*']), JSON.stringify(segs));
}

// ---------------------------------------------------------------------------
// FILTER
// ---------------------------------------------------------------------------
{
  const [l, r] = driftedPair(true);
  const res = cmp([l], [r]);
  const c = K.counts(res.rows, false);
  check('FILTER', 'all', c.all === res.rows.length);
  check('FILTER', 'different values', c.valueDiff === 2, String(c.valueDiff));
  check('FILTER', 'different keys = left only + right only',
    c.keyDiff === 210 && c.leftOnly === 60 && c.rightOnly === 150, JSON.stringify(c));
  check('FILTER', 'matching keys = equal + changed', c.keysMatch === 6, String(c.keysMatch));
  check('FILTER', 'matching values', c.valuesMatch === 4, String(c.valuesMatch));
  const hit = res.rows.filter(x => K.matches(x, 'all', 'sacram', false));
  check('FILTER', 'search matches values', hit.length === 1 && hit[0].path === '[0].City');

  // Columns over many records.
  const L = [], R = [];
  for (let i = 0; i < 5; i++) {
    L.push({ id: 'r' + i, same: 1, diff: i, gone: 1, partial: 1 });
    const o = { id: 'r' + i, same: 1, diff: i === 2 ? 99 : i, added: 1 };
    if (i % 2) o.partial = 1;
    R.push(o);
  }
  const cols = K.columns(cmp(L, R));
  const col = {};
  for (const x of cols) col[x.label] = x;
  check('COLUMNS', 'root record index dropped from the label', !!col.same && !!col.id, cols.map(x => x.label).join(', '));
  check('COLUMNS', 'all-equal column', col.same.status === 'equal' && col.same.equal === 5);
  check('COLUMNS', 'column differing in one record', col.diff.status === 'changed' && col.diff.changed === 1);
  check('COLUMNS', 'representative row is the differing one', col.diff.first.right === 99);
  check('COLUMNS', 'left-only column', col.gone.status === 'leftOnly' && col.gone.leftOnly === 5);
  check('COLUMNS', 'right-only column', col.added.status === 'rightOnly');
  check('COLUMNS', 'partially present column', col.partial.status === 'mixed' && col.partial.leftOnly === 3);
  const cc = K.counts(cols, true);
  check('COLUMNS', 'filters on aggregates',
    cc.valuesMatch === 2 && cc.valueDiff === 1 && cc.keyDiff === 3 && cc.keysMatch === 3, JSON.stringify(cc));
}

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------
{
  const res = cmp({ a: 'x,y', b: null, c: { d: 1 } }, { a: 'x,y', b: 'NaN', e: '"q"' });
  const csv = K.toCSV(res.rows, false, { left: 'prod', right: 'test' });
  const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
  check('EXPORT', 'csv header names the panels', lines[0] === 'path,status,missing_on,prod_value,test_value,prod_record,test_record,note',
    lines[0]);
  check('EXPORT', 'csv quotes commas', lines.includes('a,match,,"x,y","x,y",,,'), lines.join(' | '));
  check('EXPORT', 'csv marks type change', lines.includes('b,different,,null,NaN,,,type null → string'), lines.join(' | '));
  check('EXPORT', 'csv names the missing side', lines.includes('c.d,only in left,right,1,,,,') ||
    lines.includes('c,only in left,right,"{""d"":1}",,,,'), lines.join(' | '));
  check('EXPORT', 'csv escapes quotes', lines.includes('e,only in right,left,,"""q""",,,'), lines.join(' | '));

  const json = JSON.parse(K.toJSON(res.rows, false, { filter: 'all' }));
  check('EXPORT', 'json keeps real values', json.rows.find(x => x.path === 'b').left === null &&
    json.rows.find(x => x.path === 'b').right === 'NaN');
  const miss = json.rows.find(x => x.path === 'e');
  check('EXPORT', 'json omits the missing side and names it', !('left' in miss) && miss.missingOn === 'left');
  check('EXPORT', 'json carries meta', json.filter === 'all');
}

// ---------------------------------------------------------------------------
// The real snapshot, when it is on disk (it is not committed): extract the zip
// and point KC_SNAPSHOT_DIR at it.
// ---------------------------------------------------------------------------
{
  const zip = process.env.KC_SNAPSHOT_DIR || path.join(__dirname, 'fixtures', 'snapshot-2026-10-28');
  const lf = path.join(zip, 'left-content.json'), rf = path.join(zip, 'right-content.json');
  if (fs.existsSync(lf) && fs.existsSync(rf)) {
    const l = fs.readFileSync(lf, 'utf8'), r = fs.readFileSync(rf, 'utf8');
    const t = A.align(l, r, {}).model.totals;
    check('SNAPSHOT', 'the reported pair is compared as one record', t.changed === 1, JSON.stringify(t));
    const res = cmp(JSON.parse(l), JSON.parse(r));
    check('SNAPSHOT', 'every key is accounted for', res.totals.leftOnly > 0 && res.totals.rightOnly > 0,
      JSON.stringify(res.totals));
  }
}

// ---------------------------------------------------------------------------
console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log('');
  process.exit(1);
}
