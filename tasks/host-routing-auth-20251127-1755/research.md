---
task: host-routing-auth
timestamp_utc: 2025-11-27T17:55:35Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Host/app routing & auth separation

## Requirements

- Functional:
  - Normalize `/app` routing between root and app hosts; avoid loops and duplicated prefixes.
  - Protect ops APIs via explicit rewrite map and shared auth/role guard; no double rewrites.
  - Clarify public vs ops API semantics and document expected host behaviors.
  - Define deterministic cookie/auth strategy for guest vs restaurant users; host-aware login redirects.
  - Redirect non-app paths on app host to root host; preserve static assets and framework paths.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: ops APIs require authenticated restaurant role; root host ops paths must not leak data even if middleware misses.
  - Reliability: static assets and framework routes must bypass middleware rewrites; no redirect loops.
  - Observability: optional headers for API scope to aid debugging; documentation for new behaviors.
  - A11y/Perf: unchanged for this backend-heavy work; ensure middleware doesn’t add latency via unnecessary redirects.

## Existing Patterns & Reuse

- **Middleware**: `src/middleware.ts` handles host routing.
  - `ROOT_DOMAIN` from `NEXT_PUBLIC_ROOT_DOMAIN` (default `localhost`); `APP_HOSTS = {app.${ROOT_DOMAIN}, app.localhost}`; `WEB_HOSTS = {ROOT_DOMAIN, www.ROOT_DOMAIN, localhost}`.
  - App-host logic rewrites everything to `/app*`, removes a single leading `/app` via redirect, special-cases `/app` → `/` (then rewrites to `/app/`). Root-host logic redirects `/app*` to `https://app.${ROOT_DOMAIN}${path sans /app}` and `/ops*` to the same host/path.
  - OPS API rewrite list currently hard-coded (`allowed-capacities`, `bookings`, `customers`, `dashboard`, `debug`, `metrics`, `occasions`, `restaurants`, `settings`, `strategies`, `tables`, `team`, `zones`) and skips public restaurant schedule/calendar-mask. Static handling relies on matcher + `isAssetOrApi` but doesn’t explicitly list `favicon/robots/sitemap`.
  - No cross-host redirect for non-/app paths on app host; no guard against root `/api/ops/*` beyond handler-level checks.
- **Supabase/auth**:
  - Server client (`server/supabase.ts`) sets cookies with domain `.${ROOT_DOMAIN}` when not localhost → shared session across subdomains.
  - Auth flows use Supabase OTP/password via `/api/auth/signin` and `/api/auth/callback`; fallback redirect `/guest/dashboard` (host-agnostic). Ops sign-in page lives at `/app/auth/signin` but ultimately posts to the shared auth endpoint.
- **Ops API security**:
  - All `api/ops/**` handlers manually call `getRouteHandlerSupabaseClient().auth.getUser()` and most call `requireMembershipForRestaurant`/`requireAdminMembership`; patterns vary and responses aren’t standardized. No shared guard; `opsGuardV2` flag unused.
- **Docs/route maps**: `route-map-mermaid.md`, `route-map-ascii.txt/json` describe current routes; no `src/app/api/README.md` yet; no `docs/dev-routing.md` yet.

## External Resources

- None yet. Relying on repo context; may consult framework docs if gaps appear.

## Constraints & Risks

- Must adhere to root AGENTS non-overridable rules: no secrets in source; accessibility baseline; remote-only Supabase; Chrome DevTools QA for UI changes (likely N/A here unless UI touched).
- Large surface: middleware changes risk breaking asset delivery or introducing redirect loops.
- Auth changes risk session collision across hosts if cookie domains misconfigured.
- Host detection for local dev currently assumes `app.localhost`/`localhost`; need to confirm doc and env guidance.
- Adding shared guard across all `api/ops/**` touches many files—risk of regressions or missing route coverage; need incremental, well-tested rollout.
- Need to ensure tests cover both hosts; may require host awareness in test harness (vitest + NextRequest).

## Open Questions (owner, due)

- Precise root/app host detection method and expected `ROOT_DOMAIN` env? (owner: assistant, due: during analysis)
- Current auth/session strategy (single vs separate cookies)? (owner: assistant)
- Existing ops API guards—do they exist? (owner: assistant)
- Do we need to update route-map docs vs new docs? (owner: assistant)
- Should ops guard standardize membership check (needs restaurantId) or just session + “has any membership”? (owner: assistant)
- How to avoid breaking public `/api/restaurants/*/schedule` exemption while applying new rewrite map? (owner: assistant)

## Recommended Direction (with rationale)

- Centralize host detection and exclusions in middleware; add early static-path exits to avoid redirects.
- Introduce explicit `opsServices` array and rewrite map; guard ops APIs with shared helper applied to all handlers.
- Document host semantics and API scope in `src/app/api/README.md` plus a routing overview in `docs/`.
- Decide and document cookie strategy (likely separate guest vs restaurant cookies with domain scoping) and implement host-aware post-login redirects.
