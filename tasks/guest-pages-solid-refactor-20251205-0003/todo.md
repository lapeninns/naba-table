---
task: guest-pages-solid-refactor
timestamp_utc: 2025-12-05T00:03:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm effective AGENTS stack for touched paths (root, src/app, components, hooks, lib).
- [x] Align route map with new module layout; update imports.
- [x] Scaffold DI container for guest services.

## Core

- [x] Define ports/interfaces (AuthPort, BookingsPort, ProfilePort, OffersPort placeholder).
- [x] Implement adapters reusing existing fetchers/hooks/supabase utilities.
- [x] Add ViewModel builders for dashboard, bookings, profile.
- [x] Refactor page.tsx files to orchestration-only using ViewModel + PageView.
- [ ] Move cross-cutting concerns to guest layout/middleware (auth gating, analytics stubs).

## UI/UX

- [x] Create/loading/empty/error/success state components with focus/aria-live.
- [ ] Ensure responsive layout remains; verify no CLS regressions.

## Tests

- [x] Unit tests for formatters/validation and ViewModels.
- [x] Integration tests for adapters with mocked fetch/supabase.
- [x] Rendering tests per page state (vitest).
- [ ] Axe/a11y checks.

## Notes

- Assumptions: feature flags currently static (empty config) in DI provider.
- Deviations: Addressed test setup failure by using built-in fetch (removed whatwg-fetch import). New guest test suites pass locally (vitest) with Node engine warning; broader a11y/perf checks still pending.

## Batched Questions

- [ ] Decide DI provider location (layout vs provider file) — pending resolution.
