// Standalone utilities extracted from index.html
(function () {
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
    // More precise regex to avoid matching 'j' in words like 'json'
    s = s.replace(
      /\(([+-]?\d+\.?\d*)\s*([+-])\s*(\d+\.?\d*)j\)/g,
      '{"real": $1, "imag": "$2$3"}'
    );
    // Handle standalone complex numbers like 5j, but only when preceded by digit and followed by word boundary
    s = s.replace(/\b([+-]?\d+\.?\d*)j\b/g, '{"real": 0, "imag": "$1"}');

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
    // Enhanced to handle function calls better
    s = s.replace(/\(([^)]*)\)/g, function (match, content) {
      content = content.trim();
      if (!content) return "[]"; // Empty tuple

      // Skip if it's part of datetime.datetime() - already processed
      if (match.includes("datetime")) return match;

      // Check if it looks like a function call or complex number (already handled)
      if (/^[+-]?\d*\.?\d*[+-]\d*\.?\d*j$/.test(content)) return match;

      // Skip if it appears to be a function call (contains non-numeric, non-comma content before parentheses)
      const beforeParen = s.substring(0, s.indexOf(match));
      if (beforeParen.match(/[a-zA-Z_]\w*\s*$/)) return match;

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
    // Add quotes around unquoted object keys (enhanced to handle more key types)
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
    // Clean up extra whitespace
    s = s.replace(/\s+/g, " ");

    // Step 10: Final parsing attempts
    try {
      return JSON.parse(s);
    } catch (e) {
      // Try one more time with additional cleanup for edge cases
      try {
        // Handle cases where there might be unmatched quotes or brackets
        let cleaned = s;

        // Ensure proper bracket matching for nested objects
        cleaned = fixBracketMatching(cleaned);

        return JSON.parse(cleaned);
      } catch (e2) {
        throw new Error(
          `Unable to parse input as JSON or Python data structure. ` +
            `Processed: "${s.slice(0, 200)}${s.length > 200 ? "..." : ""}". ` +
            `Error: ${e.message}`
        );
      }
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

  // Helper function to fix bracket matching issues
  function fixBracketMatching(str) {
    const brackets = { "{": "}", "[": "]", "(": ")" };
    const stack = [];
    let result = str;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (brackets[char]) {
        stack.push({ char: brackets[char], pos: i });
      } else if (Object.values(brackets).includes(char)) {
        if (stack.length > 0 && stack[stack.length - 1].char === char) {
          stack.pop();
        }
      }
    }

    return result;
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

  // Test function to demonstrate parsing the provided example
  function testParser() {
    const testInput = `{'answers_id': 645, 'home_id': 655715, 'user_id': 33, 'token_id': 2837, 'answers_json': {'cooling': 'cooling-ac-conventional', 'heating': 'heating-furnace-natgas', 'version': 3, 'waterheater': 'wh-tank-natgas', 'cooling-setpoint': 80}, 'answers_blue_badge': {}, 'misc': None, 'created_on': datetime.datetime(2025, 8, 21, 10, 37, 4, 895369), 'updated_on': datetime.datetime(2025, 8, 21, 18, 0, 37, 982180)}`;

    console.log("Input:");
    console.log(testInput);
    console.log("\nParsed output:");
    console.log(parseAndFormat(testInput));
  }

  // Export functions for use
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      parseFlexibleJSON,
      parseAndFormat,
      testParser,
    };
  }

  window.parseFlexibleJSON = parseFlexibleJSON;
})();
