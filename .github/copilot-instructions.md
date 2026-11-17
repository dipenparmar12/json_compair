# JSON Compare Tool - AI Agent Instructions

## Performance and scale — standing rule (read before any change)

This tool must stay fast and responsive with **very large comparisons: 100–200 MB of CSV or JSON per side**, which become several hundred MB of pretty-printed JSON. Every feature, fix and refactor is judged on this, not only on its behaviour. A change that adds a feature but slows or freezes large inputs is not done.

Rules:

1. **Measure before and after.** Any change on a comparison path (ingest, parse, align, diff, render, fold, search, export, save) must be checked with the large generator and bench harness, e.g. `node tools/gen_dataset.js --format csv --size 100MB --cols 20 --profile changed:5 --out .outputs/bench/p` and `tools/bench_pipeline.js`. Report the numbers. Baselines are in `docs/PRD/16-large-dataset-phase1-findings.md`.
2. **Never hand CodeMirror a whole large document.** Large content goes through the windowed path (`JSONAlign` window / pager). Writing a full multi-MB document into an editor is the main cause of past freezes.
3. **Read whole panes only through `getDocumentPair()` / `getPaneDocument(side)`.** Do not call `doc.toString()` on a pane in a loop, on a timer, or on every keystroke. Use `docIsBlank()`-style O(1) checks.
4. **No per-keystroke or per-scroll work over the full document.** Debounce it, cap it by size, or do it on demand. Search, fold and status updates must run on the visible window or on demand.
5. **Keep work off the main thread when it scales with input.** Parsing, CSV conversion and matching already run in chunks or in `diff-worker.js`. New heavy loops must yield (`chunkedLoop` / `prepareAsync` style) and support Cancel.
6. **Use linear algorithms.** No nested scans over records, no repeated `JSON.parse` / `JSON.stringify` of the same document, no copies of large strings or objects that are kept alive (see `lastRawCsv` lesson in the findings doc).
7. **Respect existing size gates** (`MAX_BYTES`, `PRETTY_MAX_BYTES`, `FORMAT_MAX_BYTES`, `AUTOSAVE_MAX_BYTES`, `MAX_RENDER_CELLS_PER_PANEL`, …). A new feature that bypasses a gate needs a reason and a measurement.
8. **Tell the user when a result is partial** (sampled rows, windowed records, over-cap content). Never show a partial result as complete.
9. **Prefer the simplest change that keeps the cost bounded** (CLAUDE.MD minimal-change rule). A clever fast path that adds a second code path to maintain needs a measured gain.

Before merging a change that touches the comparison path, state in the commit or PR: the sizes tested (at least one case of 100 MB or more, or the largest the change can reach), the before/after timings, and any new cap or limit.

## 🎯 Project Overview

A **client-side-only** web application for comparing, formatting, and merging JSON data. Two parallel implementations:

