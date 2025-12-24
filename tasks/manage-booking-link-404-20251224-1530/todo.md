---
task: manage-booking-link-404
timestamp_utc: 2025-12-24T15:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Verify env base URL (`NEXT_PUBLIC_SITE_URL`/`SITE_URL`) used in manage links matches deployment.
- [ ] Identify a booking with failing manage link (id + token) for reproduction (redact token in logs).

## Core

- [ ] Inspect booking row to confirm `confirmation_token` presence and expiry.
- [ ] Ensure API GET `/api/bookings/{id}` returns booking when token is valid; adjust token validation or response mapping if needed.
- [ ] Confirm email link builder includes token and correct host; adjust if env mismatch found.

## UI/UX

- [ ] Validate booking detail page renders with token-only access (no auth) and surfaces errors cleanly.

## Tests

- [ ] Add/extend tests for token success, token not found (404), token expired (410), token mismatch (403), missing token (401) for GET `/api/bookings/{id}`.

## Notes

- Assumptions: Token-based access is allowed for read-only guest view; no DB schema changes.
- Deviations: None yet.

## Batched Questions

- Provide a specific failing link (booking id + domain; token optional) to speed reproduction.
