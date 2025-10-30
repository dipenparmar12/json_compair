# Utility Module Specifications

## 1. URL Manager (`utils.js`)

### 1.1 URLManager Object
Primary utility for managing shareable URLs and browser history.

#### Methods

**`compress(str)`**
- **Purpose**: Compresses string content for URL encoding
- **Input**: Raw string content
- **Output**: Base64-encoded URL-safe string
- **Error Handling**: Falls back to simple URL encoding on compression failure
- **Use Cases**: Preparing content for URL parameters

**`decompress(str)`**
- **Purpose**: Decompresses URL-encoded content
- **Input**: Base64-encoded string from URL parameters
- **Output**: Original string content
- **Error Handling**: Falls back to simple URL decoding on decompression failure
- **Use Cases**: Restoring content from shared URLs

**`saveToURL(leftContent, rightContent)`**
- **Purpose**: Updates browser URL with current editor content
- **Input**: Left and right panel content strings
- **Output**: Updated URL string
- **Behavior**: Uses `history.replaceState()` to avoid navigation history pollution
- **Compression**: Automatically compresses content using base64 encoding

**`loadFromURL()`**
- **Purpose**: Extracts content from URL parameters
- **Input**: Current browser URL (automatic)
- **Output**: Object with `{left, right}` properties or `null`
- **Decompression**: Automatically decompresses base64-encoded parameters
- **Use Cases**: Loading shared content on page load

**`generateShareableURL(leftContent, rightContent)`**
- **Purpose**: Creates shareable URL without modifying browser history
- **Input**: Content strings for both panels
- **Output**: Complete shareable URL
- **Behavior**: Returns URL without changing current browser location

**`clearURL()`**
- **Purpose**: Removes all URL parameters
- **Output**: Clean URL without parameters
- **Use Cases**: Cleaning URL after importing snapshots or clearing content

## 2. Storage Manager (`utils.js`)

### 2.1 StorageManager Object
Handles persistent storage with automatic fallback mechanisms.

#### Configuration
- **Storage Key**: `"json_compare_data"`
- **Expiry Period**: 30 days
- **Fallback**: IndexedDB when localStorage unavailable

#### Methods

**`saveToStorage(leftContent, rightContent)`**
- **Purpose**: Persists current content with timestamp
- **Input**: Left and right panel content
- **Behavior**: Stores JSON object with content and timestamp
- **Error Handling**: Automatic fallback to IndexedDB on localStorage failure
- **Data Structure**: `{left, right, timestamp}`

**`loadFromStorage()`**
- **Purpose**: Retrieves stored content with expiry check
- **Output**: Object with `{left, right}` properties or `null`
- **Expiry Logic**: Automatically removes expired data (>30 days)
- **Use Cases**: Restoring content on page reload

**`saveToIndexedDB(leftContent, rightContent)`**
- **Purpose**: Async fallback storage method
- **Returns**: Promise resolving to success boolean
- **Database**: `json_compair_db` with `snapshots` object store
- **Use Cases**: When localStorage quota exceeded

**`loadFromIndexedDB()`**
- **Purpose**: Async retrieval from IndexedDB
- **Returns**: Promise resolving to stored data or null
- **Error Handling**: Returns null on any failure

## 3. Settings Manager (`utils.js`)

### 3.1 SettingsManager Object
Manages user preferences with default fallbacks.

#### Default Settings
- **autoCsv**: `false` - Automatic CSV conversion
- **autoSortOnPaste**: `true` - Sort JSON keys when pasting
- **showOnlyDiffs**: `false` - Show only differences mode

#### Methods

**`loadAll()`**
- **Purpose**: Loads all settings with defaults
- **Output**: Complete settings object
- **Error Handling**: Returns defaults on any failure

**`saveAll(obj)`**
- **Purpose**: Saves settings object to localStorage
- **Input**: Partial or complete settings object
- **Behavior**: Merges with existing settings
- **Returns**: Success boolean

**`get(key)`**
- **Purpose**: Retrieves specific setting value
- **Input**: Setting key name
- **Output**: Setting value or default
- **Fallback**: Returns default value if key not found

**`set(key, value)`**
- **Purpose**: Updates specific setting
- **Input**: Setting key and new value
- **Behavior**: Merges with existing settings
- **Returns**: Success boolean

## 4. JSON Processing Utilities (`json_utils.js`)

### 4.1 parseFlexibleJSON Function
Advanced JSON parser supporting Python data structures.

#### Input Processing Steps
1. **Quick JSON Detection**: Attempts standard JSON.parse() first
2. **Python Literal Conversion**: Converts `True`/`False`/`None`
3. **Quote Normalization**: Converts single quotes to double quotes
4. **Complex Numbers**: Converts `(1+2j)` to `{"real": 1, "imag": "2"}`
5. **Decimal Objects**: Converts `Decimal("123.45")` to `"123.45"`
6. **String Literals**: Handles `b"`, `r"`, `u"`, `f"` prefixes
7. **Object Representations**: Converts `<User #123>` to structured objects
8. **DateTime Objects**: Converts to ISO string format
9. **Collection Types**: Converts sets and tuples to arrays
10. **Key Formatting**: Adds quotes to unquoted object keys
11. **Cleanup**: Removes trailing commas, fixes whitespace

