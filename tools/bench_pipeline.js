#!/usr/bin/env node
/**
 * Stage-by-stage timing of the pure comparison modules, in Node.
 *
 *   node --max-old-space-size=4096 tools/bench_pipeline.js --a x_a.csv --b x_b.csv [--lift]
 *
 * Runs the same code the browser runs (diff-worker.js csvToJSON, json_repair
 * detectKind, json_align prepareAsync + render) and prints one JSON line:
 * milliseconds per stage, heap after each stage, peak RSS, and the stage that
 * failed if one did. One pair per process, so peak memory belongs to that pair.
 *
 * --lift raises json_align's MAX_BYTES so the cost beyond the cap can be
 * measured; without it the run reports the cap as the failure.
 * Not measured here: CodeMirror, structured clone to/from the worker, the DOM.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i].replace(/^--/, '');
  if (k === 'lift') args.lift = true; else args[k] = process.argv[++i];
}
const V6 = path.join(__dirname, '..', 'v6', 'utils');
const sandbox = { console, MessageChannel, setTimeout, performance, postMessage() {}, addEventListener() {} };
sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
const load = (f, patch) => {
  let src = fs.readFileSync(path.join(V6, f), 'utf8');
  if (patch) src = patch(src);
  vm.runInContext(src, sandbox, { filename: f });
};
load('json_repair.js');
load('json_align.js', (s) => args.lift ? s.replace('var MAX_BYTES = 64000000;', 'var MAX_BYTES = 1e12;') : s);
load('diff-worker.js', (s) => s + '\nself.__csvToJSON = csvToJSON;');

const out = { a: path.basename(args.a), lift: !!args.lift, ms: {}, heapMB: {}, sizeMB: {} };
const mb = (n) => Math.round(n / 1048576 * 10) / 10;
let stage = 'start';
async function time(name, fn) {
  stage = name;
  const t = performance.now();
  const r = await fn();
  out.ms[name] = Math.round(performance.now() - t);
  out.heapMB[name] = mb(process.memoryUsage().heapUsed);
  return r;
}

(async () => {
  let A = await time('read', () => [fs.readFileSync(args.a, 'utf8'), fs.readFileSync(args.b, 'utf8')]);
  out.sizeMB.input = mb(A[0].length + A[1].length);
  const kind = await time('detect', () => sandbox.JSONRepairKit.detectKind(A[0]));
  out.kind = kind;
  let L = A[0], R = A[1];
  if (kind === 'csv' || kind === 'tsv') {
    const rows = await time('csvParse', () => A.map((t) => sandbox.__csvToJSON(t, { coerceTypes: true }).data));
    out.rows = rows[0].length;
    A = null;
    const json = await time('csvStringify', () => rows.map((d) => JSON.stringify(d, null, 3)));
    L = json[0]; R = json[1];
  }
  out.sizeMB.json = mb(L.length + R.length);
  await time('jsonParse', () => { JSON.parse(L); JSON.parse(R); });
  const marks = [];
  const ctl = { signal: { cancelled: false }, onPhase(key) { marks.push([key, performance.now()]); return { onProgress() {} }; } };
  const t0 = performance.now();
  const h = await time('prepare', () => sandbox.JSONAlign.prepareAsync(L, R, {}, ctl));
  marks.push(['end', performance.now()]);
  for (let i = 0; i < marks.length - 1; i++) out.ms['prepare.' + marks[i][0]] = Math.round(marks[i + 1][1] - marks[i][1]);
  if (!h || !h.ok) { out.failed = 'prepare'; out.why = (h && h.reason) || 'json_align returned ok:false (MAX_BYTES 64 MB combined, or not parseable)'; return; }
  const t = h.model.totals || {};
  out.model = { items: h.model.items.length, strategy: h.model.strategy, idKey: h.model.idKey, totals: t };
  const r = await time('renderWindow', () => h.render({ from: 0, view: 'auto' }));
  out.sizeMB.rendered = mb(r.left.length + r.right.length);
  out.renderedItems = r.stats && r.stats.window ? r.stats.window.size : undefined;
  await time('render10Pages', () => { for (let i = 1; i <= 10; i++) h.render({ from: i * 50, view: 'auto' }); });
})().catch((e) => { out.failed = stage; out.why = String(e && e.message || e).slice(0, 200); })
  .finally(() => {
    out.peakRssMB = Math.round(process.resourceUsage().maxRSS / 1024);
    console.log(JSON.stringify(out));
    process.exit(0);   // json_align's MessageChannel would keep the process alive
  });
