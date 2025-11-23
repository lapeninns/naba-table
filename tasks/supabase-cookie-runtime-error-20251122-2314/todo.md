---
task: supabase-cookie-runtime-error
timestamp_utc: 2025-11-22T23:14:25Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review `server/supabase.ts` cookie adapter behavior against Next.js 16 restrictions.

## Core

- [x] Add safe error handling around cookie writes in server component contexts.
- [x] Preserve cookie writes for route handlers/middleware.

## UI/UX

- [x] Confirm no UI change required (backend-only).

## Tests

- [ ] Run `pnpm run dev` smoke on `/` to ensure no cookie errors.
- [ ] Consider `pnpm run lint` if time permits.
- [x] Run `pnpm run build` to ensure typecheck/production build passes.
- [x] Run `pnpm exec next start` on port 3100 and curl `/` to confirm no runtime cookie errors.

## Notes

- Assumptions: middleware handles session refresh; suppressing cookie write errors in RSC is acceptable.
- Deviations: Used `pnpm exec next start` on port 3100 (due to existing dev server/lock) for runtime smoke instead of `pnpm run dev`.
