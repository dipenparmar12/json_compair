# Plan: Git-like Branching for JSON Compare Panels

Enable each editor panel to switch between named "branches" (stored sessions), allowing users to compare content across multiple saved versions like API v1 vs v2 vs v3.

---

## Steps

1. **Create `BranchManager` utility** in `v6/utils/utils_branch.js`
   - New module exporting `window.BranchManager` with methods: `listBranches()`, `getBranch(id)`, `saveBranch(id, content, metadata)`, `deleteBranch(id)`, `renameBranch()`
   - Use IndexedDB as primary storage (branches can be large), with localStorage fallback for branch metadata/index
   - Each branch stores: `{ id, name, content, timestamp, metadata: { source, notes } }`

2. **Extend `SettingsManager`** in `v6/utils/utils.js`
   - Add new default settings: `leftBranch: 'main'`, `rightBranch: 'main'` to track active branch per panel
   - Keep `leftPanelName`/`rightPanelName` as display names (derived from branch name)

3. **Replace panel name input with branch selector dropdown** in `v6/index.html`
   - Modify `addPanelNameInput()` → `addBranchSelector(paneElement, side)`
   - Create dropdown showing: current branch name, list of all branches, divider, "➕ New Branch", "✏️ Rename", "🗑️ Delete"
   - Wire dropdown change to save current content to old branch, then load selected branch

4. **Wire branch switching logic** in `v6/index.html`
   - `switchBranch(side, newBranchId)` — save current → load new → update editor
   - Modify `saveContent()` to save to current active branch (not just flat storage)
   - Modify `initializeApp()` to restore last active branches on page load

5. **Update snapshot import/export** in `v6/utils/utils_zip.js` and `v6/index.html`
   - Include `branches.json` in ZIP export containing all branches
   - On import, offer to merge/replace existing branches
   - Maintain backward compatibility with existing snapshots (no branches = single "main" branch)

6. **Add CSS styles** in `v6/css/app.css`
   - Style branch selector dropdown (replace `.panel-name-input`)
   - Add "modified" indicator (asterisk/dot when content differs from saved branch)

---

## Further Considerations

1. **Storage limits** — Should we limit branch count or auto-prune old branches?
   - *Recommend: Soft limit of 20 branches with warning, no hard limit*

2. **Branch naming** — Auto-generate IDs (slug from name) or let users define?
   - *Recommend: Auto-generate slugs like `api-v1` from display name "API v1"*

3. **Conflict handling** — What happens when switching branches with unsaved changes?
   - Options: (A) Auto-save before switching, (B) Prompt user, (C) Discard silently
   - *Recommend: Option A with visual "saved" feedback*
