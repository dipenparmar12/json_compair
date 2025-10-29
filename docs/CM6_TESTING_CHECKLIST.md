# CodeMirror 6 Testing Checklist

**Date**: October 29, 2025  
**Version**: CM6 6.0.1 with @codemirror/merge 6.7.2  
**Test URL**: http://localhost:8000/index-cm6.html

## ✅ Basic Functionality Tests

### Page Load
- [ ] Page loads without errors in console
- [ ] Both editor panes are visible
- [ ] Diff status bar shows "Ready to compare JSON"
- [ ] All toolbar buttons are present

### JSON Formatting
1. [ ] Paste malformed JSON in left pane
2. [ ] Paste malformed JSON in right pane
3. [ ] Click "Format JSON"
4. [ ] Both panes should show formatted JSON

**Test Case**:
```
Left: {"name":"Alice","age":30}
Right: {"name":"Bob","age":25}
```

### Key Sorting
1. [ ] Enter unordered JSON in both panes
2. [ ] Click "Sort Keys"
3. [ ] Keys should be alphabetically sorted

**Test Case**:
```json
{"z": 1, "a": 2, "m": {"y": 3, "b": 4}}
```
Expected: `{"a": 2, "m": {"b": 4, "y": 3}, "z": 1}`

### Share URL
1. [ ] Enter different content in both panes
2. [ ] Click "📋 Share URL"
3. [ ] URL should be copied to clipboard
4. [ ] Open URL in new tab
5. [ ] Content should be restored

### Templates
1. [ ] Click "Examples"
2. [ ] Select option "1" (Simple)
3. [ ] Both panes should load simple template
4. [ ] Repeat with option "2" (Complex)

### Clear Functionality
1. [ ] Enter content in both panes
2. [ ] "Clear All" button should appear
3. [ ] Click "Clear All"
4. [ ] Confirm dialog
5. [ ] Both panes should be empty

## ✅ Diff Visualization Tests

### Basic Diff
**Test Case**:
```
Left:  {"name": "Alice", "age": 30, "city": "NYC"}
Right: {"name": "Bob",   "age": 30, "city": "LA"}
```

**Expected**:
- [ ] Changed values highlighted (name, city)
- [ ] Identical values not highlighted (age)
- [ ] Diff status shows "Found X differences"
- [ ] Red/green color coding visible

### Git-Style Alignment
**Test Case**:
```
Left:  {"a": 1, "b": 2, "c": 3}
Right: {"a": 1, "d": 4}
```

**Expected**:
- [ ] Common lines aligned ({"a": 1})
- [ ] Deletions highlighted in red ("b": 2, "c": 3)
- [ ] Insertions highlighted in green ("d": 4)
- [ ] Gap area shows visual connections

### Array Comparison
**Test Case**:
```
Left:  [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
Right: [{"id": 1, "name": "Alice"}, {"id": 3, "name": "Charlie"}]
```

**Expected**:
- [ ] Array items compared element-by-element
- [ ] Changed items highlighted
- [ ] Diff count accurate

## ✅ Editor Features

### Copy Functionality
1. [ ] Hover over left pane
2. [ ] "Copy" button should appear
3. [ ] Click "Copy"
4. [ ] Button text changes to "Copied!"
5. [ ] Content is in clipboard
6. [ ] Repeat for right pane

### Content Persistence
1. [ ] Enter content in both panes
2. [ ] Refresh page
3. [ ] Content should be restored from localStorage

### Keyboard Navigation
- [ ] Tab key works
- [ ] Ctrl/Cmd + A selects all
- [ ] Ctrl/Cmd + C copies
- [ ] Ctrl/Cmd + V pastes

## ✅ Performance Tests

### Large File Handling
**Test Case**: 1MB JSON file (approximately 20,000 lines)

1. [ ] Paste large JSON in left pane
2. [ ] Page remains responsive
3. [ ] Formatting works without freezing
4. [ ] Diff calculation completes

**Acceptable Performance**:
- Load time: < 1 second
- Format time: < 2 seconds
- Diff calculation: < 3 seconds

### Rapid Typing
1. [ ] Type rapidly in editor
2. [ ] No input lag
3. [ ] Diff updates smoothly
4. [ ] localStorage saves without issues

## ✅ Browser Compatibility

### Chrome/Edge
- [ ] All features work
- [ ] No console errors
- [ ] Visual appearance correct

### Firefox
- [ ] All features work
- [ ] No console errors
- [ ] Visual appearance correct

### Safari
- [ ] All features work
- [ ] No console errors
- [ ] Visual appearance correct

## ✅ Integration Tests

### URL Manager Integration
1. [ ] utils.js loaded correctly
2. [ ] URLManager.loadFromURL() works
3. [ ] URLManager.saveToStorage() works
4. [ ] URLManager.clearURL() works

### JSON Parser Integration
1. [ ] json_utils.js loaded correctly
2. [ ] parseFlexibleJSON() handles Python syntax
3. [ ] parseFlexibleJSON() handles datetime objects

### CSV Integration (Future)
- [ ] CSV utils available
- [ ] Auto-conversion ready
- [ ] Drag-and-drop prepared

## 🐛 Known Issues

### Critical
- None found yet

### Minor
- [ ] Module loading requires modern browser
- [ ] No IE11 support (expected)
- [ ] Import map requires Chrome 89+ / Firefox 108+

### Feature Gaps (vs CM5)
- [ ] CSV auto-conversion not yet implemented
- [ ] File drag-and-drop not yet implemented
- [ ] Snapshot import/export not yet implemented
- [ ] Advanced settings dropdown not yet implemented
- [ ] Show Only Differences mode not yet implemented

## 📊 Test Results Summary

**Date Tested**: _________________

**Tester**: _________________

**Browser**: _________________

**Pass Rate**: _____ / _____ (_____%)

**Critical Failures**: _________________

**Notes**:
```




```

## 🚀 Next Actions

Based on test results:

1. [ ] Fix critical bugs
2. [ ] Document workarounds for known issues
3. [ ] Implement missing features
4. [ ] Optimize performance bottlenecks
5. [ ] Update documentation

## 📝 Sign-Off

**Tested By**: _________________

**Date**: _________________

**Status**: ⬜ Approved ⬜ Needs Work

**Comments**:
```




```
