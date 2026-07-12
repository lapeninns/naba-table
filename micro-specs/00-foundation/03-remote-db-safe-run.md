---
spec_id: MS-foundation-remote-db-safe-run
status: active
risk_class: docs-tooling
owner: agent:wa-db-safe-run
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/00-foundation/03-remote-db-safe-run.md
  - micro-specs/evidence/MS-foundation-remote-db-safe-run.json
  - .omo/evidence/task-6a-db-safe-run.md
  - scripts/db/safe-run.ts
  - scripts/db/check-drift.ts
  - tests/scripts/db-safe-run.test.ts
  - package.json
  - README.md
  - docs/environments.md
  - docs/security.md
  - tasks/db-safe-run-20260712-2003/**
implementation_surfaces:
  - scripts/db/safe-run.ts
  - scripts/db/check-drift.ts
  - tests/scripts/db-safe-run.test.ts
  - package.json
  - README.md
  - docs/environments.md
  - docs/security.md
  - tasks/db-safe-run-20260712-2003/**
related_docs:
  - AGENTS.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - docs/security.md
related_tests:
  - tests/scripts/db-safe-run.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm format:db-safe-run
  - pnpm test -- tests/scripts/db-safe-run.test.ts
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions:
  - 'evidence-waiver: implemented on the shared isolated WhatsApp release worktree; scope is independently attributable and no child agent commit is authorized (expires: 2026-07-19)'
---

# MS-foundation-remote-db-safe-run — Remote Database Safe Runner

## 1. Exact Goal and User-Visible Outcomes

Maintainers have one fail-closed command boundary for every supported remote database workflow.
The boundary identifies the staging or production target before execution, validates the runtime
environment, previews its static command plan without side effects, and never prints credentials.
Package commands and operator documentation expose only workflows supported by the repository's
remote-only Supabase operating model.

## 2. Blast Radius

**In scope:** the safe runner, its behavioral tests, database entries in `package.json`, and the
database-command sections of `README.md`, `docs/environments.md`, and `docs/security.md`.
Task/evidence artifacts and this Micro-Spec may record the delivery proof.

**Out of scope:** database schemas, migrations, Supabase project configuration, credentials,
environment-schema behavior, product runtime code, and any actual local or remote database command.

## 3. Strict Constraints and Assumptions

- The wrapper adds no dependency and delegates only to fixed executable/argument allowlists.
- User-supplied passthrough arguments are rejected; secrets and environment values are never
  rendered in help, dry-run, errors, or command summaries.
- Child processes inherit the operator environment but run with inherited stdio so provider output
  remains available without being buffered or reprinted by the wrapper.
- Automated verification substitutes temporary fake child executables and must not invoke
  Supabase, a migration, a database client, or any network command.

## 4. Decisions Already Made

- `DB_TARGET_ENV` is the explicit target selector and accepts only `staging` or `production`; the
  wrapper does not infer a target from `APP_ENV`.
- Supported workflows are `status`, `migrate`, `push`, `pull`, and `check-drift`. `migrate` and
  `push` are equivalent migration-apply aliases. Legacy local reset/seed/wipe workflows are removed.
- Every executing workflow runs `pnpm validate:env` first. `--help` and `--dry-run` execute no child.
- A production migration apply requires `CONFIRM_PRODUCTION=true`; read-only workflows and
  child-free dry-runs do not require that write confirmation.
- Drift detection compares the linked remote public schema with local migrations through the
  supported Supabase CLI diff command and exits non-zero when either the CLI fails or drift exists.

## 5. Behavioral Requirements (EARS)

- WHEN a supported workflow executes with an explicit valid target, THE runner SHALL validate the
  environment before invoking the fixed command mapped to that workflow.
- IF `DB_TARGET_ENV` is absent or is not `staging` or `production`, THEN THE runner SHALL refuse
  before invoking any child process.
- IF a production migration apply lacks `CONFIRM_PRODUCTION=true`, THEN THE runner SHALL refuse
  before invoking any child process.
- WHEN `--dry-run` is requested for a valid workflow and target, THE runner SHALL print the target,
  access class, and redacted fixed command plan without requiring apply confirmation or invoking a
  child process.
- WHEN `--help` is requested, THE runner SHALL print supported workflows, required target selection,
  and production confirmation guidance without validating the environment or invoking a child.
- IF an unknown workflow, flag, extra positional argument, or `--` passthrough boundary is supplied,
  THEN THE runner SHALL reject it without invoking a child process.
- IF environment validation or the delegated workflow exits non-zero, THEN THE runner SHALL stop at
  that boundary and propagate the exact child exit code.
- THE package database commands and operator documentation SHALL route supported remote workflows
  through the safe runner and SHALL NOT advertise legacy local reset, seed, full-reset, or wipe flows.
- WHEN drift detection returns SQL differences, THE drift command SHALL emit the differences and
  exit non-zero; WHEN the delegated CLI fails, THE drift command SHALL propagate that exact exit.

## 6. Verification Criteria and Task Breakdown

Acceptance requires tests proving the valid staging and production read paths, both migration-apply
aliases, missing/invalid targets, missing production confirmation, validation failure, delegated
failure, help, dry-run redaction, and every rejected argument shape. A package/documentation
contract test proves all exposed database workflows match the remote-only model.

1. Capture the absent/refusing behavior at the CLI seam with a substituted child runner.
2. Implement the smallest fixed command plan and fail-closed target/confirmation parser.
3. Triangulate validation and delegated child failures, then reconcile package scripts and docs.
4. Run the scoped gates and record a no-remote-command attestation in the task evidence.
