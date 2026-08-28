/*
 * Regression suite for v6/utils/json_repair.js
 *
 * Two corpora, both from docs/PRD/15-v6-audit-and-json-autofix-brd.md:
 *
 *   A. INTEGRITY  — valid data that must survive a lenient parse *unchanged*.
 *      This is the blocking one. The parser this replaces failed 7 of 10 here
 *      ("None provided" -> "null provided"), which for a diff tool is the worst
 *      possible failure: it can hide a real difference and invent a false one.
 *
 *   B. MALFORMED  — broken input that must either repair to valid JSON or fail
 *      loudly with a position. Never silently corrupt.
 *
 *   C. PERFORMANCE — the O(n*m) scan that froze the tab for 139 s.
 *   D. CLASSIFY    — the CSV sniff that replaced pasted prose with `[]`.
 *
 * Run: node tests/json_repair.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const V6 = path.join(__dirname, '..', 'v6', 'utils');

// Load the vendored UMD build and the kit into one shared global, the same way
// the browser does (plain <script> tags, global namespace).
const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(V6, 'vendor', 'jsonrepair.umd.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(V6, 'json_repair.js'), 'utf8'), sandbox);
const Kit = sandbox.JSONRepairKit;

let pass = 0, fail = 0;
const failures = [];

function check(group, name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push(`${group} :: ${name}${detail ? '\n      ' + detail : ''}`);
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------
// A. Data-integrity corpus — the blocking suite
//
// Each case is valid data with ONE unquoted key, so it cannot take the
// JSON.parse fast path and must go through the repair chain. The string value
// must come back byte-identical.
// ---------------------------------------------------------------------------
const INTEGRITY = [
  ['string contains True',    `{"name": "True Value Inc", x:1}`,      { name: 'True Value Inc', x: 1 }],
  ['string contains None',    `{"note": "None provided", x:1}`,       { note: 'None provided', x: 1 }],
  ['string contains False',   `{"m": "False alarm raised", x:1}`,     { m: 'False alarm raised', x: 1 }],
  ['double spaces in string', `{"t": "a  b   c", x:1}`,               { t: 'a  b   c', x: 1 }],
  ['escaped newline',         `{"t": "line1\\nline2", x:1}`,          { t: 'line1\nline2', x: 1 }],
  ['HTML in string',          `{"h": "<b>hi</b>", x:1}`,              { h: '<b>hi</b>', x: 1 }],
  ['parens in string',        `{"phone": "(555) 123-4567", x:1}`,     { phone: '(555) 123-4567', x: 1 }],
  ['braces in string',        `{"tpl": "{{name}}", x:1}`,             { tpl: '{{name}}', x: 1 }],
  ['tab in string',           `{"t": "a\\tb", x:1}`,                  { t: 'a\tb', x: 1 }],
  ['repr-like in string',     `{"d": "<User #12>", x:1}`,             { d: '<User #12>', x: 1 }],
  // Extra integrity probes beyond the BRD's ten.
  ['# inside string',         `{"c": "#ff0000", x:1}`,                { c: '#ff0000', x: 1 }],
  ['// inside string',        `{"u": "https://a.example/b", x:1}`,    { u: 'https://a.example/b', x: 1 }],
  ['/* inside string',        `{"g": "a /* not a comment */ b", x:1}`,{ g: 'a /* not a comment */ b', x: 1 }],
  ['colon inside string',     `{"s": "a: b, c: d", x:1}`,             { s: 'a: b, c: d', x: 1 }],
  ['datetime word in string', `{"s": "datetime.datetime(x)", x:1}`,   { s: 'datetime.datetime(x)', x: 1 }],
  ['comma+brace in string',   `{"s": "}, {", x:1}`,                   { s: '}, {', x: 1 }],
  ['unicode preserved',       `{"s": "café ☕ 日本", x:1}`,            { s: 'café ☕ 日本', x: 1 }],
  ['leading zeros as string', `{"z": "007", x:1}`,                    { z: '007', x: 1 }],
  ['deep nesting untouched',  `{"a": {"b": {"c": [1, 2, {"d": "e"}]}}, x:1}`,
                              { a: { b: { c: [1, 2, { d: 'e' }] } }, x: 1 }],
  ['key order preserved',     `{"z":1,"a":2,"m":3, x:1}`,             { z: 1, a: 2, m: 3, x: 1 }]
];

