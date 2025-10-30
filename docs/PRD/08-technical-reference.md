# Technical Reference and API Documentation

## Application Programming Interface (API)

### Global Objects and Methods

#### Window-Level Utilities
The following objects are exposed globally on the `window` object for integration and testing purposes:

```javascript
// URL Management
window.URLManager = {
  compress(str),
  decompress(str),
  saveToURL(leftContent, rightContent),
  loadFromURL(),
  generateShareableURL(leftContent, rightContent),
  clearURL()
}

// Storage Management
window.StorageManager = {
  saveToStorage(leftContent, rightContent),
  loadFromStorage(),
  saveToIndexedDB(leftContent, rightContent),
  loadFromIndexedDB()
}

// Settings Management
window.SettingsManager = {
  loadAll(),
  saveAll(obj),
  get(key),
  set(key, value)
}

// JSON Processing
window.parseFlexibleJSON(text)

// JSON Utilities
window.sortJSONKeys(obj)
window.sortJSONArray(arr)

// Template Management
window.DefaultTemplates = {
  simple: { left: string, right: string },
  complex: { left: string, right: string }
}

// CSV Processing
window.CSVUtils = {
  isCSV(text),
  csvToJSON(csvText, options),
  csvToJSONAsync(csvText, options),
  jsonToCSV(input)
}

// Large Data Processing
window.LargeDataHelpers = {
  runHeavyTask(action, payload, fallback),
  WORKER_SIZE_THRESHOLD: 157286400 // 150KB
}
```

### Core Application Initialization

#### CodeMirror Configuration
```javascript
const mergeViewConfig = {
  value: initialContent.left,
  origLeft: null,
  orig: initialContent.right,
  lineNumbers: true,
  mode: "application/json",
  showDifferences: true,
  connect: "align",
  collapseIdentical: false,
  revertButtons: true,
  allowEditingOriginals: true,
  highlightDifferences: true,
  lineWrapping: false,               // Updated default in v5.65.20
  styleActiveLine: true,
  chunkClassLocation: ["background", "wrap", "gutter"]
}

// CodeMirror v5.65.20 (Latest stable v5, October 2025)
// Preserved backward compatibility with all existing features
```

#### Event Handlers
```javascript
// Scroll synchronization
leftEditor.on("scroll", () => syncScroll(leftEditor, rightEditor));
rightEditor.on("scroll", () => syncScroll(rightEditor, leftEditor));

// Content change detection
leftEditor.on("change", () => updateDiffStatus(mv));
rightEditor.on("change", () => updateDiffStatus(mv));

// File drop handling
leftEditor.on("drop", (editor, event) => handleFileDrop(event, leftEditor));
rightEditor.on("drop", (editor, event) => handleFileDrop(event, rightEditor));
```

## Data Structures and Formats

### Internal Data Representations

#### Content Storage Format
```javascript
// localStorage/IndexedDB storage format
{
  left: string,     // Left panel content
  right: string,    // Right panel content
  timestamp: number // Unix timestamp in milliseconds
}
```

#### Settings Storage Format
```javascript
// User settings format
{
  autoCsv: boolean,           // Auto CSV conversion
  autoSortOnPaste: boolean,   // Auto sort on paste
  showOnlyDiffs: boolean      // Show only differences mode
}
```

#### URL Parameter Format
```javascript
// URL parameter structure
?left=<base64-encoded-content>&right=<base64-encoded-content>
```

#### Snapshot File Format
```javascript
// .json.gz snapshot file content (before compression)
{
  left: string,   // Left panel JSON content
  right: string   // Right panel JSON content
}
```

### JSON Processing Data Types

