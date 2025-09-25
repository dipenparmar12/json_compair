# System Architecture Requirements

## Overview
JSON Compare Tool is a client-side-only web application designed for comparing, formatting, and sharing JSON data structures. The application operates entirely in the browser without requiring server-side processing or external services.

## Architecture Pattern
- **Architecture Type**: Single-Page Application (SPA) with no build process
- **Execution Model**: Client-side only, no server dependencies
- **Deployment Model**: Static file hosting (GitHub Pages, CDN, or local HTTP server)
- **Security Model**: All data processing occurs locally in the browser, ensuring complete privacy

## Core Components

### 1. Entry Point (`index.html`)
- **Primary HTML file** containing the complete application
- **Embedded JavaScript** initialization and configuration logic
- **Library Loading** through CDN fallback system with offline support
- **Meta Tags** for SEO, social sharing, and mobile responsiveness
- **Responsive Design** viewport configuration for mobile/desktop compatibility

### 2. Utility Modules
- **`utils.js`**: URL management, local storage, default templates, settings persistence
- **`json_utils.js`**: Flexible JSON parser supporting Python literals and complex data types
- **`utils_csv.js`**: CSV auto-detection, parsing, and conversion capabilities
- **`large_json_helpers.js`**: Performance optimization for large data processing

### 3. UI Components
- **`js/button-events.js`**: File upload handlers and legacy UI interactions
- **CSS Stylesheets**: Application styling, CodeMirror themes, responsive layouts
- **Dynamic Controls**: JavaScript-generated buttons, dropdowns, and interaction elements

### 4. Third-Party Integration
- **CodeMirror 5.65.3**: Text editor with syntax highlighting and merge view
- **diff_match_patch**: Google's difference calculation library
- **Pako 2.1.0**: Client-side gzip compression for URL sharing
- **PapaParse 5.4.1**: High-performance CSV parsing (optional)
- **Oboe 2.1.5**: Streaming JSON parser (optional)

## Data Flow Architecture

### 1. Input Processing
1. **File Upload**: Drag-and-drop or file picker interface
2. **Text Input**: Direct text editing in CodeMirror editors
3. **URL Parameters**: Compressed data loaded from shareable URLs
4. **Local Storage**: Automatic persistence and restoration
5. **Template Loading**: Pre-defined example data structures

### 2. Processing Pipeline
1. **Format Detection**: Automatic detection of JSON, CSV, or Python literal formats
2. **Parsing**: Flexible JSON parsing with Python compatibility
3. **Conversion**: CSV-to-JSON automatic conversion when enabled
4. **Validation**: Syntax error detection and user feedback
5. **Formatting**: Pretty-printing with configurable indentation

### 3. Comparison Engine
1. **Difference Calculation**: Google's diff_match_patch algorithm
2. **Alignment**: Visual alignment of matching content sections
3. **Highlighting**: Color-coded difference visualization
4. **Navigation**: Chunk-based navigation between differences

### 4. Output Generation
1. **Visual Display**: Side-by-side merge view with highlighting
2. **URL Sharing**: Base64-encoded compressed shareable links
3. **File Export**: Snapshot downloads with gzip compression
4. **Local Persistence**: Automatic saving to localStorage/IndexedDB

## Performance Considerations

### 1. Large Data Handling
- **Worker Threads**: Background processing for payloads >150KB
- **Lazy Loading**: On-demand library loading from CDN
- **Memory Management**: Efficient handling of large JSON structures
- **UI Responsiveness**: Non-blocking operations with async processing

### 2. Storage Optimization
- **Compression**: Gzip compression for URL sharing and snapshots
- **Fallback Storage**: IndexedDB fallback when localStorage quota exceeded
- **Expiry Management**: 30-day automatic cleanup of stored data

### 3. Network Efficiency
- **CDN Loading**: Primary libraries loaded from CDN with local fallback
- **Offline Support**: Local copies of all dependencies available
- **Minimal Dependencies**: Only essential libraries included

## Deployment Requirements

### 1. Static Hosting Compatibility
- **No Server Processing**: Pure static file deployment
- **HTTPS Support**: Required for modern browser APIs
- **CORS Policies**: Must support cross-origin resource sharing

### 2. Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **JavaScript APIs**: Support for ES6+, Web Workers, Clipboard API
- **Storage APIs**: localStorage, IndexedDB, File API
- **Compression**: Support for native browser compression

### 3. Development Environment
- **Local Testing**: Python HTTP server or equivalent
- **No Build Process**: Direct file editing and browser refresh
- **Version Control**: Git-based workflow with GitHub Pages deployment

## Security Architecture

### 1. Data Privacy
- **Local Processing**: All data remains in user's browser
- **No Server Transmission**: Data never sent to external servers
- **URL Sharing**: Optional user-initiated sharing only

### 2. Content Security
- **XSS Protection**: Proper input sanitization and content escaping
- **Safe Parsing**: Robust error handling for malformed input
- **Resource Loading**: Secure CDN and fallback mechanisms

## Integration Points

### 1. External Libraries
- **CDN Dependencies**: Reliable fallback to local copies
- **Version Pinning**: Specific versions for stability
- **License Compliance**: All libraries use permissive licenses

### 2. Browser APIs
- **File API**: File upload and download capabilities
- **Clipboard API**: Copy/paste URL sharing
- **History API**: Clean URL management
- **Web Share API**: Native sharing on mobile devices

## Scalability Considerations

### 1. Performance Scaling
- **Worker Thread Processing**: Automatic scaling for large datasets
- **Memory Management**: Efficient cleanup and garbage collection
- **UI Responsiveness**: Progressive rendering for large content

### 2. Feature Scaling
- **Modular Architecture**: Easy addition of new utilities and features
- **Plugin System**: Extensible library loading mechanism
- **Template System**: Configurable example content