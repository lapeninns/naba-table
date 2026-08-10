# GBP final code-quality review

**Verdict: FAIL**  
**codeQualityStatus:** BLOCK  
**recommendation:** REQUEST_CHANGES

## Scope and method

Reviewed the current GBP remediation worktree against base
`a583de5d278b2cb5fd1bda248648a8c303f8c35e`. The current diff SHA-256 was
`76878d58a7283b776e37e065e5d4533901cd3defbe5cec05b65cc2993af0f9c2`, which
does not match the supplied fingerprint; conclusions apply to the live
worktree examined.

Skill-perspective check: **ran**. I read and applied `omo:programming` plus
its TypeScript reference, and `omo:remove-ai-slops`. The diff has no new
`any`, `@ts-ignore`, or duplicated Google mutation client path found in the
reviewed GBP write flow. It does, however, violate the programming/error
handling perspective in the terminal-persistence case below, and has a test
that locks that unsafe behavior instead of the required observable safety
outcome.

Validation independently run:

- `pnpm exec vitest run tests/server/dual-sync-exact-consent.test.ts tests/server/dual-sync-exact-consent-workflow.test.ts tests/server/dual-sync-exact-consent-claimed-execution.test.ts tests/server/google-business-profile/write-permit-bundle.test.ts tests/server/google-business-profile-food-menus-exact-route.test.ts tests/server/dual-sync-queue-worker.test.ts tests/server/dual-sync-remediation-contracts.test.ts` — passed (runner emitted only the existing pnpm-field warning).
- `pnpm typecheck` — passed (same pnpm-field warning).
- `git diff --check <base>` — passed.

## Findings

### CRITICAL

None.

### MAJOR

1. **The database manifest constraint rejects the supported profile write renderer.**

   `server/dual-sync/publish/exact-consent/adapter.ts:155-157` creates the
   supported profile resource exactly as `locations/${locationId}`. The only
   matching branch in `issue_gbp_write_bundle_v1` is
   `v_item.google_resource like 'locations/%/' || p_external_location_id`
   at `supabase/migrations/20260809120000_gbp_write_safety_foundation.sql:2011-2015`.
   For a normal location id this pattern requires another path segment before
   the id (for example, `locations/x/location-1`); it does **not** match
   `locations/location-1`. As a result, every supported exact-consent profile
   publish fails during issuance with `GBP grant manifest is invalid`, before
   Google can be called. FoodMenus happens to use the other branch, so focused
   mocks do not expose this.

   Fix: make the SQL resource allowlist exactly match the renderer (for example
   `v_item.google_resource = 'locations/' || p_external_location_id`), retaining
   any additional endpoint patterns only where a corresponding renderer exists.
   Add a migration/RPC integration regression that submits both the profile and
   FoodMenus resource forms; a TypeScript mocked-RPC test is insufficient.

2. **A post-dispatch terminal-persistence failure loses the required outcome classification.**

   Once a provider write has been dispatched, `executeGoogleWrite` calls
   `store.finalize` directly on both the exception path
   (`server/google-business-profile/writePermit.ts:211-215`) and the success
   path (`:219`). If that database call fails after Google accepted the request
   (or after the network outcome became unknowable), its raw failure escapes.
   The grant remains `dispatched`; `expire_gbp_write_grants_v1` only expires
   `granted` rows (`supabase/migrations/20260809120000_gbp_write_safety_foundation.sql:2438-2451`),
   so the safety ledger and terminal-notice process have no eventual
   `outcome_unknown`/terminal state. This is not merely an HTTP error: it
   prevents reconciliation and can leave an operator retrying a write whose
   provider outcome is already unknown.

   Fix: provide a durable fail-safe/reconciler for stranded `dispatched` grants
   and surface a typed outcome-unknown error whenever terminal persistence is
   uncertain. The implementation must ensure a later worker cannot silently
   retry the mutation. Test the real persistence failure path and recovery,
   rather than only a mocked function rejection.

### MEDIUM

1. **The regression test codifies the unsafe terminal-persistence behavior.**

   `tests/server/google-business-profile/write-permit-bundle.test.ts:351-375`
   explicitly requires that an unknown outcome marker is _not_ emitted when
   finalization fails; `:377+` preserves the analogous success-finalization
   escape. This is implementation-mirroring negative coverage and gives false
   confidence for the most safety-sensitive race/failure boundary. Replace it
   with an observable contract: post-dispatch persistence interruption yields
   an outcome-unknown response and a durable reconciliation candidate, and no
   retry can dispatch the same grant.

### LOW

None.

## Slop/maintainability assessment

The code is generally split by responsibility and the exact-consent parsing at
request/queue boundaries is justified. I did not find deletion-only tests,
prose/prompt tests, or a new unsafe duplicate Google write client. The above
test is nevertheless a slop/overfit concern because it pins an internal
failure propagation that conflicts with the required safety behavior.

## Blockers

- Correct the profile-resource SQL allowlist and prove the actual RPC accepts
  the renderer's `locations/{locationId}` manifest.
- Make post-dispatch finalization failure fail closed as a durable,
  reconcilable `outcome_unknown` state, with a non-retryable operator result;
  replace the current contrary mock test with that behavioral regression.
