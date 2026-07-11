# QA Full Suite

The complete non-e2e Vitest suite runs through:

```sh
pnpm test
```

The script is a bare `vitest run`, so `vitest.config.ts` defines the suite: every
`tests/**/*.{test,spec}.{ts,tsx}` file except `tests/e2e/**` (~3,370 tests, ~40s). Any
path argument would silently narrow the gate, so the script takes none.

CI enforcement lives in `.github/workflows/test-suite.yml` (spec:
`MS-foundation-full-suite-ci-gate`). It runs the full suite on every pull request, every
push to `main`, and on manual dispatch — with no path filters, no
`continue-on-error`, and no quarantine list. Direct pushes to `main` are therefore
tested even though the other QA workflows only trigger on pull requests.

The workflow exports sanitized offline env only (`APP_ENV=test`,
`QA_TARGET_ENV=ci-ephemeral`, dummy Supabase/Resend credentials, `TZ=UTC`), mirroring
`qa-foundation.yml`; `tests/setup.ts` fallbacks align with these values, so no test can
reach remote infrastructure.

`tests/qa/full-suite-command.test.ts` is the wiring self-test: it fails if the `test`
script is renamed or narrowed, a trigger is dropped, the env sanitization keys are
removed, or an escape hatch is added.

Relationship to the packs: the `qa:*` domain packs remain the curated, guarded slices
for local operator workflows and release candidates; the full suite is the safety net
that also runs the ~575 test files no pack references.
