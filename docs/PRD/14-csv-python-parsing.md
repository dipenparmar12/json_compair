# CSV to JSON Conversion with Python Literal Parsing

## Overview

The CSV to JSON conversion system provides intelligent data type recognition and Python literal parsing capabilities. This document specifies the precise behavior for handling Python-style boolean/null literals, preserving string integrity, and managing whitespace during conversion.

## Core Conversion Rules

### 1. Explicit Boolean/None Handling

The system recognizes and converts specific Python literals to JSON equivalents:

```javascript
// Exact String Matches (case-sensitive)
'None'  → null     // Python None becomes JSON null
'True'  → true     // Python True becomes JSON true  
'False' → false    // Python False becomes JSON false

// Non-matches remain as strings
'none'  → "none"   // lowercase stays string
'TRUE'  → "TRUE"   // uppercase stays string
'true'  → "true"   // lowercase stays string
'false' → "false"  // lowercase stays string
```

### 2. Empty Cell Handling

Empty cells in CSV data are processed as follows:

```javascript
// CSV Input Processing
""           → ""     // Empty string remains empty string
,field2,     → ""     // Missing values become empty strings
"  "         → "  "   // Whitespace-only preserved as string

// Type Coercion Mode (when enabled)
""           → null   // Empty strings converted to null
,field2,     → null   // Missing values become null
"  "         → null   // Whitespace-only trimmed and nullified
```

### 3. String Preservation Rules

Original string values are preserved unless they match exact conversion patterns:

```javascript
// Preserve Original Strings
"lowercase true"     → "lowercase true"    // Compound strings preserved
"true value"         → "true value"        // Partial matches preserved  
"It's true"          → "It's true"         // Context-dependent preserved
"really false"       → "really false"      // Compound preserved

// Only Exact Standalone Matches Convert
"True"               → true                // Exact match converts
"False"              → false               // Exact match converts
"None"               → null                // Exact match converts
```

### 4. Whitespace Handling

Whitespace management follows preservation principles:

```javascript
// Original Preservation (default)
"  True  "           → "  True  "          // Whitespace preserved in strings
"None   "            → "None   "           // Trailing space preserved

// Comparison Mode (for matching)
"  True  ".trim()    → "True" → true       // Trimmed for comparison only
"  None  ".trim()    → "None" → null       // Trimmed for comparison only

// Return Behavior
- Return original unstripped when no conversion applies
- Strip only for comparison logic, not final output
- Maintain exact whitespace in non-converting strings
```

## Technical Implementation

### Core Parser Function

```javascript
function parseFlexibleValue(value, options = {}) {
  const { typeCoercion = false, preserveWhitespace = true } = options;
  
  // Handle empty values
  if (value === "" || value == null) {
    return typeCoercion ? null : "";
  }
  
  // Get comparison value (trimmed for matching)
  const trimmedValue = typeof value === 'string' ? value.trim() : value;
  
  // Exact Python literal matches (case-sensitive)
  switch (trimmedValue) {
    case 'None':
      return null;
    case 'True':
      return true;
    case 'False':
      return false;
  }
  
  // Number conversion (if not a Python literal)
  if (typeCoercion && !isNaN(trimmedValue) && trimmedValue !== '') {
    const num = Number(trimmedValue);
    if (isFinite(num)) return num;
  }
  
  // Return original value with whitespace preserved
  return preserveWhitespace ? value : trimmedValue;
}
```

### CSV Processing Pipeline

```javascript
function csvToJSON(csvContent, options = {}) {
  const { 
    separator = ',',
    typeCoercion = true,
    preserveWhitespace = true,
    headers = null 
  } = options;
  
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headerLine = headers || parseCSVLine(lines[0]);
  const dataLines = lines.slice(headers ? 0 : 1);
  
  return dataLines.map(line => {
    const values = parseCSVLine(line, separator);
    const record = {};
    
    headerLine.forEach((header, index) => {
      const rawValue = values[index] || "";
      record[header] = parseFlexibleValue(rawValue, {
        typeCoercion,
        preserveWhitespace
      });
    });
    
    return record;
  });
}
```

## Sample Conversion Examples

### Input CSV
```csv
name,age,active,metadata,score,empty_field
John,25,True,{"key": "value"},85.5,
Jane,30,False,None,92.0,""
Bob,None,true,"complex string",98,  
```

