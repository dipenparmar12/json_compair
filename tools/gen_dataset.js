#!/usr/bin/env node
/**
 * Synthetic dataset generator for comparison testing. No dependencies.
 *
 * Writes a PAIR of files (<out>_a.<ext> and <out>_b.<ext>) row by row, so a
 * file of several hundred MB never sits in memory. Every value is a pure
 * function of (seed, row, column), which is what lets file B be derived
 * from file A without keeping A around. Field names and values are generic.
 *
 *   node tools/gen_dataset.js --format csv --size 100MB --cols 20 \
 *        --profile changed:5 --seed 1 --out tmp/bench100
 *
 * Options
 *   --format   csv | json | nested        (json = array of flat objects,
 *                                          nested = array of nested objects)
 *   --rows N   or  --size 50MB            (size is the target for file A)
 *   --cols N                              (default 12, includes "id")
 *   --seed N                              (default 1)
 *   --profile  identical | changed:N | schema | reordered | addremove[:N]
 *              | different | none         (default identical; none = A only)
 *       changed:N   N% of non-id values differ (0 1 5 10 25 50 75 100 ...)
 *       schema      B drops two columns, renames one, adds two
 *       reordered   same rows, different order
 *       addremove:N N% of rows only in A, N% extra rows only in B (default 10)
 *       different   no ids and no values in common
 *   --messy                               text holds commas, quotes, newlines
 *   --out PREFIX                          (default ./dataset)
 */
'use strict';
const fs = require('fs');

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
  'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec',
  'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu'];
const CATS = ['red', 'green', 'blue', 'amber', 'grey', 'white', 'black', 'teal'];
const TYPES = ['text', 'int', 'float', 'bool', 'date', 'cat', 'code'];
const DAY0 = Date.UTC(2020, 0, 1);

function hash(a, b, c) {
  let x = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA6B) ^ Math.imul(c | 0, 0xC2B2AE35)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function parseArgs(argv) {
  const o = { format: 'csv', cols: 12, seed: 1, profile: 'identical', out: 'dataset', messy: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (k === 'messy') { o.messy = true; continue; }
    if (k === 'help' || k === 'h') { o.help = true; continue; }
    o[k] = argv[++i];
  }
  o.cols = Math.max(2, parseInt(o.cols, 10));
  o.seed = parseInt(o.seed, 10) || 1;
  if (o.rows != null) o.rows = parseInt(o.rows, 10);
  if (o.size != null) {
    const m = /^([\d.]+)\s*(kb|mb|gb|b)?$/i.exec(String(o.size));
    if (!m) throw new Error('Bad --size: ' + o.size);
    o.size = Math.round(parseFloat(m[1]) * { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 }[(m[2] || 'b').toLowerCase()]);
  }
  const p = String(o.profile).split(':');
  o.kind = p[0];
  o.pct = p[1] != null ? parseFloat(p[1]) : (o.kind === 'addremove' ? 10 : 0);
  if (!['csv', 'json', 'nested'].includes(o.format)) throw new Error('Bad --format: ' + o.format);
  if (!['identical', 'changed', 'schema', 'reordered', 'addremove', 'different', 'none'].includes(o.kind)) {
    throw new Error('Bad --profile: ' + o.profile);
  }
  return o;
}

/** Column descriptors: `src` is the column number the value is hashed from. */
function columns(o, side) {
  const cols = [];
  for (let c = 1; c < o.cols; c++) {
    const type = TYPES[(c - 1) % TYPES.length];
    cols.push({ name: 'col_' + String(c).padStart(3, '0') + '_' + type, type, src: c });
  }
  if (side === 'b' && o.kind === 'schema') {
    cols.splice(Math.max(0, cols.length - 2), 2);                 // two columns gone
    if (cols.length > 1) cols[1] = Object.assign({}, cols[1], { name: cols[1].name + '_renamed' });
    cols.push({ name: 'extra_001_text', type: 'text', src: o.cols + 1 });
    cols.push({ name: 'extra_002_int', type: 'int', src: o.cols + 2 });
  }
  return cols;
}

function value(o, type, h) {
  switch (type) {
    case 'int': return h % 100000;
    case 'float': return (h % 1000000) / 100;
    case 'bool': return (h & 1) === 1;
    case 'date': return new Date(DAY0 + (h % 2000) * 86400000).toISOString().slice(0, 10);
    case 'cat': return CATS[h % CATS.length];
    case 'code': return 'X' + h.toString(36).toUpperCase().padStart(7, '0');
    default: {
      const t = WORDS[h % WORDS.length] + ' ' + WORDS[(h >>> 8) % WORDS.length];
      if (!o.messy) return t;
      switch ((h >>> 16) % 5) {
        case 0: return t.replace(' ', ', ');
        case 1: return '"' + t + '"';
        case 2: return t.replace(' ', '\n');
        case 3: return ' ' + t + '\t';
        default: return t;
      }
    }
  }
}

