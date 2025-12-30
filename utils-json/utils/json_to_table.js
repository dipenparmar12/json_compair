/**
 * JSON Toolbox - JSON to Table Converter
 * Converts JSON arrays to Markdown and HTML tables.
 * @module json_to_table
 * @version 1.0.0
 */
(function () {
  'use strict';

  const Core = window.JSONToolsCore;
  const Flattener = window.JSONFlattener;

  /**
   * Default options for table generation
   */
  const DEFAULT_OPTIONS = {
    flatten: true,
    arrayMode: 'inline', // 'inline', 'indexed', 'expand'
    includeEmpty: true,
    maxColumns: 50,
    indent: 2,
    expandNested: true,
    format: 'markdown' // 'markdown', 'html', 'html-expandable'
  };

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape special characters for Markdown table cells
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  function escapeMarkdown(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '');
  }

  /**
   * Format a value for display in a table cell
   * @param {*} value - Value to format
   * @param {Object} options - Formatting options
   * @returns {string} - Formatted value
   */
  function formatValue(value, options = {}) {
    if (value === null) return options.includeEmpty ? 'null' : '';
    if (value === undefined) return '';
    
    if (Array.isArray(value)) {
      if (options.arrayMode === 'inline') {
        return value.map(v => formatValue(v, { ...options, arrayMode: 'inline' })).join(', ');
      }
      return JSON.stringify(value);
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    
    return String(value);
  }

  /**
   * Get all unique column headers from an array of objects
   * @param {Object[]} data - Array of objects
   * @param {Object} options - Options
   * @returns {string[]} - Column headers
   */
  function getHeaders(data, options = {}) {
    const headers = new Set();
    
    for (const item of data) {
      if (options.flatten && Flattener) {
        const flat = Flattener.flatten(item, { arrayNotation: 'bracket' });
        for (const key of Object.keys(flat)) {
          headers.add(key);
        }
      } else {
        for (const key of Object.keys(item)) {
          headers.add(key);
        }
      }
    }
    
    // Sort headers for consistency
    const sorted = Array.from(headers).sort((a, b) => {
      // Put simple keys first, then nested
      const aDepth = (a.match(/\./g) || []).length + (a.match(/\[/g) || []).length;
      const bDepth = (b.match(/\./g) || []).length + (b.match(/\[/g) || []).length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.localeCompare(b);
    });
    
    // Limit columns
    return sorted.slice(0, options.maxColumns || DEFAULT_OPTIONS.maxColumns);
  }

  /**
   * Get cell value for a specific header
   * @param {Object} item - Row data
   * @param {string} header - Column header
   * @param {Object} options - Options
   * @returns {*} - Cell value
   */
  function getCellValue(item, header, options = {}) {
    if (options.flatten && Flattener) {
      const flat = Flattener.flatten(item, { arrayNotation: 'bracket' });
      return flat[header];
    }
    return item[header];
  }

  /**
   * Convert JSON array to Markdown table
   * @param {*} data - JSON data (array or object)
   * @param {Object} [options] - Conversion options
   * @returns {Object} - { markdown: string, headers: string[], rowCount: number }
   */
  function toMarkdownTable(data, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Handle single object
    if (!Array.isArray(data)) {
      data = [data];
    }
    
    if (data.length === 0) {
      return { markdown: '| (empty) |\n| --- |\n', headers: [], rowCount: 0 };
    }
    
    const headers = getHeaders(data, opts);
    
    if (headers.length === 0) {
      return { markdown: '| (no data) |\n| --- |\n', headers: [], rowCount: 0 };
    }
    
    // Build header row
    let markdown = '| ' + headers.map(h => escapeMarkdown(h)).join(' | ') + ' |\n';
    
    // Build separator row
    markdown += '|' + headers.map(() => '---').join('|') + '|\n';
    
    // Build data rows
    for (const item of data) {
      const cells = headers.map(header => {
        const value = getCellValue(item, header, opts);
        return escapeMarkdown(formatValue(value, opts));
      });
      markdown += '| ' + cells.join(' | ') + ' |\n';
    }
    
    return {
      markdown,
      headers,
      rowCount: data.length
    };
  }

  /**
   * Convert JSON array to simple HTML table
   * @param {*} data - JSON data
   * @param {Object} [options] - Conversion options
   * @returns {Object} - { html: string, headers: string[], rowCount: number }
   */
  function toHTMLTable(data, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Handle single object
    if (!Array.isArray(data)) {
      data = [data];
    }
    
    if (data.length === 0) {
      return {
        html: '<table><thead><tr><th>(empty)</th></tr></thead></table>',
        headers: [],
        rowCount: 0
      };
    }
    
    const headers = getHeaders(data, opts);
    
    let html = `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif;">\n`;
    
    // Header row
    html += '  <thead>\n    <tr>\n';
    for (const header of headers) {
      html += `      <th style="background-color: #f5f5f5; font-weight: bold;">${escapeHtml(header)}</th>\n`;
    }
    html += '    </tr>\n  </thead>\n';
    
    // Data rows
    html += '  <tbody>\n';
    for (const item of data) {
      html += '    <tr>\n';
      for (const header of headers) {
        const value = getCellValue(item, header, opts);
        html += `      <td>${escapeHtml(formatValue(value, opts))}</td>\n`;
      }
      html += '    </tr>\n';
    }
    html += '  </tbody>\n</table>';
    
    return {
      html,
      headers,
      rowCount: data.length
    };
  }

  /**
   * Render a nested value as expandable HTML
   * @param {*} value - Value to render
   * @param {string} label - Label for the section
   * @returns {string} - HTML string
   */
  function renderExpandableValue(value, label) {
    if (value === null || value === undefined) {
      return '<em>(empty)</em>';
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '<em>(empty array)</em>';
      }
      
      // Check if array contains objects
      if (value.some(v => typeof v === 'object' && v !== null && !Array.isArray(v))) {
        // Render as nested table
        let html = `<details>\n  <summary>${value.length} item(s)</summary>\n`;
        html += `  <table border="1" cellpadding="3" cellspacing="0" style="margin-top: 5px; font-size: 0.9em; border-collapse: collapse;">\n`;
        
        const headers = getHeaders(value, { flatten: false });
        html += '    <tr>';
        for (const h of headers) {
          html += `<th>${escapeHtml(h)}</th>`;
        }
        html += '</tr>\n';
        
        for (const item of value) {
          html += '    <tr>';
          for (const h of headers) {
            const v = item[h];
            if (typeof v === 'object' && v !== null) {
              html += `<td>${renderExpandableValue(v, h)}</td>`;
            } else {
              html += `<td>${escapeHtml(formatValue(v, {}))}</td>`;
            }
          }
          html += '</tr>\n';
        }
        html += '  </table>\n</details>';
        return html;
      }
      
      // Simple array - render as list
      let html = '<ul style="margin: 5px 0; padding-left: 20px;">\n';
      for (const item of value) {
        html += `  <li>${escapeHtml(formatValue(item, {}))}</li>\n`;
      }
      html += '</ul>';
      return html;
    }
    
    if (typeof value === 'object') {
      // Render object as expandable details
      let html = `<details>\n  <summary>View ${label || 'Details'}</summary>\n`;
      html += '  <ul style="margin: 5px 0; padding-left: 20px;">\n';
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const v = value[key];
          if (typeof v === 'object' && v !== null) {
            html += `    <li><strong>${escapeHtml(key)}:</strong> ${renderExpandableValue(v, key)}</li>\n`;
          } else {
            html += `    <li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(formatValue(v, {}))}</li>\n`;
          }
        }
      }
      html += '  </ul>\n</details>';
      return html;
    }
    
    return escapeHtml(formatValue(value, {}));
  }

  /**
   * Convert JSON array to HTML table with expandable nested sections
   * @param {*} data - JSON data
   * @param {Object} [options] - Conversion options
   * @returns {Object} - { html: string, headers: string[], rowCount: number }
   */
  function toExpandableHTMLTable(data, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options, flatten: false };
    
    // Handle single object
    if (!Array.isArray(data)) {
      data = [data];
    }
    
    if (data.length === 0) {
      return {
        html: '<table><thead><tr><th>(empty)</th></tr></thead></table>',
        headers: [],
        rowCount: 0
      };
    }
    
    // Get top-level headers only
    const headers = [];
    for (const item of data) {
      for (const key of Object.keys(item)) {
        if (!headers.includes(key)) {
          headers.push(key);
        }
      }
    }
    
    let html = `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif;">\n`;
    
    // Header row
    html += '  <thead>\n    <tr>\n';
    for (const header of headers) {
      html += `      <th style="background-color: #f5f5f5; font-weight: bold;">${escapeHtml(header)}</th>\n`;
    }
    html += '    </tr>\n  </thead>\n';
    
    // Data rows
    html += '  <tbody>\n';
    for (const item of data) {
      html += '    <tr>\n';
      for (const header of headers) {
        const value = item[header];
        
        if (typeof value === 'object' && value !== null) {
          html += `      <td>${renderExpandableValue(value, header)}</td>\n`;
        } else {
          html += `      <td>${escapeHtml(formatValue(value, opts))}</td>\n`;
        }
      }
      html += '    </tr>\n';
    }
    html += '  </tbody>\n</table>';
    
    return {
      html,
      headers,
      rowCount: data.length
    };
  }

  /**
   * Convert JSON to table in specified format
   * @param {*} data - JSON data
   * @param {Object} [options] - Conversion options
   * @returns {Object} - Result object with output
   */
  function toTable(data, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    switch (opts.format) {
      case 'html':
        return toHTMLTable(data, opts);
      case 'html-expandable':
        return toExpandableHTMLTable(data, opts);
      case 'markdown':
      default:
        return toMarkdownTable(data, opts);
    }
  }

  /**
   * Convert a single object to a key-value table
   * @param {Object} obj - Object to convert
   * @param {Object} [options] - Options
   * @returns {Object} - { markdown: string, html: string }
   */
  function objectToKeyValueTable(obj, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    let flat = obj;
    if (opts.flatten && Flattener) {
      flat = Flattener.flatten(obj, { arrayNotation: 'bracket' });
    }
    
    const entries = Object.entries(flat);
    
    // Markdown
    let markdown = '| Key | Value |\n|---|---|\n';
    for (const [key, value] of entries) {
      markdown += `| ${escapeMarkdown(key)} | ${escapeMarkdown(formatValue(value, opts))} |\n`;
    }
    
    // HTML
    let html = `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif;">\n`;
    html += '  <thead>\n    <tr>\n      <th style="background-color: #f5f5f5;">Key</th>\n      <th style="background-color: #f5f5f5;">Value</th>\n    </tr>\n  </thead>\n';
    html += '  <tbody>\n';
    for (const [key, value] of entries) {
      html += `    <tr>\n      <td><strong>${escapeHtml(key)}</strong></td>\n      <td>${escapeHtml(formatValue(value, opts))}</td>\n    </tr>\n`;
    }
    html += '  </tbody>\n</table>';
    
    return {
      markdown,
      html,
      entries: entries.length
    };
  }

  /**
   * Auto-detect input type and convert appropriately
   * @param {*} data - JSON data
   * @param {Object} [options] - Options
   * @returns {Object} - Result
   */
  function autoConvert(data, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Array of objects -> table
    if (Array.isArray(data)) {
      if (data.length > 0 && data.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) {
        return {
          type: 'array-of-objects',
          ...toTable(data, opts)
        };
      }
      
      // Array of primitives -> simple list
      return {
        type: 'array-of-primitives',
        markdown: data.map((v, i) => `${i + 1}. ${formatValue(v, opts)}`).join('\n'),
        html: '<ol>' + data.map(v => `<li>${escapeHtml(formatValue(v, opts))}</li>`).join('') + '</ol>'
      };
    }
    
    // Single object -> key-value table
    if (typeof data === 'object' && data !== null) {
      return {
        type: 'object',
        ...objectToKeyValueTable(data, opts)
      };
    }
    
    // Primitive -> simple display
    return {
      type: 'primitive',
      markdown: formatValue(data, opts),
      html: `<p>${escapeHtml(formatValue(data, opts))}</p>`
    };
  }

  // Export to global namespace
  window.JSONToTable = {
    toMarkdownTable,
    toHTMLTable,
    toExpandableHTMLTable,
    toTable,
    objectToKeyValueTable,
    autoConvert,
    getHeaders,
    formatValue,
    escapeHtml,
    escapeMarkdown,
    DEFAULT_OPTIONS
  };

  console.log('JSONToTable loaded successfully');
})();
