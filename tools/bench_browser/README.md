# Browser benchmark harness

Measures the full ingest path of v6 in a real tab: wall time, how long the main
thread was blocked, which calls blocked it, and JS heap. Used for
`docs/PRD/16-large-dataset-phase1-findings.md`.

It runs against a frozen copy of the app, so the working tree can keep changing.

1. Generate data into `.outputs/bench/` (git-ignored) with `tools/gen_dataset.js`.
2. Copy the app and the two scripts:
   `git archive HEAD v6 | tar -x -C .outputs/bench/app` then copy `bench_page.js`
   and `bench_setup.js` into `.outputs/bench/app/v6/`.
3. In the copy's `index.html`, just before the last `initializeApp();`, add:
   ```js
   window.__bench = { ingestContent, clearPanels, handleFileDrop, applyImportedSnapshot,
     getDocumentPair, saveContent, gotoRecordPage, cancelAllProcessing,
     get mergeView(){return mergeView}, get diffStats(){return diffStats},
     get diffModel(){return diffModel}, get pristine(){return _ignorePristine} };
   ```
4. Serve the repo root (`py -m http.server 8770 --bind 127.0.0.1`) and open
   `http://localhost:8770/.outputs/bench/app/v6/index.html`.
5. In the console, load `./bench_page.js` then `./bench_setup.js` (script tags), then:
   ```js
   __go('csv10', 'csv', 'left,right,page,replaceLeft,race,clear');  // name, ext, steps
   await __poll(60);   // JSON summary; "pending" until the run settles
   ```
   Steps: `left`, `right`, `page`, `replaceLeft`, `race` (both sides at once),
   `all` ("Convert all anyway" on the left), `clear`.

Reading a result line: `fn` = time until the call returned, `blocked` = total ms a
20 ms timer could not fire, `top[…]` = longest freezes, `heap now/peak` in MB
(main thread only), then the calls that took ≥ 30 ms as `name xCount total/max`.
