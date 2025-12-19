# Routing Overview

## Hosts

- **Root host** (`{ROOT_DOMAIN}` / `localhost`): marketing, public booking, guest dashboard/auth.
- **App host** (`app.{ROOT_DOMAIN}` / `app.localhost`): restaurant operations console.

## Middleware rules (summary)

- Static/framework assets (`/_next`, `/_static`, `/_vercel`, `favicon.ico`, `robots.txt`, `sitemap.xml`, files with extensions) bypass redirects.
- **Root → App**
  - `/app*` → `https://app.{ROOT_DOMAIN}/app*` (single prefix preserved).
  - `/ops*` → `https://app.{ROOT_DOMAIN}/app/management`.
- **App host normalization**
  - `/app/app*` → `/app*` (308 redirect).
  - Paths already starting with `/app` are left as-is.
  - Non-`/app`/`/api` paths redirect back to root host with the same path/query.
- **Ops API rewrite (app host)**
  - `/api/<service>` → `/api/ops/<service>` when `<service>` ∈ `OPS_API_SERVICES` (central list in `src/middleware.ts`).
  - Public restaurant schedule/calendar-mask endpoints are exempt from rewrite.
- **Ops API guard**
  - `/api/ops/**` (and rewritten ops services) require an authenticated user with at least one restaurant membership; middleware returns 401/403 otherwise.

## Public vs Guest vs Ops routes (high level)

- **Public**: `/`, `/restaurants/:slug`, `/restaurants/:slug/thank-you`, `/bookings/:id`, `/bookings/:id/thank-you` (legacy), `/auth/signin`, `/api/bookings`, `/api/restaurants/:slug/(schedule|calendar-mask)`, `/api/availability`, etc.
- **Guest** (root host): `/guest/*`, `/account/*`, `/guest/bookings`, `/guest/dashboard`, `/api/profile`, `/api/lead`, etc.
- **Ops** (app host): `/app/*` pages; APIs under `/api/ops/**` plus app-host rewrites for services listed in `OPS_API_SERVICES`.

## Auth & sessions

- Supabase session cookies are shared across subdomains via `.${ROOT_DOMAIN}`; login on one host authenticates the other.
- Post-sign-in defaults are host-aware in auth routes:
  - Root host → `/guest/dashboard`.
  - App host → `/app/dashboard`.

## API scope quick answer

- **Q:** What does `/api/bookings` do?
  - On **root host**: public/guest bookings API.
  - On **app host**: middleware rewrites to `/api/ops/bookings` (restaurant operations scope).

## Diagrams

- See `route-map-mermaid.md` and `route-map-ascii.txt` for a full, auto-generated route list.
