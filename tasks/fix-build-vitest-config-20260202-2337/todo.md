---
task: fix-build-vitest-config
timestamp_utc: 2026-02-02T23:38:14Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect `package.json` and `pnpm-lock.yaml` for `vitest`.

## Core

- [x] Ensure `vitest.config.ts` is excluded from Next build typecheck.

## Tests

- [x] Run `pnpm run build`.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Is `vitest` expected to be installed in all environments running `next build`?
