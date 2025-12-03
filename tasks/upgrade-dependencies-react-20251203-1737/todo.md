---
task: upgrade-dependencies-react
timestamp_utc: 2025-12-03T17:37:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm current dependency versions and overrides/patches.
- [x] Identify latest compatible React/Next/Storybook/Tailwind versions.

## Core

- [x] Update React/ReactDOM (and @types) to latest compatible versions.
- [x] Update Next.js and related tooling (@next/mdx, eslint-config-next, etc.).
- [x] Update other dependencies flagged as outdated (Radix, TanStack Query, Tailwind, Vite, Vitest, Storybook, Playwright, etc.).
- [x] Refresh pnpm lockfile.

## UI/UX

- [ ] Smoke run dev/build to confirm UI renders. (build passes; manual UI QA pending)
- [ ] Address any a11y/perf regressions found in manual QA.

## Tests

- [x] Run `pnpm run lint`. (warnings only; no errors)
- [x] Run `pnpm run test`. (fails: 10 tests across 13 suites; see verification)
- [x] Run `pnpm run build`. (passes after fixes)
- [ ] (Optional) Run `pnpm run storybook:build` if time permits.

## Notes

- Assumptions: No backend schema changes; Supabase remains remote.
- Deviations: Storybook add-on packages removed per v10 deprecation; @storybook/test remains on 8.6.14 (no 10.x release).

## Batched Questions

- TODO
