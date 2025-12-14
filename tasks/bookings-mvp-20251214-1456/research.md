---
task: bookings-mvp
timestamp_utc: 2025-12-14T14:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Bookings MVP (/bookings)

## Problem Statement

We need to evaluate `/bookings?restaurantId=<uuid>` end-to-end, identify what the MVP is missing, and identify unnecessary features that add complexity without supporting the core booking workflow.

## Requirements (Initial)

- Functional:
  - View bookings for a specific restaurant (`restaurantId` in URL).
  - Understand booking status at a glance (e.g., pending/confirmed/cancelled).
  - Create a booking (minimum fields) or have a clear next action if creation is out of scope.
  - Basic empty/error states with actionable messaging.
- Non-functional (baseline):
  - Accessibility: keyboard navigation, visible focus, semantic structure, form labeling.
  - Performance: avoid heavy client work and excessive network waterfalls.
  - Security: ensure restaurant scoping is enforced server-side (no trusting query params alone).
  - UX: state reflected in URL; fast to scan; mobile-first.

## Existing Patterns & Reuse (To Fill)

- Routing:
  - Host-based routing via `src/middleware.ts`: app host rewrites all non-API paths to `/app/*`.
  - Ops bookings is effectively “/bookings on app host” → `src/app/app/(app)/bookings/page.tsx`.
- Data fetching:
  - React Query for ops pages (e.g. `src/hooks/ops/useOpsBookingsList.ts`).
  - Thin service wrappers under `src/services/ops/*` calling `/api/ops/*`.
- Auth/tenant scoping:
  - Server-side Supabase session via `getServerComponentSupabaseClient()` in ops layout.
  - Membership scoping enforced in ops APIs (e.g. `src/app/api/ops/bookings/route.ts` checks memberships + 403).
  - Middleware additionally guards `/api/ops/*` via `requireOpsAuth`.
- UI primitives:
  - Shadcn-style primitives present (`Button`, `Badge`, `Alert`, etc.).
  - Bookings list uses shared dashboard components: `components/dashboard/BookingsTable.tsx` + `components/dashboard/BookingRow.tsx`.

## Current Observations (To Fill)

- Dev server note (local):
  - `pnpm dev` initially logged `Watchpack Error (watcher): Error: EMFILE: too many open files, watch` and then served **only** `/_not-found` for every route.
  - Running with polling fixed routing: `WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=2000 pnpm dev`.
- Page behavior at `http://app.localhost:3000/bookings?restaurantId=486de541-a307-4414-b0b1-f774a0e4a9fa` (logged out):
  - Middleware rewrites to `/app/bookings?...` (internal app router location).
  - Server responds `307` to `/auth/signin` (restaurant operations sign-in).
  - CSRF cookie is set by middleware on first request.
- Page behavior at `http://app.localhost:3000/bookings?restaurantId=486de541-a307-4414-b0b1-f774a0e4a9fa` (authenticated session observed during dev):
  - Loads the ops bookings page successfully (200).
  - Network activity observed (server logs):
    - `GET /api/ops/restaurants/<restaurantId>` (restaurant details / timezone)
    - `GET /api/ops/bookings?...` (bookings list; returned 0 in this env)
    - Additional calls fired on page load: `GET /api/dashboard/summary?...` and `GET /api/dashboard/heatmap?...` (likely from shared ops shell/overview widgets, not strictly needed to render bookings list)
- Routing mismatch affecting “MVP” perception:
  - `/reserve` and `/booking` permanently redirect to `/bookings` (from `next.config.js`).
  - On the **web host** (`http://localhost:3000/bookings`) there is **no** index page route → it renders `src/app/not-found.tsx` (404).
  - On the **app host** (`http://app.localhost:3000/bookings`) the path is valid because middleware rewrites `/bookings` → `/app/bookings`.
- Sign-in UX (app host):
  - The operations sign-in page includes a “Sign in as a guest →” link that points to the same `/auth/signin` path on the app host, which is ambiguous and likely not what a diner wants.

## Constraints & Risks

- Risk: bookings are sensitive; must confirm authorization and restaurant scoping.
- Risk: query-param driven restaurant selection can be abused if not validated.
- Risk: “extra features” might be entangled with core flows; trimming needs care.
- Risk: route collisions between guest `/bookings/*` and ops `/bookings` (host-dependent) can easily cause broken redirects and user confusion.

## Open Questions (Owner, Due)

- What exactly is the MVP definition for bookings in SajiloReserveX (list-only vs CRUD)? (owner: maintainers, due: 2025-12-16)
- What roles exist (staff/admin) and what actions are permitted per role? (owner: maintainers, due: 2025-12-16)
- Is `restaurantId` always provided, or do we support “select restaurant” UX? (owner: maintainers, due: 2025-12-16)

## Recommended Direction (Initial)

- Fix the “broken entrypoint” problem first (routing/redirects) so users land on a real page on the correct host.
- Then define a strict Ops Bookings MVP for restaurant staff that prioritizes: list bookings + minimal status/actions + reliable loading/empty/error states + a11y.

## MVP Gaps vs Extra Features (Initial Triage)

### Gaps (things that break the core experience)

- **Broken guest entrypoint**: `/reserve` and `/booking` redirect to `/bookings`, but there is no `src/app/(public)/bookings/page.tsx`, so diners land on 404.
- **Lost deep-link context on auth redirect**: ops layout (`src/app/app/(app)/layout.tsx`) redirects unauthenticated users to `/auth/signin` without preserving the original path/query (e.g. `restaurantId`).
- **Docs drift**: `docs/current-routes.md` claims some routes that differ from current on-disk routing (e.g., landing page location), which contributes to confusion during development and QA.

### Likely extras (features implemented beyond what the list endpoint currently supports)

- Ops bookings list UI (`components/dashboard/BookingRow.tsx`) renders capacity/table-assignment, loyalty, seating prefs, allergies/dietary flags, check-in/out indicators, etc., but the list API (`GET /api/ops/bookings`) currently returns only a minimal booking DTO (so many fields are effectively always blank/unused).
- Booking offline queue + transition state machine are wired into the list view; this increases mental overhead and surface area for bugs before core flows are validated.
- Ops bookings page load currently triggers dashboard-level data fetches (summary + heatmap), which may be unnecessary for the bookings MVP and could slow the critical path.
