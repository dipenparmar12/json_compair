/**
 * ZIP Snapshot Utilities
 * Handles creation and extraction of ZIP-based snapshots for JSON comparison tool
 * 
 * Dependencies:
 * - JSZip (loaded from CDN)
 * - parseFlexibleJSON (from json_utils.js)
 */

(function() {
  'use strict';

  /**
   * ZipSnapshotManager - Manages ZIP-based snapshot creation and import
   */
  window.ZipSnapshotManager = {
    /**
     * Create a ZIP snapshot with separate JSON files
     * @param {string} leftContent - Content from left editor
     * @param {string} rightContent - Content from right editor
     * @param {object} settings - Application settings object
     * @returns {Promise<Blob>} ZIP file as Blob
     */
    createSnapshot: async function(leftContent, rightContent, settings) {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded');
      }

      const zip = new JSZip();
      
      // Add left content (parse and format if valid JSON)
      const leftFormatted = this._formatContentForFile(leftContent);
      zip.file('left-content.json', leftFormatted);
      
      // Add right content (parse and format if valid JSON)
      const rightFormatted = this._formatContentForFile(rightContent);
      zip.file('right-content.json', rightFormatted);
      
      // Add settings as formatted JSON
      zip.file('settings.json', JSON.stringify(settings, null, 2));
      
      // Add README for user guidance
      zip.file('README.txt', this._generateReadme());
      
      // Generate ZIP with maximum compression
      return await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });
    },

    /**
     * Import snapshot from ZIP file
     * @param {File} file - ZIP file to import
     * @returns {Promise<object>} Object with left, right, and settings
     */
    importSnapshot: async function(file) {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded');
      }

      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      const result = {
        left: '',
        right: '',
        settings: null
      };
      
      // Extract left content
      const leftFile = zip.file('left-content.json');
      if (leftFile) {
        result.left = await leftFile.async('string');
      }
      
      // Extract right content
      const rightFile = zip.file('right-content.json');
      if (rightFile) {
        result.right = await rightFile.async('string');
      }
      
      // Extract settings
      const settingsFile = zip.file('settings.json');
      if (settingsFile) {
        try {
          const settingsText = await settingsFile.async('string');
          result.settings = JSON.parse(settingsText);
        } catch (err) {
          console.warn('Failed to parse settings from ZIP:', err);
        }
      }
      
      return result;
    },

    /**
     * Download ZIP snapshot
     * @param {Blob} zipBlob - ZIP file blob
     * @param {string} filename - Name for downloaded file (default: json-compare-snapshot.zip)
     */
    downloadSnapshot: function(zipBlob, filename = 'json-compare-snapshot.zip') {
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },

    /**
     * Format content for file (parse and prettify if valid JSON)
     * @private
     * @param {string} content - Raw content
     * @returns {string} Formatted content
     */
    _formatContentForFile: function(content) {
      if (!content || !content.trim()) {
        return '';
      }

      try {
        // Use flexible JSON parser if available
        const parser = window.parseFlexibleJSON || JSON.parse;
        const parsed = parser(content);
        return JSON.stringify(parsed, null, 2);
      } catch (e) {
        // If not valid JSON, return as-is
        return content;
      }
    },

    /**
     * Generate README content for ZIP file
     * @private
     * @returns {string} README text
     */
    _generateReadme: function() {
      return `JSON Compare Snapshot
=====================

This ZIP file contains a snapshot from the JSON Compare Tool.

Files:
------
- left-content.json   : Content from the left comparison panel
- right-content.json  : Content from the right comparison panel  
- settings.json       : Application settings (theme, diff options, etc.)
- README.txt          : This file

Usage:
------
1. Import this file using the "Import Snapshot" button in the tool
2. Or manually open individual JSON files in any text editor
3. Share individual files or the entire ZIP with collaborators

Settings:
---------
The settings.json file contains your editor preferences:
- Theme (light/dark/oneDark)
- Word wrap enabled/disabled
- Scroll lock enabled/disabled
- Diff highlighting options
- And more...

Generated: ${new Date().toISOString()}
Tool: JSON Compare (CodeMirror 6)
`;
    }
  };

  /**
   * Legacy format handler for backward compatibility
   */
  window.LegacySnapshotManager = {
    /**
     * Import legacy .json.gz snapshot
     * @param {File} file - Gzipped JSON file
     * @returns {Promise<object>} Object with left, right, and settings
     */
    importSnapshot: async function(file) {
      if (typeof pako === 'undefined') {
        throw new Error('Pako library not loaded');
      }

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let decompressed;
      try {
        decompressed = pako.ungzip(uint8Array, { to: 'string' });
      } catch (err) {
        // Try treating as uncompressed JSON
        const decoder = new TextDecoder();
        decompressed = decoder.decode(uint8Array);
      }

      const data = JSON.parse(decompressed);
      
      return {
        left: data.left || '',
        right: data.right || '',
        settings: data.settings || null
      };
    }
  };

  /**
   * Unified snapshot handler - automatically detects format
   */
  window.SnapshotHandler = {
    /**
     * Import snapshot (auto-detects ZIP or legacy format)
     * @param {File} file - Snapshot file to import
     * @returns {Promise<object>} Object with left, right, and settings
     */
    importSnapshot: async function(file) {
      if (file.name.endsWith('.zip')) {
        return await window.ZipSnapshotManager.importSnapshot(file);
      } else {
        // Legacy .json.gz or .json format
        return await window.LegacySnapshotManager.importSnapshot(file);
      }
    },

    /**
     * Create and download snapshot
     * @param {string} leftContent - Left editor content
     * @param {string} rightContent - Right editor content
     * @param {object} settings - Application settings
     * @returns {Promise<void>}
     */
    createAndDownload: async function(leftContent, rightContent, settings) {
      const zipBlob = await window.ZipSnapshotManager.createSnapshot(
        leftContent, 
        rightContent, 
        settings
      );
      window.ZipSnapshotManager.downloadSnapshot(zipBlob);
    }
  };

})();
