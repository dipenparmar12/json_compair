/**
 * Branch UI Improvements
 * - Separate save button
 * - Keyboard shortcuts
 * - Enhanced dropdown with timestamps
 * - Branch search
 * - Context menu
 * - Toast notifications
 * - Branch locking support
 */

(function() {
  'use strict';

  // ============================================================
  // Helper Functions
  // ============================================================

  /**
   * Format timestamp to relative time (e.g., "2h ago", "Just now")
   */
  function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'save-toast';
    toast.innerHTML = message;

    if (type === 'success') {
      toast.style.background = '#4caf50';
    } else if (type === 'error') {
      toast.style.background = '#f44336';
    } else if (type === 'warning') {
      toast.style.background = '#ff9800';
    }

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * Filter branches by search term
   */
  function filterBranches(branches, searchTerm) {
    if (!searchTerm || !searchTerm.trim()) return branches;

    const term = searchTerm.toLowerCase();
    return branches.filter(b =>
      b.name.toLowerCase().includes(term) ||
      b.id.toLowerCase().includes(term) ||
      (b.metadata?.notes || '').toLowerCase().includes(term)
    );
  }

  // ============================================================
  // Enhanced Branch Selector
  // ============================================================

  /**
   * Create save button (separate from dropdown)
   */
  function createSaveButton(side, saveCallback) {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'branch-save-btn';
    saveBtn.id = `branch-save-btn-${side}`;
    saveBtn.innerHTML = '💾';
    saveBtn.title = 'Save changes (Ctrl+S)';

    saveBtn.onclick = async (e) => {
      e.stopPropagation();
      await saveCallback();
    };

    return saveBtn;
  }

  /**
   * Create search box for branch dropdown
   */
  function createBranchSearch(onSearch) {
    const container = document.createElement('div');
    container.className = 'branch-search-container';
    container.style.position = 'relative';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'branch-search-input';
    input.placeholder = '🔍 Search branches...';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'branch-search-clear';
    clearBtn.innerHTML = '×';
    clearBtn.style.display = 'none';

    input.oninput = () => {
      const term = input.value;
      clearBtn.style.display = term ? 'block' : 'none';
      onSearch(term);
    };

    clearBtn.onclick = () => {
      input.value = '';
      clearBtn.style.display = 'none';
      onSearch('');
    };

    container.appendChild(input);
    container.appendChild(clearBtn);
    return container;
  }

  /**
   * Create context menu for branch
   */
  function createContextMenu(branch, side, callbacks) {
    const menu = document.createElement('div');
    menu.className = 'branch-context-menu';
    menu.style.display = 'none';

    const items = [];

    // Rename
    items.push({
      icon: '✏️',
      label: 'Rename',
      onClick: callbacks.onRename
    });

    // Duplicate
    items.push({
      icon: '📋',
      label: 'Duplicate',
      onClick: callbacks.onDuplicate
    });

    // Lock/Unlock
    if (branch.id !== 'main') {
      items.push({
        icon: branch.locked ? '🔓' : '🔒',
        label: branch.locked ? 'Unlock' : 'Lock',
        onClick: callbacks.onToggleLock
      });
    }

    // Notes
    items.push({
      icon: '📝',
      label: 'Edit Notes',
      onClick: callbacks.onEditNotes
    });

    // Delete
    if (branch.id !== 'main') {
      items.push({
        icon: '🗑️',
        label: 'Delete',
        onClick: callbacks.onDelete,
        danger: true
      });
    }

    items.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'branch-context-menu-item';
      if (item.danger) menuItem.classList.add('danger');
      menuItem.innerHTML = `${item.icon} ${item.label}`;
      menuItem.onclick = (e) => {
        e.stopPropagation();
        menu.style.display = 'none';
        item.onClick();
      };
      menu.appendChild(menuItem);
    });

    return menu;
  }

  /**
   * Create enhanced branch dropdown item
   */
  function createBranchItem(branch, isActive, side, callbacks) {
    const item = document.createElement('div');
    item.className = 'branch-dropdown-item branch-item-row';
    if (isActive) item.classList.add('active');

    // Main section (clickable)
    const mainSection = document.createElement('div');
    mainSection.className = 'branch-item-main';
    mainSection.onclick = callbacks.onSwitch;

    // Branch name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'branch-item-name';
    nameSpan.textContent = branch.name;
    mainSection.appendChild(nameSpan);

    // Lock indicator
    if (branch.locked) {
      const lockSpan = document.createElement('span');
      lockSpan.className = 'branch-item-lock';
      lockSpan.textContent = '🔒';
      lockSpan.title = 'Branch is locked';
      mainSection.appendChild(lockSpan);
    }

    // Timestamp
    if (branch.timestamp) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'branch-item-timestamp';
      timeSpan.textContent = formatRelativeTime(branch.timestamp);
      timeSpan.title = new Date(branch.timestamp).toLocaleString();
      mainSection.appendChild(timeSpan);
    }

    item.appendChild(mainSection);

    // Context menu button (except for main)
    if (branch.id !== 'main') {
      const contextBtn = document.createElement('button');
      contextBtn.className = 'branch-context-btn';
      contextBtn.innerHTML = '⋯';
      contextBtn.title = 'More options';

      const contextMenu = createContextMenu(branch, side, callbacks);

      contextBtn.onclick = (e) => {
        e.stopPropagation();
        const isVisible = contextMenu.style.display !== 'none';

        // Close all other context menus
        document.querySelectorAll('.branch-context-menu').forEach(m => m.style.display = 'none');

        contextMenu.style.display = isVisible ? 'none' : 'block';
      };

      item.appendChild(contextBtn);
      item.appendChild(contextMenu);
    }

    return item;
  }

  // ============================================================
  // Keyboard Shortcuts
  // ============================================================

  /**
   * Initialize keyboard shortcuts
   */
  function initKeyboardShortcuts(callbacks) {
    document.addEventListener('keydown', (e) => {
      // Ignore shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Allow Ctrl+S even in editors
        if (!((e.ctrlKey || e.metaKey) && e.key === 's')) {
          return;
        }
      }

      // Ctrl/Cmd + S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        callbacks.onSave();
        return;
      }

      // Ctrl/Cmd + B - Toggle branch dropdown
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        callbacks.onToggleDropdown();
        return;
      }

      // Ctrl/Cmd + Shift + N - New branch
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        callbacks.onNewBranch();
        return;
      }

      // Ctrl/Cmd + Shift + S - Save as new branch
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        callbacks.onSaveAsNew();
        return;
      }
    });
  }

  // ============================================================
  // Export to window
  // ============================================================

  window.BranchUIHelpers = {
    formatRelativeTime,
    showToast,
    filterBranches,
    createSaveButton,
    createBranchSearch,
    createContextMenu,
    createBranchItem,
    initKeyboardShortcuts
  };

})();
