---
task: apply-staging-migration
timestamp_utc: 2026-02-07T13:39:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Checklist

- [x] List migrations added on 2026-02-06 UTC
- [x] Dry-run apply against staging (transaction + rollback)
- [x] Apply migration against staging (transaction + commit)
- [x] Verify index/functions/grants
- [x] Save logs under artifacts/