/** One cell. In file B a `changed:N` profile re-salts N% of the cells. */
function cell(o, side, row, col) {
  let seed = o.seed;
  if (side === 'b') {
    if (o.kind === 'different') seed = o.seed + 7919;
    else if (o.kind === 'changed' && (hash(o.seed + 101, row, col.src) % 10000) < o.pct * 100) seed = o.seed + 31;
  }
  return value(o, col.type, hash(seed, row, col.src));
}

function csvCell(v) {
  const s = String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function record(o, side, row, id, cols) {
  if (o.format === 'csv') {
    let line = String(id);
    for (let i = 0; i < cols.length; i++) line += ',' + csvCell(cell(o, side, row, cols[i]));
    return line;
  }
  const rec = { id };
  if (o.format === 'json') {
    for (let i = 0; i < cols.length; i++) rec[cols[i].name] = cell(o, side, row, cols[i]);
    return JSON.stringify(rec);
  }
  // nested: columns in groups of five, plus a small collection per record
  for (let i = 0; i < cols.length; i += 5) {
    const g = {};
    for (let j = i; j < Math.min(i + 5, cols.length); j++) g[cols[j].name] = cell(o, side, row, cols[j]);
    rec['group_' + (i / 5 + 1)] = g;
  }
  const n = 2 + hash(o.seed, row, 9001) % 3;
  rec.items = [];
  for (let k = 0; k < n; k++) {
    rec.items.push({
      item_id: id * 10 + k,
      label: cell(o, side, row, { type: 'text', src: 9100 + k }),
      qty: cell(o, side, row, { type: 'int', src: 9200 + k }) % 50,
      price: cell(o, side, row, { type: 'float', src: 9300 + k })
    });
  }
  rec.tags = [CATS[hash(o.seed, row, 9400) % CATS.length], CATS[hash(o.seed, row, 9401) % CATS.length]];
  return JSON.stringify(rec);
}

function gcd(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }

/** Yields {row, id} for one side, in that side's order. */
function* rowPlan(o, side) {
  const n = o.rows;
  if (side === 'a' || ['identical', 'changed', 'schema'].includes(o.kind)) {
    for (let i = 0; i < n; i++) yield { row: i, id: i + 1 };
  } else if (o.kind === 'different') {
    for (let i = 0; i < n; i++) yield { row: i, id: n + i + 1 };
  } else if (o.kind === 'reordered') {
    // i -> (i*step + offset) mod n is a permutation when gcd(step, n) = 1
    let step = Math.floor(n * 0.618) | 1;
    while (n > 1 && gcd(step, n) !== 1) step += 2;
    const offset = hash(o.seed, 1, 2) % n;
    for (let i = 0; i < n; i++) {
      const r = n > 1 ? Number((BigInt(i) * BigInt(step) + BigInt(offset)) % BigInt(n)) : 0;
      yield { row: r, id: r + 1 };
    }
  } else {   // addremove
    for (let i = 0; i < n; i++) {
      if (hash(o.seed + 7, i, 0) % 10000 >= o.pct * 100) yield { row: i, id: i + 1 };
      if (hash(o.seed + 8, i, 0) % 10000 < o.pct * 100) yield { row: n + i, id: n + i + 1 };
    }
  }
}

async function writeSide(o, side, file) {
  const cols = columns(o, side);
  const out = fs.createWriteStream(file);
  const json = o.format !== 'csv';
  let buf = json ? '[\n' : 'id,' + cols.map((c) => c.name).join(',') + '\n';
  let bytes = 0, count = 0, first = true;
  const flush = async () => {
    bytes += Buffer.byteLength(buf);
    if (!out.write(buf)) await new Promise((r) => out.once('drain', r));
    buf = '';
  };
  for (const p of rowPlan(o, side)) {
    const rec = record(o, side, p.row, p.id, cols);
    buf += json ? (first ? '' : ',\n') + rec : rec + '\n';
    first = false; count++;
    if (buf.length > 1048576) await flush();
  }
  if (json) buf += '\n]\n';
  await flush();
  await new Promise((r) => out.end(r));
  return { file, rows: count, bytes };
}

async function main() {
  const o = parseArgs(process.argv);
  if (o.help) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); return; }
  if (o.rows == null) {
    if (o.size == null) o.rows = 1000;
    else {
      const cols = columns(o, 'a');
      let sample = 0;
      for (let i = 0; i < 500; i++) sample += Buffer.byteLength(record(o, 'a', i, i + 1, cols)) + 2;
      o.rows = Math.max(1, Math.round(o.size / (sample / 500)));
    }
  }
  const ext = o.format === 'csv' ? 'csv' : 'json';
  const t0 = Date.now();
  const sides = o.kind === 'none' ? ['a'] : ['a', 'b'];
  for (const side of sides) {
    const r = await writeSide(o, side, `${o.out}_${side}.${ext}`);
    console.log(`${r.file}  ${r.rows.toLocaleString()} rows  ${(r.bytes / 1048576).toFixed(1)} MB`);
  }
  console.log(`profile ${o.profile}, ${o.cols} columns, seed ${o.seed}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { hash, columns, record, rowPlan, parseArgs };
