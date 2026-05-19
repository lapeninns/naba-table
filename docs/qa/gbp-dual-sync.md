# GBP and Dual-Sync QA

Sprint 12 adds a focused local entrypoint for Google Business Profile settings and dual-sync dry-run style coverage:

```sh
pnpm run qa:gbp-dual-sync
```

The command runs:

- GBP route contracts for settings reads/writes, core sync, callback security, and read-only v1 behavior.
- dual-sync state refresh and candidate contract tests.
- publish preview tests for read-only plan generation.
- publish route tests for tenant/admin access, field-level pins, pause/lock guards, queued execution, and mocked Google edit throttling.
- Google audit tests that ensure request/audit payloads stay controlled.
- settings route/component proof for the shipped `google-business-profile` view, GBP section states, and dual-sync publish shell behavior.
- app-host Playwright proof for `/settings/restaurant/google-business-profile`, including local mocked GBP connection data, dual-sync state, and publish-preview UI without executing publish.
- a command-composition QA test so the selector stays intentional.

This suite is local and mocked. It must not publish live GBP changes, call real provider write APIs, or use production/staging access. The publish preview route is the positive safe path; publish execution coverage stays mocked and includes negative guards for unsafe or stale requests.

Tags: `@p2`, `@browser`, `@api`, `@security`, `@contract`, `@dry-run-only`, `@external-mock`.
