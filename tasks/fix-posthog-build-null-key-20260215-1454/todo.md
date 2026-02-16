---
task: fix-posthog-build-null-key
timestamp_utc: 2026-02-15T14:54:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and SDLC artifacts.

## Core

- [x] Add explicit `key`/`host` null guards in PostHog provider.
- [x] Use narrowed `posthogKey`/`posthogHost` values in `posthog.init`.
- [x] Capture Vercel failed deployment evidence showing the nullability failure signature.

## UI/UX

- [x] Not applicable (no UI change).

## Tests

- [x] `pnpm exec eslint lib/posthog/provider.tsx` (pass).
- [x] `pnpm run build` (pass).
- [x] `pnpm run typecheck` (pass).

## Notes

- Assumptions:
  - Existing `enabled` semantics should remain intact.
- Deviations:
  - Local `next build` includes `tasks/**/artifacts/*.ts`; fixed follow-up nullability in `tasks/booking-confirmation-pdf-template-20260212-1831/artifacts/pdf-template-smoke.ts` to keep local build/typecheck green.

## Batched Questions

- None.
