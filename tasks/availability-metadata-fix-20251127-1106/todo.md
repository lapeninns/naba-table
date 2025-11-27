---
task: availability-metadata-fix
timestamp_utc: 2025-11-27T11:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Update ops booking API list response to include restaurant slug/timezone/interval.
- [x] Update ops booking patch response to include restaurant metadata.
- [x] Align shared types (OpsBookingListItem) with new fields.
- [x] Map ops bookings client data to pass slug/timezone into EditBookingDialog with fallbacks.

## Verification

- [x] Type check / lint or targeted tests.
- [ ] Manual QA via Chrome DevTools MCP: open ops booking edit dialog, availability loads (record artifact if possible).
- [ ] Update verification.md with results and any artifacts paths.
