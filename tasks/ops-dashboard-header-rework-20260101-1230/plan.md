---
task: ops-dashboard-header-rework
timestamp_utc: 2026-01-01T12:30:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard Header Rework

## Objective

We will make the Ops dashboard header’s service date block easier to parse at a glance so ops users can instantly understand the date and booking volume.

## Success Criteria

- [ ] Service date label + booking summary read clearly on mobile and desktop.
- [ ] Date picker button remains primary action in the block.
- [ ] A11y semantics and focus states remain correct.

## Architecture & Components

- `OpsDashboardClientContent` (header layout/spacing)
- `HeatmapCalendar` (service date block layout/typography)

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Loading state in `HeatmapCalendar` keeps aligned layout.
- Default state shows label + meta + date button.

## Edge Cases

- Long date strings (locale/timezone formatting)
- No bookings vs booking counts present
- Narrow mobile width with wrap

## Testing Strategy

- Manual UI QA via Chrome DevTools MCP (required)
- Verify keyboard navigation and focus visibility
- Verify responsive behavior at 375px / 768px / 1280px

## Rollout

- No feature flag.

## DB Change Plan (if applicable)

- N/A
