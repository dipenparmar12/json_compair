# Branching UI Improvements - Implementation Guide

**Date**: 2026-01-13
**Status**: Ready for Implementation

---

## Overview

This guide provides step-by-step instructions to implement the branching UX improvements in `v6/index.html`.

## Prerequisites

1. ✅ Updated `v6/utils/utils_branch.js` with locking support
2. ✅ Updated `v6/css/app.css` with new styles
3. ✅ Created `v6/utils/branch_ui_improvements.js` helper library

---

## Step 1: Load Helper Script

**File**: `v6/index.html`
**Location**: In `<head>`, after other utility scripts

```html
<!-- Existing scripts -->
<script src="./utils/utils.js"></script>
<script src="./utils/json_utils.js"></script>
<script src="./utils/utils_csv.js"></script>
<script src="./utils/utils_zip.js"></script>
<script src="./utils/utils_branch.js"></script>
<script src="./utils/viewport_diff.js"></script>

<!-- ADD THIS LINE -->
<script src="./utils/branch_ui_improvements.js"></script>
```

---

## Step 2: Update `addBranchSelector` Function

**File**: `v6/index.html`
**Location**: Around line 1299
**Action**: Replace the entire function

### Find This:

```javascript
function addBranchSelector(paneElement, side) {
  const container = document.createElement('div');
  container.className = `branch-selector-container branch-selector-${side}`;
  // ... existing code ...
}
```

### Replace With:

