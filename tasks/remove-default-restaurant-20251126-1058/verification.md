---
task: remove-default-restaurant
timestamp_utc: 2025-11-26T10:58:00Z
status: pending
summary: Pending implementation; need to validate APIs and UI entry points without default restaurant.
---

# Verification Plan

- [ ] Bookings/availability API return 400 with clear message when restaurant id/slug is absent.
- [ ] UI landing links render neutral path or prompt selection (no hardcoded slug).
- [ ] All tests updated and passing.
- [ ] Env docs updated (no White Horse defaults).
