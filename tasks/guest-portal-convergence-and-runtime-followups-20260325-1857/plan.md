---
task: guest-portal-convergence-and-runtime-followups
timestamp_utc: 2026-03-25T18:57:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest portal convergence and runtime follow-ups

## Objective

We will finish the remaining guest portal and local-runtime follow-up work so the guest dashboard, bookings, and profile surfaces share one coherent shell family, the auth-gated portal can be validated through dev-browser harnesses, and the remaining local test/runtime drift is reduced without weakening coverage.

## Success Criteria

- [ ] Dashboard, bookings, and profile use the canonical guest-shell family consistently.
- [ ] Portal loading, empty, success, and error states are explicit and browser-verifiable through dev harnesses.
- [ ] Profile keeps email visible but non-editable, validates supported fields inline, and disables save when unchanged or submitting.
- [ ] Stale guest booking Playwright assumptions are updated to current supported port-3000 flows.
- [ ] Obvious guest/booking console noise is removed or reduced.

## Architecture & Components

- `src/components/guest/ui/GuestPrimitives.tsx`
  - Reuse existing shell and section primitives as the single portal shell family.
- `src/components/features/guest/dashboard/GuestDashboardClient.tsx`
  - Align hero, section rhythm, and explicit empty/error states with the shared guest shell.
- `src/components/features/booking/list/BookingListClient.tsx`
  - Normalize tab handling and converge bookings-page shell/states with the rest of the portal.
- `src/components/features/guest/profile/GuestProfileClient.tsx`
  - Align profile shell and feedback patterns with the portal family; keep supported fields only.
- `src/guest/services/di.tsx` / `src/guest/hooks/useGuestSession.ts`
  - Support mocked guest session injection for dev portal harnesses if needed.
- `src/app/(public)/dev/**`
  - Add dev-only guest portal harness routes using real clients with injected mock services.
- `tests/guest/**` and `tests/e2e/**`
  - Extend/refresh unit and browser coverage for portal convergence and stale booking flow assumptions.

## Data Flow & API Contracts

- Production portal routes remain unchanged: server view models prefetch bookings/profile and hydrate into guest clients.
- Dev portal harnesses will inject mock guest service ports and, if needed, a mock session user so the real clients render without redirecting.
- Booking list URL state remains normalized through `normalizeBookingsTab`, with canonical tab values preserved in the query string contract.

## UI/UX States

- Loading: explicit skeletons on dashboard/bookings/profile harnesses and live routes.
- Empty: dashboard no-upcoming state, bookings no-results state, profile no special empty state beyond current data load contract.
- Error: actionable retry states using guest status/error primitives.
- Success: profile save feedback, dashboard primary actions, bookings card actions, portal shell continuity.

## Edge Cases

- No real guest auth fixture exists locally; dev harnesses must be dev-only and reuse the real portal clients instead of building fake lookalikes.
- If apphost canonicalization cannot be truthfully exercised locally, document it rather than force a fake pass.
- Preserve current booking lifecycle/public route behavior while refreshing booking-manage Playwright coverage.

## Testing Strategy

- Vitest:
  - `tests/guest/guest-view-models.test.ts`
  - `tests/guest/guest-bookings-params.test.ts`
  - any new guest portal harness/state tests if needed
- Playwright:
  - `tests/e2e/guest-mocked-api-coverage.spec.ts`
  - `tests/e2e/guest-booking.spec.ts`
  - `tests/e2e/guest-booking-manage.spec.ts`
  - new dev-portal browser coverage if needed
- Browser / Chrome DevTools:
  - default validation surface for portal harnesses and booking-entry console checks
- Quality gates:
  - `pnpm typecheck`
  - `pnpm lint`

## Rollout

- No feature flags or deployment changes.
- Keep dev harnesses gated behind `enforceDevOnly()`.
