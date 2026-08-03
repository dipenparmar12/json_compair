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

   -------------------------------------------------------------------
   SCALE (why this file is more than a pretty-printer)
   -------------------------------------------------------------------
   CM6's diff gives up on big inputs. In @codemirror/merge 6.7.2 the
   *applied* limit is `scanLimit >> 1`, and findSnake() bails:

       if (min(lenA,lenB) > scanLimit * 16) crudeMatch(...)
       if (min(lenA,lenB) > scanLimit * 64) return [ONE change]

   Those are absolute CHARACTER counts, so a pretty-printed array of a
   few hundred records (~1 MB) collapses into a single "everything
   changed" block — the whole collection reported as one diff. Raising
   scanLimit instead freezes the tab (Myers is O(ND) and synchronous).
   There is no scanLimit that works for a multi-MB pair.

   So this module stops relying on CM6 to FIND the differences:

     0. findCollection() locates the records: the root when both sides are
        arrays, else the shared object key holding the biggest array on both
        sides. Envelope shapes ({data:[...]}, {results:[...]}) therefore get
        the same model + window as a bare array instead of being handed to
        CM6 whole.
     1. matchArray()  pairs records itself — by a detected identity key
        (patience/LIS over unique ids, O(n log n)), else by content-hash
        anchors, else positionally. No O(n·m) DP, no size cliff.
     2. buildModel()  computes the item- and FIELD-level diff directly.
        This is the authoritative answer, is exact at any size, and is
        what the UI reports and lists.
     3. render()      emits text sized so CM6's own diff stays in its
        accurate regime: identical records collapse to one compact line
        (byte-identical on both sides → free), and CHANGED records are
        pretty-printed field-per-line (so the field-level diff is
        visible in both panes) up to a character budget. Records past
        the budget stay compact; the caller pages through them.

   Compact and pretty JSON parse to the same value, so both panes still
   hold the user's real data — only the formatting adapts.

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
   items still align via the tolerance-aware matcher. `changed` covers this too.

   Pure + dependency-free. Exposes window.JSONAlign.
   ==================================================================== */
