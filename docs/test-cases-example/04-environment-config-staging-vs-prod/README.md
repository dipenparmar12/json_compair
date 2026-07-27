# Test Case 04: Environment Configuration Diff (Staging vs Production)

## Overview
Demonstrates comparing application deployment configurations between Staging and Production environments to catch misconfigurations, pool size mismatches, or unexpected feature flags.

## Key Differences:
- 🌐 **Environment & Version**: `staging` (2.4.0-rc1) vs `production` (2.4.0).
- ⚡ **Server Workers**: Scale from 2 worker threads in staging to 16 in prod.
- 🔒 **Database Security & Pool**: Staging uses unencrypted `ssl_enabled: false` and pool size 5; Prod enforces `ssl_enabled: true` and pool size 50.
- 📝 **Logging Configuration**: `level: debug` vs `level: info`, `format: text` vs `format: json`.
- 🚩 **Feature Flags**: Experimental flags (`enable_ai_search`, `enable_beta_checkout`) are active in staging but disabled in prod; rate limiting is enforced in prod.
