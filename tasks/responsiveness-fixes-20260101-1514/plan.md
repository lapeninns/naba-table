---
task: responsiveness-fixes
timestamp_utc: 2026-01-01T15:14:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Responsiveness Fixes

## Objective

We will improve mobile usability and accessibility by ensuring touch targets meet 44x44px and resolve new-bookings form labeling warnings.

## Success Criteria

- [ ] All primary buttons/links in /app/bookings and /app/customers meet 44x44px on 375px width.
- [ ] Floor-plan table/zone buttons meet 44x44px on 375px width.
- [ ] Console warnings for label/field id/name on /app/new-bookings are resolved.
- [ ] No new console errors/warnings introduced.
- [ ] Manual QA via Chrome DevTools MCP with screenshots and logs in artifacts.

## Architecture & Components

- Update shared button/link styles or specific component wrappers to enforce min sizes on mobile.
- Fix form label/id wiring in new-bookings step components.

## Data Flow & API Contracts

- N/A (UI changes only).

## UI/UX States

- Ensure button layouts still fit within cards and headers at all breakpoints.

## Edge Cases

- Sidebar collapsed/expanded on tablet/desktop.
- Floor plan zones with small labels.

## Testing Strategy

- Manual QA via Chrome DevTools MCP at 375/768/1024/1440.
- Validate touch target size measurements.

## Rollout

- N/A.

## DB Change Plan (if applicable)

- N/A.
