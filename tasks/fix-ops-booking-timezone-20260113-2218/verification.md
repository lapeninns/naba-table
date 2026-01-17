---
task: fix-ops-booking-timezone
timestamp_utc: 2026-01-13T22:17:59Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers, github:@qa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Ops booking timezone

- [ ] Same booking rendered on two devices with different device timezones
- [ ] Booking list time matches booking details time
- [ ] Countdown/late indicators behave as expected

## Test outcomes

- [x] Targeted vitest runs for new timezone fallback tests (see `artifacts/test-summary.txt`)
  - `pnpm vitest run src/app/api/ops/bookings/route.test.ts -t "derives fallback ISO timestamps using restaurant timezone"`
  - `pnpm vitest run "src/app/api/ops/bookings/[id]/route.test.ts" -t "derives fallback ISO timestamps using restaurant timezone"`

## Artifacts

- Tests: `artifacts/test-summary.txt`

## Notes

- Full `pnpm test` currently fails due to unrelated pre-existing suites/import errors; not addressed in this task.
- Manual QA via Chrome DevTools MCP is still required for UI-touching changes.
