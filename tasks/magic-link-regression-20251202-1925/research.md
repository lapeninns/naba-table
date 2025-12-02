---
task: magic-link-regression
timestamp_utc: 2025-12-02T19:25:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Restore Magic Link Behavior

## Requirements

- Functional:
  - Guest sign-in should accept email, send Supabase magic link, and return `{ status: "magic_link_sent", redirectTo }` with 202.
  - Magic-link email must use the same callback/redirect behavior as commit `43ee2e6` (no regressions to redirect handling or user creation).
  - CSRF + rate limiting continue to protect the endpoint.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Respect existing CSRF/rate-limit checks; no added latency.
  - Do not weaken redirect host validation; avoid open redirects.
  - Keep current UX copy/timing (cooldown, status messages) unchanged.

## Existing Patterns & Reuse

- API route: `src/app/api/auth/signin/route.ts` handles both password and magic-link flows with Zod validation, CSRF, rate limiting, Supabase `signInWithOtp`.
- Callback flow: `src/app/api/auth/callback/route.ts` validates `redirectedFrom` via `sanitizeRedirect` + `defaultRedirectForHost`, then exchanges code for session.
- Client form: `components/auth/GuestSignInForm.tsx` uses `fetchJson` which auto-injects the CSRF header from browser cookie.
- Redirect helpers: `lib/auth/redirects.ts` centralizes allowed paths/domains and absolute redirect building.

## External Resources

- Supabase auth requires `emailRedirectTo` to match an allowed redirect URL (host + port) in project settings; mismatched hosts return 4xx (commonly 422).

## Constraints & Risks

- Current logs show `emailRedirectTo: "http://localhost/api/auth/callback?..."` (no port), likely not whitelisted; Supabase can return 422/500 for invalid redirect.
- `parseHostname` strips `:3000`; changing host handling must not break prod domains (`*.nabatable.com`).
- Callback host validation must stay strict to avoid open redirects; any relaxation could be a security risk.
- Dev env may rely on host header quirks; need to verify on both localhost and real domains.

## Open Questions (owner, due)

- Q: What exact Supabase redirect URLs are allowed in the current project (does it include `http://localhost:3000/api/auth/callback`)? (owner: assistant, before verification)
  A: Pending confirmation during verification.

- Q: Do any clients rely on the stripped-port host for redirect defaults? (owner: assistant, before implementation)
  A: Will confirm via tests; default redirect logic should remain unchanged for prod domains.

## Recommended Direction (with rationale)

- Build `emailRedirectTo` using the full host header (including port) when present, while retaining fallback to the trusted root domain for non-whitelisted hosts.
- Keep existing redirect sanitization/defaults for user-facing redirects; only adjust the callback URL generation to preserve port for localhost/dev so it matches Supabase allow-list.
- Add a route unit test asserting the Supabase call receives `emailRedirectTo` with port when host is `localhost:3000`, preventing future regressions.
