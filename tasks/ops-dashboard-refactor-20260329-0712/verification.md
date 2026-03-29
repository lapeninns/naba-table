---
task: ops-dashboard-refactor
timestamp_utc: 2026-03-29T07:12:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Static Validation

- `pnpm exec tsc --noEmit` — passed
- Targeted eslint on changed dashboard files — passed
- `pnpm exec vitest run 'tests/components/OpsDashboardListUtils.test.ts' 'tests/lib/supabase/realtime-client.test.ts'` — passed
- `pnpm exec vitest run 'tests/components/OpsDashboardFilters.test.ts' 'tests/components/OpsDashboardSummarySelectors.test.ts' 'tests/components/OpsDashboardListUtils.test.ts' 'tests/lib/supabase/realtime-client.test.ts'` — passed
- `pnpm exec vitest run 'tests/components/OpsDashboardFilters.test.ts' 'tests/components/OpsDashboardSummarySelectors.test.ts' 'tests/components/OpsDashboardListUtils.test.ts' 'tests/lib/supabase/realtime-client.test.ts' 'tests/utils/dashboardSummary.test.ts'` — passed
- `pnpm exec vitest run 'tests/components/OpsDashboardListUtils.test.ts' 'tests/components/OpsDashboardSummarySelectors.test.ts' 'tests/utils/dashboardSummary.test.ts' 'tests/lib/supabase/realtime-client.test.ts' 'tests/components/OpsBookingCardViewModel.test.ts'` — passed
- `pnpm exec eslint 'src/components/features/dashboard/cards/opsBookingCardUtils.ts' 'src/components/features/dashboard/cards/OpsBookingCard.tsx' 'src/components/features/dashboard/list/BookingsListVirtualized.tsx' 'src/components/features/dashboard/BookingsList.tsx' 'components/dashboard/BookingsTable.tsx' 'tests/components/OpsBookingCardViewModel.test.ts'` — passed
- Re-ran `pnpm exec tsc --noEmit` and targeted eslint after aligning `components/dashboard/BookingsTable.tsx` with the shared card view-model path — passed
- `pnpm exec eslint 'src/components/features/dashboard/cards/OpsBookingCard.tsx' 'src/components/features/dashboard/cards/OpsBookingCardHeader.tsx' 'src/components/features/dashboard/cards/OpsBookingCardDetails.tsx' 'src/components/features/dashboard/cards/OpsBookingCardActions.tsx' 'src/components/features/dashboard/cards/opsBookingCardUtils.ts' 'src/components/features/dashboard/list/BookingsListVirtualized.tsx'` — passed
- `pnpm exec vitest run 'tests/components/OpsBookingCardViewModel.test.ts' 'tests/components/OpsDashboardListUtils.test.ts'` — passed
- Re-ran `pnpm exec tsc --noEmit` after narrowing the card subtree prop contracts — passed
- `pnpm exec eslint 'src/components/features/dashboard/types.ts' 'src/components/features/dashboard/useOpsDashboardDialogs.ts' 'src/components/features/dashboard/useOpsDashboardState.ts' 'src/components/features/dashboard/list/BookingsListVirtualized.tsx' 'src/components/features/dashboard/cards/OpsBookingCard.tsx' 'components/dashboard/BookingsTable.tsx' 'src/utils/ops/mapOpsDashboardBookingItemToBookingDTO.ts'` — passed
- `pnpm exec vitest run 'tests/components/OpsBookingCardViewModel.test.ts' 'tests/components/OpsDashboardListUtils.test.ts' 'tests/utils/mapOpsDashboardBookingItemToBookingDTO.test.ts'` — passed
- `pnpm exec eslint 'tests/utils/mapOpsDashboardBookingItemToBookingDTO.test.ts'` — passed
- Re-ran `pnpm exec tsc --noEmit` after shifting dashboard action wiring to booking IDs and lookup-based dialog resolution — passed
- `pnpm exec eslint 'src/components/features/dashboard/useOpsDashboardBookingActions.ts' 'src/components/features/dashboard/useOpsDashboardState.ts' 'src/hooks/ops/useOpsBookingStatusActions.ts' 'tests/components/useOpsDashboardBookingActions.test.tsx'` — passed
- `pnpm exec vitest run 'tests/components/useOpsDashboardBookingActions.test.tsx' 'tests/components/OpsBookingCardViewModel.test.ts' 'tests/utils/mapOpsDashboardBookingItemToBookingDTO.test.ts'` — passed
- Re-ran `pnpm exec tsc --noEmit` after removing redundant summary refetches from dashboard lifecycle actions — passed
- `pnpm exec eslint 'src/components/features/dashboard/BookingsList.tsx'` — passed
- Re-ran `pnpm exec tsc --noEmit` after removing the dead dashboard dialog preload path — passed

## Manual QA — Chrome DevTools

- Reloaded `http://app.localhost:3000/dashboard` as an authenticated operator
- Dashboard rendered successfully in the empty-state path for Sunday 29 March 2026
- Realtime status still showed `Live / Realtime`
- Duplicate Supabase `Multiple GoTrueClient instances detected` warning no longer appeared after reload
- After the dashboard state split, the route continued to render correctly with the same empty-state content and date controls intact
- After memoizing the client render boundaries, the route still rendered correctly with the same header, toolbar, and dialog wiring
- After tightening cache updates and reducing broad invalidations, the route still rendered correctly with the same empty-state content and controls
- After reducing the list/action prop surface, the route still rendered correctly with the same filter bar, print action, and empty-state list behavior
- After shifting booking cards to a precomputed row view-model contract, the route still rendered correctly with the same empty-state content, filters, and realtime badge
- After narrowing the booking card subtree to presentation-level props, the route still rendered correctly with the same empty-state content and `Live / Realtime` status
- After moving dashboard card actions to booking IDs and resolving dialog data from a shared lookup, the route still rendered correctly with the same empty-state content and `Live / Realtime` status
- After removing redundant summary refetches from lifecycle actions, the route still rendered correctly with the same empty-state content and `Live / Realtime` status
- After removing the dead `BookingDetailsDialog` preload path from `BookingsList`, the dashboard reloaded with only the expected Supabase info log and no remaining preload or stale chunk console warnings

## Lighthouse

- Mobile navigation audit
- Accessibility: 100
- Best Practices: 96
- SEO: 91
- Reports:
  - `/var/folders/t4/b7qzq59j6y95v59m5_32snvw0000gn/T/chrome-devtools-mcp-OVqTVg/report.json`
  - `/var/folders/t4/b7qzq59j6y95v59m5_32snvw0000gn/T/chrome-devtools-mcp-AHyBsX/report.html`

## Notes

- Dev harness route `http://app.localhost:3000/dev/ops-dashboard` still returned 404 in this environment, so live verification was done on the authenticated dashboard route instead.
