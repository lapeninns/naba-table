## Objective

Run a high-risk security closure sweep for the user-selected 35 scanner findings, preserving unrelated dirty auto-complete work and leaving replayable evidence.

## Repo facts

- The checkout is on `main`, behind `origin/main` by 5 commits.
- The worktree was already dirty before this task in:
  - `server/jobs/auto-complete-bookings.ts`
  - `server/ops/booking-lifecycle/actions.ts`
  - `tests/server/jobs/auto-complete-bookings.test.ts`
- The only tracked CSV found in this checkout is `docs/security/deepsec-backlog.csv`; it currently contains 558 finding rows plus a header, not 35 rows.
- `docs/security/closure-matrix.md` exists and is root-cause oriented, but it is not a scanner-row closure table.
- Security commands exposed by `package.json` include `secret:scan`, `security:guard:service-role`, `security:regression`, `typecheck`, and `validate:env`.
- Supabase is remote-only and staging-first. Local migration tests may inspect SQL, but they do not prove remote apply.

## Assumptions and tradeoffs

- The phrase "all 35 CSV findings" refers to a user-selected scanner export or view that is not present as a 35-row CSV file in the current checkout.
- Because the only local CSV has 558 rows, this sweep will build a task-local matrix for the 35-finding scope described by the user and link matching local `.deepsec/findings/**` paths where available.
- Historical credential exposure cannot be closed by code deletion alone; any leaked real credential remains `historical-leak-needs-rotation` until external rotation evidence is attached.
- Current dirty auto-complete files are unrelated and out of scope. They must not be edited by this task.

## Constraints

- Secrets must not be printed into logs, task artifacts, or docs.
- Mutating cookie-authenticated APIs must require CSRF before body parsing where the route parses attacker-controlled request bodies.
- Service-role handlers must perform route-level auth and tenant/resource checks before service-role reads or writes.
- Service-only `SECURITY DEFINER` RPCs must not be executable by `PUBLIC`, `anon`, or `authenticated`.
- Scanner closure cannot be claimed from local tests alone; record `not rerun` if the scanner cannot be rerun.

## Risks

- The missing 35-row CSV can cause incomplete row-level closure if the selected scanner view differs from local `.deepsec` data.
- Remote Supabase validation may be blocked if env credentials or target confirmation are unavailable.
- Broad security changes can accidentally cross guest/public and ops surfaces.
- Editing historical generated artifacts can introduce noise; prefer closure notes unless a tracked plaintext secret is still present.

## Reuse notes

- `docs/security/deepsec-remediation-board.md` defines fixed criteria for scanner closure.
- `docs/security/closure-matrix.md` already tracks root-cause closure status and scanner rerun requirements.
- Existing security regression tests include CSRF, service-role guard, soft-hold RPC security, customers, public bookings, and webhook/auth coverage.

## Non-goals

- Do not pull, rebase, or merge `origin/main`.
- Do not edit the existing dirty auto-complete files unless the user expands scope.
- Do not perform production credential rotation without explicit validated access and target confirmation.
- Do not mark scanner findings closed without a scanner rerun or explicit "not rerun" gap.

## Route/API identity

| Host context | External path | Internal file or handler | Expected proxy behavior | Auth expectation |
| ------------ | ------------- | ------------------------ | ----------------------- | ---------------- |
| App API host | `/api/ops/occasions` | `src/app/api/ops/occasions/route.ts` | Direct Next API handler; app host protected by ops auth/proxy context | Authenticated ops caller; backend authorization required before service-role writes |
| App API host | `/api/ops/occasions/[key]` | `src/app/api/ops/occasions/[key]/route.ts` | Direct Next API handler; app host protected by ops auth/proxy context | Authenticated ops caller; backend authorization required before service-role writes |
| App API host | `/api/ops/bookings/[id]/assignment-context` | `src/app/api/ops/bookings/[id]/assignment-context/route.ts` | Direct Next API handler; app host protected by ops auth/proxy context | Authenticated restaurant member for the booking restaurant before service-role reads |
| App API host | `/api/ops/bookings/[id]/{status,check-in,check-out,no-show,tables,assign-tables}` | `src/app/api/ops/bookings/[id]/**/route.ts` and shared lifecycle helpers | Direct Next API handlers; app host protected by ops auth/proxy context | Cookie-authenticated mutation with CSRF and restaurant/resource authorization |
| Root/public API host | `/api/bookings/[id]` | `src/app/api/bookings/[id]/route.ts` | Direct Next API handler; no app-host redirect | Authenticated session or valid guest recovery/confirmation token; guest-safe DTO only |
| Root/public API host | `/api/bookings` | `src/app/api/bookings/route.ts` | Direct Next API handler; no app-host redirect | Public booking create/list with fail-closed capacity behavior and guest-safe responses |
| Any API host | `/api/webhooks/resend` | `src/app/api/webhooks/resend/route.ts` | Direct Next API handler if route exists | Public webhook authenticated by provider signature/secret; fail closed if unset |
| Any API host | `/api/webhook/resend` | `src/app/api/webhook/resend/route.ts` | Direct Next API handler if route exists | Public webhook authenticated by provider signature/secret; fail closed if unset |
| App API host | `/api/ops/customers` | `src/app/api/ops/customers/route.ts` | Direct Next API handler; app host protected by ops auth/proxy context | Authenticated restaurant member scoped to selected restaurant |
| App API host | `/api/ops/customers/export` | `src/app/api/ops/customers/export/route.ts` | Direct Next API handler; app host protected by ops auth/proxy context | Authenticated restaurant member scoped to selected restaurant |
