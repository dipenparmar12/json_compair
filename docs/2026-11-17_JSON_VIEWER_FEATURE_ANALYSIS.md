# JSON viewer features for the comparison tool: current scope

Source: `C:\xh\city-ui\src\components\JsonView\` (Vue tree viewer). Read in part; see §6.
This document covers what we build now. The tree explorer is parked on the roadmap: [2026-11-17_ROADMAP.md](2026-11-17_ROADMAP.md).

## 1. Principles

- **The text view stays as it is.** The panels keep showing JSON as text. Nothing here changes how a line is shown.
- **Never change the lines.** Search, fold and expand only hide or reveal lines. No feature rewrites, reorders or re-indents the text. (Block Diff's own alignment is separate and unchanged.)
- **Declutter.** Large nested documents are the main case. Folding is there to reduce what is on screen, so the user can focus on differences.
- **Per panel.** Each panel has its own search, depth and fold state. The two panels never overwrite each other.

## 2. Features to build now

### 2.1 Search across both panels

- Comma-separated terms, trimmed, case-insensitive substring match. Example: `status, error`.
- A **switch** chooses what matches: **Keys**, **Values**, or **Both**. Default: Both.
- Shows a match count per panel, for example "3 of 17".
- **Next / previous** match, in each panel, with the matched line in view and flashed.
- **Scope** chooses the panels searched: left, right or both. Default: both.
- Match order follows the document (top to bottom).
- Searches the pristine pair (`getPaneDocument`), so a windowed collection is searched in full. The count says when it covers only the window.
- **Esc** clears the search and removes the highlights.

### 2.2 Expand and collapse by depth

- **Fold to depth N** per panel: every line deeper than N is folded. N from 1 to 10.
- **Expand all** and **collapse all** as commands, per panel and for both.
- Built on the indentation rule that `JSONContext` already uses to find parents. Folds are CodeMirror fold ranges.
- **Rule: changed lines are never folded by depth.** A depth fold hides only unchanged structure. A changed line always stays visible.
- Change folds (▾ on a large block) keep working. Both fold kinds sit on the same lines; the depth fold never reopens a change fold, and a change fold never hides a changed line.
- Depth and search are independent controls. Depth folding does not clear a search.

### 2.3 Declutter controls

- The toolbar gets one compact group: depth (−, N, +), expand all, collapse all.
- Settings are saved per panel under keys that include the side (`left` / `right`), through `SettingsManager`.

## 3. Decisions taken

| Question | Decision |
|---|---|
| Tree explorer now? | No. Roadmap item, see [2026-11-17_ROADMAP.md](2026-11-17_ROADMAP.md). |
| Search scope | Keys, values, or both, selected by a switch. Default both. |
| Depth fold and changed lines | Changed lines are never hidden. |
| Multi-term, match count, next / previous | Required now. |
| Depth folding | Required now. |

## 4. Reuse and integration

- **Port the logic, not the components.** The viewer is Vue; v6 is plain JavaScript. Port the depth rule (`depth < N`), the comma-term parsing and the match ordering into a new `v6/utils/` file on `window`, with a `tests/` file, as the other utilities do.
- **Reuse:** `JSONContext` (parents and paths), `scrollPanesToLine` (jumps, which already unfolds change blocks), `KeyCompare` (key search), `getPaneDocument` (pristine text), `SettingsManager` (storage).
- **Do not reuse** the viewer's sticky overlay. `stickyBlockPlugin` already covers change blocks.
- **Conflicts to handle:**
  - Aligned output has gap lines. Depth counts real lines only; a gap row follows the fold state of its partner row.
  - Folding must not trigger a re-diff. Use fold effects, not `diffConfig`.
  - Keep the existing rules: no settings written for transient state, and every new control must survive a reload (CLAUDE.MD §2b).

## 5. Shortcuts

Planned keys are in [2026-11-17_KEYBOARD_SHORTCUTS.md](2026-11-17_KEYBOARD_SHORTCUTS.md).

## 6. Limits of this analysis

- Read: `Json-view.vue` (props, state, toolbar, expand and depth functions), the search and expand logic in `JsonNode.vue`, and the structure of `useStickyScroll.js`.
- Not read: the helpers `safeSerialize`, `filterJSONData`, `highlightSearchTerm`.
- The viewer's shared storage keys (`_tjsn…`) are fixed, so two viewers on one page share state. We avoid this by keying per side.
