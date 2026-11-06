# Unified CSV and JSON Comparison Desktop Application

## Master Product Requirements Document and Engineering Specification

**Document type:** Product Requirements Document, Technical
Architecture, UX Specification and AI Coding Agent Handoff\
**Status:** Consolidated implementation specification. Phase gates and
acceptance criteria are normative.\
**Version:** 1.1\
**Date:** 6 November 2026\
**Target application:** Standalone local desktop application\
**Primary stack:** Tauri + Vue 3 + Python worker, with an adapter for
the existing JSON comparison implementation

------------------------------------------------------------------------

# 1. Executive Summary

Build one standalone desktop application that combines two existing
comparison capabilities:

1.  **Existing Python CSV comparison module** (`csv_diff(9).py`): a
    substantial implementation with keyed and keyless comparison, schema
    reconciliation, normalization, duplicate-key handling, Decimal-based
    numeric tolerance, memory and SQLite-backed strategies, progress
    callbacks, cancellation through callback interruption, and streamed
    exports.
2.  **Existing JSON comparison tool** (`json_compair`, modern v6): a
    separate tool whose supplied functional analysis documents
    structural JSON comparison, collection discovery, identity-key
    detection, record alignment, nested field differences, move
    detection, difference navigation, By key and Per record inspection,
    JSON repair, formatting, cleanup, ignore rules, and themes.

The goal is integration, not an uncontrolled rewrite. Preserve the
existing engines' comparison semantics. Put a common desktop application
layer around them so users experience one product regardless of which
engine processes the selected files.

The supplied JSON functional analysis identifies JavaScript modules such
as `json_align.js` and `key_compare.js` in a CodeMirror 6 application.
The complete JSON source repository was not present in the inspected
file set. Therefore, its exact source-level API, worker boundaries, and
large-file capabilities must be verified during repository audit. Do not
claim that the current JSON tool already supports 5 GB processing.

The application must process files locally. The frontend must never
receive complete multi-gigabyte file contents or complete result
collections. It should receive metadata, bounded pages, selected record
details, progress events, and export status.

## 1.1 Target architecture

``` text
┌──────────────────────────────────────────────────────────────┐
│                       Tauri Desktop Shell                    │
│ Native file dialogs | Drag/drop | Window | Packaging         │
├──────────────────────────────────────────────────────────────┤
│                       Vue 3 Application                       │
│ File selection | Schema/key setup | Progress | Results UI     │
│ Summary | Details | By key | Per record | Exports | Settings  │
├──────────────────────────────────────────────────────────────┤
│                 Desktop Application Service Layer             │
│ Input inspection | Comparison orchestration | Job lifecycle   │
│ Result repository | Pagination | Export coordination           │
├──────────────────────────────────────────────────────────────┤
│                       Engine Adapter Layer                     │
│                                                              │
│ CSV Adapter                            JSON Adapter           │
│ Existing Python module                 Existing JSON tool     │
│ Memory/SQLite strategy                 Structural matching    │
│ CSV exports                            JSON/delta exports     │
├──────────────────────────────────────────────────────────────┤
│                  Local Processing and Storage                  │
│ Original files read-only | Temporary workspace                │
│ Disk-backed indexes/results | Logs | Job metadata             │
└──────────────────────────────────────────────────────────────┘
```

## 1.2 Product outcome

A user can select two files, inspect detected formats and schemas,
configure comparison behavior, run a background comparison, monitor
progress, review exact results, navigate differences, and export reports
without using command-line tools.

## 1.3 Non-negotiable constraints

-   Source files remain in their original locations.
-   Source files are opened read-only and are never modified, renamed,
    moved, or overwritten.
-   No permanent duplicate source copies are created.
-   Temporary indexes, intermediate files, and result stores are
    permitted in a controlled workspace.
-   Source data is not uploaded to an external service.
-   The frontend never loads an entire source file or complete result
    set.
-   Existing engine behavior must not be silently changed.
-   Performance claims must be backed by reproducible benchmarks.

------------------------------------------------------------------------

# 2. Existing Assets and Evidence

This PRD distinguishes verified behavior from target behavior.

## 2.1 Existing CSV Python module: verified

**Inspected source:** `csv_diff(9).py`

The public entry point is `compare_csv(...)`. It returns a
JSON-serializable summary and can write streamed outputs.

Verified capabilities:

-   Header reading, delimiter sniffing, UTF-8 BOM handling, and
    configurable encoding.
-   Schema validation, column selection, ignored columns, and column
    renaming.
-   Keyed comparison with one or more key columns.
-   Keyless multiset comparison using row digests.
-   Order-independent matching for supported cases.
-   Column matching by name rather than physical position.
-   Duplicate-key reporting and configurable duplicate behavior.
-   Null/empty key policies.
-   Exact comparison by default.
-   Optional trim, case-insensitive, numeric, NA-token, boolean, and
    date normalization.
-   Decimal-based numeric comparison.
-   Absolute, relative, and per-column tolerances.
-   In-memory and SQLite-backed index strategies, including automatic
    selection.
-   Memory budget and temporary directory configuration.
-   Input-file change checks.
-   Progress callback with phase, bytes completed, total bytes, and row
    count.
-   Cancellation by interruption from the progress callback, with
    temporary cleanup.
-   Streamed added, removed, modified, duplicate-key, validation,
    column-statistics, summary JSON, and optional HTML outputs.
-   Output collision checks.
-   Staged export writes with commit/abort behavior.

Important CSV semantics that the UI must preserve:

-   Keyed mode supports modified-record detection.
-   Keyless mode is a multiset comparison. It can report unchanged
    multiplicities, additions, and removals, but cannot objectively
    infer modifications without a reliable identity.
-   Duplicate policy `match` first matches identical records in a
    duplicate-key group regardless of order. Remaining records are
    paired in file order and counted as ambiguous pairs. This is not
    fully order-independent for those remaining ambiguous pairs.
-   Duplicate policy `error` rejects ambiguous duplicate-key
    comparisons.
-   Null key policy supports `error`, `warn`, and `allow`.
-   Numeric tolerance requires keyed comparison.
-   `--key auto` currently selects from a fixed candidate list. The new
    UI must show suggestions and require user confirmation rather than
    silently accepting an automatic key.

The CSV adapter must call the existing public API. Do not duplicate its
matching, canonicalization, tolerance, storage-selection, or export
logic in the application service layer.

## 2.2 Existing JSON comparison tool: verified from supplied functional analysis

**Evidence:** `injection_compare_functional_analysis.md` and screenshots
Figures 1--20.

The analysis identifies the current tool as `json_compair` v6 using
CodeMirror 6 and JavaScript comparison modules including `json_align.js`
and `key_compare.js`. The complete JSON source repository was not
included in the inspected file set. The following are therefore verified
as documented/observed behavior, while source contracts and exact
implementation details require source audit.

Documented capabilities:

-   Side-by-side JSON comparison.
-   Root arrays and common collection envelopes such as `data`,
    `results`, and `items`.
-   Identity-key detection using sampled uniqueness and overlap.
-   ID-based patience/LIS alignment.
-   Exact LCS for small collections without an identity key.
-   Content-hash anchors and similarity gap filling for larger
    collections without an identity key.
-   Record states: same, changed, added, removed, moved.
-   Field states: equal, changed, type mismatch, tolerance-equal,
    left-only, right-only, ignored.
-   Nested object and array inspection.
-   Field-level difference navigation and visual highlighting.
-   Details drawer with field histogram and click-to-jump item
    navigation.
-   Key comparison dialog with By key and Per record modes.
-   Search and status filters.
-   JSON formatting, minification, syntax repair preview, and text
    cleanup.
-   Ignore patterns, regex rules, and numeric tolerance.
-   Sorting by field values and recursive key sorting.
-   CSV/TSV auto-conversion to JSON in the existing tool.
-   Light/dark themes.
-   Branch/session tabs per editor pane.
-   Import/export and example workflows.

The existing browser-oriented JSON parsing, matching, and rendering must
not be assumed to scale to multi-gigabyte inputs. Preserve useful
semantics while separating comparison logic from browser rendering and
moving large-file processing to a bounded local backend workflow.

## 2.3 Visual references

The supplied references cover empty and populated comparison states,
toolbars, settings, formatting, sorting, ignore rules, details drawer,
By key and Per record views, JSON repair, CSV/JSON mismatch, raw and
structured CSV comparison, large CSV paging, field histograms, cleanup
options, branch tabs, and dark theme.

Screenshots are UX evidence, not proof of multi-gigabyte performance.

## 2.4 Evidence labels

Use these labels in implementation records:

-   **CONFIRMED:** directly supported by inspected source or supplied
    functional analysis.
-   **INFERRED:** supported by multiple observations but not confirmed
    in executable source.
-   **PROPOSED:** target behavior for the unified application.
-   **DECISION REQUIRED:** must be resolved before affected
    implementation.
-   **NOT VERIFIED:** source or benchmark evidence is unavailable.

Never convert a proposed feature into a claim about existing behavior.

------------------------------------------------------------------------

# 3. Goals, Non-goals, and Success Measures

## 3.1 Goals

-   Unify CSV and JSON comparison in one desktop product.
-   Preserve existing comparison semantics and proven Python CSV
    capabilities.
-   Provide one consistent workflow for both formats.
-   Support multi-gigabyte files through local, disk-aware processing.
-   Keep frontend memory bounded.
-   Make matching behavior explicit and auditable.
-   Make comparisons reproducible through saved options and source
    metadata.
-   Provide record-level and schema-level inspection.
-   Ensure summaries, details, and exports agree.
-   Package the application so end users do not need to configure Python
    manually.

## 3.2 Initial non-goals

Unless explicitly approved, initial release does not require:

-   Cloud processing or cloud storage.
-   Multi-user collaboration.
-   Remote comparison servers.
-   Editing source datasets in place.
-   A general-purpose spreadsheet editor.
-   Fuzzy identity resolution without a reliable key.
-   Arbitrary SQL authoring.
-   Full Git-like branch management as a release blocker.
-   A hosted SaaS version.
-   Guaranteed completion time for every possible 5 GB dataset.

## 3.3 Success measures

-   Both engines can be used from one application.
-   Original files remain unchanged.
-   Frontend memory does not scale with full source size or full result
    count.
-   Summary counts, result pages, details, and exports are consistent.
-   Long-running operations can be cancelled safely.
-   Interrupted jobs do not publish incomplete final exports.
-   Engine regression fixtures pass.
-   Benchmarks report runtime, peak RAM, temporary disk, throughput, and
    correctness.
-   A packaged build works on a clean supported machine.

------------------------------------------------------------------------

# 4. Users and Primary Workflow

## 4.1 Users

-   Developers comparing application exports, database dumps, and
    regression datasets.
-   Analysts validating two versions of CSV or JSON data.
-   Operations and technical users currently relying on CLI scripts.
-   Users who need to inspect differences without writing code.

## 4.2 Main workflow

``` text
Launch
 -> New comparison
 -> Select Left file
 -> Select Right file
 -> Inspect format and metadata
 -> Validate schema
 -> Select comparison mode and keys
 -> Configure normalization and ignore rules
 -> Review processing plan and resource estimate
 -> Run comparison
 -> Monitor progress
 -> Review summary
 -> Inspect Details / By key / Per record
 -> Export results
 -> Save or reopen session
```

## 4.3 UX principles

