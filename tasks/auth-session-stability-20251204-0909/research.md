---
task: auth-session-stability
timestamp_utc: 2025-12-04T09:09:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Auth/session stability hardening

## Requirements

- Functional: Centralize magic-link hash handling; stabilize Supabase session handling; per-user query persistence; global 401/419 re-auth redirect; aligned Supabase cookie config; reliable sign-out cache reset; bookings tab URL sync; server prefetch + hydration; guest route loading states; lazy-load booking dialogs/QR; replace router.refresh retries with query invalidation; shared guest error/empty CTAs; guest preference persistence; client error reporting; accessibility polish.
- Non-functional: Avoid duplicate setSession/redirect races; reduce network churn/flicker on auth; prevent data leakage across users; keep logs quiet in production; ensure a11y (WCAG), perf budgets; maintain SSR hydration integrity; avoid regressions in guest flows.

## Existing Patterns & Reuse

- Magic-link handling duplicated: `components/auth/ImplicitAuthHandler.tsx` (global via `ClientLayout` + `AuthLayout`) and `components/auth/GuestSignInForm.tsx` both parse URL hash and call `supabase.auth.setSession`, leading to double set + router refresh. `ImplicitAuthHandler` already uses a ref but each instance has its own ref, so multiple renders can still double-handle.
- Session hydration: `src/app/layout.tsx` fetches `session` via `getServerComponentSupabaseClient().auth.getSession()` and passes it to `AppProviders initialSession`. `AppProviders` unconditionally calls `supabase.auth.setSession` for that session; `useSupabaseSession` ignores `initialSession` and calls `getUser` on mount plus again on each `onAuthStateChange`, causing extra network calls and flicker. Logging is always on.
- Query persistence: `lib/query/persist.ts` uses a single localStorage key `reserve.query-cache` + version `v1` and is configured from `AppProviders` with no cleanup on unmount. No awareness of user id, so cache survives account switches. No cache clear on auth changes (only per-hook state).
- Query client creation: `AppProviders` constructs one `QueryClient` with default options and enables ReactQueryDevtools in non-prod. No auth-driven cache invalidation.
- HTTP helpers: `lib/http/fetchJson.ts` wraps fetch with CSRF header and throws `HttpError` via `normalizeError`; currently no global 401/419 handling. Reserve SPA uses `reserve/shared/api/client.ts` with similar behavior and CSRF header but no auth redirect handling.
- Supabase cookies: multiple implementations of cookie defaults across `server/supabase.ts`, `src/app/api/auth/callback`, `src/app/api/auth/signout`, using `sameSite=lax`, `secure` by env, domain from `ROOT_DOMAIN`; browser client (`lib/supabase/browser.ts`) derives domain from window and sets `sameSite=lax`, `secure` based on protocol. No shared helper and no `maxAge`/remember-me wiring.
- Guest data hooks: `useBookings` (`/api/bookings?me=1`) uses query key `['bookings','list', params]`, fetchJson; `useProfile` uses fetchJson and returns profile. Guest pages `BookingListClient`/`GuestDashboardClient` rely on these; error UI uses `router.refresh()` as retry.
- Pages: `src/app/guest/bookings/page.tsx` and `src/app/guest/dashboard/page.tsx` already wrap clients in `HydrationBoundary` but do not prefetch queries (empty QueryClient). `BookingListClient` keeps tab state local (no URL sync). No `loading.tsx` under `src/app/guest/**`.
- Reservation detail client eagerly imports dialog components and QR assets; no dynamic imports.
- Error/empty states are per-component; no shared guest-specific banners/CTAs yet. Skip link already exists in `src/app/layout.tsx` but focus/target styling TBD.
- Monitoring: `src/app/providers.tsx` does not wire Sentry/monitoring; need to inspect before adding (open question).

## External Resources

- None consulted yet; will rely on code inspection and in-repo patterns. If needed, Context7/DeepWiki can be used later for precedent.

## Constraints & Risks

- High surface area; auth, cache, and routing changes span multiple sprints—risk of regressions in guest flows, SSR hydration mismatches, and cross-user data leakage.
- Supabase remote-only; any cookie/auth changes must avoid exposing tokens and must respect `ROOT_DOMAIN` / subdomain sharing semantics.
- Need to prevent duplicate redirects/setSession calls; ImplicitAuthHandler runs in multiple layouts.
- Query persistence must clear reliably on SIGNED_OUT and user switches to avoid prior-user data.
- Global 401/419 handling must avoid redirect loops (e.g., on `/auth` routes) and should debounce toast spam.
- Server/client prefetch and hydration must use identical query keys to avoid double-fetch or cache poisoning.
- Loading skeletons must respect a11y (prefers-reduced-motion) and avoid CLS.

## Open Questions (owner, due)

- Toast surface for session-expired: use Shadcn `use-toast` or react-hot-toast? Need to confirm preferred stack (assistant, pre-plan).
- Monitoring: Is Sentry already initialized elsewhere (maybe in `ClientLayout` or providers)? Need to inspect before adding (assistant, pre-implementation).
- Remember-me UX: no checkbox found; should we add one or just support a `rememberMe` payload flag for future? (assistant, pre-implementation)
- Server prefetch data source: should we call internal APIs with fetch or query Supabase directly for bookings/profile? Need to confirm best boundary (assistant, pre-plan).

## Recommended Direction (initial)

- Centralize implicit auth flow in ImplicitAuthHandler, removing parallel handling from GuestSignInForm.
- Update useSupabaseSession to hydrate from initialSession + getSession (no getUser) with explicit status and env-gated logging.
- Key TanStack Query persistence by user id; clear cache on auth changes in providers.
- Add global 401/419 interceptors with toast + redirect preserving path.
- Align Supabase cookie config across server/browser/api with remember-me maxAge.
- Ensure sign-out clears query cache/persistence and soft-redirects home.
- Sync bookings tab via search params; prefetch bookings/profile server-side and dehydrate; add route loading skeletons; lazy-load heavy dialogs/QR; replace router.refresh retries with query invalidation.
- Standardize guest error/empty states with CTAs; persist lightweight preferences; wire client error reporting with metadata; run a11y polish.

## Notes

- Task span is large (multi-sprint). May need to stage changes; consider feature flags for risky auth/query persistence changes if required.
