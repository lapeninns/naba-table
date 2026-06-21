---
task: booking-table-fit-precheck
timestamp_utc: 2026-04-13T17:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [bookingValidationUnified]
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Local server: `NEXT_DEV_PORT=3001 pnpm dev`
- Dev advisory harness: `http://localhost:3001/dev/guest-booking-plan-alert`
  - Weekend advisory rendered
  - Override-date advisory rendered
  - No console errors; only expected PostHog debug logs in dev
- Dev capacity harness: `http://localhost:3001/dev/guest-booking-capacity`
  - Guest-facing capacity failure alert rendered
  - Alternatives panel and mock table availability remained visible
  - No console errors; only expected PostHog debug logs in dev

## Test Outcomes

- `pnpm vitest run tests/server/capacity/seatability.test.ts tests/server/public-bookings-route.test.ts tests/reserve/plan-step-advisory.test.ts tests/reserve/review-step-capacity-error.test.tsx`
- `pnpm typecheck`
- Result: passed

## Artifacts

- `/Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-table-fit-precheck-20260413-1755/artifacts/guest-booking-plan-alert-dev.png`
- `/Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-table-fit-precheck-20260413-1755/artifacts/guest-booking-capacity-dev.png`
- `/Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-table-fit-precheck-20260413-1755/artifacts/booking-route-404.png`

## Known Issues

- [ ] `next-env.d.ts` was auto-updated by Next dev to point at `.next/dev/types/routes.d.ts` during local verification. This is an incidental dev-server change, not part of the feature logic.
