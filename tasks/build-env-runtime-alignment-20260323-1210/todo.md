---
task: build-env-runtime-alignment
timestamp_utc: 2026-03-23T12:10:40Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Add shared env schema target resolver
- [x] Update runtime env parsing to use the shared resolver
- [x] Update `validate:env` to use the shared resolver

## Tests

- [x] Add regression coverage for schema target resolution
- [x] Run lint, typecheck, and build verification
