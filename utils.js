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
        window.location.origin + window.location.pathname +
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

  // Flexible JSON parser that accepts Python dict literals as input.
  // It normalizes Python-style booleans/None, single quotes, unquoted keys, and trailing commas
  // into valid JSON, then parses with JSON.parse.
  function parseFlexibleJSON(text) {
    if (!text || !text.trim()) return null;
    let s = text.trim();

    // Quick heuristic: if it already starts with { or [ or " then try native parse first
    try {
      return JSON.parse(s);
    } catch (e) {
      // continue to try flexible parsing
    }

    // Replace Python booleans and None with JSON equivalents
    s = s.replace(/\bTrue\b/g, 'true')
         .replace(/\bFalse\b/g, 'false')
         .replace(/\bNone\b/g, 'null');

    // Convert single-quoted strings to double-quoted strings
    // This tries to avoid converting single quotes inside double quoted strings.
    s = s.replace(/'([^']*)'/g, function(m, p1) {
      // escape any existing double quotes inside
      const escaped = p1.replace(/\\\"/g, '\\\\"').replace(/"/g, '\\"');
      return '"' + escaped + '"';
    });

    // Add quotes around unquoted object keys: { key: -> { "key":
    // This is a best-effort and won't handle computed keys or nested colons in strings.
    s = s.replace(/([\{,\s])(\s*)([A-Za-z0-9_\-]+)\s*:/g, function(_, a, b, key) {
      // if key is already quoted, skip
      if (/^['\"]/.test(key)) return _;
      return a + b + '"' + key + '":';
    });

    // Remove trailing commas before } or ]
    s = s.replace(/,\s*(?=[}\]])/g, '');

    // Now attempt native parse
    try {
      return JSON.parse(s);
    } catch (e) {
      // As a last resort, try evaluating in a safe sandbox by using Function
      // Convert Python dict-literal-specific True/False/None already replaced.
      try {
        // Wrap in parentheses so object literal parses correctly
        const fn = new Function('return (' + s + ');');
        return fn();
      } catch (err) {
        // rethrow the original JSON error for upstream handling
        throw new Error('Unable to parse input as JSON or Python dict: ' + err.message);
      }
    }
  }

  // Expose utilities on the global window for compatibility
  window.URLManager = URLManager;
  window.StorageManager = StorageManager;
  window.DefaultTemplates = DefaultTemplates;
  window.sortJSONKeys = sortJSONKeys;
  window.sortJSONArray = sortJSONArray;
  window.parseFlexibleJSON = parseFlexibleJSON;

})();
