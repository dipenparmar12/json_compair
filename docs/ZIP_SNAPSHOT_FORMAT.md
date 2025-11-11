# ZIP Snapshot Format Implementation

## Overview
The Share URL functionality now creates a user-friendly ZIP archive when content is too large for URL sharing. This replaces the previous `.json.gz` format with a more accessible `.zip` format containing separate, readable JSON files.

## Implementation Date
November 11, 2025

## Changes Made

### 1. Added JSZip Library
- **Library**: JSZip v3.10.1
- **Source**: CDN (cdnjs.cloudflare.com)
- **Purpose**: Create and extract ZIP archives in the browser
- **Location**: Added to `<head>` section after pako

### 2. Updated Share URL Function
When content exceeds URL length limits (~2000 characters), the system now:

**Old Behavior:**
- Created single `.json.gz` file
- Content stored as stringified JSON with escaped quotes
- Required decompression + JSON parsing to read
- Single file with all data combined

**New Behavior:**
- Creates `.zip` archive with three separate files:
  - `left-content.json` - Left panel content (formatted JSON)
  - `right-content.json` - Right panel content (formatted JSON)
  - `settings.json` - Application settings (formatted JSON)
- Each file contains proper JSON (not stringified strings)
- Can be opened directly after extraction without special tools
- Smaller file size due to:
  - No string escaping needed
  - No nested stringification
  - ZIP compression (DEFLATE level 9)

### 3. Updated Import Function
The import function now handles both formats:

**ZIP Format (`.zip`):**
- Extracts three separate files
- Loads left/right content from respective JSON files
- Applies settings from settings.json

**Legacy Format (`.json.gz`):**
- Still supported for backward compatibility
- Handles old snapshots created before this update

## File Structure

### ZIP Archive Contents:
```
json-compare-snapshot.zip
├── left-content.json      # Left panel JSON content (formatted)
├── right-content.json     # Right panel JSON content (formatted)
└── settings.json          # Application settings
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

## Benefits

1. **User-Friendly**: Standard ZIP format that any OS can extract
2. **Readable**: JSON files can be opened in any text editor
3. **Smaller Size**: No string escaping or nested JSON reduces file size
4. **Professional**: Three separate files are more organized than single blob
5. **Shareable**: Easier to inspect, edit, or share individual files
6. **Backward Compatible**: Still imports old `.json.gz` format

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
- `/index.html` - Main implementation
- `/docs/LIBRARY_UPDATES_OCT_2025.md` - Library version tracking
- `/docs/URL Auto-Cleaning Implementation.md` - Related URL sharing docs