-   Keep the workflow simple and discoverable.
-   Hide engine-specific complexity unless needed.
-   Explain key selection and its consequences.
-   Warn before expensive operations when estimates indicate substantial
    time or disk usage.
-   Never present heuristic pairing as guaranteed identity.
-   Keep progress and resource usage visible.
-   Preserve source file paths and metadata without copying contents
    into the UI.

------------------------------------------------------------------------

# 5. Supported Files and Format Detection

## 5.1 Initial format matrix

  -----------------------------------------------------------------------
  Format                  Scope                   Processing
  ----------------------- ----------------------- -----------------------
  CSV                     Required                Existing Python CSV
                                                  engine

  TSV                     Required where          CSV engine with tab
                          supported               delimiter

  JSON object             Required                JSON adapter

  JSON array              Required                Streaming parser or
                                                  bounded structural
                                                  parser

  Common JSON envelopes   Preserve existing       Collection discovery
  (`data`, `results`,     behavior                
  `items`)                                        

  NDJSON / JSON Lines     Target support; verify  Line-by-line streaming
                          existing engine         

  CSV vs JSON             Optional later          Only with a defined
                          capability              common record model

  Arbitrary plain text    Not core dataset        Separate utility only
                          comparison              if approved
  -----------------------------------------------------------------------

Show detected format and confidence. Allow delimiter, encoding, and
supported format overrides when detection is ambiguous.

## 5.2 File selection

Provide:

-   Native open-file dialog for each side.
-   Drag-and-drop onto Left or Right target.
-   Replace and clear actions.
-   File name, extension, size, path on demand, last modified time, and
    detected format.
-   Validation status.
-   Warning when both sides resolve to the same file.
-   File existence, access, and read-permission checks.
-   Clear errors for locked, inaccessible, or changing files.

Pass real filesystem paths to the local processing layer. Do not read
the complete file into JavaScript strings, blobs, or base64.

## 5.3 Source safety

-   Open source files read-only.
-   Never modify, rename, move, or delete source files.
-   Do not write exports beside source files unless the user selects
    that location.
-   Prevent output paths from colliding with either input.
-   Verify file identity/modification metadata before and after
    processing where practical.
-   If an input changes during processing, fail or mark the result
    invalid.

------------------------------------------------------------------------

# 6. Unified Architecture

## 6.1 Technology baseline

-   Desktop shell: Tauri.
-   Frontend: Vue 3, preferably TypeScript.
-   Styling: Tailwind utility classes or established project convention.
-   CSV: existing Python module.
-   JSON: existing JSON comparison implementation behind an adapter.
    Source audit determines whether the pure comparison core remains
    JavaScript in a worker or is ported to Python after parity tests.
-   Python: bundled or managed local runtime/sidecar.
-   Persistence: SQLite for job/session metadata and suitable indexes,
    not as an automatic requirement for all result data.
-   Temporary artifacts: configurable local workspace.
-   IPC: Tauri commands/events or a documented local worker protocol.
    Avoid an unauthenticated general-purpose local HTTP server unless
    necessary.

## 6.2 Component responsibilities

### Tauri shell

-   Native file dialogs.
-   Drag/drop path acquisition.
-   Window and application lifecycle.
-   Secure command registration.
-   Native save dialogs.
-   Starting/stopping the Python sidecar.
-   Packaging.
-   Passing approved paths and structured options.

### Vue frontend

-   File selection.
-   Schema/key configuration.
-   Settings and validation feedback.
-   Progress display.
-   Summary and paginated inspection.
-   Details drawer, key table, record detail.
-   Export initiation and status.
-   Theme and preferences.

Vue must not implement a second authoritative comparison engine.

### Application service layer

-   Input inspection and engine routing.
-   Comparison plan validation.
-   Job lifecycle.
-   Engine adapter invocation.
-   Progress normalization.
-   Cancellation.
-   Result metadata persistence.
-   Backend filtering, sorting, and pagination.
-   Export coordination.
-   Cleanup and recovery.

### Engine adapters

Translate the unified application request into engine-specific options
and translate engine outputs into the application's canonical result
model.

### Storage layer

-   Job metadata.
-   Comparison configuration snapshots.
-   Result summaries.
-   Disk-backed difference records or references.
-   Temporary indexes and intermediate files.
-   Export staging.
-   Cleanup and recovery metadata.

## 6.3 Adapter contract

Each adapter should provide equivalent operations where supported:

``` python
class ComparisonEngineAdapter:
    def inspect(self, source_path, options=None):
        pass  # format, metadata, schema, validation, estimates

    def validate(self, left_path, right_path, options):
        pass  # validate without full comparison where possible

    def run(self, job_context, left_path, right_path, options):
        pass  # execute and emit normalized progress

    def get_summary(self, result_ref):
        pass

    def query_results(self, result_ref, filters, sort, cursor, limit):
        pass  # bounded result page

    def get_record_detail(self, result_ref, record_ref):
        pass

    def export(self, result_ref, options, destination, progress):
        pass  # stream to disk

    def cancel(self, job_context):
        pass
```

Language-specific implementation may differ, but the application-level
contract must remain stable.

## 6.4 CSV adapter

-   Call `compare_csv(...)` from the existing module.
-   Do not duplicate matching, canonicalization, tolerance, storage
    selection, or export logic.
-   Translate UI settings to existing function arguments.
-   Adapt progress callback to the job manager.
-   Map `CsvDiffError.code` and other exceptions to stable application
    error codes.
-   Capture summary and export metadata.
-   Ensure full results can be queried through a disk-backed result
    repository. If the module only exposes streamed exports and bounded
    examples, extend it backward-compatibly or add a compatible result
    sink. Do not load complete exports into memory for the UI.
-   Preserve staged export and input/output collision behavior.

## 6.5 JSON adapter

Inspect the actual JSON repository and identify:

-   `json_align.js` and `key_compare.js` or equivalents.
-   Collection discovery and identity-key detection.
-   Matching algorithms and thresholds.
-   Move detection.
-   Field comparison and tolerance.
-   Ignore rules and normalization.
-   Repair and cleanup functions.
-   Result model and rendering dependencies.
-   Existing tests and fixtures.

Separate comparison data generation from DOM and CodeMirror
presentation.

Preferred target:

-   Keep structural comparison logic as a pure engine module.
-   Execute it in a background worker or local sidecar.
-   Add streaming parsing and disk-backed result handling for large
    inputs.
-   Preserve matching semantics with parity tests.
-   Let Vue display normalized result records.

If the current JavaScript implementation cannot meet large-file resource
limits, port or reimplement only the processing core after source audit
and parity fixture creation. Do not rewrite it blindly.

## 6.6 Canonical result model

The frontend consumes one stable result model regardless of engine.

Core concepts:

-   Comparison job.
-   Input source.
-   Schema/field.
-   Record identity.
-   Record comparison.
-   Field difference.
-   Duplicate or ambiguous match.
-   Validation issue.
-   Summary metric.
-   Export artifact.

Normalized record statuses:

-   `unchanged`
-   `modified`
-   `added`
-   `removed`
-   `moved`
-   `duplicate`
-   `ambiguous`
-   `invalid`

Not every engine or mode supports every status. Adapters must declare
supported statuses and semantics. Never fabricate `modified` in keyless
mode.

Normalized field statuses:

-   `equal`
-   `changed`
-   `type_changed`
-   `left_only`
-   `right_only`
-   `ignored`
-   `within_tolerance`

Every record must have stable source row/index or JSON path references
where available. Large values are fetched on demand.

------------------------------------------------------------------------

# 7. Matching and Comparison Semantics

## 7.1 CSV keyed comparison

-   Match records using one or more selected key columns.
-   Apply configured key normalization consistently.
-   Compare values after schema mapping and selected normalization.
-   Classify added, removed, modified, and unchanged.
-   Report duplicate keys and ambiguous pairs.
-   Avoid Cartesian multiplication from duplicate keys.
-   Preserve exact numeric semantics unless explicitly
    normalized/toleranced.
-   Preserve source row references.

Existing duplicate policy must be represented accurately:

-   `match`: exact records within duplicate-key groups are matched first
    regardless of order; remaining records are paired in file order and
    counted as ambiguous.
-   `error`: reject duplicate-key comparisons as ambiguous.

Do not silently replace this behavior with row-number occurrence
matching without a product decision and parity analysis.

## 7.2 CSV keyless comparison

Keyless mode compares row multiplicities using digests.

It can report:

-   Matching row multiplicities.
-   Rows present only on the left.
-   Rows present only on the right.

It cannot reliably infer:

-   Which removed row corresponds to which added row.
-   Modified records.
-   Field-level changes for unmatched rows.

The UI must disable modified-record claims and explain the limitation.

## 7.3 JSON collection matching

Preserve existing documented behavior after source-level verification:

-   Root arrays and supported envelope discovery.
-   Identity-key detection based on uniqueness and overlap.
-   User-visible confirmation of detected keys.
-   ID-based alignment.
-   Small-array exact matching without an ID.
-   Large-array hash/similarity fallback where supported.
-   Move/reorder detection.
-   Nested field-level differences.

Automatic identity detection is a suggestion, not a silent final
decision. Show key/path, uniqueness evidence, overlap estimate, sample
coverage, and limitations. Sample uniqueness must not be presented as
full-file uniqueness. If full scan is required, show it as a processing
stage.

## 7.4 Composite keys

Support one or more selected fields wherever the engine supports them.

Examples:

-   `customer_id`
-   `parcel_number + state`
-   `account_id + effective_date`

Define field order, null behavior, normalization, collision-safe
serialization, and duplicate behavior. Do not concatenate key values
with an unescaped delimiter.

## 7.5 Key validation

Before full comparison, show:

-   Selected key fields.
-   Presence on both sides.
-   Null/empty key counts where measurable.
-   Duplicate counts where measurable.
-   Candidate uniqueness.
-   Key type mismatches.
-   Sample overlap.
-   Warnings and recommended actions.

Clearly label sample-based estimates versus exact full-scan statistics.

## 7.6 Schema reconciliation

CSV:

-   Match columns by header name, not physical order.
-   Show left-only, right-only, common, renamed, and ignored columns.
-   Preserve `columns`, `ignore_columns`, and `rename` behavior.
-   Allow explicit renamed-column mapping.
-   Report ragged rows, duplicate headers, missing headers, encoding
    errors, and malformed rows.

JSON:

-   Compare properties by path.
-   Preserve nested object and array semantics.
-   Report fields missing on either side.
-   Distinguish missing property from explicit `null`.
-   Preserve array index/path where identity alignment is unavailable.

------------------------------------------------------------------------

# 8. Normalization, Ignore Rules, and Tolerance

Normalization changes comparison semantics. Options must be explicit,
saved with the job, and opt-in unless the engine currently defines a
default.

## 8.1 Existing CSV options to expose

-   Trim leading/trailing whitespace.
-   Ignore text case.
-   Numeric canonicalization (`1`, `1.0`, `1e0`).
-   Custom NA tokens.
-   Boolean normalization.
-   Date normalization and custom formats.
-   Absolute tolerance.
-   Relative tolerance.
-   Per-column tolerance patterns.
-   Ignored columns.
-   Column renaming.
-   Strict CSV structure validation.
-   Delimiter and encoding override.

Preserve Decimal precision. Do not convert arbitrary numeric values to
binary floating-point for UI convenience.

## 8.2 JSON options to expose where source confirms