### Output JSON (with type coercion)
```json
[
  {
    "name": "John",
    "age": 25,
    "active": true,
    "metadata": "{\"key\": \"value\"}",
    "score": 85.5,
    "empty_field": null
  },
  {
    "name": "Jane", 
    "age": 30,
    "active": false,
    "metadata": null,
    "score": 92.0,
    "empty_field": null
  },
  {
    "name": "Bob",
    "age": null,
    "active": "true",
    "metadata": "complex string",
    "score": 98,
    "empty_field": null
  }
]
```

## Key Behavior Specifications

### Conversion Priority Order
1. **Empty Value Check**: Handle null/empty before other processing
2. **Exact Literal Match**: Check for exact Python literals (case-sensitive)
3. **Numeric Conversion**: Apply number parsing if type coercion enabled
4. **String Preservation**: Return original string with whitespace intact

### Case Sensitivity Rules
- **Python Literals**: Exact case-sensitive matching only
  - `'True'` → `true` ✓
  - `'true'` → `"true"` (remains string)
  - `'TRUE'` → `"TRUE"` (remains string)

### Whitespace Preservation
- **Input Preservation**: Original whitespace maintained in output
- **Comparison Logic**: Trimmed values used for matching logic only
- **Mixed Behavior**: `"  True  "` becomes `true` (literal recognized after trim)

### Error Handling
- **Invalid JSON**: Malformed JSON strings preserved as strings
- **Parse Errors**: Return original value rather than throwing exceptions
- **Type Mismatches**: Graceful fallback to string representation

## Integration with JSON Parser

### Smart JSON Detection Within Values
```javascript
// CSV field contains stringified JSON
metadata: '{"user": {"name": "John", "active": True}}'

// Step 1: Detect JSON structure
const isJSONLike = /^\s*[{\[]/.test(value);

// Step 2: Apply Python literal conversion
const processedJSON = value.replace(
  /\b(True|False|None)\b/g,
  match => ({ True: 'true', False: 'false', None: 'null' }[match])
);

// Step 3: Parse as JSON
try {
  return JSON.parse(processedJSON);
} catch {
  return value; // Return original on parse failure
}
```

### Compound Structure Handling
Uses `ast.literal_eval` equivalent for complex Python structures:
```javascript
// Input: "{'name': 'John', 'active': True, 'data': None}"
// Output: {"name": "John", "active": true, "data": null}

function pythonLiteralEval(pythonString) {
  return pythonString
    .replace(/'/g, '"')           // Single quotes to double quotes
    .replace(/\bTrue\b/g, 'true') // Python True to JSON true
    .replace(/\bFalse\b/g, 'false') // Python False to JSON false  
    .replace(/\bNone\b/g, 'null'); // Python None to JSON null
}
```

## Testing Requirements

### Unit Test Cases
```javascript
describe('CSV Python Parsing', () => {
  test('Exact boolean conversion', () => {
    expect(parseFlexibleValue('True')).toBe(true);
    expect(parseFlexibleValue('False')).toBe(false); 
    expect(parseFlexibleValue('None')).toBe(null);
  });
  
  test('Case sensitivity preservation', () => {
    expect(parseFlexibleValue('true')).toBe('true');
    expect(parseFlexibleValue('TRUE')).toBe('TRUE');
    expect(parseFlexibleValue('false')).toBe('false');
  });
  
  test('Empty cell handling', () => {
    expect(parseFlexibleValue('')).toBe('');
    expect(parseFlexibleValue('', {typeCoercion: true})).toBe(null);
  });
  
  test('Whitespace preservation', () => {
    expect(parseFlexibleValue('  True  ')).toBe(true);
    expect(parseFlexibleValue('  true  ')).toBe('  true  ');
  });
});
```

### Integration Test Scenarios
- Large CSV files with mixed Python/JSON content
- Edge cases with malformed data and special characters
- Performance testing with datasets containing thousands of records
- Cross-browser compatibility with different CSV parsing approaches

## Configuration Options

### Parser Settings
```javascript
const csvOptions = {
  // Core conversion behavior
  separator: ',',              // CSV delimiter character
  typeCoercion: true,          // Enable number/boolean conversion
  preserveWhitespace: true,    // Maintain original whitespace
  
  // Python literal handling
  pythonLiterals: true,        // Convert True/False/None
  caseSensitive: true,         // Exact case matching only
  
  // Empty value behavior
  emptyAsNull: true,          // Convert empty strings to null
  trimForComparison: true,    // Trim for matching logic
  
  // Advanced features
  smartJSONDetection: true,   // Parse JSON within CSV fields
  compoundStructures: true,   // Handle complex Python objects
}
```

This specification ensures predictable, reliable CSV to JSON conversion that respects Python conventions while maintaining data integrity and user expectations.