// Lenient JSON parsing for the JSON Compare tool.
//
// This file used to hold ~250 lines of regexes applied one after another to the
// whole document. That approach had two defects that were not fixable by
// patching individual patterns, because the bug was the approach:
//
//   * It could not tell a keyword from a word inside a string, so valid data was
//     silently rewritten — `"None provided"` came back as `"null provided"`,
//     `"(555) 123"` as `"[555] 123"`. Measured: 7 of 10 realistic data probes
//     produced a wrong value or threw. For a diff tool that is the worst
//     possible failure: it can hide a real difference AND invent a false one.
//
//   * It ran `s.substring(0, s.indexOf(match))` inside a `String.replace`
//     callback, once per `(...)` group — O(n*m). A 3.2 MB paste froze the tab
//     for 139 seconds, uncancellably, because it ran before the first await.
//
// Both are gone. The work now lives in json_repair.js, which walks the document
// once, knows when it is inside a string literal, and only rewrites what it
// finds outside one. The same 10,000-record input parses in ~160 ms.
//
// The `parseFlexibleJSON(text) -> value | throws` contract is unchanged, because
// ~15 call sites in index.html depend on it.
(function () {
  function kit() {
    return typeof window !== 'undefined' ? window.JSONRepairKit
         : (typeof self !== 'undefined' ? self.JSONRepairKit : null);
  }

  function parseFlexibleJSON(text) {
    if (!text || !String(text).trim()) return null;

    var K = kit();
    if (K) return K.parse(text);

    // json_repair.js failed to load. Strict parsing is the only safe fallback —
    // guessing with regexes is what this file used to do.
    return JSON.parse(text);
  }

  /**
   * Repair without throwing, for callers that want the report rather than just
   * the value: `{ok, changed, text, value, repairs, error}`.
   */
  function repairJSON(text) {
    var K = kit();
    if (K) return K.repair(text);
    try {
      return { ok: true, changed: false, text: text, value: JSON.parse(text), repairs: [], error: null };
    } catch (e) {
      return { ok: false, changed: false, text: text, value: undefined, repairs: [],
               error: { message: e.message, line: 1, col: 1, pos: 0 } };
    }
  }

  function parseAndFormat(text) {
    try {
      return JSON.stringify(parseFlexibleJSON(text), null, 2);
    } catch (e) {
      return 'Error: ' + e.message;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseFlexibleJSON: parseFlexibleJSON, repairJSON: repairJSON, parseAndFormat: parseAndFormat };
  }

  if (typeof window !== 'undefined') {
    window.parseFlexibleJSON = parseFlexibleJSON;
    window.repairJSON = repairJSON;
  }
})();
