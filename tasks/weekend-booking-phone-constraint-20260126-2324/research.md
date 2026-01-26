---
task: weekend-booking-phone-constraint
timestamp_utc: 2026-01-26T23:24:27Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Weekend Booking Failures After Drinks Removal

## Requirements

- Functional:
- Booking creation must not 500 when contact phone is missing.
- Customer upsert inputs must satisfy `customers_phone_check` (length 7–20).
- Non-functional (a11y, perf, security, privacy, i18n):
- Fail fast at the API boundary instead of surfacing DB constraint errors.

## Existing Patterns & Reuse

- Canonical booking creation paths:
- `src/app/api/ops/bookings/route.ts` is the canonical ops creation path.
- Customer upsert logic:
- `server/customers.ts::upsertCustomer` performs the write to `customers`.
- Contact validation:
- Shared validation lives in `reserve/shared/validation/contact.ts`.
- Profile validation already encodes the 7–20 digit constraint in `lib/profile/schema.ts`.

## External Resources

- N/A (codebase-local investigation)

## Constraints & Risks

- Supabase is remote-only; no local DB migrations.
- Must keep single canonical path and avoid shims.
- Must respect DB constraints (`customers_phone_check`).
- Root cause found: fallback phone generation could exceed 20 characters.
  - `ensureFallbackContact` used `slug.slice(0, 24)` and returned `000-${slug}`.
  - This yields up to 28 characters and violates the check constraint on insert.

## Open Questions (owner, due)

- Q: Why is this observed primarily on Fri/Sat/Sun?
  A: Hypothesis: weekend flow uses fallback contact paths more frequently due to drinks/meal-type inference changes.

## Recommended Direction (with rationale)

- Centralize the phone-length constraint (7–20) in shared validation.
- Generate a constraint-safe fallback phone (digits only, max length 20) in the canonical ops route.
- Align public booking schemas to the DB constraint to reduce future 500s.
