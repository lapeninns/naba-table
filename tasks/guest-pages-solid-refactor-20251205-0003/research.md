---
task: guest-pages-solid-refactor
timestamp_utc: 2025-12-05T00:03:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Pages SOLID Refactor

## Requirements

- Functional:
  - Refactor guest-facing routes/pages to be modular and maintainable while preserving existing URLs and UX.
  - Introduce ViewModel + PageView separation with dependency injection for data ports (offers/profile/bookings/auth).
  - Keep existing API contracts and route behaviors intact (redirects, SEO metadata, hydration).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain perf budgets: FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms.
  - Ensure keyboard/focus flows, aria-live for async messaging, semantic headings.
  - Auth gating and token flows stay secure; no secrets in source; Supabase remote-only.
  - Preserve SEO metadata and structured redirects (e.g., `withRedirectedFrom`).

## Existing Patterns & Reuse

- Routing & pages: Next.js App Router under `src/app/guest/**`. Current pages (`dashboard`, `bookings`, `profile`, `thank-you`) mix auth checks, data prefetching, and rendering inside `page.tsx`.
- Data hooks: legacy `hooks/useBookings`, `hooks/useProfile`, `hooks/useSupabaseSession` already encapsulate client-side fetching with React Query.
- Components: feature UIs live in `src/components/features/guest/dashboard` and `src/components/features/booking/list`. Shared primitives in `src/components/guest/ui` and layouts in `src/components/layouts/GuestLayout`.
- API/ports hints: `src/app/(public)/bookings/booking-page.tsx` uses adapter + query keys with clearer boundary (example for detail route that could inform refactor).
- Query keys: `@/lib/query/keys` centralizes cache keys; can be reused in new ports/adapters.
- Route coverage confirmed against `route-map.json` and `guest-facing-routes.md` (paths: /guest, /guest/dashboard, /guest/bookings, /guest/profile, /guest/thank-you, /guest/bookings/[bookingId], /guest/bookings/[bookingId]/receipt).

## Inventory (current guest routes)

- `src/app/guest/page.tsx` re-exports dashboard page/metadata; no logic.
- `dashboard/page.tsx`: server component; does `getServerComponentSupabaseClient().auth.getUser()`, redirects unauthenticated, constructs `QueryClient`, builds cookie header, prefetches bookings + profile via `fetch` to `/api/bookings` + `/api/profile` using `process.env.NEXT_PUBLIC_SITE_URL`, handles errors with `console.warn`, hydrates client with `HydrationBoundary` -> `GuestDashboardClient`.
- `bookings/page.tsx`: nearly identical prefetch/auth logic to dashboard; differs only in initial tab handling and renders `BookingListClient`.
- `profile/page.tsx`: server component; auth check; calls `ensureProfileRow` + `normalizeProfileRow` on server, seeds React Query cache with `queryClient.setQueryData`, hydrates `ProfileManageForm`. Mixes data shaping, auth, and view layout in page.
- Loading states exist per route; simple skeleton components. Error boundary at `guest/error.tsx` logs to console.
- `bookings/[bookingId]/page.tsx` wraps `(public)/bookings/booking-page` with different `pathPrefix` to keep canonical URLs.

## Duplicated logic / tight coupling

- Auth gating duplicated across dashboard/bookings/profile using direct Supabase client + redirect string literals.
- Cookie header construction repeated in dashboard/bookings for SSR prefetch; tightly coupled to Next headers and site URL env.
- Prefetch logic inside pages binds directly to HTTP endpoints and `queryKeys`, mixing data fetching with routing concerns.
- Pages import concrete fetch (`fetch`) and `process.env` rather than abstractions; no DI.
- Profile page mutates data (`ensureProfileRow`) during render, mixing side-effects with view composition.
- UI components (`GuestDashboardClient`, `BookingListClient`) depend on hooks directly; pages also fetch same data, risking double fetching.

## External Resources

- [Guest route canonical list](../guest-facing-routes.md) — defines URLs and auth/token expectations; must not regress.
- [Route map JSON](../route-map.json) — reference for existing route segments.

## Constraints & Risks

- Risk of breaking auth redirects (`redirectedFrom` params) if guards move; must keep contract.
- Prefetch logic currently uses `cookies()` and `fetch` inside pages; moving to adapters must preserve cookie forwarding for SSR hydration.
- Large UI components are client components; need to avoid new RSC/client boundary issues when introducing ViewModel.
- Existing hooks live in top-level `hooks/`; moving them could cause path changes—prefer adapters wrapping them instead of relocations to avoid churn.
- Time budget for perf/a11y validation via Chrome DevTools MCP required once UI changes land.

## Open Questions (owner, due)

- Should DI provider live at route group (`src/app/guest/layout.tsx`) or app-wide? (owner: @amankumarshrestha, due: Phase 2 plan)
- Are there upcoming feature flags/experiments for guest flows we must model? (owner: @amankumarshrestha, due: Phase 2)
- Do we keep React Query prefetch on server or move to RSC data functions? Need decision to avoid double fetching. (owner: @amankumarshrestha, due: Phase 2)

## Recommended Direction (with rationale)

- Introduce `services/ports` (GuestOffersPort/AuthPort/ProfilePort/BookingsPort) with adapters using existing APIs (`/api/bookings`, `/api/profile`, Supabase session). Pages depend on ports via DI provider.
- Create `routes/guest` module map: `routes/guest/dashboard`, `routes/guest/bookings`, `routes/guest/profile`, each exporting `buildViewModel(deps)` + `PageView` that is pure/presentational.
- Move auth/analytics/i18n cross-cutting concerns into `src/app/guest/layout.tsx` or middleware wrapper; keep pages declarative.
- Reuse existing hooks/components by composing them inside ViewModels, not inside pages, to limit churn and preserve tested behaviors.
