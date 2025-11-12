# CSV Conversion Button Feature

## Overview
Added contextual "Convert CSV to JSON" buttons that appear automatically when CSV content is detected in either panel.

## User Experience

### When CSV is Detected
1. User pastes or drops CSV content into a panel
2. A blue "📊 Convert CSV to JSON" button appears at the **bottom-left** of that panel
3. User clicks the button
4. CSV is converted to formatted JSON (3-space indentation)
5. Button disappears (content is now JSON, not CSV)

### When Content is JSON
- No conversion button visible
- User can edit normally

## Implementation Details

### Button Creation
- **Location**: Bottom-left of each pane (10px from bottom, 10px from left)
- **Styling**: Blue (#007bff) with hover effect
- **Classes**: `.csv-convert-btn`, `.csv-convert-left`, `.csv-convert-right`
- **Z-index**: 100 (floats above editor)

### Detection Logic
Uses `window.CSVUtils.isCSV(content)` to detect CSV format:
- Checks for common separators (`,`, `\t`, `;`)
- Validates consistent column count
- Requires minimum 2 rows
- Handles quoted fields

### Auto-Updates
Button visibility updates automatically on:
1. **Content changes** (via auto-save extension debounce - 300ms)
2. **Paste operations**
3. **File drops**
4. **Manual edits**

### Code Structure

```javascript
// Add button to pane (called during initialization)
function addCSVConversionButton(paneElement, side) {
  // Creates button with inline styles
  // Wires up click handler for conversion
  // Adds hover effects
}

// Update button visibility based on content
function updateCSVConversionButtons() {
  // Check left panel content
  const leftIsCSV = CSVUtils.isCSV(leftContent);
  leftBtn.style.display = leftIsCSV ? 'block' : 'none';
  
  // Check right panel content
  const rightIsCSV = CSVUtils.isCSV(rightContent);
  rightBtn.style.display = rightIsCSV ? 'block' : 'none';
}
```

### Integration Points

1. **Auto-save extension** - Debounces button updates (300ms)
2. **Pane controls** - Created alongside copy/paste/clear buttons
3. **Content handlers** - Called after paste/drop operations
4. **Update functions** - Integrated into `updatePaneButtonVisibility()`

## Benefits

✅ **Contextual** - Only appears when relevant  
✅ **Non-intrusive** - Positioned out of the way  
✅ **Clear action** - Obvious what the button does  
✅ **Immediate feedback** - Button appears/disappears based on content  
✅ **Accessible** - Large click target with clear label  

## CSS Styling

```css
Button styles (inline):
- Background: #007bff (hover: #0056b3)
- Color: white
- Padding: 8px 16px
- Border-radius: 4px
- Box-shadow: 0 2px 4px rgba(0,0,0,0.2)
- Font: 13px, weight 500
- Position: absolute, bottom-left
```

## Example Workflow

### Scenario: User has CSV data

1. **Copy CSV from Excel**
   ```csv
   name,age,city
   John,30,NYC
   Jane,25,LA
   ```

2. **Paste into left panel**
   - CSV content appears
   - "📊 Convert CSV to JSON" button appears at bottom-left

3. **Click convert button**
   - Content transforms to:
   ```json
   [
      {
         "name": "John",
         "age": 30,
         "city": "NYC"
      },
      {
         "name": "Jane",
         "age": 25,
         "city": "LA"
      }
   ]
   ```
   - Button disappears (content is now JSON)

4. **User can now compare** with JSON in right panel

## Edge Cases Handled

- **Empty panels**: No button shown
- **Invalid CSV**: No button shown
- **Already JSON**: No button shown
- **Mixed content**: Uses heuristic detection
- **Large files**: Async conversion prevents UI freeze
- **Conversion failure**: Shows error message, preserves original content

## Performance

- **Debounced updates**: 300ms delay prevents excessive checks
- **Async conversion**: Large CSV files don't block UI
- **Efficient detection**: CSVUtils.isCSV() is fast heuristic check

## Files Modified

- **index.html**
  - Added `addCSVConversionButton()` function
  - Added `updateCSVConversionButtons()` function
  - Updated `updatePaneButtonVisibility()` to call CSV button update
  - Updated `autoSaveExtension` to debounce CSV button updates
  - Integrated into `addPaneControls()` initialization

## Future Enhancements

Potential improvements:
- [ ] Show CSV column count in button tooltip
- [ ] Allow choosing delimiter before conversion
- [ ] Preview conversion before applying
- [ ] Support TSV/PSV (pipe-separated) detection
- [ ] Add "Revert to CSV" button after conversion
