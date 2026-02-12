---
task: fix-vercel-function-size
timestamp_utc: 2026-02-08T21:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Vercel Function Size

## Objective

Prevent Vercel serverless functions from exceeding size limits by excluding `tasks/**/artifacts/**` from build context and output file tracing.

## Success Criteria

- [ ] Vercel build no longer reports function size errors tied to task artifacts.
- [ ] No functional runtime code removed.

## Architecture & Components

- `next.config.js` (`outputFileTracingExcludes`).
- `.vercelignore` (exclude task artifacts from upload).

## Data Flow & API Contracts

- No changes.

## UI/UX States

- No changes.

## Edge Cases

- Ensure only artifacts are excluded; task metadata remains in repo.

## Testing Strategy

- Build on Vercel should pass size checks.

## Rollout

- No flags.
