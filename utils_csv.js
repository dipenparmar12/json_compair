// Standalone utilities extracted from index.html
(function () {
  // CSV utilities
  const CSVUtils = {
    // Convert CSV text to JSON array of objects. Tries to be forgiving with separators and quotes.
    csvToJSON: function (csvText, options) {
      options = options || {};
      if (!csvText || !csvText.trim()) return [];

      // Normalize line endings and trim
      const text = csvText.replace(/\r\n|\r/g, "\n").trim();

      // Heuristic: detect separator (comma, tab, semicolon)
      const firstLine = text.split("\n")[0];
      let sep = ",";
      if (firstLine.indexOf("\t") > -1) sep = "\t";
      else if (firstLine.indexOf(";") > -1) sep = ";";

      // Basic CSV parser that handles quoted fields with escaped quotes
      const rows = [];
      let cur = "";
      let inQuotes = false;
      let row = [];

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = i + 1 < text.length ? text[i + 1] : null;

        if (ch === '"') {
          if (inQuotes && next === '"') {
            // Escaped quote
            cur += '"';
            i++; // skip next
            continue;
          }
          inQuotes = !inQuotes;
          continue;
        }

        if (!inQuotes && ch === sep) {
          row.push(cur);
          cur = "";
          continue;
        }

        if (!inQuotes && ch === "\n") {
          row.push(cur);
          rows.push(row);
          row = [];
          cur = "";
          continue;
        }

        cur += ch;
      }

      // Push leftover
      if (cur !== "" || inQuotes || row.length > 0) {
        row.push(cur);
        rows.push(row);
      }

      if (rows.length === 0) return [];

      // If first row looks like headers (no numeric-only), use them
      const headers = rows[0].map((h) => h.trim());

      // Build array of objects
      const data = [];
      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        // Skip completely empty lines
        if (cells.length === 1 && cells[0].trim() === "") continue;
        const obj = {};
        for (let c = 0; c < headers.length; c++) {
          const key = headers[c] || `col${c}`;
          const val = c < cells.length ? cells[c].trim() : "";
          // Try to coerce numbers and booleans if option set
          if (options.coerceTypes) {
            if (/^\d+$/.test(val)) obj[key] = parseInt(val, 10);
            else if (/^\d*\.\d+$/.test(val)) obj[key] = parseFloat(val);
            else if (/^(true|false)$/i.test(val))
              obj[key] = /^true$/i.test(val);
            else if (val === "") obj[key] = null;
            else obj[key] = val;
          } else {
            obj[key] = val;
          }
        }
        data.push(obj);
      }

      return data;
    },
  };

  window.CSVUtils = CSVUtils;
})();
