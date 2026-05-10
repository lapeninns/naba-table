# [MEDIUM] Guest-controlled booking fields can reach CSV exports as spreadsheet formulas

**File:** [`server/ops/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/bookings.ts#L362-L478) (lines 362, 363, 364, 365, 475, 476, 477, 478)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getTodayBookingsSummary selects and returns guest-controlled booking fields such as customer_name, customer_email, customer_phone, and notes without export-context neutralization. The traced bookings export route passes these values to generateCSV, whose escaping only handles commas, quotes, and newlines and does not neutralize leading formula characters such as =, +, -, @, tab, or carriage return. A guest can submit a booking name or note like =HYPERLINK(...) and, when staff export and open the CSV in Excel or Sheets, the spreadsheet may execute the formula.

## Recommendation

Neutralize CSV formula prefixes in the shared CSV generator or at every export sink by prefixing formula-like cells with a single quote and preserving normal CSV quoting. Apply this to all user-controlled string fields before returning the CSV response.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
