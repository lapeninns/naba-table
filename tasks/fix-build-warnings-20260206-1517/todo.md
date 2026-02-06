---
task: fix-build-warnings
timestamp_utc: 2026-02-06T15:17:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Config

- [x] Add `turbopack.root` to `next.config.js` (absolute path).

## Dependencies

- [x] Update `baseline-browser-mapping` to `@latest` via `pnpm`.
- [x] Upgrade Next.js to a patched version to refresh bundled baseline mapping data.

## Verification

- [x] `pnpm run build` (warnings removed)
- [ ] `pnpm run dev` (not re-run; build path already verified)
