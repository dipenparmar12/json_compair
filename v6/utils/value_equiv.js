/*
 * value_equiv.js — "Treat specific values as equivalent" (window.ValueEquiv)
 *
 * Builds ONE function, value -> canonical string: two JSON values are equal
 * under the user's rules exactly when their canonical strings are identical.
 * Modelled on make_canonicalizer() in the csv_diff.py reference: every form
 * carries a type tag, so text never equals a number, boolean, date or the
 * missing token unless a rule the user turned on says so.
 *
 *   \x00 missing (NA)   \x01 text   \x02 number   \x03 boolean   \x04 date
 *   \x05<n> custom group n
 *
 * Rules apply in this order: trim -> custom groups -> NA -> booleans ->
 * numbers -> dates -> ignore case. Display only: nothing here rewrites a value.
 * json_align uses canon() through eqKind (kind 3); index.html uses
 * rowsEquivalent() so the row diff leaves such rows unmarked.
 */
(function (root) {
  'use strict';

  var DEFAULT_NA = ['null', 'NULL', 'None', 'none', 'NaN', 'nan', 'N/A', 'n/a', 'NA', '#N/A'];
  var DEFAULT_GROUPS = [
    { name: 'Missing values', values: ['NaN', 'null', 'None', 'N/A', 'NA'], on: true },
    { name: 'Empty values', values: ['""', 'null'], on: false },
    { name: 'Boolean true', values: ['true', 'True', 'yes', '1'], on: false },
    { name: 'Boolean false', values: ['false', 'False', 'no', '0'], on: false }
  ];
  var DEFAULTS = {
    enabled: false, trim: false, ignoreCase: false, na: false, naValues: DEFAULT_NA,
    booleans: false, numeric: false, dates: false, groups: DEFAULT_GROUPS
  };

  // Plain decimal / scientific notation only — arbitrary text is never a number.
  var NUM_RE = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;
  var NUM_SPECIAL = { nan: 'NaN', inf: 'Infinity', infinity: 'Infinity', '+inf': 'Infinity',
    '+infinity': 'Infinity', '-inf': '-Infinity', '-infinity': '-Infinity' };
  // Whole words only: single letters (t/f/y/n) are too often real text.
  var BOOLS = { 'true': 'true', yes: 'true', 'false': 'false', no: 'false' };
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?)?(Z|[+-]\d{2}:?\d{2})?$/;
  var US_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;   // MM/DD/YYYY

  // Exact canonical text for a decimal string: 1 == 1.0 == 1e0 == 01, -0 == 0.
  // No float conversion, so "0.1" and "0.10000000000000001" stay different.
  function canonNumber(s) {
    var m = NUM_RE.exec(s);
    if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
      return NUM_SPECIAL[s.toLowerCase()] || null;
    }
    var frac = m[3] || '';
    var digits = (m[2] + frac).replace(/^0+/, '');
    if (!digits) return '0';
    var exp = (m[4] ? parseInt(m[4], 10) : 0) - frac.length;
    var t = digits.replace(/0+$/, '');
    exp += digits.length - t.length;
    return (m[1] === '-' ? '-' : '') + t + 'e' + exp;
  }

  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }

  // Canonical ISO form; a date alone means midnight (as Python's fromisoformat).
  // With a zone the instant is converted to UTC; without one it stays naive.
  function canonDate(s) {
    var m = ISO_RE.exec(s), y, mo, d, h = 0, mi = 0, se = 0, frac = '', tz = null;
    if (m) {
      y = +m[1]; mo = +m[2]; d = +m[3];
      if (m[4] !== undefined) { h = +m[4]; mi = +m[5]; se = m[6] ? +m[6] : 0; }
      frac = m[7] ? m[7].slice(1).replace(/0+$/, '') : '';
      tz = m[8] || null;
    } else if ((m = US_RE.exec(s))) {
      mo = +m[1]; d = +m[2]; y = +m[3];
    } else return null;
    var t = Date.UTC(y, mo - 1, d, h, mi, se);
    var dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d ||
        h > 23 || mi > 59 || se > 59) return null;     // 2026-02-30, 25:00 → text
    if (tz && tz !== 'Z') {
      var sign = tz[0] === '-' ? -1 : 1, z = tz.slice(1).replace(':', '');
      dt = new Date(t - sign * (+z.slice(0, 2) * 60 + +z.slice(2)) * 60000);
    }
    var out = pad(dt.getUTCFullYear(), 4) + '-' + pad(dt.getUTCMonth() + 1, 2) + '-' +
      pad(dt.getUTCDate(), 2) + 'T' + pad(dt.getUTCHours(), 2) + ':' +
      pad(dt.getUTCMinutes(), 2) + ':' + pad(dt.getUTCSeconds(), 2) + (frac ? '.' + frac : '');
    return tz ? out + 'Z' : out;
  }

  // How a value is written in a rule: null / true / 12 by their JSON text, a
  // string by its content. A rule token `""` means the empty string.
  function token(t) { t = String(t); return t === '""' ? '' : t; }
  function display(v) { return typeof v === 'string' ? v : v === null ? 'null' : String(v); }

  /**
   * @param {object} cfg - { enabled, trim, ignoreCase, na, naValues[], booleans,
   *                         numeric, dates, groups:[{name, values[], on}] }
   * @returns {function|null} value -> canonical string; null when no rule is on
   */
  function make(cfg) {
    cfg = cfg || {};
    if (!cfg.enabled) return null;
    var fold = function (s) { return cfg.ignoreCase ? s.toLowerCase() : s; };
    var groups = Object.create(null), anyGroup = false;
    (cfg.groups || []).forEach(function (g, i) {
      if (!g || !g.on) return;
      (g.values || []).forEach(function (t) {
        t = fold(cfg.trim ? token(t).trim() : token(t));
        if (!(t in groups)) { groups[t] = '\x05' + i; anyGroup = true; }
      });
    });
    var na = null;
    if (cfg.na) {
      na = Object.create(null);
      na[''] = 1;
      (cfg.naValues || DEFAULT_NA).forEach(function (t) { na[token(t)] = 1; });
    }
    if (!anyGroup && !na && !cfg.trim && !cfg.ignoreCase && !cfg.booleans &&
        !cfg.numeric && !cfg.dates) return null;

    var memo = new Map();
    function canonOf(v) {
      var isStr = typeof v === 'string';
      var s = display(v);
      if (cfg.trim && isStr) s = s.trim();
      if (anyGroup) { var g = groups[fold(s)]; if (g) return g; }
      if (na && (v === null || (isStr && na[s]))) return '\x00';
      if (typeof v === 'boolean') return '\x03' + v;
      if (cfg.booleans && isStr && s.length <= 5) {
        var b = BOOLS[s.toLowerCase()];
        if (b) return '\x03' + b;
      }
      if (v === null) return '\x00null';
      if (typeof v === 'number') return '\x02' + (cfg.numeric ? canonNumber(String(v)) || s : s);
      if (cfg.numeric) { var n = canonNumber(s); if (n !== null) return '\x02' + n; }
      if (cfg.dates) { var d = canonDate(s); if (d !== null) return '\x04' + d; }
      return '\x01' + fold(s);
    }
    return function canon(v) {
      if (typeof v !== 'string') return canonOf(v);
      var c = memo.get(v);
      if (c === undefined) {
        c = canonOf(v);
        if (memo.size > 50000) memo.clear();   // bounded; values repeat a lot in exports
        memo.set(v, c);
      }
      return c;
    };
  }

  // Deep equality where primitives compare by canonical form.
  function equal(x, y, canon) {
    if (x === y) return true;
    var ox = x !== null && typeof x === 'object', oy = y !== null && typeof y === 'object';
    if (!ox && !oy) return canon(x) === canon(y);
    if (!ox || !oy || Array.isArray(x) !== Array.isArray(y)) return false;
    var kx = Object.keys(x), ky = Object.keys(y), i;
    if (kx.length !== ky.length) return false;
    for (i = 0; i < kx.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(y, kx[i]) || !equal(x[kx[i]], y[kx[i]], canon)) return false;
    }
    return true;
  }

  var KEY_RE = /^\s*("(?:[^"\\]|\\.)*")\s*:\s*([\s\S]*)$/;
  function splitRow(line) {
    var s = line.replace(/,\s*$/, ''), m = KEY_RE.exec(s);
    try {
      return m ? { key: JSON.parse(m[1]), value: JSON.parse(m[2]) }
               : { key: undefined, value: JSON.parse(s) };
    } catch (e) { return null; }
  }

  /**
   * Are two rendered rows the same under the rules? `"a": "NaN",` vs `"a": null`
   * → true. Rows holding a whole compact record compare value by value. A row
   * that is not a complete JSON value (`{`, `]`) → false; the caller diffs it.
   */
  function rowsEquivalent(a, b, canon) {
    if (!canon) return false;
    var x = splitRow(a), y = splitRow(b);
    return !!(x && y && x.key === y.key && equal(x.value, y.value, canon));
  }

  root.ValueEquiv = {
    DEFAULTS: DEFAULTS, DEFAULT_NA: DEFAULT_NA,
    make: make, equal: equal, rowsEquivalent: rowsEquivalent,
    canonNumber: canonNumber, canonDate: canonDate
  };
})(typeof window !== 'undefined' ? window : this);
