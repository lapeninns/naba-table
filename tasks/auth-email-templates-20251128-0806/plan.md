---
task: auth-email-templates
timestamp_utc: 2025-11-28T08:06:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Auth email templates

## Objective

Deliver brand-aligned, Supabase-compatible email templates for six auth flows so the team can paste them into the Supabase dashboard without guesswork.

## Success Criteria

- [ ] Each flow (confirm signup, invite user, magic link, change email, reset password, reauthentication) has subject, preview, HTML, and plain-text versions.
- [ ] Copy uses the correct Supabase variables (`{{ .ActionLink }}`, `{{ .Email }}`, `{{ .SiteURL }}`, change-email tokens, reauth URL) and clearly distinguishes flows.
- [ ] Templates include safety/expiry/support messaging and live in `docs/auth-email-templates.md`.

## Architecture & Components

- Artifact: documentation only (markdown); no runtime code or migrations.
- Inputs: Supabase template variables; brand tone from README; sender details from `docs/environments.md`.

## Data Flow & API Contracts

- Not applicable; note that Supabase injects `ActionLink` and token values server-side—templates must leave these untouched.

## UI/UX States

- Email-focused; ensure copy covers expected states (success action, ignore-if-not-you, expiry).

## Edge Cases

- Change email uses two tokens (current vs new) and must reassure both addresses.
- Magic link vs confirm signup need distinct wording so new users are not confused.
- Reauthentication is triggered by sensitive actions; emphasize security.
- Expired links and copy/paste scenarios should have clear guidance.

## Testing Strategy

- Manual proofread for tone, placeholders, and security cues.
- Optional: paste into Supabase template preview (dashboard) and send a test via the existing scripts; avoid hitting production recipients.

## Rollout

- Documentation only; no feature flags. Ops can adopt templates in Supabase after review.

## DB Change Plan

- Not applicable.
