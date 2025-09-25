# Third-Party Library Dependencies

## 1. CodeMirror Text Editor

### 1.1 Version and Source
- **Version**: 5.65.3
- **License**: MIT License
- **Source**: Local file (`js/codemirror.js`)
- **CDN Alternative**: Not currently used, local-only deployment
- **Size**: Approximately 580KB minified

### 1.2 Core Components
**Primary Libraries**:
- `codemirror.js`: Main editor library
- `merge.js`: Merge view functionality for side-by-side comparison
- `codemirror.css`: Base editor styling
- `merge.css`: Merge view specific styling

**Language Modules**:
- JavaScript mode support (built-in)
- JSON syntax highlighting
- Bracket matching
- Auto-completion foundation

### 1.3 Configuration Options
**Editor Configuration**:
- **Mode**: `"application/json"` for JSON syntax highlighting
- **Line Numbers**: Enabled by default
- **Line Wrapping**: Toggleable via user interface
- **Style Active Line**: Enabled for better cursor visibility
- **Show Differences**: Enabled for merge view
- **Chunk Class Location**: `["background", "wrap", "gutter"]`

**Merge View Configuration**:
- **Connect**: `"align"` for visual connection of matching lines
- **Collapse Identical**: Disabled to show all content
- **Revert Buttons**: Enabled for individual diff reverting
- **Allow Editing Originals**: Both panels fully editable
- **Highlight Differences**: Visual highlighting of changes

### 1.4 Integration Points
**Event Handling**:
- Scroll synchronization between panels
- Content change detection
- Copy/paste event handling
- Drag and drop file integration

**API Usage**:
- `getValue()`/`setValue()` for content management
- `getScrollInfo()`/`scrollTo()` for scroll synchronization
- `getOption()`/`setOption()` for dynamic configuration
- `getAllMarks()` for difference marker management

## 2. Google Diff Match Patch