-   Ignore selected keys or values.
-   Plain-text ignore patterns.
-   Regex patterns and flags.
-   Ignore scope: key, value, or both.
-   Numeric tolerance.
-   Read/expand JSON embedded inside strings.
-   Sort by selected field values.
-   Recursive key sorting.
-   Configurable diff highlighting.

Distinguish display-only settings from comparison-semantic settings.
Highlight color and collapse behavior must not change comparison
results.

## 8.3 Ignore rules

-   Show active rules and count.
-   Validate regex before execution.
-   Allow add/edit/remove.
-   Explain rule scope.
-   Preserve ignored differences in audit metadata where supported.
-   Distinguish ignored from equal.
-   Never modify source files to clean or normalize them.

## 8.4 Tolerance

-   Show default absolute and relative tolerance.
-   Support per-field/column overrides where available.
-   Preserve current CSV precedence: last matching column pattern wins.
-   Explain that tolerance is not exact equality.
-   Preserve original left/right values.
-   Mark within-tolerance values distinctly.
-   Validate finite, non-negative thresholds.

------------------------------------------------------------------------

# 9. UI and Information Architecture

## 9.1 Main navigation

Initial product navigation:

-   New comparison.
-   Recent comparisons.
-   Settings.
-   Help/About.

The comparison workspace is the primary screen.

## 9.2 New comparison

Two file cards:

-   Left / Baseline.
-   Right / Candidate.

Each shows name, size, path on demand, last modified, format, validation
status, and replace/remove action.

Primary action: Continue to configuration.

## 9.3 Configuration

Sections:

1.  Input overview.
2.  Format and schema.
3.  Matching mode.
4.  Key selection.
5.  Duplicate/null handling.
6.  Normalization.
7.  Ignore rules.
8.  Numeric tolerance.
9.  Performance and temporary storage.
10. Processing plan.

Allow users to return to file selection without losing valid
configuration.

## 9.4 Progress view

Show current phase, progress when measurable, bytes read, rows
processed, throughput, elapsed time, ETA only when meaningful, current
memory, temporary disk, selected engine/strategy, warnings, and Cancel.

Normalized phases:

-   Inspecting inputs.
-   Reading schema.
-   Validating keys.
-   Building index.
-   Matching records.
-   Comparing fields.
-   Writing result store.
-   Finalizing summary.
-   Completed.

Do not invent percentages when an engine cannot report meaningful
progress.

## 9.5 Results workspace

Preserve the existing compact two-row toolbar concept.

Toolbar row 1:

-   Format/cleanup actions where applicable.
-   Sort.
-   Collapse unchanged.
-   Highlight.
-   Settings.
-   Ignore rules.
-   Clear/reset.
-   More.

Toolbar row 2:

-   Previous/next difference.
-   Authoritative summary pill.
-   Result pager/range.
-   Details.
-   Keys.

Main content:

-   Left and Right panels.
-   File header/status.
-   Structured record or field view.
-   Difference markers.
-   Expandable nested JSON.
-   Virtualized result grid/list.
-   Synchronized navigation where useful.

For multi-gigabyte inputs, do not render the entire source file in
CodeMirror. Use bounded structured result views. A raw editor may be
offered for small inputs or selected excerpts only.

## 9.6 Summary metrics

Where applicable:

-   Left record count.
-   Right record count.
-   Matched.
-   Unchanged.
-   Modified.
-   Added.
-   Removed.
-   Moved.
-   Duplicate keys.
-   Ambiguous matches.
-   Invalid records/keys.
-   Field changes.
-   Ignored differences.
-   Duration.

All metrics must derive from canonical result data, not the visible
page.

## 9.7 Details drawer

Preserve:

-   Search/filter.
-   Summary metadata.
-   Fields by number of affected records.
-   Changed/added/removed/moved item list.
-   Click-to-jump.
-   Selected item highlight.

Fetch histogram and item pages from the result repository. Do not
construct unbounded lists in Vue.

## 9.8 Keys dialog

### By key

-   Field name/path.
-   Status.
-   Left/right presence.
-   Number of affected records.
-   Matching/different counts.
-   Representative values.
-   Search.
-   Status filters.
-   Export.

### Per record

-   Record identity.
-   Field/path.
-   Status.
-   Left value.
-   Right value.
-   Source row/index.
-   Search and filters.
-   Click-to-jump.

Relevant filters include All, Different values, Different fields, Only
left, Only right, Matching, and Ignored. Do not show categories
unsupported by the active engine.

## 9.9 Record detail

Show stable record reference, key values, status, left/right record,
field differences, source row or JSON path, duplicate/ambiguity
warnings, and normalization/ignore context.

Nested JSON values expand on demand. Large values are truncated with
explicit load-more/view-full behavior.

## 9.10 UI states

Define each major view's initial, loading, empty, partial, invalid,
warning, running, cancelling, cancelled, completed-no-differences,
completed-with-differences, completed-with-warnings, failed,
result-unavailable, exporting, export-completed, and export-failed
states.

Errors include stable code, user-readable message, and recovery action.

## 9.11 Themes and accessibility

-   Light, dark, and system themes.
-   Red/green diff colors remain legible in both themes.
-   Do not rely on color alone; include labels/icons/markers.
-   Consistent typography, spacing, borders, and component sizing.
-   Keyboard navigation and visible focus.
-   Reduced animation during large result rendering.
-   Accessible table headers, focus management, and status
    announcements.

## 9.12 Branch management

MVP: save/reopen sessions and saved profiles.

Later: independent left/right branch tabs and snapshots. Branches
reference file identity and configuration, not duplicate multi-gigabyte
contents.

------------------------------------------------------------------------

# 10. Large-File Processing and Resource Management

## 10.1 Workload target

Design for approximately 5 GB per input and 10 GB combined. Include CSV
and JSON, wide schemas, nested structures, high difference rates,
duplicate-heavy datasets, and network-mounted files.

These are design targets, not guaranteed performance claims. Actual
limits must be published after benchmarking.

## 10.2 General rules

-   Never load complete source files into frontend memory.
-   Never serialize complete source files through Tauri IPC.
-   Use filesystem paths and bounded reads.
-   Stream parsing and comparison where possible.
-   Use memory budgets and disk-backed strategies.
-   Store only data required for results and exports.
-   Fetch result pages on demand.
-   Stream exports to disk.
-   Preflight and monitor temporary disk.
-   Clean temporary artifacts after completion, cancellation, and
    recovery.

## 10.3 CSV processing

The existing module already has memory and SQLite-backed strategies.
Expose automatic selection, optional memory budget, temp directory,
estimated disk need, free-space preflight, selected strategy, and
disk-space failure handling.

Do not introduce DuckDB or Polars as the default CSV engine without
benchmarks and an explicit decision. If evaluated, protect against type
inference corruption such as leading-zero identifiers, ZIP codes, long
integers, decimal precision, and date-like identifiers. Preserve raw
text or use explicit schema overrides.

## 10.4 JSON processing

JSON can contain nested objects, arrays, large strings, and envelopes.

-   NDJSON: line-by-line parsing.
-   Large JSON arrays: streaming parser such as `ijson` or another
    verified incremental parser.
-   Root objects: bounded parsing where possible.
-   Nested arrays: stream or index by stable paths/identities.
-   Embedded JSON strings: expand only when enabled and supported.
-   Large values: preserve exact source or lossless parsed
    representation as required.

Document which structures are truly streaming and which require
materialization. Do not claim constant-memory processing without
measurement.

## 10.5 Temporary workspace

Provide a configurable per-user workspace with job-specific directories
for indexes, spill files, result stores, staged exports, and manifests.

Cleanup policy:

-   Success: retain results according to retention settings; remove
    disposable intermediates.
-   Cancellation: remove partial results unless resumable checkpoints
    are explicitly supported.
-   Failure: preserve diagnostic metadata and remove unsafe partial
    outputs.
-   Restart: mark unfinished jobs interrupted and clean or recover.
-   Disk pressure: stop safely before publishing partial outputs.

Show workspace path and disk consumption.

## 10.6 Network paths

-   Support accessible network-mounted files.
-   Detect network paths where practical.
-   Show actual read throughput.
-   Warn that network storage may be slower.
-   Handle disconnects and read errors safely.

## 10.7 Benchmark plan

Test 100 MB, 500 MB, 1 GB, and 5 GB per side where representative data
is available.

Include unique keys, keyless, duplicates, null keys, row/column reorder,
wide schemas, high/low differences, nested JSON arrays, NDJSON, invalid
input, local SSD, and network storage where relevant.

Record input sizes, row counts, phase runtime, peak RAM, temporary disk
peak, throughput, difference count, correctness, cancellation time, and
cleanup outcome.

No "5 GB in seconds" claim without reproducible evidence.

------------------------------------------------------------------------

# 11. Jobs, Progress, Cancellation, and Recovery

## 11.1 Job states

``` text
created -> inspecting -> validating -> queued -> running
running -> finalizing -> completed
running -> cancelling -> cancelled
running -> failed
created/queued -> cancelled
running/finalizing at crash -> interrupted -> recovered or abandoned
```

Persist state transitions and timestamps.

## 11.2 Job metadata

Store job ID, engine/version, input paths, sizes and modification
metadata, fingerprints where practical, formats, options snapshot,
phase, progress counters, timestamps, result reference, export
references, error information, and cleanup status.

Do not store raw source data in job metadata.

## 11.3 Progress contract

``` json
{
  "job_id": "job-id",
  "state": "running",
  "phase": "matching",
  "phase_label": "Matching records",
  "bytes_done": 1200000000,
  "bytes_total": 5000000000,
  "records_done": 4200000,
  "records_total": null,
  "throughput_bytes_per_second": 85000000,
  "elapsed_seconds": 48,
  "eta_seconds": null,
  "memory_bytes": 900000000,
  "temporary_disk_bytes": 1400000000,
  "message": null
}
```

Unknown values are `null`, not guessed.

## 11.4 Cancellation

-   Cooperative cancellation.
-   UI immediately shows Cancelling.
-   Worker checks cancellation at safe checkpoints.
-   Adapt existing CSV callback interruption carefully.
-   Do not publish partial final exports.
-   Clean or mark temporary artifacts.
-   Do not claim cancellation is complete until worker confirmation.

## 11.5 Concurrency

Initial default: one heavy comparison job at a time per application
instance. Lightweight inspection and completed-result browsing may
remain available. Add concurrent comparisons only after resource
isolation and benchmarking.

## 11.6 Recovery

At startup, detect jobs left running/finalizing, mark interrupted,
verify committed results, clean partial outputs, and offer
retry/discard. Never assume a partial result is valid.

------------------------------------------------------------------------

# 12. Result Repository, Filtering, and Pagination

## 12.1 Single source of truth

Summary metrics, status filters, Details, histogram, By key, Per record,
record details, and exports must derive from the same canonical result
model.

## 12.2 Repository operations

Support summary retrieval, status filtering, field/path filtering,
search, sorting, keyset/cursor pagination, record detail lookup,
histogram retrieval, export iteration, retention, and cleanup.

## 12.3 Pagination

-   Default page size: 50 or 100.
-   Use keyset/cursor pagination where possible.
-   Avoid large OFFSET queries.
-   Stable sort order required.
-   Reset cursor when filters change.
-   Keep only bounded pages in frontend memory.
-   Show total count only when exact and available; otherwise label
    estimated/unavailable.

## 12.4 Search

Search executes in the result repository/engine, not by downloading all
rows to Vue.

------------------------------------------------------------------------

# 13. Exports and Reports

