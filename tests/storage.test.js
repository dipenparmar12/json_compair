/*
 * Regression suite for the saved comparison (v6/utils/utils.js StorageManager).
 *
 *   LATEST  — startup restores the NEWER of the localStorage record and the
 *             IndexedDB one. A save that overflows localStorage goes to
 *             IndexedDB; reading localStorage alone brought back the older pair.
 *   RECORD  — what the restore card shows before loading: timestamp + meta.
 *
 * Run: node tests/storage.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

// Just enough of IndexedDB for loadSnapshotFromIDB: open → get(key).
function fakeIndexedDB(record) {
  return {
    open() {
      const req = {};
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              get() {
                const r = {};
                setTimeout(() => { r.result = record; r.onsuccess(); });
                return r;
              },
            }),
          }),
          close() {},
        };
        req.onsuccess();
      });
      return req;
    },
  };
}

function load(idbRecord) {
  const sandbox = { console, localStorage: makeStore(), indexedDB: fakeIndexedDB(idbRecord), setTimeout };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'v6', 'utils', 'utils.js'), 'utf8'), sandbox);
  return sandbox;
}

let pass = 0, fail = 0;
const failures = [];
function check(group, name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push(`${group} :: ${name}${detail ? '\n      ' + detail : ''}`);
}

const KEY = 'json_compare_data';
const DAY = 24 * 60 * 60 * 1000;

(async () => {
  {
    const s = load({ left: 'idb', right: 'idb', timestamp: Date.now() - 1000 });
    s.localStorage.setItem(KEY, JSON.stringify({ left: 'local', right: 'local', timestamp: Date.now() }));
    const r = await s.StorageManager.loadLatest();
    check('LATEST', 'localStorage newer → localStorage', r && r.left === 'local', JSON.stringify(r));
  }
  {
    const s = load({ left: 'idb', right: 'idb', timestamp: Date.now(), meta: { summary: 'x' } });
    s.localStorage.setItem(KEY, JSON.stringify({ left: 'old', right: 'old', timestamp: Date.now() - 60000 }));
    const r = await s.StorageManager.loadLatest();
    check('LATEST', 'IndexedDB newer (quota fallback) → IndexedDB', r && r.left === 'idb' && r.meta.summary === 'x',
      JSON.stringify(r));
  }
  {
    const s = load({ left: 'idb', right: '', timestamp: Date.now() });
    const r = await s.StorageManager.loadLatest();
    check('LATEST', 'only IndexedDB → IndexedDB', r && r.left === 'idb');
  }
  {
    const s = load({ left: 'idb', right: '', timestamp: Date.now() - 31 * DAY });
    const r = await s.StorageManager.loadLatest();
    check('LATEST', 'expired IndexedDB record is ignored', r === null, JSON.stringify(r));
  }
  {
    const s = load(null);
    const r = await s.StorageManager.loadLatest();
    check('LATEST', 'nothing saved → null', r === null);
  }
  {
    const s = load(null);
    s.StorageManager.saveToStorage('L', 'R', { summary: '2 changed of 5 items' });
    const r = s.StorageManager.loadFromStorage();
    check('RECORD', 'meta and timestamp round-trip', r && r.left === 'L' && r.meta.summary === '2 changed of 5 items' &&
      typeof r.timestamp === 'number', JSON.stringify(r));
  }
  {
    const s = load(null);
    s.localStorage.setItem(KEY, JSON.stringify({ left: 'L', right: 'R' }));
    const r = s.StorageManager.loadFromStorage();
    check('RECORD', 'a record without a timestamp is kept, not deleted', r && r.left === 'L' &&
      s.localStorage.getItem(KEY) !== null);
  }
  {
    const s = load(null);
    s.localStorage.setItem(KEY, '{not json');
    check('RECORD', 'a corrupt record reads as nothing saved', s.StorageManager.loadFromStorage() === null);
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log('  FAIL  ' + f);
    console.log('');
    process.exit(1);
  }
})();
