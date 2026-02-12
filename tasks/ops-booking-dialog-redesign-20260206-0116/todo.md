---
task: ops-booking-dialog-redesign
timestamp_utc: 2026-02-06T01:16:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Task Setup

- [x] Ensure task artifacts exist (this folder).
- [x] Update CONTINUITY.md.

## Shortcuts

- [x] Update `src/hooks/useGlobalShortcuts.ts` to support `metaOrCtrl` and `allowRepeat`.
- [x] Update all call sites to use correct modifier semantics.
- [x] Add unit tests for shortcut matching.

## Booking Dialog Shell

- [x] Safe-area padding and dvh sizing for mobile sheet.
- [x] Hide redundant footer date/time on mobile.
- [x] Replace footer wrap actions with `DropdownMenu` overflow.
- [x] Copy summary feedback (visual + aria-live).
- [x] Focus restoration on close.

## Mobile Tables

- [x] Auto-open table assignment when required (first open only).
- [x] Add “Action required” indicator on the table assignment trigger.
- [x] Remove timeout-based scroll; prefer focus + reduced-motion aware scroll.

## Cancel Unification

- [x] Add shared `OpsCancelBookingAlertDialog` component.
- [x] Replace cancel confirm dialogs in OpsBookingsClient, OpsDashboardDialogs, BookingDialog.

## Guest Panel Refactor

- [x] Extract guest subcomponents into `components/guest/`.
- [x] Add desktop tabs (Guest/Booking/History).
- [x] Consolidate dietary badges into single badge + popover.
- [x] Notes default collapsed.
- [x] Deposit uses `Intl.NumberFormat` (GBP default).

## Table Panel Refactor

- [x] Extract table assignment subcomponents into `components/table-assignment/`.
- [x] Fit filters via ToggleGroup (single).
- [x] Rename “AI Optimized” to “Suggested”.
- [x] Add aria-live status and success alerts.
- [x] Roving focus + arrow key nav grid.
- [x] Add offline banner.

## Selectable Table Card

- [x] Reduced motion classes.
- [x] Better SR description via aria-describedby.

## Table Assignment Eligibility Policy

- [x] Add shared policy helper in `lib/ops/table-assignment-policy.ts`.
- [x] Apply status + date gate in Ops client surfaces.
- [x] Enforce status + date gate in server direct-assignment endpoints.
- [x] Add policy unit tests.

## Verification

- [x] Run lint/typecheck/tests.
- [x] Chrome DevTools MCP manual QA and artifacts in `artifacts/`.
- [x] Fill verification.md.

## Performance Pass

- [x] Add ScrollArea `viewportRef` for virtualization.
- [x] Virtualize All tables at scale and preserve keyboard navigation.
- [x] Add content-visibility to heavy panels.
- [x] Capture updated perf trace + Lighthouse JSON for dev harness.
