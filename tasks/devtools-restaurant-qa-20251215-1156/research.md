---
task: devtools-restaurant-qa
timestamp_utc: 2025-12-15T11:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Chrome DevTools QA (Restaurant-Facing Routes)

## Scope

- **In scope**: Restaurant-facing (Ops) pages/routes only (the `app.*` host / `/app/*` internal routes).
- **Out of scope**: Guest-facing marketing/booking flows.

## Requirements (from request)

- Performance testing: Performance panel + Core Web Vitals + memory profiling/leaks.
- Network & API testing: request/response validation, throttling, caching behavior.
- Security & Console testing: JS errors, mixed content, CORS/CSP, security headers/certs.
- Responsive & device testing: viewport/device emulation + touch interactions.
- Accessibility testing: Lighthouse a11y + DOM/ARIA review + keyboard + screen reader readiness.
- App state & storage testing: cookies/storage/IndexedDB, service worker/PWA, offline/cache behavior.
- Deliverable: **Detailed findings**, **severity ratings**, and **actionable recommendations** per category.

## Existing Patterns & References

- `docs/restaurant-facing-routes.md` — canonical restaurant-facing routes & host routing rules.
- `docs/current-routes.md` — route inventory including Ops pages and related file paths.
- `src/middleware.ts` — app-host rewrite rules + auth guards (ops pages require auth; `/auth/*` remains public).

## Assumptions

- Local dev server runs at `http://localhost:3000` and app-host is reachable at `http://app.localhost:3000`.
- A valid restaurant-staff test account exists (or the environment allows creating one) to access protected routes.

## Open Questions (owner, due)

- Credentials / login method for a restaurant-staff user for local QA? (Owner: github:@amankumarshrestha, Due: ASAP)
- Any feature flags that must be enabled to access analytics/floor-plan routes? (Owner: github:@amankumarshrestha, Due: ASAP)
