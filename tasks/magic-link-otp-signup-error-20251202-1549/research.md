---
task: magic-link-otp-signup-error
timestamp_utc: 2025-12-02T15:49:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Magic link sign-in returning "Signups not allowed for otp"

## Requirements

- Functional:
  - Magic-link sign-in should succeed for existing users even when Supabase signups are disabled.
  - New users should be directed to the signup flow instead of triggering backend errors.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve rate limiting and CSRF validation already in place on the auth route.
  - Avoid leaking account existence more than current behavior; keep responses concise and safe.

## Existing Patterns & Reuse

- Auth API routes live in `src/app/api/auth/**` and already validate CSRF, sanitize redirects, and rate-limit requests.
- `src/app/api/auth/signin/route.ts` uses `signInWithOtp` with `shouldCreateUser: false` and builds callback URLs per host.
- `server/supabase.ts` exposes both anon (`getRouteHandlerSupabaseClient`) and service (`getServiceSupabaseClient`) clients we can reuse for privileged calls.
- UI form `components/auth/SignInForm.tsx` maps HTTP error statuses to user-friendly copy; backend should surface consistent status codes/messages.

## External Resources

- MCP web search unavailable here; relying on in-repo supabase-js 2.72.0 bundle for API capabilities.

- Supabase project has signups disabled, causing anon `signInWithOtp` to return “Signups not allowed for otp.”
- Using service-role auth must not inadvertently create new users; keep `shouldCreateUser: false` on any fallback.
- Need to keep change narrow to signin route and its tests; avoid touching signup flows.

## Open Questions (owner, due)

- Q: Does the service-role client bypass the signup-disabled restriction while still honoring `shouldCreateUser: false`? (owner: assistant, due: during implementation; will validate via unit test mocks)
- Q: What is the best user-facing message when no account exists? (owner: assistant, due: before final response)

- Detect the specific signup-disabled error from Supabase when sending magic links.
- Fallback to using the service-role Supabase client to send the magic link with `shouldCreateUser: false`, which can operate even when public signups are disabled.
- Return clear, non-leaky error copy (e.g., suggest signing up) if the fallback still reports “user not found”.
- Add unit coverage in `src/app/api/auth/signin/route.test.ts` to exercise the fallback path and ensure we don’t create users.
