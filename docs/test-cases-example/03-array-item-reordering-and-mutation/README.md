# Test Case 03: Array Item Reordering & Collection Mutation

## Overview
Demonstrates how `json_compair` compares array collections where items have been reordered, updated, replaced, or scaled.

## Key Differences:
- 🔄 **Array Reordering**: Node `us-west-2a` shifted above `us-east-1b`.
- ⚡ **Item Upgrades**: `us-east-1a` CPU upgraded from `16` to `32`, RAM doubled from `64` to `128`, and service `"metrics_exporter"` added.
- 🟢 **Status Repair**: `us-west-2a` status changed from `"degraded"` to `"healthy"`.
- ❌ **Node Removal**: `eu-central-1a` was decommissioned.
- ➕ **Node Addition**: `ap-southeast-1a` was provisioned in Asia region.

## Tip:
Use the **Sort JSON Keys** tool button in `json_compair` to automatically order array items or object keys for cleaner diff alignment!
