---
task: ops-restaurant-qa-fixes
timestamp_utc: 2025-12-15T15:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Restaurant QA Fixes

## Objective

Address the high-severity Ops QA findings (offline failure mode, security headers, and floor-plan render-delay performance) while keeping changes scoped to restaurant-facing routes and shared infra that directly affects them.

## Success Criteria

- [ ] Offline mode does **not** hard-navigate away from the app for ops navigation/pagination interactions.
- [ ] Baseline security headers present on both root-host and app-host responses.
- [ ] `/seating/floor-plan` reduces main-thread render delay on first load under constrained CPU/network by progressively rendering non-critical visuals.
- [ ] `/customers` avoids redundant server-side work that inflates TTFB (no server-side query prefetch/hydration).
- [ ] Supabase auth warning reduced by not using unverified session user objects in client hooks.
- [ ] Chrome autofill/a11y issue resolved for known form fields (add `id`/`name` where missing).

## Changes (High Level)

1. **Offline navigation safety**
   - Add a click-capture guard in ops shell content area that prevents anchor-based navigation when offline and shows a toast.
   - Guard ops pagination callbacks so “Next/Previous” does not attempt URL navigation while offline.

2. **Security headers**
   - Apply a baseline header set in `src/middleware.ts` for consistent coverage across hosts/routes.
   - Keep CSP intentionally minimal to avoid breaking Next.js (especially dev) while still improving posture.

3. **Floor plan performance**
   - Replace O(n²) timeline row lookups with a per-table map.
   - Pre-parse timeline segment windows (numeric start/end) to avoid repeated `Date` parsing.
   - Progressive rendering: defer decorative elements (grid texture, merge-connector lines, per-chair DOM) until after initial paint/idle.
   - Stabilize early-loading layout dimensions to reduce CLS.

4. **Customers TTFB**
   - Remove redundant server-side auth/membership fetch and query prefetch in `/app/customers` page; rely on the authenticated layout + client fetch.

## Testing Strategy

- `pnpm typecheck`
- `pnpm build` + `pnpm start` for production-mode validation (avoids dev watcher limits).
- Manual QA (Chrome DevTools MCP):
  - Verify security headers on root-host and app-host.
  - Validate offline behavior on ops shell + list pagination (requires authenticated ops session).
  - Record a performance trace for `/seating/floor-plan` under Fast 3G + 4× CPU (requires authenticated ops session).

## Rollout

No feature flags added. Changes are safe defaults (headers + UI guards + perf improvements).

## Notes / Deviations

- If authenticated ops QA is blocked (missing credentials or Supabase Auth admin instability), document the limitation and provide a repeatable verification checklist for maintainers.