### 2.1 Version and Source
- **Version**: Not explicitly versioned (Google's reference implementation)
- **License**: Apache License 2.0
- **Source**: Local file (`js/diff_match_patch.js`)
- **Origin**: Google's official diff-match-patch library
- **Language**: JavaScript implementation

### 2.2 Core Functionality
**Difference Calculation**:
- Line-by-line text comparison
- Character-level difference detection
- Insertion/deletion identification
- Context-aware diff generation

**Algorithm Features**:
- Myers' diff algorithm implementation
- Semantic cleanup for readable diffs
- Edit cost optimization
- Merge conflict resolution

### 2.3 Integration Usage
**Primary Functions**:
- Text comparison for JSON content
- Difference highlighting coordination with CodeMirror
- Chunk-based navigation support
- Merge view data structure population

**Performance Characteristics**:
- Efficient for medium-sized documents
- Memory usage scales with content size
- CPU-intensive for very large comparisons
- Worker thread compatible for background processing

## 3. Pako Compression Library

### 3.1 Version and Source
- **Version**: 2.1.0
- **License**: MIT License
- **CDN Source**: `https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js`
- **Local Fallback**: Not included locally (CDN-only)
- **Size**: Approximately 45KB minified

### 3.2 Core Functionality
**Compression Features**:
- Gzip compression/decompression
- Base64 encoding support
- Stream processing capability
- Browser-optimized performance

**API Usage**:
- `pako.gzip(data)`: Compresses data to gzip format
- `pako.ungzip(data, {to: 'string'})`: Decompresses to string
- Error handling for malformed compressed data
- Uint8Array processing for binary data

### 3.3 Integration Points
**URL Sharing**:
- Content compression for shareable URLs
- Fallback to file download when URLs become too long
- Snapshot file generation with .gz extension

**Performance Optimization**:
- Large data compression before storage
- Bandwidth reduction for sharing
- Storage space optimization

## 4. PapaParse CSV Library

### 4.1 Version and Source
- **Version**: 5.4.1 (latest stable 5.x)
- **License**: MIT License
- **CDN Source**: `https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js`
- **Local Fallback**: `js/papaparse.min.js` (optional)
- **Loading**: Dynamic loading with fallback mechanism

### 4.2 Core Functionality
**CSV Processing**:
- High-performance CSV parsing
- Web Worker support for large files
- Automatic type detection
- Header row processing
- Streaming support for very large files

**Configuration Options**:
- `header: true`: Use first row as column names
- `worker: true`: Enable background processing
- `dynamicTyping`: Automatic type conversion
- `skipEmptyLines: true`: Filter empty rows

### 4.3 Integration Points
**Large File Processing**:
- Threshold: 100KB+ files automatically use PapaParse
- Worker-based processing prevents UI blocking
- Fallback to synchronous processing for smaller files

**Error Handling**:
- Comprehensive error reporting
- Graceful fallback to built-in CSV parser
- User-friendly error messages

## 5. Oboe Streaming JSON Parser

### 5.1 Version and Source
- **Version**: 2.1.5
- **License**: BSD License
- **CDN Source**: `https://unpkg.com/oboe@2.1.5/dist/oboe-browser.min.js`
- **Local Fallback**: `js/oboe-browser.min.js` (optional)
- **Loading**: Dynamic loading with fallback mechanism

### 5.2 Core Functionality
**Streaming JSON Parsing**:
- Progressive JSON parsing for large files
- Memory-efficient processing
- Pattern-based data extraction
- Real-time processing as data loads

**Use Cases**:
- Very large JSON file processing
- Progressive rendering of comparison results
- Memory-constrained environments

### 5.3 Integration Status
**Current Implementation**: Loaded but not actively used in current version
**Future Enhancement**: Available for large file streaming optimization
**Performance Benefits**: Potential memory usage reduction for very large JSON files

## 6. Dynamic Loading System

### 6.1 Loading Strategy
**Fallback Mechanism**:
1. Attempt local file loading first
2. Fall back to CDN on local failure
3. Continue without optional libraries if all fail
4. Graceful degradation of functionality

**Implementation Pattern**:
```javascript
function loadOnce(cdnSrc, localPath) {
  return new Promise((resolve) => {
    // Try local first, then CDN fallback
  });
}
```

### 6.2 Library Status Detection
**Detection Logic**:
- Check for global objects (window.Papa, window.oboe)
- Prevent duplicate loading
- Enable feature detection for optional functionality

**Graceful Degradation**:
- Core functionality works without optional libraries
- Enhanced features enabled when libraries available
- User feedback for missing functionality

## 7. Browser API Dependencies

### 7.1 Core Web APIs
**Required APIs**:
- **File API**: File upload and processing
- **Clipboard API**: Copy/paste functionality
- **Web Storage**: localStorage and sessionStorage
- **IndexedDB**: Fallback storage for large data
- **History API**: URL management without page reload

**Optional APIs**:
- **Web Workers**: Background processing for large operations
- **Web Share API**: Native sharing on mobile devices
- **Fullscreen API**: Full-screen comparison mode
- **Compression Streams**: Future enhancement possibility

### 7.2 Browser Compatibility Matrix

**Modern Browser Support** (Required):
- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

**Feature Support Matrix**:
- **Web Workers**: All modern browsers
- **IndexedDB**: All modern browsers
- **Clipboard API**: HTTPS required for full functionality
- **Web Share API**: Mobile browsers, limited desktop support
- **File API**: All modern browsers

### 7.3 Progressive Enhancement
**Core Functionality** (Works everywhere):
- Text editing and comparison
- Basic JSON formatting
- Manual copy/paste sharing

**Enhanced Features** (Modern browsers):
- File drag-and-drop
- Clipboard integration
- Background processing
- Advanced sharing options

**Premium Features** (Latest browsers):
- Native mobile sharing
- Compression streams
- Advanced performance optimizations

## 8. Development and Build Dependencies

### 8.1 No Build Process
**Philosophy**: Zero build complexity
- No webpack, rollup, or similar bundlers
- No transpilation required
- No dependency management beyond file inclusion
- Direct browser compatibility

### 8.2 Development Tools
**Local Testing**:
- Python HTTP server: `python3 -m http.server 8000`
- Node.js alternatives: `npx http-server`
- Any static file server for local development

**Version Control**:
- Git for source control
- GitHub Pages for automatic deployment
- No CI/CD pipeline required

### 8.3 Deployment Requirements
**Static Hosting**:
- Any static file hosting service
- HTTPS recommended for full feature support
- CDN compatible for global distribution
- No server-side processing required

**File Structure**:
- All dependencies included in repository
- Optional CDN loading for enhanced features
- Offline functionality with local files only