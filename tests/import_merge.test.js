/*
 * Regression suite for Import → Merge (mergeJSONValues in v6/utils/utils.js).
 *
 *   MERGE — objects merge key by key, recursively; the imported value wins;
 *           arrays and mismatched kinds are replaced whole; nothing is dropped.
 *
 * Run: node tests/import_merge.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = new Map();
const sandbox = {
  console,
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  location: { search: '', href: 'http://x/', origin: 'http://x', pathname: '/' },
  history: { replaceState() {} },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'v6', 'utils', 'utils.js'), 'utf8'), sandbox);
const merge = sandbox.mergeJSONValues;

let pass = 0, fail = 0;
const failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  failures.push(`${name}\n      got  ${g}\n      want ${w}`);
}

check('existing keys the import lacks are kept', merge({ a: 1, b: 2 }, { b: 3 }), { a: 1, b: 3 });
check('new keys are added', merge({ a: 1 }, { c: [1] }), { a: 1, c: [1] });
check('nested objects merge recursively',
  merge({ n: { x: 1, y: { p: 1, q: 2 } } }, { n: { y: { q: 9, r: 3 }, z: 0 } }),
  { n: { x: 1, y: { p: 1, q: 9, r: 3 }, z: 0 } });
check('arrays are replaced whole', merge({ a: [1, 2, 3], k: 1 }, { a: [9] }), { a: [9], k: 1 });
check('arrays of objects are replaced, not merged', merge({ a: [{ id: 1, v: 1 }] }, { a: [{ id: 1 }] }), { a: [{ id: 1 }] });
check('object replaced by a primitive', merge({ a: { x: 1 } }, { a: 5 }), { a: 5 });
check('primitive replaced by an object', merge({ a: 5 }, { a: { x: 1 } }), { a: { x: 1 } });
check('array replaced by an object', merge({ a: [1] }, { a: { x: 1 } }), { a: { x: 1 } });
check('imported null wins', merge({ a: { x: 1 }, b: 1 }, { a: null }), { a: null, b: 1 });
check('existing null is replaced', merge({ a: null }, { a: { x: 1 } }), { a: { x: 1 } });
check('empty object adds nothing and removes nothing', merge({ a: { x: 1 } }, { a: {} }), { a: { x: 1 } });
check('empty array, false, 0 and "" are real values',
  merge({ a: [1], b: true, c: 7, d: 'x' }, { a: [], b: false, c: 0, d: '' }), { a: [], b: false, c: 0, d: '' });
check('root array is replaced', merge([1, 2], [3]), [3]);
check('root kinds differ → imported', merge({ a: 1 }, [1]), [1]);
{
  const a = { n: { x: 1 } }, b = { n: { y: 2 } };
  merge(a, b);
  check('inputs are not changed', [a, b], [{ n: { x: 1 } }, { n: { y: 2 } }]);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log('');
  process.exit(1);
}
