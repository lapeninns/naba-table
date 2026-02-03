---
task: fix-next-sitemap-env
timestamp_utc: 2026-02-02T19:45:03Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix next-sitemap env load error

## Objective

We will make `pnpm run build` complete without the `next-sitemap` env load error so local builds are reliable.

## Success Criteria

- [ ] `pnpm run build` completes without `Failed to load env ... TypeError` from `next-sitemap`.
- [ ] No secrets are exposed or committed.

## Architecture & Components

- `.env.local`: validate and repair malformed entries.
- `next-sitemap.config.js`: ensure safe usage of `SITE_URL` fallback only.

## Data Flow & API Contracts

- N/A.

## UI/UX States

- N/A.

## Edge Cases

- Missing optional env vars should not break sitemap generation.

## Testing Strategy

- Manual: rerun `pnpm run build`.

## Rollout

- Local-only change (env or config). No flags.

## DB Change Plan (if applicable)

- Not applicable.
