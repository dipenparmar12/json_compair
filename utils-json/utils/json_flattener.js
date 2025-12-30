/**
 * JSON Toolbox - JSON Flattener
 * Flattens and unflattens JSON objects using dot notation.
 * @module json_flattener
 * @version 1.0.0
 */
(function () {
  'use strict';

  const Core = window.JSONToolsCore;

  /**
   * Default options for flattening
   */
  const DEFAULT_OPTIONS = {
    delimiter: '.',
    arrayNotation: 'bracket', // 'bracket' for [0], 'dot' for .0
    maxDepth: Infinity,
    safe: true, // Prevent prototype pollution
    transformKey: null // Custom key transformer function
  };

  /**
   * Escape a key for use in flat notation
   * @param {string} key - Key to escape
   * @param {string} delimiter - Delimiter being used
   * @returns {string} - Escaped key
   */
  function escapeKey(key, delimiter) {
    // If key contains the delimiter, wrap in quotes or escape
    if (key.includes(delimiter) || key.includes('[') || key.includes(']')) {
      return `["${key}"]`;
    }
    return key;
  }

  /**
   * Check if a key represents an array index
   * @param {string} key - Key to check
   * @returns {boolean}
   */
  function isArrayIndex(key) {
    return /^\d+$/.test(key);
  }

  /**
   * Flatten a nested object into a flat object with dot notation keys
   * @param {*} obj - Object to flatten
   * @param {Object} [options] - Flattening options
   * @returns {Object} - Flattened object
   */
  function flatten(obj, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const result = {};
    
    function recurse(current, path, depth) {
      // Check max depth
      if (depth > opts.maxDepth) {
        result[path] = current;
        return;
      }
      
      // Handle null
      if (current === null) {
        result[path] = null;
        return;
      }
      
      // Handle arrays
      if (Array.isArray(current)) {
        if (current.length === 0) {
          result[path] = [];
          return;
        }
        
        current.forEach((item, index) => {
          let newPath;
          if (opts.arrayNotation === 'bracket') {
            newPath = path ? `${path}[${index}]` : `[${index}]`;
          } else {
            newPath = path ? `${path}${opts.delimiter}${index}` : `${index}`;
          }
          recurse(item, newPath, depth + 1);
        });
        return;
      }
      
      // Handle objects
      if (typeof current === 'object') {
        const keys = Object.keys(current);
        
        if (keys.length === 0) {
          result[path] = {};
          return;
        }
        
        for (const key of keys) {
          // Skip prototype pollution
          if (opts.safe && (key === '__proto__' || key === 'constructor' || key === 'prototype')) {
            continue;
          }
          
          const escapedKey = escapeKey(key, opts.delimiter);
          let newPath;
          
          if (escapedKey.startsWith('[')) {
            // Key is already escaped with brackets
            newPath = path ? `${path}${escapedKey}` : escapedKey;
          } else {
            newPath = path ? `${path}${opts.delimiter}${key}` : key;
          }
          
          // Apply custom key transformer if provided
          if (opts.transformKey) {
            newPath = opts.transformKey(newPath, key, current[key]);
          }
          
          recurse(current[key], newPath, depth + 1);
        }
        return;
      }
      
      // Primitive value
      result[path] = current;
    }
    
    recurse(obj, '', 0);
    return result;
  }

  /**
   * Parse a flat key into path segments
   * @param {string} key - Flat key to parse
   * @param {string} delimiter - Delimiter used
   * @returns {string[]} - Array of path segments
   */
  function parseKey(key, delimiter) {
    const segments = [];
    let current = '';
    let inBracket = false;
    let inQuote = false;
    
    for (let i = 0; i < key.length; i++) {
      const char = key[i];
      
      if (char === '"' && inBracket) {
        inQuote = !inQuote;
        continue;
      }
      
      if (inQuote) {
        current += char;
        continue;
      }
      
      if (char === '[') {
        if (current) {
          segments.push(current);
          current = '';
        }
        inBracket = true;
        continue;
      }
      
      if (char === ']') {
        if (current) {
          segments.push(current);
          current = '';
        }
        inBracket = false;
        continue;
      }
      
      if (char === delimiter && !inBracket) {
        if (current) {
          segments.push(current);
          current = '';
        }
        continue;
      }
      
      current += char;
    }
    
    if (current) {
      segments.push(current);
    }
    
    return segments;
  }

  /**
   * Unflatten a flat object back into a nested structure
   * @param {Object} obj - Flat object to unflatten
   * @param {Object} [options] - Unflattening options
   * @returns {*} - Nested object
   */
  function unflatten(obj, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }
    
    const result = {};
    
    for (const flatKey in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, flatKey)) {
        continue;
      }
      
      const value = obj[flatKey];
      const segments = parseKey(flatKey, opts.delimiter);
      
      if (segments.length === 0) {
        continue;
      }
      
      // Skip prototype pollution
      if (opts.safe) {
        const hasUnsafe = segments.some(seg => 
          seg === '__proto__' || seg === 'constructor' || seg === 'prototype'
        );
        if (hasUnsafe) continue;
      }
      
      // Build the nested structure
      let current = result;
      
      for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        const nextSegment = segments[i + 1];
        const nextIsArray = isArrayIndex(nextSegment);
        
        if (current[segment] === undefined) {
          current[segment] = nextIsArray ? [] : {};
        }
        
        current = current[segment];
      }
      
      const lastSegment = segments[segments.length - 1];
      current[lastSegment] = value;
    }
    
    // Convert number-keyed objects to arrays at the root if needed
    return convertToArraysIfNeeded(result);
  }

  /**
   * Convert objects with consecutive numeric keys to arrays
   * @param {*} obj - Object to convert
   * @returns {*} - Converted object
   */
  function convertToArraysIfNeeded(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(convertToArraysIfNeeded);
    }
    
    const keys = Object.keys(obj);
    
    // Check if all keys are consecutive integers starting from 0
    const allNumeric = keys.length > 0 && keys.every(k => /^\d+$/.test(k));
    
    if (allNumeric) {
      const indices = keys.map(k => parseInt(k, 10)).sort((a, b) => a - b);
      const isConsecutive = indices.every((val, i) => val === i);
      
      if (isConsecutive) {
        // Convert to array
        const arr = [];
        for (let i = 0; i < indices.length; i++) {
          arr[i] = convertToArraysIfNeeded(obj[String(i)]);
        }
        return arr;
      }
    }
    
    // Recursively convert children
    const result = {};
    for (const key of keys) {
      result[key] = convertToArraysIfNeeded(obj[key]);
    }
    return result;
  }

  /**
   * Check if flatten -> unflatten produces the same result
   * @param {*} obj - Object to test
   * @param {Object} [options] - Options
   * @returns {Object} - { success: boolean, original, restored, match }
   */
  function roundTrip(obj, options = {}) {
    const flattened = flatten(obj, options);
    const restored = unflatten(flattened, options);
    const match = Core.deepEqual(obj, restored);
    
    return {
      success: match,
      original: obj,
      flattened,
      restored,
      match
    };
  }

  /**
   * Get statistics about a flat object
   * @param {Object} flatObj - Flat object
   * @returns {Object} - Statistics
   */
  function getFlatStats(flatObj) {
    const keys = Object.keys(flatObj);
    let maxDepth = 0;
    let arrayCount = 0;
    let objectCount = 0;
    
    for (const key of keys) {
      const segments = parseKey(key, '.');
      maxDepth = Math.max(maxDepth, segments.length);
      
      // Count array indices
      for (const seg of segments) {
        if (isArrayIndex(seg)) {
          arrayCount++;
        } else {
          objectCount++;
        }
      }
    }
    
    return {
      totalKeys: keys.length,
      maxDepth,
      arraySegments: arrayCount,
      objectSegments: objectCount
    };
  }

  /**
   * Get all paths in a flat object
   * @param {Object} flatObj - Flat object
   * @returns {Object[]} - Array of { path, value, type }
   */
  function getPaths(flatObj) {
    const paths = [];
    
    for (const key in flatObj) {
      if (Object.prototype.hasOwnProperty.call(flatObj, key)) {
        paths.push({
          path: key,
          value: flatObj[key],
          type: Core.inferType(flatObj[key])
        });
      }
    }
    
    return paths;
  }

  /**
   * Compare two flat objects and find differences
   * @param {Object} flat1 - First flat object
   * @param {Object} flat2 - Second flat object
   * @returns {Object} - Comparison result
   */
  function compareFlatObjects(flat1, flat2) {
    const keys1 = new Set(Object.keys(flat1));
    const keys2 = new Set(Object.keys(flat2));
    
    const added = [];
    const removed = [];
    const changed = [];
    const unchanged = [];
    
    // Find removed and changed
    for (const key of keys1) {
      if (!keys2.has(key)) {
        removed.push({ path: key, value: flat1[key] });
      } else if (!Core.deepEqual(flat1[key], flat2[key])) {
        changed.push({ path: key, oldValue: flat1[key], newValue: flat2[key] });
      } else {
        unchanged.push({ path: key, value: flat1[key] });
      }
    }
    
    // Find added
    for (const key of keys2) {
      if (!keys1.has(key)) {
        added.push({ path: key, value: flat2[key] });
      }
    }
    
    return {
      added,
      removed,
      changed,
      unchanged,
      hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0
    };
  }

  /**
   * Pick specific paths from a flat object
   * @param {Object} flatObj - Flat object
   * @param {string[]} paths - Paths to pick
   * @returns {Object} - Object with only picked paths
   */
  function pickPaths(flatObj, paths) {
    const result = {};
    const pathSet = new Set(paths);
    
    for (const key in flatObj) {
      if (pathSet.has(key)) {
        result[key] = flatObj[key];
      }
    }
    
    return result;
  }

  /**
   * Omit specific paths from a flat object
   * @param {Object} flatObj - Flat object
   * @param {string[]} paths - Paths to omit
   * @returns {Object} - Object without omitted paths
   */
  function omitPaths(flatObj, paths) {
    const result = {};
    const pathSet = new Set(paths);
    
    for (const key in flatObj) {
      if (!pathSet.has(key)) {
        result[key] = flatObj[key];
      }
    }
    
    return result;
  }

  // Export to global namespace
  window.JSONFlattener = {
    flatten,
    unflatten,
    roundTrip,
    parseKey,
    getFlatStats,
    getPaths,
    compareFlatObjects,
    pickPaths,
    omitPaths,
    DEFAULT_OPTIONS
  };

  console.log('JSONFlattener loaded successfully');
})();
