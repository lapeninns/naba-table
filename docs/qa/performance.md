# Performance QA

Sprint 15 adds a focused local entrypoint for deterministic performance and load smoke coverage:

```sh
pnpm run qa:performance
```

The command runs:

- thresholded local timing smoke from `tests/performance/qa-performance-smoke.test.ts`.
- explicit thresholds from `config/qa/performance-thresholds.json`.
- public availability route contract tests.
- booking capacity and deterministic table planner tests.
- ops dashboard summary and changes route tests.
- seeded customer CSV export coverage.
- email/SMS delivery route coverage.
- booking short-link and SMS summary worker coverage, including local `/health` endpoint timing.
- a command-composition QA test so the selector stays intentional.

This suite is local and mocked. It uses deterministic fixtures rather than live traffic, does not send notifications, and is selectable separately from PR baseline because timing assertions are inherently more environment-sensitive than contract tests.

Tags: `@p3`, `@performance`, `@api`, `@worker`.

Worker endpoint timing uses local stub bindings only. It proves the Cloudflare worker `fetch`
handlers can respond inside the configured `workerEndpointMs` threshold without touching D1,
Durable Objects, Twilio, Supabase, or a deployed worker.
