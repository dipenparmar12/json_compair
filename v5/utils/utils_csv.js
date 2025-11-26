// CSV utilities
(function () {
  const CSVUtils = {
    // Heuristic to detect CSV-like text
    isCSV: function (text) {
      if (!text || typeof text !== 'string') return false;
      const lines = text.trim().split(/\r\n|\r|\n/);
      if (lines.length === 0) return false;
      const first = lines[0];
      const sepMatch = first.match(/[,;\t]/);
      if (!sepMatch) return false;
      return lines.length > 1 || /[,;\t].+/.test(first);
    },

    // Convert CSV text to JSON array of objects. Tries to be forgiving with separators and quotes.
    csvToJSON: function (csvText, options) {
      options = options || {};
      if (!csvText || !csvText.trim()) return [];

      const text = csvText.replace(/\r\n|\r/g, "\n").trim();
      const firstLine = text.split("\n")[0] || "";
      let sep = ",";
      if (firstLine.indexOf("\t") > -1) sep = "\t";
      else if (firstLine.indexOf(";") > -1) sep = ";";

      const rows = [];
      let cur = "";
      let inQuotes = false;
      let row = [];

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = i + 1 < text.length ? text[i + 1] : null;

        if (ch === '"') {
          if (inQuotes && next === '"') { cur += '"'; i++; continue; }
          inQuotes = !inQuotes; continue;
        }

        if (!inQuotes && ch === sep) { row.push(cur); cur = ""; continue; }
        if (!inQuotes && ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; continue; }
        cur += ch;
      }

      if (cur !== "" || inQuotes || row.length > 0) { row.push(cur); rows.push(row); }
      if (rows.length === 0) return [];

      const headers = rows[0].map((h) => h.trim());
      const data = [];
      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        if (cells.length === 1 && cells[0].trim() === "") continue;
        const obj = {};
        for (let c = 0; c < headers.length; c++) {
          const key = headers[c] || `col${c}`;
          const raw = c < cells.length ? cells[c] : "";
          const val = (raw === undefined || raw === null) ? '' : String(raw).trim();
          
          // Try to parse value with type coercion and nested JSON restoration
          if (options.coerceTypes) {
            if (/^-?\d+$/.test(val)) {
              obj[key] = parseInt(val, 10);
            } else if (/^-?\d*\.\d+$/.test(val)) {
              obj[key] = parseFloat(val);
            } else if (/^(true|false)$/i.test(val)) {
              obj[key] = /^true$/i.test(val);
            } else if (val === "") {
              obj[key] = null;
            } else {
              // Try to parse as JSON (for nested objects/arrays)
              obj[key] = tryParseNestedJSON(val);
            }
          } else {
            // Still try to restore nested JSON even without coerceTypes
            obj[key] = tryParseNestedJSON(val);
          }
        }
        data.push(obj);
      }

      return data;
      
      // Helper to parse nested JSON strings back to objects/arrays
      function tryParseNestedJSON(val) {
        if (typeof val !== 'string') return val;
        const trimmed = val.trim();
        // Check if it looks like JSON object or array
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            return JSON.parse(trimmed);
          } catch (e) {
            // Not valid JSON, return as string
            return val;
          }
        }
        return val;
      }
    },

    // Convert JSON (array of objects or array of arrays) to CSV string
    jsonToCSV: function (input) {
      let data = input;
      if (typeof input === 'string') {
        try { data = JSON.parse(input); } catch (e) { throw new Error('Invalid JSON provided for JSON→CSV conversion'); }
      }
      if (!Array.isArray(data)) throw new Error('JSON→CSV expects an array (of objects or arrays)');
      if (data.length === 0) return '';

      if (Array.isArray(data[0]) && data.every(Array.isArray)) {
        return data.map(row => row.map(escape).join(',')).join('\n');
      }

      const keys = Array.from(data.reduce((acc, item) => { if (item && typeof item === 'object' && !Array.isArray(item)) { Object.keys(item).forEach(k => acc.add(k)); } return acc; }, new Set()));
      if (keys.length === 0) { return ['value'].concat(data.map(d => escapeValue(d))).join('\n'); }

      const header = keys.join(',');
      const rows = data.map(item => keys.map(k => { const v = (item && Object.prototype.hasOwnProperty.call(item, k)) ? item[k] : ''; return escapeValue(v); }).join(','));
      return [header].concat(rows).join('\n');

      function escapeValue(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return escape(JSON.stringify(v));
        return escape(String(v));
      }
      function escape(str) {
        if (str.indexOf('"') !== -1) str = str.replace(/"/g, '""');
        if (/[",\n]/.test(str)) return '"' + str + '"';
        return str;
      }
    }
  };
  // Check if JSON content is convertible to CSV (array of objects or arrays)
  CSVUtils.isConvertibleToCSV = function(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    // Quick check: must start with [ for array
    if (!trimmed.startsWith('[')) return false;
    
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed) || parsed.length === 0) return false;
      
      // Check first element - must be object or array
      const first = parsed[0];
      if (Array.isArray(first)) return true; // Array of arrays
      if (first && typeof first === 'object' && first !== null) return true; // Array of objects
      
      return false;
    } catch (e) {
      return false;
    }
  };

  // Download helper for exporting files
  CSVUtils.downloadFile = function(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  window.CSVUtils = CSVUtils;
  // Async adapter: use PapaParse for large inputs when available (returns a Promise)
  CSVUtils.csvToJSONAsync = function(csvText, options) {
    options = options || {};
    if (!csvText || !csvText.trim()) return Promise.resolve([]);

    // If Papa is available and input is large, use it with worker:true
    const size = csvText.length;
    const USE_PAPA_THRESHOLD = 100 * 1024; // 100KB
    if (window.Papa && size > USE_PAPA_THRESHOLD) {
      return new Promise((resolve, reject) => {
        try {
          Papa.parse(csvText, {
            header: true,
            worker: true,
            dynamicTyping: !!options.coerceTypes,
            skipEmptyLines: true,
            complete: function(results) { resolve(results.data || []); },
            error: function(err) { reject(err); }
          });
        } catch (e) { reject(e); }
      });
    }

    // Small payloads: run existing synchronous parser on next tick to avoid blocking UI
    return Promise.resolve().then(() => CSVUtils.csvToJSON(csvText, options));
  };
})();
