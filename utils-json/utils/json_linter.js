/**
 * JSON Toolbox - JSON Linter
 * Validates, repairs, and formats JSON data.
 * @module json_linter
 * @version 1.0.0
 */
(function () {
  'use strict';

  /**
   * Error severity levels
   */
  const SEVERITY = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  };

  /**
   * Default options for linting
   */
  const DEFAULT_OPTIONS = {
    allowComments: false,
    allowTrailingCommas: false,
    allowSingleQuotes: false,
    allowUnquotedKeys: false,
    strictMode: false,
    autoRepair: false
  };

  /**
   * Parse JSON and return detailed error information
   * @param {string} text - JSON text to parse
   * @returns {Object} - { valid: boolean, data: any, error: Object }
   */
  function parseWithDetails(text) {
    try {
      const data = JSON.parse(text);
      return { valid: true, data, error: null };
    } catch (e) {
      return {
        valid: false,
        data: null,
        error: parseJsonError(e, text)
      };
    }
  }

  /**
   * Parse a JSON error and extract position information
   * @param {Error} error - The JSON parse error
   * @param {string} text - Original text
   * @returns {Object} - Detailed error info
   */
  function parseJsonError(error, text) {
    const message = error.message;
    let line = 1;
    let column = 1;
    let position = 0;

    // Try to extract position from error message
    // Different browsers have different formats
    const posMatch = message.match(/position\s*(\d+)/i) ||
                     message.match(/at\s*(\d+)/i);
    
    if (posMatch) {
      position = parseInt(posMatch[1], 10);
      // Convert position to line/column
      const lines = text.substring(0, position).split('\n');
      line = lines.length;
      column = lines[lines.length - 1].length + 1;
    }

    // Try to extract line from error message
    const lineMatch = message.match(/line\s*(\d+)/i);
    if (lineMatch) {
      line = parseInt(lineMatch[1], 10);
    }

    // Try to extract column from error message
    const colMatch = message.match(/column\s*(\d+)/i);
    if (colMatch) {
      column = parseInt(colMatch[1], 10);
    }

    return {
      message: message,
      line,
      column,
      position,
      severity: SEVERITY.ERROR
    };
  }

  /**
   * Find all issues in JSON text
   * @param {string} text - JSON text to analyze
   * @param {Object} options - Linting options
   * @returns {Object[]} - Array of issues
   */
  function findIssues(text, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const issues = [];
    const lines = text.split('\n');

    // First, try to parse and get the main error
    const parseResult = parseWithDetails(text);
    if (!parseResult.valid) {
      issues.push(parseResult.error);
    }

    // Scan for additional issues
    let inString = false;
    let inComment = false;
    let stringChar = '';
    let braceStack = [];
    let bracketStack = [];
    let lastNonWhitespaceChar = '';
    let lastNonWhitespacePos = { line: 0, col: 0 };

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      for (let col = 0; col < line.length; col++) {
        const char = line[col];
        const prevChar = col > 0 ? line[col - 1] : '';
        const nextChar = col < line.length - 1 ? line[col + 1] : '';

        // Skip if in comment (for comment detection)
        if (inComment) {
          if (char === '*' && nextChar === '/') {
            inComment = false;
            col++; // Skip the /
          }
          continue;
        }

        // String handling
        if (inString) {
          if (char === stringChar && prevChar !== '\\') {
            inString = false;
          }
          continue;
        }

        // Check for comments (not valid JSON)
        if (char === '/' && nextChar === '/') {
          if (!opts.allowComments) {
            issues.push({
              message: 'Single-line comments are not valid JSON',
              line: lineNum + 1,
              column: col + 1,
              severity: SEVERITY.ERROR,
              type: 'comment'
            });
          }
          break; // Rest of line is comment
        }

        if (char === '/' && nextChar === '*') {
          if (!opts.allowComments) {
            issues.push({
              message: 'Multi-line comments are not valid JSON',
              line: lineNum + 1,
              column: col + 1,
              severity: SEVERITY.ERROR,
              type: 'comment'
            });
          }
          inComment = true;
          col++; // Skip the *
          continue;
        }

        // String start
        if (char === '"' || char === "'") {
          if (char === "'" && !opts.allowSingleQuotes) {
            issues.push({
              message: 'Single quotes are not valid JSON, use double quotes',
              line: lineNum + 1,
              column: col + 1,
              severity: SEVERITY.ERROR,
              type: 'single-quote'
            });
          }
          inString = true;
          stringChar = char;
          continue;
        }

        // Track braces and brackets
        if (char === '{') {
          braceStack.push({ line: lineNum + 1, col: col + 1 });
        } else if (char === '}') {
          if (braceStack.length === 0) {
            issues.push({
              message: 'Unexpected closing brace',
              line: lineNum + 1,
              column: col + 1,
              severity: SEVERITY.ERROR,
              type: 'bracket-mismatch'
            });
          } else {
            braceStack.pop();
          }
        } else if (char === '[') {
          bracketStack.push({ line: lineNum + 1, col: col + 1 });
        } else if (char === ']') {
          if (bracketStack.length === 0) {
            issues.push({
              message: 'Unexpected closing bracket',
              line: lineNum + 1,
              column: col + 1,
              severity: SEVERITY.ERROR,
              type: 'bracket-mismatch'
            });
          } else {
            bracketStack.pop();
          }
        }

        // Check for trailing commas
        if ((char === '}' || char === ']') && lastNonWhitespaceChar === ',') {
          if (!opts.allowTrailingCommas) {
            issues.push({
              message: 'Trailing comma before ' + char,
              line: lastNonWhitespacePos.line,
              column: lastNonWhitespacePos.col,
              severity: SEVERITY.ERROR,
              type: 'trailing-comma'
            });
          }
        }

        // Track non-whitespace for trailing comma detection
        if (!/\s/.test(char)) {
          lastNonWhitespaceChar = char;
          lastNonWhitespacePos = { line: lineNum + 1, col: col + 1 };
        }
      }
    }

    // Check for unclosed braces/brackets
    for (const pos of braceStack) {
      issues.push({
        message: 'Unclosed brace',
        line: pos.line,
        column: pos.col,
        severity: SEVERITY.ERROR,
        type: 'unclosed-brace'
      });
    }

    for (const pos of bracketStack) {
      issues.push({
        message: 'Unclosed bracket',
        line: pos.line,
        column: pos.col,
        severity: SEVERITY.ERROR,
        type: 'unclosed-bracket'
      });
    }

    // Check for unquoted keys (basic detection)
    const unquotedKeyPattern = /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
    let match;
    while ((match = unquotedKeyPattern.exec(text)) !== null) {
      const keyStart = match.index + match[1].length;
      // Count lines to this position
      const beforeKey = text.substring(0, keyStart);
      const linesBefore = beforeKey.split('\n');
      const lineNum = linesBefore.length;
      const colNum = linesBefore[linesBefore.length - 1].length + 1;
      
      if (!opts.allowUnquotedKeys) {
        issues.push({
          message: `Unquoted key "${match[2]}" is not valid JSON`,
          line: lineNum,
          column: colNum,
          severity: SEVERITY.ERROR,
          type: 'unquoted-key'
        });
      }
    }

    // Remove duplicate issues (same line/column)
    const seen = new Set();
    return issues.filter(issue => {
      const key = `${issue.line}:${issue.column}:${issue.type || issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Attempt to repair common JSON issues
   * @param {string} text - JSON text to repair
   * @param {Object} options - Repair options
   * @returns {Object} - { repaired: string, changes: string[] }
   */
  function autoRepair(text, options = {}) {
    const changes = [];
    let repaired = text;

    // Step 1: Remove comments
    const commentRegex = /\/\/.*?$|\/\*[\s\S]*?\*\//gm;
    if (commentRegex.test(repaired)) {
      repaired = repaired.replace(commentRegex, '');
      changes.push('Removed comments');
    }

    // Step 2: Convert single quotes to double quotes
    // This is tricky because we need to handle escaped quotes
    repaired = convertSingleToDoubleQuotes(repaired);
    if (repaired !== text) {
      changes.push('Converted single quotes to double quotes');
    }

    // Step 3: Quote unquoted keys
    const unquotedKeyRegex = /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
    const beforeQuoting = repaired;
    repaired = repaired.replace(unquotedKeyRegex, '$1"$2":');
    if (repaired !== beforeQuoting) {
      changes.push('Added quotes to unquoted keys');
    }

    // Step 4: Remove trailing commas
    const trailingCommaRegex = /,(\s*[}\]])/g;
    const beforeTrailing = repaired;
    repaired = repaired.replace(trailingCommaRegex, '$1');
    if (repaired !== beforeTrailing) {
      changes.push('Removed trailing commas');
    }

    // Step 5: Try to fix missing commas between properties
    // Look for patterns like "key": value "nextKey": 
    const missingCommaRegex = /("|\d|true|false|null|\]|\})\s*\n\s*"/g;
    const beforeMissingComma = repaired;
    repaired = repaired.replace(missingCommaRegex, (match, p1) => {
      // Don't add comma after opening brace or bracket
      if (p1 === '{' || p1 === '[') return match;
      return p1 + ',\n  "';
    });
    if (repaired !== beforeMissingComma) {
      changes.push('Added missing commas between properties');
    }

    // Step 6: Try to balance brackets
    repaired = balanceBrackets(repaired, changes);

    return { repaired, changes };
  }

  /**
   * Convert single quotes to double quotes in JSON-like string
   * @param {string} text - Text to convert
   * @returns {string} - Converted text
   */
  function convertSingleToDoubleQuotes(text) {
    let result = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      
      if (!inString) {
        if (char === "'" || char === '"') {
          inString = true;
          stringChar = char;
          result += '"'; // Always output double quote
        } else {
          result += char;
        }
      } else {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
          result += '"'; // Always output double quote
        } else if (char === '"' && stringChar === "'") {
          // Escape double quote inside single-quoted string
          result += '\\"';
        } else {
          result += char;
        }
      }
    }
    
    return result;
  }

  /**
   * Try to balance unmatched brackets
   * @param {string} text - Text to balance
   * @param {string[]} changes - Array to record changes
   * @returns {string} - Balanced text
   */
  function balanceBrackets(text, changes) {
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      
      if (char === '"' && prevChar !== '\\') {
        inString = !inString;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
    }
    
    let result = text;
    
    // Add missing closing braces
    if (braceCount > 0) {
      result += '}'.repeat(braceCount);
      changes.push(`Added ${braceCount} missing closing brace(s)`);
    }
    
    // Add missing closing brackets
    if (bracketCount > 0) {
      result += ']'.repeat(bracketCount);
      changes.push(`Added ${bracketCount} missing closing bracket(s)`);
    }
    
    return result;
  }

  /**
   * Lint JSON text
   * @param {string} text - JSON text to lint
   * @param {Object} options - Linting options
   * @returns {Object} - { valid: boolean, errors: Object[], repaired?: string }
   */
  function lint(text, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    if (!text || !text.trim()) {
      return {
        valid: false,
        errors: [{
          message: 'Empty input',
          line: 1,
          column: 1,
          severity: SEVERITY.ERROR
        }]
      };
    }

    const issues = findIssues(text, opts);
    const errors = issues.filter(i => i.severity === SEVERITY.ERROR);
    const warnings = issues.filter(i => i.severity === SEVERITY.WARNING);
    
    const result = {
      valid: errors.length === 0,
      errors: issues,
      errorCount: errors.length,
      warningCount: warnings.length
    };

    // Attempt repair if requested or if there are errors
    if (opts.autoRepair || errors.length > 0) {
      const repairResult = autoRepair(text, opts);
      const repairParse = parseWithDetails(repairResult.repaired);
      
      if (repairParse.valid) {
        result.repaired = repairResult.repaired;
        result.repairs = repairResult.changes;
        result.canRepair = true;
      } else {
        result.canRepair = false;
        result.repairError = repairParse.error;
      }
    }

    // Try flexible parsing as last resort
    if (!result.valid && !result.canRepair && window.parseFlexibleJSON) {
      try {
        const flexResult = window.parseFlexibleJSON(text);
        if (flexResult !== null) {
          result.flexibleParsed = true;
          result.parsedData = flexResult;
          result.repaired = JSON.stringify(flexResult, null, 2);
          result.canRepair = true;
          result.repairs = result.repairs || [];
          result.repairs.push('Parsed using flexible JSON parser (Python syntax support)');
        }
      } catch (e) {
        // Flexible parsing also failed
      }
    }

    return result;
  }

  /**
   * Format/beautify JSON
   * @param {string} text - JSON text to format
   * @param {number} indent - Indentation spaces
   * @returns {Object} - { formatted: string, error?: string }
   */
  function format(text, indent = 2) {
    try {
      const parsed = JSON.parse(text);
      return {
        formatted: JSON.stringify(parsed, null, indent),
        success: true
      };
    } catch (e) {
      // Try flexible parsing
      if (window.parseFlexibleJSON) {
        try {
          const parsed = window.parseFlexibleJSON(text);
          if (parsed !== null) {
            return {
              formatted: JSON.stringify(parsed, null, indent),
              success: true,
              usedFlexibleParser: true
            };
          }
        } catch (e2) {
          // Fall through
        }
      }
      
      return {
        formatted: text,
        success: false,
        error: e.message
      };
    }
  }

  /**
   * Minify JSON
   * @param {string} text - JSON text to minify
   * @returns {Object} - { minified: string, error?: string }
   */
  function minify(text) {
    try {
      const parsed = JSON.parse(text);
      return {
        minified: JSON.stringify(parsed),
        success: true,
        originalSize: text.length,
        minifiedSize: JSON.stringify(parsed).length
      };
    } catch (e) {
      return {
        minified: text,
        success: false,
        error: e.message
      };
    }
  }

  /**
   * Sort JSON keys alphabetically
   * @param {string} text - JSON text
   * @param {boolean} recursive - Sort nested objects too
   * @returns {Object} - { sorted: string, error?: string }
   */
  function sortKeys(text, recursive = true) {
    function sortObject(obj) {
      if (Array.isArray(obj)) {
        return obj.map(item => sortObject(item));
      }
      
      if (obj !== null && typeof obj === 'object') {
        const sorted = {};
        const keys = Object.keys(obj).sort();
        for (const key of keys) {
          sorted[key] = recursive ? sortObject(obj[key]) : obj[key];
        }
        return sorted;
      }
      
      return obj;
    }
    
    try {
      const parsed = JSON.parse(text);
      const sorted = sortObject(parsed);
      return {
        sorted: JSON.stringify(sorted, null, 2),
        success: true
      };
    } catch (e) {
      return {
        sorted: text,
        success: false,
        error: e.message
      };
    }
  }

  // Export to global namespace
  window.JSONLinter = {
    lint,
    format,
    minify,
    sortKeys,
    autoRepair,
    findIssues,
    parseWithDetails,
    SEVERITY,
    DEFAULT_OPTIONS
  };

  console.log('JSONLinter loaded successfully');
})();
