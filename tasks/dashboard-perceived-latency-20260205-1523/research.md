---
task: dashboard-perceived-latency
timestamp_utc: 2026-02-05T15:23:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Dashboard Perceived Latency

## Requirements

- Functional:
  - Enforce a minimum loader display time (min ~300ms) with a short show delay (~120ms) to prevent skeleton flashes.
  - Prefer stale-while-revalidate: keep prior content visible and show an inline refresh indicator on refetch.
  - Apply to dashboard summary, list, header, heatmap calendar, and booking details dialog.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Respect prefers-reduced-motion (global in `src/app/globals.css`).
  - Keep aria-busy and role="status" for loading indicators.
  - Avoid delaying already-slow requests or blocking interactions.

## Existing Patterns & Reuse

- Route-level loading: `src/app/app/(app)/dashboard/loading.tsx` renders `DashboardSkeleton`.
- Summary skeleton: `src/components/features/dashboard/DashboardSummarySkeleton.tsx`.
- List skeleton: `OpsBookingCardSkeleton` + `BookingsListSkeleton` in `DashboardSummaryCard`.
- React Query SWR behavior: `useOpsTodaySummary` uses `placeholderData: keepPreviousData`.
- Existing refresh indicators: `BookingsListControls` status pill, `OpsDashboardHeader` "Updating…" text.
- Loading a11y: `HeatmapCalendar` sets `aria-busy`; dashboard components use `role="status"`.

## External Resources

- TanStack Query placeholder data: https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data
- TanStack Query background fetching indicators: https://tanstack.com/query/latest/docs/framework/react/guides/background-fetching-indicators
- Next.js App Router loading UI and streaming: https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming

## Constraints & Risks

- Follow SDLC task artifacts and manual UI QA via Chrome DevTools MCP for UI changes.
- No new base UI primitives; use existing shadcn/ui components.
- Keep data fetching and cache keys unchanged.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add a reusable `useMinimumDelay` hook to gate loader visibility with a show delay + minimum duration.
- Apply delayed indicators in dashboard components to avoid single-frame flashes.
- Use existing skeletons and apply a subtle fade-in on content mount to polish transitions.
