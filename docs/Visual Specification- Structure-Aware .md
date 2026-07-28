# Visual Specification: Structure-Aware JSON Diff for Arrays of Objects

## Current Problem vs. Proxyman's Superior UX

### Current Tool Limitations
- **Line-based diff approach** treats JSON as plain text, breaking object relationships
- **No object-level grouping** - changes appear as fragmented line-by-line differences
- **Poor change classification** - cannot distinguish between:
  - Whole object additions/removals
  - Field-level modifications within objects
  - Object reordering
- **Visual clutter** - red/green highlighting across multiple lines makes it hard to identify logical units

### Proxyman's Effective Solution
- **Object-level change grouping** - entire objects treated as single logical units
- **Clear visual indicators** for different change types:
  - ✅ **Added objects**: Full green background with "+" gutter marker
  - ❌ **Removed objects**: Striped red background with "-" gutter marker
  - 🔀 **Modified objects**: Field-level highlighting only (no full background)
- **Intuitive field-level changes** - only modified values highlighted within objects
- **Preserved readability** - unchanged content remains visually neutral

## Visual Specification for Our Tool

### 1. Object-Level Change Indicators

| Change Type | Visual Treatment | Gutter Marker | Background | Line Numbers |
|-------------|------------------|---------------|------------|--------------|
| **Added Object** | Full object highlighted | `+` | Solid green (20% opacity) | New line numbers |
| **Removed Object** | Full object highlighted | `-` | Red with diagonal stripes | Strikethrough line numbers |
| **Modified Object** | Only changed fields highlighted | `→` | None | Normal line numbers |

```markdown
### Example: Added Object
+ {
+   "city_name": "Sacramento",  <!-- Green background for entire block -->
+   "client_id": 13,           <!-- All lines in object have green background -->
+   "created_on": "2022-11-29 00:59:06.009943",
+   ...
+ }
```

```markdown
### Example: Removed Object
- {
-   "city_name": "San Luis Obispo",  <!-- Striped red background for entire block -->
-   "client_id": 10,
-   ...
- }
```

```markdown
### Example: Modified Object
{
  "city_name": "Petaluma",
  "client_id": 10,
  "created_on": "2022-11-01 18:43:42.92294",  <!-- Unchanged -->
  "description": "The City of Petaluma..."     <!-- Unchanged -->
  "favor_hp": 1,                               <!-- Unchanged -->
  "html_snippet": null,                        <!-- Unchanged -->
  "id": 12,                                    <!-- Unchanged -->
  "launchcode": null,                          <!-- Unchanged -->
  "name": "ve2102-petaluma",                   <!-- Unchanged -->
  "project_config": null,                      <!-- Unchanged -->
  "state_code": "CA",                          <!-- Unchanged -->
  "updated_on": "2023-03-15 06:55:28.595532"  <!-- Unchanged -->
}
```

### 2. Field-Level Change Highlighting

| Element | Visual Treatment | Priority |
|---------|------------------|----------|
| **Changed field value** | Green background (10% opacity) | High |
| **Removed field** | Red strikethrough background | Medium |
| **Added field** | Green background with `+` prefix | High |
| **Unchanged content** | Normal styling | Default |

```markdown
### Example: Modified Object with Field Changes
{
  "city_name": "Petaluma",  <!-- Unchanged -->
  "client_id": 10,          <!-- Unchanged -->
  "created_on": "2022-11-01 18:43:42.92294",  <!-- Unchanged -->
  "description": "The City of Petaluma and PG&E...",  <!-- Unchanged -->
  "favor_hp": 1,            <!-- Unchanged -->
  "html_snippet": null,     <!-- Unchanged -->
  "id": 12,                 <!-- Unchanged -->
  "launchcode": null,       <!-- Unchanged -->
  "name": "ve2102-petaluma",  <!-- Unchanged -->
  "project_config": null,   <!-- Unchanged -->
  "state_code": "CA",       <!-- Unchanged -->
  "updated_on": "2023-03-15 06:55:28.595532",  <!-- Unchanged -->
  
  /* NEW FIELD ADDED */
  + "new_field": "value",   <!-- Green background, + prefix -->
  
  /* MODIFIED FIELD */
  "modified_field": "new_value",  <!-- Green background on value only -->
  
  /* REMOVED FIELD */
  - "old_field": "value"    <!-- Red strikethrough background -->
}
```

### 3. UI Elements & Behavior

```markdown
## Diff Mode Toggle
[ ] Semantic Diff Mode (Auto-enabled for JSON arrays of objects)

## Gutter Indicators
| Symbol | Meaning | When Visible |
|--------|---------|--------------|
| `+`    | Entire object added | When object exists only in right panel |
| `-`    | Entire object removed | When object exists only in left panel |
| `→`    | Object modified | When object exists in both panels but has field changes |
| `↔`    | Object reordered | When object position changed but content identical |

## Visual Hierarchy
1. Object-level changes (most prominent)
2. Field-level changes (subtle but clear)
3. Unchanged content (minimal visual weight)
```

### 4. Visual Examples Comparison

#### Current Tool (Problem)
```diff
- {
-   "city_name": "San Luis Obispo",
-   "client_id": 10,
-   ...
- },
+ {
+   "city_name": "Sacramento",
+   "client_id": 13,
+   ...
+ },
```
*Problem: Fragmented highlighting makes it hard to see this is a complete object replacement*

#### Target Implementation (Solution)
```markdown
- {
-   "city_name": "San Luis Obispo",
-   "client_id": 10,
-   ...
- }

+ {
+   "city_name": "Sacramento",
+   "client_id": 13,
+   ...
+ }
```
*Solution: Clear object-level grouping with consistent visual treatment*

