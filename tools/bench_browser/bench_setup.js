(function () {
  const H = window.__h, b = window.__bench;
  window.confirm = () => true;
  window.__errs = [];
  window.addEventListener('error', (e) => window.__errs.push(String(e.message).slice(0, 80)));
  window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej: ' + String(e.reason && e.reason.message || e.reason).slice(0, 80)));
  window.__sum = (o) => {
    if (!o || typeof o !== 'object') return o; const s = {};
    for (const k of Object.keys(o)) {
      const r = o[k]; if (!r || typeof r !== 'object' || Array.isArray(r)) { s[k] = r; continue; }
      s[k] = `fn ${r.fnMs} wall ${r.wallMs} blocked ${r.blockedTotalMs} top[${r.longestBlocks}] heap ${r.heapMB}/${r.peakHeapMB} panes ${r.paneMB} pristine ${r.pristineMB} view ${r.view} items ${r.itemsTotal} | ${r.status} | ${r.calls.map((c) => c.call + ' x' + c.n + ' ' + c.totalMs + '/' + c.maxMs).join('; ')} | ${r.notices.join(' // ')} ${r.err || ''}`;
    }
    return s;
  };
  window.__ladder = async (n, ext = 'csv', steps = 'left,right,page,replaceLeft,clear') => {
    const base = '/.outputs/bench/' + n; const out = {}; window.__errs.length = 0;
    await b.clearPanels(); await H.settle(800);
    let A = await H.fetchText(base + '_a.' + ext), B = await H.fetchText(base + '_b.' + ext);
    out.fetchMs = [A.ms, B.ms]; out.inMB = Math.round((A.text.length + B.text.length) / 104857.6) / 10;
    const want = (s) => steps.includes(s);
    if (want('left')) out.left = await H.run(n + ':left', () => b.ingestContent(A.text, 'left', {}));
    if (want('right')) out.right = await H.run(n + ':right', () => b.ingestContent(B.text, 'right', {}));
    if (want('page') && b.diffStats && b.diffStats.truncated) out.page = await H.run(n + ':page', async () => { b.gotoRecordPage((b.diffStats.to || 0)); });
    if (want('replaceLeft')) out.replaceLeft = await H.run(n + ':replaceLeft', () => b.ingestContent(B.text, 'left', {}));
    if (want('race')) out.race = await H.run(n + ':race', async () => { const p = b.ingestContent(A.text, 'left', {}); await new Promise((r) => setTimeout(r, 300)); const q = b.ingestContent(B.text, 'right', {}); await Promise.all([p, q]); });
    if (want('all')) out.all = await H.run(n + ':convertAll', async () => { await window.__ingestConvertAll('left'); });
    A = B = null;
    if (want('clear')) out.clear = await H.run(n + ':clear', () => b.clearPanels());
    out.errs = window.__errs.slice(0, 3).join(' // ') + ' (' + window.__errs.length + ')'; return out;
  };
  window.__go = (n, ext, steps) => { window.__done = null; window.__ladder(n, ext, steps).then((o) => window.__done = o, (e) => window.__done = { err: String(e) }); };
  window.__poll = async (s) => {
    for (let i = 0; i < s && !window.__done; i++) await new Promise((r) => setTimeout(r, 1000));
    return JSON.stringify(window.__sum(window.__done) || { pending: 1, results: Object.keys(H.results).slice(-3), gaps: H.gaps.slice(-6), errs: window.__errs.slice(-2), heap: Math.round(performance.memory.usedJSHeapSize / 1048576), status: document.getElementById('diff-summary').textContent.trim().slice(0, 80) }, null, 1);
  };
})();
