---
task: sprint3-optimization
timestamp_utc: 2025-11-26T15:23:13Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Sprint 3 – Deep Optimization & Polish

## Objective

Reduce perceived and actual cost of our core flows (settings, booking wizard, dashboards) by shrinking initial JS, deferring heavy UI, optimizing images/assets, smoothing animations, and tightening a11y/interaction polish—without regressing existing behaviour.

## Success Criteria

- [ ] Measured main JS for `/restaurants/[slug]/book` shrinks ≥15% vs baseline (Next analyzer capture in artifacts).
- [ ] Settings entry `/settings/restaurant/profile` (or any tab) initial client chunk shrinks ≥20% vs baseline.
- [ ] Lighthouse/DevTools on a test device shows CLS ≤0.10 and no large layout shifts from images/async fallbacks.
- [ ] React Query devtools/Profiler show no redundant refetch when navigating between wizard steps or settings tabs; polling/backoff is consistent (≤3 retries with backoff; polling only where justified).
- [ ] A11y polish shipped: skip link works, dialogs restore focus, aria-busy on async regions, animations respect prefers-reduced-motion.

## Architecture & Components

- **Measurement**: Add env-gated Next bundle analyzer (`@next/bundle-analyzer`) or `next build --profile` harness; capture before/after HTML in `tasks/.../artifacts/`.
- **Dynamic import targets**
  - Settings tabs: wrap each section (`RestaurantProfileSection`, `OperatingHoursSection`, `OccasionsSection`, `ServicePeriodsSection`, `OpsTeamManagementClient`) with `next/dynamic` + skeleton fallbacks; keep header/shell SSR.
  - Booking wizard: dynamic import `ReservationWizard` on marketing + ops routes; inside wizard, split heavy steps (Plan, Details, Review, Confirmation) using `dynamic` + existing skeletons.
  - Dashboard modal: load `BookingDetailsDialog` (and optional history tab) via `dynamic` triggered on click; keep small trigger button inline.
  - Analytics: lazy load `OpsRejectionDashboard` within `/analytics/rejections` with card/skeleton fallback.
  - Export/PDF helpers: defer heavy CSV/PDF builders to on-demand imports.
- **Bundle diet**: remove unused deps (e.g., `react-tooltip` if dead), prefer `lucide-react/dynamicIconImports` or local icon registry for large icon sets, verify tree-shaking of date libs (prefer `date-fns` where possible).
- **Images/assets**: swap remaining `<img>` to `<Image>` with width/height + blur placeholders; add blurDataURL for hero backgrounds; audit marketing/guest hero remote images; ensure `next.config.js` domains cover sources.
- **Memoization**: Memoize row/child components in `BookingsList`, wizard selection grids, and favorites rail; guard handlers with `useCallback`; wrap derived data with `useMemo` where expensive.
- **Network tweaks**: Standardize React Query defaults for retry/backoff/polling; ensure fetchers accept `AbortSignal` to cancel stale views; stop polling on tab blur where appropriate; audit refetchInterval usage.
- **Animation & a11y**: Replace layout-changing transitions with transform/opacity; gate motion with PRM; add `aria-busy` to async cards, restore focus on modal close, add skip link + heading fixes in layouts.

## Data Flow & API Contracts

No API contract changes expected. Verify deferred loaders do not alter request sequencing; ensure query keys remain stable when components load dynamically so cache is reused.

## UI/UX States

- Skeleton/fallbacks for each dynamic section and wizard step (use existing `WizardSkeletons`, add lightweight cards for settings/analytics).
- Error boundaries remain intact (`StepErrorBoundary` in wizard); ensure dynamic components surface loading/error messages with screen-reader-friendly status.
- Keep URL/state behaviour (step numbers, tabs) unchanged; ensure back/forward restores scroll and focus.

## Edge Cases

- Server/Client boundary: dynamic client components must stay inside existing providers (OpsSession, WizardProvider) to avoid context splits.
- SSR critical path: marketing booking page should still render hero copy and metadata while wizard chunk loads.
- Image domains: add to allowlist only if new remote sources introduced; avoid breaking existing logo uploads.

## Testing Strategy

- Pre/post `next build` with analyzer or `--profile`; store HTML/JSON outputs in `artifacts/`.
- Run targeted Lighthouse + Web Vitals via Chrome DevTools MCP on `/restaurants/[slug]/book`, `/settings/restaurant/profile`, `/app/bookings` modal open.
- React Profiler/Devtools session to confirm render counts before/after memoization.
- Manual a11y pass: keyboard-only navigation, skip link, focus trapping/restoration, aria-busy toggling.
- Unit/interaction: adjust or add tests around lazy imports if needed (ensure fallbacks render).

## Rollout

- Analyzer/dev tooling behind env flag (`ANALYZE=1`) to avoid prod impact.
- Ship optimizations in small PRs per surface (settings, booking, dashboard, assets) to ease review.

## DB Change Plan

Not applicable; no schema changes expected.