#### Modified Object Example
```markdown
{
  "city_name": "Petaluma",
  "client_id": 10,
  "created_on": "2022-11-01 18:43:42.92294",
  "description": "The City of Petaluma and PG&E...",
- "favor_hp": 1,
+ "favor_hp": 2,
  "html_snippet": null,
  ...
}
```
*Only the changed field value is highlighted, preserving readability of unchanged content*

## Key Improvements Over Current Implementation

1. **Object awareness** - JSON structure is understood, not just text
2. **Intuitive visual hierarchy** - changes are immediately recognizable at glance
3. **Preserved context** - unchanged content remains readable
4. **Clear change classification** - users instantly know if an object was added, removed, or modified
5. **Reduced cognitive load** - no need to mentally reconstruct object relationships from line differences

This visual specification directly addresses the core limitations shown in the current implementation while matching Proxyman's superior UX approach for JSON diffing of object arrays.

---

# IMP

# Proxyman's Object-Level Property Diff Visualization

## How Proxyman Handles Field-Level Changes

Proxyman excels at showing granular property changes within objects while maintaining context. Unlike traditional line-based diffs that highlight entire lines, Proxyman's semantic diff engine understands JSON structure and highlights **only the changed values** while keeping the property names and unchanged content readable.

### Key Characteristics of Proxyman's Property Diff

```markdown
## Visual Treatment for Property Changes

| Change Type | Visual Treatment | Example | Notes |
|-------------|------------------|---------|-------|
| **Modified Value** | Green background on value only | `"delta_elec_utilitybill":` **`123.218`** | Property name remains unhighlighted |
| **Modified Value (Left)** | Red background on value only | `"delta_elec_utilitybill":` **`121.508`** | Only changed value highlighted |
| **Added Property** | Green background with `+` prefix | **`+`** `"delta_gas_utilitybill": 551.264` | New property clearly marked |
| **Removed Property** | Red background with `-` prefix | **`-`** `"delta_gas_utilitybill": 551.264` | Removed property clearly marked |
| **Unchanged Content** | Normal styling | `"delta_elec_gj": 0.708,` | Maintains readability |
```

### Visual Comparison: Current Tool vs. Proxyman

#### Current Tool (Problem)
```diff
- "delta_elec_utilitybill": 121.508,
- "delta_solar_gj_displaced": 0,
- "delta_solar_utilitybill_displaced": 63.142,
- "delta_total_utilitybill": 672.772,
+ "delta_elec_utilitybill": 123.218,
+ "delta_solar_gj_displaced": 0.001,
+ "delta_solar_utilitybill_displaced": 61.432,
+ "delta_total_utilitybill": 674.482,
```
*Problem: Entire lines highlighted, making it hard to quickly identify what specifically changed*

#### Proxyman's Approach (Solution)
```markdown
"delta_elec_utilitybill": 121.508,  // Left side
"delta_elec_utilitybill": 123.218,  // Right side (value highlighted in green)

"delta_solar_gj_displaced": 0,      // Left side
"delta_solar_gj_displaced": 0.001,  // Right side (value highlighted in green)

"delta_solar_utilitybill_displaced": 63.142,  // Left side
"delta_solar_utilitybill_displaced": 61.432,  // Right side (value highlighted in green)

"delta_total_utilitybill": 672.772,  // Left side
"delta_total_utilitybill": 674.482,  // Right side (value highlighted in green)
```

### Proxyman's Visual Implementation Details

```markdown
## Proxyman's Property Diff Mechanics

### 1. Value-Level Highlighting
- Only the **changed portion** of values is highlighted
- Property names remain unhighlighted and readable
- Maintains visual context of the object structure

### 2. Color Coding System
- **Red background** (left panel): Values that were changed/deleted
- **Green background** (right panel): New values that replaced old ones
- **No background**: Unchanged content

### 3. Precision Targeting
- Handles numeric precision changes: `0` → `0.001`
- Highlights specific decimal changes: `121.508` → `123.218`
- Maintains readability of surrounding content

### 4. Visual Hierarchy
1. **Object structure** (most prominent)
2. **Property names** (clearly visible)
3. **Changed values** (subtly highlighted)
4. **Unchanged values** (minimal visual weight)

### 5. Real-World Example from Screenshot
```
"delta_elec_utilitybill": 121.508,  // Left (red highlight on value)
"delta_elec_utilitybill": 123.218,  // Right (green highlight on value)

"delta_solar_gj_displaced": 0,      // Left (red highlight on value)
"delta_solar_gj_displaced": 0.001,  // Right (green highlight on value)

"delta_gas_utilitybill": 551.264,   // Right only (green highlight, + prefix)
```

### 6. Key UX Advantages
- ✅ **Immediate change identification** - users can instantly see what values changed
- ✅ **Preserved context** - property names remain visible and readable
- ✅ **Reduced visual noise** - only changed values highlighted, not entire lines
- ✅ **Numeric precision handling** - subtle decimal changes are clearly visible
- ✅ **Maintains JSON structure** - object hierarchy remains intact visually
```

## Why This Approach Works Better

Proxyman's property-level diff solves the fundamental problem of traditional line-based diffs: **it separates the structure from the content**. 

- In a JSON object, the property name is structural metadata, while the value is the actual content
- By highlighting only the values that changed, Proxyman allows users to:
  1. Quickly scan for changes without visual overload
  2. Maintain context of where changes occurred
  3. See the exact nature of numeric/decimal changes
  4. Understand the relationship between properties

This approach is particularly effective for JSON objects with many properties where only a few values have changed - the user can immediately identify the specific changes without having to mentally parse entire lines of code.
