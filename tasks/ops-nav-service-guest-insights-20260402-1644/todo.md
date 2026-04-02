---
task: ops-nav-service-guest-insights
timestamp_utc: 2026-04-02T16:45:54Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review root and closest AGENTS guidance for `src/components/**`.
- [x] Identify the canonical ops navigation source.

## Core

- [x] Update sidebar sections to `Service` and `Guest & Insights`.
- [x] Preserve existing href, icon, and active match logic.

## UI/UX

- [x] Confirm section ordering and item grouping in the rendered sidebar.
- [x] Add a dev-only ops navigation harness to verify the sidebar outside the auth-gated app shell.

## Tests

- [x] Run a lightweight code check for the edited files.
- [x] Complete Chrome DevTools manual verification for the sidebar.

## Notes

- Assumptions:
- The existing item order within each new category is acceptable to staff users because only grouping changed.

- Deviations:
- Added a dev-only harness route because the authenticated ops shell is not directly reachable for local verification.

## Batched Questions

- None.
