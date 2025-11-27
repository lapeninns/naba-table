# API Surface & Host Semantics

This project serves two audiences from the same codebase:

- **Public/guest** (root host, e.g. `https://{ROOT_DOMAIN}`)
- **Restaurant ops** (app host, e.g. `https://app.{ROOT_DOMAIN}`)

## Host-based behavior

- **Root host**
  - `/api/bookings` (and other non-ops APIs) are public/guest-facing.
  - `/app/*` requests are redirected to `https://app.{ROOT_DOMAIN}/app/*` (single `/app` prefix preserved).
  - `/ops*` requests are redirected to `https://app.{ROOT_DOMAIN}/app/management`.
- **App host**
  - Non-app, non-api paths (e.g. `/auth/*`, `/guest/*`) are redirected back to the root host with the same path/query.
  - `/app/app*` is normalized to `/app*` to prevent double prefixes.
  - Ops API rewrites: `/api/<service>` is rewritten to `/api/ops/<service>` when `<service>` is in the `opsServices` list. Public restaurant schedule endpoints (`/api/restaurants/:slug/(schedule|calendar-mask)`) are exempt.

## API scope cheat sheet

- `x-api-scope` (implicit):
  - Root host `/api/bookings` → **public** bookings (guest/public flows).
  - App host `/api/bookings` → rewritten to `/api/ops/bookings` → **ops** bookings.
- `/api/ops/**` is always treated as **ops** scope. Middleware requires an authenticated user with at least one restaurant membership before the request reaches handlers.

## Auth & sessions

- Supabase session cookies are shared across subdomains via `.${ROOT_DOMAIN}`. Logging into one host authenticates the other; routing logic and guards determine access.
- Post-sign-in destinations are host-aware in middleware/auth routes:
  - Root-origin logins default to `/guest/dashboard`.
  - App-origin logins default to `/app/dashboard`.

## Adding or changing ops APIs

1. Add the service key to `OPS_API_SERVICES` in `src/middleware.ts`.
2. Keep the handler under `src/app/api/ops/<service>/...`.
3. Ensure the handler uses the shared ops guard (`requireOpsAuth` from `server/auth/ops-guard`) or at minimum `auth.getUser()` + membership validation.
4. If the endpoint is intentionally public, do **not** add it to `OPS_API_SERVICES`.

## Debug tips

- If you see `api/ops/ops/...` you likely double-rewrote; ensure the path starts as `/api/<service>` on app host or `/api/ops/<service>` directly.
- Static and framework assets (`/_next`, `favicon.ico`, `robots.txt`, `sitemap.xml`) bypass middleware redirects.
