# v6 Modern Refresh + Large-Data Performance

## Context

`v6/` is the primary JSON-compare app: a single ~3,050-line `index.html` (embedded CM6 MergeView + all UI logic), plus `css/app.css` (~1,400 lines) and `css/ccsiteV6.css`. It works, but it has accumulated three classes of debt that hurt the experience and make large-JSON comparison slow:

1. **Large-data performance** — every edit-while-Collapse-Unchanged-is-on and every settings change tears down the whole MergeView (`container.innerHTML = ''` + full rebuild + re-bind every handler), and the status bar runs a *second* full `diff_match_patch` diff just to print a count. Both are redundant: CM6 MergeView already re-diffs on dispatch and exposes `mergeView.chunks`, and CM6 merge ≥6.7 supports cheap in-place `mergeView.reconfigure()`.
2. **UX/UI** — plain toolbar, two confusingly-identical "⚙️" buttons, no way to jump between diffs, app chrome (toolbar/settings/dropdowns) is **not** themed so "dark" only darkens the editors, leaving a white toolbar.
3. **Code health blocking the refresh** — the settings panel is ~150 lines of inline styles + inline `onmouseover/onmouseout`, there are real CSS bugs (orphaned rule, duplicate `<link>`, duplicated selectors), and `css/merge-custom.css` is dead CM5 code never loaded by v6.

The user chose a **Modern refresh** visually, prioritizing **large-data performance** and **UX/UI experience**. Scope is **v6 only** (v5 untouched). No build step — direct file edits, verify in browser.

Outcome: comparing large JSON stays smooth while typing/toggling settings, the diff count is accurate and instant, users can jump between changes, and light/dark look consistent and modern across the whole app.

---

## Workstream 1 — Design tokens + CSS cleanup (foundation for the refresh)

**Files:** `v6/css/app.css` (top), `v6/index.html` (`<head>`), delete `v6/css/merge-custom.css`.

1. Add a `:root` token block at the top of `app.css` and a `[data-theme="dark"]` override block:
   - Color tokens: `--accent: #08c988`, `--accent-hover`, `--bg`, `--bg-elev` (panels/dropdowns), `--text`, `--text-muted`, `--border`, `--shadow`, plus diff tokens `--diff-add-line/--diff-add-text/--diff-del-line/--diff-del-text`.
   - Scale tokens: `--radius`, `--space-*`, `--font-ui`, `--font-mono`.
   - Migrate hardcoded `#08c988`, panel backgrounds, borders, and the GitHub-style diff colors (currently `#ffebe9`/`#e6ffec`/`#ffc1ba`/`#acf2bd` in `app.css:192-241`) to reference these tokens so dark mode and theming are consistent.
2. Fix concrete bugs:
   - Remove the duplicate `<link rel="stylesheet" href="./css/ccsiteV6.css" />` (`index.html:16-17`).
   - Fix the orphaned rule at `app.css:1124-1125` (a stray `border-bottom: …; }` outside any selector — silently breaks the rule above it).
   - De-duplicate the repeated `.branch-dropdown-item.active` and `.branch-item-actions` blocks (defined 2–3× with conflicting values around `app.css:1077-1208`).
3. Delete `v6/css/merge-custom.css` — confirmed never referenced in v6 (grep clean) and contains only CM5 `.CodeMirror-merge-*` selectors.

## Workstream 2 — App-wide theme system (consistent light + dark)

**Files:** `v6/index.html` (`applyTheme()` ~`:980`, `initializeApp` ~`:467`), `v6/css/app.css`.

- Drive a single `data-theme` attribute on `<html>`: in `applyTheme()` and on initial load, set `document.documentElement.dataset.theme = (currentTheme === 'dark' || currentTheme === 'oneDark') ? 'dark' : 'light'`. Keep the existing per-editor CM theme compartment dispatch (`themeCompartment`, `lightTheme`/`darkTheme`/`oneDark`) exactly as-is.
- Restyle toolbar, settings panel, dropdowns, buttons, and status under tokens so `[data-theme="dark"]` themes the **whole** app, not just the editors. Replace the fragile attribute selectors like `[style*="background-color: rgb(30"]` (`app.css:897`, `:1272`) with `[data-theme="dark"]`.

## Workstream 3 — Modern UI refresh (toolbar / settings / status)

**Files:** `v6/index.html` (toolbar `:78-265`, settings panel `:92-211`), `v6/css/app.css`.

1. **Extract inline styles → CSS classes.** Convert the settings panel's inline-styled `<label>`/`<div>` rows into reusable classes (`.settings-panel`, `.settings-section`, `.setting-row`, `.setting-title`, `.setting-desc`, `.settings-select`) and drop every inline `onmouseover/onmouseout` in favor of CSS `:hover`. Same for the toolbar's inline-styled links/buttons.
2. **Unify buttons** into `.btn` / `.btn-primary` / `.btn-ghost` / `.btn-icon` classes (replacing the base `button {}` + scattered inline styles).
3. **Resolve the two-gears confusion:** keep `⚙️ Diff Settings` as the gear; relabel `⚙️ Extra Settings` to a clearer menu (e.g. `⋯ More` or `📁 File`) holding Share/Import/Examples/Theme.
4. **Status/diff summary as a polished pill** in the toolbar center (`#diff-summary`, `:216`): show an accurate change badge + a perf-mode indicator chip, styled with tokens.

