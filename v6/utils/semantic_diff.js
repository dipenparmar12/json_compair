/**
 * Semantic JSON Diff Engine
 * 
 * Provides structure-aware comparison for JSON data, especially arrays of objects.
 * Unlike text-based diff (diff_match_patch), this engine understands:
 * - Object-level changes (added, removed, modified)
 * - Field-level changes within objects
 * - Intelligent object matching without requiring ID fields
 * 
 * Usage:
 *   const differ = new SemanticJSONDiff();
 *   const result = differ.diff(leftJSON, rightJSON);
 *   // result contains structured diff with line mappings
 */
(function() {
  'use strict';

  // Change types
  const ChangeType = {
    UNCHANGED: 'unchanged',
    ADDED: 'added',
    REMOVED: 'removed',
    MODIFIED: 'modified'
  };

  // Object match confidence thresholds
  const MATCH_THRESHOLD = 0.4;  // Minimum similarity to consider a match
  const EXACT_MATCH_THRESHOLD = 0.95;  // Consider objects identical

  /**
   * Calculate Levenshtein distance between two strings
   * Used for fuzzy string matching
   */
  function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    
    // Handle edge cases
    if (m === 0) return n;
    if (n === 0) return m;
    
    // Create distance matrix
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    return dp[m][n];
  }

  /**
   * Calculate similarity ratio between two strings (0-1)
   */
  function stringSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;
    
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Calculate similarity between two values (handles all types)
   */
  function valueSimilarity(val1, val2) {
    // Same reference or primitive equality
    if (val1 === val2) return 1;
    
    // Handle nulls
    if (val1 === null || val2 === null) {
      return val1 === val2 ? 1 : 0;
    }
    
    // Type mismatch
    if (typeof val1 !== typeof val2) return 0;
    
    // String comparison with fuzzy matching
    if (typeof val1 === 'string') {
      return stringSimilarity(val1, val2);
    }
    
    // Number comparison (exact match for numbers)
    if (typeof val1 === 'number') {
      return val1 === val2 ? 1 : 0;
    }
    
    // Boolean comparison
    if (typeof val1 === 'boolean') {
      return val1 === val2 ? 1 : 0;
    }
    
    // Array comparison
    if (Array.isArray(val1) && Array.isArray(val2)) {
      return arraysSimilarity(val1, val2);
    }
    
    // Object comparison
    if (typeof val1 === 'object' && typeof val2 === 'object') {
      return objectSimilarity(val1, val2);
    }
    
    return 0;
  }

  /**
   * Calculate similarity between two arrays
   */
  function arraysSimilarity(arr1, arr2) {
    if (arr1.length === 0 && arr2.length === 0) return 1;
    if (arr1.length === 0 || arr2.length === 0) return 0;
    
    // For simple arrays, use element-wise comparison
    const maxLen = Math.max(arr1.length, arr2.length);
    let matchScore = 0;
    
    // Simple approach: compare in order
    const minLen = Math.min(arr1.length, arr2.length);
    for (let i = 0; i < minLen; i++) {
      matchScore += valueSimilarity(arr1[i], arr2[i]);
    }
    
    return matchScore / maxLen;
  }

  /**
   * Calculate similarity between two objects
   * Returns a score from 0 (completely different) to 1 (identical)
   */
  function objectSimilarity(obj1, obj2) {
    if (!obj1 || !obj2) return 0;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    if (allKeys.size === 0) return 1;
    
    let matchScore = 0;
    let weightTotal = 0;
    
    for (const key of allKeys) {
      const hasKey1 = key in obj1;
      const hasKey2 = key in obj2;
      
      // Weight: identity-like keys get higher weight
      const weight = isIdentityKey(key) ? 2 : 1;
      weightTotal += weight;
      
      if (hasKey1 && hasKey2) {
        // Both have the key - compare values
        matchScore += weight * valueSimilarity(obj1[key], obj2[key]);
      }
      // If only one has the key, matchScore stays the same (penalty)
    }
    
    return weightTotal > 0 ? matchScore / weightTotal : 0;
  }

  /**
   * Check if a key name suggests an identity field
   */
  function isIdentityKey(key) {
    const identityPatterns = [
      /^id$/i,
      /^_id$/i,
      /^uuid$/i,
      /^guid$/i,
      /^key$/i,
      /^name$/i,
      /^email$/i,
      /^username$/i,
      /^slug$/i,
      /^code$/i,
      /_id$/i,
      /Id$/
    ];
    return identityPatterns.some(pattern => pattern.test(key));
  }

  /**
   * Find best matches between two arrays of objects using greedy algorithm
   * Returns array of { leftIndex, rightIndex, similarity } pairs
   */
  function findBestMatches(leftArr, rightArr) {
    const matches = [];
    const usedLeft = new Set();
    const usedRight = new Set();
    
    // Build similarity matrix
    const similarities = [];
    for (let i = 0; i < leftArr.length; i++) {
      for (let j = 0; j < rightArr.length; j++) {
        const sim = objectSimilarity(leftArr[i], rightArr[j]);
        if (sim >= MATCH_THRESHOLD) {
          similarities.push({ leftIndex: i, rightIndex: j, similarity: sim });
        }
      }
    }
    
    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    // Greedy matching
    for (const match of similarities) {
      if (!usedLeft.has(match.leftIndex) && !usedRight.has(match.rightIndex)) {
        matches.push(match);
        usedLeft.add(match.leftIndex);
        usedRight.add(match.rightIndex);
      }
    }
    
    return matches;
  }

  /**
   * Compute field-level differences between two objects
   * Returns object with changed fields and their values
   */
  function computeFieldDiff(leftObj, rightObj) {
    const changes = {
      added: {},      // Keys in right but not left
      removed: {},    // Keys in left but not right
      modified: {},   // Keys in both but with different values
      unchanged: {}   // Keys in both with same values
    };
    
    const leftKeys = new Set(Object.keys(leftObj || {}));
    const rightKeys = new Set(Object.keys(rightObj || {}));
    
    // Check all keys from left
    for (const key of leftKeys) {
      if (!rightKeys.has(key)) {
        changes.removed[key] = leftObj[key];
      } else {
        const leftVal = leftObj[key];
        const rightVal = rightObj[key];
        
        if (deepEqual(leftVal, rightVal)) {
          changes.unchanged[key] = leftVal;
        } else {
          changes.modified[key] = { left: leftVal, right: rightVal };
        }
      }
    }
    
    // Check keys only in right
    for (const key of rightKeys) {
      if (!leftKeys.has(key)) {
        changes.added[key] = rightObj[key];
      }
    }
    
    return changes;
  }

  /**
   * Deep equality check for JSON values
   */
  function deepEqual(val1, val2) {
    if (val1 === val2) return true;
    if (val1 === null || val2 === null) return val1 === val2;
    if (typeof val1 !== typeof val2) return false;
    
    if (Array.isArray(val1) && Array.isArray(val2)) {
      if (val1.length !== val2.length) return false;
      return val1.every((item, i) => deepEqual(item, val2[i]));
    }
    
    if (typeof val1 === 'object') {
      const keys1 = Object.keys(val1);
      const keys2 = Object.keys(val2);
      if (keys1.length !== keys2.length) return false;
      return keys1.every(key => deepEqual(val1[key], val2[key]));
    }
    
    return false;
  }

  /**
   * Map JSON structure to line numbers in formatted JSON string
   * Returns mapping of paths to line ranges
   */
  function buildLineMap(jsonString) {
    const lines = jsonString.split('\n');
    const lineMap = {
      byPath: {},      // path -> { startLine, endLine }
      byLine: {},      // lineNumber -> { path, type, key, depth }
      arrayItems: []   // For arrays of objects: { index, startLine, endLine }
    };
    
    let depth = 0;
    let bracketStack = []; // Track { and [ with their line numbers
    let currentArrayItemStart = -1;
    let arrayItemIndex = -1;
    let inTopLevelArray = false;
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const trimmed = line.trim();
      
      // Track line info
      const lineInfo = { depth, lineNum };
      
      // Detect top-level array start
      if (lineNum === 0 && trimmed === '[') {
        inTopLevelArray = true;
        bracketStack.push({ type: '[', line: lineNum });
        depth++;
      }
      // Detect object start
      else if (trimmed === '{' || trimmed.startsWith('{')) {
        if (inTopLevelArray && bracketStack.length === 1) {
          // This is a top-level array item object
          arrayItemIndex++;
          currentArrayItemStart = lineNum;
        }
        bracketStack.push({ type: '{', line: lineNum, arrayIndex: arrayItemIndex });
        depth++;
      }
      // Detect object end
      else if (trimmed === '}' || trimmed === '},' || trimmed.endsWith('}') || trimmed.endsWith('},')) {
        const bracket = bracketStack.pop();
        depth--;
        if (bracket && bracket.type === '{' && inTopLevelArray && bracketStack.length === 1) {
          // Closing a top-level array item object
          lineMap.arrayItems.push({
            index: bracket.arrayIndex,
            startLine: currentArrayItemStart,
            endLine: lineNum
          });
        }
      }
      // Detect array end
      else if (trimmed === ']' || trimmed === '],') {
        bracketStack.pop();
        depth--;
        if (depth === 0) {
          inTopLevelArray = false;
        }
      }
      
      // Detect key-value pairs
      const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
      if (keyMatch) {
        lineInfo.key = keyMatch[1];
        lineInfo.type = 'key-value';
      }
      
      lineMap.byLine[lineNum] = lineInfo;
    }
    
    return lineMap;
  }

  /**
   * Main SemanticJSONDiff class
   */
  class SemanticJSONDiff {
    constructor(options = {}) {
      this.options = {
        matchThreshold: options.matchThreshold || MATCH_THRESHOLD,
        exactMatchThreshold: options.exactMatchThreshold || EXACT_MATCH_THRESHOLD,
        indentSize: options.indentSize || 3,
        ...options
      };
    }

    /**
     * Detect if JSON is an array of objects
     */
    isArrayOfObjects(data) {
      if (!Array.isArray(data)) return false;
      if (data.length === 0) return false;
      return data.every(item => item !== null && typeof item === 'object' && !Array.isArray(item));
    }

    /**
     * Main diff function
     * @param {string|object} left - Left JSON (string or parsed object)
     * @param {string|object} right - Right JSON (string or parsed object)
     * @returns {object} Diff result with structured changes and line mappings
     */
    diff(left, right) {
      // Parse if strings
      let leftData, rightData;
      let leftString, rightString;
      
      try {
        if (typeof left === 'string') {
          leftData = JSON.parse(left);
          leftString = JSON.stringify(leftData, null, this.options.indentSize);
        } else {
          leftData = left;
          leftString = JSON.stringify(left, null, this.options.indentSize);
        }
        
        if (typeof right === 'string') {
          rightData = JSON.parse(right);
          rightString = JSON.stringify(rightData, null, this.options.indentSize);
        } else {
          rightData = right;
          rightString = JSON.stringify(right, null, this.options.indentSize);
        }
      } catch (e) {
        // Not valid JSON - return null to indicate fallback needed
        return null;
      }

      // Build line maps
      const leftLineMap = buildLineMap(leftString);
      const rightLineMap = buildLineMap(rightString);

      // Check if both are arrays of objects
      const leftIsArrayOfObjects = this.isArrayOfObjects(leftData);
      const rightIsArrayOfObjects = this.isArrayOfObjects(rightData);

      if (leftIsArrayOfObjects && rightIsArrayOfObjects) {
        return this.diffArraysOfObjects(leftData, rightData, leftLineMap, rightLineMap, leftString, rightString);
      }

      // For other structures, do a simple object diff
      if (typeof leftData === 'object' && typeof rightData === 'object' && 
          !Array.isArray(leftData) && !Array.isArray(rightData)) {
        return this.diffObjects(leftData, rightData, leftLineMap, rightLineMap, leftString, rightString);
      }

      // Fallback: return null to use text-based diff
      return null;
    }

    /**
     * Diff two arrays of objects
     */
    diffArraysOfObjects(leftArr, rightArr, leftLineMap, rightLineMap, leftString, rightString) {
      const result = {
        type: 'array-of-objects',
        leftString,
        rightString,
        changes: [],
        summary: {
          added: 0,
          removed: 0,
          modified: 0,
          unchanged: 0
        },
        leftLineChanges: {},   // lineNumber -> change type
        rightLineChanges: {}   // lineNumber -> change type
      };

      // Find best matches between arrays
      const matches = findBestMatches(leftArr, rightArr);
      const matchedLeft = new Set(matches.map(m => m.leftIndex));
      const matchedRight = new Set(matches.map(m => m.rightIndex));

      // Process matched pairs (modified or unchanged)
      for (const match of matches) {
        const leftObj = leftArr[match.leftIndex];
        const rightObj = rightArr[match.rightIndex];
        const fieldDiff = computeFieldDiff(leftObj, rightObj);
        
        const hasChanges = Object.keys(fieldDiff.added).length > 0 ||
                          Object.keys(fieldDiff.removed).length > 0 ||
                          Object.keys(fieldDiff.modified).length > 0;

        const changeType = hasChanges ? ChangeType.MODIFIED : ChangeType.UNCHANGED;
        
        if (hasChanges) {
          result.summary.modified++;
        } else {
          result.summary.unchanged++;
        }

        // Get line ranges for this object
        const leftLines = leftLineMap.arrayItems[match.leftIndex];
        const rightLines = rightLineMap.arrayItems[match.rightIndex];

        result.changes.push({
          type: changeType,
          leftIndex: match.leftIndex,
          rightIndex: match.rightIndex,
          similarity: match.similarity,
          fieldDiff: hasChanges ? fieldDiff : null,
          leftLines: leftLines ? { start: leftLines.startLine, end: leftLines.endLine } : null,
          rightLines: rightLines ? { start: rightLines.startLine, end: rightLines.endLine } : null
        });

        // Mark line changes
        if (leftLines && hasChanges) {
          for (let line = leftLines.startLine; line <= leftLines.endLine; line++) {
            result.leftLineChanges[line] = { type: ChangeType.MODIFIED, fieldDiff };
          }
        }
        if (rightLines && hasChanges) {
          for (let line = rightLines.startLine; line <= rightLines.endLine; line++) {
            result.rightLineChanges[line] = { type: ChangeType.MODIFIED, fieldDiff };
          }
        }
      }

      // Process unmatched left items (removed)
      for (let i = 0; i < leftArr.length; i++) {
        if (!matchedLeft.has(i)) {
          result.summary.removed++;
          const leftLines = leftLineMap.arrayItems[i];
          
          result.changes.push({
            type: ChangeType.REMOVED,
            leftIndex: i,
            rightIndex: null,
            leftLines: leftLines ? { start: leftLines.startLine, end: leftLines.endLine } : null,
            rightLines: null
          });

          if (leftLines) {
            for (let line = leftLines.startLine; line <= leftLines.endLine; line++) {
              result.leftLineChanges[line] = { type: ChangeType.REMOVED };
            }
          }
        }
      }

      // Process unmatched right items (added)
      for (let i = 0; i < rightArr.length; i++) {
        if (!matchedRight.has(i)) {
          result.summary.added++;
          const rightLines = rightLineMap.arrayItems[i];
          
          result.changes.push({
            type: ChangeType.ADDED,
            leftIndex: null,
            rightIndex: i,
            leftLines: null,
            rightLines: rightLines ? { start: rightLines.startLine, end: rightLines.endLine } : null
          });

          if (rightLines) {
            for (let line = rightLines.startLine; line <= rightLines.endLine; line++) {
              result.rightLineChanges[line] = { type: ChangeType.ADDED };
            }
          }
        }
      }

      // Sort changes by their position in arrays
      result.changes.sort((a, b) => {
        const aPos = a.rightIndex ?? a.leftIndex ?? 0;
        const bPos = b.rightIndex ?? b.leftIndex ?? 0;
        return aPos - bPos;
      });

      return result;
    }

    /**
     * Diff two plain objects
     */
    diffObjects(leftObj, rightObj, leftLineMap, rightLineMap, leftString, rightString) {
      const fieldDiff = computeFieldDiff(leftObj, rightObj);
      
      const result = {
        type: 'object',
        leftString,
        rightString,
        fieldDiff,
        summary: {
          added: Object.keys(fieldDiff.added).length,
          removed: Object.keys(fieldDiff.removed).length,
          modified: Object.keys(fieldDiff.modified).length,
          unchanged: Object.keys(fieldDiff.unchanged).length
        },
        leftLineChanges: {},
        rightLineChanges: {}
      };

      // Map field changes to lines
      const leftLines = leftString.split('\n');
      const rightLines = rightString.split('\n');

      // Mark removed fields in left
      for (const key of Object.keys(fieldDiff.removed)) {
        const lineIdx = leftLines.findIndex(line => line.includes(`"${key}":`));
        if (lineIdx !== -1) {
          result.leftLineChanges[lineIdx] = { type: ChangeType.REMOVED, key };
        }
      }

      // Mark added fields in right
      for (const key of Object.keys(fieldDiff.added)) {
        const lineIdx = rightLines.findIndex(line => line.includes(`"${key}":`));
        if (lineIdx !== -1) {
          result.rightLineChanges[lineIdx] = { type: ChangeType.ADDED, key };
        }
      }

      // Mark modified fields
      for (const key of Object.keys(fieldDiff.modified)) {
        const leftLineIdx = leftLines.findIndex(line => line.includes(`"${key}":`));
        const rightLineIdx = rightLines.findIndex(line => line.includes(`"${key}":`));
        
        if (leftLineIdx !== -1) {
          result.leftLineChanges[leftLineIdx] = { type: ChangeType.MODIFIED, key };
        }
        if (rightLineIdx !== -1) {
          result.rightLineChanges[rightLineIdx] = { type: ChangeType.MODIFIED, key };
        }
      }

      return result;
    }

    /**
     * Generate summary message
     */
    getSummaryMessage(diffResult) {
      if (!diffResult) return 'Unable to compute semantic diff';
      
      const { summary } = diffResult;
      const parts = [];
      
      if (summary.added > 0) parts.push(`${summary.added} added`);
      if (summary.removed > 0) parts.push(`${summary.removed} removed`);
      if (summary.modified > 0) parts.push(`${summary.modified} modified`);
      
      if (parts.length === 0) {
        return 'No differences found';
      }
      
      return `Found: ${parts.join(', ')}`;
    }
  }

  // Export to global scope
  window.SemanticJSONDiff = SemanticJSONDiff;
  window.SemanticDiffChangeType = ChangeType;

})();
