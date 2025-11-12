/**
 * ZIP Snapshot Manager for JSON Compare Tool
 * 
 * Creates ZIP files containing separate JSON files for left/right content and settings
 * This makes exports human-readable and usable outside the tool
 * 
 * Requires: JSZip library (loaded via CDN in index.html)
 */

window.ZipSnapshotManager = {
  /**
   * Create a ZIP snapshot with separate files
   * @param {string} leftContent - Left panel JSON content
   * @param {string} rightContent - Right panel JSON content  
   * @param {object} settings - Application settings
   * @returns {Promise<Blob>} ZIP file blob
   */
  async createSnapshot(leftContent, rightContent, settings) {
    const zip = new JSZip();
    
    // Add README file for user guidance
    const readme = `JSON Compare Tool - Snapshot Export
=====================================

This snapshot contains your comparison session.

Files Included:
- left-content.json: Content from the left panel
- right-content.json: Content from the right panel
- settings.json: Tool settings (diff options, theme, etc.)

How to Use:
1. Open the JSON files in any text editor or JSON viewer
2. Import this ZIP back into the tool using "Import Snapshot"
3. Or use the JSON files directly in your projects

Exported: ${new Date().toISOString()}
Tool: https://github.com/dipenparmar12/json_compair
`;
    zip.file('README.txt', readme);
    
    // Parse and format JSON content for readability
    let leftJson, rightJson;
    
    try {
      // Try to parse and beautify left content
      leftJson = typeof leftContent === 'string' 
        ? (leftContent.trim() ? JSON.stringify(JSON.parse(leftContent), null, 2) : '')
        : JSON.stringify(leftContent, null, 2);
    } catch (e) {
      // If not valid JSON, save as-is
      leftJson = leftContent;
    }
    
    try {
      // Try to parse and beautify right content
      rightJson = typeof rightContent === 'string'
        ? (rightContent.trim() ? JSON.stringify(JSON.parse(rightContent), null, 2) : '')
        : JSON.stringify(rightContent, null, 2);
    } catch (e) {
      // If not valid JSON, save as-is
      rightJson = rightContent;
    }
    
    // Add content files (formatted JSON, not stringified)
    zip.file('left-content.json', leftJson || '');
    zip.file('right-content.json', rightJson || '');
    
    // Add settings as formatted JSON
    zip.file('settings.json', JSON.stringify(settings, null, 2));
    
    // Generate ZIP blob
    const blob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
    
    return blob;
  },
  
  /**
   * Import a ZIP snapshot
   * @param {File} file - ZIP file from file input
   * @returns {Promise<{left: string, right: string, settings: object}>}
   */
  async importSnapshot(file) {
    const zip = await JSZip.loadAsync(file);
    
    // Extract files
    const leftFile = zip.file('left-content.json');
    const rightFile = zip.file('right-content.json');
    const settingsFile = zip.file('settings.json');
    
    if (!leftFile || !rightFile) {
      throw new Error('Invalid snapshot: missing left-content.json or right-content.json');
    }
    
    const leftContent = await leftFile.async('string');
    const rightContent = await rightFile.async('string');
    
    let settings = {};
    if (settingsFile) {
      try {
        const settingsText = await settingsFile.async('string');
        settings = JSON.parse(settingsText);
      } catch (e) {
        console.warn('Failed to parse settings from snapshot:', e);
      }
    }
    
    return { left: leftContent, right: rightContent, settings };
  },
  
  /**
   * Download a ZIP snapshot
   * @param {Blob} blob - ZIP blob
   * @param {string} filename - Download filename
   */
  downloadSnapshot(blob, filename = 'json-compare-snapshot.zip') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

/**
 * Legacy Snapshot Manager for backward compatibility
 * Handles old .json.gz format
 */
window.LegacySnapshotManager = {
  /**
   * Import legacy .json.gz snapshot
   * @param {File} file - Gzipped JSON file
   * @returns {Promise<{left: string, right: string, settings: object}>}
   */
  async importSnapshot(file) {
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
      settings: data.settings || {}
    };
  }
};

/**
 * Unified Snapshot Handler
 * Auto-detects format and routes to appropriate handler
 */
window.SnapshotHandler = {
  /**
   * Import snapshot (auto-detects format)
   * @param {File} file - Snapshot file (.zip or .json.gz)
   * @returns {Promise<{left: string, right: string, settings: object}>}
   */
  async importSnapshot(file) {
    const filename = file.name.toLowerCase();
    
    if (filename.endsWith('.zip')) {
      return await ZipSnapshotManager.importSnapshot(file);
    } else if (filename.endsWith('.json.gz') || filename.endsWith('.gz')) {
      return await LegacySnapshotManager.importSnapshot(file);
    } else {
      throw new Error('Unsupported file format. Please use .zip or .json.gz files.');
    }
  },
  
  /**
   * Create and download snapshot
   * @param {string} leftContent - Left panel content
   * @param {string} rightContent - Right panel content
   * @param {object} settings - Application settings
   */
  async createAndDownload(leftContent, rightContent, settings) {
    const blob = await ZipSnapshotManager.createSnapshot(leftContent, rightContent, settings);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `json-compare-snapshot-${timestamp}.zip`;
    ZipSnapshotManager.downloadSnapshot(blob, filename);
  }
};
