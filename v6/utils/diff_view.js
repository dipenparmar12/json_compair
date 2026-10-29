/*
 * diff_view.js — presentation decisions for the v6 diff, kept pure so they can
 * be tested without CodeMirror. Exposed as window.DiffView.
 *
 *   changeRegions(chunks, docA, docB, {minLines})
 *       Groups MergeView chunks into "blocks of differences" and says which are
 *       large enough to fold. Both panes fold from the SAME list, which is what
 *       keeps them aligned.
 *
 * `doc` is anything with CodeMirror's Text shape: length, lines, lineAt(pos),
 * line(n) → {number, from, to, text}.
 */
(function (root) {
  'use strict';

  // Chunks separated by this many unchanged lines or fewer are one block.
  // Collapse Unchanged never folds a run this short (it keeps 3 lines of
  // margin either side and needs 4 more), so the two kinds of fold can never
  // claim the same line.
  const MERGE_GAP = 4;
  const DEFAULT_MIN_LINES = 40;

  // Lines a [from, to) chunk range covers on one side, or null when the
  // chunk is empty there (pure insertion on the other side).
  function lineSpan(doc, from, to) {
    if (from >= to) return null;
    const last = Math.min(doc.length, Math.max(from, to - 1));
    return { first: doc.lineAt(from).number, last: doc.lineAt(last).number };
  }

  function hasText(doc, span) {
    if (!span) return false;
    for (let n = span.first; n <= span.last; n++) {
      if (/\S/.test(doc.line(n).text)) return true;
    }
    return false;
  }

  // 'removed' when only the left side has text (the right holds gap rows or
  // nothing), 'added' for the reverse, otherwise 'changed'.
  function kindOf(docA, docB, a, b) {
    const ta = hasText(docA, a), tb = hasText(docB, b);
    if (ta && !tb) return 'removed';
    if (tb && !ta) return 'added';
    return 'changed';
  }

  function changeRegions(chunks, docA, docB, opts) {
    const minLines = Math.max(2, (opts && opts.minLines) || DEFAULT_MIN_LINES);
    const out = [];
    if (!chunks || !chunks.length) return out;

    // Unchanged text is identical on both sides, so the gap between two
    // chunks has the same number of lines in either document; measure it on A.
    const gapLines = (prev, next) =>
      docA.lineAt(Math.min(docA.length, next.fromA)).number -
      docA.lineAt(Math.min(docA.length, prev.toA)).number;

    let start = 0;
    for (let i = 1; i <= chunks.length; i++) {
      if (i < chunks.length && gapLines(chunks[i - 1], chunks[i]) <= MERGE_GAP) continue;
      const first = chunks[start], last = chunks[i - 1];
      const a = lineSpan(docA, first.fromA, last.toA);
      const b = lineSpan(docB, first.fromB, last.toB);
      const linesA = a ? a.last - a.first + 1 : 0;
      const linesB = b ? b.last - b.first + 1 : 0;
      if (Math.max(linesA, linesB) >= minLines) {
        out.push({
          key: first.fromA + ':' + first.fromB + ':' + last.toA + ':' + last.toB,
          a, b, linesA, linesB,
          chunks: i - start,
          kind: kindOf(docA, docB, a, b),
        });
      }
      start = i;
    }
    return out;
  }

  // Short, plain summary for a folded block: "1,249 removed lines hidden".
  function foldLabel(region, hidden) {
    const n = hidden.toLocaleString('en-US');
    const what = region.kind === 'changed' ? 'changed' : region.kind;
    return n + ' ' + what + (hidden === 1 ? ' line' : ' lines') + ' hidden';
  }

  root.DiffView = { changeRegions, foldLabel, MERGE_GAP, DEFAULT_MIN_LINES };
})(typeof window !== 'undefined' ? window : globalThis);
