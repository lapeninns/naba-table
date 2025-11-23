---
task: revamp-restaurants-page
timestamp_utc: 2025-11-23T00:38:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Restaurants Page Revamp

## Requirements

- Functional:
  - Revamp the marketing restaurants directory page at `/restaurants` while keeping the navbar, footer, and list of restaurants functional.
  - Preserve RestaurantBrowser functionality (filters/search, bookings link) and data source.
  - Improve hero, layout, hierarchy, and CTAs to guide users to start booking.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain WCAG-compliant landmarks, headings, focus-visible states; ensure controls are keyboard accessible.
  - Keep load performant (Target LCP ≤ 2.5s, avoid heavy assets/CLS), mobile-first responsive down to 360px.
  - No secrets or API changes; static copy only. Text should remain clear for international users (simple wording).

## Existing Patterns & Reuse

- Next.js App Router page at `src/app/(marketing)/restaurants/page.tsx` already uses Tailwind + shadcn components (Badge, buttonVariants) and HydrationBoundary for React Query state.
- RestaurantBrowser component lives at `components/marketing/RestaurantBrowser.tsx` providing filters, loading/empty/error states, and cards.
- Page currently has simple hero and a bordered card around the browser; gradient background used.

## External Resources

- None required; design handled with in-repo Tailwind + shadcn components.

- Must not break RestaurantBrowser interactions or data fetching.
- Manual UI QA with Chrome DevTools MCP required; may need to note if tooling unavailable in this environment.
- Avoid introducing new dependencies or Supabase changes (UI-only task).
- Need to ensure responsiveness across breakpoints and no CLS from new layout.

- Should we surface additional meta (price/rating) on cards? (Unknown; proceed with layout/CTAs only.)
- Any marketing copy preferences/brand voice constraints? (Not provided; use concise, neutral tone.)

- Strengthen hero with two-column layout (headline + supporting stats) and quick anchor to directory for users landing mid-scroll.
- Add “pill” highlights for trust signals and a sticky filter ribbon heading above RestaurantBrowser to reduce scroll friction.
- Use responsive grid and card elevation for clarity; maintain minimal color palette consistent with existing primary/neutral scheme.
- Keep interactions intact by reusing RestaurantBrowser; changes limited to page layout and surrounding content.
