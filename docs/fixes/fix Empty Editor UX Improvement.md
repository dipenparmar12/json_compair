# Empty Editor UX Improvement

### Problem
Empty editors showed overlay placeholders that:
- Completely hid the editor and cursor
- Made panels appear non-interactive
- Required typing to discover editability

### Solution
Replaced custom overlay placeholders with **CodeMirror 6's built-in placeholder extension**.

### Changes Made

#### A. Added placeholder import
```javascript
import {
  lineNumbers,
  // ... other imports
  placeholder,  // NEW
} from "@codemirror/view";
```

#### B. Created placeholder text
```javascript
const leftPlaceholderText = "Left Panel\n\n✏️  Paste JSON/CSV content\n📁 Drag & drop files here\n⌨️  Start typing directly\n\nUse ⚙️ Diff Settings for auto-format options";
const rightPlaceholderText = "Right Panel\n\n✏️  Paste JSON/CSV content\n📁 Drag & drop files here\n⌨️  Start typing directly\n\nUse ⚙️ Diff Settings for auto-format options";
```

#### C. Added to editor extensions
```javascript
mergeView = new MergeView({
  a: {
    doc: initialContent.left,
    extensions: [
      basicSetup,
      json(),
      // ... other extensions
      placeholder(leftPlaceholderText)  // NEW
    ],
  },
  b: {
    doc: initialContent.right,
    extensions: [
      basicSetup,
      json(),
      // ... other extensions
      placeholder(rightPlaceholderText)  // NEW
    ],
  },
  // ... rest of config
});
```

#### D. Removed old placeholder functions
Replaced `addPlaceholders()`, `addPlaceholderToPane()`, and `updatePlaceholders()` with stub functions.

#### E. Added CSS styling
In `css/app.css`:
```css
.cm-placeholder {
    color: #999 !important;
    font-style: normal !important;
    font-size: 14px !important;
    line-height: 1.6 !important;
    opacity: 0.7 !important;
    white-space: pre-wrap !important;
    padding: 20px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}
```

### Benefits
✅ **Cursor visible** in empty editors  
✅ **Clearly editable** - users can click and type immediately  
✅ **Native behavior** - placeholder disappears as soon as typing starts  
✅ **Better UX** - no confusing overlay that hides the editor  
✅ **Less code** - removed ~70 lines of custom placeholder logic  

---

## Testing Checklist

### Python Dict Fix
- [x] Python dict with Auto CSV enabled → Valid JSON
- [x] Python dict with Auto Format enabled → Valid JSON
- [x] Python dict with Auto Sort enabled → Valid sorted JSON
- [x] Actual CSV with Auto CSV enabled → JSON array
- [x] Invalid content → Original text preserved
- [x] Settings persist across page reloads

### Empty Editor UX
- [x] Placeholder shows in empty editors
- [x] Cursor visible and blinking in empty editor
- [x] Click in empty editor → cursor appears
- [x] Type in empty editor → placeholder disappears
- [x] Placeholder reappears when all text deleted
- [x] Works in both left and right panels
- [x] Placeholder text styled properly

---

## Files Modified

1. **index.html** (3 major changes)
   - Added `placeholder` import from `@codemirror/view`
   - Implemented JSON-first parsing in 3 handler functions
   - Added settings persistence for Auto Format/Sort
   - Added placeholder text constants
   - Updated MergeView creation (2 places) to include placeholder extension
   - Replaced placeholder overlay functions with stubs

2. **css/app.css** (1 addition)
   - Added `.cm-placeholder` styling

---

## Example Test Case

### Input (Python dict):
```python
{'AC_installed_kbtuh': 20.12, 'ceiling_and_roof_r_assembly_ip': 12.66, 'central_ac_seer': 8.0, 'cooling_setpoint_f': 74.5, 'dhw_eff': 0.525, 'dhw_gal_per_day': 69.0, 'dhw_location': 'unfinishedattic', }
```

### Expected Output (with Auto Format):
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

### Empty Editor State:
- Shows gray placeholder text with usage instructions
- Cursor visible and blinking
- Click anywhere to start typing
- Placeholder vanishes on first character
