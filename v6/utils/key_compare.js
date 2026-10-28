/**
 * key_compare.js — key-by-key comparison of two parsed JSON documents.
 *
 * The editors answer "what does the text look like side by side". This
 * answers "which keys match, which values differ, which keys exist on only
 * one side" as a flat table that can be filtered and exported — what you
 * need when two records carry thousands of columns and most of the question
 * is about the schema, not the text.
 *
 * Compares PARSED values, so whitespace, indentation and key order can never
 * register as a difference. Honours the app's ignore predicate and numeric
 * tolerance, and pairs array elements with JSONAlign.matchArray — the same
 * pairing the editors draw — so the table and the panes cannot disagree about
 * which records correspond.
 *
 * Exposed as window.KeyCompare:
 *   compare(left, right, opts)    → { rows[], totals, rootArray, truncated }
 *   columns(result)               → per-key aggregate over every record
 *   FILTERS                       → [{ key, label, hint }] in display order
 *   matches(item, filter, query, isColumn)
 *   counts(items, isColumn)       → { [filterKey]: n }
 *   preview(value, max)           → short JSON for a table cell
 *   toCSV(items, isColumn, labels) / toJSON(items, isColumn, meta)
 *   parsePath(path)               → ['key', 3, 'nested'] (numbers = indices)
 */
