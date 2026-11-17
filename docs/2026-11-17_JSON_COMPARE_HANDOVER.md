# Handover note: json_compair (v6), 2026-11-17

Sources: the three open GitHub issues, `CLAUDE.MD`, [PRD/16-large-dataset-phase1-findings.md](PRD/16-large-dataset-phase1-findings.md), and the v6 code. The app was not run in a browser for this note; issue status comes from commits, docs and code.

## 1. Current status

- **Branch:** `feat/2026-11-updates`, clean, with no commits ahead of `main`.
- **Tests:** all 10 Node suites pass (361 checks).
- **Issue 1 (complete export, Import Replace/Merge):** built in `ac5c56f` and `5677863`. The issue is still open.
- **Issue 2 (Reset, separate from Clear all):** built in `7b3c3ee` and `c369637`. The issue is still open.
- **Issue 3 (smart, configurable formatting):** not started.
- **Large datasets:** phase 1 was measurement only. Its six small fixes and the phase 2 redesign are not done.

What Format does today:

| Piece | Where | Behaviour |
|---|---|---|
| Format button | `formatJSON()`, `v6/index.html:6496` | `JSON.stringify(parsed, null, indent)` per pane, so every array item gets its own line |
| Format ▾ menu | `#format-panel`, `v6/index.html:146` | Fix JSON, Minify, Clean up text, Indent (2/3/4/tab, default 3) |
| What the panes show | `ser()`, `v6/utils/json_align.js:316` | With Block Diff on (the default), alignment re-serializes both panes itself, one value per line |

## 2. Identified gaps

1. **Issue 3 is entirely missing:** no inline arrays, no line width, no array mode, no presets, no preview, no Format Left/Right.
2. **Changing `formatJSON()` alone will do nothing.** Alignment re-renders the panes straight after, so the inline rule must live in `json_align.js`.
3. **Wrong over-cap message:** `v6/index.html:9284` tells users to "use CSV→JSON" even when the data is already JSON.
4. **Partial result not flagged:** when CSV rows are capped (`MAX_RENDER_CELLS_PER_PANEL`), the status pill does not say the result covers a sample.
5. **Memory kept after Clear:** `lastRawCsv` (`v6/index.html:8223`) is set at line 8497 and never released.
6. **Slow snapshot import:** `applyImportedSnapshot()` (`v6/index.html:7875`) writes raw text before aligning (5.9 s against 0.23 s for a paste of the same 20 MB pair).
7. **Docs out of date:**
   - `CLAUDE.MD` line 1373 says the alignment cap is 24 MB; the code says 64,000,000 chars.
   - `CLAUDE.MD` says `key_compare` has 55 checks; it has 53.
   - `CLAUDE.MD` points to `todo.md` and `prd.md`, which do not exist.
   - `CLAUDE.MD` "Last Updated" reads 2026-08-28.
   - `README.md` still describes v5.
8. **Real data in the repository and its history** (findings doc §7). This needs a history rewrite and force push, so it is for the owner only.
9. **Large files:** there is no record comparison above about 8 MB CSV or 32 MB JSON per file. This needs the phase 2 redesign and an owner decision.

## 3. Required updates and how to do them

### Task A: inline arrays (issue 3, priority 1)

Rule: an array holding only primitives (string, number, boolean, null) goes on one line when the line fits the width. Arrays with objects or nested arrays stay as they are.

1. In `json_align.js`, next to `INDENT` and `setIndent()` (lines 81–90), add `LINE_WIDTH` (default 120) and `ARRAY_MODE` (`'auto'` or `'expanded'`) with one setter, `setFormat({lineWidth, arrays})`.
2. In `ser()`, before the array loop: if the mode is `'auto'`, every element is primitive, and `pad + '[' + items.join(', ') + ']'` fits `LINE_WIDTH`, return that single line.
3. In `alignValue()` (line 1440), before the call to `alignArrayPretty`: if both `a` and `b` are primitive-only arrays and both fit inline, return `padToEqual(ser(a, pad), ser(b, pad))`. If either does not fit, leave today's path. This keeps the two panes row-aligned.
4. Export a `JSONAlign.stringify(value)` that returns `ser(value, '').join('\n')`.
5. In `index.html`, use it in `formatJSON()` (line 6500) and in the sort output (lines 7383 and 7566) in place of `JSON.stringify(…, null, indent)`.
6. Extend `syncAlignIndent()` (line 6368) to push the two new settings as well.

Do not touch `diff-worker.js` (CSV rows hold no arrays) or `utils_zip.js` (the export format stays).

Check these four readers, which assume one value per line. Fix only what a test shows broken:

