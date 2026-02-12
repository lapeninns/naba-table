---
task: magic-link-resend
timestamp_utc: 2026-02-12T18:27:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Magic Link Sending via Resend

## Objective

We will send Supabase authentication magic links through the app's Resend integration so auth delivery is controlled in one canonical server-side path.

## Success Criteria

- [x] `POST /api/auth/signin` (magic-link mode) sends a valid magic link via Resend and returns existing 202 contract.
- [x] `POST /api/auth/signup` (magic-link mode) sends a valid magic link via Resend and returns existing 202 contract.
- [x] Auth callback flow remains compatible with generated links.
- [x] Missing auth-link or email transport failures return stable user-safe errors.

## Architecture & Components

- New canonical helper in `server/auth`:
  - Generate link via Supabase admin client.
  - Build email HTML/text payload.
  - Send via `libs/resend.ts`.
- Update route handlers:
  - `src/app/api/auth/signin/route.ts` magic-link branch calls helper.
  - `src/app/api/auth/signup/route.ts` magic-link branch calls helper.
- Keep password flows unchanged.

## Data Flow & API Contracts

Endpoint: `POST /api/auth/signin` (`mode=magic_link`)
Request: `{ mode: 'magic_link', email, redirectedFrom?, rememberMe? }`
Response success: `{ status: 'magic_link_sent', redirectTo }` with 202
Errors: `{ message }` with stable 4xx/5xx statuses

Endpoint: `POST /api/auth/signup` (`mode=magic_link`)
Request: `{ mode: 'magic_link', email, redirectedFrom? }`
Response success: `{ status: 'magic_link_sent', redirectTo }` with 202
Errors: `{ message }` with stable 4xx/5xx statuses

## UI/UX States

- No UI structural changes; existing forms should continue showing success/error toasts/messages.

## Edge Cases

- Supabase returns no `action_link` or verification type mismatch.
- Resend unavailable/misconfigured.
- Redirect paths sanitized to fallback path as before.
- Existing users and first-time users (magic link should continue to support user creation semantics).

## Testing Strategy

- Type-check affected files.
- Run targeted lint/tests for auth routes and new helper module.
- Manual verification of route response shape via existing frontend (no UI code change expected).

## Rollout

- No new feature flags.
- Deploy as direct replacement of magic-link send path.
- Monitor auth route errors (`/api/auth/signin`, `/api/auth/signup`) and resend webhook events.

## DB Change Plan (if applicable)

- None.
