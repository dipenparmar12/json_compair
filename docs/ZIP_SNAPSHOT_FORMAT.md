# ZIP Snapshot Format Implementation

## Overview
The Share URL functionality now creates a user-friendly ZIP archive when content is too large for URL sharing. This implementation uses a dedicated utility module (`utils_zip.js`) for maintainability and code reuse.

## Implementation Date
November 11, 2025

## Architecture

### New Files
- **`utils_zip.js`** - Dedicated ZIP snapshot utilities module
  - `ZipSnapshotManager` - Creates and imports ZIP snapshots
  - `LegacySnapshotManager` - Handles legacy .json.gz format
  - `SnapshotHandler` - Unified interface with auto-format detection

### Modified Files
- **`index.html`** - Updated to use new utility modules
  - Simplified `shareURL()` function (now ~50 lines vs 80 lines)
  - Simplified `importSnapshot()` function (now ~50 lines vs 150 lines)
  - Added `applyImportedSettings()` helper to reduce duplication

## Code Organization

### utils_zip.js Structure
```javascript
window.ZipSnapshotManager = {
  createSnapshot()      // Create ZIP with 3 JSON files + README
  importSnapshot()      // Extract ZIP and return data
  downloadSnapshot()    // Trigger browser download
}

window.LegacySnapshotManager = {
  importSnapshot()      // Handle old .json.gz format
}

window.SnapshotHandler = {
  importSnapshot()      // Auto-detect format
  createAndDownload()   // One-liner for creating & downloading
}
```

### Benefits of Modular Approach
1. **Reusability** - ZIP utilities can be used elsewhere
2. **Testability** - Each function can be tested independently
3. **Maintainability** - ZIP logic separated from UI logic
4. **Readability** - Clear separation of concerns
5. **Extensibility** - Easy to add new export formats

## Changes Made

### 1. Added JSZip Library
- **Library**: JSZip v3.10.1
- **Source**: CDN (cdnjs.cloudflare.com)
- **Purpose**: Create and extract ZIP archives in the browser
- **Location**: Added to `<head>` section after pako

### 2. Created utils_zip.js Module
New utility file with three main components:

**ZipSnapshotManager:**
- `createSnapshot(left, right, settings)` - Creates ZIP with formatted JSON files
- `importSnapshot(file)` - Extracts and parses ZIP contents
- `downloadSnapshot(blob, filename)` - Triggers browser download
- `_formatContentForFile(content)` - Smart JSON formatting
- `_generateReadme()` - Creates helpful README.txt for users

**LegacySnapshotManager:**
- `importSnapshot(file)` - Handles old `.json.gz` format
- Provides backward compatibility

**SnapshotHandler (Unified Interface):**
- `importSnapshot(file)` - Auto-detects ZIP vs legacy format
- `createAndDownload(left, right, settings)` - One-liner for export

### 3. Updated index.html
Refactored to use new utilities:

**shareURL() function:**
```javascript
// Before: ~80 lines with inline ZIP creation
// After: ~50 lines using SnapshotHandler.createAndDownload()
```

**importSnapshot() function:**
```javascript
// Before: ~150 lines with duplicated logic for ZIP and legacy
// After: ~50 lines using SnapshotHandler.importSnapshot()
```

**New helper function:**
- `applyImportedSettings(settings)` - Eliminates code duplication

### 4. Enhanced ZIP Contents

**Old Behavior (single .json.gz):**
- Created single `.json.gz` file
- Content stored as stringified JSON with escaped quotes
- Required decompression + JSON parsing to read
- Single file with all data combined

**New Behavior (multi-file .zip):**
- Creates `.zip` archive with four separate files:
  - `left-content.json` - Left panel content (formatted JSON)
  - `right-content.json` - Right panel content (formatted JSON)
  - `settings.json` - Application settings (formatted JSON)
  - `README.txt` - User-friendly guide with usage instructions
- Each file contains proper JSON (not stringified strings)
- Can be opened directly after extraction without special tools
- Smaller file size due to:
  - No string escaping needed
  - No nested stringification
  - ZIP compression (DEFLATE level 9)

### 5. Improved Import Function
The import function now uses unified handler with auto-detection:

**ZIP Format (`.zip`):**
- Auto-detected by file extension
- Extracts all four files
- Loads content from respective JSON files
- Applies settings from settings.json
- Displays "ZIP snapshot imported successfully"

**Legacy Format (`.json.gz`):**
- Still supported for backward compatibility
- Auto-detected for non-.zip files
- Handles old snapshots created before this update
- Displays "legacy snapshot imported successfully"

## File Structure

