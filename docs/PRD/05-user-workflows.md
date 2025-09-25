# User Workflows and Use Cases

## 1. Primary Use Cases

### 1.1 JSON File Comparison
**Scenario**: Developer needs to compare two JSON configuration files
**Steps**:
1. Navigate to the application URL
2. Load first JSON file by drag-and-drop or file picker
3. Load second JSON file into right panel
4. Click "Format & Compare JSON" to see differences
5. Review highlighted differences in side-by-side view
6. Navigate between differences using keyboard or mouse

**Success Criteria**:
- Clear visual distinction between added/removed/modified content
- Accurate line-by-line alignment
- Responsive interface on different screen sizes

### 1.2 API Response Comparison
**Scenario**: QA engineer comparing API responses from different environments
**Steps**:
1. Copy API response from development environment
2. Paste into left panel
3. Copy API response from production environment
4. Paste into right panel
5. Enable "Sort JSON Keys" for consistent comparison
6. Use "Show Only Differences" to focus on changes
7. Share URL with team for collaboration

**Success Criteria**:
- Automatic JSON formatting and validation
- Key sorting eliminates ordering differences
- Shareable URL for team collaboration

### 1.3 Data Migration Validation
**Scenario**: Database administrator validating data migration results
**Steps**:
1. Export source data as JSON from original database
2. Export migrated data as JSON from new database
3. Load both datasets into comparison tool
4. Enable automatic CSV conversion if data exported as CSV
5. Use "Sort JSON Keys" to normalize structure
6. Review differences to identify migration issues
7. Export snapshot for audit trail

**Success Criteria**:
- Handles large datasets efficiently
- Automatic format conversion (CSV to JSON)
- Persistent snapshots for audit purposes

## 2. Content Input Workflows

### 2.1 File Upload Workflow
**Direct File Upload**:
1. Click file picker button in either panel
2. Select JSON, CSV, or text file from system
3. File content automatically loads into selected panel
4. Automatic format detection and conversion if needed
5. Error handling for unsupported or corrupted files

**Drag and Drop**:
1. Drag file from system file manager
2. Drop onto left or right editor panel
3. Visual feedback during drag operation
4. Automatic content loading and format detection
5. Support for multiple file formats

### 2.2 Text Input Workflow
**Manual Entry**:
1. Click in either editor panel
2. Type or paste JSON content directly
3. Automatic syntax highlighting during input
4. Real-time validation with error indicators
5. Auto-save to local storage for recovery

**Template Loading**:
1. Click template selector dropdown
2. Choose "Simple" or "Complex" example
3. Confirm overwrite of existing content
4. Template loads into both panels with sample differences
5. Edit templates as starting point for comparison

### 2.3 URL Import Workflow
**Shared URL Loading**:
1. Navigate to shared URL with content parameters
2. Automatic decompression and content restoration
3. Display content in both panels immediately
4. Clear URL parameters after successful load
5. Fall back to local storage if URL loading fails

**Snapshot Import**:
1. Click "Import Snapshot" button
2. Select .json.gz snapshot file
3. Automatic decompression and content restoration
4. Clear URL and update local storage
5. Error handling for corrupted snapshots

## 3. Content Processing Workflows

### 3.1 JSON Formatting Workflow
**Automatic Formatting**:
1. Paste or load unformatted JSON
2. Click "Format & Compare JSON" button
3. Automatic pretty-printing with 3-space indentation
4. Syntax error detection and user feedback
5. Preservation of data types and structure

**Python Literal Conversion**:
1. Paste Python dictionary or list syntax
2. Automatic detection of Python literals
3. Conversion of True/False/None to JSON equivalents
4. Complex number and datetime object handling
5. Error reporting for unconvertible syntax

### 3.2 CSV Processing Workflow
**Automatic CSV Detection**:
1. Drop CSV file onto editor panel
2. Automatic detection based on content heuristics
3. Separator detection (comma, tab, semicolon)
4. Header row identification and processing
5. Conversion to JSON array of objects

**Manual CSV Conversion**:
1. Paste CSV content into editor
2. Enable "Auto CSV→JSON" setting
3. Manual trigger or automatic conversion
4. Type coercion options for numbers/booleans
5. Error display for malformed CSV

### 3.3 Content Optimization Workflow
**Key Sorting**:
1. Load JSON with unsorted keys
2. Click "Sort JSON Keys" button
3. Recursive alphabetical sorting of all object keys
4. Array element sorting for object arrays
5. Reduced differences from key ordering

**Large File Processing**:
1. Load file larger than 150KB threshold
2. Automatic worker thread processing activation
3. Progress indication for heavy operations
4. Timeout protection with synchronous fallback
5. Memory-efficient processing for very large files

## 4. Comparison and Analysis Workflows

### 4.1 Side-by-Side Comparison
**Basic Comparison**:
1. Load content into both panels
2. Click "Format & Compare JSON" 
3. Visual highlighting of differences appears
4. Synchronized scrolling between panels
5. Line number alignment for easy reference

**Advanced Navigation**:
1. Use "Show Only Differences" to filter identical content
2. Navigate between difference chunks
3. Expand/collapse identical sections as needed
4. Use keyboard shortcuts for efficient navigation
5. Toggle scroll lock for independent panel scrolling

