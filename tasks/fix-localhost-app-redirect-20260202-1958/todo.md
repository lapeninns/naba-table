---
task: fix-localhost-app-redirect
timestamp_utc: 2026-02-02T19:58:18Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify local routing controls in `src/proxy.ts`.

## Core

- [x] Update `.env.local` to use `NEXT_PUBLIC_ROOT_DOMAIN=localhost`.
- [x] Add `NEXT_PUBLIC_LOCAL_APP_HOSTS` for localhost and 127.0.0.1.

## Tests

- [ ] Restart dev server and verify `/app` stays on localhost.

## Notes

- Assumptions: None.
- Deviations: None.

## Batched Questions

- None.