#### Error Handling
- **Multi-stage Parsing**: Multiple fallback parsing attempts
- **Detailed Errors**: Descriptive error messages with sample content
- **Bracket Matching**: Automatic bracket balancing attempts
- **Context Preservation**: Shows problematic content section

#### Support Matrix
- **Standard JSON**: Full RFC 7159 compliance
- **Python Dicts**: `{'key': 'value'}` syntax
- **Python Lists**: `[1, 2, 3]` syntax
- **Python Tuples**: `(1, 2, 3)` converted to arrays
- **Python Sets**: `{1, 2, 3}` converted to arrays
- **Python Booleans**: `True`/`False` conversion
- **Python None**: Converted to `null`
- **Complex Numbers**: Mathematical notation support
- **DateTime Objects**: Full datetime parsing
- **Object Representations**: Python object string representations

### 4.2 Helper Functions

**`convertSingleQuotesToDouble(str)`**
- **Purpose**: Intelligent single-to-double quote conversion
- **Logic**: Context-aware conversion avoiding mid-word replacements
- **Escape Handling**: Preserves existing escape sequences

**`containsColonOutsideQuotes(content)`**
- **Purpose**: Distinguishes objects from sets
- **Logic**: Detects colons outside quoted strings
- **Use Cases**: Set vs dictionary detection

**`fixBracketMatching(str)`**
- **Purpose**: Attempts bracket balancing
- **Scope**: Handles `{}`, `[]`, `()` mismatches
- **Limitations**: Basic matching only

## 5. CSV Processing Utilities (`utils_csv.js`)

### 5.1 CSVUtils Object
Comprehensive CSV processing with auto-detection.

#### Methods

**`isCSV(text)`**
- **Purpose**: Heuristic CSV detection
- **Logic**: Checks for common separators and multi-line structure
- **Supported Separators**: Comma, semicolon, tab
- **Threshold**: Requires separator and either multiple lines or complex first line

**`csvToJSON(csvText, options)`**
- **Purpose**: Synchronous CSV to JSON conversion
- **Input**: Raw CSV text, optional configuration object
- **Output**: Array of objects with header keys
- **Options**: 
  - `coerceTypes`: Boolean/number type conversion
- **Processing**: 
  - Automatic separator detection
  - Quote handling with escape sequences
  - Header row processing
  - Empty row filtering

**`csvToJSONAsync(csvText, options)`**
- **Purpose**: Asynchronous CSV processing for large files
- **Threshold**: Uses PapaParse for files >100KB
- **Returns**: Promise resolving to JSON array
- **Worker Support**: Background processing when available
- **Fallback**: Uses synchronous version for small files

**`jsonToCSV(input)`**
- **Purpose**: Converts JSON back to CSV format
- **Input**: JSON array or string
- **Support**: Objects array or arrays array
- **Output**: RFC 4180 compliant CSV
- **Escaping**: Automatic quote escaping for special characters

### 5.2 Processing Features
- **Separator Detection**: Automatic comma/tab/semicolon detection
- **Quote Handling**: RFC 4180 compliant quote processing
- **Type Coercion**: Optional number/boolean conversion
- **Empty Value Handling**: Configurable null conversion
- **Large File Support**: Worker-based processing
- **Error Recovery**: Graceful handling of malformed CSV

## 6. Template Management (`utils.js`)

### 6.1 DefaultTemplates Object
Pre-defined JSON examples for user convenience.

#### Available Templates

**Simple Template**
- **Structure**: Basic user object with name, age, city
- **Use Cases**: Quick testing, demonstrations
- **Differences**: Age and city variations between left/right

**Complex Template**
- **Structure**: Multi-level object with users array and settings
- **Features**: Nested objects, arrays, boolean values
- **Differences**: User status changes, theme preferences, array modifications

#### Template Structure
- **Format**: Each template contains `{left, right}` properties
- **Formatting**: Pre-formatted with 3-space indentation
- **JSON Compliance**: Valid JSON with realistic data variations

## 7. JSON Sorting Utilities (`utils.js`)

### 7.1 Sorting Functions

**`sortJSONKeys(obj)`**
- **Purpose**: Recursively sorts object keys alphabetically
- **Behavior**: Deep traversal of nested structures
- **Array Handling**: Delegates to `sortJSONArray()` for array elements
- **Preservation**: Maintains all data types and values

**`sortJSONArray(arr)`**
- **Purpose**: Sorts array elements when they are objects
- **Logic**: Object arrays sorted by stringified representation
- **Mixed Arrays**: Non-object elements preserved in order
- **Recursive**: Applies key sorting to nested objects

#### Use Cases
- **Diff Reduction**: Minimizing differences from key ordering
- **Standardization**: Consistent object key ordering
- **Comparison**: Easier visual comparison of similar structures

## 8. Large Data Helpers (`index.html`)

### 8.1 LargeDataHelpers Object
Performance optimization for heavy operations.

#### Configuration
- **Worker Path**: `./js/large-data-worker.js`
- **Size Threshold**: 150KB conservative threshold
- **Timeout**: 30-second fallback timeout

#### Methods

**`runHeavyTask(action, payload, fallback)`**
- **Purpose**: Offloads heavy operations to Web Worker
- **Input**: Action name, data payload, fallback function
- **Returns**: Promise resolving to processed result
- **Logic**: Uses worker for large payloads, synchronous for small ones
- **Timeout**: Automatic fallback on worker timeout
- **Error Handling**: Graceful degradation to synchronous processing