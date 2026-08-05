/* ====================================================================
   progress.js — processing feedback, ETA and cancellation for long runs
   --------------------------------------------------------------------
   Large comparisons take seconds: CSV parsing, record matching, the
   field-level model, then CodeMirror's own diff. Individually each step
   is fast; together, on a big dataset, they add up to long enough that a
   silent UI is indistinguishable from a frozen tab.

   This module owns two things:

     1. A non-blocking status panel — current phase, determinate progress,
        records done/total, elapsed, a smoothed ETA, and a Cancel button.
        It deliberately does NOT cover the editors and does not trap input.

     2. A cancellation token that long-running work checks cooperatively.
        Work that cannot be interrupted from the outside (a synchronous
        loop in a Worker) is cancelled by tearing the Worker down instead;
        see cancelWorker() in index.html.

   Nothing here knows what the work IS — callers declare their phases with
   relative weights up front, so the overall bar stays honest across a
   pipeline whose steps have very different costs.

   The panel only appears after SHOW_DELAY_MS. Most comparisons finish
   well inside that, and a progress bar that flashes for 80ms is worse
   than no progress bar at all.

   Exposes window.ProcessingUI, window.CancelledError, window.yieldToUI.
   ==================================================================== */
(function () {
  'use strict';

  // Below this, showing progress is noise — the work is already done.
  var SHOW_DELAY_MS = 400;
  // Don't quote an ETA until there is enough signal for it to mean anything.
  var ETA_MIN_ELAPSED_MS = 600;
  var ETA_MIN_FRACTION = 0.02;
  // Exponential smoothing on the ETA: raw remaining-time estimates jump around
  // as phases change cost, and a number that flickers reads as broken.
  var ETA_SMOOTHING = 0.25;

  function CancelledError(message) {
    this.name = 'CancelledError';
    this.message = message || 'Operation cancelled';
    this.cancelled = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, CancelledError);
  }
  CancelledError.prototype = Object.create(Error.prototype);
  CancelledError.prototype.constructor = CancelledError;

  function isCancelled(err) {
    return !!(err && (err.name === 'CancelledError' || err.cancelled));
  }

  /**
   * Hand control back to the browser so it can paint and process input.
   *
   * A plain setTimeout(0) is clamped to ~4ms once nested, which is a heavy tax
   * when a loop yields often. requestAnimationFrame paints but never fires in a
   * background tab, which would hang the pipeline outright. Racing a message
   * channel against a timeout gives us a real macrotask in both cases.
   */
  var _mc = typeof MessageChannel === 'function' ? new MessageChannel() : null;
  var _yieldQueue = [];
  if (_mc) {
    _mc.port1.onmessage = function () {
      var fn = _yieldQueue.shift();
      if (fn) fn();
    };
  }
  function yieldToUI() {
    return new Promise(function (resolve) {
      if (_mc) {
        _yieldQueue.push(resolve);
        _mc.port2.postMessage(0);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  // Yield in a way that also lets the browser PAINT (a MessageChannel task can
  // run before the next frame, so a bar updated that way may never be drawn).
  // Used at phase boundaries, where one extra frame is cheap.
  function yieldToPaint() {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (!done) { done = true; resolve(); } };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { setTimeout(finish, 0); });
      setTimeout(finish, 32);   // hidden tabs never get a frame
    });
  }

  function fmtNum(n) {
    return Number(n || 0).toLocaleString();
  }

  function fmtDuration(ms) {
    if (!isFinite(ms) || ms < 0) return '';
    var s = Math.round(ms / 1000);
    if (s < 1) return 'under a second';
    if (s < 60) return '~' + s + ' second' + (s === 1 ? '' : 's');
    var m = Math.floor(s / 60), rest = s % 60;
    if (m < 60) return '~' + m + ' min' + (rest ? ' ' + rest + ' s' : '');
    return '~' + Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }

  function fmtElapsed(ms) {
    var s = ms / 1000;
    return s < 10 ? s.toFixed(1) + 's' : Math.round(s) + 's';
  }

  function memoryNote() {
    try {
      var m = performance.memory;
      if (!m || !m.usedJSHeapSize) return '';
      return (m.usedJSHeapSize / 1048576).toFixed(0) + ' MB heap';
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------------ */
  /* Panel                                                               */
  /* ------------------------------------------------------------------ */

  var el = null;   // cached DOM refs

  function buildPanel() {
    if (el) return el;
    var root = document.createElement('div');
    root.className = 'proc-panel';
    root.id = 'processing-panel';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="proc-row proc-head">' +
        '<span class="proc-spinner" aria-hidden="true"></span>' +
        '<span class="proc-title"></span>' +
        '<button type="button" class="proc-cancel" title="Stop processing">Cancel</button>' +
      '</div>' +
      '<div class="proc-phase"></div>' +
      '<div class="proc-track"><div class="proc-fill"></div></div>' +
      '<div class="proc-row proc-meta">' +
        '<span class="proc-count"></span>' +
        '<span class="proc-eta"></span>' +
      '</div>';
    document.body.appendChild(root);
    el = {
      root: root,
      title: root.querySelector('.proc-title'),
      phase: root.querySelector('.proc-phase'),
      fill: root.querySelector('.proc-fill'),
      count: root.querySelector('.proc-count'),
      eta: root.querySelector('.proc-eta'),
      cancel: root.querySelector('.proc-cancel'),
      track: root.querySelector('.proc-track'),
    };
    el.track.setAttribute('role', 'progressbar');
    el.track.setAttribute('aria-valuemin', '0');
    el.track.setAttribute('aria-valuemax', '100');
    return el;
  }

  function hidePanel() {
    if (el) el.root.classList.remove('is-visible');
  }

  /* ------------------------------------------------------------------ */
  /* Job                                                                 */
  /* ------------------------------------------------------------------ */

  var current = null;

  /**
   * @param {object} opts
   *   title    {string}  headline, e.g. "Comparing datasets"
   *   phases   {Array}   [{ key, label, weight }] — weights are relative and
   *                      only affect how the overall bar apportions itself.
   *   onCancel {function}
   */
  function start(opts) {
    opts = opts || {};
    // The newest job owns the panel, but the previous one keeps running (and
    // keeps its cancellation path) — see job.detach().
    if (current) current.detach();

    var phases = (opts.phases || []).map(function (p) {
      return { key: p.key, label: p.label, weight: p.weight > 0 ? p.weight : 1 };
    });
    if (!phases.length) phases = [{ key: 'work', label: 'Processing', weight: 1 }];
    var totalWeight = phases.reduce(function (s, p) { return s + p.weight; }, 0);

    var job = {
      title: opts.title || 'Processing',
      startedAt: (performance && performance.now) ? performance.now() : Date.now(),
      phases: phases,
      phaseIndex: -1,
      done: 0,
      total: 0,
      note: '',
      cancelled: false,
      finished: false,
      _baseIndex: null,
      _eta: null,
      _cancelHandlers: opts.onCancel ? [opts.onCancel] : [],
      _showTimer: null,
      _visible: false,
      _rafPending: false,
    };

    job.signal = {
      get cancelled() { return job.cancelled; },
      throwIfCancelled: function () {
        if (job.cancelled) throw new CancelledError();
      },
    };

    job.onCancel = function (fn) {
      if (typeof fn === 'function') job._cancelHandlers.push(fn);
      return job;
    };

    job.now = function () {
      return ((performance && performance.now) ? performance.now() : Date.now()) - job.startedAt;
    };

    // Relative position through the whole pipeline, 0..1.
    //
    // Measured from the FIRST phase this job actually entered, not from the
    // start of the declared list: a JSON paste skips the CSV phase entirely,
    // and a bar that opens at 20% because of a step that will never run reads
    // as broken. Phases are declared in order, so everything from the first
    // one entered onwards is this job's real work.
    job.fraction = function () {
      if (job.phaseIndex < 0) return 0;
      var base = job._baseIndex == null ? 0 : job._baseIndex;
      var before = 0, span = 0, i;
      for (i = base; i < job.phaseIndex; i++) before += job.phases[i].weight;
      for (i = base; i < job.phases.length; i++) span += job.phases[i].weight;
      if (span <= 0) span = totalWeight;
      var cur = job.phases[job.phaseIndex];
      var within = job.total > 0 ? Math.min(1, job.done / job.total) : 0;
      return Math.min(1, (before + cur.weight * within) / span);
    };

    job.phase = function (key, note) {
      var idx = -1;
      for (var i = 0; i < phases.length; i++) if (phases[i].key === key) { idx = i; break; }
      if (idx < 0) return job;
      if (job._baseIndex == null) job._baseIndex = idx;
      job.phaseIndex = idx;
      job.done = 0; job.total = 0;
      job.note = note || '';
      job._render();
      return job;
    };

    job.update = function (done, total, note) {
      job.done = done || 0;
      if (total != null) job.total = total;
      if (note != null) job.note = note;
      job._render();
      return job;
    };

    job.cancel = function () {
      if (job.cancelled || job.finished) return;
      job.cancelled = true;
      var hs = job._cancelHandlers.slice();
      for (var i = 0; i < hs.length; i++) {
        try { hs[i](); } catch (e) { console.warn('[progress] cancel handler failed', e); }
      }
      job.finish();
    };

    // Give up the panel WITHOUT ending the job. Two panes can ingest at once,
    // and the newer one takes over the display — but the older one is still
    // doing real work and must stay cancellable. Conflating the two is how a
    // pane kept processing after the user pressed Cancel.
    job.detach = function () {
      clearTimeout(job._showTimer);
      job._visible = false;
      if (current === job) current = null;
    };

    job.finish = function () {
      if (job.finished) return;
      job.finished = true;
      var owned = (current === job);
      job.detach();
      // Only pull the panel down if nothing else has claimed it meanwhile.
      if (owned && !current) hidePanel();
    };

    // Repaints are coalesced to one per frame: a chunked loop can call update()
    // thousands of times a second and layout is not free.
    job._render = function () {
      if (job.finished) return;
      if (!job._visible) return;
      if (job._rafPending) return;
      job._rafPending = true;
      var paint = function () {
        job._rafPending = false;
        if (job.finished || !job._visible) return;
        job._paint();
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(paint);
      else setTimeout(paint, 16);
    };

    job._paint = function () {
      var d = buildPanel();
      var frac = job.fraction();
      var elapsed = job.now();

      d.title.textContent = job.title;
      d.phase.textContent = job.phases[job.phaseIndex] ? job.phases[job.phaseIndex].label : 'Processing';
      d.fill.style.width = (frac * 100).toFixed(1) + '%';
      d.track.setAttribute('aria-valuenow', String(Math.round(frac * 100)));

      var count = job.note;
      if (!count && job.total > 0) count = fmtNum(job.done) + ' / ' + fmtNum(job.total);
      var mem = memoryNote();
      d.count.textContent = count + (count && mem ? ' · ' : '') + mem;

      // ETA only once the estimate has something to stand on.
      var etaText = '';
      if (frac >= ETA_MIN_FRACTION && elapsed >= ETA_MIN_ELAPSED_MS && frac < 1) {
        var raw = elapsed / frac - elapsed;
        job._eta = job._eta == null ? raw : job._eta + ETA_SMOOTHING * (raw - job._eta);
        etaText = fmtDuration(job._eta) + ' left';
      }
      d.eta.textContent = (etaText ? etaText + ' · ' : '') + fmtElapsed(elapsed) + ' elapsed';
    };

    job._show = function () {
      var d = buildPanel();
      d.cancel.onclick = function () { job.cancel(); };
      job._visible = true;
      d.root.classList.add('is-visible');
      job._paint();
    };

    job._showTimer = setTimeout(function () {
      if (!job.finished) job._show();
    }, opts.showDelayMs != null ? opts.showDelayMs : SHOW_DELAY_MS);

    current = job;
    return job;
  }

  window.CancelledError = CancelledError;
  window.yieldToUI = yieldToUI;
  window.ProcessingUI = {
    start: start,
    active: function () { return current; },
    isCancelled: isCancelled,
    yieldToUI: yieldToUI,
    yieldToPaint: yieldToPaint,
    CancelledError: CancelledError,
  };
})();
