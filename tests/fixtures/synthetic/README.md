# Synthetic fixtures

Generated with `tools/gen_dataset.js` (seed 1). No real data. Each pair is `<name>_a` / `<name>_b`.

| Pair | Command options | What it covers |
|---|---|---|
| identical | csv, 400 rows, 12 cols, `identical` | no differences |
| modified | json, 300 rows, `changed:10` | 10% of values differ, same ids |
| wide | csv, 20 rows, 400 cols, `changed:5` | header row longer than data rows |
| nested | nested, 150 rows, 16 cols, `changed:5` | objects holding objects and arrays |
| schema_mismatch | csv, 400 rows, `schema` | B drops two columns, renames one, adds two |
| reordered | json, 300 rows, `reordered` | same records, different order |
| unrelated | json, 300 rows, `different` | no ids or values in common |
| add_remove | json, 300 rows, `addremove:10` | records on one side only |
| multiline_escaped | csv, 300 rows, 10 cols, `changed:10 --messy` | quoted commas, quotes, newlines, edge spaces |

Malformed input (hand-written):

- `malformed_truncated.json` — first 3,000 bytes of `modified_a.json`
- `malformed_ragged.csv` — short row, long row, unterminated quote
- `malformed_python_dict.txt` — Python literals, tuple, trailing comma
