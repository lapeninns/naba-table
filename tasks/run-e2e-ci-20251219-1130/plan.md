---
task: run-e2e-ci
timestamp_utc: 2025-12-19T11:30:43Z
owner: github:@amankumarshrestha
reviewers: [github:@qa]
risk: medium
flags: []
related_tickets: []
---

# Plan: Run full E2E suite in CI

## Steps

1. Add a workflow (`.github/workflows/e2e.yml`) to run Playwright across `tests/e2e` using all projects.
2. Wire required secrets/inputs (`BASE_URL`, `E2E_GUEST_SESSION_TOKEN`, `E2E_TEST_GUEST_EMAIL`, `E2E_TEST_GUEST_NAME`, `E2E_TEST_RESTAURANT_SLUG`).
3. Trigger workflow via GH CLI or Actions UI.
4. Record results + artifact paths in `verification.md`.
