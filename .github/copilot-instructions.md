# JSON Compare Tool - AI Agent Guidelines

## Architecture Overview
This is a **client-side-only** web application for JSON comparison and formatting. No build process exists - all functionality runs directly in the browser using static HTML/CSS/JavaScript files.

**Core Components:**
- `index.html` - Main application with embedded initialization logic
- `utils.js` - URL parameter management, local storage, default templates
- `json_utils.js` - Flexible JSON parser supporting Python literals, datetime objects, complex numbers
- `utils_csv.js` - CSV auto-detection and conversion to JSON
- `js/button-events.js` - File upload and UI interaction handlers

**Key Libraries:**
- CodeMirror (text editing with merge view)
- diff_match_patch (difference calculation)
- Pako (gzip compression for URL sharing)

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
- `js/` holds third-party libraries (CodeMirror, diff_match_patch)
- `css/` contains stylesheets (app-specific + CodeMirror themes)
- Root level has active application files

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
