# ZIP Snapshot Export - Human-Readable JSON Files

**Date:** November 12, 2025  
**Feature:** ZIP-based snapshot export with separate JSON files  
**Branch:** feature/python-data-conversation

## Problem
The previous snapshot export used `.json.gz` format with stringified JSON content:
```json
{
  "left": "{\"name\": \"John\", \"age\": 30}",
  "right": "{\"name\": \"Jane\", \"age\": 25}",
  "settings": {...}
}
```

**Issues:**
1. JSON content was double-encoded (stringified)
2. Files couldn't be used directly outside the tool
3. Not human-readable when extracted
4. Difficult to inspect or edit manually

## Solution

### ZIP Snapshot Format
New export creates a standard ZIP file containing:
```
json-compare-snapshot-2025-11-12T14-30-00.zip
├── left-content.json      # Formatted JSON (indented, not stringified)
├── right-content.json     # Formatted JSON (indented, not stringified)
├── settings.json          # Tool settings (formatted)
└── README.txt             # User guide
```

### Example Content

**left-content.json:**
```json
{
  "name": "John",
  "age": 30,
  "address": {
    "city": "New York",
    "zip": "10001"
  }
}
```

**right-content.json:**
```json
{
  "name": "Jane",
  "age": 25,
  "address": {
    "city": "Boston",
    "zip": "02101"
  }
}
```

**settings.json:**
```json
{
  "theme": "light",
  "wordWrap": true,
  "highlightChanges": true,
  "collapseUnchanged": false
}
```

**README.txt:**
```
JSON Compare Tool - Snapshot Export
=====================================

This snapshot contains your comparison session.

Files Included:
- left-content.json: Content from the left panel
- right-content.json: Content from the right panel
- settings.json: Tool settings (diff options, theme, etc.)

How to Use:
1. Open the JSON files in any text editor or JSON viewer
2. Import this ZIP back into the tool using "Import Snapshot"
3. Or use the JSON files directly in your projects

Exported: 2025-11-12T14:30:00.000Z
Tool: https://github.com/dipenparmar12/json_compair
```

## Implementation

### New File: `utils_zip.js`
Created a dedicated utility module with three managers:

1. **ZipSnapshotManager:** Create/import ZIP snapshots
2. **LegacySnapshotManager:** Import old .json.gz files (backward compatibility)
3. **SnapshotHandler:** Unified interface (auto-detects format)

### Architecture

```javascript
// Export workflow
User clicks Share → 
  Content too large for URL? → 
    Yes: SnapshotHandler.createAndDownload() →
      ZipSnapshotManager.createSnapshot() →
        Parse & format JSON (JSON.stringify with indent=2) →
        Create ZIP with JSZip →
        Download as .zip file

// Import workflow  
User selects file →
  SnapshotHandler.importSnapshot() →
    Auto-detect format (.zip or .json.gz) →
      .zip: ZipSnapshotManager.importSnapshot()
      .json.gz: LegacySnapshotManager.importSnapshot() →
    Extract content & settings →
    Apply to editors
```

### Key Features

1. **Auto-Formatting:** JSON content is automatically parsed and formatted with 2-space indentation
2. **Error Handling:** Invalid JSON saved as-is (preserves user data)
3. **Backward Compatible:** Still supports importing old .json.gz snapshots
4. **Compression:** DEFLATE compression (level 9) for smaller file size
5. **Timestamped Names:** `json-compare-snapshot-2025-11-12T14-30-00.zip`

## Files Modified

### 1. `/index.html`
- Added JSZip 3.10.1 library (CDN)
- Added `utils_zip.js` script reference
- Updated share button to use `SnapshotHandler.createAndDownload()`
- Simplified `importSnapshot()` to use `SnapshotHandler.importSnapshot()`
- Updated file input to accept `.zip` files

