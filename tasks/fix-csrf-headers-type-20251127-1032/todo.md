---
task: fix-csrf-headers-type
timestamp_utc: 2025-11-27T10:32:28Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review `server/security/csrf.ts` for current header usage and typings.
- [x] Review `server/security/rate-limit.ts` for TypeScript errors.

## Core

- [x] Update `shouldUseSecureCookie()` to await `headers()` and reuse the returned `ReadonlyHeaders`.
- [x] Reorder `parseBooleanEnv` so it is declared before first use in `server/security/rate-limit.ts`.

## Tests / Verification

- [x] Run `pnpm run build` to ensure TypeScript passes.
- [x] Update `verification.md` with results.

## Notes

- Assumptions: No other callers depend on synchronous `shouldUseSecureCookie()` behavior; awaiting headers is supported in this context.
- Deviations: Build surfaced an additional temporal dead zone error; captured as part of scope.
