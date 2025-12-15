---
task: devtools-restaurant-qa
timestamp_utc: 2025-12-15T11:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Plan: Chrome DevTools QA (Restaurant-Facing Routes)

## Objective

Verify that restaurant-facing (Ops) pages are performant, correct under adverse network conditions, secure, responsive, accessible, and stable with respect to client storage/state using Chrome DevTools (via MCP automation where possible).

## Target Routes

Canonical (app host) routes to validate:

- `/auth/signin` (public)
- `/` (redirects to `/dashboard`)
- `/dashboard`
- `/bookings`
- `/customers`
- `/seating` (redirects to `/seating/floor-plan`)
- `/seating/floor-plan`
- `/seating/capacity`
- `/management` (redirects to `/management/team`)
- `/management/team`
- `/settings` (redirects to `/settings/restaurant/profile`)
- `/settings/restaurant`
- `/settings/restaurant/profile`
- `/settings/restaurant/operating-hours`
- `/settings/restaurant/service-periods`
- `/settings/restaurant/occasions`
- `/settings/restaurant/team`
- `/settings/tables`
- `/new-bookings` (if enabled/linked in nav)

Note: Docs mention `/walk-in` and analytics routes; codebase route scan (via `src/app/app/(app)`) does not currently show pages for them, so they are treated as **out of scope / N/A** for this QA pass unless they exist behind feature flags.

## Execution Strategy (DevTools)

### Performance

- Record Performance trace for initial load (cold) and warm navigation for key routes.
- Capture CWV-like metrics from trace: LCP, CLS, long tasks, main-thread work.
- Use Memory profiling for:
  - heap snapshot before/after route navigation loops
  - allocation timeline (if feasible) to detect growth/leaks

### Network & API

- Capture network waterfall on cold load and key interactions:
  - bookings list fetch, filters, pagination (if present)
  - settings saves (if present)
- Validate:
  - status codes, response shapes, error handling
  - caching headers for static assets and API responses where applicable
- Throttling:
  - Fast 3G + offline scenarios to verify graceful UX

### Security & Console

- Review console for errors/warnings.
- Inspect response headers for security posture:
  - `content-security-policy`, `strict-transport-security`, `x-content-type-options`, `referrer-policy`
- Check for mixed content (should be none) and CORS/CSP violations.

### Responsive & Device

- Validate layouts at common widths (mobile/tablet/desktop).
- Verify touch target sizing and overflow behavior using device emulation.

### Accessibility

- Run Lighthouse (a11y) where possible; otherwise document limitation and supplement with:
  - semantic HTML + ARIA inspection
  - keyboard-only flows (focus order, visible focus, no traps)

### App State & Storage

- Inspect cookies and local/session storage for:
  - session consistency across app-host routes
  - CSRF cookie behavior (`CSRF_COOKIE_NAME`)
- Verify service worker presence/absence and cache storage behavior.

## Artifacts

Capture evidence under `tasks/devtools-restaurant-qa-20251215-1156/artifacts/`:

- Performance trace exports / screenshots
- Network request lists (HAR-like capture if feasible)
- Console logs screenshot (if issues)
- Viewport screenshots (mobile/tablet/desktop)
- Lighthouse reports (if available)
