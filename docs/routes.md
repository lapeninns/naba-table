# API Routes: Structure and Conventions

This app uses Next.js App Router for API endpoints. We adopt a versioned, hierarchical, RESTful structure with a version prefix at the root: `/api/v1/...`.

## Principles

- Versioned root: `/api/v1` (future: `/api/v2`).
- Noun-based, plural, lowercase, kebab-case segments.
- Nest only when the child depends on the parent; depth ≤ 3.
- Standard verbs:
  - GET /resources, GET /resources/:id, POST /resources, PATCH/PUT /resources/:id, DELETE /resources/:id
- Common list params: `page`, `limit`, `offset`, `sortBy`, `order`, `q`, `filter`, `fields`, `include`, `expand`.
- Consistent error shape: `{ error: { code, message, details? } }` (helpers in `lib/api/errors.ts`).
- Backward compatibility: old unversioned `/api/*` routes remain and are marked deprecated via response headers. Prefer `/api/v1/*` in new clients.

## Current Route Map (v1)

Public

- POST `/api/v1/lead`
- GET/POST `/api/v1/events`

Profile

- GET `/api/v1/profile`
- PUT `/api/v1/profile`
- POST `/api/v1/profile/image`

Bookings

- GET `/api/v1/bookings` (contact lookup or `me=1` for auth’d user’s bookings)
- POST `/api/v1/bookings` (create booking)

Stripe

- POST `/api/v1/stripe/create-checkout`
- POST `/api/v1/stripe/create-portal`

Test Helpers (non-prod / gated via envs)

- POST `/api/v1/test/bookings`
- DELETE `/api/v1/test/leads`
- GET `/api/v1/test/reservations/{reservationId}/confirmation`
- POST `/api/v1/test/playwright-session`

## Backward Compatibility

- All existing unversioned routes under `/api/*` are preserved.
- Middleware attaches deprecation headers to unversioned API responses:
  - `Deprecation: true`
  - `Sunset: <ISO timestamp>` (default +30 days; configurable via `ROUTE_COMPAT_WINDOW_DAYS`)
  - `Link: </api/v1/...>; rel="successor-version"`

## Utilities

- `lib/api/list-params.ts` → `parseListParamsFromUrl(url)` parses common list/query params with sane defaults and caps.
- `lib/api/errors.ts` provides helpers for consistent error shapes.

## Notes

- As we iterate, handlers may adopt shared utilities for pagination and errors. For now, behavior is preserved and changes are minimized to avoid test disruption.
