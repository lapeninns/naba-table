---
task: factory-landing-showcase
timestamp_utc: 2025-12-10T22:06:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Factory landing reference & screenshot

## Requirements

- Functional:
  - Add design narrative sections (Visual & Aesthetic Strategy, Technical Architecture, UX) for the new Factory design direction.
  - Render the provided Factory landing layout in-app so it can be viewed and screenshotted.
  - Capture a screenshot of the rendered layout for reference.
- Non-functional:
  - Keep changes isolated from the live guest landing flow; avoid regressions.
  - Adhere to Factory/DesignSystem tokens; avoid new arbitrary colors/fonts beyond provided set.
  - Maintain accessibility (headings, labels, focusable buttons, responsive layout).

## Existing Patterns & Reuse

- Current home uses `src/app/(public)/page.tsx` with composed sections from `src/components/landing/HomeSections.tsx` (shadcn-driven marketing layout).
- Design tokens/components documented in `DesignSystem.md` (GlobalStyles, Button, Badge, Input, SearchBar, MetricTile, Modal, Toast) but not implemented as runtime code.
- `globals.css` + `styles/guest-design-system.css` already provide typography utilities (`heading-*`, `text-body`), shadows, and radii under `.guest-theme`.

## External Resources

- User-provided Factory design brief and full React snippet (NavBar, Hero, Bento metrics grid, Live feed, Footer) to be rendered as reference.

## Constraints & Risks

- Introducing new CSS variables could clash with existing global theme; need to scope tokens to the reference page only.
- Page uses client-side state (`useState`, `useEffect`) for the live feed; must mark the component as client-side in Next.js.
- Manual UI QA + screenshot required per AGENTS; ensure the route is reachable for DevTools/Playwright capture.

## Open Questions (owner, due)

- Should this replace the main home page or live as a reference? → Assumption: reference-only dev/marketing preview to avoid production impact.

## Recommended Direction (with rationale)

- Create a dedicated reference route (e.g., `/dev/factory-landing`) that renders the provided Factory layout as a client component, with CSS variables scoped to the page container to avoid global overrides.
- Store the design narrative (sections A/B/C) in a doc (`docs/factory-landing-notes.md`) so the rationale travels with the code.
- Capture a screenshot of the new page and save to `tasks/factory-landing-showcase-20251210-2206/artifacts/` for review and future PR evidence.
