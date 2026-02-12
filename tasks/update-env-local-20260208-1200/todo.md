---
task: update-env-local
timestamp_utc: 2026-02-08T12:00:00Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm env keys to update (Clarity + Supabase).

## Core

- [x] Update .env.local with provided values.

## Notes

- Assumptions: Provided values map to NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, SUPABASE_DB_PASSWORD, and NEXT_PUBLIC_CLARITY_PROJECT_ID.
- Deviations: None.

## Batched Questions

- Any other env values to update?