### ZIP Archive Contents:
```
json-compare-snapshot.zip
├── left-content.json      # Left panel JSON content (formatted)
├── right-content.json     # Right panel JSON content (formatted)
├── settings.json          # Application settings
└── README.txt             # User guide with usage instructions
```

### Example `left-content.json`:
```json
{
  "users": [
    {
      "id": 1,
      "name": "John Doe"
    }
  ]
}
```

### Example `settings.json`:
```json
{
  "wordWrap": true,
  "scrollLock": true,
  "theme": "light",
  "highlightChanges": true,
  "gutter": true,
  "collapseUnchanged": false,
  "orientation": "a-b",
  "revertControls": "a-to-b",
  "scanLimit": 10000
}
```

### Example `README.txt`:
```
JSON Compare Snapshot
=====================

This ZIP file contains a snapshot from the JSON Compare Tool.

Files:
------
- left-content.json   : Content from the left comparison panel
- right-content.json  : Content from the right comparison panel  
- settings.json       : Application settings (theme, diff options, etc.)
- README.txt          : This file

Usage:
------
1. Import this file using the "Import Snapshot" button in the tool
2. Or manually open individual JSON files in any text editor
3. Share individual files or the entire ZIP with collaborators

Generated: 2025-11-11T10:30:00.000Z
Tool: JSON Compare (CodeMirror 6)
```

## Benefits

1. **User-Friendly**: Standard ZIP format that any OS can extract
2. **Readable**: JSON files can be opened in any text editor
3. **Self-Documenting**: Includes README.txt explaining contents
4. **Smaller Size**: No string escaping or nested JSON reduces file size
5. **Professional**: Four separate files more organized than single blob
6. **Shareable**: Easier to inspect, edit, or share individual files
7. **Backward Compatible**: Still imports old `.json.gz` format
8. **Maintainable**: Modular code structure with reusable utilities

## Usage

### Creating a Snapshot:
1. Click "Share URL" button
2. If content is too large for URL, ZIP file downloads automatically
3. File named: `json-compare-snapshot.zip`

### Importing a Snapshot:
1. Click "Import Snapshot" under Extra Settings
2. Select either:
   - New `.zip` file (recommended)
   - Old `.json.gz` file (backward compatible)
3. Content and settings are restored

## Technical Details

### Compression:
- **Algorithm**: DEFLATE (ZIP standard)
- **Level**: 9 (maximum compression)
- **Format**: ZIP 2.0 compatible

### Error Handling:
- Gracefully handles invalid JSON in content files
- Falls back to raw text if parsing fails
- Continues import even if settings.json is missing/invalid
- Displays user-friendly error messages

### Performance:
- Async/await for non-blocking ZIP operations
- Streaming where possible
- No memory bloat from string concatenation

## Browser Compatibility
- All modern browsers (Chrome, Firefox, Safari, Edge)
- Requires: File API, Blob API, JSZip library
- No build process needed - works directly in browser

## Future Enhancements
Potential improvements:
- Add metadata file with export date, version info
- Include README.txt explaining file structure
- Support for importing individual JSON files
- Drag-and-drop ZIP import
- Export history/multiple snapshots in single ZIP

## Related Files
- `/index.html` - Main implementation (simplified using utilities)
- `/utils_zip.js` - ZIP snapshot utility module (NEW)
- `/docs/LIBRARY_UPDATES_OCT_2025.md` - Library version tracking
- `/docs/URL Auto-Cleaning Implementation.md` - Related URL sharing docs

## Code Maintenance Guide

### Adding New Export Formats
To add a new export format (e.g., TAR, 7z):

1. Create new manager in `utils_zip.js`:
```javascript
window.TarSnapshotManager = {
  createSnapshot: async function(left, right, settings) {
    // Implementation
  },
  importSnapshot: async function(file) {
    // Implementation
  }
};
```

2. Update `SnapshotHandler.importSnapshot()` to detect new format
3. No changes needed in `index.html` - it uses the unified interface

### Modifying ZIP Contents
To add/remove files from ZIP:

1. Edit `ZipSnapshotManager.createSnapshot()` in `utils_zip.js`
2. Update `_generateReadme()` to document changes
3. Ensure backward compatibility in `importSnapshot()`

### Testing Checklist
- [ ] Create snapshot with large content (>2000 chars URL limit)
- [ ] Verify ZIP contains 4 files (left, right, settings, README)
- [ ] Extract ZIP and verify JSON is formatted (not stringified)
- [ ] Import ZIP snapshot and verify content restored
- [ ] Import legacy .json.gz snapshot (backward compatibility)
- [ ] Verify settings are applied correctly
- [ ] Test with invalid/malformed JSON
- [ ] Test with empty content
- [ ] Verify README.txt is helpful and accurate