### 2. `/utils_zip.js` (NEW)
- `ZipSnapshotManager.createSnapshot()`: Create ZIP with separate files
- `ZipSnapshotManager.importSnapshot()`: Extract ZIP files
- `LegacySnapshotManager.importSnapshot()`: Handle old .json.gz format
- `SnapshotHandler.importSnapshot()`: Auto-detect and route
- `SnapshotHandler.createAndDownload()`: Unified export

## Usage Examples

### Export Snapshot
```javascript
const settings = SettingsManager.loadAll();
await SnapshotHandler.createAndDownload(leftContent, rightContent, settings);
// Downloads: json-compare-snapshot-2025-11-12T14-30-00.zip
```

### Import Snapshot (Auto-detect)
```javascript
const data = await SnapshotHandler.importSnapshot(file);
// Works with both .zip and .json.gz files
// Returns: { left: '...', right: '...', settings: {...} }
```

### Manual ZIP Creation
```javascript
const blob = await ZipSnapshotManager.createSnapshot(left, right, settings);
ZipSnapshotManager.downloadSnapshot(blob, 'my-snapshot.zip');
```

## Benefits

### For Users
1. **Direct Use:** Extract and use JSON files anywhere
2. **Readable:** View/edit files in any text editor
3. **Portable:** Share JSON files without the tool
4. **Inspectable:** See exactly what's being compared
5. **Version Control:** Commit JSON files to Git

### For Developers
1. **Debugging:** Easily inspect exported snapshots
2. **Testing:** Use exported files in test suites
3. **Integration:** Import JSON files into other tools
4. **Documentation:** Share examples with stakeholders

## Testing Checklist
- [x] Export creates valid ZIP file
- [x] ZIP contains all 4 files
- [x] JSON files are properly formatted (indented)
- [x] JSON files are NOT stringified
- [x] README.txt contains correct info
- [x] Import reads ZIP files correctly
- [x] Import restores content accurately
- [x] Import applies settings correctly
- [x] Backward compatibility: Old .json.gz files still work
- [ ] Test with invalid JSON content
- [ ] Test with empty panels
- [ ] Test with very large files (>1MB)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

## Library Dependencies

### JSZip 3.10.1
**CDN:** https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js  
**License:** MIT  
**Size:** ~110KB (minified)  
**Features Used:**
- `zip.file()`: Add files to archive
- `zip.generateAsync()`: Create ZIP blob
- `JSZip.loadAsync()`: Read ZIP files

### Pako 2.1.0 (existing)
**Used for:** Legacy .json.gz import (backward compatibility)

## Future Enhancements

1. **Export Options Panel:**
   - Choose what to include (left only, right only, both)
   - Include/exclude settings
   - Custom filename

2. **Batch Export:**
   - Export multiple comparisons as separate folders in one ZIP

3. **Diff Export:**
   - Export only the differences as a patch file

4. **Import from URL:**
   - Fetch JSON files from URLs and compare

5. **Drag & Drop ZIP:**
   - Drag ZIP file onto page to import

## Migration Guide

### For Users
**Old Format (.json.gz):**
- Still supported for import
- Will not be created on new exports

**New Format (.zip):**
- Default export format
- Extract to get individual JSON files
- Use JSON files directly in other tools

### For Developers
**Before:**
```javascript
const data = JSON.stringify({ left, right, settings });
const compressed = pako.gzip(data);
```

**After:**
```javascript
await SnapshotHandler.createAndDownload(left, right, settings);
```

## Related Documentation
- `docs/PRD/03-utility-specifications.md` - Original utility specs
- `CODEMIRROR_6_MIGRATION.md` - CM6 migration notes
- `docs/LIBRARY_UPDATES_OCT_2025.md` - Library update log

## References
- JSZip Documentation: https://stuk.github.io/jszip/
- ZIP File Format: https://en.wikipedia.org/wiki/ZIP_(file_format)
- Pako Documentation: https://github.com/nodeca/pako
