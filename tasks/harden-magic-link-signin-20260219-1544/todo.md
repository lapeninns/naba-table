---
task: harden-magic-link-signin
timestamp_utc: 2026-02-19T15:44:01Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and SDLC artifacts.
- [x] Update continuity ledger with this execution scope.

## Core

- [x] Add signin surface helper (`public_guest` vs `app_ops`).
- [x] Add chained magic-link throttle helper (IP + global).
- [x] Add auth-send audit helper with HMAC hashes and outcomes.
- [x] Add Turnstile server verification helper.
- [x] Refactor `/api/auth/signin` to use new controls and normalized `202` semantics.

## UI/UX

- [x] Add Turnstile token capture to guest sign-in form.
- [x] Include `captchaToken` in guest magic-link requests.
- [x] Add CAPTCHA-specific error mapping.

## Config

- [x] Add new env schema keys and runtime getters.
- [x] Update `.env.example` with new variables.

## Tests

- [x] Add route-policy test for magic-link outcomes.
- [x] Add throttle helper tests.
- [x] Add Turnstile verifier tests.
- [x] Add guest form CAPTCHA tests.
- [x] Run typecheck + targeted vitest suite.

## Notes

- Keep diff scoped to auth-hardening; do not modify unrelated workspace changes.
