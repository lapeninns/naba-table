# GBP Final Review 2 — Security

## recommendation

PASS

No evidence-backed tenant-isolation, OAuth binding, write-grant replay/retry, Pub/Sub authentication, credential-protection, privacy/no-store, retention, or sensitive-logging failure was reproduced in the current shared worktree relative to base `a583de5d278b2cb5fd1bda248648a8c303f8c35e`.

Reviewed source fingerprint: `7fa1ff4b71354b28d669efdcc87a5c663e9663ec2bf29c7649858b078041fdd2`.

Fresh re-stamp verdict: **PASS**. The final post-review delta only normalizes generated `next-env.d.ts` to the committed production import. It changes no executable product logic, test behavior, route, authorization boundary, OAuth state binding, grant/RPC behavior, Pub/Sub control, credential handling, privacy header, retention path, or logging behavior. The preceding route-documentation corrections also remain non-executable and preserve the security conclusions below.

## originalIntent

Ship comprehensive Google Business Profile remediation in which every operation remains tenant-scoped, OAuth completion is bound to the initiating browser/user/restaurant and is non-replayable, provider writes require exact one-shot grants and fail stop after dispatch uncertainty, Pub/Sub ingress is authenticated and deduplicated, credentials stay encrypted and server-only, and private provider-derived data is neither cached nor leaked through logs or unbounded retention.

## desiredOutcome

An operator can connect and manage only an authorized restaurant. Forged or replayed callbacks, stale grants, wrong Pub/Sub identities/subscriptions, cross-tenant identifiers, credential ciphertext moved between profiles, and secret-bearing errors all fail closed. A provider dispatch can never be silently replayed after an ambiguous result. Private GBP responses are non-cacheable and retained content is bounded and purgeable.

## userOutcomeReview

The current implementation satisfies the locally testable security outcome. Restaurant routes retain authorization before service-role/provider work; OAuth state is hashed server-side, tied to requesting user and restaurant, checked against current admin membership, and atomically completed with the identity/credential write. The callback now obtains `expectedRestaurantId` from a strict browser state-cookie payload and passes it to completion; completion rejects a missing tenant and rejects a state row for another restaurant. The cookie's tenant field is not independently signed, but altering it cannot authorize another tenant because the high-entropy state token must match in constant time and the server-side state row must match both the requesting user and supplied restaurant before code exchange/persistence.

Exact-consent writes bind tenant, profile/listing identity, generation, consent epoch, ordered masks/hashes, actor, expiry, bundle, grant, execution and order. Dispatch and terminalization use fenced RPCs; queued write jobs are forced to one attempt; dispatched-but-unsettled recovery resolves to `outcome_unknown` and remaining work is cancelled rather than replayed. Pub/Sub pins RS256, Google issuer, exact audience, verified service-account email and configured subscription, then stores only bounded metadata/hash through atomic dedupe/enqueue persistence. Credential encryption uses per-profile AAD and server-only persistence paths. Reviewed routes apply private `no-store`; durable Google audit/error values redact token-like keys and strings; request-log pruning is capped, supports dry run, and deletes content rather than laundering it into an archive.

## security criteria

| Criterion                                                      | Result | Reproduced evidence                                                                                                                                                                                                                                          |
| -------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SEC-1 Tenant isolation and authorization                       |   PASS | `requireAdminMembership` precedes OAuth completion; state row, expected restaurant, requesting user and RPC identities are checked; adversarial callback and authorization-flow tests passed.                                                                |
| SEC-2 OAuth callback state/nonce binding and replay resistance |   PASS | Canonical callback passes cookie-derived `expectedRestaurantId`; strict versioned cookie parsing and constant-time state comparison; server-side SHA-256 state lookup, nonce binding and atomic completion; callback/authorization/OIDC tests passed.        |
| SEC-3 Permit/grant fail-stop and recovery                      |   PASS | Exact ordered grant bundle, per-grant dispatch/finalize RPCs, one-attempt queue behavior, `outcome_unknown` recovery and no automatic second provider call; exact-consent and queue tests passed; current recovery evidence reports 6 files/81 tests passed. |
| SEC-4 Pub/Sub authentication and persistence                   |   PASS | RS256/issuer/audience/expiry validation, `email_verified: true`, exact service account and subscription, bounded envelope, metadata-only hash, atomic dedupe/enqueue; Pub/Sub tests passed.                                                                  |
| SEC-5 Credential protection                                    |   PASS | AES-GCM envelope/profile AAD paths and server-only credential repository reviewed; token/identity tests passed; no plaintext credential logging found in inspected paths.                                                                                    |
| SEC-6 No-store/privacy                                         |   PASS | Callback and Pub/Sub responses emit private/no-store controls and appropriate `Vary`; privacy assertions passed.                                                                                                                                             |
| SEC-7 Retention                                                |   PASS | Capped selection/deletion, dry-run behavior and no content archiving; retention tests passed.                                                                                                                                                                |
| SEC-8 Logging and telemetry redaction                          |   PASS | Callback logs booleans/error class rather than state/code/error payload; safe telemetry and durable audit/error sanitizers exercised by tests.                                                                                                               |