(function () {
  'use strict';

  // Row cap: the table is virtualized, but every row is an object in memory.
  // 2,000 records × 158 columns is 316k rows; this leaves plenty of headroom.
  var MAX_ROWS = 2000000;

  var hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var isPlainObject = function (v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  };

  function typeName(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  var IDENT = /^[A-Za-z_$][\w$]*$/;
  function keySeg(path, k) {
    if (IDENT.test(k)) return path ? path + '.' + k : k;
    return path + '[' + JSON.stringify(k) + ']';
  }

  /**
   * Value equality: 'eq' | 'tol' (equal only within numeric tolerance) | false.
   * Deep, key-order independent.
   */
  function equalKind(a, b, tol) {
    if (a === b) return 'eq';
    var ta = typeName(a), tb = typeName(b);
    if (ta !== tb) return false;
    if (ta === 'number') {
      return (tol != null && Math.abs(a - b) <= tol) ? 'tol' : false;
    }
    if (ta === 'array') {
      if (a.length !== b.length) return false;
      var kind = 'eq';
      for (var i = 0; i < a.length; i++) {
        var k = equalKind(a[i], b[i], tol);
        if (!k) return false;
        if (k === 'tol') kind = 'tol';
      }
      return kind;
    }
    if (ta === 'object') {
      var ka = Object.keys(a);
      if (ka.length !== Object.keys(b).length) return false;
      var kind2 = 'eq';
      for (var j = 0; j < ka.length; j++) {
        if (!hasOwn(b, ka[j])) return false;
        var k2 = equalKind(a[ka[j]], b[ka[j]], tol);
        if (!k2) return false;
        if (k2 === 'tol') kind2 = 'tol';
      }
      return kind2;
    }
    return false;
  }

  // Key order for a pair of objects, the way the editors lay it out: the
  // left's order, with each right-only key placed after the key that
  // precedes it on the right (json_align's alignObject does the same).
  function keyOrder(x, y) {
    var xk = Object.keys(x), yk = Object.keys(y), out = [], i;
    var START = {}, after = new Map(), prev = START;
    for (i = 0; i < yk.length; i++) {
      if (hasOwn(x, yk[i])) { prev = yk[i]; continue; }
      if (!after.has(prev)) after.set(prev, []);
      after.get(prev).push(yk[i]);
    }
    var flush = function (k) {
      var list = after.get(k);
      if (list) for (var q = 0; q < list.length; q++) out.push(list[q]);
    };
    flush(START);
    for (i = 0; i < xk.length; i++) {
      out.push(xk[i]);
      if (hasOwn(y, xk[i])) flush(xk[i]);
    }
    return out;
  }

  /**
   * Compare two parsed documents.
   * @param {*} left
   * @param {*} right
   * @param {object} [opts]
   *   ignore(key, aVal, bVal) → bool   key/pattern exclusion (DiffIgnore predicate)
   *   numTol                           max |a-b| treated as equal, or null
   *   matchArray(a, b, tol) → {pairs}  element pairing (JSONAlign.matchArray)
   *   maxRows
   * @returns {{rows: object[], totals: object, rootArray: boolean, truncated: boolean}}
   *   row: { path, col, status, left, right, li, ri, note }
   *     status  'equal' | 'changed' | 'leftOnly' | 'rightOnly' | 'ignored'
   *     col     path with every array index replaced by [*] — the "column"
   *     li/ri   index of the top-level record the row belongs to (root arrays)
   *     note    'type' (value changed type) | 'tolerance' (equal within numTol)
   */
  function compare(left, right, opts) {
    opts = opts || {};
    var ignore = typeof opts.ignore === 'function' ? opts.ignore : null;
    var tol = (typeof opts.numTol === 'number' && isFinite(opts.numTol) && opts.numTol > 0) ? opts.numTol : null;
    var match = typeof opts.matchArray === 'function' ? opts.matchArray : positionalPairs;
    var maxRows = opts.maxRows || MAX_ROWS;
    var rows = [];
    var totals = { equal: 0, changed: 0, leftOnly: 0, rightOnly: 0, ignored: 0 };
    var truncated = false;
    var rootArray = Array.isArray(left) && Array.isArray(right);

    function emit(path, col, status, l, r, li, ri, note) {
      if (rows.length >= maxRows) { truncated = true; return; }
      rows.push({ path: path, col: col, status: status, left: l, right: r,
                  li: li, ri: ri, note: note || null });
      totals[status]++;
    }

    function walk(x, y, path, col, li, ri) {
      if (truncated) return;
      if (isPlainObject(x) && isPlainObject(y)) {
        var keys = keyOrder(x, y);
        if (!keys.length) { emit(path, col, 'equal', x, y, li, ri); return; }
        for (var i = 0; i < keys.length && !truncated; i++) {
          var k = keys[i], inX = hasOwn(x, k), inY = hasOwn(y, k);
          var p = keySeg(path, k), c = keySeg(col, k);
          if (ignore && ignore(k, inX ? x[k] : undefined, inY ? y[k] : undefined)) {
            emit(p, c, 'ignored', inX ? x[k] : undefined, inY ? y[k] : undefined, li, ri);
          } else if (inX && inY) {
            walk(x[k], y[k], p, c, li, ri);
          } else if (inX) {
            emit(p, c, 'leftOnly', x[k], undefined, li, ri);
          } else {
            emit(p, c, 'rightOnly', undefined, y[k], li, ri);
          }
        }
        return;
      }
      if (Array.isArray(x) && Array.isArray(y)) {
        if (!x.length && !y.length) { emit(path, col, 'equal', x, y, li, ri); return; }
        var top = path === '' && rootArray;
        var pairs = match(x, y, tol).pairs;
        for (var q = 0; q < pairs.length && !truncated; q++) {
          var i2 = pairs[q][0], j2 = pairs[q][1];
          var at = i2 !== null ? i2 : j2;
          var p2 = path + '[' + at + ']', c2 = col + '[*]';
          var rli = top ? i2 : li, rri = top ? j2 : ri;
          if (i2 !== null && j2 !== null) walk(x[i2], y[j2], p2, c2, rli, rri);
          else if (i2 !== null) emit(p2, c2, 'leftOnly', x[i2], undefined, rli, rri);
          else emit(p2, c2, 'rightOnly', undefined, y[j2], rli, rri);
        }
        return;
      }
      var kind = equalKind(x, y, tol);
      if (kind) emit(path, col, 'equal', x, y, li, ri, kind === 'tol' ? 'tolerance' : null);
      else emit(path, col, 'changed', x, y, li, ri, typeName(x) !== typeName(y) ? 'type' : null);
    }

    walk(left, right, '', '', null, null);
    return { rows: rows, totals: totals, rootArray: rootArray, truncated: truncated };
  }

  // Fallback pairing when JSONAlign is not loaded: index by index.
  function positionalPairs(a, b) {
    var pairs = [], n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i++) pairs.push([i < a.length ? i : null, i < b.length ? i : null]);
    return { pairs: pairs };
  }

  // A column's name as a reader would say it. For a root array every path
  // starts with the record ("[*].UUID"), which says nothing — drop it.
  // A single top-level key is shown bare even when a path would quote it:
  // `WI-opt-step1-tou`, not `["WI-opt-step1-tou"]`.
  var ONE_QUOTED = /^\["(?:[^"\\]|\\.)*"\]$/;
  function columnLabel(col, rootArray) {
    var s = col;
    if (rootArray) {
      if (col === '[*]') return '(whole record)';
      if (col.indexOf('[*].') === 0) s = col.slice(4);
      else if (col.indexOf('[*]') === 0) s = col.slice(3);
    }
    if (ONE_QUOTED.test(s)) return JSON.parse(s.slice(1, -1));
    return s || '(root)';
  }

  /**
   * One entry per column (path with indices collapsed), in first-seen order,
   * counting how that key compared across every record.
   *   status  'equal' | 'changed' | 'leftOnly' | 'rightOnly' | 'ignored' | 'mixed'
   *   first   a representative row — the first that differs, else the first
   */
  function columns(result) {
    var byCol = new Map(), list = [];
    var rows = result.rows;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], c = byCol.get(r.col);
      if (!c) {
        c = { col: r.col, label: columnLabel(r.col, result.rootArray), first: r, n: 0,
              equal: 0, changed: 0, leftOnly: 0, rightOnly: 0, ignored: 0, status: null };
        byCol.set(r.col, c);
        list.push(c);
      }
      c[r.status]++;
      c.n++;
      if (c.first.status === 'equal' && r.status !== 'equal') c.first = r;
    }
    for (var j = 0; j < list.length; j++) list[j].status = columnStatus(list[j]);
    return list;
  }

  function columnStatus(c) {
    var both = c.equal + c.changed, only = c.leftOnly + c.rightOnly;
    if (!both && !only) return 'ignored';
    if (!only) return c.changed ? 'changed' : 'equal';
    if (!both) {
      if (!c.rightOnly) return 'leftOnly';
      if (!c.leftOnly) return 'rightOnly';
    }
    return 'mixed';
  }

  // The filters, in display order. `hint` is the tooltip.
  var FILTERS = [
    { key: 'all', label: 'All', hint: 'Every compared key' },
    { key: 'valueDiff', label: 'Different values', hint: 'Key on both sides, value differs' },
    { key: 'keyDiff', label: 'Different keys', hint: 'Key exists on only one side' },
    { key: 'leftOnly', label: 'Only in left', hint: 'Key missing on the right' },
    { key: 'rightOnly', label: 'Only in right', hint: 'Key missing on the left' },
    { key: 'keysMatch', label: 'Matching keys', hint: 'Key on both sides, whatever the value' },
    { key: 'valuesMatch', label: 'Matching values', hint: 'Key on both sides with an equal value' },
    { key: 'ignored', label: 'Ignored', hint: 'Excluded by an ignore pattern' }
  ];

  /**
   * Does a row (or column aggregate) belong under a filter? For a column the
   * question is asked of every record: "Different values" = differs in at
   * least one record, "Matching values" = equal in every record that has it.
   */
  function inFilter(item, filter, isColumn) {
    if (filter === 'all') return true;
    if (!isColumn) {
      var s = item.status;
      switch (filter) {
        case 'valueDiff': return s === 'changed';
        case 'keyDiff': return s === 'leftOnly' || s === 'rightOnly';
        case 'leftOnly': return s === 'leftOnly';
        case 'rightOnly': return s === 'rightOnly';
        case 'keysMatch': return s === 'equal' || s === 'changed';
        case 'valuesMatch': return s === 'equal';
        case 'ignored': return s === 'ignored';
      }
      return true;
    }
    var only = item.leftOnly + item.rightOnly, both = item.equal + item.changed;
    switch (filter) {
      case 'valueDiff': return item.changed > 0;
      case 'keyDiff': return only > 0;
      case 'leftOnly': return item.leftOnly > 0;
      case 'rightOnly': return item.rightOnly > 0;
      case 'keysMatch': return both > 0 && !only;
      case 'valuesMatch': return item.equal > 0 && !item.changed && !only;
      case 'ignored': return item.ignored > 0;
    }
    return true;
  }

  function matches(item, filter, query, isColumn) {
    if (!inFilter(item, filter, isColumn)) return false;
    if (!query) return true;
    var name = isColumn ? item.label : item.path;
    if (name.toLowerCase().indexOf(query) !== -1) return true;
    var row = isColumn ? item.first : item;
    return valueHas(row.left, query) || valueHas(row.right, query);
  }

  function valueHas(v, q) {
    if (v === undefined || (v !== null && typeof v === 'object')) return false;
    return String(v).toLowerCase().indexOf(q) !== -1;
  }

  function counts(items, isColumn) {
    var out = {};
    for (var f = 0; f < FILTERS.length; f++) out[FILTERS[f].key] = 0;
    for (var i = 0; i < items.length; i++) {
      for (var g = 0; g < FILTERS.length; g++) {
        if (inFilter(items[i], FILTERS[g].key, isColumn)) out[FILTERS[g].key]++;
      }
    }
    return out;
  }

  /** Short JSON for a table cell; undefined (missing) → ''. */
  function preview(v, max) {
    if (v === undefined) return '';
    var s;
    try { s = JSON.stringify(v); } catch (e) { s = String(v); }
    if (s === undefined) s = String(v);
    max = max || 200;
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  /* ------------------------------------------------------------------
     EXPORT
     ------------------------------------------------------------------ */
  var STATUS_LABEL = {
    equal: 'match', changed: 'different', leftOnly: 'only in left',
    rightOnly: 'only in right', ignored: 'ignored', mixed: 'partial'
  };

  function missingOn(status) {
    if (status === 'leftOnly') return 'right';
    if (status === 'rightOnly') return 'left';
    return '';
  }

  function noteText(row) {
    if (row.note === 'type') return 'type ' + typeName(row.left) + ' → ' + typeName(row.right);
    if (row.note === 'tolerance') return 'equal within numeric tolerance';
    return '';
  }

  // CSV cell: strings as-is (so a spreadsheet shows SACRAMENTO, not
  // "SACRAMENTO"), everything else as JSON. `missing_on` and `note` resolve the
  // ambiguities that leaves — missing vs "", null vs "null".
  function csvValue(v) {
    if (v === undefined) return '';
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  }

  function csvCell(s) {
    s = String(s);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csvLine(cells) {
    var out = [];
    for (var i = 0; i < cells.length; i++) out.push(csvCell(cells[i]));
    return out.join(',');
  }

  /**
   * @param {object[]} items    rows, or column aggregates
   * @param {boolean} isColumn
   * @param {{left?: string, right?: string}} [labels] panel names for headers
   */
  function toCSV(items, isColumn, labels) {
    var L = (labels && labels.left) || 'left', R = (labels && labels.right) || 'right';
    var lines = [], i, it;
    if (isColumn) {
      lines.push(csvLine(['key', 'status', 'missing_on', 'records_equal', 'records_different',
        'records_only_left', 'records_only_right', 'records_ignored',
        L + '_value', R + '_value', 'note']));
      for (i = 0; i < items.length; i++) {
        it = items[i];
        lines.push(csvLine([it.label, STATUS_LABEL[it.status], missingOn(it.status),
          it.equal, it.changed, it.leftOnly, it.rightOnly, it.ignored,
          csvValue(it.first.left), csvValue(it.first.right), noteText(it.first)]));
      }
    } else {
      lines.push(csvLine(['path', 'status', 'missing_on', L + '_value', R + '_value',
        L + '_record', R + '_record', 'note']));
      for (i = 0; i < items.length; i++) {
        it = items[i];
        lines.push(csvLine([it.path, STATUS_LABEL[it.status], missingOn(it.status),
          csvValue(it.left), csvValue(it.right),
          it.li == null ? '' : it.li + 1, it.ri == null ? '' : it.ri + 1, noteText(it)]));
      }
    }
    // BOM so Excel reads UTF-8; CRLF per RFC 4180.
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  /** JSON report — values kept as real JSON values; a missing side is omitted. */
  function toJSON(items, isColumn, meta) {
    var out = [], i, it, o;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (isColumn) {
        o = { key: it.label, status: STATUS_LABEL[it.status],
              records: { equal: it.equal, different: it.changed, onlyLeft: it.leftOnly,
                         onlyRight: it.rightOnly, ignored: it.ignored } };
        if (missingOn(it.status)) o.missingOn = missingOn(it.status);
        if (it.first.left !== undefined) o.left = it.first.left;
        if (it.first.right !== undefined) o.right = it.first.right;
        if (noteText(it.first)) o.note = noteText(it.first);
      } else {
        o = { path: it.path, status: STATUS_LABEL[it.status] };
        if (missingOn(it.status)) o.missingOn = missingOn(it.status);
        if (it.left !== undefined) o.left = it.left;
        if (it.right !== undefined) o.right = it.right;
        if (it.li != null) o.leftRecord = it.li + 1;
        if (it.ri != null) o.rightRecord = it.ri + 1;
        if (noteText(it)) o.note = noteText(it);
      }
      out.push(o);
    }
    var doc = {};
    if (meta) for (var k in meta) if (hasOwn(meta, k)) doc[k] = meta[k];
    doc[isColumn ? 'keys' : 'rows'] = out;
    return JSON.stringify(doc, null, 2);
  }

  /** 'a.b[3]["x y"]' → ['a', 'b', 3, 'x y'] */
  function parsePath(path) {
    var out = [], i = 0, n = path.length;
    while (i < n) {
      var ch = path.charAt(i);
      if (ch === '.') { i++; continue; }
      if (ch === '[') {
        if (path.charAt(i + 1) === '"') {
          // A JSON string literal; find its closing quote, honouring escapes.
          var j = i + 2;
          while (j < n && path.charAt(j) !== '"') j += path.charAt(j) === '\\' ? 2 : 1;
          out.push(JSON.parse(path.slice(i + 1, j + 1)));
          i = j + 2;
        } else {
          var close = path.indexOf(']', i);
          var tok = path.slice(i + 1, close);
          out.push(tok === '*' ? tok : parseInt(tok, 10));
          i = close + 1;
        }
        continue;
      }
      var end = i;
      while (end < n && path.charAt(end) !== '.' && path.charAt(end) !== '[') end++;
      out.push(path.slice(i, end));
      i = end;
    }
    return out;
  }

  window.KeyCompare = {
    compare: compare,
    columns: columns,
    FILTERS: FILTERS,
    STATUS_LABEL: STATUS_LABEL,
    matches: matches,
    counts: counts,
    preview: preview,
    toCSV: toCSV,
    toJSON: toJSON,
    parsePath: parsePath,
    noteText: noteText
  };
})();