## 13.1 Formats

-   CSV difference exports.
-   JSON difference exports.
-   Summary JSON.
-   Optional compact HTML report.

Show only export types supported by the active engine/mode.

## 13.2 Existing CSV outputs

Preserve the module's streamed added records, removed records, modified
records, duplicate keys, validation errors, column statistics, summary
JSON, and optional HTML.

## 13.3 Unified delta export

Where practical, include:

-   comparison_id
-   record_ref
-   record_status
-   key
-   source_left_row
-   source_right_row
-   field_path
-   field_status
-   left_value
-   right_value
-   left_type
-   right_type
-   ambiguity indicator where available

Added/removed records must include full payload or a separate
record-level export. Do not export only field deltas for complete
added/removed records.

## 13.4 Summary/schema audit

Include field/path, presence on each side, compared count, equal count,
different count, left-only, right-only, ignored, within-tolerance, and
bounded examples where useful.

## 13.5 Export behavior

-   Stream directly from result storage to destination.
-   Never materialize complete exports in frontend memory.
-   Use native save dialog.
-   Export all differences or current filtered subset.
-   Show progress and cancellation.
-   Stage output and commit only on success.
-   Never overwrite an input.
-   Confirm existing destination overwrite.
-   Clean partial output on failure.
-   Preserve encoding and null/empty semantics.
-   Include options and engine version in report metadata.

## 13.6 HTML report

Never embed entire source datasets. Include summary and bounded
examples. Avoid exposing full source paths by default. Include options
and warnings and enforce a maximum report size.

------------------------------------------------------------------------

# 14. Persistence and Sessions

Persist user preferences, theme, recent comparison metadata, saved
profiles, completed summaries, retained result references, export
history where useful, and recovery metadata. Do not persist source file
contents.

Profiles may contain format settings, keys, mappings, ignore rules,
normalization, tolerances, export preferences, and workspace preference.
Avoid saving absolute paths unless explicitly saving a file-pair
session.

Recent comparisons show date/time, file names, format, summary, status,
duration, and retention availability. If source files move/change,
explain whether the prior result remains available.

MVP sessions/profiles first. Full branch tabs later.

------------------------------------------------------------------------

# 15. Error Handling

Define stable error codes:

-   `file_not_found`
-   `file_access_denied`
-   `same_input_file`
-   `unsupported_format`
-   `format_mismatch`
-   `invalid_encoding`
-   `invalid_csv`
-   `invalid_json`
-   `schema_mismatch`
-   `missing_key`
-   `duplicate_key`
-   `null_key`
-   `invalid_option`
-   `invalid_regex`
-   `disk_space`
-   `memory_limit`
-   `input_changed`
-   `worker_crashed`
-   `cancelled`
-   `result_unavailable`
-   `export_collision`
-   `export_failed`
-   `storage_error`
-   `unexpected_error`

Each error includes stable code, readable message, technical log detail,
recoverability, suggested action, and job ID where applicable. Do not
show stack traces in normal UI. Diagnostic exports must be
user-initiated. Do not log source row values by default.

------------------------------------------------------------------------

# 16. Security and Privacy

-   All processing local.
-   No cloud upload or telemetry containing file contents.
-   Restrict Tauri commands to required operations.
-   Validate paths at native boundary.
-   Prevent path traversal in temporary/export paths.
-   Use per-user application data directories and appropriate
    permissions.
-   Avoid shell commands with untrusted interpolated arguments.
-   Validate sidecar invocation arguments.
-   Do not expose an unauthenticated local HTTP API unless required and
    protected.
-   Do not log row contents or sensitive values by default.
-   Use restrictive temporary-file permissions where supported.
-   Provide cleanup controls.
-   Document that secure deletion cannot be guaranteed on
    SSDs/filesystems.

------------------------------------------------------------------------

# 17. Packaging and Runtime

## 17.1 Standalone requirement

End users must launch the application without manually installing
Python, Node, Rust, or project dependencies.

## 17.2 Runtime packaging

-   Bundle required Python runtime or self-contained sidecar.
-   Bundle Python dependencies.
-   Bundle the JSON engine/runtime required by selected architecture.
-   Verify native dependencies.
-   Start worker from a known resource path.
-   Validate worker version and health.
-   Show useful startup error if worker is missing or fails.

## 17.3 Platform

Windows is the assumed primary target based on current project context.
macOS/Linux must not be claimed until built and tested. Confirm release
platform before final packaging tasks.

## 17.4 Release

Provide development and production builds, version metadata, application
icon, installer, signing where required, upgrade/uninstall behavior,
workspace cleanup policy, and crash diagnostics.

------------------------------------------------------------------------

# 18. Testing and QA

## 18.1 CSV regression

Run existing CLI fixtures and compare direct module output with adapter
output. Verify every option, summary, export, cancellation, cleanup,
collision protection, duplicate/null-key behavior, precision, and
tolerance.

## 18.2 JSON regression

Capture fixtures from the existing tool. Verify root arrays/envelopes,
identity detection, reordering/moves, LCS behavior, large-array
fallback, nested differences, type changes, missing/null distinction,
ignore/tolerance, repair, and cleanup. Compare old/new outputs on the
same fixture set.

## 18.3 Application tests

Test native selection, drag/drop, path validation, format detection,
profiles, progress, cancellation, worker crash, restart recovery,
pagination, filters, details, By key, Per record, all/filtered export,
export cancellation, themes, and keyboard accessibility.

## 18.4 Performance tests

Measure realistic sizes and high-difference cases. Verify UI memory does
not grow with complete source size or full result count.

## 18.5 Acceptance examples

-   Selecting a 5 GB file does not cause Vue to read it entirely.
-   Input hashes remain unchanged after comparison.
-   Cancelling does not publish partial final exports.
-   Summary counts equal aggregates from canonical result storage.
-   Export counts match corresponding result queries.
-   Duplicate keys are reported and do not cause Cartesian
    multiplication.
-   Keyless mode does not label records modified.
-   UI remains interactive during processing.
-   A retained completed session can be reopened.

------------------------------------------------------------------------

# 19. Implementation Plan

## Phase 0: Repository and source audit

-   Inspect Tauri/Vue project.
-   Inspect complete CSV module and tests.
-   Inspect complete JSON repository and tests.
-   Identify dependencies, runtime, and licenses.
-   Document public functions, inputs, outputs, side effects.
-   Capture baseline fixture outputs.
-   Create source inventory, capability matrix, and parity matrix.

**Exit:** both engines have documented contracts, dependencies, tests,
and limitations.

## Phase 1: Engine integration proof

-   Build CSV adapter around `compare_csv`.
-   Build JSON adapter around existing JSON engine.
-   Define job request/progress contracts.
-   Define normalized summary and result references.
-   Prove path-based processing without source copying.
-   Prove cancellation and cleanup.
-   Verify parity on fixtures.

**Exit:** both engines run through local services without frontend
dataset loading.

## Phase 2: Job manager and storage

-   Job state machine.
-   Progress events.
-   Cancellation.
-   Persistent metadata.
-   Workspace manager.
-   Result repository.
-   Startup recovery and cleanup.
-   Bounded query/pagination.

**Exit:** jobs run, monitor, cancel, and reopen with bounded frontend
data.

## Phase 3: Desktop file workflow

-   Tauri setup.
-   Native dialogs and drag/drop.
-   Path validation.
-   Format inspection.
-   File metadata.
-   Source safety.
-   Worker lifecycle/health.

**Exit:** users select real local files without copying contents into
the UI.

## Phase 4: Configuration UX

-   Schema inspection.
-   Key suggestions/confirmation.
-   Composite keys.
-   Duplicate/null handling.
-   CSV and JSON options.
-   Ignore rules and tolerance.
-   Workspace settings.
-   Comparison plan.

**Exit:** validated UI settings map correctly to adapters.

## Phase 5: Progress and results UX

-   Progress.
-   Summary.
-   Record grid.
-   Details drawer.
-   Field histogram.
-   By key.
-   Per record.
-   Record detail.
-   Difference navigation.
-   Nested JSON expansion.
-   All UI states.

**Exit:** results load only through bounded backend queries.

## Phase 6: Exports and sessions

-   Streamed CSV/JSON exports.
-   Summary JSON.
-   Compact HTML.
-   Filtered export.
-   Save/reopen sessions.
-   Profiles.
-   Retention settings.

**Exit:** exports match canonical results and do not use frontend
materialization.

## Phase 7: Performance and packaging

-   Benchmark representative data.
-   Optimize measured bottlenecks.
-   Validate disk-space handling.
-   Validate crashes/recovery.
-   Package runtimes.
-   Build installer.
-   Test clean-machine installation.
-   Document release and limitations.

**Exit:** packaged app passes functional, regression, performance, and
recovery tests.

------------------------------------------------------------------------

# 20. Initial Requirement Register

  -----------------------------------------------------------------------
  ID               Requirement                  Priority Evidence
  ---------------- ---------------- -------------------- ----------------
  REQ-APP-001      One standalone                     P0 Proposed
                   desktop app for                       
                   CSV and JSON                          

  REQ-FILE-001     Native file                        P0 Proposed
                   selection                             

  REQ-FILE-002     Drag/drop path                     P0 Proposed
                   selection                             

  REQ-FILE-003     Never modify                       P0 User requirement
                   source files                          

  REQ-FILE-004     No permanent                       P0 User requirement
                   source                                
                   duplicates                            

  REQ-FMT-001      Detect CSV, TSV,                P0/P1 Existing
                   JSON, supported                       evidence; NDJSON
                   NDJSON                                verify

  REQ-ENG-001      Integrate                          P0 Source inspected
                   existing Python                       
                   CSV module                            

  REQ-ENG-002      Integrate                          P0 Functional
                   existing JSON                         analysis; source
                   comparison tool                       audit

  REQ-ENG-003      Preserve engine                    P0 Product
                   semantics                             direction

  REQ-JOB-001      Run processing                     P0 Proposed
                   outside UI                            
                   thread                                

  REQ-JOB-002      Show progress                      P0 Proposed
                   and resource use                      

  REQ-JOB-003      Safe                               P0 CSV callback
                   cancellation                          capability;
                                                         integration
                                                         proposed

  REQ-RES-001      Canonical result                   P0 Proposed
                   data for UI and                       
                   exports                               

  REQ-RES-002      Backend                            P0 Proposed
                   pagination                            

  REQ-RES-003      Record and field                   P0 Proposed
                   detail lookup                         

  REQ-UI-001       Exact summary                      P0 Existing
                   metrics                               summary/UX

  REQ-UI-002       Details and                        P1 Existing JSON UX
                   field histogram                       

  REQ-UI-003       By key and Per                     P0 Existing JSON UX
                   record views                          

  REQ-UI-004       Light and dark                     P1 Existing JSON UX
                   themes                                

  REQ-EXP-001      Stream CSV                         P0 Existing CSV
                   exports                               module

  REQ-EXP-002      Stream JSON                        P1 Existing JSON
                   exports                               tool; backend
                                                         contract
                                                         required

  REQ-EXP-003      Summary/schema                     P0 Existing CSV
                   audit export                          stats; unified
                                                         form proposed

  REQ-SEC-001      Local-only                         P0 User requirement
                   processing                            

  REQ-PERF-001     Approx. 5 GB per                   P0 User target;
                   input design                          benchmark
                   target                                unverified

  REQ-PERF-002     Bounded frontend                   P0 User requirement
                   memory                                

  REQ-OPS-001      Recover/clean                      P1 Proposed
                   interrupted jobs                      

  REQ-OPS-002      Reopen completed                   P1 Proposed
                   sessions                              

  REQ-PKG-001      Self-contained                     P0 Proposed
                   installer                             
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 21. Decision Registry

  -----------------------------------------------------------------------
  ID                      Decision                Baseline
  ----------------------- ----------------------- -----------------------
  DEC-001                 Desktop architecture    Tauri + Vue 3 + local
                                                  Python worker

  DEC-002                 CSV engine              Preserve existing
                                                  Python module

  DEC-003                 JSON engine             Preserve existing JSON
                                                  behavior behind
                                                  adapter; audit source
                                                  to choose runtime

  DEC-004                 Comparison ownership    Engine is
                                                  authoritative; Vue does
                                                  not calculate results

  DEC-005                 Source files            Read-only, no upload,
                                                  no permanent copy

  DEC-006                 Large results           Backend pagination and
                                                  bounded rendering

  DEC-007                 Summary/exports         One canonical result
                                                  model

  DEC-008                 CSV strategy            Existing memory/SQLite
                                                  strategy until
                                                  benchmark supports
                                                  alternative

  DEC-009                 Auto key detection      Suggest only; user
                                                  confirms

  DEC-010                 Keyless mode            Multiset
                                                  add/remove/unchanged;
                                                  no inferred
                                                  modifications

  DEC-011                 Duplicate handling      Preserve engine policy
                                                  and expose ambiguity

  DEC-012                 Concurrency             One heavy job at a time
                                                  initially

  DEC-013                 Temp files              Configurable workspace
                                                  with cleanup/recovery

  DEC-014                 Branches                Sessions/profiles
                                                  first; full branches
                                                  later

  DEC-015                 Cross-format comparison Not mandatory
                                                  initially; requires
                                                  common data model
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 22. Open Questions and Source Verification

