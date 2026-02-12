---
task: ops-email-delivery-page
timestamp_utc: 2026-02-05T23:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Email Delivery Page

## Requirements

- Functional:
  - Ops users can view a restaurant-scoped feed of email delivery attempts.
  - Default range: last 7 days.
  - Can filter by status / recipient / message id / booking reference / template type / email type.
  - Each grouped attempt links to its booking in the bookings page (focus param).
- Non-functional:
  - Tenant-safe: membership enforced for the restaurant.
  - Read-only.
  - Degrades gracefully if `email_delivery_log` is missing/unqueryable.

## Existing Patterns & Reuse

- Sidebar sections: `src/components/features/ops-shell/navigation.tsx`.
- Ops page patterns: `OpsPageHeader`, `OpsPageToolbar`.
- Delivery log types + grouping: `types/emailDelivery.ts`, `src/lib/email-delivery/grouping.ts`.
- Auth/membership guards: `server/auth/guards.ts`.

## Constraints & Risks

- `email_delivery_log` may be missing or absent from schema cache in some environments.
- Must not touch `docs/DATABASE_MIGRATIONS.md`.
