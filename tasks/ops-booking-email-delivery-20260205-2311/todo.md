---
task: ops-booking-email-delivery
timestamp_utc: 2026-02-05T23:11:13Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Backend

- [x] Add shared delivery types: `types/emailDelivery.ts`
- [x] Refactor `server/emails/email-delivery-log.ts` to use shared types
- [x] Add `listEmailDeliveryEventsForBooking(...)` helper
- [x] Add route `GET /api/ops/bookings/[id]/email-delivery`

## Frontend

- [x] Extend ops booking service with `getBookingEmailDeliveryLog(...)`
- [x] Add hook `useOpsBookingEmailDeliveryLog`
- [x] Add helper `groupEmailDeliveryEvents`
- [x] Add UI component `EmailDeliveryPanel`
- [x] Render `EmailDeliveryPanel` inside `GuestProfilePanel`

## Tests

- [x] Unit tests for grouping helper

## Verification

- [x] `pnpm run lint`
- [x] `pnpm run typecheck`
- [x] `pnpm vitest run`
- [x] Chrome DevTools MCP manual QA + screenshots
