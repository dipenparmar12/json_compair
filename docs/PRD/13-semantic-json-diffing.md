# Semantic JSON Diffing and Normalization

## Overview

Semantic JSON Diffing produces diffs that reflect real data changes by parsing, normalizing, and comparing JSON structures instead of raw text. This approach reduces noise from formatting differences and key ordering, allowing users to focus on true structural or value changes.

## Objective

Reduce noise from formatting, whitespace, and key-order differences so users see only true structural or value changes. Enable meaningful comparison of JSON data regardless of how it's formatted or serialized.

## Stakeholders

- **API Developers**: Comparing API responses across versions and environments
- **QA Engineers**: Validating configuration changes and test fixtures  
- **Data Engineers**: Analyzing data pipeline transformations and migrations
- **JSON Reviewers**: Reviewing infrastructure configurations and application settings
- **DevOps Teams**: Validating deployment configurations and infrastructure as code

## User Personas

### 1. API Developer
- **Goal**: Compare API responses to detect actual data changes vs formatting changes
- **Pain Point**: Text diffs flag insignificant formatting differences as changes
- **Use Case**: Validate API backward compatibility after refactoring

### 2. Configuration Reviewer  
- **Goal**: Review changes to JSON configuration files
- **Pain Point**: Key reordering creates diff noise, obscuring real changes
- **Use Case**: Approve production configuration changes with confidence

### 3. Operations Engineer
- **Goal**: Validate infrastructure JSON configurations before deployment
- **Pain Point**: Automated tools reformat JSON, creating false positive changes
- **Use Case**: Ensure infrastructure changes are intentional and correct

## Core Problems Addressed

### 1. Text Diff Noise
Current text-based comparison flags non-functional changes:
- Key reordering: `{"a": 1, "b": 2}` vs `{"b": 2, "a": 1}`
- Whitespace differences: formatting variations create false positives
- Number format variations: `1.0` vs `1` vs `1.00`

### 2. Reviewer Time Waste
Reviewers spend time analyzing formatting changes instead of focusing on actual data changes.

### 3. Missed Real Changes
Important structural changes can be obscured by formatting noise.

## Primary Features

### 1. JSON Structure Parsing
- Parse JSON inputs into Abstract Syntax Tree (AST) like structures
- Maintain semantic meaning while abstracting formatting details
- Handle malformed JSON with clear error reporting

### 2. Data Canonicalization
```javascript
// Example canonicalization process
const canonicalizeJSON = (obj) => {
  return {
    // Sort object keys consistently
    keys: sortObjectKeys(obj),
    
    // Normalize number formats
    numbers: normalizeNumbers(obj), // 1.0 → 1, 1.00 → 1
    
    // Standardize boolean representations
    booleans: normalizeBooleans(obj), // "true" → true
    
    // Normalize null variations
    nulls: normalizeNulls(obj), // "null", undefined → null
    
    // Standardize date formats
    dates: normalizeDates(obj), // Multiple formats → ISO 8601
    
    // Handle array ordering based on configuration
    arrays: normalizeArrays(obj) // Optional: treat as sets vs ordered
  };
};
```

### 3. Semantic Comparison Engine
- Compare canonicalized structures instead of raw text
- Detect semantic changes: added/removed keys, value changes, type changes
- Generate structured diff output with precise change locations

### 4. Array Handling Options
```javascript
// Configurable array comparison modes
const arrayComparisonModes = {
  ORDERED: 'Compare arrays as ordered lists (default)',
  SET: 'Compare arrays as unordered sets',
  INDEXED: 'Compare arrays by index with position awareness',
  SEMANTIC: 'Match array elements by content similarity'
};
```

### 5. Visual Semantic Diff Output
- Tree view showing only meaningful changes
- Highlight semantic differences with precise paths
- Inline old → new value display
- Collapsible sections for large structures

## Functional Requirements

### Core Functionality
1. **Accept JSON Inputs**: Support file upload, paste, and direct input
2. **Parse & Validate**: Clear parse error messages with line numbers
3. **Canonicalize**: Deterministic normalization of JSON structures
4. **Compare**: Semantic comparison producing structured diff results
5. **Display Results**: Visual tree with highlighted changes

