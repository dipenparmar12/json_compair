
## Plan: Improve Editor Typing Performance (Refined)

**TL;DR:** Implement a tiered debounce system: 300ms for save, 1.5s for diff status (with "calculating..." indicator), 2.5s for MergeView refresh. Fix paste handling to insert at cursor position instead of replacing all content, letting CodeMirror handle native paste while only auto-formatting the pasted portion.

### Steps

1. **Add typing mode flag and tiered debounce timers** in index.html `autoSaveExtension` (around line 333) — Introduce separate timers: `autoSaveTimer` (300ms), `diffStatusTimer` (1.5s), and remove `refreshMergeViewIfNeeded()` from content change path entirely. Show "Calculating..." in diff summary immediately when typing starts.

2. **Remove `refreshMergeViewIfNeeded()` from `autoSaveExtension`** — Delete the `diffRefreshTimer` that calls `refreshMergeViewIfNeeded()`. This expensive MergeView rebuild should only run on explicit settings changes via `applyMergeSettings()`, never during content edits.

3. **Fix paste to insert at cursor position** in `handlePaste()` (around line 2580) — Change from `changes: { from: 0, to: editor.state.doc.length, insert: content }` (full replace) to inserting at the current selection/cursor position. Only auto-format the pasted content, not the entire document.

4. **Move non-critical updates to idle callbacks** in `saveContent()` (around line 2745) — Wrap `checkBranchModified()`, `updatePaneButtonVisibility()`, and `updateConversionButtons()` in `requestIdleCallback()` with a 3-second timeout fallback.

5. **Cache content strings per update cycle** — In `saveContent()`, extract content once and pass to child functions. Modify `updateDiffStatus()`, `updateClearButtonVisibility()` to accept optional cached content parameters.

6. **Lower web worker threshold** in `updateDiffStatus()` (around line 2800) — Change `useLargeFileThreshold` from 100KB to 30KB so diff calculations move off main thread sooner.

### Further Considerations

1. **Should auto-format on paste apply to just pasted text or full document?** — Recommendation: Just the pasted portion. If user pastes JSON snippet into middle of content, only format that snippet (harder to implement but better UX). Alternative: Skip auto-format entirely for partial paste (simpler).

2. **What about drag-drop behavior?** — Currently `handleFileDrop()` also replaces entire content. Should we apply the same cursor-position logic there, or is full-replace acceptable for file drops?