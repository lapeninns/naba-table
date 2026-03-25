---
task: add-public-restaurants-empty-state-fixture
timestamp_utc: 2026-03-25T11:52:14Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [ ] Identify current restaurants data flow and fixture extension point
- [ ] Add deterministic empty-state fixture path
- [ ] Keep empty-state messaging and CTAs inside guest design system

## Tests

- [ ] Add/update Vitest coverage for fixture path
- [ ] Add/update Playwright coverage for deterministic empty-state route
- [ ] Run validators
