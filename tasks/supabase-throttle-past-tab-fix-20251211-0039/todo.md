---
task: supabase-throttle-past-tab-fix
timestamp_utc: 2025-12-11T00:39:00Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Identify relevant auth polling hooks/components.
- [ ] Trace Past tab data fetch and render pipeline.

## Core

- [ ] Adjust Supabase auth polling cadence / caching to prevent 429s.
- [ ] Fix Past tab data synchronization with counts.

## UI/UX

- [ ] Validate loading/empty states for Past tab.

## Tests

- [ ] Update/add tests or QA scripts if applicable.

## Notes

- Assumptions: TBD
- Deviations: TBD

## Batched Questions

- TBD
