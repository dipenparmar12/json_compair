Now let me create a comprehensive report with exact line numbers and full content for each section requested:

## COMPREHENSIVE FILE INVESTIGATION REPORT

---

### 1. **v6/index.html - HEAD SECTION (Lines 1-100)**

**Location:** [v6/index.html](v6/index.html#L1-L100)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="theme-color" content="#08C988" />
    <title>Compare JSON files online - CodeMirror 6</title>
    <meta
      name="Description"
      content="FREE two-way JSON format, diff and merge tool with CodeMirror 6"
    />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, minimum-scale=1.0"
    />
    <link rel="shortcut icon" href="../img/onlinetextcompare.png" />
    <link rel="stylesheet" href="./css/ccsiteV6.css" />
    <link rel="stylesheet" href="./css/ccsiteV6.css" />
  <link rel="stylesheet" type="text/css" href="./css/app.css" />

    <!-- pako for client-side gzip compression/decompression - v2.1.0 (latest) -->
    <script
      src="https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"
      crossorigin="anonymous"
    ></script>

    <!-- JSZip for creating ZIP snapshots - v3.10.1 (latest) -->
    <script
      src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
      crossorigin="anonymous"
    ></script>

    <!-- diff_match_patch for accurate diff counting -->
    <script
      src="https://cdnjs.cloudflare.com/ajax/libs/diff-match-patch/1.0.5/index.min.js"
      crossorigin="anonymous"
    ></script>

    <!-- Utility scripts -->
    <script src="./utils/utils.js"></script>
    <script src="./utils/json_utils.js"></script>
    <script src="./utils/utils_csv.js"></script>
    <script src="./utils/utils_zip.js"></script>
    <script src="./utils/utils_branch.js"></script>
    <script src="./utils/viewport_diff.js"></script>
    <script src="./utils/large-data-handler.js"></script>

    <!-- ES Module Import Map for CodeMirror 6 - Using unpkg with exact versions -->
    <script type="importmap">
      {
        "imports": {
          "@codemirror/state": "https://unpkg.com/@codemirror/state@6.4.1/dist/index.js",
          "@codemirror/view": "https://unpkg.com/@codemirror/view@6.34.1/dist/index.js",
          "@codemirror/language": "https://unpkg.com/@codemirror/language@6.10.3/dist/index.js",
          "@codemirror/commands": "https://unpkg.com/@codemirror/commands@6.7.1/dist/index.js",
          "@codemirror/lang-json": "https://unpkg.com/@codemirror/lang-json@6.0.1/dist/index.js",
          "@codemirror/merge": "https://unpkg.com/@codemirror/merge@6.7.2/dist/index.js",
          "@codemirror/search": "https://unpkg.com/@codemirror/search@6.5.6/dist/index.js",
          "@codemirror/autocomplete": "https://unpkg.com/@codemirror/autocomplete@6.18.1/dist/index.js",
          "@codemirror/lint": "https://unpkg.com/@codemirror/lint@6.8.2/dist/index.js",
          "@codemirror/theme-one-dark": "https://unpkg.com/@codemirror/theme-one-dark@6.1.3/dist/index.js",
          "@lezer/common": "https://unpkg.com/@lezer/common@1.2.2/dist/index.js",
          "@lezer/highlight": "https://unpkg.com/@lezer/highlight@1.2.1/dist/index.js",
          "@lezer/lr": "https://unpkg.com/@lezer/lr@1.4.2/dist/index.js",
          "@lezer/json": "https://unpkg.com/@lezer/json@1.0.2/dist/index.js",
          "codemirror": "https://unpkg.com/codemirror@6.0.1/dist/index.js",
          "crelt": "https://unpkg.com/crelt@1.0.6/index.js",
          "style-mod": "https://unpkg.com/style-mod@4.1.2/src/style-mod.js",
          "w3c-keyname": "https://unpkg.com/w3c-keyname@2.2.8/index.js"
        }
      }
    </script>
```

**Key Finding:** PapaParse is NOT loaded in the HEAD. Only utility scripts and CodeMirror 6 dependencies are loaded.

---

### 2. **v6/index.html - autoSaveExtension (Lines 383-410)**

**Location:** [v6/index.html](v6/index.html#L383-L410)

```javascript
      const autoSaveExtension = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          if (_bulkLoading) return; // Skip all processing during bulk load
          invalidateContentCache();

          // Debounce saves with adaptive delay
          clearTimeout(window.autoSaveTimer);
          window.autoSaveTimer = setTimeout(() => {
            saveContent();
          }, getAdaptiveDelay(300));
          
          // Schedule batched UI updates (diff, buttons, placeholders)
          scheduleUIUpdate();
          
          // Debounce CSV button updates with longer delay for large content
          clearTimeout(window.csvButtonTimer);
          window.csvButtonTimer = setTimeout(() => {
            if (typeof updateCSVConversionButtons === 'function') {
              updateCSVConversionButtons();
            }
          }, getAdaptiveDelay(500));
        }
      });
