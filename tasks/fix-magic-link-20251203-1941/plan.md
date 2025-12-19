---
task: fix-magic-link
timestamp_utc: 2025-12-03T19:41:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Magic link email failures

## Objective

Restore functional magic link sign-in so users receive OTP email and are redirected to dashboard after clicking link.

## Success Criteria

- [ ] POST /api/auth/signin responds 200 and UI shows "Check your email" without server error.
- [ ] Email provider logs show magic link sent to submitted address in staging/dev.
- [ ] No regressions to other auth methods.

## Architecture & Components

- Auth API route (`src/app/api/auth/signin/route.ts`) generates magic link via Supabase.
- Add fallback path using Supabase admin `generateLink` + Resend sender if Supabase email delivery fails.
- Email sending utility (`libs/resend.ts`) reused for fallback delivery.

## Data Flow & API Contracts

- Endpoint: POST /api/auth/signin
- Request: { email }
- Response: 200 with success message; errors 4xx/5xx handled gracefully.
- Errors: provider failures mapped to 500 with logged details; missing env -> 500.

## UI/UX States

- Loading while request in flight.
- Success "Magic link sent" state.
- Error state if send fails (non-leaky message).

## Edge Cases

- Invalid/missing email input already validated.
- hostname/rootDomain mismatch causing invalid links.
- Missing provider API key.

## Testing Strategy

- Manual repro using `pnpm run dev` and submit sign-in form.
- Unit/integration: where feasible, mock email sender; otherwise rely on manual verification.

## Rollout

- Feature flag not needed; deploy after verification.
- Monitoring: logs for auth send errors.
- Kill-switch: fallback to OTP code via email? (not planned).

## DB Change Plan

- N/A (no DB migration expected).
