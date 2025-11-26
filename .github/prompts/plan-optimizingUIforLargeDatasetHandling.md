# Plan: Optimize Large Dataset Performance

The page freezes when comparing large JSON files because diffing (via `diff_match_patch` and CodeMirror's MergeView with `scanLimit: 6000`) runs synchronously on the main thread. The solution involves Web Worker offloading, smarter defaults, progressive feedback, and a "Performance Mode" toggle.

### Steps

1. **Revive Web Worker for diff calculations** — Move `diff_match_patch.diff_main()` calls in `updateDiffStatus()` (lines 2132-2161) to `_archive/js-backups/large-data-worker.js`, relocated to `v6/utils/diff-worker.js`.

3. **Auto-disable expensive features for large files** — In the paste/drop/load handlers, detect content size (>300KB) and automatically disable `highlightChanges`, enable `collapseUnchanged`, and reduce `scanLimit` temporarily.

4. **Add "Performance Mode" toggle in Settings** — Expose a UI checkbox that bundles: lower scanLimit (1000), disable character highlighting, enable collapse unchanged, and increase debounce to 1000ms.

5. **Show progress/loading indicator during diff** — Add a non-blocking spinner or status message ("Calculating diff...") while worker processes, using `postMessage` callbacks to update UI.

6. **Add file size warnings and soft limits** — Display a warning toast when combined content exceeds 500KB; suggest Performance Mode or splitting files at 2MB.

### Further Considerations

1. **WebAssembly diff library?** Could use `diff-wasm` for 2-5x speedup — adds complexity, recommend deferring unless worker approach insufficient.
2. **JSON-aware semantic diffing?** Libraries like `jsondiffpatch` compare structure rather than text — better accuracy but different UX; consider as Phase 2.
3. **Virtual scrolling for CodeMirror?** CM6 already virtualizes, but MergeView may recreate full diff — investigate upstream performance patches if issues persist.

---

# Plan: Virtual Diff Viewport Mode for Large Datasets

Implement a "virtual diff viewport" feature that computes diffs only for the visible scroll area plus a buffer zone, drastically reducing processing time for large files. The diff engine will re-calculate on scroll (debounced), keeping the UI responsive regardless of dataset size.

### Steps

1. **Create `ViewportDiffManager` utility** — Add `v6/utils/viewport_diff.js` with a class that tracks viewport boundaries using CodeMirror's `EditorView.viewport` (which already provides `from`/`to` positions), extracts visible text slices plus buffer (e.g., ±500 lines), and runs `diff_match_patch.diff_main()` only on that slice.

2. **Hook into scroll events with debounced recalculation** — In `setupSynchronizedScrolling()` (line 1557), add a scroll listener that triggers `ViewportDiffManager.recalculate()` with 150-200ms debounce; use CodeMirror's `visibleRanges` and `lineBlockAt()` APIs (already used in `@codemirror/merge` source's `updateSpacers()`) to determine visible line ranges.

3. **Add "Virtual Viewport Diff" toggle in Settings** — Add a checkbox in the settings dropdown (near line 100-130) that enables/disables viewport-only diffing; store in `SettingsManager` as `virtualViewportDiff`; when enabled, bypass full `highlightChanges` and use lightweight viewport-based decorations.

4. **Implement viewport-scoped diff decorations** — Create a custom CodeMirror extension (ViewPlugin) that applies diff highlighting only to visible chunks; use `Decoration.mark()` for visible diffs and `Decoration.widget()` for a "...X more differences above/below" indicator at viewport edges.

5. **Auto-enable for large files with user notification** — In content load handlers (paste, drop, import), detect when combined content exceeds 300KB; auto-enable virtual viewport mode and show a toast: "Large file detected - viewport diff mode enabled for performance".

6. **Integrate with existing `updateDiffStatus()`** — Modify `updateDiffStatus()` (line 2134) to use cached full diff count when available, or show "~X visible differences" when in viewport mode; add a "Calculate Full Diff" button for users who need exact counts.

### Further Considerations

1. **Proxyman-style optimizations?** The Proxyman diff tool appears to be a standard client-side implementation with no special public API for chunked diffing; however, consider using `requestIdleCallback()` for background pre-computation of adjacent viewport chunks.

2. **Persist diff cache between scroll positions?** Could cache computed diff chunks in a Map keyed by line ranges, invalidating only when content changes — trades memory for responsiveness during rapid scrolling.

3. **Alternative: CodeMirror's built-in `collapseUnchanged`?** Already available but requires full diff computation first; virtual viewport differs by never computing unchanged regions outside viewport — recommend as complementary, not replacement.