---
task: ops-dashboard-print
timestamp_utc: 2026-01-24T19:16:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: [feat.ops.print_bookings]
related_tickets: []
---

# Implementation Plan: Ops Dashboard Booking Print

## Objective

We will enable ops staff to print a clean, formatted booking list filtered to their current dashboard view so that front-of-house can use paper-friendly lists without on-screen UI clutter.

## Success Criteria

- [ ] Print action is accessible from the ops dashboard and clearly labeled.
- [ ] Print output includes only name, table number, notes, party size, time.
- [ ] Print output respects current filters, search, sort, and selected date.
- [ ] Print view is visually readable and compact, with page-break safe layout.

## Architecture & Components

- Ops dashboard entry point: `src/components/features/dashboard/OpsDashboardClient.tsx`.
- Print action placement: toolbar area near `BookingsFilterBar` or within `DashboardSummaryCard` actions.
- Print view component (new): `src/components/features/dashboard/OpsBookingsPrintView.tsx` (client component to render and trigger print).
- Print route (new): `src/app/app/(app)/dashboard/print/page.tsx` or similar, accepts query params for filters/search/sort/date.
- Data access: reuse ops bookings list hook/service used by dashboard (likely `useOpsBookingsList` or related) to fetch consistent data for print.

## Data Flow & API Contracts

- Print route receives query params: `date`, `filter`, `search`, `sortKey`, `sortDir`, `tableId` (if applicable), `statuses`.
- Use existing ops bookings fetch with these params; no new API needed unless existing hooks cannot accept all filter/sort inputs.
- Output is a print-specific UI with a static table.

## UI/UX States

- Loading: minimal skeleton or “Preparing print view…” message.
- Empty: “No bookings for the selected filters.”
- Error: friendly error message with retry.
- Success: rendered print layout + auto-trigger `window.print()` when content is ready (with user-initiated fallback button).

## Edge Cases

- Notes are long: wrap text and avoid overflow.
- Missing table assignment: show “Unassigned” placeholder.
- Missing guest name: show “Walk-in Guest”.
- Timezone handling: use ops summary timezone.
- Large lists: ensure pagination is disabled for print (show all filtered results).

## Testing Strategy

- Unit: data mapping for print rows (name/table/notes/party/time).
- Integration: print route renders with filters/search/date from query params.
- E2E: optional smoke for `/app/dashboard/print` (if feasible).
- Accessibility: keyboard focus, ARIA label on print button.

## Rollout

- Feature flag: `feat.ops.print_bookings` (default on in ops environment unless otherwise required).
- Exposure: 100% (low risk, UI-only).
- Monitoring: check console errors and user feedback.
- Kill-switch: hide print action behind flag.

## DB Change Plan (if applicable)

- Not applicable.
