---
task: remove-default-restaurant
timestamp_utc: 2025-11-26T10:58:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Remove default restaurant fallback

## Requirements

- Eliminate baked-in default restaurant ID/slug and seeded venue info (White Horse Pub) from configuration and runtime behavior.
- Ensure app surfaces a clear requirement to select/provide a restaurant instead of silently falling back.
- Avoid breaking existing flows; provide explicit errors or selection prompts when restaurant context is missing.

## Existing Patterns & Reuse

- Fallback constants live in `server/supabase.ts` (default ID/slug), `reserve/shared/config/venue.ts`, and `lib/venue.ts`.
- Many routes call `getDefaultRestaurantId()` when no restaurant is supplied (bookings, availability, tests, test fixtures).
- Marketing/guest UI uses `DEFAULT_RESTAURANT_SLUG` to build booking links.

## Constraints & Risks

- Removing defaults impacts multiple API routes and UI entry points; must replace with explicit requirement (e.g., require slug/id param) or a “choose restaurant” flow.
- Tests rely on mocked defaults; they need updates to new behavior.
- Production/staging may set env vars; behavior should prefer explicit env values but not hard-code sample data.

## Open Questions

- Should guest landing links fall back to a restaurant chooser page, or should we render an error? (Assume minimal change: redirect to restaurant discovery if available; otherwise show actionable error.)

## Recommended Direction

- Remove hardcoded fallback values; make env-driven defaults optional. If missing, API routes return 400 with a clear message rather than using a seed ID.
- Update UI links to use a discovery route (e.g., `/restaurants`) when no default slug exists.
- Keep env schema optional; document that operators must supply restaurant context or ensure selection upstream.
