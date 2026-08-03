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
│       ├── json_align.js   # Record matcher + item/field diff model + block-level aligner (window.JSONAlign)
│       ├── diff_ignore.js  # Exclude keys/patterns from the diff (window.DiffIgnore) — key-name matcher + line-scan
│       └── diff-worker.js  # Web Worker: off-thread CSV→JSON (streaming, row-capped) + diff_match_patch helpers
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
│       ├── progress.js     # ProcessingUI: progress panel, ETA, cancellation token
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
- `diff_match_patch` 1.0.5 — still loaded, but **no longer used for the live status-bar count**. The count now comes from `mergeView.chunks.length` (see `updateDiffStatus()`); DMP/the count worker are effectively dormant. Rendering has always been CM6 MergeView's own diff.

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
  "blockDiff": true,             // Object-aware (block-level) JSON diff (see Diff Engine §6)
  "highlightChanges": true,      // Red/green highlighting
  "gutter": true,                // Diff gutter markers
  "collapseUnchanged": false,    // Auto-collapse identical blocks
  "orientation": "a-b",          // a-b (side-by-side) or a-b-merge
  "revertControls": "a-to-b",    // a-to-b|b-to-a|none
  "scanLimit": 6000,             // MIN scan effort; raised as content needs (Diff Engine §3)
  "ignorePatterns": [],          // Key names / /regex/ excluded from the diff (see Diff Engine §7)
  "ignoreScope": "both",         // What a pattern matches: 'key' | 'value' | 'both'
  "ignoreStyled": true,          // Tint excluded matches gray (off = neutral, still no red/green)
  "numToleranceEnabled": false,  // Treat near-equal numbers as identical (see Diff Engine §8)
  "numTolerance": 0.001,         // Max |a-b| ignored when enabled (e.g. 0.001 ≈ 3 decimals)

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
window.sortJSONKeys()          // alphabetize keys recursively (crude value-sort of object arrays)
window.parseSortSpec(str)      // "category ASC, amount DESC" → [{field,dir,path}] (dot-notation nesting)
window.sortJSONByFields(data, specs) // stable value-sort of a top-level array of objects by field(s)

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

// diff_ignore.js (v6)
window.DiffIgnore
  .parseOne()           // "/re/flags" → regex descriptor, else plain match
  .parsePatterns()
  .makeMatcher()        // → { testKey, testValueStr, testValue } (null when none)
  .makePredicate()      // (matcher, scope) → (key,aVal,bVal)=>bool for json_align
  .computeIgnoredLines()// (text, matcher, scope) → Set<1-based line no.> (key + value block)

