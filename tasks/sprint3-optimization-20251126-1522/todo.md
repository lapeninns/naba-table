---
task: sprint3-optimization
timestamp_utc: 2025-11-26T15:23:13Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Add analyzer harness (env-gated) and capture baseline bundle stats in `artifacts/`.
- [ ] Confirm image domains allowlist covers planned sources.

## Code Splitting

- [x] Lazy-load settings sections (`RestaurantProfileSection`, `OperatingHoursSection`, `OccasionsSection`, `ServicePeriodsSection`, `OpsTeamManagementClient`) with fallbacks.
- [x] Lazy-load `ReservationWizard` on marketing + ops routes; split internal steps with suspense fallbacks.
- [x] Lazy-load heavy modals (`BookingDetailsDialog`, history tab) on demand.
- [x] Lazy-load analytics dashboard (`OpsRejectionDashboard`) with placeholder.
- [ ] Defer export/PDF helpers to on-demand imports.

## Bundle Diet

- [ ] Identify and remove unused deps (e.g., `react-tooltip` or others after analyzer).
- [ ] Reduce icon payload (dynamic icon imports or shared registry where dense).
- [ ] Verify date/time libs are tree-shaken; prefer `date-fns` where feasible.

## Images & Assets

- [x] Replace remaining `<img>` usages with `<Image>` + width/height + blur placeholders (logos, guest cards, marketing avatars).
- [ ] Add blurDataURL/low-res placeholders for hero/marketing backgrounds.
- [ ] Ensure lazy loading for non-critical images; check CLS on target pages.

## Memoization & Network

- [ ] Memoize render-heavy rows/cards (Bookings list, wizard slot grid, favorites rail).
- [ ] Wrap handler props in `useCallback`; memoize derived data.
- [x] Standardize React Query retry/backoff/polling; wire abort signals for fetchers and cancel on unmount/tab change.

## Animation & A11y

- [ ] Replace layout-affecting animations with transform/opacity; gate via prefers-reduced-motion.
- [ ] Add `aria-busy` to async regions; ensure focus trap/restore for dialogs; add skip link + heading fixes.

## Tests / Verification

- [ ] Run analyzer & document before/after stats.
- [ ] Lighthouse/Perf + a11y pass via Chrome DevTools MCP (mobile + desktop).
- [ ] Spot-check React Query devtools/Profiler for wasted renders/refetches.

## Notes

- Assumptions: no backend or schema changes required.
- Deviations: document any added dependencies or skipped areas with justification.
