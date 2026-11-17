# JSON Compare Tool - Comprehensive AI Agent Guide

## 🎯 Project Overview
A **client-side-only** web application for comparing, formatting, and merging JSON data with advanced diff visualization. Built with CodeMirror 6, this tool runs entirely in the browser with no backend or build process required.

**Live URL:** https://your-domain.github.io/json_compair/  
**Version:** CodeMirror 6 (migrated from v5 in Nov 2025)  
**Deployment:** Automatic via GitHub Pages on push to `main`

---

## 📁 Project Structure

### Root Files (Active Application)
```
json_compair/
├── index.html              # Main app (CM6) - 1950+ lines with embedded JS
├── index-v5.html           # Legacy version (CM5) - kept for fallback
├── utils.js                # URL/storage management, templates
├── json_utils.js           # Flexible JSON parser (Python syntax support)
├── utils_csv.js            # CSV detection & conversion
├── utils_zip.js            # ZIP snapshot creation/import (NEW Nov 2025)
├── server.js               # Optional local dev server (Node.js)
└── README.md               # User-facing documentation
```

### Directories
```
css/
├── app.css                 # Application-specific styles
├── codemirror.css          # CodeMirror base (DO NOT modify - from CDN)
├── merge.css               # Merge view base (DO NOT modify - from CDN)
├── merge-custom.css        # Custom diff colors (red/green) - SAFE to edit
└── ccsiteV6.css            # Site-wide branding/layout

js/
├── button-events.js        # File upload handlers (legacy, not used in CM6)
├── codemirror.js           # CodeMirror v5 library (for index-v5.html)
├── merge.js                # CodeMirror v5 merge addon
├── diff_match_patch.js     # Text diffing algorithm
├── large_json_helpers.js   # Performance optimizations for large files
├── large-data-worker.js    # Web Worker for async processing
├── oboe-browser.min.js     # Streaming JSON parser
└── papaparse.min.js        # CSV parsing library

docs/
├── PRD/                    # Product Requirements Documents
│   ├── 01-system-architecture.md
│   ├── 02-feature-specifications.md
│   ├── ...
│   └── 14-csv-python-parsing.md
├── 2025-10-29_LIBRARY_UPDATES_OCT_2025.md
├── 2025-11-12_ZIP_SNAPSHOT_FORMAT.md  # NEW - ZIP export documentation
├── QUICK_REFERENCE_ZIP.md  # NEW - Quick reference
└── ...

src/
├── choose-version.html     # Version selector page
├── demo-block-align.html   # Feature prototypes
├── test-*.html             # Various experiments
└── index*.html             # Development iterations

temp/                       # Temporary files (gitignored)
```

---

## 🏗️ Architecture Deep Dive

### Technology Stack

**Core Framework:**
- **CodeMirror 6** (Nov 2025) - Modern text editor with ES modules
  - `@codemirror/merge@6.7.2` - Side-by-side diff view
  - `@codemirror/lang-json@6.0.1` - JSON syntax highlighting
  - `@codemirror/view@6.34.1` - Editor rendering
  - Loaded via ES Module Import Maps from unpkg.com

**Libraries (CDN-loaded):**
- **JSZip 3.10.1** - ZIP file creation/extraction (NEW)
- **Pako 2.1.0** - Gzip compression for URL sharing
- **diff_match_patch 1.0.5** - Semantic diff algorithm
- **PapaParse 5.4.1** - CSV parsing
- **Oboe.js 2.1.5** - Streaming JSON (for large files)

**No Build Tools:**
- Direct HTML/CSS/JS editing
- Changes effective immediately (F5 refresh)
- Dependencies loaded from CDN
- Pure ES6 modules in browser

### Application Flow

```
User Opens Page
    ↓
index.html loads
    ↓
Load utilities (utils.js, json_utils.js, utils_csv.js, utils_zip.js)
    ↓
Load CodeMirror 6 via Import Maps
    ↓
Initialize MergeView
    ↓
Check URL params → Load content OR
Check localStorage → Load saved OR
Show default template
    ↓
Setup event listeners (drag-drop, paste, buttons)
    ↓
Ready for user interaction
```

---

## 🔧 Core Utilities Explained

### 1. **utils.js** - Foundation Manager
Located at project root. Handles URL/storage/templates.

**Key Components:**
```javascript
window.URLManager = {
  generateShareableURL(left, right)  // Compress & encode for URL
  loadFromURL()                       // Decompress from URL params
  clearURL()                          // Clean URL after loading
}

window.StorageManager = {
  saveToStorage(left, right)          // Save to localStorage
  loadFromStorage()                   // Load from localStorage
  saveToIndexedDB(left, right)        // Fallback for large data
}

window.DefaultTemplates = {
  simple: { left: '...', right: '...' }
  nested: { left: '...', right: '...' }
  array: { left: '...', right: '...' }
  // ... more templates
}

window.SettingsManager = {
  get(key)                            // Get setting from localStorage
  set(key, value)                     // Save setting
  loadAll()                           // Get all settings as object
}
```

