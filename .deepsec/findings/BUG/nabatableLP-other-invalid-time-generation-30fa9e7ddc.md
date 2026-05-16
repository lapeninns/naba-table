# [BUG] Lunch booking generator creates invalid minute values

**File:** [`scripts/seed-bookings-week.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/seed-bookings-week.ts#L207-L213) (lines 207, 209, 213)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-invalid-time-generation`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

Lunch minutes are generated with Math.random() \* 105, then embedded directly into HH:mm:ss strings. This can produce invalid times such as 12:90:00 and 14:90:00, causing insert failures or malformed seed data depending on database validation.

## Recommendation

Generate minutes in the 0-59 range or normalize a total offset into hour/minute components before formatting.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-21)
