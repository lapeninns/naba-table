---
task: fix-dashboard-api
timestamp_utc: 2025-11-30T18:59:13Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix dashboard API routing and middleware deprecation

## Objective

Restore ops dashboard data and align routing with Next.js 16 requirements by correcting API base paths, updating the middleware entrypoint to `proxy`, and removing the stale baseline-browser-mapping warning.

## Success Criteria

- Dashboard calls from `/app/dashboard` hit `/api/ops/dashboard/*` successfully (no 404s) for a known restaurant ID.
- Middleware/proxy continues to guard ops APIs and set CSRF cookies; tests updated and passing.
- `pnpm build` and `pnpm dev` run without the baseline-browser-mapping staleness warning.
- No new routing regressions on app vs guest hosts in local dev.

## Architecture & Components

- `src/services/ops/bookings.ts`: update `OPS_DASHBOARD_BASE` to `/api/ops/dashboard` and ensure downstream hooks use it.
- Hooks using the base (`useOpsTodayVIPs`, `useOpsBookingChanges`, others via services) continue unchanged except for the base constant.
- Add/adjust tests around dashboard service paths if present; otherwise add a small unit test for the service function base path.
- `src/middleware.ts` → `src/proxy.ts`: preserve `config` matcher, `handleRouting`, and default export; update imports in tests and any references.
- Dependency: add/update `baseline-browser-mapping` dev dependency (or override) to latest.

## Data Flow & API Contracts

- Client: `/app/dashboard` → hooks/services → `/api/ops/dashboard/*` (server-side route implemented).
- No contract shape change; only base URL correction to existing ops routes.

## UI/UX States

- Dashboard loading/error states already handled; we expect errors to drop once 404 resolved. No new UI states added.

## Edge Cases

- Localhost vs hosted domains: ensure proxy keeps existing redirects (app vs root) intact after rename.
- Exemption for public restaurant schedule/calendar-mask APIs must remain unaffected.
- Duplicate `/app/app` normalization retained.

## Testing Strategy

- Unit/integration: run `pnpm test src/middleware.test.ts` (or equivalent filter) to validate proxy behavior.
- Build: `pnpm build` to confirm Next.js passes without warnings and routes compile.
- Manual QA: launch `pnpm dev`, load `/app/dashboard` with a sample restaurant ID, confirm no 404s and data loads; capture console/network via Chrome DevTools MCP for verification.

## Rollout

- No feature flags; low-risk client/service change.
- If any hosted envs use `/api/dashboard`, consider adding temporary rewrite; plan to proceed with direct fix unless blocker found.