#### Flexible JSON Parser Support Matrix
```javascript
// Supported Python-style data types and their conversions
{
  // Literals
  "True": true,
  "False": false,
  "None": null,
  
  // Quotes
  "{'key': 'value'}": '{"key": "value"}',
  
  // Collections
  "{1, 2, 3}": "[1, 2, 3]",           // Sets to arrays
  "(1, 2, 3)": "[1, 2, 3]",           // Tuples to arrays
  
  // Complex numbers
  "(1+2j)": '{"real": 1, "imag": "2"}',
  "5j": '{"real": 0, "imag": "5"}',
  
  // Datetime objects
  "datetime.datetime(2025, 1, 1, 12, 0, 0)": '"2025-01-01T12:00:00.000000"',
  "datetime.date(2025, 1, 1)": '"2025-01-01"',
  
  // Decimal objects
  'Decimal("123.45")': '"123.45"',
  
  // String literals
  'b"bytes"': '"bytes"',
  'r"raw"': '"raw"',
  'u"unicode"': '"unicode"',
  'f"format"': '"format"',
  
  // Object representations
  "<User #123>": '{"type": "User", "id": "#123"}'
}
```

## Error Handling and Validation

### Error Types and Handling

#### JSON Parsing Errors
```javascript
// Error handling for parseFlexibleJSON
try {
  const result = parseFlexibleJSON(userInput);
} catch (error) {
  // Error message format:
  // "Unable to parse input as JSON or Python data structure. 
  //  Processed: "<first-200-chars>...". 
  //  Error: <original-error-message>"
}
```

#### File Processing Errors
```javascript
// File upload error handling
reader.onerror = (event) => {
  alert(event.target.error.name);
  // Common errors: NotReadableError, SecurityError, NotFoundError
};
```

#### Storage Errors
```javascript
// localStorage quota exceeded handling
try {
  localStorage.setItem(key, value);
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Automatic fallback to IndexedDB
    StorageManager.saveToIndexedDB(leftContent, rightContent);
  }
}
```

#### CSV Processing Errors
```javascript
// CSV conversion error handling
try {
  const jsonData = CSVUtils.csvToJSON(csvText, options);
} catch (error) {
  // Display error in conversion-error-area div
  displayConversionError(error.message);
}
```

## Performance Optimization

### Web Worker Integration

#### Worker Task Structure
```javascript
// Message format for large-data-worker.js
{
  id: string,           // Unique task identifier
  action: string,       // Task type: 'sortAndStringify', 'parseJSON', etc.
  payload: {
    text: string,       // Content to process
    options?: object    // Optional configuration
  }
}

// Worker response format
{
  id: string,           // Matching task identifier
  ok: boolean,          // Success status
  result?: any,         // Processed result
  error?: string        // Error message if ok: false
}
```

#### Performance Thresholds
```javascript
const PERFORMANCE_THRESHOLDS = {
  WORKER_SIZE_THRESHOLD: 150 * 1024,    // 150KB for worker processing
  PAPA_CSV_THRESHOLD: 100 * 1024,       // 100KB for PapaParse
  URL_LENGTH_LIMIT: 1800,               // Safe URL length
  STORAGE_EXPIRY: 30 * 24 * 60 * 60 * 1000  // 30 days
};
```

### Memory Management

#### Large File Handling Strategy
```javascript
// Processing strategy by file size (Updated October 2025)
// Worker threshold optimized for modern browsers
const WORKER_SIZE_THRESHOLD = 150 * 1024; // 150KB

if (fileSize < 1024) {
  // Small files: immediate synchronous processing
  processSync(content);
} else if (fileSize < 150 * 1024) {
  // Medium files: next-tick processing
  Promise.resolve().then(() => processSync(content));
} else {
  // Large files: worker thread processing
  LargeDataHelpers.runHeavyTask('process', { text: content }, fallback);
}
```

## Browser Compatibility

### Feature Detection and Fallbacks

#### API Availability Detection
```javascript
// Feature detection patterns used in the application
const FEATURE_SUPPORT = {
  webWorkers: typeof Worker !== 'undefined',
  clipboard: navigator.clipboard && navigator.clipboard.writeText,
  webShare: navigator.share && navigator.canShare,
  fullscreen: document.documentElement.requestFullscreen,
  indexedDB: typeof indexedDB !== 'undefined',
  fileAPI: typeof FileReader !== 'undefined'
};
```

