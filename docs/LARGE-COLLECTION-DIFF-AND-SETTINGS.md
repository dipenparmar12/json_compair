# Large-collection diffs, settings persistence, snapshot settings

Work log for the three reported issues. Regression data:
`docs/test-cases-example/6-did-not-show-diffs-test-data/{one,two}.csv`
(2,000 records × 158 columns, ~1.2 MB each).

---

## 1. "The entire collection is reported as one diff"

### What the data actually contains

Measured independently of the app, so the expected answer was known before any fix:

| | |
|---|---|
| Records | 2,000 on both sides |
| Columns | 158 (left) vs 157 (right) — `ProjectValue` is missing from `two.csv` |
| Records differing | 2,000 |
| Field-level changes | **6,370** |

Per-field breakdown: `UUID` 2,000 · `ModelPath` 2,000 (`\` vs `/`) · `ProjectValue` 2,000
(left-only) · `ModelMatchDistance` 173 · `BlockVolume` 102 · `Height` 70 ·
`HVACHeatingDetail` 25.

### Root cause

Not a threshold in this codebase — a hard bail inside `@codemirror/merge` 6.7.2. The applied
limit is `scanLimit >> 1`, and `findSnake()` gives up on **absolute character counts**:

```js
if (scanLimit < 1e9 && Math.min(lenA, lenB) > scanLimit * 16) {
    if (Math.min(lenA, lenB) > scanLimit * 64)
        return [new Change(fromA, toA, fromB, toB)];   // ONE change spanning everything
    return crudeMatch(a, fromA, toA, b, fromB, toB);
}
```

Verified against the real library (`diff()` extracted and run over the actual data):

| Records | Combined size | scanLimit 6000 (the app default) | scanLimit 60000 |
|--:|--:|--|--|
| 6 | 0.06 MB | 80 changes ✅ | 80 changes |
| 50 | 0.47 MB | **1 change** ❌ | 685 changes |
| 200 | 1.52 MB | **1 change** ❌ | 2,785 changes |

That is exactly the report: correct for the first 6–10 records, one giant diff for the full
dataset. It already breaks at **50** records.

The app made this worse. `clampScanLimit()` *lowered* scanLimit as content grew
(≤2 MB → 10000, ≤8 MB → 6000, >8 MB → 4000), steering every large input into the bail branch.
No scanLimit value works for a multi-MB pair: too low bails, too high freezes (Myers is
synchronous and O(ND)).

A previous attempt (`alignArrayOneLine`, commit `f45e332`) put each record on **one compact
line** to shrink the line count. That stopped the freeze but made a 158-field record a single
4,000-character line — so field-level differences became invisible, which is the other half of
the report ("we should see what the field level difference is in its items").

### Fix — stop asking CodeMirror to *find* the differences

`v6/utils/json_align.js` now does the matching and the diff itself, and only hands CM6 a
document small enough for its own diff to stay accurate.

1. **`matchArray()` — pair records ourselves.**
   - `'id'`: `detectIdKey()` finds a field whose values are unique on *both* sides **and**
     overlap heavily between them. Uniqueness alone is not enough — here both sides have unique
     `UUID`s but every one was regenerated (0 % overlap, useless as an anchor), while
     `ParcelNumberRaw` / `ATTOMId` / `PropertyAddressFull` overlap 100 %. Anchors are the
     longest increasing subsequence over those ids (patience diff, O(n log n)).
   - `'lcs'`: exact LCS for small arrays, where it is optimal and cheap. Identity is not guessed
     below 4 items — on a handful of elements almost any field looks unique.
   - `'hash'`: content-hash anchors + positional gap fill.

   This replaced an O(n·m) DP that allocated a 16 MB `Uint32Array` at 2,000×2,000 and was
   skipped entirely above 1 M cells (falling back to blind positional pairing).

2. **`buildModel()` — the authoritative item + field diff.** Per item:
   `{status, changed[], onlyA[], onlyB[]}`, plus totals and a field histogram. Exact at any
   size, independent of rendering. ~0.5 s on the 2,000-record pair.

3. **`linkMoves()` — field diffs for records that moved.** Rendering must stay
   order-preserving, because each pane has to hold that side's records in that side's real
   order; a reordered pane would no longer contain the user's document. So a record that moves
   far renders as a removal plus an addition. That is right for layout and wrong for reporting,
   so moves are detected by identity and reported as `moved` **with their real field diff**,
   without touching the layout.

4. **`renderArray()` — bound what CM6 must diff.** Above 800 KB combined, render a *window* of
   records at full fidelity (pretty-printed, field per line); page size is derived from the
   average record size. The pane holds a real, complete, valid-JSON slice. Below the threshold
   everything is pretty-printed exactly as before.

5. **`clampScanLimit()` inverted.** For aligned content, scanLimit is *raised* to what the
   rendered document needs; the user's value is a minimum, not a cap. Three details matter:
   - **Aim past both thresholds.** Clearing only the `*64` cliff leaves CM6 in `crudeMatch`,
     whose repeated `indexOf` over the whole range is wildly variable — measured 148 ms for a
     4,800-line page but **12 s** for a 2,400-line one. The floor is `minSide/7`, which puts
     `min(lenA,lenB)` under `scanLimit*8` and gets full Myers. On line-aligned content Myers is
     cheap and predictable: its cost tracks the *number of differences*, not document size.
     This single change took page turns from ~2–6.7 s to **~100 ms**.
   - **Only raise on a bounded document** (`SCAN_RAISE_MAX_BYTES`, 3 MB). Past that no scanLimit
     is both accurate and affordable, so the low protective cap stays and CM6 bails out cheaply.
   - **Keep it low across the two-dispatch transition.** Writing both panes is two dispatches and
     CM6 re-diffs on each, so there is a moment where one side is the new window and the other is
     still the old multi-MB document. A limit raised for the *final* size turned that moment into
     full Myers on 300 KB vs 10 MB — a hard lock. The limit is lowered before the writes and
     raised after; CM6 re-diffs on the reconfigure, so only one cheap diff is wasted.

6. **`prepare()` — parse once, render many windows.** Paging re-ran the whole pipeline per page:
   re-parsing ~20 MB of text and rebuilding the match and model every time Next was pressed.
   None of that depends on the window. `JSONAlign.prepare()` returns a handle holding the parsed
   pair + match + model, and paging just calls `handle.render({from})` (measured 41 ms initial,
   3 ms per subsequent page).

### Result on the reported dataset

| | Before | After |
|---|---|---|
| Status bar | `1 changed block` | `2,000 changed of 2,000 items · 6,370 field changes` |
| CM6 chunks | 1 | ~857 per page (real field-level chunks) |
| Highlighting | whole record marked changed | only the differing fields |
| Rendered per pane | 7.9 MB / one line per record | 300 KB / 61 records, pretty |
| Records compared | ~1,390 (rest silently dropped) | 2,000 |
| Page turn | n/a | ~100 ms |

`MAX_RENDER_CELLS_PER_PANEL` was raised 220 k → 2 M. It used to bound what MergeView had to
render, which meant *dropping rows* — the 2,000 × 158 export was silently cut to ~1,390 rows and
those rows were never compared at all. Rendering is now bounded by the record window instead.

### New UI

- **Record pager** — `1–61 of 2,000` with prev/next, shown only when the render is windowed.
- **Details panel** — field histogram plus every changed / added / removed / moved item,
  filterable, click an item to jump to it. Reads the model, so it describes the whole dataset,
  not the visible page.
- **Honest degraded state** — when CM6 does bail (e.g. two raw 1.2 MB CSVs that are not JSON),
  the status says *"Too large to compare precisely — use CSV→JSON so records can be matched
  individually"* rather than printing a meaningless `1 changed block`.

### Paging safety — two bugs found while verifying

While a window is showing, `_ignorePristine` holds the untransformed pair.
`applyBlockAlignment()` and `gotoRecordPage()` re-align **from that**, never from the panes —
re-aligning a window would window a window and lose the rest of the data.

Verification in the browser then turned up two problems that only exist *because* the panes can
now hold less than the whole document:

- **A window could be persisted as the user's data (data loss).** The autosave listener drops
  `_ignorePristine` on any doc change that is not ours — including the user typing while a page
  is displayed. `saveContent()` would then persist the panes, i.e. 61 records standing in for
  2,000, and the rest would be gone on reload. (It bit this very test: a stale 60-record window
  in localStorage made a later comparison report "61 changed, 1,939 added".) `saveContent()` now
  refuses to write when the panes are a truncated view and no complete snapshot exists.
- **The autosave size guard measured the wrong thing.** It compared `AUTOSAVE_MAX_BYTES` against
  the *panes*, then wrote `_ignorePristine`. With a window showing that is a ~600 KB measurement
  guarding a 20 MB synchronous write — straight past the 4 MB limit, on every debounced change.
  It now sizes the guard against whatever will actually be written, and only materializes the
  strings once it knows they are small enough.

---

## 2. Settings not persisting

Round-tripped all 19 controls through a reload. Two genuine failures, plus one latent
inconsistency:

- **`blockDiff` reverted on every reload.** `loadMergeSettings()` did not return it, so
  `settings.blockDiff` was `undefined` at restore time and `undefined !== false` re-enabled it.
  The stored value had been correct all along — nothing read it.
- **`collapseUnchanged` turned itself back on.** `applyProactivePosture()` (large paste → force
  collapse for the first render) called `SettingsManager.set('collapseUnchanged', true)`,
  promoting a one-off render decision to a permanent preference. It now flips only the live view
  and sets `_collapseForcedBySize`; `applyMergeSettings()` keeps persisting the *stored* value
  while that flag is set, and touching either collapse control clears it.
- **Two keys for one setting.** `defaults` declared `autoFormatJson` / `autoSortKeys` while all
  the code read and wrote `autoFormat` / `autoSort`, so the intended "auto-format on" default
  never applied and storage carried both names with disagreeing values.

All 19 controls now round-trip: word wrap, scroll lock, auto CSV / format / sort, block diff,
highlight, gutter, collapse, performance mode, viewport diff, orientation, revert controls, scan
limit, theme, ignore scope, ignore styling, numeric tolerance on/off and value.

---

## 3. Snapshot exports now restore the comparison

`ZipSnapshotManager` already carried `settings.json`, and import already wrote it to
localStorage — but only `wordWrap`, `scrollLock` and `theme` were turned back into live state.
Everything that decides what the diff actually *says* — ignore patterns, ignore scope and
styling, numeric tolerance, block diff — was stored and never applied, so a reopened snapshot
did not reproduce.

`applyComparisonSettings()` re-derives all of it, resets the align memo and pristine snapshot,
re-syncs the ignore/tolerance inputs, re-runs the transform and re-counts. It is called from
both ZIP import sites; the URL-share path already re-derives during startup. Settings are
written with a single `saveAll()` instead of one `set()` round-trip per key.

Verified by exporting a real ZIP with ignore `UUID`, scope `key`, tolerance `0.5`, scan limit
`7700`, clearing localStorage, and importing through the app's own file input: all four come
back in both storage **and** the live controls, with the ignore chip rendered.

---

## Files touched

| File | Change |
|---|---|
| `v6/utils/json_align.js` | Rewritten: identity/patience/LCS record matching, `diffModel()`, move linking, windowed rendering |
| `v6/index.html` | scanLimit inverted + `syncDiffConfig()`; model-driven status; record pager; details panel; settings-persistence fixes; `applyComparisonSettings()` |
| `v6/css/app.css` | Pager, details panel, degraded-status styling |
| `v6/utils/utils.js` | `defaults` key names matched to their readers |
| `CLAUDE.MD` | Diff Engine §2, §3, §9/10 rewritten; settings-persistence rules added |

## Tests

18 engine tests (`json_align` in isolation): basics, invalid input, changed/added/removed,
reorder-with-edits pairing by identity, small arrays not guessing identity, ignore, numeric
tolerance, `normalize()`, round-trip to source values, gap padding, windowed-slice exactness,
nested arrays. Browser verification covered the raw-CSV path, the CSV→JSON path, paging,
filtering, jump-to-item, all six built-in templates, and the settings/snapshot round-trips.
