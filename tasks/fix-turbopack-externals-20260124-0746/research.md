---
task: fix-turbopack-externals
timestamp_utc: 2026-01-24T07:46:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Turbopack Externals Warnings

## Requirements

- Functional: Remove Turbopack warnings about missing externals (import-in-the-middle, require-in-the-middle, ioredis).
- Non-functional (a11y, perf, security, privacy, i18n): No UI changes; keep build output stable.

## Existing Patterns & Reuse

- `next.config.js` has no explicit `serverExternalPackages`; defaults apply.
- `package.json` already includes `ioredis` but not `import-in-the-middle`/`require-in-the-middle`.

## External Resources

- N/A (warnings include suggested remediation steps).

## Constraints & Risks

- Keep changes minimal; no runtime behavior changes beyond externalization.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add missing external packages and patch BullMQ to avoid importing `ioredis/built/utils`, replacing it with a local constant.
