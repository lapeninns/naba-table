---
task: fix-mobile-horizontal-scroll
timestamp_utc: 2026-01-19T22:46:19Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate pages/components causing horizontal overflow.
- [x] Document root causes and impacted files.

## Core

- [x] Replace rigid widths/min-widths with fluid alternatives.
- [x] Confirm no flex/grid shrink/wrap issues in targeted components.
- [x] Ensure media is responsive (`max-w-full`, `h-auto`).
- [x] Add safe text wrapping for long strings where needed.

## UI/UX

- [ ] Verify layout at 320px, 375px, 768px, 1280px.
- [ ] Confirm no content clipped.

## Tests

- [x] Manual QA via Chrome DevTools MCP.
- [ ] Capture Lighthouse JSON + HAR + screenshots in `artifacts/`.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Which specific pages/routes reproduce the issue?
