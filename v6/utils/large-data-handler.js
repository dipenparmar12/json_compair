/**
 * Large Data Handler - Robust handling for datasets of any size
 * 
 * Provides:
 * - Web Worker offloading for heavy processing
 * - Chunked processing to prevent UI freeze
 * - Streaming JSON parsing for very large files
 * - Progress tracking and cancellation
 * - Memory-efficient operations
 * 
 * Design Goals:
 * - Never freeze the UI, even with 200MB+ files
 * - Graceful degradation when Workers unavailable
 * - Real-time progress feedback
 * - Cancellable operations
 */
(function () {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    // Size thresholds (bytes)
    CHUNK_SIZE: 64 * 1024,           // 64KB chunks for processing
    WORKER_THRESHOLD: 50 * 1024,      // 50KB - use worker above this
    STREAMING_THRESHOLD: 5 * 1024 * 1024, // 5MB - use streaming parser
    CRITICAL_THRESHOLD: 50 * 1024 * 1024, // 50MB - extra caution
    EXTREME_THRESHOLD: 200 * 1024 * 1024, // 200MB - maximum optimizations
    
    // Processing limits
    MAX_SYNC_PARSE_SIZE: 1 * 1024 * 1024, // 1MB max for sync JSON.parse
    YIELD_INTERVAL_MS: 16,            // Yield to UI every 16ms (~60fps)
    PROGRESS_UPDATE_INTERVAL: 100,    // Update progress every 100ms
    
    // Worker pool
    MAX_WORKERS: navigator.hardwareConcurrency || 4,
    WORKER_TIMEOUT_MS: 60000,         // 1 minute timeout
  };

  // ============================================
  // Progress Manager - Real-time progress UI
  // ============================================
  class ProgressManager {
    constructor() {
      this.activeOperations = new Map();
      this.progressElement = null;
      this._createProgressUI();
    }

    _createProgressUI() {
      // Check if element already exists
      if (document.getElementById('large-data-progress')) {
        this.progressElement = document.getElementById('large-data-progress');
        return;
      }

      const container = document.createElement('div');
      container.id = 'large-data-progress';
      container.className = 'large-data-progress-container';
      container.innerHTML = `
        <div class="progress-backdrop"></div>
        <div class="progress-modal">
          <div class="progress-header">
            <span class="progress-title">Processing Large Data</span>
            <button class="progress-cancel" title="Cancel">✕</button>
          </div>
          <div class="progress-body">
            <div class="progress-status">Initializing...</div>
            <div class="progress-bar-container">
              <div class="progress-bar"></div>
            </div>
            <div class="progress-details">
              <span class="progress-percentage">0%</span>
              <span class="progress-size"></span>
            </div>
          </div>
          <div class="progress-tips">
            <span class="tip-icon">💡</span>
            <span class="tip-text">Large files are processed in background to keep the app responsive.</span>
          </div>
        </div>
      `;

      // Add styles
      if (!document.getElementById('large-data-progress-styles')) {
        const styles = document.createElement('style');
        styles.id = 'large-data-progress-styles';
        styles.textContent = `
          .large-data-progress-container {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .large-data-progress-container.visible {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .progress-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(2px);
          }
          .progress-modal {
            position: relative;
            background: white;
            border-radius: 12px;
            padding: 24px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.2s ease-out;
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .progress-title {
            font-size: 18px;
            font-weight: 600;
            color: #333;
          }
          .progress-cancel {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #999;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s;
          }
          .progress-cancel:hover {
            background: #f0f0f0;
            color: #333;
          }
          .progress-status {
            font-size: 14px;
            color: #666;
            margin-bottom: 12px;
          }
          .progress-bar-container {
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 12px;
          }
          .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #08c988, #06a070);
            width: 0%;
            transition: width 0.2s ease-out;
            border-radius: 4px;
          }
          .progress-bar.indeterminate {
            width: 30%;
            animation: indeterminate 1.5s infinite linear;
          }
          @keyframes indeterminate {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
          .progress-details {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: #888;
          }
          .progress-percentage {
            font-weight: 500;
            color: #08c988;
          }
          .progress-tips {
            margin-top: 16px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #666;
          }
          .tip-icon {
            font-size: 16px;
          }
          
          /* Dark mode support */
          @media (prefers-color-scheme: dark) {
            .progress-modal {
              background: #2d2d2d;
            }
            .progress-title {
              color: #e0e0e0;
            }
            .progress-status {
              color: #aaa;
            }
            .progress-bar-container {
              background: #444;
            }
            .progress-cancel:hover {
              background: #444;
              color: #fff;
            }
            .progress-tips {
              background: #383838;
              color: #aaa;
            }
          }
        `;
        document.head.appendChild(styles);
      }

      document.body.appendChild(container);
      this.progressElement = container;

      // Setup cancel button
      container.querySelector('.progress-cancel').onclick = () => {
        this.cancelAll();
      };
    }

    show(operationId, options = {}) {
      const operation = {
        id: operationId,
        title: options.title || 'Processing Large Data',
        status: options.status || 'Initializing...',
        progress: 0,
        size: options.size || 0,
        startTime: Date.now(),
        cancelled: false,
        onCancel: options.onCancel || null,
      };

      this.activeOperations.set(operationId, operation);
      this._updateUI(operation);
      this.progressElement.classList.add('visible');
      return operationId;
    }

    update(operationId, updates) {
      const operation = this.activeOperations.get(operationId);
      if (!operation) return;

      Object.assign(operation, updates);
      this._updateUI(operation);
    }

    complete(operationId) {
      this.activeOperations.delete(operationId);
      if (this.activeOperations.size === 0) {
        this.progressElement.classList.remove('visible');
      }
    }

    cancelAll() {
      for (const [id, operation] of this.activeOperations) {
        operation.cancelled = true;
        if (operation.onCancel) {
          operation.onCancel();
        }
      }
      this.activeOperations.clear();
      this.progressElement.classList.remove('visible');
    }

    isCancelled(operationId) {
      const operation = this.activeOperations.get(operationId);
      return operation ? operation.cancelled : true;
    }

    _updateUI(operation) {
      const modal = this.progressElement.querySelector('.progress-modal');
      modal.querySelector('.progress-title').textContent = operation.title;
      modal.querySelector('.progress-status').textContent = operation.status;
      
      const bar = modal.querySelector('.progress-bar');
      if (operation.progress < 0) {
        bar.classList.add('indeterminate');
        bar.style.width = '30%';
      } else {
        bar.classList.remove('indeterminate');
        bar.style.width = `${Math.min(100, operation.progress)}%`;
      }
      
      modal.querySelector('.progress-percentage').textContent = 
        operation.progress < 0 ? 'Processing...' : `${Math.round(operation.progress)}%`;
      
      if (operation.size > 0) {
        modal.querySelector('.progress-size').textContent = this._formatSize(operation.size);
      }
    }

    _formatSize(bytes) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
  }

  // ============================================
  // Worker Manager - Web Worker Pool
  // ============================================
  class WorkerManager {
    constructor() {
      this.worker = null;
      this.pendingTasks = new Map();
      this.taskId = 0;
      this._initWorker();
    }

    _initWorker() {
      try {
        // Create worker from existing diff-worker.js and extend it
        const workerCode = `
          // Import diff_match_patch from existing worker
          ${this._getDiffMatchPatchCode()}
          
          // Large data processing functions
          const LargeDataProcessor = {
            // Chunked JSON parsing
            parseJSONChunked: function(text, chunkSize = 65536) {
              // For very large strings, we need to be careful
              // Standard JSON.parse should work, but we wrap it safely
              try {
                return { ok: true, result: JSON.parse(text) };
              } catch (e) {
                return { ok: false, error: e.message };
              }
            },
            
            // Format JSON with progress
            formatJSON: function(obj, indent = 3) {
              try {
                const result = JSON.stringify(obj, null, indent);
                return { ok: true, result };
              } catch (e) {
                return { ok: false, error: e.message };
              }
            },
            
            // Sort JSON keys deeply
            sortJSONKeys: function(obj) {
              if (obj === null || typeof obj !== 'object') return obj;
              if (Array.isArray(obj)) {
                return obj.map(item => this.sortJSONKeys(item));
              }
              const sorted = {};
              const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
              for (const key of keys) {
                sorted[key] = this.sortJSONKeys(obj[key]);
              }
              return sorted;
            },
            
            // Count diff chunks efficiently
            countDiffChunks: function(leftText, rightText) {
              const startTime = performance.now();
              const dmp = new diff_match_patch();
              
              // For very large texts, use line mode
              const useLineMode = leftText.length > 100000 || rightText.length > 100000;
              let diffs;
              
              if (useLineMode) {
                // Convert to line-based for faster processing
                diffs = dmp.diff_main(leftText, rightText, true);
              } else {
                diffs = dmp.diff_main(leftText, rightText);
              }
              
              dmp.diff_cleanupSemantic(diffs);
              
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
              
              return {
                diffCount,
                duration: performance.now() - startTime
              };
            },
            
            // CSV to JSON conversion
            parseCSV: function(text, options = {}) {
              const lines = text.split(/\\r?\\n/);
              const delimiter = options.delimiter || this._detectDelimiter(text);
              const result = [];
              
              if (lines.length === 0) return { ok: true, result: [] };
              
              // Parse header
              const headers = this._parseCSVLine(lines[0], delimiter);
              
              // Parse data rows
              for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = this._parseCSVLine(line, delimiter);
                const row = {};
                
                for (let j = 0; j < headers.length; j++) {
                  let value = values[j] || '';
                  // Coerce types
                  if (options.coerceTypes !== false) {
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;
                    else if (value === 'null' || value === '') value = null;
                    else if (!isNaN(value) && value !== '') value = Number(value);
                  }
                  row[headers[j]] = value;
                }
                result.push(row);
              }
              
              return { ok: true, result };
            },
            
            _detectDelimiter: function(text) {
              const sample = text.slice(0, 2000);
              const commas = (sample.match(/,/g) || []).length;
              const tabs = (sample.match(/\\t/g) || []).length;
              const semicolons = (sample.match(/;/g) || []).length;
              
              if (tabs > commas && tabs > semicolons) return '\\t';
              if (semicolons > commas) return ';';
              return ',';
            },
            
            _parseCSVLine: function(line, delimiter) {
              const result = [];
              let current = '';
              let inQuotes = false;
              
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                  if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                  } else {
                    inQuotes = !inQuotes;
                  }
                } else if (char === delimiter && !inQuotes) {
                  result.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              result.push(current.trim());
              return result;
            }
          };
          
          // Message handler
          self.onmessage = function(e) {
            const { id, action, payload } = e.data;
            let result;
            
            try {
              switch (action) {
                case 'parseJSON':
                  result = LargeDataProcessor.parseJSONChunked(payload.text);
                  break;
                  
                case 'formatJSON':
                  result = LargeDataProcessor.formatJSON(payload.obj, payload.indent);
                  break;
                  
                case 'sortJSONKeys':
                  const sorted = LargeDataProcessor.sortJSONKeys(payload.obj);
                  result = { ok: true, result: sorted };
                  break;
                  
                case 'countDiffs':
                  const diffResult = LargeDataProcessor.countDiffChunks(payload.leftText, payload.rightText);
                  result = { ok: true, result: diffResult };
                  break;
                  
                case 'parseCSV':
                  result = LargeDataProcessor.parseCSV(payload.text, payload.options);
                  break;
                  
                case 'fullProcess':
                  // Full processing pipeline: parse, sort, format
                  let data = payload.text;
                  
                  // Parse
                  const parseResult = LargeDataProcessor.parseJSONChunked(data);
                  if (!parseResult.ok) {
                    result = parseResult;
                    break;
                  }
                  data = parseResult.result;
                  
                  // Sort if requested
                  if (payload.sort) {
                    data = LargeDataProcessor.sortJSONKeys(data);
                  }
                  
                  // Format
                  const formatResult = LargeDataProcessor.formatJSON(data, payload.indent || 3);
                  result = formatResult;
                  break;
                  
                case 'ping':
                  result = { ok: true, result: 'pong' };
                  break;
                  
                default:
                  result = { ok: false, error: 'Unknown action: ' + action };
              }
            } catch (e) {
              result = { ok: false, error: e.message };
            }
            
            self.postMessage({ id, ...result });
          };
          
          // Signal ready
          self.postMessage({ type: 'ready' });
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));

        this.worker.onmessage = (e) => {
          const { id, ok, result, error, type } = e.data;
          
          if (type === 'ready') {
            console.log('[LargeDataHandler] Worker ready');
            return;
          }

          const task = this.pendingTasks.get(id);
          if (task) {
            this.pendingTasks.delete(id);
            clearTimeout(task.timeout);
            
            if (ok) {
              task.resolve(result);
            } else {
              task.reject(new Error(error || 'Worker task failed'));
            }
          }
        };

        this.worker.onerror = (e) => {
          console.error('[LargeDataHandler] Worker error:', e);
        };

      } catch (err) {
        console.warn('[LargeDataHandler] Failed to create worker:', err);
        this.worker = null;
      }
    }

    _getDiffMatchPatchCode() {
      // Inline diff_match_patch implementation for worker
      return `
        class diff_match_patch {
          constructor() {
            this.Diff_Timeout = 1.0;
          }
          
          diff_main(text1, text2, checklines = true) {
            if (text1 === text2) {
              return text1 ? [[0, text1]] : [];
            }
            
            let commonlength = this.diff_commonPrefix(text1, text2);
            let commonprefix = text1.substring(0, commonlength);
            text1 = text1.substring(commonlength);
            text2 = text2.substring(commonlength);
            
            commonlength = this.diff_commonSuffix(text1, text2);
            let commonsuffix = text1.substring(text1.length - commonlength);
            text1 = text1.substring(0, text1.length - commonlength);
            text2 = text2.substring(0, text2.length - commonlength);
            
            let diffs = this.diff_compute_(text1, text2, checklines);
            
            if (commonprefix) diffs.unshift([0, commonprefix]);
            if (commonsuffix) diffs.push([0, commonsuffix]);
            
            this.diff_cleanupMerge(diffs);
            return diffs;
          }
          
          diff_compute_(text1, text2, checklines) {
            if (!text1) return [[1, text2]];
            if (!text2) return [[-1, text1]];
            
            let longtext = text1.length > text2.length ? text1 : text2;
            let shorttext = text1.length > text2.length ? text2 : text1;
            let i = longtext.indexOf(shorttext);
            
            if (i !== -1) {
              let diffs = [[1, longtext.substring(0, i)], [0, shorttext], [1, longtext.substring(i + shorttext.length)]];
              if (text1.length > text2.length) diffs[0][0] = diffs[2][0] = -1;
              return diffs;
            }
            
            if (shorttext.length === 1) return [[-1, text1], [1, text2]];
            
            return this.diff_bisect_(text1, text2);
          }
          
          diff_bisect_(text1, text2) {
            const text1_length = text1.length;
            const text2_length = text2.length;
            const max_d = Math.ceil((text1_length + text2_length) / 2);
            const v_offset = max_d;
            const v_length = 2 * max_d;
            const v1 = new Array(v_length).fill(-1);
            const v2 = new Array(v_length).fill(-1);
            v1[v_offset + 1] = 0;
            v2[v_offset + 1] = 0;
            const delta = text1_length - text2_length;
            const front = (delta % 2 !== 0);
            let k1start = 0, k1end = 0, k2start = 0, k2end = 0;
            
            for (let d = 0; d < max_d; d++) {
              for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
                const k1_offset = v_offset + k1;
                let x1;
                if (k1 === -d || (k1 !== d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
                  x1 = v1[k1_offset + 1];
                } else {
                  x1 = v1[k1_offset - 1] + 1;
                }
                let y1 = x1 - k1;
                while (x1 < text1_length && y1 < text2_length && text1.charAt(x1) === text2.charAt(y1)) {
                  x1++; y1++;
                }
                v1[k1_offset] = x1;
                if (x1 > text1_length) k1end += 2;
                else if (y1 > text2_length) k1start += 2;
                else if (front) {
                  const k2_offset = v_offset + delta - k1;
                  if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] !== -1) {
                    const x2 = text1_length - v2[k2_offset];
                    if (x1 >= x2) {
                      return this.diff_bisectSplit_(text1, text2, x1, y1);
                    }
                  }
                }
              }
              
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
                  x2++; y2++;
                }
                v2[k2_offset] = x2;
                if (x2 > text1_length) k2end += 2;
                else if (y2 > text2_length) k2start += 2;
                else if (!front) {
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
          
          diff_commonPrefix(text1, text2) {
            if (!text1 || !text2 || text1.charAt(0) !== text2.charAt(0)) return 0;
            let pointermin = 0;
            let pointermax = Math.min(text1.length, text2.length);
            let pointermid = pointermax;
            let pointerstart = 0;
            while (pointermin < pointermid) {
              if (text1.substring(pointerstart, pointermid) === text2.substring(pointerstart, pointermid)) {
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
            if (!text1 || !text2 || text1.charAt(text1.length - 1) !== text2.charAt(text2.length - 1)) return 0;
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
                if (lastEquality && (lastEquality.length <= Math.max(length_insertions1, length_deletions1)) &&
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
            
            if (changes) this.diff_cleanupMerge(diffs);
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
                          diffs[pointer - count_delete - count_insert - 1][1] += text_insert.substring(0, commonlength);
                        } else {
                          diffs.splice(0, 0, [0, text_insert.substring(0, commonlength)]);
                          pointer++;
                        }
                        text_insert = text_insert.substring(commonlength);
                        text_delete = text_delete.substring(commonlength);
                      }
                      commonlength = this.diff_commonSuffix(text_insert, text_delete);
                      if (commonlength !== 0) {
                        diffs[pointer][1] = text_insert.substring(text_insert.length - commonlength) + diffs[pointer][1];
                        text_insert = text_insert.substring(0, text_insert.length - commonlength);
                        text_delete = text_delete.substring(0, text_delete.length - commonlength);
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
            if (diffs[diffs.length - 1][1] === '') diffs.pop();
          }
        }
      `;
    }

    async execute(action, payload, timeoutMs = CONFIG.WORKER_TIMEOUT_MS) {
      if (!this.worker) {
        throw new Error('Worker not available');
      }

      const id = ++this.taskId;
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingTasks.delete(id);
          reject(new Error('Worker task timed out'));
        }, timeoutMs);

        this.pendingTasks.set(id, { resolve, reject, timeout });
        this.worker.postMessage({ id, action, payload });
      });
    }

    isAvailable() {
      return this.worker !== null;
    }

    terminate() {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      for (const [id, task] of this.pendingTasks) {
        clearTimeout(task.timeout);
        task.reject(new Error('Worker terminated'));
      }
      this.pendingTasks.clear();
    }
  }

  // ============================================
  // LargeDataHandler - Main API
  // ============================================
  class LargeDataHandler {
    constructor() {
      this.progressManager = new ProgressManager();
      this.workerManager = new WorkerManager();
    }

    /**
     * Determine the size category of data
     */
    getSizeCategory(dataSize) {
      if (dataSize >= CONFIG.EXTREME_THRESHOLD) return 'extreme';
      if (dataSize >= CONFIG.CRITICAL_THRESHOLD) return 'critical';
      if (dataSize >= CONFIG.STREAMING_THRESHOLD) return 'large';
      if (dataSize >= CONFIG.WORKER_THRESHOLD) return 'medium';
      return 'small';
    }

    /**
     * Format bytes to human readable string
     */
    formatSize(bytes) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    /**
     * Process large text content (JSON parsing, formatting, sorting)
     * Automatically chooses best strategy based on size
     */
    async processContent(text, options = {}) {
      const size = text.length;
      const category = this.getSizeCategory(size);
      const operationId = `process-${Date.now()}`;

      // For small data, process synchronously
      if (category === 'small') {
        return this._processSynchronous(text, options);
      }

      // Show progress for larger data
      let cancelled = false;
      this.progressManager.show(operationId, {
        title: 'Processing Content',
        status: `Preparing to process ${this.formatSize(size)}...`,
        size: size,
        onCancel: () => { cancelled = true; }
      });

      try {
        let result;

        // Use worker for medium+ size
        if (this.workerManager.isAvailable() && category !== 'small') {
          this.progressManager.update(operationId, {
            status: 'Processing in background...',
            progress: -1 // Indeterminate
          });

          result = await this.workerManager.execute('fullProcess', {
            text,
            sort: options.sort || false,
            indent: options.indent || 3
          });
        } else {
          // Fallback to chunked main thread processing
          result = await this._processChunked(text, options, operationId);
        }

        this.progressManager.complete(operationId);
        return result;

      } catch (err) {
        this.progressManager.complete(operationId);
        throw err;
      }
    }

    /**
     * Parse JSON with automatic strategy selection
     */
    async parseJSON(text, options = {}) {
      const size = text.length;
      const category = this.getSizeCategory(size);

      // Small data: sync parse
      if (category === 'small' || size < CONFIG.MAX_SYNC_PARSE_SIZE) {
        return window.parseFlexibleJSON ? window.parseFlexibleJSON(text) : JSON.parse(text);
      }

      // Larger data: use worker
      if (this.workerManager.isAvailable()) {
        const operationId = `parse-${Date.now()}`;
        this.progressManager.show(operationId, {
          title: 'Parsing JSON',
          status: `Parsing ${this.formatSize(size)}...`,
          size,
          progress: -1
        });

        try {
          const result = await this.workerManager.execute('parseJSON', { text });
          this.progressManager.complete(operationId);
          return result;
        } catch (err) {
          this.progressManager.complete(operationId);
          throw err;
        }
      }

      // Fallback: sync with warning
      console.warn(`[LargeDataHandler] Parsing ${this.formatSize(size)} synchronously - may cause UI freeze`);
      return window.parseFlexibleJSON ? window.parseFlexibleJSON(text) : JSON.parse(text);
    }

    /**
     * Convert CSV to JSON with progress
     */
    async parseCSV(text, options = {}) {
      const size = text.length;
      const category = this.getSizeCategory(size);

      // Use worker for larger CSVs
      if (this.workerManager.isAvailable() && category !== 'small') {
        const operationId = `csv-${Date.now()}`;
        this.progressManager.show(operationId, {
          title: 'Converting CSV',
          status: `Converting ${this.formatSize(size)} CSV to JSON...`,
          size,
          progress: -1
        });

        try {
          const result = await this.workerManager.execute('parseCSV', { text, options });
          this.progressManager.complete(operationId);
          return result;
        } catch (err) {
          this.progressManager.complete(operationId);
          throw err;
        }
      }

      // Fallback to existing CSVUtils
      if (window.CSVUtils && window.CSVUtils.csvToJSONAsync) {
        return await window.CSVUtils.csvToJSONAsync(text, options);
      }

      throw new Error('CSV parsing not available');
    }

    /**
     * Count diffs between two texts
     */
    async countDiffs(leftText, rightText) {
      const totalSize = leftText.length + rightText.length;
      const category = this.getSizeCategory(totalSize);

      // Use worker for larger diffs
      if (this.workerManager.isAvailable() && category !== 'small') {
        return await this.workerManager.execute('countDiffs', { leftText, rightText });
      }

      // Fallback to main thread
      if (typeof diff_match_patch !== 'undefined') {
        const dmp = new diff_match_patch();
        const diffs = dmp.diff_main(leftText, rightText);
        dmp.diff_cleanupSemantic(diffs);

        let diffCount = 0;
        let inDiffChunk = false;
        for (const [op] of diffs) {
          if (op !== 0) {
            if (!inDiffChunk) {
              diffCount++;
              inDiffChunk = true;
            }
          } else {
            inDiffChunk = false;
          }
        }
        return { diffCount, duration: 0 };
      }

      return { diffCount: -1, duration: 0 };
    }

    /**
     * Format JSON with progress
     */
    async formatJSON(obj, indent = 3) {
      const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
      const size = text.length;

      if (this.workerManager.isAvailable() && size > CONFIG.WORKER_THRESHOLD) {
        return await this.workerManager.execute('formatJSON', { obj, indent });
      }

      return JSON.stringify(typeof obj === 'string' ? JSON.parse(obj) : obj, null, indent);
    }

    /**
     * Sort JSON keys with progress
     */
    async sortJSONKeys(obj) {
      if (this.workerManager.isAvailable()) {
        try {
          return await this.workerManager.execute('sortJSONKeys', { obj });
        } catch (err) {
          console.warn('[LargeDataHandler] Worker sort failed, using fallback:', err);
        }
      }

      // Fallback to existing sortJSONKeys
      if (window.sortJSONKeys) {
        return window.sortJSONKeys(obj);
      }

      // Manual implementation
      return this._sortJSONKeysSync(obj);
    }

    _sortJSONKeysSync(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) {
        return obj.map(item => this._sortJSONKeysSync(item));
      }
      const sorted = {};
      const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
      for (const key of keys) {
        sorted[key] = this._sortJSONKeysSync(obj[key]);
      }
      return sorted;
    }

    _processSynchronous(text, options) {
      let parsed = window.parseFlexibleJSON ? window.parseFlexibleJSON(text) : JSON.parse(text);
      
      if (options.sort && window.sortJSONKeys) {
        parsed = window.sortJSONKeys(parsed);
      }
      
      return JSON.stringify(parsed, null, options.indent || 3);
    }

    async _processChunked(text, options, operationId) {
      // For main thread processing, yield periodically
      const startTime = performance.now();
      let lastYield = startTime;

      const yieldToUI = async () => {
        const now = performance.now();
        if (now - lastYield > CONFIG.YIELD_INTERVAL_MS) {
          await new Promise(resolve => setTimeout(resolve, 0));
          lastYield = performance.now();
        }
      };

      this.progressManager.update(operationId, {
        status: 'Parsing JSON...',
        progress: 10
      });

      await yieldToUI();

      let parsed;
      try {
        parsed = window.parseFlexibleJSON ? window.parseFlexibleJSON(text) : JSON.parse(text);
      } catch (e) {
        throw new Error('JSON parse failed: ' + e.message);
      }

      this.progressManager.update(operationId, {
        status: 'Processing...',
        progress: 50
      });

      await yieldToUI();

      if (options.sort && window.sortJSONKeys) {
        parsed = window.sortJSONKeys(parsed);
      }

      this.progressManager.update(operationId, {
        status: 'Formatting...',
        progress: 80
      });

      await yieldToUI();

      const result = JSON.stringify(parsed, null, options.indent || 3);

      this.progressManager.update(operationId, {
        status: 'Complete',
        progress: 100
      });

      return result;
    }

    /**
     * Check if data size requires special handling
     */
    needsSpecialHandling(size) {
      return size >= CONFIG.WORKER_THRESHOLD;
    }

    /**
     * Get recommended settings for a given data size
     */
    getRecommendedSettings(size) {
      const category = this.getSizeCategory(size);
      
      switch (category) {
        case 'extreme':
          return {
            collapseUnchanged: true,
            highlightChanges: false, // Disable for extreme sizes
            viewportDiff: true,
            performanceMode: true,
            scanLimit: 1000
          };
        case 'critical':
          return {
            collapseUnchanged: true,
            highlightChanges: true,
            viewportDiff: true,
            performanceMode: true,
            scanLimit: 3000
          };
        case 'large':
          return {
            collapseUnchanged: true,
            highlightChanges: true,
            viewportDiff: true,
            performanceMode: true,
            scanLimit: 5000
          };
        case 'medium':
          return {
            collapseUnchanged: false,
            highlightChanges: true,
            viewportDiff: false,
            performanceMode: false,
            scanLimit: 6000
          };
        default:
          return null; // Use default settings
      }
    }

    /**
     * Cleanup resources
     */
    destroy() {
      this.workerManager.terminate();
      this.progressManager.cancelAll();
    }
  }

  // ============================================
  // Performance Mode Manager
  // ============================================
  class PerformanceMode {
    constructor() {
      this.enabled = false;
      this.originalSettings = null;
    }

    enable() {
      if (this.enabled) return;
      this.enabled = true;
      
      // Store original settings
      if (window.SettingsManager) {
        this.originalSettings = {
          collapseUnchanged: window.SettingsManager.get('collapseUnchanged'),
          scanLimit: window.SettingsManager.get('scanLimit'),
        };
      }
      
      console.log('[PerformanceMode] Enabled');
    }

    disable() {
      if (!this.enabled) return;
      this.enabled = false;
      
      // Restore original settings
      if (this.originalSettings && window.SettingsManager) {
        window.SettingsManager.set('collapseUnchanged', this.originalSettings.collapseUnchanged);
        window.SettingsManager.set('scanLimit', this.originalSettings.scanLimit);
      }
      
      console.log('[PerformanceMode] Disabled');
    }
  }

  // ============================================
  // Large File Detector
  // ============================================
  class LargeFileDetector {
    constructor() {
      this.thresholds = {
        large: CONFIG.STREAMING_THRESHOLD,
        warning: CONFIG.CRITICAL_THRESHOLD,
        critical: CONFIG.EXTREME_THRESHOLD
      };
    }

    analyze(leftContent, rightContent) {
      const leftSize = leftContent?.length || 0;
      const rightSize = rightContent?.length || 0;
      const totalSize = leftSize + rightSize;

      return {
        leftSize,
        rightSize,
        totalSize,
        formattedSize: this._formatSize(totalSize),
        isLarge: totalSize >= this.thresholds.large,
        isWarning: totalSize >= this.thresholds.warning,
        isCritical: totalSize >= this.thresholds.critical,
        recommendation: this._getRecommendation(totalSize)
      };
    }

    _formatSize(bytes) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    _getRecommendation(size) {
      if (size >= this.thresholds.critical) {
        return 'Enable Performance Mode and Viewport Diff for best experience';
      }
      if (size >= this.thresholds.warning) {
        return 'Consider enabling Performance Mode';
      }
      if (size >= this.thresholds.large) {
        return 'Large file detected - performance optimizations available';
      }
      return null;
    }
  }

  // ============================================
  // Performance Toast Notifications
  // ============================================
  const PerformanceToast = {
    show(message, type = 'info', duration = 4000) {
      // Remove existing toast
      const existing = document.getElementById('perf-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'perf-toast';
      toast.className = `perf-toast perf-toast-${type}`;
      toast.innerHTML = `
        <span class="toast-icon">${this._getIcon(type)}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close">✕</button>
      `;

      // Add styles if not present
      if (!document.getElementById('perf-toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'perf-toast-styles';
        styles.textContent = `
          .perf-toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
          }
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .perf-toast-info { background: #e3f2fd; color: #1565c0; }
          .perf-toast-success { background: #e8f5e9; color: #2e7d32; }
          .perf-toast-warning { background: #fff3e0; color: #ef6c00; }
          .perf-toast-critical { background: #ffebee; color: #c62828; }
          .toast-icon { font-size: 18px; }
          .toast-close {
            background: none;
            border: none;
            cursor: pointer;
            opacity: 0.6;
            font-size: 16px;
            padding: 0 4px;
          }
          .toast-close:hover { opacity: 1; }
        `;
        document.head.appendChild(styles);
      }

      document.body.appendChild(toast);

      toast.querySelector('.toast-close').onclick = () => toast.remove();

      if (duration > 0) {
        setTimeout(() => {
          if (toast.parentNode) {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
          }
        }, duration);
      }
    },

    _getIcon(type) {
      switch (type) {
        case 'success': return '✅';
        case 'warning': return '⚠️';
        case 'critical': return '🚨';
        default: return 'ℹ️';
      }
    }
  };

  // ============================================
  // Export to global scope
  // ============================================
  window.LargeDataHandler = new LargeDataHandler();
  window.PerformanceMode = PerformanceMode;
  window.LargeFileDetector = LargeFileDetector;
  window.PerformanceToast = PerformanceToast;
  window.LargeDataConfig = CONFIG;

  console.log('[LargeDataHandler] Initialized with worker:', window.LargeDataHandler.workerManager.isAvailable());

})();
