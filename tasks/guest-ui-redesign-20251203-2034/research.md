---
task: guest-ui-redesign
timestamp_utc: 2025-12-03T20:35:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Guest UI Redesign

## Requirements

- **Functional**
  - Redesign **all guest-facing routes** (public + protected) for booking discovery, reservation creation, post-booking management, thank-you flows, guest dashboard, bookings list/detail/receipt, and profile.
  - Preserve existing flows (auth redirect logic, booking lookups, thank-you deep links) while modernizing layouts and components.
  - Maintain current data contracts with Supabase-backed services and route handlers; no schema changes planned in this task.
- **Non-functional (a11y, perf, security, privacy, i18n)**
  - WCAG 2.2 AA: focus visibility, pointer target ≥24px, logical heading hierarchy, semantic landmarks, aria-live for async feedback, reduced-motion support.
  - Mobile-first responsiveness for 360–1440px; avoid CLS (reserve image/hero space), hit perf budgets (FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms).
  - Keep client bundles lean; reuse Shadcn primitives and shared layouts to avoid duplicate styling.
  - Respect auth boundaries: protected guest pages must redirect unauthenticated users; public flows must not leak PII.

## Existing Patterns & Reuse

- **Layouts**: `src/components/layouts/GuestLayout` wraps guest routes with `Header` (components/layout) and `Footer`; marketing uses `PageHero/PageSection` under `src/components/shared`.
- **Navigation & shell**: `components/layout/Header/Header.tsx` already handles auth-aware nav, mobile sheet, avatar menu; can be rethemed rather than rebuilt.
- **Booking flows**: Public booking uses `ReservationWizardClient` (`src/components/features/booking/wizard/*`) from `restaurants/[slug]/book` plus thank-you pages; guest bookings list/detail under `src/app/guest/bookings/**`.
- **Dashboard**: `GuestDashboardClient` hydrates react-query state; page redirects unauthenticated users.
- **UI primitives**: Shadcn-derived components live in `src/components/ui`; marketing/shared cards in `src/components/shared`; tables/cards/buttons already standardized.
- **Data/services**: Route pages lean on `server/restaurants/*`, `src/services/ops/*`, and hooks (`src/hooks` / `hooks`) for data; reuse rather than bypass.
- **Styles**: Global Tailwind tokens in `src/app/globals.css`; brand currently “Nab a Table” with primary gradient usage.

## External Resources

- Mobile-first responsive UX guidance (fluid grids, spacing, line length) and emphasis on progressive enhancement were reinforced by current web best-practice articles. These stress simplifying nav, prioritizing above-the-fold value, and trimming secondary CTAs to speed decision-making.citeturn0search0
- WCAG 2.2 updates highlight pointer target sizing, focus appearance, and reduced-motion requirements that must inform component states and spacing.citeturn0search1

> MCP (Context7/DeepWiki) not available in this environment (no resources listed); external web research used instead and cited above.

## Constraints & Risks

- **Scope blast radius**: Touches every guest route; high risk of regression in auth redirects, deep links (`/bookings/[id]/manage`, `/guest/bookings/[id]/receipt`, marketing thank-you).
- **Data boundaries**: Must not change Supabase schema or API responses; rely on existing services/hooks.
- **Performance**: Rich visuals could bloat bundles; need shared design tokens and image handling (sizes/aspect-ratio) to avoid CLS.
- **A11y compliance**: Complex widgets (sheet, dropdown, wizard steps) must retain keyboard support; redesign must not regress focus management.
- **Timeline**: Large redesign likely needs phased rollout/flags (`feat.guest.ui`), otherwise risk of big-bang breakage.

## Open Questions (owner, due)

- Palette & typography source of truth? (Owner: Design/brand, Due: 2025-12-06) — confirm brand colors/tones and font licensing.
- Motion rules? (Owner: Design/PM, Due: 2025-12-06) — define acceptable durations/easings and reduced-motion behavior.
- Assets & imagery? (Owner: Marketing, Due: 2025-12-07) — confirm available restaurant imagery/illustrations or need placeholders.
- Copy refresh scope? (Owner: PM, Due: 2025-12-06) — decide if we rewrite marketing + in-app microcopy during redesign.
- Feature flag strategy? (Owner: Eng, Due: 2025-12-05) — agree on `feat.guest.ui` flag semantics and exposure plan.

## Recommended Direction (with rationale)

- Establish a **unified design system** (tokens for color/spacing/typography, button/link styles, card templates) built on existing Shadcn primitives to minimize new surface area.
- Define two shells: **Marketing shell** for public routes `(public)` with light hero + story sections; **Guest app shell** for authenticated routes with persistent nav/status bar and contextual side panels where space allows.
- Create **page templates** for recurring patterns (list + filters, detail with summary/action rail, wizard, receipt/confirmation, empty/error) to enforce consistency across bookings, dashboard, and profile.
- Apply **mobile-first layouts**: single-column with progressive disclosure; enhance to split-view on ≥1024px for dashboards/management pages.
- Instrument **loading/empty/error** states with consistent visuals and aria-live messaging; ensure booking wizard and manage pages surface validation inline.
- Use **feature flag + incremental rollout** to ship marketing pages first, then booking wizard/thank-you, then authenticated dashboard/booking detail, reducing blast radius while gathering telemetry.