#### Graceful Degradation Examples
```javascript
// Clipboard API with fallback
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Fallback to execCommand
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

// Web Share API with fallback
async function shareContent(data) {
  if (navigator.canShare && navigator.canShare(data)) {
    await navigator.share(data);
  } else {
    // Fallback to file download
    downloadFile(data);
  }
}
```

## Security Considerations

### Input Sanitization

#### Safe JSON Parsing
```javascript
// Multi-layer parsing approach for safety
function safeParseJSON(input) {
  // 1. Try standard JSON parser first (most secure)
  try {
    return JSON.parse(input);
  } catch (error) {
    // 2. Use flexible parser with controlled transformations
    return parseFlexibleJSON(input);
  }
}
```

#### Content Validation
```javascript
// Basic content validation before processing
function validateInput(content) {
  if (typeof content !== 'string') {
    throw new Error('Input must be a string');
  }
  
  if (content.length > 50 * 1024 * 1024) { // 50MB limit
    throw new Error('Content too large for processing');
  }
  
  // Additional validation as needed
  return content;
}
```

### URL Sharing Security

#### Content Encoding
```javascript
// URL sharing uses base64 encoding (not encryption)
function encodeForURL(content) {
  // Base64 encoding for URL safety, NOT security
  return btoa(encodeURIComponent(content));
}

// Users should be aware that URL-shared content is not encrypted
// and can be decoded by anyone with access to the URL
```

## Extension and Customization

### Plugin Architecture Concepts

#### Custom Template Integration
```javascript
// Adding custom templates
window.DefaultTemplates.customTemplate = {
  left: JSON.stringify(customLeftData, null, 3),
  right: JSON.stringify(customRightData, null, 3)
};
```

#### Custom CSV Processing
```javascript
// Extending CSV processing with custom parsers
window.CSVUtils.customParser = function(csvText, options) {
  // Custom CSV parsing logic
  return parsedData;
};
```

#### Event Hook System (Future Enhancement)
```javascript
// Conceptual event system for extensibility
window.JsonCompareEvents = {
  on: function(eventName, callback) { /* ... */ },
  emit: function(eventName, data) { /* ... */ },
  off: function(eventName, callback) { /* ... */ }
};

// Usage example
JsonCompareEvents.on('contentChanged', function(data) {
  console.log('Content changed:', data);
});
```

## Testing and Debugging

### Debug Utilities

#### Console Debugging
```javascript
// Enable debug mode
window.DEBUG_MODE = true;

// Debug logging throughout application
function debugLog(category, message, data) {
  if (window.DEBUG_MODE) {
    console.log(`[${category}] ${message}`, data);
  }
}
```

#### Performance Monitoring
```javascript
// Performance timing utilities
function measurePerformance(name, fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  if (window.DEBUG_MODE) {
    console.log(`Performance: ${name} took ${end - start}ms`);
  }
  
  return result;
}
```

### Manual Testing Checklist

#### Core Functionality Tests
1. **JSON Comparison**: Load valid JSON in both panels, verify differences highlighted
2. **Python Parsing**: Test various Python literal formats
3. **CSV Conversion**: Test automatic CSV detection and conversion
4. **URL Sharing**: Generate shareable URL, test loading in new tab
5. **File Operations**: Test file upload, drag-and-drop, snapshot import/export
6. **Settings Persistence**: Modify settings, reload page, verify persistence
7. **Error Handling**: Test malformed JSON, oversized files, network failures

#### Browser Compatibility Tests
1. **Chrome**: Full functionality verification
2. **Firefox**: Cross-browser behavior validation
3. **Safari**: WebKit-specific features and limitations
4. **Edge**: Microsoft browser compatibility
5. **Mobile**: Touch interface and responsive design

#### Performance Tests
1. **Small Files** (<1KB): Instant response verification
2. **Medium Files** (1-150KB): Sub-second processing confirmation
3. **Large Files** (>150KB): Worker thread activation and timeout handling
4. **Memory Usage**: Monitor for memory leaks during extended use

This technical reference provides the comprehensive API documentation and implementation details needed for future development, maintenance, and integration efforts.
