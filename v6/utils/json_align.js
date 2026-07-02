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

   Pure + dependency-free. Exposes window.JSONAlign.
   ==================================================================== */
(function () {
  'use strict';

  var INDENT = '  ';
  var MAX_BYTES = 3000000;     // skip alignment above this combined size (safety)
  var MAX_LCS_CELLS = 1000000; // skip element LCS for very large arrays
  var PAIR_KEY_RATIO = 0.5;    // min shared-key ratio to treat two objects as "the same item changed"

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;
    if (typeof a !== 'object') return a === b;
    var aArr = Array.isArray(a), bArr = Array.isArray(b);
    if (aArr !== bArr) return false;
    if (aArr) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    var ak = Object.keys(a), bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (var k = 0; k < ak.length; k++) {
      var key = ak[k];
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
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
    if (deepEqual(a, b)) {
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

    var matches = (n === 0 || m === 0 || n * m > MAX_LCS_CELLS) ? [] : lcsMatches(a, b);
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
    A.push(pad + ']'); B.push(pad + ']');
    return { A: A, B: B };
  }

  // Longest common subsequence over deep-equality → matched [i, j] pairs.
  function lcsMatches(a, b) {
    var n = a.length, m = b.length;
    var dp = [], i, j;
    for (i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
    var eqCache = [];
    for (i = 0; i < n; i++) { eqCache.push(new Int8Array(m)); eqCache[i].fill(-1); }
    function equal(i, j) {
      if (eqCache[i][j] === -1) eqCache[i][j] = deepEqual(a[i], b[j]) ? 1 : 0;
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

  // Normalize an opts.ignore argument into a { ignore, changed } ctx.
  function makeCtx(opts) {
    return {
      ignore: (opts && typeof opts.ignore === 'function') ? opts.ignore : null,
      changed: false
    };
  }

  /**
   * Align two JSON texts for block-level diffing (with optional ignore).
   * @param {object} [opts] - { ignore?: (key,aVal,bVal)=>bool }
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
      var res = alignValue(a, b, '', ctx);
      return { ok: true, left: res.A.join('\n'), right: res.B.join('\n'), changed: ctx.changed };
    } catch (e) {
      return { ok: false, error: e && e.message };
    }
  }

  /**
   * Normalize ignored values WITHOUT structural gap-alignment (used when Block
   * Diff is off but there are ignore patterns). Left is pretty-printed a; right
   * is pretty-printed b with ignored props swapped to a's value.
   * @returns {{ok:true, left:string, right:string, changed:boolean} | {ok:false}}
   */
  function normalize(leftText, rightText, ignore) {
    try {
      if (typeof ignore !== 'function') return { ok: false };
      if (typeof leftText !== 'string' || typeof rightText !== 'string') return { ok: false };
      if (!leftText.trim() || !rightText.trim()) return { ok: false };
      if (leftText.length + rightText.length > MAX_BYTES) return { ok: false };
      var a, b;
      try { a = JSON.parse(leftText); b = JSON.parse(rightText); }
      catch (e) { return { ok: false }; }
      var ctx = { ignore: ignore, changed: false };
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
