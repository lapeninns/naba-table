---
task: walk-in-perf
timestamp_utc: 2025-11-30T22:36:13Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Speed up walk-in/auth pages

## Objective

Reduce initial load and TTI for the walk-in/sign-in entry by eliminating redirect hops, improving cacheability, and deferring non-critical JS across auth pages.

## Success Criteria

- [ ] `/walk-in` resolves in a single navigation (no extra 308) and lands on the correct sign-in form.
- [ ] TTFB improves via CDN cache (route serves with `x-vercel-cache: HIT`).
- [ ] Total blocking time for auth page ≤ 200ms on mobile emu; bundle size reduced vs baseline.
- [ ] No auth/a11y regressions (form fields, labels, focus order intact).

## Architecture & Components

- Route handling: adjust `src/app/(public)/walk-in/route` or middleware to point directly to auth page, or alias segment to avoid redirects.
- Auth page component under `src/app/(public)/auth/signin` (or similar) — ensure server component wrapper and minimal client boundary for the form.
- Shared layout/scripts: move Plausible/NProgress to lazy strategies.

## Data Flow & API Contracts

- No API contract changes. Auth submission remains via existing handlers/services.

## UI/UX States

- Loading: keep minimal (or rely on browser). Avoid nprogress blocking.
- Error/success: unchanged.

## Edge Cases

- Already authenticated users should continue to redirect appropriately after sign-in.
- CSRF token and cookies must remain set; cache only static HTML safe for anonymous users.

## Testing Strategy

- Manual check `/walk-in`, `/auth/signin` load times and redirect chain.
- Lighthouse + DevTools (mobile 4G/4x CPU) before/after; capture HAR + report in `artifacts/`.
- Axe/a11y quick scan on form.

## Rollout

- Feature flag not required; safe change if routes are static. Monitor via Vercel analytics / Plausible page load times if available. Kill-switch: revert route rewrite or toggle back to previous script strategy.
