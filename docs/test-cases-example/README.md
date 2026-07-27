# JSON Compare - Public Example Test Cases

Welcome to the **JSON Compare (`json_compair`)** public test case suite. This collection contains world-friendly, real-world examples designed to showcase the capabilities, comparison philosophy, and visual alignment features of the JSON Compare tool.

---

## 🎯 Our Philosophy

**`json_compair`** is a privacy-first, client-side web application designed for developers, DevOps engineers, QA teams, and data analysts to compare, format, clean, and analyze JSON and CSV data effortlessly.

Key design principles:
1. **100% Client-Side Privacy**: Your data stays in your browser and is never transmitted to an external server.
2. **Structure-Aware Comparison**: Line-by-line and block alignment so added, modified, deleted, or reordered keys are clearly highlighted.
3. **Array & Collection Support**: Handles array element reordering, element insertion, deletion, and item property mutations.
4. **Developer-Friendly Tools**: Auto-formatting, key sorting, CSV conversion, selective key filtering, and instant sharing via compressed URL hashes or ZIP snapshots.

---

## 📁 Included Example Test Cases

| Case | Scenario | Description | Key Diff Features Demonstrated |
|---|---|---|---|
| [`00-quick-simple-example`](./00-quick-simple-example/) | Quick Start | Ultra-simple 5-line JSON with 3 easy diffs | 2 value edits (`age`, `city`), 1 key addition (`department`) |
| [`01-user-profile-v1-vs-v2`](./01-user-profile-v1-vs-v2/) | User Profile Schema Migration | Upgrading a user profile object from API v1 to v2 schema | Field additions, deletions, type mutations, nested address updates |
| [`02-api-response-pagination`](./02-api-response-pagination/) | REST API Response Evolution | REST API payload changes between microservice versions | Restructured pagination meta, object key additions, modified nested data |
| [`03-array-item-reordering-and-mutation`](./03-array-item-reordering-and-mutation/) | Array Collection & Reordering | Server cluster node list with reordered elements and node updates | Array item reordering, item addition/removal, array element diffing |
| [`04-environment-config-staging-vs-prod`](./04-environment-config-staging-vs-prod/) | Staging vs Prod Environment Config | Comparing application config between Staging and Production | Environment variable mismatches, feature flags, secret maskings, pool sizes |
| [`05-ecommerce-order-state-changes`](./05-ecommerce-order-state-changes/) | E-Commerce Order Lifecycle | Comparing an order when placed vs when fulfilled | Transactional state changes, price/tax calculations, line item additions |

---

## 🚀 How to Use These Examples

### In the Web Interface
You can load these examples directly in the app using the **More ⋯ → Examples** dropdown in the top toolbar:
- **👤 User Profile (v1 vs v2)** -> `01-user-profile-v1-vs-v2`
- **🚀 API Response (v1 vs v2)** -> `02-api-response-pagination`
- **📋 Array Reordering & Collection Diff** -> `03-array-item-reordering-and-mutation`
- **⚙️ App Config (Staging vs Prod)** -> `04-environment-config-staging-vs-prod`
- **🛒 E-Commerce Order State** -> `05-ecommerce-order-state-changes`

### For Testing & Benchmarking
You can also copy the `left-content.json` and `right-content.json` files from any example directory into the Left and Right editor panes to test features such as:
- **Auto Format JSON**: Cleans and indents raw or minified JSON.
- **Sort JSON Keys**: Sorts object keys alphabetically before diffing.
- **Ignore Keys/Patterns**: Test masking out dynamic fields like `timestamp`, `session_id`, or `checksum`.
- **Export / Share Snapshot**: Package any comparison state into a ZIP snapshot or compressed shareable URL.
