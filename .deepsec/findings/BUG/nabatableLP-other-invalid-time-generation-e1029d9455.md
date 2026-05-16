# [BUG] Lunch booking generator emits invalid minute values

**File:** [`scripts/seed-bookings-week.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/seed-bookings-week.ts#L205-L213) (lines 205, 207, 209, 213)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-invalid-time-generation`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

Lunch minutes are generated with Math.random() \* 105 and then formatted directly into HH:mm:ss strings, producing values like 12:104:00. A large fraction of lunch inserts will fail validation or create malformed booking times if the database accepts them.

## Recommendation

Generate minutes in the 0-59 range, or decompose offsets into hour and minute components as the dinner path does.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-21)
