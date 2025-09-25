# Feature Specification: Selective Key Comparison

## Overview

This feature enables users to compare JSON objects by focusing only on keys that exist in one side (left or right), effectively filtering out irrelevant properties and enabling precise 1:1 property comparison even when objects have different property sets.

## Use Case Scenarios

### Scenario 1: Schema Validation
```json
// Left (Expected Schema)
{
  "id": 1,
  "name": "John",
  "email": "john@example.com"
}

// Right (API Response with Extra Fields)
{
  "id": 1,
  "name": "John", 
  "email": "john@example.com",
  "created_at": "2024-01-01",
  "updated_at": "2024-01-05",
  "internal_id": "xyz123",
  "cache_key": "user_1_cache"
}
```

With **"Left Keys Only"** mode enabled:
- Only compares: `id`, `name`, `email`
- Ignores: `created_at`, `updated_at`, `internal_id`, `cache_key`
- UI shows clean 1:1 comparison of relevant fields only

### Scenario 2: API Migration Testing
```json
// Left (Old API Response)
{
  "user_id": 123,
  "full_name": "Jane Smith",
  "date_of_birth": "1990-05-15"
}

// Right (New API Response)
{
  "user_id": 123,
  "full_name": "Jane Smith", 
  "date_of_birth": "1990-05-15",
  "profile_image": "https://...",
  "preferences": {...},
  "analytics": {...}
}
```

With **"Left Keys Only"** mode:
- Focuses comparison on core migrated fields
- Hides new fields that don't exist in old API
- Validates that essential data remains consistent

## Feature Specifications

### 1. Comparison Modes

#### Standard Mode (Current Behavior)
- Compares all keys from both objects
- Shows additions, deletions, and modifications
- Full diff visibility

#### Left Keys Only Mode
```javascript
// Only compare keys that exist in left object
const leftKeys = Object.keys(leftObject);
const filteredRight = {};

leftKeys.forEach(key => {
  if (key in rightObject) {
    filteredRight[key] = rightObject[key];
  } else {
    filteredRight[key] = undefined; // Mark as missing
  }
});

// Compare leftObject vs filteredRight
```

#### Right Keys Only Mode  
```javascript
// Only compare keys that exist in right object
const rightKeys = Object.keys(rightObject);
const filteredLeft = {};

rightKeys.forEach(key => {
  if (key in leftObject) {
    filteredLeft[key] = leftObject[key];
  } else {
    filteredLeft[key] = undefined; // Mark as missing
  }
});

// Compare filteredLeft vs rightObject
```

#### Intersection Mode
```javascript
// Only compare keys that exist in BOTH objects
const leftKeys = new Set(Object.keys(leftObject));
const rightKeys = new Set(Object.keys(rightObject));
const commonKeys = [...leftKeys].filter(key => rightKeys.has(key));

const filteredLeft = {};
const filteredRight = {};

commonKeys.forEach(key => {
  filteredLeft[key] = leftObject[key];
  filteredRight[key] = rightObject[key];
});
```

### 2. UI Implementation

#### Mode Selector
```html
<div class="comparison-mode-selector">
  <label>Comparison Mode:</label>
  <select id="comparisonMode">
    <option value="full">All Keys (Default)</option>
    <option value="left-only">Left Keys Only</option>
    <option value="right-only">Right Keys Only</option>
    <option value="intersection">Common Keys Only</option>
  </select>
</div>
```

#### Visual Indicators
```css
/* Show which keys are being compared */
.key-comparison-info {
  background: #e3f2fd;
  border: 1px solid #2196f3;
  padding: 8px 12px;
  margin-bottom: 10px;
  border-radius: 4px;
}

.filtered-keys-count {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

/* Example: "Comparing 5 of 8 keys (Left side keys only)" */
```

#### Hidden Key Indicator
```html
<!-- Show count of hidden keys -->
<div class="hidden-keys-summary">
  <span class="hidden-count">3 additional keys hidden</span>
  <button class="show-hidden-toggle">Show All</button>
</div>
```

### 3. Technical Implementation

#### Core Filtering Logic
```javascript
class SelectiveKeyComparison {
  constructor() {
    this.mode = 'full'; // 'full', 'left-only', 'right-only', 'intersection'
  }
  
  filterObjects(leftObj, rightObj, mode = this.mode) {
    switch (mode) {
      case 'left-only':
        return this.filterByLeftKeys(leftObj, rightObj);
      
      case 'right-only':
        return this.filterByRightKeys(leftObj, rightObj);
      
      case 'intersection':
        return this.filterByCommonKeys(leftObj, rightObj);
      
      case 'full':
      default:
        return { left: leftObj, right: rightObj };
    }
  }
  
  filterByLeftKeys(leftObj, rightObj) {
    const leftKeys = this.getAllKeys(leftObj);
    const filteredRight = this.extractKeys(rightObj, leftKeys);
    
    return {
      left: leftObj,
      right: filteredRight,
      metadata: {
        comparedKeys: leftKeys,
        hiddenKeys: this.getHiddenKeys(rightObj, leftKeys),
        mode: 'left-only'
      }
    };
  }
  
  getAllKeys(obj, prefix = '') {
    const keys = [];
    
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys.push(...this.getAllKeys(obj[key], fullKey));
      }
    });
    
    return keys;
  }
  
  extractKeys(sourceObj, targetKeys) {
    const result = {};
    
    targetKeys.forEach(key => {
      const value = this.getNestedValue(sourceObj, key);
      this.setNestedValue(result, key, value);
    });
    
    return result;
  }
}
```

