---
task: guest-pages-audit
timestamp_utc: 2025-12-03T19:07:59Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Run `route-scanner` utility (via `RouteScanner` class) to enumerate routes and save artifacts.
- [x] Open `guest-facing-routes.md` for existing context.

## Core

- [x] Identify auth enforcement (middleware, layouts) affecting guest routes.
- [x] Categorize routes by protected/unprotected and by purpose.
- [x] Draft final list with source paths.

## QA / Verification

- [x] Sanity check against directory structure to ensure no omissions.

## Notes

- Assumptions: dev/test routes not guest-facing unless explicitly public.
- Deviations: None yet.

## Batched Questions

- None.
