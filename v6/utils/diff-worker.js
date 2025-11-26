/**
 * diff-worker.js - Web Worker for heavy diff calculations
 * 
 * Offloads diff_match_patch calculations to a separate thread to keep UI responsive.
 * Handles: full diff calculation, viewport diff, diff counting
 */

// Import diff_match_patch in worker context
importScripts('https://cdnjs.cloudflare.com/ajax/libs/diff-match-patch/1.0.5/index.min.js');

/**
 * Calculate diff between two strings
 */
function calculateDiff(leftText, rightText, options = {}) {
  const dmp = new diff_match_patch();
  
  // Apply timeout if specified
  if (options.timeout) {
    dmp.Diff_Timeout = options.timeout / 1000; // Convert ms to seconds
  }
  
  const startTime = performance.now();
  const diffs = dmp.diff_main(leftText, rightText);
  dmp.diff_cleanupSemantic(diffs);
  const endTime = performance.now();
  
  return {
    diffs,
    duration: endTime - startTime
  };
}

/**
 * Count diff chunks (contiguous blocks of changes)
 */
function countDiffChunks(diffs) {
  let diffCount = 0;
  let inDiffChunk = false;
  
  for (const [op, text] of diffs) {
    if (op !== 0) { // DIFF_INSERT (-1) or DIFF_DELETE (1)
      if (!inDiffChunk) {
        diffCount++;
        inDiffChunk = true;
      }
    } else { // DIFF_EQUAL (0)
      inDiffChunk = false;
    }
  }
  
  return diffCount;
}

/**
 * Calculate viewport-specific diff
 */
function calculateViewportDiff(leftText, rightText, leftRange, rightRange, options = {}) {
  // Extract viewport slices
  const leftSlice = leftText.slice(leftRange.from, leftRange.to);
  const rightSlice = rightText.slice(rightRange.from, rightRange.to);
  
  const result = calculateDiff(leftSlice, rightSlice, options);
  const diffCount = countDiffChunks(result.diffs);
  
  return {
    diffs: result.diffs,
    diffCount,
    duration: result.duration,
    isViewport: true,
    leftRange,
    rightRange
  };
}

/**
 * Lightweight parse for JSON (best-effort)
 */
function fastParseJSON(text) {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    // Minimal fallback: convert Python-style to JSON
    let s = text.replace(/\r\n|\r/g, "\n");
    s = s.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");
    s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    return JSON.parse(s);
  }
}

/**
 * Sort JSON keys recursively
 */
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

/**
 * CSV to JSON conversion (lightweight)
 */
function csvToJSON(csvText, options = {}) {
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

// Worker message handling
self.addEventListener('message', function (e) {
  const { id, action, payload } = e.data || {};
  
  (async function () {
    const startTime = performance.now();
    
    try {
      let result = null;
      
      switch (action) {
        case 'calculateDiff': {
          // Full diff calculation
          const { leftText, rightText, options } = payload;
          const diffResult = calculateDiff(leftText, rightText, options || {});
          const diffCount = countDiffChunks(diffResult.diffs);
          result = {
            diffs: diffResult.diffs,
            diffCount,
            duration: diffResult.duration
          };
          break;
        }
        
        case 'countDiffs': {
          // Just count diffs without returning full diff data
          const { leftText, rightText, options } = payload;
          const diffResult = calculateDiff(leftText, rightText, options || {});
          const diffCount = countDiffChunks(diffResult.diffs);
          result = {
            diffCount,
            duration: diffResult.duration
          };
          break;
        }
        
        case 'viewportDiff': {
          // Viewport-specific diff
          const { leftText, rightText, leftRange, rightRange, options } = payload;
          result = calculateViewportDiff(leftText, rightText, leftRange, rightRange, options || {});
          break;
        }
        
        case 'parseAndStringify': {
          const obj = fastParseJSON(payload.text);
          result = JSON.stringify(obj, null, 3);
          break;
        }
        
        case 'sortAndStringify': {
          let obj = null;
          if (payload.text !== undefined) obj = fastParseJSON(payload.text);
          else obj = payload.obj;
          if (Array.isArray(obj)) obj = sortJSONArray(obj);
          else obj = sortJSONKeys(obj);
          result = JSON.stringify(obj, null, 3);
          break;
        }
        
        case 'csvToJsonString': {
          const arr = csvToJSON(payload.text, { coerceTypes: true });
          result = JSON.stringify(arr, null, 3);
          break;
        }
        
        default:
          throw new Error('Unknown action: ' + action);
      }
      
      const endTime = performance.now();
      self.postMessage({ 
        id, 
        ok: true, 
        result,
        totalDuration: endTime - startTime
      });
      
    } catch (err) {
      self.postMessage({ 
        id, 
        ok: false, 
        error: err && err.message ? err.message : String(err) 
      });
    }
  })();
});

// Notify that worker is ready
self.postMessage({ type: 'ready' });
