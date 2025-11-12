// Large data worker: lightweight JSON/CSV parsing and sorting optimized for large payloads
// This worker implements minimal, fast operations and avoids the heavier flexible parser.

// CSV parsing (lightweight port from utils_csv.js)
function csvToJSON(csvText, options) {
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
      if (options.coerceTypes) {
        if (/^-?\d+$/.test(val)) obj[key] = parseInt(val, 10);
        else if (/^-?\d*\.\d+$/.test(val)) obj[key] = parseFloat(val);
        else if (/^(true|false)$/i.test(val)) obj[key] = /^true$/i.test(val);
        else if (val === "") obj[key] = null;
        else obj[key] = val;
      } else { obj[key] = val; }
    }
    data.push(obj);
  }

  return data;
}

// Sorting utilities (port from utils.js)
function sortJSONKeys(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return sortJSONArray(obj);
  const sortedObj = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sortedObj[key] = sortJSONKeys(obj[key]);
  }
  return sortedObj;
}

function sortJSONArray(arr) {
  if (!Array.isArray(arr)) return arr;
  if (
    arr.length > 0 &&
    arr.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))
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
    if (item && typeof item === "object") return sortJSONKeys(item);
    return item;
  });
}

// Lightweight parse: try strict JSON.parse first, fallback to minimal single-quote handling
function fastParseJSON(text) {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    // Minimal fallback: convert single-quoted keys/strings to double quotes (best-effort)
    let s = text.replace(/\r\n|\r/g, "\n");
    s = s.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");
    // Replace simple single-quoted strings: '...' -> "..."
    s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    return JSON.parse(s);
  }
}

// Worker message handling
self.addEventListener('message', function (e) {
  const { id, action, payload } = e.data || {};
  (async function () {
    try {
      let result = null;
      if (action === 'parseAndStringify') {
        const obj = fastParseJSON(payload.text);
        result = JSON.stringify(obj, null, 3);
      } else if (action === 'sortAndStringify') {
        let obj = null;
        if (payload.text !== undefined) obj = fastParseJSON(payload.text);
        else obj = payload.obj;
        if (Array.isArray(obj)) obj = sortJSONArray(obj);
        else obj = sortJSONKeys(obj);
        result = JSON.stringify(obj, null, 3);
      } else if (action === 'csvToJsonString') {
        const arr = csvToJSON(payload.text, { coerceTypes: true });
        result = JSON.stringify(arr, null, 3);
      } else {
        throw new Error('Unknown action: ' + action);
      }

      self.postMessage({ id: id, ok: true, result: result });
    } catch (err) {
      self.postMessage({ id: id, ok: false, error: err && err.message ? err.message : String(err) });
    }
  })();
});
