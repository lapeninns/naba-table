---
task: ops-email-delivery-performance-pass
timestamp_utc: 2026-03-29T16:53:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Audit current email delivery coordinator, data hooks, and table rendering path
- [x] Capture research and plan artifacts before implementation

## Core

- [x] Add shared email-delivery selectors/types for query and row shaping
- [x] Split email delivery state into smaller query/data/action hooks
- [x] Refactor `OpsEmailDeliveryClient` into a thinner composition shell
- [x] Convert retry flow to key-driven handling where practical

## UI / Rendering

- [x] Pass precomputed row models into `OpsEmailDeliveryTable`
- [x] Remove repeated subject/sort/display derivation from render time
- [x] Keep current loading, error, empty, pagination, and tab behavior intact

## Tests

- [x] Add selector/view-model regression tests
- [x] Update targeted table/client tests as needed
- [x] Run targeted typecheck, lint, and tests
- [x] Run Chrome DevTools manual verification on the dev harness

## Notes

- Assumptions:
  - Analytics eager loading remains unchanged in this pass to preserve current behavior.
- Deviations:
  - Added a small runtime-quality cleanup by removing the dev-harness hydration mismatch and the missing form-field name warning while touching the page.
