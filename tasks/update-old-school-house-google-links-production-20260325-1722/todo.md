---
task: update-old-school-house-google-links-production
timestamp_utc: 2026-03-25T17:22:46Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Capture the exact Google review and directions URLs from the user.
- [x] Extend the metadata updater to include `google_map_url`.

## Core

- [x] Dry-run the Google link update.
- [x] Apply the production Google link update.
- [x] Read back the final restaurant row.

## UI/UX

- [x] Not applicable.

## Tests

- [x] Dry-run verification recorded.
- [x] Applied verification recorded.

## Notes

- Assumptions:
  - Keep slug as `the-old-school-house`.
  - Store the exact map URL provided by the user, including its origin coordinates.
- Deviations:
  - None.

## Batched Questions

- None.
