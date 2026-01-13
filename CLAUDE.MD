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
│   ├── index.html          # ~2074 lines, embedded JS
│   ├── css/
│   │   ├── app.css         # Application styles (SAFE to edit)
│   │   └── ccsiteV6.css    # Branding/layout
│   └── utils/              # Shared utility modules
│       ├── utils.js        # URLManager, StorageManager, SettingsManager
│       ├── json_utils.js   # Python syntax → JSON parser
│       ├── utils_csv.js    # CSV auto-detection & conversion
│       ├── utils_zip.js    # ZIP snapshot import/export
│       └── utils_branch.js # Git-like branching for panels
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
{
  "@codemirror/merge": "6.7.2",
  "@codemirror/state": "6.4.1",
  "@codemirror/view": "6.27.0",
  "@codemirror/lang-json": "6.0.1",
  "@codemirror/theme-one-dark": "6.1.2",
  "pako": "2.1.0",              // gzip compression
  "diff-match-patch": "latest"  // Google's diff algorithm
}
```

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
```

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

**Current branch**: `feature/json-tool-box`
**Main branch**: `main`
**Deployment**: GitHub Pages (auto-publish on push to `main`)

### Recent Commits
- `47d90f9` Add link to JSON Toolbox in info dropdown menu
- `d7c472e` feat: Add JSON Schema Generator and Core Utilities
- `d5b539f` fix: Update Copilot instructions and .gitignore
- `c634c2f` chore: Add .github/todo.md to .gitignore
- `a2f3b63` docs: Update Copilot instructions

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

## Performance Considerations

### Large JSON Files
- Use streaming parser (Oboe.js) for files >10MB
- IndexedDB fallback for localStorage quota
- ZIP compression for snapshots
- Virtualized rendering (not yet implemented)

### Diff Performance
- `scanLimit` setting controls max lines to diff
- Semantic cleanup reduces noise in diffs
- Collapse unchanged sections reduces DOM size

## Known Limitations

1. **Very large files** (>100MB) may cause browser performance issues
2. **URL sharing** limited to ~2000 chars (falls back to ZIP)
3. **CodeMirror 6 themes** loaded from CDN (requires internet)
4. **Mobile experience** - Works but optimized for desktop

## Future Enhancements

Potential improvements (check `todo.md` for current priorities):
- Virtualized rendering for very large files
- More CodeMirror 6 themes
- Better mobile UI
- Progressive Web App (PWA) support
- Offline mode for v6
- WebWorker for diff calculations
- More JSON Toolbox utilities

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

**Last Updated**: 2026-01-13
**Current Version**: v6 (CodeMirror 6) is primary, v5 (CodeMirror 5) is legacy
**Status**: Active development on `feature/json-tool-box` branch