for (const [name, input, expected] of INTEGRITY) {
  const r = Kit.repair(input);
  if (!r.ok) { check('INTEGRITY', name, false, `repair failed: ${r.error && r.error.message}`); continue; }
  check('INTEGRITY', name, eq(r.value, expected),
    `got  ${JSON.stringify(r.value)}\n      want ${JSON.stringify(expected)}`);
}

// Key ORDER, not just key set — JSON.stringify comparison above already covers
// it, but state it explicitly since FR-5 calls it out.
{
  const r = Kit.repair(`{"z":1,"a":2,"m":3, x:1}`);
  check('INTEGRITY', 'key order is literal',
    r.ok && Object.keys(r.value).join(',') === 'z,a,m,x', `got ${r.ok && Object.keys(r.value)}`);
}

// Valid JSON must be returned byte-for-byte with changed:false.
{
  const src = '{\n  "a": 1,\n  "b": [1, 2, 3]\n}';
  const r = Kit.repair(src);
  check('INTEGRITY', 'valid JSON is untouched',
    r.ok && r.changed === false && r.text === src && r.engine === 'none');
}

// ---------------------------------------------------------------------------
// B. Malformed corpus — must repair, or fail with a position
// ---------------------------------------------------------------------------
const MALFORMED = [
  ['trailing comma object',   `{"a":1,}`,                          { a: 1 }],
  ['trailing comma array',    `[1,2,3,]`,                          [1, 2, 3]],
  ['single quotes',           `{'a': 'b'}`,                        { a: 'b' }],
  ['unquoted keys',           `{a: 1, b: 2}`,                      { a: 1, b: 2 }],
  ['line comment',            `{"a":1} // done`,                   { a: 1 }],
  ['block comment',           `{/* hi */ "a":1}`,                  { a: 1 }],
  ['hash comment',            `{\n # note\n "a":1\n}`,             { a: 1 }],
  ['missing closing brace',   `{"a":1`,                            { a: 1 }],
  ['missing closing bracket', `[1,2`,                              [1, 2]],
  ['missing comma',           `{"a":1 "b":2}`,                     { a: 1, b: 2 }],
  ['smart quotes',            `{“a”: “b”}`,    { a: 'b' }],
  ['NaN',                     `{"a": NaN}`,                        { a: null }],
  ['Infinity',                `{"a": Infinity}`,                   { a: null }],
  ['code fence',              '```json\n{"a":1}\n```',             { a: 1 }],
  ['JSONP wrapper',           `cb({"a":1})`,                       { a: 1 }],
  // NOT unwrapped: `"{\"a\":1}"` is a *valid* JSON document whose value happens
  // to be a string. Stage 0 must win — silently unwrapping valid JSON would
  // violate FR-5. Unescaping is an explicit text-cleanup action instead.
  ['escaped stringified stays a string', `"{\\"a\\":1}"`,          '{"a":1}'],
  ['ndjson',                  `{"a":1}\n{"a":2}`,                  [{ a: 1 }, { a: 2 }]],
  ['python True/False/None',  `{'a': True, 'b': False, 'c': None}`,{ a: true, b: false, c: null }],
  ['python tuple',            `{'a': (1, 2, 3)}`,                  { a: [1, 2, 3] }],
  ['python set',              `{'a': {1, 2, 3}}`,                  { a: [1, 2, 3] }],
  ['python empty dict',       `{'a': {}}`,                         { a: {} }],
  ['python nested dict',      `{'a': {'b': 1}}`,                   { a: { b: 1 } }],
  ['datetime.datetime',       `{'t': datetime.datetime(2025, 8, 21, 10, 37, 4, 895369)}`,
                              { t: '2025-08-21T10:37:04.895369' }],
  ['datetime.date',           `{'d': datetime.date(2025, 8, 3)}`,  { d: '2025-08-03' }],
  ['datetime no micro',       `{'t': datetime.datetime(2025, 8, 21, 10, 37, 4)}`,
                              { t: '2025-08-21T10:37:04' }],
  ['Decimal',                 `{'p': Decimal('19.99')}`,           { p: 19.99 }],
  ['UUID',                    `{'u': UUID('a-b-c')}`,              { u: 'a-b-c' }],
  ['bytes prefix',            `{'b': b'data'}`,                    { b: 'data' }],
  ['raw/unicode prefix',      `{'r': r'a\\b', 'u': u'x'}`,         { r: 'a\\b', u: 'x' }],
  ['object repr',             `{'o': <User #655715>}`,             { o: '<User #655715>' }],
  ['complex number',          `{'c': (1+2j)}`,                     { c: { real: 1, imag: 2 } }],
  ['apostrophe in py string', `{'a': 'it's fine', 'b': 1}`,        { a: "it's fine", b: 1 }],
  ['hex number',              `{"a": 0x1A}`,                       null],   // repaired somehow, or reported
  ['single-element set',      `{'s': {'x'}}`,                      { s: ['x'] }],
  ['mixed py + json',         `{"a": 1, 'b': True, c: None,}`,     { a: 1, b: true, c: null }]
];

