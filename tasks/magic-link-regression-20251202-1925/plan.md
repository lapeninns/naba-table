---
task: magic-link-regression
timestamp_utc: 2025-12-02T19:25:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restore Magic Link Behavior

## Objective

Restore guest magic-link sign-in so Supabase accepts the callback URL and returns `magic_link_sent` (as in commit 43ee2e6), without changing UX or weakening security.

## Success Criteria

- [ ] POST `/api/auth/signin` returns 202 + `{ status: "magic_link_sent" }` on localhost dev using magic-link flow.
- [ ] Supabase `emailRedirectTo` includes the correct host + port when host header contains a port (e.g., `http://localhost:3000/...`).
- [ ] Unit tests cover the host-with-port case; existing auth route tests stay green.

## Architecture & Components

- `src/app/api/auth/signin/route.ts`: adjust callback URL construction to use full host header (incl. port) while keeping sanitized fallback for untrusted hosts.
- `lib/auth/redirects.ts`: reuse existing redirect helpers; no change to sanitization rules.
- Tests: extend `src/app/api/auth/signin/route.test.ts` to assert Supabase receives `emailRedirectTo` with port.

## Data Flow & API Contracts

- Endpoint: POST `/api/auth/signin`
- Request: `{ mode: "magic_link", email: string, redirectedFrom?: string }` + CSRF header/cookie
- Response: `202 { status: "magic_link_sent", redirectTo: string }`
- Errors: unchanged (400 validation, 403 CSRF, 429 rate limit, 4xx from Supabase)

## UI/UX States

- Loading: existing button spinner/cooldown unchanged.
- Empty: blank status area as today.
- Error: reuse current status mapping for 4xx/5xx.
- Success: status message and cooldown unchanged.

## Edge Cases

- Host header with port (localhost:3000) → preserve port in callback URL.
- Host header missing or untrusted → fall back to trusted root domain (`nabatable.com`/configured) as today.
- RedirectedFrom invalid → still sanitized via `sanitizeRedirect`.

## Testing Strategy

- Unit: update `route.test.ts` to cover host-with-port magic-link call; ensure rate-limit headers still set.
- Integration: manual call via dev server after change to confirm 202 response.
- E2E: not required for this patch.
- Accessibility: unchanged; manual sign-in page already covered.

## Rollout

- Feature flag: none (bug fix).
- Exposure: all environments immediately.
- Monitoring: rely on logs for `[Auth/signin] Magic link details` and Supabase responses.
- Kill-switch: revert patch if Supabase errors persist.

## DB Change Plan (if applicable)

- Not applicable
