---
task: magic-link-incident-audit
timestamp_utc: 2026-02-19T14:34:32Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and artifacts directory.
- [x] Confirm canonical magic-link send codepath and endpoint callsites.

## Core

- [x] Pull Resend magic-link sends and compute 24h/7d volumes.
- [x] Correlate recipients with `customers`, `bookings`, and membership context.
- [x] Pull Vercel production logs for `/api/auth/signin` and classify statuses.
- [x] Extract repeated 500 error signatures from request logs.

## UI/UX

- [x] Not applicable (no UI change).

## Tests

- [x] Scripted production audit runs completed.
- [x] Artifact sanity checks completed.

## Notes

- Assumptions:
  - Resend subject `Your Nab a Table magic sign-in link` is the canonical sign-in marker.
- Deviations:
  - Direct `SUPABASE_DB_URL` login unavailable in this environment; used service-role API correlation instead.
  - `auth.admin.listUsers` pagination produced `Database error finding users`, so auth-user presence is treated as partial confidence.

## Batched Questions

- Should we patch `/api/auth/signin` now to remove status-differential behavior for unknown emails and block enumeration?
