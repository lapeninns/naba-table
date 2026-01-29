---
task: sync-supabase-env
timestamp_utc: 2026-01-29T21:47:46Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Sync Supabase Env

## Requirements

- Functional:
  - Populate required Supabase env vars for local build: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Secrets must remain out of git and logs.

## Existing Patterns & Reuse

- Env validation enforced in `scripts/validate-env.ts` and `config/env.schema.ts`.
- Vercel env pull and Supabase CLI API keys are available for sourcing values.

## External Resources

- Supabase CLI `projects api-keys` — source anon/service role keys.
- Vercel CLI `env pull` — source project env vars.

## Constraints & Risks

- Must avoid production credentials in non-production environment.
- Do not print secrets to the terminal.

## Open Questions (owner, due)

- Q: Confirm correct Supabase project ref for local dev (current ref: loxrwkeuxesctnrdpksy).
  A: UNCONFIRMED

## Recommended Direction (with rationale)

- Pull Vercel development env and Supabase API keys, then populate `.env.local` if missing to satisfy validation.
