/*
 * Regression suite for v6/utils/diff_view.js
 *
 *   REGION   — MergeView chunks are grouped into blocks of differences: chunks
 *              a few unchanged lines apart are one block, only blocks of at
 *              least `minLines` are offered for folding, and each block knows
 *              whether it was removed, added or changed. Both panes fold from
 *              this one list, so a wrong grouping misaligns them.
 *   COVERAGE — a line is 'full' (whole line added / removed), 'part' (only a
 *              value changed) or untouched. The value-focused highlight styles
 *              rely on this to leave unchanged property names neutral.
 *
 * Run: node tests/diff_view.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'v6', 'utils', 'diff_view.js'), 'utf8'), sandbox);
const D = sandbox.DiffView;

let pass = 0, fail = 0;
const failures = [];
function check(group, name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  failures.push(`${group} :: ${name}${detail ? '\n      ' + detail : ''}`);
}

// Minimal stand-in for CodeMirror's Text.
function doc(lines) {
  const text = lines.join('\n');
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const line = (n) => {
    const from = starts[n - 1];
    const to = n < starts.length ? starts[n] - 1 : text.length;
    return { number: n, from, to, text: text.slice(from, to) };
  };
  return {
    length: text.length,
    lines: starts.length,
    line,
    lineAt(pos) {
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
      return line(lo + 1);
    },
  };
}
// A chunk covering lines [fa, ta] on A and [fb, tb] on B (1-based,
// inclusive); pass ta < fa for "empty on that side". Same shape as CM6's.
function chunk(dA, fa, ta, dB, fb, tb) {
  const span = (d, f, t) => {
    if (t < f) { const p = f <= d.lines ? d.line(f).from : d.length; return [p, p]; }
    return [d.line(f).from, d.line(t).to + 1];
  };
  const [fromA, toA] = span(dA, fa, ta), [fromB, toB] = span(dB, fb, tb);
  return { fromA, toA, fromB, toB, changes: [] };
}
const fill = (n, s) => Array.from({ length: n }, (_, i) => s + i);
const blank = (n) => Array.from({ length: n }, () => '');

// ---------------------------------------------------------------------------
// REGION
{
  // Row-aligned output: 100 removed lines on A opposite 100 gap rows on B.
  const A = doc([...fill(10, 'same'), ...fill(100, 'gone'), ...fill(10, 'tail')]);
  const B = doc([...fill(10, 'same'), ...blank(100), ...fill(10, 'tail')]);
  const r = D.changeRegions([chunk(A, 11, 110, B, 11, 110)], A, B, { minLines: 40 });
  check('REGION', 'a 100-line block is foldable', r.length === 1, JSON.stringify(r));
  check('REGION', 'left text opposite gap rows is "removed"', r[0] && r[0].kind === 'removed', r[0] && r[0].kind);
  check('REGION', 'both sides span the same lines', r[0] && r[0].a.first === 11 && r[0].b.last === 110,
    JSON.stringify(r[0]));
  check('REGION', 'label names count and kind', D.foldLabel(r[0], 99) === '99 removed lines hidden',
    D.foldLabel(r[0], 99));
}
{
  const A = doc([...fill(5, 'x'), ...fill(3, 'old'), ...fill(5, 'y')]);
  const B = doc([...fill(5, 'x'), ...fill(3, 'new'), ...fill(5, 'y')]);
  const r = D.changeRegions([chunk(A, 6, 8, B, 6, 8)], A, B, { minLines: 40 });
  check('REGION', 'a small change is never offered for folding', r.length === 0, JSON.stringify(r));
}
{
  // CM6's own diff (not row-aligned): 60 lines inserted, nothing on A.
  const A = doc([...fill(5, 'x'), ...fill(5, 'y')]);
  const B = doc([...fill(5, 'x'), ...fill(60, 'new'), ...fill(5, 'y')]);
  const r = D.changeRegions([chunk(A, 6, 5, B, 6, 65)], A, B, { minLines: 40 });
  check('REGION', 'an insertion empty on one side is "added"', r.length === 1 && r[0].kind === 'added',
    JSON.stringify(r));
  check('REGION', 'the empty side has no span to fold', r[0] && r[0].a === null && r[0].linesB === 60,
    JSON.stringify(r[0]));
}
{
  // 30 small changes, each 2 lines, separated by 2 unchanged lines: one block.
  const la = [], lb = [], chunks = [];
  for (let i = 0; i < 30; i++) {
    la.push('k' + i, 'k' + i); lb.push('k' + i, 'k' + i);
    la.push('a' + i, 'a' + i); lb.push('b' + i, 'b' + i);
  }
  const A = doc(la), B = doc(lb);
  for (let i = 0; i < 30; i++) { const s = i * 4 + 3; chunks.push(chunk(A, s, s + 1, B, s, s + 1)); }
  const r = D.changeRegions(chunks, A, B, { minLines: 40 });
  check('REGION', 'nearby small changes merge into one block', r.length === 1 && r[0].chunks === 30,
    JSON.stringify(r.map((x) => x.chunks)));
  check('REGION', 'a block with text on both sides is "changed"', r[0] && r[0].kind === 'changed');
}
{
  // Same 2-line changes but 20 unchanged lines apart: separate, and each small.
  const la = [], lb = [], chunks = [];
  for (let i = 0; i < 10; i++) {
    for (let k = 0; k < 20; k++) { la.push('s' + i + k); lb.push('s' + i + k); }
    la.push('a' + i, 'a' + i); lb.push('b' + i, 'b' + i);
  }
  const A = doc(la), B = doc(lb);
  for (let i = 0; i < 10; i++) { const s = i * 22 + 21; chunks.push(chunk(A, s, s + 1, B, s, s + 1)); }
  const r = D.changeRegions(chunks, A, B, { minLines: 40 });
  check('REGION', 'changes separated by real context stay separate', r.length === 0, JSON.stringify(r));
}
{
  // Gap of exactly MERGE_GAP merges; MERGE_GAP + 1 does not.
  const mk = (gap) => {
    const la = [...fill(30, 'a'), ...fill(gap, 'g'), ...fill(30, 'c')];
    const lb = [...fill(30, 'b'), ...fill(gap, 'g'), ...fill(30, 'd')];
    const A = doc(la), B = doc(lb);
    return D.changeRegions([chunk(A, 1, 30, B, 1, 30), chunk(A, 31 + gap, 60 + gap, B, 31 + gap, 60 + gap)],
      A, B, { minLines: 40 });
  };
  check('REGION', `a ${D.MERGE_GAP}-line gap joins two blocks`, mk(D.MERGE_GAP).length === 1);
  check('REGION', `a ${D.MERGE_GAP + 1}-line gap keeps them apart`, mk(D.MERGE_GAP + 1).length === 0);
}
{
  const A = doc(fill(50, 'a')), B = doc(fill(50, 'b'));
  const c = [chunk(A, 1, 50, B, 1, 50)];
  const k1 = D.changeRegions(c, A, B, { minLines: 40 })[0].key;
  const k2 = D.changeRegions(c, A, B, { minLines: 40 })[0].key;
  check('REGION', 'the same chunks give the same key (fold state survives a re-render)', k1 === k2);
  check('REGION', 'minLines is honoured', D.changeRegions(c, A, B, { minLines: 51 }).length === 0);
  check('REGION', 'no chunks, no regions', D.changeRegions([], A, B, {}).length === 0);
}

// ---------------------------------------------------------------------------
// COVERAGE
{
  const line = '    "price": 12,';
  check('COVERAGE', 'a changed value is a partial line',
    D.lineCoverage(line, [{ from: 14, to: 15 }]) === 'part');
  check('COVERAGE', 'a whole added line is full (indent ignored)',
    D.lineCoverage(line, [{ from: 4, to: line.length }]) === 'full');
  check('COVERAGE', 'several ranges that together cover the text are full',
    D.lineCoverage(line, [{ from: 4, to: 12 }, { from: 12, to: line.length }]) === 'full');
  check('COVERAGE', 'no ranges means untouched', D.lineCoverage(line, []) === null);
  check('COVERAGE', 'a deletion opposite (zero-width here) is partial',
    D.lineCoverage(line, [{ from: 15, to: 15 }]) === 'part');
}

// ---------------------------------------------------------------------------
console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log('  FAIL  ' + f);
  console.log('');
  process.exit(1);
}
