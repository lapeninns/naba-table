---
task: restaurant-email-template-editor
timestamp_utc: 2026-03-25T07:08:18Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm editable template catalog and blocked templates
- [ ] Decide endpoint shape: nested endpoint vs extending restaurant PATCH

## Core

- [ ] Add typed email template schema and validation
- [ ] Persist validated template config per restaurant
- [ ] Update booking email renderer to use typed overrides

## UI/UX

- [ ] Add restaurant settings route for email templates
- [ ] Build constrained editor and preview
- [ ] Add reset/default and merge-tag guidance

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E
- [ ] A11y

## Notes

- Assumptions:
  - Phase 1 covers booking emails only.
  - Core HTML shell remains code-owned.
- Deviations:

## Batched Questions

- Should CTA label editing be global per template or locked for some system-critical templates?