**Usage in index.html:**
```javascript
// Save content
StorageManager.saveToStorage(leftText, rightText);

// Generate share URL
const url = URLManager.generateShareableURL(leftText, rightText);

// Load template
const template = DefaultTemplates.simple;
```

### 2. **json_utils.js** - Smart JSON Parser
Handles non-standard JSON formats (Python, datetime, etc.)

**Key Functions:**
```javascript
window.parseFlexibleJSON(text)      // Parse JSON with Python syntax
window.sortJSONKeys(obj)            // Recursively sort object keys
```

**Supported Formats:**
```python
# Python dict/list syntax
{'name': 'John', 'active': True}
→ {"name": "John", "active": true}

# Python None
{'value': None}
→ {"value": null}

# Complex numbers
{'number': (3+4j)}
→ {"number": {"real": 3, "imag": "4"}}

# Datetime
datetime.datetime(2023, 11, 15, 10, 30, 0)
→ "2023-11-15T10:30:00.000Z"
```

### 3. **utils_csv.js** - CSV Auto-Converter
Detects and converts CSV to JSON automatically.

**Key Functions:**
```javascript
window.CSVUtils = {
  isCSV(text)                        // Heuristic CSV detection
  csvToJSON(text, options)           // Sync conversion
  csvToJSONAsync(text, options)      // Async for large files
}
```

**Auto-Detection Logic:**
- Check for common separators (`,`, `\t`, `;`)
- Validate consistent column count
- Look for quoted fields
- Min 2 rows required

**Options:**
```javascript
{
  coerceTypes: true,     // Convert "123" → 123, "true" → true
  header: true,          // First row as keys
  skipEmptyLines: true
}
```

### 4. **utils_zip.js** - Snapshot Manager (NEW)
Handles export/import of multi-file snapshots.

**Architecture:**
```javascript
window.ZipSnapshotManager = {
  createSnapshot(left, right, settings)  // Create ZIP with 4 files
  importSnapshot(file)                   // Extract ZIP
  downloadSnapshot(blob, filename)       // Trigger download
}

window.LegacySnapshotManager = {
  importSnapshot(file)                   // Handle old .json.gz
}

window.SnapshotHandler = {               // Unified interface
  importSnapshot(file)                   // Auto-detect format
  createAndDownload(left, right, settings)
}
```

**ZIP Contents:**
```
json-compare-snapshot.zip
├── left-content.json      # Formatted JSON (not stringified)
├── right-content.json     # Formatted JSON
├── settings.json          # All user preferences
└── README.txt             # User guide
```

**Usage:**
```javascript
// Export
await SnapshotHandler.createAndDownload(leftContent, rightContent, settings);

// Import (auto-detects ZIP vs legacy)
const data = await SnapshotHandler.importSnapshot(file);
// Returns: { left: '...', right: '...', settings: {...} }
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
      autoSaveExtension
    ]
  },
  b: { /* same for right side */ },
  parent: containerElement,
  orientation: "a-b",              // Side-by-side
  highlightChanges: true,          // Red/green diffs
  gutter: true,                    // Show diff markers
  collapseUnchanged: { margin: 3 }, // Fold identical blocks
  revertControls: "a-to-b"         // Copy left→right buttons
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
      saveContent();  // Save to localStorage
    }, 300);  // 300ms debounce
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

leftScroller.addEventListener('scroll', () => {
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
  if (op !== 0) diffCount++;  // -1=delete, +1=insert, 0=equal
}
```

**Status Messages:**
- "No differences found" - Identical
- "Found X difference(s)" - With count
- "Add content to both panels" - Empty panels

### 7. Drag & Drop
**Implementation:**
```javascript
editorElement.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const text = await files[0].text();
    
    // Auto-convert CSV if enabled
    if (CSVUtils.isCSV(text) && autoCsvEnabled) {
      const json = await CSVUtils.csvToJSONAsync(text);
      editor.dispatch({ changes: { from: 0, to: doc.length, insert: json }});
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
editor.addEventListener('paste', async (e) => {
  const text = e.clipboardData.getData('text');
  
  if (CSVUtils.isCSV(text) && autoCsvEnabled) {
    e.preventDefault();  // Block default paste
    const json = await CSVUtils.csvToJSONAsync(text);
    editor.dispatch({ changes: { from: 0, to: doc.length, insert: json }});
  }
});
```

---

# Copilot Terminal Protocol

## Rules
1. **Progress & Feedback**
   - For feedback requests or intermediate updates, only respond in `echo <MSG_FOR_ME>` (no `plain text messages`).

2. **Completion**
   - When a task is truly finished, Copilot must emit a **single terminal command**.
   - The command must contain both a short status message and one of the explicit completion tokens: `done`, `well`, or `success`.
   - Example:
     ```bash
     echo "Copilot: All steps completed successfully"; echo done
     ```

3. **User Response**
   - The user may confirm with a terminal command:
     ```bash
     echo "User: success"
     ```

4. **Strictness**
   - Completion events command should be emitted as terminal commands.

## Example Flow

- Copilot (completion, fires terminal command):  
  ```bash
  echo "Copilot: Deployment finished"; echo "success"
   ```
- User confirms:  
  ```bash
  echo "User: success"
  ```