/**
 * diff-worker.js - Web Worker for heavy diff calculations
 * 
 * Offloads diff_match_patch calculations to a separate thread to keep UI responsive.
 * Handles: full diff calculation, viewport diff, diff counting
 */

// diff_match_patch implementation (inlined to avoid module loading issues)
// Based on https://github.com/google/diff-match-patch
// Simplified version for browser Web Worker context

class diff_match_patch {
  constructor() {
    this.Diff_Timeout = 1.0;
    this.Diff_EditCost = 4;
    this.Match_Threshold = 0.5;
    this.Match_Distance = 1000;
  }

  // Diff constants
  static DIFF_DELETE = -1;
  static DIFF_INSERT = 1;
  static DIFF_EQUAL = 0;

  diff_main(text1, text2, opt_checklines = true) {
    if (text1 === text2) {
      if (text1) {
        return [[0, text1]];
      }
      return [];
    }

    // Check for common prefix
    let commonlength = this.diff_commonPrefix(text1, text2);
    let commonprefix = text1.substring(0, commonlength);
    text1 = text1.substring(commonlength);
    text2 = text2.substring(commonlength);

    // Check for common suffix
    commonlength = this.diff_commonSuffix(text1, text2);
    let commonsuffix = text1.substring(text1.length - commonlength);
    text1 = text1.substring(0, text1.length - commonlength);
    text2 = text2.substring(0, text2.length - commonlength);

    // Compute the diff
    let diffs = this.diff_compute_(text1, text2, opt_checklines);

    // Restore prefix and suffix
    if (commonprefix) {
      diffs.unshift([0, commonprefix]);
    }
    if (commonsuffix) {
      diffs.push([0, commonsuffix]);
    }

    this.diff_cleanupMerge(diffs);
    return diffs;
  }

  diff_compute_(text1, text2, checklines) {
    if (!text1) {
      return [[1, text2]];
    }
    if (!text2) {
      return [[-1, text1]];
    }

    let longtext = text1.length > text2.length ? text1 : text2;
    let shorttext = text1.length > text2.length ? text2 : text1;
    let i = longtext.indexOf(shorttext);
    if (i !== -1) {
      let diffs = [[1, longtext.substring(0, i)], [0, shorttext], [1, longtext.substring(i + shorttext.length)]];
      if (text1.length > text2.length) {
        diffs[0][0] = diffs[2][0] = -1;
      }
      return diffs;
    }

    if (shorttext.length === 1) {
      return [[-1, text1], [1, text2]];
    }

    // Use line-mode speedup for longer texts
    if (checklines && text1.length > 100 && text2.length > 100) {
      return this.diff_lineMode_(text1, text2);
    }

    return this.diff_bisect_(text1, text2);
  }

  diff_lineMode_(text1, text2) {
    // Convert to line-based representation
    const a = this.diff_linesToChars_(text1, text2);
    text1 = a.chars1;
    text2 = a.chars2;
    const linearray = a.lineArray;

    let diffs = this.diff_main(text1, text2, false);

    // Convert back to character-based
    this.diff_charsToLines_(diffs, linearray);
    this.diff_cleanupSemantic(diffs);
    
    // Add an empty diff to force break
    diffs.push([0, '']);
    let pointer = 0;
    let count_delete = 0;
    let count_insert = 0;
    let text_delete = '';
    let text_insert = '';

    while (pointer < diffs.length) {
      switch (diffs[pointer][0]) {
        case 1:
          count_insert++;
          text_insert += diffs[pointer][1];
          break;
        case -1:
          count_delete++;
          text_delete += diffs[pointer][1];
          break;
        case 0:
          if (count_delete >= 1 && count_insert >= 1) {
            diffs.splice(pointer - count_delete - count_insert,
                count_delete + count_insert);
            pointer = pointer - count_delete - count_insert;
            const subDiff = this.diff_main(text_delete, text_insert, false);
            for (let j = subDiff.length - 1; j >= 0; j--) {
              diffs.splice(pointer, 0, subDiff[j]);
            }
            pointer = pointer + subDiff.length;
          }
          count_insert = 0;
          count_delete = 0;
          text_delete = '';
          text_insert = '';
          break;
      }
      pointer++;
    }
    diffs.pop();
    return diffs;
  }

