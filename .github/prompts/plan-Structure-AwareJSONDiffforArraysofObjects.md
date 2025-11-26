# Plan: Structure-Aware JSON Diff for Arrays of Objects

We will implement a semantic diff engine that understands JSON structure, specifically arrays of objects, to provide "Proxyman-like" diffs with granular field highlighting and object-level status (Added/Removed/Modified).

### Steps

1.  **Implement Semantic Diff Engine** (`v6/utils/semantic_diff.js`)
    -   Create `SemanticDiffer` class with `computeSemanticDiff(left, right)`.
    -   Implement **Key-Agnostic Matching**: Use a greedy best-match algorithm (O(n²)) based on content similarity (Jaccard index of keys/values) to pair objects between arrays without relying on `id` fields.
    -   Detect `Added` (in right only), `Removed` (in left only), and `Modified` (matched but different) objects.
    -   For `Modified` objects, recursively identify specific changed fields.

2.  **Add JSON Canonicalization** (`v6/utils/json_utils.js`)
    -   Add `canonicalizeJSON(obj)` to recursively sort object keys.
    -   This ensures that `{ "a": 1, "b": 2 }` and `{ "b": 2, "a": 1 }` are treated as identical during comparison.

3.  **Create CodeMirror 6 ViewPlugin** (`v6/utils/semantic_diff_view.js`)
    -   Create `SemanticDiffPlugin` that attaches to the `MergeView` editors.
    -   **Visualizations:**
        -   **Added Objects:** Green background + `+` gutter marker (Right editor).
        -   **Removed Objects:** Red background + `-` gutter marker (Left editor).
        -   **Modified Objects:** Subtle background + granular highlighting of changed fields (Both editors).
    -   Use CodeMirror `Decoration` API (line and mark decorations) to apply these styles.

4.  **Integrate into UI** (`v6/index.html`)
    -   Add a "Semantic Diff" toggle in the Settings panel.
    -   Update `recreateMergeView` to enable/disable the `SemanticDiffPlugin`.
    -   Auto-detect "Array of Objects" structure to suggest or auto-enable this mode.

5.  **Apply Styling** (`v6/css/app.css`)
    -   Define CSS classes: `.semantic-added`, `.semantic-removed`, `.semantic-modified`, `.semantic-field-changed`.
    -   Ensure colors match the requested "Proxyman" style (Green/Red backgrounds, subtle field highlights).

### Further Considerations
1.  **Alignment:** We will rely on `MergeView`'s native alignment initially. If misalignment occurs for complex arrays, we may need to inject invisible spacers, but that is a more advanced step.
2.  **Performance:** For very large arrays (>1000 items), the O(n²) matching might be slow. We can add a threshold to fall back to standard diff or run it in a worker if needed.
3.  **Nested Arrays:** The initial implementation will focus on top-level arrays of objects. Nested arrays will be treated as fields (modified/same).
## Plan: Structure-Aware JSON Diff — Implementation Plan with Test Cases

Transform the text-based diff into a semantic, object-aware diff engine that detects Added/Removed/Modified objects in arrays and highlights only changed fields within objects—replicating Proxyman's UX.

---

### Phase 1: Core Semantic Diff Engine

**File:** `v6/utils/semantic_diff.js` (new)

#### Step 1.1: Create `SemanticDiffer` class
- Parse left/right JSON into structured AST
- Detect content type: `array-of-objects`, `plain-object`, `array-of-primitives`, `primitive`
- Export to `window.SemanticDiffer` for global access

#### Step 1.2: Implement object similarity scoring
- Calculate field overlap percentage: `matchingFields / totalFields`
- Handle nested objects recursively (configurable depth limit)
- Return similarity score 0.0–1.0 per object pair

#### Step 1.3: Build array element matcher
- For each left object, find best-match in right array (greedy O(n²))
- Threshold: ≥60% similarity = "same object, modified"
- Below threshold or no match = "removed" (left) / "added" (right)

#### Step 1.4: Generate structured diff output
```javascript
{
  type: 'array-of-objects',
  changes: [
    { changeType: 'added', index: 1, object: {...}, lineRange: [10, 25] },
    { changeType: 'removed', index: 2, object: {...}, lineRange: [30, 45] },
    { changeType: 'modified', leftIndex: 0, rightIndex: 0, 
      fieldChanges: [
        { field: 'city_name', oldValue: 'Petaluma', newValue: 'Sacramento' }
      ], 
      lineRange: [1, 15] 
    }
  ]
}
```

---

### Phase 2: JSON Canonicalization

**File:** json_utils.js (extend)

#### Step 2.1: Add `canonicalizeJSON(obj)` function
- Sort object keys alphabetically (recursive)
- Normalize numbers: `1.0` → `1`, `1.00` → `1`
- Normalize whitespace in string values
- Return canonical object (not string)

#### Step 2.2: Add `getCanonicalString(obj)` for comparison
- Call `canonicalizeJSON()` then `JSON.stringify()` with consistent indent
- Used for object fingerprinting and quick equality checks

---

### Phase 3: CodeMirror 6 Integration

