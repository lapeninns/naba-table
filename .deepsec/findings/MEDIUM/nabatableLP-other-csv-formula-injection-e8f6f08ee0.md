# [MEDIUM] Customer CSV export allows spreadsheet formula injection

**File:** [`src/app/api/ops/customers/export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/customers/export/route.ts#L38-L136) (lines 38, 39, 40, 121, 136)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The export writes customer-controlled fields such as name, email, and phone directly into CSV columns, then passes the records to `generateCSV`. The shared CSV helper only quotes commas, quotes, and newlines; it does not neutralize values starting with spreadsheet formula prefixes such as `=`, `+`, `-`, `@`, tab, or carriage return. A guest can create a customer value like `=HYPERLINK(...)`; when staff export guests and open the CSV in Excel/Sheets, the formula can execute in the spreadsheet context and potentially exfiltrate data or trick the operator.

## Recommendation

Sanitize CSV cell values before export, preferably in `generateCSV`, by forcing all exported user-controlled values to literal text. Prefix dangerous formula-leading values with an apostrophe or use an XLSX writer that sets explicit string cell types.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
