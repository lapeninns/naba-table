---
task: repo-cleanup
timestamp_utc: 2025-12-26T00:08:11Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm deletion scope and dry-run approval.

## Core

- [x] Generate dry-run list by category.
- [x] Delete approved files/folders.

## Tests

- [ ] N/A

## Notes

- Assumptions:
  - User wants all SQL and migration files removed.
  - User wants all past task folders removed.
- Deviations:
  - None.
