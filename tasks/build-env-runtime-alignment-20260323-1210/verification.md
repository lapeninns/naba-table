---
task: build-env-runtime-alignment
timestamp_utc: 2026-03-23T12:10:40Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Automated Verification

- [x] `pnpm exec vitest run tests/config/env-schema-target.test.ts`
- [x] `pnpm exec eslint config/env.schema.ts lib/env.ts scripts/validate-env.ts tests/config/env-schema-target.test.ts`
- [x] `pnpm run typecheck`
- [x] `pnpm run build`

## Outcome

- Local build now succeeds with `APP_ENV=staging` and no Turnstile/auth audit production secrets.
- Production-only secrets remain required when the target is actually production (`APP_ENV=production` or `VERCEL_ENV=production`).
