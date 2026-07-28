/* ====================================================================
   json_align.js — structural (block-level) alignment for JSON diffing
   --------------------------------------------------------------------
   Problem: CodeMirror's MergeView runs a character/line diff and won't
   accept a custom diff. On arrays of objects it greedily matches shared
   boilerplate ({, },, "id": ) ACROSS object boundaries, so a removed
   item shows as stray half-matched lines instead of one clean block.

   Approach (no engine replacement): re-serialize BOTH sides to pretty
   JSON, but insert blank "gap" lines on the side that is missing an
   array element / object key so that matching content lands on matching
   lines. Blank lines are insignificant JSON whitespace, so the result
   still parses to the exact same value — the editors keep holding valid
   JSON and every existing reader keeps working. MergeView then diffs an
   already-aligned document, which renders as clean whole-block adds /
   removes (the way Proxyman shows them).

   Ignore support: an optional `ignore(key, aVal, bVal)` predicate can mark
   properties whose values should be treated as IDENTICAL (e.g. db
   created/updated columns). For a matched property present on both sides,
   the LEFT ("a") value is emitted on BOTH sides so MergeView sees no change
   — the record collapses, is not counted, and shows no red/green. `changed`
   in the result reports whether any such normalization actually altered a
   value (used by the caller to snapshot the pre-normalized originals).

   Numeric tolerance: an optional `numTol` (a positive number) makes two
   numbers count as equal when |a - b| <= numTol — same normalization trick
   (emit the LEFT value on both sides), so tiny floating-point differences
   collapse, aren't counted, and show no red/green. Applies everywhere numbers
   are compared (object props, array elements, nested), and near-equal array
   items still align via the tolerance-aware LCS. `changed` covers this too.

   Pure + dependency-free. Exposes window.JSONAlign.
   ==================================================================== */