```javascript
function addBranchSelector(paneElement, side) {
  const container = document.createElement('div');
  container.className = `branch-selector-container branch-selector-${side}`;
  container.id = `branch-container-${side}`;

  // Save button (separate from dropdown)
  const saveBtn = window.BranchUIHelpers.createSaveButton(side, async () => {
    await saveCurrentToBranch(side);
  });
  saveBtn.id = `branch-save-btn-${side}`;

  // Branch selector button
  const branchBtn = document.createElement('button');
  branchBtn.className = 'branch-selector-btn';
  branchBtn.id = `branch-btn-${side}`;
  branchBtn.title = 'Switch branch (Ctrl+B)';

  // Dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'branch-dropdown';
  dropdown.id = `branch-dropdown-${side}`;
  dropdown.style.display = 'none';

  // Search state
  let currentSearchTerm = '';

  // Update button text
  const updateBranchButton = async () => {
    const branchId = activeBranches[side];
    const branch = await window.BranchManager.getBranch(branchId);

    let icon = '🌿';
    if (branch && branch.locked) icon = '🔒';

    branchBtn.innerHTML = `<span class="branch-icon">${icon}</span> ${branch ? branch.name : branchId} <span class="branch-arrow">▼</span>`;
  };

  // Populate dropdown with enhancements
  const populateDropdown = async () => {
    dropdown.innerHTML = '';
    let branches = window.BranchManager.listBranches();

    // Add search box if >5 branches
    if (branches.length > 5) {
      const searchBox = window.BranchUIHelpers.createBranchSearch((term) => {
        currentSearchTerm = term;
        populateDropdown();
      });
      dropdown.appendChild(searchBox);
    }

    // Filter branches by search
    if (currentSearchTerm) {
      branches = window.BranchUIHelpers.filterBranches(branches, currentSearchTerm);
    }

    // Header
    const header = document.createElement('div');
    header.className = 'branch-dropdown-header';
    header.textContent = 'BRANCHES';
    dropdown.appendChild(header);

    // Branch list
    for (const branch of branches) {
      const isActive = branch.id === activeBranches[side];

      // Get full branch data for lock status
      const fullBranch = await window.BranchManager.getBranch(branch.id);

      const item = window.BranchUIHelpers.createBranchItem(
        fullBranch || branch,
        isActive,
        side,
        {
          onSwitch: async (e) => {
            e.stopPropagation();

            // Check if locked
            if (fullBranch && fullBranch.locked) {
              window.BranchUIHelpers.showToast('⚠️ Cannot switch to locked branch', 'warning');
              return;
            }

            try {
              await switchBranch(side, branch.id);
              dropdown.style.display = 'none';
            } catch (error) {
              console.error(`Failed to switch branch: ${error}`);
              window.BranchUIHelpers.showToast(`❌ Error: ${error.message}`, 'error');
            }
          },
          onRename: async () => {
            dropdown.style.display = 'none';
            await renameBranchById(branch.id);
          },
          onDuplicate: async () => {
            dropdown.style.display = 'none';
            const newName = prompt(`Duplicate "${branch.name}" as:`, `${branch.name} (copy)`);
            if (newName && newName.trim()) {
              try {
                const duplicate = await window.BranchManager.duplicateBranch(branch.id, newName.trim());
                window.BranchUIHelpers.showToast(`✓ Duplicated to <strong>${duplicate.name}</strong>`);
                updateBranchSelectors();
              } catch (err) {
                window.BranchUIHelpers.showToast(`❌ Failed to duplicate: ${err.message}`, 'error');
              }
            }
          },
          onToggleLock: async () => {
            dropdown.style.display = 'none';
            try {
              const updated = await window.BranchManager.toggleLock(branch.id);
              if (updated) {
                const status = updated.locked ? '🔒 Locked' : '🔓 Unlocked';
                window.BranchUIHelpers.showToast(`${status} <strong>${updated.name}</strong>`);
                updateBranchSelectors();
              }
            } catch (err) {
              window.BranchUIHelpers.showToast(`❌ ${err.message}`, 'error');
            }
          },
          onEditNotes: async () => {
            dropdown.style.display = 'none';
            const currentNotes = fullBranch?.metadata?.notes || '';
            const newNotes = prompt(`Notes for "${branch.name}":`, currentNotes);
            if (newNotes !== null) {
              try {
                const content = fullBranch?.content || '';
                await window.BranchManager.saveBranch(branch.id, content, {
                  notes: newNotes
                });
                window.BranchUIHelpers.showToast(`✓ Updated notes for <strong>${branch.name}</strong>`);
              } catch (err) {
                window.BranchUIHelpers.showToast(`❌ ${err.message}`, 'error');
              }
            }
          },
          onDelete: async () => {
            dropdown.style.display = 'none';
            await deleteBranchById(branch.id, side);
          }
        }
      );

      dropdown.appendChild(item);
    }

    // No results message
    if (branches.length === 0 && currentSearchTerm) {
      const noResults = document.createElement('div');
      noResults.className = 'branch-dropdown-item';
      noResults.style.color = '#999';
      noResults.style.cursor = 'default';
      noResults.textContent = 'No branches found';
      dropdown.appendChild(noResults);
    }

    // Divider
    const divider = document.createElement('div');
    divider.className = 'branch-dropdown-divider';
    dropdown.appendChild(divider);

    // New Branch option
    const newBranchItem = document.createElement('div');
    newBranchItem.className = 'branch-dropdown-item branch-action';
    newBranchItem.innerHTML = '<span class="branch-item-icon">➕</span> New Branch';
    newBranchItem.onclick = async (e) => {
      e.stopPropagation();
      dropdown.style.display = 'none';
      await createNewBranch(side);
    };
    dropdown.appendChild(newBranchItem);

    // Branch count info
    const allBranches = window.BranchManager.listBranches();
    const infoItem = document.createElement('div');
    infoItem.className = 'branch-dropdown-item branch-info';
    infoItem.textContent = `${allBranches.length} branch${allBranches.length !== 1 ? 'es' : ''} total`;
    dropdown.appendChild(infoItem);

    // Reset all branches option
    if (allBranches.length > 1) {
      const divider2 = document.createElement('div');
      divider2.className = 'branch-dropdown-divider';
      dropdown.appendChild(divider2);

      const resetItem = document.createElement('div');
      resetItem.className = 'branch-dropdown-item branch-action branch-delete';
      const nonMainCount = allBranches.length - 1;
      resetItem.innerHTML = `<span class="branch-item-icon">🔄</span> Reset All Branches (${nonMainCount})`;
      resetItem.onclick = async (e) => {
        e.stopPropagation();
        dropdown.style.display = 'none';
        await resetAllBranches(side);
      };
      dropdown.appendChild(resetItem);
    }
  };

  // Toggle dropdown
  branchBtn.onclick = async (e) => {
    e.stopPropagation();
    const isVisible = dropdown.style.display !== 'none';

    // Close all other dropdowns
    document.querySelectorAll('.branch-dropdown').forEach(d => d.style.display = 'none');

    if (!isVisible) {
      currentSearchTerm = ''; // Reset search
      await populateDropdown();
      dropdown.style.display = 'block';

      // Close on outside click
      const closeDropdown = (event) => {
        if (!container.contains(event.target)) {
          dropdown.style.display = 'none';
          document.removeEventListener('click', closeDropdown);
        }
      };

      setTimeout(() => {
        document.addEventListener('click', closeDropdown);
      }, 0);
    }
  };

  // Assemble container
  container.appendChild(saveBtn);
  container.appendChild(branchBtn);
  container.appendChild(dropdown);
  paneElement.appendChild(container);

  // Initial state
  updateBranchButton();

  // Store references
  container._updateButton = updateBranchButton;
  container._populateDropdown = populateDropdown;
}
```