- **v6/** - CodeMirror 6 (modern, ES modules, ~2074 lines)
- **v5/** - CodeMirror 5 (legacy, proven stability, ~63KB)

**Entry Point:** `index.html` (version selector) → redirects to `v6/` or `v5/`  
**Deployment:** GitHub Pages (auto-publish on push to `main`)

---

## 📁 Actual Project Structure

```
json_compair/
├── index.html              # VERSION SELECTOR - Auto-redirects to v5/v6
├── server.js               # Optional Node.js dev server
├── README.md               # User docs (references CodeMirror 5, outdated)
│
├── v6/                     # 🔥 ACTIVE APPLICATION (CodeMirror 6)
│   ├── index.html          # 2074-line monolithic app with embedded JS
│   ├── css/
│   │   ├── app.css         # Application styles (SAFE to edit)
│   │   └── ccsiteV6.css    # Branding/layout
│   └── utils/              # Shared utility modules
│       ├── utils.js        # URL params, localStorage, templates, SettingsManager
│       ├── json_utils.js   # Python syntax → JSON parsing
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
├── docs/                   # Documentation & PRDs
├── tests/                  # Test files
└── _archive/               # Old iterations
```

---

## ⚡ Critical Patterns & Workflows

### 1. **NO BUILD PROCESS**

- Direct file editing, F5 refresh, immediate preview
- All JS dependencies loaded from CDN via `<script>` or ES Module Import Maps
- **Utilities shared across v5/v6:** Located in `v{5,6}/utils/` directories
- **Code changes:** Edit `v6/index.html` directly or extract embedded code to separate files

### 2. **Utility Loading Pattern**

Both versions load utilities in this order (in `<head>`):

```html
<script src="./utils/utils.js"></script>
<script src="./utils/json_utils.js"></script>
<script src="./utils/utils_csv.js"></script>
<script src="./utils/utils_zip.js"></script>
```

**Each utility exports to `window.` global namespace:**

- `utils.js` → `window.URLManager`, `window.StorageManager`, `window.DefaultTemplates`, `window.SettingsManager`
- `json_utils.js` → `window.parseFlexibleJSON()`, `window.sortJSONKeys()`
- `utils_csv.js` → `window.CSVUtils` with `.isCSV()`, `.csvToJSON()`, `.csvToJSONAsync()`
- `utils_zip.js` → `window.SnapshotHandler`, `window.ZipSnapshotManager`, `window.LegacySnapshotManager`
- `utils_branch.js` → `window.BranchManager` with `.listBranches()`, `.getBranch()`, `.saveBranch()`, `.createBranch()`, `.deleteBranch()`

### 3. **V6-Specific: CodeMirror 6 via ES Modules**

v6/index.html uses `<script type="importmap">` to load from unpkg.com:

```javascript
"@codemirror/merge": "https://unpkg.com/@codemirror/merge@6.7.2/dist/index.js"
```

Then in the embedded script:

```javascript
import { MergeView } from "@codemirror/merge";
import { EditorState, Compartment } from "@codemirror/state";
// ... usage
```

**Key point:** CM6 uses `Compartment` for dynamic reconfig (e.g., theme toggle) without recreating editors.

### 4. **Data Persistence Flow**

1. **On content change** → 300ms debounce → `StorageManager.saveToStorage(left, right)`
2. **Page load** → Check URL params (`c=...`) → Decompress & load
3. **Fallback** → Load from `localStorage['json-compare-left/right']`
4. **All empty** → Show default template

**Large data:** Falls back to IndexedDB if localStorage quota exceeded (handled in utils.js)

### 5. **URL Sharing Pattern**

```
Content → JSON.stringify → gzip (pako) → base64 encode → URL: ?c=H4sIAAA...
```

Size limit ~2000 chars → Falls back to ZIP download

### 6. **CSV Auto-Detection**

Entry points: drag-drop, paste, file upload

```javascript
if (CSVUtils.isCSV(text) && settings.autoCsv) {
  const json = await CSVUtils.csvToJSONAsync(text);
  // Parse first row as headers, return [{key: val, ...}, ...]
}
```

---

## 🎨 CodeMirror 6 Integration

### Initialization Pattern

```javascript
import { EditorView } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { MergeView } from "@codemirror/merge";

// Dynamic reconfiguration compartments
const wordWrapCompartment = new Compartment();
const themeCompartment = new Compartment();

// Basic editor extensions
const basicSetup = [
  lineNumbers(),
  highlightActiveLineGutter(),
  foldGutter(),
  history(),
  json(),
  // ... more extensions
];

// Create merge view
const mergeView = new MergeView({
  a: {
    doc: leftContent,
    extensions: [
      basicSetup,
      wordWrapCompartment.of(EditorView.lineWrapping),
      themeCompartment.of(lightTheme),
      autoSaveExtension,
    ],
  },
  b: {
    /* same for right side */
  },
  parent: containerElement,
  orientation: "a-b", // Side-by-side
  highlightChanges: true, // Red/green diffs
  gutter: true, // Show diff markers
  collapseUnchanged: { margin: 3 }, // Fold identical blocks
  revertControls: "a-to-b", // Copy left→right buttons
});
```

### Dynamic Reconfiguration

```javascript
// Change word wrap without recreating view
mergeView.a.dispatch({
  effects: wordWrapCompartment.reconfigure(
    wordWrapEnabled ? EditorView.lineWrapping : []
  ),
});

