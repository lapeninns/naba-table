---
task: seed-oldcrown-staging-bookings
timestamp_utc: 2026-03-19T00:37:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Seed past, present, and future staging bookings

## Requirements

- Functional:
  - Seed some bookings into staging for Old Crown Girton.
  - Include a past date, a present date, and a future date.
  - Use an existing safe seeding path that respects current schema relationships.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Remote-only Supabase access.
  - No secrets in artifacts.

## Existing Patterns & Reuse

- `scripts/generate-bookings-safe.ts` creates customers, bookings, and table assignments using the service-role key.
- Old Crown Girton restaurant id is `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`.
- Current staging project is `ndxmivcrehsacuerwxtm`.

## Constraints & Risks

- Data is synthetic but persistent in staging; keep volume modest.
- Script reuses deterministic customer phone numbers, so repeated runs may attach more bookings to the same seeded customers.

## Recommended Direction (with rationale)

- Run `scripts/generate-bookings-safe.ts` three times for Old Crown Girton with small counts on:
  - `2026-03-18` (past)
  - `2026-03-19` (present)
  - `2026-03-26` (future)
- Verify resulting booking counts by date and sample rows.
