---
task: ops-email-delivery-page
timestamp_utc: 2026-02-05T23:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Backend

- [x] Extend `types/emailDelivery.ts` with feed response DTOs
- [x] Extend `server/emails/email-delivery-log.ts` with restaurant list helper
- [x] Add route `GET /api/ops/email-delivery`

## Frontend

- [x] Add sidebar nav item `Email Delivery`
- [x] Add `/app/email-delivery` page
- [x] Add `OpsEmailDeliveryClient` feature component
- [x] Extend ops booking service with `getRestaurantEmailDeliveryFeed(...)`
- [x] Add `useOpsEmailDeliveryFeed` hook
- [x] Add `parseEmailDeliverySearch` helper

## Tests

- [x] Unit tests for `parseEmailDeliverySearch`

## Verification

- [x] `pnpm run lint` (warnings only; no errors)
- [x] `pnpm run typecheck`
- [x] `pnpm vitest run`
- [x] Chrome DevTools MCP manual QA + artifacts