### Configuration Options
```javascript
const semanticDiffConfig = {
  // Key ordering
  keyOrderSensitive: false,     // Ignore key reordering by default
  
  // Numeric comparison
  numericTolerance: 0,          // Exact match vs fuzzy tolerance
  numericNormalization: true,   // 1.0 === 1
  
  // Array handling  
  arrayComparisonMode: 'ORDERED', // 'ORDERED', 'SET', 'INDEXED', 'SEMANTIC'
  
  // Path ignoring
  ignorePaths: [],              // Paths to exclude from comparison
  
  // Type coercion
  strictTypes: false,           // "1" !== 1 when true
  
  // Date handling
  dateNormalization: true,      // Normalize date formats
  dateFormats: ['ISO8601', 'timestamp', 'custom'],
  
  // Null handling
  nullNormalization: true       // null === undefined when false
};
```

### Ignore Path Configuration
```javascript
// Support for ignoring specific paths
const ignoreConfig = {
  paths: [
    'metadata.timestamp',        // Ignore timestamp fields
    '*.id',                     // Ignore all id fields
    'config.*.debug',          // Ignore debug flags in config objects
    'data[*].created_at'       // Ignore created timestamps in arrays
  ],
  
  patterns: [
    /^_.*$/,                   // Ignore fields starting with underscore
    /.*_internal$/,            // Ignore internal fields
    /.*password.*$/i           // Ignore password-related fields (case insensitive)
  ]
};
```

## Non-Functional Requirements

### Performance Requirements
- **Client-Side Processing**: All comparison occurs in browser for privacy
- **Large File Handling**: Support JSON documents up to 20MB
- **Response Time**: <2 seconds for documents up to 5MB
- **Memory Efficiency**: Deterministic memory usage scaling

### Scalability Requirements
```javascript
// Performance benchmarks and limits
const performanceLimits = {
  maxDocumentSize: 20 * 1024 * 1024,  // 20MB
  maxNestingDepth: 50,                 // Prevent stack overflow
  maxArrayLength: 100000,              // Large array handling
  maxObjectKeys: 10000,                // Large object handling
  
  // Response time targets
  smallDoc: { size: '< 1MB', time: '< 500ms' },
  mediumDoc: { size: '1-5MB', time: '< 2s' },
  largeDoc: { size: '5-20MB', time: '< 10s' }
};
```

### Accessibility Requirements
- **Screen Reader Support**: Semantic HTML with ARIA labels
- **Keyboard Navigation**: Full keyboard accessibility for all features
- **High Contrast**: Support for high contrast display modes
- **Responsive Design**: Mobile and tablet compatibility

## Acceptance Criteria

### Core Functionality Tests
```javascript
// Test cases that must pass
const acceptanceCriteria = [
  {
    name: 'Key reordering shows no change',
    left: '{"a": 1, "b": 2}',
    right: '{"b": 2, "a": 1}',
    expected: { changes: [], semanticallyIdentical: true }
  },
  
  {
    name: 'Whitespace differences show no change',
    left: '{"a":1}',
    right: '{\n  "a": 1\n}',
    expected: { changes: [], semanticallyIdentical: true }
  },
  
  {
    name: 'Value changes detected correctly',
    left: '{"a": 1}',
    right: '{"a": 2}',
    expected: {
      changes: [{
        path: 'a',
        changeType: 'modified',
        oldValue: 1,
        newValue: 2
      }],
      semanticallyIdentical: false
    }
  },
  
  {
    name: 'Ignored paths suppress diffs',
    left: '{"data": 1, "timestamp": "2024-01-01"}',
    right: '{"data": 1, "timestamp": "2024-01-02"}',
    config: { ignorePaths: ['timestamp'] },
    expected: { changes: [], semanticallyIdentical: true }
  }
];
```

## User Experience Design

