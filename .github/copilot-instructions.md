# JSON Compare Tool - AI Agent Instructions

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
│       ├── utils.js        # URL params, localStorage, templates
│       ├── json_utils.js   # Python syntax → JSON parsing
│       ├── utils_csv.js    # CSV auto-detection & conversion
│       └── utils_zip.js    # ZIP snapshot import/export
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