## Workstream 4 — Large-data performance (core business logic)

**Files:** `v6/index.html` — `updateDiffStatus()` (`:2933`), `applyMergeSettings()` (`:1004`), `refreshMergeViewIfNeeded()` (`:1045`), `recreateMergeView()` (`:1071`), `addPaneControls()` (`:1141`).

1. **Replace full teardown with `mergeView.reconfigure()`** (CM6 merge ≥6.7; import map pins 6.7.2). Guard once: `const canReconfigure = typeof mergeView?.reconfigure === 'function'`.
   - `refreshMergeViewIfNeeded()` (the per-keystroke hot path): call `mergeView.reconfigure({ highlightChanges, gutter, collapseUnchanged, revertControls, diffConfig })` instead of `recreateMergeView()`. Eliminates the DOM rebuild + handler re-binding on every 500ms-debounced keystroke.
   - `applyMergeSettings()`: use `reconfigure()` for all merge options **except `orientation`** (an orientation flip can reorder panes → keep the `recreateMergeView()` path only for that, which is rare and off the hot path).
   - Keep `recreateMergeView()` as the initial-build + orientation + no-reconfigure-fallback path. Make `addControlsToPane()` idempotent (remove any existing `.pane-controls`/branch/name nodes before re-adding) so reconfigure never double-injects controls.
2. **Kill the double diff in `updateDiffStatus()`.** Derive the count from `mergeView.chunks.length` (the authoritative rendered line-chunk list per CLAUDE.md) instead of running a fresh `diff_match_patch` pass. Removes a full O(n) main-thread diff on every change, fixes the count-vs-render mismatch, and makes the count instant. The DMP/Web-Worker counting path (and the >100 KB worker round-trip) is no longer needed for the count — leave `diff-worker.js` on disk but stop calling it for the status count.
3. **Guard redundant work / memoize:** skip `reconfigure()` when the new merge-settings object equals the last-applied one (shallow compare); keep the existing identical-content early-out in `updateDiffStatus()`.

## Workstream 5 — UX features (diff navigation + shortcuts)

**Files:** `v6/index.html` (toolbar + module script).

1. **Jump to next / previous difference** — add ◤▲/▼◢ buttons (and "3 / 12" position text) to the toolbar. Implement with the authoritative `mergeView.chunks` + `EditorView.scrollIntoView(pos, { y: 'center' })` dispatched to the focused pane; use `@codemirror/merge`'s built-in `goToNextChunk`/`goToPreviousChunk` if exported in 6.7.2, else the manual chunk walk. Reuses the same `mergeView.chunks` from Workstream 4.
2. **Keyboard shortcuts:** `Alt+↓` / `Alt+↑` for next/prev diff, wired through the existing `keymap.of([...])` in `basicSetup` (`:448`). Surface them in the Info dropdown.
3. **Responsive toolbar:** ensure controls wrap cleanly under the existing `@media (max-width:768px)` block; keep panes side-by-side (full mobile stacked-diff is out of scope).

---

## Constraints & risk notes

- **Incremental, targeted edits** to the live single-file app — no wholesale rewrite, no file reorg/split (DX restructure was not prioritized).
- `mergeView.reconfigure()` availability is confirmed at implementation time via the runtime guard; the `recreateMergeView()` fallback guarantees graceful degradation.
- Preserve all existing globals/utilities and behavior: `SettingsManager` (`utils.js:214` defaults), `StorageManager`, `URLManager`, `DefaultTemplates`, `PerformanceToast`/`LargeFileDetector`/`PerformanceMode`/`ViewportDiffManager` (`viewport_diff.js`), branching, CSV, ZIP snapshot, URL share.

## Verification (browser, no test suite)

1. Serve locally: `node server.js` → open `http://localhost:8000/v6/` (use the Claude Preview / Chrome MCP tools to load + screenshot).
2. **Perf hot path:** paste a large JSON (e.g. `tests/projects.json`) in both panes, enable Collapse Unchanged, and type — confirm no full-view flicker/teardown (editors keep focus/scroll) and the diff count updates instantly.
3. **Count accuracy:** count badge matches the rendered chunk count (no DMP mismatch).
4. **Settings:** toggle highlight/gutter/collapse/revert/scan-limit → updates in place; change orientation → still correct (rebuild path).
5. **Theme:** switch Light ↔ Dark ↔ One Dark → toolbar, settings panel, dropdowns, and editors all theme together.
6. **Diff nav:** next/prev buttons + `Alt+↓/↑` scroll through changes; position text tracks.
7. **Regression sweep:** Format, Sort Keys, Share URL, Import/Export snapshot, branch switch, CSV drag-drop — all still work. Check console for errors.