Resolve during repository audit:

1.  What is the exact JSON source repository path and version?
2.  Is the JSON engine importable, or tightly coupled to the browser
    app?
3.  Does JSON currently support NDJSON?
4.  Which JSON structures can be processed incrementally today?
5.  Which features depend on CodeMirror or DOM state?
6.  What result data is available independently of rendering?
7.  Can the CSV module expose paginated results directly, or does it
    need a backward-compatible result sink?
8.  Is Windows the only initial platform?
9.  What minimum RAM and temporary free disk should be supported?
10. Are network-mounted files a required scenario?
11. Is CSV-to-JSON cross-format comparison needed in the first release?
12. How long should completed results be retained?
13. Are representative 5 GB CSV and JSON benchmark files available?
14. Can sessions reopen if source files move, provided result storage
    remains?
15. Which JSON repair and cleanup features are required in v1?

Blocking questions affect engine boundaries, correctness, packaging, or
large-file support. Visual refinements can proceed with documented
assumptions.

------------------------------------------------------------------------

# 23. Risks and Mitigations

  -----------------------------------------------------------------------
  Risk                    Impact                  Mitigation
  ----------------------- ----------------------- -----------------------
  JSON logic coupled to   Integration and scaling Separate pure core;
  browser rendering       difficulty              parity-test before port

  CSV engine lacks        Results UI cannot       Backward-compatible
  queryable full results  browse all differences  disk-backed result sink

  Duplicate keys cause    Incorrect               Preserve duplicate
  ambiguous pairing       classifications         report and ambiguity
                                                  metadata

  Type inference changes  False differences/data  Preserve raw strings or
  values                  corruption              explicit schema

  Large JSON arrays use   Application failure     Streaming parser,
  excessive RAM                                   disk-backed indexing,
                                                  benchmarks

  Result set itself is    Disk exhaustion         Preflight, quotas,
  huge                                            streaming export,
                                                  cancellation

  UI requests too much    Memory growth/freezes   Strict page limits and
  data                                            virtualization

  Source changes during   Invalid result          Capture
  comparison                                      metadata/fingerprint
                                                  and verify

  Worker crashes          Partial state/artifacts Persist state, atomic
                                                  output, recovery

  Packaging misses native Clean install failure   Test installers on
  dependencies                                    clean machines

  Parity assumed without  Regression              Golden fixtures and
  tests                                           parity matrix
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 24. Definition of Done

The first production release is ready only when:

1.  Tauri app launches on each supported platform.
2.  Python worker and JSON engine start and report health.
3.  Both engines are invoked through documented adapters.
4.  CSV and JSON workflows exist in one UI.
5.  Source files remain unchanged.
6.  Large files are not loaded into Vue memory.
7.  Key selection and validation are explicit.
8.  Duplicate, null, and ambiguous matching behavior is visible.
9.  Progress and cancellation work for both engines.
10. Canonical results power summaries and exports.
11. Pagination, filtering, and detail retrieval are backend-driven.
12. By key and Per record work where supported.
13. CSV and JSON exports stream to disk.
14. Partial exports are not published after cancellation/failure.
15. Recovery and temporary cleanup are tested.
16. Existing CSV and JSON regression fixtures pass.
17. Performance benchmarks are documented.
18. Installer works on a clean supported machine.
19. Error handling and diagnostics are usable.
20. Documentation, limitations, and open decisions are updated.

------------------------------------------------------------------------

# 25. AI Coding Agent Handoff

Treat this document as the product and architecture baseline.

Before changing code:

1.  Inspect the current desktop repository and record its actual
    structure.
2.  Inspect the complete CSV module and tests.
3.  Inspect the complete JSON comparison source repository, not only
    screenshots or functional documentation.
4.  Produce source inventory and engine capability matrix.
5.  Identify mismatches between this PRD and actual source behavior.
6.  Do not silently change engine semantics.
7.  Do not introduce DuckDB, Polars, or another engine as a replacement
    without benchmark evidence and an approved decision.
8.  Do not port JSON before capturing parity fixtures.
9.  Do not build a UI that downloads complete result sets.
10. Do not pass multi-gigabyte contents through Tauri IPC.
11. Keep source files read-only.
12. Implement adapters and job lifecycle before the complete results UI.
13. Write tests at every integration boundary.
14. Update decisions, assumptions, risks, and traceability as
    discoveries occur.

For every implementation task, report requirement IDs, files changed,
engine behavior reused, new behavior introduced, tests, performance
impact, limitations, and remaining decisions.

If source evidence contradicts this PRD, document the contradiction and
propose a change. Do not silently rewrite requirements.

------------------------------------------------------------------------

# 26. Final Product Definition

The final product is one standalone desktop application combining the
existing Python CSV comparison module and existing JSON comparison tool
behind one interface and shared application services.

It is not a browser upload tool, not a new comparison engine written in
Vue, and not a replacement of the existing CSV module with an
unbenchmarked database engine.

The application owns file selection, configuration, orchestration,
progress, result browsing, exports, sessions, packaging, and UX. The
engines remain responsible for the comparison semantics of their
respective formats.

``` text
Source audit
 -> Engine capability and parity matrix
 -> Adapter contracts
 -> Local worker and job lifecycle
 -> Disk-backed result access
 -> Tauri file integration
 -> Unified configuration UI
 -> Progress UI
 -> Results explorer
 -> Exports and sessions
 -> Performance and recovery validation
 -> Standalone packaging
```

**Governing principle: Unify the product experience and application
architecture while preserving the proven comparison behavior of the
existing engines.**

------------------------------------------------------------------------

# 27. Version 1.1 Consolidated Decisions and Normative Amendments

This section resolves implementation gaps identified during the v1.0
review. It is normative and takes precedence over any conflicting open
question, provisional statement, or earlier wording in sections 1
through 26. Requirements not changed here remain in force.

## 27.1 Product delivery strategy and phase gates

The product is delivered as a CSV-first vertical slice while the JSON
source audit runs in parallel.

  -----------------------------------------------------------------------
  Phase                   Deliverable             Gate to proceed
  ----------------------- ----------------------- -----------------------
  Phase 0A                JSON source audit,      JSON integration
                          capability matrix,      decision recorded and
                          dependency map,         approved
                          headless feasibility    
                          report, parity fixture  
                          plan                    

  Phase 0B                Architecture contracts, Contracts reviewed and
                          supported-machine       testable
                          baseline, result        
                          schema, job lifecycle   
                          and security design     

  Phase 1                 Complete CSV vertical   All Phase 1 P0
                          slice: select, inspect, acceptance criteria
                          configure, preflight,   pass
                          compare, browse,        
                          filter, export,         
                          retain/delete session   

  Phase 2                 JSON adapter and        JSON parity suite
                          unified JSON UX, only   passes for every
                          for capabilities proven claimed capability
                          by Phase 0A             

  Phase 3                 Large-file hardening,   Release gates in
                          recovery, packaging,    section 27.16 pass
                          performance and         
                          clean-machine release   
                          qualification           
  -----------------------------------------------------------------------

CSV development must not wait for JSON audit completion if it does not
depend on JSON-specific contracts. Shared contracts must be stable
before they are used by both engines.

### JSON integration decision tree

The Phase 0A audit must inspect the complete JSON implementation, not
only the functional analysis or screenshots.

1.  **Headless core is separable:** extract or invoke the existing
    comparison core without CodeMirror, DOM, browser globals, or UI
    lifecycle dependencies. Preserve its matching and status semantics.
2.  **Core is coupled but separable with bounded work:** isolate pure
    comparison functions, define a stable adapter result model, and
    build parity fixtures against the current tool before integration.
3.  **Core requires a Node runtime:** keep the existing JavaScript
    engine in a headless Node sidecar or worker, behind the same
    application adapter contract. Do not port it merely to make the
    stack look uniform.
4.  **A controlled port is necessary:** port only after a fixture corpus
    captures current behavior and automated parity tests can compare old
    and new outputs.
5.  **Safe integration or parity cannot be demonstrated:** defer that
    capability or JSON support from v1. Do not claim large-file JSON
    support based on the CSV engine's capabilities.

The JSON audit deliverable must include: - Repository inventory, entry
points, runtime requirements, dependencies and licenses. - Separation
map for comparison logic, parsing, alignment, rendering and UI state. -
Data structures and result contracts for records, fields, moves, ignored
values and errors. - Memory behavior, parsing strategy, streaming
support, and largest tested inputs. - Features that rely on browser
APIs, CodeMirror, DOM or in-memory whole-document objects. -
Worker/sidecar feasibility, startup and shutdown behavior. - Capability
matrix: existing, reusable, adaptable, unsupported, and not yet
verified. - Versioned parity fixture corpus and known limitations. -
Explicit decision: extract, wrap, port, defer, or exclude each
capability.

**Acceptance criteria** - `JSON-AUDIT-001`: Audit covers the complete
source tree and runtime dependencies. - `JSON-AUDIT-002`: Every feature
advertised in the UI has a source-backed capability status. -
`JSON-AUDIT-003`: Every supported JSON comparison behavior has at least
one fixture; edge cases have dedicated fixtures. - `JSON-AUDIT-004`: A
documented architecture decision selects the integration route. -
`JSON-AUDIT-005`: No JSON large-file claim is made without repeatable
benchmark evidence and memory measurements. - `JSON-AUDIT-006`: If
parity is incomplete, the unsupported feature is hidden or clearly
marked unavailable rather than approximated silently.

## 27.2 Phase 1 CSV result repository is a named deliverable

