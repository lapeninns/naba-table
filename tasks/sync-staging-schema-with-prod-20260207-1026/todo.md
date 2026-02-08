---
task: sync-staging-schema-with-prod
timestamp_utc: 2026-02-07T10:26:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

- [x] Confirm production project ref and credentials are correct.
- [x] Create new staging project (`ndxmivcrehsacuerwxtm`).
- [x] Restore production `public` schema into new staging (schema-only).
- [x] Seed config-only data (restaurants + inventory + scheduling).
- [x] Verify no customers/bookings/assignments data copied.
- [x] Record evidence in `verification.md` and `artifacts/`.
