/* ====================================================================
   diff_ignore.js — exclude keys/patterns from the JSON diff
   --------------------------------------------------------------------
   CodeMirror's MergeView owns the diff and won't accept a custom one, so
   we cannot delete "ignored" keys from the comparison at the engine level.
   Instead this module identifies, purely from the pretty-printed text, the
   line numbers that belong to an excluded key (the key line + its whole
   nested value). index.html turns that into a CM6 line decoration that
   neutralises the red/green highlight (and paints a subdued grey), and the
   diff counter skips chunks that fall entirely inside those lines.

   Matching is by JSON *key name*:
     - plain text        → exact key match  (e.g. "updatedAt")
     - "/regex/flags"    → RegExp tested against the key name (e.g. "/_id$/i")

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

  // Build a fast key-name matcher from parsed descriptors. Returns null when
  // there are no *usable* patterns, so callers can cheaply short-circuit.
  function makeMatcher(parsed) {
    var plain = Object.create(null), regexes = [], hasPlain = false, i;
    for (i = 0; i < parsed.length; i++) {
      var p = parsed[i];
      if (p.kind === 'plain') { plain[p.value] = true; hasPlain = true; }
      else if (p.kind === 'regex') regexes.push(p.re);
    }
    if (!hasPlain && regexes.length === 0) return null;
    return function (key) {
      if (hasPlain && plain[key] === true) return true;
      for (var j = 0; j < regexes.length; j++) {
        if (regexes[j].test(key)) return true;
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

  // Last line index (0-based) of the value beginning on key line `startIdx`.
  // Primitives end on the same line; objects/arrays span until their brackets
  // balance, respecting strings and blank alignment-gap lines in between.
  function regionEnd(lines, startIdx) {
    var col = valueStartCol(lines[startIdx]);
    if (col < 0) return startIdx;
    var depth = 0, inStr = false, esc = false, started = false;
    for (var i = startIdx; i < lines.length; i++) {
      var s = lines[i];
      var from = (i === startIdx) ? col : 0;
      for (var c = from; c < s.length; c++) {
        var ch = s.charCodeAt(c);
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

  // Given full document text and a matcher, return a Set of 1-based line
  // numbers belonging to an excluded key (key line + its entire value block).
  function computeIgnoredLines(text, matcher) {
    var ignored = new Set();
    if (!matcher || typeof text !== 'string' || !text) return ignored;
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var key = lineKey(lines[i]);
      if (key === null || !matcher(key)) continue;
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
    lineKey: lineKey,
    computeIgnoredLines: computeIgnoredLines,
  };
})();