The CSV result repository is a Phase 1 P0 deliverable, not a later
optimization. The application must provide queryable, disk-backed
results during the initial CSV vertical slice.

The existing `compare_csv(...)` engine remains authoritative for
comparison classification. Add a backward-compatible result sink or
equivalent callback that receives classified records during the existing
comparison pass. Existing callers must continue to work without
providing the sink and must retain their current summary/export
behavior.

Do not build the UI result repository by parsing the engine's exported
CSV files after comparison. That would introduce a second parser and a
second interpretation of comparison results.

### Required logical schema

The physical schema may be normalized across tables, but it must support
these fields and relationships:

  -----------------------------------------------------------------------
  Entity                              Required fields
  ----------------------------------- -----------------------------------
  Job                                 `job_id`, status,
                                      created/started/completed
                                      timestamps, engine, options
                                      version, left/right source
                                      metadata, source fingerprints,
                                      error code

  Result record                       `job_id`, `record_ref`, `status`,
                                      serialized or typed key,
                                      `duplicate_group_id`,
                                      `match_quality`, `ambiguous`,
                                      left/right source row references

  Field difference                    `job_id`, `record_ref`,
                                      `field_path`, field status, left
                                      value, right value, value type
                                      metadata

  Source location                     side (`left`/`right`), source row
                                      or record location, byte offset
                                      where reliably available, source
                                      identifier

  Summary                             counts by status, counts by field
                                      status, duplicate and ambiguity
                                      counts, column statistics, warnings

  Export                              export type, destination, state,
                                      bytes written, commit state, error
                                      code
  -----------------------------------------------------------------------

`record_ref` must be stable within a job and must not depend on the
current UI page. It is an application identifier, not a source record
key.

The repository must preserve actual source values for detail inspection.
Large values may be stored in a bounded or separately blob-backed
representation, but truncation must be explicit and must not silently
alter exported values.

### Duplicate and ambiguity model

Use these canonical concepts:

-   `duplicate_group_id`: identifies a group of records sharing a
    duplicate comparison key.
-   `match_quality`: enum with `exact`, `ambiguous`, and `unmatched`.
-   `ambiguous`: explicit boolean for convenient filtering and summary
    counts.
-   Optional occurrence index and content hash may be stored to support
    diagnosis and deterministic exact matches.

The CSV engine's current duplicate `match` policy first matches
identical records within duplicate-key groups, then pairs remaining
records in file order and marks those residual pairs ambiguous. The
residual pairing is order-dependent. Reordering either input can change
which residual records pair. The product must not imply reorder
invariance for those ambiguous residual pairs.

Ambiguity must be visible in: - Summary counts. - Result status/filter
controls. - Record details and source row references. - Exported result
metadata. - Help text explaining the matching limitation.

### Repository operations

The service layer must support: - Fetch summary by job. - Fetch a
cursor/keyset page of records. - Fetch a record and its field
differences. - Filter by record status, key, field path, ambiguity and
match quality. - Search keys using an indexed strategy. - Sort only by
supported indexed or bounded fields. - Stream a selected result set to
an export writer. - Delete all artifacts for a job. - Validate
repository integrity after recovery.

Avoid large `OFFSET` pagination. Use a stable cursor based on indexed
ordering, such as `(job_id, record_ref)` or a compound indexed key.

**Acceptance criteria** - `RES-001`: The CSV adapter writes canonical
classified results to the repository during the comparison pass. -
`RES-002`: UI summary counts reconcile exactly with engine summary
counts for the same classification scope. - `RES-003`: UI record pages
and detail views are read from the repository, not reconstructed from
export files. - `RES-004`: Pagination remains bounded for a result set
containing millions of records. - `RES-005`: Filtering by status and
ambiguity returns correct counts and records. - `RES-006`: Exported
records reconcile with the canonical repository selection. - `RES-007`:
Interrupted or cancelled jobs cannot be mistaken for completed result
sets. - `RES-008`: Existing CSV module callers without a result sink
retain backward-compatible behavior.

## 27.3 Canonical application result contract

All adapters must map engine output to a versioned application result
contract. The contract is a storage and UI boundary, not a mandate to
change the engines' internal algorithms.

### Summary object

Required logical fields: - `job_id` - `engine` and `engine_version` -
`status` - `left_source` and `right_source` metadata - `started_at`,
`completed_at`, and duration when available - `counts`: added, removed,
modified, unchanged, moved where supported, duplicate groups, ambiguous
pairs, unmatched records - `field_counts`: equal, changed, type
mismatch, tolerance equal, left only, right only, ignored where
supported - `warnings` - `errors` - `capabilities_used` -
`result_repository_version`

Unsupported counts must be represented as unsupported or null, not as
zero. Zero means the engine measured the count and found none.

### Record object

Required logical fields: - `job_id` - `record_ref` - `status` - `key` or
key representation, if the engine has one - `duplicate_group_id`,
nullable - `match_quality` - `ambiguous` - `left_source_location`,
nullable - `right_source_location`, nullable - `field_difference_count`

### Field difference object

Required logical fields: - `record_ref` - `field_path` - `status` -
`left_value` and `right_value`, nullable where absent - left/right value
types - tolerance or ignore rule applied, where relevant

### Source location object

A source location must identify the side and the most precise stable
location the engine can provide. For CSV this normally includes physical
or logical row number. Byte offset is optional and must not be
fabricated. For JSON it may include JSON Pointer, line/column, array
index or record path only when the parser can provide it reliably.

### Versioning

Persist a schema version for job metadata and result records. Migrations
must be tested against retained sessions. An adapter must declare the
result schema version it writes.

**Acceptance criteria** - `MODEL-001`: CSV and JSON adapters produce
valid, versioned application result objects. - `MODEL-002`: Unsupported
semantics remain explicitly unsupported and are not mapped to misleading
zero counts. - `MODEL-003`: Source locations are traceable to the
original input where the engine provides reliable locations. -
`MODEL-004`: Stored results remain readable after an application update
through tested migrations or a documented compatibility boundary.

## 27.4 Hardware baseline and workload qualification

The product must publish a tested minimum machine profile. The following
is a **proposed qualification baseline**, not a claim about current
performance:

-   Windows 10/11, 64-bit, supported release versions to be pinned in
    packaging notes.
-   8 GB RAM.
-   At least 20 GB free space in the configured temporary workspace
    before a large comparison.
-   Local SSD recommended.
-   No requirement for administrator privileges for normal comparison
    operations.

The engineering team must ratify or revise this baseline using benchmark
evidence. If a workload cannot complete within the baseline, document
the supported limit and show a clear preflight warning.

Benchmarks must record: - CPU model and core count. - Physical RAM and
available RAM. - Storage type, free space and measured read/write
throughput. - OS build and application/engine versions. - File size,
row/record count, column count, average and maximum record width. -
Difference rate and duplicate-key rate. - Selected strategy and
configured memory limit. - Peak process memory, peak temporary disk use,
elapsed time and result repository growth.

Required workload profiles include: - Small files for startup and
interaction latency. - 1 GB and 5 GB per-side CSV inputs where generated
fixtures can represent the format. - High-difference-rate 5 GB inputs,
not only mostly-identical files. - Very wide CSVs. - Duplicate-heavy and
keyless datasets. - JSON workloads only after Phase 0A proves a viable
processing strategy. - Result-store growth under high difference rates.

**Acceptance criteria** - `PERF-001`: The 8 GB RAM / 20 GB free
workspace baseline is either ratified or replaced with a measured
baseline before release. - `PERF-002`: Benchmark reports include the
complete machine and workload metadata above. - `PERF-003`: A
high-difference-rate large-file benchmark is included. - `PERF-004`:
Result repository growth and temporary disk peak are measured. -
`PERF-005`: No performance claim is published without a reproducible
benchmark report.

## 27.5 Mandatory preflight and disk-space policy

A preflight step is mandatory before a full comparison. It must run
after configuration and before the engine processes the complete input.

Preflight must report: - File readability, format and detected
encoding/delimiter where applicable. - File sizes, source fingerprints
or fingerprinting status. - Header/schema compatibility. - Selected
comparison strategy. - Required temporary workspace and currently
available free space. - Estimated temporary disk range, including result
repository growth where estimable. - Configured soft and hard workspace
quotas. - Memory limit and relevant engine options. - Key candidate
suggestion, with explicit user confirmation. - Null-key and
duplicate-key risk where discoverable from sampling or indexing. -
Warnings that require user acknowledgment.

An estimate is a range or best-effort value and must be labeled as such.
Never present an estimate as a guarantee. If exact duplicate/null counts
require a scan, identify that scan and its cost rather than silently
doing a full pass.

### Quotas and safe stop

-   Soft quota: warn and allow the user to continue only with an
    explicit acknowledgment where policy permits.
-   Hard quota: do not begin or continue work that would exceed the
    configured hard limit.
-   Safety margin: reserve space for database journal/WAL, rollback, and
    clean shutdown.
-   If free space falls below the safety margin during a job, stop
    safely, close writers, preserve job diagnostics, remove uncommitted
    partial artifacts, and mark the failure as `disk_space`.
-   The quota and safety margin must be configurable within safe bounds
    and visible in settings.

CSV `null_keys` defaults to `error`. The UI must display this default
and identify null-key risk during preflight. The user must not discover
millions of rows into a comparison that the configured null-key policy
will reject when that risk could have been found earlier. If exact
detection requires a scan, provide a preflight scan option or integrate
validation into an explicit indexing phase before the main matching
phase.

**Acceptance criteria** - `PREFLIGHT-001`: Every comparison passes
through preflight. - `PREFLIGHT-002`: Preflight shows strategy,
workspace estimate, available space and quota status. - `PREFLIGHT-003`:
Suggested keys require user confirmation. - `PREFLIGHT-004`: Null-key
default is visibly `error` for CSV. - `PREFLIGHT-005`: Disk exhaustion
below the safety margin stops the job safely and records `disk_space`. -
`PREFLIGHT-006`: Estimates are labeled with confidence/limitations and
are not represented as guarantees.

## 27.6 CSV adapter requirements and error mapping

The CSV adapter must call the existing `compare_csv(...)` API and
preserve its semantics. It must not silently invoke CLI defaults that
write to the current directory.

In particular: - The application must pass explicit output destinations
for every requested export. - The application must disable or omit HTML
output unless the user explicitly requests it and selects a
destination. - The adapter must not rely on implicit `./report.html` or
default `--out-dir` behavior. - The adapter must validate that output
destinations do not collide with either input or with each other. - The
adapter must route progress and cancellation through the engine's
supported progress callback behavior. - The adapter must capture the
engine's summary and error code without parsing human-readable console
output.

### Verified `CsvDiffError.code` values

