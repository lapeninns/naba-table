---
task: fix-magic-link
timestamp_utc: 2025-12-03T19:41:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Magic link email fails (500) in staging dev run

## Requirements

- Functional: Magic link sign-in should send OTP email successfully in staging/dev environment when user submits /auth/signin; API should return 200 and show confirmation UI.
- Non-functional (a11y, perf, security, privacy, i18n): maintain existing a11y; avoid leaking secrets in logs; no perf regressions in auth flow; support current locale setup.

## Existing Patterns & Reuse

- NextAuth/Supabase auth flow already implemented; check existing email provider configuration and error handling in `src/app/api/auth/[...nextauth]` or related service.
- OTP magic link sending helper likely in `src/services` or `server/auth` files; reuse rather than reimplement.

## External Resources

- None yet. MCP Context7/DeepWiki not used (not required for low/medium risk or unavailable); relying on codebase inspection.

## Constraints & Risks

- Environment uses staging credentials (`APP_ENV=staging`); Supabase magic link send fails with `AuthApiError: Error sending confirmation email` (status 500) when tested via `node test-magic-link.mjs devnull@example.com` using current `.env.local`.
- Node version mismatch (project wants 20.11.1; current is v22.12.0) could affect dependencies.
- Must avoid exposing secrets; do not modify production configs.

## Open Questions (owner, due)

- Which email/magic link provider is configured (Supabase built-in vs. custom SMTP)? Need to confirm via code/env. (Owner: assistant, due: before implementation)
- Should fallback send via Resend or adjust Supabase config? Need decision before change.

## Recommended Direction (with rationale)

- Reproduce failure and capture Supabase error (done; 500 unexpected_failure when sending email).
- Prefer minimal code change: keep current flow but add server-side fallback using Supabase admin `generateLink` plus Resend to send email when Supabase mailer fails; keeps auth tokens valid while bypassing failing SMTP.
- Ensure `shouldCreateUser` remains enabled to allow sign-in for new users.