---

## Step 3: Update `saveCurrentToBranch` Function

**Location**: Around line 1550
**Action**: Enhance with toast notification and save button feedback

### Find This:

```javascript
async function saveCurrentToBranch(side) {
  const branchId = activeBranches[side];
  const editor = side === 'left' ? mergeView.a : mergeView.b;
  const content = editor.state.doc.toString();

  try {
    await window.BranchManager.saveBranch(branchId, content, {
      source: 'manual'
    });

    branchModified[side] = false;
    updateBranchModifiedIndicator(side);
    updateStatus(`Saved to branch: ${branchId}`);
  } catch (err) {
    showErrorMessage('Failed to save branch: ' + err.message);
  }
}
```

### Replace With:

```javascript
async function saveCurrentToBranch(side) {
  const branchId = activeBranches[side];
  const editor = side === 'left' ? mergeView.a : mergeView.b;
  const content = editor.state.doc.toString();

  const saveBtn = document.getElementById(`branch-save-btn-${side}`);

  try {
    // Show saving state
    if (saveBtn) {
      saveBtn.classList.add('saving');
      saveBtn.innerHTML = '⏳';
    }

    await window.BranchManager.saveBranch(branchId, content, {
      source: 'manual'
    });

    branchModified[side] = false;
    updateBranchModifiedIndicator(side);

    // Get branch name for display
    const branch = await window.BranchManager.getBranch(branchId);
    const branchName = branch ? branch.name : branchId;

    // Show success state
    if (saveBtn) {
      saveBtn.classList.remove('saving');
      saveBtn.classList.add('saved');
      saveBtn.innerHTML = '✓';

      // Reset after 1 second
      setTimeout(() => {
        saveBtn.classList.remove('saved');
        saveBtn.innerHTML = '💾';
      }, 1000);
    }

    // Show toast notification
    window.BranchUIHelpers.showToast(`✓ Saved to <strong>${branchName}</strong>`);
    updateStatus(`Saved to branch: ${branchName}`);

  } catch (err) {
    // Show error state
    if (saveBtn) {
      saveBtn.classList.remove('saving', 'saved');
      saveBtn.innerHTML = '💾';
    }

    showErrorMessage('Failed to save branch: ' + err.message);
    window.BranchUIHelpers.showToast(`❌ ${err.message}`, 'error');
  }
}
```

---

## Step 4: Update `updateBranchModifiedIndicator` Function

**Location**: Search for `function updateBranchModifiedIndicator`
**Action**: Show/hide save button instead of dot indicator

### Find This:

```javascript
function updateBranchModifiedIndicator(side) {
  const indicator = document.getElementById(`branch-modified-${side}`);
  if (indicator) {
    indicator.style.display = branchModified[side] ? 'inline' : 'none';
  }
}
```

