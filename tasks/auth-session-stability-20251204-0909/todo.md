---
task: auth-session-stability
timestamp_utc: 2025-12-04T09:09:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Review relevant auth/session/query files
- [ ] Confirm reuse patterns and feature flags

## Core

- [x] Centralize magic-link handling in ImplicitAuthHandler
- [x] Refactor useSupabaseSession hydration
- [x] Per-user TanStack Query persistence + cache reset on auth change
- [x] Global 401/419 re-auth flow with redirect and toast
- [x] Align Supabase cookie configuration
- [x] Sign-out clears cache and soft-redirects
- [x] URL-sync bookings tab state
- [x] Server prefetch + dehydrate bookings/profile
- [x] Add route-level loading skeletons
- [x] Lazy-load booking dialogs/QR
- [x] Replace router.refresh retries with query invalidation
- [x] Standardize guest error/empty states
- [x] Persist guest booking preferences
- [x] Client error reporting with metadata
- [ ] Accessibility polish tasks

## Tests

- [ ] Unit/integration updates for auth/session/query changes
- [ ] E2E coverage for re-auth redirect and tab sync (if applicable)
- [ ] Accessibility/axe smoke

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- [ ]
