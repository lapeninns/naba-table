---
task: fix-dashboard-hydration-mismatch
timestamp_utc: 2026-03-23T16:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify the `/dashboard` route tree and likely hydration-mismatch sources.
- [x] Add a stable initial time snapshot to the ops dashboard render path.

## Core

- [x] Thread `initialNowIso` from the server route into the dashboard client tree.
- [x] Remove first-render `Date.now()` drift from connection status labels.
- [x] Remove first-render `DateTime.now()` drift from booking urgency calculations.

## UI/UX

- [x] Preserve existing loading, empty, and error states.
- [x] Keep a11y behavior unchanged.

## Tests

- [x] Focused lint/type checks for touched files
- [x] Chrome DevTools manual verification

## Notes

- Assumptions:
  - The reported `/dashboard` error maps to the ops dashboard route rendered from `src/app/app/(app)/dashboard/page.tsx`.
  - Time-derived text is the primary hydration risk here.
- Deviations:
  - Used a temporary workspace copy at `/tmp/nabatableLP-hydration-qa` with `APP_ENV=development` for DevTools QA because the primary workspace runs with `APP_ENV=staging`, which intentionally 404s dev harness routes.

## Batched Questions

- None.
