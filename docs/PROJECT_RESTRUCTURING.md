# Project Restructuring - Separated v5 and v6 Versions

**Date:** November 12, 2025  
**Purpose:** Separate CodeMirror 5 and CodeMirror 6 versions into isolated directories  
**Branch:** feature/python-data-conversation

## Problem
Previously, both CodeMirror 5 and 6 versions shared the same utilities, CSS files, and resources. This caused:
- Conflicts between version-specific features
- Difficulty maintaining separate versions
- Risk of breaking one version when updating the other
- Confusion about which files belong to which version

## Solution: Complete Separation

### New Directory Structure
```
json_compair/
├── index.html                 # Version selector (new entry point)
├── index-cm6-old.html         # Backup of old CM6 index
├── index-v5.html              # Backup of old CM5 index
│
├── v6/                        # CodeMirror 6 (recommended)
│   ├── index.html             # CM6 main app
│   ├── css/
│   │   ├── app.css
│   │   ├── ccsiteV6.css
│   │   └── merge-custom.css   # Enhanced diff colors
│   └── utils/
│       ├── utils.js           # URL/storage/templates
│       ├── json_utils.js      # Flexible JSON parser
│       ├── utils_csv.js       # CSV auto-converter
│       └── utils_zip.js       # ZIP snapshots (new)
│
├── v5/                        # CodeMirror 5 (legacy)
│   ├── index.html             # CM5 main app
│   ├── css/
│   │   ├── app.css
│   │   ├── ccsiteV6.css
│   │   ├── codemirror.css
│   │   ├── merge.css
│   │   └── merge-custom.css
│   ├── js/
│   │   ├── codemirror.js
│   │   ├── diff_match_patch.js
│   │   ├── merge.js
│   │   ├── javascript.js
│   │   └── large_json_helpers.js
│   └── utils/
│       ├── utils.js
│       ├── json_utils.js
│       └── utils_csv.js
│
├── img/                       # Shared images
├── docs/                      # Documentation
├── tests/                     # Test files
└── [legacy files in root]     # Keep for backward compatibility
```

## Migration Steps

### 1. Created Directories
```bash
mkdir -p v6/css v6/js v6/utils v5/css v5/js v5/utils
```

### 2. Copied CM6 Files
```bash
# Main file
index.html → v6/index.html

# Utilities
utils.js → v6/utils/utils.js
json_utils.js → v6/utils/json_utils.js
utils_csv.js → v6/utils/utils_csv.js
utils_zip.js → v6/utils/utils_zip.js  # NEW

# Styles
css/app.css → v6/css/app.css
css/ccsiteV6.css → v6/css/ccsiteV6.css
css/merge-custom.css → v6/css/merge-custom.css
```

**Updated paths in v6/index.html:**
```html
<!-- Before -->
<link rel="shortcut icon" href="./img/onlinetextcompare.png" />
<script src="./utils.js"></script>

<!-- After -->
<link rel="shortcut icon" href="../img/onlinetextcompare.png" />
<script src="./utils/utils.js"></script>
```

### 3. Copied CM5 Files
```bash
# Main file
index-v5.html → v5/index.html

# Utilities (no utils_zip.js - CM5 doesn't have ZIP support)
utils.js → v5/utils/utils.js
json_utils.js → v5/utils/json_utils.js
utils_csv.js → v5/utils/utils_csv.js

# Styles
css/codemirror.css → v5/css/codemirror.css
css/merge.css → v5/css/merge.css
css/merge-custom.css → v5/css/merge-custom.css
css/app.css → v5/css/app.css
css/ccsiteV6.css → v5/css/ccsiteV6.css

# Scripts
js/codemirror.js → v5/js/codemirror.js
js/diff_match_patch.js → v5/js/diff_match_patch.js
js/merge.js → v5/js/merge.js
js/javascript.js → v5/js/javascript.js
js/large_json_helpers.js → v5/js/large_json_helpers.js
```

**Updated paths in v5/index.html:**
```html
<!-- Before -->
<link rel="shortcut icon" href="./img/onlinetextcompare.png" />
<script src="./utils.js"></script>
<script src="./js/codemirror.js"></script>

<!-- After -->
<link rel="shortcut icon" href="../img/onlinetextcompare.png" />
<script src="./utils/utils.js"></script>
<script src="./js/codemirror.js"></script>
```

### 4. Created Version Selector
**New root `index.html`:**
- Beautiful landing page with two cards
- Auto-redirects if URL has `?v=5` or `?v=6` parameter
- Preserves URL parameters when redirecting (for share links)
- Saves user's version preference in localStorage
- Responsive design with gradient background

**Features:**
```javascript
// Auto-redirect examples
https://example.com/?v=6        → ./v6/index.html
https://example.com/?v=5&c=...  → ./v5/index.html?c=...
https://example.com/?c=...      → ./v6/index.html?c=... (default)
```

## Benefits

### ✅ Complete Isolation
- Each version has its own utilities
- No shared state or conflicts
- Safe to modify one without affecting the other

