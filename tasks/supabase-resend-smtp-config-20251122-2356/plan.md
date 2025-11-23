---
task: supabase-resend-smtp-config
timestamp_utc: 2025-11-22T23:56:51Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Supabase Resend SMTP Config

## Objective

Document and align the Supabase email configuration now pointing to Resend SMTP so engineers know how to set env values and avoid breaking auth/transactional emails.

## Success Criteria

- [ ] Supabase→Resend SMTP setup is documented with sender metadata and non-secret fields.
- [ ] Env examples/notes describe required placeholders without leaking credentials.
- [ ] No code paths for existing Resend integration are regressed.

## Architecture & Components

- Documentation: update `docs/environments.md` (or new section) with Supabase SMTP + Resend instructions.
- Env references: ensure `.env.example` and `libs/resend.ts` expectations are clear for SMTP/API keys.

## Data Flow & API Contracts

- No API contract changes; focus on configuration alignment. Supabase handles SMTP delivery; app continues using Resend API where applicable.

## UI/UX States

- N/A (configuration/docs only).

## Edge Cases

- Avoid storing secrets in git artifacts.
- Clarify staging vs production settings to prevent cross-environment leakage.

## Testing Strategy

- Docs-only: no automated tests needed. Manual check that docs paths render and env placeholders are consistent.

## Rollout

- Immediately effective once docs merged; no feature flag required.

## DB Change Plan (if applicable)

- Not applicable; no DB changes.
