---
task: resend-from-email
timestamp_utc: 2025-12-02T14:28:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix RESEND_FROM validation failure

## Requirements

- Functional: Build must pass env validation; RESEND_FROM should be a valid email used for transactional emails (Resend).
- Non-functional: No secrets committed; keep existing validation pattern; production-safe defaults.

## Existing Patterns & Reuse

- `scripts/validate-env.ts` uses zod schema for env validation.
- Email sender values are drawn from `process.env.RESEND_FROM` and likely consumed in email libs.

## External Resources

- Vercel build log shows error: `RESEND_FROM: Invalid email address` during `next build`.

## Constraints & Risks

- Value must be a valid RFC5322 email; domain `no-reply-notifications.nabatable.com` is verified in production.
- Changing validation schema could mask misconfiguration; prefer correcting expected format.

## Open Questions (owner, due)

- None identified; using provided domain.

## Recommended Direction (with rationale)

- Require RESEND_FROM to be a valid email and default to `no-reply@no-reply-notifications.nabatable.com` when unset to prevent missing value in non-prod.
- Update `.env.example` and documentation to show correct format; keep validation strict.