for (const [name, input, expected] of MALFORMED) {
  const r = Kit.repair(input);
  if (expected === null) {
    // Only requirement: never silently corrupt. Either it repairs (any value),
    // or it reports an error with a position.
    check('MALFORMED', name,
      r.ok || (r.error && typeof r.error.line === 'number' && r.text === input),
      `neither repaired nor reported: ${JSON.stringify(r)}`);
    continue;
  }
  if (!r.ok) { check('MALFORMED', name, false, `not repaired: ${r.error && r.error.message}`); continue; }
  check('MALFORMED', name, eq(r.value, expected),
    `got  ${JSON.stringify(r.value)}\n      want ${JSON.stringify(expected)}`);
}

// Unrepairable input must leave the text alone and report a line/column.
for (const bad of ['{{{{', '}{', '[1,2,,,3]']) {
  const r = Kit.repair(bad);
  if (r.ok) continue;                             // repairing it is also fine
  check('MALFORMED', `reports position for ${JSON.stringify(bad)}`,
    r.text === bad && r.error && r.error.line >= 1 && r.error.col >= 1,
    JSON.stringify(r.error));
}

// jsonrepair will turn ANY text into valid JSON by quoting the whole thing.
// For a diff tool that is a lie, so a scalar result from input that never
// looked like JSON is rejected. (Wrapper calls still pass — they yield objects.)
for (const prose of ['not json at all', 'a b c d', 'Hello, world. This is a note.']) {
  const r = Kit.repair(prose);
  check('MALFORMED', `prose is not "repaired" into a string: ${JSON.stringify(prose.slice(0, 24))}`,
    !r.ok && r.text === prose, `got ${JSON.stringify(r.value)}`);
}

// parse() keeps the throwing contract the ~15 call sites in index.html rely on.
{
  let threw = false;
  try { Kit.parse('{{{{'); } catch (e) { threw = !!e.jsonError; }
  check('MALFORMED', 'parse() throws with jsonError', threw);
  check('MALFORMED', 'parse() returns value', eq(Kit.parse(`{'a': True}`), { a: true }));
  check('MALFORMED', 'parse() empty -> null', Kit.parse('   ') === null);
}

// ---------------------------------------------------------------------------
// C. Performance — the quadratic scan. BRD acceptance: 3.2 MB in under 3 s.
// ---------------------------------------------------------------------------
function pyRecords(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push(
      `{'id': ${i}, 'name': 'Item (${i}) alpha', 'ok': True, 'note': None, ` +
      `'created_on': datetime.datetime(2025, 8, 21, 10, 37, 4, ${100000 + i}), ` +
      `'price': Decimal('19.99'), 'tags': ('a', 'b')}`
    );
  }
  return '[' + rows.join(', ') + ']';
}

for (const [n, budgetMs] of [[1000, 500], [4000, 1500], [10000, 3000]]) {
  const src = pyRecords(n);
  const t0 = Date.now();
  const r = Kit.repair(src);
  const ms = Date.now() - t0;
  check('PERF', `${n} python records (${(src.length / 1048576).toFixed(1)} MB) repairs`, r.ok,
    r.error && r.error.message);
  check('PERF', `${n} python records under ${budgetMs} ms`, ms < budgetMs, `took ${ms} ms`);
  if (r.ok) {
    check('PERF', `${n} records: all rows survived`, r.value.length === n, `got ${r.value.length}`);
    check('PERF', `${n} records: paren string intact`,
      r.value[0].name === 'Item (0) alpha', `got ${JSON.stringify(r.value[0].name)}`);
  }
}

