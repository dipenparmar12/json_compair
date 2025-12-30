# Product Requirements Document (PRD): Ultimate JSON Toolbox

## 1. Product Overview

**Product Name**: Ultimate JSON Toolbox  
**Version**: 1.0  
**Date**: December 30, 2025  
**Description**: A comprehensive, web-based application that serves as a one-stop solution for developers, data engineers, and API designers working with JSON data. The tool combines multiple advanced JSON processing features into a single, fast, privacy-focused platform. All core processing occurs client-side, with optional server support for very large files.

**Vision**: Enable users to perform any JSON-related task efficiently without switching between tools.

**Key Differentiators**:
- Single workspace: Paste JSON once and switch between tools.
- Real-time previews and intelligent error handling.
- Advanced support for nested structures and arrays.
- Superior accuracy and customization compared to existing tools.

## 2. Target Users & Personas

- Developers (debugging APIs)
- API Designers (schema generation, documentation)
- Data Engineers/Analysts (conversions, flattening)
- QA Engineers (data fuzzing)

## 3. Core Features with Input/Output Examples

### 3.1 JSON Schema Generator
**Purpose**: Auto-generate a JSON Schema (Draft 2020-12) from one or more sample JSON objects.

**Key Features**:
- Infer types, required properties, formats (email, uri, date-time).
- Merge multiple samples to detect optional fields.
- Options: Add titles/descriptions, mark arrays as uniqueItems, etc.

**Example 1 – Basic Object**  
**Input**:
```json
{
  "name": "Alice",
  "age": 30,
  "email": "alice@example.com",
  "isActive": true
}
```