### Replace With:

```javascript
function updateBranchModifiedIndicator(side) {
  const saveBtn = document.getElementById(`branch-save-btn-${side}`);
  if (saveBtn) {
    if (branchModified[side]) {
      saveBtn.classList.add('show');
    } else {
      saveBtn.classList.remove('show');
    }
  }

  // Legacy indicator (can remove if desired)
  const indicator = document.getElementById(`branch-modified-${side}`);
  if (indicator) {
    indicator.style.display = 'none'; // Always hidden now
  }
}
```

---

## Step 5: Update `switchBranch` Function

**Location**: Around line 1494
**Action**: Add locked branch check

### Find This (at the start of the function):

```javascript
async function switchBranch(side, newBranchId) {
  const currentBranchId = activeBranches[side];

  if (currentBranchId === newBranchId) return;
```

### Replace With:

```javascript
async function switchBranch(side, newBranchId) {
  const currentBranchId = activeBranches[side];

  if (currentBranchId === newBranchId) return;

  // Check if target branch is locked
  const targetBranch = await window.BranchManager.getBranch(newBranchId);
  if (targetBranch && targetBranch.locked) {
    window.BranchUIHelpers.showToast('⚠️ Cannot switch to locked branch', 'warning');
    updateStatus('✗ Branch is locked');
    return;
  }

  // Check if current branch is locked
  const currentBranch = await window.BranchManager.getBranch(currentBranchId);
  if (currentBranch && currentBranch.locked) {
    window.BranchUIHelpers.showToast('⚠️ Current branch is locked', 'warning');
    updateStatus('✗ Cannot save to locked branch');
    return;
  }
```

---

## Step 6: Add Keyboard Shortcuts Initialization

**Location**: After `window.addEventListener('DOMContentLoaded', ...)`
**Action**: Add keyboard shortcut initialization

### Add This Code:

```javascript
// Initialize keyboard shortcuts for branching
window.BranchUIHelpers.initKeyboardShortcuts({
  onSave: () => {
    // Determine focused panel (left/right)
    const focusedPanel = getFocusedPanel(); // You may need to implement this
    if (branchModified[focusedPanel]) {
      saveCurrentToBranch(focusedPanel);
    }
  },
  onToggleDropdown: () => {
    const focusedPanel = getFocusedPanel();
    const btn = document.getElementById(`branch-btn-${focusedPanel}`);
    if (btn) btn.click();
  },
  onNewBranch: () => {
    const focusedPanel = getFocusedPanel();
    createNewBranch(focusedPanel);
  },
  onSaveAsNew: () => {
    const focusedPanel = getFocusedPanel();
    const name = prompt('Save as new branch:', '');
    if (name && name.trim()) {
      const editor = focusedPanel === 'left' ? mergeView.a : mergeView.b;
      const content = editor.state.doc.toString();
      window.BranchManager.createBranch(name.trim(), content).then(branch => {
        window.BranchUIHelpers.showToast(`✓ Created <strong>${branch.name}</strong>`);
        updateBranchSelectors();
      });
    }
  }
});

// Helper: Get focused panel (left or right)
function getFocusedPanel() {
  // Check which editor has focus
  const leftEditor = mergeView.a.dom;
  const rightEditor = mergeView.b.dom;

  if (leftEditor.contains(document.activeElement)) return 'left';
  if (rightEditor.contains(document.activeElement)) return 'right';

  // Default to left if neither focused
  return 'left';
}
```

---

## Step 7: Remove Old Modified Indicator Creation

**Location**: In `addBranchSelector` function
**Action**: Remove/comment out old dot indicator code

### Find This:

```javascript
// Modified indicator
const modifiedIndicator = document.createElement('span');
modifiedIndicator.className = 'branch-modified-indicator';
modifiedIndicator.id = `branch-modified-${side}`;
modifiedIndicator.textContent = '●';
modifiedIndicator.title = 'Unsaved changes';
modifiedIndicator.style.display = 'none';
```