### Main Interface Components
```html
<!-- Semantic Diff Configuration Panel -->
<div class="bg-white border border-gray-200 rounded-lg p-4 mb-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Semantic Comparison Settings</h3>
  
  <!-- Key Order Sensitivity -->
  <div class="mb-4">
    <label class="inline-flex items-center">
      <input type="checkbox" id="ignore-key-order" checked
             class="rounded border-gray-300 text-blue-600 shadow-sm">
      <span class="ml-2 text-sm text-gray-700">Ignore key ordering differences</span>
    </label>
  </div>
  
  <!-- Array Comparison Mode -->
  <div class="mb-4">
    <label class="block text-sm font-medium text-gray-700 mb-2">Array Comparison</label>
    <select class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
      <option value="ordered">Ordered Lists (position matters)</option>
      <option value="set">Unordered Sets (position ignored)</option>
      <option value="indexed">Indexed Comparison</option>
      <option value="semantic">Semantic Matching</option>
    </select>
  </div>
  
  <!-- Numeric Tolerance -->
  <div class="mb-4">
    <label class="block text-sm font-medium text-gray-700 mb-2">Numeric Tolerance</label>
    <div class="flex items-center space-x-2">
      <input type="number" id="numeric-tolerance" value="0" step="0.001" min="0"
             class="block w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm">
      <span class="text-sm text-gray-600">Absolute difference threshold</span>
    </div>
  </div>
  
  <!-- Ignore Paths -->
  <div class="mb-4">
    <label class="block text-sm font-medium text-gray-700 mb-2">Ignore Paths</label>
    <textarea id="ignore-paths" rows="3" placeholder="metadata.timestamp&#10;*.id&#10;config.*.debug"
              class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"></textarea>
    <p class="text-xs text-gray-500 mt-1">One path per line. Use * for wildcards.</p>
  </div>
</div>
```

### Semantic Diff Tree View
```html
<!-- Tree View for Semantic Differences -->
<div class="semantic-diff-tree">
  <div class="tree-node">
    <div class="node-header" data-path="root">
      <span class="toggle-icon">▼</span>
      <span class="node-name">Root Object</span>
      <span class="change-count badge bg-blue-100 text-blue-800">3 changes</span>
    </div>
    
    <div class="node-children ml-4">
      <!-- Added Key -->
      <div class="tree-node added">
        <span class="node-icon text-green-600">+</span>
        <span class="node-name font-mono">"newField"</span>
        <span class="node-value text-green-600">"added value"</span>
        <span class="node-path text-gray-500 text-xs">root.newField</span>
      </div>
      
      <!-- Modified Value -->
      <div class="tree-node modified">
        <span class="node-icon text-blue-600">~</span>
        <span class="node-name font-mono">"existingField"</span>
        <div class="value-change">
          <span class="old-value text-red-600 line-through">"old value"</span>
          <span class="change-arrow text-gray-400">→</span>
          <span class="new-value text-green-600">"new value"</span>
        </div>
        <span class="node-path text-gray-500 text-xs">root.existingField</span>
      </div>
      
      <!-- Removed Key -->
      <div class="tree-node removed">
        <span class="node-icon text-red-600">-</span>
        <span class="node-name font-mono">"removedField"</span>
        <span class="node-value text-red-600">"removed value"</span>
        <span class="node-path text-gray-500 text-xs">root.removedField</span>
      </div>
    </div>
  </div>
</div>
```

### Machine-Readable Diff Output
```javascript
// Structured diff output schema
const diffOutputSchema = {
  metadata: {
    comparisonType: 'semantic',
    timestamp: '2024-01-01T12:00:00Z',
    configuration: {
      ignoreKeyOrder: true,
      numericTolerance: 0,
      arrayMode: 'ordered'
    }
  },
  
  summary: {
    totalChanges: 3,
    added: 1,
    modified: 1, 
    removed: 1,
    semanticallyIdentical: false
  },
  
  changes: [
    {
      path: 'root.newField',
      changeType: 'added',
      newValue: 'added value',
      valueType: 'string',
      metadata: {
        depth: 1,
        parentType: 'object'
      }
    },
    {
      path: 'root.existingField',
      changeType: 'modified',
      oldValue: 'old value',
      newValue: 'new value',
      valueType: 'string',
      metadata: {
        depth: 1,
        parentType: 'object'
      }
    },
    {
      path: 'root.removedField',
      changeType: 'removed',
      oldValue: 'removed value',
      valueType: 'string',
      metadata: {
        depth: 1,
        parentType: 'object'
      }
    }
  ]
};
```

## Implementation Architecture

