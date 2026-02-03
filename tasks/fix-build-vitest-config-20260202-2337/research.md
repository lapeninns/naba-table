---
task: fix-build-vitest-config
timestamp_utc: 2026-02-02T23:38:14Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix build failure (vitest/config)

## Requirements

- Functional:
  - `pnpm run build` must succeed without missing module errors.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No user-facing UI change.

## Existing Patterns & Reuse

- Root `vitest.config.ts` uses `vitest/config` import; follow existing testing toolchain.

## External Resources

- N/A (expected to align with current repo tooling).

## Constraints & Risks

- Keep changes minimal; avoid adding unnecessary dependencies.
- Ensure any dependency change remains dev-only.

## Open Questions (owner, due)

- Q: Is Vitest intentionally excluded from devDependencies for build? (owner: github:@amankumarshrestha, due: 2026-02-02)

## Recommended Direction (with rationale)

- Ensure `vitest` is present in devDependencies at a compatible version so `vitest/config` resolves during build.
