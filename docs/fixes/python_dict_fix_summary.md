# Fix: Python Dict Misdetection as CSV

## Problem
When Auto CSV→JSON was enabled, Python dict pastes were being misdetected as CSV and converted to an empty array `[]`.

## Root Cause
The CSV detection heuristic was running before JSON/Python parsing, causing Python dictionaries (which can have commas and colons) to be incorrectly identified as CSV data.

## Solution
Implemented a **JSON-first parsing strategy** in three locations:
1. **Per-pane Paste button** (`pasteBtn.onclick`)
2. **Global paste handler** (`handlePaste()`)
3. **File drop handler** (`handleFileDrop()`)

## Changes Made

### 1. JSON-First Heuristic
```javascript
// Try parsing as JSON/Python FIRST
if (autoCSV || autoFormat || autoSort) {
  try {
    let parsed = window.parseFlexibleJSON(content);
    if (autoSort) {
      parsed = window.sortJSONKeys(parsed);
    }
    content = JSON.stringify(parsed, null, 3);
    isJSON = true;
  } catch (err) {
    // Not valid JSON/Python, continue to CSV check
  }
}

// ONLY attempt CSV if JSON parsing failed
if (!isJSON && autoCSV) {
  const isCSV = window.CSVUtils && window.CSVUtils.isCSV(text);
  if (isCSV) {
    // Convert CSV to JSON
  }
}
```

### 2. Settings Persistence
Added localStorage persistence for:
- **Auto Format JSON** (defaults to `true`)
- **Auto Sort Keys** (defaults to `false`)

This matches the existing Auto CSV→JSON setting behavior.

## Behavior

### Before Fix
1. User enables "Auto CSV→JSON"
2. User pastes Python dict: `{'key': 'value'}`
3. CSV detector triggers incorrectly
4. Result: `[]` (empty array)

### After Fix
1. User enables "Auto CSV→JSON" 
2. User pastes Python dict: `{'key': 'value'}`
3. JSON parser runs first, succeeds
4. Result: Properly formatted JSON: `{"key": "value"}`

### CSV Still Works
1. User pastes actual CSV:
   ```
   name,age,city
   John,30,NYC
   Jane,25,LA
   ```
2. JSON parser fails (as expected)
3. CSV detector triggers
4. Result: JSON array of objects

## Testing Checklist

✅ Python dict with Auto CSV enabled → Valid JSON
✅ Python dict with Auto Format enabled → Valid JSON
✅ Python dict with Auto Sort enabled → Valid sorted JSON
✅ Actual CSV with Auto CSV enabled → JSON array
✅ Invalid content → Original text preserved
✅ Settings persist across page reloads
✅ Works for paste, file drop, and paste button

## Example Test Case

**Input (Python dict):**
```python
{'AC_installed_kbtuh': 20.12, 'ceiling_and_roof_r_assembly_ip': 12.66, 'central_ac_seer': 8.0, 'cooling_setpoint_f': 74.5, 'dhw_eff': 0.525, 'dhw_gal_per_day': 69.0, 'dhw_location': 'unfinishedattic', }
```

**Expected Output (with Auto Format):**
```json
{
   "AC_installed_kbtuh": 20.12,
   "ceiling_and_roof_r_assembly_ip": 12.66,
   "central_ac_seer": 8,
   "cooling_setpoint_f": 74.5,
   "dhw_eff": 0.525,
   "dhw_gal_per_day": 69,
   "dhw_location": "unfinishedattic"
}
```

**Expected Output (with Auto Format + Auto Sort):**
```json
{
   "AC_installed_kbtuh": 20.12,
   "ceiling_and_roof_r_assembly_ip": 12.66,
   "central_ac_seer": 8,
   "cooling_setpoint_f": 74.5,
   "dhw_eff": 0.525,
   "dhw_gal_per_day": 69,
   "dhw_location": "unfinishedattic"
}
```