(function () {
  'use strict';

  var INDENT = '  ';
  // Hard ceiling on input we will parse at all. Everything below is linear or
  // n·log n, so this only guards against absurd pastes / memory pressure.
  var MAX_BYTES = 64000000;    // ~64MB combined

  // Exact LCS is optimal but O(n·m); use it only where that is genuinely
  // cheap. Above this the patience/hash matcher takes over (better results
  // on real data anyway, since it anchors on identity rather than equality).
  var MAX_LCS_CELLS = 250000;
  var PAIR_KEY_RATIO = 0.5;    // min shared-key ratio to treat two objects as "the same item changed"

  // Sharing key NAMES is not evidence that two records are the same record.
  // Every row of a CSV export has identical keys, so a key-name-only test says
  // "yes" to any two rows and positional gap-filling then pairs record k of one
  // file with record k of an unrelated file. That produced the worst possible
  // outcome: a model claiming thousands of "changed" records and tens of
  // thousands of "field changes" that do not exist, rendered as a page where
  // ~64% of lines differ — which CM6 cannot diff at any affordable scanLimit,
  // so the panes showed one undifferentiated block while the summary insisted
  // there were changes to see. Values have to agree too.
  var PAIR_VALUE_RATIO = 0.5;  // min share of INFORMATIVE shared keys that must be equal
  // Agreement on a column that holds the same value in every record (a status
  // flag, a constant unit) is not evidence either, so those keys are excluded
  // from the ratio. Sampled: a key that never varies across this many spread-out
  // records is treated as constant.
  var INFO_SAMPLE = 400;

  // Below this combined input size everything is pretty-printed, exactly as
  // before — small comparisons must look untouched. Above it the adaptive
  // renderer kicks in (equal records compact, changed records pretty within a
  // budget), because a fully pretty multi-MB document is precisely what pushes
  // CM6 over the cliff described above.
  var PRETTY_MAX_BYTES = 800000;

  // Rendering budget for the adaptive path. Changed records are pretty-printed
  // (one field per line) until the emitted text for one side passes this many
  // characters; the rest stay on one compact line. Keeps what CM6 must diff
  // inside its accurate regime while still showing field-level detail.
  var EXPAND_CHAR_BUDGET = 400000;

  // Identity-key detection: a key is only usable if its values are unique on
  // BOTH sides and the two sides largely agree on the value set.
  var ID_SAMPLE = 200;         // cheap first pass before scanning full arrays
  var ID_MIN_OVERLAP = 0.5;    // >= this share of min(n,m) must match by id
  // Identity is an inference, and on a handful of elements almost any field
  // looks unique. Below this many items the exact LCS is cheap and is the
  // better answer, so don't guess.
  var ID_MIN_ITEMS = 4;

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  /* ==================================================================
     COOPERATIVE CHUNKING — so a big model build can be watched and stopped
     --------------------------------------------------------------------
     The matching and field-model passes are linear in record count: ~0.3 s
     for 2,000 records, so ~3 s for 20,000 and worse beyond. Run as one
     synchronous loop that is a frozen tab with no progress and no way out.

     The async variants below do exactly the same work, but hand control back
     to the browser every SLICE_MS and check a cancellation flag when they do.
     The sync entry points are untouched, so small comparisons keep taking the
     straight-line path with zero added overhead.

     Kept dependency-free on purpose (this module is pure): the caller passes
     `signal` / `onProgress`, and the yield is implemented locally.
     ================================================================== */

  var SLICE_MS = 12;        // work between yields — about one frame
  // The clock is only read every CHECK_EVERY items, so this — not SLICE_MS —
  // sets the FLOOR on slice length. At 256 a 158-field record set ran ~33 ms
  // slices (over a frame, and only 8 progress updates across 2,000 records).
  // 64 keeps slices inside a frame; the extra clock reads are unmeasurable.
  var CHECK_EVERY = 64;

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  }

  function Cancelled() {
    this.name = 'CancelledError';
    this.message = 'Operation cancelled';
    this.cancelled = true;   // duck-typed so callers can test err.cancelled
  }
  Cancelled.prototype = Object.create(Error.prototype);
  Cancelled.prototype.constructor = Cancelled;

  // A real macrotask: MessageChannel avoids setTimeout's ~4 ms clamp (which,
  // at one yield per slice, would dominate the runtime), and still fires in a
  // background tab where requestAnimationFrame never would.
  var _chan = (typeof MessageChannel === 'function') ? new MessageChannel() : null;
  var _waiters = [];
  if (_chan) {
    _chan.port1.onmessage = function () {
      var fn = _waiters.shift();
      if (fn) fn();
    };
  }
  function yieldNow() {
    return new Promise(function (resolve) {
      if (_chan) { _waiters.push(resolve); _chan.port2.postMessage(0); }
      else setTimeout(resolve, 0);
    });
  }

  function cancelledBy(ctl) {
    return !!(ctl && ctl.signal && ctl.signal.cancelled);
  }

  /**
   * Open a phase and return the control object for its loop.
   *
   * The signal has to be copied onto the per-phase control: chunkedLoop tests
   * `ctl.signal`, and a reporter returned bare from onPhase() carries only
   * onProgress — which silently made every loop uncancellable.
   */
  function phaseCtl(ctl, key, total) {
    if (!ctl) return undefined;
    var rep = ctl.onPhase ? ctl.onPhase(key, total) : null;
    return {
      signal: ctl.signal,
      onProgress: rep ? rep.onProgress : ctl.onProgress
    };
  }

  /**
   * Run body(i) for i in [0, n), yielding every SLICE_MS.
   * @param {object} [ctl] { signal, onProgress(done,total) }
   */
  function chunkedLoop(n, body, ctl) {
    var i = 0;
    function run() {
      var deadline = nowMs() + SLICE_MS;
      var sinceCheck = 0;
      while (i < n) {
        body(i);
        i++;
        if (++sinceCheck >= CHECK_EVERY) {
          sinceCheck = 0;
          if (nowMs() >= deadline) break;
        }
      }
      if (i >= n) {
        // Check on the way OUT too, not only at a yield. A loop whose last slice
        // covers the remaining items used to finish regardless — a cancel landing
        // there was silently ignored and the phase reported success. (Harmless in
        // this file, since callers re-check before writing anything, but a
        // cancellation that is only sometimes honoured is not one.)
        if (cancelledBy(ctl)) return Promise.reject(new Cancelled());
        if (ctl && ctl.onProgress) ctl.onProgress(n, n);
        return Promise.resolve();
      }
      if (cancelledBy(ctl)) return Promise.reject(new Cancelled());
      if (ctl && ctl.onProgress) ctl.onProgress(i, n);
      return yieldNow().then(run);
    }
    // n === 0 still has to report completion so the phase bar fills.
    if (n <= 0) {
      if (ctl && ctl.onProgress) ctl.onProgress(0, 0);
      return Promise.resolve();
    }
    return run();
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

  var hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

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
      var cpHas = isPlainObject(cp) && hasOwn(cp, k);
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

  /**
   * Which keys carry information about record identity, i.e. actually vary
   * across the collection. Sampled with a stride so this stays O(INFO_SAMPLE·k)
   * regardless of how many records there are.
   * @returns {object|null} a key→true set, or null when nothing varies
   */
  function informativeKeys(a, b) {
    if (!a.length || !b.length || !isPlainObject(a[0])) return null;
    var keys = Object.keys(a[0]), out = Object.create(null), any = false;
    for (var i = 0; i < keys.length; i++) {
      if (keyVaries(a, keys[i]) || keyVaries(b, keys[i])) { out[keys[i]] = true; any = true; }
    }
    return any ? out : null;
  }

  function keyVaries(arr, key) {
    var step = Math.max(1, Math.floor(arr.length / INFO_SAMPLE));
    var first, seen = false;
    for (var i = 0; i < arr.length; i += step) {
      var r = arr[i];
      if (!isPlainObject(r)) continue;
      if (!seen) { first = r[key]; seen = true; continue; }
      if (eqKind(r[key], first, null) === 0) return true;
    }
    return false;
  }

  /**
   * Heuristic: are two values "the same item, modified" (→ align internals and
   * report a field-level diff) vs unrelated (→ show as separate remove + add)?
   *
   * Only consulted for records that the anchor pass could NOT match, so this is
   * a guess. Guessing "unrelated" costs a field diff the user might have wanted;
   * guessing "same" invents field changes AND produces text CM6 cannot diff. The
   * second is strictly worse, so the bar is agreement on both key names and
   * values (see PAIR_VALUE_RATIO).
   *
   * @param {object} [info] informativeKeys() set — keys that are constant across
   *        the collection are ignored, since matching on them proves nothing.
   */
  function shouldPair(x, y, info) {
    var xObj = isPlainObject(x), yObj = isPlainObject(y);
    if (xObj && yObj) {
      var xk = Object.keys(x), yk = Object.keys(y);
      if (xk.length === 0 || yk.length === 0) return true;
      var ySet = {}; for (var i = 0; i < yk.length; i++) ySet[yk[i]] = true;
      var shared = 0, weighed = 0, agree = 0;
      for (var j = 0; j < xk.length; j++) {
        var k = xk[j];
        if (!ySet[k]) continue;
        shared++;
        if (info && !info[k]) continue;         // constant column: carries no evidence
        weighed++;
        if (eqKind(x[k], y[k], null) !== 0) agree++;
      }
      if (shared / Math.max(xk.length, yk.length) < PAIR_KEY_RATIO) return false;
      // Nothing informative to judge on (every shared key is constant): fall back
      // to the old key-name-only verdict rather than refusing every pair.
      if (!weighed) return true;
      return agree / weighed >= PAIR_VALUE_RATIO;
    }
    if (Array.isArray(x) && Array.isArray(y)) return true;
    // primitives / type-mismatch: pairing just renders old → new on a line
    return !xObj && !yObj && !Array.isArray(x) && !Array.isArray(y);
  }

  function padToEqual(A, B) {
    while (A.length < B.length) A.push('');
    while (B.length < A.length) B.push('');
    return { A: A, B: B };
  }

  /* ==================================================================
     RECORD MATCHING — how array elements are paired up
     ================================================================== */

  // Deterministic 32-bit hash of a value, key-order independent so two records
  // that differ only in column order hash the same. Collisions are possible and
  // harmless: every hash match is verified with eqKind before it is trusted.
  function hashValue(v, h) {
    var i, keys;
    if (h === undefined) h = 0x811c9dc5;
    if (v === null || v === undefined || typeof v !== 'object') {
      return hashString(typeof v + ':' + String(v), h);
    }
    if (Array.isArray(v)) {
      h = hashString('[' + v.length, h);
      for (i = 0; i < v.length; i++) h = hashValue(v[i], h);
      return h;
    }
    keys = Object.keys(v).sort();
    h = hashString('{' + keys.length, h);
    for (i = 0; i < keys.length; i++) {
      h = hashString(keys[i], h);
      h = hashValue(v[keys[i]], h);
    }
    return h;
  }

  function hashString(s, h) {
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  // Scalar values only — an identity key must be comparable as a map key.
  function idOf(rec, key) {
    if (!isPlainObject(rec) || !hasOwn(rec, key)) return null;
    var v = rec[key];
    var t = typeof v;
    if (v === null || t === 'object') return null;
    if (t === 'string') return v === '' ? null : 's' + v;
    return t.charAt(0) + String(v);
  }

  // Find a key usable as a record identity: unique on both sides AND with a
  // high value overlap between them. Uniqueness alone is not enough — in a
  // homefacts export both sides have unique UUIDs, but every UUID was
  // regenerated, so UUID overlaps 0% and is useless as an anchor while
  // ATTOMId / ParcelNumber overlap 100%.
  function detectIdKey(a, b) {
    var n = a.length, m = b.length;
    if (!n || !m || !isPlainObject(a[0]) || !isPlainObject(b[0])) return null;

    // Stage 1: candidate keys = present + scalar + unique across a small sample
    // of BOTH sides. Most columns are low-cardinality and die here, so the full
    // scan below only runs for a handful of keys.
    var sampleN = Math.min(ID_SAMPLE, n), sampleM = Math.min(ID_SAMPLE, m);
    var candidates = [], keys = Object.keys(a[0]), ki;
    for (ki = 0; ki < keys.length; ki++) {
      var key = keys[ki];
      if (uniqueOver(a, sampleN, key) && uniqueOver(b, sampleM, key)) candidates.push(key);
    }
    if (!candidates.length) return null;

    // Stage 2: full uniqueness + overlap, best overlap wins.
    var best = null, minLen = Math.min(n, m);
    for (ki = 0; ki < candidates.length; ki++) {
      var k = candidates[ki];
      var setA = collectIds(a, k); if (!setA) continue;
      var setB = collectIds(b, k); if (!setB) continue;
      var overlap = 0;
      setA.forEach(function (v) { if (setB.has(v)) overlap++; });
      if (overlap >= minLen * ID_MIN_OVERLAP && (!best || overlap > best.overlap)) {
        best = { key: k, overlap: overlap };
      }
    }
    return best ? best.key : null;
  }

  function uniqueOver(arr, count, key) {
    var seen = new Set();
    for (var i = 0; i < count; i++) {
      var id = idOf(arr[i], key);
      if (id === null || seen.has(id)) return false;
      seen.add(id);
    }
    return true;
  }

  // Full-array id set, or null if any element lacks the key / repeats a value.
  function collectIds(arr, key) {
    var seen = new Set();
    for (var i = 0; i < arr.length; i++) {
      var id = idOf(arr[i], key);
      if (id === null || seen.has(id)) return null;
      seen.add(id);
    }
    return seen;
  }

  // Longest increasing subsequence over the j values of candidate pairs, i.e.
  // the largest order-preserving subset of matches (patience diff's anchor
  // step). O(k log k). Returns the chosen pairs.
  function longestIncreasing(pairs) {
    if (!pairs.length) return [];
    // tails[k] = index into `pairs` of the smallest possible tail of an
    // increasing subsequence of length k+1; prev[] threads the back-pointers.
    var tails = [], prev = new Array(pairs.length);
    for (var p = 0; p < pairs.length; p++) {
      var j = pairs[p][1];
      var lo = 0, hi = tails.length;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (pairs[tails[mid]][1] < j) lo = mid + 1; else hi = mid;
      }
      prev[p] = lo > 0 ? tails[lo - 1] : -1;
      tails[lo] = p;
    }
    var out = [], cur = tails[tails.length - 1];
    while (cur !== undefined && cur !== -1) { out.push(pairs[cur]); cur = prev[cur]; }
    out.reverse();
    return out;
  }

  // Anchor pairs from symbols that occur exactly once on each side and match.
  // `symbolsOf` maps an element to a comparable token (identity value or hash).
  function anchorsFromSymbols(a, b, symbolOf) {
    var countA = new Map(), countB = new Map(), firstA = new Map(), firstB = new Map();
    var i, s;
    for (i = 0; i < a.length; i++) {
      s = symbolOf(a[i]);
      if (s === null) continue;
      countA.set(s, (countA.get(s) || 0) + 1);
      if (!firstA.has(s)) firstA.set(s, i);
    }
    for (i = 0; i < b.length; i++) {
      s = symbolOf(b[i]);
      if (s === null) continue;
      countB.set(s, (countB.get(s) || 0) + 1);
      if (!firstB.has(s)) firstB.set(s, i);
    }
    var pairs = [];
    countA.forEach(function (c, sym) {
      if (c === 1 && countB.get(sym) === 1) pairs.push([firstA.get(sym), firstB.get(sym)]);
    });
    pairs.sort(function (x, y) { return x[0] - y[0]; });
    return longestIncreasing(pairs);
  }

  // Exact LCS over (tolerance-aware) equality. Optimal, but O(n·m) — only used
  // for small arrays (see MAX_LCS_CELLS).
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

  /**
   * Pair up the elements of two arrays. Returns { pairs, strategy, idKey }
   * where pairs is an ordered list of [i, j] with either side nullable:
   *   [i, j]    element i of a corresponds to element j of b
   *   [i, null] removed        [null, j] added
   *
   * Strategy, in preference order:
   *   'id'       an identity key was detected → anchor on it (best: survives
   *              reordering AND value changes, since the id itself is stable)
   *   'lcs'      small arrays → exact LCS over equality
   *   'hash'     content-hash anchors + positional fill (patience diff)
   */
  function matchArray(a, b, tol) {
    var n = a.length, m = b.length;
    var strategy, idKey = null, anchors;

    if (!n || !m) {
      anchors = [];
      strategy = 'empty';
    } else {
      idKey = Math.min(n, m) >= ID_MIN_ITEMS ? detectIdKey(a, b) : null;
      if (idKey) {
        strategy = 'id';
        anchors = anchorsFromSymbols(a, b, function (r) { return idOf(r, idKey); });
      } else if (n * m <= MAX_LCS_CELLS) {
        strategy = 'lcs';
        anchors = lcsMatches(a, b, tol);
      } else {
        strategy = 'hash';
        anchors = anchorsFromSymbols(a, b, function (r) { return hashValue(r); });
      }
    }

    // Walk anchors, filling the gaps between them positionally.
    return { pairs: fillPairs(a, b, anchors, informativeKeys(a, b)), strategy: strategy, idKey: idKey };
  }

  // The anchor→pair walk, shared by matchArray and matchArrayAsync.
  function fillPairs(a, b, anchors, info) {
    var n = a.length, m = b.length;
    var pairs = [];
    var list = anchors.concat([[n, m]]);
    var ai = 0, bj = 0;
    for (var t = 0; t < list.length; t++) {
      var ti = list[t][0], tj = list[t][1];
      var dels = [], inss = [], i, j;
      for (i = ai; i < ti; i++) dels.push(i);
      for (j = bj; j < tj; j++) inss.push(j);
      var len = Math.max(dels.length, inss.length);
      for (var k = 0; k < len; k++) {
        var di = k < dels.length ? dels[k] : null;
        var ij = k < inss.length ? inss[k] : null;
        if (di !== null && ij !== null && !shouldPair(a[di], b[ij], info)) {
          pairs.push([di, null]);
          pairs.push([null, ij]);
        } else {
          pairs.push([di, ij]);
        }
      }
      if (ti < n && tj < m) { pairs.push([ti, tj]); ai = ti + 1; bj = tj + 1; }
      else { ai = ti; bj = tj; }
    }
    return pairs;
  }

  // Identity detection, one candidate key per slice. Stage 2 scans both arrays
  // in full for every surviving candidate, so on a large collection this is the
  // second-most expensive thing we do after the field model.
  function detectIdKeyAsync(a, b, ctl) {
    var n = a.length, m = b.length;
    if (!n || !m || !isPlainObject(a[0]) || !isPlainObject(b[0])) return Promise.resolve(null);

    var sampleN = Math.min(ID_SAMPLE, n), sampleM = Math.min(ID_SAMPLE, m);
    var candidates = [], keys = Object.keys(a[0]);
    for (var ki = 0; ki < keys.length; ki++) {
      if (uniqueOver(a, sampleN, keys[ki]) && uniqueOver(b, sampleM, keys[ki])) candidates.push(keys[ki]);
    }
    if (!candidates.length) return Promise.resolve(null);

    var best = null, minLen = Math.min(n, m);
    var inner = phaseCtl(ctl, 'identity', candidates.length);
    return chunkedLoop(candidates.length, function (idx) {
      var k = candidates[idx];
      var setA = collectIds(a, k); if (!setA) return;
      var setB = collectIds(b, k); if (!setB) return;
      var overlap = 0;
      setA.forEach(function (v) { if (setB.has(v)) overlap++; });
      if (overlap >= minLen * ID_MIN_OVERLAP && (!best || overlap > best.overlap)) {
        best = { key: k, overlap: overlap };
      }
    }, inner).then(function () { return best ? best.key : null; });
  }

  // Async twin of matchArray. Same strategies, same results.
  function matchArrayAsync(a, b, tol, ctl) {
    var n = a.length, m = b.length;
    if (!n || !m) {
      return Promise.resolve({ pairs: fillPairs(a, b, [], null), strategy: 'empty', idKey: null });
    }
    var idPromise = Math.min(n, m) >= ID_MIN_ITEMS
      ? detectIdKeyAsync(a, b, ctl)
      : Promise.resolve(null);

    return idPromise.then(function (idKey) {
      var strategy, anchors;
      if (idKey) {
        strategy = 'id';
        anchors = anchorsFromSymbols(a, b, function (r) { return idOf(r, idKey); });
      } else if (n * m <= MAX_LCS_CELLS) {
        strategy = 'lcs';
        anchors = lcsMatches(a, b, tol);   // bounded by MAX_LCS_CELLS, so bounded time
      } else {
        strategy = 'hash';
        anchors = anchorsFromSymbols(a, b, function (r) { return hashValue(r); });
      }
      if (cancelledBy(ctl)) throw new Cancelled();
      var inner = phaseCtl(ctl, 'match', n + m);
      // The walk itself is linear with a small constant; report it as one step
      // rather than paying a closure per element.
      var pairs = fillPairs(a, b, anchors, informativeKeys(a, b));
      if (inner && inner.onProgress) inner.onProgress(n + m, n + m);
      return { pairs: pairs, strategy: strategy, idKey: idKey };
    });
  }

  /* ==================================================================
     FIELD-LEVEL DIFF MODEL — the authoritative answer, at any size
     ================================================================== */

  // Which keys of two paired records actually differ (honouring ignore +
  // numeric tolerance). Returns null when the pair is fully equal.
  function diffFields(ra, rb, ctx) {
    if (!isPlainObject(ra) || !isPlainObject(rb)) {
      return eqKind(ra, rb, ctx.numTol) !== 0 ? null : { changed: ['(value)'], onlyA: [], onlyB: [] };
    }
    var changed = [], onlyA = [], onlyB = [], k;
    for (k in ra) {
      if (!hasOwn(ra, k)) continue;
      if (!hasOwn(rb, k)) {
        if (!(ctx.ignore && ctx.ignore(k, ra[k], undefined))) onlyA.push(k);
        continue;
      }
      if (ctx.ignore && ctx.ignore(k, ra[k], rb[k])) continue;
      if (eqKind(ra[k], rb[k], ctx.numTol) === 0) changed.push(k);
    }
    for (k in rb) {
      if (!hasOwn(rb, k) || hasOwn(ra, k)) continue;
      if (!(ctx.ignore && ctx.ignore(k, undefined, rb[k]))) onlyB.push(k);
    }
    if (!changed.length && !onlyA.length && !onlyB.length) return null;
    return { changed: changed, onlyA: onlyA, onlyB: onlyB };
  }

  /**
   * Build the item + field level diff of two arrays. Exact at any size —
   * this is what the UI reports, independent of what gets rendered.
   *
   * items[]: { a, b, status, changed[], onlyA[], onlyB[], nFields }
   *          status ∈ 'same' | 'changed' | 'added' | 'removed'
   */
  // Split into start/step/end so the synchronous and the chunked async build
  // run byte-identical logic — two copies of this loop would drift.
  function modelStart(a, b, ctx, match) {
    return {
      a: a, b: b, ctx: ctx, match: match,
      items: [], fields: Object.create(null),
      totals: { total: 0, same: 0, changed: 0, added: 0, removed: 0, moved: 0, fieldChanges: 0 }
    };
  }

  function modelStep(st, p) {
    var a = st.a, b = st.b, ctx = st.ctx;
    var i = st.match.pairs[p][0], j = st.match.pairs[p][1];
    var it;
    if (i !== null && j !== null) {
      var d = diffFields(a[i], b[j], ctx);
      if (!d) {
        it = { a: i, b: j, status: 'same', changed: [], onlyA: [], onlyB: [], nFields: 0 };
        st.totals.same++;
      } else {
        var nf = d.changed.length + d.onlyA.length + d.onlyB.length;
        it = { a: i, b: j, status: 'changed', changed: d.changed, onlyA: d.onlyA, onlyB: d.onlyB, nFields: nf };
        st.totals.changed++;
        st.totals.fieldChanges += nf;
        countFields(st.fields, d.changed); countFields(st.fields, d.onlyA); countFields(st.fields, d.onlyB);
      }
    } else if (i !== null) {
      it = { a: i, b: null, status: 'removed', changed: [], onlyA: [], onlyB: [], nFields: 0 };
      st.totals.removed++;
    } else {
      it = { a: null, b: j, status: 'added', changed: [], onlyA: [], onlyB: [], nFields: 0 };
      st.totals.added++;
    }
    st.totals.total++;
    st.items.push(it);
  }

  function modelEnd(st) {
    if (st.match.idKey) {
      linkMoves(st.items, st.a, st.b, st.ctx, st.match.idKey, st.totals, st.fields);
    }
    return {
      kind: 'array', strategy: st.match.strategy, idKey: st.match.idKey,
      items: st.items, totals: st.totals, fields: st.fields
    };
  }

  function buildModel(a, b, ctx) {
    var match = matchArray(a, b, ctx.numTol);
    var st = modelStart(a, b, ctx, match);
    for (var p = 0; p < match.pairs.length; p++) modelStep(st, p);
    return modelEnd(st);
  }

  // Same result as buildModel, built in interruptible slices with progress.
  function buildModelAsync(a, b, ctx, ctl) {
    return matchArrayAsync(a, b, ctx.numTol, ctl).then(function (match) {
      var st = modelStart(a, b, ctx, match);
      var inner = phaseCtl(ctl, 'model', match.pairs.length);
      return chunkedLoop(match.pairs.length, function (p) { modelStep(st, p); }, inner)
        .then(function () { return modelEnd(st); });
    });
  }

  /**
   * Recover field-level diffs for records that MOVED.
   *
   * Pairing has to stay order-preserving, because the rendered panes must hold
   * each side's records in that side's real order — reordering them to line up
   * would mean the pane no longer contains the user's document. So a record that
   * moved far enough falls outside the matched run and renders as a removal plus
   * an addition.
   *
   * That is fine for rendering and wrong for reporting: the record still exists
   * on both sides, and "what changed inside it" is exactly what the user wants.
   * With an identity key we can find those pairs directly and report them as
   * moved, with their real field-level diff, without touching the layout.
   */
  function linkMoves(items, a, b, ctx, idKey, totals, fields) {
    var removedById = new Map(), p, it, id;
    for (p = 0; p < items.length; p++) {
      it = items[p];
      if (it.status !== 'removed') continue;
      id = idOf(a[it.a], idKey);
      if (id !== null && !removedById.has(id)) removedById.set(id, p);
    }
    if (!removedById.size) return;

    for (p = 0; p < items.length; p++) {
      it = items[p];
      if (it.status !== 'added') continue;
      id = idOf(b[it.b], idKey);
      if (id === null || !removedById.has(id)) continue;
      var q = removedById.get(id);
      removedById.delete(id);
      var from = items[q];
      var d = diffFields(a[from.a], b[it.b], ctx);

      from.status = it.status = 'moved';
      from.movedTo = it.b; it.movedFrom = from.a;
      from.changed = it.changed = d ? d.changed : [];
      from.onlyA = it.onlyA = d ? d.onlyA : [];
      from.onlyB = it.onlyB = d ? d.onlyB : [];
      from.nFields = it.nFields = d ? d.changed.length + d.onlyA.length + d.onlyB.length : 0;

      totals.removed--; totals.added--; totals.moved = (totals.moved || 0) + 1;
      if (d) {
        totals.fieldChanges += from.nFields;
        countFields(fields, d.changed); countFields(fields, d.onlyA); countFields(fields, d.onlyB);
      }
    }
  }

  function countFields(acc, keys) {
    for (var i = 0; i < keys.length; i++) acc[keys[i]] = (acc[keys[i]] || 0) + 1;
  }

  /* ==================================================================
     RENDERING
     ================================================================== */

  // Canonical key order for a record = a's keys, then any b-only keys. Applied
  // to BOTH sides so two equal records serialize to byte-identical lines (which
  // CM6 then collapses); changed records differ only where a field differs.
  function mergeKeyOrder(o1, o2) {
    var order = [], seen = Object.create(null), k;
    for (k in o1) if (hasOwn(o1, k) && !seen[k]) { seen[k] = 1; order.push(k); }
    for (k in o2) if (hasOwn(o2, k) && !seen[k]) { seen[k] = 1; order.push(k); }
    return order;
  }

  // One compact line for a single added/removed record.
  function compactSingle(obj) {
    if (!isPlainObject(obj)) return JSON.stringify(obj);
    var parts = [], keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      parts.push(JSON.stringify(keys[i]) + ':' + JSON.stringify(obj[keys[i]]));
    }
    return '{' + parts.join(',') + '}';
  }

  // The two compact lines for a matched record pair, keys in canonical order.
  // Ignored props and within-tolerance numbers emit a's value on BOTH sides, so
  // an unchanged-after-normalization pair produces byte-identical lines. Nothing
  // is dropped: both panes keep every field of the user's data.
  function compactPair(ra, rb, ctx, out) {
    if (!isPlainObject(ra) || !isPlainObject(rb)) {
      out.a = JSON.stringify(ra); out.b = JSON.stringify(rb); return;
    }
    var order = mergeKeyOrder(ra, rb), laP = [], lbP = [];
    for (var idx = 0; idx < order.length; idx++) {
      var k = order[idx];
      var inA = hasOwn(ra, k), inB = hasOwn(rb, k);
      var av = inA ? ra[k] : undefined, bv = inB ? rb[k] : undefined;
      var bOut = bv;
      if (inA && inB) {
        if (ctx.ignore && ctx.ignore(k, av, bv)) {
          if (!deepEqual(av, bv)) ctx.changed = true;
          bOut = av;                                   // normalize to a's value
        } else if (ctx.numTol != null && eqKind(av, bv, ctx.numTol) === 2) {
          ctx.changed = true; bOut = av;
        }
      }
      if (inA) laP.push(JSON.stringify(k) + ':' + JSON.stringify(av));
      if (inB) lbP.push(JSON.stringify(k) + ':' + JSON.stringify(bOut));
    }
    out.a = '{' + laP.join(',') + '}';
    out.b = '{' + lbP.join(',') + '}';
  }

  // Render a matched, non-equal record pair pretty (field per line) with gap
  // padding, so both panes show the field-level difference on aligned lines.
  function prettyPair(ra, rb, pad, ctx) {
    return alignValue(ra, rb, pad, ctx);
  }

  /**
   * How many items fit one page, from the average serialized record size.
   * Sized so the text handed to CM6 stays inside its accurate-diff regime
   * (see the SCALE note): a page that is too big is not "slower", it is
   * silently WRONG — CM6 returns one change covering everything.
   */
  function pageSizeFor(a, b, budget) {
    var sample = Math.min(20, a.length, b.length) || 1;
    var bytes = 0, i;
    for (i = 0; i < sample; i++) {
      bytes += JSON.stringify(a[i] === undefined ? null : a[i]).length;
      bytes += JSON.stringify(b[i] === undefined ? null : b[i]).length;
    }
    // Pretty-printing costs roughly 1.6x compact for typical records.
    var per = Math.max(40, (bytes / sample) * 1.6);
    return Math.max(5, Math.min(2000, Math.floor((budget * 2) / per)));
  }

  /**
   * Emit the aligned text for an array using a prebuilt model.
   *
   * opts.view:
   *   'window' — render only items [from, from+size) at FULL fidelity. The
   *              pane holds a real, complete subset of the data (valid JSON,
   *              no field omitted); the caller pages through it and reports
   *              totals from the model, not from what is on screen.
   *   'full'   — render every item: equal ones compact (byte-identical on both
   *              sides, so they cost CM6 nothing and fold away), changed ones
   *              pretty until `budget` is spent. Complete, but on a very large
   *              collection CM6's own diff will degrade — the model stays exact.
   */
  function renderArray(a, b, model, ctx, opts, pad) {
    if (pad == null) pad = '';
    var child = pad + INDENT;
    var A = [pad + '['], B = [pad + '['];
    var buf = {};
    var budget = opts.budget == null ? EXPAND_CHAR_BUDGET : opts.budget;
    var windowed = opts.view === 'window';
    var items = model.items;
    var from = 0, to = items.length;

    if (windowed) {
      var size = opts.size || pageSizeFor(a, b, budget);
      from = Math.max(0, Math.min(opts.from || 0, Math.max(0, items.length - 1)));
      to = Math.min(items.length, from + size);
    }

    var used = 0, expanded = 0, compacted = 0, shown = 0;
    // Trailing commas depend on what is actually emitted, not on the source
    // index, because a window omits items on either end.
    var lastA = -1, lastB = -1, p;
    for (p = from; p < to; p++) {
      if (items[p].a !== null) lastA = p;
      if (items[p].b !== null) lastB = p;
    }

    function pushBoth(la, lb) {
      var x;
      for (x = 0; x < la.length; x++) A.push(la[x]);
      for (x = 0; x < lb.length; x++) B.push(lb[x]);
    }

    for (p = from; p < to; p++) {
      var it = items[p];
      var i = it.a, j = it.b;
      var commaA = i !== null && p !== lastA;
      var commaB = j !== null && p !== lastB;
      var sub;
      shown++;

      if (it.status === 'removed') {
        sub = windowed ? ser(a[i], child) : [child + compactSingle(a[i])];
        if (commaA) addComma(sub);
        pushBoth(sub, blanks(sub.length));
        continue;
      }
      if (it.status === 'added') {
        sub = windowed ? ser(b[j], child) : [child + compactSingle(b[j])];
        if (commaB) addComma(sub);
        pushBoth(blanks(sub.length), sub);
        continue;
      }

      // A matched pair. In a window everything is pretty. In 'full' mode equal
      // records go compact — the two lines come out byte-identical, so CM6
      // treats them as common text and Collapse Unchanged folds them away.
      var wantPretty = windowed || (it.status === 'changed' && used < budget);

      if (!wantPretty) {
        compactPair(a[i], b[j], ctx, buf);
        var la = [child + buf.a], lb = [child + buf.b];
        if (commaA) addComma(la);
        if (commaB) addComma(lb);
        pushBoth(la, lb);
        if (it.status === 'changed') compacted++;
        continue;
      }

      var al = prettyPair(a[i], b[j], child, ctx);
      if (commaA) addComma(al.A);
      if (commaB) addComma(al.B);
      for (var q = 0; q < al.A.length; q++) used += al.A[q].length + 1;
      if (it.status === 'changed') expanded++;
      pushBoth(al.A, al.B);
    }

    // Pad BEFORE the closing bracket so the two "]" lines stay on the same row.
    // Matters when this block is nested inside an object shell and more keys
    // follow it — otherwise everything after the array is off by the gap.
    var res = padToEqual(A, B);
    res.A.push(pad + ']'); res.B.push(pad + ']');
    res.stats = {
      view: windowed ? 'window' : 'full',
      from: from, to: to, shown: shown, itemsTotal: items.length,
      expanded: expanded, compacted: compacted,
      changedTotal: model.totals.changed,
      truncated: windowed && (from > 0 || to < items.length),
      budgetHit: used >= budget
    };
    return res;
  }

  /**
   * Find the collection this pair is really "about", so object-rooted exports
   * get the same treatment as bare arrays.
   *
   * Everything above (matching, the field model, the record window) works on a
   * pair of ARRAYS, and used to be reachable only when the two documents were
   * arrays at the root. But the most common export shape is an envelope —
   * {data:[...]}, {results:[...]}, {items:[...]} — and for those the whole
   * mechanism switched off: no model, no window, no pager, and a multi-MB
   * document handed to CM6 whole, which is exactly the size where its diff
   * gives up and returns one change covering everything.
   *
   * So: use the root when both sides are arrays, otherwise the shared object key
   * holding the biggest array on both sides. Depth 1 only — that covers the
   * envelope shapes without turning this into a search over the whole document.
   *
   * @returns {{path: string|null, a: Array, b: Array} | null}
   */
  function findCollection(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return { path: null, a: a, b: b };
    if (!isPlainObject(a) || !isPlainObject(b)) return null;
    var best = null, k;
    for (k in a) {
      if (!hasOwn(a, k) || !hasOwn(b, k)) continue;
      if (!Array.isArray(a[k]) || !Array.isArray(b[k])) continue;
      var n = a[k].length + b[k].length;
      if (!best || n > best.n) best = { path: k, a: a[k], b: b[k], n: n };
    }
    // A one-element array is not a collection worth paging; let it render pretty.
    return best && best.n > 1 ? best : null;
  }

  /**
   * Render the object shell around a collection: every other key aligned
   * normally, with the already-rendered collection lines spliced in at `path`.
   * Keeps the window bounded (the collection is the only big thing) while the
   * panes still hold a complete, valid JSON object.
   */
  function renderWithShell(pa, pb, path, lines, ctx) {
    var A = lines.A.slice(), B = lines.B.slice();
    A[0] = keyPrefix(A[0], INDENT, path);
    B[0] = keyPrefix(B[0], INDENT, path);
    return alignObject(pa, pb, '', ctx, { key: path, A: A, B: B });
  }

  /* ==================================================================
     GENERIC (non-array) ALIGNMENT — unchanged behaviour
     ================================================================== */

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
    if (Array.isArray(a) && Array.isArray(b)) return alignArrayPretty(a, b, pad, ctx);
    if (isPlainObject(a) && isPlainObject(b)) return alignObject(a, b, pad, ctx);
    return padToEqual(ser(a, pad), ser(b, pad));
  }

  // Fully pretty array alignment (nested arrays, and top-level arrays small
  // enough that everything fits the budget).
  function alignArrayPretty(a, b, pad, ctx) {
    var child = pad + INDENT;
    var n = a.length, m = b.length;
    var A = [pad + '['], B = [pad + '['];

    function pushBoth(la, lb) {
      var i;
      for (i = 0; i < la.length; i++) A.push(la[i]);
      for (i = 0; i < lb.length; i++) B.push(lb[i]);
    }

    var match = matchArray(a, b, ctx.numTol);
    for (var p = 0; p < match.pairs.length; p++) {
      var i = match.pairs[p][0], j = match.pairs[p][1];
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
    A.push(pad + ']'); B.push(pad + ']');
    return { A: A, B: B };
  }

  // `override` (optional) = { key, A, B }: use those pre-rendered lines for that
  // key instead of aligning its value here. Used by renderWithShell so a windowed
  // collection can sit inside a normally-aligned object.
  function alignObject(a, b, pad, ctx, override) {
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
        // Pre-rendered collection (already gap-aligned, equal line counts).
        if (override && override.key === e.k) {
          var oA = override.A.slice(), oB = override.B.slice();
          if (commaA) addComma(oA);
          if (commaB) addComma(oB);
          pushBoth(oA, oB);
        // Ignored property present on both sides → normalize to the "a" value
        // on BOTH sides so MergeView sees no change.
        } else if (ctx.ignore && ctx.ignore(e.k, a[e.k], b[e.k])) {
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

  function parsePair(leftText, rightText) {
    if (typeof leftText !== 'string' || typeof rightText !== 'string') return null;
    if (!leftText.trim() || !rightText.trim()) return null;
    if (leftText.length + rightText.length > MAX_BYTES) return null;
    try { return { a: JSON.parse(leftText), b: JSON.parse(rightText) }; }
    catch (e) { return null; }
  }

  /**
   * Item + field level diff of two JSON texts, with no rendering. Exact at any
   * size — this is what the UI should report and list.
   * @returns {{ok:true, model:object} | {ok:false}}
   */
  function diffModel(leftText, rightText, opts) {
    try {
      var p = parsePair(leftText, rightText);
      if (!p) return { ok: false };
      var coll = findCollection(p.a, p.b);
      if (!coll) return { ok: false, reason: 'no-collection' };
      var m = buildModel(coll.a, coll.b, makeCtx(opts));
      m.path = coll.path;
      return { ok: true, model: m };
    } catch (e) {
      return { ok: false, error: e && e.message };
    }
  }

  /**
   * Parse + match + model ONCE, and hand back a renderer that can be called
   * repeatedly with different windows.
   *
   * Paging must not re-do the expensive half. Re-running align() per page meant
   * re-parsing both documents (~20 MB of text into ~2×10⁵ objects) and
   * rebuilding the match and model every time the user pressed Next — several
   * seconds a page. None of that depends on which window is rendered.
   *
   * @returns {{ok:true, model, render:(o)=>({left,right,changed,stats})} | {ok:false}}
   */
  function prepare(leftText, rightText, opts) {
    try {
      var p = parsePair(leftText, rightText);
      if (!p) return { ok: false };
      // The root pair when both are arrays, else the envelope key holding the
      // collection ({data:[...]} and friends) — see findCollection.
      var coll = findCollection(p.a, p.b);
      if (!coll) return { ok: false, reason: 'no-collection' };
      var rootIsArray = coll.path === null;
      var baseCtx = makeCtx(opts);
      var model = buildModel(coll.a, coll.b, baseCtx);
      model.path = coll.path;
      return makeHandle(p.a, p.b, coll, rootIsArray, model, opts,
                        leftText.length + rightText.length);
    } catch (e) {
      return { ok: false, error: e && e.message };
    }
  }

  // Fraction of emitted lines where the two sides are not byte-identical.
  // This is the practical stand-in for Myers' D: near 0 means CM6 will find the
  // diff almost instantly however hard we let it try; near 1 means it cannot
  // find one at any price, and asking it to try harder only burns time.
  function lineDiffRatio(A, B) {
    var n = Math.max(A.length, B.length);
    if (!n) return 0;
    var differing = 0;
    for (var i = 0; i < n; i++) {
      if ((A[i] === undefined ? '' : A[i]) !== (B[i] === undefined ? '' : B[i])) differing++;
    }
    return differing / n;
  }

  // The reusable render closure shared by prepare() and prepareAsync().
  // Rendering is deliberately synchronous: a window is bounded by design, so it
  // costs ~10-20 ms whether the collection has 60 records or 2,000,000.
  function makeHandle(rootA, rootB, coll, rootIsArray, model, opts, combined) {
    var pageSize = pageSizeFor(coll.a, coll.b, (opts && opts.budget) || EXPAND_CHAR_BUDGET);
    return {
      ok: true,
      model: model,
      render: function (o) {
        o = o || {};
        // Fresh ctx per render: `changed` reports what THIS render normalized.
        var ctx = makeCtx(opts);
        var view = o.view || 'auto';
        if (view === 'auto') view = combined <= PRETTY_MAX_BYTES ? 'pretty' : 'window';
        var res, stats;
        if (view === 'pretty') {
          // Small enough to show whole: the ordinary pretty alignment, which
          // already handles an envelope object around the array.
          res = rootIsArray ? alignArrayPretty(rootA, rootB, '', ctx)
                            : alignValue(rootA, rootB, '', ctx);
          stats = {
            view: 'pretty', from: 0, to: model.items.length, shown: model.items.length,
            itemsTotal: model.items.length, expanded: model.totals.changed, compacted: 0,
            changedTotal: model.totals.changed, truncated: false, budgetHit: false
          };
        } else {
          var arr = renderArray(coll.a, coll.b, model, ctx, {
            view: view, from: o.from, size: o.size, budget: o.budget
          }, rootIsArray ? '' : INDENT);
          stats = arr.stats;
          res = rootIsArray ? arr : renderWithShell(rootA, rootB, coll.path, arr, ctx);
        }
        stats.pageSize = pageSize;
        // How much of what we just emitted actually differs, line for line.
        // The caller needs this to decide how hard CM6 should try: Myers costs
        // O((N+M)*D), so on a near-identical page a high scanLimit is free,
        // while on a mostly-different page it is ruinous and buys nothing.
        // One pass over the rendered lines — a few ms at any page size.
        stats.diffLineRatio = lineDiffRatio(res.A, res.B);
        return {
          ok: true, left: res.A.join('\n'), right: res.B.join('\n'),
          changed: ctx.changed, model: model, stats: stats
        };
      }
    };
  }

  /**
   * Interruptible twin of prepare(): identical result, built in slices that
   * yield to the browser, report progress, and stop when the signal is set.
   *
   * Phases reported through ctl.onPhase(key, total) → a per-phase reporter:
   *   'parse'    both documents into values (native, not divisible)
   *   'identity' looking for a stable record id
   *   'match'    pairing records up
   *   'model'    the field-level diff, item by item  ← the one that scales
   *
   * Rendering stays synchronous: it is bounded by the record window, so it
   * costs ~10-20 ms regardless of collection size.
   *
   * @param {object} ctl { signal:{cancelled}, onPhase(key,total)->{onProgress} }
   * @returns {Promise<{ok:true, model, render} | {ok:false}>}
   *          Rejects with a Cancelled error (err.cancelled === true) if stopped.
   */
  function prepareAsync(leftText, rightText, opts, ctl) {
    return Promise.resolve().then(function () {
      if (typeof leftText !== 'string' || typeof rightText !== 'string') return { ok: false };
      if (!leftText.trim() || !rightText.trim()) return { ok: false };
      if (leftText.length + rightText.length > MAX_BYTES) return { ok: false };

      var parseRep = phaseCtl(ctl, 'parse', 2);
      var pa, pb;
      try { pa = JSON.parse(leftText); } catch (e) { return { ok: false }; }
      if (parseRep && parseRep.onProgress) parseRep.onProgress(1, 2);
      if (cancelledBy(ctl)) throw new Cancelled();

      // Yield between the two parses: each is a single uninterruptible native
      // call, so this is the only place the panel can paint during parsing.
      return yieldNow().then(function () {
        try { pb = JSON.parse(rightText); } catch (e) { return { ok: false }; }
        if (parseRep && parseRep.onProgress) parseRep.onProgress(2, 2);
        if (cancelledBy(ctl)) throw new Cancelled();

        var coll = findCollection(pa, pb);
        if (!coll) return { ok: false, reason: 'no-collection' };
        var rootIsArray = coll.path === null;
        var baseCtx = makeCtx(opts);

        return buildModelAsync(coll.a, coll.b, baseCtx, ctl).then(function (model) {
          model.path = coll.path;
          return makeHandle(pa, pb, coll, rootIsArray, model, opts,
                            leftText.length + rightText.length);
        });
      });
    });
  }

  /**
   * Align two JSON texts for block-level diffing (with optional ignore + numeric
   * tolerance). Ignored props and numbers within `numTol` are emitted as a's
   * value on both sides so MergeView sees no change.
   *
   * For a top-level array the item/field model is computed first and returned
   * alongside the text, so the caller can report counts that do NOT depend on
   * how much was rendered.
   *
   * @param {object} [opts] - { ignore?, numTol?, expandFrom?, expandCount?, budget? }
   * @returns {{ok:true, left, right, changed, model?, stats?} | {ok:false}}
   *          ok:false means "could not align" — caller should fall back to
   *          the raw text + CodeMirror's default diff.
   */
  function align(leftText, rightText, opts) {
    try {
      var p = parsePair(leftText, rightText);
      if (!p) return { ok: false };
      var ctx = makeCtx(opts);
      var o = opts || {};

      // Whenever there is a collection to work with — a root array, or an
      // envelope object around one — go through prepare(), so the item/field
      // model and the record window apply regardless of the wrapper.
      if (findCollection(p.a, p.b)) {
        // The model is always computed: item and field counts must not depend
        // on how much of the document we choose to render.
        var h = prepare(leftText, rightText, opts);
        if (h.ok) return h.render(o);
      }

      var v = alignValue(p.a, p.b, '', ctx);
      return {
        ok: true, left: v.A.join('\n'), right: v.B.join('\n'), changed: ctx.changed,
        // No collection here (a plain object pair), so no model or window — but
        // the caller still needs to know how similar the two sides are before it
        // decides how hard to let CM6 try. See MYERS_MAX_DIFF_RATIO.
        stats: { view: 'value', diffLineRatio: lineDiffRatio(v.A, v.B) }
      };
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
      var p = parsePair(leftText, rightText);
      if (!p) return { ok: false };
      var ctx = { ignore: hasIgnore ? ignore : null, changed: false, numTol: tol };
      var leftLines = ser(p.a, '');
      var rightLines = serWithSwap(p.b, p.a, ctx, '');
      return {
        ok: true, left: leftLines.join('\n'), right: rightLines.join('\n'),
        changed: ctx.changed,
        stats: { view: 'normalized', diffLineRatio: lineDiffRatio(leftLines, rightLines) }
      };
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

  window.JSONAlign = {
    align: align,
    prepare: prepare,
    prepareAsync: prepareAsync,
    diffModel: diffModel,
    normalize: normalize,
    stripGaps: stripGaps,
    CancelledError: Cancelled,
    EXPAND_CHAR_BUDGET: EXPAND_CHAR_BUDGET
  };
})();
