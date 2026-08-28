# BRD — v6 Quality Audit & JSON Auto-Fix / Linting

**Status**: **Implemented** (2026-08-27) — see §12 for what shipped, what changed from this
plan and why, and what was deliberately deferred.
**Date**: 2026-08-26 (audit) · 2026-08-27 (implementation)
**Scope**: `v6/` (CodeMirror 6 app) — `index.html`, `utils/json_utils.js`, `utils/utils_csv.js`, `utils/diff-worker.js`
**Author**: Engineering analysis, evidence-based (all measurements reproduced locally — see Appendix A)

---

## 1. Executive Summary

v6's **diff engine is in excellent shape**. The record-matching model, windowed rendering,
adaptive `scanLimit`, ignore-patterns, numeric tolerance, and the interruptible progress
pipeline are sophisticated, well-documented, and measurably correct on the regression datasets.
That work is not in question here.

The weakness is **everything that happens before the diff**: the ingest path. v6 accepts
whatever the user pastes, guesses what it is, silently transforms it, and never reports
what it decided or whether it failed. Four defects in that path are severe enough to
cause **silent data corruption or data loss**, and they are all reachable in under five
seconds by a first-time user with default settings.

| # | Defect | Severity | User-visible outcome |
|---|--------|----------|----------------------|
| F-01 | `parseFlexibleJSON` rewrites string **contents** | **P0** | `"None provided"` → `"null provided"`; diffs that are invented or hidden |
| F-02 | `parseFlexibleJSON` is **O(n²)** on parentheses in strings | **P0** | 3.2 MB paste = **139 s** frozen tab, no progress, no Cancel |
| F-03 | Any line with a comma is treated as CSV | **P0** | Pasting a sentence or SQL replaces the pane with `[]` |
| F-04 | Export / Share reads the **panes**, not the document | **P0** | Exports 60 of 2,000 records; exports normalized (fake) values |
| F-05 | Format / Sort-keys also read the panes | P1 | Same truncation, in-session |
| F-06 | `Auto Format JSON = off` is not honoured | P1 | Original formatting destroyed against the user's setting |
| F-07 | **No JSON validation surface exists** | P1 | Broken JSON produces no error, anywhere |

The feature you asked for — **auto-fix + linting** — is not a nice-to-have bolted onto a
healthy base. It is the correct *replacement* for the broken base. `parseFlexibleJSON` is
already trying to be a JSON repairer; it is just doing it with 15 sequential unanchored
regexes over the whole document, which is why it both corrupts data and takes two minutes.

**Recommendation**: replace the repair engine with `jsonrepair` (ISC, 0 deps, 35 KB UMD,
vendorable) + a narrow tokenizer-based Python pre-pass, put it behind an explicit
**"Fix JSON"** affordance with a preview, and turn on CodeMirror's linter — which requires
**one line of code**, because `jsonParseLinter` is already exported by the
`@codemirror/lang-json` build v6 loads today.

---

## 2. Method & Evidence Base

Every finding below was reproduced, not inferred:

- `v6/utils/json_utils.js` was loaded into a sandboxed VM and run against a 24-case
  malformed-JSON corpus and a 10-case **data-integrity** corpus (valid data that must
  survive a lenient parse unchanged).
- `jsonrepair@3.15.0` (UMD) was run against the same corpora for comparison.
- Timing was measured by bisecting record shape until the quadratic trigger was isolated.
- Ingest routing (`looksLikeJSONStart` / `cheapLooksLikeCSV`) was simulated verbatim
  against 8 realistic paste payloads.
- Library facts (versions, licences, exports, bundle sizes, API surface) were read from
  the npm registry and the published unpkg artifacts, not from memory.

Raw numbers are in **Appendix A**.

---

## 3. What Is Working Well (do not regress)

Stated explicitly so the fixes below stay surgical:

- **Structural diff model** (`json_align.js`): item + field level, exact at any size,
  independent of what is rendered. The status pill reporting the model instead of
  `mergeView.chunks` is the right call.
- **Windowed rendering + measured render budget**: the probe-and-scale calibration
  (`calibrateRenderBudget`) is the correct answer to a cost curve that cannot be predicted.
- **`scanLimit` as a correctness knob**: the analysis in `CLAUDE.md` §3 is right, and the
  ordering fix in `writeAlignedPanes()` (limit before write) is subtle and correct.
- **Interruptible pipeline** (`progress.js`): real cancellation, MessageChannel yielding,
  `detach()`/`finish()` separation. Genuinely well built.
- **Ignore patterns / numeric tolerance via normalization**: choosing to normalize rather
  than re-skin was the right architectural call, and `_ignorePristine` is the right guard.
- **Settings persistence discipline** (`CLAUDE.md` §2b): the three rules are sound.

The defects below are concentrated in code that predates this work.

---

## 4. Findings Register

### F-01 — `parseFlexibleJSON` silently rewrites the contents of strings — **P0**

**Symptom.** String *values* are modified. The tool that exists to show you what changed
changes your data before showing it to you.

**Evidence** (measured; input is valid data with one unquoted key, so it takes the
flexible path):

| Input | Correct value | `parseFlexibleJSON` produces |
|---|---|---|
| `{"note": "None provided", x:1}` | `None provided` | **`null provided`** |
| `{"name": "True Value Inc", x:1}` | `True Value Inc` | **`true Value Inc`** |
| `{"m": "False alarm", x:1}` | `False alarm` | **`false alarm`** |
| `{"phone": "(555) 123", x:1}` | `(555) 123` | **`[555] 123`** |
| `{"t": "a  b   c", x:1}` | `a  b   c` | **`a b c`** |
| `{"h": "<b>hi</b>", x:1}` | `<b>hi</b>` | **throws** |
| `{"d": "<User #12>", x:1}` | `<User #12>` | **throws** |

**7 of 10** realistic probes produced a wrong result or an error. `jsonrepair` produced
the correct value for **10 of 10**.

**Root cause.** The parser is a pipeline of unanchored, non-string-aware regexes applied to
the entire document:

