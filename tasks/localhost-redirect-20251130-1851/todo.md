---
task: localhost-redirect
timestamp_utc: 2025-11-30T18:51:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect middleware domain routing logic.

## Core

- [x] Add localhost guard to skip cross-domain redirects for /app when host is localhost/127.0.0.1.
- [x] Keep prod redirect behavior intact for other hosts.
- [x] Ensure /ops legacy redirect still functions appropriately on localhost (without changing host).

## Testing

- [x] pnpm run build.
- [ ] Manual: load http://localhost:3000/app/dashboard and verify no external redirect (requires dev server).

## Notes

- Assumption: env keeps NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com for dev; middleware must adapt.
