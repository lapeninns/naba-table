---
task: fix-customer-phone-normalization
timestamp_utc: 2026-04-01T16:11:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm canonical path for ops/public customer creation.
- [x] Confirm root cause in phone normalization mismatch before insert.

## Core

- [x] Update shared customer phone normalization to canonicalize UK equivalents consistently.
- [x] Keep non-UK fallback normalization safe and deterministic.
- [x] Ensure `upsertCustomer` reuses an existing customer for equivalent UK phone formats.
- [x] Reuse the same comparable-phone helper in reserve timeout recovery.
- [x] Normalize guest self-serve booking ownership checks instead of comparing raw phone strings.

## UI/UX

- [ ] No direct UI changes.

## Tests

- [x] Add focused server tests for phone normalization and existing-customer reuse.
- [x] Add reserve timeout recovery proof for equivalent UK phone formats.
- [x] Run targeted Vitest coverage for the changed path.

## Notes

- Assumptions: UK canonicalization should be the only format-aware behavior in this fix; other numbers keep a digits-only fallback.
- Deviations: RED-first is relaxed here because the first step was confirming the production mismatch in the current implementation.

## Batched Questions

- None.
