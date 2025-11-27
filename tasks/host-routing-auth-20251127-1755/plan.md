---
task: host-routing-auth
timestamp_utc: 2025-11-27T17:55:35Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Host/app routing & auth separation

## Objective

Enable predictable, safe host-based routing and auth semantics across root and app subdomains, ensuring public/guest/app behaviors are clearly separated and documented.

## Success Criteria

- [ ] Root `/app*` requests consistently land on `app.<root>` with a single `/app` prefix; `/ops*` normalized per spec with no redirect loops.
- [ ] App host rewrites `/api/<service>` → `/api/ops/<service>` only for services in central list; never double-rewrites; static/framework paths bypass middleware.
- [ ] Shared ops API guard enforces session + restaurant role across all `api/ops/**` handlers.
- [ ] Auth cookie strategy defined and configured to prevent guest/restaurant session collisions; post-sign-in redirects respect origin host and role.
- [ ] Documentation updated: API semantics, routing overview, local dev multi-host setup.
- [ ] Tests cover key host paths and API rewrites/guards for both hosts; no redirect loops detected.

## Architecture & Components

- `middleware.ts`: host detection, static path early exits, `/app` and `/ops` redirect/normalize logic, `opsServices` rewrite map, cross-host redirect for non-app paths on app host. Must preserve public restaurant schedule/calendar-mask exception.
- `src/app/api/ops/*`: shared guard helper (e.g., `requireOpsUser`) to standardize 401/403 and ensure session + membership/role; applied across handlers.
- `server/supabase.ts` / auth flows: document and, if needed, tighten cookie scope; add host-aware post-sign-in redirect helper `postSignInRedirect(host, role?)` used by `/api/auth/signin` + `/api/auth/callback`.
- Docs: `src/app/api/README.md`, `docs/dev-routing.md`, `docs/routing-overview.md` (new), potentially update route map references.

## Data Flow & API Contracts

- Incoming request → middleware:
  - If static/framework path → passthrough.
  - Root host `/app*` → redirect to app host preserving single `/app` prefix.
  - Root host `/ops*` → redirect to `app.<root>/app/management` or 404 (TBD after code review).
  - App host `/app/app*` → rewrite/redirect to `/app*` to avoid double prefix.
  - App host `/api/<service>` where service ∈ `opsServices` → rewrite to `/api/ops/<service>`.
  - App host non-app/api/static path → redirect to root host.
- API handlers under `/api/ops/**` consume `requireRestaurantUser(req)`; respond with standardized 401/403 JSON when not authorized.
- Optional response header `x-api-scope: public|ops` for clarity.

## UI/UX States

- Mainly backend routing; UI impact minimal. If login redirects touch UI, ensure success/error states are conveyed via existing patterns; maintain accessible focus handling (no new UI components anticipated).

## Edge Cases

- Prevent loops for `/app`, `/app/`, `/app/app`, `/app/app/dashboard` on both hosts.
- Static assets (`/_next`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`, etc.) must never redirect.
- `/api/ops/**` on root host should remain safe (auth guard) even if middleware doesn’t rewrite.
- Guest hitting app host non-app path should be redirected to root host without losing path/query.
- Ensure dev/local host detection works when `app.localhost` used.
- Preserve public `/api/restaurants/:slug/(schedule|calendar-mask)` behavior on app host (no ops rewrite).
- Avoid double `/api/ops/ops` or `/app/app` prefixes after normalization.

## Testing Strategy

- Unit/integration tests for middleware host routing cases (root and app hosts) and static exclusions.
- Tests for `opsServices` rewrites and no double-rewrite cases.
- Tests for `requireRestaurantUser` guard: unauthenticated → 401; authenticated guest → 403; restaurant user → success stub.
- If login redirect helper implemented, add tests for host/role combinations.
- Manual QA: verify core paths and static assets via Chrome DevTools (per policy) after implementation (if UI impacted, e.g., login redirect pages).

## Rollout

- Feature flag not required; behavior should be deterministic. If risk emerges, consider env-toggle for middleware host rules (documented if added).
- Monitoring: add logging if available for unexpected host/path combos (keep PII out). Optional header to aid debugging.
- Kill-switch: ability to temporarily bypass middleware logic via env (TBD only if needed and allowed by scope).

## DB Change Plan (if applicable)

- No DB changes expected; Supabase remote-only constraint noted. If auth/session config touches DB, ensure staging-first.
