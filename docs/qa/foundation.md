# QA Foundation

Sprint 0 foundation runs through:

```sh
pnpm run qa:foundation
```

The command runs the QA tag audit before the foundation Vitest suite:

```sh
pnpm run guard:qa-tags
pnpm exec vitest run tests/qa
```

The tag audit scans Playwright and Vitest test files under `tests/**`, validates every discovered `@tag` against `scripts/qa/tags.ts`, and compares untagged test-title counts against `config/qa/tag-baseline.json`. Existing untagged test-title debt is pinned as a ratchet; new untagged titles or unknown tags fail the guard.

High-risk QA package scripts route through `scripts/qa/run-guarded-command.ts` before they execute Vitest. The runner applies the shared environment guard to direct command entrypoints, so destructive suites require `QA_ALLOW_DESTRUCTIVE` for the resolved target class and external mutation suites require `QA_EXTERNAL_MUTATION_MODE=mock|dry-run|sandbox|test-sink` or an approved mock/dry-run flag.

App-host Playwright configs run `scripts/qa/clear-next-dev-lock.ts` before starting Next dev. It removes `.next/dev/lock` only when the configured local app port is not listening, which keeps repeated local QA selectors from failing on stale lock files while preserving active dev servers.

Artifact safety lives in the shared QA helpers:

- `scripts/qa/redaction.ts` redacts structured payloads and free-form logs.
- `scripts/qa/artifact-sanitizer.ts` redacts text, JSON, HAR, and JSONL artifact files on disk.
- Retained Playwright `trace.zip` archives are removed by the sanitizer and replaced with a `.redacted.txt` placeholder, because raw trace archives can retain cookies, tokens, headers, emails, phones, and request payloads.

Refresh the baseline only after reviewing intentional tag debt movement:

```sh
pnpm exec tsx scripts/qa/tag-audit.ts --baseline=config/qa/tag-baseline.json --update-baseline
```
