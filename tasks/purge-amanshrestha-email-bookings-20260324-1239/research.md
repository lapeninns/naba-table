---
task: purge-amanshrestha-email-bookings
timestamp_utc: 2026-03-24T12:39:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Purge bookings for masked guest email

## Requirements

- Preview the existing bookings that match a single guest email in production.
- Delete all booking records and booking-linked operational rows for that same email after the preview.

## Existing Patterns & Reuse

- `scripts/purge-restaurant-bookings.ts` is the canonical hard-delete reference for booking-linked rows.
- `src/app/api/ops/bookings/route.ts` already supports email filtering for preview semantics.
- No existing repo tool hard-deletes bookings scoped by email.

## Constraints & Risks

- Target is production, so the operation is irreversible once committed.
- Scope must be exact-match by normalized email only.
- PII should stay minimized in task artifacts; store counts/IDs instead of full guest details.
- Use remote-only Supabase access; do not run local DB flows.

## Open Questions

- None. User confirmed production and requested preview of existing bookings before deletion.

## Recommended Direction

- Use the production env file locally only to source credentials.
- Run a read-only preview against production, including dependent-row counts.
- Execute a single transaction that deletes child rows first, then bookings, then verify zero remaining rows for the target email.
