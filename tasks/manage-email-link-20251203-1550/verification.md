---
task: manage-email-link
timestamp_utc: 2025-12-03T15:50:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Summary

- Booking email links now derive their origin from `NEXT_PUBLIC_SITE_URL`/`SITE_URL` (with fallback to the existing app URL), preventing localhost hosts in production emails.

## Tests

- [ ] Unit/logic check (not run; change is deterministic string construction)

## Manual QA

- Not applicable (email content only); no UI changes.

## Artifacts

- None (logic-only change).

## Known Issues

- None noted.
