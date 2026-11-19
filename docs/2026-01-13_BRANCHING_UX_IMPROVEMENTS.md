# Branching Feature - UX/UI Improvement Plan

**Last Updated**: 2026-01-13
**Status**: Proposal for Implementation

---

## Current State Analysis

### What Works Well ✅
1. **Core functionality** - Branch switching, create, rename, delete all work
2. **Visual indicator** - Modified dot (●) shows unsaved changes
3. **Auto-save** - Content saves automatically when switching
4. **Dropdown menu** - Compact with all essential actions
5. **Hover behavior** - Selector appears on panel hover (non-intrusive)

### Pain Points 🔴
1. **Save button buried in dropdown** - 3 clicks to save (open dropdown → find save → click)
2. **No visual feedback on save state** - Hard to know when content is saved
3. **Modified indicator too subtle** - Easy to miss the small pulsing dot
4. **No quick save shortcut** - Must use dropdown every time
5. **Branch list gets crowded** - Actions (rename, delete) inline makes it cluttered
6. **No timestamps visible** - Can't see when branch was last modified
7. **No context menu** - Right-click support missing
8. **No keyboard shortcuts** - All actions require mouse

---

## Proposed Improvements

### 1. **Separate Save Button** ⭐ HIGH PRIORITY

**Current:**
```
[🌿 Branch Name ▼]  ← Single button with dropdown
```

**Proposed:**
```
[💾] [🌿 Branch Name ▼]  ← Save button + Dropdown
```

**Benefits:**
- **1-click save** instead of 3 clicks
- Save button visible only when changes exist (conditional rendering)
- Visual feedback on hover/click
- Keyboard shortcut support (Ctrl+S)

**Implementation Details:**
```javascript
// CSS - Save button styling
.branch-save-btn {
  display: none;  /* Hidden by default */
  margin-right: 4px;
  padding: 4px 8px;
  background: #ff9800;
  color: white;
  border: 1px solid #f57c00;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  animation: pulse-save 1.5s ease-in-out infinite;
}

.branch-save-btn.show {
  display: inline-flex;  /* Show when modified */
}

@keyframes pulse-save {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.branch-save-btn:hover {
  background: #f57c00;
  transform: scale(1.05);
}

// State management
branchModified = {
  left: false,
  right: false
};

// Show/hide save button based on modified state
function updateSaveButtonVisibility(side) {
  const saveBtn = document.querySelector(`.branch-save-btn-${side}`);
  if (saveBtn) {
    saveBtn.classList.toggle('show', branchModified[side]);
  }
}
```

---

### 2. **Enhanced Modified Indicator** ⭐ HIGH PRIORITY

**Current:**
- Small orange dot (●) with subtle pulse
- Hard to notice

**Proposed:**
- **Save button replaces the dot** (more obvious)
- **Tooltip on hover**: "Unsaved changes - Click to save"
- **Save status text** next to branch name when saved: "✓ Saved"

**Alternative Visual States:**
```
SAVED:     [🌿 Main ▼]
MODIFIED:  [💾] [🌿 Main ▼]  ← Pulsing orange save button
SAVING:    [⏳] [🌿 Main ▼]  ← Brief loading state
```

---

### 3. **Improved Dropdown Menu Structure** ⭐ MEDIUM PRIORITY

**Current:**
```
✓ Main
  API v1  [✏️ 🗑️]
  API v2  [✏️ 🗑️]
  API v3  [✏️ 🗑️]
─────────────
➕ New Branch
💾 Save to Branch
─────────────
Total: 4 branches
─────────────
🔄 Reset All Branches
```

**Proposed - Cleaner Structure:**
```
BRANCHES                     [🔍]  ← Search (if >5 branches)
───────────────────────────────
✓ Main                    Just now
  API v1 (Production)     2h ago   [⋯]  ← Context menu icon
  API v2 (Staging)        1d ago   [⋯]
  API v3 (Development)    3d ago   [⋯]
───────────────────────────────
➕ New Branch
───────────────
Total: 4 branches
🔄 Reset All Branches (3)
```

