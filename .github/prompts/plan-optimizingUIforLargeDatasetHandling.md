## Plan: Optimize Large Dataset Performance

The page freezes when comparing large JSON files because diffing (via `diff_match_patch` and CodeMirror's MergeView with `scanLimit: 6000`) runs synchronously on the main thread. The solution involves Web Worker offloading, smarter defaults, progressive feedback, and a "Performance Mode" toggle.

### Steps

1. **Revive Web Worker for diff calculations** — Move `diff_match_patch.diff_main()` calls in `updateDiffStatus()` (lines 2132-2161) to `_archive/js-backups/large-data-worker.js`, relocated to `v6/utils/diff-worker.js`.

2. **Lower default `scanLimit` and add timeout** — Change default from `6000` to `2000` in `utils/utils.js` `SettingsManager`, and wrap MergeView creation with a timeout (e.g., 5s) that shows a "Diff too large" fallback message.

3. **Auto-disable expensive features for large files** — In the paste/drop/load handlers, detect content size (>300KB) and automatically disable `highlightChanges`, enable `collapseUnchanged`, and reduce `scanLimit` temporarily.

4. **Add "Performance Mode" toggle in Settings** — Expose a UI checkbox that bundles: lower scanLimit (1000), disable character highlighting, enable collapse unchanged, and increase debounce to 1000ms.

5. **Show progress/loading indicator during diff** — Add a non-blocking spinner or status message ("Calculating diff...") while worker processes, using `postMessage` callbacks to update UI.

6. **Add file size warnings and soft limits** — Display a warning toast when combined content exceeds 500KB; suggest Performance Mode or splitting files at 2MB.

### Further Considerations

1. **WebAssembly diff library?** Could use `diff-wasm` for 2-5x speedup — adds complexity, recommend deferring unless worker approach insufficient.
2. **JSON-aware semantic diffing?** Libraries like `jsondiffpatch` compare structure rather than text — better accuracy but different UX; consider as Phase 2.
3. **Virtual scrolling for CodeMirror?** CM6 already virtualizes, but MergeView may recreate full diff — investigate upstream performance patches if issues persist.