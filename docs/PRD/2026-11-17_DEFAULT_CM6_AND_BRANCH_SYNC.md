# PRD: Default CodeMirror 6 entry and cross-panel branch synchronization

Status: proposed. Not started. Tracked as feature issues (see the end of this document).

## 1. Objective

1. Make CodeMirror 6 the default landing experience instead of the version-selection homepage.
2. Synchronize branch selection between the left and right panels, so that selecting a branch on one side selects its most relevant match on the other side.

Both aim to remove unnecessary steps from the comparison workflow.

---

## Feature 1: CodeMirror 6 as the default entry point

### 2. Current situation

The root page offers a choice between CodeMirror 5 and CodeMirror 6. CodeMirror 6 is now the main tool. CodeMirror 5 stays as an alternative, but the selection page is no longer useful as the entry point, and users should not have to choose a version each time they open the app.

### 3. Proposed behaviour

**3.1 Landing page.** Opening the app loads CodeMirror 6 directly. The version-selection page is no longer the default.

**3.2 CodeMirror 5 navigation.** CodeMirror 5 stays reachable through the existing version navigation. Users can go back to CodeMirror 6 from it. This changes the default entry point, not CodeMirror 5 itself.

**3.3 Routing.**
- The root route resolves directly to CodeMirror 6.
- Existing CodeMirror 5 and CodeMirror 6 routes keep working, including direct links to CodeMirror 5.
- Refreshing a CodeMirror 6 route does not redirect to the old selection page.
- Existing bookmarks and internal links keep working where possible.
- No unnecessary redirects or second entry points.

Start by reviewing the current routing and index page. This app has no build step and is served as static files (GitHub Pages), so the root `index.html` is the redirect to change.

**3.4 Acceptance criteria.**
1. Opening the app loads CodeMirror 6 directly.
2. The version-selection page is not part of the normal entry flow.
3. CodeMirror 5 is still reachable.
4. Users can return to CodeMirror 6.
5. Direct URLs for both versions work.
6. Comparison features and stored data are unaffected.

---

## Feature 2: Cross-panel branch synchronization

### 4. Problem

Each panel can hold several branches, and they are often versions of the same dataset or scenario. When a branch changes on one side, the user must find and select the matching branch on the other side by hand. This repeats often when several related branches exist on both sides.

The change: switching a branch on one panel automatically selects its most relevant match on the other panel. It is on by default and can be turned off.

### 5. Example

Left panel:

```text
What If Analysis - Base Building
What If Analysis - Upgraded Building
```

Right panel:

```text
What If Analysis - Base Building Incremental
What If Analysis - Upgraded Building Incremental
```

- Select `What If Analysis - Base Building` on the left. The right panel switches to `What If Analysis - Base Building Incremental`.
- Select `What If Analysis - Upgraded Building` on the left. The right panel switches to `What If Analysis - Upgraded Building Incremental`.
- The same works in reverse.

### 6. Functional requirements

**6.1 Automatic matching.** When the active branch changes on either panel:
1. Detect the newly selected branch.
2. Get the branches on the opposite panel.
3. Score their names and any useful metadata.
4. Pick the most relevant candidate.
5. Switch the opposite panel if the match is reliable.
6. Otherwise leave the opposite panel as it is.

**6.2 Matching examples.**

| Left | Right | Expected |
|---|---|---|
| Base Building | Base Building Incremental | Strong match |
| Upgraded Building | Upgraded Building Incremental | Strong match |
| What If - Base | What If - Base Updated | Possible match |
| Scenario A | Scenario B | No match |

The matcher considers:
- **A. Normalized names:** case-insensitive, trimmed, repeated spaces collapsed, separators (`_`, `-`, spaces) treated alike, non-significant punctuation ignored where sensible.
- **B. Meaningful parts:** a shared phrase such as `What If Analysis - Base Building` counts strongly.
- **C. Metadata, if it exists:** identifiers, parent branch, original source, scenario type, creation relationship, user grouping. Do not add metadata the branch model does not already have.
- **D. Scoring:** rank candidates and tell apart exact matches, strong matches, ambiguous matches and unrelated branches. One shared common word is never enough.