#### Integration with Existing Diff Engine
```javascript
// Enhance existing comparison workflow
function performComparison(leftContent, rightContent, options = {}) {
  const leftObj = parseFlexibleJSON(leftContent);
  const rightObj = parseFlexibleJSON(rightContent);
  
  // Apply key filtering if mode is not 'full'
  if (options.comparisonMode !== 'full') {
    const selective = new SelectiveKeyComparison();
    const filtered = selective.filterObjects(leftObj, rightObj, options.comparisonMode);
    
    // Update UI to show filtering metadata
    updateComparisonMetadata(filtered.metadata);
    
    // Proceed with filtered objects
    return computeDiff(filtered.left, filtered.right);
  }
  
  // Standard full comparison
  return computeDiff(leftObj, rightObj);
}
```

### 4. User Experience Enhancements

#### Smart Mode Detection
```javascript
// Auto-suggest comparison mode based on object structure
function suggestComparisonMode(leftObj, rightObj) {
  const leftKeys = new Set(Object.keys(leftObj));
  const rightKeys = new Set(Object.keys(rightObj));
  
  const onlyInLeft = [...leftKeys].filter(k => !rightKeys.has(k)).length;
  const onlyInRight = [...rightKeys].filter(k => !leftKeys.has(k)).length;
  const common = [...leftKeys].filter(k => rightKeys.has(k)).length;
  
  // Suggest mode based on key distribution
  if (onlyInRight > common * 0.5 && onlyInLeft === 0) {
    return {
      suggested: 'left-only',
      reason: `Right object has ${onlyInRight} extra keys that might be irrelevant`
    };
  }
  
  if (onlyInLeft > common * 0.5 && onlyInRight === 0) {
    return {
      suggested: 'right-only', 
      reason: `Left object has ${onlyInLeft} extra keys that might be irrelevant`
    };
  }
  
  return { suggested: 'full', reason: 'Objects have similar structure' };
}
```

#### Comparison Summary
```html
<div class="comparison-summary">
  <div class="summary-row">
    <span class="label">Mode:</span>
    <span class="value">Left Keys Only</span>
  </div>
  <div class="summary-row">
    <span class="label">Keys Compared:</span>
    <span class="value">5 of 8 total keys</span>
  </div>
  <div class="summary-row">
    <span class="label">Hidden Keys:</span>
    <span class="value">created_at, updated_at, internal_id</span>
  </div>
  <div class="summary-row">
    <span class="label">Differences Found:</span>
    <span class="value">2 modified, 1 missing</span>
  </div>
</div>
```

### 5. Advanced Features

#### Key Path Filtering
```javascript
// Support for nested key filtering
const keyFilters = [
  'user.profile.name',
  'user.profile.email',
  'settings.preferences.*',  // Wildcard support
  'metadata.!internal_*'     // Exclusion pattern
];
```

#### Export Filtered Results
```javascript
// Export only the compared subset
function exportFilteredComparison(result, metadata) {
  return {
    comparisonMode: metadata.mode,
    comparedKeys: metadata.comparedKeys,
    hiddenKeys: metadata.hiddenKeys,
    filteredLeft: result.filteredLeft,
    filteredRight: result.filteredRight,
    differences: result.differences
  };
}
```

#### Preset Filters
```javascript
// Common filtering presets
const COMPARISON_PRESETS = {
  'api-schema': {
    mode: 'left-only',
    description: 'Compare only expected schema fields'
  },
  'core-properties': {
    mode: 'intersection',
    description: 'Compare only properties that exist in both objects'
  },
  'migration-test': {
    mode: 'right-only', 
    description: 'Validate new API contains all old properties'
  }
};
```

## Implementation Priority

### Phase 1: Basic Feature
1. Add comparison mode selector UI
2. Implement core filtering logic for object properties
3. Integrate with existing diff engine
4. Add visual indicators for filtered keys

### Phase 2: Enhanced UX
1. Smart mode suggestions
2. Comparison metadata display
3. Hidden key summary with toggle
4. Export filtered results

### Phase 3: Advanced Features  
1. Nested key path filtering
2. Wildcard and exclusion patterns
3. Preset filter configurations
4. Deep object traversal with selective comparison

## Benefits

1. **Focused Comparisons**: Compare only relevant properties
2. **Cleaner UI**: Hide irrelevant differences and noise
3. **Schema Validation**: Perfect for API testing and validation scenarios  
4. **Performance**: Smaller comparison sets process faster
5. **Flexibility**: Multiple modes for different use cases