Inspection of the supplied `csv_diff(9).py` confirms these
machine-readable codes:

  -----------------------------------------------------------------------------------------
  Engine code           Application code             User-facing       Handling
                                                     category          
  --------------------- ---------------------------- ----------------- --------------------
  `empty_file`          `input.empty_file`           Input validation  Identify which input
                                                                       is empty

  `no_header`           `input.no_header`            Input validation  Explain that a
                                                                       header row is
                                                                       required

  `bad_encoding`        `input.bad_encoding`         Input decoding    Show encoding issue
                                                                       and available
                                                                       encoding
                                                                       configuration

  `csv_parse`           `input.csv_parse`            Input parsing     Show side and
                                                                       row/line context
                                                                       when available

  `strict_validation`   `input.strict_validation`    Data validation   Show validation
                                                                       failure and
                                                                       strict-mode context

  `schema`              `compare.schema`             Schema mismatch   Explain missing or
                                                                       incompatible columns

  `null_key`            `compare.null_key`           Key validation    Identify
                                                                       side/row/key context
                                                                       and selected policy

  `bad_option`          `config.invalid_option`      Configuration     Identify invalid
                                                                       option without
                                                                       exposing a traceback

  `output_collision`    `export.output_collision`    Export            Explain input/output
                                                     destination       or output/output
                                                                       collision

  `disk_space`          `resource.disk_space`        Resource limit    Stop safely and
                                                                       explain
                                                                       required/available
                                                                       space

  `storage`             `storage.failure`            Temporary storage Preserve diagnostics
                                                                       and clean
                                                                       uncommitted
                                                                       artifacts

  `input_changed`       `input.changed_during_run`   Source integrity  Invalidate
                                                                       completion and
                                                                       report which input
                                                                       changed
  -----------------------------------------------------------------------------------------

The CLI wrapper also maps `FileNotFoundError` to `file_not_found`,
generic `ValueError` to `invalid_input`, and otherwise to `unexpected`.
The application adapter must independently map missing input paths to
`input.not_found`; it must not depend on CLI text output.

The application may add more granular codes for application-layer
failures, but it must preserve the original engine code in diagnostic
metadata. Do not map unrelated engine codes into a generic error if a
stable mapping exists.

**Acceptance criteria** - `CSV-ADAPTER-001`: Existing `compare_csv(...)`
remains the comparison authority. - `CSV-ADAPTER-002`: Explicit
destinations are required for all requested exports. -
`CSV-ADAPTER-003`: No implicit current-directory report or export
directory is created. - `CSV-ADAPTER-004`: Every verified engine error
code maps to the application code shown above. - `CSV-ADAPTER-005`:
Original engine code and safe diagnostic context are retained. -
`CSV-ADAPTER-006`: Existing callers continue to work without the new
result sink.

## 27.7 Job lifecycle, worker health and sidecar contract

The Python worker is a managed local process. The application service
layer owns its lifecycle and must not treat a spawned process as healthy
merely because it exists.

### Worker protocol

The worker protocol must be versioned and include: -
`protocol_version` - `worker_version` - `request_id` - `job_id` -
message type - timestamp or monotonic sequence - payload

The worker must support `hello`, `health_check`, `start_job`,
`cancel_job`, `job_progress`, `job_completed`, `job_failed`, and
`shutdown` messages. Large source contents and result sets must never
travel through IPC. Pass validated local paths and small configuration
objects only.

### Health contract

-   On startup, the worker must send a protocol/version handshake within
    a configurable startup timeout.
-   While a job is active, it must emit a heartbeat at a documented
    interval.
-   The service must detect a missed-heartbeat threshold and distinguish
    a stalled worker from a long-running comparison that is still
    reporting progress.
-   A health check must report worker state, active job ID, last
    progress sequence, last heartbeat, and protocol version.
-   On unexpected exit, record exit code/signal, last known job state,
    and stderr diagnostics with sensitive values filtered.
-   Restart policy must be explicit: restart the worker for a new job
    after a cleanly handled crash; do not automatically rerun a
    non-idempotent or partially committed job.
-   A job interrupted by worker death is marked `interrupted`, not
    `completed`.
-   Recovery may inspect and clean temporary artifacts, but must not
    publish partial results as complete.
-   Shutdown must request graceful termination, wait for a bounded
    interval, then force-terminate and record the event.

**Acceptance criteria** - `WORKER-001`: Worker startup handshake is
versioned and timeout-protected. - `WORKER-002`: Heartbeats and progress
sequence detect stalls. - `WORKER-003`: Unexpected exit records exit
code and diagnostic context. - `WORKER-004`: A crashed worker cannot
leave a job marked completed. - `WORKER-005`: Restart does not silently
replay an interrupted comparison. - `WORKER-006`: Graceful shutdown and
forced termination are both tested.

## 27.8 Cancellation and partial-result visibility

Cancellation is cooperative and must be honored at every safe
checkpoint: inspection, indexing, matching, result persistence,
finalization and export writing.

Default policy: - A cancelled comparison is not presented as a completed
result. - Partial result rows are not browseable in the normal
completed-results workspace. - Partial result stores are discarded
during cancellation cleanup unless a future resumable-checkpoint feature
is explicitly designed and versioned. - Partial exports remain staged
and are never committed to the user-selected final destination. - A
cancellation record and diagnostic summary may be retained without
exposing partial comparison data as complete.

The export writer must write to a job-scoped staging path, flush and
close it, validate success, then atomically commit/rename where the
filesystem supports it. If cancellation occurs during writing, abort the
staging file and leave any pre-existing destination untouched.
Cross-volume or network destinations may not support atomic rename; use
a documented safe-copy/commit strategy and never delete the previous
destination before the replacement is complete.

**Acceptance criteria** - `CANCEL-001`: Cancellation is tested during
inspection, indexing, matching, repository writes, finalization and
export writes. - `CANCEL-002`: Cancellation during export leaves no
published partial export. - `CANCEL-003`: Existing destination files
remain intact if export commit fails. - `CANCEL-004`: Cancelled jobs are
not shown as completed results. - `CANCEL-005`: Temporary artifacts are
cleaned or marked for recovery if immediate cleanup fails.

## 27.9 Security, privacy and data lifecycle

All comparison processing is local. Source files, result stores and
exports may contain sensitive business or personal information.

Required controls: - Tauri v2 capabilities must be narrowly scoped to
required filesystem and dialog operations. - Do not grant broad
filesystem access to the frontend. - Use strict Content Security Policy.
Avoid unsafe inline script allowances unless a documented, reviewed
exception is unavoidable. - Set IPC payload limits and reject
unexpectedly large messages. - Frontend receives paths, metadata,
progress and bounded result pages, not full multi-gigabyte file
contents. - Validate and normalize paths at the native/service boundary.
Prevent path traversal and symlink/path confusion where relevant. -
Store temporary artifacts in a dedicated workspace with restrictive
permissions appropriate to the OS. - Do not log source record values,
full keys, tokens or sensitive file paths by default. - User-defined
regular expressions must be protected against ReDoS. Apply pattern
length/complexity limits, execution isolation or timeouts where the
chosen regex engine supports them, and adversarial test cases. Do not
execute untrusted patterns on the UI thread. - Result stores and exports
inherit the sensitivity of source data. - Provide a per-job **Delete all
artifacts** action that removes result rows, indexes, staged exports and
job-scoped temporary files after confirmation. - Document that exported
files are outside application control after the user saves or moves
them. - Redaction/masking is a future optional export feature. It must
be explicitly configured and must never alter the canonical stored
comparison result.

**Acceptance criteria** - `SEC-001`: Tauri capabilities grant only the
filesystem/dialog operations required by the app. - `SEC-002`: CSP and
IPC limits are documented and tested. - `SEC-003`: Frontend cannot
request arbitrary unrestricted filesystem reads. - `SEC-004`: Regex
adversarial tests include catastrophic-backtracking patterns and
oversized patterns. - `SEC-005`: Logs do not contain source values by
default. - `SEC-006`: Delete all artifacts removes all job-owned
artifacts and reports any file that could not be removed. - `SEC-007`:
Result storage permissions and retention behavior are documented. -
`SEC-008`: Redaction is not silently applied to canonical data.

## 27.10 Network-mounted files

Network-mounted files are supported only to the extent that the OS and
engine can read them reliably. They may have lower throughput,
intermittent connectivity, file locking, and weaker rename semantics.

An optional **Copy to local workspace for this job** mode may be
provided: - Show source size, estimated local disk requirement and copy
duration only when measurable. - Show that a temporary local copy will
be created. - Verify copied file size and fingerprint before
comparison. - Do not modify or delete the network source. - Clean the
local copy according to the job retention policy. - Enforce the same
workspace quotas and safety margin.

This mode is opt-in. It must not silently duplicate a multi-gigabyte
input.

**Acceptance criteria** - `NET-001`: Network source files are never
modified. - `NET-002`: Local staging is opt-in and shows its disk
cost. - `NET-003`: Staged copies are verified before comparison. -
`NET-004`: Staged copies are removed under retention/deletion policy.

## 27.11 Progress reporting rules

Progress UI must be truthful.

-   Show phase names and absolute counters whenever available: bytes
    read, rows scanned, records matched, records written, bytes
    exported.
-   Show percentage only when the denominator is known and the reported
    work is sufficiently representative.
-   Show ETA only when the rate is stable enough to be meaningful.
-   If percentage or ETA is unavailable, show phase and counters rather
    than fabricated values.
-   Distinguish input scanning from matching, repository persistence,
    finalization and export.
-   Do not reset progress without explaining a phase transition.

**Acceptance criteria** - `PROGRESS-001`: Unknown totals are represented
as unknown, not guessed. - `PROGRESS-002`: Percentage is omitted when
the denominator is not reliable. - `PROGRESS-003`: UI distinguishes
comparison completion from export completion. - `PROGRESS-004`: Progress
updates do not overwhelm IPC or the Vue render loop.

## 27.12 Sessions, source fingerprints and retention

A job is one execution. A session is the retained user-facing workspace
for that job and its results. A profile is a reusable set of comparison
options. These terms must not be used interchangeably.

Retention policy must be implemented before release: - Provide a
configurable retention period or quota-based cleanup policy with a
documented default. - Provide **Keep results** and **Delete after
export** choices. - Explain whether metadata, result records and exports
are retained separately. - Never silently delete a session the user has
explicitly marked to keep. - When a retained session is opened, compare
current source fingerprints if the original paths remain available. - If
either source has changed or is unavailable, show a warning that the
stored result reflects the original source fingerprints. Still allow the
user to inspect the stored result. - A stored result must not be
represented as a fresh comparison of the current source files.

**Acceptance criteria** - `SESSION-001`: Retention default and quota
behavior are explicit in settings and documentation. - `SESSION-002`:
Keep results and Delete after export are available. - `SESSION-003`:
Source fingerprint mismatch is surfaced without blocking stored-result
inspection. - `SESSION-004`: User-kept sessions are not silently
removed. - `SESSION-005`: Delete all artifacts is available per
job/session.

## 27.13 User interface requirements

The application must present CSV and JSON as equally first-class formats
at the product navigation and workflow level. The interface must not be
JSON/CodeMirror-centric.

-   Format-specific controls appear only when relevant.
-   CSV gets a structured table-oriented comparison workspace with
    column, row, key and source-row context.
-   JSON gets a structured tree/record-oriented workspace only for
    features verified by the JSON audit.
-   Shared toolbar actions must have format-neutral names where
    possible.
-   Do not expose internal engine names in ordinary user-facing
    controls.
-   A comparison mode must clearly state whether it is keyed, keyless,
    identity-based, or structural.
-   Ambiguity and match quality must be visible, not buried in a
    diagnostic panel.
-   Preflight is a visible step or expandable section before the user
    starts the full run.
-   The result workspace must remain usable when there are millions of
    results by using bounded pages and server-side filtering.
-   The user must be able to distinguish comparison results from
    generated exports.

**Acceptance criteria** - `UX-001`: CSV and JSON have clear
format-specific workspaces under one consistent shell. - `UX-002`: CSV
workflows do not require code-editor concepts. - `UX-003`: Unsupported
JSON capabilities are not displayed as working controls. - `UX-004`:
Ambiguous results are visible in summary and filters. - `UX-005`:
Preflight warnings are visible before the main run.

