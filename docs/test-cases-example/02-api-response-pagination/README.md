# Test Case 02: REST API Response Evolution & Restructuring

## Overview
Demonstrates payload comparison when a REST API moves pagination parameters into a nested `meta.pagination` envelope and updates item fields.

## Key Diffs Highlighted:
- ❌ **Removed Flat Pagination Keys**: `page`, `per_page`, `total_records` at top level replaced by standard `meta` envelope.
- ➕ **Added Nested Envelope**: `meta.pagination` object with `current_page`, `total_pages`, `has_next`.
- ✏️ **Value Changes in Products**:
  - `PROD-101` price dropped from `199.99` to `179.99`.
  - `PROD-102` `in_stock` updated from `false` to `true`.
  - Category updated from `"Audio"` to `"Audio & Sound"`.
  - New properties `rating` added to both product objects.
- 📋 **Tag Array Expansion**: New tags added to product tags arrays.
