---
task: fix-build-warnings
timestamp_utc: 2026-02-06T15:17:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix build/dev warnings

## Problem Statement

`pnpm run build` and `pnpm run dev` emit warnings:

- `[baseline-browser-mapping] The data in this module is over two months old...`
- `Warning: Next.js inferred your workspace root, but it may not be correct.` (due to multiple lockfiles; it selects `/Users/amankumarshrestha/package-lock.json` as the root)

## Requirements

- Functional:
  - Remove/silence the warnings without changing runtime behavior.
- Non-functional:
  - Keep configuration explicit and stable across machines.
  - Avoid deleting user files outside the repo (safe fix preferred).

## Existing Patterns & Reuse

- `next.config.js` already uses `turbopack.resolveAlias`. Next.js supports `turbopack.root` for pinning the project root.
- `baseline-browser-mapping` is already present in `devDependencies`, so bumping it is the canonical path.

## External Resources

- Next.js docs: Turbopack `root` option (absolute path) to set the application root directory.

## Constraints & Risks

- There is a `package-lock.json` located at `/Users/amankumarshrestha/package-lock.json` which Next detects as a lockfile and uses to infer the workspace root.
- Avoid deleting or moving that file unless explicitly requested.

## Recommended Direction (with rationale)

1. Configure `turbopack.root` to the repo directory to avoid accidental root inference based on unrelated lockfiles.
2. Update `baseline-browser-mapping` to `@latest` to refresh its embedded dataset and silence the warning.
