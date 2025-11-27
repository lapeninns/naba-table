---
task: middleware-regex-build-fix
timestamp_utc: 2025-11-27T23:22:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Update middleware regex to remove named capturing group while preserving match.

## Core

- [x] Verify ops rewrite exemption still covers `/api/restaurants/:slug/(schedule|calendar-mask)` paths.

## UI/UX

- [ ] N/A (no UI changes).

## Tests

- [x] Run `pnpm run build`.

## Notes

- Assumptions: Routing behavior unchanged; capture value not used elsewhere.
- Deviations: No new automated tests since behavior unchanged and build failure was compile-time only.
- Build completed successfully after regex change.

## Batched Questions

- None currently.
