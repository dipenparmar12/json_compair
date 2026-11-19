# Investigation: a large paste into a panel that already has content does not render

Tracked as [issue #25](https://github.com/dipenparmar12/json_compair/issues/25) (`bug`, `priority: high`).
Related: [#26 clearing one side freezes the tab](https://github.com/dipenparmar12/json_compair/issues/26), [#27 large comparisons not restored after reload](https://github.com/dipenparmar12/json_compair/issues/27).

Status: **root cause confirmed for #25.** No code was changed. The fix is not part of this document.

## 1. Symptom

With content in both panels, paste a CSV (or JSON) into one panel. The comparison does not update to the aligned view. The status shows `differ too much for line-by-line highlighting`, `Too large to match records`, or a chunk count such as `6 changed blocks`, and Details has no record list. Refreshing the page appears to fix it.

## 2. Root cause

**The paste is inserted at the caret, not used to replace the panel, unless the whole panel is selected. The panel keeps its old content, so the panel now holds two JSON documents one after the other. The alignment step rejects invalid JSON, so the comparison falls back to plain-text diff.**

Chain of events (line numbers from `v6/index.html`):

1. `handlePaste()` (around line 8654) takes the selection as the range to replace: `range = { from: sel.from, to: sel.to }`. A caret with nothing selected gives `from === to`.
2. `ingestContentInner()` converts the text (CSV → JSON), then computes `fullReplace = (from === 0 && to === editor.state.doc.length)` (line 8581). A caret is not a full replace, so `fullReplace` is false.
3. The aligned path is gated on `fullReplace` (line 8593), so it is skipped and the text is written raw with `editor.dispatch({ changes: { from, to, insert: content } })` (around line 8615). The pasted text lands in front of the old content.
4. The panel now holds `[ …pasted array… ]{ …old content… }`. This is not valid JSON (`JSON.parse` fails at the end of the first array).
5. The debounced re-align (`applyBlockAlignment`, around line 4582) reads both panels, `JSONAlign.prepareAsync` returns `ok: false` (about 6 ms), and `applyTransformResult` takes its else branch: `diffModel = null`, plain CodeMirror diff. Hence "differ too much" or "N changed blocks" with no record model.

Why refresh seems to fix it: the panels are restored from the saved session on load, and the restore path (`restorePair`) writes both panels in full, so the concatenation is replaced.

## 3. Evidence

All runs used the synthetic generator in the investigation method (section 4), 20 columns, 6 or 20 changed records, left pasted first, right second, with a few seconds between pastes.

| Starting state of the panels | Paste | Result |
|---|---|---|
| Both empty | 1,000 rows each (about 395 KB) | `20 changed of 1,000 items · 20 field changes` (correct) |
| Both hold demo text (85 and 87 characters) | 1,000 rows each | Left = pasted text + demo (394,858 chars), right = pasted text + demo (394,884 chars). Both fail `JSON.parse`. Status `6 changed blocks`, no model |
| Earlier runs in the first session (panel state not recorded) | 300 rows / 3,000 rows / 40,000 rows / 150,000 rows | 300 rows gave the correct model; 3,000 and larger gave `differ too much`. Those runs were not instrumented, so the panel state at paste time is unknown |

The size pattern in the first session (300 rows fine, larger failing) is probably **not** a size effect on its own. The controlled runs show the failure depends on whether the panels held leftover content when the paste happened. Size is still relevant because larger pastes take the async path, and that path is where the failure becomes visible. This needs one more controlled run at 300 rows with leftover content to confirm.

Instrumented trace of the failing run (scratch copy, see section 4):

- Gate 1 (left paste, right empty): `from 0, to 0, len 85, fullReplace false`, so no transform and a raw insert.
- Gate 2 (right paste): `from 0, to 0, len 87, o 394858, fullReplace false`, so no transform and a raw insert.
- Re-align from the debounce: `prepareAsync` returns `ok: false`, `hOk: false`, which matches invalid JSON in the panels.

With both panels empty, the same trace shows `fullReplace: true`, the transform runs, `prepareAsync` succeeds, and the aligned write follows.

Other observations from the first session, not reproduced in the final run:

- One run left the left panel with about 513 KB of extra array text after the right paste. This is the same mechanism with more leftover content.
- One run threw `Cannot read properties of undefined (reading 'length')` in CodeMirror's `TextLeaf.lineInner` during a paste, and the panel showed `Processing failed`. Not explained yet. It may be related to a dispatch made against a stale document, which the raw insert can cause.

## 4. Method

- The investigation used a copy of `v6/` in the session scratch folder, served on a separate local port. The repository was not modified. The copy had single-line `window.__dbg.push` logs added at the gate, the branch after the transform, the async entry, and the result check.
- Synthetic data came from a small generator in the browser (`id` plus numeric columns, every 50th record changed). Use `tools/gen_dataset.js` for repeatable runs.
- The pane text was read through CodeMirror's DOM hook (`.cm-content`'s `cmView.view.state.doc`), because the app's editors are not exposed on `window`.

## 5. What this means for the fix (for the next step, not done here)

- The gate that decides whether a paste replaces the panel is wrong for the common case. A caret in a panel with content should not produce an insert, or the panel should be replaced fully when the paste is a whole-document input.
- The raw-write branch uses `from` and `to` captured before the awaits in `ingestContentInner`. Re-reading them from the current document before writing is safer.
- `applyBlockAlignment` should not run on panels that are not valid JSON as if they were comparable. Showing the parse error for that panel (the existing chip) would make the state obvious.
- The regression test should paste into a panel that already holds content with the caret at 0, then check for `changed of N items`.

## 6. Open questions

- Confirm what the user sees after a paste with the caret at the end of a long existing document, which is a common case.
- Find the source of the `TextLeaf.lineInner` error (single occurrence). It is probably a dispatch against a stale document during an async step.
- Issue #26 (clear freeze) was measured (389 ms at 3 MB per side, 965 ms at 12 MB) but not instrumented. Candidate costs from code reading: `setPaneIfChanged` calls `doc.toString()` on the whole document (line ~4149), the Clear handler calls `saveContent()` synchronously right after a full-document dispatch, and `writeAlignedPanes` calls `doc.toString()` twice. These need a profiler trace before any fix.
- Issue #27 (large saves): autosave skips above 4 MB, confirmed by reload.