**6.3 Confidence and ambiguity.** Given left `Base Building` and right `Base Building Incremental`, `Base Building Updated` and `Base Building Historical`, the matcher must not pick one at random. It switches only when the best candidate is reliable and clearly ahead of the others. Otherwise the opposite panel stays unchanged. A visible suggestion can come later.

**6.4 One-to-one.** A branch on one side should not keep pulling unrelated branches on the other side. If another branch already matches a candidate more strongly, prefer that pairing.

**6.5 Both directions.**

| User action | Result |
|---|---|
| Switch left branch | Activate the best right match |
| Switch right branch | Activate the best left match |
| No match | Opposite panel unchanged |
| Ambiguous | Opposite panel unchanged |
| Exact match | Activate that branch |
| Sync disabled | Only the chosen panel changes |

**6.6 No loops.** A switch made by sync must not start another matching cycle. Use an explicit origin flag (manual or synchronized) or an equivalent state, so the programmatic change is recognized.

### 7. Configuration

**7.1 Default:** enabled.

**7.2 Setting.** Under the branch or comparison preferences:

> **Automatically synchronize matching branches**
> When switching a branch on either panel, automatically select the most relevant matching branch on the opposite panel.

- On: branch changes trigger matching; reliable matches switch automatically; unmatched or ambiguous branches leave the other panel alone.
- Off: each panel keeps its own selection.

**7.3 Later options (not in the first version, but the design should allow them):** exact names only, similar names, metadata-based matching, a stricter confidence threshold, a suggestion before switching, manually paired branches. Keep the first settings screen small.

### 8. Experience requirements

- **8.1** No dialog or extra step for reliable matches.
- **8.2** Branch data is not changed. Neither branch is overwritten, and unrelated panel content is not reset. The comparison recalculates with the newly active branch, and editor and branch persistence keep working.
- **8.3** No switch when there is no candidate, when candidates score almost the same, when the branch has too little information, or when the match is unreliable.
- **8.4** Performance: matching is cheap. Do not re-score every branch during ordinary editing. Reuse normalized names or cached scores. Recalculate only when the branch list changes or the active branch changes. Do not recalculate the comparison when the active branch is unchanged.

### 9. Implementation phases

1. **Audit.** Read the code for branch collections per panel, the active branch, switch events, identifiers and metadata, create/delete/rename, comparison recalculation, persistence, and any existing sync. Identify the source of truth for each panel first.
2. **Matching utility.** A UI-independent function. Inputs: the newly selected branch, the opposite branches, their metadata. Outputs: best match, score or confidence, match class, and whether it is reliable enough to switch. Test it on its own.
3. **Bidirectional integration.** Connect it to both selection paths. Handle programmatic switches, loop prevention, no-match and ambiguous results.
4. **Setting.** Enabled by default, stored in the existing settings, applied to both panels, effective without reload.
5. **Testing.** Identical names; shared phrases; extra prefixes and suffixes; similar but unrelated names; several candidates; empty names; renamed branches; created and deleted branches; left-to-right and right-to-left; rapid consecutive changes; sync disabled.

### 10. Acceptance criteria

**Default CodeMirror 6 entry**
1. The app opens directly in CodeMirror 6.
2. The version-selection page is not shown by default.
3. CodeMirror 5 is still reachable.
4. Both versions are reachable by their own routes.
5. Existing features are unaffected.

**Branch synchronization**
1. A left switch looks for a right match.
2. A right switch looks for a left match.
3. Exact matches are selected automatically.
4. Strongly related names match correctly.
5. A shared generic word alone never matches.
6. Ambiguous matches cause no switch.
7. No match leaves the other panel alone.
8. No sync loops.
9. Branch data is unchanged.
10. Calculations update correctly after a switch.
11. Enabled by default.
12. Can be turned off in settings.
13. The setting survives reloads.

### 11. Expected outcome

CodeMirror 6 is the first screen users see, and CodeMirror 5 stays one click away. Related branches on the two sides stay paired without manual work. Matching is careful enough not to pick a wrong branch, and users can keep independent panels by turning the setting off.

---

## Tracking

- Feature 1 (default entry point): feature issue, linked from this document.
- Feature 2 (branch sync): feature issue, linked from this document.
