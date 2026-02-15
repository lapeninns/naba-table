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
- [x] Use narrowed values in `posthog.init`.

## UI/UX

- [x] Not applicable (no UI change).

## Tests

- [x] Build (`pnpm run build`) executed; blocked by unrelated pre-existing task artifact TypeScript error.

## Notes

- Assumptions:
  - Existing `enabled` semantics should remain intact.
- Deviations:
  - Local `next build` includes `tasks/**/artifacts/*.ts`; this differs from Vercel build context where `.vercelignore` excludes `tasks/**/artifacts/**`.

## Batched Questions

- None.