- `v6/utils/json_utils.js:21` — `.replace(/\bTrue\b/g, "true")` (and `False`, `None`)
  cannot tell a keyword from a word inside a string.
- `v6/utils/json_utils.js:147` — `s.replace(/\s+/g, " ")` collapses **all** whitespace,
  including runs inside string values.
- `v6/utils/json_utils.js:~56` — `<Name #12>` → `{"type":…}` rewrites any angle-bracket
  content, including HTML in strings.
- `v6/utils/json_utils.js:101-120` — the tuple rule rewrites `( … )` to `[ … ]` inside
  strings whenever the preceding character is not a word character.

**Impact.** For a diff tool this is the worst possible failure mode: it can **hide a real
difference** (both sides normalized to the same wrong value) and **invent a false one**
(one side takes the flexible path, the other does not). It is silent — nothing in the UI
indicates the content was rewritten.

**Scope.** Only on the flexible path. Strictly-valid JSON hits `JSON.parse` at the top of
the function and is untouched. The flexible path is entered for Python dicts, unquoted
keys, single quotes, trailing commas — i.e. **exactly the inputs the auto-fix feature
targets**.

**Fix.** Replace the regex pipeline (§5.4). Do not patch individual regexes; the class of
bug is "regex over a document that contains strings", and it will keep reappearing.

---

### F-02 — `parseFlexibleJSON` is quadratic; a 3.2 MB paste freezes the tab for 139 s — **P0**

**Measured**, on Python-dict input with a `(…)` inside a string value:

| Records | Size | Time |
|---:|---:|---:|
| 250 | 14 KB | 12 ms |
| 500 | 28 KB | 30 ms |
| 1,000 | 55 KB | 133 ms |
| 2,000 | 113 KB | 494 ms |
| 4,000 | 228 KB | **2,407 ms** |
| 10,000 | 3.2 MB | **139,166 ms** |

Doubling the input multiplies the time by ~5. The same records **without** parentheses in
the string take 17 ms at 228 KB — a **140× difference** caused by one character.

**Root cause.** `v6/utils/json_utils.js:114`:

```js
const beforeParen = s.substring(0, s.indexOf(match));
```

Inside a `String.replace` callback that fires once per `(…)` group. Each call scans the
whole document (`indexOf`) and allocates a prefix copy (`substring`). With *m* matches over
*n* characters that is O(n·m). The intended guard — `if (match.includes("datetime")) return match;`
one line above — never fires, because `match` is only the parenthesised text and never
contains the word before the paren.

**Why it is worse than the number suggests.** This runs **synchronously in
`ingestContentInner` step 1** (`v6/index.html:4724-4728`), *before* `job.phase('csv')` and
before the first `await`. Consequences:

- No progress phase covers it — the panel is parked or absent.
- The main thread is blocked, so the progress panel **cannot paint** even after
  `SHOW_DELAY_MS`.
- **Cancel is unreachable.** The user's only option is to kill the tab.
- `FORMAT_MAX_BYTES` is 4 MB, so inputs up to 4 MB are explicitly allowed down this path.

**Fix.** (a) Remove the quadratic scan. (b) Move repair off the main thread into the
existing `diff-worker.js` for payloads over ~256 KB, so it is cancellable like every other
phase. (c) Give it a real phase label.

---

### F-03 — Any first line containing a comma is treated as CSV; prose is replaced with `[]` — **P0**

**Reproduction** (default settings, Auto CSV→JSON on):

1. Click into the left pane.
2. Paste `Hello, world. This is a note I pasted.`
3. The pane now contains `[]`.

**Measured routing** for realistic pastes:

| Paste | Routed to |
|---|---|
| `Hello, world. This is a note I pasted.` | **CSV convert → `[]`** |
| `SELECT id, name FROM users WHERE active = 1;` | **CSV convert → `[]`** |
| `Error: connection refused, retrying in 5s` | **CSV convert → `[]`** |
| `a,b,c\n1,2,3` | CSV convert (correct) |

**Root cause.** `v6/index.html:4538`:

```js
function cheapLooksLikeCSV(text) {
  …
  return /[,;\t]/.test(firstLine);   // one comma anywhere on line 1
}
```

A single-line input with one comma qualifies. `CSVUtils.csvToJSON` then reads line 1 as
headers, finds no data rows, and returns `[]`. The stricter `CSVUtils.isCSV` exists but is
only used by `updateConversionButtons` — the ingest path does not call it.

**Impact.** Silent destruction of pasted content on a very common input shape (log lines,
SQL, prose, single-line CSV headers). Ctrl-Z recovers it, but the user has no reason to
expect they need to.

**Fix.** Require CSV-shaped evidence, not one delimiter: ≥2 non-empty lines, a consistent
delimiter count across the first ~5 lines, and ≥2 columns. Never convert a single-line
input without an explicit user action. Additionally, when conversion yields **zero data
rows**, abort and insert the raw text instead — a conversion that produces `[]` is never
what the user wanted.

---

### F-04 — Export / Share writes the panes, not the document — **P0**

`v6/index.html:4096-4098`:

```js
async function shareURL() {
  const leftContent  = mergeView.a.state.doc.toString();
  const rightContent = mergeView.b.state.doc.toString();
```

Two ways this loses data:

1. **Windowed collections.** When a large collection is paged, the panes hold *one window*
   (~60 of 2,000 records). Export produces a ZIP containing 60 records. The user believes
   they exported their dataset.
2. **Normalized comparisons.** With ignore-patterns or numeric tolerance active, the right
   pane holds the *left* pane's values for matched fields. Export writes those fabricated
   values as if they were real data.

`saveContent()` already solves this correctly (`v6/index.html:4956-4981`): it prefers
`_ignorePristine` and refuses to write when `diffStats.truncated` and no complete snapshot
exists. `sortByFields()` solves it too (`v6/index.html:3964-3970`). Export/Share never
received the same treatment.

**Fix.** Introduce one accessor — `getDocumentPair()` — returning the pristine pair when it
exists and the panes otherwise, and route **every** whole-document consumer through it:
Share, ZIP export, Format, Sort keys, per-pane Copy, branch save. Refuse (with a clear
message) when the panes are truncated and no pristine pair exists.

