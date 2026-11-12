/*
 * json_context.js — what is on a line of pretty-printed JSON (window.JSONContext)
 *
 * The right-click menu needs to know what the pointer is on: which key, which
 * value, and where in the document. The panes hold pretty-printed JSON, one
 * property or element per line, so this reads it from the text: the line itself
 * gives the key and value, and walking UP by indentation gives the path.
 *
 *   at(getLine, lineNo) → { key, value, hasValue, segs, opens } | null
 *     getLine(n)  1-based line text, '' / undefined past either end
 *     key         property name, or undefined for an array element
 *     value       the parsed value when the line holds a complete one
 *     opens       '{' or '[' when the line opens an object / array instead
 *     segs        path from the root: strings for keys, numbers for indices
 *   null for a blank (gap) line and for a closing bracket.
 *
 *   formatPath(segs)  → a.b[3]["x y"]   (KeyCompare.parsePath reads it back)
 *   token(value)      → how a value is written in an equivalence group
 *
 * Indices are counted from the text, so blank gap lines (records that exist
 * only on the other side) are skipped and the index is this side's own.
 */
(function (root) {
  'use strict';

  var KEY_RE = /^\s*("(?:[^"\\]|\\.)*")\s*:\s*([\s\S]*)$/;
  var IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

  function indentOf(s) { return s.length - s.replace(/^\s+/, '').length; }

  // One line → { key, value, hasValue, opens }, or null when it is not the
  // start of anything (blank, `}`, `],`).
  function parseLine(text) {
    if (!text || !text.trim()) return null;
    var s = text.replace(/,\s*$/, ''), m = KEY_RE.exec(s), key, rest = s.trim();
    if (m) {
      try { key = JSON.parse(m[1]); } catch (e) { return null; }
      rest = m[2].trim();
    }
    if (rest === '{' || rest === '[') return { key: key, hasValue: false, opens: rest };
    if (rest[0] === '}' || rest[0] === ']') return null;
    try { return { key: key, value: JSON.parse(rest), hasValue: true, opens: null }; }
    catch (e) { return null; }
  }

  function at(getLine, lineNo) {
    var here = parseLine(getLine(lineNo));
    if (!here) return null;
    var segs = [], n = lineNo, cur = here, indent = indentOf(getLine(lineNo));
    for (;;) {
      // Up to the line that opened this one's container, counting the
      // siblings passed on the way (deeper lines belong to those siblings).
      var index = 0, parent = 0, pIndent = 0, i, t, ind;
      for (i = n - 1; i >= 1; i--) {
        t = getLine(i);
        if (!t || !t.trim()) continue;
        ind = indentOf(t);
        if (ind < indent) { parent = i; pIndent = ind; break; }
        if (ind === indent && !/^\s*[\]}]/.test(t)) index++;
      }
      if (!parent) break;                       // `cur` is the root value
      segs.unshift(cur.key !== undefined ? cur.key : index);
      cur = parseLine(getLine(parent));
      if (!cur) break;
      n = parent; indent = pIndent;
    }
    return { key: here.key, value: here.value, hasValue: here.hasValue, opens: here.opens, segs: segs };
  }

  function formatPath(segs) {
    var out = '';
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (typeof s === 'number' || s === '*') out += '[' + s + ']';
      else if (IDENT_RE.test(s)) out += (out ? '.' : '') + s;
      else out += '[' + JSON.stringify(s) + ']';
    }
    return out;
  }

  // A value as an equivalence-group token: null / true / 12 by their JSON text,
  // a string by its content, the empty string as "" (see value_equiv.js).
  function token(v) { return v === '' ? '""' : v === null ? 'null' : String(v); }

  root.JSONContext = { at: at, parseLine: parseLine, formatPath: formatPath, token: token };
})(typeof window !== 'undefined' ? window : this);
