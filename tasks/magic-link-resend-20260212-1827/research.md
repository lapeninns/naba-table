---
task: magic-link-resend
timestamp_utc: 2026-02-12T18:27:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Magic Link Delivery via Resend

## Requirements

- Functional:
- Keep existing auth entrypoints (`POST /api/auth/signin` and `POST /api/auth/signup`) and response contracts stable.
- Send magic-link emails through Resend transport rather than relying on Supabase-managed outbound email in route logic.
- Preserve redirect sanitization, CSRF checks, and rate limiting.
- Preserve existing callback compatibility (`/api/auth/callback`) and user-linking behavior.
- Non-functional (a11y, perf, security, privacy, i18n):
- Fail fast on missing/invalid auth link payloads.
- Do not leak tokens in logs.
- Reuse existing Resend integration (`libs/resend.ts`) and avoid duplicate send paths.

## Existing Patterns & Reuse

- `src/app/api/auth/signin/route.ts` and `src/app/api/auth/signup/route.ts` currently call `supabase.auth.signInWithOtp`.
- `src/app/api/auth/callback/route.ts` already supports `token_hash` verification with `supabase.auth.verifyOtp({ type: 'magiclink' })`.
- `libs/resend.ts` is the canonical transactional email sender in app code.
- `server/emails/base.ts` provides reusable HTML email primitives.
- `server/supabase.ts::getServiceSupabaseClient()` provides service-role auth client needed for admin auth link generation.

## External Resources

- [Supabase Auth JS: admin.generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generate-link) - Confirms server-side generation of one-time links and that generated links include fields such as `action_link`, `hashed_token`, `email_otp`, and `verification_type`.
- [Resend Node SDK](https://resend.com/docs/send-with-nodejs) - Confirms `resend.emails.send(...)` API for transactional delivery.

## Constraints & Risks

- Supabase service role key is required for `auth.admin.generateLink` and must stay server-only.
- Link type mismatches could break callback verification if not aligned with callback `verifyOtp` type.
- Any token/link logged verbatim is a security risk.
- Existing docs mention Supabase SMTP + Resend; route-level direct sending should be documented to avoid operational confusion.

## Open Questions (owner, due)

- Q: Should magic-link sending include idempotency keys at transport level?
  A: Not required for this first canonical path; retry behavior remains caller-driven and rate-limited.

## Recommended Direction (with rationale)

- Introduce a single server-side helper to generate Supabase magic links using admin API and deliver via `libs/resend.ts`.
- Replace direct `signInWithOtp` calls in both signin and signup routes with this helper.
- Keep callback route unchanged (already supports token-hash verification).
- Update environment/docs to make the delivery path explicit and maintainable.
