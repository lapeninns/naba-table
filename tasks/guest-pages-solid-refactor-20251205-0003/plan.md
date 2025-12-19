---
task: guest-pages-solid-refactor
timestamp_utc: 2025-12-05T00:03:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Pages SOLID Refactor

## Objective

We will refactor guest-facing routes to use ViewModel + PageView composition with dependency-injected ports so that pages stay orchestration-only while preserving current UX/URLs/SEO and performance budgets.

## Success Criteria

- [ ] URLs, metadata, and redirects remain unchanged; no UX regressions.
- [ ] Pages import only ViewModel/ports abstractions (no concrete fetchers/global singletons in page files).
- [ ] Loading/empty/error/success states explicit with a11y (aria-live/focus) covered.
- [ ] Tests cover ports/adapters and page states.

## Architecture & Components

- Module map (new `src/guest/**` root with tsconfig path alias `@/guest/*`):
  - `routes/` — per-page orchestration modules (`dashboard`, `bookings`, `profile`, `thank-you`) exporting `buildViewModel` + `PageView` + `states.tsx`.
  - `pages/` — thin facades for Next routes if needed (e.g., shared view exports for `/guest` and aliases).
  - `layouts/` — guest-shell specific wrappers (DI provider, a11y landmarks, cross-cutting concerns).
  - `components/atoms|molecules/` — guest-only primitives (status banners, skeletons) to keep feature UIs lean.
  - `hooks/` — guest-specific hooks that compose ports; no direct fetchers.
  - `services/ports|adapters/` — port interfaces + concrete adapters over existing fetchJson/Supabase/session.
  - `lib/formatters`, `lib/validation` — pure helpers for dates/labels + payload validation.
- ViewModels: `routes/guest/<page>/view-model.ts` exports `buildGuest<Page>ViewModel(deps: GuestDeps)` returning normalized state `{ status, data, actions, accessibility }`.
- Page views: `routes/guest/<page>/view.tsx` pure presentational components receiving ViewModel output; no side-effects.
- Ports (contracts):
  - `AuthPort`: `getUser(): Promise<User | null>`, `redirectToSignIn(path: string): never`, `getSessionCookieHeader(): Promise<string | null>`.
  - `BookingsPort`: `list(filters): Promise<BookingsPage>`.
  - `ProfilePort`: `getSelf(): Promise<ProfileResponse>`, `ensure(user): Promise<ProfileResponse>`.
  - `FeatureConfigPort` (optional): surface flags/experiments as config object for Open/Closed compliance.
- Adapters: `serverAuthAdapter` (Supabase server client + redirectedFrom), `clientAuthAdapter` (useSupabaseSession), `bookingsAdapter` (wrap `/api/bookings` fetchJson with cookie forwarding), `profileAdapter` (wrap `/api/profile` + `ensureProfileRow`).
- DI boundary: `src/guest/services/di.ts` exports `createGuestServerDeps({ cookies })` + `GuestServicesProvider` (client) to inject ports into hooks/ViewModels.
- Shared lib: `src/guest/lib/formatters.ts` for dashboard labels (greetings/date/time) and `src/guest/lib/validation.ts` for query params normalization (tab, bookingId).
- State components: `routes/guest/shared/LoadingState`, `ErrorState`, `EmptyState` built atop existing `GuestEmptyState/GuestErrorState` to keep ARIA/focus consistent.

### Cross-cutting concerns

- Auth gating centralized in `guest/services/di` + `guest/layouts/GuestShell` so page files only call `deps.auth.requireUser()`.
- Analytics/i18n hooks live in ViewModel (composable config object) rather than scattered conditionals.
- SEO metadata remains in page exports but derived helpers can live in `guest/lib/formatters` if needed.

## Dependency Graph (target)

`Next route page` → `buildGuest<Page>ViewModel(deps)` → `ports` (`AuthPort`, `BookingsPort`, `ProfilePort`, `FeatureConfigPort`) → `adapters` (fetchJson + Supabase client + query keys) → external APIs (`/api/bookings`, `/api/profile`, Supabase auth).

- UI path: `PageView` ← ViewModel output only (no direct hooks/fetch); uses `GuestLayout` + shared atoms/molecules.
- DI path: `guest/services/di` constructs adapters and provides via context for client hooks; SSR factory injects cookies/header for fetch.

## Data Flow & API Contracts

- Auth: `AuthPort` on server reads session via `getServerComponentSupabaseClient().auth.getUser()`; exposes `redirectToSignIn(redirectedFrom)` helper to keep existing redirect semantics. Client uses `useSupabaseSession` via provider.
- Bookings: `BookingsPort.list(params)` fetches `/api/bookings?me=1` with forwarded cookies header; return type stays `BookingsPage` to preserve React Query cache keys.
- Profile: `ProfilePort.getSelf()` fetches `/api/profile`; `ensure(user)` wraps existing `ensureProfileRow + normalizeProfileRow` to keep server-side seeding; updates continue through existing `useUpdateProfile` to avoid API/contract changes.
- Reservation detail: `guest/bookings/[bookingId]` continues delegating to `(public)/bookings/booking-page`; ensure `pathPrefix` remains `/guest/bookings` for URL stability.

## UI/UX States

- Each ViewModel returns explicit variant union: `{ status: 'loading' } | { status: 'error', message, retry } | { status: 'empty', cta } | { status: 'ready', ...payload }`.
- Focus + aria-live: shared `StatusRegion` component with `role="status"` + `tabIndex={-1}` to programmatically focus on state changes; `aria-live="polite"` for toasts.
- Loading skeletons remain but centralized in `routes/guest/shared/LoadingState` to avoid duplicated markup.

## Edge Cases

- No user session → redirect with `redirectedFrom` preserved.
- Empty bookings/profile → show empty state; avoid crashing on missing profile row.
- Token-based booking detail stays supported via existing `(public)` booking page; ensure path prefix remains.
- Network errors during prefetch → degrade gracefully (skip prefetch; client fetch handles error).
- Cookie-less SSR: if cookies unavailable, skip prefetch and rely on client fetch; ViewModel should return `loading` + set `hydrate=false` flag to avoid double fetch.
- Query param normalization: `tab` accepts `history|past|upcoming`; fallback to `upcoming` using validation helper.
- Timezone handling: formatters use `booking.restaurantTimezone` if present; fallback to browser timezone but avoid `NaN` date by guarding parse failures.

## Testing Strategy

- Unit: ports/formatters validation (`lib/guest/formatters`, `validation`), ViewModel logic for state derivations.
- Integration: adapters hitting mocked fetch (`/api/bookings`, `/api/profile`) via msw or fetch-mock; DI wiring test ensures defaults.
- Rendering: page-level tests covering loading/error/empty/success view states with React Testing Library.
- Accessibility: axe on rendered states; verify focus management.

## Rollout

- Feature flag: none required; structural refactor only.
- Monitoring: reuse existing analytics; ensure console warnings removed; rely on React Query cache for perf.
- Kill-switch: revert to previous page exports (keep commit ready) if regressions found.

## DB Change Plan (if applicable)

- No DB schema changes expected.
