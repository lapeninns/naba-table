---
task: harden-magic-link-signin
timestamp_utc: 2026-02-19T15:44:01Z
owner: github:@amankumarshrestha
reviewers: [github:@amankumarshrestha]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Public Magic-Link Hardening

## Objective

Harden public magic-link sign-in against enumeration and automation abuse while preserving a stable user-facing contract.

## Success Criteria

- [ ] `POST /api/auth/signin` returns `202` for magic-link unknown-email and provider-send failures after boundary checks.
- [ ] Guest/public magic-link flow enforces CAPTCHA and rejects missing/invalid tokens with `403`.
- [ ] Magic-link flow applies chained IP/global throttling and returns `429` with retry metadata on breach.
- [ ] Every magic-link attempt writes one `observability_events` row with hashed identifiers and outcome.
- [ ] Password flow behavior remains unchanged.

## Architecture & Components

- `server/auth/signin-surface.ts`: classify `public_guest` vs `app_ops` from host.
- `server/auth/signin-throttle.ts`: chained magic-link throttle policy.
- `server/auth/signin-audit.ts`: deterministic hashed audit telemetry.
- `server/security/turnstile.ts`: server-side Turnstile verification.
- `src/app/api/auth/signin/route.ts`: enforce boundary logic + normalized response semantics.
- `components/auth/GuestSignInForm.tsx`: collect and submit CAPTCHA token.

## Data Flow & API Contracts

Endpoint: `POST /api/auth/signin`
Request (magic-link): `{ mode: 'magic_link', email, redirectedFrom?, rememberMe?, captchaToken? }`
Response:

- `202`: accepted (`magic_link_sent`) for sent/suppressed/send-error/lookup-error post-boundary cases.
- `403`: CAPTCHA missing/invalid for guest/public magic-link attempts.
- `429`: throttled by IP/global controls.
- `400`: validation errors.

## UI/UX States

- Guest sign-in shows CAPTCHA challenge when site key exists.
- Submit remains blocked until CAPTCHA token exists when CAPTCHA is enabled.
- CAPTCHA-specific error text is shown for `403` CAPTCHA failures.

## Edge Cases

- CAPTCHA verify endpoint unavailable -> deny request with `403`, log `captcha_verify_unavailable`.
- `user_profiles` lookup error -> no-send + `202`, log `lookup_error`.
- Unknown email -> no-send + `202`, log `suppressed_unknown_email`.

## Testing Strategy

- Unit tests for Turnstile verifier helper.
- Unit tests for throttle helper behavior and block scope.
- Route-policy tests for unknown/sent/send-error outcomes.
- Guest form tests for CAPTCHA gating + error mapping.

## Rollout

- Staging first with valid Turnstile keys and hostname.
- Production rollout after env validation confirms required keys.
- Monitor `observability_events` `event_type='magic_link.send_attempt'` outcome distribution for 24h.

## DB Change Plan

- No schema changes.
- Reuse existing `observability_events` table.