// json_align.js (v6) — ignore/tolerance-aware, scales to large collections
window.JSONAlign
  .align(l, r, opts)        // → {ok,left,right,changed,model,stats}
                            //   opts: {ignore, numTol, view:'auto'|'pretty'|'window'|'full',
                            //          from, size, budget}
  .prepare(l, r, opts)      // parse+match+model ONCE → {ok, model, render({from,size,view})}
  .prepareAsync(l, r, opts, ctl)  // same result, in interruptible slices (Diff Engine §11)
                            //   ctl: { signal:{cancelled}, onPhase(key,total)->{onProgress} }
                            //   rejects with err.cancelled === true when stopped
  .diffModel(l, r, opts)    // item + FIELD level diff, no rendering; exact at ANY size
                            //   → {ok, model:{items,totals,fields,idKey,strategy,path}}
                            //   `path`: collection key, or null when the root is the array.
                            //   Works for a root array AND for {data:[…]}-style envelopes.
  .normalize(l, r, ignore, numTol) // normalize only (block-diff off)
  .stripGaps(text)
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
<script src="./utils/progress.js"></script>       <!-- v6 only: progress panel + cancellation -->
<script src="./utils/diff_ignore.js"></script>    <!-- v6 only: exclude keys/patterns from diff -->
```

> Note: `diff-worker.js` is NOT loaded via `<script>`. It is instantiated as a Web Worker
> at runtime (`new Worker('./utils/diff-worker.js')`, started in `initializeApp`) and has its
> own inlined copies of `diff_match_patch` **and** the CSV parser so it runs standalone off
> the main thread. v6 talks to it through the promise-based `callWorker(action, payload)` RPC
> in `index.html`. Its primary job today is the `csvToJsonString` action (streaming CSV→JSON
> with an optional `maxRows` cap), used by the ingest pipeline below.

### Content ingest pipeline (v6) — IMPORTANT

All outside text entering a panel (paste event, Paste button, file drop, manual CSV→JSON)
funnels through **`ingestContent(rawText, side, opts)`** in `v6/index.html`. This exists so
the CSV→JSON *transform* and the MergeView *diff/render* never pile up on the main thread and
OOM the tab (the old failure mode on medium/large CSV). It:

1. Sniffs type cheaply on a small prefix (`looksLikeJSONStart` / `cheapLooksLikeCSV`) — never
   splits or regex-scans a multi-MB blob just to classify it.
2. Converts CSV **off-thread** via the worker, **row-capping** very large inputs to
   `MAX_RENDER_CELLS_PER_PANEL` (≈ keys × rows). Wide CSVs sample fewer rows; narrow CSVs
   sample many. A persistent toast discloses "showing first N of ~M rows" with a
   `window.__ingestConvertAll(side)` escape hatch that re-ingests the full dataset on opt-in.
3. Enables `collapseUnchanged` **before** the first large render (`applyProactivePosture`),
   so we never render every line and then re-render collapsed.
4. Dispatches once, then runs a single coalesced `afterContentChanged()` instead of the old
   per-entry-point `setTimeout(100, …)` cascade.

Supporting size guards: `updateConversionButtons()` skips full `isCSV`/`isConvertibleToCSV`
parsing above `DETECT_MAX_BYTES`; `saveContent()` skips the synchronous localStorage stringify
above `AUTOSAVE_MAX_BYTES` (use Export snapshot instead); the JSON auto-format/sort step in
`ingestContent()` is skipped above `FORMAT_MAX_BYTES` (raw text is inserted as-is — parse +
pretty-print of a multi-MB paste is a guaranteed main-thread stall). Tuning constants live near
the top of the ingest block in `index.html`.

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
- **Diff settings** (highlight, gutter, collapse, revertControls, scanLimit): Applied
  in place via `mergeView.reconfigure(buildReconfigureConfig(...))` when CM6 merge ≥ 6.7
  (`canReconfigure()`). Full `recreateMergeView()` is now reserved for the one case
  reconfigure can't handle: an **orientation flip** (which can reorder the panes).

### 2b. Settings persistence — three rules that were each broken once
Every user-facing control must survive a reload. The bugs that motivated these rules:

1. **Every key the settings panel reads back must be listed in `loadMergeSettings()`.**
   `blockDiff` was not, so `settings.blockDiff` came back `undefined` at restore time and
   `undefined !== false` silently re-enabled it on every reload — the stored value was correct
   the whole time, nothing ever read it.
2. **Transient performance postures must not be written to settings.**
   `applyProactivePosture()` (large paste → force Collapse Unchanged) used to
   `SettingsManager.set('collapseUnchanged', true)`. That turned a one-off render decision into
   the user's permanent preference, which is what "the setting keeps coming back on" was.
   It now flips only the live view + checkbox and sets `_collapseForcedBySize`;
   `applyMergeSettings()` keeps persisting the *stored* value while that flag is set, and
   touching either collapse control clears it (the choice is theirs again).
3. **One storage key per setting.** `defaults` declared `autoFormatJson`/`autoSortKeys` while all
   the code read/wrote `autoFormat`/`autoSort`, so the intended default never applied and
   storage carried both names with disagreeing values. Names now match the readers.

Round-trip check when adding a control: set it, reload, confirm the DOM control comes back —
storage being right is not enough.

### 2c. Snapshot / URL must restore the COMPARISON, not just the content
`ZipSnapshotManager` already carried `settings.json`, and import wrote it to localStorage — but
only `wordWrap`, `scrollLock` and `theme` were turned back into live state. The options that
decide what the diff actually *says* (ignore patterns + scope + styling, numeric tolerance,
block diff) were stored and never applied, so a reopened snapshot did not reproduce.
`applyComparisonSettings()` re-derives all of them, resets the align memo and pristine
snapshot, re-syncs the ignore/tolerance inputs, re-runs the transform and re-counts. Call it
from every path that loads foreign settings (both ZIP import sites; the URL path already
re-derives during startup). Settings are written with one `saveAll()`, not one
`set()` round-trip per key.

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
- **Sort ▾ dropdown** (v6): "Sort by field value" — a text input taking a spec like
  `category ASC, amount DESC` (comma-separated keys, per-key ASC/DESC default ASC, dot-notation
  for nested keys) that value-sorts the **top-level array of objects in both panes** (ideal for
  aligning two arrays before diffing); empty spec falls back to "Sort keys A→Z". Pure logic in
  `utils.js` (`parseSortSpec` / `sortJSONByFields`); UI in `initializeSortPanel()` + `sortByFields()`.
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

### Progressive-disclosure info tooltips (v6)
To keep panels uncluttered, verbose descriptions are hidden and revealed on demand
behind a subtle ⓘ icon (progressive disclosure). Implemented generically in
`v6/index.html`:
- **`enhanceInfoTips(root)`** runs once over the document at the end of `initializeApp`.
  It finds every `.setting-desc` (→ ⓘ appended to the row's `.setting-title`) and every
  `.ignore-desc` (→ ⓘ appended to the preceding `.settings-section-title`), tags the
  description `.is-tip-source` (CSS `display:none !important`), and wires the icon.
  Idempotent (`dataset.tipDone`), so authors keep writing `.setting-desc`/`.ignore-desc`
  as before and new ones auto-convert — no per-row markup.
- **`InfoTips`** (IIFE) manages ONE shared `.info-tip` popover portaled to `<body>` so a
  scrolling panel's `overflow-y:auto` never clips it. Shows on hover/focus (desktop) and
  tap/click (touch); dismisses on mouseleave/blur/Escape/scroll/resize/outside-click. Icon
  click does `preventDefault` (so an ⓘ inside a `<label>` doesn't toggle its checkbox) and
  the popover `stopPropagation`s its own clicks (so it doesn't trip panels' outside-click
  close). `position()` places below the icon, flips above / clamps to `window.innerWidth`.
- **CSS** (`app.css`): `.info-icon` (subtle bordered circle "i"), `.info-tip`
  (`position:fixed; width:max-content; max-width:300px`), `.is-tip-source`. Font size
  unchanged — this is presentation/hierarchy only. See memory [[v6-info-tooltips]].

### Status Bar
Shows diff count and current mode (count = `mergeView.chunks.length`):
- "No differences"
- "N changed blocks"
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

v6 has **one diff that matters** — CodeMirror's MergeView — plus a dormant legacy counter.
Understand the split before touching diff/perf code:

### 1. Rendering diff — CodeMirror 6 `MergeView` (the real one)
- Computes the line + character diff and draws the gutters/highlights.
- Configured in `MergeView({...})` at `v6/index.html` (`initializeApp`, ~line 500) and
  rebuilt in `recreateMergeView()` (~line 1255).
- Key knobs: `highlightChanges`, `gutter`, `collapseUnchanged`, `revertControls`,
  `orientation`, and `diffConfig.scanLimit` (UI default **6000**, set via the Scan Limit input).
- Recomputes automatically on every `dispatch` — you do NOT need to recreate the view to
  refresh the diff after a content change.
- The authoritative chunk list lives at `mergeView.chunks`.

### 2. Status-bar count — the structural model first, `mergeView.chunks` as fallback
- For a **top-level array pair**, `updateDiffStatus()` reports `JSONAlign`'s model:
  "*2,000 changed of 2,000 items · 6,370 field changes*". Those numbers come from our own
  item/field diff (§10) and are **exact regardless of how much is rendered**.
- Everything else (objects, non-JSON, alignment unavailable) still falls back to
  `mergeView.chunks.length` → "N changed blocks".
- `diffIsDegraded()` detects the case where CM6 gave up and returned one change spanning the
  document, and says so ("Too large to compare precisely — use CSV→JSON…") instead of
  printing a meaningless "1 changed block".
- Viewport-diff mode is only consulted when there is **no** model — an approximate
  "~5 differences in view" is strictly worse than an exact whole-collection count.
- The old `diff_match_patch` full-diff count (and its >100 KB worker offload) was **removed**;
  `diff_match_patch` is still `<script>`-loaded but effectively unused.

### 3. scanLimit is a CORRECTNESS knob, not just a speed knob (~line 1669)
- Read this before touching `clampScanLimit()`. In `@codemirror/merge` 6.7.2 the applied limit
  is `scanLimit >> 1`, and `findSnake()` bails on **absolute character counts**:

      min(lenA,lenB) > scanLimit*16  ->  crudeMatch()          (coarser, still useful)
      min(lenA,lenB) > scanLimit*64  ->  [ONE Change spanning everything]

- So a *low* scanLimit on a large document does not produce a slower or rougher diff — it
  produces **no diff at all**, just one block covering the file. The previous table here
  *lowered* scanLimit as content grew (≤2 MB → 10000, ≤8 MB → 6000, >8 MB → 4000), which drove
  every large input straight into that second branch. That was the "large collections show a
  single large diff" bug: measured, a 50-record pretty-printed pair already collapsed to 1
  change at the default 6000, while 6 records worked — matching the original report exactly.
- The fix is to bound the **text** (§9/10 renders a page of records) and then raise scanLimit to
  whatever that bounded document needs. Three things matter, each learned the hard way:
  - **Aim past BOTH thresholds.** Clearing only the `*64` cliff leaves CM6 in `crudeMatch`, whose
    repeated `indexOf` over the whole range is wildly variable — measured 148 ms for a 4,800-line
    page but **12 s** for a 2,400-line one. Full Myers needs `min(lenA,lenB) <= scanLimit*8`, so
    the floor is `minSide/7`. On line-aligned content Myers is cheap and predictable: its cost
    tracks the NUMBER of differences, not document size. This took page turns 2–6.7 s → ~100 ms.
  - **Only raise on a bounded document** (`SCAN_RAISE_MAX_BYTES`, 3 MB). Past that no scanLimit is
    both accurate and affordable, so the low protective cap stays and CM6 bails out cheaply.
  - **Keep it low across the two-dispatch transition.** Writing both panes is two dispatches and
    CM6 re-diffs on each, so one side is briefly the new window while the other is still the old
    multi-MB document. A limit raised for the FINAL size turned that moment into full Myers on
    300 KB vs 10 MB — a hard lock. `transformAndDispatch`/`gotoRecordPage` lower it before the
    writes and raise it after; CM6 re-diffs on the reconfigure, so one cheap diff is wasted.
  The user's value is a **minimum**, never a cap that breaks the diff.
- The old ceiling still applies to **unaligned** content (`_alignedRender === false`: non-JSON,
  or Block Diff off), where Myers really is quadratic and the crude fallback is protective.
- `syncDiffConfig()` must run after **any content change**, not just settings changes —
  scanLimit is a function of document length, so a value left over from smaller content
  silently re-introduces the bail. See memory [[v6-scanlimit-freeze]].
- **`reconfigure({diffConfig})` does NOT re-diff — the limit must be right BEFORE the write.**
  In `@codemirror/merge` 6.7.2, `MergeView.reconfigure()` assigns `this.diffConf` and calls
  `scheduleMeasure()`; chunks are rebuilt *only* inside `MergeView.dispatch()` on a doc change,
  from the `diffConf` live at that instant. So "write the panes, then raise scanLimit" — which
  is what this code did — leaves the visible diff computed at the low transition cap forever.
  That was the whole "large collections render as one modified block" bug: measured on the
  2,000 × 158 pair, the rendered page produced **1 chunk at the live limit vs 196 at the raised
  one**, on byte-identical text. `writeAlignedPanes()` now orders it correctly — low cap for the
  first write (where one pane is new and the other is still the old multi-MB doc), the final
  limit before the write that settles the pair. A full-document replacement makes CM6 re-diff
  the whole pair, so the last write is the one that counts.
- `_chunkScanLimit` records what the visible chunks were **actually** computed with (updated on
  every doc change by the autosave update listener); `ensureDiffFresh()` compares it with
  `_appliedScanLimit` and calls `forceRediff()` — rewriting a pane with its own text, the only
  lever the merge API gives us — when they disagree. Needed wherever the effort changes without
  a content write: a Scan Limit settings change, or content that arrived already aligned.
  `diffIsDegraded()` also tests against `_chunkScanLimit`, not the configured value.
- Cost of a raised limit on aligned 158-field records, measured: 0.6 MB combined → 0.24 s,
  1.5 MB → 1.2 s, 3 MB → 3.3 s, 6 MB → 12 s. That is why `SCAN_RAISE_MAX_BYTES` is 3 MB and
  why bounding the **text** (the record window) is the mechanism above it, not a bigger limit.

### 4. In-place reconfigure + forced re-collapse (no more teardown on edit)
- `canReconfigure()` gates on CM6 merge ≥ 6.7. When true, settings/edits call
  `mergeView.reconfigure(buildReconfigureConfig(...))` instead of full DOM teardown.
  `recreateMergeView()` now runs only for an **orientation flip**.
- **Caveat:** reconfigure applies highlight/gutter/collapse/orientation/revert immediately, but
  `diffConfig` is only *stored* — it takes effect on the next doc change. Anything that depends
  on the diff being recomputed must follow it with `ensureDiffFresh()` (see §3).
- `refreshMergeViewIfNeeded()` (called after format/sort/paste/CSV ingest and debounced edits,
  only while Collapse-Unchanged is on) reconfigures in place, then calls `forceRecollapse()`.
- `forceRecollapse()` works around CM6's collapse being a singleton StateField that only folds
  in its `init`: it reconfigures `collapseUnchanged: undefined` then back on, forcing a re-fold
  against the latest chunks. Cheap (two state-effect dispatches, no DOM rebuild). See memory
  [[v6-collapse-needs-reinit]].

### 6. Block-level (object-aware) JSON alignment — `json_align.js` + `applyBlockAlignment()`
- **Why:** CM6's diff is char/line based and can't be replaced (`MergeView.chunks` is
  read-only; no custom-diff hook). On arrays of objects it greedily matches shared boilerplate
  (`{`, `},`, `"id": `) ACROSS element boundaries, so a removed item shows as stray half-matched
  lines + a "comma" artifact instead of one clean block.
- **How:** `window.JSONAlign.align(leftText, rightText)` (in `json_align.js`) parses both sides,
  structurally aligns them (arrays by element via LCS over deep-equality with positional pairing
  of "changed" items; objects by key), and returns BOTH sides re-serialized as pretty JSON with
  blank **gap lines** where an item/key exists on only one side. Blank lines are insignificant
  JSON whitespace, so the result parses to the identical value — the editors keep holding valid
  JSON and all ~50 `mergeView.a/b.state.doc` readers keep working. MergeView then diffs an
  already-aligned document → clean whole-block adds/removes (Proxyman-style), equal line counts
  (so no `cm-mergeSpacer` in this mode), and the gap renders as calm empty `cm-changedLine`s
  (neutral `--diff-changed-line`).
- **Wiring (kept minimal):** `applyBlockAlignment()` (near `forceRecollapse`) runs at startup
  (end of `initializeBranches`) and on the existing debounced change timer in `autoSaveExtension`
  — but **skipped while the user is typing** (`tr.isUserEvent('input.type'|'delete')`) so it never
  reformats mid-edit. Paste/format/sort/branch/snapshot all dispatch programmatically → re-align
  automatically. Idempotent (re-aligning aligned content is a no-op), guarded by `_blockAligning`,
  and **memoized by doc identity** (`_lastAlignMemo`: CM6 `Text` objects are immutable, so
  same-docs + same-mode + same-predicate ⇒ skip the whole parse/align/stringify, failures included).
- **Setting:** `blockDiff` (default **true**, toggle in settings panel). Off → `removeBlockAlignment()`
  strips gaps (only when the result is valid JSON) and CM6's default diff returns.
- **Fallback:** any parse failure / non-JSON / >`MAX_BYTES` (24 MB) combined → `align()` returns
  `{ok:false}` → no-op → raw text + CM6 default diff. See memory [[v6-block-diff-alignment]].

### 9 / 10. Large collections — our own record matching + field model + windowed render
- **Symptom (two separate reports, same root cause):** large CSV-derived JSON either froze the
  tab or reported "the entire collection as one modified record". Regression datasets:
  `docs/test-cases-example/bwoser-tabs-freezed-on-this-data/*.csv` and
  `docs/test-cases-example/6-did-not-show-diffs-test-data/*.csv` (2,000 records × 158 columns).
- **Root cause:** CM6's diff cannot handle a multi-MB pair *at any scanLimit* — see §3 for the
  exact bail conditions. An earlier attempt put each record on **one compact line**
  (`alignArrayOneLine`) to shrink the line count. That fixed the freeze but destroyed the point
  of the tool: a 158-field record became one 4,000-character line, so there was no visible
  field-level diff. Both the freeze *and* the one-line workaround are gone.

**How it works now — `json_align.js` stopped relying on CM6 to FIND differences:**

0. **`findCollection()` locates the records first.** The root when both sides are arrays,
   otherwise the shared object key holding the biggest array on both sides (depth 1). Envelope
   shapes — `{data:[…]}`, `{results:[…]}`, `{items:[…]}` — used to bypass this entire module:
   no model, no window, no pager, and the whole multi-MB document handed to CM6, which is
   exactly the size where its diff gives up. They now get the same treatment as a bare array,
   with the collection windowed *inside* a normally-aligned object shell (`renderWithShell()`
   + `alignObject(…, override)`), so the panes still hold a complete, valid JSON object.
   `model.path` names the key (null for a root array) — `idSource()` in index.html indexes
   through it. Below `PRETTY_MAX_BYTES` nothing changes: still fully pretty-printed.
1. **`matchArray()` pairs records itself.** In preference order:
   - `'id'` — an **identity key** detected by `detectIdKey()`: a field whose values are unique on
     *both* sides **and** largely overlap between them. Uniqueness alone is not enough — in a
     homefacts export both sides have unique `UUID`s but every one was regenerated (0% overlap,
     useless), while `ParcelNumberRaw`/`ATTOMId` overlap 100%. Anchors are then the
     **longest increasing subsequence** over those ids (patience diff, O(n log n)).
   - `'lcs'` — exact LCS for small arrays (`n*m <= MAX_LCS_CELLS`), where it is optimal and cheap.
     Identity is *not* guessed below `ID_MIN_ITEMS` (4) — on a handful of elements almost any
     field looks unique.
   - `'hash'` — content-hash anchors + positional gap fill. No O(n·m) DP, no size cliff.

   **Gap filling must not invent pairs (`shouldPair`).** Records the anchor pass could not match
   are filled in positionally, and `shouldPair()` decides whether such a pair is "the same record,
   modified" or two unrelated records. It used to test **key names only** — but every row of a CSV
   export has identical keys, so it said yes to *anything*. Comparing two unrelated 70k/8k exports
   (dataset 8, zero overlap on every column) therefore paired record k with record k and reported
   **"8,000 changed · 55,988 field changes"** for changes that do not exist — and the resulting page
   differed on 64 % of its lines, which CM6 cannot diff at any affordable scanLimit, so the panes
   showed one undifferentiated block while the summary insisted there was something to see.
   `shouldPair` now also requires **value agreement** (`PAIR_VALUE_RATIO`, 0.5) over the keys that
   actually *vary* across the collection (`informativeKeys()`, sampled `INFO_SAMPLE`) — matching on
   a column that holds the same value in every record proves nothing. Guessing "unrelated" only
   costs a field diff; guessing "same" invents field changes *and* produces undiffable text, so the
   bar is deliberately set high. Dataset 8 now reports `8,000 removed, 70,752 added, 0 field
   changes · no records in common`, rendered as clean whole-record add/remove blocks. Datasets 6,
   the attom/parcels pair and all six curated examples are byte-identical before/after.
2. **`buildModel()` computes the item + field diff directly** — `{status, changed[], onlyA[],
   onlyB[]}` per item plus totals and a field histogram. Exact at any size; this is what the UI
   reports and lists.
3. **`linkMoves()`** recovers field-level diffs for records that MOVED. Rendering has to stay
   order-preserving (each pane must hold that side's records in that side's real order — a
   reordered pane would no longer contain the user's document), so a record that moved far
   renders as a removal plus an addition. That is right for layout and wrong for reporting, so
   moves are detected by identity and reported as `status: 'moved'` **with their real field
   diff**, without touching the layout.
4. **`renderArray()` bounds what CM6 has to diff.**
   - `view: 'window'` (auto above `PRETTY_MAX_BYTES`, 800 KB combined) renders only
     `items[from, from+size)` at **full fidelity**, pretty-printed, field per line. `pageSizeFor()`
     derives the page size from the average record size. The pane holds a real, complete,
     valid-JSON slice — nothing is omitted from the records that are shown.
   - `view: 'full'` renders everything: equal records compact (byte-identical both sides, so they
     cost CM6 nothing and fold away), changed records pretty until `EXPAND_CHAR_BUDGET`.
   - Below the threshold everything is pretty-printed exactly as before.
- **The page size is MEASURED, not fixed (`calibrateRenderBudget` / `renderWindow`, index.html).**
  A fixed character budget is the wrong unit, because CM6's diff is O((N+M)·D) and D varies
  enormously between datasets. Measured on ~300 KB pages: dataset 6 (2 % of lines differ) 0.3 s;
  attom/parcels (8 % differ) **12–20 s**, a locked tab; disjoint records (64 % differ) gives up
  entirely. Nor can it be predicted from the line-diff ratio — 4× the ratio cost 70× the time.
  So: render a small **probe** page (`PROBE_BUDGET`, 24k chars), run CM6's own exported `diff` on
  it, and scale the real page so the predicted cost lands near `DIFF_TARGET_MS` (400 ms). Cost
  grows ~quadratically with page bytes (measured exponent ≈ 2.1), so the page scales with the
  square root of the headroom. This costs **nothing in diff quality** — chunk count tracks records
  shown exactly (256 records → 256 chunks, 32 → 32), so a smaller page means fewer records per
  page, never a coarser diff. Self-calibrating on purpose: a constant tuned on one machine would
  be wrong on a slower one. Measured once per content change; page turns reuse it.
  - **Extrapolation is capped** (`MAX_PROBE_SCALE` 16, `MAX_PROBE_SCALE_DISSIMILAR` 2). CM6
    switches algorithm branches on absolute length (full Myers → `crudeMatch` → give up), so on a
    mostly-different page the cost curve is not even monotonic — measured 60 → 102 → 6 → 22 → 1 ms
    as the page grew. Extrapolating through that is meaningless, so those pages take one small step
    up instead.
  - Result: attom/parcels **12,574 ms → ~400 ms** with real field-level chunks; worst synchronous
    CM6 cost across all regression datasets ~400 ms, stable across runs.
  - A dissimilar page still hits the `MYERS_MAX_DIFF_RATIO` cap and comes back as one chunk. That
    is deliberate: at ~100 % differing lines every line is marked changed either way, so 1 vs 108
    chunks changes only prev/next granularity, not what is rendered — and letting Myers run to
    completion there costs 490–770 ms per page for a result the Details panel already gives.
- **UI:** a **record pager** (`1–62 of 2,000`, prev/next) appears only when the render is
  windowed, and a **Details** panel (`#diff-details`) lists the complete breakdown — field
  histogram + every changed/added/removed/moved item, filterable, click to jump to that record.
  Both read the model, so they describe the whole dataset, not the visible page.
  The status pill appends **"no records in common"** when nothing on either side matched anything
  on the other, so a large "added" count reads as a verdict rather than as a result.
- **`prepare()` — parse once, render many windows.** `JSONAlign.prepare(l, r, opts)` returns a
  handle holding the parsed pair + match + model; `handle.render({from, size})` emits a window
  from it. Paging must use this: re-running `align()` per page re-parsed ~20 MB and rebuilt the
  match and model on every Next press. Measured 41 ms initial, 3 ms per subsequent page.
- **Paging safety — two invariants, both violated at first:**
  - While a window is showing, `_ignorePristine` holds the untransformed pair.
    `applyBlockAlignment()` and `gotoRecordPage()` re-align **from that**, never from the panes —
    re-aligning a window would window a window and lose the rest of the data.
  - **Never persist a truncated view.** The autosave listener drops `_ignorePristine` on any doc
    change that is not ours (including the user typing while a page is displayed), after which
    `saveContent()` would happily write 61 records over a 2,000-record document. It now refuses
    to save when the panes are truncated and no complete snapshot exists. Its size guard also has
    to measure what will actually be WRITTEN (the pristine pair), not the panes — a ~600 KB
    window guarding a 20 MB synchronous write sailed past `AUTOSAVE_MAX_BYTES` and stalled the
    tab on every debounced change.
- **`MAX_RENDER_CELLS_PER_PANEL` 220k → 2M.** It used to bound what MergeView had to *render*,
  which meant dropping rows — a 2,000-row × 158-column export was silently cut to ~1,390 rows and
  those rows were never compared at all. Rendering is now bounded by the record window, so this
  only needs to bound parse + memory.
- **Measured** on the 2,000 × 158 pair (~19.7 MB pretty): model in ~0.4 s; 2,000 items,
  6,370 field changes, matched on `ParcelNumberRaw`; rendered page ~300 KB/side; CM6 returns
  ~196 real chunks touching ~2 % of the rendered lines, in ~0.24 s — instead of 1 chunk
  covering everything. Page turns ~0.25 s. Same numbers for the `{meta, data:[…]}` envelope
  (197 chunks) and for a 60-record pretty render (190). Regression data:
  `docs/test-cases-example/6-did-not-show-diffs-test-data/{one,two}.csv`.

### 7. Exclude keys/patterns from the diff — `diff_ignore.js` + normalization + `.cm-ignoredLine`
- **Why:** ignore noisy fields (db `created_on`/`updated_at`, ids, hashes) that differ on every
  record. CM6 owns the diff and won't drop keys, so a matched property is made to **look identical
  on both sides** — then MergeView genuinely sees no change: the record **collapses**, is **not
  counted**, and shows **no red/green**. (My first cut only re-skinned lines; that left every record
  "changed" so nothing collapsed — normalization is what actually delivers "treat as same content".)
- **Normalization (the mechanism):** `applyBlockAlignment()` runs when Block Diff **or** ignore is
  active. It passes an `ignore(key,aVal,bVal)` predicate to `JSONAlign.align(...,{ignore})`
  (block-diff on) or `JSONAlign.normalize(left,right,ignore)` (block-diff off). For a matched
  property present on **both** sides, json_align emits the **left ("a") value on both sides**. Since
  this rewrites the right pane's value, the pre-normalized text is snapshotted in `_ignorePristine`
  (captured when `res.changed` is true = input still un-normalized); removing a pattern / turning
  ignore off calls `restoreIgnorePristine()`, and **`saveContent()` persists `_ignorePristine`**, so
  storage/export keep real data, not the normalized view. Any **external** doc change (typing,
  paste, clear — anything not guarded by `_blockAligning`) invalidates `_ignorePristine` in the
  autosave listener, so autosave persists what's on screen until the next re-normalization
  recaptures a fresh pair — a stale pristine can no longer resurrect replaced/cleared content
  (this was the "cleared data reappears after refresh" bug). Clear All persists the cleared
  state immediately via `StorageManager.clearStorage()` (empty pair in localStorage + deletes the
  IndexedDB fallback record); per-pane Clear calls `restoreIgnorePristine()` first (surviving
  pane keeps its real values) and then saves synchronously.
- **Match scope (`ignoreScope`, default `both`):** `window.DiffIgnore.makePredicate(matcher, scope)`
  — `'key'` tests the key name, `'value'` tests the property's primitive value, `'both'` either.
  Plain pattern = exact match; `/regex/flags` = RegExp. Selector lives in the ignore dropdown.
- **Decoration (grey skin, safety net):** a per-pane `ViewPlugin` in `ignoreCompartment` decorates
  matched lines (`computeIgnoredLines(text, matcher, scope)` → key line + whole value block) with
  `.cm-ignoredLine`. CSS (two-class selectors + `!important`) overrides any residual red/green
  (e.g. a matched key present on only one side, which can't be normalized): transparent/dimmed by
  default, subdued gray when the container has `.ignore-styled` (setting `ignoreStyled`, default on).
- **Count:** `countVisibleChunks()` still skips chunks lying entirely inside ignored keys — mostly a
  no-op now (normalized props aren't chunks) but covers the structural-only case.
- **Caching:** ignored-line sets are computed once per doc version via `getIgnoredLineSet(doc)`
  (WeakMap keyed on the immutable `Text` object + `_ignoreGen` bumped in `rebuildIgnoreMatcher`);
  the decoration ViewPlugin and `countVisibleChunks()` share the same scan.
- **Wiring:** `applyIgnorePatterns()` (add/remove/scope change) → `restoreIgnorePristine()` first →
  persist `ignorePatterns`/`ignoreScope` → recompile → re-run transform → `reconfigureIgnore()` →
  re-render → recount. Compartment mounted in both editors (initial + `recreateMergeView`).
- **Setting:** `ignorePatterns` (string[]) + `ignoreScope` ('key'|'value'|'both') + `ignoreStyled`
  (bool). Empty list → predicate `null` → zero overhead. See memory [[v6-ignore-keys-diff]].

### 8. Numeric tolerance for floating-point diffs — `json_align.js` (`numTol`)
- **Why:** ignore tiny floating-point noise (`19.99` vs `19.9905`, rounding drift) so values that
  are "equal enough" don't show as diffs. Same problem shape as ignore keys — CM6 owns the diff — so
  the **same solution**: normalize. When `|a - b| <= numTol` the LEFT number is emitted on BOTH
  sides, so MergeView sees no change (collapses, not counted, no red/green).
- **Mechanism (`eqKind(a,b,tol)` in json_align.js):** replaced `deepEqual` with a 3-way `eqKind`
  returning `0` (differ), `1` (exactly equal), `2` (equal ONLY via tolerance). Kind `2` flips
  `ctx.changed` so the caller snapshots `_ignorePristine` — reusing the **exact same** pristine /
  restore / autosave path as ignore, so storage/export keep real numbers, not the normalized view.
  `deepEqual` is now `eqKind(a,b,null) !== 0` (unchanged exact semantics for the ignore path).
- **Coverage:** works at every level via recursion — object props, array elements (the LCS in
  `lcsMatches` is tolerance-aware, so near-equal items *align* instead of read as add+remove), and
  nested. Both `align()` (block-diff on, `{numTol}`) and `normalize()` (block-diff off, 4th arg).
- **Wiring (index.html):** `numTolEnabled` + `numTolValue` globals, `numToleranceActive()` →
  effective tol or null, `transformActive()` (block OR ignore OR tol) gates
  `applyBlockAlignment`/`removeBlockAlignment` everywhere. `applyNumTolerance()` mirrors
  `applyIgnorePatterns()` (restore pristine → persist → drop `_lastAlignMemo` → re-transform →
  recount). `_lastAlignMemo` key includes `tol`. UI: enable checkbox + number input in the **Ignore
  dropdown** ("Numeric tolerance" section), wired in `initializeIgnorePanel()`.
- **Setting:** `numToleranceEnabled` (bool, default false) + `numTolerance` (number, default 0.001).
  Off / value ≤ 0 → `numTol` null → zero overhead. **Gotcha:** the boundary is IEEE754-fuzzy —
  `|19.991 - 19.99|` is `0.001000…012 > 0.001`, so exactly-at-tolerance pairs may or may not match.
  See memory [[v6-numeric-tolerance-diff]].

### 11. Progress, ETA and cancellation for long runs — `progress.js` + async pipeline
- **Why:** a large comparison is a chain of individually-fast steps (CSV parse ≈ 0.25 s,
  parse ≈ 0.1 s, match ≈ 0.1 s, field model ≈ 0.3 s, CM6's diff ≈ 0.25 s) that add up, and the
  model/match passes are **linear in record count** — 0.3 s at 2,000 records is 3 s at 20,000.
  Run synchronously with no feedback, that is indistinguishable from a frozen tab.
- **`window.ProcessingUI`** (`utils/progress.js`) owns a non-blocking bottom-right panel:
  phase label, determinate bar, `1,245 / 2,000`, elapsed, an EMA-smoothed ETA, optional heap
  size, and a **Cancel** button. `start({title, phases:[{key,label,weight}]})` → a job;
  `job.phase(key)` / `job.update(done,total,note)` drive it. Repaints are coalesced to one
  per frame — a chunked loop calls `update()` thousands of times a second.
  - It only appears after `SHOW_DELAY_MS` (400 ms); a bar that flashes for 80 ms is worse
    than none. Most comparisons never show it.
  - `fraction()` measures from the **first phase actually entered**, not the start of the
    declared list — a JSON paste skips the CSV phase, and a bar that opens at 20 % because of
    a step that will never run reads as broken.
  - **`detach()` vs `finish()`:** two panes can ingest at once and the newer job takes over the
    panel, but the older one is still working and must stay cancellable. Conflating the two
    (the newer job calling `finish()` on the older) made `cancel()` early-return on
    `job.finished` — one pane kept processing after Cancel and produced a nonsense
    "61 changed, 1,939 removed" comparison against a stale pane.
- **Cooperative chunking** (`json_align.js`): `chunkedLoop(n, body, ctl)` runs slices of
  `SLICE_MS` (12 ms) and yields via **MessageChannel** — `setTimeout`'s ~4 ms clamp would
  dominate at one yield per slice, and `requestAnimationFrame` never fires in a background tab.
  `CHECK_EVERY` (64), not `SLICE_MS`, sets the *floor* on slice length, since the clock is only
  read every N items; at 256 a 158-field record set ran 33 ms slices (over a frame).
- **`prepareAsync(l, r, opts, ctl)`** is a verified drop-in twin of `prepare()` — identical
  model, items, rendered text and stats, ~10 % slower from yielding. Phases: `parse` →
  `identity` → `match` → `model`. Rendering stays synchronous (bounded by the record window,
  ~10-20 ms at any collection size). `phaseCtl()` must copy `signal` onto each phase's control:
  a reporter returned bare from `onPhase()` carries only `onProgress`, which silently made
  every loop uncancellable.
- **Cancellation is real, not cosmetic.** A Worker running a synchronous parse loop cannot
  receive a "stop" message — its queue is not serviced until the loop returns — so
  `cancelWorker()` **terminates** it (`initializeDiffWorker` is lazy, so the next call rebuilds
  it). Main-thread work checks `ctl.signal.cancelled` at each yield. `cancelAllProcessing()` is
  re-entrant (each job's handler calls back into it), snapshots `_liveJobs` before cancelling,
  clears `_blockAligning` (a cancel can land between the two pane writes), and is also called
  by `clearAll()` so an in-flight ingest can't write over freshly-cleared panes.
- **Cancel stays cancelled:** `_cancelledAlign` records the doc pair that was stopped, so the
  500 ms debounced re-align doesn't restart the exact work the user just cancelled. Any real
  content change clears it.
- **Every cancel point is before a pane write**, so cancellation never leaves a half-written
  comparison — there is nothing to roll back.
- **`chunkedLoop` checks the signal on the way OUT, not only at a yield.** A loop whose last slice
  covered the remaining items used to finish regardless, so a cancel landing there was silently
  ignored and the phase reported success. (Callers re-check before writing, so nothing incorrect
  reached the panes — but a cancellation that is only sometimes honoured is not one.)
- **The editor write needs its own phase.** For the first file of a pair the other pane is empty,
  so no transform runs and the entire cost is `editor.dispatch()` handing CodeMirror a 20 MB
  document — seconds of synchronous work that no phase covered, leaving the panel parked on
  "Parsing CSV data" while the tab locked. `ingestContentInner` now enters the `render` phase,
  reports `Loading 22.9 MB into the editor`, and yields so the panel paints before it blocks.
- **`WORKER_VERSION`** — the worker URL carries `?v=N`. Browsers cache Workers hard and a
  normal (even forced) reload does **not** pick up a new one: measured, the stale worker kept
  running the old message protocol and silently emitted zero progress frames. Bump it whenever
  `diff-worker.js` changes.
- Only payloads over `PROGRESS_MIN_BYTES` (512 KB) take the interruptible path; below that the
  synchronous path is done before the panel would appear.

### 5. Performance managers (`viewport_diff.js`)
- `ViewportDiffManager` — recomputes the **count** for the scrolled viewport ± buffer on
  scroll (debounced). NOTE: it currently affects only the status text, NOT what MergeView renders.
- `PerformanceMode` — bundles settings (auto-enables `collapseUnchanged`) for faster rendering.
- `LargeFileDetector` — analyzes size and auto-suggests/enables perf modes
  (thresholds: 300 KB large, 500 KB warning, 2 MB critical).
- `PerformanceToast` — transient notifications.

### Remaining inefficiencies / where to optimize
- **Viewport mode is cosmetic** for rendering — MergeView still diffs the whole document.
- **MergeView itself has no memoization** — identical content re-diffs from scratch on every
  recreate. (The json_align transform IS memoized now — `_lastAlignMemo`, see §6 — and the
  status pill / button-visibility helpers no longer materialize full doc strings: `docIsBlank()`
  iterates chunks, and above `TEXT_EQ_MAX_BYTES` equality defers to `mergeView.chunks`.)
- The genuinely effective CM6 lever for large files is **`collapseUnchanged` + the adaptive
  `scanLimit` cap**, not the viewport counter.

## Performance Considerations

### Large content handling
- IndexedDB fallback for localStorage quota (StorageManager)
- ZIP compression for snapshots (JSZip)
- Web Worker (`diff-worker.js`) handles off-thread CSV→JSON ingest (its diff-count role is retired)
- `collapseUnchanged` reduces rendered DOM size dramatically
- (NOTE: v6 does NOT use Oboe.js — that streaming parser is v5 only)

### Diff Performance levers
- `scanLimit` (`diffConfig.scanLimit`) bounds the LCS scan for the rendering diff; the applied
  value is auto-capped by content size via `clampScanLimit()` (see Diff Engine Architecture §3)
- `collapseUnchanged: { margin: 3, minSize: 4 }` folds identical regions
- Performance Mode auto-enables collapse for very large inputs

## Known Limitations

1. **Very large files** (>100MB) may cause browser performance issues
2. **URL sharing** limited to ~2000 chars (falls back to ZIP)
3. **CodeMirror 6 themes** loaded from CDN (requires internet)
4. **Mobile experience** - Works but optimized for desktop

## Future Enhancements

Potential improvements (check `todo.md` for current priorities):
- Make Viewport Diff actually limit rendering (not just the count)
- Memoize diff results by content hash
- Virtualized rendering for very large files
- More CodeMirror 6 themes / better mobile UI / PWA / offline v6

> Done (was on this list): status count now derives from `mergeView.chunks.length`
> (no more duplicate DMP diff); edits/settings reconfigure the live view in place
> instead of full `recreateMergeView()` teardown; **object-aware (block-level) JSON
> diff** via `json_align.js` (was "Optional semantic JSON mode") — see Diff Engine §6.

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

**Last Updated**: 2026-06-06
**Current Version**: v6 (CodeMirror 6) is primary, v5 (CodeMirror 5) is legacy
**Status**: Active development on `main` branch
