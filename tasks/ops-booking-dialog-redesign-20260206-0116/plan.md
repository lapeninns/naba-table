---
task: ops-booking-dialog-redesign
timestamp_utc: 2026-02-06T01:16:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Booking Dialog Redesign (P0–P2)

This task implements the agreed plan from the review thread.

## Objective

Make the Ops booking dialog faster to scan, more accessible, and more maintainable while preserving business behavior.

## Success Criteria

- Global shortcuts work correctly (Cmd+Enter on macOS, Ctrl+Enter on Windows/Linux) and are scoped.
- Mobile table assignment is discoverable when required.
- Safe areas are respected; footer is stable.
- Fit filters use single-select group semantics.
- Async actions announce via aria-live.
- GuestProfilePanel and TableAssignmentPanel are decomposed into subcomponents (file size caps).
- Ops cancellation confirm uses a single canonical component everywhere.
- All tables grid virtualizes at scale and preserves keyboard navigation.
- Perf trace + Lighthouse captured for the dev harness page.

## Rollout

No DB changes. Validate in staging by opening bookings, applying table assignments, and running a11y/perf checks.

## Performance Pass (Addendum)

- Virtualize the All tables grid when large (use existing `@tanstack/react-virtual`).
- Keep Suggested tables non-virtualized.
- Add content-visibility to heavy panels (timeline + email delivery).
- Validate smooth scrolling and roving focus in the dev harness.

## Policy Addendum — Table Assignment Eligibility

- Centralize assignment eligibility in `lib/ops/table-assignment-policy.ts`.
- Enforce status + date gate in Ops UI and server direct-assignment endpoints.
- Update messaging to reflect “past or completed” lock.