**Output**:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/person.schema.json",
  "title": "Person",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "integer" },
    "email": { "type": "string", "format": "email" },
    "isActive": { "type": "boolean" }
  },
  "required": ["name", "age", "email", "isActive"]
}
```

**Example 2 – Nested with Array**  
**Input**:
```json
{
  "user": {
    "id": 1,
    "roles": ["admin", "editor"],
    "profile": {
      "avatar": "https://example.com/avatar.jpg"
    }
  }
}
```

**Output** (relevant excerpt):
```json
{
  "type": "object",
  "properties": {
    "user": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "roles": {
          "type": "array",
          "items": { "type": "string" }
        },
        "profile": {
          "type": "object",
          "properties": {
            "avatar": { "type": "string", "format": "uri" }
          }
        }
      }
    }
  }
}
```

### 3.2 JSON Shaping (Structure Outline)
**Purpose**: Display a compact, human-readable outline of the JSON structure.

**Key Features**:
- Show nesting, array indicators, and optional type hints.
- Collapsible view in UI.

**Example**  
**Input**:
```json
{
  "id": 123,
  "name": "Dpn",
  "address": {
    "home": "123 Main St",
    "city": "Ahmedabad",
    "zipcode": "380015"
  },
  "orders": [
    { "item": "Book", "price": 29.99 },
    { "item": "Pen", "price": 5.49 }
  ]
}
```

**Output** (text representation):
```
{
  "id": number,
  "name": string,
  "address": {
    "home": string,
    "city": string,
    "zipcode": string
  },
  "orders": [
    {
      "item": string,
      "price": number
    }
  ]
}
```

Alternative compact mode:
```
{ id, name, address { home, city, zipcode }, orders [ { item, price } ] }
```

Alternative compact mode with data types:
```
{ id:number, name:string, address { home:string, city:string, zipcode:string }, orders [ { item:string, price:number } ] }
```

### 3.3 JSON Linter / Formatter / Beautifier
**Purpose**: Validate, repair, and prettify JSON.

**Example – Fixing malformed JSON**  
**Input** (minified + errors):
```json
{"name":"Bob" "age":42,"hobbies":["reading", "coding"}}
```

**Output** (auto-fixed & formatted):
```json
{
  "name": "Bob",
  "age": 42,
  "hobbies": [
    "reading",
    "coding"
  ]
}
```

Error message shown: “Inserted missing comma after "Bob" and fixed brackets.”

### 3.4 JSON to CSV (Advanced)
**Purpose**: Flatten JSON (especially arrays of objects) into CSV.

**Example**  
**Input**:
```json
[
  {
    "id": 1,
    "name": "Alice",
    "address": { "city": "NYC", "zip": "10001" },
    "tags": ["premium", "active"]
  },
  {
    "id": 2,
    "name": "Bob",
    "address": { "city": "LA", "zip": "90210" }
  }
]
```

**Output** (CSV with array expansion to rows):
```csv
id,name,address.city,address.zip,tags
1,Alice,NYC,10001,"premium,active"
2,Bob,LA,90210,
```

Alternative mode (one row per array item):
```csv
id,name,address.city,address.zip,tag
1,Alice,NYC,10001,premium
1,Alice,NYC,10001,active
2,Bob,LA,90210,
```

### 3.5 CSV to JSON (Advanced)
**Purpose**: Convert CSV with dot-notation headers back to nested JSON.

**Example**  
**Input** (CSV):
```csv
user.id,user.name,user.address.city,user.address.zip,order.id,order.amount
1,Alice,NYC,10001,101,59.99
1,Alice,NYC,10001,102,29.99
2,Bob,LA,90210,201,15.00
```

**Output**:
```json
[
  {
    "user": {
      "id": 1,
      "name": "Alice",
      "address": { "city": "NYC", "zip": "10001" }
    },
    "order": [
      { "id": 101, "amount": 59.99 },
      { "id": 102, "amount": 29.99 }
    ]
  },
  {
    "user": {
      "id": 2,
      "name": "Bob",
      "address": { "city": "LA", "zip": "90210" }
    },
    "order": [
      { "id": 201, "amount": 15.00 }
    ]
  }
]
```

### 3.6 JSON to Markdown / HTML Table
**Purpose**: Render array of objects as readable table.

**Example**  
**Input** (same as JSON to CSV example, array of 2 users)

**Output** (Markdown):
```markdown
| id | name  | address.city | address.zip | tags              |
|----|-------|--------------|-------------|-------------------|
| 1  | Alice | NYC          | 10001       | premium, active   |
| 2  | Bob   | LA           | 90210       |                   |
```

### 3.7 JSON Flattener / Unflattener
**Flatten Example**  
**Input**:
```json
{
  "user": {
    "name": "Eve",
    "address": { "city": "Paris" }
  },
  "tags": ["a", "b"]
}
```

**Output** (dot notation):
```json
{
  "user.name": "Eve",
  "user.address.city": "Paris",
  "tags[0]": "a",
  "tags[1]": "b"
}
```

**Unflatten** reverses exactly back to original.

---

Absolutely! Here’s the **updated and enhanced version** of your `JSON to Table` utility section — now including:

✅ Deeply nested objects  
✅ Arrays/collections (with index-based or named columns)  
✅ Support for **HTML tables with nested rows/columns** (using `<details>`, `<summary>`, or rowspan/colspan where appropriate)  
✅ Markdown table with **dot-notation flattening** (for simplicity)  
✅ Optional: **Expandable nested HTML tables** for complex structures

---

## ✅ 3.6 JSON to Markdown / HTML Table (Enhanced for Nested & Collections)

### 🎯 Purpose
Render an array of JSON objects as a human-readable, structured table — supporting **deep nesting**, **arrays**, and **collections** — in both **Markdown** (flat) and **HTML** (hierarchical/expansible).

---

### 📥 Input Example (Complex Nested + Collections)
```json
[
  {
    "id": 1,
    "name": "Alice",
    "address": {
      "city": "NYC",
      "zip": "10001",
      "coordinates": { "lat": 40.7128, "lng": -74.0060 }
    },
    "tags": ["premium", "active"],
    "orders": [
      { "orderId": "ORD-001", "amount": 99.99 },
      { "orderId": "ORD-002", "amount": 150.00 }
    ]
  },
  {
    "id": 2,
    "name": "Bob",
    "address": {
      "city": "LA",
      "zip": "90210",
      "coordinates": { "lat": 34.0522, "lng": -118.2437 }
    },
    "tags": [],
    "orders": [
      { "orderId": "ORD-003", "amount": 299.99 }
    ]
  }
]
```

---

## 🖋️ Output Option 1: **Markdown Table (Flattened Dot Notation)**

> Best for simple docs, GitHub READMEs, emails.

```markdown
| id | name  | address.city | address.zip | address.coordinates.lat | address.coordinates.lng | tags[0]     | tags[1]   | orders[0].orderId | orders[0].amount | orders[1].orderId | orders[1].amount |
|----|-------|--------------|-------------|--------------------------|--------------------------|-------------|-----------|-------------------|------------------|-------------------|------------------|
| 1  | Alice | NYC          | 10001       | 40.7128                  | -74.006                  | premium     | active    | ORD-001           | 99.99            | ORD-002           | 150.00           |
| 2  | Bob   | LA           | 90210       | 34.0522                  | -118.2437                |             |           | ORD-003           | 299.99           |                   |                  |
```

> ⚠️ Note: Empty cells for missing array items or null values.

---

## 🌐 Output Option 2: **HTML Table (Nested Rows / Expandable Sections)**

> Best for web UIs, dashboards, documentation portals — supports **expandable nested data**.

```html
<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial;">
  <thead>
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Address</th>
      <th>Tags</th>
      <th>Orders</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Alice</td>
      <td>
        <details>
          <summary>View Address</summary>
          <ul style="margin: 5px 0; padding-left: 20px;">
            <li><strong>City:</strong> NYC</li>
            <li><strong>Zip:</strong> 10001</li>
            <li><strong>Coordinates:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li><strong>Lat:</strong> 40.7128</li>
                <li><strong>Lng:</strong> -74.0060</li>
              </ul>
            </li>
          </ul>
        </details>
      </td>
      <td>
        <ul style="margin: 5px 0; padding-left: 20px;">
          <li>premium</li>
          <li>active</li>
        </ul>
      </td>
      <td>
        <details>
          <summary>2 Orders</summary>
          <table border="1" cellpadding="3" cellspacing="0" style="margin-top: 5px; font-size: 0.9em; border-collapse: collapse;">
            <tr><th>Order ID</th><th>Amount</th></tr>
            <tr><td>ORD-001</td><td>$99.99</td></tr>
            <tr><td>ORD-002</td><td>$150.00</td></tr>
          </table>
        </details>
      </td>
    </tr>
    <tr>
      <td>2</td>
      <td>Bob</td>
      <td>
        <details>
          <summary>View Address</summary>
          <ul style="margin: 5px 0; padding-left: 20px;">
            <li><strong>City:</strong> LA</li>
            <li><strong>Zip:</strong> 90210</li>
            <li><strong>Coordinates:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li><strong>Lat:</strong> 34.0522</li>
                <li><strong>Lng:</strong> -118.2437</li>
              </ul>
            </li>
          </ul>
        </details>
      </td>
      <td><em>(none)</em></td>
      <td>
        <details>
          <summary>1 Order</summary>
          <table border="1" cellpadding="3" cellspacing="0" style="margin-top: 5px; font-size: 0.9em; border-collapse: collapse;">
            <tr><th>Order ID</th><th>Amount</th></tr>
            <tr><td>ORD-003</td><td>$299.99</td></tr>
          </table>
        </details>
      </td>
    </tr>
  </tbody>
