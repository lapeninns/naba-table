# [MEDIUM] Guest-controlled booking fields flow into CSV export without formula neutralization

**File:** [`server/ops/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/bookings.ts#L475-L482) (lines 475, 476, 477, 478, 482)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csv-formula-injection`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getTodayBookingsSummary returns guest-controlled fields such as customerName, notes, customerEmail, and customerPhone. The public booking API accepts name and notes and persists them, and the traced /api/ops/bookings/export route passes these summary fields to generateCSV, whose escaping only quotes commas, quotes, and newlines. A guest can submit a value beginning with =, +, -, or @; when staff export and open the CSV in spreadsheet software, it may execute as a formula.

## Recommendation

Neutralize spreadsheet formula prefixes in the CSV export path or shared CSV helper before writing cells, for example by prefixing dangerous leading characters after trimming leading control whitespace. Add regression tests for =, +, -, @, tab, and carriage-return variants.

## Revalidation

**Verdict:** fixed

`server/ops/bookings.ts` can continue returning domain values because `src/app/api/ops/bookings/export/route.ts` writes them through `generateCSV`, whose shared `escapeCSVField` neutralizes formula-leading cells. Covered by `tests/lib/csv-export.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