```

**Context (Lines 367-410):** Full context showing `scheduleUIUpdate()` and adaptive delay:

```javascript
      function scheduleUIUpdate() {
        if (_uiUpdateScheduled || _bulkLoading) return;
        _uiUpdateScheduled = true;
        const delay = getAdaptiveDelay(200);
        setTimeout(() => {
          _uiUpdateScheduled = false;
          if (_bulkLoading) return;
          invalidateContentCache();
          updateDiffStatus();
          updatePaneButtonVisibility();
          updateClearButtonVisibility();
          updatePlaceholders();
        }, delay);
      }

      // Auto-save extension for CodeMirror 6
      const autoSaveExtension = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          if (_bulkLoading) return; // Skip all processing during bulk load
          invalidateContentCache();

          // Debounce saves with adaptive delay
          clearTimeout(window.autoSaveTimer);
          window.autoSaveTimer = setTimeout(() => {
            saveContent();
          }, getAdaptiveDelay(300));
          
          // Schedule batched UI updates (diff, buttons, placeholders)
          scheduleUIUpdate();
          
          // Debounce CSV button updates with longer delay for large content
          clearTimeout(window.csvButtonTimer);
          window.csvButtonTimer = setTimeout(() => {
            if (typeof updateCSVConversionButtons === 'function') {
              updateCSVConversionButtons();
            }
          }, getAdaptiveDelay(500));
        }
      });
```

---

### 3. **v6/index.html - scheduleUIUpdate Function (Lines 367-379)**

**Location:** [v6/index.html](v6/index.html#L367-L379)

```javascript
      function scheduleUIUpdate() {
        if (_uiUpdateScheduled || _bulkLoading) return;
        _uiUpdateScheduled = true;
        const delay = getAdaptiveDelay(200);
        setTimeout(() => {
          _uiUpdateScheduled = false;
          if (_bulkLoading) return;
          invalidateContentCache();
          updateDiffStatus();
          updatePaneButtonVisibility();
          updateClearButtonVisibility();
          updatePlaceholders();
        }, delay);
      }
```

---

### 4. **v6/index.html - refreshMergeViewIfNeeded Function (Lines 1096-1122)**

**Location:** [v6/index.html](v6/index.html#L1096-L1122)

```javascript
      function refreshMergeViewIfNeeded() {
        if (_bulkLoading) return; // Don't rebuild during bulk content loading
        
        const collapseUnchanged = document.getElementById('setting-collapse-unchanged')?.checked;
        const highlightChanges = document.getElementById('setting-highlight-changes')?.checked;
        
        // Only refresh if collapse unchanged is enabled
        if (collapseUnchanged) {
          const { left, right } = getContentCache();
          
          // Only refresh if both panels have content
          if (left.trim() && right.trim()) {
            const currentSettings = {
              highlightChanges: highlightChanges ?? true,
              gutter: document.getElementById('setting-gutter')?.checked ?? true,
              collapseUnchanged: collapseUnchanged,
              orientation: document.getElementById('setting-orientation')?.value || 'a-b',
              revertControls: document.getElementById('setting-revert-controls')?.value || 'none',
              scanLimit: parseInt(document.getElementById('setting-scan-limit')?.value || '500', 10),
            };
            
            recreateMergeView(currentSettings, wordWrapEnabled);
          }
        }
      }

      // Recreate merge view with new settings (extracted common logic)
