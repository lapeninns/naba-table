# [MEDIUM] Guest-controlled booking fields are exported to CSV without formula neutralization

**File:** [`src/app/api/ops/bookings/export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/export/route.ts#L89-L113) (lines 89, 94, 97, 98, 101, 112, 113)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The export builds a CSV from booking fields such as customerName, customerEmail, customerPhone, allergies, profileNotes, and notes. Public booking creation accepts guest-controlled name and notes and persists them into the booking record; getTodayBookingsSummary maps those values back into summary.bookings. The shared CSV helper only quotes commas, quotes, and newlines, and does not neutralize values beginning with formula metacharacters such as =, +, -, @, or leading tab/space variants. A malicious guest can create a booking whose name or notes start with a spreadsheet formula; when staff export and open the CSV in Excel/Sheets/LibreOffice, that formula may execute and can exfiltrate sheet data or trigger dangerous spreadsheet behavior.

## Recommendation

Centralize CSV cell hardening in the CSV helper before quoting. Prefix formula-like cells with an apostrophe or otherwise neutralize values matching leading whitespace followed by =, +, -, @, tab, CR, or LF, then apply normal CSV escaping. Add tests covering exported guest name, email, phone, notes, and array fields.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
