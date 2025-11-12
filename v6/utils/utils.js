// Standalone utilities extracted from index.html
(function () {
  // URL Parameter Manager for shareable links
  const URLManager = {
    compress: function (str) {
      try {
        return btoa(encodeURIComponent(str));
      } catch (e) {
        console.warn("Compression failed, using fallback");
        return encodeURIComponent(str);
      }
    },

    decompress: function (str) {
      try {
        return decodeURIComponent(atob(str));
      } catch (e) {
        console.warn("Decompression failed, using fallback");
        return decodeURIComponent(str);
      }
    },

      // This function is intentionally left empty to prevent real-time URL updates.
    saveToURL: function (left, right) {
      // No-op. URL is now only generated on-demand.
    },

    loadFromURL: function () {
      const params = new URLSearchParams(window.location.search);
      const leftParam = params.get("left");
      const rightParam = params.get("right");
      const settingsParam = params.get("settings");

      if (!leftParam && !rightParam) return null;

      const result = {
        left: leftParam ? this.decompress(leftParam) : "",
        right: rightParam ? this.decompress(rightParam) : "",
        settings: null,
      };

      // Decode settings if present
      if (settingsParam) {
        try {
          const decompressed = this.decompress(settingsParam);
          result.settings = JSON.parse(decompressed);
        } catch (err) {
          console.warn('Failed to decode settings from URL:', err);
        }
      }

      return result;
    },

    generateShareableURL: function (leftContent, rightContent) {
      const params = new URLSearchParams();

      if (leftContent.trim()) {
        params.set("left", this.compress(leftContent));
      }
      if (rightContent.trim()) {
        params.set("right", this.compress(rightContent));
      }

      // Encode current settings in URL
      try {
        const currentSettings = SettingsManager.loadAll();
        const settingsStr = JSON.stringify(currentSettings);
        params.set("settings", this.compress(settingsStr));
      } catch (err) {
        console.warn('Failed to encode settings in URL:', err);
      }

      return (
        window.location.origin +
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "")
      );
    },

    clearURL: function () {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
      return cleanUrl;
    },
  };

  // Storage Manager Implementation
  const StorageManager = {
    STORAGE_KEY: "json_compare_data",
    EXPIRY_DAYS: 30,

    saveToStorage: function (leftContent, rightContent) {
      const data = {
        left: leftContent,
        right: rightContent,
        timestamp: new Date().getTime(),
      };
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        // localStorage quota exceeded or other failure — fall back to IndexedDB async save
        console.warn('localStorage.setItem failed, falling back to IndexedDB:', err && err.message ? err.message : err);
        try {
          // Fire-and-forget async save
          saveSnapshotToIDB(this.STORAGE_KEY, data).catch((e) => {
            console.error('IndexedDB fallback save failed:', e && e.message ? e.message : e);
          });
        } catch (e) {
          // ignore
        }
      }
    },

    loadFromStorage: function () {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (!storedData) return null;

      const data = JSON.parse(storedData);
      const now = new Date().getTime();
      const age = now - data.timestamp;
      const expiryTime = this.EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      if (age > expiryTime) {
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }

      return {
        left: data.left,
        right: data.right,
      };
    },
  };

  // --- IndexedDB Helpers (async fallback when localStorage is unavailable or full) ---
  const IDB_DB_NAME = 'json_compair_db';
  const IDB_STORE = 'snapshots';

  function openIDB() {
    return new Promise((resolve, reject) => {
      try {
        const r = indexedDB.open(IDB_DB_NAME, 1);
        r.onupgradeneeded = (e) => {
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
          } catch (ex) {
            console.warn('IDB upgrade error', ex);
          }
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error || new Error('IDB open failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  async function saveSnapshotToIDB(key, data) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.put(data, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error('IDB put failed'));
        tx.oncomplete = () => db.close();
      } catch (err) {
        reject(err);
      }
    });
  }

  async function loadSnapshotFromIDB(key) {
    try {
      const db = await openIDB();
      return await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const store = tx.objectStore(IDB_STORE);
          const req = store.get(key);
          req.onsuccess = () => {
            resolve(req.result || null);
            db.close();
          };
          req.onerror = () => {
            reject(req.error || new Error('IDB get failed'));
            db.close();
          };
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      return null;
    }
  }

  // Expose IDB helper functions on StorageManager for optional use
  StorageManager.saveToIndexedDB = function (leftContent, rightContent) {
    const data = { left: leftContent, right: rightContent, timestamp: new Date().getTime() };
    return saveSnapshotToIDB(this.STORAGE_KEY, data);
  };

  StorageManager.loadFromIndexedDB = function () {
    return loadSnapshotFromIDB(this.STORAGE_KEY);
  };

    // Settings Manager: persists small UI settings in localStorage (with simple fallback)
  const SettingsManager = {
    KEY: "json_compair_settings",
    defaults: {
      autoCsv: false,
      autoFormatJson: true,     // Auto-format JSON on paste/drop
      autoSortKeys: false,      // Auto-sort keys on paste/drop
      showOnlyDiffs: false,
      wordWrap: true,       // Default word wrap enabled
      scrollLock: true,     // Default scroll lock enabled
      theme: "default",     // default, light, or dark
      // Merge view settings
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: false,
      orientation: "a-b",
      revertControls: "none",
      scanLimit: 6000,     // Increased from 500 to better detect identical lines in different positions
      timeout: 5000,        // Max 5 seconds for detailed diff computation
    },

    loadAll: function () {
      try {
        const raw = localStorage.getItem(this.KEY);
        if (!raw) return Object.assign({}, this.defaults);
        const parsed = JSON.parse(raw);
        return Object.assign({}, this.defaults, parsed);
      } catch (e) {
        console.warn('Settings load failed, using defaults', e);
        return Object.assign({}, this.defaults);
      }
    },

    saveAll: function (obj) {
      try {
        const toSave = Object.assign({}, this.loadAll(), obj);
        localStorage.setItem(this.KEY, JSON.stringify(toSave));
        return true;
      } catch (e) {
        console.warn('Settings save failed', e);
        return false;
      }
    },

    get: function (key) {
      const all = this.loadAll();
      return all.hasOwnProperty(key) ? all[key] : this.defaults[key];
    },

    set: function (key, value) {
      const all = this.loadAll();
      all[key] = value;
      return this.saveAll(all);
    }
  };

  // Default templates
  // Generate longer example templates dynamically
  function makeUser(id, name, active, city) {
    return { id, name, active, city };
  }

  function makeUsers(count, startId, cityList) {
    const names = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Helen", "Ivy", "Jack"];
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push(
        makeUser(
          startId + i,
          names[i % names.length],
          i % 2 === 0,
          cityList[i % cityList.length]
        )
      );
    }
    return users;
  }

  const DefaultTemplates = {
    simple: {
      left: JSON.stringify(
        {
          name: "John",
          age: 30,
          city: "New York",
        },
        null,
        3
      ),
      right: JSON.stringify(
        {
          name: "John",
          age: 31,
          city: "Boston",
        },
        null,
        3
      ),
    },
    complex: {
      left: JSON.stringify(
        {
          users: [
            makeUser(1, "Alice", true, "Paris2"),
            makeUser(2, "Bob", false, "Boston"),
            makeUser(3, "Charlie", true, "Chicago"),
            makeUser(4, "David", false, "Paris2"), // identical
            makeUser(5, "Eve", true, "Boston"),    // identical
            makeUser(6, "Frank", false, "Chicago"),
            makeUser(7, "Grace", true, "Paris2"),
            makeUser(8, "Helen", false, "Boston"),
            makeUser(9, "Ivy", true, "Chicago"),
            makeUser(10, "Jack", false, "Paris2"),
          ],
          settings: {
            theme: "dark",
            notifications: true,
            version: "1.0.0",
            features: ["compare", "merge", "export", "import"],
          },
        },
        null,
        3
      ),
      right: JSON.stringify(
        {
          users: [
            makeUser(1, "Alice", true, "Paris2"),      // identical
            makeUser(2, "Bob", false, "Boston"),       // identical
            makeUser(3, "Charlie", false, "Chicago"),  // diff: active
            makeUser(4, "David", false, "Paris2"),     // identical
            makeUser(5, "Eve", true, "Boston"),        // identical
            makeUser(6, "Frank", true, "Chicago"),     // diff: active
            makeUser(7, "Grace", true, "Rome"),        // diff: city
            makeUser(8, "Helen", false, "Boston"),     // identical
            makeUser(9, "Ivy", true, "Chicago"),       // identical
            makeUser(10, "Jack", false, "Paris2"),     // identical
          ],
          settings: {
            theme: "light",
            notifications: false,
            version: "1.1.0",
            features: ["compare", "merge", "export", "import", "zip"],
          },
        },
        null,
        3
      ),
    },
    array: {
      left: JSON.stringify(
        [
          makeUser(100, "Alice", true, "London"),
          makeUser(101, "Bob", false, "Paris2"),
          makeUser(102, "Charlie", true, "Berlin"),
          makeUser(103, "David", false, "Dpn"),
          makeUser(104, "Eve", true, "London"),    // identical
          makeUser(105, "Frank", false, "Paris2"), // identical
          makeUser(106, "Grace", true, "Berlin"),  // identical
          makeUser(107, "Helen", false, "Dpn"),    // identical
          makeUser(108, "Ivy", true, "London"),
          makeUser(109, "Jack", false, "Paris2"),
          makeUser(110, "Alice", true, "Berlin"),
          makeUser(111, "Bob", false, "Dpn"),
          makeUser(112, "Charlie", true, "London"),
          makeUser(113, "David", false, "Paris2"),
          makeUser(114, "Eve", true, "Berlin"),
          makeUser(115, "Frank", false, "Dpn"),
          makeUser(116, "Grace", true, "London"),
          makeUser(117, "Helen", false, "Paris2"),
          makeUser(118, "Ivy", true, "Berlin"),
          makeUser(119, "Jack", false, "Dpn"),
        ],
        null,
        3
      ),
      right: JSON.stringify(
        [
          makeUser(100, "Alice", true, "London"),      // identical
          makeUser(101, "Bob", false, "Paris"),        // diff: city
          makeUser(102, "Charlie", true, "Berlin"),    // identical
          makeUser(103, "David", false, "Rome"),       // diff: city
          makeUser(104, "Eve", true, "London"),        // identical
          makeUser(105, "Frank", false, "Paris2"),     // identical
          makeUser(106, "Grace", true, "Berlin"),      // identical
          makeUser(107, "Helen", false, "Dpn"),        // identical
          makeUser(108, "Ivy", true, "London"),        // identical
          makeUser(109, "Jack", false, "Paris2"),      // identical
          makeUser(110, "Alice", true, "Berlin"),      // identical
          makeUser(111, "Bob", false, "Rome"),         // diff: city
          makeUser(112, "Charlie", true, "London"),    // identical
          makeUser(113, "David", false, "Paris2"),     // identical
          makeUser(114, "Eve", true, "Berlin"),        // identical
          makeUser(115, "Frank", false, "Dpn"),        // identical
          makeUser(116, "Grace", true, "London"),      // identical
          makeUser(117, "Helen", false, "Paris"),      // diff: city
          makeUser(118, "Ivy", true, "Berlin"),        // identical
          makeUser(119, "Jack", false, "Rome"),        // diff: city
        ],
        null,
        3
      ),
    },
  };

  // Function to sort JSON object keys recursively
  function sortJSONKeys(obj) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return sortJSONArray(obj); // Recursively sort arrays
    }
    const sortedObj = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sortedObj[key] = sortJSONKeys(obj[key]);
    }
    return sortedObj;
  }

  // Function to sort array items if they are objects or arrays
  function sortJSONArray(arr) {
    if (!Array.isArray(arr)) {
      return arr;
    }
    // If array contains only objects, sort by their stringified value
    if (
      arr.length > 0 &&
      arr.every(
        (item) =>
          typeof item === "object" && item !== null && !Array.isArray(item)
      )
    ) {
      arr = arr.slice().sort((a, b) => {
        const aStr = JSON.stringify(sortJSONKeys(a));
        const bStr = JSON.stringify(sortJSONKeys(b));
        if (aStr < bStr) return -1;
        if (aStr > bStr) return 1;
        return 0;
      });
    }
    return arr.map((item) => {
      if (item && typeof item === "object") {
        return sortJSONKeys(item); // Handles both objects and arrays
      }
      return item;
    });
  }

  // Expose utilities on the global window for compatibility
  window.URLManager = URLManager;
  window.StorageManager = StorageManager;
  window.DefaultTemplates = DefaultTemplates;
  window.sortJSONKeys = sortJSONKeys;
  window.sortJSONArray = sortJSONArray;
  window.SettingsManager = SettingsManager;
})();