## 27.14 Cross-format comparison is deferred

CSV-to-JSON and JSON-to-CSV comparison are not part of the initial
release. They require a separately specified common record model,
field-path normalization, type conversion rules, identity/key rules,
null semantics, array semantics and explicit lossiness reporting.

The adapters must not imply that two formats can be compared simply
because they share an application result schema.

**Acceptance criteria** - `CROSS-001`: Cross-format comparison is absent
or visibly marked as future functionality in v1. - `CROSS-002`: No
implicit CSV-to-JSON conversion is used to claim semantic equivalence. -
`CROSS-003`: A future cross-format feature requires its own PRD section
and fixture corpus.

## 27.15 Test strategy and fixture governance

All fixture corpora must be versioned, checked into the test repository,
and associated with the engine and application versions used to generate
expected results.

### Required CSV fixture matrix

-   Identical files and the same file selected on both sides.
-   Empty file, header-only file and single-record file.
-   Missing or malformed headers.
-   Different column order and differing schemas.
-   Very wide CSV with long fields.
-   Quoted delimiters, embedded newlines and encoding edge cases.
-   Null keys under each supported policy.
-   Duplicate keys with identical and conflicting records.
-   Only duplicate keys.
-   Keyless multiset comparisons.
-   High add/remove/modify rates.
-   Decimal precision and absolute/relative/per-column tolerance.
-   Ignored, renamed and selected columns.
-   Input modified during comparison.
-   Output path colliding with an input or another output.
-   Disk exhaustion and SQLite/storage failure.
-   Cancellation during indexing, matching, result persistence and
    export.

### Required JSON fixture matrix

The final matrix is set by Phase 0A. It must include the supported
root/envelope forms, identity-key matching, no-ID alignment, moves,
nested differences, type mismatches, tolerance, ignore rules,
malformed/repair inputs, and large-input behavior only where the source
implementation supports those features.

### Property-based and fuzz testing

Use property-based tests where the semantics guarantee the property: -
Identical input compared with itself produces no differences. - Column
order changes do not change name-based column matching where that mode
is selected. - Reordering records preserves classification in modes
whose semantics guarantee order independence. - Keyless multiset results
are invariant to row order. - Exact duplicate matches are invariant to
order when content matching makes that guarantee. - Residual duplicate
pairs marked ambiguous are explicitly excluded from reorder-invariance
assertions because current file-order pairing is order-dependent.

Fuzz tests must cover corrupt/truncated CSV and JSON inputs,
quoting/escaping boundaries, unusual Unicode, deeply nested JSON where
supported, and malformed option/pattern inputs. Fuzz failures must not
corrupt source files or publish partial exports.

**Acceptance criteria** - `TEST-001`: Fixture corpus is versioned and
expected outputs are reviewed. - `TEST-002`: Every P0 requirement has
one or more automated tests. - `TEST-003`: Property tests assert only
guaranteed semantics. - `TEST-004`: Corrupt/truncated input fuzzing is
included. - `TEST-005`: Cancellation and disk failure tests verify
cleanup and source safety. - `TEST-006`: JSON parity tests are a release
gate for every JSON capability claimed.

## 27.16 Packaging and release qualification

Version 1 is Windows-only unless a separate resourcing decision adds
macOS/Linux. Do not imply cross-platform support merely because Tauri
supports those operating systems.

Release qualification must include: - Clean Windows machine installation
and first launch. - No development environment, Python installation or
Java installation required unless the final architecture explicitly
documents otherwise. - Sidecar discovery from packaged locations. -
Worker protocol/version compatibility. - Worker startup, health check,
crash, restart and shutdown. - Required runtime bundling and license
notices. - File dialogs, drag/drop and paths containing spaces, Unicode
and long path components. - Restricted user permissions and non-admin
operation. - Code signing plan and SmartScreen/antivirus reputation
considerations. - Upgrade, uninstall and retained-session behavior. -
Temporary workspace permissions and cleanup.

**Acceptance criteria** - `RELEASE-001`: Clean-machine install and run
succeeds without developer tooling. - `RELEASE-002`: Packaged sidecar is
discovered and its version is validated. - `RELEASE-003`: Worker health
and recovery tests pass in the packaged build. - `RELEASE-004`: Code
signing and SmartScreen/AV handling are documented. - `RELEASE-005`:
Windows support versions and known limitations are published.

## 27.17 Rough engineering effort sizing

The following are relative sizing estimates for planning only. They are
not schedule commitments and must be refined after repository inspection
and technical spikes.

  -----------------------------------------------------------------------
  Workstream              Size                    Notes
  ----------------------- ----------------------- -----------------------
  Phase 0A JSON source    M                       Depends on repository
  audit                                           completeness and
                                                  buildability

  Shared contracts and    M                       Includes result model,
  architecture                                    protocol and storage
                                                  design

  CSV result sink and     XL                      Largest new backend
  repository                                      capability; must be
                                                  benchmarked

  CSV adapter and         M                       Reuses existing
  preflight                                       comparison engine

  Job manager,            L                       Includes worker health
  cancellation and                                and cleanup
  recovery                                        

  Tauri shell and Vue     L                       Native integration and
  workflows                                       structured result views

  Export staging and      M                       Includes cancellation
  commit                                          and collision safety

  Security and regex      M                       Depends on regex
  hardening                                       runtime and pattern
                                                  capabilities

  JSON extraction/wrapper L to XL                 Must be re-estimated
                                                  after Phase 0A

  Packaging and release   L                       Windows-only baseline
  qualification                                   
  -----------------------------------------------------------------------

Sizing must be updated with implementation evidence and recorded in the
engineering plan.

## 27.18 Requirement traceability and AI coding-agent workflow

Every implementation task, pull request and AI coding-agent report must
list: - Requirement IDs implemented. - Requirement IDs partially
implemented or deferred. - Decision IDs followed or changed. - Tests
added and test results. - Known limitations and evidence. - Any behavior
that differs from the existing engines.

No task is complete solely because code compiles. Completion requires
the relevant acceptance criteria to pass.

The project requirement register must include the IDs introduced in this
section and map them to implementation tasks and tests. P0 requirements
are release blockers unless a signed product decision explicitly defers
them.

## 27.19 Glossary

  -----------------------------------------------------------------------
  Term                                Definition
  ----------------------------------- -----------------------------------
  Adapter                             Application boundary that invokes
                                      an existing comparison engine and
                                      maps its output into the
                                      application contract

  Ambiguous pair                      Two records paired by a fallback
                                      rule where the engine cannot
                                      establish a unique identity match

  Canonical result                    Versioned application
                                      representation used by summaries,
                                      browsing, filtering and exports

  Comparison job                      One execution of a comparison with
                                      fixed inputs and options

  Keyed comparison                    Record comparison using one or more
                                      selected identity columns

  Keyless comparison                  Record comparison without an
                                      identity key, typically as a
                                      multiset

  Match quality                       Confidence category for a record
                                      match: exact, ambiguous or
                                      unmatched

  Profile                             Reusable comparison configuration

  `record_ref`                        Stable application identifier for a
                                      result record within one job

  `field_path`                        Field/column locator within a
                                      record, represented in a
                                      format-appropriate path syntax

  Result repository                   Disk-backed store for canonical
                                      comparison records and field
                                      differences

  Session                             Retained user-facing workspace for
                                      a job, its results and related
                                      artifacts

  Source fingerprint                  Fingerprint used to identify the
                                      exact source version compared

  Staging export                      Temporary export output not yet
                                      committed to the user-selected
                                      destination

  Worker heartbeat                    Periodic signal indicating that the
                                      managed worker is alive and
                                      responsive
  -----------------------------------------------------------------------

## 27.20 Decision register updates

  -----------------------------------------------------------------------
  Decision ID             Decision                Status
  ----------------------- ----------------------- -----------------------
  `DEC-001`               Preserve the existing   Confirmed
                          CSV comparison engine   
                          as the comparison       
                          authority               

  `DEC-002`               CSV result repository   Confirmed
                          and result sink are     
                          Phase 1 deliverables    

  `DEC-003`               JSON integration is     Confirmed
                          gated by Phase 0A       
                          source audit and parity 
                          evidence                

  `DEC-004`               CSV-first vertical      Confirmed
                          slice proceeds while    
                          JSON audit runs in      
                          parallel                

  `DEC-005`               Windows is the v1       Confirmed
                          target platform unless  
                          separately resourced    

  `DEC-006`               Proposed 8 GB RAM / 20  Proposed, not yet
                          GB free workspace       ratified
                          baseline requires       
                          benchmark ratification  

  `DEC-007`               Cancelled jobs do not   Confirmed default
                          expose partial results  
                          as completed results    

  `DEC-008`               Cross-format comparison Confirmed
                          is deferred             

  `DEC-009`               Residual duplicate-key  Confirmed
                          pairing is              
                          order-dependent and     
                          must be marked          
                          ambiguous               

  `DEC-010`               Retention default must  Open implementation
                          be selected and         decision
                          implemented before      
                          release                 

  `DEC-011`               Network-file local      Confirmed
                          staging is opt-in       

  `DEC-012`               Redaction/masking is    Confirmed
                          deferred and must not   
                          alter canonical results 
  -----------------------------------------------------------------------

## 27.21 P0 release gate checklist

The following are mandatory for the first production release:

-   [ ] CSV engine integration preserves existing comparison behavior.
-   [ ] CSV result sink writes during classification in the comparison
    pass.
-   [ ] Disk-backed result repository supports bounded pagination and
    filtering.
-   [ ] Preflight displays strategy, disk estimate, free space, quotas
    and key/null-key warnings.
-   [ ] CSV null-key default is `error` and is surfaced before the main
    comparison.
-   [ ] No implicit default export paths are used.
-   [ ] Output staging, cancellation and commit behavior protect
    existing destination files.
-   [ ] Worker protocol, heartbeat, stall detection and crash handling
    are implemented.
-   [ ] Source files remain read-only and are never overwritten.
-   [ ] Tauri capabilities, CSP, IPC limits and regex ReDoS safeguards
    are tested.
-   [ ] Delete all artifacts is implemented.
-   [ ] Retention policy and source fingerprint mismatch warning are
    implemented.
-   [ ] CSV fixture, property-based, fuzz, disk-failure and cancellation
    suites pass.
-   [ ] High-difference-rate large-file benchmark and result-store
    growth report exist.
-   [ ] Minimum supported hardware baseline is ratified from benchmark
    evidence.
-   [ ] Windows clean-machine packaging and sidecar qualification pass.
-   [ ] Every P0 requirement has traceable acceptance evidence.
-   [ ] JSON capabilities are only included if Phase 0A and parity gates
    pass.

------------------------------------------------------------------------

# 28. Final Implementation Direction

Build the application around a durable application service layer and a
disk-backed canonical result repository. Integrate the existing CSV
engine first through a backward-compatible result sink. In parallel,
audit the complete JSON source and make an evidence-based integration
decision before promising JSON parity or large-file support.

The primary implementation risk is not the comparison screen. It is
preserving engine semantics while creating a reliable result repository,
resource preflight, job lifecycle, cancellation, export commit and
recovery behavior for very large inputs.

The first usable release must therefore be a complete CSV workflow, not
a superficial shell around both engines. JSON joins that workflow only
when the existing implementation can be integrated and its supported
behavior demonstrated through fixtures and benchmarks.
