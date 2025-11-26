---
task: restaurant-settings-consistency
timestamp_utc: 2025-11-26T12:34:10Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create shared restaurant settings page shell component.
- [x] Wire shell into restaurant settings layout and tables page.

## Core

- [x] Ensure headings/eyebrow/description copy align with existing layout content.
- [x] Keep auth redirects and Suspense fallback intact.

## UI/UX

- [x] Verify consistent max-width/padding across settings pages.
- [x] Confirm subnav focus/active styling remains correct.

## Tests

- [ ] Manual UI QA (desktop + mobile width) via Chrome DevTools MCP.

## Notes

- Assumptions: Tables route remains `/settings/tables`.
- Deviations: Manual QA blocked by sign-in/404 redirects locally; need valid session to verify screens.

## Batched Questions

- None.
