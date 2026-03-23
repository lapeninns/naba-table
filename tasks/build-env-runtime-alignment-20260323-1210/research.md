---
task: build-env-runtime-alignment
timestamp_utc: 2026-03-23T12:10:40Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Align build-time and runtime environment validation

## Requirements

- Functional:
  - `pnpm run build` must not fail in local staging/dev targets solely because Next sets `NODE_ENV=production`.
  - Runtime env parsing must use the same production-target rule as `scripts/validate-env.ts`.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve strict production requirements for real production targets.
  - Keep the fix centralized in env parsing rather than adding route-specific workarounds.

## Existing Patterns & Reuse

- `scripts/validate-env.ts` already distinguishes a real production target using `APP_ENV` and `VERCEL_ENV`.
- `lib/env.ts` currently chooses the schema from `NODE_ENV` only, which diverges during `next build`.

## Constraints & Risks

- Production secrets such as Turnstile and auth audit keys must still be required for true production deployments.
- `server/supabase.ts` evaluates `getEnv()` at module load, so env parsing must be safe during build-time route evaluation.

## Recommended Direction (with rationale)

- Add a shared schema-target resolver in `config/env.schema.ts`.
- Use it from both `scripts/validate-env.ts` and `lib/env.ts` so build-time and runtime validation stay aligned.