## reproducedEvidence

- `./node_modules/.bin/vitest run` over 13 focused security files: **PASS — 13 files, 104 tests**.
- Covered canonical and legacy callback routes, authorization flow/runtime, OAuth token and identity verification, Pub/Sub auth/parser/persistence, exact consent, queue worker, request-log retention/storage, audit redaction and final control assertions.
- `git diff --check a583de5d278b2cb5fd1bda248648a8c303f8c35e`: **PASS**.
- `.omo/evidence/gbp-final-dispatched-grant-recovery-focused.log`: **PASS — 6 files, 81 tests**.
- `.omo/evidence/gbp-final-dispatched-grant-recovery-manual-audit.log`: `MANUAL_NO_EXCUSE_FORBIDDEN_PATTERNS=0`.

## direct programming / remove-ai-slops pass

- Approval does not rely on deletion-only, prose-pinning, tautological, or implementation-mirroring tests. The focused tests distinguish hostile state/cookie/tenant/JWT/subscription/grant/error inputs and observable rejection or terminal outcomes.
- Route mocks are supported by direct inspection of the server-side state/grant/RPC boundaries and the existing PostgreSQL/concurrency evidence. No unnecessary parser, normalization layer, or production extraction was needed to justify the security behavior.
- The versioned OAuth cookie parser is justified boundary code: it rejects malformed/non-canonical payloads and supplies the tenant value required for the server-side row match. It does not replace the authoritative database check.
- Large modules and source-contract tests remain maintenance/false-confidence risks if treated alone, but neither violates a stated security criterion because behavioral and database evidence exists for the critical controls.

## blockers

None for the local implementation security gate.

## risks and exactEvidenceGaps

- **External release gates remain open:** no live staging OAuth redirect/OIDC journey, applied migration/RPC privilege readback, Pub/Sub IAM/audience/signed-push proof, key-rotation readback, backup/PITR proof, retention census, canary grants/restoration, or deployed environment/cron verification was reproduced. Production rollout must remain disabled until those artifacts exist.
- `server/dual-sync/pubsub/parser.ts` reads `request.arrayBuffer()` before enforcing the actual 64 KiB body limit when `Content-Length` is absent. Authentication occurs first and limits reachability to the configured Google push identity, so this is defense in depth rather than a reproduced security-criterion failure; streaming enforcement would reduce memory-amplification risk.
- The exact authoritative reviewed source fingerprint is `7fa1ff4b71354b28d669efdcc87a5c663e9663ec2bf29c7649858b078041fdd2`. The final delta only normalized generated `next-env.d.ts`; no product-source or test behavior changed, so the reproduced security evidence remains applicable.
- Local tests and source inspection do not substitute for remote RLS/RPC execution against the deployed schema.

## checkedArtifactPaths

- `src/app/api/ops/google-business-profile/callback/route.ts`
- `src/app/api/ops/restaurants/[id]/google-business/callback/route.ts`
- `server/google-business-profile/oauth-state-cookie.ts`
- `server/google-business-profile/serviceOAuthState.ts`
- `server/google-business-profile/serviceAuthorizationFlow.ts`
- `server/google-business-profile/serviceAuthorizationRuntime.ts`
- `server/google-business-profile/clientAuth.ts`
- `server/google-business-profile/clientIdentity.ts`
- `server/google-business-profile/crypto.ts`
- `server/dual-sync/publish/exact-consent/**`
- `server/dual-sync/queue/worker.ts`
- `server/dual-sync/pubsub/**`
- `src/app/api/webhooks/google-business-profile/pubsub/route.ts`
- `server/dual-sync/publish/google-audit.ts`
- `server/dual-sync/publish/google-request-logs.ts`
- `server/dual-sync/publish/google-request-log-retention.ts`
- `supabase/migrations/20260809120000_gbp_write_safety_foundation.sql`
- `tests/server/google-business-profile-callback-route.test.ts`
- `tests/server/google-business-profile-service-authorization-flow.test.ts`
- `tests/server/google-business-profile-service-authorization-runtime.test.ts`
- `tests/server/google-business-profile/client-auth.test.ts`
- `tests/server/google-business-profile/client-identity.test.ts`
- `tests/server/dual-sync-pubsub.test.ts`
- `tests/server/dual-sync-pubsub-persistence.test.ts`
- `tests/server/dual-sync-exact-consent.test.ts`
- `tests/server/dual-sync-queue-worker.test.ts`
- `tests/server/dual-sync-google-request-log-retention.test.ts`
- `tests/server/dual-sync-google-request-logs.test.ts`
- `tests/server/dual-sync-google-audit.test.ts`
- `tests/server/deepsec-final-controls-source.test.ts`
- `.omo/evidence/gbp-final-review-security.md`
- `.omo/evidence/gbp-final-dispatched-grant-recovery-focused.log`
- `.omo/evidence/gbp-final-dispatched-grant-recovery-manual-audit.log`