  diff_bisect_(text1, text2) {
    const text1_length = text1.length;
    const text2_length = text2.length;
    const max_d = Math.ceil((text1_length + text2_length) / 2);
    const v_offset = max_d;
    const v_length = 2 * max_d;
    const v1 = new Array(v_length);
    const v2 = new Array(v_length);
    for (let x = 0; x < v_length; x++) {
      v1[x] = -1;
      v2[x] = -1;
    }
    v1[v_offset + 1] = 0;
    v2[v_offset + 1] = 0;
    const delta = text1_length - text2_length;
    const front = (delta % 2 !== 0);
    let k1start = 0;
    let k1end = 0;
    let k2start = 0;
    let k2end = 0;

    for (let d = 0; d < max_d; d++) {
      // Walk the front path
      for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
        const k1_offset = v_offset + k1;
        let x1;
        if (k1 === -d || (k1 !== d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
          x1 = v1[k1_offset + 1];
        } else {
          x1 = v1[k1_offset - 1] + 1;
        }
        let y1 = x1 - k1;
        while (x1 < text1_length && y1 < text2_length &&
               text1.charAt(x1) === text2.charAt(y1)) {
          x1++;
          y1++;
        }
        v1[k1_offset] = x1;
        if (x1 > text1_length) {
          k1end += 2;
        } else if (y1 > text2_length) {
          k1start += 2;
        } else if (front) {
          const k2_offset = v_offset + delta - k1;
          if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] !== -1) {
            const x2 = text1_length - v2[k2_offset];
            if (x1 >= x2) {
              return this.diff_bisectSplit_(text1, text2, x1, y1);
            }
          }
        }
      }

