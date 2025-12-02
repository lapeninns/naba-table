---
task: fix-magic-link-routes
timestamp_utc: 2025-12-02T18:24:59Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm baseline behavior in commit 43ee2e6 (reference only).
- [x] Identify current callback regressions (code vs token_hash, redirects).

## Core Changes

- [x] Update `src/app/api/auth/callback/route.ts` to restore safe redirect resolution while keeping token_hash handling.
- [x] Guard customer-linking and membership lookup so auth success is not blocked.

## Tests

- [x] Add/adjust tests for callback (code vs token_hash, valid/invalid redirect, staff vs guest fallback).
- [x] Run relevant test subset (`pnpm test` or targeted route tests).

## Verification

- [ ] Manual quick call (if possible) to callback endpoints with mock params to ensure redirects.
- [ ] Record outcomes in `verification.md`.

## Notes

- Assumptions: service-role envs present in deployed envs; rootDomain may be missing locally.
- Deviations: MCP research unavailable; manual diff used instead.
