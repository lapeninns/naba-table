## Risk tier

High. This task covers auth, tenant isolation, secret exposure, Supabase migrations/RPC privileges, public booking behavior, webhooks, and scanner closure evidence across ops and guest/public API surfaces.

## Affected surfaces and files

- Task packet and artifacts under `tasks/security-findings-sweep-20260527-1111/`.
- Scanner and closure docs under `docs/security/**` if a repo-level closure table update is useful.
- Potential route/server/test files identified by the 35-row matrix after evidence gathering.
- Potential Supabase migration and migration test files if still-existing RPC privilege gaps are confirmed.

## Route/API identity

See `research.md`. Keep the table current before editing any route/API boundary.

## Shared-ownership decision

No shared UI primitives are planned. If code review finds a required change under `components/ui/**`, `src/components/ui/**`, or shared exported UI primitives, stop and update this plan before editing.

## Success criteria

- A 35-row task-local remediation matrix exists with every row classified as `needs-code`, `already-fixed-needs-evidence`, `historical-leak-needs-rotation`, or `missing-path-needs-closure-note`.
- Matching scanner finding URLs/paths, current code evidence, test evidence, and remaining external actions are recorded without plaintext secrets.
- Any still-existing plaintext credentials in tracked files or task artifacts are removed or redacted.
- Any confirmed current dangerous service-only `SECURITY DEFINER` RPC privileges are hardened with a migration and migration assertions.
- Current API/auth routes in scope either have code/test hardening or evidence-backed closure notes.
- Required gates are run or recorded as blocked/not run with exact reason.
- Existing dirty auto-complete files remain untouched by this task.

## Implementation sequence

1. Snapshot worktree state and task constraints.
2. Build the scanner-row matrix from local CSV/finding files and current code paths.
3. Run current secret scan and targeted plaintext-credential search without printing secrets.
4. Inventory current `SECURITY DEFINER` RPCs and privilege revocations/assertions.
5. Audit current routes for confirmation-token detail access, assignment context, booking lifecycle CSRF, Resend webhook auth, customers SSR behavior, team/profile invite remnants, occasions, and public booking capacity fail-closed behavior.
6. Implement only confirmed `needs-code` fixes, preserving unrelated dirty files.
7. Add or update targeted regression tests.
8. Run required gates and record exact outcomes.
9. Perform independent review and update closure docs/task artifacts.

## Verification plan

- `pnpm run secret:scan`
- `pnpm run security:guard:service-role`
- `pnpm run security:regression`
- `pnpm run typecheck`
- Targeted eslint for changed `src/**` files
- Targeted Vitest for any changed route/RPC behavior
- `pnpm validate:env` before any Supabase remote validation
- Supabase migration dry-run or staging apply only if credentials and target confirmation are available
- Scanner rerun with same Codex Security/deepsec profile if available; otherwise record `not rerun`

## Stop rules

- Stop before remote Supabase writes if `APP_ENV`, `DB_TARGET_ENV`, and target project/ref cannot be confirmed.
- Stop before editing dirty auto-complete files.
- Stop and re-plan if the missing 35-row CSV cannot be reconciled with local scanner evidence enough to produce row-level closure.
- Stop if a route/API identity row becomes ambiguous.
