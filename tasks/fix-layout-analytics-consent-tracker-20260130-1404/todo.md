---
task: fix-layout-analytics-consent-tracker
timestamp_utc: 2026-01-30T14:04:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm current RootLayout consent logic and providers.

## Core

- [x] Remove `cookies()` usage from `src/app/layout.tsx`.
- [x] Gate Plausible in `src/app/providers.tsx` with `useAnalyticsConsent`.
- [x] Add pruning/size cap for Supabase N+1 signature map.
- [x] Align CI pnpm setup with packageManager version (remove pinned action version).
- [x] Ensure E2E/DAST workflows have valid BASE_URL and required env fallbacks.

## UI/UX

- [ ] N/A

## Tests

- [x] Decide on test coverage and run targeted checks (`pnpm typecheck`, `pnpm lint`, `pnpm test:ci`).

## Notes

- Assumptions: Consent banner continues to manage `nat_consent` cookie.
- Deviations: None.

## Batched Questions

- None.
