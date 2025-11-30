---
task: fix-dashboard-api
timestamp_utc: 2025-11-30T18:59:13Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Update `baseline-browser-mapping` dev dependency to latest.
- [ ] Rename `src/middleware.ts` to `src/proxy.ts`; adjust tests/imports.

## Core

- [ ] Update ops dashboard service base to `/api/ops/dashboard` and verify dependent hooks.
- [ ] Add/adjust tests to assert correct dashboard API path usage.

## UI/UX

- [ ] Verify dashboard page loads without 404s in dev; ensure redirects/rewrite behavior unchanged.

## Tests

- [ ] Run `pnpm test src/middleware.test.ts` (or filtered equivalent).
- [ ] Run `pnpm build` to confirm clean build.

## Notes

- Assumptions: `/api/dashboard/*` is not a supported path; ops endpoints should live under `/api/ops/*`.
- Deviations: If downstream clients require legacy path, add temporary rewrite in proxy.

## Batched Questions

- Do any external clients rely on `/api/dashboard/*`? If yes, add compatibility rewrite and deprecate.
