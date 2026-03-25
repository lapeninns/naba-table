# Continuity Ledger

Last updated: 2026-03-25T19:53:00Z

## Goal (incl. success criteria)

- Complete the remaining guest portal convergence features in the dedicated guest worktree.
- Success means dashboard, bookings, and profile share the canonical guest shell family, dev-browser harnesses exist for the auth-gated portal routes, stale guest Playwright coverage is updated to current port-3000 flows, and the public booking-entry route is clean of the app-owned runtime noise found during validation.

## Constraints/Assumptions

- Work only in the isolated mission worktree and validate against the live Next.js server on port `3000`.
- Use the dev browser as the default validation surface for portal and booking-entry checks.
- Dev-only portal harnesses are the truthful local validation path for auth-gated `/guest/*` routes.
- `validate-live-apphost-guest-route-canonicalization` remains environment-bound unless a trustworthy local multi-host route becomes available.

## Key decisions

- Reuse the canonical guest-shell primitives through a shared `GuestPortalPage` wrapper instead of building a parallel portal shell.
- Inject mocked guest services/session state inside client-side dev harness components to avoid passing function-bearing service objects across a server/client boundary.
- Update stale Playwright coverage to the flows the app actually supports now: canonical `/restaurants/[slug]/book`, recovery-authorized read-only booking detail, and `PLAYWRIGHT_DEV_HARNESS=1` on the live port-3000 server.
- Add a dev-only public schedule/calendar fallback for the local fixture restaurant instead of letting the booking-entry route render from the fixture page shell and then fail its live schedule requests.
- Remove the public booking page’s `next/dynamic` wrapper around `ReservationWizard` so the route no longer bails out to client rendering and preloads an orphaned chunk in local dev.
- Keep the plan-step time select controlled even before a time is chosen so the browser stays free of the uncontrolled-to-controlled warning once suggestions hydrate.

## State

- The guest portal convergence pass is functionally complete in the worktree: dashboard, bookings, and profile now share the canonical guest shell, mocked dev harnesses exist for all three, booking-entry runtime noise has been cleaned up, and focused Vitest/Playwright/typecheck/lint are green.
- Manual Chrome DevTools validation confirms the new harness routes render correctly on `localhost:3000`, with screenshots and a Lighthouse snapshot stored in `tasks/guest-portal-convergence-and-runtime-followups-20260325-1857/artifacts/`.
- A follow-up real-browser capture in `artifacts/booking-entry-browser-check.json` confirms `/restaurants/the-fox/book` now loads without the earlier `schedule` `500`s, stale wizard chunk `404`, or uncontrolled select warning.
- One mission item remains genuinely open: live apphost canonicalization is still environment-bound.

## Done

- Created `tasks/guest-portal-convergence-and-runtime-followups-20260325-1857/`.
- Added `GuestPortalPage` and converged dashboard/bookings/profile onto the shared guest shell family.
- Added deterministic dev portal harness routes and mocked guest portal services for dashboard, bookings, and profile.
- Extended `GuestServicesProvider` / guest page-view contracts to support injected mocked session state and service ports.
- Removed the stray profile page debug log.
- Added server-side dev fixture fallbacks for the public fixture restaurant schedule/calendar APIs used by the booking-entry route.
- Removed the `next/dynamic` wrapper from the public `ReservationWizardClient` and fixed the plan-step time select to stay controlled.
- Refreshed stale Playwright coverage to current supported flows and validated it with `PLAYWRIGHT_DEV_HARNESS=1`.
- Verified with focused Vitest, focused Playwright, targeted booking-entry browser capture, `pnpm typecheck`, `pnpm lint`, and Chrome DevTools screenshots plus Lighthouse snapshot.

## Now

- Update mission metadata so the completed portal-convergence/runtime-cleanup features and still-pending apphost follow-up match the new evidence.

## Next

- Share the completion summary plus the one still-open follow-up (`validate-live-apphost-guest-route-canonicalization`).

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `tasks/guest-portal-convergence-and-runtime-followups-20260325-1857/`
- `src/components/features/guest/shared/GuestPortalPage.tsx`
- `src/components/features/guest/dashboard/GuestDashboardClient.tsx`
- `src/components/features/booking/list/BookingListClient.tsx`
- `src/components/features/guest/profile/GuestProfileClient.tsx`
- `src/app/(public)/dev/guest-dashboard/**`
- `src/app/(public)/dev/guest-bookings/**`
- `src/app/(public)/dev/guest-profile/**`
- `src/guest/services/di.tsx`
- `server/restaurants/devBookingFixture.ts`
- `server/restaurants/schedule.ts`
- `server/restaurants/calendarMask.ts`
- `src/components/features/booking/wizard/ReservationWizardClient.tsx`
- `reserve/features/reservations/wizard/ui/steps/plan-step/components/Calendar24Field.tsx`
- `tests/e2e/guest-booking.spec.ts`
- `tests/e2e/guest-booking-manage.spec.ts`
- `tests/e2e/guest-mocked-api-coverage.spec.ts`
- `tests/e2e/guest-reserve-routes.spec.ts`
- `tests/server/restaurants/devBookingFixture.test.ts`
- `npx vitest run tests/guest/guest-view-models.test.ts tests/guest/guest-bookings-params.test.ts --reporter=verbose`
- `npx vitest run tests/server/restaurants/devBookingFixture.test.ts --reporter=verbose`
- `PLAYWRIGHT_DEV_HARNESS=1 npx playwright test tests/e2e/guest-mocked-api-coverage.spec.ts tests/e2e/guest-booking.spec.ts tests/e2e/guest-booking-manage.spec.ts --reporter=list`
- `PLAYWRIGHT_DEV_HARNESS=1 npx playwright test tests/e2e/guest-reserve-routes.spec.ts tests/e2e/guest-booking.spec.ts --reporter=list`
- `pnpm typecheck`
- `pnpm lint`
