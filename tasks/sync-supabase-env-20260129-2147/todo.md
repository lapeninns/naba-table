---
task: sync-supabase-env
timestamp_utc: 2026-01-29T21:47:46Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm target Supabase project for local dev (ref: loxrwkeuxesctnrdpksy)
- [x] Pull Vercel development env vars
- [x] Fetch Supabase API keys via CLI

## Core

- [x] Populate missing Supabase env vars in `.env.local`
- [x] Avoid printing secrets in logs

## Tests

- [x] `pnpm run validate:env`
- [ ] `pnpm run build` (if requested)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Confirm intended Supabase project for local dev
