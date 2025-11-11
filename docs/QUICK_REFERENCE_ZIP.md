# Quick Reference: ZIP Snapshot Feature

## For Users

### Creating a Snapshot
1. Add content to both panels
2. Click "Share URL" button
3. If content is too large, a ZIP file downloads automatically
4. Share the `json-compare-snapshot.zip` file

### Opening a Snapshot
**Option 1: Import to Tool**
1. Click "⚙️ Extra Settings"
2. Click "Import Snapshot"
3. Select the `.zip` or `.json.gz` file
4. Content and settings are restored

**Option 2: Manual Extraction**
1. Extract the ZIP file
2. Open any JSON file in a text editor
3. Files are human-readable, properly formatted JSON

### What's in the ZIP?
- `left-content.json` - Left panel content
- `right-content.json` - Right panel content
- `settings.json` - Your preferences (theme, options, etc.)
- `README.txt` - Help file explaining the contents

## For Developers

### Key Files
- **`utils_zip.js`** - All ZIP-related logic
- **`index.html`** - UI integration (minimal, delegates to utils)

### Main Functions

#### Creating Snapshots
```javascript
// One-liner to create and download ZIP
await window.SnapshotHandler.createAndDownload(
  leftContent,
  rightContent,
  settingsObject
);
```

#### Importing Snapshots
```javascript
// Auto-detects ZIP or legacy format
const data = await window.SnapshotHandler.importSnapshot(file);
// Returns: { left: '...', right: '...', settings: {...} }
```

### Extending the Feature

**Add new file to ZIP:**
```javascript
// In utils_zip.js -> ZipSnapshotManager.createSnapshot()
zip.file('metadata.json', JSON.stringify({
  version: '1.0',
  timestamp: new Date().toISOString()
}));
```

**Add new export format:**
```javascript
// Create new manager in utils_zip.js
window.CustomFormatManager = {
  createSnapshot: async function(left, right, settings) {
    // Your format implementation
  }
};
```

### Testing

**Quick Test:**
1. Load tool with sample JSON
2. Click "Share URL"
3. Extract downloaded ZIP
4. Verify 4 files present
5. Check JSON is formatted (not escaped)
6. Import the ZIP back
7. Verify content matches

**Edge Cases:**
- Empty content
- Invalid JSON
- Large files (>10MB)
- Legacy .json.gz imports
- Missing settings

### Code Structure

```
utils_zip.js
├── ZipSnapshotManager      (creates/imports ZIP)
├── LegacySnapshotManager   (handles old .json.gz)
└── SnapshotHandler         (unified interface)

index.html
├── shareURL()              (uses SnapshotHandler)
├── importSnapshot()        (uses SnapshotHandler)
└── applyImportedSettings() (helper for settings)
```

### Performance Notes
- ZIP creation is async (non-blocking)
- Maximum compression level (9) for smallest files
- Smart JSON detection (only formats valid JSON)
- Graceful fallback for invalid content

### Backward Compatibility
- Still imports old `.json.gz` format
- Auto-detects format by file extension
- Legacy format kept for existing users
- No breaking changes

## Common Issues

### "JSZip library not loaded"
- Check CDN is accessible
- Verify `<script>` tag in HTML head
- Check browser console for network errors

### "Failed to import snapshot"
- Verify file is valid ZIP or .json.gz
- Check browser console for details
- Try extracting ZIP manually first

### ZIP too large
- Consider splitting content
- Check for redundant data
- JSON should be compressed efficiently

### Settings not applied
- Check settings.json exists in ZIP
- Verify JSON is valid
- Check browser console for warnings

## Best Practices

### For Users
1. Keep snapshots organized by project
2. Name files descriptively if sharing
3. Include README.txt when sharing individual files
4. Test import before deleting original data

### For Developers
1. Always use `SnapshotHandler` (don't call managers directly)
2. Handle errors gracefully with user-friendly messages
3. Test both ZIP and legacy formats
4. Maintain backward compatibility
5. Document any format changes

## Resources
- Full docs: `/docs/ZIP_SNAPSHOT_FORMAT.md`
- Source code: `/utils_zip.js`
- JSZip docs: https://stuk.github.io/jszip/