**File:** `v6/utils/semantic_diff_view.js` (new)

#### Step 3.1: Create `SemanticDiffPlugin` ViewPlugin
- Subscribe to document changes via `EditorView.updateListener`
- On change: debounce 300ms → compute semantic diff → apply decorations

#### Step 3.2: Define decoration styles
```javascript
const addedLine = Decoration.line({ class: 'semantic-added' });
const removedLine = Decoration.line({ class: 'semantic-removed' });
const modifiedField = Decoration.mark({ class: 'semantic-field-changed' });
```

#### Step 3.3: Create gutter markers
- `+` marker for added objects (green)
- `-` marker for removed objects (red)
- `→` marker for modified objects (blue)

---

### Phase 4: UI Integration

**File:** index.html

#### Step 4.1: Add settings toggle (line ~140)
- Checkbox: "Semantic Diff Mode" (auto-enabled when array-of-objects detected)
- Dropdown: Array comparison mode (Ordered / Set / Semantic matching)

#### Step 4.2: Update `recreateMergeView()` (line ~1071)
- If semantic mode enabled: pre-canonicalize JSON before passing to MergeView
- After MergeView creation: apply semantic decorations via ViewPlugin

#### Step 4.3: Update diff status display (line ~2397)
- Show semantic stats: "2 added, 1 removed, 3 modified objects"
- Show field-level count: "(5 fields changed)"

---

### Phase 5: CSS Styling

**File:** app.css

#### Step 5.1: Object-level styles
```css
.semantic-added { background: rgba(40, 167, 69, 0.15); border-left: 3px solid #28a745; }
.semantic-removed { background: rgba(220, 53, 69, 0.15); border-left: 3px solid #dc3545; }
.semantic-modified { border-left: 3px solid #007bff; }
```

#### Step 5.2: Field-level styles
```css
.semantic-field-changed { background: rgba(255, 193, 7, 0.3); border-radius: 2px; }
```

---

### Test Cases

#### TC1: Array Addition
**Input:** semantic_diff_test_data.json → `arrayAddition`
**Expected:** Sacramento object marked as `added` (green background, `+` gutter)

#### TC2: Array Removal
**Input:** semantic_diff_test_data.json → `arrayRemoval`
**Expected:** Beta object marked as `removed` (red background, `-` gutter)

#### TC3: Object Modification (Field-Level)
**Input:** test_case_objects
**Expected:** Only 5 fields highlighted: `delta_elec_utilitybill`, `delta_solar_gj_displaced`, `delta_solar_utilitybill_displaced`, `delta_total_utilitybill`, `elec_gj`, `elec_utilitybill`, `from.furnace_eff`

#### TC4: Mixed Changes
**Input:** semantic_diff_test_data.json → `mixedChanges`
**Expected:**
- Alpha → Alpha Prime: `modified` (name field highlighted)
- Beta: `removed`
- Gamma: `modified` (status field highlighted)
- Delta: `added`

#### TC5: Nested Arrays
**Input:** test_case_array_objects
**Expected:**
- `id` field: `0002` → `0001` (highlighted)
- `type` field: `Ice Cream` → `donut` (highlighted)
- `batters.batter`: 4 items → 1 item (array change detected)
- `topping`: 2 removed, 1 added, 2 unchanged

#### TC6: Key Reordering (No Change)
**Input:** `{"a":1,"b":2}` vs `{"b":2,"a":1}`
**Expected:** No differences shown (canonicalization eliminates false positive)

#### TC7: Numeric Normalization
**Input:** `{"val": 1.0}` vs `{"val": 1}`
**Expected:** No differences (normalized to same value)

#### TC8: Empty Arrays
**Input:** `[]` vs `[{"id":1}]`
**Expected:** One object marked as `added`

#### TC9: Non-Array Fallback
**Input:** `"hello"` vs `"world"`
**Expected:** Falls back to text diff (not semantic mode)

#### TC10: Large Array Performance
**Input:** 500-object arrays with 10% differences
**Expected:** Completes in <2 seconds, uses Web Worker if >100KB

---

### Further Considerations

1. **Similarity threshold configurable?** Default 60% seems reasonable; add advanced setting for power users who want stricter/looser matching.

2. **Web Worker integration?** For files >100KB, move semantic diff to existing viewport_diff.js worker pattern to prevent UI blocking.

3. **Ignore paths feature?** Add textarea in settings for paths like `*.timestamp`, `metadata._internal` to exclude from comparison (per PRD spec).

---

## Plan: Semantic Structure-Aware JSON Diff Engine

Transform the current text-based diff into an object-aware semantic diff that detects Added/Removed/Modified objects in arrays and highlights only the specific fields that differ within modified objects—replicating Proxyman's superior UX.

### Steps

1. **Create semantic diff engine** in `v6/utils/semantic_diff.js` — Implement `computeSemanticDiff(leftJSON, rightJSON)` that returns structured diff with change types (added/removed/modified) and JSON paths for each difference.

2. **Implement key-agnostic array element matching** in the same file — Use content similarity scoring (Jaccard index or deep-equality count) to match objects across left/right arrays without relying on `id` or specific keys.

