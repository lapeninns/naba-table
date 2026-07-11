# QA Coverage Ratchet

Coverage is a measured, machine-enforced number (spec:
`MS-foundation-coverage-ratchet`). Two entrypoints:

```sh
pnpm test:coverage   # vitest run --coverage → text-summary + coverage/coverage-summary.json
pnpm guard:coverage  # test:coverage, then scripts/qa/coverage-ratchet.ts compares
                     # the summary against config/qa/coverage-baseline.json
```

The provider is `@vitest/coverage-v8` (pinned `4.1.0` to match vitest). The
coverage block in `vitest.config.ts` only activates under `--coverage`, so
`pnpm test` behavior and timing are unchanged (~40s). The coverage-guarded run
measured ~42–45s locally (2026-07-11, 3,521 tests), well inside the ~4 minute
CI budget. One coverage-only accommodation lives outside the block:
`testTimeout` scales to 30s when `--coverage` is passed, because V8
instrumentation pushes the planner stress suite past the default 5s under
full-suite worker contention; plain runs keep vitest defaults.

## Ratchet

`scripts/qa/coverage-ratchet.ts` reads `coverage/coverage-summary.json` and
compares lines + branches percentages for `global` plus each tracked top-level
directory (`cloudflare`, `components`, `hooks`, `lib`, `reserve`, `scripts`,
`server`, `src`) against the frozen floors in
`config/qa/coverage-baseline.json`. Any scope below its floor exits 1 with a
per-scope message. A missing or unparseable summary fails closed, as does a
baseline scope with no coverage data in the current run.
`.github/workflows/test-suite.yml` runs `pnpm guard:coverage` as a second step
after the fast `pnpm test` step (the fast step is pinned by
`tests/qa/full-suite-command.test.ts`), so a coverage drop fails CI.

## Raising floors

After landing tests that raise coverage, regenerate the floors:

```sh
pnpm test:coverage
pnpm exec tsx scripts/qa/coverage-ratchet.ts --baseline=config/qa/coverage-baseline.json --update-baseline
```

Floors are set to the measured value minus a 0.2pp epsilon (absorbs unrelated
line-count drift), and the update is strictly monotonic: it prints what rose
and refuses to lower any existing floor. Lowering a floor is a deliberate,
reviewed edit to the baseline file, never a script path.

## Phase-1 scoping: exercised files only

Vitest 4 removed `coverage.all`; its default — only files actually loaded by
the suite are measured — is the equivalent of `all: false`, and that is the
deliberate phase-1 choice: the floor covers exercised files, so the ~578-module
tree of never-imported files does not dilute percentages into meaninglessly
tiny floors. The trade-off is that a file dropping entirely out of the test
graph leaves the denominator instead of showing as 0%. The closure specs that
raise coverage will flip this to the `all: true` equivalent by declaring
explicit `coverage.include` globs for the product tree, after which the floors
get regenerated (upward) against the full denominator. Excludes are explicit
in `vitest.config.ts`: `tests/**`, `node_modules`, `.next`, storybook, config
files, `*.d.ts`, and `types/**` never count toward floors.

`tests/qa/coverage-command.test.ts` is the wiring self-test: it fails if the
scripts are renamed or rewired, the baseline is missing or has floors at zero,
the CI step disappears, or the ratchet stops rejecting lowered floors.