### Change To:

```javascript
// Modified indicator - now replaced by save button
// (Keeping for backward compatibility but hidden)
const modifiedIndicator = document.createElement('span');
modifiedIndicator.className = 'branch-modified-indicator';
modifiedIndicator.id = `branch-modified-${side}`;
modifiedIndicator.textContent = '●';
modifiedIndicator.title = 'Unsaved changes';
modifiedIndicator.style.display = 'none'; // Always hidden
```

---

## Step 8: Test All Features

### Manual Testing Checklist:

1. **Save Button**
   - [ ] Appears when content is modified
   - [ ] Disappears when content is saved
   - [ ] Pulsing animation works
   - [ ] Click saves successfully
   - [ ] Shows saving → saved states
   - [ ] Toast notification appears

2. **Keyboard Shortcuts**
   - [ ] Ctrl+S saves current branch
   - [ ] Ctrl+B toggles dropdown
   - [ ] Ctrl+Shift+N creates new branch
   - [ ] Ctrl+Shift+S saves as new branch

3. **Enhanced Dropdown**
   - [ ] Shows timestamps ("2h ago", "Just now")
   - [ ] Search box appears when >5 branches
   - [ ] Search filters correctly
   - [ ] Context menu (⋯) appears on hover
   - [ ] Lock icon shows for locked branches

4. **Branch Locking**
   - [ ] Can lock/unlock branches
   - [ ] Cannot switch to locked branch
   - [ ] Cannot save to locked branch
   - [ ] Lock icon shows in dropdown
   - [ ] Toast shows lock status

5. **Context Menu**
   - [ ] Rename works
   - [ ] Duplicate works
   - [ ] Lock/unlock works
   - [ ] Edit notes works
   - [ ] Delete works

6. **Toast Notifications**
   - [ ] Shows on save success
   - [ ] Shows on error
   - [ ] Auto-dismisses after 2s
   - [ ] Slide-in animation works

7. **General**
   - [ ] All features work on both panels
   - [ ] No console errors
   - [ ] Smooth animations
   - [ ] Mobile responsive

---

## Troubleshooting

### Save button doesn't appear
- Check that `branch_ui_improvements.js` is loaded
- Verify CSS class `branch-save-btn.show` exists
- Check console for JavaScript errors

### Keyboard shortcuts don't work
- Ensure `initKeyboardShortcuts` is called
- Check that `getFocusedPanel()` is implemented
- Verify no other scripts are preventing shortcuts

### Timestamps show "undefined"
- Ensure branches have `timestamp` property
- Check that old branches are migrated
- Verify `formatRelativeTime` function works

### Context menu doesn't show
- Check z-index conflicts
- Verify menu positioning CSS
- Ensure click handler is attached

### Branch locking errors
- Verify `utils_branch.js` has lock methods
- Check that branches have `locked` property
- Ensure IndexedDB schema supports new field

---

## Performance Considerations

1. **Search debouncing**: Already handled in input event
2. **Dropdown population**: Only happens on open (lazy)
3. **Timestamp formatting**: Lightweight function
4. **Context menu**: Created dynamically per branch

---

## Future Enhancements

Once base implementation is complete, consider:

1. **Branch preview tooltip** - Show first 3 lines on hover
2. **Keyboard navigation** - Arrow keys in dropdown
3. **Batch operations** - Select multiple branches
4. **Branch comparison** - Diff two branches
5. **Mobile bottom sheet** - Better mobile UX

---

## Rollback Plan

If issues occur, revert by:

1. Remove `<script src="./utils/branch_ui_improvements.js"></script>`
2. Restore original `addBranchSelector` function from git
3. Restore original `saveCurrentToBranch` function
4. Clear browser cache and IndexedDB

---

## Questions?

Open an issue or check the documentation:
- `/docs/BRANCHING_FEATURE.md` - Original feature docs
- `/docs/BRANCHING_UX_IMPROVEMENTS.md` - UX improvement specs

**Last Updated**: 2026-01-13
