/**
 * BranchManager - Git-like branching for JSON Compare panels
 * Enables switching between named "branches" (stored sessions) per panel.
 * 
 * Storage: IndexedDB for branch content, localStorage for metadata/index
 * 
 * Branch structure:
 * {
 *   id: string,         // Slug ID (e.g., "api-v1")
 *   name: string,       // Display name (e.g., "API v1")
 *   content: string,    // JSON content
 *   timestamp: number,  // Last modified timestamp
 *   metadata: {
 *     source: string,   // "manual", "import", "paste", "drop"
 *     notes: string     // Optional user notes
 *   }
 * }
 */
(function () {
  const IDB_DB_NAME = 'json_compair_branches_db';
  const IDB_STORE = 'branches';
  const META_KEY = 'json_compair_branch_index';
  const MAX_BRANCHES_WARNING = 20;

  // Each panel's default branch. Its NAME is the panel title shown above the
  // editor, so it defaults to the label the panel had before titles were
  // editable. Installs from before that carry the old names; init() migrates
  // them only while they are still exactly the untouched default.
  const MAIN_NAMES = { 'main-left': 'Left', 'main-right': 'Right' };
  const LEGACY_MAIN_NAMES = { 'main-left': 'Main Left', 'main-right': 'Main Right' };

  /**
   * Generate a slug ID from a display name
   * @param {string} name - Display name
   * @returns {string} - Slug ID
   */
  function generateSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      || 'branch-' + Date.now();
  }

  /**
   * Generate a unique ID ensuring no collision with existing branches
   * @param {string} baseName - Base display name
   * @param {Object} existingBranches - Map of existing branch IDs
   * @returns {string} - Unique slug ID
   */
  function generateUniqueId(baseName, existingBranches) {
    let slug = generateSlug(baseName);
    let counter = 1;
    let uniqueSlug = slug;
    
    while (existingBranches[uniqueSlug]) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    
    return uniqueSlug;
  }

  // ============================================================
  // IndexedDB helpers for branch content storage
  // ============================================================

  function openBranchDB() {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(IDB_DB_NAME, 1);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'id' });
          }
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open branch database'));
      } catch (err) {
        reject(err);
      }
    });
  }

  async function saveBranchToIDB(branch) {
    const db = await openBranchDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const request = store.put(branch);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      } catch (err) {
        reject(err);
      }
    });
  }

  async function loadBranchFromIDB(id) {
    try {
      const db = await openBranchDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const request = store.get(id);
        
        request.onsuccess = () => {
          resolve(request.result || null);
          db.close();
        };
        request.onerror = () => {
          reject(request.error);
          db.close();
        };
      });
    } catch (err) {
      console.warn('Failed to load branch from IDB:', err);
      return null;
    }
  }

  async function deleteBranchFromIDB(id) {
    const db = await openBranchDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      } catch (err) {
        reject(err);
      }
    });
  }

  async function getAllBranchesFromIDB() {
    try {
      const db = await openBranchDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result || []);
          db.close();
        };
        request.onerror = () => {
          reject(request.error);
          db.close();
        };
      });
    } catch (err) {
      console.warn('Failed to get all branches from IDB:', err);
      return [];
    }
  }

  // ============================================================
  // Branch metadata index (localStorage for quick access)
  // ============================================================

  function loadBranchIndex() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (err) {
      console.warn('Failed to load branch index:', err);
      return {};
    }
  }

  function saveBranchIndex(index) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(index));
      return true;
    } catch (err) {
      console.warn('Failed to save branch index:', err);
      return false;
    }
  }

  // ============================================================
  // BranchManager API
  // ============================================================

  const BranchManager = {
    /**
     * Initialize branch system with default 'main-left' and 'main-right' branches if none exist
     * @returns {Promise<void>}
     */
    async init() {
      const index = loadBranchIndex();
      
      // Migration: if old 'main' branch exists, rename it to 'main-left'
      if (index['main'] && !index['main-left']) {
        const mainBranch = await this.getBranch('main');
        if (mainBranch) {
          await this.saveBranch('main-left', mainBranch.content || '', {
            name: 'Main Left',
            source: 'system',
            notes: 'Default left panel branch',
            panel: 'left'
          });
        }
        // Delete old main branch
        await deleteBranchFromIDB('main');
        delete index['main'];
        saveBranchIndex(index);
      }
      
      // Create default branches for each panel if they don't exist
      if (!index['main-left']) {
        await this.saveBranch('main-left', '', {
          name: MAIN_NAMES['main-left'],
          source: 'system',
          notes: 'Default left panel branch',
          panel: 'left',
          created: 0
        });
      }

      if (!index['main-right']) {
        await this.saveBranch('main-right', '', {
          name: MAIN_NAMES['main-right'],
          source: 'system',
          notes: 'Default right panel branch',
          panel: 'right',
          created: 0
        });
      }

      // The old default names made every panel title read "Main Left".
      for (const id of Object.keys(LEGACY_MAIN_NAMES)) {
        const entry = loadBranchIndex()[id];
        if (entry && entry.name === LEGACY_MAIN_NAMES[id]) {
          await this.renameBranch(id, MAIN_NAMES[id]);
        }
      }

      // Tabs are ordered by creation, and `timestamp` moves on every save — a
      // tab ordered by it would jump to the front each time it was saved.
      // Branches from before `created` existed get their last-modified time,
      // once, which is the best order still recoverable.
      const fresh = loadBranchIndex();
      let backfilled = false;
      for (const entry of Object.values(fresh)) {
        entry.metadata = entry.metadata || {};
        if (typeof entry.metadata.created !== 'number') {
          entry.metadata.created = MAIN_NAMES[entry.id] ? 0 : (entry.timestamp || Date.now());
          backfilled = true;
        }
      }
      if (backfilled) saveBranchIndex(fresh);
    },

    /** True for the two per-panel default branches, which cannot be deleted or moved. */
    isMainBranch(id) {
      return Object.prototype.hasOwnProperty.call(MAIN_NAMES, id);
    },

    /** The name a branch falls back to when its title is cleared. */
    defaultName(id) {
      return MAIN_NAMES[id] || 'Untitled';
    },

    /**
     * List all branches with metadata (without full content)
     * @param {string} [panel] - Optional panel filter ('left' or 'right') - strict filtering
     * @returns {Array<{id, name, timestamp, metadata}>}
     */
    listBranches(panel = null) {
      const index = loadBranchIndex();
      let branches = Object.values(index);
      
      // Strict filter by panel - only show branches belonging to this panel
      if (panel) {
        branches = branches.filter(b => {
          // Only show branches explicitly assigned to this panel
          return b.metadata?.panel === panel;
        });
      }
      
      // Stable order, because it is the TAB order: main branch first, then in
      // the order branches were created (new tabs appear at the end). This used
      // to be most-recently-modified first, which is fine for a dropdown and
      // wrong for tabs — saving a tab would have moved it.
      const created = (b) => {
        const c = b.metadata && b.metadata.created;
        return typeof c === 'number' ? c : (b.timestamp || 0);
      };
      return branches.sort((a, b) => {
        const aIsMain = a.id.startsWith('main-');
        const bIsMain = b.id.startsWith('main-');
        if (aIsMain && !bIsMain) return -1;
        if (!aIsMain && bIsMain) return 1;
        if (aIsMain && bIsMain) return a.id.localeCompare(b.id);
        return (created(a) - created(b)) || a.id.localeCompare(b.id);
      });
    },

    /**
     * Get a branch by ID (with full content)
     * @param {string} id - Branch ID
     * @returns {Promise<Object|null>} - Branch object or null
     */
    async getBranch(id) {
      const branch = await loadBranchFromIDB(id);
      return branch;
    },

    /**
     * Save or update a branch
     * @param {string} id - Branch ID (will be auto-generated if creating new)
     * @param {string} content - JSON content
     * @param {Object} options - { name?, source?, notes?, panel?, created? }
     * @returns {Promise<Object>} - Saved branch object
     */
    async saveBranch(id, content, options = {}) {
      const index = loadBranchIndex();
      const existing = index[id];
      const now = Date.now();
      const prevCreated = existing && existing.metadata ? existing.metadata.created : undefined;
      // A new branch's creation time must be strictly the latest: two created
      // in the same millisecond tied, and the tie fell back to id order, so a
      // tab could appear before one made earlier.
      let fresh = now;
      if (typeof options.created !== 'number' && typeof prevCreated !== 'number') {
        for (const entry of Object.values(index)) {
          const c = entry && entry.metadata && entry.metadata.created;
          if (typeof c === 'number' && c >= fresh) fresh = c + 1;
        }
      }

      const branch = {
        id: id,
        name: options.name || (existing ? existing.name : id),
        content: content,
        timestamp: now,
        metadata: {
          source: options.source || (existing ? existing.metadata?.source : 'manual'),
          notes: options.notes !== undefined ? options.notes : (existing ? existing.metadata?.notes : ''),
          panel: options.panel || (existing ? existing.metadata?.panel : null),  // Preserve panel affiliation
          // Creation time orders the tabs; unlike `timestamp` it never moves.
          created: typeof options.created === 'number' ? options.created
            : (typeof prevCreated === 'number' ? prevCreated : fresh)
        }
      };

      // Save full content to IndexedDB
      await saveBranchToIDB(branch);

      // Save metadata to index (without content)
      index[id] = {
        id: branch.id,
        name: branch.name,
        timestamp: branch.timestamp,
        metadata: branch.metadata
      };
      saveBranchIndex(index);

      return branch;
    },

    /**
     * Create a new branch with auto-generated unique ID
     * @param {string} name - Display name for the branch
     * @param {string} content - Initial content
     * @param {Object} metadata - { source?, notes?, panel? }
     * @returns {Promise<Object>} - Created branch object
     */
    async createBranch(name, content = '', metadata = {}) {
      const index = loadBranchIndex();
      
      // Check branch limit warning
      if (Object.keys(index).length >= MAX_BRANCHES_WARNING) {
        console.warn(`You have ${Object.keys(index).length} branches. Consider deleting unused ones.`);
      }

      const id = generateUniqueId(name, index);
      
      return await this.saveBranch(id, content, {
        name: name,
        source: metadata.source || 'manual',
        notes: metadata.notes || '',
        panel: metadata.panel || null  // Pass panel affiliation to saveBranch
      });
    },

    /**
     * Delete a branch
     * @param {string} id - Branch ID to delete
     * @returns {Promise<boolean>} - Success status
     */
    async deleteBranch(id) {
      if (id === 'main-left' || id === 'main-right') {
        console.warn('Cannot delete the main branches');
        return false;
      }

      const index = loadBranchIndex();
      
      if (!index[id]) {
        console.warn(`Branch '${id}' not found`);
        return false;
      }

      // Delete from IndexedDB
      await deleteBranchFromIDB(id);

      // Remove from index
      delete index[id];
      saveBranchIndex(index);

      return true;
    },

    /**
     * Rename a branch
     * @param {string} id - Branch ID
     * @param {string} newName - New display name
     * @returns {Promise<Object|null>} - Updated branch or null
     */
    async renameBranch(id, newName) {
      const branch = await this.getBranch(id);
      if (!branch) {
        console.warn(`Branch '${id}' not found`);
        return null;
      }

      branch.name = newName;
      branch.timestamp = Date.now();

      // Save updated branch
      await saveBranchToIDB(branch);

      // Update index
      const index = loadBranchIndex();
      if (index[id]) {
        index[id].name = newName;
        index[id].timestamp = branch.timestamp;
        saveBranchIndex(index);
      }

      return branch;
    },

    /**
     * Move a branch to a different panel
     * @param {string} id - Branch ID
     * @param {string} newPanel - Target panel ('left' or 'right')
     * @returns {Promise<Object|null>} - Updated branch or null
     */
    async moveBranchToPanel(id, newPanel) {
      // Cannot move main branches
      if (id === 'main-left' || id === 'main-right') {
        console.warn('Cannot move main branches');
        return null;
      }
      
      const branch = await this.getBranch(id);
      if (!branch) {
        console.warn(`Branch '${id}' not found`);
        return null;
      }

      // Update panel affiliation
      branch.metadata = branch.metadata || {};
      branch.metadata.panel = newPanel;
      branch.timestamp = Date.now();

      // Save updated branch
      await saveBranchToIDB(branch);

      // Update index
      const index = loadBranchIndex();
      if (index[id]) {
        index[id].metadata = index[id].metadata || {};
        index[id].metadata.panel = newPanel;
        index[id].timestamp = branch.timestamp;
        saveBranchIndex(index);
      }

      return branch;
    },

    /**
     * Duplicate a branch
     * @param {string} sourceId - Source branch ID
     * @param {string} newName - Name for the new branch
     * @returns {Promise<Object|null>} - New branch or null
     */
    async duplicateBranch(sourceId, newName) {
      const source = await this.getBranch(sourceId);
      if (!source) {
        console.warn(`Source branch '${sourceId}' not found`);
        return null;
      }

      return await this.createBranch(newName, source.content, {
        source: 'duplicate',
        notes: `Duplicated from ${source.name}`
      });
    },

    /**
     * Check if content differs from saved branch
     * @param {string} id - Branch ID
     * @param {string} currentContent - Current editor content
     * @returns {Promise<boolean>} - True if modified
     */
    async isModified(id, currentContent) {
      const branch = await this.getBranch(id);
      if (!branch) return false;
      return branch.content !== currentContent;
    },

    /**
     * Export all branches for snapshot
     * @returns {Promise<Object>} - All branches with content
     */
    async exportAll() {
      const branches = await getAllBranchesFromIDB();
      const result = {};
      
      for (const branch of branches) {
        result[branch.id] = branch;
      }
      
      return result;
    },

    /**
     * Import branches from snapshot
     * @param {Object} branches - Branch data object
     * @param {string} mode - 'merge' or 'replace'
     * @returns {Promise<{imported: number, skipped: number}>}
     */
    async importBranches(branches, mode = 'merge') {
      let imported = 0;
      let skipped = 0;

      if (mode === 'replace') {
        // Clear existing branches except 'main'
        const existing = this.listBranches();
        for (const branch of existing) {
          if (branch.id !== 'main') {
            await this.deleteBranch(branch.id);
          }
        }
      }

      const index = loadBranchIndex();

      for (const [id, branchData] of Object.entries(branches)) {
        if (mode === 'merge' && index[id]) {
          // Skip existing branches in merge mode
          skipped++;
          continue;
        }

        // Panel and creation order have to come across too: branches are listed
        // strictly per panel, so one imported without its panel was saved,
        // counted, and never shown anywhere.
        await this.saveBranch(id, branchData.content || '', {
          name: branchData.name || id,
          source: branchData.metadata?.source || 'import',
          notes: branchData.metadata?.notes || '',
          panel: branchData.metadata?.panel || null,
          created: branchData.metadata?.created
        });
        imported++;
      }

      return { imported, skipped };
    },

    /**
     * Get branch count
     * @returns {number}
     */
    count() {
      const index = loadBranchIndex();
      return Object.keys(index).length;
    }
  };

  // Expose on window
  window.BranchManager = BranchManager;
})();