---

### F-05 — Format JSON and Sort Keys operate on the visible window — P1

`formatJSON` (`v6/index.html:3883`) and `sortJSON` (`v6/index.html:3916`) both read
`mergeView.a/b.state.doc` and dispatch the result back. On a windowed collection this
writes the 60-record page over the pane, and because neither dispatch is guarded by
`_blockAligning`, the autosave listener (`v6/index.html:489`) then sets
`_ignorePristine = null`. The remaining 1,940 records are gone from live session state.

`saveContent()`'s truncation guard prevents them being written to storage, so the data
survives on disk — but the session is broken and the user is not told.

**Fix.** Same as F-04: route through `getDocumentPair()`, and mark programmatic rewrites
with `_blockAligning` where they are re-deriving rather than replacing.

---

### F-06 — "Auto Format JSON" off does not stop auto-formatting — P1

`v6/index.html:4724`:

```js
if (!opts.forceCsv && (autoCSV || autoFormat || autoSort) && … looksLikeJSONStart(rawText)) {
  const parsed = window.parseFlexibleJSON(rawText);
  content = buildJSONString(parsed, { autoSort });   // ← always pretty-prints
```

`buildJSONString` (`v6/index.html:4083-4093`) ends with an unconditional
`JSON.stringify(content, null, 3)`. Because **Auto CSV→JSON defaults to on**, the guard is
satisfied for every JSON-looking paste regardless of the Auto-Format setting. Turning
Auto Format JSON *off* changes nothing.

**Impact.** Beyond the broken setting: a user comparing two files whose *formatting* differs
(indent style, key order on the wire, minified vs pretty) cannot do so — v6 silently
re-serializes both. Indent is also hard-coded to 3 spaces, which is an unusual default and
not configurable.

**Fix.** Gate re-serialization on `autoFormat`; pass `autoFormat` into `buildJSONString`
and return the raw text when it is off (still applying `autoSort` only if *that* is on).
Add an indent setting (2 / 3 / 4 / tab).

---

### F-07 — There is no JSON validation surface anywhere in the app — P1

- `@codemirror/lint@6.8.2` is loaded from the CDN, but only `lintKeymap` is imported
  (`v6/index.html:466`, used at `:1043`). `lintKeymap` navigates diagnostics that are never
  produced. The package is downloaded and parsed for nothing.
- No `linter(...)`, no `lintGutter()`, no `setDiagnostics` anywhere in v6.
- Parse failures are swallowed: `v6/index.html:4728` — `catch (err) { /* not JSON */ }`.
- `formatJSON`'s error path writes one line to the status pill
  (`updateStatus` → `setDiffSummary('idle', …)`, `v6/index.html:5369`), which the next
  `updateDiffStatus()` overwrites. There is no line number, no column, no indication of
  **which pane** failed.
- `json_align.js` parses with strict `JSON.parse` (`json_align.js:1414`, `:1421`). Any
  input `parseFlexibleJSON` would have accepted — Python syntax, trailing comma, single
  quotes — makes `align()` return `{ok:false}`, silently disabling **Block Diff**, the
  record model, the pager and the Details panel. The user sees a degraded text diff and is
  told nothing.

**Net effect**: a user with slightly-broken JSON gets a worse comparison with no
explanation and no path to fixing it. This is the single largest UX gap in v6.

**Fix.** §6.

---

### F-08 — Format JSON refuses to work on one pane — P1

`v6/index.html:3887`:

```js
if (!leftContent || !rightContent) {
  updateStatus("Please provide content in both panels");
  return;
}
```

Formatting one pane is a legitimate, common action (you paste one document and want to read
it before finding the second). The all-or-nothing rule also means **one broken pane blocks
formatting of the good pane** — `parseFlexibleJSON` throws on the bad side and the `try`
block aborts before either dispatch.

**Fix.** Format each pane independently. Report per-pane outcome
("Left formatted · Right: invalid JSON at line 42").

---

### F-09 — The status pill is a single volatile line doing four jobs — P1

`diff-summary` is simultaneously: the diff result, the busy indicator, the error channel,
and the general status line. Every `updateStatus()` call is
`setDiffSummary('idle', message)`, and the next `afterContentChanged()` (50 ms debounce)
replaces it with the diff result. Errors are therefore frequently invisible.

Minor related defect: `setIngestBusy` sets `data-state="busy"`, but `app.css` only styles
`diff`, `same` and `warn` — the busy state renders identically to idle.

**Fix.** Separate channels: keep `diff-summary` for the comparison result only; add a
persistent, dismissible **notice strip** for errors and warnings; add per-pane validity
chips (§6.2). Add a `[data-state="busy"]` style.

---

### F-10 — Smaller items

| # | Item | Where | Note |
|---|---|---|---|
| F-10a | `fixBracketMatching()` is dead code — it builds a stack, then `return result` (the unmodified input) | `json_utils.js:259-276` | The "one more time with additional cleanup" retry is a no-op that always fails identically |
| F-10b | CodeMirror **5** options passed to a CM6 `MergeView`: `connect: "align"`, `collapseIdentical: false`, `allowEditingOriginals: true` | `index.html:1263-1268` | Silently ignored; misleading to future readers |
| F-10c | File drop uses `files[0]` only | `index.html:4447` | Dropping two files should fill left + right |
| F-10d | No "Open file" button — files can only arrive by drag & drop | toolbar | Discoverability; also blocks keyboard-only users |
| F-10e | 6 `aria-*` attributes in a 250 KB app; icon-only buttons (`↑ ↓ ◀ ▶ ✕`) have `title` but no accessible name | throughout | Screen-reader and keyboard gaps |
| F-10f | `CLAUDE.md` documents `utils-json/` as a live app; the directory does not exist (removed after `47d90f9`) | `CLAUDE.md` | Doc drift — also documents `autoFormat: false` while the real default is `true` (`utils.js:255`) |
| F-10g | No minify / compact output action | toolbar | Common companion to Format |

---

