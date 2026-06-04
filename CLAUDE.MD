# JSON Compare Tool - Claude Context

## Project Overview

A **client-side-only** web application for comparing, formatting, and merging JSON data with advanced features. The project has two parallel implementations using different CodeMirror versions, plus a comprehensive JSON utilities toolbox.

**Live Demo**: https://dipenparmar12.github.io/json_compair/
**Repository**: https://github.com/dipenparmar12/json_compair

## Core Architecture

### Three Main Applications

1. **v6/** - Modern CodeMirror 6 implementation (ES modules, CDN-based)
2. **v5/** - Legacy CodeMirror 5 (fully offline, proven stability)
3. **utils-json/** - JSON Toolbox with advanced processing utilities

**Entry Point**: `index.html` (root) → Version selector that redirects to v6/ or v5/

### Key Characteristics

- **No build process** - Direct file editing, F5 to refresh
- **Client-side only** - All processing in browser
- **Privacy-first** - No server uploads (except optional Node.js dev server)
- **CDN dependencies** - Uses unpkg.com for libraries with SRI hashes

## Project Structure

```
json_compair/
├── index.html              # Version selector (redirects to v6 or v5)
├── v6/                     # 🔥 PRIMARY APP - CodeMirror 6
│   ├── index.html          # ~3050 lines, embedded JS (MergeView setup + all UI logic)
│   ├── css/
│   │   ├── app.css         # Application styles (SAFE to edit)
│   │   └── ccsiteV6.css    # Branding/layout
│   └── utils/              # Shared utility modules
│       ├── utils.js        # URLManager, StorageManager, SettingsManager
│       ├── json_utils.js   # Python syntax → JSON parser
│       ├── utils_csv.js    # CSV auto-detection & conversion
│       ├── utils_zip.js    # ZIP snapshot import/export
│       ├── utils_branch.js # Git-like branching for panels
│       ├── viewport_diff.js # ViewportDiffManager, PerformanceMode, LargeFileDetector, PerformanceToast
│       └── diff-worker.js  # Web Worker: inlined diff_match_patch for off-thread diff counting
│
├── v5/                     # Legacy CodeMirror 5 version
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── utils/              # Same utilities as v6
│
├── utils-json/             # JSON Toolbox (separate app)
│   ├── index.html
│   └── utils/
│       ├── schema_generator.js
│       ├── json_shaper.js
│       ├── json_linter.js
│       ├── json_flattener.js
│       ├── json_to_table.js
│       └── json_fuzzer.js
│
├── docs/                   # Documentation & PRDs
├── tests/                  # Test files
└── _archive/               # Old iterations
```

## Technical Stack

### Dependencies (CodeMirror 6 - v6/)

Loaded via ES Module Import Maps from unpkg.com:

```javascript
// Import map (unpkg) — see <script type="importmap"> in v6/index.html
{
  "@codemirror/state": "6.4.1",
  "@codemirror/view": "6.34.1",
  "@codemirror/language": "6.10.3",
  "@codemirror/commands": "6.7.1",
  "@codemirror/lang-json": "6.0.1",
  "@codemirror/merge": "6.7.2",
  "@codemirror/search": "6.5.6",
  "@codemirror/autocomplete": "6.18.1",
  "@codemirror/lint": "6.8.2",
  "@codemirror/theme-one-dark": "6.1.3"
}
```

Loaded separately via `<script>` (cdnjs), exposed as globals:
- `pako` 2.1.0 — gzip compression for URL sharing
- `JSZip` 3.10.1 — ZIP snapshot import/export
- `diff_match_patch` 1.0.5 — used **only for the status-bar diff count**, not for rendering (rendering is CM6 MergeView's own diff)

### Dependencies (CodeMirror 5 - v5/)

Local files in `v5/js/`:
- CodeMirror 5.65.20
- Pako 2.1.0
- PapaParse 5.4.1
- Oboe.js 2.1.5
- diff-match-patch

All with SRI hashes for security.

## Core Features

### 1. JSON Comparison
- **Real-time diff** with character-level highlighting
- **Red/Green color coding** - Red (deletions), Green (insertions)
- **Side-by-side view** with synchronized scrolling
- **Collapse unchanged sections** - Focus on differences
- **Diff count** - Shows number of differences found

### 2. Flexible JSON Parsing
Handles non-standard formats via `parseFlexibleJSON()`:
- Python dict syntax conversion
- Datetime object parsing
- Complex number handling
- Graceful fallback to standard JSON.parse()

### 3. CSV Auto-Conversion
- **Auto-detection** of CSV/TSV data
- **Drag & drop** CSV files onto editor panels
- **Automatic conversion** to JSON (array of objects)
- **Configurable** - Can be disabled in settings

### 4. URL Sharing
```
Content → JSON.stringify → pako.gzip → base64 encode → URL param (?c=...)
```
- Compresses JSON for URL sharing
- Size limit ~2000 chars
- Fallback to ZIP download for large content

### 5. Git-like Branching
Save and switch between multiple content versions per panel:

```javascript
// Initialize
await BranchManager.init();

// List branches
const branches = BranchManager.listBranches();

// Get branch with content
const branch = await BranchManager.getBranch("api-v2");

// Save current content
await BranchManager.saveBranch("api-v2", content);

// Create new branch
const newBranch = await BranchManager.createBranch("API v3", content);
```

**Storage**:
- IndexedDB for branch content (`json_compair_branches_db`)
- localStorage for metadata index
- Included in ZIP snapshot exports

### 6. Snapshot Import/Export
- **ZIP format** - Standard ZIP file with JSON files
- **Backward compatible** - Supports legacy .json.gz format
- **Includes branches** - All branches exported in snapshots
- **Human-readable** - Contains formatted JSON + README.txt

### 7. Advanced Settings

```javascript
{
  // Editor Settings
  "wordWrap": true,              // Line wrapping
  "scrollLock": true,            // Synchronized scrolling
  "theme": "light",              // light|dark|oneDark|default

  // Diff Settings
  "highlightChanges": true,      // Red/green highlighting
  "gutter": true,                // Diff gutter markers
  "collapseUnchanged": false,    // Auto-collapse identical blocks
  "orientation": "a-b",          // a-b (side-by-side) or a-b-merge
  "revertControls": "a-to-b",    // a-to-b|b-to-a|none
  "scanLimit": 10000,            // Max lines to diff

  // Auto-Processing
  "autoCsv": true,               // Auto-convert CSV
  "autoFormat": false,           // Auto-format on paste
  "autoSort": false              // Auto-sort keys on paste
}
```

## Utility System

### Global Namespace Pattern

All utilities export to `window.*` global namespace:

```javascript
// utils.js
window.URLManager
window.StorageManager
window.DefaultTemplates
window.SettingsManager

// json_utils.js
window.parseFlexibleJSON()
window.sortJSONKeys()

// utils_csv.js
window.CSVUtils
  .isCSV()
  .csvToJSON()
  .csvToJSONAsync()

// utils_zip.js
window.SnapshotHandler
window.ZipSnapshotManager
window.LegacySnapshotManager

// utils_branch.js
window.BranchManager
  .listBranches()
  .getBranch()
  .saveBranch()
  .createBranch()
  .deleteBranch()
```

### Loading Pattern

Both v5 and v6 load utilities in `<head>`:

```html
<script src="./utils/utils.js"></script>
<script src="./utils/json_utils.js"></script>
<script src="./utils/utils_csv.js"></script>
<script src="./utils/utils_zip.js"></script>
<script src="./utils/utils_branch.js"></script>
<script src="./utils/viewport_diff.js"></script>  <!-- v6 only: performance managers -->
```

> Note: `diff-worker.js` is NOT loaded via `<script>`. It is instantiated as a Web Worker
> at runtime (`new Worker('./utils/diff-worker.js')`) and has its own inlined copy of
> `diff_match_patch` so it runs standalone off the main thread.

## CodeMirror 6 Integration (v6/)

### Initialization

```javascript
import { MergeView } from "@codemirror/merge";
import { EditorState, Compartment } from "@codemirror/state";
import { json } from "@codemirror/lang-json";

// Dynamic reconfiguration compartments
const wordWrapCompartment = new Compartment();
const themeCompartment = new Compartment();

// Create merge view
const mergeView = new MergeView({
  a: { doc: leftContent, extensions: [...] },
  b: { doc: rightContent, extensions: [...] },
  parent: containerElement,
  orientation: "a-b",
  highlightChanges: true,
  gutter: true,
  collapseUnchanged: { margin: 3 },
  revertControls: "a-to-b"
});
```

### Dynamic Reconfiguration

```javascript
// Change word wrap without recreating view
mergeView.a.dispatch({
  effects: wordWrapCompartment.reconfigure(
    wordWrapEnabled ? EditorView.lineWrapping : []
  )
});

// Change theme
mergeView.a.dispatch({
  effects: themeCompartment.reconfigure(oneDark)
});
```

### Auto-Save Extension

```javascript
const autoSaveExtension = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    clearTimeout(window.autoSaveTimer);
    window.autoSaveTimer = setTimeout(() => {
      saveContent(); // Save to localStorage
    }, 300); // 300ms debounce
  }
});
```

## Data Persistence Flow

1. **On content change** → 300ms debounce → `StorageManager.saveToStorage(left, right)`
2. **Page load** → Check URL params (`c=...`) → Decompress & load
3. **Fallback** → Load from `localStorage['json-compare-left/right']`
4. **All empty** → Show default template
5. **Large data** → Falls back to IndexedDB if localStorage quota exceeded

## JSON Toolbox (utils-json/)

Advanced JSON processing utilities as a separate app:

### 1. JSON Schema Generator
Auto-generate JSON Schema (Draft 2020-12) from sample JSON objects.

**Features**:
- Infer types, required properties, formats (email, uri, date-time)
- Merge multiple samples to detect optional fields
- Options for titles/descriptions, uniqueItems, etc.

### 2. JSON Shaping
Display compact, human-readable outline of JSON structure.

**Modes**:
- Nested format with types
- Compact mode: `{ id, name, address { city, zip } }`
- With types: `{ id:number, name:string }`

### 3. JSON Linter/Formatter
Validate, repair, and prettify JSON with error recovery.

### 4. JSON to CSV (Advanced)
Flatten JSON (especially arrays of objects) into CSV.

**Features**:
- Nested object flattening with dot notation
- Array expansion (one row per array item)
- Configurable delimiters

### 5. CSV to JSON (Advanced)
Convert CSV with dot-notation headers back to nested JSON.

### 6. JSON to Markdown/HTML Table
Render array of objects as readable table.

**Modes**:
- Markdown (flattened dot notation)
- HTML with expandable sections (`<details>`)
- HTML with rowspan/colspan for strict layout

### 7. JSON Flattener/Unflattener
Convert between nested and flat dot-notation formats.

**Example**:
```javascript
// Nested
{ user: { name: "Eve", address: { city: "Paris" } } }

// Flattened
{ "user.name": "Eve", "user.address.city": "Paris" }
```

### 8. JSON Randomizer/Fuzzer
Generate random valid JSON from schema or sample for testing.

## Development Workflow

### Local Development

1. **Direct editing**: Edit `v6/index.html` or other files
2. **Refresh**: Press F5 to see changes
3. **No build step**: Instant preview

### Optional Dev Server

```bash
node server.js
# Opens http://localhost:8000
```

### Git Workflow

**Current branch**: `main`
**Main branch**: `main`
**Deployment**: GitHub Pages (auto-publish on push to `main`)

> For up-to-date history use `git log` — do not rely on a hardcoded commit list here.

## Critical Patterns

### 1. NO Build Process
- Direct file editing, F5 refresh
- All dependencies from CDN
- Utilities shared across v5/v6 in separate directories

### 2. Settings Apply Methods
- **Word wrap, theme**: Applied via `Compartment.reconfigure()` (no reload)
- **Diff settings**: Require `recreateMergeView()` (destroys and rebuilds)

### 3. CSV Auto-Detection Entry Points
- Drag & drop
- Paste
- File upload

```javascript
if (CSVUtils.isCSV(text) && settings.autoCsv) {
  const json = await CSVUtils.csvToJSONAsync(text);
  // Parse first row as headers, return [{key: val}, ...]
}
```

### 4. Large Data Handling
- localStorage with fallback to IndexedDB
- Streaming JSON parser (Oboe.js) for very large files
- ZIP compression for snapshots

## UI Components

### Header Controls
- Format JSON
- Sort JSON keys
- Clear All
- Theme selector (v6 only)
- Settings panel toggle (⚙️)
- Share URL
- Import/Export snapshots
- Info dropdown (links to docs, GitHub)

### Per-Panel Controls
- Copy content
- Paste content
- Clear panel
- Branch selector (bottom-right)

### Settings Panel
Two sections:

1. **Quick Toggles**: Collapse Unchanged, Highlight Changes
2. **Full Settings**: All configuration options

### Status Bar
Shows diff count and current mode:
- "No differences found"
- "Found X difference(s)"
- "Add content to both panels to compare"

## Testing

### Test Files
Located in `tests/`:
- `projects.json`
- `semantic_diff_test_data.json`
- `test_case_array_objects/`
- `test_case_objects/`

### Manual Testing Checklist
1. Format malformed JSON
2. Compare different JSON objects
3. CSV drag & drop
4. URL sharing (short & long content)
5. Snapshot export/import
6. Branch create/switch/delete
7. Theme switching
8. Settings persistence

## Common Tasks

### Adding a New Feature

1. **Plan**: Consider if it affects v5, v6, or both
2. **Utilities**: If shared logic, add to `utils/`
3. **UI**: Add controls to `index.html`
4. **Settings**: Add to `SettingsManager` if configurable
5. **Persistence**: Use localStorage or IndexedDB
6. **Test**: Manual testing with various inputs

### Modifying CodeMirror Behavior

**For v6**:
1. Check if can be done via `Compartment.reconfigure()`
2. If yes: Add compartment, update in place
3. If no: Modify `recreateMergeView()` function

**For v5**:
1. Edit options in CodeMirror.MergeView initialization
2. May require view recreation

### Adding a New Utility

1. Create file in `utils/` (e.g., `utils_new_feature.js`)
2. Export to `window.NewFeature`
3. Add `<script src="./utils/utils_new_feature.js"></script>` to both v5 and v6
4. Use in main app via `window.NewFeature.*`

### Updating Dependencies

**For v6** (CDN-based):
1. Update version in import map
2. Test thoroughly
3. Update SRI hash if available

**For v5** (local files):
1. Download new version
2. Replace file in `v5/js/`
3. Update SRI hash in `<script>` tag
4. Create backup of old version

## Deployment

### GitHub Pages
- Automatic deployment on push to `main`
- URL: https://dipenparmar12.github.io/json_compair/
- No build step required

### Pre-deployment Checklist
1. Test all features manually
2. Check console for errors
3. Verify URL sharing works
4. Test on Chrome, Firefox, Safari
5. Check mobile responsive design

## Documentation

### Key Files
- `README.md` - User documentation (currently references v5, may be outdated)
- `.github/copilot-instructions.md` - AI agent instructions (authoritative)
- `prd.md` - Product Requirements Document for JSON Toolbox
- `docs/BRANCHING_FEATURE.md` - Branching feature documentation
- `docs/LIBRARY_UPDATES_OCT_2025.md` - Library update history

### Copilot Terminal Protocol
The project uses a special terminal protocol for Copilot:

1. **Progress**: Only respond in `echo "<MSG>"`
2. **Completion**: Emit `echo "Copilot: <status message>";` ending with `done`, `well`, or `success`
3. **Post-completion**: Check `./todo.md` for new work
4. **Strictness**: All outputs must be valid terminal `echo` commands

## Diff Engine Architecture (v6) — IMPORTANT

There are **two independent diff computations** in v6. Confusing them is the #1 source of
bugs and wasted work, so understand the split before touching diff/perf code:

### 1. Rendering diff — CodeMirror 6 `MergeView` (the real one)
- Computes the **visible** line + character diff and draws the gutters/highlights.
- Configured in `MergeView({...})` at `v6/index.html` (`initializeApp`, ~line 500) and
  rebuilt in `recreateMergeView()` (~line 1071).
- Key knobs: `highlightChanges`, `gutter`, `collapseUnchanged`, `revertControls`,
  `orientation`, and `diffConfig.scanLimit` (UI default **6000**, set via the Scan Limit input).
- Recomputes automatically on every `dispatch` — you do NOT need to recreate the view to
  refresh the diff after a content change.
- The authoritative chunk list lives at `mergeView.chunks`.

### 2. Status-bar count diff — `diff_match_patch` (display only)
- `updateDiffStatus()` (`v6/index.html` ~line 2933) runs a **separate full DMP diff** purely
  to print "Found N differences". This is `diff_cleanupSemantic` + chunk counting.
- For content > **100 KB** it offloads counting to the Web Worker (`diff-worker.js`).
- ⚠️ This is a *second* diff over the same text and counts **character** chunks, while the
  MergeView renders **line** chunks — so the displayed number can disagree with the screen.

### 3. Performance managers (`viewport_diff.js`)
- `ViewportDiffManager` — recomputes the **count** for the scrolled viewport ± buffer on
  scroll (debounced). NOTE: it currently affects only the status text, NOT what MergeView renders.
- `PerformanceMode` — bundles settings (auto-enables `collapseUnchanged`) for faster rendering.
- `LargeFileDetector` — analyzes size and auto-suggests/enables perf modes
  (thresholds: 300 KB large, 500 KB warning, 2 MB critical).
- `PerformanceToast` — transient notifications.

### Known inefficiencies / where to optimize
- **Double diffing**: DMP recomputes a full diff just to count; the count could come from
  `mergeView.chunks.length` instead (removes the duplicate pass and fixes count/render mismatch).
- **Full teardown on edit**: `refreshMergeViewIfNeeded()` calls `recreateMergeView()` (full DOM
  rebuild) every 500 ms while typing *when Collapse-Unchanged is on*. Prefer
  `mergeView.reconfigure({...})` for options that support it (CM6 merge ≥ 6.7).
- **Viewport mode is cosmetic** for rendering — MergeView still diffs the whole document.
- **No memoization** — identical content re-diffs from scratch on every recreate.
- The genuinely effective CM6 lever for large files is **`collapseUnchanged` + an adaptive
  `scanLimit`**, not the viewport counter.

## Performance Considerations

### Large content handling
- IndexedDB fallback for localStorage quota (StorageManager)
- ZIP compression for snapshots (JSZip)
- Web Worker (`diff-worker.js`) keeps the >100 KB count off the main thread
- `collapseUnchanged` reduces rendered DOM size dramatically
- (NOTE: v6 does NOT use Oboe.js — that streaming parser is v5 only)

### Diff Performance levers
- `scanLimit` (`diffConfig.scanLimit`) bounds the LCS scan for the rendering diff
- `collapseUnchanged: { margin: 3, minSize: 4 }` folds identical regions
- Performance Mode auto-enables collapse for very large inputs

## Known Limitations

1. **Very large files** (>100MB) may cause browser performance issues
2. **URL sharing** limited to ~2000 chars (falls back to ZIP)
3. **CodeMirror 6 themes** loaded from CDN (requires internet)
4. **Mobile experience** - Works but optimized for desktop

## Future Enhancements

Potential improvements (check `todo.md` for current priorities):
- Derive status count from `mergeView.chunks` (kill the duplicate DMP diff)
- Make Viewport Diff actually limit rendering (not just the count)
- Replace full `recreateMergeView()` with `mergeView.reconfigure()` on edits
- Memoize diff results by content hash
- Optional semantic JSON mode (canonicalize keys/whitespace before diffing)
- Virtualized rendering for very large files
- More CodeMirror 6 themes / better mobile UI / PWA / offline v6

## Getting Help

- **GitHub Issues**: https://github.com/dipenparmar12/json_compair/issues
- **Documentation**: Check `docs/` directory
- **Copilot Instructions**: `.github/copilot-instructions.md`

## Contributing

1. **Branch**: Create feature branch from `main`
2. **Develop**: Edit files directly, test with F5
3. **Commit**: Follow conventional commits (feat:, fix:, docs:, etc.)
4. **PR**: Create PR to `main` with description
5. **Deploy**: Auto-deploys to GitHub Pages on merge

---

**Last Updated**: 2026-05-28
**Current Version**: v6 (CodeMirror 6) is primary, v5 (CodeMirror 5) is legacy
**Status**: Active development on `main` branch