| Reader | File | What to test |
|---|---|---|
| `JSONContext.parseLine` / `at` | `v6/utils/json_context.js` | Right-click on `"months": [1, 2, 3]` gives key `months` and the right path for the lines below it |
| `computeIgnoredLines` | `v6/utils/diff_ignore.js` | Ignoring `months` greys exactly that one line |
| `ValueEquiv.rowsEquivalent` | `v6/utils/value_equiv.js` | An inline array row does not crash and is not wrongly called equivalent |
| `findKeyLine` (Keys dialog jump) | `v6/index.html` | Clicking a key after an inline array lands on the right line |

### Task B: settings and controls (issue 3, priority 2)

1. Add `lineWidth: 120` and `arrayFormat: 'auto'` to the defaults in `v6/utils/utils.js:283`, next to `indentWidth`.
2. In `#format-panel`, under the Indent select, add two selects: **Arrays** (Auto / Expanded) and **Line width** (80 / 100 / 120 / 160 / No limit).
3. Wire them in `initializeFormatPanel()` (line 7288) by copying the `indentSel` handler: save, `syncAlignIndent()`, `_lastAlignMemo = null`, re-align.
4. Reload and confirm both controls come back (`CLAUDE.MD` rule 2b).

### Task C: Format Left / Right (issue 3, priority 3)

1. Give `transformPanes(fn, label)` (line 6440) an optional third argument `onlySide`, and skip the other side in its loop.
2. Add "Format left" and "Format right" items to `#format-panel` and wire them with the existing `wire()` helper.

### Task D: four small fixes (findings doc §8), one commit each

1. **Message:** at line 9284, replace the text with one that fits JSON too, for example "Too large to match records — showing a plain text comparison".
2. **Partial result:** when the row cap was applied, append "· first N rows only" to the status pill in `updateDiffStatus()`.
3. **Memory:** in `clearPanels()` (line 8809) and the per-pane Clear, set `lastRawCsv[side] = null`.
4. **Import:** make `applyImportedSnapshot()` load panels through `restorePair()` (line 8946) instead of raw writes. Test Replace, Merge and Cancel again afterwards (checklist items 35 and 36 in `CLAUDE.MD`).

### Task E: docs

Correct the five items in gap 7. For `README.md`, only a short v6 section and a pointer to `CLAUDE.MD`.

### Rules for whoever does this

- One feature or fix per commit; never push; no AI attribution in commit messages.
- No build step: edit, press F5.
- Run all `node tests/*.test.js` before each commit.
- New pure logic gets checks in the matching test file (inline arrays go in a new `tests/format.test.js`).
- Read `CLAUDE.MD` "Ingest §4–5" before touching anything that writes a pane.

## 4. Pending tasks, in order

| # | Task | Size | Who |
|---|---|---|---|
| 1 | Close issues 1 and 2 after running checklist items 34–36 in the app | 15 min | Owner |
| 2 | Task A: inline arrays, with tests | Medium | Junior / agent |
| 3 | Task B: Arrays and Line width controls | Small | Junior / agent |
| 4 | Task D1: over-cap message | Tiny | Junior / agent |
| 5 | Task D3: release `lastRawCsv` | Tiny | Junior / agent |
| 6 | Task D2: partial-result wording | Small | Junior / agent |
| 7 | Task C: Format Left / Right | Small | Junior / agent |
| 8 | Task D4: import through `restorePair()` | Medium | Stronger developer |
| 9 | Task E: docs | Small | Junior / agent |
| 10 | Decide the rest of issue 3 (see §5) | Decision | Owner |
| 11 | Remove real data from history (findings doc §7) | Risky | Owner only |
| 12 | Large-dataset phase 2 (worker pipeline) | Large | Owner decision, not a junior task |

## 5. Decisions for the owner

- **Issue 3 scope.** Left out of this note: presets, compact objects, the preview pane, per-panel preferences, key sort in the formatter, and Unicode and spacing options. They add many settings for little gain, and Sort ▾ already sorts keys. The cost of leaving them out is that acceptance criteria 8 and 9 of the issue stay unmet.
- **Indent default.** The issue asks for a default of 2 and options 2/4/tab; the app has a default of 3 and offers 2/3/4/tab. Suggested: keep the app's values so existing users see no change.
- **"Compact" array mode.** With a line-width limit it behaves the same as Auto, so this note has two modes, not three.

## 6. Expected outcome

- Format gives `"months": [1, 2, 3, 4, 5, 10, 11, 12]` on one line; arrays of objects stay multi-line; long primitive arrays wrap as today.
- Both panes stay row-aligned, and formatting alone creates no differences.
- Arrays mode, line width and indent survive a reload.
- Each panel can be formatted on its own.
- Messages for large files are accurate, and Clear frees the raw CSV.
- Docs match the code; issues 1 and 2 are closed, and issue 3 is closed or reduced to the deferred parts.
- All existing tests plus the new format tests pass.
