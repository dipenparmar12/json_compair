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

    // Persist an explicit "cleared" state: overwrite the localStorage record
    // with an empty pair (removing the key entirely would make the next load
    // fall back to the demo template instead of staying empty) and delete the
    // IndexedDB fallback record (written when localStorage was full) so stale
    // oversized content can never resurface after a refresh.
    clearStorage: function () {
      try {
        this.saveToStorage('', '');
      } catch (err) {
        console.warn('Failed to persist cleared state:', err && err.message ? err.message : err);
      }
      return deleteSnapshotFromIDB(this.STORAGE_KEY);
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

  async function deleteSnapshotFromIDB(key) {
    try {
      const db = await openIDB();
      return await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          const req = store.delete(key);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error || new Error('IDB delete failed'));
          tx.oncomplete = () => db.close();
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      return false;
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
      blockDiff: true,      // Object-aware (block-level) diff for valid JSON; falls back to text diff
      ignorePatterns: [],   // Key names / /regex/ excluded from the diff (grayed out)
      ignoreScope: "both",  // What patterns match: 'key' | 'value' | 'both'
      ignoreStyled: true,   // Show excluded matches with a subdued gray tint

      orientation: "a-b",
      revertControls: "none",
      scanLimit: 6000,     // Increased from 500 to better detect identical lines in different positions
      timeout: 5000,        // Max 5 seconds for detailed diff computation
      // Performance settings
      performanceMode: false,   // Enable optimized settings for large files
      viewportDiff: false,      // Only compute diffs for visible area
      // Panel names for UX (deprecated, replaced by branches)
      leftPanelName: "",    // Name/ID for left panel
      rightPanelName: "",   // Name/ID for right panel
      // Branch settings - track active branch per panel
      leftBranch: "main",   // Active branch ID for left panel
      rightBranch: "main",  // Active branch ID for right panel
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
          name: "John Doe",
          age: 30,
          city: "New York",
          status: "active"
        },
        null,
        2
      ),
      right: JSON.stringify(
        {
          name: "John Doe",
          age: 31,
          city: "New York-2",
          status: "active"
        },
        null,
        2
      )
    },
    user_profile: {
      left: JSON.stringify(
        {
          user_id: 10482,
          legacy_id: "USR-2021-994",
          username: "alex_developer",
          status: "pending_verification",
          role: "editor",
          profile: {
            first_name: "Alex",
            last_name: "Morgan",
            email: "alex.morgan@example.com",
            phone: "+1-555-019-2834",
            avatar_url: "https://cdn.example.com/avatars/user-10482.jpg",
            address: {
              street: "742 Evergreen Terrace",
              city: "Springfield",
              state: "IL",
              postal_code: "62704",
              country: "USA"
            }
          },
          account: {
            created_at: "2024-01-15T08:30:00Z",
            last_login: "2026-07-20T14:22:10Z",
            login_count: 42,
            email_verified: false
          },
          roles: ["content_creator", "beta_tester"]
        },
        null,
        2
      ),
      right: JSON.stringify(
        {
          user_id: 10482,
          username: "alex_developer",
          status: "active",
          role: "admin",
          profile: {
            first_name: "Alexander",
            last_name: "Morgan",
            email: "alex.morgan@example.com",
            phone: "+1-555-019-2834",
            avatar_url: "https://cdn.example.com/avatars/v2/user-10482.webp",
            address: {
              street: "742 Evergreen Terrace",
              suite: "Building B, Suite 400",
              city: "Springfield",
              state: "IL",
              postal_code: "62704",
              country: "USA"
            }
          },
          preferences: {
            theme: "dark",
            language: "en-US",
            notifications: {
              email: true,
              push: false,
              sms: true
            }
          },
          account: {
            created_at: "2024-01-15T08:30:00Z",
            last_login: "2026-07-27T10:15:00Z",
            login_count: 87,
            email_verified: true,
            mfa_enabled: true
          },
          roles: ["content_creator", "beta_tester", "system_administrator"]
        },
        null,
        2
      )
    },
    api: {
      left: JSON.stringify(
        {
          status_code: 200,
          message: "Success",
          data_version: "1.0",
          page: 1,
          per_page: 2,
          total_records: 4,
          products: [
            {
              id: "PROD-101",
              name: "Wireless Noise-Canceling Headphones",
              category: "Audio",
              price: 199.99,
              in_stock: true,
              tags: ["audio", "wireless", "bluetooth"]
            },
            {
              id: "PROD-102",
              name: "Ergonomic Mechanical Keyboard",
              category: "Peripherals",
              price: 129.50,
              in_stock: false,
              tags: ["office", "keyboard"]
            }
          ]
        },
        null,
        2
      ),
      right: JSON.stringify(
        {
          status_code: 200,
          message: "Operation completed successfully",
          data_version: "2.0",
          meta: {
            pagination: {
              current_page: 1,
              per_page: 2,
              total_records: 5,
              total_pages: 3,
              has_next: true
            },
            response_time_ms: 42
          },
          products: [
            {
              id: "PROD-101",
              name: "Wireless Noise-Canceling Headphones",
              category: "Audio & Sound",
              price: 179.99,
              in_stock: true,
              rating: 4.8,
              tags: ["audio", "wireless", "bluetooth", "noise-canceling"]
            },
            {
              id: "PROD-102",
              name: "Ergonomic Mechanical Keyboard",
              category: "Peripherals",
              price: 129.50,
              in_stock: true,
              rating: 4.6,
              tags: ["office", "keyboard", "rgb"]
            }
          ]
        },
        null,
        2
      )
    },
    array: {
      left: JSON.stringify(
        [
          {
            node_id: "us-east-1a",
            hostname: "node-01.east.internal",
            role: "primary_db",
            status: "healthy",
            capacity: { cpu: 16, ram_gb: 64 },
            services: ["postgres", "pgbouncer"]
          },
          {
            node_id: "us-east-1b",
            hostname: "node-02.east.internal",
            role: "replica_db",
            status: "healthy",
            capacity: { cpu: 16, ram_gb: 64 },
            services: ["postgres"]
          },
          {
            node_id: "us-west-2a",
            hostname: "node-03.west.internal",
            role: "api_gateway",
            status: "degraded",
            capacity: { cpu: 8, ram_gb: 32 },
            services: ["envoy", "rate_limiter"]
          },
          {
            node_id: "eu-central-1a",
            hostname: "node-04.eu.internal",
            role: "cache",
            status: "healthy",
            capacity: { cpu: 8, ram_gb: 16 },
            services: ["redis"]
          }
        ],
        null,
        2
      ),
      right: JSON.stringify(
        [
          {
            node_id: "us-east-1a",
            hostname: "node-01.east.internal",
            role: "primary_db",
            status: "healthy",
            capacity: { cpu: 32, ram_gb: 128 },
            services: ["postgres", "pgbouncer", "metrics_exporter"]
          },
          {
            node_id: "us-west-2a",
            hostname: "node-03.west.internal",
            role: "api_gateway",
            status: "healthy",
            capacity: { cpu: 16, ram_gb: 32 },
            services: ["envoy", "rate_limiter"]
          },
          {
            node_id: "us-east-1b",
            hostname: "node-02.east.internal",
            role: "replica_db",
            status: "healthy",
            capacity: { cpu: 16, ram_gb: 64 },
            services: ["postgres"]
          },
          {
            node_id: "ap-southeast-1a",
            hostname: "node-05.asia.internal",
            role: "cache",
            status: "healthy",
            capacity: { cpu: 8, ram_gb: 16 },
            services: ["redis"]
          }
        ],
        null,
        2
      )
    },
    config: {
      left: JSON.stringify(
        {
          environment: "staging",
          app_name: "inventory-management-service",
          version: "2.4.0-rc1",
          server: {
            port: 8080,
            host: "0.0.0.0",
            workers: 2,
            cors_origins: ["https://staging.example.com", "http://localhost:3000"]
          },
          database: {
            host: "db-staging.internal.example.com",
            port: 5432,
            name: "inventory_staging",
            pool_size: 5,
            ssl_enabled: false
          },
          logging: {
            level: "debug",
            format: "text",
            output: "stdout"
          },
          feature_flags: {
            enable_ai_search: true,
            enable_beta_checkout: true,
            enable_strict_rate_limit: false
          }
        },
        null,
        2
      ),
      right: JSON.stringify(
        {
          environment: "production",
          app_name: "inventory-management-service",
          version: "2.4.0",
          server: {
            port: 8080,
            host: "0.0.0.0",
            workers: 16,
            cors_origins: ["https://app.example.com"]
          },
          database: {
            host: "db-prod-cluster.internal.example.com",
            port: 5432,
            name: "inventory_prod",
            pool_size: 50,
            ssl_enabled: true
          },
          logging: {
            level: "info",
            format: "json",
            output: "cloudwatch"
          },
          feature_flags: {
            enable_ai_search: false,
            enable_beta_checkout: false,
            enable_strict_rate_limit: true
          }
        },
        null,
        2
      )
    },
    ecommerce: {
      left: JSON.stringify(
        {
          order_id: "ORD-2026-88912",
          status: "payment_confirmed",
          created_at: "2026-07-27T09:00:00Z",
          updated_at: "2026-07-27T09:02:15Z",
          customer: {
            customer_id: "CUST-4402",
            name: "Samantha Reed",
            email: "samantha.reed@example.com"
          },
          pricing: {
            subtotal: 149.98,
            discount: 0.00,
            tax: 12.00,
            shipping_fee: 5.99,
            total: 167.97,
            currency: "USD"
          },
          items: [
            {
              item_id: "ITEM-10",
              name: "Smart Fitness Tracker",
              quantity: 1,
              unit_price: 99.99,
              status: "allocated"
            },
            {
              item_id: "ITEM-25",
              name: "Stainless Steel Water Bottle",
              quantity: 2,
              unit_price: 24.995,
              status: "allocated"
            }
          ],
          fulfillment: {
            warehouse_id: "WH-EAST-01",
            carrier: null,
            tracking_number: null,
            shipped_at: null
          }
        },
        null,
        2
      ),
      right: JSON.stringify(
        {
          order_id: "ORD-2026-88912",
          status: "shipped",
          created_at: "2026-07-27T09:00:00Z",
          updated_at: "2026-07-27T11:30:00Z",
          customer: {
            customer_id: "CUST-4402",
            name: "Samantha Reed",
            email: "samantha.reed@example.com"
          },
          pricing: {
            subtotal: 149.98,
            discount: 15.00,
            tax: 10.80,
            shipping_fee: 0.00,
            total: 145.78,
            currency: "USD",
            promo_code: "SUMMER15"
          },
          items: [
            {
              item_id: "ITEM-10",
              name: "Smart Fitness Tracker",
              quantity: 1,
              unit_price: 99.99,
              status: "packed"
            },
            {
              item_id: "ITEM-25",
              name: "Stainless Steel Water Bottle",
              quantity: 2,
              unit_price: 24.995,
              status: "packed"
            }
          ],
          fulfillment: {
            warehouse_id: "WH-EAST-01",
            carrier: "FedEx Express",
            tracking_number: "FX-994827103-US",
            shipped_at: "2026-07-27T11:28:44Z"
          }
        },
        null,
        2
      )
    }
  };

  // Backwards compatibility alias for 'complex'
  DefaultTemplates.complex = DefaultTemplates.config;

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
