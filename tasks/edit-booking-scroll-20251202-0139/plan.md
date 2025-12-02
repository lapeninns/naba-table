---
task: edit-booking-scroll
timestamp_utc: 2025-12-02T01:40:03Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Edit booking dialog scroll

## Objective

Ensure the edit booking modal allows users to reach all fields by enabling vertical scrolling within the dialog body when content exceeds viewport height.

## Success Criteria

- [ ] Modal content remains fully reachable on smaller viewports via internal scroll (no page/background scroll bleed).
- [ ] Header/close button remain visible and focusable; footer actions unaffected.
- [ ] No visual regression for typical desktop sizes (modal width, spacing intact).

## Architecture & Components

- Target the booking edit dialog component under `src/app` / `src/components/features/booking` (confirm exact file). Adjust container class/style to add `overflow-y-auto` with viewport-based max height. If footer exists, ensure padding accommodates scrollbars.

## Data Flow & API Contracts

- No API contract changes; pure layout CSS update.

## UI/UX States

- Default/edit state; ensure keyboard navigation and focus traversal respect the scrollable region.

## Edge Cases

- Smaller laptop screens where modal height exceeds viewport.
- Long notes text area causing overflow.
- Browser zoom at 110–125%.

## Testing Strategy

- Manual: open edit booking modal, resize to ~700px height or use browser devtools responsive view; confirm inner scroll works and backdrop does not scroll.
- Automated: consider adding a regression test if an existing component test suite supports layout snapshots (not planned unless nearby patterns exist).

## Rollout

- No feature flag. Straightforward UI tweak.
