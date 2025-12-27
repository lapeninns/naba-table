---
task: app-dashboard-first-load-issue
timestamp_utc: 2025-12-27T18:42:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate dashboard route and related loaders

## Core

- [x] Trace first-load redirect/rewrite path on app.localhost
- [x] Identify failing request or missing dependency
- [x] Enforce app-host auth flow for ops targets on public sign-in page

## UI/UX

- [ ] N/A

## Tests

- [x] Manual repro with DevTools (root sign-in -> app host redirect)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- What console/network errors appear on first load?
