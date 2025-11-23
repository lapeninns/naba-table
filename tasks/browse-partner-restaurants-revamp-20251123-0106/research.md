---
task: browse-partner-restaurants-revamp
timestamp_utc: 2025-11-23T01:06:47Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Browse partner restaurants revamp

## Requirements

- Functional:
  - Revamp the marketing "Browse partner restaurants" component into a minimal, list-first layout.
  - Surface richer restaurant details from the database (address, timezone, booking policy, capacity, contact, map link) while keeping booking CTA.
  - Keep live data (React Query + /api/v1/restaurants) and existing analytics tracking.
- Non-functional (a11y, perf, security, privacy, i18n):
  - WCAG-compliant semantics (lists, headings, focus-visible, aria-live for status/errors).
  - Responsive for mobile-first; minimal visual noise.
  - Avoid leaking PII; show only public contact/address fields already in DB.
  - Maintain current perf budgets; keep list virtual small, no heavy assets.

## Existing Patterns & Reuse

- Current component at `components/marketing/RestaurantBrowser.tsx` uses Shadcn `Card/Badge/Button`, `useRestaurants` hook, and analytics events.
- Data fetched via `listRestaurants` → Supabase selecting `id,name,slug,timezone,capacity` only.
- Supabase schema (`types/supabase.ts`) exposes richer fields: `address`, `contact_email`, `contact_phone`, `google_map_url`, `booking_policy`, `logo_url`, `is_active`, reservation timing columns.
- Error + empty + skeleton states already implemented; can be simplified/reused with updated copy.

## External Resources

- Supabase typed schema in `types/supabase.ts` (for available restaurant fields).

## Constraints & Risks

- Existing `RestaurantSummary` type is used by page prefetch + `getRestaurantBySlug`; expanding type must stay backward compatible (optional fields) to avoid breaking other callers.
- Some restaurants may have null address/contact/policy; UI must degrade gracefully without blank gaps.
- Analytics events should continue to fire to avoid regressions in marketing dashboards.
- Manual UI QA via Chrome DevTools MCP required after UI change.

## Open Questions (owner, due)

- Q: Which details matter most for "great details"? (Assume address, policy snippet, contact, timezone unless instructed otherwise.)
  A: Proceed with these defaults and keep layout flexible.

## Recommended Direction (with rationale)

- Extend `RestaurantSummary` + `listRestaurants` selection to include optional detail fields (address, booking_policy, contact email/phone, google_map_url, logo_url, capacity/timezone still present).
- Simplify UI to a vertical list (1 column on mobile, 2 on desktop) with compact `Card` rows: name + timezone badge, address with map link, booking policy summary, contact info, capacity/availability chips, primary CTA to book.
- Keep existing loading/error handling but tighten copy; ensure aria-live for status and semantic list/definition lists for details.
- Preserve analytics hooks for view, error, empty, and selection events.
