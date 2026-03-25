---
task: update-old-school-house-metadata-production
timestamp_utc: 2026-03-25T16:42:56Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm the existing production restaurant ID and current slug.
- [x] Verify the canonical Google Maps place URL for The Old School House.
- [x] Add a guarded production metadata updater script.

## Core

- [x] Dry-run the metadata update.
- [x] Apply the production metadata update.
- [x] Read back the updated row.

## UI/UX

- [x] Not applicable.

## Tests

- [x] Dry-run verification recorded.
- [x] Applied verification recorded.

## Notes

- Assumptions:
  - Rename the slug to `the-old-school-house`.
  - Use the canonical Google Maps place page as the best verified Google review destination.
- Deviations:
  - No direct anonymous `search.google.com/local/writereview?placeid=...` link was recoverable from the public business profile without authenticated review flow context.

## Batched Questions

- None.
