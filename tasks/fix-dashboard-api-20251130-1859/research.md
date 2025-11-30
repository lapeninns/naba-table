---
task: fix-dashboard-api
timestamp_utc: 2025-11-30T18:59:13Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix dashboard API routing and middleware deprecation

## Requirements

- Functional:
  - Restore dashboard data fetches so `/app/dashboard` no longer triggers 404s on `/api/dashboard/summary` (restaurant-scoped).
  - Align ops dashboard client calls with existing API route structure.
  - Eliminate baseline-browser-mapping staleness warning during build/dev.
  - Replace deprecated `middleware` entrypoint with supported `proxy` entrypoint without changing behavior.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve current auth guard behavior for ops APIs (`requireOpsAuth`).
  - Maintain CSRF cookie issuance across subdomains.
  - Avoid regressions to routing latency; keep redirects/rewrite paths stable.

## Existing Patterns & Reuse

- API routes already live under `app/api/ops/...`; route map shows `/api/ops/dashboard/summary` source (`route-map.json`).
- Ops dashboard client base in `src/services/ops/bookings.ts` uses `OPS_DASHBOARD_BASE = '/api/dashboard'` and is reused by hooks like `useOpsTodayVIPs`, `useOpsBookingChanges`.
- Middleware logic centralizes host-based routing, ops auth guard, and CSRF cookie setup in `src/middleware.ts`; tests live in `src/middleware.test.ts`.

## External Resources

- Next.js 16 change: `middleware.ts` entry is deprecated; new supported file name is `proxy.ts` (Next.js docs: middleware-to-proxy message during build/dev).

## Constraints & Risks

- Changing base API path affects multiple hooks; must ensure all ops dashboard fetchers point to `/api/ops/...` to avoid partial fixes.
- Middleware rename could break routing if exports/config differ; tests must be updated to cover `proxy` path.
- Remote calls observed failing with `UND_ERR_SOCKET` (host 104.18.38.10); may be upstream dependency—outside immediate scope but could mask other issues.
- Need to keep CSRF cookie domain logic intact (root domain env-driven).

## Open Questions (owner, due)

- Expected public vs ops dashboard endpoints: is `/api/dashboard/*` intended to exist separately? (assume no; confirm with maintainer when available.)
- Any downstream clients relying on old `/api/dashboard` path? If yes, consider temporary rewrite.

## Recommended Direction (with rationale)

- Align client base constant to `/api/ops/dashboard` to match implemented routes; update dependent hooks/services.
- Add/adjust tests (unit or integration) to ensure dashboard endpoints call the ops route path.
- Migrate `src/middleware.ts` to `src/proxy.ts`, preserving `config` matcher and `proxy` default export; update tests/imports accordingly.
- Update dev dependency `baseline-browser-mapping` to latest to silence warning; verify build still passes.
- Retest dashboard page locally to confirm 404s resolved and routing behavior unchanged; capture evidence for verification.
