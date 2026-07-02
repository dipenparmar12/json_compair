/* ====================================================================
   diff_ignore.js — exclude keys/patterns from the JSON diff
   --------------------------------------------------------------------
   CodeMirror's MergeView owns the diff and won't accept a custom one. To
   truly EXCLUDE a property (so the record collapses, isn't counted, and
   shows no color), json_align normalizes the matched value to be identical
   on both sides. This module supplies the pure matching logic used both by
   that normalization (via a predicate) and by the grey "ignored" decoration
   (via a line-number scan of the pretty-printed text).

   Match scope (config `ignoreScope`, default 'both'):
     - 'key'   → test the JSON key name
     - 'value' → test the property's (primitive) value
     - 'both'  → match if EITHER the key or the value matches

   Pattern syntax (per entry):
     - plain text     → exact match (key name, or value's string form)
     - "/regex/flags" → RegExp tested against the key / value string

   Pure + dependency-free (no CodeMirror). Exposes window.DiffIgnore.
   ==================================================================== */
(function () {
  'use strict';

  // `  "key": ...`  → captures the (still-escaped) key. Anchored so it only
  // matches genuine object keys, never string values or array elements.
  var KEY_RE = /^\s*"((?:[^"\\]|\\.)*)"\s*:/;

  // Parse one raw pattern string into a descriptor.
  //   kind: 'plain' | 'regex' | 'invalid'
  function parseOne(raw) {
    if (typeof raw !== 'string') return null;
    var s = raw.trim();
    if (!s) return null;
    var m = s.match(/^\/(.*)\/([a-z]*)$/i);
    if (m) {
      try {
        return { source: s, kind: 'regex', re: new RegExp(m[1], m[2]) };
      } catch (e) {
        return { source: s, kind: 'invalid', error: (e && e.message) || 'invalid regex' };
      }
    }
    return { source: s, kind: 'plain', value: s };
  }

  function parsePatterns(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length; i++) {
      var p = parseOne(list[i]);
      if (p) out.push(p);
    }
    return out;
  }

  // A primitive JS value → the string we test patterns against.
  //   "abc" → abc   123 → "123"   true → "true"   null → "null"
  function valueToTestString(v) {
    if (typeof v === 'string') return v;
    if (v === null) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return null; // objects/arrays are not value-matchable
  }

  // Build a matcher from parsed descriptors. Returns null when there are no
  // usable patterns, so callers can cheaply short-circuit.
  //   { testKey(key) , testValueStr(str) , testValue(jsVal) }
  function makeMatcher(parsed) {
    var plain = Object.create(null), regexes = [], hasPlain = false, i;
    for (i = 0; i < parsed.length; i++) {
      var p = parsed[i];
      if (p.kind === 'plain') { plain[p.value] = true; hasPlain = true; }
      else if (p.kind === 'regex') regexes.push(p.re);
    }
    if (!hasPlain && regexes.length === 0) return null;
    function testStr(s) {
      if (typeof s !== 'string') return false;
      if (hasPlain && plain[s] === true) return true;
      for (var j = 0; j < regexes.length; j++) {
        if (regexes[j].test(s)) return true;
      }
      return false;
    }
    return {
      testKey: testStr,
      testValueStr: testStr,
      testValue: function (v) {
        var s = valueToTestString(v);
        return s === null ? false : testStr(s);
      }
    };
  }

  // Build the (key, aVal, bVal) predicate json_align uses to decide whether a
  // property should be normalized/ignored, honoring the match scope.
  function makePredicate(matcher, scope) {
    if (!matcher) return null;
    var s = scope || 'both';
    return function (key, aVal, bVal) {
      if (s !== 'value' && matcher.testKey(key)) return true;
      if (s !== 'key') {
        if (aVal !== undefined && matcher.testValue(aVal)) return true;
        if (bVal !== undefined && matcher.testValue(bVal)) return true;
      }
      return false;
    };
  }

  // Extract & unescape the JSON key on a line. null when the line is not a key.
  function lineKey(line) {
    var m = KEY_RE.exec(line);
    if (!m) return null;
    try { return JSON.parse('"' + m[1] + '"'); } catch (e) { return m[1]; }
  }

  // Column just past the `:` that separates key from value, or -1.
  function valueStartCol(line) {
    var m = KEY_RE.exec(line);
    return m ? m[0].length : -1;
  }

  // The primitive value's comparable string on a key line, or null for a
  // container ({ or [) / non-extractable value. Used for value-scope scanning.
  function lineValueStr(line) {
    var col = valueStartCol(line);
    if (col < 0) return null;
    var rest = line.slice(col).trim();
    if (rest.charAt(rest.length - 1) === ',') rest = rest.slice(0, -1).replace(/\s+$/, '');
    if (rest === '') return null;
    var c0 = rest.charAt(0);
    if (c0 === '{' || c0 === '[') return null;         // container value
    if (c0 === '"') {
      try { return JSON.parse(rest); } catch (e) { return null; }
    }
    return rest;                                        // number / true / false / null
  }

  // Does a key line match, given scope? (key and/or value scope.)
  function lineMatches(line, matcher, scope) {
    var key = lineKey(line);
    if (key === null) return false;
    var s = scope || 'both';
    if (s !== 'value' && matcher.testKey(key)) return true;
    if (s !== 'key') {
      var v = lineValueStr(line);
      if (v !== null && matcher.testValueStr(v)) return true;
    }
    return false;
  }

  // Last line index (0-based) of the value beginning on key line `startIdx`.
  // Primitives end on the same line; objects/arrays span until their brackets
  // balance, respecting strings and blank alignment-gap lines in between.
  function regionEnd(lines, startIdx) {
    var col = valueStartCol(lines[startIdx]);
    if (col < 0) return startIdx;
    var depth = 0, inStr = false, esc = false, started = false;
    for (var i = startIdx; i < lines.length; i++) {
      var st = lines[i];
      var from = (i === startIdx) ? col : 0;
      for (var c = from; c < st.length; c++) {
        var ch = st.charCodeAt(c);
        if (inStr) {
          if (esc) esc = false;
          else if (ch === 92) esc = true;        // backslash
          else if (ch === 34) inStr = false;     // "
          continue;
        }
        if (ch === 34) inStr = true;             // "
        else if (ch === 123 || ch === 91) { depth++; started = true; }  // { [
        else if (ch === 125 || ch === 93) {      // } ]
          depth--;
          if (started && depth <= 0) return i;
        }
      }
      if (!started) return startIdx;             // primitive value on key line
    }
    return lines.length - 1;                       // unbalanced → to end (safe)
  }

  // Given full document text, a matcher and a scope, return a Set of 1-based
  // line numbers belonging to a matched key (key line + its entire value block).
  function computeIgnoredLines(text, matcher, scope) {
    var ignored = new Set();
    if (!matcher || typeof text !== 'string' || !text) return ignored;
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lineKey(lines[i]) === null || !lineMatches(lines[i], matcher, scope)) continue;
      var end = regionEnd(lines, i);
      for (var l = i; l <= end; l++) ignored.add(l + 1);  // 1-based (CM6 doc.line)
      i = end;                                            // skip covered children
    }
    return ignored;
  }

  window.DiffIgnore = {
    parseOne: parseOne,
    parsePatterns: parsePatterns,
    makeMatcher: makeMatcher,
    makePredicate: makePredicate,
    lineKey: lineKey,
    computeIgnoredLines: computeIgnoredLines,
  };
})();