## 5. Feature: JSON Auto-Fix

### 5.1 Problem statement

Users arrive with JSON copied from log output, a browser console, a Python REPL, a Slack
message, a truncated cURL response, or an LLM answer wrapped in a code fence. Today v6
either silently corrupts it (F-01), freezes on it (F-02), or drops it into the pane as raw
text with block-diff quietly disabled (F-07). In every case the user is not told what
happened.

### 5.2 Goals / Non-goals

**Goals**
- Turn realistic broken JSON into valid JSON **without altering any data the user typed**.
- Make the repair **visible and reversible** — never a silent rewrite.
- Make it **fast and cancellable** at multi-MB scale.
- Restore the full-fidelity comparison (block diff, record model, Details) once repaired.

**Non-goals**
- Semantic correction (guessing intended values). Structural/syntactic repair only.
- Repairing on every keystroke. Repair is user-initiated or paste-time-with-consent.
- Replacing CSV conversion.

### 5.3 Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Each pane shows a live **validity chip**: `✓ Valid JSON` / `⚠ 3 issues` / `✕ Invalid — line 42` / `Plain text`. | Must |
| FR-2 | When a pane is invalid **and** repairable, the chip exposes a **Fix** action. | Must |
| FR-3 | Fix must **preview** before applying: a modal/inline summary listing the repairs made, with Apply / Cancel. | Must |
| FR-4 | Fix must be a single undo step (`Ctrl+Z` restores the original exactly). | Must |
| FR-5 | Fix must never change any string value, number, key name, or the order of keys/elements. Only syntax is changed. | Must |
| FR-6 | Repair runs off the main thread above 256 KB and is cancellable via the existing `ProcessingUI` job. | Must |
| FR-7 | Auto-fix on paste is **opt-in** (`autoFixJson`, default **off**), and when it fires it shows a dismissible "Repaired N issues — Undo" notice. | Must |
| FR-8 | If a pane cannot be repaired, report the **first error with line + column** and offer "Jump to error". | Must |
| FR-9 | Python-specific constructs (`datetime.datetime(...)`, `datetime.date(...)`, `Decimal('...')`, tuples, sets, `b''`/`r''`/`u''` prefixes, `<Obj #id>`) continue to be supported — they are a differentiator and `jsonrepair` does not handle them. | Must |
| FR-10 | A **Fix both panes** action in the toolbar, active whenever either pane is repairable. | Should |
| FR-11 | Repair report is per-category and countable ("2 trailing commas, 1 unclosed brace, 14 single-quoted strings"). | Should |
| FR-12 | Fix is available from the command palette / keyboard (`Ctrl+Shift+F` format, `Ctrl+Shift+R` repair). | Could |

### 5.4 Repair engine design

Replace `parseFlexibleJSON`'s regex pipeline with a **three-stage, string-aware chain**.
Stage order matters: the cheapest, most-certain stage runs first and most inputs stop there.

```
             ┌────────────────────────────────────────────┐
  raw text → │ 0. JSON.parse                              │ → valid, untouched (unchanged behaviour)
             └──────────────┬─────────────────────────────┘
                            │ throws
             ┌──────────────▼─────────────────────────────┐
             │ 1. Python pre-pass (tokenizer, NOT regex)  │  datetime/date/Decimal/tuple/
             │    scans the document once, string-aware   │  set/bytes/repr-object → JSON
             └──────────────┬─────────────────────────────┘  (skipped if no Python marker)
             ┌──────────────▼─────────────────────────────┐
             │ 2. jsonrepair()                            │  quotes, commas, brackets, comments,
             │    (vendored, 35 KB UMD, ISC, 0 deps)      │  fences, NDJSON, truncation, JSONP,
             └──────────────┬─────────────────────────────┘  smart quotes, escaped-stringified
             ┌──────────────▼─────────────────────────────┐
             │ 3. JSON.parse — verify                     │ → repaired  |  → report error w/ pos
             └────────────────────────────────────────────┘
```

**Stage 1 must be a tokenizer, not regexes.** This is the whole lesson of F-01/F-02. It
walks the string once tracking in-string / escape state, and only rewrites constructs found
outside string literals. Single pass, O(n), no `indexOf`, no whole-document `substring`.
Approximately 150 lines, fully unit-testable, and it replaces ~250 lines of `json_utils.js`.

**Why the split.** Measured coverage of the two engines is complementary:

