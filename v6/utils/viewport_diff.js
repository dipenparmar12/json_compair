/**
 * ViewportDiffManager - Virtual Diff Viewport for Large Datasets
 * 
 * This utility computes diffs only for the visible scroll area plus a buffer zone,
 * drastically reducing processing time for large files. The diff engine re-calculates
 * on scroll (debounced), keeping the UI responsive regardless of dataset size.
 * 
 * Usage:
 *   const manager = new ViewportDiffManager(mergeView, options);
 *   manager.enable();
 *   manager.disable();
 */
(function () {
  'use strict';

  // Default configuration
  const DEFAULT_OPTIONS = {
    bufferLines: 100,           // Lines above/below viewport to include in diff
    scrollDebounceMs: 150,      // Debounce time for scroll-triggered recalculation
    largeSizeThreshold: 300000, // 300KB - auto-enable threshold
    showIndicators: true,       // Show "X more differences above/below" indicators
    cacheMaxEntries: 20,        // Max cached diff segments
  };

  /**
   * ViewportDiffManager class
   * Manages viewport-based diff calculations for CodeMirror 6 MergeView
   */
  class ViewportDiffManager {
    constructor(mergeView, options = {}) {
      this.mergeView = mergeView;
      this.options = Object.assign({}, DEFAULT_OPTIONS, options);
      this.enabled = false;
      this.scrollHandler = null;
      this.debounceTimer = null;
      this.diffCache = new Map();
      this.lastViewport = { left: null, right: null };
      this.visibleDiffCount = 0;
      this.estimatedTotalDiffs = null;
      this.isCalculating = false;
      
      // Callbacks for UI updates
      this.onDiffCalculated = options.onDiffCalculated || (() => {});
      this.onCalculationStart = options.onCalculationStart || (() => {});
      this.onCalculationEnd = options.onCalculationEnd || (() => {});
    }

    /**
     * Enable viewport-based diffing
     */
    enable() {
      if (this.enabled) return;
      this.enabled = true;
      this._setupScrollListeners();
      this._recalculateViewportDiff();
      console.log('[ViewportDiffManager] Enabled');
    }

    /**
     * Disable viewport-based diffing
     */
    disable() {
      if (!this.enabled) return;
      this.enabled = false;
      this._removeScrollListeners();
      this._clearCache();
      console.log('[ViewportDiffManager] Disabled');
    }

    /**
     * Check if content size exceeds the large file threshold
     */
    isLargeContent(leftContent, rightContent) {
      const totalSize = (leftContent?.length || 0) + (rightContent?.length || 0);
      return totalSize > this.options.largeSizeThreshold;
    }

    /**
     * Get the current viewport line range for an editor
     */
    getViewportRange(editor) {
      if (!editor || !editor.viewport) return null;

      const viewport = editor.viewport;
      const doc = editor.state.doc;
      
      // Get line numbers for viewport positions
      const fromLine = doc.lineAt(viewport.from).number;
      const toLine = doc.lineAt(Math.min(viewport.to, doc.length)).number;
      
      // Apply buffer
      const bufferFromLine = Math.max(1, fromLine - this.options.bufferLines);
      const bufferToLine = Math.min(doc.lines, toLine + this.options.bufferLines);
      
      // Get character positions for buffered range
      const bufferFrom = doc.line(bufferFromLine).from;
      const bufferTo = doc.line(bufferToLine).to;
      
      return {
        visibleFromLine: fromLine,
        visibleToLine: toLine,
        bufferFromLine,
        bufferToLine,
        bufferFrom,
        bufferTo,
        totalLines: doc.lines
      };
    }

    /**
     * Extract text slice for the viewport range
     */
    getViewportText(editor, range) {
      if (!editor || !range) return '';
      return editor.state.doc.sliceString(range.bufferFrom, range.bufferTo);
    }

    /**
     * Calculate diff for the current viewport only
     */
    calculateViewportDiff() {
      if (!this.enabled || !this.mergeView) return null;
      if (typeof diff_match_patch === 'undefined') {
        console.warn('[ViewportDiffManager] diff_match_patch not available');
        return null;
      }

      const leftEditor = this.mergeView.a;
      const rightEditor = this.mergeView.b;
      
      if (!leftEditor || !rightEditor) return null;

      const leftRange = this.getViewportRange(leftEditor);
      const rightRange = this.getViewportRange(rightEditor);
      
      if (!leftRange || !rightRange) return null;

      // Check cache
      const cacheKey = this._getCacheKey(leftRange, rightRange);
      if (this.diffCache.has(cacheKey)) {
        return this.diffCache.get(cacheKey);
      }

      // Get viewport text slices
      const leftText = this.getViewportText(leftEditor, leftRange);
      const rightText = this.getViewportText(rightEditor, rightRange);

      // Calculate diff for viewport only
      const dmp = new diff_match_patch();
      const diffs = dmp.diff_main(leftText, rightText);
      dmp.diff_cleanupSemantic(diffs);

      // Count diff chunks
      let diffCount = 0;
      let inDiffChunk = false;
      for (const [op, text] of diffs) {
        if (op !== 0) {
          if (!inDiffChunk) {
            diffCount++;
            inDiffChunk = true;
          }
        } else {
          inDiffChunk = false;
        }
      }

      const result = {
        diffs,
        diffCount,
        leftRange,
        rightRange,
        timestamp: Date.now()
      };

      // Cache result
      this._addToCache(cacheKey, result);
      this.visibleDiffCount = diffCount;

      return result;
    }

    /**
     * Get diff status message for viewport mode
     */
    getDiffStatusMessage() {
      if (!this.enabled) return null;
      
      const leftRange = this.getViewportRange(this.mergeView?.a);
      const rightRange = this.getViewportRange(this.mergeView?.b);
      
      if (!leftRange || !rightRange) return 'Calculating...';

      const isPartialView = leftRange.bufferFromLine > 1 || 
                           leftRange.bufferToLine < leftRange.totalLines ||
                           rightRange.bufferFromLine > 1 ||
                           rightRange.bufferToLine < rightRange.totalLines;

      if (isPartialView) {
        return `~${this.visibleDiffCount} difference${this.visibleDiffCount !== 1 ? 's' : ''} in view (viewport mode)`;
      }
      
      return `Found ${this.visibleDiffCount} difference${this.visibleDiffCount !== 1 ? 's' : ''}`;
    }

    /**
     * Get indicators for differences outside viewport
     */
    getOutOfViewportIndicators() {
      if (!this.enabled || !this.mergeView) return { above: 0, below: 0 };
      
      // This is an estimate based on content size ratios
      const leftRange = this.getViewportRange(this.mergeView.a);
      const rightRange = this.getViewportRange(this.mergeView.b);
      
      if (!leftRange || !rightRange) return { above: 0, below: 0 };
      
      const totalLines = Math.max(leftRange.totalLines, rightRange.totalLines);
      const viewportStart = Math.min(leftRange.bufferFromLine, rightRange.bufferFromLine);
      const viewportEnd = Math.max(leftRange.bufferToLine, rightRange.bufferToLine);
      
      // Rough estimate based on visible diff density
      const viewportRatio = (viewportEnd - viewportStart + 1) / totalLines;
      const estimatedTotal = viewportRatio > 0 ? Math.round(this.visibleDiffCount / viewportRatio) : this.visibleDiffCount;
      
      const aboveRatio = (viewportStart - 1) / totalLines;
      const belowRatio = (totalLines - viewportEnd) / totalLines;
      
      return {
        above: Math.round(estimatedTotal * aboveRatio),
        below: Math.round(estimatedTotal * belowRatio),
        total: estimatedTotal
      };
    }

    /**
     * Force recalculation (e.g., after content change)
     */
    invalidateCache() {
      this._clearCache();
      if (this.enabled) {
        this._recalculateViewportDiff();
      }
    }

    // Private methods

    _setupScrollListeners() {
      if (!this.mergeView) return;

      const leftScroller = this.mergeView.a?.scrollDOM;
      const rightScroller = this.mergeView.b?.scrollDOM;

      this.scrollHandler = () => {
        if (!this.enabled) return;
        
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this._recalculateViewportDiff();
        }, this.options.scrollDebounceMs);
      };

      if (leftScroller) {
        leftScroller.addEventListener('scroll', this.scrollHandler, { passive: true });
      }
      if (rightScroller) {
        rightScroller.addEventListener('scroll', this.scrollHandler, { passive: true });
      }
    }

    _removeScrollListeners() {
      if (!this.mergeView || !this.scrollHandler) return;

      const leftScroller = this.mergeView.a?.scrollDOM;
      const rightScroller = this.mergeView.b?.scrollDOM;

      if (leftScroller) {
        leftScroller.removeEventListener('scroll', this.scrollHandler);
      }
      if (rightScroller) {
        rightScroller.removeEventListener('scroll', this.scrollHandler);
      }

      clearTimeout(this.debounceTimer);
      this.scrollHandler = null;
    }

    _recalculateViewportDiff() {
      if (this.isCalculating) return;
      
      this.isCalculating = true;
      this.onCalculationStart();

      // Use requestAnimationFrame to avoid blocking
      requestAnimationFrame(() => {
        try {
          const result = this.calculateViewportDiff();
          this.onDiffCalculated(result);
        } catch (err) {
          console.warn('[ViewportDiffManager] Diff calculation error:', err);
        } finally {
          this.isCalculating = false;
          this.onCalculationEnd();
        }
      });
    }

    _getCacheKey(leftRange, rightRange) {
      return `${leftRange.bufferFromLine}-${leftRange.bufferToLine}:${rightRange.bufferFromLine}-${rightRange.bufferToLine}`;
    }

    _addToCache(key, value) {
      // Limit cache size
      if (this.diffCache.size >= this.options.cacheMaxEntries) {
        const oldestKey = this.diffCache.keys().next().value;
        this.diffCache.delete(oldestKey);
      }
      this.diffCache.set(key, value);
    }

    _clearCache() {
      this.diffCache.clear();
      this.visibleDiffCount = 0;
      this.estimatedTotalDiffs = null;
    }
  }

  /**
   * PerformanceMode - Bundles multiple performance optimizations
   * Note: Preserves highlightChanges by default since visual diffs are important
   */
  class PerformanceMode {
    constructor() {
      this.enabled = false;
      this.originalSettings = null;
    }

    /**
     * Performance mode settings
     * Note: We keep highlightChanges enabled as it's important for visual comparison
     * Only disable collapseUnchanged and adjust timeout for faster processing
     */
    static get SETTINGS() {
      return {
        collapseUnchanged: true,  // Collapse unchanged sections to reduce rendering
        timeout: 3000,            // Shorter timeout for faster fallback
        // Note: We do NOT modify scanLimit or highlightChanges - user controls these
      };
    }

    /**
     * Enable performance mode - saves current settings and applies optimized ones
     */
    enable() {
      if (this.enabled) return;
      
      // Save original settings
      this.originalSettings = {
        scanLimit: SettingsManager.get('scanLimit'),
        highlightChanges: SettingsManager.get('highlightChanges'),
        collapseUnchanged: SettingsManager.get('collapseUnchanged'),
        timeout: SettingsManager.get('timeout'),
      };

      // Apply performance settings
      Object.entries(PerformanceMode.SETTINGS).forEach(([key, value]) => {
        SettingsManager.set(key, value);
      });

      this.enabled = true;
      console.log('[PerformanceMode] Enabled');
      return true;
    }

    /**
     * Disable performance mode - restores original settings
     */
    disable() {
      if (!this.enabled || !this.originalSettings) return;

      // Restore original settings
      Object.entries(this.originalSettings).forEach(([key, value]) => {
        SettingsManager.set(key, value);
      });

      this.originalSettings = null;
      this.enabled = false;
      console.log('[PerformanceMode] Disabled');
      return true;
    }

    /**
     * Check if performance mode should be suggested based on content size
     */
    static shouldSuggest(leftContent, rightContent) {
      const totalSize = (leftContent?.length || 0) + (rightContent?.length || 0);
      return {
        suggest: totalSize > 300000, // 300KB
        warn: totalSize > 500000,    // 500KB
        critical: totalSize > 2000000 // 2MB
      };
    }
  }

  /**
   * LargeFileDetector - Detects large files and suggests optimizations
   */
  class LargeFileDetector {
    constructor(options = {}) {
      this.thresholds = {
        autoEnable: options.autoEnableThreshold || 300000,  // 300KB
        warning: options.warningThreshold || 500000,        // 500KB
        critical: options.criticalThreshold || 2000000,     // 2MB
      };
    }

    /**
     * Analyze content and return recommendations
     */
    analyze(leftContent, rightContent) {
      const leftSize = leftContent?.length || 0;
      const rightSize = rightContent?.length || 0;
      const totalSize = leftSize + rightSize;

      const result = {
        leftSize,
        rightSize,
        totalSize,
        isLarge: totalSize > this.thresholds.autoEnable,
        isWarning: totalSize > this.thresholds.warning,
        isCritical: totalSize > this.thresholds.critical,
        recommendations: [],
        formattedSize: this._formatBytes(totalSize),
      };

      if (result.isCritical) {
        result.recommendations.push({
          type: 'critical',
          message: 'File size exceeds 2MB. Consider splitting into smaller chunks or using Performance Mode.',
          action: 'enablePerformanceMode'
        });
      } else if (result.isWarning) {
        result.recommendations.push({
          type: 'warning',
          message: 'Large file detected (>500KB). Performance Mode recommended.',
          action: 'suggestPerformanceMode'
        });
      } else if (result.isLarge) {
        result.recommendations.push({
          type: 'info',
          message: 'Viewport diff mode enabled for better performance.',
          action: 'enableViewportDiff'
        });
      }

      return result;
    }

    _formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  }

  /**
   * Toast notification utility for performance-related messages
   */
  const PerformanceToast = {
    show(message, type = 'info', duration = 4000) {
      // Remove existing toast
      const existing = document.getElementById('performance-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'performance-toast';
      toast.className = `performance-toast performance-toast-${type}`;
      toast.innerHTML = `
        <span class="toast-icon">${this._getIcon(type)}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
      `;

      // Inject styles if not present
      this._injectStyles();

      document.body.appendChild(toast);

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => toast.remove(), duration);
      }

      return toast;
    },

    _getIcon(type) {
      const icons = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨',
        success: '✅'
      };
      return icons[type] || icons.info;
    },

    _injectStyles() {
      if (document.getElementById('performance-toast-styles')) return;

      const styles = document.createElement('style');
      styles.id = 'performance-toast-styles';
      styles.textContent = `
        .performance-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 16px;
          background: #333;
          color: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 10000;
          animation: slideIn 0.3s ease;
          max-width: 400px;
        }
        .performance-toast-warning {
          background: #f0ad4e;
          color: #333;
        }
        .performance-toast-critical {
          background: #d9534f;
        }
        .performance-toast-success {
          background: #5cb85c;
        }
        .toast-close {
          background: none;
          border: none;
          color: inherit;
          font-size: 18px;
          cursor: pointer;
          padding: 0 4px;
          opacity: 0.7;
        }
        .toast-close:hover {
          opacity: 1;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(styles);
    }
  };

  // Expose to global scope
  window.ViewportDiffManager = ViewportDiffManager;
  window.PerformanceMode = PerformanceMode;
  window.LargeFileDetector = LargeFileDetector;
  window.PerformanceToast = PerformanceToast;

})();