### Core Components
```javascript
// Main semantic diff engine
class SemanticJSONDiffer {
  constructor(config = {}) {
    this.config = this.validateConfig(config);
    this.canonicalizer = new JSONCanonicalizer(this.config);
    this.comparer = new SemanticComparer(this.config);
  }
  
  compare(leftJSON, rightJSON) {
    try {
      // Parse inputs
      const leftParsed = this.parseJSON(leftJSON);
      const rightParsed = this.parseJSON(rightJSON);
      
      // Canonicalize structures
      const leftCanonical = this.canonicalizer.canonicalize(leftParsed);
      const rightCanonical = this.canonicalizer.canonicalize(rightParsed);
      
      // Perform semantic comparison
      const diff = this.comparer.compare(leftCanonical, rightCanonical);
      
      return {
        success: true,
        diff: diff,
        metadata: this.generateMetadata(leftJSON, rightJSON)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        parseErrors: this.extractParseErrors(error)
      };
    }
  }
}

// JSON canonicalization engine
class JSONCanonicalizer {
  canonicalize(obj, path = 'root') {
    if (obj === null || obj === undefined) {
      return this.normalizeNull(obj);
    }
    
    if (typeof obj === 'number') {
      return this.normalizeNumber(obj);
    }
    
    if (typeof obj === 'boolean') {
      return this.normalizeBoolean(obj);
    }
    
    if (typeof obj === 'string') {
      return this.normalizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return this.canonicalizeArray(obj, path);
    }
    
    if (typeof obj === 'object') {
      return this.canonicalizeObject(obj, path);
    }
    
    return obj;
  }
  
  canonicalizeObject(obj, path) {
    const result = {};
    
    // Sort keys for deterministic comparison
    const sortedKeys = Object.keys(obj).sort();
    
    for (const key of sortedKeys) {
      const keyPath = `${path}.${key}`;
      
      // Skip ignored paths
      if (this.shouldIgnorePath(keyPath)) {
        continue;
      }
      
      result[key] = this.canonicalize(obj[key], keyPath);
    }
    
    return result;
  }
  
  canonicalizeArray(arr, path) {
    const result = arr.map((item, index) => {
      const itemPath = `${path}[${index}]`;
      return this.canonicalize(item, itemPath);
    });
    
    // Apply array comparison mode
    if (this.config.arrayComparisonMode === 'SET') {
      return this.normalizeArrayAsSet(result);
    }
    
    return result;
  }
}
```

## Error Handling

### Parse Error Display
```javascript
// Enhanced error handling for malformed JSON
class ParseErrorHandler {
  static formatParseError(error, jsonString) {
    const lines = jsonString.split('\n');
    const errorMatch = error.message.match(/position (\d+)/);
    
    if (errorMatch) {
      const position = parseInt(errorMatch[1]);
      const { line, column } = this.getLineAndColumn(jsonString, position);
      
      return {
        message: error.message,
        line: line + 1,
        column: column + 1,
        context: this.getErrorContext(lines, line),
        suggestion: this.getSuggestion(error.message)
      };
    }
    
    return {
      message: error.message,
      context: 'Unable to parse JSON structure'
    };
  }
  
  static getErrorContext(lines, errorLine, contextSize = 2) {
    const start = Math.max(0, errorLine - contextSize);
    const end = Math.min(lines.length, errorLine + contextSize + 1);
    
    return lines.slice(start, end).map((line, index) => ({
      lineNumber: start + index + 1,
      content: line,
      isError: start + index === errorLine
    }));
  }
}
```

## Testing Strategy

