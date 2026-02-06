---
task: ops-bookings-ux-improvements
timestamp_utc: 2026-02-06T16:07:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Improve /app/bookings UX

## Problem

`/app/bookings` currently hides the primary "view" control (Recent/Upcoming/Past/etc) and relies on implicit defaults and URL params. This makes the screen feel ambiguous ("what am I looking at?") and slows down operators during service.

## Requirements

- Default to Upcoming when no query params are provided.
- Make view controls explicit and keyboard-accessible.
- Add a date picker for day scope (and clear/today shortcuts).
- Add a single Reset action for clearing filters/search/context.
- Fix empty-state CTAs for ops routing in single-host vs app-subdomain.
- Maintain infinite scrolling + booking lifecycle actions correctness.

## Existing Patterns & Reuse

- Sticky toolbar pattern: `src/components/features/ops-shell/patterns/OpsPageToolbar.tsx`.
- Calendar + popover pattern: `src/components/features/dashboard/HeatmapCalendar.tsx` + `components/ui/calendar.tsx`.
- List virtualization + ops booking cards: `components/dashboard/BookingsTable.tsx` -> `src/components/features/dashboard/cards/OpsBookingCard.tsx`.

## Risks

- Default view change could hide statuses if backend list endpoint doesn't accept them.
- URL sync must remain stable and not reintroduce stale params via debounced updates.
