# Performance Optimization Features

This document describes the performance optimization features added to handle large JSON datasets without UI freezing.

## Overview

When comparing large JSON files, the diffing algorithms can block the main thread and cause the UI to freeze. These optimizations address this by:

1. **Viewport Diff Mode** - Only compute diffs for visible area
2. **Performance Mode** - Bundle of optimized settings for large files
3. **Web Worker** - Offload heavy calculations to a background thread
4. **Auto-detection** - Automatically suggest/enable optimizations for large files

## Features

### 1. Viewport Diff Mode

**Location:** `v6/utils/viewport_diff.js`

Instead of computing diffs for the entire document, this mode only calculates differences for:
- The currently visible lines
- A configurable buffer above and below (default: 100 lines)

**Benefits:**
- Near-instant diff calculation regardless of file size
- Smooth scrolling with debounced recalculation (150ms)
- Memory efficient - only processes what's visible

**Usage:**
```javascript
const manager = new ViewportDiffManager(mergeView, {
  bufferLines: 100,           // Lines above/below to include
  scrollDebounceMs: 150,      // Debounce for scroll events
  largeSizeThreshold: 300000, // Auto-enable threshold
});
manager.enable();
```

**UI Toggle:** Settings → Performance → "🔍 Viewport Diff Mode"

### 2. Performance Mode

A bundle of settings optimized for large files:

| Setting | Normal | Performance Mode |
|---------|--------|------------------|
| scanLimit | 6000 | 1000 |
| highlightChanges | true | false |
| collapseUnchanged | false | true |
| timeout | 5000ms | 2000ms |

**Benefits:**
- Reduces character-level diff computation
- Collapses unchanged regions automatically
- Lower scan limit means faster (but less precise) diffing

**UI Toggle:** Settings → Performance → "⚡ Performance Mode"

### 3. Web Worker for Diff Calculations

**Location:** `v6/utils/diff-worker.js`

Heavy diff calculations are offloaded to a Web Worker for files >100KB:

**Supported operations:**
- `calculateDiff` - Full diff with semantic cleanup
- `countDiffs` - Just count differences (fast)
- `viewportDiff` - Diff for a specific range
- `parseAndStringify` - JSON parsing
- `sortAndStringify` - JSON sorting
- `csvToJsonString` - CSV conversion

**Usage:**
```javascript
diffWorker.postMessage({
  id: 'unique-id',
  action: 'countDiffs',
  payload: { leftText, rightText }
});

diffWorker.onmessage = (e) => {
  if (e.data.ok) {
    console.log('Diff count:', e.data.result.diffCount);
  }
};
```

### 4. Large File Detection

**Location:** `v6/utils/viewport_diff.js` → `LargeFileDetector`

Automatically analyzes content size and suggests optimizations:

| Threshold | Action |
|-----------|--------|
| >300KB | Auto-enable Viewport Diff Mode |
| >500KB | Show warning toast, suggest Performance Mode |
| >2MB | Show critical toast, auto-enable Performance Mode |

**Toast Notifications:**
Uses `PerformanceToast.show()` for non-blocking user notifications.

## Settings Storage

New settings in `SettingsManager`:

```javascript
{
  performanceMode: false,  // Enable optimized settings bundle
  viewportDiff: false,     // Only diff visible area
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Main Thread                           │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │ ViewportDiff    │  │ PerformanceMode             │   │
│  │ Manager         │  │ - scanLimit: 1000           │   │
│  │ - bufferLines   │  │ - highlightChanges: false   │   │
│  │ - debounce      │  │ - collapseUnchanged: true   │   │
│  └────────┬────────┘  └──────────────────────────────┘   │
│           │                                              │
│  ┌────────▼────────┐  ┌─────────────────────────────┐   │
│  │ LargeFile       │  │ PerformanceToast            │   │
│  │ Detector        │──│ - info/warning/critical     │   │
│  │ - thresholds    │  │ - auto-dismiss              │   │
│  └─────────────────┘  └─────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          │
                          │ postMessage
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Web Worker                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │ diff-worker.js                                   │    │
│  │ - calculateDiff                                  │    │
│  │ - countDiffs                                     │    │
│  │ - viewportDiff                                   │    │
│  │ - parseAndStringify                              │    │
│  │ - sortAndStringify                               │    │
│  │ - csvToJsonString                                │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## UI Changes

### Settings Panel

New "PERFORMANCE" section added after "DIFF ALGORITHM":

```
⚙️ Diff Settings
├── EDITOR SETTINGS
├── DIFF VIEW SETTINGS  
├── DIFF ALGORITHM
│   └── Scan Limit: [input]
└── PERFORMANCE
    ├── ⚡ Performance Mode [checkbox]
    ├── 🔍 Viewport Diff Mode [checkbox]
    └── 📊 Performance active: [status]
```

### Status Display

When viewport diff mode is active, the diff summary shows:
- `~X differences in view (viewport mode)` - For partial views
- `Found X differences` - When full document fits in buffer

## Testing

To test performance improvements:

1. **Large file test:**
   - Load a 500KB+ JSON file
   - Observe auto-detection toast
   - Check if Performance Mode is suggested

2. **Viewport diff test:**
   - Enable Viewport Diff Mode
   - Load large files
   - Scroll and observe recalculation
   - Check status shows "(viewport mode)"

3. **Worker test:**
   - Open DevTools → Sources → Workers
   - Load >100KB content
   - Observe worker activity in Network tab

## Browser Compatibility

- **Web Workers:** All modern browsers
- **requestAnimationFrame:** All modern browsers
- **importScripts (Worker):** All modern browsers

## Future Enhancements

1. **WebAssembly Diff** - Use `diff-wasm` for 2-5x speedup
2. **Diff Caching** - Cache computed diffs between scroll positions
3. **Streaming Diff** - Progressive diff calculation with partial results
4. **JSON Semantic Diff** - Use `jsondiffpatch` for structural comparison
