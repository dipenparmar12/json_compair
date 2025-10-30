🧩 Concept

A split diff (side-by-side diff) shows two versions of the same file:
	•	Left = Before
	•	Right = After

Each line aligns vertically.
If a line exists only on one side, the other side shows an empty placeholder so the layout stays perfectly aligned.

⸻

🎨 Visual Markings

Change Type	Color/Style	Meaning
Deleted	🔴 Red background (left side)	Line existed before, now gone
Added	🟢 Green background (right side)	Line didn’t exist before, now added
Unchanged	⚪ No highlight	Appears in both versions
Placeholder	⚫ Hatched/striped block	Keeps alignment where the other side has no line


⸻

🧠 How It Works

Imagine two parallel lists of text lines.
Each “diff hunk” (a group of changes) aligns by inserting invisible placeholders where lines don’t match.

LEFT (Original)                      RIGHT (Modified)
──────────────────────────────────   ──────────────────────────────────
1  {                                 1  {
2  "theme": "dark",      [-RED-]     2  "theme": "light",      [+GREEN+]
3  "users": [                        3  "users": [
4    { "id": 1, "name": "Alice" }    4    { "id": 1, "name": "Alice" },
5    { "id": 2, "name": "Bob" },     5    { "id": 3, "name": "Charlie" }
6    { "id": 2, "name": "Bob" }      6  ]
7  ]                                 7  }

On screen:
	•	Lines 5–6 (Bob duplicates) are highlighted red on the left.
	•	Line 5 on the right (“Charlie”) is green.
	•	To keep rows aligned, the right panel shows empty hatched blocks opposite the deleted “Bob” lines.

⸻

🧩 Empty Block Alignment (Arrays Example)

LEFT (Before)                         RIGHT (After)
═══════════════════════════════════   ═══════════════════════════════════

"batter": [                           "batter": [
  { "id": "1001", "type": "Regular" }   [EMPTY ⟶ deleted item]
  { "id": "1002", "type": "Chocolate" }  { "id": "1002", "type": "Chocolate" }
  { "id": "1003", "type": "Blueberry" }  [EMPTY ⟶ deleted item]
  { "id": "1004", "type": "Devil's Food"}[EMPTY ⟶ deleted item]
]                                      ]

	•	Left shows all original objects.
	•	Right keeps empty gray boxes (“hatch” areas) where those items used to be — preserving vertical order and comparison alignment.


## 📄 Text-Markup Representation (Plain Text Version)

Let’s simulate your example using ASCII-style text markup.

We’ll use:
- `[LEFT]` and `[RIGHT]` to label the sides
- `---` to separate sections
- `(empty)` to show where a block is missing
- `+` for added lines
- `-` for removed lines
- Colors shown as `[RED]` or `[GREEN]` for explanation

---

```
[LEFT]                            [RIGHT]
─────────────────────────────────── ───────────────────────────────────
1  {                                1  {
2  "answers_blue_badge": {},        2  "answers_blue_badge": {},
3  "answers_green_badge": {},       3+ [GREEN]"answers_green_badge": {
4- [RED]"answers_merged": {},       4+ [GREEN]  "cooling": "cooling-ac-conventional",
                                     5+ [GREEN]  "heating": "heating-furnace-natgas",
                                     6+ [GREEN]  "version": 3,
                                     7+ [GREEN]  "waterheater": "wh-tank-natgas"
                                     8+ [GREEN]},
                                     9+ [GREEN]"answers_merged": {
10+ [GREEN]  "cooling": "cooling-ac-conventional",
11+ [GREEN]  "heating": "heating-furnace-natgas",
12+ [GREEN]  "version": 3,
13+ [GREEN]  "waterheater": "wh-tank-natgas"
14+ [GREEN]},
                                     15  "base_bldg_desc": {
                                     16    "AC installed kbtuh": 21,098,

(empty)                             (empty)

5   "base_bldg_desc": {             5   "base_bldg_desc": {
6     "AC installed kbtuh": 21,098,  6     "AC installed kbtuh": 21,098,
```

> 💡 Note: In real UIs, the empty space on the left for lines 4–14 would be visually represented as a grayed-out or striped area — showing “nothing here” while keeping vertical alignment with the right side.


⸻

## 🧠 How It Works Step-by-Step

1. **Line 1–2**: Same on both sides → displayed normally.
2. **Line 3**: Same key `"answers_green_badge"` — but on the right, it now has *content inside* → so left shows just `{}`, right shows full object.
3. **Line 4 (Left)**: `"answers_merged": {}` is **removed** → shown in red, marked with `-`.
4. **Lines 4–14 (Right)**: New content added under `"answers_green_badge"` and `"answers_merged"` → shown in green, marked with `+`.
5. **Empty Block (Left)**: Since those new lines don’t exist on the left, the left side shows nothing — just whitespace or striped placeholder — to keep alignment.
6. **Lines 5 onward**: Both sides match again → displayed normally.

---

## 🎯 Why Use Empty Blocks?

To make it easy to see **what changed** by **keeping context aligned**.

Example:
> You can glance at line 10 on the right and know that it corresponds to *nothing* on the left — meaning this entire section was newly added.

Without empty blocks, the alignment would shift and confuse you — like reading two mismatched pages.


⚙️ Why This Matters

Without empty placeholders, added/removed lines would shift everything below them, breaking alignment.
By preserving height through empty diff blocks, your eyes can instantly trace what changed — no scrolling confusion, no guessing.


## ✅ Summary (Plain Words)

> Imagine two pages side-by-side. Where one page has extra lines, the other page leaves blank space to stay lined up. Red means “this was deleted”, green means “this was added”. Blank space on one side? That means “nothing was here before” (or “nothing is here now”). This helps you instantly see additions, deletions, and unchanged parts — without losing your place.


In short:

A split diff is like two synchronized scrolls of the same song. When one side skips a verse, the other side holds a silent beat — the empty block — so rhythm stays aligned.