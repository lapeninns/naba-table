---
task: supabase-resend-smtp-config
timestamp_utc: 2025-11-22T23:56:51Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Supabase Resend SMTP Config

## Requirements

- Functional: capture/document the Supabase email configuration that now uses Resend SMTP (sender name/email, host/port/user, API key name) and align code/env placeholders so engineering environments match the dashboard change.
- Non-functional: keep secrets out of source; maintain compatibility with existing Resend email paths; no downtime for auth or transactional emails.

## Existing Patterns & Reuse

- Resend client integration already lives in `libs/resend.ts` and `.env.example` exposes `RESEND_API_KEY` / `RESEND_FROM`.
- Environment guardrails and secret rotation guidance exist in `docs/environments.md` and `docs/security.md`.

## External Resources

- Supabase dashboard email/SMTP configuration (Resend) — source of truth for host/port/user and sender metadata.

## Constraints & Risks

- Secrets (SMTP password/API key) must stay in env/secret stores; never committed.
- Need clarity on which Supabase project/env was updated (staging vs production) to mirror values correctly.
- Auth/magic-link emails rely on Supabase settings; misalignment could block logins.

## Open Questions (owner, due)

- Which environments were changed (staging, prod, both)? (owner: requester, due: ASAP)
- Do we need to update any hosting/CI secrets or just docs? (owner: requester, due: ASAP)
- Should `.env.example` include placeholder SMTP fields or rely solely on Resend API key? (owner: engineering, due: planning)

## Recommended Direction (with rationale)

- Document the Supabase→Resend SMTP configuration and required env placeholders to keep code/env in sync and avoid tribal knowledge.
- Validate existing Resend integration for app-driven emails remains unchanged; limit scope to configuration/docs unless code gaps emerge during planning.
