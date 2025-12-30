/**
 * JSON Toolbox - JSON Shaper
 * Generates structure outlines showing types without values.
 * @module json_shaper
 * @version 1.0.0
 */
(function () {
  'use strict';

  const Core = window.JSONToolsCore;

  /**
   * Default options for shaping
   */
  const DEFAULT_OPTIONS = {
    mode: 'verbose', // 'verbose', 'compact', 'compact-typed'
    showTypes: true,
    maxDepth: Infinity,
    indent: 2
  };

  /**
   * Get the type name for display
   * @param {*} value - Value to analyze
   * @returns {string} - Type name
   */
  function getTypeName(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    const type = typeof value;
    if (type === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    return type;
  }

  /**
   * Generate verbose structure (JSON with type names as values)
   * @param {*} value - Value to analyze
   * @param {Object} options - Options
   * @param {number} depth - Current depth
   * @returns {*} - Structure with type names
   */
  function generateVerboseStructure(value, options, depth = 0) {
    if (depth > options.maxDepth) {
      return '...';
    }

    if (value === null) {
      return 'null';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [];
      }
      // Analyze first item to represent array structure
      const firstItem = generateVerboseStructure(value[0], options, depth + 1);
      return [firstItem];
    }

    if (typeof value === 'object') {
      const result = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = generateVerboseStructure(value[key], options, depth + 1);
        }
      }
      return result;
    }

    // Primitive types
    return getTypeName(value);
  }

  /**
   * Generate compact structure string
   * @param {*} value - Value to analyze
   * @param {Object} options - Options
   * @param {number} depth - Current depth
   * @returns {string} - Compact string representation
   */
  function generateCompactStructure(value, options, depth = 0) {
    if (depth > options.maxDepth) {
      return '...';
    }

    if (value === null) {
      return options.showTypes ? 'null' : 'null';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]';
      }
      const itemStructure = generateCompactStructure(value[0], options, depth + 1);
      return `[ ${itemStructure} ]`;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return '{}';
      }
      
      const parts = keys.map(key => {
        const childStructure = generateCompactStructure(value[key], options, depth + 1);
        if (options.showTypes) {
          // Check if child is a complex type (object/array)
          if (typeof value[key] === 'object' && value[key] !== null) {
            return `${key} ${childStructure}`;
          }
          return `${key}:${childStructure}`;
        }
        // Check if child is a complex type (object/array)
        if (typeof value[key] === 'object' && value[key] !== null) {
          return `${key} ${childStructure}`;
        }
        return key;
      });
      
      return `{ ${parts.join(', ')} }`;
    }

    // Primitive types
    return options.showTypes ? getTypeName(value) : '';
  }

  /**
   * Generate tree structure for UI rendering
   * @param {*} value - Value to analyze
   * @param {string} name - Property name
   * @param {Object} options - Options
   * @param {number} depth - Current depth
   * @param {string} path - Current path
   * @returns {Object} - Tree node
   */
  function generateTreeStructure(value, name, options, depth = 0, path = '') {
    const currentPath = path ? `${path}.${name}` : name;
    
    const node = {
      name: name || 'root',
      path: currentPath,
      depth,
      expanded: depth < 2 // Auto-expand first 2 levels
    };

    if (depth > options.maxDepth) {
      node.type = 'truncated';
      node.displayValue = '...';
      return node;
    }

    if (value === null) {
      node.type = 'null';
      node.displayValue = 'null';
      return node;
    }

    if (Array.isArray(value)) {
      node.type = 'array';
      node.displayValue = `array[${value.length}]`;
      node.children = [];
      
      if (value.length > 0) {
        // Show structure of first item
        const itemNode = generateTreeStructure(
          value[0], 
          '[0]', 
          options, 
          depth + 1, 
          currentPath
        );
        itemNode.isArrayItem = true;
        itemNode.displayValue = `items: ${itemNode.displayValue || itemNode.type}`;
        node.children.push(itemNode);
      }
      return node;
    }

    if (typeof value === 'object') {
      node.type = 'object';
      const keyCount = Object.keys(value).length;
      node.displayValue = `object{${keyCount}}`;
      node.children = [];
      
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          node.children.push(
            generateTreeStructure(value[key], key, options, depth + 1, currentPath)
          );
        }
      }
      return node;
    }

    // Primitive types
    node.type = getTypeName(value);
    node.displayValue = node.type;
    return node;
  }

  /**
   * Generate formatted string output from verbose structure
   * @param {*} structure - Structure object
   * @param {number} indent - Indentation level
   * @returns {string} - Formatted string
   */
  function formatVerboseStructure(structure, indent = 2) {
    return JSON.stringify(structure, null, indent);
  }

  /**
   * Get the structure of a JSON value
   * @param {*} value - JSON value to analyze
   * @param {Object} [options] - Options
   * @returns {Object} - Structure representation
   */
  function getStructure(value, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    const result = {
      mode: opts.mode,
      stats: {
        depth: Core.getMaxDepth(value),
        keyCount: Core.countKeys(value),
        type: getTypeName(value)
      }
    };

    switch (opts.mode) {
      case 'compact':
        opts.showTypes = false;
        result.structure = generateCompactStructure(value, opts);
        break;
        
      case 'compact-typed':
        opts.showTypes = true;
        result.structure = generateCompactStructure(value, opts);
        break;
        
      case 'tree':
        result.tree = generateTreeStructure(value, '', opts);
        result.structure = formatVerboseStructure(generateVerboseStructure(value, opts));
        break;
        
      case 'verbose':
      default:
        result.verboseObject = generateVerboseStructure(value, opts);
        result.structure = formatVerboseStructure(result.verboseObject, opts.indent);
        break;
    }

    return result;
  }

  /**
   * Render tree structure as HTML
   * @param {Object} tree - Tree structure
   * @param {Object} [options] - Rendering options
   * @returns {string} - HTML string
   */
  function renderTreeAsHTML(tree, options = {}) {
    const { expandAll = false, theme = 'light' } = options;
    
    function renderNode(node, isLast = true) {
      const hasChildren = node.children && node.children.length > 0;
      const expandedClass = (expandAll || node.expanded) ? 'expanded' : 'collapsed';
      const typeClass = `type-${node.type}`;
      
      let html = `<div class="tree-node ${expandedClass} ${typeClass}">`;
      
      // Toggle button for expandable nodes
      if (hasChildren) {
        html += `<span class="tree-toggle" onclick="this.parentNode.classList.toggle('expanded');this.parentNode.classList.toggle('collapsed');">`;
        html += `<span class="toggle-icon">▶</span>`;
        html += `</span>`;
      } else {
        html += `<span class="tree-leaf-indent"></span>`;
      }
      
      // Node content
      html += `<span class="tree-key">${escapeHtml(node.name)}</span>`;
      
      if (node.displayValue) {
        html += `<span class="tree-separator">: </span>`;
        html += `<span class="tree-value ${typeClass}">${escapeHtml(node.displayValue)}</span>`;
      }
      
      // Children
      if (hasChildren) {
        html += `<div class="tree-children">`;
        node.children.forEach((child, i) => {
          html += renderNode(child, i === node.children.length - 1);
        });
        html += `</div>`;
      }
      
      html += `</div>`;
      return html;
    }
    
    return `<div class="json-tree theme-${theme}">${renderNode(tree)}</div>`;
  }

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Compare two structures for differences
   * @param {*} value1 - First JSON value
   * @param {*} value2 - Second JSON value
   * @returns {Object} - Comparison result
   */
  function compareStructures(value1, value2) {
    const struct1 = generateVerboseStructure(value1, DEFAULT_OPTIONS);
    const struct2 = generateVerboseStructure(value2, DEFAULT_OPTIONS);
    
    const differences = [];
    
    function compare(s1, s2, path = '') {
      const type1 = typeof s1;
      const type2 = typeof s2;
      
      if (type1 !== type2) {
        differences.push({
          path: path || 'root',
          type: 'type-mismatch',
          left: s1,
          right: s2
        });
        return;
      }
      
      if (type1 === 'string') {
        if (s1 !== s2) {
          differences.push({
            path: path || 'root',
            type: 'type-change',
            left: s1,
            right: s2
          });
        }
        return;
      }
      
      if (Array.isArray(s1) && Array.isArray(s2)) {
        if (s1.length !== s2.length) {
          differences.push({
            path: path || 'root',
            type: 'array-length',
            left: s1.length,
            right: s2.length
          });
        }
        const maxLen = Math.max(s1.length, s2.length);
        for (let i = 0; i < maxLen; i++) {
          compare(s1[i], s2[i], `${path}[${i}]`);
        }
        return;
      }
      
      if (type1 === 'object' && s1 !== null && s2 !== null) {
        const keys1 = Object.keys(s1);
        const keys2 = Object.keys(s2);
        const allKeys = new Set([...keys1, ...keys2]);
        
        for (const key of allKeys) {
          const newPath = path ? `${path}.${key}` : key;
          if (!(key in s1)) {
            differences.push({
              path: newPath,
              type: 'added',
              right: s2[key]
            });
          } else if (!(key in s2)) {
            differences.push({
              path: newPath,
              type: 'removed',
              left: s1[key]
            });
          } else {
            compare(s1[key], s2[key], newPath);
          }
        }
      }
    }
    
    compare(struct1, struct2);
    
    return {
      identical: differences.length === 0,
      differences
    };
  }

  // Export to global namespace
  window.JSONShaper = {
    getStructure,
    generateVerboseStructure,
    generateCompactStructure,
    generateTreeStructure,
    renderTreeAsHTML,
    compareStructures,
    DEFAULT_OPTIONS
  };

  console.log('JSONShaper loaded successfully');
})();
