# Third-Party Library Dependencies

## Core Frontend Dependencies

### 1. TailwindCSS 3.3.6 (CSS Framework)
- **Purpose**: Primary UI styling framework with utility-first approach for consistent, responsive design
- **Implementation**: CDN delivery with offline fallback for development environment
- **CDN Source**: https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js
- **Local Fallback**: js/offline/pako_2.1.0.js
- **Local Fallback**: css/offline/tailwindcss_3.3.6.css
- **Bundle Size**: ~100KB (base utilities only, tree-shaken in production)
- **License**: MIT License
- **Last Updated**: November 2023 (actively maintained)

**Key Features**:
- Responsive design utilities (sm:, md:, lg:, xl:, 2xl: breakpoints)
- Dark mode support with 'dark:' variant prefix
- Comprehensive color palette with semantic naming
- Spacing system based on 0.25rem increments
- Built-in accessibility features and ARIA support
- Component composition through utility classes

**Integration Strategy**:
```html
<!-- CDN with fallback loading -->
<script>
  const loadTailwind = () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.tailwindcss.com';
    link.onerror = () => {
      // Fallback to local TailwindCSS
      const fallback = document.createElement('link');
      fallback.rel = 'stylesheet';
      fallback.href = 'css/offline/tailwindcss_3.3.6.css';
      document.head.appendChild(fallback);
    };
    document.head.appendChild(link);
  };
  loadTailwind();
</script>
```

**Custom Components for JSON Comparison**:
```css
/* css/app.css - Built on TailwindCSS utilities */
@layer components {
  .diff-added {
    @apply bg-green-100 text-green-800 border-l-4 border-green-500 dark:bg-green-900 dark:text-green-200;
  }
  .diff-removed {
    @apply bg-red-100 text-red-800 border-l-4 border-red-500 dark:bg-red-900 dark:text-red-200;
  }
  .diff-modified {
    @apply bg-blue-100 text-blue-800 border-l-4 border-blue-500 dark:bg-blue-900 dark:text-blue-200;
  }
  .json-key {
    @apply text-purple-600 font-medium dark:text-purple-400;
  }
  .json-string {
    @apply text-green-600 dark:text-green-400;
  }
  .json-number {
    @apply text-blue-600 dark:text-blue-400;
  }
}
```

### 2. CodeMirror 5.65.3 (Text Editor)

### 2.1 Version and Source
- **Version**: 5.65.3 (Stable, widely adopted version)
- **License**: MIT License  
- **CDN Source**: https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.3/
- **Local Fallback**: js/offline/codemirror_5.65.3.js, css/offline/codemirror_5.65.3.css
- **Bundle Size**: ~580KB minified (core + merge addon + modes)
- **Browser Support**: All modern browsers, IE 8+

### 2.2 Core Components
**Required Files with CDN + Fallback**:
```javascript
// Core CodeMirror files
{
  cdn: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.3/codemirror.min.css',
  fallback: 'css/offline/codemirror_5.65.3.css'
},
{
  cdn: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.3/codemirror.min.js',
  fallback: 'js/offline/codemirror_5.65.3.js'
}

// Merge view addon
{
  cdn: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.3/addon/merge/merge.min.css',
  fallback: 'css/offline/merge_5.65.3.css'
},
{
  cdn: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.3/addon/merge/merge.min.js',
  fallback: 'js/offline/codemirror-merge_5.65.3.js'
}

// JSON mode support  
{
  cdn: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.3/mode/javascript/javascript.min.js',
  fallback: 'js/offline/codemirror-mode-javascript_5.65.3.js'
}
```

### 2.3 Integration with TailwindCSS
CodeMirror integrates seamlessly with TailwindCSS through custom component classes:

```css
/* CodeMirror styling enhanced with Tailwind utilities */
.CodeMirror {
  @apply border border-gray-300 rounded-md font-mono text-sm;
  @apply focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500;
}

.CodeMirror-merge {
  @apply border-0; /* Remove default border, handled by container */
}

.CodeMirror-merge-pane {
  @apply border-r border-gray-200 last:border-r-0;
}

.CodeMirror-merge-gap {
  @apply bg-gray-100;
}

/* Dark mode support */
.dark .CodeMirror {
  @apply bg-gray-900 text-gray-100 border-gray-700;
}

.dark .CodeMirror-merge-gap {
  @apply bg-gray-800;
}
```

### 2.4 Configuration Options
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
- **CDN Source**: https://cdnjs.cloudflare.com/ajax/libs/diff-match-patch/1.0.5/diff_match_patch.min.js
- **Local Fallback**: js/offline/diff_match_patch_1.0.5.js
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