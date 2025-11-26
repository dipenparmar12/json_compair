# Plan: Semantic Structure-Aware JSON Diff Engine

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