---
task: fix-next-sitemap-env
timestamp_utc: 2026-02-02T19:45:03Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix next-sitemap env load error

## Requirements

- Functional: `pnpm run build` should complete without `next-sitemap` env load error.
- Non-functional (a11y, perf, security, privacy, i18n): No UI changes; avoid exposing secrets; keep env handling safe.

## Existing Patterns & Reuse

- `scripts/validate-env.ts` loads `.env.local` safely with dotenv.
- `next-sitemap.config.js` reads `process.env.SITE_URL` with fallback.

## External Resources

- None.

## Constraints & Risks

- `.env.local` is git-ignored and may contain secrets; do not log values.
- Must follow SDLC artifacts and minimal change set.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Fix `.env.local` value that ends with an unescaped `$` (triggers `@next/env@13.5.11` expansion bug during `next-sitemap`).
