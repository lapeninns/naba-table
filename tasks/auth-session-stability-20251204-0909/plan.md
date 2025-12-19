---
task: auth-session-stability
timestamp_utc: 2025-12-04T09:09:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Auth/session stability hardening

## Objective

Stabilize guest authentication/session handling and navigation so magic links are processed exactly once, session state hydrates without flicker, cached data never leaks across users, and guest surfaces load smoothly with clear re-auth + error flows.

## Success Criteria

- Magic-link URL hashes handled once per load; no duplicate `setSession`, no double redirects/log spam.
- `useSupabaseSession` uses `initialSession + getSession` (not `getUser`), surfaces `loading|authenticated|unauthenticated`, no mount flicker for authed guests.
- TanStack Query persistence keyed per user and cleared on SIGNED_OUT / user switch; no prior-user bookings/profile after account change.
- 401/419 responses show “session expired” toast and redirect to `/auth/signin?redirectedFrom=<path>`; post sign-in returns to origin; no dead generic error screens for expired sessions.
- Supabase auth cookies share one config (domain, sameSite=lax, secure, maxAge 30d default) across server/browser/API; optional remember-me shortens/extends maxAge consistently.
- Sign-out wipes query cache + persisted cache, triggers Supabase SIGNED_OUT, and soft-redirects home (no full page reload).
- `/guest/bookings?tab=history` opens history tab; back/forward + copy/paste preserve tab.
- Guest dashboard/bookings render with prefetched bookings+profile or skeletons; no double initial fetches.
- Guest routes show skeletons within ~200ms; no blank flash.
- Reservation detail lazily loads dialogs/QR assets without regressing actions.
- Guest retries use query invalidation instead of `router.refresh()`; layout/scroll preserved.
- Shared guest error/empty views provide retry + sign-in CTA; no generic “Something went wrong”.
- Guest booking preferences persist (profile when available, else localStorage); clearing profile/localStorage removes defaults.
- Client error reporting includes user/booking metadata; automated a11y smoke finds no critical issues.

## Architecture & Components

### A. Auth & Session

- **ImplicitAuthHandler consolidation**: add module-level guard so only one instance processes hash per load; dev-only logs; remove hash handling from `GuestSignInForm`; use `router.replace` without extra `refresh` unless required.
- **Session context**: in `AppProviders`, hydrate from `initialSession`, then `supabase.auth.getSession()`; expose `{session,user,status}` (`loading|authenticated|unauthenticated`) via context; subscribe to `onAuthStateChange`; dev-only logging.
- **useSupabaseSession refactor**: consume context above; drop on-mount `getUser` poll; emit status + user.
- **Supabase cookie options**: shared helper (e.g., `lib/supabase/cookies.ts`) deriving domain from `ROOT_DOMAIN`/window host, `sameSite=lax`, `secure` by env/protocol, `maxAge` default 30d, optional shorter session when remember-me off. Apply to `server/supabase.ts`, `lib/supabase/browser.ts`, `api/auth/callback`, `api/auth/signin`, `api/auth/signout`.
- **Sign-out flow**: Header sign-out calls API signout, clears Supabase session, then query cache + persisted cache wipe and `router.replace('/')` (no full refresh).

### B. Query Persistence & Cache Hygiene

- Extend `lib/query/persist.ts` to accept per-user storage key/buster and expose `removeClient` helper; default key `reserve.query-cache:<user|anon>`.
- In `AppProviders`, track `session?.user.id`; configure persistence keyed to user; on auth change (SIGNED_OUT or SIGNED_IN with different user) clear `QueryClient` + remove persisted cache; recreate persister as needed.
- Add helper to invalidate bookings/profile query keys for retries; use in guest components instead of `router.refresh()`.

### C. Auth Error Handling (401/419)

- Shared handler (e.g., `lib/auth/handleAuthRedirect.ts`) invoked by `fetchJson` and `reserve/shared/api/client.ts`: detect 401/419, if client-side and not already redirecting, show toast (`use-toast` export) “Session expired, please sign in again”, compute `redirectedFrom` from `location.pathname + search`, and `window.location.assign` to sign-in. Debounce to avoid duplicate toasts; skip on `/auth` routes; still throw `HttpError` for caller awareness.

### D. Guest Data & Navigation

