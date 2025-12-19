---
task: guest-routes-unification
timestamp_utc: 2025-12-03T19:19:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Route Unification

## Requirements

- Create/confirm a `guest/thank-you` page; remove stale 404-prone pages.
- Unify guest-facing routes to a consistent `/guest/*` pattern; avoid redirects within guest area.
- Optimize naming and flows while keeping existing deep links stable (per AGENTS guidance).

## Existing Patterns & Reuse

- Current guest routes live under `src/app/guest/**`; `guest/page.tsx` redirects to `/guest/dashboard`.
- `guest/bookings/[bookingId]/page.tsx` permanently redirects to `/bookings/:id` (non-guest path).
- Booking detail implementation lives at `(public)/bookings/[bookingId]/page.tsx` (supports auth or token).
- `guest/thank-you/page.tsx` already exists and renders static confirmation.
- Middleware does not enforce guest auth; per-page Supabase checks do.

## Constraints & Risks

- Must avoid breaking existing bookmarked links (`/bookings/:id`), so keep compatibility while reducing guest-facing redirects.
- Need to ensure shared logic (data fetching, metadata) stays consistent between old and new paths.
- UI changes require Chrome DevTools MCP per AGENTS; note if pending.

## Open Questions

- Should `/bookings/:id` remain first-class or only as legacy alias? (assume keep as alias for stability.)
- Any analytics/SEO implications for adding `/guest/bookings/:id`? (not addressed here.)

## Recommended Direction

- Reuse booking detail implementation via shared module; have both `/bookings/:id` and `/guest/bookings/:id` render without redirects.
- Make `/guest` render dashboard content directly (no redirect).
- Confirm `guest/thank-you` exists; remove stale doc references to non-existent routes and mark legacy aliases.
