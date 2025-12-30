/**
 * JSON Toolbox - Core Utilities
 * Shared utility functions for type detection, deep cloning, path manipulation, and format inference.
 * @module utils_core
 * @version 1.0.0
 */
(function () {
  'use strict';

  /**
   * Format patterns for common string formats
   * @constant {Object}
   */
  const FORMAT_PATTERNS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    uri: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i,
    'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    time: /^\d{2}:\d{2}:\d{2}(\.\d+)?$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    ipv6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/i,
    hostname: /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/
  };

  /**
   * Check if value is null
   * @param {*} val - Value to check
   * @returns {boolean}
   */
  function isNull(val) {
    return val === null;
  }

  /**
   * Check if value is undefined
   * @param {*} val - Value to check
   * @returns {boolean}
   */
  function isUndefined(val) {
    return val === undefined;
  }

  /**
   * Check if value is a boolean
   * @param {*} val - Value to check
   * @returns {boolean}
   */
  function isBoolean(val) {
    return typeof val === 'boolean';
  }

  /**
   * Check if value is a number (excluding NaN)
   * @param {*} val - Value to check
   * @returns {boolean}
   */
  function isNumber(val) {
    return typeof val === 'number' && !isNaN(val);
  }

  /**
   * Check if value is an integer
   * @param {*} val - Value to check
   * @returns {boolean}
   */
  function isInteger(val) {
    return isNumber(val) && Number.isInteger(val);
  }

  /**
   * Check if value is a string
   * @param {*} val - Value to check
   * @returns {boolean}
   */
  function isString(val) {
    return typeof val === 'string';
  }

  /**
   * Check if value is an array
   * @param {*} val - Value to check
   * @returns {boolean}
   */
  function isArray(val) {
    return Array.isArray(val);
  }

  /**
   * Check if value is a plain object (not array, not null)
   * @param {*} val - Value to check
   * @returns {boolean}
   */
  function isObject(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  /**
   * Infer the JSON Schema type of a value
   * @param {*} value - Value to analyze
   * @returns {string} - One of: 'string', 'number', 'integer', 'boolean', 'null', 'array', 'object'
   */
  function inferType(value) {
    if (isNull(value)) return 'null';
    if (isBoolean(value)) return 'boolean';
    if (isInteger(value)) return 'integer';
    if (isNumber(value)) return 'number';
    if (isString(value)) return 'string';
    if (isArray(value)) return 'array';
    if (isObject(value)) return 'object';
    return 'unknown';
  }

  /**
   * Deep clone an object or array
   * @param {*} obj - Object to clone
   * @param {WeakMap} [seen] - Internal tracking for circular references
   * @returns {*} - Deep cloned value
   */
  function deepClone(obj, seen = new WeakMap()) {
    // Handle primitives and null
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Handle circular references
    if (seen.has(obj)) {
      return seen.get(obj);
    }

    // Handle Date
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    // Handle RegExp
    if (obj instanceof RegExp) {
      return new RegExp(obj.source, obj.flags);
    }

    // Handle Array
    if (Array.isArray(obj)) {
      const clonedArr = [];
      seen.set(obj, clonedArr);
      for (let i = 0; i < obj.length; i++) {
        clonedArr[i] = deepClone(obj[i], seen);
      }
      return clonedArr;
    }

    // Handle Object
    const clonedObj = {};
    seen.set(obj, clonedObj);
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = deepClone(obj[key], seen);
      }
    }
    return clonedObj;
  }

  /**
   * Parse a dot-notation path into an array of keys
   * Handles bracket notation for arrays: "users[0].name" -> ["users", "0", "name"]
   * @param {string} path - Dot notation path
   * @returns {string[]} - Array of path segments
   */
  function parsePath(path) {
    if (!path) return [];
    
    const result = [];
    let current = '';
    let inBracket = false;
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if (char === '[' && !inBracket) {
        if (current) {
          result.push(current);
          current = '';
        }
        inBracket = true;
      } else if (char === ']' && inBracket) {
        if (current) {
          result.push(current);
          current = '';
        }
        inBracket = false;
      } else if (char === '.' && !inBracket) {
        if (current) {
          result.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      result.push(current);
    }
    
    return result;
  }

  /**
   * Get a value from an object using dot notation path
   * @param {Object} obj - Source object
   * @param {string} path - Dot notation path (e.g., "user.address.city" or "users[0].name")
   * @param {*} [defaultValue] - Default value if path not found
   * @returns {*} - Value at path or defaultValue
   */
  function getValueAtPath(obj, path, defaultValue = undefined) {
    if (!obj || !path) return defaultValue;
    
    const keys = parsePath(path);
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current === undefined ? defaultValue : current;
  }

  /**
   * Set a value in an object using dot notation path
   * Creates intermediate objects/arrays as needed
   * @param {Object} obj - Target object
   * @param {string} path - Dot notation path
   * @param {*} value - Value to set
   * @returns {Object} - Modified object
   */
  function setValueAtPath(obj, path, value) {
    if (!obj || !path) return obj;
    
    const keys = parsePath(path);
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const nextKey = keys[i + 1];
      
      // Determine if next level should be array or object
      const shouldBeArray = /^\d+$/.test(nextKey);
      
      if (current[key] === undefined || current[key] === null) {
        current[key] = shouldBeArray ? [] : {};
      }
      
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    
    return obj;
  }

  /**
   * Delete a value from an object using dot notation path
   * @param {Object} obj - Target object
   * @param {string} path - Dot notation path
   * @returns {boolean} - True if value was deleted
   */
  function deleteValueAtPath(obj, path) {
    if (!obj || !path) return false;
    
    const keys = parsePath(path);
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined || current[key] === null) {
        return false;
      }
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (Array.isArray(current)) {
      current.splice(parseInt(lastKey, 10), 1);
    } else {
      delete current[lastKey];
    }
    
    return true;
  }

  /**
   * Detect the format of a string value
   * @param {string} str - String to analyze
   * @returns {string|null} - Detected format or null
   */
  function detectFormat(str) {
    if (!isString(str) || str.length === 0) return null;
    
    // Check each format pattern
    for (const [format, pattern] of Object.entries(FORMAT_PATTERNS)) {
      if (pattern.test(str)) {
        return format;
      }
    }
    
    return null;
  }

  /**
   * Get all leaf paths in an object
   * @param {Object} obj - Object to traverse
   * @param {string} [prefix=''] - Current path prefix
   * @param {string[]} [paths=[]] - Accumulated paths
   * @returns {string[]} - Array of all leaf paths
   */
  function getAllPaths(obj, prefix = '', paths = []) {
    if (isArray(obj)) {
      obj.forEach((item, index) => {
        const path = prefix ? `${prefix}[${index}]` : `[${index}]`;
        if (isObject(item) || isArray(item)) {
          getAllPaths(item, path, paths);
        } else {
          paths.push(path);
        }
      });
    } else if (isObject(obj)) {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const path = prefix ? `${prefix}.${key}` : key;
          const value = obj[key];
          if (isObject(value) || isArray(value)) {
            getAllPaths(value, path, paths);
          } else {
            paths.push(path);
          }
        }
      }
    } else {
      if (prefix) paths.push(prefix);
    }
    
    return paths;
  }

  /**
   * Get all paths with their values
   * @param {Object} obj - Object to traverse
   * @param {string} [prefix=''] - Current path prefix
   * @returns {Object[]} - Array of {path, value, type} objects
   */
  function getAllPathsWithValues(obj, prefix = '') {
    const results = [];
    
    if (isArray(obj)) {
      obj.forEach((item, index) => {
        const path = prefix ? `${prefix}[${index}]` : `[${index}]`;
        if (isObject(item) || isArray(item)) {
          results.push(...getAllPathsWithValues(item, path));
        } else {
          results.push({ path, value: item, type: inferType(item) });
        }
      });
    } else if (isObject(obj)) {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const path = prefix ? `${prefix}.${key}` : key;
          const value = obj[key];
          if (isObject(value) || isArray(value)) {
            results.push(...getAllPathsWithValues(value, path));
          } else {
            results.push({ path, value, type: inferType(value) });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object to merge
   * @param {Object} [options] - Merge options
   * @param {boolean} [options.arrayMerge='replace'] - How to handle arrays: 'replace', 'concat', 'union'
   * @returns {Object} - Merged object
   */
  function mergeDeep(target, source, options = {}) {
    const { arrayMerge = 'replace' } = options;
    
    if (!isObject(target) || !isObject(source)) {
      return source;
    }
    
    const result = deepClone(target);
    
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];
        
        if (isArray(sourceValue) && isArray(targetValue)) {
          switch (arrayMerge) {
            case 'concat':
              result[key] = targetValue.concat(sourceValue);
              break;
            case 'union':
              result[key] = [...new Set([...targetValue, ...sourceValue])];
              break;
            default: // 'replace'
              result[key] = deepClone(sourceValue);
          }
        } else if (isObject(sourceValue) && isObject(targetValue)) {
          result[key] = mergeDeep(targetValue, sourceValue, options);
        } else {
          result[key] = deepClone(sourceValue);
        }
      }
    }
    
    return result;
  }

  /**
   * Check if two values are deeply equal
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean}
   */
  function deepEqual(a, b) {
    if (a === b) return true;
    
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    if (isObject(a) && isObject(b)) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Get the maximum depth of an object/array structure
   * @param {*} obj - Object to analyze
   * @param {number} [currentDepth=0] - Current depth
   * @returns {number} - Maximum depth
   */
  function getMaxDepth(obj, currentDepth = 0) {
    if (!isObject(obj) && !isArray(obj)) {
      return currentDepth;
    }
    
    let maxDepth = currentDepth;
    
    if (isArray(obj)) {
      for (const item of obj) {
        const depth = getMaxDepth(item, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    } else if (isObject(obj)) {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const depth = getMaxDepth(obj[key], currentDepth + 1);
          maxDepth = Math.max(maxDepth, depth);
        }
      }
    }
    
    return maxDepth;
  }

  /**
   * Count total keys in an object (including nested)
   * @param {*} obj - Object to count
   * @returns {number} - Total key count
   */
  function countKeys(obj) {
    if (!isObject(obj) && !isArray(obj)) {
      return 0;
    }
    
    let count = 0;
    
    if (isArray(obj)) {
      count += obj.length;
      for (const item of obj) {
        count += countKeys(item);
      }
    } else if (isObject(obj)) {
      count += Object.keys(obj).length;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          count += countKeys(obj[key]);
        }
      }
    }
    
    return count;
  }

  /**
   * Escape a string for use in a regular expression
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate a unique ID
   * @returns {string} - UUID v4
   */
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Export to global namespace
  window.JSONToolsCore = {
    // Type checks
    isNull,
    isUndefined,
    isBoolean,
    isNumber,
    isInteger,
    isString,
    isArray,
    isObject,
    inferType,
    
    // Deep operations
    deepClone,
    deepEqual,
    mergeDeep,
    
    // Path operations
    parsePath,
    getValueAtPath,
    setValueAtPath,
    deleteValueAtPath,
    getAllPaths,
    getAllPathsWithValues,
    
    // Format detection
    detectFormat,
    FORMAT_PATTERNS,
    
    // Analysis
    getMaxDepth,
    countKeys,
    
    // Utilities
    escapeRegExp,
    generateId
  };

  console.log('JSONToolsCore loaded successfully');
})();
