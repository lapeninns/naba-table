---
task: magic-link-resend
timestamp_utc: 2026-02-12T18:27:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Analyze current magic-link auth routes and callback behavior.
- [x] Confirm existing Resend integration patterns.

## Core

- [x] Add canonical server helper for Supabase magic-link generation + Resend delivery.
- [x] Replace signin route magic-link branch to use helper.
- [x] Replace signup route magic-link branch to use helper.
- [x] Keep password branch behavior unchanged.

## UI/UX

- [x] N/A (server-side auth email delivery path change only).

## Tests

- [x] Run targeted type/lint verification for changed files.

## Notes

- Assumptions:
- Existing callback flow for `token_hash` remains valid for generated links.
- Deviations:
- None.

## Batched Questions

- None.
