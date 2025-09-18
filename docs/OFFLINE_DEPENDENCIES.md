Offline dependency instructions

This project can work offline by placing the following vendor files into `./js/`:

1) PapaParse (CSV parser)
   - Recommended file: js/papaparse.min.js
   - CDN: https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js

2) Oboe (streaming JSON parser)
   - Recommended file: js/oboe-browser.min.js
   - Example CDN: https://unpkg.com/oboe@2.1.5/dist/oboe-browser.min.js

3) (Optional) json-bigint (if you need to preserve large integers)
   - Example CDN: https://cdn.jsdelivr.net/npm/json-bigint@0.3.0/dist/json-bigint.min.js

How to fetch and save locally (macOS / zsh):

```bash
# from project root
mkdir -p js
curl -L -o js/papaparse.min.js https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js
curl -L -o js/oboe-browser.min.js https://unpkg.com/oboe@2.1.5/dist/oboe-browser.min.js
# optional
curl -L -o js/json-bigint.min.js https://cdn.jsdelivr.net/npm/json-bigint@0.3.0/dist/json-bigint.min.js
```

If you save these files locally, the app will prefer the local copies and run fully offline. The index.html also attempts to load CDNs when local files are not present, for convenience during development.

Notes:
- Keep versions updated if you rely on bug fixes; update the URLs in `index.html` as needed.
- PapaParse supports `worker: true` when parsing strings, making CPU-heavy CSV parsing run in a background thread.
- Oboe is useful for streaming JSON parsing and processing large arrays item-by-item to avoid high memory usage.