### 4.2 Difference Analysis
**Visual Analysis**:
1. Color-coded highlighting for different change types
2. Gutter indicators showing change locations
3. Contextual display of surrounding unchanged content
4. Clear distinction between additions and deletions
5. Nested structure preservation in diff view

**Detailed Inspection**:
1. Click on specific differences for detailed view
2. Line-by-line character comparison
3. Whitespace and formatting difference detection
4. Data type change identification
5. Structural change analysis (added/removed properties)

## 5. Sharing and Collaboration Workflows

### 5.1 URL Sharing Workflow
**Simple Sharing**:
1. Create comparison with content in both panels
2. Click "📋 Copy Share URL" button
3. Automatic compression and URL generation
4. URL copied to clipboard for easy sharing
5. Recipients access identical comparison view

**Large Content Sharing**:
1. Attempt URL sharing for large content
2. Automatic detection of URL length limits
3. Fallback to snapshot file download
4. Gzip compression for efficient transfer
5. Helper text with instructions for recipients

### 5.2 Snapshot Management
**Creating Snapshots**:
1. Set up comparison view as desired
2. Click "📋 Copy Share URL" (triggers snapshot for large content)
3. .json.gz file automatically downloads
4. Helper text copied to clipboard
5. File ready for sharing via email/messaging

**Loading Snapshots**:
1. Receive snapshot file from collaborator
2. Click "Import Snapshot" button
3. Select .json.gz file from downloads
4. Automatic decompression and loading
5. Exact restoration of original comparison view

## 6. Settings and Customization Workflows

### 6.1 User Preferences
**Basic Settings**:
1. Access options dropdown menu
2. Toggle "Auto CSV→JSON" conversion
3. Enable/disable "Auto Sort JSON Keys on Paste"
4. Settings automatically saved to localStorage
5. Preferences restored on subsequent visits

**Display Options**:
1. Toggle "Show Only Differences" mode
2. Enable/disable scroll synchronization
3. Switch between different CodeMirror themes
4. Adjust editor options (line wrapping, etc.)
5. Full-screen mode for detailed analysis

### 6.2 Template Customization
**Using Templates**:
1. Select template from dropdown
2. Confirm overwrite of existing content
3. Use template as starting point
4. Modify template content as needed
5. Templates provide quick setup for common scenarios

## 7. Error Recovery Workflows

### 7.1 Content Recovery
**Auto-save Recovery**:
1. Browser crash or accidental close
2. Return to application URL
3. Automatic restoration from localStorage
4. 30-day expiry for stored content
5. Manual clearing of stored data when needed

**Import Failure Recovery**:
1. Failed snapshot or URL import
2. Clear error message with recovery options
3. Fallback to previous content state
4. Manual content restoration options
5. Retry mechanisms for temporary failures

### 7.2 Parsing Error Handling
**JSON Syntax Errors**:
1. Invalid JSON pasted into editor
2. Clear error message with line number
3. Syntax highlighting shows error location
4. Suggestion to use flexible parser
5. Option to continue with partial parsing

**CSV Conversion Errors**:
1. Malformed CSV content detected
2. Detailed error message with problematic line
3. Option to continue with best-effort parsing
4. Manual correction suggestions
5. Fallback to treating as plain text

## 8. Mobile and Accessibility Workflows

### 8.1 Mobile Usage
**Touch Interface**:
1. Responsive design adapts to screen size
2. Touch-friendly button sizes and spacing
3. Gesture support for scrolling and navigation
4. Mobile-optimized share options
5. Pinch-to-zoom for detailed inspection

**Mobile-Specific Features**:
1. Web Share API integration for native sharing
2. File access through mobile browser file picker
3. Clipboard integration for easy copying
4. Orientation change handling
5. Performance optimization for mobile processors

### 8.2 Accessibility Support
**Keyboard Navigation**:
1. Full keyboard accessibility without mouse
2. Tab order follows logical interface flow
3. Keyboard shortcuts for common actions
4. Focus indicators clearly visible
5. Screen reader compatibility

**Visual Accessibility**:
1. High contrast mode support
2. Scalable fonts for different visual needs
3. Color-blind friendly difference highlighting
4. Clear visual focus indicators
5. ARIA labels for screen readers

## 9. Performance-Optimized Workflows

### 9.1 Large File Handling
**Automatic Optimization**:
1. File size detection on load
2. Worker thread activation for >150KB content
3. Progressive processing with user feedback
4. Memory management for very large files
5. Graceful degradation for performance constraints

**User-Controlled Performance**:
1. Option to disable heavy features for speed
2. Selective feature activation based on need
3. Clear indication of performance-intensive operations
4. Cancel options for long-running operations
5. Performance feedback and recommendations

### 9.2 Network-Optimized Workflows
**Offline Usage**:
1. Full functionality without internet connection
2. Local library files for core features
3. Enhanced features when CDN libraries available
4. Graceful degradation for missing libraries
5. Clear indication of available vs unavailable features

**Efficient Loading**:
1. Lazy loading of optional libraries
2. CDN with local fallback for reliability
3. Compression for large content sharing
4. Minimal initial page load requirements
5. Progressive enhancement as libraries load