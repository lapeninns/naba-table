---
task: resend-from-email
timestamp_utc: 2025-12-02T14:28:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix RESEND_FROM validation failure

## Objective

Ensure builds pass by validating and providing a correct default sender email for Resend, aligned to `no-reply-notifications.nabatable.com`.

## Success Criteria

- `pnpm run validate:env` passes locally with default values.
- `next build` no longer fails on `RESEND_FROM` validation.

## Architecture & Components

- `scripts/validate-env.ts`: tighten/default env parsing for RESEND_FROM.
- `.env.example`: document correct sender email value.

## Data Flow & API Contracts

- Env loader reads `process.env.RESEND_FROM`; fallback to default email when absent.

## UI/UX States

- N/A (backend/env only).

## Edge Cases

- Missing RESEND_FROM uses default valid email.
- Provided invalid email still fails validation.

## Testing Strategy

- Run `pnpm run validate:env`.
- Run `pnpm run build` if feasible to ensure no further env errors.

## Rollout

- No feature flag. Once merged, update Vercel env to use `no-reply@no-reply-notifications.nabatable.com`.
