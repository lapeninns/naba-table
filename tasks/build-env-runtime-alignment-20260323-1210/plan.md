---
task: build-env-runtime-alignment
timestamp_utc: 2026-03-23T12:10:40Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Align build-time and runtime environment validation

## Objective

We will make env parsing choose the production schema only for real production targets so `next build` and runtime imports behave consistently with `validate:env`.

## Success Criteria

- [ ] Shared env-schema target resolution exists in one place.
- [ ] `lib/env.ts` and `scripts/validate-env.ts` both use the same resolver.
- [ ] Local `pnpm run build` succeeds without production-only secrets when `APP_ENV=staging` and `VERCEL_ENV` is not production.

## Architecture & Components

- `config/env.schema.ts`: export shared schema target resolver.
- `lib/env.ts`: use shared resolver instead of raw `NODE_ENV`.
- `scripts/validate-env.ts`: reuse shared resolver.
- Add focused regression coverage for target resolution.

## Testing Strategy

- Unit test for schema target resolution.
- Run focused lint/type checks.
- Run `pnpm run build`.
