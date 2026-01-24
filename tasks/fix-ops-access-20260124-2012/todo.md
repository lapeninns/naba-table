---
task: fix-ops-access
timestamp_utc: 2026-01-24T20:12:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Decode service role key to confirm project ref and role.
- [x] If match, verify schema grants for `service_role` in pre-staging.
- [x] Apply missing grants if needed.
- [x] Adjust secure cookie handling to avoid localhost redirect loops.
- [ ] Verify memberships API works.