// Change theme
mergeView.a.dispatch({
  effects: themeCompartment.reconfigure(oneDark),
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

---

## ⚙️ Settings System

### Stored Settings (localStorage)

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

### Settings UI

Two interfaces:

1. **Quick Toggles** (header): Collapse Unchanged, Highlight Changes
2. **Settings Panel** (⚙️ button): Full settings dropdown

**Live Updates:**

- Word wrap, theme: Applied via `Compartment.reconfigure()` (no reload)
- Diff settings: Require `recreateMergeView()` (destroys and rebuilds)

---

## 🎯 Key Features Explained

### 1. Flexible JSON Parsing

Handles non-standard formats via `parseFlexibleJSON()`:

- Python dict syntax conversion
- Datetime object parsing
- Complex number handling
- Graceful fallback to standard JSON.parse()

### 2. CSV Auto-Conversion

**When:** Drag/drop or paste CSV data
**How:**

1. `CSVUtils.isCSV()` detects format
2. If `autoCsv` enabled → convert
3. `PapaParse` parses CSV
4. Convert to array of objects
5. Format as JSON (indented 3 spaces)
6. Show success message

**Edge Cases:**

- Invalid CSV → shows error, keeps original text
- TSV/semicolon → auto-detects delimiter
- Quoted fields → handled correctly

### 3. URL Sharing

**Process:**

```
User content → JSON.stringify → pako.gzip → base64 encode → URL param
```

**Size Limit:**

- URLs >2000 chars → Fallback to ZIP download
- ZIP contains formatted JSON (smaller than escaped strings)

**URL Structure:**

```
https://example.com/?c=H4sIAAAAAAAA...
                      ↑
                      Compressed content
```

### 4. ZIP Snapshots

**When:** Content too large for URL
**Format:** Standard ZIP (extractable on any OS)

**Benefits:**

- Human-readable files (formatted JSON)
- Smaller size (no string escaping)
- Includes README.txt for users
- Backward compatible with old .json.gz

### 5. Synchronized Scrolling

**Implementation:**

```javascript
const leftScroller = mergeView.a.scrollDOM;
const rightScroller = mergeView.b.scrollDOM;

leftScroller.addEventListener("scroll", () => {
  if (!scrollLocked) return;
  rightScroller.scrollTop = leftScroller.scrollTop;
  rightScroller.scrollLeft = leftScroller.scrollLeft;
});
```

### 6. Diff Status Display

**Algorithm:**

```javascript
const dmp = new diff_match_patch();
const diffs = dmp.diff_main(leftContent, rightContent);
dmp.diff_cleanupSemantic(diffs);

// Count contiguous diff chunks
let diffCount = 0;
for (const [op, text] of diffs) {
  if (op !== 0) diffCount++; // -1=delete, +1=insert, 0=equal
}
```

**Status Messages:**

- "No differences found" - Identical
- "Found X difference(s)" - With count
- "Add content to both panels" - Empty panels

### 7. Drag & Drop

**Implementation:**

```javascript
editorElement.addEventListener("drop", async (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const text = await files[0].text();

    // Auto-convert CSV if enabled
    if (CSVUtils.isCSV(text) && autoCsvEnabled) {
      const json = await CSVUtils.csvToJSONAsync(text);
      editor.dispatch({ changes: { from: 0, to: doc.length, insert: json } });
    }
  }
});
```

### 8. Paste Enhancement

**Features:**

- Auto-detect CSV → convert to JSON
- Auto-format JSON → prettify
- Auto-sort keys → alphabetically

**Paste Handler:**

```javascript
editor.addEventListener("paste", async (e) => {
  const text = e.clipboardData.getData("text");

  if (CSVUtils.isCSV(text) && autoCsvEnabled) {
    e.preventDefault(); // Block default paste
    const json = await CSVUtils.csvToJSONAsync(text);
    editor.dispatch({ changes: { from: 0, to: doc.length, insert: json } });
  }
});
```

### 9. Git-like Branching

**Purpose:** Save and switch between multiple content versions per panel (e.g., API v1 vs v2 vs v3)

**Branch Selector UI:**

- Located at bottom-right of each editor panel
- Dropdown shows: all branches, "New Branch", "Rename", "Delete", "Save"
- Modified indicator (●) pulses when content differs from saved branch

**Key Operations:**

```javascript
// Initialize on app start
await BranchManager.init();

// List branches (metadata only, no content)
const branches = BranchManager.listBranches();

// Get branch with full content
const branch = await BranchManager.getBranch("api-v2");

// Save current content to branch
await BranchManager.saveBranch("api-v2", content, { source: "manual" });

// Create new branch from current content
const newBranch = await BranchManager.createBranch("API v3", content);

// Switch branch (auto-saves current, loads new)
await switchBranch("left", "api-v2");
```

**Storage:**

- IndexedDB (`json_compair_branches_db`) for branch content
- localStorage (`json_compair_branch_index`) for metadata index
- Settings: `leftBranch`, `rightBranch` track active branch per panel

**Snapshot Integration:**

- ZIP exports include `branches.json` with all branches
- Import merges branches (skips duplicates)

**See:** `docs/2025-11-26_BRANCHING_FEATURE.md` for full documentation

---

# Copilot Terminal Protocol

## Rules

1. **Progress & Feedback**

   - For feedback requests or intermediate updates, only respond in `echo "<MSG_FOR_ME>"` (no plain text messages).

2. **Completion**

   - When a task is truly finished, Copilot must emit a **single terminal command**:
     ```bash
     echo "Copilot: <brief status message>";
     ```
     The message must end with one of the explicit completion tokens: `done`, `well`, or `success`.

3. **Post-Completion Action**

   - **After completing all assigned tasks**, Copilot **must** check for new work at `./todo.md`.
   - If the file exists and is non-empty, Copilot must output:
     ```bash
     echo "NEXT: Pending tasks found in ./todo.md — review required, since its contains new work";
     ```
   - If the file does not exist or is empty, output:
     ```bash
     echo "DONE: No pending tasks or updates found";
     ```

4. **User Response**

   - The user may confirm completion with:
     ```bash
     echo "User: success"
     ```

5. **Strictness**
   - All outputs must be valid terminal `echo` commands—no explanatory text outside `echo`.
