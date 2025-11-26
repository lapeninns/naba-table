---
task: auth-session-hardening
timestamp_utc: 2025-11-26T10:10:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
---

# Implementation Checklist

## Setup

- [x] Add server-side CSRF helper and set token cookie on auth entry pages.
- [x] Create rate-limited auth sign-in API proxy using Supabase server client.

## Core

- [x] Enforce stronger password schema client + server.
- [x] Wire SignInForm to new API and handle 403/429/validation states.
- [x] Harden Supabase cookie adapter with secure flags.

## Tests

- [x] Add route tests for /api/auth/signin (success, CSRF fail, rate limit).

## Docs/Verification

- [x] Update security assessment doc with implemented mitigations.
- [ ] Record manual QA notes (password + magic-link) in verification.md.
