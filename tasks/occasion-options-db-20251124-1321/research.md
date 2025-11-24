---
task: occasion-options-db
timestamp_utc: 2025-11-24T13:24:36Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Occasion options should be fetched from DB

## Requirements

- Functional:
  - Occasion options shown in the reservation wizard must reflect the `booking_occasions` records stored in Supabase.
  - Booking creation/update must accept any active occasion key from the database (no hardcoded allowlist).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing wizard UX and validations; no regressions to accessibility.
  - Keep server-side validation fast (re-use cached catalog where possible).

## Existing Patterns & Reuse

- Occasion data already flows from the `/api/restaurants/[slug]/schedule` endpoint, which in turn calls `getOccasionCatalog()` (Supabase-backed).
- Server-side booking mutations currently call `ensureBookingType` (lib/enums) which uses a hardcoded enum and rejects DB-defined keys (e.g., `christmas_party`, `curry_and_carols`).
- New validation helper can reuse the cached catalog in `server/occasions/catalog.ts`.

## External Resources

- None yet — will add if used.

## Constraints & Risks

- Changing validation must not allow blank/invalid values.
- Scripts that clone bookings also rely on booking type normalization; need to keep them functional.

## Open Questions (owner, due)

- Q: Do we need a public occasions endpoint for guests? (Not required for this fix; schedule already embeds catalog.)
  A: Use existing catalog fetch on the server side.

## Recommended Direction (with rationale)

- Replace hardcoded booking-type validation with catalog-backed checks:
  - Add a helper that verifies a key exists and is active in the cached/fresh occasion catalog.
  - Update booking create/update flows and cloning script to use the helper (with safe fallback in the script).
- Relax front-end/shared `ensureBookingType` to accept any non-empty string so UI/schema no longer block DB-defined keys.
