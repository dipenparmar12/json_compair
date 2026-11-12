// In-page measurement harness (loaded only into the frozen copy of the app).
(function () {
  const H = window.__h = { calls: {}, tasks: [], results: {} };
  const rec = (name, ms) => {
    const c = H.calls[name] || (H.calls[name] = { n: 0, ms: 0, max: 0 });
    c.n++; c.ms += ms; if (ms > c.max) c.max = ms;
  };
  const wrap = (obj, key, name) => {
    const orig = obj[key];
    obj[key] = function () {
      const t = performance.now();
      try { return orig.apply(this, arguments); }
      finally { const d = performance.now() - t; if (d >= 1) rec(name, d); }
    };
  };
  wrap(JSON, 'parse', 'JSON.parse');
  wrap(JSON, 'stringify', 'JSON.stringify');
  wrap(Worker.prototype, 'postMessage', 'worker.postMessage (clone to worker)');
  wrap(Storage.prototype, 'setItem', 'localStorage.setItem');
  wrap(String.prototype, 'trim', 'String.trim');
  wrap(String.prototype, 'split', 'String.split');
  wrap(String.prototype, 'replace', 'String.replace');
  H.patchEditors = function () {
    const mv = window.__bench.mergeView;
    if (mv.__patched) return; mv.__patched = true;
    wrap(mv.a, 'dispatch', 'editor.dispatch left');
    wrap(mv.b, 'dispatch', 'editor.dispatch right');
    wrap(mv, 'reconfigure', 'mergeView.reconfigure');
    let proto = Object.getPrototypeOf(mv.a.state.doc);
    while (proto && !Object.prototype.hasOwnProperty.call(proto, 'toString')) proto = Object.getPrototypeOf(proto);
    if (proto && !proto.__p) { proto.__p = 1; wrap(proto, 'toString', 'doc.toString'); }
    for (const k of ['align', 'prepare', 'normalize', 'diffModel']) wrap(window.JSONAlign, k, 'JSONAlign.' + k);
    wrap(window.JSONRepairKit, 'repair', 'JSONRepairKit.repair');
    wrap(window.JSONRepairKit, 'analyze', 'JSONRepairKit.analyze');
    wrap(window.JSONRepairKit, 'detectKind', 'JSONRepairKit.detectKind');
  };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) H.tasks.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  // Heartbeat: gaps between 20 ms ticks = time the main thread could not respond.
  let last = performance.now(); H.gaps = [];
  setInterval(() => { const n = performance.now(); if (n - last > 120) H.gaps.push(Math.round(n - last)); last = n; }, 20);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const heap = () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  H.fetchText = async (url) => { const t = performance.now(); const r = await fetch(url); const s = await r.text(); return { text: s, ms: Math.round(performance.now() - t) }; };
  H.fetchFile = async (url, name) => { const r = await fetch(url); const b = await r.blob(); return new File([b], name); };
  H.busy = () => (document.getElementById('diff-summary') || {}).dataset?.state === 'busy';
  H.settle = async (quietMs = 1500, maxMs = 600000) => {
    const t0 = performance.now(); let lastN = -1, quietSince = performance.now();
    while (performance.now() - t0 < maxMs) {
      await sleep(250);
      const n = H.tasks.length + H.gaps.length;
      if (n !== lastN || H.busy()) { lastN = n; quietSince = performance.now(); }
      else if (performance.now() - quietSince > quietMs) break;
    }
  };
  H.run = async (name, fn) => {
    H.patchEditors();
    H.calls = {}; H.tasks = []; H.gaps = [];
    let peak = heap();
    const pk = setInterval(() => { const h = heap(); if (h > peak) peak = h; }, 100);
    const t0 = performance.now(); let err = null, tFn = 0;
    try { await fn(); tFn = Math.round(performance.now() - t0); await H.settle(); } catch (e) { err = String(e && e.message || e); }
    clearInterval(pk);
    const calls = Object.entries(H.calls).map(([k, v]) => ({ call: k, n: v.n, totalMs: Math.round(v.ms), maxMs: Math.round(v.max) }))
      .filter((c) => c.maxMs >= 30).sort((a, b) => b.totalMs - a.totalMs).slice(0, 8);
    const gaps = H.gaps.slice().sort((a, b) => b - a);
    const b = window.__bench, mv = b.mergeView, st = b.diffStats || {};
    const res = H.results[name] = {
      fnMs: tFn, wallMs: Math.round(performance.now() - t0) - 1500, err,
      blockedTotalMs: gaps.reduce((s, x) => s + x, 0), longestBlocks: gaps.slice(0, 5),
      calls, heapMB: heap(), peakHeapMB: peak,
      paneMB: [mv.a.state.doc.length, mv.b.state.doc.length].map((n) => Math.round(n / 104857.6) / 10),
      pristineMB: b.pristine ? Math.round((b.pristine.left.length + b.pristine.right.length) / 104857.6) / 10 : null,
      status: (document.getElementById('diff-summary') || {}).textContent.trim().slice(0, 90),
      view: st.view, itemsTotal: st.itemsTotal, truncated: st.truncated,
      notices: [...document.querySelectorAll('.notice, .toast')].map((n) => n.textContent.trim().slice(0, 110)).slice(0, 3)
    };
    return res;
  };
  H.ready = true;
})();