</table>
```

> ✅ **Features**:
- Uses `<details>`/`<summary>` for collapsible sections.
- Nested tables inside cells for collections (like `orders`).
- Clean styling for readability.
- Handles empty arrays gracefully (`<em>(none)</em>`).

---

## 🧩 Output Option 3: **HTML Table with Rowspan/Colspan (For Strict Tabular Layout)**

> For cases where you want strict grid layout — e.g., reporting tools, PDF exports.

```html
<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial;">
  <thead>
    <tr>
      <th rowspan="2">ID</th>
      <th rowspan="2">Name</th>
      <th colspan="2">Address</th>
      <th rowspan="2">Tags</th>
      <th colspan="2">Orders</th>
    </tr>
    <tr>
      <th>City</th>
      <th>Zip</th>
      <th>Order ID</th>
      <th>Amount</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="2">1</td>
      <td rowspan="2">Alice</td>
      <td rowspan="2">NYC</td>
      <td rowspan="2">10001</td>
      <td rowspan="2">premium, active</td>
      <td>ORD-001</td>
      <td>$99.99</td>
    </tr>
    <tr>
      <td>ORD-002</td>
      <td>$150.00</td>
    </tr>
    <tr>
      <td rowspan="1">2</td>
      <td rowspan="1">Bob</td>
      <td rowspan="1">LA</td>
      <td rowspan="1">90210</td>
      <td rowspan="1"><em>(none)</em></td>
      <td>ORD-003</td>
      <td>$299.99</td>
    </tr>
  </tbody>
</table>
```

> ⚠️ Note: Uses `rowspan` to avoid duplicating parent row data — ideal for flat reports.

---

## 🛠️ Tool Options You Can Offer Users

| Feature                     | Description                                                                 |
|----------------------------|-----------------------------------------------------------------------------|
| `flatten: true/false`      | Toggle between dot-notation (Markdown) vs hierarchical (HTML)               |
| `arrayMode: "index"|"named"` | For arrays: use `[0]`, `[1]` or generate column names like `tag_1`, `tag_2` |
| `expandNested: true/false` | Enable `<details>` expanders in HTML output                                 |
| `includeEmpty: true/false` | Show empty/null fields or skip them                                         |
| `format: "markdown"|"html"`| Choose output format                                                        |

---

## 💡 Pro Tip: Auto-Detect Structure

Your tool can auto-detect:
- If input is an array → render as table
- If input is object → render as key-value list (or single-row table)
- If arrays contain objects → render nested tables or expandable lists

---

Let me know if you want:
- A Python/JS function to generate these outputs
- CLI flags for the above options
- Integration with VS Code or Jupyter
- Export to PDF/Excel from these tables

You’re building something truly powerful, this will be a game-changer for devs working with complex JSON data! 🚀

### 3.8 JSON Randomizer / Fuzzer
**Purpose**: Generate random valid JSON from schema or sample.

**Example** (using schema from 3.1 Example 1) and also supports 3.* input structures:

**Generated Output** (one of many possible):
```json
{
  "name": "John Doe",
  "age": 45,
  "email": "john.doe45@example.org",
  "isActive": false
}
```

Fuzz mode might produce edge cases: age: 0, age: 999999, email: very long string, etc.

## 4. Additional Features (Repeated from previous PRD)
- Shared workspace across tools
- File upload/download
- History (local storage)
- Real-time error highlighting

This updated PRD now includes concrete input/output examples for every core feature, making requirements significantly clearer for design, development, and testing teams.