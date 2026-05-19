# Release Candidate QA

Sprint 16 adds a single local release-candidate entrypoint:

```sh
pnpm run qa:rc
```

The command runs through `scripts/qa/rc-pack.ts`, applies the QA environment guard, sets safe local defaults for mock/dry-run execution, and writes a redacted JSON summary to:

```text
test-results/qa/<QA_RUN_ID>/rc-summary.json
```

Useful selectors:

- `pnpm run qa:rc:list` lists the RC commands without executing them.
- `pnpm run qa:rc -- --dry-run` writes a skipped-command summary artifact without executing the suites.
- `pnpm run qa:rc -- --phase worker` runs a single RC phase.
- `pnpm run qa:rc:p0p1-api` runs the P0/P1 API and security selector.
- `pnpm run qa:rc:p0p1-browser` runs the P0/P1 browser selector.
- `pnpm run qa:rc:workers` runs worker/background coverage.
- `pnpm run qa:rc:a11y-visual` runs UI/a11y/visual coverage.
- `pnpm run qa:rc:artifact-safety` verifies QA artifacts, redaction, and cleanup registry behavior.
- `pnpm run qa:artifacts:sanitize <path>` redacts a QA artifact directory on disk and removes raw Playwright trace archives.

RC phases:

- build: `pnpm run build`, `pnpm run reserve:build`
- static: `pnpm run lint`, `pnpm run typecheck`, `pnpm run secret:scan`, `pnpm run guard:qa-tags`
- P0/P1 API/security: public booking, ops lifecycle, guest portal, security regression, service-role guard, capacity/tables, settings/team, customers/delivery API
- P0/P1 browser: public booking, ops lifecycle auth-boundary proof, authenticated ops app-host shipped-route proof, capacity/tables proof, settings/team proof, customers/delivery proof, guest portal auth-boundary proof
- worker: webhooks, cron, queues, and worker endpoints
- a11y/visual: shadcn strict guard, Luma strict baseline ratchet, axe, keyboard, screenshots, overflow checks
- privacy: observability, analytics, log redaction, artifact safety
- performance: deterministic local performance smoke
- artifact-safety: QA run id, artifact directories, redaction, cleanup registry

The RC pack refuses production-like targets through the QA environment guard. The standalone Playwright configs load the same guard before starting dev servers or browser sessions. External integrations stay mocked, sandboxed, dry-run, or test-sink only. Authenticated ops app-host browser proof uses a local-only QA auth fixture that requires `QA_ENABLE_AUTH_FIXTURES=1`, `QA_USE_MOCKS=1`, `QA_TARGET_ENV=local`, an app-local host, and a test cookie. `secret:scan` uses `gitleaks` and `trufflehog` when they are installed, and always runs the repo-local fallback scanner so local and ephemeral CI runs are deterministic. The Luma guard pins existing semantic-token debt in `config/qa/luma-baseline.json` and fails RC a11y/visual coverage if exception findings drift above that baseline. The QA tag audit pins existing untagged test-title debt in `config/qa/tag-baseline.json` and fails on unknown tags or any increase in untagged titles. The RC runner sanitizes the current `QA_RUN_ID` artifact directory before writing the summary, including redacting text/JSON/HAR/JSONL artifacts and removing retained raw Playwright trace archives. Quarantined tests are listed in the summary and are not counted as coverage; the current quarantine list is empty.
