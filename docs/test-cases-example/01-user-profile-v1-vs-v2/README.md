# Test Case 01: User Profile Schema Migration (V1 vs V2)

## Overview
This test case demonstrates how `json_compair` highlights schema changes when migrating an API from user profile V1 to V2.

## What changed between Left (V1) and Right (V2):
- ❌ **Removed Field**: `legacy_id` was deprecated and deleted in V2.
- ✏️ **Modified Values**:
  - `status`: changed from `"pending_verification"` to `"active"`.
  - `role`: promoted from `"editor"` to `"admin"`.
  - `profile.first_name`: updated from `"Alex"` to `"Alexander"`.
  - `profile.avatar_url`: format updated to `.webp` CDN path.
  - `account.email_verified`: changed from `false` to `true`.
- ➕ **Added Fields**:
  - `profile.address.suite`: added property inside nested `address` object.
  - `preferences`: new nested object containing `theme`, `language`, and `notifications`.
  - `account.mfa_enabled`: new security flag.
- 📋 **Array Updates**:
  - `roles`: `"system_administrator"` was appended to the list.

## Why this is useful:
When upgrading user database models or API schemas, backend and QA engineers can use `json_compair` to verify that migrations don't silently drop fields or break nested contracts.
