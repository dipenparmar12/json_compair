# JSON Compare Tool

A browser-based tool for comparing and formatting JSON data. This tool allows you to:

- Format and compare two JSON objects side by side
- Highlight differences between the objects with red/green color coding
- Sort JSON keys alphabetically
- View only the differences between documents
- Choose from different JSON templates
- Share comparisons via URL with compression
- Import/export snapshots for later review

## Features

- **Real-time JSON comparison** with character-level diff highlighting
- **Red/Green diff highlighting** - Visual differentiation of insertions (red) and deletions (green)
- **Local storage** to save your recent work
- **Format malformed JSON** - Supports Python dict syntax, datetime objects, and more
- **Sort keys alphabetically** - Deep sorting of nested objects
- **Show only differences mode** - Focus on what changed
- **Synchronized scrolling** - Keep both sides aligned
- **URL sharing** - Compress and share via URL parameters
- **Snapshot import/export** - Save and restore comparisons

## CSV Support

- Drag and drop CSV files directly onto the left or right editor pane
- Automatic CSV to JSON conversion (array of objects) using PapaParse
- Compare CSV vs CSV, CSV vs JSON, or JSON vs JSON
- Auto-detection of separators (comma, tab, or semicolon)
- Handles quoted fields and escaped quotes
- Type coercion for numeric and boolean values

## Technology Stack

**Latest library versions as of October 2025:**
- **CodeMirror 5.65.20** - Code editor with merge view
- **Pako 2.1.0** - Gzip compression for URL sharing
- **PapaParse 5.4.1** - CSV parsing
- **Oboe.js 2.1.5** - Streaming JSON parser
- **diff-match-patch (latest)** - Google's diff algorithm

All dependencies are loaded with SRI (Subresource Integrity) hashes for security.

## Usage

Visit the [JSON Compare Tool](https://dipenparmar12.github.io/json_compair/) to use the online version.

Or clone this repository and open `index.html` in your browser to run it locally:

```bash
git clone https://github.com/dipenparmar12/json_compair.git
cd json_compair
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

## Recent Updates

See [docs/LIBRARY_UPDATES_OCT_2025.md](docs/LIBRARY_UPDATES_OCT_2025.md) for details on the latest library updates.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

# ✅ LIBRARY UPDATE SUMMARY - October 29, 2025

ALL LIBRARY UPDATES COMPLETED SUCCESSFULLY

📦 Updated Libraries (Oct 29, 2025):
   • CodeMirror: 5.65.3 → 5.65.20 (latest stable v5)
        - Core: js/codemirror.js
        - Merge addon: js/merge.js
        - JavaScript mode: js/javascript.js (newly added)
        - Styles: css/codemirror.css, css/merge.css
   • Pako: 2.1.0 (latest, added SRI)
   • PapaParse: 5.4.1 (latest, added SRI)
   • Oboe.js: 2.1.5 (latest, added SRI)
   • diff-match-patch: Updated to latest

🎨 Architecture Improvements:
   • Created css/merge-custom.css for custom styles
   • Separated vendor CSS from custom overrides
   • Future library updates won't overwrite customizations
   • Editor now uses full viewport height: calc(100vh - 120px)

✨ Features Preserved:
   ✓ Red/green diff highlighting (character & line level)
   ✓ Full viewport height editors
   ✓ JSON formatting & parsing
   ✓ CSV auto-conversion
   ✓ URL sharing & snapshots
   ✓ All UI controls

📚 Documentation Updated:
   • docs/LIBRARY_UPDATES_OCT_2025.md
   • README.md
   • .github/copilot-instructions.md

📚 DOCUMENTATION:
   - Created: docs/LIBRARY_UPDATES_OCT_2025.md
   - Updated: README.md
   - Updated: .github/copilot-instructions.md

✨ ALL FEATURES VERIFIED WORKING:
   ✓ Red/green diff highlighting (character & line level)
   ✓ JSON formatting & parsing
   ✓ Merge view with scroll sync
   ✓ CSV auto-conversion
   ✓ File drag-and-drop
   ✓ URL sharing with compression
   ✓ Snapshot import/export
   ✓ All UI controls and buttons

📁 BACKUP FILES CREATED:
   - js/codemirror.js.5.65.3.backup
   - js/merge.js.backup
   - js/diff_match_patch.js.backup
   - css/codemirror.css.backup
   - css/merge.css.backup

🔐 Security: SRI hashes added to all CDN scripts

🎯 Result: Zero breaking changes, all features working!