      // Walk the reverse path
      for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
        const k2_offset = v_offset + k2;
        let x2;
        if (k2 === -d || (k2 !== d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
          x2 = v2[k2_offset + 1];
        } else {
          x2 = v2[k2_offset - 1] + 1;
        }
        let y2 = x2 - k2;
        while (x2 < text1_length && y2 < text2_length &&
               text1.charAt(text1_length - x2 - 1) === text2.charAt(text2_length - y2 - 1)) {
          x2++;
          y2++;
        }
        v2[k2_offset] = x2;
        if (x2 > text1_length) {
          k2end += 2;
        } else if (y2 > text2_length) {
          k2start += 2;
        } else if (!front) {
          const k1_offset = v_offset + delta - k2;
          if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] !== -1) {
            const x1 = v1[k1_offset];
            const y1 = v_offset + x1 - k1_offset;
            x2 = text1_length - x2;
            if (x1 >= x2) {
              return this.diff_bisectSplit_(text1, text2, x1, y1);
            }
          }
        }
      }
    }
    return [[-1, text1], [1, text2]];
  }

  diff_bisectSplit_(text1, text2, x, y) {
    const text1a = text1.substring(0, x);
    const text2a = text2.substring(0, y);
    const text1b = text1.substring(x);
    const text2b = text2.substring(y);

    const diffs = this.diff_main(text1a, text2a, false);
    const diffsb = this.diff_main(text1b, text2b, false);

    return diffs.concat(diffsb);
  }

  diff_linesToChars_(text1, text2) {
    const lineArray = [];
    const lineHash = {};
    lineArray[0] = '';

    const chars1 = this.diff_linesToCharsMunge_(text1, lineArray, lineHash);
    const chars2 = this.diff_linesToCharsMunge_(text2, lineArray, lineHash);
    return { chars1, chars2, lineArray };
  }

  diff_linesToCharsMunge_(text, lineArray, lineHash) {
    let chars = '';
    let lineStart = 0;
    let lineEnd = -1;
    let lineArrayLength = lineArray.length;
    while (lineEnd < text.length - 1) {
      lineEnd = text.indexOf('\n', lineStart);
      if (lineEnd === -1) {
        lineEnd = text.length - 1;
      }
      let line = text.substring(lineStart, lineEnd + 1);

      if (lineHash.hasOwnProperty ? lineHash.hasOwnProperty(line) :
          (lineHash[line] !== undefined)) {
        chars += String.fromCharCode(lineHash[line]);
      } else {
        if (lineArrayLength === 65535) {
          line = text.substring(lineStart);
          lineEnd = text.length;
        }
        chars += String.fromCharCode(lineArrayLength);
        lineHash[line] = lineArrayLength;
        lineArray[lineArrayLength++] = line;
      }
      lineStart = lineEnd + 1;
    }
    return chars;
  }

  diff_charsToLines_(diffs, lineArray) {
    for (let i = 0; i < diffs.length; i++) {
      const chars = diffs[i][1];
      const text = [];
      for (let j = 0; j < chars.length; j++) {
        text[j] = lineArray[chars.charCodeAt(j)];
      }
      diffs[i][1] = text.join('');
    }
  }

  diff_commonPrefix(text1, text2) {
    if (!text1 || !text2 || text1.charAt(0) !== text2.charAt(0)) {
      return 0;
    }
    let pointermin = 0;
    let pointermax = Math.min(text1.length, text2.length);
    let pointermid = pointermax;
    let pointerstart = 0;
    while (pointermin < pointermid) {
      if (text1.substring(pointerstart, pointermid) ===
          text2.substring(pointerstart, pointermid)) {
        pointermin = pointermid;
        pointerstart = pointermin;
      } else {
        pointermax = pointermid;
      }
      pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
    }
    return pointermid;
  }

  diff_commonSuffix(text1, text2) {
    if (!text1 || !text2 ||
        text1.charAt(text1.length - 1) !== text2.charAt(text2.length - 1)) {
      return 0;
    }
    let pointermin = 0;
    let pointermax = Math.min(text1.length, text2.length);
    let pointermid = pointermax;
    let pointerend = 0;
    while (pointermin < pointermid) {
      if (text1.substring(text1.length - pointermid, text1.length - pointerend) ===
          text2.substring(text2.length - pointermid, text2.length - pointerend)) {
        pointermin = pointermid;
        pointerend = pointermin;
      } else {
        pointermax = pointermid;
      }
      pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
    }
    return pointermid;
  }

  diff_cleanupSemantic(diffs) {
    let changes = false;
    const equalities = [];
    let equalitiesLength = 0;
    let lastEquality = null;
    let pointer = 0;
    let length_insertions1 = 0;
    let length_deletions1 = 0;
    let length_insertions2 = 0;
    let length_deletions2 = 0;

    while (pointer < diffs.length) {
      if (diffs[pointer][0] === 0) {
        equalities[equalitiesLength++] = pointer;
        length_insertions1 = length_insertions2;
        length_deletions1 = length_deletions2;
        length_insertions2 = 0;
        length_deletions2 = 0;
        lastEquality = diffs[pointer][1];
      } else {
        if (diffs[pointer][0] === 1) {
          length_insertions2 += diffs[pointer][1].length;
        } else {
          length_deletions2 += diffs[pointer][1].length;
        }
        if (lastEquality && (lastEquality.length <=
            Math.max(length_insertions1, length_deletions1)) &&
            (lastEquality.length <= Math.max(length_insertions2, length_deletions2))) {
          diffs.splice(equalities[equalitiesLength - 1], 0, [-1, lastEquality]);
          diffs[equalities[equalitiesLength - 1] + 1][0] = 1;
          equalitiesLength--;
          equalitiesLength--;
          pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1;
          length_insertions1 = 0;
          length_deletions1 = 0;
          length_insertions2 = 0;
          length_deletions2 = 0;
          lastEquality = null;
          changes = true;
        }
      }
      pointer++;
    }

    if (changes) {
      this.diff_cleanupMerge(diffs);
    }
  }

  diff_cleanupMerge(diffs) {
    diffs.push([0, '']);
    let pointer = 0;
    let count_delete = 0;
    let count_insert = 0;
    let text_delete = '';
    let text_insert = '';

    while (pointer < diffs.length) {
      switch (diffs[pointer][0]) {
        case 1:
          count_insert++;
          text_insert += diffs[pointer][1];
          pointer++;
          break;
        case -1:
          count_delete++;
          text_delete += diffs[pointer][1];
          pointer++;
          break;
        case 0:
          if (count_delete + count_insert > 1) {
            if (count_delete !== 0 && count_insert !== 0) {
              let commonlength = this.diff_commonPrefix(text_insert, text_delete);
              if (commonlength !== 0) {
                if ((pointer - count_delete - count_insert) > 0 &&
                    diffs[pointer - count_delete - count_insert - 1][0] === 0) {
                  diffs[pointer - count_delete - count_insert - 1][1] +=
                      text_insert.substring(0, commonlength);
                } else {
                  diffs.splice(0, 0, [0, text_insert.substring(0, commonlength)]);
                  pointer++;
                }
                text_insert = text_insert.substring(commonlength);
                text_delete = text_delete.substring(commonlength);
              }
              commonlength = this.diff_commonSuffix(text_insert, text_delete);
              if (commonlength !== 0) {
                diffs[pointer][1] = text_insert.substring(text_insert.length -
                    commonlength) + diffs[pointer][1];
                text_insert = text_insert.substring(0, text_insert.length -
                    commonlength);
                text_delete = text_delete.substring(0, text_delete.length -
                    commonlength);
              }
            }
            pointer -= count_delete + count_insert;
            diffs.splice(pointer, count_delete + count_insert);
            if (text_delete.length) {
              diffs.splice(pointer, 0, [-1, text_delete]);
              pointer++;
            }
            if (text_insert.length) {
              diffs.splice(pointer, 0, [1, text_insert]);
              pointer++;
            }
            pointer++;
          } else if (pointer !== 0 && diffs[pointer - 1][0] === 0) {
            diffs[pointer - 1][1] += diffs[pointer][1];
            diffs.splice(pointer, 1);
          } else {
            pointer++;
          }
          count_insert = 0;
          count_delete = 0;
          text_delete = '';
          text_insert = '';
          break;
      }
    }
    if (diffs[diffs.length - 1][1] === '') {
      diffs.pop();
    }

    let changes = false;
    pointer = 1;
    while (pointer < diffs.length - 1) {
      if (diffs[pointer - 1][0] === 0 && diffs[pointer + 1][0] === 0) {
        if (diffs[pointer][1].substring(diffs[pointer][1].length -
            diffs[pointer - 1][1].length) === diffs[pointer - 1][1]) {
          diffs[pointer][1] = diffs[pointer - 1][1] +
              diffs[pointer][1].substring(0, diffs[pointer][1].length -
                  diffs[pointer - 1][1].length);
          diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
          diffs.splice(pointer - 1, 1);
          changes = true;
        } else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) ===
            diffs[pointer + 1][1]) {
          diffs[pointer - 1][1] += diffs[pointer + 1][1];
          diffs[pointer][1] =
              diffs[pointer][1].substring(diffs[pointer + 1][1].length) +
              diffs[pointer + 1][1];
          diffs.splice(pointer + 1, 1);
          changes = true;
        }
      }
      pointer++;
    }
    if (changes) {
      this.diff_cleanupMerge(diffs);
    }
  }
}

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
