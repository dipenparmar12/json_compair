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