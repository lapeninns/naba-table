---
task: fix-build-warnings
timestamp_utc: 2026-02-06T15:17:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Commands

- `pnpm run build`
- `pnpm run dev` (smoke)

## Expected Outcome

- No Turbopack workspace-root inference warning.
- No baseline-browser-mapping stale-data warning.

## Results

- `pnpm run build` (2026-02-06):
  - No `baseline-browser-mapping` stale-data warning.
  - No Next.js `turbopack.root` / inferred-workspace-root warning.
  - Build completes successfully and `next-sitemap` runs.

## Notes

- The Baseline warning was emitted from Next.js's bundled `browserslist` build (not the direct `baseline-browser-mapping` dependency),
  so the durable fix is upgrading Next.js to a patched version that refreshes the embedded dataset.