(function () {
  'use strict';

  var INDENT = '  ';
  // Skip alignment above this combined size. Kept generous on purpose: for large
  // arrays the O(n·m) element LCS is skipped (see MAX_LCS_CELLS) so align falls
  // back to positional pairing — O(n) parse + serialize, ~0.4s for ~15MB — which
  // is the difference between a clean, collapsible diff and CM6 choking on a
  // ~98%-"changed" raw text diff (e.g. CSV-derived JSON whose only real
  // difference is key order). See the "Performance" notes in CLAUDE.md.
  var MAX_BYTES = 24000000;    // ~24MB combined
  var MAX_LCS_CELLS = 1000000; // skip element LCS for very large arrays (-> positional pairing)
  var PAIR_KEY_RATIO = 0.5;    // min shared-key ratio to treat two objects as "the same item changed"
  // Above either threshold, a top-level array is aligned in COMPACT mode: each
  // element on ONE line instead of pretty-printed across many. Pretty-printing an
  // array of a few thousand objects explodes into hundreds of thousands of lines,
  // which CM6's line-diff cannot resolve (it falls back to one crude "everything
  // changed" block, or freezes at a high scanLimit). One line per record keeps the
  // line count ≈ the record count, so CM6 diffs it instantly and still shows the
  // changed fields via character-level highlighting. See CLAUDE.md Performance.
  var COMPACT_MIN_BYTES = 1000000; // ~1MB combined input, or…
  var COMPACT_MIN_ELEMENTS = 1000; // …this many top-level array elements → compact

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  // Structural equality with an OPTIONAL numeric tolerance `tol` (null = exact).
  // Returns a kind so callers can tell a genuine match from a tolerated one:
  //   0 = not equal
  //   1 = exactly equal
  //   2 = equal ONLY because tolerance bridged a numeric difference
  // Kind 2 matters because emitting one side's value on both is then a real
  // normalization — the caller flips ctx.changed and snapshots the originals
  // (just like the ignore path) so storage/export keep the true values.
  function eqKind(a, b, tol) {
    if (a === b) return 1;
    var ta = typeof a, tb = typeof b;
    if (ta === 'number' && tb === 'number') {
      if (tol != null && isFinite(a) && isFinite(b) && Math.abs(a - b) <= tol) return 2;
      return 0; // a === b already ruled out above
    }
    if (ta !== tb) return 0;
    if (a === null || b === null) return 0;
    if (ta !== 'object') return 0; // unequal primitives (string/boolean)
    var aArr = Array.isArray(a), bArr = Array.isArray(b);
    if (aArr !== bArr) return 0;
    var viaTol = false, r, i, k, key, ak, bk;
    if (aArr) {
      if (a.length !== b.length) return 0;
      for (i = 0; i < a.length; i++) {
        r = eqKind(a[i], b[i], tol);
        if (r === 0) return 0;
        if (r === 2) viaTol = true;
      }
      return viaTol ? 2 : 1;
    }
    ak = Object.keys(a); bk = Object.keys(b);
    if (ak.length !== bk.length) return 0;
    for (k = 0; k < ak.length; k++) {
      key = ak[k];
      if (!Object.prototype.hasOwnProperty.call(b, key)) return 0;
      r = eqKind(a[key], b[key], tol);
      if (r === 0) return 0;
      if (r === 2) viaTol = true;
    }
    return viaTol ? 2 : 1;
  }

  // Exact structural equality (tolerance off) — used by the ignore path's
  // "did normalization actually change a value?" checks.
  function deepEqual(a, b) {
    return eqKind(a, b, null) !== 0;
  }

  // Serialize a value to lines matching JSON.stringify(v, null, 2), each
  // prefixed by `pad`. No trailing comma.
  function ser(v, pad) {
    if (!v || typeof v !== 'object') return [pad + JSON.stringify(v)];
    var out, i, sub, l;
    if (Array.isArray(v)) {
      if (v.length === 0) return [pad + '[]'];
      out = [pad + '['];
      for (i = 0; i < v.length; i++) {
        sub = ser(v[i], pad + INDENT);
        if (i < v.length - 1) sub[sub.length - 1] += ',';
        for (l = 0; l < sub.length; l++) out.push(sub[l]);
      }
      out.push(pad + ']');
      return out;
    }
    var keys = Object.keys(v);
    if (keys.length === 0) return [pad + '{}'];
    out = [pad + '{'];
    for (i = 0; i < keys.length; i++) {
      sub = ser(v[keys[i]], pad + INDENT);
      sub[0] = keyPrefix(sub[0], pad + INDENT, keys[i]);
      if (i < keys.length - 1) sub[sub.length - 1] += ',';
      for (l = 0; l < sub.length; l++) out.push(sub[l]);
    }
    out.push(pad + '}');
    return out;
  }

  // Serialize `v`, but substitute the counterpart (`cp`, the "a"/left) value
  // for any object property that `ignore` marks — so ignored props render
  // identically on both sides. Used by normalize() (no gap-padding path).
  function serWithSwap(v, cp, ctx, pad) {
    // Numeric tolerance: when b's value (v) is within tolerance of a's value
    // (cp) across this WHOLE subtree, emit a's value on both sides so MergeView
    // sees no change. Partial matches (some field differs beyond tolerance) fall
    // through and are resolved per-property/element by the recursion below.
    if (ctx.numTol != null && cp !== undefined && eqKind(v, cp, ctx.numTol) === 2) {
      ctx.changed = true;
      return ser(cp, pad);
    }
    if (!v || typeof v !== 'object') return [pad + JSON.stringify(v)];
    var out, i, l, sub;
    if (Array.isArray(v)) {
      if (v.length === 0) return [pad + '[]'];
      out = [pad + '['];
      for (i = 0; i < v.length; i++) {
        var cpi = Array.isArray(cp) ? cp[i] : undefined;
        sub = serWithSwap(v[i], cpi, ctx, pad + INDENT);
        if (i < v.length - 1) sub[sub.length - 1] += ',';
        for (l = 0; l < sub.length; l++) out.push(sub[l]);
      }
      out.push(pad + ']');
      return out;
    }
    var keys = Object.keys(v), child = pad + INDENT;
    if (keys.length === 0) return [pad + '{}'];
    out = [pad + '{'];
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      var cpHas = isPlainObject(cp) && Object.prototype.hasOwnProperty.call(cp, k);
      if (cpHas && ctx.ignore && ctx.ignore(k, cp[k], v[k])) {
        if (!deepEqual(cp[k], v[k])) ctx.changed = true;
        sub = ser(cp[k], child);                          // emit the "a" value
      } else {
        sub = serWithSwap(v[k], cpHas ? cp[k] : undefined, ctx, child);
      }
      sub[0] = keyPrefix(sub[0], child, k);
      if (i < keys.length - 1) sub[sub.length - 1] += ',';
      for (l = 0; l < sub.length; l++) out.push(sub[l]);
    }
    out.push(pad + '}');
    return out;
  }

  function keyPrefix(firstLine, childPad, key) {
    return childPad + JSON.stringify(key) + ': ' + firstLine.slice(childPad.length);
  }

  function blanks(n) {
    var a = []; for (var i = 0; i < n; i++) a.push(''); return a;
  }

  // Append a trailing comma to the last non-blank line.
  function addComma(arr) {
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] !== '') { arr[i] += ','; return; }
    }
  }

  // Heuristic: are two values "the same item, modified" (→ align internals)
  // vs unrelated (→ show as separate remove + add)?
  function shouldPair(x, y) {
    var xObj = isPlainObject(x), yObj = isPlainObject(y);
    if (xObj && yObj) {
      var xk = Object.keys(x), yk = Object.keys(y);
      if (xk.length === 0 || yk.length === 0) return true;
      var ySet = {}; for (var i = 0; i < yk.length; i++) ySet[yk[i]] = true;
      var shared = 0;
      for (var j = 0; j < xk.length; j++) if (ySet[xk[j]]) shared++;
      return shared / Math.max(xk.length, yk.length) >= PAIR_KEY_RATIO;
    }
    if (Array.isArray(x) && Array.isArray(y)) return true;
    // primitives / type-mismatch: pairing just renders old → new on a line
    return !xObj && !yObj && !Array.isArray(x) && !Array.isArray(y);
  }

  // Align two values into equal-length line arrays { A, B }. `ctx` carries the
  // ignore predicate + a `changed` flag.
  function alignValue(a, b, pad, ctx) {
    var kind = eqKind(a, b, ctx.numTol);
    if (kind !== 0) {
      // Tolerated (kind 2) → emitting a's value on both sides is a real
      // normalization; flag it so the caller snapshots the originals.
      if (kind === 2) ctx.changed = true;
      var same = ser(a, pad);
      return { A: same.slice(), B: same.slice() };
    }
    if (Array.isArray(a) && Array.isArray(b)) return alignArray(a, b, pad, ctx);
    if (isPlainObject(a) && isPlainObject(b)) return alignObject(a, b, pad, ctx);
    return padToEqual(ser(a, pad), ser(b, pad));
  }

  function padToEqual(A, B) {
    while (A.length < B.length) A.push('');
    while (B.length < A.length) B.push('');
    return { A: A, B: B };
  }

  // Walk the element matches of arrays a,b (LCS where affordable, else positional)
  // and call emit(i,j) for each output position: (i,j) a paired/positional match,
  // (i,null) an a-only element, (null,j) a b-only element. Shared by the pretty
  // (alignArray) and compact (alignArrayOneLine) emitters.
  function walkArrayMatches(a, b, tol, emit) {
    var n = a.length, m = b.length;
    var matches = (n === 0 || m === 0 || n * m > MAX_LCS_CELLS) ? [] : lcsMatches(a, b, tol);
    var anchors = matches.concat([[n, m]]);
    var ai = 0, bj = 0;
    for (var t = 0; t < anchors.length; t++) {
      var ti = anchors[t][0], tj = anchors[t][1];
      // unmatched block before this anchor: pair positionally
      var dels = [], inss = [], i, j;
      for (i = ai; i < ti; i++) dels.push(i);
      for (j = bj; j < tj; j++) inss.push(j);
      var len = Math.max(dels.length, inss.length);
      for (var k = 0; k < len; k++) {
        var di = k < dels.length ? dels[k] : null;
        var ij = k < inss.length ? inss[k] : null;
        if (di !== null && ij !== null && !shouldPair(a[di], b[ij])) {
          emit(di, null);
          emit(null, ij);
        } else {
          emit(di, ij);
        }
      }
      if (ti < n && tj < m) { emit(ti, tj); ai = ti + 1; bj = tj + 1; }
      else { ai = ti; bj = tj; }
    }
  }

  function alignArray(a, b, pad, ctx) {
    var child = pad + INDENT;
    var n = a.length, m = b.length;
    var A = [pad + '['], B = [pad + '['];

    function pushBoth(la, lb) {
      var i;
      for (i = 0; i < la.length; i++) A.push(la[i]);
      for (i = 0; i < lb.length; i++) B.push(lb[i]);
    }
    function emit(i, j) {
      var commaA = i !== null && i < n - 1;
      var commaB = j !== null && j < m - 1;
      var sub;
      if (i !== null && j !== null) {
        var al = alignValue(a[i], b[j], child, ctx);
        if (commaA) addComma(al.A);
        if (commaB) addComma(al.B);
        pushBoth(al.A, al.B);
      } else if (i !== null) {
        sub = ser(a[i], child); if (commaA) addComma(sub);
        pushBoth(sub, blanks(sub.length));
      } else {
        sub = ser(b[j], child); if (commaB) addComma(sub);
        pushBoth(blanks(sub.length), sub);
      }
    }

    walkArrayMatches(a, b, ctx.numTol, emit);
    A.push(pad + ']'); B.push(pad + ']');
    return { A: A, B: B };
  }

  // Canonical key order for a record = a's keys, then any b-only keys. Applied to
  // BOTH sides so two equal records serialize to byte-identical lines (which CM6
  // then collapses); changed records differ only where a field actually differs.
  function mergeKeyOrder(o1, o2) {
    var order = [], seen = Object.create(null), k;
    for (k in o1) if (Object.prototype.hasOwnProperty.call(o1, k) && !seen[k]) { seen[k] = 1; order.push(k); }
    for (k in o2) if (Object.prototype.hasOwnProperty.call(o2, k) && !seen[k]) { seen[k] = 1; order.push(k); }
    return order;
  }

  var hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  // Compact line for a single added/removed record. Ignored keys are dropped so
  // noisy columns don't clutter add/remove blocks either.
  function compactSingle(obj, ctx) {
    if (!isPlainObject(obj)) return JSON.stringify(obj);
    var parts = [], keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (ctx && ctx.ignore && ctx.ignore(k, obj[k], undefined)) continue;
      parts.push(JSON.stringify(k) + ':' + JSON.stringify(obj[k]));
    }
    return '{' + parts.join(',') + '}';
  }

  // Build the two compact lines for a matched record pair, keys in canonical
  // order. Ignored keys are DROPPED from BOTH sides (so a noisy column — even one
  // present on only one side, like a db `created_on` — never shows as a diff);
  // near-equal numbers emit a's value on both. Equal records → identical lines.
  function compactPair(ra, rb, ctx, out) {
    var order = mergeKeyOrder(ra, rb), laP = [], lbP = [];
    for (var idx = 0; idx < order.length; idx++) {
      var k = order[idx];
      var inA = hasOwn(ra, k), inB = hasOwn(rb, k);
      var av = inA ? ra[k] : undefined, bv = inB ? rb[k] : undefined;
      if (ctx.ignore && ctx.ignore(k, av, bv)) {
        if (inA && inB && !deepEqual(av, bv)) ctx.changed = true;
        continue; // drop ignored key from both sides
      }
      var bOut = bv;
      if (inA && inB && ctx.numTol != null && typeof av === 'number' && typeof bv === 'number'
          && eqKind(av, bv, ctx.numTol) === 2) { ctx.changed = true; bOut = av; }
      if (inA) laP.push(JSON.stringify(k) + ':' + JSON.stringify(av));
      if (inB) lbP.push(JSON.stringify(k) + ':' + JSON.stringify(bOut));
    }
    out.a = '{' + laP.join(',') + '}';
    out.b = '{' + lbP.join(',') + '}';
  }

  // Compact top-level array alignment: each element on ONE line. Keeps the line
  // count ≈ element count so CM6 stays fast on very large arrays. Gap (blank) lines
  // still mark added/removed elements; changed fields show via CM6's char diff.
  function alignArrayOneLine(a, b, ctx) {
    var n = a.length, m = b.length;
    var A = ['['], B = ['['];
    var buf = {};
    function emit(i, j) {
      var commaA = i !== null && i < n - 1;
      var commaB = j !== null && j < m - 1;
      if (i !== null && j !== null) {
        if (isPlainObject(a[i]) && isPlainObject(b[j])) {
          compactPair(a[i], b[j], ctx, buf);
          A.push(buf.a + (commaA ? ',' : ''));
          B.push(buf.b + (commaB ? ',' : ''));
        } else {
          A.push(JSON.stringify(a[i]) + (commaA ? ',' : ''));
          B.push(JSON.stringify(b[j]) + (commaB ? ',' : ''));
        }
      } else if (i !== null) {
        A.push(compactSingle(a[i], ctx) + (commaA ? ',' : ''));
        B.push('');
      } else {
        A.push('');
        B.push(compactSingle(b[j], ctx) + (commaB ? ',' : ''));
      }
    }
    walkArrayMatches(a, b, ctx.numTol, emit);
    A.push(']'); B.push(']');
    return padToEqual(A, B);
  }

  function shouldCompact(a, b, combinedLen) {
    return Array.isArray(a) && Array.isArray(b) &&
      (combinedLen > COMPACT_MIN_BYTES || (a.length + b.length) > COMPACT_MIN_ELEMENTS);
  }

  // Longest common subsequence over (tolerance-aware) deep-equality → matched
  // [i, j] pairs. With `tol` set, elements that differ only within tolerance
  // count as matches, so a near-equal item aligns instead of read as add+remove.
  function lcsMatches(a, b, tol) {
    var n = a.length, m = b.length;
    var dp = [], i, j;
    for (i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
    var eqCache = [];
    for (i = 0; i < n; i++) { eqCache.push(new Int8Array(m)); eqCache[i].fill(-1); }
    function equal(i, j) {
      if (eqCache[i][j] === -1) eqCache[i][j] = (eqKind(a[i], b[j], tol) !== 0) ? 1 : 0;
      return eqCache[i][j] === 1;
    }
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        dp[i][j] = equal(i, j) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var out = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (equal(i, j)) { out.push([i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return out;
  }

  function alignObject(a, b, pad, ctx) {
    var child = pad + INDENT;
    var aKeys = Object.keys(a), bKeys = Object.keys(b);
    var aSet = {}, bSet = {}, i;
    for (i = 0; i < aKeys.length; i++) aSet[aKeys[i]] = true;
    for (i = 0; i < bKeys.length; i++) bSet[bKeys[i]] = true;

    // Emit shared + a-only keys in a's order, then b-only keys at the end.
    var entries = [];
    for (i = 0; i < aKeys.length; i++) entries.push({ k: aKeys[i], inA: true, inB: !!bSet[aKeys[i]] });
    for (i = 0; i < bKeys.length; i++) if (!aSet[bKeys[i]]) entries.push({ k: bKeys[i], inA: false, inB: true });

    var lastA = -1, lastB = -1;
    for (i = 0; i < entries.length; i++) { if (entries[i].inA) lastA = i; if (entries[i].inB) lastB = i; }

    var A = [pad + '{'], B = [pad + '{'];
    function pushBoth(la, lb) {
      var x;
      for (x = 0; x < la.length; x++) A.push(la[x]);
      for (x = 0; x < lb.length; x++) B.push(lb[x]);
    }
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      var commaA = e.inA && i !== lastA;
      var commaB = e.inB && i !== lastB;
      var sub;
      if (e.inA && e.inB) {
        // Ignored property present on both sides → normalize to the "a" value
        // on BOTH sides so MergeView sees no change.
        if (ctx.ignore && ctx.ignore(e.k, a[e.k], b[e.k])) {
          if (!deepEqual(a[e.k], b[e.k])) ctx.changed = true;
          var canon = ser(a[e.k], child);
          canon[0] = keyPrefix(canon[0], child, e.k);
          var cA = canon.slice(), cB = canon.slice();
          if (commaA) addComma(cA);
          if (commaB) addComma(cB);
          pushBoth(cA, cB);
        } else {
          var al = alignValue(a[e.k], b[e.k], child, ctx);
          al.A[0] = keyPrefix(al.A[0], child, e.k);
          al.B[0] = keyPrefix(al.B[0], child, e.k);
          if (commaA) addComma(al.A);
          if (commaB) addComma(al.B);
          pushBoth(al.A, al.B);
        }
      } else if (e.inA) {
        sub = ser(a[e.k], child); sub[0] = keyPrefix(sub[0], child, e.k);
        if (commaA) addComma(sub);
        pushBoth(sub, blanks(sub.length));
      } else {
        sub = ser(b[e.k], child); sub[0] = keyPrefix(sub[0], child, e.k);
        if (commaB) addComma(sub);
        pushBoth(blanks(sub.length), sub);
      }
    }
    A.push(pad + '}'); B.push(pad + '}');
    return padToEqual(A, B);
  }

  // Coerce a raw tolerance into a usable positive finite number, or null.
  function coerceTol(t) {
    return (typeof t === 'number' && isFinite(t) && t > 0) ? t : null;
  }

  // Normalize opts into a { ignore, changed, numTol } ctx.
  function makeCtx(opts) {
    return {
      ignore: (opts && typeof opts.ignore === 'function') ? opts.ignore : null,
      changed: false,
      numTol: coerceTol(opts && opts.numTol)
    };
  }

  /**
   * Align two JSON texts for block-level diffing (with optional ignore + numeric
   * tolerance). Ignored props and numbers within `numTol` are emitted as a's
   * value on both sides so MergeView sees no change.
   * @param {object} [opts] - { ignore?: (key,aVal,bVal)=>bool, numTol?: number }
   * @returns {{ok:true, left:string, right:string, changed:boolean} | {ok:false}}
   *          ok:false means "could not align" — caller should fall back to
   *          the raw text + CodeMirror's default diff.
   */
  function align(leftText, rightText, opts) {
    try {
      if (typeof leftText !== 'string' || typeof rightText !== 'string') return { ok: false };
      if (!leftText.trim() || !rightText.trim()) return { ok: false };
      if (leftText.length + rightText.length > MAX_BYTES) return { ok: false };
      var a, b;
      try { a = JSON.parse(leftText); b = JSON.parse(rightText); }
      catch (e) { return { ok: false }; }
      var ctx = makeCtx(opts);
      // Large top-level arrays → compact (one line per element) so CM6's line diff
      // scales; everything else → pretty (readable) alignment.
      var res = shouldCompact(a, b, leftText.length + rightText.length)
        ? alignArrayOneLine(a, b, ctx)
        : alignValue(a, b, '', ctx);
      return { ok: true, left: res.A.join('\n'), right: res.B.join('\n'), changed: ctx.changed };
    } catch (e) {
      return { ok: false, error: e && e.message };
    }
  }

  /**
   * Normalize ignored / within-tolerance values WITHOUT structural gap-alignment
   * (used when Block Diff is off but there are ignore patterns and/or a numeric
   * tolerance). Left is pretty-printed a; right is pretty-printed b with ignored
   * props and near-equal numbers swapped to a's value.
   * @param {function} [ignore] - (key,aVal,bVal)=>bool predicate, or null
   * @param {number}   [numTol] - numeric tolerance (>0), or null/omitted
   * @returns {{ok:true, left:string, right:string, changed:boolean} | {ok:false}}
   */
  function normalize(leftText, rightText, ignore, numTol) {
    try {
      var hasIgnore = typeof ignore === 'function';
      var tol = coerceTol(numTol);
      if (!hasIgnore && tol == null) return { ok: false };
      if (typeof leftText !== 'string' || typeof rightText !== 'string') return { ok: false };
      if (!leftText.trim() || !rightText.trim()) return { ok: false };
      if (leftText.length + rightText.length > MAX_BYTES) return { ok: false };
      var a, b;
      try { a = JSON.parse(leftText); b = JSON.parse(rightText); }
      catch (e) { return { ok: false }; }
      var ctx = { ignore: hasIgnore ? ignore : null, changed: false, numTol: tol };
      var left = ser(a, '').join('\n');
      var right = serWithSwap(b, a, ctx, '').join('\n');
      return { ok: true, left: left, right: right, changed: ctx.changed };
    } catch (e) {
      return { ok: false, error: e && e.message };
    }
  }

  // Remove gap (blank) lines, restoring compact pretty JSON. Safe because
  // pretty-printed JSON never contains intentional blank lines.
  function stripGaps(text) {
    if (typeof text !== 'string') return text;
    return text.split('\n').filter(function (l) { return l.trim() !== ''; }).join('\n');
  }

  window.JSONAlign = { align: align, normalize: normalize, stripGaps: stripGaps };
})();
