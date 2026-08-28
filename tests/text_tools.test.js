/*
 * Regression suite for v6/utils/text_tools.js
 *
 *   CLEAN  — the invisible-character and whitespace actions. The blocking rule
 *            is that the default set never changes meaning, only presentation.
 *   SORT   — sorting must work on whatever the panel holds: JSON, NDJSON, CSV,
 *            a delimited list, or plain lines. Sort used to be JSON-only.
 *
 * Run: node tests/text_tools.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const V6 = path.join(__dirname, '..', 'v6', 'utils');

// text_tools leans on utils.js (parseSortSpec / sortJSONByFields / sortJSONKeys)
// and json_repair.js. utils.js expects a browser, so stub just enough of one.
const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.window = sandbox;
sandbox.document = { addEventListener() {}, getElementById: () => null, documentElement: { style: {} } };
sandbox.localStorage = {
  _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }
};
sandbox.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
sandbox.indexedDB = undefined;
vm.createContext(sandbox);

const run = (f) => vm.runInContext(fs.readFileSync(path.join(V6, f), 'utf8'), sandbox);
run('vendor/jsonrepair.umd.js');
run('json_repair.js');
try { run('utils.js'); } catch (e) { console.log('  (utils.js partial load: ' + e.message + ')'); }
run('text_tools.js');

const T = sandbox.TextTools;
if (!sandbox.parseSortSpec) throw new Error('utils.js did not expose parseSortSpec — sort tests would be meaningless');

let pass = 0, fail = 0;
const failures = [];
function check(group, name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push(`${group} :: ${name}${detail ? '\n      ' + detail : ''}`);
}

// ---------------------------------------------------------------------------
// CLEAN
// ---------------------------------------------------------------------------
{
  const ZW = '​', BOM = '﻿', NBSP = ' ';

  let r = T.clean(`a${ZW}b${BOM}c`);
  check('CLEAN', 'strips zero-width + BOM', r.text === 'abc', JSON.stringify(r.text));
  check('CLEAN', 'counts what it stripped',
    r.applied.some(a => a.key === 'zeroWidth' && a.count === 2), JSON.stringify(r.applied));

  r = T.clean(`a${NBSP}b`);
  check('CLEAN', 'normalizes NBSP', r.text === 'a b');

  r = T.clean('a  \nb\t\nc');
  check('CLEAN', 'trims trailing whitespace', r.text === 'a\nb\nc', JSON.stringify(r.text));

  r = T.clean('a\r\nb\rc');
  check('CLEAN', 'normalizes line endings', r.text === 'a\nb\nc', JSON.stringify(r.text));

  r = T.clean('a\n\n\n\n\nb');
  check('CLEAN', 'collapses 3+ blank lines', r.text === 'a\n\nb', JSON.stringify(r.text));

  r = T.clean('\n\n  a\nb\n\n  \n');
  check('CLEAN', 'trims the document', r.text === '  a\nb', JSON.stringify(r.text));

  r = T.clean('clean text');
  check('CLEAN', 'no-op reports unchanged', !r.changed && r.applied.length === 0);

  // The default set must never change meaning — a single blank line survives.
  r = T.clean('a\n\nb');
  check('CLEAN', 'single blank line is preserved', r.text === 'a\n\nb', JSON.stringify(r.text));

  // Opt-ins are off by default.
  r = T.clean('a\tb');
  check('CLEAN', 'tabs kept by default', r.text === 'a\tb');
  r = T.clean('a\tb', { tabsToSpaces: true, tabWidth: 4 });
  check('CLEAN', 'tabs->spaces on request', r.text === 'a    b', JSON.stringify(r.text));

  r = T.clean('a\nb\na\nc', { dedupeLines: true });
  check('CLEAN', 'dedupe keeps first occurrence', r.text === 'a\nb\nc', JSON.stringify(r.text));

  r = T.clean('“hi”', { smartQuotes: true });
  check('CLEAN', 'straightens smart quotes', r.text === '"hi"', JSON.stringify(r.text));

  r = T.clean('"{\\"a\\":1}"', { unescapeJson: true });
  check('CLEAN', 'unescapes stringified JSON', r.text === '{"a":1}', JSON.stringify(r.text));
  r = T.clean('"just a quoted sentence"', { unescapeJson: true });
  check('CLEAN', 'refuses to unescape non-JSON', r.text === '"just a quoted sentence"', JSON.stringify(r.text));

  // JSON content must survive the default clean byte-identically apart from
  // the whitespace it is explicitly allowed to touch.
  const json = '{\n  "a": 1,\n  "b": "x  y"\n}';
  r = T.clean(json);
  check('CLEAN', 'default clean leaves JSON parseable & equal',
    JSON.stringify(JSON.parse(r.text)) === JSON.stringify(JSON.parse(json)), JSON.stringify(r.text));
  check('CLEAN', 'default clean does not touch spaces inside strings',
    JSON.parse(r.text).b === 'x  y');

  check('CLEAN', 'summary is human readable', /Cleaned:/.test(T.summarizeClean(T.clean(`a${ZW}b`))));
}

// ---------------------------------------------------------------------------
// SORT — JSON
// ---------------------------------------------------------------------------
{
  const recs = JSON.stringify([
    { name: 'charlie', age: 30 }, { name: 'alice', age: 25 }, { name: 'bob', age: 35 }
  ]);

  let r = T.smartSort(recs, 'name ASC', {});
  check('SORT/json', 'array of objects by field',
    r.ok && JSON.parse(r.text).map(x => x.name).join(',') === 'alice,bob,charlie',
    r.error || r.text);

  r = T.smartSort(recs, 'age DESC', {});
  check('SORT/json', 'descending field',
    r.ok && JSON.parse(r.text).map(x => x.age).join(',') === '35,30,25', r.error || r.text);

  r = T.smartSort('[3, 1, 2]', '', {});
  check('SORT/json', 'array of numbers by value',
    r.ok && r.text.replace(/\s/g, '') === '[1,2,3]', r.error || r.text);

  r = T.smartSort('["b","a","c"]', '', {});
  check('SORT/json', 'array of strings by value',
    r.ok && JSON.parse(r.text).join(',') === 'a,b,c', r.error || r.text);

  r = T.smartSort('{"z":1,"a":2}', '', {});
  check('SORT/json', 'object sorts keys',
    r.ok && Object.keys(JSON.parse(r.text)).join(',') === 'a,z', r.error || r.text);

  r = T.smartSort('[2,1,2,3]', '', { unique: true });
  check('SORT/json', 'unique on values',
    r.ok && JSON.parse(r.text).join(',') === '1,2,3', r.error || r.text);

  // Natural order: a2 before a10.
  r = T.smartSort('["a10","a2","a1"]', '', {});
  check('SORT/json', 'natural numeric ordering',
    r.ok && JSON.parse(r.text).join(',') === 'a1,a2,a10', r.text);

  // Repairable input sorts too — this is what unlocks Sort for Python dumps.
  r = T.smartSort(`[{'n': 'b'}, {'n': 'a'}]`, 'n ASC', {});
  check('SORT/json', 'repairs before sorting',
    r.ok && JSON.parse(r.text).map(x => x.n).join(',') === 'a,b', r.error || r.text);

  // Asking for a field sort on an array of plain values must explain itself.
  r = T.smartSort('[3,1,2]', 'name ASC', {});
  check('SORT/json', 'field sort on scalars reports why not',
    !r.ok && /array of objects/.test(r.error), r.error);

  // Unparseable JSON reports a line, not a silent no-op.
  r = T.smartSort('{{{{', '', {});
  check('SORT/json', 'unparseable reports an error', !r.ok && /parse/i.test(r.error), r.error);
}

// ---------------------------------------------------------------------------
// SORT — NDJSON
// ---------------------------------------------------------------------------
{
  const nd = '{"id":3,"n":"c"}\n{"id":1,"n":"a"}\n{"id":2,"n":"b"}';
  const r = T.smartSort(nd, 'id ASC', {});
  check('SORT/ndjson', 'sorts records by field',
    r.ok && r.text.split('\n').map(l => JSON.parse(l).id).join(',') === '1,2,3', r.error || r.text);
  check('SORT/ndjson', 'stays one record per line', r.ok && r.text.split('\n').length === 3);
}

// ---------------------------------------------------------------------------
// SORT — CSV / TSV
// ---------------------------------------------------------------------------
{
  const csv = 'name,price\ncherry,30\napple,10\nbanana,20';

  let r = T.smartSort(csv, 'name ASC', {});
  check('SORT/csv', 'sorts by column name',
    r.ok && r.text === 'name,price\napple,10\nbanana,20\ncherry,30', r.error || JSON.stringify(r.text));
  check('SORT/csv', 'header stays first', r.ok && r.text.split('\n')[0] === 'name,price');

  r = T.smartSort(csv, 'price DESC', {});
  check('SORT/csv', 'numeric column sorts numerically',
    r.ok && r.text.split('\n').slice(1).map(l => l.split(',')[1]).join(',') === '30,20,10',
    r.error || JSON.stringify(r.text));

  r = T.smartSort(csv, '2 ASC', {});
  check('SORT/csv', 'column number works',
    r.ok && r.text.split('\n')[1] === 'apple,10', r.error || JSON.stringify(r.text));

  r = T.smartSort(csv, 'nope ASC', {});
  check('SORT/csv', 'unknown column lists the real ones',
    !r.ok && /No column "nope"/.test(r.error) && /name, price/.test(r.error), r.error);

  // 10 must sort after 9 numerically, not before it lexically.
  // (Two columns on purpose: a single column with no delimiter is not CSV, and
  // must not be guessed as CSV — that guess is exactly what F-03 was.)
  const nums = 'name,v\na,9\nb,10\nc,2';
  r = T.smartSort(nums, 'v ASC', {});
  check('SORT/csv', 'numbers are not sorted as text',
    r.ok && r.text === 'name,v\nc,2\na,9\nb,10', JSON.stringify(r.text));

  // Currency and thousands separators still compare numerically.
  const money = 'item,cost\na,"$1,200"\nb,$90\nc,$300';
  r = T.smartSort(money, 'cost ASC', {});
  check('SORT/csv', 'currency compares numerically',
    r.ok && r.text.split('\n').slice(1).map(l => l.split(',')[0]).join(',') === 'b,c,a',
    JSON.stringify(r.text));

  const tsv = 'a\tb\n2\ty\n1\tx';
  r = T.smartSort(tsv, 'a ASC', {});
  check('SORT/tsv', 'TSV sorts by column', r.ok && r.text === 'a\tb\n1\tx\n2\ty', JSON.stringify(r.text));

  // Quoted cells containing the delimiter must not be split.
  const quoted = 'name,note\nb,"x, y"\na,"p, q"';
  r = T.smartSort(quoted, 'name ASC', {});
  check('SORT/csv', 'quoted delimiters survive',
    r.ok && r.text === 'name,note\na,"p, q"\nb,"x, y"', JSON.stringify(r.text));
}

// ---------------------------------------------------------------------------
// SORT — plain text and inline lists
// ---------------------------------------------------------------------------
{
  let r = T.smartSort('charlie\nalice\nbob', '', {});
  check('SORT/text', 'sorts lines', r.ok && r.text === 'alice\nbob\ncharlie', JSON.stringify(r.text));

  r = T.smartSort('item10\nitem9\nitem1', '', {});
  check('SORT/text', 'natural order on lines',
    r.ok && r.text === 'item1\nitem9\nitem10', JSON.stringify(r.text));

  r = T.smartSort('b\na\nb\nc', '', { unique: true });
  check('SORT/text', 'unique lines', r.ok && r.text === 'a\nb\nc', JSON.stringify(r.text));

  r = T.smartSort('B\na\nC', '', { ignoreCase: true });
  check('SORT/text', 'case-insensitive', r.ok && r.text === 'a\nB\nC', JSON.stringify(r.text));

  r = T.smartSort('a\nb\nc', '', { descending: true });
  check('SORT/text', 'descending', r.ok && r.text === 'c\nb\na', JSON.stringify(r.text));

  // Column sort on whitespace-separated text (log lines).
  r = T.smartSort('x 30 p\ny 10 q\nz 20 r', '2 ASC', {});
  check('SORT/text', 'sorts by whitespace column',
    r.ok && r.text === 'y 10 q\nz 20 r\nx 30 p', JSON.stringify(r.text));

  r = T.smartSort('a\nb', 'name ASC', {});
  check('SORT/text', 'field name on text explains itself',
    !r.ok && /column number/.test(r.error), r.error);

  r = T.smartSort('banana, apple, cherry', '', {});
  check('SORT/list', 'sorts an inline list',
    r.ok && r.text === 'apple, banana, cherry', JSON.stringify(r.text));
  check('SORT/list', 'keeps the separator style', r.ok && r.text.indexOf(', ') > -1);

  r = T.smartSort('c;a;b', '', {});
  check('SORT/list', 'semicolon list', r.ok && r.text === 'a;b;c', JSON.stringify(r.text));

  // A single line with no delimiters is text, and there is nothing to reorder.
  r = T.smartSort('one line only', '', {});
  check('SORT/text', 'single line is a harmless no-op', r.ok && r.text === 'one line only', JSON.stringify(r));

  r = T.smartSort('', '', {});
  check('SORT', 'empty reports an error', !r.ok);
}

// ---------------------------------------------------------------------------
// describeSortTarget — drives the Sort panel's label and hint
// ---------------------------------------------------------------------------
{
  const cases = [
    ['[{"a":1},{"a":2}]',       'json-array-objects', true],
    ['[1,2,3]',                 'json-array-values',  false],
    ['{"a":1}',                 'json-object',        false],
    ['a,b\n1,2\n3,4',           'csv',                true],
    ['{"a":1}\n{"a":2}',        'ndjson',             true],
    ['line one\nline two',      'text',               true],
    ['a, b, c',                 'list',               false],
    ['',                        'empty',              false]
  ];
  for (const [input, kind, canField] of cases) {
    const d = T.describeSortTarget(input);
    check('DESCRIBE', `${JSON.stringify(input.slice(0, 24))} -> ${kind}`, d.kind === kind, `got ${d.kind}`);
    check('DESCRIBE', `${JSON.stringify(input.slice(0, 24))} canField=${canField}`, d.canField === canField);
  }
  const d = T.describeSortTarget('[{"name":1,"age":2}]');
  check('DESCRIBE', 'offers field names for completion',
    Array.isArray(d.fields) && d.fields.join(',') === 'name,age', JSON.stringify(d.fields));
}

// ---------------------------------------------------------------------------
// reverse
// ---------------------------------------------------------------------------
{
  let r = T.reverse('[1,2,3]');
  check('REVERSE', 'json array', r.ok && JSON.parse(r.text).join(',') === '3,2,1');
  r = T.reverse('a\nb\nc');
  check('REVERSE', 'text lines', r.ok && r.text === 'c\nb\na');
  r = T.reverse('h,x\n1,a\n2,b');
  check('REVERSE', 'csv keeps header', r.ok && r.text === 'h,x\n2,b\n1,a', JSON.stringify(r.text));
}

// ---------------------------------------------------------------------------
console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log('');
  process.exit(1);
}
