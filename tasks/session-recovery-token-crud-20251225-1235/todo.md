---
task: session-recovery-token-crud
timestamp_utc: 2025-12-25T12:46:33Z
owner: github:@maintainers
reviewers: [github:@web-core]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add token capture route `/bookings/recover` and cookie `sr_access`
- [x] Update env TTL bounds if needed for email usage

## Email / Links

- [x] Update `server/emails/bookings.ts` manage URL generation to prefer HMAC token links
- [x] Keep safe fallback to confirmation token links when HMAC is unavailable

## API

- [x] `GET /api/bookings` reads token from cookie in addition to header/query
- [x] `GET /api/bookings/[id]` supports session recovery token auth (read)
- [x] `PUT /api/bookings/[id]` supports session recovery token auth (update)
- [x] `DELETE /api/bookings/[id]` supports session recovery token auth (cancel)
- [x] Ensure no token values are logged

## UI

- [x] Booking detail page enables manage actions when token cookie present
- [ ] Guest edit/cancel dialogs succeed with token auth

## Tests

- [x] Add/adjust tests for token auth paths in `src/app/api/bookings/[id]/route.test.ts`
- [x] Run targeted `vitest` for affected suites
- [x] Run `eslint --max-warnings=0` on changed files

## Notes

- Assumptions:
  - Token payload remains restaurant-scoped (`restaurantId`) and includes contact identity fields.
  - Token cookie is stored as httpOnly and used implicitly by API calls.