- **URL-synced tabs**: `BookingListClient` accepts `initialTab`; `page.tsx` reads `searchParams.tab`; tab change updates query param via router (replace/push) so back/forward works.
- **Server prefetch + hydration**: in guest dashboard/bookings pages, build `QueryClient`, prefetch `useProfile` and first-page `useBookings` with same query keys; include cookie header for auth; dehydrate into `HydrationBoundary`.
- **Route loading states**: add `loading.tsx` under guest layout/pages with skeletons matching clients; respect `prefers-reduced-motion`.
- **Lazy dialogs/QR**: `next/dynamic` for `CancelBookingDialog`, `EditBookingDialog`, QR module; show lightweight placeholders for buttons.
- **Retry via query invalidation**: replace `router.refresh()` in guest components with `queryClient.invalidateQueries` targeting bookings/profile keys; keep layout/scroll.

### E. Guest UX & Observability (Sprint 3 scope)

- Shared `GuestErrorState` / `GuestEmptyState` with retry + sign-in CTA; use in bookings list, dashboard, reservation detail.
- Preference persistence: extend profile handling to optional `preferredPartySize`/`preferredTime` (backend permitting); fallback to localStorage; booking wizard consumes defaults.
- Client error reporting: integrate Sentry (or configured provider) in `src/app/providers.tsx`; attach `userId`, `bookingId` (when available) to scope; ensure guest routes use error boundary.
- A11y polish: consistent `:focus-visible`, skip-link target, tap targets ≥44px; run axe/DevTools a11y smoke on guest flows.

## Data Flow & API Contracts

- Auth hash → `ImplicitAuthHandler` parses tokens, sets session via Supabase client, strips hash, redirects to `redirectedFrom` or default.
- Session provider seeds from `initialSession`; `getSession` verifies; `onAuthStateChange` updates status/user and notifies cache manager.
- Query persistence storage key `reserve.query-cache:<userId|anon>`; version `v1`; auth change triggers `queryClient.clear()` + persister remove.
- 401/419 handling schedules toast+redirect (client only) then throws `HttpError`.
- Sign-in endpoint to accept optional `rememberMe` boolean to choose cookie maxAge; default 30d.

## UI/UX States

- Sign-in: no double handling; expired session → toast + redirect; return to origin after login.
- Bookings tabs driven by `searchParams.tab` with sensible default.
- Loading: skeletons for guest dashboard/bookings/profile/detail appear quickly; animations respect reduced motion.
- Error: shared guest error banner with retry + sign-in; empty states with CTA.
- Reservation detail: action buttons visible immediately; dialogs/QR lazy-loaded.

## Edge Cases

- Multiple `ImplicitAuthHandler` instances (ClientLayout + AuthLayout) — guard prevents duplicate processing.
- Auth redirect loops avoided on `/auth` routes or when redirect already in flight.
- Cache clear covers SIGNED_OUT from API + tab closure/token expiry.
- Prefetch only when user present; skip/redirect otherwise.
- LocalStorage availability guards for SSR and private mode; fall back gracefully.
- prefers-reduced-motion honored for skeletons/animations.

## Testing Strategy

- Unit: cookie option helper, auth redirect handler, query persistence keying, session provider transitions.
- Integration (RTL): ImplicitAuthHandler (hash → setSession → redirect), useSupabaseSession (initialSession + getSession), cache clear on auth change, tab sync component behavior.
- E2E (Playwright):
  1. Magic link hash handled once (no double redirect/logs).
  2. Expired session (mock 401) → toast + redirect → sign-in → returns to original path.
  3. Logout then login as different guest → prior bookings/profile absent.
  4. Bookings tab URL sync/back-forward.
- Manual QA (Chrome DevTools MCP): guest auth, dashboard, bookings, reservation detail — console/network clean, perf budgets, a11y checks.

## Rollout

- Deliver in sprint slices: Sprint 1 (auth/session/persistence/401/cookies/sign-out), Sprint 2 (nav/prefetch/loading/lazy/retries), Sprint 3 (shared UX, prefs, monitoring, a11y).
- Staging first; consider feature flag for global auth-redirect & per-user persistence if needed.
- Verify Supabase cookies across subdomains in staging before prod rollout.

## DB Change Plan (if applicable)

- None planned; if profile preferences require schema changes, design remote-only migration with backup/rollback in separate task.
