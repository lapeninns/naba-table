---
task: auth-email-templates
timestamp_utc: 2025-11-28T08:06:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Auth email templates

## Requirements

- Functional: Produce highly personalized, security-minded templates for six Supabase auth flows (confirm signup, invite user, magic link, change email, reset password, reauthentication) and store them in a single markdown file consumable by the team.
- Non-functional: Keep content brand-aligned with Nab a Table (warm, concise hospitality tone), support plain-text fallbacks, ensure templates reference Supabase-provided action links/tokens, and avoid embedding secrets.

## Existing Patterns & Reuse

- Supabase auth already configured to send mail via Resend SMTP (`docs/environments.md`); templates should assume the sender name **Lapen Inns / Nab a Table** and reply-to support inbox.
- Supabase provides built-in email flows for the six listed triggers and exposes template variables such as `{{ .ActionLink }}`, `{{ .Email }}`, `{{ .SiteURL }}`, and token variants for change-email/reset flows—these should be reused instead of inventing new placeholders.
- Prior auth email investigation (`tasks/auth-email-fallback-20251128-0749`) noted the same template set; align terminology to reduce confusion between flows.

## External Resources

- Supabase docs: auth email templates and variables (`ActionLink`, `SiteURL`, `Email`, `EmailChangeTokenCurrent`, `EmailChangeTokenNew`, `ReauthenticateURL`, token expiry guidance).
- Internal brand context: README.md (platform brand Nab a Table, parent Lapen Inns); environments doc for sender identity.

## Constraints & Risks

- Follow root AGENTS policy: task artifacts required; no secrets in repo; Supabase is remote-only (no dashboard changes recorded here); avoid over-engineering.
- Misusing template variables could break links or bypass confirmations; ensure each flow references the correct Supabase-provided URL/token.
- Overly generic copy could confuse users during security-sensitive actions (reset/reauth); must keep intent explicit.

## Open Questions (owner: pending)

- Confirm official support contact to surface in templates (`support@nabat.com` vs `team@resend.adtechgrow.com`).
- Preferred default locale and time zone hints for link expiry messaging.
- Do we want a single-brand sender ("Lapen Inns") or product-specific ("Nab a Table") per environment?

## Recommended Direction

- Author `docs/auth-email-templates.md` with per-flow sections including subject, preview line, HTML body, plain-text body, and notes on which Supabase variables to keep intact.
- Emphasize personalization (first name, venue context, requested action), safety cues (expiry, ignore-if-not-you), and support/next steps.
- Keep the copy concise but distinct per flow so users can tell signup vs magic link vs reauth at a glance.