```

---

### 5. **v6/index.html - recreateMergeView Function (Lines 1123-1185)**

**Location:** [v6/index.html](v6/index.html#L1123-L1185)

```javascript
      function recreateMergeView(newSettings, newWordWrap) {
        // Get current content
        const leftContent = mergeView.a.state.doc.toString();
        const rightContent = mergeView.b.state.doc.toString();
        
        // Destroy existing merge view
        const container = document.getElementById("view-container");
        container.innerHTML = '';
        
        // Recreate merge view with new settings
        mergeView = new MergeView({
          a: {
            doc: leftContent,
            extensions: [
              basicSetup, 
              json(), 
              wordWrapCompartment.of(newWordWrap ? EditorView.lineWrapping : []), 
              themeCompartment.of(getThemeExtension(currentTheme)), 
              autoSaveExtension,
              placeholder(leftPlaceholderText)
            ],
          },
          b: {
            doc: rightContent,
            extensions: [
              basicSetup, 
              json(), 
              wordWrapCompartment.of(newWordWrap ? EditorView.lineWrapping : []), 
              themeCompartment.of(getThemeExtension(currentTheme)), 
              autoSaveExtension,
              placeholder(rightPlaceholderText)
            ],
          },
          parent: container,
          orientation: newSettings.orientation,
          connect: "align",
          collapseIdentical: false,
          highlightChanges: newSettings.highlightChanges,
          gutter: newSettings.gutter,
          allowEditingOriginals: true,
          revertControls: newSettings.revertControls === "none" ? undefined : newSettings.revertControls,
          collapseUnchanged: newSettings.collapseUnchanged ? { margin: 3, minSize: 4 } : undefined,
          diffConfig: { scanLimit: newSettings.scanLimit },
        });
        
        // Re-add pane controls
        addPaneControls();
        
        // Re-setup synchronized scrolling
        setupSynchronizedScrolling();
        
        // Re-setup drag and drop handlers
        setupDragDrop();
        
        // Re-setup paste handlers
        setupPasteHandlers();
        
        updateDiffStatus();
      }

      // Placeholder functions (now handled by CodeMirror's built-in placeholder extension)
      function addPlaceholders() {
        // No longer needed - using CodeMirror placeholder extension
```

---

### 6. **v6/index.html - handleFileDrop Function (Lines 2749-2830)**

**Location:** [v6/index.html](v6/index.html#L2749-L2830)

```javascript
      async function handleFileDrop(file, side) {
        // Check if it's a snapshot file (ZIP or GZ) - handle specially
        if (isSnapshotFile(file)) {
          await handleSnapshotFileDrop(file);
          return;
        }
        
        try {
          const text = await file.text();
          const editor = side === 'left' ? mergeView.a : mergeView.b;

          const autoCSV = document.getElementById('auto-csv-conversion')?.checked;
          const autoFormat = document.getElementById('auto-format-json')?.checked;
          const autoSort = document.getElementById('auto-sort-keys')?.checked;

          let content = text;
          let isJSON = false;
          
          // JSON-first heuristic: Try parsing as JSON/Python if any auto-processing is enabled
          if (autoCSV || autoFormat || autoSort) {
            try {
              const parsed = window.parseFlexibleJSON(content);
              content = buildJSONString(parsed, { autoSort });
              isJSON = true;
            } catch (err) {
              // Not valid JSON/Python, continue to CSV check
              console.log('JSON parsing failed, checking for CSV:', err);
            }
          }
          
          // Only attempt CSV conversion if JSON parsing failed and auto CSV is enabled
          if (!isJSON && autoCSV) {
            const isCSV = window.CSVUtils && window.CSVUtils.isCSV(text);
            if (isCSV) {
              try {
                // Use LargeDataHandler for large CSV files (worker-based with progress UI)
                let jsonData;
                if (window.LargeDataHandler && text.length > 100000) {
                  jsonData = await window.LargeDataHandler.parseCSV(text, { coerceTypes: true });
                } else {
                  jsonData = await window.CSVUtils.csvToJSONAsync(text, { coerceTypes: true });
                }
                content = buildJSONString(jsonData, { autoSort });
                showConversionMessage("CSV converted to JSON");
              } catch (err) {
                showErrorMessage("CSV conversion failed: " + err.message);
              }
            }
          }

          // Performance: Suppress cascading operations during large content insertion
          const isLargeContent = content.length > 100000;
          if (isLargeContent) {
            _bulkLoading = true;
            updateStatus('Loading large content...');
          }

          editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: content }
          });

          if (isLargeContent) {
            // Re-enable after a delay to let the editor settle
            setTimeout(() => {
              _bulkLoading = false;
              invalidateContentCache();
              checkContentSizeAndSuggest();
              scheduleUIUpdate();
            }, getAdaptiveDelay(500));
          } else {
            // For small content, schedule a light UI update
            invalidateContentCache();
            scheduleUIUpdate();
          }
        } catch (err) {
          _bulkLoading = false;
          showErrorMessage("Failed to read file: " + err.message);
        }
      }

      // Setup paste handlers
      function setupPasteHandlers() {
```

---

### 7. **v6/index.html - handlePaste Function (Lines 2835-2920)**

**Location:** [v6/index.html](v6/index.html#L2835-L2920)

```javascript
      async function handlePaste(e, side) {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const text = clipboardData.getData('text');
        if (!text) return;

        const autoCSV = document.getElementById('auto-csv-conversion')?.checked;
        const autoFormat = document.getElementById('auto-format-json')?.checked;
        const autoSort = document.getElementById('auto-sort-keys')?.checked;

        let content = text;
        let isJSON = false;

        // Resolve the target editor and current selection for this side
        const editor = side === 'left' ? mergeView.a : mergeView.b;
        const mainSelection = editor.state.selection?.main;
        const from = mainSelection ? mainSelection.from : 0;
        const to = mainSelection ? mainSelection.to : editor.state.doc.length;
        
        // JSON-first heuristic: Try parsing as JSON/Python if any auto-processing is enabled
        if (autoCSV || autoFormat || autoSort) {
          try {
            const parsed = window.parseFlexibleJSON(content);
            content = buildJSONString(parsed, { autoSort });
            isJSON = true;
          } catch (err) {
            // Not valid JSON/Python, continue to CSV check
            console.log('JSON parsing failed, checking for CSV:', err);
          }
        }

        // Helper to dispatch content and schedule deferred UI updates
        function dispatchAndScheduleUpdate(contentToInsert, statusMsg) {
          const isLarge = contentToInsert.length > 100000;
          if (isLarge) _bulkLoading = true;

          editor.dispatch({
            changes: { from, to, insert: contentToInsert }
          });

          if (statusMsg) showConversionMessage(statusMsg);

          if (isLarge) {
            setTimeout(() => {
              _bulkLoading = false;
              invalidateContentCache();
              checkContentSizeAndSuggest();
              scheduleUIUpdate();
            }, getAdaptiveDelay(500));
          } else {
            invalidateContentCache();
            scheduleUIUpdate();
          }
        }
        
        // Only attempt CSV conversion if JSON parsing failed and auto CSV is enabled
        if (!isJSON && autoCSV) {
          const isCSV = window.CSVUtils && window.CSVUtils.isCSV(text);
          if (isCSV) {
            e.preventDefault();
            e.stopPropagation();

            try {
              // Use LargeDataHandler for large CSV (worker-based with progress UI)
              let jsonData;
              if (window.LargeDataHandler && text.length > 100000) {
                jsonData = await window.LargeDataHandler.parseCSV(text, { coerceTypes: true });
              } else {
                jsonData = await window.CSVUtils.csvToJSONAsync(text, { coerceTypes: true });
              }
              content = buildJSONString(jsonData, { autoSort });
              dispatchAndScheduleUpdate(content, "CSV converted to JSON");
            } catch (err) {
              _bulkLoading = false;
              showErrorMessage("CSV conversion failed: " + err.message);
            }
            return;
          }
        }
        
        // If JSON was parsed or formatting requested, insert the formatted content
        if (isJSON && (autoFormat || autoSort || autoCSV)) {
          e.preventDefault();
          e.stopPropagation();
          dispatchAndScheduleUpdate(content);
        }
      }

      // Show conversion message
      function showConversionMessage(message) {
        updateStatus(message);
      }

      // Show error message
      function showErrorMessage(message) {
        const errorArea = document.getElementById('conversion-error-area');
        if (errorArea) {
          errorArea.textContent = message;
          errorArea.style.display = 'block';
          setTimeout(() => {
```

---

### 8. **v6/index.html - updateDiffStatus Function (Lines 3044-3110)**

**Location:** [v6/index.html](v6/index.html#L3044-L3110)

```javascript
      function updateDiffStatus() {
        const { left, right } = getContentCache();
        const leftContent = left.trim();
        const rightContent = right.trim();
        const summaryDiv = document.getElementById("diff-summary");
        
        if (!leftContent || !rightContent) {
          if (summaryDiv) summaryDiv.textContent = "Add content to both panels to compare";
          return;
        }

        if (leftContent === rightContent) {
          if (summaryDiv) summaryDiv.textContent = "No differences found";
          return;
        }
        
        // If viewport diff mode is enabled, use that instead
        if (viewportDiffManager?.enabled) {
          const result = viewportDiffManager.calculateViewportDiff();
          if (result) {
            const statusMsg = viewportDiffManager.getDiffStatusMessage();
            if (summaryDiv) summaryDiv.textContent = statusMsg || "Calculating...";
            return;
          }
        }
        
        // Check if we should use web worker for large content
        const totalSize = leftContent.length + rightContent.length;
        const useLargeFileThreshold = 50000; // 50KB - offload to worker earlier
        
        // For extremely large content (>5MB), skip detailed diff count entirely
        if (totalSize > 5000000) {
          if (summaryDiv) summaryDiv.textContent = "Large content - differences detected (diff count skipped for performance)";
          return;
        }
        
        // Try LargeDataHandler worker first (has its own robust worker pool)
        if (totalSize > useLargeFileThreshold && window.LargeDataHandler) {
          if (summaryDiv) summaryDiv.textContent = "Calculating diff...";
          window.LargeDataHandler.countDiffs(leftContent, rightContent).then(result => {
            if (result && summaryDiv) {
              const diffCount = result.diffCount;
              const duration = Math.round(result.duration || 0);
              summaryDiv.textContent = `Found ${diffCount} difference${diffCount !== 1 ? 's' : ''}${duration ? ` (${duration}ms)` : ''}`;
            }
          }).catch(() => {
            if (summaryDiv) summaryDiv.textContent = "Differences detected";
          });
          return;
        }
        
        if (totalSize > useLargeFileThreshold && diffWorker) {
          // Use web worker for large content
          if (summaryDiv) summaryDiv.textContent = "Calculating diff...";
          
          const requestId = Date.now().toString();
          
          const handler = function(e) {
            if (e.data.id === requestId) {
              diffWorker.removeEventListener('message', handler);
              
              if (e.data.ok && e.data.result) {
                const diffCount = e.data.result.diffCount;
                const duration = Math.round(e.data.result.duration);
                if (summaryDiv) {
                  summaryDiv.textContent = `Found ${diffCount} difference${diffCount !== 1 ? 's' : ''} (${duration}ms)`;
```

---

### 9. **v6/index.html - buildJSONString Function (Lines 2375-2410)**

**Location:** [v6/index.html](v6/index.html#L2375-L2410)

```javascript
      function buildJSONString(data, options = {}) {
        let content = data;
        if (options.autoSort && typeof window.sortJSONKeys === 'function') {
          try {
            content = window.sortJSONKeys(content);
          } catch (err) {
            console.warn('Auto sort failed:', err);
          }
        }
        // For very large arrays, use reduced indentation to limit output size
        if (Array.isArray(content) && content.length > 5000) {
          return JSON.stringify(content, null, 2); // 2-space indent for large arrays
        }
        return JSON.stringify(content, null, 3);
      }

      // Share URL functionality
      async function shareURL() {
        const leftContent = mergeView.a.state.doc.toString();
        const rightContent = mergeView.b.state.doc.toString();

        if (!leftContent.trim() && !rightContent.trim()) {
          updateStatus("No content to share");
          return;
        }

        const btn = document.getElementById("btn-share");
        const originalText = btn.textContent;
        btn.textContent = '⏳ Processing...';
        btn.disabled = true;

        try {
          // Get all current settings
          const currentSettings = SettingsManager.loadAll();
          
          // Try to create compressed URL with settings
```

---

### 10. **v6/index.html - checkContentSizeAndSuggest Function (Lines 901-970)**

**Location:** [v6/index.html](v6/index.html#L901-L970)

```javascript
      function checkContentSizeAndSuggest() {
        if (!largeFileDetector || !mergeView) return;
        
        const { left: leftContent, right: rightContent } = getContentCache();
        
        const analysis = largeFileDetector.analyze(leftContent, rightContent);
        
        if (analysis.isCritical) {
          PerformanceToast.show(
            `Large content detected (${analysis.formattedSize}). Performance Mode strongly recommended.`,
            'critical',
            6000
          );
          
          // Auto-enable performance mode for critical sizes
          const perfCheckbox = document.getElementById('setting-performance-mode');
          if (perfCheckbox && !perfCheckbox.checked) {
            perfCheckbox.checked = true;
            applyPerformanceMode();
          }
        } else if (analysis.isWarning) {
          PerformanceToast.show(
            `Content size: ${analysis.formattedSize}. Consider enabling Performance Mode.`,
            'warning',
            5000
          );
        } else if (analysis.isLarge) {
          // Auto-enable viewport diff for large files
          const viewportCheckbox = document.getElementById('setting-viewport-diff');
          if (viewportCheckbox && !viewportCheckbox.checked && !SettingsManager.get('performanceMode')) {
            viewportCheckbox.checked = true;
            applyViewportDiffMode();
          }
        }
      }

      // Initialize quick header toggles
      function initializeQuickToggles() {
        const quickCollapse = document.getElementById('quick-collapse-unchanged');
        const quickHighlight = document.getElementById('quick-highlight-changes');
        if (quickCollapse) {
          quickCollapse.addEventListener('change', (e) => {
            const val = e.target.checked;
            const setting = document.getElementById('setting-collapse-unchanged');
            if (setting) setting.checked = val;
            applyMergeSettings();
          });
        }
        if (quickHighlight) {
          quickHighlight.addEventListener('change', (e) => {
            const val = e.target.checked;
            const setting = document.getElementById('setting-highlight-changes');
            if (setting) setting.checked = val;
            applyMergeSettings();
          });
        }
      }

      // Initialize Extra Settings dropdown (Share, Import, Examples, Theme)
      function initializeExtraSettingsPanel() {
        const btn = document.getElementById('btn-extra-settings');
        const panel = document.getElementById('extra-settings-panel');
        if (!btn || !panel) return;

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'block' : 'none';
        });
        document.addEventListener('click', (e) => {
          if (!panel.contains(e.target) && e.target !== btn) {
```

---

### 11. **v6/utils/utils_csv.js - ENTIRE FILE (All 500+ lines)**

**Location:** [v6/utils/utils_csv.js](v6/utils/utils_csv.js)

```javascript
// CSV utilities
(function () {
  const CSVUtils = {
    // Heuristic to detect CSV-like text
    isCSV: function (text) {
      if (!text || typeof text !== 'string') return false;
      const lines = text.trim().split(/\r\n|\r|\n/);
      if (lines.length === 0) return false;
      const first = lines[0];
      const sepMatch = first.match(/[,;\t]/);
      if (!sepMatch) return false;
      return lines.length > 1 || /[,;\t].+/.test(first);
    },

    // Convert CSV text to JSON array of objects. Tries to be forgiving with separators and quotes.
    csvToJSON: function (csvText, options) {
      options = options || {};
      if (!csvText || !csvText.trim()) return [];

      const text = csvText.replace(/\r\n|\r/g, "\n").trim();
      const firstLine = text.split("\n")[0] || "";
      let sep = ",";
      if (firstLine.indexOf("\t") > -1) sep = "\t";
      else if (firstLine.indexOf(";") > -1) sep = ";";

      const rows = [];
      let cur = "";
      let inQuotes = false;
      let row = [];

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = i + 1 < text.length ? text[i + 1] : null;

        if (ch === '"') {
          if (inQuotes && next === '"') { cur += '"'; i++; continue; }
          inQuotes = !inQuotes; continue;
        }

        if (!inQuotes && ch === sep) { row.push(cur); cur = ""; continue; }
        if (!inQuotes && ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; continue; }
        cur += ch;
      }

      if (cur !== "" || inQuotes || row.length > 0) { row.push(cur); rows.push(row); }
      if (rows.length === 0) return [];

      const headers = rows[0].map((h) => h.trim());
      const data = [];
      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        if (cells.length === 1 && cells[0].trim() === "") continue;
        const obj = {};
        for (let c = 0; c < headers.length; c++) {
          const key = headers[c] || `col${c}`;
          const raw = c < cells.length ? cells[c] : "";
          const val = (raw === undefined || raw === null) ? '' : String(raw).trim();
          
          // Try to parse value with type coercion and nested JSON restoration
          if (options.coerceTypes) {
            if (/^-?\d+$/.test(val)) {
              obj[key] = parseInt(val, 10);
            } else if (/^-?\d*\.\d+$/.test(val)) {
              obj[key] = parseFloat(val);
            } else if (/^(true|false)$/i.test(val)) {
              obj[key] = /^true$/i.test(val);
            } else if (val === "") {
              obj[key] = null;
            } else {
              // Try to parse as JSON (for nested objects/arrays)
              obj[key] = tryParseNestedJSON(val);
            }
          } else {
            // Still try to restore nested JSON even without coerceTypes
            obj[key] = tryParseNestedJSON(val);
          }
        }
        data.push(obj);
      }

      return data;
      
      // Helper to parse nested JSON strings back to objects/arrays
      function tryParseNestedJSON(val) {
        if (typeof val !== 'string') return val;
        const trimmed = val.trim();
        // Check if it looks like JSON object or array
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            return JSON.parse(trimmed);
          } catch (e) {
            // Not valid JSON, return as string
            return val;
          }
        }
        return val;
      }
    },

    // Convert JSON (array of objects or array of arrays) to CSV string
    jsonToCSV: function (input) {
      let data = input;
      if (typeof input === 'string') {
        try { data = JSON.parse(input); } catch (e) { throw new Error('Invalid JSON provided for JSON→CSV conversion'); }
      }
      if (!Array.isArray(data)) throw new Error('JSON→CSV expects an array (of objects or arrays)');
      if (data.length === 0) return '';

      if (Array.isArray(data[0]) && data.every(Array.isArray)) {
        return data.map(row => row.map(escape).join(',')).join('\n');
      }

      const keys = Array.from(data.reduce((acc, item) => { if (item && typeof item === 'object' && !Array.isArray(item)) { Object.keys(item).forEach(k => acc.add(k)); } return acc; }, new Set()));
      if (keys.length === 0) { return ['value'].concat(data.map(d => escapeValue(d))).join('\n'); }

      const header = keys.join(',');
      const rows = data.map(item => keys.map(k => { const v = (item && Object.prototype.hasOwnProperty.call(item, k)) ? item[k] : ''; return escapeValue(v); }).join(','));
      return [header].concat(rows).join('\n');

      function escapeValue(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return escape(JSON.stringify(v));
        return escape(String(v));
      }
      function escape(str) {
        if (str.indexOf('"') !== -1) str = str.replace(/"/g, '""');
        if (/[",\n]/.test(str)) return '"' + str + '"';
        return str;
      }
    }
  };
  // Check if JSON content is convertible to CSV (array of objects or arrays)
  CSVUtils.isConvertibleToCSV = function(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    // Quick check: must start with [ for array
    if (!trimmed.startsWith('[')) return false;
    
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed) || parsed.length === 0) return false;
      
      // Check first element - must be object or array
      const first = parsed[0];
      if (Array.isArray(first)) return true; // Array of arrays
      if (first && typeof first === 'object' && first !== null) return true; // Array of objects
      
      return false;
    } catch (e) {
      return false;
    }
  };

  // Download helper for exporting files
  CSVUtils.downloadFile = function(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  window.CSVUtils = CSVUtils;
  // Async adapter: use PapaParse for large inputs when available (returns a Promise)
  CSVUtils.csvToJSONAsync = function(csvText, options) {
    options = options || {};
    if (!csvText || !csvText.trim()) return Promise.resolve([]);

    // If Papa is available and input is large, use it with worker:true
    const size = csvText.length;
    const USE_PAPA_THRESHOLD = 50 * 1024; // 50KB - use PapaParse worker earlier for better responsiveness
    if (window.Papa && size > USE_PAPA_THRESHOLD) {
      return new Promise((resolve, reject) => {
        try {
          Papa.parse(csvText, {
            header: true,
            worker: true,
            dynamicTyping: !!options.coerceTypes,
            skipEmptyLines: true,
            complete: function(results) { resolve(results.data || []); },
            error: function(err) { reject(err); }
          });
        } catch (e) { reject(e); }
      });
    }

    // Small payloads: run existing synchronous parser on next tick to avoid blocking UI
    return Promise.resolve().then(() => CSVUtils.csvToJSON(csvText, options));
  };
})();
```

**Key Finding:** `csvToJSONAsync` only attempts to use `window.Papa` (PapaParse) if it exists AND content is >50KB. Falls back to synchronous CSV parser otherwise.

---

### 12. **v6/utils/large-data-handler.js - Lines 1-100**

**Location:** [v6/utils/large-data-handler.js](v6/utils/large-data-handler.js#L1-L100)

```javascript
/**
 * Large Data Handler - Robust handling for datasets of any size
 * 
 * Provides:
 * - Web Worker offloading for heavy processing
 * - Chunked processing to prevent UI freeze
 * - Streaming JSON parsing for very large files
 * - Progress tracking and cancellation
 * - Memory-efficient operations
 * 
 * Design Goals:
 * - Never freeze the UI, even with 200MB+ files
 * - Graceful degradation when Workers unavailable
 * - Real-time progress feedback
 * - Cancellable operations
 */
(function () {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    // Size thresholds (bytes)
    CHUNK_SIZE: 64 * 1024,           // 64KB chunks for processing
    WORKER_THRESHOLD: 50 * 1024,      // 50KB - use worker above this
    STREAMING_THRESHOLD: 5 * 1024 * 1024, // 5MB - use streaming parser
    CRITICAL_THRESHOLD: 50 * 1024 * 1024, // 50MB - extra caution
    EXTREME_THRESHOLD: 200 * 1024 * 1024, // 200MB - maximum optimizations
    
    // Processing limits
    MAX_SYNC_PARSE_SIZE: 1 * 1024 * 1024, // 1MB max for sync JSON.parse
    YIELD_INTERVAL_MS: 16,            // Yield to UI every 16ms (~60fps)
    PROGRESS_UPDATE_INTERVAL: 100,    // Update progress every 100ms
    
    // Worker pool
    MAX_WORKERS: navigator.hardwareConcurrency || 4,
    WORKER_TIMEOUT_MS: 60000,         // 1 minute timeout
  };

  // ============================================
  // Progress Manager - Real-time progress UI
  // ============================================
  class ProgressManager {
    constructor() {
      this.activeOperations = new Map();
      this.progressElement = null;
      this._createProgressUI();
    }

    _createProgressUI() {
      // Check if element already exists
      if (document.getElementById('large-data-progress')) {
        this.progressElement = document.getElementById('large-data-progress');
        return;
      }

      const container = document.createElement('div');
      container.id = 'large-data-progress';
      container.className = 'large-data-progress-container';
      container.innerHTML = `
        <div class="progress-backdrop"></div>
        <div class="progress-modal">
          <div class="progress-header">
            <span class="progress-title">Processing Large Data</span>
            <button class="progress-cancel" title="Cancel">✕</button>
          </div>
          <div class="progress-body">
            <div class="progress-status">Initializing...</div>
            <div class="progress-bar-container">
              <div class="progress-bar"></div>
            </div>
            <div class="progress-details">
              <span class="progress-percentage">0%</span>
              <span class="progress-size"></span>
            </div>
          </div>
          <div class="progress-tips">
            <span class="tip-icon">💡</span>
            <span class="tip-text">Large files are processed in background to keep the app responsive.</span>
          </div>
        </div>
      `;

      // Add styles
      if (!document.getElementById('large-data-progress-styles')) {
        const styles = document.createElement('style');
        styles.id = 'large-data-progress-styles';
        styles.textContent = `
          .large-data-progress-container {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .large-data-progress-container.visible {
```

**Key Finding:** Large Data Handler provides worker-based processing with progress tracking at 50KB+ threshold.

---

### 13. **csvToJSONAsync & csvToJSON Usage in v6/index.html**

**Locations found:**

| Line | Usage | Context |
|------|-------|---------|
| 1262 | `const jsonData = await window.CSVUtils.csvToJSONAsync(text, { coerceTypes: true });` | Inside CSV conversion branch during paste |
| 1903 | `const jsonData = await window.CSVUtils.csvToJSONAsync(text, { coerceTypes: true });` | Inside CSV conversion during format button |
| 2049 | `const jsonData = window.CSVUtils.csvToJSON(content, { coerceTypes: true });` | Sync version used somewhere |
| 2789 | `jsonData = await window.CSVUtils.csvToJSONAsync(text, { coerceTypes: true });` | File drop handler |
| 2904 | `jsonData = await window.CSVUtils.csvToJSONAsync(text, { coerceTypes: true });` | Paste handler |

**All async calls follow the same pattern:**
1. Check size threshold first
2. If > 100KB and `LargeDataHandler` available: use `window.LargeDataHandler.parseCSV()`
3. Otherwise: use `window.CSVUtils.csvToJSONAsync()` (which internally checks Papa at 50KB+)
4. Either way wrapped in `buildJSONString()` for final formatting

---

### 14. **parseFlexibleJSON Usage in v6/index.html**

**Locations found:**

| Line | Usage | Context |
|------|-------|---------|
| 1245 | `let parsed = window.parseFlexibleJSON(content);` | Branch switching |
| 2293 | `const leftParsed = window.parseFlexibleJSON(leftContent);` | Diff calculation |
| 2294 | `const rightParsed = window.parseFlexibleJSON(rightContent);` | Diff calculation |
| 2338 | `const leftParsed = window.parseFlexibleJSON(leftContent);` | Sort operation |
| 2339 | `const rightParsed = window.parseFlexibleJSON(rightContent);` | Sort operation |
| 2770 | `const parsed = window.parseFlexibleJSON(content);` | File drop JSON-first heuristic |
| 2858 | `const parsed = window.parseFlexibleJSON(content);` | Paste handler JSON-first heuristic |

**Pattern:** Always wrapped in try-catch that falls back to CSV if JSON parsing fails.

---

### 15. **v6/index.html - _bulkLoading Usage Pattern (Lines 353-2911)**

**Location:** Multiple occurrences throughout v6/index.html

**Summary of _bulkLoading usage:**

| Line | Usage | Scope |
|------|-------|-------|
| 353 | `let _bulkLoading = false;` | **Declaration** |
| 368 | `if (_uiUpdateScheduled \|\| _bulkLoading) return;` | Guard in `scheduleUIUpdate()` |
| 373 | `if (_bulkLoading) return;` | Guard before `updateDiffStatus()` |
| 385 | `if (_bulkLoading) return; // Skip all processing during bulk load` | Guard in `autoSaveExtension` |
| 1097 | `if (_bulkLoading) return; // Don't rebuild during bulk content loading` | Guard in `refreshMergeViewIfNeeded()` |
| 1881 | `if (_bulkLoading) return; // Skip during bulk loading` | Guard somewhere |
| **1907** | `if (isLarge) _bulkLoading = true;` | **SET true during paste (large content)** |
| **1917** | `_bulkLoading = false;` | **SET false after paste completes** |
| 1927 | `_bulkLoading = false;` | SET false on error |
| **2300** | `if (isLarge) _bulkLoading = true;` | **SET true during branch/switch** |
| 2313 | `_bulkLoading = false;` | SET false |
| 2322 | `_bulkLoading = false;` | SET false |
| **2348** | `if (isLarge) _bulkLoading = true;` | **SET true during sort** |
| 2361 | `_bulkLoading = false;` | SET false |
| 2370 | `_bulkLoading = false;` | SET false |
| **2802** | `_bulkLoading = true;` | **SET true during file drop** |
| 2813 | `_bulkLoading = false;` | SET false |
| 2824 | `_bulkLoading = false;` | SET false |
| **2870** | `if (isLarge) _bulkLoading = true;` | **SET true during paste** |
| 2880 | `_bulkLoading = false;` | SET false |
| 2909 | `_bulkLoading = false;` | SET false |

**Pattern:** 
- `_bulkLoading` is a **global flag** set to `true` when large content (>100KB) is being inserted
- During bulk loading, expensive operations skip:
  - `scheduleUIUpdate()` exits early
  - `autoSaveExtension` skips processing
  - `refreshMergeViewIfNeeded()` skips rebuilding
  - Diff status updates are deferred
- After content settles (500ms delay), flag is set back to `false`
- This prevents cascading, expensive operations from blocking the UI

---

## KEY FINDINGS SUMMARY

1. **PapaParse is NOT loaded in HEAD** - Only loaded on-demand via CDN if needed

2. **CSV Processing Priority Chain:**
   - JSON-first heuristic (try `parseFlexibleJSON()` first)
   - If JSON fails: Try `CSVUtils.isCSV()` detection
   - If CSV detected AND >100KB: Use `LargeDataHandler.parseCSV()`
   - If CSV detected AND ≤100KB: Use `CSVUtils.csvToJSONAsync()`
   - The async version internally checks for Papa at 50KB+ threshold

3. **Performance Pattern: _bulkLoading Flag**
   - Global flag suppresses cascading updates during large content insertion
   - Sets to `true` when content >100KB is pasted/dropped/switched
   - Disables: diff recalculation, button updates, MergeView rebuilds
   - Re-enables after 500ms with adaptive delay

4. **Three-tier Diff Calculation:**
   - Files <50KB: Sync diff-match-patch
   - Files 50KB-5MB: Web Worker diff counting
   - Files >5MB: Skip detail count, show generic "differences detected"

5. **Large Data Handler Integration:**
   - Provides worker pool with progress UI
   - Used for CSV parsing >100KB AND diff counting >50KB
   - Has own robust error recovery vs fallback to sync versions