---
task: fix-build-signin-env
timestamp_utc: 2026-03-19T00:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect root and nested `AGENTS.md`
- [x] Read failing route and build config

## Core

- [x] Normalize auth provider error statuses in sign-in route
- [x] Remove fragile sitemap postbuild execution from build path

## UI/UX

- [x] No UI changes

## Tests

- [x] Production build
- [x] Targeted verification of sign-in fallback path

## Notes

- Assumptions: App Router metadata routes are the canonical sitemap/robots implementation.
- Deviations: No Chrome DevTools MCP required because no UI was changed.
- Verification note: `npm run build` passed with `PATH` pointed at the local NVM Node install used by the interactive shell.

## Batched Questions

- None at this stage
