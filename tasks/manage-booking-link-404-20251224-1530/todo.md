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

- [x] Verify env base URL (`NEXT_PUBLIC_SITE_URL`/`SITE_URL`) used in manage links matches deployment.
- [x] Identify a booking with failing manage link (id + token) for reproduction (redact token in logs).

## Core

- [x] Inspect booking row to confirm `confirmation_token` presence and expiry.
- [x] Ensure API GET `/api/bookings/{id}` returns booking when token is valid; adjust token validation or response mapping if needed.
- [x] Add fallback for bookings with null/missing confirmation_token - backfill token on first access.
- [x] Confirm email link builder includes token and correct host; adjust if env mismatch found.

## UI/UX

- [x] Validate booking detail page renders with token-only access (no auth) and surfaces errors cleanly.

## Tests

- [x] Add/extend tests for token success, token not found (404), token expired (410), token mismatch (403), missing token (401) for GET `/api/bookings/{id}`.
- [x] Add test for null stored token backfill case.

## Notes

- Assumptions: Token-based access is allowed for read-only guest view; no DB schema changes.
- Root cause: Bookings created before confirmation_token feature or via code paths that didn't generate tokens have null confirmation_token, causing 404 when email links include a token that doesn't exist in any row.
- Fix: Added fallback that looks up booking by ID when token not found; if booking exists with null token, we backfill the provided token and serve the booking.

## Batched Questions

- None remaining.
