---
task: dashboard-ux-smoothing
timestamp_utc: 2026-02-03T23:23:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Dashboard UX/Performance Smoothing

## Requirements

- Functional:
- Add route-level loading state for `/app/dashboard` using existing skeletons.
- Fix a11y gaps (missing labels, aria-hidden, aria-labelledby targets) without changing behavior.
- Replace `transition-all` with explicit property transitions on dashboard UI.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Performance targets for 1000 bookings; smooth scroll and minimal layout shift.
  - Follow Web Interface Guidelines for UI semantics and motion.

## Existing Patterns & Reuse

- Ops dashboard route: `src/app/app/(app)/dashboard/page.tsx` renders `OpsDashboardClient`.
- Ops shell and sidebar: `src/components/features/ops-shell/OpsShell.tsx`, `src/components/features/ops-shell/OpsSidebarLayout.tsx`.
- Dashboard skeleton: `src/components/features/dashboard/DashboardSkeleton.tsx`.
- Heavy list virtualization already present:
  - `src/components/features/dashboard/BookingsList.tsx` uses `useWindowVirtualizer`.
  - `components/dashboard/BookingsTable.tsx` uses `useWindowVirtualizer`.
- Ops summary data hook: `src/hooks/ops/useOpsTodaySummary.ts` with SWR-style `placeholderData` and polling/realtime.

## External Resources

- Web Interface Guidelines: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## Constraints & Risks

- Scope limited to ops dashboard (`/app/dashboard`) only.
- Manual QA blocked if auth/session not available.

## Open Questions (owner, due)

- Q: Which dashboard tasks are highest priority (top 2–3)?
  A: Bookings list triage flow.
- Q: Desired data scale for perf targets (rows, images, etc.)?
  A: 1000 bookings.
- Q: Can we run the app locally for profiling and p95 latency?
  A: Yes, local profiling allowed (auth required; dashboard access blocked during QA).
- Q: Confirm scope includes ops dashboard only (`/app/dashboard`) vs also guest dashboard (`/guest/dashboard`).
  A: Ops dashboard only.

## Recommended Direction (with rationale)

- Implement a small set of low-risk UI improvements: route-level loading, a11y labeling, and explicit transitions.
- Keep data fetching behavior stable; no query or mutation logic changes in this phase.
