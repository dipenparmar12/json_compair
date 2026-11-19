# Keyboard shortcuts

Status: **Existing** keys work today. **Planned** keys are part of the current scope and are not yet built.

## Existing

| Key | Action |
|---|---|
| Alt + ↓ / Alt + ↑ | Next / previous difference |
| Alt + [ / Alt + ] | Fold / show all change blocks |
| Ctrl + Z | Undo (per panel) |
| Esc | Close menus, dialogs, the lint popover |

## Planned

| Key | Action | Notes |
|---|---|---|
| Ctrl + S | Export the current comparison as a file | Replaces the browser's "Save page" (§1) |
| Ctrl + F | Focus the search box (both panels) | Overrides the browser's find when the app is focused |
| F3 / Shift + F3 | Next / previous search match | Browser "find next" is replaced in the app |
| Ctrl + Shift + 1 … 9 | Fold to depth N in both panels | Depth 1 to 9 |
| Ctrl + Shift + 0 | Expand all in both panels | |
| Alt + P | Copy the JSON path of the caret's line | Same as the right-click menu |
| Esc (in search) | Clear the search | |

## Choosing keys

- Use keys the browser does not reserve. Ctrl + T, W, N and Ctrl + Shift + T cannot be overridden.
- Avoid the developer-tools keys: Ctrl + Shift + C, I and J.
- Where the browser has a default we replace (Ctrl + S, Ctrl + F, F3), the app prevents it only while it has focus.

## Decision needed: Ctrl + S

Browsers choose the download folder for the user, and a web page cannot pick it without a browser prompt. So "save to Downloads" is what the browser does on its own. Options:

1. **Export / Share as a ZIP** (the existing snapshot: both panels, branches and settings, with a readme). Recommended.
2. **Export both panels as two `.json` files.** Simpler to open elsewhere, but loses branches and settings.

Ctrl + S exports the current comparison in the chosen format. The app already saves the comparison automatically, so Ctrl + S is an explicit export, not a save.

## Performance requirement

Shortcuts must be O(1) to dispatch. Export (Ctrl + S) of a 100–200 MB comparison must not freeze the tab: build the file off the main thread or in chunks, show progress, and support Cancel, as the existing snapshot export is planned to do.