### Unit Test Coverage
```javascript
describe('Semantic JSON Diff', () => {
  describe('Canonicalization', () => {
    test('sorts object keys consistently', () => {
      const input = { z: 1, a: 2, m: 3 };
      const result = canonicalizer.canonicalize(input);
      expect(Object.keys(result)).toEqual(['a', 'm', 'z']);
    });
    
    test('normalizes numeric formats', () => {
      const cases = [
        { input: 1.0, expected: 1 },
        { input: 1.00, expected: 1 },
        { input: '1', expected: 1 } // with type coercion
      ];
      
      cases.forEach(({ input, expected }) => {
        expect(canonicalizer.normalizeNumber(input)).toBe(expected);
      });
    });
  });
  
  describe('Array Handling', () => {
    test('handles arrays as ordered lists by default', () => {
      const left = [1, 2, 3];
      const right = [1, 3, 2];
      const diff = differ.compare(left, right);
      expect(diff.changes).toHaveLength(2); // Position changes
    });
    
    test('handles arrays as sets when configured', () => {
      const config = { arrayComparisonMode: 'SET' };
      const differ = new SemanticJSONDiffer(config);
      const left = [1, 2, 3];
      const right = [3, 1, 2];
      const diff = differ.compare(left, right);
      expect(diff.changes).toHaveLength(0); // No changes in set mode
    });
  });
  
  describe('Ignore Rules', () => {
    test('ignores specified paths', () => {
      const config = { ignorePaths: ['metadata.timestamp'] };
      const left = { data: 1, metadata: { timestamp: '2024-01-01' } };
      const right = { data: 1, metadata: { timestamp: '2024-01-02' } };
      const diff = new SemanticJSONDiffer(config).compare(left, right);
      expect(diff.changes).toHaveLength(0);
    });
  });
});
```

## Privacy & Security

### Client-Side Processing
- **Default Behavior**: All processing occurs in browser
- **Data Privacy**: No JSON data transmitted to servers
- **Optional Server Mode**: Available for very large files (>20MB) with explicit opt-in

### Security Considerations
- **Input Validation**: Sanitize all user inputs
- **Memory Limits**: Prevent memory exhaustion attacks
- **Processing Limits**: Timeout protection for complex operations

## Performance Optimization

### Memory Management
```javascript
class MemoryOptimizedDiffer {
  constructor() {
    this.memoryMonitor = new MemoryMonitor();
    this.chunkSize = 1024 * 1024; // 1MB chunks
  }
  
  compareWithMemoryOptimization(leftJSON, rightJSON) {
    const leftSize = JSON.stringify(leftJSON).length;
    const rightSize = JSON.stringify(rightJSON).length;
    const totalSize = leftSize + rightSize;
    
    if (totalSize > this.chunkSize) {
      return this.chunkedComparison(leftJSON, rightJSON);
    }
    
    return this.standardComparison(leftJSON, rightJSON);
  }
  
  chunkedComparison(leftJSON, rightJSON) {
    // Process large JSON in chunks to manage memory
    const leftChunks = this.chunkObject(leftJSON);
    const rightChunks = this.chunkObject(rightJSON);
    
    const results = [];
    
    for (let i = 0; i < Math.max(leftChunks.length, rightChunks.length); i++) {
      const leftChunk = leftChunks[i] || {};
      const rightChunk = rightChunks[i] || {};
      
      const chunkResult = this.standardComparison(leftChunk, rightChunk);
      results.push(chunkResult);
      
      // Monitor memory usage
      if (this.memoryMonitor.isMemoryHigh()) {
        this.memoryMonitor.forceGarbageCollection();
      }
    }
    
    return this.mergeChunkResults(results);
  }
}
```

## Deliverables

### 1. Interactive UI
- Semantic diff configuration panel with TailwindCSS styling
- Real-time tree view showing semantic changes
- Collapsible sections for large structures
- Search and filter capabilities within diff results

### 2. Machine-Readable Output
- JSON diff export following defined schema
- Copyable structured diff data
- Integration with existing export functionality

### 3. Permalink Sharing
- URL sharing of normalized inputs and diff results
- Compressed sharing for large comparisons
- Configuration preservation in shared links

### 4. Documentation & Help
- User guide for semantic comparison features
- Configuration option explanations
- Best practices and use case examples

## Success Metrics

### Functional Metrics
- **Accuracy**: 99%+ correct semantic difference detection
- **Coverage**: Handle 95%+ of valid JSON structures
- **Reliability**: Graceful handling of malformed JSON

### Performance Metrics
- **Speed**: <2 seconds for 5MB documents
- **Memory**: Predictable memory usage scaling
- **Responsiveness**: UI remains interactive during processing

### User Experience Metrics
- **Discoverability**: Users can find and enable semantic mode
- **Clarity**: Diff results clearly show only meaningful changes
- **Efficiency**: Reduce review time by 70% compared to text diffs