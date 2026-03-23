---
task: fix-posthog-runtime-errors
timestamp_utc: 2026-03-23T14:33:34Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No crash-level console errors on `http://localhost:3000/restaurants/the-corner-house-pub-cambridge/book`
- [x] Core booking route and API requests succeeded

Notes:

- Observed warnings/issues, but no uncaught runtime errors:
  - Dev warning: uncontrolled-to-controlled `Select`
  - Dev warning: unused preload hint
  - Accessibility issue report: "No label associated with a form field" (count: 3)
- Observed one `404` for a dev chunk preload and one aborted schedule request followed by a successful retry; the page still rendered correctly.

### DOM & Accessibility

- [x] Focus landed inside the booking step content
- [x] Primary booking controls rendered and were interactable
- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Keyboard-only flows succeed

### Performance (profiled; mobile; 4x CPU; 4G)

- FCP: pending | LCP: pending | CLS: pending | TBT: pending
- Budgets met: [ ] Yes [ ] No

### Device Emulation

- [x] Mobile (≈375px)
- [ ] Tablet (≈768px)
- [ ] Desktop (≥1280px)

## Test Outcomes

- [x] `pnpm exec vitest run tests/reserve/reservation-schedule-normalization.test.ts tests/hooks/useUpdateRestaurant.test.tsx`
- [x] `pnpm run typecheck`
- [x] `pnpm exec eslint reserve/features/reservations/wizard/services/schedule.ts src/components/features/ops-shell/OpsRestaurantSwitch.tsx hooks/ops/useUpdateRestaurant.ts src/hooks/ops/useOpsBookingStatusActions.ts tests/reserve/reservation-schedule-normalization.test.ts tests/hooks/useUpdateRestaurant.test.tsx`

## Artifacts

- Screenshot: `artifacts/devtools-public-booking-page-375.png`

## Known Issues

- Existing accessibility issue reports on the booking form still need a dedicated follow-up.
- `Script error.` PostHog issue remains unresolved because this task focused on first-party null/shape failures with direct repo matches.

## Sign-off

- [x] Engineering
