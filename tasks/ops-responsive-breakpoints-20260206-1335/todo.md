---
task: ops-responsive-breakpoints
timestamp_utc: 2026-02-06T13:35:06Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Dev Harness Pages

- [x] Add `/dev/ops-dashboard`
- [x] Add `/dev/ops-customers`
- [x] Add `/dev/ops-email-delivery`
- [x] Add `/dev/ops-new-booking`
- [x] Add `/dev/ops-settings-restaurant`
- [x] Add `/dev/ops-settings-tables`
- [x] Add `/dev/ops-floor-plan`

## Dev Mock Services

- [x] RestaurantService (in-memory)
- [x] CustomerService (in-memory)
- [x] BookingService (subset needed)
- [x] TableInventoryService (in-memory)
- [x] ZoneService (in-memory)
- [x] OccasionService (in-memory)
- [x] TeamService (in-memory)

## Manual QA Matrix (DevTools MCP)

Widths: 320, 375, 414, 640, 768, 1024, 1280, 1536
Boundary: 639/640, 767/768
Landscape: 812x375 (bookings list, booking dialog, floor plan)

Pages:

- [x] /dev/ops-bookings-list
- [x] /dev/ops-booking-dialog
- [x] /dev/ops-dashboard
- [x] /dev/ops-customers
- [x] /dev/ops-email-delivery
- [x] /dev/ops-new-booking
- [x] /dev/ops-settings-restaurant
- [x] /dev/ops-settings-tables
- [x] /dev/ops-floor-plan

## Automated Checks

- [x] pnpm lint
- [x] pnpm typecheck
- [x] pnpm vitest run
- [x] pnpm build
