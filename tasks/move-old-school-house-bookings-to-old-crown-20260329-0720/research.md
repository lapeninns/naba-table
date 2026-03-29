---
task: move-old-school-house-bookings-to-old-crown
timestamp_utc: 2026-03-29T07:20:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Move Old School House bookings to Old Crown

## Requirements

- Functional:
  - Reassign every booking currently attached to the Old School House restaurant to the Old Crown restaurant in the remote Supabase project.
  - Preserve the booking rows themselves; only move their restaurant association unless dependent tables also require aligned updates.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Production data change must be auditable and reversible.
  - Secrets must remain in environment variables; no credentials in source.
  - Supabase must remain remote-only.

## Existing Patterns & Reuse

- Existing operational scripts use service-role access or direct Postgres access:
  - `scripts/debug-restaurants.ts`
  - `scripts/execute-sql.ts`
  - `scripts/purge-restaurant-bookings.ts`
- Booking logic consistently keys restaurant ownership through `bookings.restaurant_id`.
- Additional booking-adjacent tables may reference the same booking rows and derive restaurant context from the booking record rather than storing a separate mutable restaurant binding.

## External Resources

- No external docs required yet; repo-local Supabase scripts and schema are the primary source of truth.

## Constraints & Risks

- Need to confirm the exact source and destination restaurant IDs before running any update.
- Moving bookings across restaurants can invalidate table assignments, soft holds, or restaurant-specific schedule assumptions if dependent data is left unchanged.
- Direct Postgres connectivity from `.env.vercel-production` is not usable from this workspace because password auth fails; the service-role Supabase HTTP path is the working production path.

## Open Questions (owner, due)

- Are there booking-linked rows outside `bookings` that also need to move or be cleared (for example table assignments/holds)? Owner: agent. Due: before execution. Resolved: yes; assignment-linked rows needed cleanup before the venue swap.

## Recommended Direction (with rationale)

- Query Supabase first to identify the exact restaurant IDs and count impacted bookings.
- Inspect booking-linked tables for restaurant-scoped constraints before mutating production data.
- Execute the change in a single audited SQL transaction where possible and record before/after counts in task artifacts.

## Findings

- Production restaurant IDs were confirmed live:
  - Old School House: `a120da71-ba6d-446f-a33a-2e78787abcb0` (`the-old-school-house`)
  - Old Crown Girton: `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c` (`the-old-crown-girton`)
- Preflight found exactly one Old School House booking:
  - Booking `2fd69938-1e03-48c3-a776-34fa4bd3ab36` / reference `LYAGFXAT3Y`
  - Date/time `2026-04-05 12:30`
  - Status `confirmed`
- The booking carried venue-specific assignment state that had to be cleared before the move:
  - 1 table assignment
  - 1 assignment idempotency row
  - 1 confirmation cache row
  - 1 allocation row
  - 1 analytics event row with `restaurant_id`
- The linked customer `c120ec30-295b-4f63-bdca-c8cbaebbcece` belonged only to this single booking, so moving the customer row with the booking was safe.
