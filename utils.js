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
  // Enhanced flexible JSON parser that accepts Python dict literals and other Python data types
  // Supports: dicts, lists, tuples, sets, booleans, None, strings, numbers, datetime objects,
  // Decimal, complex numbers, bytes, and common Python object representations
  function parseFlexibleJSON(text) {
    if (!text || !text.trim()) return null;
    let s = text.trim();

    // Quick heuristic: if it already starts with valid JSON syntax, try native parse first
    if (/^[\{\[\"\d\-]/.test(s) || /^(true|false|null)$/i.test(s)) {
      try {
        return JSON.parse(s);
      } catch (e) {
        // Continue to flexible parsing
      }
    }

    // Step 1: Handle Python literals and constants first
    s = s
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null");

    // Step 2: Convert single quotes to double quotes (handle this early and carefully)
    s = convertSingleQuotesToDouble(s);

    // Step 3: Handle Python numeric types
    // Handle complex numbers: (1+2j) -> {"real": 1, "imag": 2}
    s = s.replace(
      /\(([+-]?\d*\.?\d*)\s*([+-])\s*(\d*\.?\d*)j\)/g,
      '{"real": $1, "imag": "$2$3"}'
    );
    s = s.replace(/([+-]?\d*\.?\d*)j/g, '{"real": 0, "imag": "$1"}');

    // Handle Decimal objects: Decimal('123.45') -> "123.45"
    s = s.replace(/Decimal\(\"([^\"]+)\"\)/g, '"$1"');

    // Step 4: Handle Python string representations
    // Handle bytes literals: b"data" -> "data" (simplified conversion)
    s = s.replace(/b\"([^\"]*)\"/g, '"$1"');

    // Handle raw strings: r"data" -> "data"
    s = s.replace(/r\"([^\"]*)\"/g, '"$1"');

    // Handle unicode strings: u"data" -> "data"
    s = s.replace(/u\"([^\"]*)\"/g, '"$1"');

    // Handle f-strings (simplified): f"Hello {name}" -> "Hello {name}"
    s = s.replace(/f\"([^\"]*)\"/g, '"$1"');

    // Step 5: Handle Python object representations
    // Convert Python object representations like <User #655715> to structured objects
    s = s.replace(/<([A-Za-z0-9_]+)\s*(#\d+)?>/g, '{"type": "$1", "id": "$2"}');

    // Step 6: Handle Python datetime objects
    s = s.replace(/datetime\.datetime\(([^)]+)\)/g, function (match, args) {
      const parts = args.split(",").map((part) => part.trim());
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      const hour = parts[3] || "0";
      const minute = parts[4] || "0";
      const second = parts[5] || "0";
      const microsecond = parts[6] || "0";

      return `"${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}.${microsecond.padStart(6, "0")}"`;
    });

    // Handle date objects
    s = s.replace(/datetime\.date\(([^)]+)\)/g, function (match, args) {
      const parts = args.split(",").map((part) => part.trim());
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `"${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}"`;
    });

    // Step 7: Handle Python collection types
    // Handle sets: {1, 2, 3} -> [1, 2, 3] (but preserve dicts)
    s = s.replace(/\{([^}]*)\}/g, function (match, content) {
      content = content.trim();
      if (!content) return "{}"; // Empty set becomes empty object

      // Check if it's a dictionary (contains colons not in quotes)
      if (containsColonOutsideQuotes(content)) {
        // It's a dictionary, keep as object
        return match;
      } else {
        // It's a set, convert to array
        const elements = content
          .split(",")
          .map((el) => el.trim())
          .filter((el) => el);
        return "[" + elements.join(", ") + "]";
      }
    });

    // Handle tuples: (1, 2, 3) -> [1, 2, 3]
    s = s.replace(/\(([^)]*)\)/g, function (match, content) {
      content = content.trim();
      if (!content) return "[]"; // Empty tuple

      // Check if it looks like a function call or complex number (already handled)
      if (/^[+-]?\d*\.?\d*[+-]\d*\.?\d*j$/.test(content)) return match;

      // Simple tuple detection: comma-separated values without colons
      if (content.includes(",") || !containsColonOutsideQuotes(content)) {
        const elements = content
          .split(",")
          .map((el) => el.trim())
          .filter((el) => el);
        return "[" + elements.join(", ") + "]";
      }

      return match;
    });

    // Step 8: Handle object key formatting
    // Add quotes around unquoted object keys
    s = s.replace(
      /([\{,]\s*)([A-Za-z0-9_\-]+)\s*:/g,
      function (match, prefix, key) {
        // Skip if already quoted
        if (/^[\"\']/.test(key)) return match;
        // Skip if it's a number
        if (/^\d+$/.test(key)) return match;
        return prefix + '"' + key + '":';
      }
    );

    // Step 9: Clean up formatting
    // Remove trailing commas before } or ]
    s = s.replace(/,\s*(?=[}\]])/g, "");

    // Handle multiple consecutive commas
    s = s.replace(/,\s*,+/g, ",");

    // Step 10: Final parsing attempts
    try {
      return JSON.parse(s);
    } catch (e) {
      throw new Error(
        `Unable to parse input as JSON or Python data structure. ` +
          `Processed: "${s.slice(0, 200)}${s.length > 200 ? "..." : ""}". ` +
          `Error: ${e.message}`
      );
    }
  }

  // Helper function to convert single quotes to double quotes properly
  function convertSingleQuotesToDouble(str) {
    let result = "";
    let i = 0;

    while (i < str.length) {
      if (str[i] === "'" && (i === 0 || str[i - 1] !== "\\")) {
        // Start of single-quoted string
        result += '"';
        i++; // skip opening quote

        // Process content until closing quote
        while (i < str.length) {
          if (str[i] === "'" && (i === 0 || str[i - 1] !== "\\")) {
            // End of string
            result += '"';
            i++;
            break;
          } else if (str[i] === '"' && (i === 0 || str[i - 1] !== "\\")) {
            // Escape unescaped double quotes
            result += '\\"';
            i++;
          } else {
            result += str[i];
            i++;
          }
        }
      } else {
        result += str[i];
        i++;
      }
    }

    return result;
  }

  // Helper function to check if content contains colon outside quotes
  function containsColonOutsideQuotes(content) {
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : "";

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar && prevChar !== "\\") {
        inQuotes = false;
      } else if (!inQuotes && char === ":") {
        return true;
      }
    }

    return false;
  }

  // Helper function to pretty-print the result
  function parseAndFormat(text) {
    try {
      const result = parseFlexibleJSON(text);
      return JSON.stringify(result, null, 2);
    } catch (e) {
      return `Error: ${e.message}`;
    }
  }

  // Export for use
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseFlexibleJSON, parseAndFormat };
  }

  // // Test with the provided data
  // const testData =
  //   "{'cooling': 'cooling-ac-conventional', 'heating': 'heating-furnace-natgas', 'version': 3, 'waterheater': 'wh-tank-natgas', 'cooling-setpoint': 80}";
  // console.log("Testing with provided data:");
  // console.log("Input:", testData);
  // try {
  //   const result = parseFlexibleJSON(testData);
  //   console.log("Success! Output:", JSON.stringify(result, null, 2));
  // } catch (e) {
  //   console.log("Error:", e.message);
  // }

  // Expose utilities on the global window for compatibility
  window.URLManager = URLManager;
  window.StorageManager = StorageManager;
  window.DefaultTemplates = DefaultTemplates;
  window.sortJSONKeys = sortJSONKeys;
  window.sortJSONArray = sortJSONArray;
  window.parseFlexibleJSON = parseFlexibleJSON;
})();