### ✅ Clear Maintenance
- Easy to identify version-specific code
- Separate git commits for v5 vs v6 changes
- Clear deprecation path for v5

### ✅ Version-Specific Features
- v6: ZIP snapshots, enhanced diff colors
- v5: Large JSON helpers, classic UI
- Each can evolve independently

### ✅ Backward Compatibility
- Old links still work (root files preserved)
- Version selector handles redirects
- User preference remembered

## URL Handling

### Root Index (Version Selector)
```
/                   → Version selector page
/?v=6               → Auto-redirect to /v6/index.html
/?v=5               → Auto-redirect to /v5/index.html
/?c=H4sIA...        → Auto-redirect to /v6/index.html?c=... (default)
```

### Direct Access
```
/v6/index.html      → CodeMirror 6 (modern)
/v5/index.html      → CodeMirror 5 (legacy)
```

### Share URLs
Both versions generate URLs with compressed content:
```
https://example.com/?c=H4sIAAAA...
```

The root selector detects the `?c` parameter and redirects to v6 by default.

## Deployment Considerations

### GitHub Pages
Update `.github/workflows/pages.yml` if needed:
```yaml
# No changes needed - index.html still exists at root
# v6/ and v5/ directories automatically deployed
```

### CDN/Build
- All external dependencies (CodeMirror, pako, JSZip) loaded from CDN
- No build process required
- Direct file serving works

## Future Maintenance

### Adding Features to v6
1. Edit files in `v6/` directory only
2. Test at `http://localhost/v6/index.html`
3. Commit with `[v6]` prefix

### Fixing Bugs in v5
1. Edit files in `v5/` directory only
2. Test at `http://localhost/v5/index.html`
3. Commit with `[v5]` prefix

### Deprecating v5
When ready to sunset CodeMirror 5:
1. Update version selector to discourage v5
2. Add deprecation notice in `v5/index.html`
3. Eventually remove `v5/` directory
4. Keep documentation for archive

## Testing Checklist

- [x] v6 loads and works correctly
- [x] v5 loads and works correctly
- [x] Version selector displays both options
- [x] Auto-redirect from `/?v=6` works
- [x] Auto-redirect from `/?v=5` works
- [x] Share URLs redirect to v6
- [x] All CSS/JS paths correct in v6
- [x] All CSS/JS paths correct in v5
- [ ] Test on live server (GitHub Pages)
- [ ] Test share URL backward compatibility
- [ ] Cross-browser testing

## File Inventory

### Root Files (Legacy - Keep for Compatibility)
```
index.html              → Version selector (NEW)
index-cm6-old.html      → Backup of old CM6 version
index-v5.html           → Backup of old CM5 version
server.js               → Local dev server
README.md               → User documentation
```

### v6 Files (CodeMirror 6)
```
v6/index.html           → 2044 lines, ES modules
v6/css/app.css
v6/css/ccsiteV6.css
v6/css/merge-custom.css → Enhanced diff colors
v6/utils/utils.js       → URL/storage managers
v6/utils/json_utils.js  → Flexible parser
v6/utils/utils_csv.js   → CSV converter
v6/utils/utils_zip.js   → ZIP snapshots (NEW)
```

### v5 Files (CodeMirror 5)
```
v5/index.html           → 1359 lines, classic
v5/css/app.css
v5/css/ccsiteV6.css
v5/css/codemirror.css
v5/css/merge.css
v5/css/merge-custom.css
v5/js/codemirror.js
v5/js/diff_match_patch.js
v5/js/merge.js
v5/js/javascript.js
v5/js/large_json_helpers.js
v5/utils/utils.js
v5/utils/json_utils.js
v5/utils/utils_csv.js
```

### Shared Resources
```
img/                    → Icons, logos
docs/                   → Documentation
tests/                  → Test files
.github/                → CI/CD workflows
```

## Breaking Changes

### For Users
- **None!** Old URLs still work via redirects
- Version selector appears on first visit
- Preference saved for future visits

### For Developers
- **File paths changed:** Must use `v6/` or `v5/` prefix
- **No more root utils:** Use version-specific directories
- **CSS edits:** Edit in correct version's css/ folder

## Rollback Plan

If issues arise:
```bash
# Restore old structure
mv index.html index-selector-backup.html
mv index-cm6-old.html index.html
mv index-v5.html index-v5.html  # Keep as-is

# Revert to shared utilities
cp v6/utils/*.js ./
```

## Related Documents
- `docs/ZIP_SNAPSHOT_FORMAT.md` - ZIP export (v6 only)
- `docs/fixes/enhanced-diff-colors-fix.md` - Diff colors (both versions)
- `CODEMIRROR_6_MIGRATION.md` - Migration notes
- `README.md` - User-facing documentation

## Summary

This restructuring provides:
1. ✅ Complete separation of v5 and v6
2. ✅ No conflicts between versions
3. ✅ Easy maintenance and updates
4. ✅ Clear deprecation path
5. ✅ Backward compatibility
6. ✅ Beautiful version selector
7. ✅ User preference persistence

Both versions can now evolve independently without risk of breaking each other!
