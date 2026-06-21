---
task: booking-capacity-precheck
timestamp_utc: 2026-04-13T13:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [bookingValidationUnified]
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] Dev harness route `http://localhost:3000/dev/guest-booking-capacity` loaded without console errors
- [x] Mock capacity error alert, alternatives, and mock table-availability panel rendered in-browser
- [x] Real public booking flow at `http://localhost:3000/restaurants/the-old-crown-girton/book` returned `409 CAPACITY_EXCEEDED` with alternative slots on a staging-backed full dinner slot
- [x] Clicking a suggested time in the real review-step alert returned to Step 1 with the replacement slot prefilled
- [x] Real public booking flow succeeded at a nearby suggested slot (`20:30`) and completed the confirmation step

### DOM & Accessibility

- [x] Alert content is exposed through the review step’s destructive alert region
- [x] Review content and mock availability panels remain readable in desktop and mobile layouts
- [x] Real review-step alert exposes alternative slot actions as keyboard-focusable buttons

### Performance (profiled; mobile; 4× CPU; 4G)

- Chrome DevTools Lighthouse snapshot on the real review-step failure state:
  - Accessibility: `93`
  - Best Practices: `100`
  - SEO: `100`
- Remaining Lighthouse accessibility misses align with pre-existing progressbar/form warnings on the booking page, not with the new capacity handling

### Device Emulation

- [x] Desktop/full-width
- [x] Mobile narrow viewport (~390px wide)

## Test Outcomes

- [x] `pnpm vitest run tests/server/public-bookings-route.test.ts`
- [x] `pnpm vitest run tests/reserve/api-client.test.ts tests/reserve/review-step-capacity-error.test.tsx`
- [x] `pnpm vitest run tests/server/public-bookings-route.test.ts tests/server/bookings/timeValidation.test.ts tests/reserve/api-client.test.ts tests/reserve/review-step-capacity-error.test.tsx tests/reserve/buildReservationDraft.test.ts tests/hooks/useCreateReservation.test.tsx`
- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm lint` completed with existing warnings only; no new errors introduced by this change

## Artifacts

- Route test output: captured from focused Vitest run
- Type validation: repo-wide `tsc --noEmit`
- Browser proof (desktop): `artifacts/guest-booking-capacity-dev-harness-desktop.png`
- Browser proof (mobile): `artifacts/guest-booking-capacity-dev-harness-mobile.png`
- Browser proof (real route, capacity error): `artifacts/guest-booking-capacity-staging-review-error.png`
- Browser proof (real route, capacity error, no-flash recheck): `artifacts/guest-booking-capacity-staging-review-error-no-flash.png`
- Browser proof (real route, intermediate success state): `artifacts/guest-booking-capacity-staging-success.png`
- Browser proof (real route, confirmed booking): `artifacts/guest-booking-capacity-staging-confirmed.png`
- Lighthouse snapshot (real route): `artifacts/lighthouse-booking-capacity/report.html`
- Lighthouse JSON (real route): `artifacts/lighthouse-booking-capacity/report.json`

## Browser Verification Notes

- Surface used: dev-only harness at `/dev/guest-booking-capacity`
- Why this surface: there was no existing public guest harness for mocked capacity failures, so a dev-only page was added to render the real guest review error surface alongside mock capacity metadata and mock table availability
- Exact interaction verified:
  - destructive capacity error copy is visible in the guest review step
  - alternative times appear in the mock side panel
  - mock table availability appears beside the review step on desktop and stacks below it on mobile
- Console result: no warnings/errors reported by Chrome DevTools for the harness route

## Staging-backed Verification Notes

- Surface used: real public booking page at `/restaurants/the-old-crown-girton/book`
- Supporting data: inserted synthetic staging bookings directly via Supabase service-role for `2026-04-15 19:00` under seed tag `CAPCHECK-20260413`
- Why direct seeding was used: staging had no explicit `restaurant_capacity_rules`, so production-like contention had to be created safely without firing guest side effects
- Additional hardening required for this verification:
  - `server/capacity/service.ts` now falls back to active `table_inventory` totals when a restaurant has no explicit capacity rules
  - shared availability now evaluates overlapping booking intervals instead of treating the entire service period as one bucket
- Exact interactions verified:
  - selected `2026-04-15`, party size `4`, time `19:00`
  - submitted from the real review step
  - observed `409` response with `X-Capacity-Exceeded: true`, `97%` utilization, and alternatives `17:30`, `20:30`, `17:00`, `21:00`
  - clicked `20:30` in the review-step alert and verified the wizard returned to Step 1 with `20:30` prefilled
  - completed the booking successfully at `20:30`
- Real request timings captured via scripted POSTs against the same local route:
  - `409 CAPACITY_EXCEEDED` at `19:00`: about `2188ms`
  - `201 Created` at `21:00`: about `8780ms`
- Browser/network notes:
  - after removing the optimistic step advance in `useReservationWizard`, the real public flow stays on Step 3 with a disabled `Processing…` button until the `409` arrives
  - Chrome DevTools showed pre-existing form-label/select warnings on the page; they were not introduced by this capacity work
  - the existing Playwright guest-booking spec could not be reused against the live `localhost:3000` app because it targets a mocked `/r/:slug` path, while the real verification route is `/restaurants/:slug/book`; the primary browser proof for this change remains the real Chrome DevTools run against the production-like booking page

## Known Issues

- [ ] Chrome DevTools still reports pre-existing form-label/select warnings on the booking page. Those warnings were not introduced by this capacity work and remain outside the scope of this change.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [ ] QA
