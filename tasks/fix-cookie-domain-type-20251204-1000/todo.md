---
task: fix-cookie-domain-type
timestamp_utc: 2025-12-04T10:00:32Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify root domain handling in `server/supabase.ts`.

## Core

- [x] Add string guard/fallback for `NEXT_PUBLIC_ROOT_DOMAIN` before calling `resolveCookieDomain`.
- [x] Ensure cookie defaults continue to use `resolveCookieDomain` output.

## Tests

- [x] Run `pnpm run build` to confirm type error is cleared.

## Notes

- Assumptions: No runtime behavior change needed; goal is type safety.
- Deviations: None.
