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

    saveToURL: function (leftContent, rightContent) {
      const params = new URLSearchParams();

      if (leftContent.trim()) {
        params.set("left", this.compress(leftContent));
      }
      if (rightContent.trim()) {
        params.set("right", this.compress(rightContent));
      }

      const newUrl =
        window.location.origin +
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "");

      window.history.replaceState({}, "", newUrl);

      return newUrl;
    },

    loadFromURL: function () {
      const params = new URLSearchParams(window.location.search);
      const leftParam = params.get("left");
      const rightParam = params.get("right");

      if (!leftParam && !rightParam) return null;

      return {
        left: leftParam ? this.decompress(leftParam) : "",
        right: rightParam ? this.decompress(rightParam) : "",
      };
    },

    generateShareableURL: function (leftContent, rightContent) {
      const params = new URLSearchParams();

      if (leftContent.trim()) {
        params.set("left", this.compress(leftContent));
      }
      if (rightContent.trim()) {
        params.set("right", this.compress(rightContent));
      }

      return (
        window.location.origin +
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "")
      );
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
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
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

  // Default templates
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
            {
              id: 1,
              name: "Alice",
              active: true,
            },
            {
              id: 2,
              name: "Bob",
              active: false,
            },
          ],
          settings: {
            theme: "dark",
            notifications: true,
          },
        },
        null,
        3
      ),
      right: JSON.stringify(
        {
          users: [
            {
              id: 1,
              name: "Alice",
              active: false,
            },
            {
              id: 3,
              name: "Charlie",
              active: true,
            },
          ],
          settings: {
            theme: "light",
            notifications: true,
          },
        },
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
  // Mode utilities for syntax highlighting (moved from index.html)
  const ModeUtils = (function () {
    const modeMap = {
      'application/json': { name: 'javascript', script: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/javascript/javascript.min.js' },
      'text/plain': { name: 'null', script: null },
      'text/csv': { name: 'csv', script: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/csv/csv.min.js' },
      'javascript': { name: 'javascript', script: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/javascript/javascript.min.js' },
      'python': { name: 'python', script: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/python/python.min.js' },
      'text/html': { name: 'htmlmixed', script: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/xml/xml.min.js https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/javascript/javascript.min.js https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/css/css.min.js https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/htmlmixed/htmlmixed.min.js' },
      'text/css': { name: 'css', script: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/css/css.min.js' },
      'application/xml': { name: 'xml', script: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/xml/xml.min.js' },
      'text/x-sql': { name: 'sql', script: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/sql/sql.min.js' },
      'text/x-yaml': { name: 'yaml', script: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/yaml/yaml.min.js' },
    };

    function loadScripts(urls, cb) {
      if (!urls) return cb && cb();
      const parts = urls.split(/\s+/).filter(Boolean);
      let loaded = 0;
      parts.forEach((u) => {
        if (document.querySelector(`script[src="${u}"]`)) {
          loaded++;
          if (loaded === parts.length && cb) cb();
          return;
        }
        const s = document.createElement('script');
        s.src = u;
        s.onload = () => {
          loaded++;
          if (loaded === parts.length && cb) cb();
        };
        s.onerror = () => {
          loaded++;
          if (loaded === parts.length && cb) cb();
        };
        document.head.appendChild(s);
      });
    }

    function detectModeFromContent(text) {
      const t = (text || '').trim();
      if (!t) return 'text/plain';
      if ((t[0] === '{' && t[t.length - 1] === '}') || (t[0] === '[' && t[t.length - 1] === ']')) return 'application/json';
      if (t.startsWith('<')) {
        if (/^<\?xml\s/i.test(t) || /^<\w+/i.test(t)) return 'application/xml';
      }
      if (t.split('\n').length > 1 && t.indexOf(',') !== -1) return 'text/csv';
      if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(t)) return 'text/x-sql';
      if (/^\s*def\s+\w+\s*\(|^\s*import\s+/m.test(t)) return 'python';
      if (/\b(function|const|let|var)\b/.test(t)) return 'javascript';
      if (/^---\n|^\w+:\s/m.test(t)) return 'text/x-yaml';
      return 'text/plain';
    }

    function applyModeToEditors(modeValue, leftEditor, rightEditor, mv) {
      const map = modeMap[modeValue] || { name: modeValue, script: null };
      return new Promise((resolve) => {
        loadScripts(map.script, () => {
          const modeName = map.name === 'null' ? null : map.name;
          const cmMode = modeName ? modeName : null;
          try {
            leftEditor && leftEditor.setOption && leftEditor.setOption('mode', cmMode || 'null');
          } catch (e) {}
          try {
            rightEditor && rightEditor.setOption && rightEditor.setOption('mode', cmMode || 'null');
          } catch (e) {}
          if (mv && mv.options) mv.options.mode = cmMode;
          try { leftEditor && leftEditor.refresh && leftEditor.refresh(); } catch (e) {}
          try { rightEditor && rightEditor.refresh && rightEditor.refresh(); } catch (e) {}
          resolve();
        });
      });
    }

    function scheduleAutoDetect(leftEditor, rightEditor, modeSelect, mv, delay = 400) {
      let detectTimer = null;
      return function () {
        clearTimeout(detectTimer);
        detectTimer = setTimeout(() => {
          const leftText = leftEditor && leftEditor.getValue ? leftEditor.getValue() : '';
          const rightText = rightEditor && rightEditor.getValue ? rightEditor.getValue() : '';
          const sample = (leftText || '').trim() || (rightText || '').trim();
          const detected = detectModeFromContent(sample);
          if (modeSelect && modeSelect.value === 'auto') {
            applyModeToEditors(detected, leftEditor, rightEditor, mv);
          }
        }, delay);
      };
    }

    return {
      modeMap,
      loadScripts,
      detectModeFromContent,
      applyModeToEditors,
      scheduleAutoDetect,
    };
  })();

  window.ModeUtils = ModeUtils;
})();
