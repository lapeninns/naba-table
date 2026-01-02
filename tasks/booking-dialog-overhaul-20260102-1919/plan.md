---
task: booking-dialog-overhaul
timestamp_utc: 2026-01-02T19:19:13Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Details Dialog UX/UI Overhaul

## Objective

We will make the Booking Details Dialog faster to scan and operate by decomposing the layout into clear panels, adding keyboard shortcuts, and improving table assignment ergonomics without any backend changes.

## Success Criteria

- Header reflects booking status with semantic colors (emerald/rose/blue) and remains accessible.
- Dialog stacks guest + table panels on <768px and is side-by-side on desktop.
- Cmd/Ctrl+Enter triggers the primary action; Esc closes dialog when open.
- WhatsApp link appears when a phone number exists and uses a digits-only `wa.me` URL.
- Smart Assign selects the tightest available table (capacity >= party size) and does not auto-apply.

## Architecture & Components

- `DialogHeader` (new component): status styling + quick stats + close.
- `GuestProfilePanel` (new component): avatar, loyalty, tags, contact actions, notes.
- `TableAssignmentPanel` (existing component): filters, smart assign, table grid, conflict indicator.

## Data Flow & API Contracts

- Use existing `OpsTodayBooking` + `OpsTodayBookingsSummary` props for dialog.
- Table data via `useTableAssignment` (AssignmentContext); no new endpoints.

## UI/UX States

- Loading, error, empty booking, normal layout.
- Table assignment: no tables, filters yield no results, conflict highlighting.

## Edge Cases

- Missing phone/email: hide WhatsApp/email buttons and show fallback text.
- Missing end time: conflict timeline renders a minimal block at start time.
- Booking with existing assignments: smart assign should not override without user action.

## Testing Strategy

- Manual QA for dialog layout and keyboard shortcuts.
- Run lint, typecheck, and test scripts from `package.json`.
- Add/adjust tests only if existing suite for booking-details exists and breaks.

## Rollout

- No feature flag; ship as UI-only refactor.
- Monitor errors and a11y regressions in manual QA.

## DB Change Plan (if applicable)

- Not applicable (frontend-only, no migrations).
