# JSON Compare Tool - AI Agent Guidelines

## Architecture Overview
This is a **client-side-only** web application for JSON comparison and formatting. No build process exists - all functionality runs directly in the browser using static HTML/CSS/JavaScript files.

**Core Components:**
- `index.html` - Main application with embedded initialization logic
- `utils.js` - URL parameter management, local storage, default templates
- `json_utils.js` - Flexible JSON parser supporting Python literals, datetime objects, complex numbers
- `utils_csv.js` - CSV auto-detection and conversion to JSON
- `js/button-events.js` - File upload and UI interaction handlers

**Key Libraries (Updated October 2025):**
- CodeMirror 5.65.20 (latest stable v5) - text editing with merge view
- diff_match_patch (latest) - difference calculation
- Pako 2.1.0 - gzip compression for URL sharing
- PapaParse 5.4.1 - CSV parsing
- Oboe.js 2.1.5 - streaming JSON parser

**CSS Architecture:**
- `css/merge.css` - Base CodeMirror merge styles (from CDN, updated with library)
- `css/merge-custom.css` - Custom overrides (red/green diff colors, preserved across updates)
- IMPORTANT: Always load `merge-custom.css` AFTER `merge.css` in HTML

## Development Workflow
**Local Development:**
```bash
# Simple HTTP server for local testing
python3 -m http.server 8000
# Then open http://localhost:8000/index.html
```

**No Build Tools:** Edit HTML/JS/CSS files directly. Changes are immediately testable by refreshing the browser.

**Deployment:** Automatic via GitHub Pages Actions on push to main branch.

## Code Patterns & Conventions

### Modular Utility Functions
Wrap utilities in IIFEs that expose functions globally:
```javascript
(function() {
  window.MyUtility = {
    method: function() { /* ... */ }
  };
})();
```

### Flexible JSON Parsing
Use `parseFlexibleJSON()` from `json_utils.js` for robust parsing that handles:
- Python dict/list syntax: `{'key': 'value'}` → `{"key": "value"}`
- Python literals: `True/False/None` → `true/false/null`
- Complex numbers: `(1+2j)` → `{"real": 1, "imag": "2"}`
- Datetime objects: `datetime.datetime(2023, 1, 1)` → ISO string

### URL Sharing with Compression
Use `URLManager` from `utils.js` for shareable links:
- Compresses content with base64 + URL encoding
- Stores left/right editor content in URL parameters
- Falls back gracefully on compression errors

### Storage Management
Use `StorageManager` for local persistence:
- Saves editor content automatically
- Loads on page refresh if no URL parameters
- Handles storage quota errors gracefully

### CSV Integration
CSV files dragged onto editors are auto-converted using `CSVUtils.csvToJSON()`:
- Auto-detects separators (comma/tab/semicolon)
- Handles quoted fields and escaped quotes
- Type coercion for numbers/booleans
- Shows conversion errors in UI without breaking comparison

### CodeMirror Integration
Initialize merge views with specific options:
```javascript
CodeMirror.MergeView(target, {
  connect: "align",           // Connect identical lines
  revertButtons: true,        // Allow reverting changes
  allowEditingOriginals: true, // Enable editing both sides
  highlightDifferences: true, // Show diff highlighting
  chunkClassLocation: ["background", "wrap", "gutter"]
});
```

### UI State Management
- Scroll synchronization toggles via button clicks
- "Show only differences" mode via CSS classes
- Dynamic button creation for enhanced features
- Error display in bottom-fixed div

## File Organization
- `src/` contains alternative implementations and experiments
- `js/` holds third-party libraries (CodeMirror, diff_match_patch, etc.)
- `css/` contains stylesheets:
  - `app.css` - Application-specific styles
  - `codemirror.css` - Base CodeMirror styles (from CDN)
  - `merge.css` - Base merge view styles (from CDN, can be safely updated)
  - `merge-custom.css` - Custom overrides (preserved across library updates)
  - `ccsiteV6.css` - Site-wide styles
- `docs/` contains documentation and update logs
- Root level has active application files

## Library Update Guidelines
- Base library files (codemirror.js, merge.css, etc.) can be updated from CDN
- Custom styles MUST be kept in separate files (e.g., merge-custom.css)
- Always create backups before updating libraries (`.backup` extension)
- Document all version changes in `docs/LIBRARY_UPDATES_*.md`
- Test all features after updates (see testing checklist in docs)

## Testing Approach
- Manual testing by opening `index.html` in browser
- Test edge cases: malformed JSON, large files, special characters
- Verify CSV conversion with various formats
- Check URL sharing and local storage persistence
- Test responsive design and fullscreen mode

## Common Patterns to Follow
1. **Error Handling:** Wrap parsing operations in try-catch, show user-friendly messages
2. **Progressive Enhancement:** Features should degrade gracefully (e.g., compression fallbacks)
3. **Performance:** Handle large JSON files efficiently, avoid blocking operations
4. **Accessibility:** Maintain keyboard navigation and screen reader compatibility
5. **Cross-browser:** Test in multiple browsers, use feature detection where needed</content>
<parameter name="filePath">/Users/dipen/projects/json_compair/.github/copilot-instructions.md

--

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