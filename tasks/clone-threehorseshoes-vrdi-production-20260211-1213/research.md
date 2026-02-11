---
task: clone-threehorseshoes-vrdi-production
timestamp_utc: 2026-02-11T12:13:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Correct production target to vrdi project

## Requirements

- Ensure restaurant clone/profile/seed/access are applied to actual production Supabase project `vrdiqfudmwydclqpydee`.

## Findings

- `.env.local` target ref: `ndxmivcrehsacuerwxtm`.
- `.env.vercel-production` target ref: `vrdiqfudmwydclqpydee`.
- Prior operations were applied to `ndxmiv...`; `vrdi...` initially had only source restaurant.

## Risks

- Auth admin `listUsers` fails for `perPage=200` on `vrdi` with `Database error finding users`.
- Mitigation: use smaller pages (`perPage=10`) and pass `USER_ID` directly for grant script.

## Direction

- Re-run clone + profile update + seeding + access grant on `vrdi` using explicit env and project-ref guard.
