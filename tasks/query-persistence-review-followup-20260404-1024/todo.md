---
task: query-persistence-review-followup
timestamp_utc: 2026-04-04T10:24:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Narrow the reload-only cache-clear skip in `src/app/providers.tsx`.
- [x] Re-run scoped validation.

## Notes

- Assumptions: redirect and Vitest alias comments are acknowledged but intentionally left unchanged in this scoped follow-up.
- Deviations: none.
