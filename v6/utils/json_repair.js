/*!
 * json_repair.js — string-aware JSON repair + classification for JSON Compare v6
 *
 * Replaces the regex pipeline that used to live in json_utils.js. That pipeline
 * applied ~15 unanchored regexes to the whole document, which meant it could not
 * tell a keyword from a word inside a string ("None provided" -> "null provided")
 * and it did an indexOf+substring over the entire document once per `(...)` group,
 * which is O(n*m) — a 3.2 MB paste took 139 seconds.
 *
 * The rule here, and the reason the whole file is written the way it is:
 *
 *     NEVER pattern-match across a document that contains string literals.
 *     Walk it once, know when you are inside a string, and only rewrite
 *     what you find outside one.
 *
 * Repair chain (cheapest and most certain first; most inputs stop at stage 0):
 *
 *   0. JSON.parse            valid JSON is returned untouched, byte for byte
 *   1. normalize()           single-pass string-aware tokenizer: Python literals,
 *                            datetime/Decimal/UUID calls, tuples, sets, b/r/u/f
 *                            prefixes, <Obj #id> reprs, and comment stripping
 *   2. jsonrepair()          vendored, ISC, 0 deps: quotes, commas, brackets,
 *                            truncation, fences, NDJSON, smart quotes, JSONP
 *   3. JSON.parse            verify — nothing is returned that does not parse
 *
 * Stage 3 is what makes this safe to run automatically: repair() reports
 * ok:false and hands back the untouched input unless the result actually parses.
 *
 * Exposes `JSONRepairKit` on window (main thread) and self (diff-worker).
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';

  // Above this we refuse rather than freeze the tab. The chain is O(n) so this
  // is a memory bound (repair holds ~3 copies of the text), not a time bound.
  var MAX_BYTES = 32 * 1024 * 1024;

  var now = function () {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  };

  // ---------------------------------------------------------------------------
  // Repair categories. Order here is the order they appear in the report.
  // ---------------------------------------------------------------------------
  var CATEGORIES = [
    ['singleQuoted',  'single-quoted string',    'single-quoted strings'],
    ['pyConst',       'Python True/False/None',  'Python True/False/None literals'],
    ['pyDateTime',    'datetime object',         'datetime objects'],
    ['pyDecimal',     'Decimal/UUID value',      'Decimal/UUID values'],
    ['pyTuple',       'tuple',                   'tuples'],
    ['pySet',         'set',                     'sets'],
    ['pyCall',        'Python object call',      'Python object calls'],
    ['pyRepr',        'object repr <Name #id>',  'object reprs <Name #id>'],
    ['wrapper',       'wrapper/JSONP call',      'wrapper/JSONP calls'],
    ['strPrefix',     'b/r/u/f string prefix',   'b/r/u/f string prefixes'],
    ['complexNum',    'complex number',          'complex numbers'],
    ['lineComment',   '// comment',              '// comments'],
    ['blockComment',  '/* */ comment',           '/* */ comments'],
    ['hashComment',   '# comment',               '# comments'],
    ['trailingComma', 'trailing comma',          'trailing commas'],
    ['unquotedKey',   'unquoted key',            'unquoted keys'],
    ['smartQuote',    'smart quote',             'smart quotes'],
    ['nanInf',        'NaN/Infinity',            'NaN/Infinity values'],
    ['fence',         'markdown code fence',     'markdown code fences'],
    ['unclosed',      'unclosed bracket',        'unclosed brackets'],
    ['other',         'syntax repair',           'syntax repairs']
  ];
  var CAT_INDEX = {};
  for (var ci = 0; ci < CATEGORIES.length; ci++) CAT_INDEX[CATEGORIES[ci][0]] = CATEGORIES[ci];

  function describeRepairs(counts) {
    var out = [];
    for (var i = 0; i < CATEGORIES.length; i++) {
      var key = CATEGORIES[i][0];
      var n = counts[key] || 0;
      if (!n) continue;
      out.push({
        key: key,
        count: n,
        label: n === 1 ? CATEGORIES[i][1] : CATEGORIES[i][2],
        text: n + ' ' + (n === 1 ? CATEGORIES[i][1] : CATEGORIES[i][2])
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Position helpers
  // ---------------------------------------------------------------------------

  /** Byte offset -> {line, col}, both 1-based. */
  function locate(text, pos) {
    if (pos == null || pos < 0) return { line: 1, col: 1 };
    if (pos > text.length) pos = text.length;
    var line = 1, last = 0, idx = -1;
    while ((idx = text.indexOf('\n', last)) !== -1 && idx < pos) {
      line++; last = idx + 1;
    }
    return { line: line, col: pos - last + 1 };
  }

  /**
   * Strict-parse the text and, on failure, dig a position out of the engine's
   * SyntaxError. Every engine words it differently, so try each shape:
   *   V8      "... in JSON at position 42"  /  "... at position 42 (line 3 column 5)"
   *   SpiderMonkey  "JSON.parse: ... at line 3 column 5 of the JSON data"
   *   JSC     "JSON Parse error: ..."       (no position at all)
   * Returns null when the text is valid JSON.
   */
  function strictError(text) {
    try { JSON.parse(text); return null; }
    catch (e) {
      var msg = String(e && e.message || e);
      var pos = null, line = null, col = null;

      var mLineCol = /line (\d+) column (\d+)/i.exec(msg);
      if (mLineCol) { line = +mLineCol[1]; col = +mLineCol[2]; }

      var mPos = /position (\d+)/i.exec(msg);
      if (mPos) {
        pos = +mPos[1];
        if (line == null) { var lc = locate(text, pos); line = lc.line; col = lc.col; }
      }
      if (line == null) { line = 1; col = 1; }
      if (pos == null) pos = offsetOf(text, line, col);

      return {
        message: cleanErrorMessage(msg),
        raw: msg,
        pos: pos,
        line: line,
        col: col
      };
    }
  }

  function offsetOf(text, line, col) {
    var at = 0;
    for (var i = 1; i < line; i++) {
      var nl = text.indexOf('\n', at);
      if (nl === -1) return Math.min(text.length, at + col - 1);
      at = nl + 1;
    }
    return Math.min(text.length, at + col - 1);
  }

  /** Strip the engine's boilerplate so the message fits in a pane chip. */
  function cleanErrorMessage(msg) {
    return String(msg)
      .replace(/^JSON\.parse:\s*/i, '')
      .replace(/^JSON Parse error:\s*/i, '')
      .replace(/\s+in JSON at position \d+.*$/i, '')
      .replace(/\s+at position \d+.*$/i, '')
      .replace(/\s+at line \d+ column \d+ of the JSON data\.?$/i, '')
      .replace(/\s+of the JSON data\.?$/i, '')
      .trim() || 'Invalid JSON';
  }

  // ---------------------------------------------------------------------------
  // Character classes
  // ---------------------------------------------------------------------------
  function isIdentStart(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
  }
  function isIdentChar(c) {
    return isIdentStart(c) || (c >= '0' && c <= '9');
  }
  function isWs(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v'; }
  function isDigit(c) { return c >= '0' && c <= '9'; }

  var SMART_QUOTES = '‘’‚‛“”„‟«»‹›';
  var STRING_PREFIXES = { b:1, B:1, r:1, R:1, u:1, U:1, f:1, F:1,
                          rb:1, RB:1, br:1, BR:1, rf:1, RF:1, fr:1, FR:1 };

  /** JSON-escape a raw run of characters for embedding in a double-quoted string. */
  function jsonEscape(raw) {
    var out = '';
    for (var i = 0; i < raw.length; i++) {
      var c = raw.charAt(i), code = raw.charCodeAt(i);
      if (c === '"') out += '\\"';
      else if (c === '\\') out += '\\\\';
      else if (c === '\n') out += '\\n';
      else if (c === '\r') out += '\\r';
      else if (c === '\t') out += '\\t';
      else if (code < 0x20) out += '\\u' + ('0000' + code.toString(16)).slice(-4);
      else out += c;
    }
    return out;
  }

  function pad2(v) { v = String(v).trim(); return v.length >= 2 ? v : '0' + v; }
  function pad6(v) { v = String(v).trim(); while (v.length < 6) v = '0' + v; return v; }

  // ---------------------------------------------------------------------------
  // normalize() — the single-pass, string-aware tokenizer (stage 1)
  //
  // Emits chunks into an array rather than concatenating, so a `{` that turns
  // out to be a set can be patched to `[` in place when its closer is reached
  // (out[idx] = '['). That is what keeps set-vs-dict detection O(n) instead of
  // needing a lookahead scan per brace.
  //
  // Whitespace and newlines outside strings are copied verbatim, and multi-line
  // block comments are replaced by their own newlines, so line numbers in the
  // output still line up with the input.
  // ---------------------------------------------------------------------------
  function normalize(src) {
    var out = [];
    var counts = Object.create(null);
    var n = src.length;
    var i = 0;
    var stack = [];           // {kind:'brace'|'bracket'|'paren', idx, sawColon, hasContent, tuple}
    var changed = false;

    function bump(k, by) { counts[k] = (counts[k] || 0) + (by || 1); }
    function emit(s) { out.push(s); }
    function markContent() {
      var top = stack[stack.length - 1];
      if (top) top.hasContent = true;
    }
    // `-Infinity` becomes `null`, not `-null`: rub out the sign we already
    // emitted as an ordinary character.
    function dropTrailingMinus() {
      for (var p = out.length - 1; p >= 0; p--) {
        var chunk = out[p];
        if (chunk === '') continue;
        if (!chunk.trim()) continue;
        if (chunk === '-') out[p] = '';
        return;
      }
    }

    // Leading markdown fence: ```json ... ```
    var fenceHead = /^\s*```[ \t]*[A-Za-z0-9_-]*[ \t]*\r?\n/.exec(src);
    if (fenceHead) {
      bump('fence'); changed = true;
      emit(fenceHead[0].replace(/[^\n]/g, ''));   // keep the newline, drop the fence
      i = fenceHead[0].length;
      var tailFence = /\r?\n[ \t]*```[ \t]*$/.exec(src);
      if (tailFence) n = tailFence.index;
    }

    while (i < n) {
      var c = src.charAt(i);

      // --- whitespace: copy verbatim ---------------------------------------
      if (isWs(c)) { emit(c); i++; continue; }

      // --- double-quoted string: copy verbatim, never look inside ----------
      if (c === '"') {
        markContent();
        var j = i + 1;
        while (j < n) {
          var sc = src.charAt(j);
          if (sc === '\\') { j += 2; continue; }
          if (sc === '"') { j++; break; }
          j++;
        }
        emit(src.slice(i, Math.min(j, n)));
        i = j;
        continue;
      }

      // --- single-quoted (Python) string: convert to a JSON string ---------
      if (c === "'") {
        markContent();
        var sq = readSingleQuoted(src, i, n);
        emit('"' + sq.value + '"');
        bump('singleQuoted'); changed = true;
        i = sq.end;
        continue;
      }

      // --- smart quotes: leave for jsonrepair, but count them ---------------
      if (SMART_QUOTES.indexOf(c) !== -1) {
        markContent(); bump('smartQuote'); changed = true;
        emit(c); i++; continue;
      }

      // --- comments ---------------------------------------------------------
      if (c === '/' && src.charAt(i + 1) === '/') {
        var eol = src.indexOf('\n', i);
        if (eol === -1) eol = n;
        bump('lineComment'); changed = true;
        i = eol;                          // the \n itself is copied next pass
        continue;
      }
      if (c === '/' && src.charAt(i + 1) === '*') {
        var close = src.indexOf('*/', i + 2);
        var stop = close === -1 ? n : close + 2;
        var removed = src.slice(i, stop);
        bump('blockComment'); changed = true;
        emit(removed.replace(/[^\n]/g, ''));   // preserve line count
        i = stop;
        continue;
      }
      // A `#` comment must start a line or follow whitespace — otherwise it is
      // part of something else (e.g. the id in a <User #12> repr).
      if (c === '#' && (i === 0 || isWs(src.charAt(i - 1)))) {
        var hEol = src.indexOf('\n', i);
        if (hEol === -1) hEol = n;
        bump('hashComment'); changed = true;
        i = hEol;
        continue;
      }

      // --- <Obj #123> / <Obj object at 0x7f...> reprs -----------------------
      if (c === '<' && isIdentStart(src.charAt(i + 1))) {
        var rep = readRepr(src, i, n);
        if (rep) {
          markContent();
          emit('"' + jsonEscape(rep.raw) + '"');
          bump('pyRepr'); changed = true;
          i = rep.end;
          continue;
        }
      }

      // --- identifiers, keywords and calls ----------------------------------
      if (isIdentStart(c)) {
        markContent();
        var id = readDottedIdent(src, i, n);
        var name = id.name;
        var after = id.end;

        // b'...' / r"..." / f'...' string prefixes (no space before the quote)
        if (STRING_PREFIXES[name] === 1) {
          var q = src.charAt(after);
          if (q === "'" || q === '"') {
            bump('strPrefix'); changed = true;
            // In a raw string every backslash is literal, so `r'a\b'` is two
            // characters and must not become a backspace on the way through.
            var isRaw = name.toLowerCase().indexOf('r') !== -1;
            if (q === "'") {
              var psq = readSingleQuoted(src, after, n, isRaw);
              emit('"' + psq.value + '"');
              bump('singleQuoted');
              i = psq.end;
            } else {
              var k = after + 1;
              while (k < n) {
                var pc = src.charAt(k);
                if (pc === '\\' && !isRaw) { k += 2; continue; }
                if (pc === '"') { k++; break; }
                k++;
              }
              var body = src.slice(after + 1, Math.max(after + 1, k - 1));
              emit('"' + (isRaw ? jsonEscape(body) : body) + '"');
              i = k;
            }
            continue;
          }
        }

        // Python constants
        if (name === 'True' || name === 'False' || name === 'None') {
          emit(name === 'None' ? 'null' : name.toLowerCase());
          bump('pyConst'); changed = true;
          i = after;
          continue;
        }
        // NaN / Infinity are not JSON. Emit null rather than leaving a bareword
        // for jsonrepair, which would quote it into the *string* "NaN".
        if (name === 'NaN' || name === 'Infinity') {
          dropTrailingMinus();
          emit('null');
          bump('nanInf'); changed = true;
          i = after;
          continue;
        }

        // A call: Name( ... )
        var ws = after;
        while (ws < n && isWs(src.charAt(ws))) ws++;
        if (src.charAt(ws) === '(') {
          // A wrapper whose payload is itself a structure — JSONP `cb({...})`,
          // `OrderedDict([...])` — is unwrapped rather than stringified, so the
          // payload still gets walked. Real constructors (datetime, Decimal,
          // UUID) never open with a brace or bracket.
          var peek = ws + 1;
          while (peek < n && isWs(src.charAt(peek))) peek++;
          var pc0 = src.charAt(peek);
          if (pc0 === '{' || pc0 === '[') {
            stack.push({ kind: 'paren', unwrap: true, idx: out.length, sawColon: false, hasContent: false });
            emit('');
            bump('wrapper'); changed = true;
            i = ws + 1;
            continue;
          }
          var call = readBalanced(src, ws, n, '(', ')');
          var rendered = renderCall(name, call.inner, src.slice(i, call.end), bump);
          emit(rendered);
          changed = true;
          i = call.end;
          continue;
        }

        // Bare identifier. If a `:` follows it is an unquoted key — jsonrepair
        // will quote it; we only count it so the report can mention it.
        var pk = after;
        while (pk < n && isWs(src.charAt(pk))) pk++;
        if (src.charAt(pk) === ':') bump('unquotedKey');

        emit(src.slice(i, after));
        i = after;
        continue;
      }

      // --- ( ... ) with no callee: a tuple, or a complex number -------------
      if (c === '(') {
        markContent();
        var cx = /^\(\s*([+-]?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)j\s*\)/.exec(src.slice(i, i + 96));
        if (cx) {
          emit('{"real": ' + cx[1] + ', "imag": ' + (cx[2] === '-' ? '-' : '') + cx[3] + '}');
          bump('complexNum'); changed = true;
          i += cx[0].length;
          continue;
        }
        stack.push({ kind: 'paren', tuple: true, idx: out.length, sawColon: false, hasContent: false });
        emit('[');
        bump('pyTuple'); changed = true;
        i++;
        continue;
      }
      if (c === ')') {
        var pTop = stack.pop();
        emit(pTop && pTop.unwrap ? '' : (pTop && pTop.tuple ? ']' : ')'));
        i++;
        continue;
      }

      // --- braces: dict or set, decided when the closer is reached ----------
      if (c === '{') {
        markContent();
        stack.push({ kind: 'brace', idx: out.length, sawColon: false, hasContent: false });
        emit('{');
        i++;
        continue;
      }
      if (c === '}') {
        var bTop = stack.pop();
        if (bTop && bTop.kind === 'brace' && bTop.hasContent && !bTop.sawColon) {
          out[bTop.idx] = '[';            // it was a set all along
          emit(']');
          bump('pySet'); changed = true;
        } else {
          emit('}');
        }
        i++;
        continue;
      }

      if (c === '[') {
        markContent();
        stack.push({ kind: 'bracket', idx: out.length, sawColon: false, hasContent: false });
        emit('['); i++; continue;
      }
      if (c === ']') {
        stack.pop();
        emit(']'); i++; continue;
      }

      // --- separators -------------------------------------------------------
      if (c === ':') {
        var cTop = stack[stack.length - 1];
        if (cTop) cTop.sawColon = true;
        emit(':'); i++; continue;
      }
      if (c === ',') {
        // Trailing comma? Peek past whitespace/comments to the next real char.
        var t = i + 1;
        while (t < n && isWs(src.charAt(t))) t++;
        var tc = src.charAt(t);
        if (tc === '}' || tc === ']' || tc === ')' || t >= n) bump('trailingComma');
        emit(','); i++; continue;
      }

      // --- anything else: copy through -------------------------------------
      markContent();
      emit(c);
      i++;
    }

    if (stack.length) bump('unclosed', stack.length);

    return {
      text: out.join(''),
      counts: counts,
      changed: changed,
      unclosed: stack.length
    };
  }

  /**
   * Read a Python single-quoted string starting at src[i] === "'".
   *
   * Sloppy exports contain unescaped apostrophes ("it's fine"), so the closing
   * quote is the first one followed — after whitespace — by a delimiter that can
   * legally follow a value. Falling back to the first quote when none qualifies
   * keeps this total.
   */
  function readSingleQuoted(src, i, n, raw) {
    var close = -1;
    var firstClose = -1;
    var j = i + 1;
    while (j < n) {
      var c = src.charAt(j);
      if (c === '\\') { j += 2; continue; }
      if (c === "'") {
        if (firstClose === -1) firstClose = j;
        var k = j + 1;
        while (k < n && isWs(src.charAt(k))) k++;
        var nx = k >= n ? '' : src.charAt(k);
        if (nx === '' || nx === ',' || nx === '}' || nx === ']' || nx === ')' || nx === ':') {
          close = j; break;
        }
      }
      j++;
    }
    if (close === -1) close = firstClose;
    if (close === -1) close = n;             // unterminated — take the rest

    var body = src.slice(i + 1, close);
    if (raw) return { value: jsonEscape(body), end: Math.min(close + 1, n) };
    var value = '';
    for (var p = 0; p < body.length; p++) {
      var ch = body.charAt(p);
      if (ch === '\\') {
        var nc = body.charAt(p + 1);
        if (nc === "'") { value += "'"; p++; continue; }          // \' is just '
        if (nc === '"') { value += '\\"'; p++; continue; }
        if (nc === '') { value += '\\\\'; continue; }
        value += '\\' + nc; p++; continue;                        // \n \t \uXXXX pass through
      }
      value += jsonEscape(ch);
    }
    return { value: value, end: Math.min(close + 1, n) };
  }

  /** `datetime.datetime` — an identifier plus any dotted continuation. */
  function readDottedIdent(src, i, n) {
    var j = i;
    while (j < n && isIdentChar(src.charAt(j))) j++;
    while (j + 1 < n && src.charAt(j) === '.' && isIdentStart(src.charAt(j + 1))) {
      j++;
      while (j < n && isIdentChar(src.charAt(j))) j++;
    }
    return { name: src.slice(i, j), end: j };
  }

  /** Balanced (…) or […] scan that skips over string literals. */
  function readBalanced(src, i, n, open, closeCh) {
    var depth = 0, j = i;
    while (j < n) {
      var c = src.charAt(j);
      if (c === '"' || c === "'") {
        var q = c; j++;
        while (j < n) {
          var s = src.charAt(j);
          if (s === '\\') { j += 2; continue; }
          if (s === q) { j++; break; }
          j++;
        }
        continue;
      }
      if (c === open) { depth++; j++; continue; }
      if (c === closeCh) { depth--; j++; if (depth === 0) break; continue; }
      j++;
    }
    return { inner: src.slice(i + 1, Math.max(i + 1, j - 1)), end: j };
  }

  /** `<User #655715>` / `<Foo object at 0x7f...>` — bounded, single-line. */
  function readRepr(src, i, n) {
    var limit = Math.min(n, i + 240);
    for (var j = i + 1; j < limit; j++) {
      var c = src.charAt(j);
      if (c === '\n' || c === '<') return null;
      if (c === '>') {
        var raw = src.slice(i, j + 1);
        if (!/^<[A-Za-z_][\w.]*(?:[\s#][^<>]*)?>$/.test(raw)) return null;
        return { raw: raw, end: j + 1 };
      }
    }
    return null;
  }

  /**
   * Turn a Python call into JSON. Known constructors become their natural value;
   * anything else becomes the source text as a string, which keeps the document
   * parseable without inventing a value the user never wrote.
   */
  function renderCall(name, inner, source, bump) {
    var base = name.indexOf('.') === -1 ? name : name.slice(name.lastIndexOf('.') + 1);
    var args = splitArgs(inner);
    var pos = [];
    for (var a = 0; a < args.length; a++) {
      if (!/^[A-Za-z_]\w*\s*=/.test(args[a])) pos.push(args[a].trim());
    }
    var allNumeric = pos.length > 0 && pos.every(function (v) { return /^[+-]?\d+$/.test(v); });
    var utc = /tzinfo|utc|UTC/.test(inner);

    if ((base === 'datetime') && allNumeric && pos.length >= 3) {
      bump('pyDateTime');
      var iso = pos[0] + '-' + pad2(pos[1]) + '-' + pad2(pos[2]) +
        'T' + pad2(pos[3] || 0) + ':' + pad2(pos[4] || 0) + ':' + pad2(pos[5] || 0);
      if (pos.length >= 7) iso += '.' + pad6(pos[6]);
      if (utc) iso += 'Z';
      return '"' + iso + '"';
    }
    if (base === 'date' && allNumeric && pos.length >= 3) {
      bump('pyDateTime');
      return '"' + pos[0] + '-' + pad2(pos[1]) + '-' + pad2(pos[2]) + '"';
    }
    if (base === 'time' && allNumeric && pos.length >= 1) {
      bump('pyDateTime');
      var t = pad2(pos[0]) + ':' + pad2(pos[1] || 0) + ':' + pad2(pos[2] || 0);
      if (pos.length >= 4) t += '.' + pad6(pos[3]);
      return '"' + t + '"';
    }
    if (base === 'Decimal' || base === 'Fraction') {
      bump('pyDecimal');
      var lit = unquoteLiteral(pos[0] || '');
      return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(lit) ? lit : '"' + jsonEscape(lit) + '"';
    }
    if (base === 'UUID' || base === 'ObjectId' || base === 'ISODate') {
      bump('pyDecimal');
      return '"' + jsonEscape(unquoteLiteral(pos[0] || '')) + '"';
    }
    bump('pyCall');
    return '"' + jsonEscape(source) + '"';
  }

  /** Split call arguments on top-level commas only. */
  function splitArgs(inner) {
    var out = [], depth = 0, start = 0;
    for (var i = 0; i < inner.length; i++) {
      var c = inner.charAt(i);
      if (c === '"' || c === "'") {
        var q = c; i++;
        while (i < inner.length) {
          if (inner.charAt(i) === '\\') { i += 2; continue; }
          if (inner.charAt(i) === q) break;
          i++;
        }
        continue;
      }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 0) { out.push(inner.slice(start, i)); start = i + 1; }
    }
    if (start <= inner.length) out.push(inner.slice(start));
    return out.filter(function (s) { return s.trim() !== ''; });
  }

  function unquoteLiteral(s) {
    s = String(s).trim();
    if (s.length >= 2) {
      var a = s.charAt(0), b = s.charAt(s.length - 1);
      if ((a === '"' && b === '"') || (a === "'" && b === "'")) return s.slice(1, -1);
    }
    return s;
  }

  // ---------------------------------------------------------------------------
  // jsonrepair bridge (stage 2)
  // ---------------------------------------------------------------------------
  /**
   * What shape did the user's input *claim* to be, judged from its first
   * non-whitespace character?
   *
   * This exists because jsonrepair will happily turn anything into valid JSON:
   * `not json at all` comes back as the string `"not json at all"`. Technically
   * a repair; in a diff tool it is a lie. A result is only accepted when it is
   * consistent with what the input opened with.
   */
  function shapeOf(text) {
    var m = /\S/.exec(text);
    if (!m) return null;
    var c = m[0];
    if (c === '{') return 'object';
    if (c === '[') return 'array';
    if (c === '"' || c === "'" || SMART_QUOTES.indexOf(c) !== -1) return 'string';
    if (c === '-' || isDigit(c)) return 'number';
    if (/[tfnTFN]/.test(c)) return 'literal';
    if (c === '`') return 'fence';
    return 'other';
  }

  /**
   * Reject a "repair" that only succeeded by reinterpreting prose as data.
   * Measured examples of what this stops:
   *   "not json at all"              -> "not json at all"   (quoted whole)
   *   "Hello, world. This is a note" -> ["Hello", "world…"]  (comma as separator)
   * Both parse. Neither is what the user pasted.
   */
  function shapeAccepts(text, value) {
    var shape = shapeOf(text);
    var isStruct = value !== null && typeof value === 'object';
    switch (shape) {
      case 'object': return isStruct;
      case 'array':  return Array.isArray(value);
      case 'string':
      case 'number':
      case 'fence':  return true;
      case 'literal':
        if (/^\s*(true|false|null)\s*$/i.test(text)) return true;
        return isStruct && opensWithNoise(text);
      default:       return isStruct && opensWithNoise(text);
    }
  }

  /** Leading junk we know how to strip: a wrapper call, a fence, a comment. */
  function opensWithNoise(text) {
    return /^\s*[A-Za-z_$][\w.$]*\s*\(/.test(text)   // cb({...})
        || /^\s*```/.test(text)                       // ```json
        || /^\s*\/[/*]/.test(text)                    // // or /*
        || /^\s*#/.test(text);                        // # comment
  }

  function jsonrepairFn() {
    var lib = root.JSONRepair || (typeof globalThis !== 'undefined' ? globalThis.JSONRepair : null);
    return lib && typeof lib.jsonrepair === 'function' ? lib.jsonrepair : null;
  }

  // ---------------------------------------------------------------------------
  // repair() — the public chain
  // ---------------------------------------------------------------------------
  /**
   * @returns {{
   *   ok: boolean, changed: boolean, text: string, value: *,
   *   repairs: Array<{key,count,label,text}>, error: ?Object,
   *   engine: 'none'|'prepass'|'jsonrepair'|'jsonrepair-raw'|null, ms: number
   * }}
   * On failure `text` is the untouched input — a repair that cannot be verified
   * is never applied.
   */
  function repair(text, opts) {
    opts = opts || {};
    var t0 = now();
    var res = {
      ok: false, changed: false, text: text, value: undefined,
      repairs: [], error: null, engine: null, ms: 0
    };

    if (text == null || !String(text).trim()) {
      res.error = { message: 'Nothing to repair — the panel is empty.', line: 1, col: 1, pos: 0 };
      res.ms = now() - t0;
      return res;
    }
    if (text.length > MAX_BYTES) {
      res.error = {
        message: 'Too large to repair (' + Math.round(text.length / 1048576) + ' MB). ' +
                 'Split the file or fix it outside the browser.',
        line: 1, col: 1, pos: 0
      };
      res.ms = now() - t0;
      return res;
    }

    // Stage 0 — already valid. Return it byte-for-byte.
    try {
      res.value = JSON.parse(text);
      res.ok = true; res.changed = false; res.engine = 'none';
      res.ms = now() - t0;
      return res;
    } catch (e0) { /* fall through */ }

    // Stage 1 — string-aware normalization.
    var pre;
    try { pre = normalize(text); }
    catch (e1) { pre = { text: text, counts: Object.create(null), changed: false, unclosed: 0 }; }

    var counts = pre.counts;

    if (pre.changed || pre.text !== text) {
      try {
        res.value = JSON.parse(pre.text);
        res.ok = true; res.changed = true; res.text = pre.text; res.engine = 'prepass';
        res.repairs = describeRepairs(counts);
        res.ms = now() - t0;
        return res;
      } catch (e2) { /* fall through to jsonrepair */ }
    }

    // Stage 2 — jsonrepair, first on the normalized text, then on the original
    // in case normalization made things worse for a non-Python input.
    //
    // `opts.aggressive === false` stops here. Stage 1 only ever rewrites
    // constructs it positively identified outside a string literal; stage 2
    // guesses (an unterminated string, a missing comma, a bareword). The
    // automatic paste path can be told to take only the certain half.
    var jr = opts.aggressive === false ? null : jsonrepairFn();
    if (jr) {
      var attempts = pre.text === text ? [[pre.text, 'jsonrepair']]
                                       : [[pre.text, 'jsonrepair'], [text, 'jsonrepair-raw']];
      for (var a = 0; a < attempts.length; a++) {
        try {
          var fixed = jr(attempts[a][0]);
          var val = JSON.parse(fixed);
          if (!shapeAccepts(text, val)) break;
          res.value = val; res.ok = true; res.changed = fixed !== text;
          res.text = fixed; res.engine = attempts[a][1];
          if (attempts[a][1] === 'jsonrepair-raw') counts = Object.create(null);
          if (!describeRepairs(counts).length) counts.other = 1;
          res.repairs = describeRepairs(counts);
          res.ms = now() - t0;
          return res;
        } catch (e3) { /* try the next attempt */ }
      }
    }

    // Stage 3 — nothing verified. Report against the ORIGINAL text, which is
    // what the user is looking at; positions in the normalized text would point
    // at characters they never typed.
    res.error = strictError(text) || { message: 'Could not repair this JSON.', line: 1, col: 1, pos: 0 };
    if (shapeOf(text) === 'other') res.error.message = "This doesn't look like JSON.";
    if (!jr && opts.aggressive !== false && !jsonrepairFn()) {
      res.error.message += ' (repair library not loaded)';
    }
    res.repairs = describeRepairs(counts);
    res.ms = now() - t0;
    return res;
  }

  /**
   * Drop-in replacement for the old parseFlexibleJSON: returns the value or
   * throws. Kept because ~15 call sites in index.html rely on that contract.
   */
  function parse(text) {
    if (text == null || !String(text).trim()) return null;
    var r = repair(text);
    if (r.ok) return r.value;
    var e = r.error || {};
    var err = new Error(
      'Unable to parse input as JSON' +
      (e.line ? ' (line ' + e.line + ', column ' + e.col + ')' : '') +
      (e.message ? ': ' + e.message : '')
    );
    err.jsonError = e;
    throw err;
  }

  // ---------------------------------------------------------------------------
  // Content classification — replaces the binary JSON/CSV guess
  // ---------------------------------------------------------------------------

  /**
   * What is this text? Cheap: only inspects a prefix, never splits the whole
   * document. Returns one of:
   *   empty | json | jsonish | ndjson | csv | tsv | xml | yaml | text
   * `jsonish` means "starts like JSON but is not valid" — i.e. repairable.
   */
  function detectKind(text) {
    if (text == null) return 'empty';
    var head = text.slice(0, 65536);
    if (!head.trim()) return 'empty';

    var t = head.replace(/^﻿/, '').trimStart();
    var first = t.charAt(0);

    if (first === '{' || first === '[') {
      // Cheap strict check only on small documents; larger ones are classified
      // by shape and validated lazily by the caller.
      if (text.length <= 2 * 1024 * 1024) {
        try { JSON.parse(text); return 'json'; } catch (e) { /* keep going */ }
        if (looksNdjson(head)) return 'ndjson';
        return 'jsonish';
      }
      return 'json';
    }
    if (first === '<') return /^<\?xml|^<[A-Za-z!/]/.test(t) ? 'xml' : 'text';
    if (/^```/.test(t)) return 'jsonish';
    if (/^[A-Za-z_$][\w.]*\s*\(\s*[{[]/.test(t)) return 'jsonish';   // JSONP
    if (/^"[\s\S]*\\"/.test(t)) return 'jsonish';                     // escaped-stringified

    if (looksNdjson(head)) return 'ndjson';

    var csv = csvEvidence(head);
    if (csv.ok) return csv.sep === '\t' ? 'tsv' : 'csv';

    if (looksYaml(t)) return 'yaml';
    return 'text';
  }

  /**
   * One `Error: connection refused` line is not a YAML document — that single
   * over-eager rule is how a log line got classified as structured data. Require
   * an explicit document marker, or at least two `key: value` lines.
   */
  function looksYaml(t) {
    if (/^---\s*$/m.test(t)) return true;
    var lines = t.split(/\r?\n/);
    var hits = 0, nonEmpty = 0;
    for (var i = 0; i < lines.length && i < 20; i++) {
      var l = lines[i];
      if (!l.trim()) continue;
      nonEmpty++;
      if (/^\s*(-\s+)?[A-Za-z_][\w.-]*\s*:(\s|$)/.test(l)) hits++;
    }
    return nonEmpty >= 2 && hits >= 2 && hits / nonEmpty >= 0.6;
  }

  function looksNdjson(head) {
    var lines = head.split('\n');
    var seen = 0;
    for (var i = 0; i < lines.length && seen < 3; i++) {
      var l = lines[i].trim();
      if (!l) continue;
      if (l.charAt(0) !== '{' && l.charAt(0) !== '[') return false;
      try { JSON.parse(l); } catch (e) { return false; }
      seen++;
    }
    return seen >= 2;
  }

  /**
   * CSV needs *evidence*, not one comma. The old `cheapLooksLikeCSV` returned
   * true for "Hello, world." and the pane was then replaced with `[]`.
   *
   * Requires: >= 2 non-empty lines, >= 2 columns, and a delimiter count that is
   * consistent across the sampled lines.
   */
  function csvEvidence(head) {
    var fail = { ok: false, sep: null, columns: 0 };
    var lines = [];
    var raw = head.split(/\r?\n/);
    for (var i = 0; i < raw.length && lines.length < 6; i++) {
      if (raw[i].trim() !== '') lines.push(raw[i]);
    }
    if (lines.length < 2) return fail;

    var seps = ['\t', ',', ';', '|'];
    var best = null;
    for (var s = 0; s < seps.length; s++) {
      var sep = seps[s];
      var counts = [];
      for (var l = 0; l < lines.length; l++) counts.push(countOutsideQuotes(lines[l], sep));
      if (counts[0] < 1) continue;
      var consistent = 0;
      for (var k = 0; k < counts.length; k++) if (counts[k] === counts[0]) consistent++;
      if (consistent / counts.length < 0.8) continue;
      if (!best || counts[0] > best.count) best = { sep: sep, count: counts[0] };
    }
    if (!best) return fail;
    return { ok: true, sep: best.sep, columns: best.count + 1 };
  }

  function countOutsideQuotes(line, sep) {
    var n = 0, inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (c === '"') {
        if (inQ && line.charAt(i + 1) === '"') { i++; continue; }
        inQ = !inQ; continue;
      }
      if (!inQ && c === sep) n++;
    }
    return n;
  }

  /**
   * Everything a pane chip needs, in one call.
   * @returns {{kind, valid, repairable, error, records, bytes, message}}
   */
  function analyze(text, opts) {
    opts = opts || {};
    var out = {
      kind: 'empty', valid: false, repairable: false, error: null,
      records: null, bytes: text ? text.length : 0, message: ''
    };
    if (!text || !text.trim()) { out.message = 'Empty'; return out; }

    out.kind = detectKind(text);

    if (out.kind === 'json') {
      // detectKind only strict-parsed below 2 MB; above that confirm here.
      try {
        var v = JSON.parse(text);
        out.valid = true;
        out.records = Array.isArray(v) ? v.length : null;
        out.message = out.records != null
          ? 'Valid JSON · ' + out.records.toLocaleString() + ' item' + (out.records === 1 ? '' : 's')
          : 'Valid JSON';
        return out;
      } catch (e) { out.kind = 'jsonish'; }
    }

    if (out.kind === 'jsonish' || out.kind === 'ndjson') {
      if (opts.skipRepair || (text.length > (opts.repairLimit || 2 * 1024 * 1024))) {
        out.error = strictError(text);
        out.message = 'Not valid JSON';
        out.repairable = true;                      // unverified, but offer it
        return out;
      }
      var r = repair(text);
      out.repairable = r.ok;
      out.error = r.ok ? null : r.error;
      if (r.ok) {
        out.records = Array.isArray(r.value) ? r.value.length : null;
        out.message = 'Fixable JSON · ' + summarizeRepairs(r.repairs);
      } else {
        out.message = 'Invalid JSON — line ' + (r.error ? r.error.line : 1);
      }
      return out;
    }

    out.message = ({
      csv: 'CSV', tsv: 'TSV', xml: 'XML', yaml: 'YAML', text: 'Plain text'
    })[out.kind] || 'Plain text';
    return out;
  }

  function summarizeRepairs(repairs) {
    if (!repairs || !repairs.length) return 'needs repair';
    var parts = [];
    for (var i = 0; i < repairs.length && i < 3; i++) parts.push(repairs[i].text);
    if (repairs.length > 3) parts.push('+' + (repairs.length - 3) + ' more');
    return parts.join(', ');
  }

  // ---------------------------------------------------------------------------
  // Duplicate-key detection (§6.3) — legal JSON, silently lossy, and a genuine
  // source of "the diff says they match but they don't".
  // ---------------------------------------------------------------------------
  /** @returns {Array<{key, line, col, pos}>} at most `limit` findings. */
  function findDuplicateKeys(text, limit) {
    limit = limit || 50;
    var found = [];
    var n = text.length, i = 0;
    var stack = [];        // array of Set-like maps, one per open object
    var seenKey = null;

    while (i < n && found.length < limit) {
      var c = text.charAt(i);
      if (c === '"') {
        var j = i + 1, buf = '';
        while (j < n) {
          var sc = text.charAt(j);
          if (sc === '\\') { buf += text.substr(j, 2); j += 2; continue; }
          if (sc === '"') { j++; break; }
          buf += sc; j++;
        }
        // Is this string a key? Next non-ws char decides.
        var k = j;
        while (k < n && isWs(text.charAt(k))) k++;
        if (text.charAt(k) === ':' && stack.length) {
          var top = stack[stack.length - 1];
          var name = buf;
          if (Object.prototype.hasOwnProperty.call(top, name)) {
            var lc = locate(text, i);
            found.push({ key: safeKeyName(name), line: lc.line, col: lc.col, pos: i });
          } else top[name] = 1;
        }
        i = j; continue;
      }
      if (c === '{') { stack.push(Object.create(null)); i++; continue; }
      if (c === '}') { stack.pop(); i++; continue; }
      i++;
    }
    return found;
  }
  function safeKeyName(s) {
    try { return JSON.parse('"' + s + '"'); } catch (e) { return s; }
  }

  // ---------------------------------------------------------------------------
  var API = {
    VERSION: VERSION,
    MAX_BYTES: MAX_BYTES,
    CATEGORIES: CATEGORIES,
    repair: repair,
    parse: parse,
    normalize: normalize,
    analyze: analyze,
    detectKind: detectKind,
    csvEvidence: csvEvidence,
    strictError: strictError,
    locate: locate,
    findDuplicateKeys: findDuplicateKeys,
    describeRepairs: describeRepairs,
    summarizeRepairs: summarizeRepairs,
    available: function () { return !!jsonrepairFn(); }
  };

  root.JSONRepairKit = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