**Benefits:**
- Timestamps show recency (e.g., "2h ago", "3d ago", "Just now")
- Context menu (⋯) keeps main list clean
- Search box appears when >5 branches
- Branch descriptions/notes shown in gray
- "Reset All" shows count of branches to be deleted

**Context Menu (on hover or click ⋯):**
```
✏️ Rename
📋 Duplicate
🗑️ Delete
📝 Edit Notes
```

---

### 4. **Keyboard Shortcuts** ⭐ HIGH PRIORITY

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Ctrl+S` (or `Cmd+S`) | Save current branch | Only when modified |
| `Ctrl+B` (or `Cmd+B`) | Open branch dropdown | Toggle |
| `Ctrl+Shift+N` | Create new branch | Shows prompt |
| `Ctrl+Shift+S` | Save as new branch | Fork current |
| `↑` / `↓` | Navigate branch list | When dropdown open |
| `Enter` | Switch to selected branch | When dropdown open |
| `Esc` | Close dropdown | When open |

**Implementation:**
```javascript
// Keyboard shortcut handler
document.addEventListener('keydown', (e) => {
  // Ctrl+S or Cmd+S - Save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const focusedPanel = getFocusedPanel(); // 'left' or 'right'
    if (branchModified[focusedPanel]) {
      saveCurrentToBranch(focusedPanel);
    }
  }

  // Ctrl+B or Cmd+B - Toggle branch dropdown
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    const focusedPanel = getFocusedPanel();
    toggleBranchDropdown(focusedPanel);
  }

  // Ctrl+Shift+N - New branch
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
    e.preventDefault();
    const focusedPanel = getFocusedPanel();
    createNewBranch(focusedPanel);
  }
});
```

---

### 5. **Right-Click Context Menu** ⭐ MEDIUM PRIORITY

**On branch selector button:**
```
Right-click → Context menu:
─────────────────────
💾 Save Now
📋 Duplicate Branch
✏️ Rename
🗑️ Delete
─────────────────────
📝 Branch Notes
🔒 Lock Branch (future)
```

**Benefits:**
- Power users can work faster
- Discoverability of advanced features
- Less clutter in main dropdown

---

### 6. **Visual Feedback Improvements** ⭐ MEDIUM PRIORITY

#### A. Save Confirmation
**Current:** Just status bar message (easy to miss)

**Proposed:**
- **Toast notification** (top-right, auto-dismiss in 2s)
- **Green checkmark** animation on save button
- **Haptic feedback** on mobile

```javascript
function showSaveConfirmation(branchName) {
  // Toast notification
  const toast = document.createElement('div');
  toast.className = 'save-toast';
  toast.innerHTML = `✓ Saved to <strong>${branchName}</strong>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
```

```css
.save-toast {
  position: fixed;
  top: 60px;
  right: 20px;
  background: #4caf50;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-size: 13px;
  z-index: 10000;
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

#### B. Branch Switch Animation
- **Smooth fade transition** between contents
- **Loading state** during switch (if slow IndexedDB)
- **Progress indicator** for large content

---

### 7. **Branch Metadata Display** ⭐ LOW PRIORITY

**Dropdown with metadata:**
```
✓ Main
  Last saved: Just now
  Source: System

  API v1 (Production)
  Last saved: 2 hours ago
  Source: Manual | 1.2 KB
  Notes: Production data from Jan 13
```

**Benefits:**
- See when branch was last modified
- File size helps identify large branches
- Notes provide context without opening

---

### 8. **Quick Branch Preview** ⭐ LOW PRIORITY

**On hover (after 1s delay):**
- Show tooltip with first 3 lines of JSON
- Display branch size (KB/MB)
- Show last modified timestamp

```javascript
function showBranchPreview(branchId, event) {
  const preview = document.createElement('div');
  preview.className = 'branch-preview-tooltip';

  const branch = await BranchManager.getBranch(branchId);
  const preview = branch.content.split('\n').slice(0, 3).join('\n');
  const size = (branch.content.length / 1024).toFixed(1);

  preview.innerHTML = `
    <div class="preview-header">${branch.name}</div>
    <pre class="preview-content">${preview}...</pre>
    <div class="preview-footer">${size} KB · ${formatTime(branch.timestamp)}</div>
  `;

  // Position near cursor
  preview.style.left = event.clientX + 'px';
  preview.style.top = event.clientY + 'px';
  document.body.appendChild(preview);
}
```

---

### 9. **Branch Search/Filter** ⭐ MEDIUM PRIORITY

**When >5 branches exist:**
```
BRANCHES
[🔍 Search branches...]  ← Fuzzy search input
───────────────────────────────
✓ Main
  API v1
  API v2 (Staging)  ← Highlighted match
  API v3
```

**Features:**
- Fuzzy search (matches partial names)
- Highlight matching text
- Show "No results" state
- Clear button (×)

```javascript
function filterBranches(searchTerm) {
  const branches = BranchManager.listBranches();
  const filtered = branches.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.metadata?.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  return filtered;
}
```

---

### 10. **Auto-Save Indicator** ⭐ LOW PRIORITY

**Show save status next to branch name:**
```
[💾] [🌿 Main (saving...) ▼]  ← While auto-saving
[🌿 Main ✓ ▼]                 ← After save complete
[💾] [🌿 Main (modified) ▼]   ← With unsaved changes
```

**Benefits:**
- Clear feedback on save state
- Users know when it's safe to close/refresh
- Builds trust in auto-save system

---

### 11. **Mobile/Responsive Improvements** ⭐ MEDIUM PRIORITY

**Current:** Dropdown works but cramped on mobile

**Proposed:**
- **Bottom sheet** instead of dropdown on mobile (<768px)
- **Larger touch targets** (48px minimum)
- **Swipe to close** gesture
- **Full-width buttons** for better tap accuracy

```css
@media (max-width: 768px) {
  .branch-dropdown {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    border-radius: 16px 16px 0 0;
    max-height: 70vh;
    transform: translateY(100%);
    transition: transform 0.3s ease-out;
  }

  .branch-dropdown.open {
    transform: translateY(0);
  }

  .branch-dropdown-item {
    padding: 12px 16px;
    font-size: 14px;
    min-height: 48px;
  }
}
```

---

### 12. **Advanced Features** (Future Consideration)

#### A. Branch Comparison
- **Compare two branches** side-by-side
- Button: "Compare with..." in context menu
- Opens diff view with selected branches

#### B. Branch Templates
- **Save branch as template** for reuse
- Templates folder in dropdown
- Quick populate with template data

#### C. Branch Locking
- **Lock branch** to prevent accidental edits
- Lock icon (🔒) shown on locked branches
- Unlock requires confirmation

#### D. Branch History
- **Version history** per branch (last 5 versions)
- Rollback to previous version
- See diff between versions

#### E. Branch Tags/Labels
- **Color-coded tags** (Production, Staging, Dev, Archive)
- Filter by tag
- Visual grouping in dropdown

---

## Implementation Priority

### Phase 1: Critical UX Fixes (Week 1)
1. ✅ Separate save button (1-click save)
2. ✅ Keyboard shortcuts (Ctrl+S, Ctrl+B)
3. ✅ Enhanced modified indicator
4. ✅ Save confirmation toast

### Phase 2: Usability Enhancements (Week 2)
5. ✅ Improved dropdown structure
6. ✅ Context menu (right-click)
7. ✅ Timestamps in dropdown
8. ✅ Branch search (if >5 branches)

### Phase 3: Polish & Advanced (Week 3)
9. ✅ Branch preview tooltip
10. ✅ Mobile bottom sheet
11. ✅ Auto-save indicator
12. ✅ Branch metadata display

### Phase 4: Future Enhancements (Backlog)
13. ⏳ Branch comparison
14. ⏳ Branch templates
15. ⏳ Branch locking
16. ⏳ Branch history/versioning
17. ⏳ Branch tags/labels

---

## Wireframes

### Current Design
```
┌─────────────────────────────┐
│   Editor Panel              │
│                             │
│   { "key": "value" }        │
│                             │
│                             │
│              [● 🌿 Main ▼] │ ← Bottom-right
└─────────────────────────────┘
                ↓ Click
┌──────────────────────────┐
│ ✓ Main                   │
│   API v1      [✏️ 🗑️]    │
│   API v2      [✏️ 🗑️]    │
│ ─────────────            │
│ ➕ New Branch            │
│ 💾 Save to Branch        │
└──────────────────────────┘
```

### Proposed Design
```
┌─────────────────────────────┐
│   Editor Panel              │
│                             │
│   { "key": "value" }        │
│                             │
│                             │
│      [💾] [🌿 Main ▼]      │ ← Save btn + Dropdown
└─────────────────────────────┘
           ↓ Click dropdown
┌────────────────────────────────┐
│ BRANCHES         [🔍 Search]   │
│ ─────────────────────────────  │
│ ✓ Main              Just now   │
│   API v1 (Prod)     2h ago [⋯] │
│   API v2 (Staging)  1d ago [⋯] │
│   API v3 (Dev)      3d ago [⋯] │
│ ─────────────────────────────  │
│ ➕ New Branch                  │
│ ─────────────────────────────  │
│ Total: 4 branches              │
│ 🔄 Reset All Branches (3)      │
└────────────────────────────────┘
           ↓ Click [⋯]
┌──────────────┐
│ ✏️ Rename    │
│ 📋 Duplicate │
│ 🗑️ Delete    │
│ 📝 Notes     │
└──────────────┘
```

---

## User Testing Questions

Before implementation, test with users:

1. **Save Button Position:**
   - Do users notice the save button?
   - Is left-side position intuitive?
   - Does the pulsing animation help or distract?

2. **Keyboard Shortcuts:**
   - Are Ctrl+S and Ctrl+B discoverable?
   - Should we show shortcut hints in UI?
   - Do users expect other shortcuts?

3. **Dropdown Structure:**
   - Is the new structure easier to scan?
   - Do timestamps add value or clutter?
   - Is context menu (⋯) discoverable?

4. **Mobile Experience:**
   - Is bottom sheet better than dropdown?
   - Are touch targets large enough?
   - Does swipe-to-close feel natural?

---

## Success Metrics

Track these after implementation:

1. **Save button usage** - % of saves via button vs. dropdown
2. **Keyboard shortcut adoption** - % of saves via Ctrl+S
3. **Average time to save** - Measure before/after (expect 3x faster)
4. **Branch creation rate** - Are users creating more branches?
5. **User satisfaction** - Survey rating (1-5 stars)
6. **Mobile engagement** - % of mobile users using branching

---

## Technical Considerations

### Performance
- **Debounce search** - Don't filter on every keystroke
- **Lazy load** branch previews (only on hover)
- **Virtual scrolling** for 50+ branches (unlikely but future-proof)
- **IndexedDB query optimization** - Cache metadata in memory

### Accessibility
- **ARIA labels** for all buttons
- **Keyboard navigation** throughout dropdown
- **Screen reader announcements** for save status
- **Focus management** when opening/closing dropdown

### Browser Compatibility
- **IndexedDB** - Already supported (current implementation)
- **Keyboard events** - Standard, works everywhere
- **CSS animations** - Graceful degradation for older browsers
- **Touch events** - Mobile gesture support

---

## Open Questions

1. **Should we auto-collapse dropdown after switching?**
   - Pro: Clean UX, less clicks to close
   - Con: Users might want to switch multiple times

2. **Should Ctrl+S save to current branch or prompt "Save as"?**
   - Current: Save to active branch
   - Alternative: Show "Save as" dialog for new branches

3. **How many branches before we require search?**
   - Proposed: >5 branches
   - Alternative: Always show, but optional to use

4. **Should we show branch size in dropdown?**
   - Pro: Helps identify large branches
   - Con: Adds visual clutter

5. **Should we support branch renaming via inline edit?**
   - Pro: Faster than dropdown menu
   - Con: Accidental edits possible

---

## Conclusion

These improvements focus on making the branching feature more **discoverable**, **efficient**, and **delightful** to use. The separate save button and keyboard shortcuts address the biggest pain point (3-click save → 1-click save), while the enhanced dropdown and metadata provide better context for branch management.

**Next Steps:**
1. Review with team/stakeholders
2. Create detailed implementation tickets
3. Build Phase 1 features (critical fixes)
4. User test with 5-10 users
5. Iterate based on feedback
6. Roll out Phase 2 & 3

---

**Questions? Feedback?**
Open an issue or discuss in the GitHub repository.