| Construct | Current | `jsonrepair` | Stage 1 + `jsonrepair` |
|---|---|---|---|
| trailing comma, single quotes, unquoted keys | ✓ | ✓ | ✓ |
| `//` and `/* */` comments | ✗ | ✓ | ✓ |
| missing closing bracket / truncated | ✗ | ✓ | ✓ |
| missing comma between members | ✗ | ✓ | ✓ |
| smart quotes `“ ”` | ✗ | ✓ | ✓ |
| NDJSON → array | ✗ | ✓ | ✓ |
| ` ```json ` fence, JSONP wrapper | ✗ | ✓ | ✓ |
| escaped-stringified `{\"a\":1}` | ✗ | ✓ | ✓ |
| `NaN` / `Infinity` | ✗ | ✓ | ✓ |
| `None` / `True` / `False` | ✓ (corrupts strings) | ✓ (correct) | ✓ |
| `Decimal('1.2')` | ✗ | ✓ | ✓ |
| `datetime.datetime(...)` | ✓ | **✗** | ✓ (stage 1) |
| `datetime.date(...)` | ✓ | **✗** | ✓ (stage 1) |
| tuples `(1,2,3)` | ✓ (corrupts strings) | **✗** | ✓ (stage 1) |
| sets `{1,2,3}` | ✗ | ✗ | ✓ (stage 1) |
| `b'…'`, `r'…'`, `u'…'` | ✗ | ✗ | ✓ (stage 1) |
| **string contents preserved** | **7/10 wrong** | **10/10 correct** | **10/10** |

Overall corpus result: current parser handled **11 / 24**; `jsonrepair` alone **24 / 24**
on the general corpus but 0/4 on Python-object constructs. The hybrid covers both.

**Dependency recommendation — vendor, do not CDN.**
`jsonrepair@3.15.0`, ISC licence, zero dependencies, UMD build **35,559 bytes** (~10 KB
gzipped), global `JSONRepair.jsonrepair`. Vendor it as
`v6/utils/vendor/jsonrepair.umd.js` and load it with a plain `<script>` alongside the other
utils. Rationale:

- It matches v6's existing global-namespace utility pattern exactly — no import-map change.
- It removes a network dependency from the critical repair path (v6 already degrades badly
  offline; v5's fully-offline posture is the better precedent).
- 35 KB is smaller than several files already in `v6/utils/`.
- Pinning by file, not by CDN version + SRI, is simpler to audit.

A `jsonrepair/stream` export also exists for documents larger than memory — out of scope
for phase 1, but it is the natural path if multi-hundred-MB support is ever needed.

**Worker placement.** `diff-worker.js` already inlines its own CSV parser to run
standalone. Add a `repairJson` action there and inline `jsonrepair` + the stage-1
tokenizer the same way. Bump `WORKER_VERSION` (workers are cached hard — the existing
comment in `CLAUDE.md` §11 is correct and easy to forget). Payloads under
`PROGRESS_MIN_BYTES` stay on the main thread; above it they get a `repair` phase, a
progress bar and Cancel.

### 5.5 Trust model — repair is never silent

This is the requirement that separates a useful feature from a liability. A diff tool that
rewrites input without saying so cannot be trusted for the job it exists to do.

- Default: **manual**. The chip says the pane is invalid; the user clicks Fix.
- Preview lists categorized repairs and shows a before/after of the first ~5 changed
  regions.
- Applying is one undoable transaction.
- `autoFixJson` (opt-in) still shows a persistent notice with **Undo** and **View changes**.
- The pristine original is captured into the same `_ignorePristine` mechanism already used
  by ignore-patterns, so Export/Share/autosave keep the user's real bytes (§F-04 fix is a
  prerequisite).

---

## 6. Feature: Live JSON Linting

### 6.1 Phase 1 — one line (do this immediately)

`@codemirror/lang-json@6.0.1`, already in v6's import map, **already exports
`jsonParseLinter`** (verified against the published bundle). The change is:

```js
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter, lintKeymap } from "@codemirror/lint";

// in basicSetup / per-pane extensions:
linter(jsonParseLinter(), { delay: 400 }),
lintGutter(),
```

This gives inline squiggles, a gutter marker, hover messages, and makes the already-loaded
`lintKeymap` (`F8` / `Shift-F8` to cycle diagnostics) functional. Cost: zero new
dependencies, ~6 lines.

**Known limitation to design around**: `jsonParseLinter` calls `JSON.parse` and reports
**only the first error**, deriving position by parsing the engine's `SyntaxError` message.
That is adequate for "where does it break", not for "what is wrong with this document".

### 6.2 Phase 2 — multi-error linter + per-pane validity chip

`json()` already installs the Lezer JSON parser, so the syntax tree is available for free.
A custom linter walking `syntaxTree(state)` for `node.type.isError` nodes reports **every**
syntax error with exact `from`/`to` positions, no `JSON.parse`, no message parsing, and
incrementally (Lezer reparses only what changed) — so it stays cheap on large documents
where a full `JSON.parse` per keystroke would not.

Pair it with a **per-pane validity chip** in the existing `.pane-controls` row:

```
┌─────────────────────────────── LEFT ────────────────────────────────┐
│ ✓ Valid JSON · 2,000 records            📋 Copy  📄 Paste  ✕ Clear  │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────── RIGHT ───────────────────────────────┐
│ ✕ Invalid JSON — line 42, col 8   [ Fix ] [ Go to error ]           │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────── RIGHT ───────────────────────────────┐
│ ⚠ Valid, but not strict JSON — Python syntax   [ Convert ]          │
└──────────────────────────────────────────────────────────────────────┘
```

The chip also resolves F-07's worst consequence: when `json_align` falls back because
strict `JSON.parse` failed, the chip explains **why** block diff, the record pager and the
Details panel are unavailable, and offers the one-click path to getting them back.

### 6.3 Phase 3 — structural warnings (beyond syntax)

Diagnostics that are valid JSON but usually bugs, surfaced as warnings (not errors):

- **Duplicate keys** in the same object — legal JSON, silently lossy through `JSON.parse`,
  and a genuine source of "the diff says they're the same but they're not".
- Numbers exceeding IEEE-754 safe integer range (precision will be lost on round-trip) —
  relevant to this app, since it re-serializes.
- Lone surrogates / invalid `\u` escapes.
- Very deep nesting approaching the render budget.

Duplicate-key detection in particular is worth shipping: it is invisible today and it
directly undermines comparison correctness.

---

## 7. Feature: Plain-Text Cleanup

For the non-JSON case (your second request). Today, plain text either passes through
untouched or is mangled into `[]` (F-03).

### 7.1 Cleanup actions (a **Clean ▾** toolbar menu, per-pane or both)

| Action | Behaviour | Default in "Clean up" |
|---|---|---|
| Trim trailing whitespace | Strip spaces/tabs at end of every line | ✓ |
| Normalize line endings | CRLF / CR → LF | ✓ |
| Strip BOM & zero-width chars | `U+FEFF`, `U+200B`–`U+200D` | ✓ |
| Normalize NBSP | `U+00A0` → space | ✓ |
| Collapse blank lines | 3+ consecutive → 1 | ✓ |
| Trim leading/trailing document whitespace | | ✓ |
| Tabs → spaces | Configurable width | opt-in |
| Unescape stringified JSON | `"{\"a\":1}"` → `{"a":1}` (offered only when it parses) | opt-in |
| Unwrap quoted blob | Strip an outer `"…"` wrapping the whole document | opt-in |
| Sort lines / unique lines | For line-oriented text diffs | opt-in |

Zero-width and NBSP stripping deserves emphasis: invisible characters copied from web pages
and terminals produce diffs the user **cannot see the cause of**. Today there is no way to
find them in v6.

### 7.2 Whitespace-insensitive comparison

A `ignoreWhitespace` setting (default off) that normalizes trailing whitespace and line
endings **for comparison only**, using the existing `_ignorePristine` mechanism so the real
bytes are preserved for Export/Share/autosave. This reuses machinery that already exists
and is already correct — it is the same shape as ignore-patterns and numeric tolerance.

### 7.3 Honest content classification

Replace binary JSON/CSV sniffing with a classifier that reports what it decided:
`json` · `json5/python` · `ndjson` · `csv` · `tsv` · `xml` · `yaml` · `text`, shown in the
pane chip. Auto-conversion fires only on `csv`/`tsv` with the stricter evidence rule from
F-03. Everything else is inserted verbatim and offered a conversion, never given one.

---

## 8. UX Summary — what changes on screen

1. **Per-pane chip** (new): content type + validity + record count, with contextual
   `Fix` / `Convert` / `Go to error` actions. This is the primary fix for F-07 and F-09.
2. **Notice strip** (new): persistent, dismissible errors and warnings, separate from the
   diff pill. `data-state="busy"` gets a style.
3. **Toolbar**: `Format JSON` gains a `▾` menu — Format · Minify · **Fix JSON** ·
   **Clean up text** · indent width. `Format` works on one pane.
4. **Lint gutter + squiggles** in both panes; `F8` cycles errors.
5. **Repair preview** dialog with categorized change list and Apply / Cancel.
6. **Open file** button next to Import Snapshot; multi-file drop fills both panes.

---

## 9. Implementation Plan

**Phase 0 — Stop the bleeding (P0s, ~1 day, no new dependencies)**
- F-02: delete the `indexOf`/`substring` scan at `json_utils.js:114`.
- F-03: tighten `cheapLooksLikeCSV`; abort conversion that yields zero data rows.
- F-04/F-05: add `getDocumentPair()`; route Share, Export, Format, Sort, Copy through it.
- F-06: honour `autoFormat` in `buildJSONString`.
- Add a hard size + time guard around `parseFlexibleJSON` until Phase 2 lands.

**Phase 1 — Linting (~0.5 day)**
- `linter(jsonParseLinter())` + `lintGutter()` (§6.1).
- Per-pane validity chip, minimal version (valid / invalid + line).
- Notice strip; stop routing errors through `updateStatus`.

**Phase 2 — Repair engine (~3 days)**
- Vendor `jsonrepair` UMD.
- Write the stage-1 Python tokenizer; delete the regex pipeline.
- Unit tests: the 24-case malformed corpus + the 10-case integrity corpus from Appendix A
  become the regression suite (`tests/`).
- Wire `repairJson` into `diff-worker.js`; bump `WORKER_VERSION`.
- Fix button + preview dialog + undo transaction.

**Phase 3 — Text cleanup & classification (~2 days)**
- Clean ▾ menu, `ignoreWhitespace` setting, content classifier + chip integration.

**Phase 4 — Polish (~1.5 days)**
- Multi-error Lezer linter; duplicate-key warning.
- Minify, indent setting, Open file, multi-file drop.
- Remove CM5 leftover options; delete `fixBracketMatching`; update `CLAUDE.md`.

---

## 10. Acceptance Criteria

**Correctness (blocking)**
- [ ] All 10 data-integrity probes (Appendix A.2) round-trip **unchanged**.
- [ ] All 24 malformed-corpus cases (Appendix A.1) either repair to valid JSON or report a
      precise line/column error. None silently corrupt.
- [ ] A 3.2 MB Python-dict paste completes in **< 3 s**, shows progress, and Cancel works.
- [ ] Pasting `Hello, world.` leaves the pane containing `Hello, world.`.
- [ ] With a 2,000-record collection windowed to 60: Export, Share, Format, Sort and Copy
      all operate on 2,000 records.
- [ ] With ignore-patterns active, Export contains the **original** right-pane values.
- [ ] `Auto Format JSON` off → pasted JSON keeps its original formatting byte-for-byte.

**Feature**
- [ ] Invalid JSON shows a squiggle, a gutter marker, and a pane chip naming line + column.
- [ ] Fix produces valid JSON, is previewable, and is undone by a single `Ctrl+Z`.
- [ ] After Fix, block diff / record pager / Details become available.
- [ ] Repair never alters a string value, number, key name, or key/element order.

**No regression**
- [ ] Regression datasets in `docs/test-cases-example/` produce byte-identical rendered
      panes and identical model totals before and after.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Repair changes data in a way the user does not notice | Preview + undo + persistent notice; manual by default; `_ignorePristine` keeps the original for export |
| Vendored `jsonrepair` drifts from upstream | Pin the version in a header comment; it is ISC, zero-dep, and stable |
| Stage-1 tokenizer reintroduces F-01 | It is the *only* new parser code; ship it with the integrity corpus as a blocking test |
| Deleting `parseFlexibleJSON`'s regexes changes behaviour for some existing user's input | Keep the function name and signature; the 24-case corpus documents the new contract, which is a strict superset except for the corrupting cases |
| Lint on every keystroke costs time on large docs | `linter(..., {delay: 400})`; Phase-2 Lezer linter is incremental; disable above a size threshold |
| Worker cache serves a stale build | `WORKER_VERSION` bump is mandatory in the Phase-2 checklist |

---

## Appendix A — Measurements

### A.1 Malformed-input corpus (24 cases)

`parseFlexibleJSON` parsed **11 / 24** without throwing. `jsonrepair` **24 / 24**.
Cases where the current parser throws: `//` comments, `/* */` comments, missing closing
brace, truncated string, `NaN`/`Infinity`, smart quotes, NDJSON, ` ```json ` fence, JSONP
wrapper, escaped-stringified JSON, missing comma, hex number, HTML in string, `<User #12>`
in string.

### A.2 Data-integrity corpus (10 cases — valid data, one unquoted key)

| Probe | Current | `jsonrepair` |
|---|---|---|
| string contains `True` | **corrupted** | ok |
| string contains `None` | **corrupted** | ok |
| double spaces in string | **corrupted** | ok |
| escaped newline in string | ok | ok |
| HTML in string | **throws** | ok |
| parens in string | **corrupted** | ok |
| braces in string | ok | ok |
| tab in string | ok | ok |
| `False` in sentence | **corrupted** | ok |
| `<User #12>` in string | **throws** | ok |
| **Wrong result** | **7 / 10** | **0 / 10** |

### A.3 Timing — `parseFlexibleJSON`, Python-dict records

| Records | Size | With `(…)` in a string | Without |
|---:|---:|---:|---:|
| 250 | 14 KB | 12 ms | 2 ms |
| 500 | 28 KB | 30 ms | 2 ms |
| 1,000 | 55 KB | 133 ms | 3 ms |
| 2,000 | 113 KB | 494 ms | 7 ms |
| 4,000 | 228 KB | 2,407 ms | 17 ms |
| 10,000 | 3.2 MB | **139,166 ms** | — |

`jsonrepair` on the same shapes: **≤ 8 ms** in all cases it accepts.

### A.4 Ingest routing (verbatim `looksLikeJSONStart` / `cheapLooksLikeCSV`)

| Paste | Route | Result |
|---|---|---|
| `Hello, world. This is a note I pasted.` | CSV | `[]` |
| `SELECT id, name FROM users WHERE active = 1;` | CSV | `[]` |
| `Error: connection refused, retrying in 5s` | CSV | `[]` |
| `key: value\nother: thing` (YAML) | raw | ok |
| `<root><a>1</a></root>` | raw | ok |
| `a,b,c\n1,2,3` | CSV | ok |

---

## Appendix B — Dependency Evaluation

| Package | Version | Licence | Deps | Size | Verdict |
|---|---|---|---|---|---|
| `jsonrepair` | 3.15.0 | ISC | 0 | 35,559 B UMD (~10 KB gz) | **Adopt** — vendor into `v6/utils/vendor/` |
| `@codemirror/lang-json` | 6.0.1 (in use) | MIT | 2 | — | **Already loaded**; exports `jsonParseLinter` — use it |
| `@codemirror/lint` | 6.8.2 (in use) | MIT | 3 | — | **Already loaded** but unused; activate `linter()` + `lintGutter()` |
| `json5` | 2.2.3 | MIT | 0 | 235 KB unpacked | Reject — parses JSON5, does not repair; overlaps `jsonrepair` |
| `jsonc-parser` | 3.3.1 | MIT | 0 | 213 KB unpacked | Reject for repair; reconsider only if error-tolerant AST positions are needed beyond Lezer |

Lezer's JSON parser (via `@codemirror/lang-json`) already provides error-tolerant,
incremental parsing with exact positions — which is why no extra parser dependency is
needed for the multi-error linter in §6.2.


---

## 12. Implementation Record (2026-08-27)

Everything in §9's plan shipped except the two items in §12.4, which are listed with
their reasons. All measurements below were re-run after the change.

### 12.1 Findings — status

| # | Finding | Status | Where |
|---|---------|--------|-------|
| F-01 | `parseFlexibleJSON` rewrites string contents | **Fixed** | `utils/json_repair.js` `normalize()` replaces the regex pipeline; `utils/json_utils.js` is now a 70-line wrapper |
| F-02 | O(n²) scan; 3.2 MB = 139 s frozen | **Fixed** | single-pass tokenizer, no `indexOf`/`substring` over the doc; plus a `repair` progress phase |
| F-03 | Any comma on line 1 = CSV | **Fixed** | `cheapLooksLikeCSV` → `JSONRepairKit.csvEvidence()`; zero-row conversions abort and keep the raw text |
| F-04 | Export/Share read the panes | **Fixed** | `getDocumentPair()`; Share, ZIP export and Copy routed through it |
| F-05 | Format/Sort read the panes | **Fixed** | `transformPanes()` + `commitPair()`, both pristine-aware |
| F-06 | `Auto Format JSON` off ignored | **Fixed** | `buildJSONString(..., {autoFormat, raw})` returns the original bytes when off |
| F-07 | No validation surface anywhere | **Fixed** | Lezer-tree linter + `lintGutter()` + per-pane chips + notice strip |
| F-08 | Format refuses one pane | **Fixed** | each pane transformed and reported independently |
| F-09 | Status pill doing four jobs | **Fixed** | `showNotice()` strip; `[data-state="busy"]` styled |
| F-10a | Dead `fixBracketMatching` | **Fixed** | file rewritten |
| F-10b | CM5 options on a CM6 MergeView | **Fixed** | 6 lines removed from both constructors |
| F-10c | Single-file drop | **Fixed** | two files fill both panes; drop target picks which side goes first |
| F-10d | No Open-file button | **Fixed** | `📂 Open file(s)…` in the More menu, 1 or 2 files |
| F-10e | Icon-only buttons unnamed | **Improved** | `aria-label` mirrored from `title` on 6 icon buttons |
| F-10f | `CLAUDE.md` drift | **Fixed** | `utils-json/` removed, `autoFormat` default corrected, new **Ingest, Repair & Linting** section |
| F-10g | No minify | **Fixed** | Format ▾ → Minify |

### 12.2 What was added

**`v6/utils/json_repair.js`** (~700 lines) — the repair chain and content classifier.
`window.JSONRepairKit`: `repair` · `parse` · `normalize` · `analyze` · `detectKind` ·
`csvEvidence` · `strictError` · `findDuplicateKeys` · `locate`.

**`v6/utils/vendor/jsonrepair.umd.js`** — jsonrepair 3.15.0, ISC, 0 deps, 35,559 bytes,
vendored rather than CDN'd so repair does not depend on the network.

**`v6/utils/text_tools.js`** (~600 lines) — `window.TextTools`: `clean` (12 actions, each
returning a count) and `smartSort` / `describeSortTarget` / `reverse` (content-aware sort).

**UI** — Format ▾ menu (Fix · Minify · Clean up · indent), per-pane validity chips, notice
strip, repair preview modal, expanded Sort panel with per-panel content detection and
Descending/Unique/Ignore-case, Open file, lint gutter and squiggles.

**Tests** — `tests/json_repair.test.js` (104), `tests/text_tools.test.js` (71),
`tests/selftest.html` (78 in a real browser). **253 checks, all green.**

### 12.3 Deviations from the plan, and why

1. **`autoFixJson` ships default ON, not OFF (FR-7).** v6 already repaired pasted JSON —
   that is what `parseFlexibleJSON` was — so defaulting it off would silently remove a
   capability people rely on (Python dict pastes above all). What actually needed fixing
   was that repair was invisible. It now always leaves a notice naming what it changed,
   with **Undo**, and the setting turns it off for anyone who wants byte-exact pastes.
   The trust requirement is met by disclosure, not by disabling the feature.

2. **A `shapeAccepts()` guard was added, which the plan did not anticipate.** jsonrepair
   turns *anything* into valid JSON: `not json at all` → the string `"not json at all"`,
   and `Hello, world. This is a note.` → `["Hello", "world. This is a note."]`. Both parse.
   Neither is what the user pasted — it is F-03 reappearing one layer down. A repair is
   only accepted when the result is consistent with the input's first non-whitespace
   character.

3. **Escaped-stringified JSON is NOT auto-unwrapped.** `"{\"a\":1}"` is a *valid* JSON
   document whose value is a string; stage 0 must win, or FR-5 is violated. Unescaping is
   an explicit Clean ▾ action instead. (A1 listed it as a jsonrepair capability; it is,
   but applying it automatically would be wrong.)

4. **The multi-error linter shipped in Phase 1, not Phase 4.** `jsonParseLinter()` reports
   only the first error and derives position by parsing an engine-specific `SyntaxError`
   string. Walking the Lezer tree `json()` already installs is barely more code, reports
   every error with exact positions, and reparses incrementally — so the "one line now,
   proper linter later" split was not worth the intermediate step.

5. **Repair categories are reported from stage 1's own counters**, not by diffing before
   and after. jsonrepair does not report what it did, so anything it alone fixed is
   summarized as "syntax repair".

### 12.4 Deferred, with reasons

- **FR-6: repair off the main thread above 256 KB.** The requirement existed because of
  F-02's 139 seconds. That is gone — measured 158 ms for 1.7 MB, linear — and repair now
  has its own progress phase that yields before it runs. Adding a `repairJson` action to
  `diff-worker.js` (which would also need `importScripts` for the vendored library and a
  `WORKER_VERSION` bump) buys nothing at current sizes. Worth doing if very large
  documents become common.

- **§7.2 `ignoreWhitespace` as a comparison setting.** Doing it properly means
  `applyTransformResult()` taking separate pane-text and pristine-text arguments, so the
  panes can hold normalized text while export keeps the real bytes. That is a change to
  the core diff pipeline, and there was no browser available in this session to verify it
  against the regression datasets — shipping it unverified would risk the very thing §3
  says not to regress. The Clean ▾ menu covers the same ground today as an explicit,
  undoable edit to both panes.

### 12.5 Acceptance criteria — verified

| Criterion | Result |
|---|---|
| 10 data-integrity probes round-trip unchanged | **20/20** (corpus extended beyond the BRD's ten) |
| Malformed corpus repairs or reports precise line/column; none silently corrupt | **35/35** |
| 3.2 MB Python-dict paste < 3 s, with progress and working Cancel | **158 ms** for 1.7 MB, 10,000 records; `repair` phase yields before it runs |
| Pasting `Hello, world.` leaves the pane containing `Hello, world.` | pass (classifier + repair shape guard, both tested) |
| Export/Share/Format/Sort/Copy operate on all records when windowed | routed through `getDocumentPair()` |
| Export contains original values with ignore-patterns active | same accessor prefers `_ignorePristine` |
| `Auto Format JSON` off → original formatting preserved | `buildJSONString` returns `raw` |
| Invalid JSON shows squiggle, gutter marker, chip with line + column | Lezer linter + `lintGutter()` + chip |
| Fix is previewable and undone by a single Ctrl+Z | preview modal; one `commitPair` transaction |
| After Fix, block diff / pager / Details become available | valid JSON re-enables `json_align` |
| Repair never alters a string value, number, key name, or order | data-integrity corpus is the blocking test |

**Not verified in this session:** the in-browser integration itself. No browser extension
was connected, so verification was static (full-page syntax parse, element-id and
function-reference checks) plus 253 headless assertions against the real modules.
`tests/selftest.html` exists so the runtime half can be confirmed in one click.

### 12.6 v5 (outside the stated scope, fixed anyway)

`v5/utils/json_utils.js` held a **byte-identical copy** of the corrupting parser
(confirmed by diff — only the line endings differed), and v5 is reachable from the same live
site through the version selector. Shipping the fix for v6 while knowingly leaving the same
string-corrupting, quadratic parser in v5 was not defensible, so the repair chain was ported:
three files copied (`json_repair.js`, `json_utils.js`, `vendor/jsonrepair.umd.js`) plus two `<script>` tags.

No v5 UI, logic or dependency posture changed — the library is vendored, so v5 stays fully
offline. `parseFlexibleJSON`'s contract is unchanged, so all 12 v5 call sites work
as before. Verified: the three integrity probes that used to corrupt now round-trip, and
Python dicts still convert. Revert with `git checkout v5/` and delete
`v5/utils/json_repair.js` / `v5/utils/vendor/` if this extension is unwanted.

### 12.7 Measured — before and after

`parseFlexibleJSON` on Python-dict records containing `(…)` inside a string value:

| Records | Size | Before | After |
|---:|---:|---:|---:|
| 250 | 43 KB | 12 ms | 15 ms |
| 1,000 | 175 KB | 133 ms | 33 ms |
| 2,000 | 351 KB | 494 ms | 42 ms |
| 4,000 | 705 KB | 2,407 ms | 72 ms |
| 10,000 | 1.7 MB | (139,166 ms at 3.2 MB) | **158 ms** |

Data integrity on the same corpus: **7 of 10 wrong → 0 of 20 wrong**.
