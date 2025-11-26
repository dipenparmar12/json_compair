# Git-like Branching Feature

## Overview

The JSON Compare Tool now supports Git-like branching, allowing users to save and switch between multiple content versions per panel. This enables easy comparison across different API versions, environments, or data snapshots.

---

## Key Features

### 1. **Branch Selector**
- Located at the bottom-right of each editor panel
- Shows current branch name with a dropdown for switching
- Visual indicator (●) for unsaved changes

### 2. **Branch Operations**
| Action | Description |
|--------|-------------|
| **Switch** | Save current → Load selected branch |
| **New Branch** | Create from current content |
| **Rename** | Change branch display name |
| **Delete** | Remove branch (except 'main') |
| **Save** | Manually save current content |

### 3. **Auto-Save Behavior**
- Content auto-saves to localStorage (legacy) every 300ms
- When switching branches, current content is saved to the old branch
- Modified indicator shows unsaved changes vs. stored branch

---

## Data Model

### Branch Structure
```javascript
{
  id: "api-v2",           // Slug ID (auto-generated from name)
  name: "API v2",         // Display name
  content: "{ ... }",     // JSON content
  timestamp: 1732656000,  // Last modified (Unix ms)
  metadata: {
    source: "manual",     // "manual", "import", "paste", "drop", "auto-save"
    notes: ""             // Optional user notes
  }
}
```

### Storage
- **IndexedDB** (`json_compair_branches_db`) — Branch content (large data)
- **localStorage** (`json_compair_branch_index`) — Branch metadata index
- **Settings** (`leftBranch`, `rightBranch`) — Active branch per panel

---

## User Workflows

### Comparing API Versions
1. Paste API v1 response in left panel
2. Click branch selector → "New Branch" → Name it "API v1"
3. Paste API v2 response (content auto-saves to "API v1")
4. Create "API v2" branch
5. Now switch between branches to compare different versions

### Importing Branches
1. Import a ZIP snapshot containing `branches.json`
2. Branches merge with existing (duplicates skipped)
3. Switch to imported branches via dropdown

### Exporting Branches
1. Click "Share URL" or trigger export
2. If content > 2000 chars, ZIP is downloaded
3. ZIP includes `branches.json` with all saved branches

---

## API Reference

### `window.BranchManager`

```javascript
// Initialize (called on app start)
await BranchManager.init();

// List all branches (metadata only)
const branches = BranchManager.listBranches();
// Returns: [{id, name, timestamp, metadata}, ...]

// Get branch with content
const branch = await BranchManager.getBranch("api-v2");
// Returns: {id, name, content, timestamp, metadata}

// Save/update branch
await BranchManager.saveBranch("api-v2", content, {
  name: "API v2",
  source: "manual"
});

// Create new branch (auto-generates unique ID)
const newBranch = await BranchManager.createBranch("API v3", content);

// Delete branch (cannot delete 'main')
await BranchManager.deleteBranch("api-v2");

// Rename branch
await BranchManager.renameBranch("api-v2", "API v2 Production");

// Check if modified
const isModified = await BranchManager.isModified("api-v2", currentContent);

// Export all branches
const allBranches = await BranchManager.exportAll();

// Import branches
await BranchManager.importBranches(branchData, "merge"); // or "replace"
```

---

## Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `leftBranch` | string | `"main"` | Active branch ID for left panel |
| `rightBranch` | string | `"main"` | Active branch ID for right panel |
| `leftPanelName` | string | `""` | Display name (synced from branch) |
| `rightPanelName` | string | `""` | Display name (synced from branch) |

---

## Files Modified

| File | Changes |
|------|---------|
| `v6/utils/utils_branch.js` | New BranchManager utility |
| `v6/utils/utils.js` | Added `leftBranch`, `rightBranch` defaults |
| `v6/utils/utils_zip.js` | Export/import `branches.json` |
| `v6/index.html` | Branch selector UI, switching logic |
| `v6/css/app.css` | Branch selector styling |

---

## UI Components

### Branch Selector Button
- Shows: 🌿 {Branch Name} ▼
- Click to open dropdown
- Modified indicator (●) pulses when changes exist

### Dropdown Menu
- List of all branches (✓ marks current)
- Divider
- ➕ New Branch
- ✏️ Rename Branch (if not 'main')
- 🗑️ Delete Branch (if not 'main')
- 💾 Save to Branch

---

## Limitations

1. **Branch limit**: Soft warning at 20 branches (no hard limit)
2. **No conflict resolution**: Switching auto-saves; no merge conflicts
3. **No branch history**: Only latest content per branch is stored
4. **Main branch**: Cannot be deleted or renamed

---

## Future Enhancements (Potential)

- [ ] Branch timestamps display in dropdown
- [ ] Duplicate branch option
- [ ] Branch notes/descriptions
- [ ] Branch search/filter for large lists
- [ ] Visual branch comparison (diff two branches)
- [ ] Branch locking to prevent accidental edits