// Growth must be linear, not quadratic. The old parser went 12 -> 2407 ms
// across this range (a ~200x jump for an 16x input).
{
  const small = pyRecords(2000), big = pyRecords(8000);
  const t1 = Date.now(); Kit.repair(small); const msSmall = Math.max(1, Date.now() - t1);
  const t2 = Date.now(); Kit.repair(big);   const msBig = Date.now() - t2;
  const ratio = msBig / msSmall;
  check('PERF', '4x input costs well under 16x time (not quadratic)', ratio < 10,
    `${msSmall} ms -> ${msBig} ms = ${ratio.toFixed(1)}x`);
}

// ---------------------------------------------------------------------------
// D. Classification — "Hello, world." must not become `[]`
// ---------------------------------------------------------------------------
const CLASSIFY = [
  ['Hello, world. This is a note I pasted.',        'text'],
  ['SELECT id, name FROM users WHERE active = 1;',  'text'],
  ['Error: connection refused, retrying in 5s',     'text'],
  ['a,b,c\n1,2,3',                                  'csv'],
  ['a,b,c\n1,2,3\n4,5,6',                           'csv'],
  ['a\tb\tc\n1\t2\t3',                              'tsv'],
  ['{"a":1}',                                       'json'],
  ['{"a":1}\n{"a":2}',                              'ndjson'],
  [`{'a': True}`,                                   'jsonish'],
  ['<root><a>1</a></root>',                         'xml'],
  ['name: value\nother: thing',                     'yaml'],
  ['',                                              'empty'],
  ['one\ntwo\nthree',                               'text'],
  ['just one line no delimiters',                   'text']
];
for (const [input, expected] of CLASSIFY) {
  const got = Kit.detectKind(input);
  check('CLASSIFY', `${JSON.stringify(input.slice(0, 40))} -> ${expected}`, got === expected, `got ${got}`);
}

// csvEvidence must reject a single line however many commas it has.
check('CLASSIFY', 'single line is never CSV', !Kit.csvEvidence('a,b,c,d,e,f').ok);
check('CLASSIFY', 'inconsistent columns rejected', !Kit.csvEvidence('a,b\n1,2,3,4,5\nx').ok);

// ---------------------------------------------------------------------------
// E. Duplicate keys (§6.3) — legal JSON, silently lossy
// ---------------------------------------------------------------------------
{
  const dup = Kit.findDuplicateKeys('{"a":1, "b":2, "a":3}');
  check('DUPKEY', 'finds duplicate', dup.length === 1 && dup[0].key === 'a', JSON.stringify(dup));
  check('DUPKEY', 'no false positive across objects',
    Kit.findDuplicateKeys('{"o":{"a":1}, "p":{"a":2}}').length === 0);
  check('DUPKEY', 'ignores string values that look like keys',
    Kit.findDuplicateKeys('{"a":"b\\": 1", "c":2}').length === 0);
  check('DUPKEY', 'finds duplicate in nested object',
    Kit.findDuplicateKeys('{"o":{"x":1,"x":2}}').length === 1);
}

// ---------------------------------------------------------------------------
// F. Repair reporting — the preview needs countable categories
// ---------------------------------------------------------------------------
{
  const r = Kit.repair(`{'a': True, 'b': None, 'c': (1,2),}`);
  const keys = r.repairs.map(x => x.key);
  check('REPORT', 'reports single quotes', keys.includes('singleQuoted'));
  check('REPORT', 'reports python consts',  keys.includes('pyConst'));
  check('REPORT', 'reports tuples',         keys.includes('pyTuple'));
  check('REPORT', 'counts are numbers',     r.repairs.every(x => x.count > 0));
  check('REPORT', 'summary is a string',    typeof Kit.summarizeRepairs(r.repairs) === 'string');
}

// ---------------------------------------------------------------------------
console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log('');
  process.exit(1);
}
