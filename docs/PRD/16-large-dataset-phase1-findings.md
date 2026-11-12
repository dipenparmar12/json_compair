# 16 — Large datasets, phase 1: findings

Investigation and profiling only. No pipeline code was changed.

## Status

| | |
|---|---|
| Measured | Node stage timings 1 MB – 500 MB per file; browser ingest, replace, clear, page turn, race, snapshot import 1 MB – 500 MB per file |
| Code read | ingest pipeline, worker CSV conversion, `json_align` entry points, snapshot export/import, autosave |
| Not measured | Firefox, Safari, a machine with less memory, both sides of a 100 MB CSV pair converted in full (expected to crash the tab, see §2.3), `.json.gz` snapshots, the Keys dialog at size |
| App version | commit `0d14527` (a frozen copy; another session was editing `v6/index.html` during the runs) |

**Machine:** Intel Core i7-10750H (6 cores / 12 threads, 2.6 GHz), 15.8 GB RAM, Windows 11 build 26300.
**Node:** v22.23.2, `--max-old-space-size=4096` (to match a browser tab's heap).
**Browser:** Claude desktop preview pane, Chromium 156.0.8078.75, JS heap limit 4,192 MB.

All data was generated with `tools/gen_dataset.js` (20 columns, profile `changed:5` unless stated). "Per file" sizes are for one side; a pair is twice that.

## 1. Summary

1. **Under the alignment cap the app is fast.** A 30 MB + 30 MB JSON pair (66,682 records) compares in 1.5 s in the browser with a longest freeze of 0.7 s. Replace, race and Clear are all under 1.3 s.
2. **The cap is the wall.** `json_align.js` refuses pairs over `MAX_BYTES` = 64,000,000 characters combined. Past it there is no record matching, no window, no pager. Both whole documents go into CodeMirror and the status reads "Too large to compare precisely — use CSV→JSON so records can be matched individually", which is wrong advice for data that already is JSON. (`CLAUDE.MD` says the cap is 24 MB; the code says 64 MB.)
3. **CSV reaches the cap at about 8 MB per file** (20 columns), because CSV is converted to JSON pretty-printed at indent 3, which is 3.9× the CSV size. A 10 MB + 10 MB CSV pair already fails to compare and freezes the tab for 8.2 s in total.
4. **The matcher itself scales.** With the cap lifted, in Node, the existing `prepareAsync` compared a 500 MB + 500 MB JSON pair (1.11 M records each) in 50 s using 3.0 GB. Cost is linear (about 48 ms per MB of pair) and does not depend on how different the files are.
5. **CSV cannot reach 300–500 MB with the current data shape.** A 200 MB CSV file fails at `JSON.stringify` ("Invalid string length": V8 strings stop near 512 MB). A 300 MB CSV file runs out of the 4 GB heap while its rows are being built as objects.
6. **Three things are silently or quietly lossy at size:** the 2,000,000-cell row cap (a 100 MB CSV compares the first 15% of its rows; a toast says so), autosave above 4 MB (a toast says so once), and memory that Clear does not release (1.7–2.7 GB still held after Clear).

## 2. Measurements

### 2.1 Node, pure modules (cap lifted so the cost past it is visible)

`tools/bench_pipeline.js`, one pair per process. Milliseconds for the PAIR. `prepare` = `JSONAlign.prepareAsync` (parse + identity + match + model). Render = one window.

**CSV, 20 columns, `changed:5`**

| Per file | Rows per file | Pretty JSON (pair) | CSV parse | Stringify | prepare (parse / identity / match / model) | Render | Peak RSS | Outcome |
|---|---|---|---|---|---|---|---|---|
| 1 MB | 6,483 | 7.9 MB | 366 | 62 | 292 (81 / 53 / 4 / 154) | 40 | 125 MB | ok |
| 10 MB | 64,825 | 79 MB | 2,715 | 469 | 2,795 (540 / 602 / 19 / 1,633) | 28 | 479 MB | ok only with cap lifted; as shipped `prepare` returns `ok:false` |
| 50 MB | 324,127 | 397 MB | 15,382 | 2,526 | 13,935 (2,758 / 3,882 / 122 / 7,172) | 38 | 2,109 MB | ok (lifted) |
| 100 MB | 648,254 | 794 MB | 26,581 | 5,312 | 28,072 (4,146 / 8,426 / 209 / 15,290) | 47 | 3,614 MB | ok (lifted) |
| 200 MB | 1,296,507 | — | 55,907 | **fails** | — | — | 4,051 MB | `JSON.stringify`: Invalid string length |
| 300 MB | — | — | **crash** | — | — | — | > 4 GB | V8 heap out of memory during CSV parse (~97 s in) |
| 500 MB | — | — | **crash** | — | — | — | > 4 GB | same |

**JSON, flat records, one per line**

| Per file | Rows per file | JSON.parse | prepare (parse / identity / match / model) | Render | Peak RSS |
|---|---|---|---|---|---|
| 10 MB | 22,227 | 118 | 1,295 (295 / 306 / 41 / 652) | 33 | 149 MB |
| 50 MB | 111,136 | 848 | 4,155 (863 / 929 / 46 / 2,316) | 37 | 448 MB |
| 100 MB | 222,272 | 1,521 | 8,300 (1,113 / 2,169 / 53 / 4,964) | 38 | 895 MB |
| 200 MB | 444,544 | 2,675 | 20,035 (2,855 / 5,256 / 147 / 11,777) | 39 | 1,752 MB |
| 300 MB | 666,815 | 4,389 | 29,033 (4,774 / 8,435 / 245 / 15,579) | 45 | 1,828 MB |
| 500 MB | 1,111,359 | 9,172 | 49,785 (8,517 / 13,919 / 320 / 27,029) | 37 | 3,033 MB |

Other shapes: nested JSON 50 MB per file (70,351 records) — prepare 3,288 ms, 532 MB. Wide CSV 10 MB per file (400 columns, 3,215 rows) — CSV parse 2,583 ms, prepare 3,116 ms, 760 MB.

**Difference profiles, CSV 10 MB per file (64,825 rows)** — prepare ms (identity / match / model):

| Profile | prepare | Result reported |
|---|---|---|
| identical | 2,394 (567 / 19 / 1,396) | 64,825 same |
| changed:1 | 2,795 (602 / 19 / 1,633) | 10,252 changed |
| changed:25 | 2,313 (501 / 18 / 1,396) | 64,369 changed |
| changed:100 | 2,471 (482 / 20 / 1,606) | 64,825 changed, 1,118,219 field changes |
| schema | 2,719 (890 / 17 / 1,430) | 64,825 changed, 388,950 field changes |
| reordered | 2,807 (554 / 183 / 1,609) | 64,076 moved **of 128,901 items** |
| addremove:10 | 2,579 (569 / 40 / 1,554) | 6,423 added, 6,490 removed |
| different | 2,782 (2,347 / 21 / 25) | 64,824 added, 64,824 removed |

What this shows:

- Matching cost is flat across profiles (2.3–2.8 s). "Most records differ" is not a matcher problem.
- The model phase is the largest part (about 55%), then identity detection (about 30%). Match is 1%.
- Rendering a window is 30–50 ms at every size. It is already independent of collection size.
- CSV conversion costs as much as the whole comparison, and its objects take about 8× the CSV bytes in heap (180 MB heap for a 20 MB pair).
- A reordered pair reports twice the item count (every moved record is counted on both sides). A reporting oddity, not a performance issue.

### 2.2 Browser, full ingest path

Harness: `tools/bench_browser/` loaded into a frozen copy of the app; files fetched from the local server and passed to `ingestContent()`. "Blocked" = total time the main thread could not run a 20 ms timer; "longest" = the longest single freeze. Heap from `performance.memory` (main thread only; the worker is not included).

**CSV pairs, 20 columns**

| Per file | Load left | Load right (compare) | Result | Peak heap |
|---|---|---|---|---|
| 1 MB | 0.3 s, no freeze | 0.4 s, no freeze | correct, windowed | 74 MB |
| 5 MB | 1.0 s, longest 0.5 s | 1.2 s, longest 0.3 s | correct: 19,002 changed of 32,413 | 234 MB |
| 10 MB | 2.9 s, longest 1.7 s | blocked 8.2 s (4.3 + 2.2 + 1.6) | **"Too large to compare precisely"** | 897 MB |
| 50 MB | 5.6 s, longest 3.5 s | blocked 12.7 s (4.6 + 4.5 + 3.2) | same; **only 100,000 of 324,127 rows loaded** | 2,314 MB |
| 100 MB | 4.6 s, longest 2.6 s | blocked 6.9 s (3.2 + 2.0 + 1.5) | same; **100,000 of 648,254 rows (15%)** | 2,762 MB |

"Convert all anyway" (the opt-out of the row cap), one side only:

| CSV file | JSON in the editor | Time | Longest freeze | Peak heap |
|---|---|---|---|---|
| 50 MB | 198 MB | 12.8 s | 7.1 s | 2,065 MB |
| 100 MB | 397 MB | 34.5 s | 23.0 s | 3,563 MB of 4,192 |

The second side of the 100 MB case was not run: one side already uses 85% of the heap limit (estimate: the tab would crash).

**JSON pairs, one record per line**

| Per file | Load right (compare) | Result | Peak heap |
|---|---|---|---|
| 10 MB | 0.5 s, longest 0.2 s | correct: 13,045 changed of 22,227 | 63 MB |
| 30 MB | 1.5 s, longest 0.7 s | correct: 39,072 changed of 66,682 | 504 MB |
| 50 MB | blocked 0.8 s | **"Too large to compare precisely"** | 673 MB |
| 100 MB | blocked 2.0 s | same | 931 MB |
| 250 MB | blocked 4.2 s (longest 1.8) | same | 2,050 MB |
| 500 MB | blocked 9.1 s (3.3 + 3.25) | same | **4,055 MB of 4,192** |

JSON with one record per line loads quickly even when huge because the editor's cost follows line count. The same data pretty-printed (what CSV conversion produces) is the slow case in the CSV table.

### 2.3 Where it fails, and why

| Input | First failure | Cause |
|---|---|---|
| CSV ≥ ~8 MB per file (20 cols) | no record comparison | pretty JSON pair > `MAX_BYTES` (64 M chars) |
| JSON ≥ ~32 MB per file | no record comparison | same cap |
| CSV > 2,000,000 cells (16 MB at 20 cols) | rows dropped | `MAX_RENDER_CELLS_PER_PANEL`; toast offers "Convert all anyway" |
| CSV ~130 MB per file, converted in full | conversion error | pretty JSON > V8 string limit (~512 MB). Measured failing at 200 MB; 130 MB is 512 / 3.9, an estimate |
| CSV 300 MB per file | out of memory | row objects ≈ 8× CSV bytes; 4 GB heap |
| JSON 500 MB per file | loads, no comparison, 97% of heap used | whole documents held as strings and editor text |
| Any file > ~512 MB | cannot be read | `file.text()` returns one string (not run; V8 limit) |

One unexplained event: on the first 10 MB CSV run CodeMirror threw `Cannot read properties of undefined (reading 'length')` in `TextLeaf.lineInner` during the right-pane write, the ingest reported "Processing failed", and Clear then threw the same error. It did not recur in two later runs of the same pair. Not reproduced, cause unknown.

## 3. The reported freezes

Each was reproduced with generated data. Times are single main-thread freezes unless marked total.

| Scenario | Data | Blocking call | Blocked |
|---|---|---|---|
| First file into an empty panel | CSV 10 MB | `editor.dispatch` (whole 39.6 MB document into CodeMirror) | 1.7 s |
| | CSV 50 MB (capped to 61 MB JSON) | same | 3.5 s |
| | CSV 100 MB converted in full (397 MB JSON) | same | 23.0 s |
| Second file, pair over the cap | CSV 10 MB | `editor.dispatch` right (CodeMirror diffs two 40 MB documents) 4.3 s; `mergeView.reconfigure` 1.5 s; follow-up `editor.dispatch` left 0.6 s | 8.2 s total |
| | CSV 50 MB | `editor.dispatch` right 4.5 s; `mergeView.reconfigure` 3.5 s; `editor.dispatch` left 2.4 s | 12.7 s total |
| Drop or paste over an occupied panel, over the cap | CSV 10 MB | `doc.toString()` of the other pane (5 calls, 1.2 s total) + `editor.dispatch` 1.1 s | 2.7 s total |
| | CSV 50 MB | `doc.toString()` 2.8 s total + `editor.dispatch` 1.5 s | 6.1 s total |
| Same, under the cap | CSV 5 MB, JSON 30 MB | `JSON.parse` + pane writes | 0.35 s, 0.7 s |
| Clear, over the cap | CSV 10 MB / 50 MB / JSON 500 MB | one `editor.dispatch` that empties the pane | 1.3 s / 2.2 s / 1.4 s |
| Clear, under the cap | any | — | none (≤ 56 ms) |
| Replace one side while the other is processing | CSV 5 MB (under cap) | correct result, both jobs finish | 0.8 s longest |
| | CSV 50 MB (over cap) | `editor.dispatch` right 3.6 s, `mergeView.reconfigure` 3.0 s, `editor.dispatch` left 2.7 s | 14.0 s total |
| Import a large snapshot | JSON 10 MB per side (3.2 MB zip) | `applyImportedSnapshot` writes each raw document into the editor before aligning: `editor.dispatch` left 3.4 s, right 0.9 s | 5.9 s total |
| | (same pair pasted instead) | — | 0.23 s |
| Export a snapshot | same pair | `JSON.stringify(JSON.parse(…), null, 2)` per side + DEFLATE level 9, on the main thread in slices | 7.0 s wall, 0.7 s blocked |
| Most records differ, under the cap | CSV 5 MB `different` / `changed:100` / `reordered` | `doc.toString()` + `JSON.parse` + pane writes | 1.2 s / 0.7 s / 0.5 s longest |
| Most records differ, over the cap | any | same as "pair over the cap" | as above |
| Page turn | CSV 1 MB, JSON 10 MB | first `editor.dispatch` left of the new window | 1.0 s, 0.7 s (0.2 s in other runs) |

Pattern: every multi-second freeze is CodeMirror being handed a whole large document (`editor.dispatch`), or re-reading one (`doc.toString()`), or re-diffing two (`mergeView.reconfigure`). None of them is in `JSONAlign`.

## 4. Bottlenecks, ranked by impact

| # | Bottleneck | Evidence | Effect |
|---|---|---|---|
| 1 | `MAX_BYTES` 64 M chars in `json_align.js`, and the fallback past it (two whole documents in CodeMirror) | §2.2: 10 MB CSV pair → no comparison, 8.2 s blocked | No result above ~8 MB CSV / ~32 MB JSON per file |
| 2 | Pretty-printed JSON text as the format between stages (CSV → objects → indent-3 string → clone to main thread → `JSON.parse` again) | 3.9× size; `JSON.stringify` fails at 200 MB CSV | Hard ceiling near 130 MB CSV per file; doubles parse work |
| 3 | Whole files as single strings and whole object graphs in one 4 GB heap | 300 MB CSV: OOM; 500 MB JSON pair: 4,055 MB | Hard ceiling; 500 MB JSON is at the edge with no comparison running |
| 4 | The first file of a pair, and every over-cap pair, is written whole into the editor | `editor.dispatch` 1.7–23 s | The freezes users see |
| 5 | Matching and the field model run on the main thread | 28 s for a 100 MB CSV pair in 12 ms slices | Tab stays responsive but competes with rendering; nothing else can run |
| 6 | Row cap of 2,000,000 cells | 100 MB CSV → 15% of rows | The reported result describes a sample |
| 7 | Snapshot import writes raw text before aligning | 5.9 s vs 0.23 s for a paste | Freeze on import at sizes that paste fine |
| 8 | Memory not released by Clear | heap 1,712 MB after Clear (CSV 100 MB), 2,721 MB after a full convert | Second large comparison in the same tab starts near the limit. Holders: `lastRawCsv` (raw CSV per side, never cleared), editor undo history |
| 9 | `doc.toString()` on a large pane (ingest reads the other pane; chips; save) | 1.2–2.8 s total per replace | Adds to every action on an over-cap pair |
| 10 | Snapshot export on the main thread | 7 s for a 20 MB pair | Slow, mostly not blocking |
| 11 | No autosave above 4 MB | code | A reload loses the comparison; restore card never appears |

## 5. Size limits and caps

| Name (file) | Value | Past it | User told? |
|---|---|---|---|
| `MAX_BYTES` (json_align.js) | 64,000,000 chars, both sides | `align` / `prepare` / `prepareAsync` return `ok:false`: no matching, model, window, pager, Details | Indirectly, and wrongly: "Too large to compare precisely — use CSV→JSON…" |
| `MAX_RENDER_CELLS_PER_PANEL` (index.html) | 2,000,000 cells (rows × columns) | CSV conversion stops at that many rows | Yes: persistent toast "showing first N of ~M rows", with "Convert all anyway". The status pill does not say the result is partial |
| `AUTOSAVE_MAX_BYTES` | 4 MB combined | Nothing saved; reload loses the work | Yes, one toast per session |
| `FORMAT_MAX_BYTES` | 4 MB | Pasted JSON is not repaired, formatted or sorted; inserted as-is | No |
| `MAX_BYTES` (json_repair.js) | 32 MB | Repair refuses | Yes, in the error text |
| `PRETTY_MAX_BYTES` (json_align.js) | 800,000 chars combined | Render switches to a window of records | Yes (pager) |
| `EXPAND_CHAR_BUDGET` | 400,000 chars | `view:'full'` stops expanding changed records | No |
| `SCAN_RAISE_MAX_BYTES` | 3 MB | CodeMirror's diff keeps a low effort cap; unaligned text becomes one change | Partly ("Too large to compare precisely") |
| `SCAN_LIMIT_MAX` | 250,000 | Diff effort not raised further | No |
| `MYERS_MAX_DIFF_RATIO` | 0.25 | Page with more differing lines is one chunk | No (documented as deliberate) |
| `PROGRESS_MIN_BYTES` | 512 KB | Below: synchronous path, no progress or Cancel | n/a |
| `OFFTHREAD_CSV_THRESHOLD` | 100 KB | Below: CSV parsed on the main thread | n/a |
| `PROACTIVE_COLLAPSE_BYTES` | 300 KB | Collapse Unchanged forced for this render | Checkbox changes |
| `DETECT_MAX_BYTES` | 512 KB | CSV↔JSON button detection skipped | No (buttons absent) |
| `TEXT_EQ_MAX_BYTES` | 1 MB | Text equality skipped; chunk list used | No |
| `CHIP_MAX_BYTES` | 4 MB | Pane chip: "N MB — too large to validate continuously" | Yes |
| `CHIP_REPAIR_MAX_BYTES` | 512 KB | No trial repair, so no Fix offer on the chip | No |
| `LINT_MAX_BYTES` | 2 MB | No syntax diagnostics | No |
| `DUPKEY_MAX_BYTES` | 512 KB | No duplicate-key warnings | No |
| `BRANCH_COMPARE_MAX_BYTES` | 2 MB | Branch "unsaved" check skipped | No |
| `RESTORE_ASK_BYTES` | 1 MB | Restore asks first | Yes (card) |
| `EMBED_MAX_CHARS` (json_align.js) | 2,000,000 | Longer embedded JSON strings stay strings | No |
| `MAX_ROWS` (key_compare.js) | 2,000,000 rows | Keys table truncated (`truncated` flag) | Flag exists; UI wording not checked |
| `DD_MAX_ROWS` | 500 | Details lists the first 500 | Yes |
| `INFO_SAMPLE`, `ID_SAMPLE` | 400, 200 records | Identity and informative-key detection use a sample first | No (heuristic, not a truncation) |
| `SNIFF_MAX` (json_repair.js) | 2 MB | Type detection reads at most this much | No |
| Share link | 2,000 chars | ZIP download instead | Yes |
| V8 string length | ~512 MB | `file.text()`, `JSON.stringify`, `doc.toString()` throw | Generic "failed" message |
| Tab JS heap | 4,192 MB here | Tab crash | No |

## 6. Where a large document is copied

For one CSV side of size S; J = its pretty JSON (≈ 3.9 S at 20 columns). Sizes for the JSON path are the same from step 7 on, with J = the file.

| # | Where | Kind | Size | Lifetime |
|---|---|---|---|---|
| 1 | `file.text()` in `handleFileDrop` / file open | string | S | until ingest ends |
| 2 | `lastRawCsv[side]` | reference to (1) | S | **never released**, not even by Clear |
| 3 | `postMessage` to the worker | structured clone | S | worker, during parse |
| 4 | `csvText.replace(/\r\n|\r/g, "\n").trim()` in the worker | string | up to S | during parse |
| 5 | row objects in the worker | parsed | ≈ 8 S (measured) | until stringify ends |
| 6 | `JSON.stringify(arr, null, 3)` in the worker | string | J | until posted |
| 7 | result posted back | structured clone | J | main thread |
| 8 | `otherPane.state.doc.toString()` / `_ignorePristine` side | string | J of the other side | per ingest |
| 9 | `JSON.parse` in `prepareAsync` (both sides) | parsed | ≈ 2 J (estimate from heap) | while `_alignHandle` lives |
| 10 | `_ignorePristine = {left, right}` | strings | 2 J | until content changes |
| 11 | model (`items`, per-item changed fields) | objects | grows with changed records | with the handle |
| 12 | editor document | CodeMirror `Text` | window only when aligned; **whole J per pane** otherwise | until replaced |
| 13 | editor undo history | `Text` of replaced documents | up to J per replace | until history is dropped |
| 14 | `saveContent` → `JSON.stringify({left, right})` → localStorage / IndexedDB | serialized | 2 J (only ≤ 4 MB) | stored |
| 15 | branch save (`BranchManager.saveBranch`) | string in IndexedDB | J per branch | stored |
| 16 | export: `JSON.stringify(JSON.parse(text), null, 2)` per side, `branches.json`, zip buffers | parsed + string + bytes | ≈ 3 J transient | during export |
| 17 | import: unzip to string, raw write to editor, then align | string + `Text` + (9–12) | J + J | as above |
| 18 | pane chips / `updateConversionButtons` / status (`doc.toString()`) | string | J | transient, per debounce (size-gated) |

At the peak of a CSV ingest, one side exists as about S + S + 8 S + J + J in the worker and main thread together, before alignment adds 2 J parsed and 2 J pristine.

## 7. Real or business-derived data in the repository

Listed by path only; file contents were not copied into this document. "Evidence" says why it is on the list. Nothing was deleted or rewritten.

**In the working tree and in history**

| Path | Size | Added by | Evidence |
|---|---|---|---|
| `docs/test-cases-example/bwoser-tabs-freezed-on-this-data/assessor__attom_2026-07-28.csv` | 1.0 MB | `5e43b18` 2026-07-28 "docs: demo large dataset" | property assessor export (named as real data in `CLAUDE.MD`) |
| `docs/test-cases-example/bwoser-tabs-freezed-on-this-data/lb-parcels.csv` | 1.6 MB | `5e43b18` | parcel export, same source |
| `tests/projects.json`, `tests/projects_cln.csv` | 6 KB, 3 KB | `719a382` 2025-11-12 | project list; owner to confirm whether real |
| `tests/test_case_objects/branches.json` (14 KB) and the other `tests/test_case_*` files | small | `35066ab`, `e7220a1` 2025-11-26 | exported snapshots; owner to confirm |
| `_archive/json_compair 3.zip` (108 KB) | | `bbad941` 2025-01-31 | archive of an old copy; contents not inspected |

**In history only (deleted from the tree, still in commits)**

| Path | Added by |
|---|---|
| `docs/test-cases-example/json-compare-snapshot-2026-07-02T07-54-12.zip` (14 KB) | `0613d5a` 2026-07-02 |
| `docs/test-cases-example/json-compare-snapshot-2026-06-06T06-37-28/*` | `cc06279` 2026-06-06 |
| `docs/test-cases-example/json-compare-collection-array-item/*` | `cfab0ab` 2026-06-06 |
| `.output/projects.json`, `.output/projects_changes.json` | `c29e5fe` 2025-10-29 |

**In stashes (local only, `refs/stash`)**

| Path | Stash |
|---|---|
| `docs/test-cases-example/freezes_browser/results_skip_steps_true.csv` (206 KB) | `stash@{0}` (`1f06969`, index commit `439b19b`) |
| `docs/test-cases-example/json-compare-snapshot-2026-10-28T15-37-48.zip` (67 KB) | same |
| `stash@{1}`, `stash@{2}` | "test case snapshot", "test cases" — contents not inspected |

**Untracked, never committed — keep it that way**

`docs/test-cases-example/not-working/` — four CSV files, 8.5–10.4 MB each. The header row contains property address, ZIP and home id columns.

**Text that quotes real field names or paths** (not data files, but derived from them): `CLAUDE.MD`, `AGENTS.md`, `docs/LARGE-COLLECTION-DIFF-AND-SETTINGS.md`, `docs/injection_compare_functional_analysis.md`, `tests/embedded_json.test.js`, and comments in `v6/index.html`, `v6/utils/json_align.js`, `v6/utils/value_equiv.js`.

The six curated pairs `docs/test-cases-example/00-…` to `05-…` (`6d4bdf0`, `e40582a`) were written as public examples and look synthetic.

**Suggested steps, for the owner to run** (this rewrites every commit hash; all 37 remote branches need a force push; collaborators must re-clone):

```bash
pip install git-filter-repo
```

```bash
git clone https://github.com/dipenparmar12/json_compair.git json_compair-clean
```

```bash
git filter-repo --invert-paths --path docs/test-cases-example/bwoser-tabs-freezed-on-this-data --path docs/test-cases-example/freezes_browser --path docs/test-cases-example/json-compare-collection-array-item --path-glob "docs/test-cases-example/json-compare-snapshot-*" --path .output --path tests/projects.json --path tests/projects_cln.csv --path "_archive/json_compair 3.zip"
```

Before running it: decide on the "owner to confirm" rows and remove those paths from the command if they are fine; replace the two real CSVs with a pair from `tools/gen_dataset.js` in a normal commit first; drop the three local stashes (`git stash drop`) in the working clone, since a fresh clone does not carry them but the old clone does. To scrub field names from text, add `--replace-text expressions.txt` (one `literal==>replacement` per line). After the force push, GitHub can still serve the old commits by hash and from forks or pull-request refs until GitHub Support runs a garbage collection, and the Pages site must be redeployed.

## 8. Phase 2: recommended design

### What the measurements say about the design

- Keep: record matching and the field model (`JSONAlign`), the windowed render, `KeyCompare`, the progress and cancel plumbing. They are linear, correct under the cap, and 30–50 ms per window at any size.
- Change: how data gets to them. The limits all come from three choices — text as the interchange format, whole documents in the editor when alignment is unavailable, and everything on the main thread's heap.

### Options compared

| Option | What it is | Makes possible at 300–500 MB | Does not solve | Cost / risk |
|---|---|---|---|---|
| A. Streaming in the browser | Read `File.stream()` in chunks; parse CSV / JSON records incrementally; never build one string | Reading files of any size; no 512 MB string limit; real progress and Cancel while reading | Memory for the parsed records (CSV rows as objects are 8× the file) | Low. A streaming CSV parser is a small change to the worker's existing loop. A streaming JSON array reader is new code |
| B. Record-oriented compare in a worker | Records go from the reader straight into the matcher inside one worker; the main thread receives only the model summary and windows of text | No main-thread freezes at any size; no double parse; no pretty-JSON string; the cap becomes a memory bound, not 64 MB | Worker heap is still ~4 GB | Medium. `json_align.js` is already DOM-free and ran unchanged in Node; the work is the message protocol and making `getDocumentPair` consumers async |
| C. Offset index over the files (with OPFS for derived data) | Per record keep only: id hash, content hash, byte offset, length (≈ 24 bytes). Match and classify from the index; read changed records back with `Blob.slice()` for field diffs and windows. OPFS holds converted or edited data and survives reload | 500 MB + 500 MB in a few hundred MB of memory (estimate: 3.2 M rows × 2 × 24 B ≈ 150 MB of index); restore after reload without re-reading | Field-level detail for every changed record at once must be streamed, not held; needs two passes | High. New matcher front end (the id / hash strategies map onto it; the similarity pairing for small arrays does not need it). OPFS is available in workers in current Chromium, Firefox and Safari (not tested here); quota varies |
| D. IndexedDB-backed records | Same idea as C with IndexedDB as the store | Same reach as C | Much slower per record than OPFS or `Blob.slice` (not measured here; estimate from general experience) | High, and likely slower than C |
| E. WebAssembly | Parser and/or matcher compiled to Wasm | Faster parsing (est. 2–4×); own linear memory, compact records | Wasm32 memory is also capped at 4 GB; does not remove the need for B or C | High: build step in a no-build project, second language |
| F. Optional desktop build | The same UI in Electron/Tauri with Node or native file access | Multi-GB files, no tab heap limit | Nothing for web users | High: packaging, signing, updates. Privacy story stays the same (local) |

### Recommendation

**B + A first, then C. Not E. F only if files above ~1 GB become a requirement.**

Stage 2a — worker pipeline (covers most of the reported pain):

1. One compare worker owns both documents as parsed records. CSV rows go from the streaming parser into the matcher directly; no JSON text is produced for comparison.
2. Files are read with `File.stream()`; pasted text keeps today's path below a threshold.
3. The editor only ever receives a window (also for the first file of a pair, and for import). The "whole document in CodeMirror" path is kept for small content only.
4. `MAX_BYTES` is replaced by a memory budget; the row cap is removed; when a budget is exceeded the app says so before starting and compares nothing rather than a sample.
5. `getDocumentPair`, export, save and Keys ask the worker (async) instead of holding `_ignorePristine` strings.
6. Clear and Cancel terminate the worker, which frees everything at once.

Expected reach of 2a (estimates from §2.1 heap figures, not measured): JSON up to roughly 200–300 MB per file (the 500 MB pair needed 3.0 GB in Node while also holding the 1 GB of text that streaming would drop); CSV up to roughly 100 MB per file with rows as objects, more with rows stored as arrays plus one shared header.

Stage 2b — offset index (reaches 300–500 MB CSV): the index and `Blob.slice` design from option C, used automatically above the 2a budget, with OPFS for converted data and reload.

What stays out of reach in a browser, whichever option: a single file above what the disk quota and a 4 GB worker heap allow; instant results (reading 1 GB at measured rates is 30–60 s); showing a 500 MB document as one scrollable editor.

### Smaller fixes that do not need the redesign

Each is independent and small; none was made in phase 1.

1. Correct the over-cap message (it tells JSON users to convert CSV).
2. Say in the status pill when the result covers a row-capped sample.
3. Release `lastRawCsv` and the editor history on Clear.
4. Make snapshot import use the align-before-render path that paste uses (5.9 s → about 0.2 s at 20 MB).
5. Update `CLAUDE.MD`: the alignment cap is 64 MB, not 24 MB.
6. Convert CSV to compact JSON, or indent 2, to move the cap from ~8 MB to ~12–16 MB of CSV per file (estimate) until 2a lands.

## 9. Reproducing

```bash
node tools/gen_dataset.js --format csv --size 100MB --cols 20 --profile changed:5 --out .outputs/bench/csv100
```

```bash
node --max-old-space-size=4096 tools/bench_pipeline.js --a .outputs/bench/csv100_a.csv --b .outputs/bench/csv100_b.csv --lift
```

Browser: see `tools/bench_browser/README.md`.