3. **Add JSON canonicalization** in json_utils.js — Create `canonicalizeJSON()` to sort keys alphabetically and normalize values (numbers, whitespace) before diff, eliminating false positives from key reordering.

4. **Create custom CodeMirror ViewPlugin** in `v6/utils/semantic_diff_view.js` — Apply semantic decorations (colored backgrounds, gutter markers) on top of MergeView using `RangeSet` to show object-level change indicators.

5. **Integrate with MergeView lifecycle** in index.html lines 500-533 and 1071-1113 — Add semantic diff toggle to settings, call semantic differ after content changes, and apply decorations via the ViewPlugin.

6. **Add UI controls and validate with test cases** — Wire up "Semantic Diff" toggle in the settings panel (lines 137-198), test against existing semantic_diff_test_data.json and test_case_array_objects.

### Further Considerations

1. **Performance for large files?** Consider running semantic diff in the existing Web Worker (`v6/utils/viewport_diff.js`) for files >100KB, or limit semantic analysis to visible viewport.

2. **How to handle nested arrays?** Recursive semantic diff at all levels (full depth) vs. shallow (top-level arrays only)? Recommend configurable depth limit defaulting to 3 levels.

3. **Preserve MergeView's native diff or replace entirely?** Option A: Overlay semantic decorations on top (additive) / Option B: Pre-canonicalize JSON so MergeView shows cleaner diff / Option C: Both combined for best results.

---


## Plan: Structure-Aware JSON Diff for Arrays of Objects

**TL;DR:** Replace the current line-by-line text diff engine with a semantic, JSON-aware diff algorithm that understands object-level changes (additions, deletions, modifications), matches objects intelligently without relying on ID fields, and highlights granular field-level differences within modified objects. Implement custom decorations in CodeMirror 6 to visualize these semantic changes with intuitive colors and markers.

### Steps

1. **Create semantic diff engine** ([`v6/utils/semantic_diff.js`] new file) that:
   - Parses JSON into AST-like structure distinguishing arrays, objects, and scalars
   - Detects arrays of objects vs. simple arrays vs. plain objects
   - For arrays of objects: Implements fuzzy object matching (best-match algorithm)
   - Classifies each object as: `Added`, `Removed`, or `Modified` (with field-level tracking)
   - Returns structured diff metadata (not just text diffs) for semantic understanding

2. **Build object matching algorithm** in semantic diff that:
   - Compares objects field-by-field using fuzzy string similarity (Levenshtein or Jaro-Winkler)
   - Handles field ordering changes gracefully
   - Weighs fields differently if keys suggest identity (e.g., UUID, email patterns)
   - Falls back to content-based matching (JSON stringified comparison)
   - Produces confidence scores for match pairs

3. **Extend diff metadata format** to include:
   - Line ranges for each change (for CodeMirror integration)
   - Change type per line (`added`, `removed`, `modified`, `unchanged`)
   - For modified lines: list of changed field keys for fine-grained highlighting
   - Context tree showing parent object/array path for each line

4. **Integrate with CodeMirror 6 decorations** ([update `v6/index.html`] section ~line 2400 `recreateMergeView`):
   - Replace current `highlightChanges` boolean with custom decoration logic
   - Parse semantic diff result and create `Decoration` ranges for each change type
   - Apply visual markers: `+` prefix for additions, `-` prefix for removals
   - Color code fields within modified objects (green for changed field values only)

5. **Update visual styling** ([`v6/css/app.css`]):
   - Define `.semantic-added`, `.semantic-removed`, `.semantic-modified` classes
   - Style object-level changes with full-line backgrounds (green/red with transparency)
   - Style field-level changes with subtle inline highlighting (preserve readability)
   - Ensure color contrast meets accessibility standards

6. **Add fallback logic** for non-array inputs:
   - Detect when content is not an array of objects
   - Gracefully degrade to current diff_match_patch behavior
   - Display toggle in UI: "Semantic Diff Mode" (auto-detected based on structure)

### Further Considerations

1. **Algorithm Choice:** Use Longest Common Subsequence (LCS) or Longest Common Substring (LCS) for array matching, or implement a simpler greedy best-match?  
   *Recommendation:* Start with greedy best-match (O(n²)) for simplicity; optimize later if performance becomes an issue with large arrays.

2. **Field-Level Granularity:** For nested objects within array items, should we highlight changes at any depth or only direct children?  
   *Recommendation:* Highlight only direct children of array objects initially; document as limitation for nested diffs.

3. **Preserving Text Diff:** Should Proxyman-style object-level diff fully replace text-level diff, or coexist as a mode toggle?  
   *Recommendation:* Implement as mode toggle; keep existing text diff as fallback for non-JSON or non-array content.

4. **Performance with Large Arrays:** The fuzzy matching algorithm is O(n²); estimate max array size (e.g., 1000+ items) and plan web worker integration if needed.

5. **User Settings:** New diff mode requires UI choices—should users manually enable, or auto-detect based on JSON structure (recommended)?