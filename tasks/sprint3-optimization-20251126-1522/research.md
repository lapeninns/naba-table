---
task: sprint3-optimization
timestamp_utc: 2025-11-26T15:23:13Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Sprint 3 – Deep Optimization & Polish

## Requirements

- **Functional:** Reduce initial JS for primary flows (settings, booking wizard, analytics, export modals) via code splitting; add graceful fallbacks. Standardize image handling with Next `<Image>`, blur placeholders, explicit dimensions, and lazy loading. Optimize memoization for render-heavy lists and handlers; cancel stale network requests and tame polling/retries. Polish animations (transform/opacity, PRM) and a11y cues (aria-busy, focus/skip link, heading order).
- **Non-functional:** Honor AGENTS perf budgets (FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms) and a11y baseline (keyboard flows, roles/labels, focus management). Avoid bundle regressions and layout jank; respect prefers-reduced-motion.

## Existing Patterns & Reuse

- **No dynamic imports today:** `rg "next/dynamic" src` returns none—every client component is statically bundled.
- **Settings tabs share one client bundle:** `src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx` imports all section components (profile, operating hours, occasions, service periods, team) eagerly, so every tab payload ships on first load. Each section pulls sizeable form+hook code (react-hook-form, luxon, react-query).
- **Booking wizard heavy & reused:** Marketing booking page (`src/app/(marketing)/restaurants/[slug]/book/page.tsx`) and ops walk-in (`src/app/app/(app)/walk-in/_components/WalkInWizardClient.tsx`) import `ReservationWizard` synchronously. Steps live in `reserve/features/reservations/wizard/ui/steps/*` and include date math (luxon), form state, calendars, selection grids—large for initial page bundles.
- **Heavy modal content:** `src/components/features/dashboard/BookingDetailsDialog.tsx` bundles rich tabbed UI, react-query history fetch, luxon/time utils, keyboard shortcuts. It is imported directly by `BookingsList`, so the entire modal ships with the list even when unopened.
- **Analytics/charts:** `src/components/features/dashboard/rejections/OpsRejectionDashboard.tsx` is a client component combining forms, tables, and lucide icons; the analytics route currently loads everything eagerly.
- **Icons:** lucide-react dist is ~39 MB (`du -sh node_modules/lucide-react/dist`), and components pull many icons; although tree-shaken, icon imports dominate bundle cost when concentrated per page.
- **Images still using `<img>`:** Restaurant logo uploader (`src/components/features/restaurant-settings/RestaurantLogoUploader.tsx`), guest dashboard hero & cards (`src/components/features/guest/dashboard/GuestDashboardClient.tsx`), and marketing components (`components/ButtonSignin.tsx`, `components/FeaturesGrid.tsx`) render raw `<img>` with no dimensions/blur, risking CLS and bypassing Next optimization.
- **Animation hooks present:** `tw-animate-css`, `tailwindcss-animate` are available; globals have minimal motion guards. No prefers-reduced-motion checks around hero background animations.
- **Network layer:** React Query v5 is used broadly; cancellation/backoff not standardized. `BookingsList` subscribes to real-time + queries; polling configs vary per hook.

## External Resources

- Next.js built-in `next/dynamic` for code splitting + suspense fallbacks (official docs). No extra library required for lazy loading.
- Rollup Visualizer already available via `pnpm analyze` (Vite config for `reserve`), but Next bundles need `@next/bundle-analyzer` or `next build --profile` for measurement.

## Constraints & Risks

- Must keep SSR/SEO intact for marketing pages; dynamic imports should preserve critical content or render server fallbacks to avoid blank first paint.
- Dynamic-loading client components must remain under `use client`; ensure suspense fallbacks are accessible (role="status", aria-busy, focusable when needed).
- Booking wizard & settings rely on shared contexts (`useOpsSession`, `WizardProvider`); splitting must not duplicate providers or break state continuity.
- Lucide icon reduction must avoid regressions in visual semantics; replacing sets risks mismatched strokes/sizes.
- Converting to `<Image>` requires remote domain allowlist—`next.config.js` already whitelists common domains; new sources must be added carefully.

## Open Questions (owner, due)

- What target reduction (% or KB) constitutes success for main `/bookings`, `/settings/*`, `/restaurants/[slug]/book`? (Product/Eng, 2025-11-27)
- Are we allowed to add dev-only dependency `@next/bundle-analyzer` for profiling? (Maintainers, 2025-11-27)
- Should ops walk-in wizard remain fully client-side, or can we defer non-critical helpers (analytics, tooltips) to idle? (Eng, 2025-11-28)

## Recommended Direction (with rationale)

1. **Establish baseline:** add temporary analyzer (`@next/bundle-analyzer`) or use `next build --profile` to capture per-route chunk sizes; record in `artifacts/` before/after.
2. **Targeted dynamic imports:**
   - Settings tabs: lazy-load each section component via `next/dynamic` with skeleton placeholders; keep shell layout/heading server-rendered for SEO/a11y.
   - Booking wizard: lazy-load `ReservationWizard` on marketing and ops routes with suspense fallback (use existing `LoadingFallback` / `WizardSkeletons`). Consider step-level splitting (Plan/Details/Review/Confirmation) using `dynamic` inside wizard to keep initial chunk smaller.
   - Dashboard modals: dynamically import `BookingDetailsDialog` and possibly history tab, mounting only on demand; provide lightweight trigger button.
   - Analytics: dynamic-load `OpsRejectionDashboard` within the page to avoid adding charts/forms to main shell.
   - Export/PDF: wrap heavy export or PDF helpers in `dynamic` or on-click imports.
3. **Bundle diet:** prune unused deps (`react-tooltip`, unused marketing images), prefer `lucide-react/dynamicIconImports` or local icon map to cut icon payload; ensure tree-shaking-friendly imports (no `lucide-react` default barrel).
4. **Image optimization:** replace remaining `<img>` with `<Image>` + width/height + `placeholder="blur"` where assets known; define blurDataURL for hero placeholders; audit marketing components for large remote hero URLs and enforce `priority` only where needed.
5. **Memoization & network:** memoize list rows (e.g., `BookingsList` items) and expensive derived data; wrap handler props in `useCallback`; enable React Query abort signals for navigations and standardize retry/backoff & polling intervals; ensure stale queries cancel when modals close.
6. **Animation & a11y polish:** shift any layout-based animations to transform/opacity; gate motion on `prefers-reduced-motion`; add `aria-busy` on async regions, focus trapping/restore in dialogs, skip link and heading fixes in main layouts.
