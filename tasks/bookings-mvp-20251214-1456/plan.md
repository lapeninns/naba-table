---
task: bookings-mvp
timestamp_utc: 2025-12-14T14:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Bookings MVP (/bookings)

## Objective

Enable a restaurant operator to view and manage bookings for a single restaurant quickly and reliably, using `/bookings?restaurantId=<uuid>` as the entry point.

## Success Criteria (Draft)

- [ ] Booking list renders for a valid `restaurantId` with no console errors.
- [ ] Empty state is clear and provides a next step.
- [ ] Error state is actionable (retry + guidance).
- [ ] Keyboard-only flows work (navigation + any forms/actions).
- [ ] Network requests are minimal and scoped to the restaurant.

## Architecture & Components (To Fill)

- Route entry (restaurant-facing, app host):
  - External URL: `http://app.localhost:3000/bookings?...`
  - Middleware rewrite: `/bookings` → `/app/bookings` (served from `src/app/app/(app)/bookings/page.tsx`)
- Layout/auth gate:
  - `src/app/app/(app)/layout.tsx` enforces staff authentication and loads memberships into `OpsSessionProvider`.
  - Important: current redirect is `redirect("/auth/signin")` and does not preserve the originally requested path/query.
- Page component:
  - `src/app/app/(app)/bookings/page.tsx` renders `OpsBookingsClient` with URL-driven initial filters (`restaurantId`, `filter`, `page`, `query`, `statuses`, `date`).
- Client UI:
  - `src/components/features/bookings/OpsBookingsClient.tsx` drives search params, status tabs, and a Details dialog (list is scan + open; no inline edit/cancel in MVP).
  - Shared table UI: `components/dashboard/BookingsTable.tsx` + `components/dashboard/BookingRow.tsx`.
- Data layer:
  - React Query hook: `src/hooks/ops/useOpsBookingsList.ts` → `bookingService.listBookings`.
  - Service: `src/services/ops/bookings.ts` → `GET /api/ops/bookings?...`.
  - API route: `src/app/api/ops/bookings/route.ts` (membership-scoped listing + walk-in create).

## Data Flow & API Contracts (To Fill)

- Read bookings (Ops list):
  - Client: `useOpsBookingsList(filters)` (requires `filters.restaurantId`).
  - Endpoint: `GET /api/ops/bookings?restaurantId=<uuid>&page=<n>&pageSize=<n>&status|statuses&query&from&to&sort&sortBy`
  - Server behavior:
    - Validates query via Zod.
    - Loads staff memberships; if `restaurantId` omitted, defaults to first membership.
    - Enforces restaurant scoping (403 if staff lacks membership).
  - Response: `{ items: BookingDTO[]; pageInfo: { page; pageSize; total; hasNext } }`
  - Key errors: `401` unauthenticated, `403` forbidden, `429` rate limit, `500` query failure.
- Mutations in current UI (likely beyond MVP, but present today):
  - Edit booking: `PATCH /api/ops/bookings/:id` (handled via the booking detail flow).
  - Cancel booking: `DELETE /api/ops/bookings/:id` or `PATCH` cancellation (handled via the booking detail flow).
  - Lifecycle actions: `POST /api/ops/bookings/:id/check-in|check-out|no-show|undo-no-show` (via `useOpsBookingLifecycleActions`).

## UI/UX States

- Loading: skeleton or spinner with `aria-busy`.
- Empty: “No bookings yet” + CTA.
- Error: message + retry; do not silently fail.
- Success: list with clear status and primary actions.

## Edge Cases

- Missing/invalid `restaurantId` → prompt to pick restaurant or show guidance.
- Unauthorized access → redirect or 403 UI.
- Timezone/date formatting correctness.
- Large booking list → pagination/virtualization decision (only if needed for MVP).

## Testing Strategy (Draft)

- Unit: helpers and status mapping.
- Integration: bookings page renders states based on mocked API.
- E2E: view list → create booking (if included) → verify appears.
- Accessibility: axe + keyboard focus order.

## Rollout (Draft)

- Feature flag: optional (decide once we see existing flags).
- Exposure: internal → staged → full.
- Monitoring: error rate, page load, mutation latency.
- Kill-switch: flag off or route guard.
